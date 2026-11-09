import { RuntimeContext } from './runtime_context.ts';
import { eventBus } from './event/event_bus.ts';
import { CapabilityRegistry } from './adapters/adapter_registry.ts';
import { pesanSemuaPenyediaGagal } from './streaming/pesan_gagal_stream.ts';
import { catatPanggilanModel, type JejakPrompt } from './jejak_prompt.ts';




const PROVIDER_COOLDOWN_DURATIONS: Record<string, number> = {
  'gemini': 60000,
  'openrouter': 60000,
  'groq': 3600000
};


export const callLLMWithMetadata = async (
  promptText: string,
  systemPromptText = '',
  chatHistory: any[] = [],
  preferredProvider: string = 'openrouter',
  extractedImage: { mimeType: string; data: string } | null = null,
  rctx: RuntimeContext,
  tools: string[] = [],
  opsi: { onNalar?: (teks: string) => void; onIsiMulai?: () => void; thinking?: boolean; tenggat?: number } = {}
): Promise<{ result: string; metadata?: any; reasoning?: string; terpotong?: boolean }> => {
  await CapabilityRegistry.initializeAdapters(rctx);

  const buildPayload = (tools: string[] = []) => {
    let staticSystemPrompt = systemPromptText || '';
    let dynamicContextInject = '';

    if (systemPromptText) {
      const dynamicBlockRegex = /(<RAG>[\s\S]*?<\/RAG>|<MEMORY>[\s\S]*?<\/MEMORY>|<EXECUTION_TRACE[^/]*\/>)/g;
      const dynamicBlocks: string[] = [];
      staticSystemPrompt = systemPromptText.replace(dynamicBlockRegex, (match: string) => {
        dynamicBlocks.push(match);
        return '';
      }).trim();

      if (dynamicBlocks.length > 0) {
        dynamicContextInject = `[KONTEKS REFERENSI UNTUK PERTANYAAN INI]\n\n${dynamicBlocks.join('\n\n')}`;
      }
    }

    const payload: any = { contents: [] };
    if (staticSystemPrompt) payload.systemInstruction = { parts: [{ text: staticSystemPrompt }] };

    if (dynamicContextInject) {
      payload.contents.push({ role: 'user', parts: [{ text: dynamicContextInject }] });
      payload.contents.push({ role: 'model', parts: [{ text: 'Baik, saya telah membaca konteks referensi tersebut.' }] });
    }

    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        payload.contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    const userParts: any[] = [{ text: promptText }];
    if (extractedImage) {
      userParts.push({ inlineData: { mimeType: extractedImage.mimeType, data: extractedImage.data } });
    }
    payload.contents.push({ role: 'user', parts: userParts });

    
    if (tools.includes('web_search')) {
      payload.tools = [{ googleSearch: {} }];
    }
    
    payload.generationConfig = { maxOutputTokens: 8192 };
    
    return payload;
  };

  let cascadeOrder: Array<string> = [];
  
  if (preferredProvider) {
    cascadeOrder = [preferredProvider];
  } else {
    cascadeOrder = ['openrouter'];
  }

  const availableAdapters = CapabilityRegistry.getAvailableAIAdapters(cascadeOrder);

  console.log(`🎯 Using provider: ${availableAdapters.map(a => a.name).join(' -> ')}`);

  const payload = buildPayload(tools);
  let lastError = '';

  if (availableAdapters.length === 0) {
    lastError = `Provider '${preferredProvider}' not available or not configured.`;
  }

  for (const adapter of availableAdapters) {
    console.log(`📍 Executing Capability Adapter: ${adapter.name}`);
    
    try {
      const modelCocokUntukAdapter =
        adapter.name === 'GeminiAdapter' && rctx.model.model && !/gemini/i.test(rctx.model.model)
          ? undefined
          : rctx.model.model;

      if (modelCocokUntukAdapter !== rctx.model.model) {
        console.log(`[Cascade] "${rctx.model.model}" bukan model Gemini — GeminiAdapter memakai model bawaannya`);
      }

      const adapterInput = {
        promptText,
        systemPromptText,
        chatHistory,
        payload,
        forceDefaultModel: (adapter.name === 'OpenRouterAdapter' && preferredProvider !== 'openrouter') ? true : false,
        model: modelCocokUntukAdapter,
        thinking: opsi.thinking,
        onNalar: opsi.onNalar,
        onIsiMulai: opsi.onIsiMulai,
        tenggat: opsi.tenggat
      };

        const result = await adapter.execute(adapterInput, { trace_id: rctx.traceId || rctx.tasks?.traceId || 'unknown' });
      
      if (result && (result.result || result.terpotong)) {
        if (!rctx.stream.isStream) {
          const modelTercatat = result.modelUsed || rctx.model.model || 'auto';
          rctx.logger.logApiUsage(result.source, modelTercatat, promptText + systemPromptText, result.result, result.usageCostUsd);
        }
        console.log(`✅ ${adapter.name} succeeded`);
        eventBus.emit({ type: 'Capability.Executed', source: adapter.name, payload: { success: true, rctx } });
        return { result: result.result || '', metadata: result.metadata, reasoning: result.reasoning, terpotong: result.terpotong === true };
      }

      console.log(`⚠️  ${adapter.name} returned empty.`);
      lastError = `Provider '${adapter.name}' returned empty response.`;
      
    } catch (err: any) {
      const message = String(err.message || err);
      lastError = `Provider '${adapter.name}' failed: ${message}`;
      const isRateLimit = message.includes('429') || message.includes('rate limit') || message.includes('RATE_LIMIT') || message.includes('quota');
      
      const providerKey = adapter.name.toLowerCase().replace('adapter', '');
      
      if (isRateLimit) {
        console.log(`🚫 Adapter ${adapter.name} hit rate limit (429), locking for ${PROVIDER_COOLDOWN_DURATIONS[providerKey] || 60000}ms`);
        CapabilityRegistry.lockProvider(providerKey, PROVIDER_COOLDOWN_DURATIONS[providerKey] || 60000);
        await rctx.logger.logAgentEvent('RATE_LIMIT_HIT', providerKey, `429 Error: ${message.substring(0, 200)}`);
      } else {
        await rctx.logger.logAgentEvent('PROVIDER_ERROR', providerKey, `Error: ${message.substring(0, 200)}`);
      }
      console.warn(`❌ Adapter ${adapter.name} failed: ${message}`);
    }
  }

  throw new Error(lastError || `Provider '${preferredProvider}' failed to respond.`);
};

export const callLLMWithCascade = async (
  promptText: string,
  systemPromptText = '',
  chatHistory: any[] = [],
  preferredProvider: string = 'openrouter',
  extractedImage: { mimeType: string; data: string } | null = null,
  rctx: RuntimeContext
): Promise<string> => {
  const res = await callLLMWithMetadata(promptText, systemPromptText, chatHistory, preferredProvider, extractedImage, rctx, []);
  return res.result;
};

export function catatKomposisiPrompt(promptText: string, systemPromptText: string, chatHistory: any[], jejak?: JejakPrompt | null) {
  const s = systemPromptText || '';
  const awalKontrak = s.indexOf('[UNIVERSAL EVIDENCE CONTRACT');
  if (awalKontrak < 0) {
    catatPanggilanModel(jejak, { utama: false, sistemHuruf: s.length, pesanHuruf: (promptText || '').length, riwayat: chatHistory, segmen: {} });
    return;
  }
  const cari = (penanda: string) => s.indexOf(penanda, awalKontrak);
  const blok4 = cari('[BLOK 4:');
  const segmen = ([
    ['dasar_identitas_panduan', 0],
    ['memori_personal_klien', s.search(/\[MEMORI & (PREFERENSI PERSONAL|KONTEKS SISTEM)\]/)],
    ['konteks_engineer', s.indexOf('[MAMET ENGINEER CONTEXT')],
    ['kontrak_blok1_2', awalKontrak],
    ['blok3_memori', cari('[BLOK 3:')],
    ['blok4_brain', blok4],
    ['blok4_rag', blok4 >= 0 ? s.indexOf('<RAG>', blok4) : -1],
    ['blok5_constraint', cari('[BLOK 5:')],
    ['blok6_format', cari('[BLOK 6:')],
  ] as [string, number][]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);

  const ukuran: Record<string, number> = {};
  segmen.forEach(([nama, i], k) => {
    const akhir = k + 1 < segmen.length ? segmen[k + 1][1] : s.length;
    ukuran[nama] = akhir - i;
  });
  const riwayat = Array.isArray(chatHistory) ? chatHistory : [];
  const hurufRiwayat = riwayat.reduce((n, m) => n + String(m?.content ?? '').length, 0);
  const hurufPesan = (promptText || '').length;
  catatPanggilanModel(jejak, { utama: true, sistemHuruf: s.length, pesanHuruf: hurufPesan, riwayat, segmen: ukuran });
  console.log(`[PROMPT_KOMPOSISI] sistem=${s.length} ${JSON.stringify(ukuran)} | riwayat=${riwayat.length} pesan/${hurufRiwayat} huruf | pesan=${hurufPesan} | total=${s.length + hurufRiwayat + hurufPesan} huruf`);
}

export const runLLMDenganNalar = async (
  promptText: string, systemPromptText = '', chatHistory: any[] = [], rctx: RuntimeContext,
  opsi: { onNalar?: (teks: string) => void; onIsiMulai?: () => void; tenggat?: number; thinking?: boolean } = {}
): Promise<{ result: string; metadata?: any; reasoning?: string; terpotong?: boolean }> => {
  catatKomposisiPrompt(promptText, systemPromptText, chatHistory, rctx?.jejakPrompt);

  let preferredProvider = 'openrouter';

  const uiProviderRaw =
    (rctx as any)?.model?.provider ||
    (rctx as any)?.model?.selectedProvider ||
    (rctx as any)?.state?.provider ||
    (rctx as any)?.state?.selectedProvider;

  const uiProvider = typeof uiProviderRaw === 'string' ? uiProviderRaw.toLowerCase() : null;

  if (uiProvider === 'openrouter') preferredProvider = 'openrouter';
  else if (uiProvider === 'openai') preferredProvider = 'openai';
  else if (uiProvider === 'groq') preferredProvider = 'groq';
  else if (uiProvider === 'gemini') preferredProvider = 'gemini';
  else {
    if (!rctx.stream.extractedImage && rctx.model.model) {
      if (typeof rctx.model.model === 'string' && rctx.model.model.includes('/')) {
        preferredProvider = 'openrouter';
      } else {
        if (rctx.model.model.includes('gpt') && !rctx.model.model.includes('openrouter')) {
          preferredProvider = 'openai';
        } else if (rctx.model.model.includes('openrouter') || rctx.model.model.startsWith('openrouter/')) {
          preferredProvider = 'openrouter';
        } else if (rctx.model.model.startsWith('groq/')) {
          preferredProvider = 'groq';
        }
      }
    }
  }

  console.log('[DEBUG][runLLM] rctx.model=', (rctx as any)?.model, ' uiProvider=', uiProvider, ' preferredProvider=', preferredProvider);
  console.log(`🔄 runLLM delegated to Capability Registry with preferred provider: ${preferredProvider}`);
  return await callLLMWithMetadata(promptText, systemPromptText, chatHistory, preferredProvider, rctx.stream.extractedImage, rctx, [], opsi);
};

export const runLLM = async (promptText: string, systemPromptText = '', chatHistory: any[] = [], rctx: RuntimeContext): Promise<string> =>
  (await runLLMDenganNalar(promptText, systemPromptText, chatHistory, rctx)).result;

export const runStreamLLM = async function*(promptText: string, systemPromptText = '', chatHistory: any[] = [], rctx: RuntimeContext): AsyncGenerator<string, void, unknown> {
  catatKomposisiPrompt(promptText, systemPromptText, chatHistory, rctx?.jejakPrompt);
  await CapabilityRegistry.initializeAdapters(rctx);
  const input = { promptText, systemPromptText, chatHistory, image: rctx.stream.extractedImage };

  let preferredAdapters: string[] = [];

  const uiProviderRaw =
    (rctx as any)?.model?.provider ||
    (rctx as any)?.model?.selectedProvider ||
    (rctx as any)?.state?.provider ||
    (rctx as any)?.state?.selectedProvider;

  const uiProvider = typeof uiProviderRaw === 'string' ? uiProviderRaw.toLowerCase() : null;

  if (!input.image) {
    if (uiProvider === 'openrouter') preferredAdapters.push('openrouter');
    else if (uiProvider === 'openai') preferredAdapters.push('openai');
    else if (uiProvider === 'groq') preferredAdapters.push('groq');

    if (preferredAdapters.length === 0) {
      if (rctx.model.model && typeof rctx.model.model === 'string' && rctx.model.model.includes('/')) {
        preferredAdapters.push('openrouter');
      } else {
        if (rctx.model.model && rctx.model.model.includes('gpt') && !rctx.model.model.includes('openrouter')) preferredAdapters.push('openai');
        if (rctx.model.model && (rctx.model.model.includes('openrouter') || rctx.model.model.startsWith('openrouter/'))) preferredAdapters.push('openrouter');
        if (rctx.model.model && rctx.model.model.startsWith('groq/')) preferredAdapters.push('groq');
      }
    }
  }

  console.log('[DEBUG][runStreamLLM] rctx.model=', (rctx as any)?.model, ' uiProvider=', uiProvider, ' preferredAdapters=', preferredAdapters);

  for (const p of ['gemini', 'groq', 'openrouter']) {
     if (!preferredAdapters.includes(p)) preferredAdapters.push(p);
  }

  const availableAdapters = CapabilityRegistry.getAvailableAIAdapters(preferredAdapters);
  let lastError = '';
  
  if (availableAdapters.length === 0) {
      yield `\n\n**Internal Server Error:** No AI adapters available. Check API keys.\n\n`;
      return;
  }

  for (const adapter of availableAdapters) {
     try {
       console.log(`📍 Streaming via Capability Adapter: ${adapter.name}`);
       const streamIter = adapter.stream(input, { trace_id: rctx.traceId || rctx.tasks?.traceId || 'unknown' });
       const firstResult = await streamIter.next();
       
       if (!firstResult.done && firstResult.value) {
          yield firstResult.value;
       }
       
       yield* streamIter;
       return;
     } catch(err: any) {
       const msg = err.message || String(err);
       console.warn(`❌ Adapter ${adapter.name} stream failed: ${msg}`);
       if (msg.includes('FATAL_CLIENT_ERROR')) {
           yield `\n\n**[SYSTEM HALTED] Client Error:** ${msg}\n\n`;
           return;
       }
       lastError += ` [${adapter.name}]: ${msg};`;
     }
  }

  (rctx as any).semuaPenyediaGagal = true;
  yield `\n\n${pesanSemuaPenyediaGagal(lastError)}`;
};

export const runCoordinatorLLM = async (promptText: string, systemPromptText = '', preferFast = false, rctx: RuntimeContext) => {

  return (await callLLMWithMetadata(promptText, systemPromptText, [], 'openrouter', null, rctx, [], { thinking: false })).result;
};

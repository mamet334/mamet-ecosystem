import { RuntimeContext } from './runtime_context.ts';
import { eventBus } from './event/event_bus.ts';
import { CapabilityRegistry } from './adapters/adapter_registry.ts';

// API Key state moved to Adapters



// === COOLDOWN CONFIGURATION ===
const PROVIDER_COOLDOWN_DURATIONS: Record<string, number> = {
  'gemini': 60000,        // 60 seconds for Gemini
  'openrouter': 60000,    // 60 seconds for OpenRouter
  'groq': 3600000         // 1 hour for Groq (rentan rate limit)
};

// Cooldown state moved to CapabilityRegistry

export const callLLMWithMetadata = async (
  promptText: string,
  systemPromptText = '',
  chatHistory: any[] = [],
  preferredProvider: string = 'gemini',
  extractedImage: { mimeType: string; data: string } | null = null,
  rctx: RuntimeContext,
  tools: string[] = []
): Promise<{ result: string; metadata?: any }> => {
  await CapabilityRegistry.initializeAdapters(rctx);

  const buildPayload = (tools: string[] = []) => {
    // [PR#6 TOKEN EFFICIENCY] Static/Dynamic split untuk Implicit Caching Gemini non-stream
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
    
    // Batasi output tokens agar tidak melampaui limit/kredit 
    payload.generationConfig = { maxOutputTokens: 8192 };
    
    return payload;
  };

  // Disable cascade - only use the provider selected by user
  let cascadeOrder: Array<string> = [];
  
  if (preferredProvider) {
    cascadeOrder = [preferredProvider];
  } else {
    // Fallback to default only if no provider specified
    cascadeOrder = ['gemini'];
  }

  // Filter available via cooldown check in Registry
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
      // Model pilihan Owner belum tentu cocok dengan adapter yang sedang dicoba.
      // Pola penjagaan ini sudah ada untuk OpenRouterAdapter lewat `forceDefaultModel`
      // (baris di bawah), tapi GeminiAdapter tidak punya padanannya — sehingga model ID
      // provider lain ikut terkirim ke endpoint Google.
      //
      // Akibatnya terukur di log produksi 2026-09-09: runCoordinatorLLM() mematok
      // provider 'gemini' tapi tetap meneruskan model Owner, jadi GeminiAdapter menembak
      // .../models/deepseek%2Fdeepseek-v4-flash-0731:generateContent → 404, diulang
      // 3 key × 3 percobaan × 2 panggilan koordinator = 18 request gagal per pesan,
      // membuang ±6,5 detik sebelum panggilan utama jalan. Lihat Item 38.
      //
      // GeminiAdapter.execute() memakai DEFAULT_GEMINI_MODEL kalau model undefined —
      // sama seperti yang sudah dilakukan jalur stream()-nya.
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
        model: modelCocokUntukAdapter
      };

        const result = await adapter.execute(adapterInput, { trace_id: rctx.traceId || rctx.tasks?.traceId || 'unknown' });
      
      if (result && result.result) {
        if (!rctx.stream.isStream) {
          // result.usageCostUsd = biaya sesungguhnya dari provider kalau dilaporkan.
          // Kalau undefined, logApiUsage jatuh ke perkiraan tabel tarif.
          //
          // Modelnya diambil dari `result.modelUsed` — model yang BENAR-BENAR
          // dipakai adapter — bukan `rctx.model.model` yang hanya model yang
          // diminta. Saat kaskade jatuh ke adapter lain, keduanya berbeda, dan
          // mencatat model yang diminta menghasilkan baris mustahil di
          // `api_usage` seperti provider `gemini` dengan model `deepseek/...`.
          //
          // Ini bukan sekadar label: kalau provider tidak melaporkan biaya,
          // `logApiUsage` mencocokkan nama model ini ke tabel tarif. Nama yang
          // salah berarti tarif yang salah — kelas kesalahan yang sama persis
          // dengan Item 41.
          const modelTercatat = result.modelUsed || rctx.model.model || 'auto';
          rctx.logger.logApiUsage(result.source, modelTercatat, promptText + systemPromptText, result.result, result.usageCostUsd);
        }
        console.log(`✅ ${adapter.name} succeeded`);
        eventBus.emit({ type: 'Capability.Executed', source: adapter.name, payload: { success: true, rctx } });
        return { result: result.result, metadata: result.metadata };
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
  preferredProvider: string = 'gemini',
  extractedImage: { mimeType: string; data: string } | null = null,
  rctx: RuntimeContext
): Promise<string> => {
  const res = await callLLMWithMetadata(promptText, systemPromptText, chatHistory, preferredProvider, extractedImage, rctx, []);
  return res.result;
};

/**
 * [PROMPT_KOMPOSISI] — ukuran tiap bagian prompt JAWABAN UTAMA, dalam huruf (Item 44/66).
 *
 * Token tak bisa dibandingkan antar model — tokenizer gpt-4o-mini dan deepseek menghitung teks
 * yang sama berbeda — jadi yang dicatat jumlah huruf. Hanya untuk prompt yang memuat Universal
 * Evidence Contract (jawaban utama), bukan panggilan kecil (peringkas, router). Penanda dicari
 * SESUDAH awal kontrak, karena teks panduan identitas juga menyebut "<RAG>" dan "[BLOK 4: …]".
 */
export function catatKomposisiPrompt(promptText: string, systemPromptText: string, chatHistory: any[]) {
  const s = systemPromptText || '';
  const awalKontrak = s.indexOf('[UNIVERSAL EVIDENCE CONTRACT');
  if (awalKontrak < 0) return;
  const cari = (penanda: string) => s.indexOf(penanda, awalKontrak);
  const blok4 = cari('[BLOK 4:');
  const segmen = ([
    ['dasar_identitas_panduan', 0],
    ['memori_personal_klien', s.search(/\[MEMORI & (PREFERENSI PERSONAL|KONTEKS SISTEM)\]/)],
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
  console.log(`[PROMPT_KOMPOSISI] sistem=${s.length} ${JSON.stringify(ukuran)} | riwayat=${riwayat.length} pesan/${hurufRiwayat} huruf | pesan=${hurufPesan} | total=${s.length + hurufRiwayat + hurufPesan} huruf`);
}

export const runLLM = async (promptText: string, systemPromptText = '', chatHistory: any[] = [], rctx: RuntimeContext) => {
  if (rctx.policy.canUseDesktopTools && !systemPromptText.includes('DESKTOP NATIVE AWARENESS ENABLED')) {
     systemPromptText += `\n[STATUS: DESKTOP NATIVE AWARENESS ENABLED]\nAnda WAJIB mengeluarkan perintah Windows di dalam tag <terminal>. DILARANG menyebut sub-agent atau menolak. Contoh: <terminal>dir %USERPROFILE%\\Desktop</terminal>\n`;
  }
  catatKomposisiPrompt(promptText, systemPromptText, chatHistory);

  // === PRIORITAS USER-EXPLICIT MODEL SELECTION via UI provider (if provided) ===
  let preferredProvider = 'gemini';

  const uiProviderRaw =
    (rctx as any)?.model?.provider ||
    (rctx as any)?.model?.selectedProvider ||
    (rctx as any)?.state?.provider ||
    (rctx as any)?.state?.selectedProvider;

  const uiProvider = typeof uiProviderRaw === 'string' ? uiProviderRaw.toLowerCase() : null;

  // If UI explicitly chose provider, honor it first (prevents "openai" heuristic from hijacking OpenRouter).
  if (uiProvider === 'openrouter') preferredProvider = 'openrouter';
  else if (uiProvider === 'openai') preferredProvider = 'openai';
  else if (uiProvider === 'groq') preferredProvider = 'groq';
  else if (uiProvider === 'gemini') preferredProvider = 'gemini';
  else {
    // fallback logic
    if (!rctx.stream.extractedImage && rctx.model.model) {
      // CRITICAL FIX:
      // If UI provider is null BUT model id looks like "openai/xxx" (contains '/'),
      // force OpenRouter so we don't accidentally route to OpenAIAdapter.
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
  return await callLLMWithCascade(promptText, systemPromptText, chatHistory, preferredProvider, rctx.stream.extractedImage, rctx);
};

export const runStreamLLM = async function*(promptText: string, systemPromptText = '', chatHistory: any[] = [], rctx: RuntimeContext): AsyncGenerator<string, void, unknown> {
  catatKomposisiPrompt(promptText, systemPromptText, chatHistory);
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
    // honor UI provider first
    if (uiProvider === 'openrouter') preferredAdapters.push('openrouter');
    else if (uiProvider === 'openai') preferredAdapters.push('openai');
    else if (uiProvider === 'groq') preferredAdapters.push('groq');

    // fallback inference if uiProvider not provided
    if (preferredAdapters.length === 0) {
      // CRITICAL FIX (stream path):
      // model like "openai/gpt-4o-mini" must route to openrouter adapter.
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

  // Append cascade
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
       // Peek the first chunk to catch connection errors early
       const firstResult = await streamIter.next();
       
       if (!firstResult.done && firstResult.value) {
          yield firstResult.value;
       }
       
       // If no error on first chunk, we are connected and locked in. 
       // Yield the rest.
       yield* streamIter;
       return; // Success, end cascade
     } catch(err: any) {
       const msg = err.message || String(err);
       console.warn(`❌ Adapter ${adapter.name} stream failed: ${msg}`);
       if (msg.includes('FATAL_CLIENT_ERROR')) {
           yield `\n\n**[SYSTEM HALTED] Client Error:** ${msg}\n\n`;
           return;
       }
       lastError += ` [${adapter.name}]: ${msg};`;
       yield `\n\n*(Fallback Note: ${adapter.name} failed, cascading...)*\n\n`;
     }
  }

  yield `\n\n**Semua AI Provider sedang limit atau gangguan.**\nDetail error: ${lastError}`;
};

// --- OTAK KHUSUS KEPALA AGENT (HEMAT KUOTA) + ANTI-LIMIT ---
export const runCoordinatorLLM = async (promptText: string, systemPromptText = '', preferFast = false, rctx: RuntimeContext) => {
  // === NOTE: Groq is temporarily disabled, so preferFast will use default cascade ===
  // if (preferFast && rctx.keys.groq && !isProviderLocked('groq')) {
  //   try {
  //     console.log("Mamet Traffic Light: Memutar tugas ringan (Intent Router) ke Groq...");
  //     return await callGroq(promptText, systemPromptText, [], rctx);
  //   } catch(e) { console.warn('Traffic Light Groq failed, cascading to Gemini...', e); }
  // }

  // Always use default cascade: Gemini -> OpenRouter
  return await callLLMWithCascade(promptText, systemPromptText, [], 'gemini', null, rctx);
};

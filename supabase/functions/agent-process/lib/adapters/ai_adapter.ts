import { CapabilityAdapter, AdapterContext, AdapterResult } from './capability_adapter.ts';
import { RuntimeContext } from '../runtime_context.ts';
import { checkGuardrails, recordUsage } from '../cost/costTracker.ts';
import { kirimOpenRouterDenganReasoning, teksNalar, pembungkusNalarStream, bacaSseOpenRouter, MAKS_TOKEN_JAWABAN, pesanSaldoTakCukup, terpotongKarenaPlafon, pesanTerpotongPlafon } from './reasoning_openrouter.ts';
import { plafonUntukPermintaan, ingatPlafonTerjangkau } from './kemampuan_model.ts';

async function* processOpenAIStream(res: Response, info?: { provider?: string; sebabSelesai?: string }, tampilkanNalar = false): AsyncGenerator<string, void, unknown> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No body");
  let buffer = '';
  const bungkus = pembungkusNalarStream();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (info && !info.provider && typeof data.provider === 'string' && data.provider) info.provider = data.provider;
          const fr = data.choices?.[0]?.finish_reason;
          if (info && typeof fr === 'string' && fr) info.sebabSelesai = fr;
          const delta = data.choices?.[0]?.delta;
          const content = delta?.content || '';
          const keluar = bungkus.potong(tampilkanNalar ? teksNalar(delta) : '', content);
          if (keluar) yield keluar;
        } catch(e) {}
      }
    }
  }
  const penutup = bungkus.akhir();
  if (penutup) yield penutup;
}


const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type ThinkingProvider = 'openrouter' | 'openai' | 'groq';

function applyThinking(
  body: Record<string, any>,
  provider: ThinkingProvider,
  enabled?: boolean
): Record<string, any> {
  if (enabled !== true) return body;
  console.log(`[Thinking] Reasoning dinyalakan untuk provider ${provider}, model ${body.model}`);
  if (provider === 'openrouter') return { ...body, reasoning: { enabled: true } };
  return { ...body, reasoning_effort: 'medium' };
}

function applyGeminiThinking(payload: any, model: string, enabled?: boolean): any {
  if (enabled !== true || !payload) return payload;

  if (!/gemini/i.test(model || '')) {
    console.log(`[Thinking] Dilewati — "${model}" bukan model Gemini, thinkingConfig tidak disuntikkan`);
    return payload;
  }

  const isGemini3 = /gemini-3/i.test(model);
  const thinkingConfig = isGemini3 ? { thinkingLevel: 'high' } : { thinkingBudget: -1 };
  console.log(`[Thinking] Reasoning dinyalakan untuk gemini, model ${model} → ${JSON.stringify(thinkingConfig)}`);
  return {
    ...payload,
    generationConfig: { ...(payload.generationConfig || {}), thinkingConfig }
  };
}

export class GroqAdapter implements CapabilityAdapter {
  name = 'GroqAdapter';
  type = 'AI' as const;
  private rctx: RuntimeContext;

  constructor(rctx: RuntimeContext) {
    this.rctx = rctx;
  }

  async initialize() {
    return !!this.rctx.keys.groq;
  }

  async execute(input: any, context: AdapterContext): Promise<AdapterResult> {
    const { promptText, systemPromptText, chatHistory } = input;
    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });
    
    let groqModel = 'openai/gpt-oss-20b';
    if (this.rctx.model.model && this.rctx.model.model.startsWith('groq/')) {
      groqModel = this.rctx.model.model.replace('groq/', '');
    } else if (this.rctx.model.model === 'groq-llama-3.3') {
      groqModel = 'openai/gpt-oss-120b';
    } else if (this.rctx.model.model === 'groq-llama-3.1') {
      groqModel = 'openai/gpt-oss-20b';
    }

    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      groqModel,
      'groq',
      context.trace_id
    );

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.rctx.keys.groq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(applyThinking({ model: groqModel, messages, temperature: 0.1, max_tokens: MAKS_TOKEN_JAWABAN }, 'groq', this.rctx.model.thinking))
    });
    if (!res.ok) throw new Error(`Groq API Error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';
    
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = usage.completion_tokens || Math.ceil(answer.length / 4);
    
    this.rctx.tasks.fire('RecordUsage', recordUsage({
      userId,
      adapter: 'groq',
      model: groqModel,
      promptTokens,
      completionTokens,
      callerContext: context.trace_id,
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));
    
    return {
      result: answer,
      confidence: 0.9,
      source: 'groq',
      trace_id: context.trace_id,
      modelUsed: groqModel
    };
  }

  async *stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown> {
    const { promptText, systemPromptText, chatHistory } = input;
    let groqModel = 'openai/gpt-oss-20b';
    if (this.rctx.model.model && this.rctx.model.model.startsWith('groq/')) groqModel = this.rctx.model.model.replace('groq/', '');
    
    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory) {
       for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });

    const aborter = new AbortController();
    const id = setTimeout(() => aborter.abort(), 15000);
    
    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      groqModel,
      'groq',
      context.trace_id
    );

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.rctx.keys.groq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(applyThinking({ model: groqModel, messages, temperature: 0.1, max_tokens: MAKS_TOKEN_JAWABAN, stream: true }, 'groq', this.rctx.model.thinking)),
      signal: aborter.signal
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    
    let accumulatedText = '';
    for await (const chunk of processOpenAIStream(res)) {
      accumulatedText += chunk;
      yield chunk;
    }
    
    const promptTokens = Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = Math.ceil(accumulatedText.length / 4);
    
    this.rctx.tasks.fire('RecordUsageStream', recordUsage({
      userId,
      adapter: 'groq',
      model: groqModel,
      promptTokens,
      completionTokens,
      callerContext: (context.trace_id || 'stream') + '_estimated',
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));
  }

  async healthCheck() {
    return await this.initialize();
  }

  async shutdown() {}
}

export class OpenRouterAdapter implements CapabilityAdapter {
  name = 'OpenRouterAdapter';
  type = 'AI' as const;
  private rctx: RuntimeContext;

  constructor(rctx: RuntimeContext) {
    this.rctx = rctx;
  }

  async initialize() {
    return !!this.rctx.keys.openRouter;
  }

  async execute(input: any, context: AdapterContext): Promise<AdapterResult> {
    const { promptText, systemPromptText, chatHistory, forceDefaultModel } = input;
    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });
    
    const rawModel = this.rctx.model.model;

    let openRouterModel: string;
    if (forceDefaultModel) {
      openRouterModel = 'meta-llama/llama-3.1-8b-instruct';
    } else if (!rawModel) {
      openRouterModel = 'meta-llama/llama-3.1-8b-instruct';
    } else if (rawModel.includes('/')) {
      openRouterModel = rawModel;
    } else if (rawModel.startsWith('openrouter/')) {
      openRouterModel = rawModel.replace('openrouter/', '');
    } else {
      const modelMap: Record<string, string> = {
        'gpt-4o-mini': 'openai/gpt-4o-mini',
        'gpt-4o': 'openai/gpt-4o',
        'openrouter-llama-3': 'meta-llama/llama-3.1-8b-instruct',
        'openrouter-google-gemini-2.0-flash-exp': 'google/gemini-3.5-flash-lite',
        'gemini-2.5-flash': 'google/gemini-2.5-flash',
        'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet:beta',
      };

      openRouterModel = modelMap[rawModel] || rawModel;
    }

    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      openRouterModel,
      'openrouter',
      context.trace_id
    );

    const pakaiStream = typeof input.onNalar === 'function' || typeof input.tenggat === 'number';
    const jejakPlafon: { plafonDipakai?: number } = {};
    const plafonDiminta = await plafonUntukPermintaan(openRouterModel, this.rctx.keys.openRouter, fetch, Date.now(), JSON.stringify(messages || []).length);
    const res = await kirimOpenRouterDenganReasoning(
      { model: openRouterModel, messages, temperature: 0.1, max_tokens: plafonDiminta, ...(pakaiStream ? { stream: true } : {}) },
      typeof input.thinking === 'boolean' ? input.thinking : this.rctx.model.thinking,
      (body) => fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.rctx.keys.openRouter}`,
          'HTTP-Referer': 'https://ai-agent-project.vercel.app',
          'X-Title': 'Mamet AI Agent',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }),
      jejakPlafon
    );
    ingatPlafonTerjangkau(this.rctx.keys.openRouter, jejakPlafon.plafonDipakai, plafonDiminta);
    if (!res.ok) {
      const teks = await res.text();
      if (res.status === 402) throw new Error(pesanSaldoTakCukup(teks, plafonDiminta));
      throw new Error(`OpenRouter API Error: ${res.status} ${teks}`);
    }
    const data = pakaiStream
      ? await bacaSseOpenRouter(res, { onNalar: input.onNalar, onIsiMulai: input.onIsiMulai, tenggat: input.tenggat })
      : await res.json();
    if (data.terpotong) {
      const m = data.choices?.[0]?.message || {};
      console.warn(`[BATAS_WAKTU] jawaban OpenRouter dipotong pada tenggat: isi ${String(m.content || '').length} huruf, nalar ${String(m.reasoning || '').length} huruf (token sudah ditagih, tidak dibuang)`);
    }
    const terpotongPlafon = terpotongKarenaPlafon(data);
    let answer = data.choices?.[0]?.message?.content || '';
    if (terpotongPlafon) {
      const plafon = jejakPlafon.plafonDipakai || plafonDiminta;
      console.warn(`[Saldo] jawaban TERPOTONG pada plafon ${plafon} token (finish_reason=length): isi ${answer.length} huruf. Label terpotong ditempelkan.`);
      answer += pesanTerpotongPlafon(plafon, plafon < plafonDiminta);
    }

    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = usage.completion_tokens || Math.ceil(answer.length / 4);
    const cachedTokens = usage.prompt_tokens_details?.cached_tokens || usage.cache_read_input_tokens || 0;

    const actualCostUsd = typeof usage.cost === 'number' ? usage.cost : undefined;

    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;

    const penyediaHulu = typeof data.provider === 'string' && data.provider ? data.provider : '(tidak dilaporkan)';
    if (typeof data.provider === 'string' && data.provider) this.rctx.penyediaHulu = data.provider;

    console.log(
      `[PR#6 TOKEN METRICS] OpenRouter (${openRouterModel}): prompt=${promptTokens}t completion=${completionTokens}t ` +
      `cached=${cachedTokens}t reasoning=${reasoningTokens}t biaya=${actualCostUsd !== undefined ? '$' + actualCostUsd : '(tidak dilaporkan)'} ` +
      `penyedia=${penyediaHulu}`
    );

    this.rctx.tasks.fire('RecordUsage', recordUsage({
      userId,
      adapter: 'openrouter',
      model: openRouterModel,
      promptTokens,
      completionTokens,
      actualCostUsd,
      callerContext: context.trace_id,
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    } as any));

    return {
      result: answer,
      confidence: 0.9,
      source: 'openrouter',
      trace_id: context.trace_id,
      usageCostUsd: actualCostUsd,
      modelUsed: openRouterModel,
      reasoning: teksNalar(data.choices?.[0]?.message),
      terpotong: data.terpotong === true
    };
  }


  async *stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown> {
    const { promptText, systemPromptText, chatHistory } = input;
    let orModel: string;
    const rawModel = this.rctx.model.model;

    if (!rawModel) {
      orModel = 'meta-llama/llama-3.1-8b-instruct';
    } else if (rawModel.includes('/')) {
      orModel = rawModel;
    } else if (rawModel.startsWith('openrouter/')) {
      orModel = rawModel.replace('openrouter/', '');
    } else {
      const modelMap: Record<string, string> = {
        'gpt-4o-mini': 'openai/gpt-4o-mini',
        'gpt-4o': 'openai/gpt-4o',
      };
      orModel = modelMap[rawModel] || rawModel;
    }

    console.log('[DEBUG][OpenRouterAdapter.stream] rawModel=', rawModel, ' finalModel(orModel)=', orModel);

    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory) {
       for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });

    const aborter = new AbortController();
    const id = setTimeout(() => aborter.abort(), 15000);
    
    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      orModel,
      'openrouter',
      context.trace_id
    );

    const jejakPlafonStream: { plafonDipakai?: number } = {};
    const plafonDimintaStream = await plafonUntukPermintaan(orModel, this.rctx.keys.openRouter, fetch, Date.now(), JSON.stringify(messages || []).length);
    const res = await kirimOpenRouterDenganReasoning(
      { model: orModel, messages, temperature: 0.1, max_tokens: plafonDimintaStream, stream: true },
      this.rctx.model.thinking,
      (body) => fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.rctx.keys.openRouter}`, 'HTTP-Referer': 'https://ai-agent-project.vercel.app', 'X-Title': 'Mamet AI Agent', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: aborter.signal
      }),
      jejakPlafonStream
    );
    clearTimeout(id);
    ingatPlafonTerjangkau(this.rctx.keys.openRouter, jejakPlafonStream.plafonDipakai, plafonDimintaStream);
    if (!res.ok) {
      const teks = await res.text();
      if (res.status === 402) throw new Error(pesanSaldoTakCukup(teks, plafonDimintaStream));
      throw new Error(`OpenRouter HTTP ${res.status}: ${teks}`);
    }

    let accumulatedText = '';
    const infoStream: { provider?: string; sebabSelesai?: string } = {};
    for await (const chunk of processOpenAIStream(res, infoStream, this.rctx.model.thinking === true)) {
      accumulatedText += chunk;
      yield chunk;
    }
    if (terpotongKarenaPlafon(infoStream)) {
      const plafon = jejakPlafonStream.plafonDipakai || plafonDimintaStream;
      console.warn(`[Saldo] aliran TERPOTONG pada plafon ${plafon} token (finish_reason=length): ${accumulatedText.length} huruf terkirim.`);
      const label = pesanTerpotongPlafon(plafon, plafon < plafonDimintaStream);
      accumulatedText += label;
      yield label;
    }

    const promptTokens = Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = Math.ceil(accumulatedText.length / 4);
    console.log(`[PR#6 TOKEN METRICS] OpenRouter stream (${orModel}): prompt_est=${promptTokens}t completion_est=${completionTokens}t penyedia=${infoStream.provider || '(tidak dilaporkan)'}`);
    if (infoStream.provider) this.rctx.penyediaHulu = infoStream.provider;

    this.rctx.tasks.fire('RecordUsageStream', recordUsage({
      userId,
      adapter: 'openrouter',
      model: orModel,
      promptTokens,
      completionTokens,
      callerContext: (context.trace_id || 'stream') + '_estimated',
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));
  }


  async healthCheck() {
    return await this.initialize();
  }

  async shutdown() {}
}

export class GeminiAdapter implements CapabilityAdapter {
  name = 'GeminiAdapter';
  type = 'AI' as const;
  private rctx: RuntimeContext;
  private static keyIndex = 0;

  constructor(rctx: RuntimeContext) {
    this.rctx = rctx;
  }

  async initialize() {
    return this.rctx.keys.allGemini.length > 0;
  }

  async execute(input: any, context: AdapterContext): Promise<AdapterResult> {
    const { payload, model } = input;
    const allKeys = this.rctx.keys.allGemini;
    const maxRetries = 3;
    let seenRateLimit = false;
    let lastError = 'Unknown error';

    const userId = this.rctx.userId || 'anonymous';
    const targetModel = model || DEFAULT_GEMINI_MODEL;
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      targetModel,
      'gemini',
      context.trace_id
    );

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (let ki = 0; ki < allKeys.length; ki++) {
        const key = allKeys[(GeminiAdapter.keyIndex + ki) % allKeys.length];
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(applyGeminiThinking(payload, targetModel, this.rctx.model.thinking))
          });
          
          if (res.ok) {
            GeminiAdapter.keyIndex = (GeminiAdapter.keyIndex + ki + 1) % allKeys.length;
            const data = await res.json();
            const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            const usage = data.usageMetadata || {};
            const promptTokens = usage.promptTokenCount || Math.ceil(JSON.stringify(payload).length / 4);
            const completionTokens = usage.candidatesTokenCount || Math.ceil(answer.length / 4);
            const cachedTokens = usage.cachedContentTokenCount || 0;
            console.log(`[PR#6 TOKEN METRICS] Gemini non-stream (${targetModel}): prompt=${promptTokens}t completion=${completionTokens}t cached=${cachedTokens}t`);
            
            this.rctx.tasks.fire('RecordUsage', recordUsage({
              userId,
              adapter: 'gemini',
              model: targetModel,
              promptTokens,
              completionTokens,
              callerContext: context.trace_id,
              traceId: context.trace_id,
              supabaseUrl: this.rctx.env.supabaseUrl || '',
              pemilihModel: this.rctx.model?.pemilih,
              supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
            }));

            const grounding = data.candidates?.[0]?.groundingMetadata;
            const metadata: any = {};
            if (grounding?.groundingChunks) {
                metadata.sources = grounding.groundingChunks.map((c: any) => ({
                    title: c.web?.title || 'Sumber Web', uri: c.web?.uri 
                })).filter((s: any) => s.uri);
            }
            return {
              result: answer,
              confidence: 0.95,
              source: 'gemini',
              trace_id: context.trace_id,
              metadata,
              modelUsed: targetModel
            };
          }
          
          const errText = await res.text();
          lastError = `Status ${res.status}: ${errText}`;
          if (res.status === 429) {
            seenRateLimit = true;
            console.warn(`[GeminiAdapter] key #${ki} got 429, trying next key...`);
            continue;
          }
          console.warn(`[GeminiAdapter] key #${ki} error ${res.status}, trying next...`);
        } catch (e: any) {
          lastError = e.message || String(e);
          console.warn(`[GeminiAdapter] network error:`, e);
        }
      }
      
      if (attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    if (seenRateLimit) {
      throw new Error(`RATE_LIMIT`);
    }
    throw new Error(`Gemini failed all retries. Last error: ${lastError}`);
  }

  async *stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown> {
    const { promptText, systemPromptText, chatHistory, image } = input;

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

    const geminiContents: any[] = [];

    if (dynamicContextInject) {
      geminiContents.push({ role: 'user', parts: [{ text: dynamicContextInject }] });
      geminiContents.push({ role: 'model', parts: [{ text: 'Baik, saya telah membaca konteks referensi tersebut.' }] });
    }

    if (chatHistory) {
      for (const msg of chatHistory) {
        geminiContents.push({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.content }] });
      }
    }
    const userParts: any[] = [{ text: promptText }];
    if (image) userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    geminiContents.push({ role: 'user', parts: userParts });

    const geminiPayload: any = { 
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 8192 }
    };
    if (staticSystemPrompt) geminiPayload.systemInstruction = { parts: [{ text: staticSystemPrompt }] };

    const estimatedPromptChars = staticSystemPrompt.length + dynamicContextInject.length + (promptText || '').length;
    console.log(`[PR#6 TOKEN] Payload stream: static=${staticSystemPrompt.length}c dynamic=${dynamicContextInject.length}c prompt=${(promptText||'').length}c estimasi~${Math.round(estimatedPromptChars/4)} token`);


    const allKeys = this.rctx.keys.allGemini;
    const model = this.rctx.model.model && this.rctx.model.model.includes('gemini') ? this.rctx.model.model : DEFAULT_GEMINI_MODEL;
    let res: Response | null = null;
    let lastErr = '';

    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      model,
      'gemini',
      context.trace_id
    );

    for (let ki = 0; ki < allKeys.length; ki++) {
      const key = allKeys[(GeminiAdapter.keyIndex + ki) % allKeys.length];
      const aborter = new AbortController();
      const id = setTimeout(() => aborter.abort(), 15000);
      try {
        const attempt = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(applyGeminiThinking(geminiPayload, model, this.rctx.model.thinking)), signal: aborter.signal
        });
        clearTimeout(id);
        if (attempt.ok) {
          GeminiAdapter.keyIndex = (GeminiAdapter.keyIndex + ki + 1) % allKeys.length;
          res = attempt;
          break;
        }
        lastErr = `HTTP ${attempt.status}`;
        if (attempt.status === 404 || attempt.status === 400) {
           throw new Error(`FATAL_CLIENT_ERROR: Gemini Model Not Found or Bad Request. ${lastErr}`);
        }
      } catch(e: any) {
        clearTimeout(id);
        lastErr = e.message;
        if (lastErr.includes('FATAL_CLIENT_ERROR')) throw e;
      }
    }
    
    if (!res) throw new Error(`Gemini exhausted. Last error: ${lastErr}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No body");
    let buffer = '';
    let isThinking = false;
    let accumulatedText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            const part = data.candidates?.[0]?.content?.parts?.[0];
            let content = part?.text || '';
            const partIsThought = !!part?.thought;
            if (content) {
              if (partIsThought && !isThinking) { content = '<think>\n' + content; isThinking = true; }
              else if (!partIsThought && isThinking) { content = '\n</think>\n\n' + content; isThinking = false; }
              accumulatedText += content;
              yield content;
            }
          } catch(e) {}
        }
      }
    }
    if (isThinking) {
      accumulatedText += '\n</think>\n\n';
      yield '\n</think>\n\n';
    }
    
    const promptTokens = Math.ceil(estimatedPromptChars / 4);
    const completionTokens = Math.ceil(accumulatedText.length / 4);
    const cachedCandidateTokens = dynamicContextInject.length > 0
      ? Math.round(staticSystemPrompt.length / 4)
      : 0;
    console.log(`[PR#6 TOKEN METRICS] Stream selesai: prompt_est=${promptTokens}t completion=${completionTokens}t static_cacheable=${cachedCandidateTokens}t`);
    
    this.rctx.tasks.fire('RecordUsageStream', recordUsage({
      userId,
      adapter: 'gemini',
      model,
      promptTokens,
      completionTokens,
      callerContext: (context.trace_id || 'stream') + '_estimated',
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));
  }


  async healthCheck() {
    return await this.initialize();
  }

  async shutdown() {}
}

export class OpenAIAdapter implements CapabilityAdapter {
  name = 'OpenAIAdapter';
  type = 'AI' as const;
  private rctx: RuntimeContext;

  constructor(rctx: RuntimeContext) {
    this.rctx = rctx;
  }

  async initialize() {
    return !!this.rctx.keys.openAI;
  }

  async execute(input: any, context: AdapterContext): Promise<AdapterResult> {
    const { promptText, systemPromptText, chatHistory } = input;
    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });
    
    const selectedModel = this.rctx.model.model || 'gpt-4o-mini';
    
    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      selectedModel,
      'openai',
      context.trace_id
    );

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.rctx.keys.openAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(applyThinking({ model: selectedModel, messages, temperature: 0.1, max_tokens: MAKS_TOKEN_JAWABAN }, 'openai', this.rctx.model.thinking))
    });
    if (!res.ok) throw new Error(`OpenAI API Error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';

    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = usage.completion_tokens || Math.ceil(answer.length / 4);

    this.rctx.tasks.fire('RecordUsage', recordUsage({
      userId,
      adapter: 'openai',
      model: selectedModel,
      promptTokens,
      completionTokens,
      callerContext: context.trace_id,
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));

    return {
      result: answer,
      confidence: 0.9,
      source: 'openai',
      trace_id: context.trace_id,
      modelUsed: selectedModel
    };
  }

  async *stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown> {
    const { promptText, systemPromptText, chatHistory } = input;
    const messages = [];
    if (systemPromptText) messages.push({ role: 'system', content: systemPromptText });
    if (chatHistory) {
       for (const msg of chatHistory) messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: promptText });

    const aborter = new AbortController();
    const id = setTimeout(() => aborter.abort(), 15000);
    const selectedModel = this.rctx.model.model || 'gpt-4o-mini';
    
    const userId = this.rctx.userId || 'anonymous';
    await checkGuardrails(
      this.rctx.env.supabaseUrl || '',
      this.rctx.env.supabaseServiceKey || '',
      userId,
      selectedModel,
      'openai',
      context.trace_id
    );

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.rctx.keys.openAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(applyThinking({ model: selectedModel, messages, temperature: 0.1, max_tokens: MAKS_TOKEN_JAWABAN, stream: true }, 'openai', this.rctx.model.thinking)),
      signal: aborter.signal
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    
    let accumulatedText = '';
    for await (const chunk of processOpenAIStream(res)) {
      accumulatedText += chunk;
      yield chunk;
    }
    
    const promptTokens = Math.ceil(JSON.stringify(messages || []).length / 4);
    const completionTokens = Math.ceil(accumulatedText.length / 4);
    
    this.rctx.tasks.fire('RecordUsageStream', recordUsage({
      userId,
      adapter: 'openai',
      model: selectedModel,
      promptTokens,
      completionTokens,
      callerContext: (context.trace_id || 'stream') + '_estimated',
      traceId: context.trace_id,
      supabaseUrl: this.rctx.env.supabaseUrl || '',
      pemilihModel: this.rctx.model?.pemilih,
      supabaseServiceKey: this.rctx.env.supabaseServiceKey || ''
    }));
  }

  async healthCheck() {
    return await this.initialize();
  }

  async shutdown() {}
}

import { CapabilityRegistry } from '../adapters/adapter_registry.ts';
import { handleAuth } from './auth_middleware.ts';
import {
  createBackgroundTaskTracker,
  createRuntimeLogger,
  type RuntimeContext
} from '../runtime_context.ts';


const MAKS_KARAKTER = 2000;

const SISTEM = `Anda adalah pemeriksa konsistensi memori. Anda menerima DUA pernyataan tentang satu pengguna.

Tentukan hubungannya, lalu jawab HANYA dengan JSON tanpa markdown:
{"putusan":"BERTENTANGAN"|"PENAJAMAN"|"INDEPENDEN","alasan":"satu kalimat singkat"}

Definisi:
- BERTENTANGAN: keduanya TIDAK MUNGKIN benar bersamaan. Contoh: "suka kopi" vs "tidak suka kopi"; "kuliah di UT" vs "kuliah di ITB"; "nama panggilan pak slamet" vs "nama panggilan pak mamet".
- PENAJAMAN: yang kedua memperjelas atau menambah detail pada yang pertama, tanpa membantahnya. Contoh: "suka kopi" vs "suka kopi hitam tanpa gula".
- INDEPENDEN: dua fakta berbeda yang sama-sama bisa benar. Contoh: "suka kopi" vs "suka teh".

Kalau ragu antara BERTENTANGAN dan PENAJAMAN, pilih PENAJAMAN. Salah menandai konflik lebih merugikan daripada melewatkannya.`;

export async function handleJudgeConflictRequest(
  request: Request,
  body: any,
  corsHeaders: HeadersInit
): Promise<Response | null> {
  if (body?.action !== 'judge_conflict') return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const { user, authErrorResponse } = await handleAuth(request, supabaseUrl, supabaseAnonKey, corsHeaders);
  if (authErrorResponse) {
    console.warn('[Judge] ⛔ Ditolak — token tidak sah atau tidak ada.');
    return authErrorResponse;
  }

  const existing = typeof body?.existing === 'string' ? body.existing.trim().slice(0, MAKS_KARAKTER) : '';
  const incoming = typeof body?.incoming === 'string' ? body.incoming.trim().slice(0, MAKS_KARAKTER) : '';
  if (!existing || !incoming) {
    return jawab({ error: 'EMPTY_INPUT', message: 'Field `existing` dan `incoming` wajib diisi.' }, 400, corsHeaders);
  }

  const byok: Record<string, string> = {
    openrouter: (request.headers.get('x-byok-openrouter') || '').trim(),
    openai: (request.headers.get('x-byok-openai') || '').trim(),
    groq: (request.headers.get('x-byok-groq') || '').trim(),
    gemini: (request.headers.get('x-byok-gemini') || '').trim()
  };
  const provider = Object.keys(byok).find((p) => byok[p]) || '';
  if (!provider) {
    console.warn(`[Judge] ⛔ Ditolak — tidak ada BYOK key dari user ${user.id}.`);
    return jawab({
      error: 'NO_API_KEY',
      message: 'Pemeriksaan konflik memerlukan API Key Anda sendiri. Buka Settings → AI Provider.'
    }, 403, corsHeaders);
  }

  const traceId = crypto.randomUUID();
  const tasks = createBackgroundTaskTracker(traceId);
  const runtimeEnv = {
    supabaseUrl, supabaseServiceKey, supabaseAnonKey,
    apifyApiToken: '', enableAsyncMemoryWrite: false
  };

  const rctx = {
    traceId,
    keys: {
      [provider]: byok[provider],
      openRouter: provider === 'openrouter' ? byok.openrouter : '',
      openAI: provider === 'openai' ? byok.openai : '',
      groq: provider === 'groq' ? byok.groq : '',
      gemini: provider === 'gemini' ? byok.gemini : '',
      allGemini: provider === 'gemini' ? [byok.gemini] : []
    },
    model: { model: typeof body?.model === 'string' ? body.model : '', provider, thinking: false, pemilih: 'sistem' },
    policy: {},
    stream: { isStream: false, desktopOSMode: false, auditMode: 'OFF' },
    env: runtimeEnv,
    logger: createRuntimeLogger(user.id, tasks, false, runtimeEnv),
    userId: user.id,
    state: { explicitModelErrors: '' },
    tasks
  } as unknown as RuntimeContext;

  const prompt = `Pernyataan LAMA: "${existing}"\nPernyataan BARU: "${incoming}"`;

  try {
    await CapabilityRegistry.initializeAdapters(rctx);
    const adapters = CapabilityRegistry.getAvailableAIAdapters([provider]);
    if (adapters.length === 0) throw new Error(`Tidak ada adapter aktif untuk provider "${provider}".`);

    let mentah = '';
    let biayaAsliUsd: number | undefined;
    let modelTercatat = '';
    for (const adapter of adapters) {
      try {
        const res = await adapter.execute(
          { promptText: prompt, systemPromptText: SISTEM, chatHistory: [], forceDefaultModel: false },
          { trace_id: traceId }
        );
        if (res?.result) {
          mentah = String(res.result);
          biayaAsliUsd = typeof (res as any).usageCostUsd === 'number' ? (res as any).usageCostUsd : undefined;
          modelTercatat = String((res as any).modelUsed || '');
          break;
        }
      } catch (e: any) {
        console.warn(`[Judge] Adapter ${adapter.name} gagal:`, e.message);
      }
    }
    if (!mentah) throw new Error('Semua adapter gagal menjawab.');

    rctx.logger.logApiUsage(
      provider,
      modelTercatat || rctx.model.model || '',
      `${SISTEM}\n${prompt}`,
      mentah,
      biayaAsliUsd
    );

    const cocok = mentah.match(/\{[\s\S]*\}/);
    if (!cocok) throw new Error(`Jawaban bukan JSON: ${mentah.slice(0, 200)}`);
    const parsed = JSON.parse(cocok[0]);

    const SAH = ['BERTENTANGAN', 'PENAJAMAN', 'INDEPENDEN'];
    const putusan = SAH.includes(parsed?.putusan) ? parsed.putusan : null;
    if (!putusan) throw new Error(`Putusan tidak dikenali: ${JSON.stringify(parsed).slice(0, 200)}`);

    console.log(`[Judge] ${putusan} — "${existing.slice(0, 40)}" vs "${incoming.slice(0, 40)}" (user ${user.id})`);
    await tasks.awaitAll();
    return jawab({ putusan, alasan: String(parsed?.alasan || '').slice(0, 300) }, 200, corsHeaders);

  } catch (err: any) {
    console.error(`[Judge] ⚠️ Tidak dapat memutuskan (user ${user.id}): ${err.message}. Dianggap TIDAK berkonflik.`);
    await tasks.awaitAll();
    return jawab({
      putusan: null,
      error: 'JUDGE_FAILED',
      message: err.message
    }, 200, corsHeaders);
  }
}

function jawab(isi: unknown, status: number, corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../rag/embedding.ts';
import { handleAuth } from './auth_middleware.ts';
import {
  createBackgroundTaskTracker,
  createRuntimeLogger,
  type RuntimeContext
} from '../runtime_context.ts';


const MAKS_KARAKTER = 8000;

export async function handleEmbedRequest(
  request: Request,
  body: any,
  corsHeaders: HeadersInit
): Promise<Response | null> {
  if (body?.action !== 'embed') return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const { user, authErrorResponse } = await handleAuth(request, supabaseUrl, supabaseAnonKey, corsHeaders);
  if (authErrorResponse) {
    console.warn('[Embed] ⛔ Ditolak — token tidak sah atau tidak ada.');
    return authErrorResponse;
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return jawab({ error: 'EMPTY_TEXT', message: 'Field `text` wajib diisi dan tidak boleh kosong.' }, 400, corsHeaders);
  }
  if (text.length > MAKS_KARAKTER) {
    return jawab({
      error: 'TEXT_TOO_LONG',
      message: `Teks ${text.length} karakter melebihi batas ${MAKS_KARAKTER}. Potong lebih dulu di sisi pemanggil.`
    }, 400, corsHeaders);
  }

  const traceId = crypto.randomUUID();
  const tasks = createBackgroundTaskTracker(traceId);
  const runtimeEnv = {
    supabaseUrl,
    supabaseServiceKey,
    supabaseAnonKey,
    apifyApiToken: Deno.env.get('APIFY_API_TOKEN') || '',
    enableAsyncMemoryWrite: false
  };

  const rctx = {
    traceId,
    keys: {
      gemini: '',
      allGemini: [],
      groq: '',
      openAI: '',
      openRouterByok: (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim()
    },
    model: { model: '', provider: 'gemini', thinking: false },
    policy: {},
    stream: { isStream: false, desktopOSMode: false, auditMode: 'OFF' },
    env: runtimeEnv,
    logger: createRuntimeLogger(user.id, tasks, false, runtimeEnv),
    userId: user.id,
    state: { explicitModelErrors: '' },
    tasks
  } as unknown as RuntimeContext;

  const embedding = await generateEmbedding(text, rctx);

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    console.error(
      `[Embed] ⛔ Gagal membuat embedding untuk user ${user.id}. ` +
      `Diharapkan ${EMBEDDING_DIMENSIONS} dimensi, didapat ${Array.isArray(embedding) ? embedding.length : typeof embedding}. ` +
      `Kemungkinan tidak ada kunci OpenRouter pengguna (x-byok-openrouter), atau OpenRouter menolaknya — lihat log [Embedding] di atas.`
    );
    return jawab({
      error: 'EMBEDDING_FAILED',
      message: 'Sistem gagal membuat vektor untuk teks ini. Memori tetap bisa disimpan, tetapi tidak akan bisa dicari berdasarkan makna.',
      expected_dimensions: EMBEDDING_DIMENSIONS,
      got_dimensions: Array.isArray(embedding) ? embedding.length : null
    }, 502, corsHeaders);
  }

  console.log(`[Embed] ✅ ${embedding.length} dimensi untuk user ${user.id} (${text.length} karakter).`);
  await tasks.awaitAll();

  return jawab({ embedding, dimensions: embedding.length }, 200, corsHeaders);
}

function jawab(isi: unknown, status: number, corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../rag/embedding.ts';
import { handleAuth } from './auth_middleware.ts';
import {
  createBackgroundTaskTracker,
  createRuntimeLogger,
  type RuntimeContext
} from '../runtime_context.ts';

/**
 * ENDPOINT EMBEDDING — `{ action: 'embed', text }`
 *
 * Dibuat 2026-09-10 untuk menutup sisa Item 46.
 *
 * MASALAH YANG DIPECAHKAN
 * Seluruh baris `user_memories` di produksi ditulis oleh `MemoryGovernorService`
 * — kode FRONTEND — dan tak satu pun punya embedding, sehingga `match_memories`
 * mustahil menghasilkan apa pun. Jalur edge `saveFactDirectly` sudah menulis
 * embedding sejak commit sebelumnya, tapi jalur itu tidak pernah dipakai.
 *
 * KENAPA ENDPOINT, BUKAN EMBEDDING DI KLIEN
 * Item 46 mencatat dua pilihan. Yang dipilih (a): endpoint kecil di server.
 *   - Kunci embedding tetap di server. Memindahkannya ke klien berarti
 *     menyebarkan kunci Gemini sistem ke setiap perangkat.
 *   - Memakai kaskade adapter yang sudah ada berikut penjaga dimensinya, jadi
 *     hanya ADA SATU tempat yang menentukan dimensi vektor. Pilihan (b) akan
 *     menduplikasi logika provider di frontend — persis pola yang dulu sengaja
 *     dihapus, dan persis cara penjaga 768 bisa tercecer di dua tempat.
 *
 * SOAL BYOK (Item 51)
 * Gerbang BYOK wajib berlaku untuk provider CHAT, bukan untuk embedding.
 * Embedding adalah fungsi internal sistem — pembuatan indeks pencarian milik
 * pengguna itu sendiri — bukan percakapan atas nama seseorang. Kunci sistem
 * tetap dipakai di sini, dan itu keputusan yang sama yang sudah tercatat saat
 * kunci Gemini sengaja tidak ikut dihapus.
 *
 * PENJAGAANNYA
 * `agent-process` di-deploy dengan `--no-verify-jwt` karena `/health` dan
 * `proxy_fetch` dipanggil langsung dari browser. Artinya endpoint ini WAJIB
 * memeriksa tokennya sendiri — tanpa itu, siapa pun di internet bisa membakar
 * kunci Gemini kita. `handleAuth` dipanggil lebih dulu, dan tanpa pengguna yang
 * sah permintaannya ditolak 401.
 */

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

  // Wajib: fungsi ini tidak diverifikasi JWT di tingkat platform.
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

  const geminiKeys = (Deno.env.get('GEMINI_API_KEY') || '').split(',').map(k => k.trim()).filter(k => k);

  // rctx minimal — hanya yang benar-benar dibaca oleh adapter embedding.
  const rctx = {
    traceId,
    keys: {
      gemini: geminiKeys[0] || '',
      allGemini: geminiKeys,
      groq: '',
      openAI: Deno.env.get('OPENAI_API_KEY') || '',
      openRouter: Deno.env.get('OPENROUTER_API_KEY') || ''
    },
    model: { model: '', provider: 'gemini', thinking: false },
    policy: { canUseDesktopTools: false },
    stream: { isStream: false, desktopOSMode: false, auditMode: 'OFF' },
    env: runtimeEnv,
    logger: createRuntimeLogger(user.id, tasks, false, runtimeEnv),
    userId: user.id,
    state: { explicitModelErrors: '' },
    tasks
  } as unknown as RuntimeContext;

  const embedding = await generateEmbedding(text, rctx);

  // GAGAL-TERTUTUP dan BERSUARA.
  //
  // `generateEmbedding` mengembalikan array KOSONG ketika semua adapter gagal —
  // bukan melempar galat. Kalau nilai itu diteruskan begitu saja, pemanggil akan
  // menyimpan memori dengan embedding kosong dan mengira berhasil. Itu persis
  // kegagalan yang melahirkan Item 46. Jadi di sini ia menjadi galat eksplisit.
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    console.error(
      `[Embed] ⛔ Gagal membuat embedding untuk user ${user.id}. ` +
      `Diharapkan ${EMBEDDING_DIMENSIONS} dimensi, didapat ${Array.isArray(embedding) ? embedding.length : typeof embedding}. ` +
      `Kemungkinan besar semua adapter embedding gagal — periksa kesehatan GEMINI_API_KEY lewat check-keys.`
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

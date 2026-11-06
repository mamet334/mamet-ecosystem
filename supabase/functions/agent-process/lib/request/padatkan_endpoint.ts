import { CapabilityRegistry } from '../adapters/adapter_registry.ts';
import { handleAuth } from './auth_middleware.ts';
import {
  createBackgroundTaskTracker,
  createRuntimeLogger,
  type RuntimeContext
} from '../runtime_context.ts';


const MAKS_KARAKTER_BAHAN = 240_000;

const MAKS_HURUF_RINGKASAN = 6000;

const SISTEM = `Anda meringkas SATU percakapan kerja teknis agar pekerjaannya bisa DILANJUTKAN setelah percakapan lamanya berhenti dikirim ke model.

Pembaca ringkasan ini adalah Anda sendiri di pesan berikutnya. Jadi tulis apa yang Anda butuhkan untuk melanjutkan, bukan ikhtisar untuk orang lain.

WAJIB dipertahankan, kata per kata bila berupa penanda:
- Tugas yang sedang dikerjakan, beserta ID-nya (mis. TUGAS-02, TASK-0014, Item 90).
- Keputusan yang sudah diambil Owner dan alasannya. Keputusan Owner tidak boleh ditulis ulang jadi "dipertimbangkan".
- Alamat berkas, nama fungsi, nama tabel/kolom, dan id commit yang disebut.
- Perintah yang sudah dijalankan DAN inti keluarannya. Ini bukti; tanpa itu langkah berikutnya akan mengulang perintah yang sama.
- Angka hasil pengukuran, apa adanya.
- Pertanyaan yang masih terbuka dan belum dijawab Owner.

WAJIB dibedakan dengan jelas:
- Apa yang sudah TERBUKTI (ada keluaran perintah, hasil uji, atau bukti lain) versus apa yang masih DUGAAN.

DILARANG:
- Menambah fakta, angka, alamat berkas, atau kesimpulan yang tidak ada di percakapan.
- Menjawab sendiri pertanyaan yang masih terbuka.
- Menghaluskan kegagalan. Kalau ada yang gagal atau ditolak, tulis bahwa itu gagal atau ditolak.
- Menulis basa-basi, pembuka, atau penutup.

Bentuk jawaban: Bahasa Indonesia, poin-poin bertajuk, sepadat mungkin, di bawah 800 kata. Jangan membungkusnya dengan markdown code fence.`;

type PesanRingkas = { role: string; content: string };

export function siapkanBahan(pesan: unknown, maksKarakter = MAKS_KARAKTER_BAHAN): PesanRingkas[] {
  const semua = Array.isArray(pesan) ? pesan : [];
  const bersih: PesanRingkas[] = [];
  for (const p of semua) {
    const isi = typeof (p as any)?.content === 'string' ? (p as any).content.trim() : '';
    if (!isi) continue;
    const role = (p as any)?.role === 'user' ? 'user' : 'model';
    bersih.push({ role, content: isi });
  }
  let total = bersih.reduce((t, p) => t + p.content.length, 0);
  let mulai = 0;
  while (mulai < bersih.length - 1 && total > maksKarakter) {
    total -= bersih[mulai].content.length;
    mulai++;
  }
  return bersih.slice(mulai);
}

export function susunPrompt(bahan: PesanRingkas[]): string {
  const isi = bahan
    .map((p) => `[${p.role === 'user' ? 'OWNER' : 'ASISTEN'}]\n${p.content}`)
    .join('\n\n---\n\n');
  return `Berikut percakapan yang harus diringkas (${bahan.length} pesan):\n\n${isi}`;
}

export function bersihkanRingkasan(mentah: string): string {
  let t = String(mentah || '').trim();
  const pagar = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (pagar) t = pagar[1].trim();
  return t;
}

export async function handlePadatkanRequest(
  request: Request,
  body: any,
  corsHeaders: HeadersInit
): Promise<Response | null> {
  if (body?.action !== 'padatkan') return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const { user, authErrorResponse } = await handleAuth(request, supabaseUrl, supabaseAnonKey, corsHeaders);
  if (authErrorResponse) {
    console.warn('[Padatkan] ⛔ Ditolak — token tidak sah atau tidak ada.');
    return authErrorResponse;
  }

  const bahan = siapkanBahan(body?.pesan);
  if (bahan.length < 2) {
    return jawab({
      error: 'TERLALU_PENDEK',
      message: 'Tidak ada yang bisa dipadatkan — percakapan ini belum cukup panjang.'
    }, 400, corsHeaders);
  }

  const byok: Record<string, string> = {
    openrouter: (request.headers.get('x-byok-openrouter') || '').trim(),
    openai: (request.headers.get('x-byok-openai') || '').trim(),
    groq: (request.headers.get('x-byok-groq') || '').trim(),
    gemini: (request.headers.get('x-byok-gemini') || '').trim()
  };
  const provider = Object.keys(byok).find((p) => byok[p]) || '';
  if (!provider) {
    console.warn(`[Padatkan] ⛔ Ditolak — tidak ada BYOK key dari user ${user.id}.`);
    return jawab({
      error: 'NO_API_KEY',
      message: 'Memadatkan konteks memerlukan API Key Anda sendiri. Buka Settings → AI Provider.'
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

  try {
    await CapabilityRegistry.initializeAdapters(rctx);
    const adapters = CapabilityRegistry.getAvailableAIAdapters([provider]);
    if (adapters.length === 0) throw new Error(`Tidak ada adapter aktif untuk provider "${provider}".`);

    const prompt = susunPrompt(bahan);
    let mentah = '';
    let biayaAsliUsd: number | undefined;
    let modelTercatat = '';
    for (const adapter of adapters) {
      try {
        const res = await adapter.execute(
          {
            promptText: prompt,
            systemPromptText: SISTEM,
            chatHistory: [],
            forceDefaultModel: false
          },
          { trace_id: traceId }
        );
        if (res?.result) {
          mentah = String(res.result);
          biayaAsliUsd = typeof (res as any).usageCostUsd === 'number' ? (res as any).usageCostUsd : undefined;
          modelTercatat = String((res as any).modelUsed || '');
          break;
        }
      } catch (e: any) {
        console.warn(`[Padatkan] Adapter ${adapter.name} gagal:`, e.message);
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

    const ringkasan = bersihkanRingkasan(mentah).slice(0, MAKS_HURUF_RINGKASAN);
    if (ringkasan.length < 40) {
      throw new Error(`Ringkasan terlalu pendek untuk dipercaya (${ringkasan.length} huruf).`);
    }
    const hurufBahan = bahan.reduce((t, p) => t + p.content.length, 0);
    if (ringkasan.length >= hurufBahan) {
      throw new Error(`Ringkasan (${ringkasan.length} huruf) tidak lebih pendek dari percakapannya (${hurufBahan} huruf).`);
    }

    console.log(`[Padatkan] ${bahan.length} pesan → ringkasan ${ringkasan.length} huruf (user ${user.id})`);
    await tasks.awaitAll();
    return jawab({ ringkasan, jumlahPesan: bahan.length }, 200, corsHeaders);

  } catch (err: any) {
    console.error(`[Padatkan] ⚠️ Gagal (user ${user.id}): ${err.message}`);
    await tasks.awaitAll();
    return jawab({ error: 'PADATKAN_GAGAL', message: err.message }, 200, corsHeaders);
  }
}

function jawab(isi: unknown, status: number, corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

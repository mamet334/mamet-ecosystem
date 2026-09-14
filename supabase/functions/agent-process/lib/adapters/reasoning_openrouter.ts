/**
 * Parameter reasoning untuk OpenRouter — TIGA keadaan, bukan dua.
 *
 *   thinking === true       → reasoning: { enabled: true }   (seperti sebelumnya)
 *   thinking === false      → reasoning: { enabled: false }  (BARU: benar-benar dimatikan)
 *   thinking === undefined  → tidak mengirim apa pun         (bawaan model — mis. mametlite)
 *
 * KENAPA "false" KINI DIKIRIM (2026-09-13):
 * Desain lama (lihat komentar di ai_adapter.ts) sengaja tidak pernah mengirim nilai "mati".
 * Akibatnya terukur di produksi: deepseek/deepseek-v4-flash-0731 di tier SEDANG yang Thinking-nya
 * DIMATIKAN Owner tetap bernalar 1.491 token dalam satu jawaban (13 Sep 2026, 13:03 UTC) — ditagih,
 * dan jawabannya baru selesai 37 detik kemudian. Dokumentasi OpenRouter
 * (openrouter.ai/docs/use-cases/reasoning-tokens, dicek 2026-09-13): model yang mampu bernalar
 * MENYALAKANNYA OTOMATIS bila parameter tidak dikirim; `enabled: false` mematikannya.
 * `enabled: false` pada model ini sudah terbukti bekerja sejak Item 67 (lib/rag/query_rewrite.ts).
 *
 * RISIKO YANG DITANGANI:
 * Sebagian model mewajibkan nalar dan menolak dimatikan — google/gemini-3.5-flash-lite menjawab
 * HTTP 400 "Reasoning is mandatory for this endpoint" (terbukti di Item 67). Untuk kasus itu
 * permintaan DIULANG SEKALI tanpa parameter (perilaku lama), dan nama modelnya diingat selama
 * instans fungsi hidup supaya permintaan berikutnya tidak membuang satu panggilan.
 */

// ── NALAR DITAMPILKAN (2026-09-14) ─────────────────────────────────────────────────────────────
// Owner sengaja menampilkan nalar model di chat (transparansi; blok lipat gaya DeepSeek). Model yang
// bernalar lewat OpenRouter TIDAK menulis `<think>` di `content` — nalarnya dikirim terpisah dan dulu
// dibuang adapter (uji chat 2026-09-14: 7 jawaban tanpa nalar). Kolom resmi (openrouter.ai/docs/
// use-cases/reasoning-tokens, dicek 2026-09-14): non-stream `message.reasoning` (teks) /
// `message.reasoning_details`; stream `delta.reasoning_details` (`reasoning.text` → `text`,
// `reasoning.summary` → `summary`; `reasoning.encrypted` tak terbaca). Hanya diteruskan bila Thinking
// dinyalakan eksplisit — klien tanpa `thinking` (mametlite) tidak tiba-tiba menerima nalar.

/** Teks nalar dari `message` (non-stream) atau `delta` (stream); '' bila tidak ada. */
export function teksNalar(obj: any): string {
  if (!obj) return '';
  if (typeof obj.reasoning === 'string' && obj.reasoning) return obj.reasoning;
  const detail = Array.isArray(obj.reasoning_details) ? obj.reasoning_details : [];
  return detail
    .map((d: any) => (d?.type === 'reasoning.summary' ? d?.summary : d?.text))
    .filter((t: any) => typeof t === 'string' && t)
    .join('');
}

/** Jawaban akhir non-stream: nalar dibungkus `<think>` di depan jawaban (bila jawaban belum memuatnya). */
export function sisipkanNalar(jawaban: string, nalar?: string): string {
  const n = String(nalar || '').trim();
  if (!n || /<think>/i.test(jawaban || '')) return jawaban;
  return `<think>\n${n}\n</think>\n\n${jawaban}`;
}

/** Stream: ubah potongan nalar + isi menjadi teks berurutan `<think>…</think>` lalu jawaban. */
export function pembungkusNalarStream() {
  let terbuka = false;
  return {
    potong(nalar: string, isi: string): string {
      let keluar = '';
      if (nalar) { if (!terbuka) { keluar += '<think>\n'; terbuka = true; } keluar += nalar; }
      if (isi) { if (terbuka) { keluar += '\n</think>\n\n'; terbuka = false; } keluar += isi; }
      return keluar;
    },
    akhir(): string {
      if (!terbuka) return '';
      terbuka = false;
      return '\n</think>\n\n';
    }
  };
}

/**
 * Hybrid (2026-09-14): jawaban akhir diminta sebagai stream ke OpenRouter supaya nalar bisa diteruskan ke klien
 * SAMBIL model berpikir, lalu dirakit kembali ke bentuk respons non-stream — pemanggil (label, verifikasi,
 * penyimpanan) tidak berubah. `onNalar` menerima potongan nalar; `onIsiMulai` dipanggil sekali saat jawaban mulai.
 */
export async function bacaSseOpenRouter(
  res: Response,
  opsi: { onNalar?: (teks: string) => void; onIsiMulai?: () => void } = {}
): Promise<any> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');
  const dekoder = new TextDecoder();
  let sisa = ''; let isi = ''; let nalar = ''; let usage: any; let provider: string | undefined; let isiMulai = false;
  const olah = (baris: string) => {
    if (!baris.startsWith('data: ') || baris.includes('[DONE]')) return;
    let data: any;
    try { data = JSON.parse(baris.slice(6)); } catch { return; }
    if (data.error) throw new Error(`OpenRouter stream error: ${JSON.stringify(data.error).slice(0, 300)}`);
    if (!provider && typeof data.provider === 'string' && data.provider) provider = data.provider;
    if (data.usage) usage = data.usage;
    const delta = data.choices?.[0]?.delta;
    const n = teksNalar(delta);
    if (n) { nalar += n; opsi.onNalar?.(n); }
    const c = delta?.content || '';
    if (c) { if (!isiMulai) { isiMulai = true; opsi.onIsiMulai?.(); } isi += c; }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const baris = sisa.split('\n');
    sisa = baris.pop() || '';
    for (const b of baris) olah(b.trim());
  }
  if (sisa.trim()) olah(sisa.trim());
  return { choices: [{ message: { content: isi, reasoning: nalar } }], usage, provider };
}

/** Model yang terbukti menolak reasoning dimatikan — diisi saat berjalan, hidup selama instans. */
export const MODEL_WAJIB_NALAR = new Set<string>();

export function badanReasoningOpenRouter(body: Record<string, any>, thinking?: boolean): Record<string, any> {
  if (thinking === true) {
    console.log(`[Thinking] Reasoning dinyalakan untuk provider openrouter, model ${body.model}`);
    return { ...body, reasoning: { enabled: true } };
  }
  if (thinking === false && !MODEL_WAJIB_NALAR.has(String(body.model))) {
    return { ...body, reasoning: { enabled: false } };
  }
  return body;
}

export function ditolakKarenaReasoning(status: number, teks: string): boolean {
  return status === 400 && /reasoning/i.test(teks || '');
}

/**
 * Kirim ke OpenRouter dengan parameter reasoning yang sesuai. Bila reasoning dimatikan lalu model
 * menolaknya (400 yang menyebut "reasoning"), ulangi sekali tanpa parameter.
 * `kirim` menerima body (objek) dan mengembalikan Response — pemanggil yang menyusun fetch-nya.
 */
export async function kirimOpenRouterDenganReasoning(
  body: Record<string, any>,
  thinking: boolean | undefined,
  kirim: (b: Record<string, any>) => Promise<Response>
): Promise<Response> {
  const badan = badanReasoningOpenRouter(body, thinking);
  const res = await kirim(badan);
  if (res.ok || !badan.reasoning || badan.reasoning.enabled !== false || res.status !== 400) return res;

  const teks = await res.clone().text().catch(() => '');
  if (!ditolakKarenaReasoning(res.status, teks)) return res;

  MODEL_WAJIB_NALAR.add(String(body.model));
  console.log(`[Thinking] Model ${body.model} menolak reasoning dimatikan (${teks.slice(0, 120)}) — diulang tanpa parameter, nalar tetap berjalan`);
  return kirim(body);
}

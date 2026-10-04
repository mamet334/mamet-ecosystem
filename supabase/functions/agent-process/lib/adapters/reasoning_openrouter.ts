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

// ── SALDO TIDAK CUKUP UNTUK max_tokens (2026-10-04) ────────────────────────────────────────────
//
// `max_tokens: 8192` dulu dipaku di ENAM tempat `ai_adapter.ts`. Angka itu bukan kebutuhan jawaban,
// melainkan plafon — tetapi OpenRouter menagih berdasarkan plafon yang DIMINTA saat memutuskan
// apakah permintaan terjangkau. Jadi saldo yang masih cukup untuk jawaban pendek pun ditolak,
// hanya karena yang diminta 8192.
//
// Keadaan yang menjadikannya mendesak: saldo Owner boleh minus dan OpenRouter TETAP melayani
// sebagian. Jalur embedding sudah menangani 402 sejak lama (`vector_utils.ts`), jalur CHAT belum
// sama sekali — badan jawabannya yang menyebut berapa yang terjangkau langsung dilempar sebagai
// galat mentah dan dibuang.
//
// POLA ULANG-COBANYA MENGIKUTI YANG SUDAH ADA di fungsi ini untuk HTTP 400 (model menolak nalar
// dimatikan): periksa respons gagal, putuskan, ulangi SEKALI. Bukan mekanisme baru.

/** Plafon token jawaban. Satu sumber untuk keenam titik panggil di `ai_adapter.ts`. */
export const MAKS_TOKEN_JAWABAN = 8192;

/**
 * Lantai kelayakan. Di bawah ini permintaan TIDAK diulang.
 *
 * Mengulang dengan plafon sangat kecil menghasilkan jawaban terpotong yang tampak seperti model
 * gagal atau membodohkan diri — lebih buruk daripada galat yang terang, karena ia menyesatkan.
 * Di bawah lantai ini Owner diberi kalimat yang bisa ditindaklanjuti: isi ulang saldo.
 */
export const MIN_TOKEN_LAYAK = 512;

/**
 * Kelonggaran plafon pengulangan.
 *
 * DIPELAJARI DARI PRODUKSI 2026-10-04, bukan dipilih di muka. Percobaan pertama meminta TEPAT
 * angka yang dikutip OpenRouter — dan tetap ditolak 402. Dua sebab terbaca dari badan jawabannya:
 *
 *   1. Angka itu BATAS, bukan nilai aman. Meminta tepat sebesar batas tidak menyisakan apa pun
 *      bila pemeriksaannya "lebih besar atau sama dengan".
 *   2. Angkanya BERGESER antar panggilan: 779 lalu 733 untuk pertanyaan yang sama.
 */
export const MARGIN_SALDO = 0.9;

/**
 * Membaca jumlah token yang masih terjangkau dari badan 402 OpenRouter, mengambil yang TERKECIL.
 *
 * Kalimatnya berbentuk "…you requested up to 8192 tokens, but can only afford 1234".
 * Polanya dari pesan yang BENAR-BENAR teramati di proyek ini, bukan dari dokumentasi.
 *
 * KENAPA TERKECIL, bukan yang pertama (diperbaiki 2026-10-04 setelah gagal di produksi):
 * satu badan 402 memuat BEBERAPA kutipan — satu di tingkat atas dan sisanya di `previous_errors`,
 * karena OpenRouter sudah mencoba beberapa PENYEDIA untuk nama model yang sama. Harga tiap
 * penyedia berbeda, jadi angkanya berbeda jauh: satu badan nyata memuat 779, 734, 1558, 1558.
 * Mengambil yang pertama (779) berarti meminta lebih besar daripada yang sanggup dibayar pada
 * penyedia termurah-batasnya (734), dan pengulangannya ditolak lagi.
 *
 * Bila polanya tidak cocok — misalnya OpenRouter mengubah kalimatnya — fungsi ini mengembalikan
 * `null` dan perilakunya kembali seperti sebelum perubahan ini: galatnya dilempar apa adanya.
 * Tebakan yang salah karena itu tidak merugikan apa pun; ia hanya tidak menolong.
 */
export function tokenTerjangkau(teks: string): number | null {
  const semua = [...String(teks || '').matchAll(/can only afford\s+([\d,.]+)/gi)]
    .map((m) => Math.floor(Number(m[1].replace(/,/g, ''))))
    .filter((n) => Number.isFinite(n) && n > 0);
  return semua.length ? Math.min(...semua) : null;
}

/** Plafon yang benar-benar diminta saat mengulang: yang terkecil, dikurangi kelonggaran. */
export function plafonUlang(teks: string): number | null {
  const n = tokenTerjangkau(teks);
  return n === null ? null : Math.floor(n * MARGIN_SALDO);
}

/**
 * Varian 402 KEDUA, teramati di produksi 2026-10-04: "Prompt tokens limit exceeded: 14250 > 3621".
 *
 * Kendalanya PINDAH — bukan `max_tokens` (keluaran) melainkan PROMPT-nya sendiri. Menurunkan
 * plafon keluaran tidak menolong sedikit pun di sini, dan menyuruh "isi ulang saldo" menyesatkan:
 * saldo sebesar 3.621 token itu CUKUP, prompt-nyalah yang 14.250.
 *
 * Tidak ada pengulangan otomatis untuk varian ini. Memangkas prompt diam-diam berarti membuang
 * aturan atau konteks yang justru menentukan mutu jawaban — keputusan itu milik Owner, dan yang
 * bisa dilakukan di sini adalah memberinya ANGKANYA.
 */
export function batasPrompt(teks: string): { dipakai: number; batas: number } | null {
  const m = String(teks || '').match(/Prompt tokens limit exceeded:\s*([\d,.]+)\s*>\s*([\d,.]+)/i);
  if (!m) return null;
  const dipakai = Math.floor(Number(m[1].replace(/,/g, '')));
  const batas = Math.floor(Number(m[2].replace(/,/g, '')));
  return Number.isFinite(dipakai) && Number.isFinite(batas) ? { dipakai, batas } : null;
}

/** Kalimat yang bisa ditindaklanjuti untuk 402 — menggantikan badan JSON mentah. */
export function pesanSaldoTakCukup(teks: string, diminta: number): string {
  // Varian PROMPT lebih dulu: di sini "isi ulang saldo" saja menyesatkan, karena memperkecil
  // prompt sama-sama menyelesaikannya — dan sering itu yang lebih tepat.
  const p = batasPrompt(teks);
  if (p) {
    const lebih = p.dipakai - p.batas;
    return `Prompt terlalu besar untuk saldo OpenRouter saat ini: ${p.dipakai} token dikirim, sedangkan saldo hanya menanggung ${p.batas} — kelebihan ${lebih} token. Menurunkan panjang jawaban TIDAK menolong di sini; yang kebesaran adalah prompt-nya. Mulai percakapan BARU (riwayat ikut terkirim di setiap pesan) atau isi ulang saldo. Rincian ukuran tiap bagian ada di log [PROMPT_KOMPOSISI].`;
  }

  const n = tokenTerjangkau(teks);
  const plafon = plafonUlang(teks);
  if (n === null || plafon === null) {
    return `Saldo OpenRouter tidak cukup untuk permintaan ini (402). Isi ulang saldo. Pesan asli: ${String(teks || '').slice(0, 200)}`;
  }
  if (plafon < MIN_TOKEN_LAYAK) {
    return `Saldo OpenRouter hanya cukup untuk ${n} token jawaban, sedangkan jawaban yang layak butuh minimal ${MIN_TOKEN_LAYAK}. Permintaan TIDAK diulang dengan plafon sekecil itu — jawaban terpotong akan terlihat seperti model gagal, bukan seperti saldo habis. Isi ulang saldo.`;
  }
  // Sudah diulang dengan plafon berkelonggaran dan tetap gagal. Ini batas yang jujur: saldonya
  // memang terlalu tipis, bukan plafonnya yang salah pilih. Menurunkannya lagi hanya akan
  // menghasilkan jawaban yang terlalu pendek untuk berguna.
  return `Saldo OpenRouter hanya cukup untuk ${n} token jawaban (diminta ${diminta}); sudah diulang dengan ${plafon} dan tetap ditolak. Saldonya memang terlalu tipis untuk jawaban yang berguna — isi ulang saldo.`;
}

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
  // tenggat (ms epoch, 2026-09-15): berhenti membaca pada waktu ini dan kembalikan yang sudah ada dengan `terpotong: true`,
  // sebelum Supabase mematikan worker (batas waktu dinding) dan semua token yang sudah dibayar hilang.
  opsi: { onNalar?: (teks: string) => void; onIsiMulai?: () => void; tenggat?: number } = {}
): Promise<any> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');
  const dekoder = new TextDecoder();
  let sisa = ''; let isi = ''; let nalar = ''; let usage: any; let provider: string | undefined; let isiMulai = false;
  let terpotong = false;
  const HABIS = Symbol('tenggat');
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
  const baca = async (): Promise<any> => {
    if (typeof opsi.tenggat !== 'number') return reader.read();
    const sisaMs = opsi.tenggat - Date.now();
    if (sisaMs <= 0) return HABIS;
    let t: number | undefined;
    try {
      return await Promise.race([reader.read(), new Promise((ok) => { t = setTimeout(() => ok(HABIS), sisaMs); })]);
    } finally {
      if (t !== undefined) clearTimeout(t);
    }
  };
  while (true) {
    const bacaan = await baca();
    if (bacaan === HABIS) {
      terpotong = true;
      reader.cancel().catch(() => { /* koneksi sudah ditutup */ });
      break;
    }
    const { done, value } = bacaan;
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const baris = sisa.split('\n');
    sisa = baris.pop() || '';
    for (const b of baris) olah(b.trim());
  }
  if (sisa.trim()) olah(sisa.trim());
  return { choices: [{ message: { content: isi, reasoning: nalar } }], usage, provider, terpotong };
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
  if (res.ok) return res;

  // 402 — saldo tidak cukup untuk PLAFON yang diminta, bukan untuk jawabannya.
  //
  // Diperiksa SEBELUM cabang 400 di bawah: baris lama memulangkan setiap kegagalan non-400 lebih
  // dulu, sehingga 402 tak pernah sampai ke mana pun. Permintaan yang ditolak 402 TIDAK ditagih,
  // jadi pengulangan ini tidak menambah biaya.
  if (res.status === 402) {
    const teks = await res.clone().text().catch(() => '');
    const n = tokenTerjangkau(teks);
    const plafon = plafonUlang(teks);
    const diminta = Number(badan.max_tokens) || 0;
    if (plafon !== null && plafon >= MIN_TOKEN_LAYAK && diminta > plafon) {
      console.warn(`[Saldo] 402: plafon ${diminta} token tidak terjangkau. Terkecil yang dikutip ${n}, diulang SEKALI dengan max_tokens: ${plafon} (margin ${MARGIN_SALDO})`);
      return kirim({ ...badan, max_tokens: plafon });
    }
    // Tidak terbaca, di bawah lantai, atau plafonnya memang sudah ≤ yang terjangkau: dipulangkan
    // apa adanya. Pemanggil yang membangun pesannya (lihat `pesanSaldoTakCukup`).
    console.warn(`[Saldo] 402 tidak diulang — terkecil terjangkau: ${n === null ? 'tak terbaca' : n}, plafon ulang: ${plafon}, diminta: ${diminta}, lantai: ${MIN_TOKEN_LAYAK}`);
    return res;
  }

  if (!badan.reasoning || badan.reasoning.enabled !== false || res.status !== 400) return res;

  const teks = await res.clone().text().catch(() => '');
  if (!ditolakKarenaReasoning(res.status, teks)) return res;

  MODEL_WAJIB_NALAR.add(String(body.model));
  console.log(`[Thinking] Model ${body.model} menolak reasoning dimatikan (${teks.slice(0, 120)}) — diulang tanpa parameter, nalar tetap berjalan`);
  return kirim(body);
}

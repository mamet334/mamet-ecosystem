// Penjaga batas waktu dinding (wall clock) Supabase + lanjutan jawaban terpotong (2026-09-15).
//
// Supabase menghentikan worker 150 detik setelah permintaan diterima (log live v443: reason "WallClockTime",
// CPU hanya 297 ms). Laporan Deep Research dengan nalar bisa melewati itu; worker mati di tengah jawaban dan
// seluruh token yang sudah dibayar ke OpenRouter hilang ("Aliran jawaban terputus").
//
// Solusi: jawaban akhir dibaca sebagai stream dan dipotong pada tenggat; teks + nalar yang sudah ada dikirim sebagai
// jawaban biasa bertanda `terpotong`, bersama bahan untuk melanjutkan. Pesan "lanjutkan" berikutnya meneruskan
// tulisan tanpa menjalankan ulang Intent Router, Coordinator, maupun sub-agent (riset tidak diulang).

const BATAS_DINDING_BAWAAN_MS = 150_000;
/** Nilai secret di bawah ini dianggap salah ketik (mis. "150" = 150 ms) — setiap jawaban akan langsung terpotong. */
const BATAS_DINDING_MINIMUM_MS = 30_000;
/** Waktu sesudah pemotongan untuk label, verifikasi, tugas latar, dan mengirim event `hasil`. */
const CADANGAN_PENUTUP_MS = 20_000;

/** Batas dinding dari secret BATAS_WAKTU_DINDING_MS (paket berbayar: 400000); nilai tak masuk akal → bawaan 150 detik. */
export function bacaBatasDinding(nilaiMentah: string | undefined | null): number {
  if (nilaiMentah === undefined || nilaiMentah === null || String(nilaiMentah).trim() === '') return BATAS_DINDING_BAWAAN_MS;
  const n = Number(nilaiMentah);
  if (!Number.isFinite(n) || n < BATAS_DINDING_MINIMUM_MS) {
    console.warn(`[BATAS_WAKTU] BATAS_WAKTU_DINDING_MS="${nilaiMentah}" diabaikan (harus milidetik ≥ ${BATAS_DINDING_MINIMUM_MS}); memakai ${BATAS_DINDING_BAWAAN_MS}`);
    return BATAS_DINDING_BAWAAN_MS;
  }
  return n;
}

const BATAS_DINDING_MS = bacaBatasDinding((globalThis as any).Deno?.env?.get?.('BATAS_WAKTU_DINDING_MS'));

export const CATATAN_TERPOTONG =
  '\n\n---\n⏸️ **Jawaban terpotong** — batas waktu server (±150 detik) hampir habis, jadi bagian yang sudah ditulis ' +
  'disimpan di sini. Ketik **lanjutkan** untuk meneruskan dari bagian ini tanpa mengulang riset.';

/** Nalar sebelumnya yang diserahkan ke lanjutan dibatasi agar prompt tidak membengkak. */
const MAKS_NALAR_SEBELUMNYA = 6000;

/** Tenggat (ms epoch) pembacaan jawaban akhir, atau undefined bila waktu mulai permintaan tidak diketahui. */
export function tenggatJawaban(rctx: any): number | undefined {
  const mulai = rctx?.stream?.mulaiPermintaan;
  return typeof mulai === 'number' ? mulai + BATAS_DINDING_MS - CADANGAN_PENUTUP_MS : undefined;
}

/** Pesan pendek yang berarti "teruskan jawaban sebelumnya". Pola yang sama dipakai desktop (AssistantService.js). */
export const POLA_LANJUTKAN =
  /^\s*(tolong\s+|mohon\s+)?(lanjut(kan|in)?|teruskan|terusin|continue)(\s+(lagi|jawaban(nya)?|laporan(nya)?|tulisan(nya)?))?\s*[.!]*\s*$/i;

export type Lanjutan = {
  permintaan: string;
  bahan: string;
  jawabanSebelumnya: string;
  /** Nalar yang sudah dibayar sebelum pemotongan — lanjutan tidak bernalar ulang dari nol. */
  nalarSebelumnya: string;
  /** Riwayat sebelum pertanyaan asal (pertanyaan, jawaban terpotong, dan "lanjutkan" sudah ada di prompt). */
  riwayat: any[];
};

/**
 * Bagian jawaban yang benar-benar dibaca pengguna: teks SEBELUM catatan terpotong, tanpa blok nalar. Semua yang
 * sesudah catatan (label status, catatan sistem dari pemeriksa label) dibuang — live v444 label itu terbawa sebagai
 * "jawaban sebelumnya" sehingga lanjutan tidak menemukan teks untuk diteruskan.
 */
export function bersihkanJawabanTerpotong(teks: string): string {
  const s = String(teks || '');
  const i = s.indexOf(CATATAN_TERPOTONG);
  return (i >= 0 ? s.slice(0, i) : s).replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
}

/** Isi blok <think> (nalar) dari jawaban. */
export function ambilNalar(teks: string): string {
  return [...String(teks || '').matchAll(/<think>([\s\S]*?)(<\/think>|$)/gi)].map((m) => m[1].trim()).filter(Boolean).join('\n');
}

/**
 * Pesan "lanjutkan" + pesan model terakhir di riwayat bertanda `terpotong` → data lanjutan. Riwayat dari desktop
 * membawa `metadata` tiap pesan (metadata = respons server yang disimpan di chats.messages).
 */
export function temukanLanjutan(pesan: string, riwayat: any[]): Lanjutan | null {
  if (!POLA_LANJUTKAN.test(String(pesan || ''))) return null;
  const r = Array.isArray(riwayat) ? riwayat : [];
  let i = r.length - 1;
  if (i >= 0 && r[i]?.role === 'user') i--; // pesan "lanjutkan" itu sendiri
  const m = r[i];
  const bahan = m?.role === 'model' && m?.metadata?.terpotong === true ? m.metadata.bahanLanjutan : null;
  if (!bahan) return null;
  return {
    permintaan: String(bahan.permintaan || ''),
    bahan: String(bahan.bahan || ''),
    jawabanSebelumnya: String(bahan.jawabanSebelumnya || ''),
    nalarSebelumnya: String(bahan.nalarSebelumnya || ''),
    riwayat: r.slice(0, Math.max(0, i - 1)),
  };
}

/** Isi bahanLanjutan untuk metadata jawaban yang terpotong (berantai bila jawaban ini sendiri adalah lanjutan). */
export function susunBahanLanjutan(balasan: string, lanjutan: Lanjutan | null, permintaanAwal: string, bahanSubAgent: string) {
  const nalarBaru = ambilNalar(balasan);
  return {
    permintaan: lanjutan ? lanjutan.permintaan : permintaanAwal,
    bahan: lanjutan ? lanjutan.bahan : bahanSubAgent,
    jawabanSebelumnya: [lanjutan?.jawabanSebelumnya, bersihkanJawabanTerpotong(balasan)].filter(Boolean).join('\n'),
    nalarSebelumnya: (nalarBaru || lanjutan?.nalarSebelumnya || '').slice(-MAKS_NALAR_SEBELUMNYA),
  };
}

export function susunPromptLanjutan(l: Lanjutan): string {
  const bagianBahan = l.bahan
    ? `Bahan yang dipakai jawaban sebelumnya (hasil sub-agent — JANGAN meminta riset ulang):\n${l.bahan}\n\n`
    : '';
  const bagianNalar = l.nalarSebelumnya
    ? `Analisis Anda sebelumnya (sudah selesai dan sudah ditampilkan ke pengguna — JANGAN menganalisis ulang dari awal, pakai kesimpulannya):\n<ANALISIS_SEBELUMNYA>\n${l.nalarSebelumnya}\n</ANALISIS_SEBELUMNYA>\n\n`
    : '';
  const tugas = l.jawabanSebelumnya
    ? `Bagian jawaban yang sudah diterima pengguna:\n<JAWABAN_SEBELUMNYA>\n${l.jawabanSebelumnya}\n</JAWABAN_SEBELUMNYA>\n\n` +
      'LANJUTKAN tepat dari kata terakhir di dalam <JAWABAN_SEBELUMNYA> (bukan dari bahan). JANGAN mengulang bagian yang ' +
      'sudah ada, JANGAN membuka dengan sapaan atau ringkasan ulang. Pertahankan format, struktur, dan nomor sumber [n] ' +
      'yang sama, lalu tutup dengan label status seperti biasa.'
    : 'Jawaban belum sempat ditulis sama sekali (terhenti saat menganalisis). Berdasarkan analisis di atas, LANGSUNG tulis ' +
      'jawaban lengkapnya sekarang sesuai permintaan dan bahan.';
  return `Permintaan awal pengguna: "${l.permintaan}"\n\n${bagianBahan}${bagianNalar}Jawaban Anda untuk permintaan itu TERPOTONG karena batas waktu server.\n${tugas}`;
}

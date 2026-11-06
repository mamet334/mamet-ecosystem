
const BATAS_DINDING_BAWAAN_MS = 150_000;
const BATAS_DINDING_MINIMUM_MS = 30_000;
const CADANGAN_PENUTUP_MS = 20_000;

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

const MAKS_NALAR_SEBELUMNYA = 6000;

export function tenggatJawaban(rctx: any): number | undefined {
  const mulai = rctx?.stream?.mulaiPermintaan;
  return typeof mulai === 'number' ? mulai + BATAS_DINDING_MS - CADANGAN_PENUTUP_MS : undefined;
}

export const POLA_LANJUTKAN =
  /^\s*(tolong\s+|mohon\s+)?(lanjut(kan|in)?|teruskan|terusin|continue)(\s+(lagi|jawaban(nya)?|laporan(nya)?|tulisan(nya)?))?\s*[.!]*\s*$/i;

export type Lanjutan = {
  permintaan: string;
  bahan: string;
  jawabanSebelumnya: string;
  nalarSebelumnya: string;
  riwayat: any[];
};

export function bersihkanJawabanTerpotong(teks: string): string {
  const s = String(teks || '');
  const i = s.indexOf(CATATAN_TERPOTONG);
  return (i >= 0 ? s.slice(0, i) : s).replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
}

export function ambilNalar(teks: string): string {
  return [...String(teks || '').matchAll(/<think>([\s\S]*?)(<\/think>|$)/gi)].map((m) => m[1].trim()).filter(Boolean).join('\n');
}

export function temukanLanjutan(pesan: string, riwayat: any[]): Lanjutan | null {
  if (!POLA_LANJUTKAN.test(String(pesan || ''))) return null;
  const r = Array.isArray(riwayat) ? riwayat : [];
  let i = r.length - 1;
  if (i >= 0 && r[i]?.role === 'user') i--;
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

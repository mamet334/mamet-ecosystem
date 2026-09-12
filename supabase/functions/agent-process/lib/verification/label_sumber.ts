/**
 * LABEL VERIFIED WAJIB MENYEBUT SUMBERNYA (Item 71, 2026-09-12)
 *
 * Sebelum item ini, `[BLOK 6]` memerintahkan label `[STATUS: VERIFIED]` **tanpa syarat** setiap kali
 * Evidence Gate berstatus PASSED — dan PASSED hanya berarti "ada dokumen yang dilampirkan".
 * Perintah itu bertentangan dengan panduan identitas (`request_pipeline.ts`), yang menulis VERIFIED
 * hanya "jika didukung oleh dokumen". Akibatnya terbukti di Item 70: satu chat menerima potongan
 * yang TIDAK memuat jawabannya (skor 0,552), jawabannya datang dari pengetahuan umum model, tapi
 * labelnya `VERIFIED`. Label itu justru menghapus tanda bahaya yang seharusnya dilihat Owner.
 *
 * Kini VERIFIED wajib disertai baris `Sumber: "<judul dokumen>"`, dan kode ini memeriksanya:
 * judul yang disebut harus benar-benar ada di antara dokumen yang dilampirkan. Kalau tidak,
 * labelnya diturunkan menjadi HYPOTHESIS — keputusan kode, bukan kesopanan model.
 */
export const LABEL_VERIFIED = '[STATUS: VERIFIED]';
export const LABEL_HIPOTESIS = '[STATUS: HYPOTHESIS - Rekomendasi AI]';
export const CATATAN_KOREKSI = '_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._';

const rapikan = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Judul dianggap disebut bila 30 huruf pertamanya (setelah dirapikan) muncul di baris Sumber. */
function judulDisebut(baris: string, judul: string): boolean {
  const j = rapikan(judul);
  if (j.length < 4) return false;
  const b = rapikan(baris);
  return b.includes(j.slice(0, 30)) || (j.length <= 60 && j.includes(b) && b.length >= 4);
}

export type HasilLabel = { jawaban: string; dikoreksi: boolean; alasan: string; catatan: string };

/**
 * @param jawaban teks jawaban model
 * @param judulDokumen judul dokumen/artikel yang BENAR-BENAR dilampirkan ke prompt
 */
export function periksaLabelSumber(jawaban: string, judulDokumen: string[]): HasilLabel {
  const teks = String(jawaban || '');
  const diam: HasilLabel = { jawaban: teks, dikoreksi: false, alasan: '', catatan: '' };
  if (!teks.includes(LABEL_VERIFIED)) return diam;

  const judul = (judulDokumen || []).filter((j) => typeof j === 'string' && j.trim());
  // Baris sumber: "Sumber: ..." / "Sumber dokumen: ..." di luar blok kode.
  const barisSumber = teks.split('\n').filter((b) => /^\s*(?:[*_>\s-]*)sumber\b/i.test(b));
  const adaYangCocok = judul.length > 0 && barisSumber.some((b) => judul.some((j) => judulDisebut(b, j)));
  if (adaYangCocok) return diam;

  const alasan = judul.length === 0
    ? 'tidak ada dokumen yang dilampirkan'
    : (barisSumber.length === 0 ? 'jawaban tidak menuliskan baris Sumber' : 'judul di baris Sumber tidak cocok dengan dokumen yang dilampirkan');
  return {
    jawaban: teks.split(LABEL_VERIFIED).join(LABEL_HIPOTESIS),
    dikoreksi: true,
    alasan,
    catatan: CATATAN_KOREKSI
  };
}

/** Dipakai jalur non-stream: mengoreksi teks sekaligus mencatat alasannya. */
export function koreksiLabel(jawaban: string, judulDokumen: string[], mode: string): string {
  const hasil = periksaLabelSumber(jawaban, judulDokumen);
  if (hasil.dikoreksi) {
    console.warn(`[LABEL] ${mode}: VERIFIED -> HYPOTHESIS (${hasil.alasan}); dokumen dilampirkan: ${judulDokumen?.length ?? 0}`);
    return `${hasil.jawaban}\n\n${hasil.catatan}`;
  }
  return hasil.jawaban;
}

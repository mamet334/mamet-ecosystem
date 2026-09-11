/**
 * PERAPIAN RIWAYAT PERCAKAPAN (Item 68, 2026-09-11)
 *
 * Menggantikan "Cognitive Memory Compressor" yang meringkas riwayat dengan AI begitu riwayat
 * melebihi 4.000 huruf. Terukur di produksi (Item 67, chat "apa itu inflasi"):
 *   - 36,5 detik menunggu ringkasan SEBELUM pencarian dokumen dan jawaban dimulai;
 *   - $0,00022 (1.038 token masuk, 867 keluar + 552 token penalaran) untuk menghemat ±700 token
 *     yang di model flash bernilai ±$0,00005 — lebih mahal daripada yang dihemat. Ia memakai model
 *     pesan itu sendiri, jadi di tingkat THINKING (`deepseek-v4-pro`) biayanya ±$0,002;
 *   - diulang dari nol di setiap pesan setelah riwayat melewati ambang.
 *
 * Kini tanpa AI: dua pesan terakhir utuh, pesan yang lebih lama dipangkas ke awalnya. Tanpa biaya,
 * tanpa jeda. Awal jawaban cukup untuk mengenali topik — tulis ulang pertanyaan lanjutan (Item 67)
 * terbukti benar dengan jawaban asisten dipotong 800 huruf. Fakta di tengah jawaban lama bisa
 * hilang; untuk pertanyaan tentang dokumen, isinya diambil lagi lewat pencarian dokumen.
 */
const AMBANG_HURUF = 4000;
const PESAN_UTUH = 2;
const MAKS_HURUF_PESAN_LAMA = 800;

export function rapikanRiwayat(history: any[], pesanSaatIni: string): any[] {
  let riwayat = Array.isArray(history) ? [...history] : [];

  // ConversationEngine mengirim riwayat yang SUDAH memuat pesan saat ini di ujungnya, lalu pesan yang
  // sama dikirim lagi sebagai prompt — model menerimanya dua kali (Item 66). Dibuang di sini hanya
  // bila benar-benar sama, supaya klien lain yang tak menyertakannya tidak kehilangan pesan.
  const terakhir = riwayat[riwayat.length - 1];
  if (terakhir?.role === 'user' && typeof terakhir.content === 'string'
      && pesanSaatIni && terakhir.content.trim() === pesanSaatIni.trim()) {
    riwayat = riwayat.slice(0, -1);
  }

  const total = riwayat.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  if (total < AMBANG_HURUF || riwayat.length <= PESAN_UTUH) return riwayat;

  const batas = riwayat.length - PESAN_UTUH;
  const hasil = riwayat.map((m, i) => {
    if (i >= batas || typeof m?.content !== 'string' || m.content.length <= MAKS_HURUF_PESAN_LAMA) return m;
    return { ...m, content: `${m.content.slice(0, MAKS_HURUF_PESAN_LAMA)}… [dipangkas]` };
  });
  const totalBaru = hasil.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0);
  console.log(`[Riwayat] ${riwayat.length} pesan, ${total} → ${totalBaru} huruf (pesan lama dipangkas ke ${MAKS_HURUF_PESAN_LAMA} huruf, ${PESAN_UTUH} terakhir utuh).`);
  return hasil;
}

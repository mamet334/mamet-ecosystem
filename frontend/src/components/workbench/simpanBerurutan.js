/**
 * Satu penyimpanan chat pada satu waktu, TANPA melewatkan perubahan (T17, 29 Okt 2026).
 *
 * Dulu timer penyimpanan otomatis yang berbunyi saat penyimpanan sebelumnya masih berjalan langsung keluar
 * (`if (isSavingRef.current) return;`) tanpa menjadwal ulang: perubahan itu baru tersimpan pada perubahan BERIKUTNYA —
 * jawaban terakhir sebuah percakapan bisa tak pernah sampai ke tabel `chats` bila aplikasi ditutup lebih dulu. Tanda
 * "sedang menyimpan" juga baru dipasang SESUDAH `await getSession()`, jadi dua penyimpanan bisa berjalan bersamaan dan
 * yang lebih lama bisa selesai belakangan (menimpa yang baru).
 *
 * Kini: tanda dipasang SEKETIKA; permintaan yang datang selama penyimpanan berjalan DICATAT, lalu `ulangi()` (pengamat
 * penyimpanan otomatis) dijalankan sekali sesudahnya — ia sendiri yang membandingkan keadaan SEKARANG dengan yang baru
 * disimpan. Penyimpanan yang gagal TANPA permintaan baru tidak diulang (tak ada lingkaran coba-ulang tiap detik).
 *
 * @param {{ current: boolean }} sedangRef   tanda "sedang menyimpan" (ref tersimpan, bertahan saat layar dilepas)
 * @param {{ current: boolean }} tertundaRef ada permintaan yang datang selama penyimpanan berjalan
 * @param {() => Promise<void>} simpan
 * @param {() => void} ulangi dijalankan bila ada permintaan tertunda
 */
export async function simpanBerurutan(sedangRef, tertundaRef, simpan, ulangi) {
  if (sedangRef.current) {
    tertundaRef.current = true;
    return;
  }
  sedangRef.current = true;
  try {
    await simpan();
  } finally {
    sedangRef.current = false;
    if (tertundaRef.current) {
      tertundaRef.current = false;
      ulangi();
    }
  }
}

/**
 * jejakSisipan.js — MATA, bukan perbaikan (2026-10-01).
 *
 * Sisipan konteks Engineer (catatan akar repo, peta repo, ingatan temuan) terbukti hilang di
 * kiriman LANJUTAN: riwayat 16.945 huruf pada pesan pertama, lalu 2.290 huruf pada pesan kedua di
 * percakapan yang sama — padahal mode tetap ENGINEER (log `[RequestParser]`).
 *
 * Tiga teori sudah ditumbangkan angka:
 *   1. anggaran konteks sempit  → jendela model ternyata 1.048.576 token, anggaran ±629.000
 *   2. turun ke mode LOOKUP     → log membuktikan mode tetap ENGINEER di kedua kiriman
 *   3. jendela konteks (Owner)  → sama dengan (1): anggarannya ratusan ribu token
 *
 * Menebak keempat kali bukan ketekunan. Sisipan disusun di SISI KLIEN dan tidak meninggalkan satu
 * pun jejak di log server — itu sebabnya kita buta. Berkas ini menutup kebutaan itu.
 *
 * ── Kenapa ini penting walau peta mungkin dipindah ke berkas ────────────────────────────────
 * Lubang yang sama membawa TIGA penumpang. Yang paling merugikan bukan petanya — uji live 1 Okt
 * justru berhasil di kiriman yang TANPA peta — melainkan **ingatan temuan**: temuan yang sudah
 * disepakati Owner dan Engineer di pesan sebelumnya ikut lenyap, tanpa satu pun tanda di layar.
 *
 * ── Yang dicatat: UKURAN, bukan isi ─────────────────────────────────────────────────────────
 * Isi sisipan memuat alamat repo dan potongan temuan. Mencatat isinya ke konsol berarti menaruh
 * salinan konteks di tempat yang tidak pernah diminta Owner. Jumlah huruf sudah cukup untuk
 * menjawab pertanyaannya, dan tidak membawa apa pun yang perlu dirahasiakan.
 */

const panjang = (s) => (typeof s === 'string' ? s.length : 0);

/**
 * Satu baris ringkas tentang apa yang BENAR-BENAR disusun untuk satu kiriman.
 *
 * Memisahkan `petaMentah` (yang dikembalikan proses utama) dari `catatanPeta` (catatan yang
 * disusun darinya) itu disengaja: bila yang pertama berisi tetapi yang kedua kosong, yang rusak
 * penyusun catatannya; bila dua-duanya kosong, yang rusak jembatan IPC-nya. Satu baris ini
 * membedakan dua kerusakan yang gejalanya identik di layar.
 *
 * @returns {string} baris log, atau '' bila bukan ruang Engineer (tak ada yang perlu dicatat)
 */
export function jejakSisipan({
  engineer = false,
  akarRepo = '',
  petaMentah = '',
  catatanAkar = '',
  catatanPeta = '',
  ringkasanTemuan = '',
  mulaiDari = 0,
  jumlahPesan = 0,
} = {}) {
  if (!engineer) return '';

  const bagian = [
    ['akar', panjang(catatanAkar)],
    ['peta', panjang(catatanPeta)],
    ['temuan', panjang(ringkasanTemuan)],
  ];
  const terpasang = bagian.filter(([, n]) => n > 0);
  const total = bagian.reduce((n, [, x]) => n + x, 0);
  const kosong = bagian.filter(([, n]) => n === 0).map(([nama]) => nama);

  return [
    '[Sisipan]',
    `akarRepo=${akarRepo ? 'ADA' : 'KOSONG'}`,
    `petaMentah=${panjang(petaMentah)}`,
    `→ ${bagian.map(([nama, n]) => `${nama}=${n}`).join(' ')}`,
    `| ${terpasang.length} sisipan / ${total} huruf`,
    `| mulaiDari=${mulaiDari} dari ${jumlahPesan} pesan`,
    kosong.length ? `| KOSONG: ${kosong.join(', ')}` : '',
  ].filter(Boolean).join(' ');
}

// PENJAGA BERKAS RAHASIA (T12, 2026-09-29) — isi berkas rahasia tidak ikut terkirim ke penyedia model.
//
// T12 bukan bug, melainkan sifat sistem: apa pun yang DIBACA alat folder/repo berakhir di dalam prompt,
// dan prompt dikirim ke OpenRouter — yang merutekannya lagi ke penyedia hulu yang berganti-ganti
// (terukur 28 Sep: 8 penyedia untuk satu nama model dalam 4 jam). Tidak ada satu pun pemberitahuan.
//
// Sifat itu TIDAK bisa dihilangkan selama modelnya di awan, dan Owner menutupnya sebagai batas yang
// diketahui. Yang bisa ditutup adalah bagian yang paling mahal bila lolos: **berkas rahasia**. Sekali
// kunci API atau kunci privat masuk ke prompt, ia sudah keluar — tidak ada cara menariknya kembali.
//
// KENAPA DAFTARNYA SEMPIT. Melarang terlalu banyak akan membuat alatnya dihindari, dan yang dihindari
// tidak menjaga apa pun. Daftar ini persis yang diputuskan Owner 28 September: `.env`, `*.key`, `*.pem`.
//
// KENAPA `.env.example` TIDAK ikut. Ia memang dibuat untuk dibaca — berisi NAMA variabel tanpa nilainya,
// dan justru itu yang dibutuhkan model saat menjelaskan setelan. Menolaknya berarti menolak berkas yang
// tidak memuat satu pun rahasia.

const path = require('path');

// `.env`, `.env.local`, `.env.production`, … tetapi BUKAN `.env.example` dan kerabatnya.
const CONTOH_ENV = /^\.env\.(example|sample|template|dist|defaults?)$/i;
const ENV = /^\.env(\..+)?$/i;
const EKSTENSI_KUNCI = new Set(['.key', '.pem']);

/**
 * Apakah berkas ini rahasia (isinya tidak boleh dibaca alat yang hasilnya masuk prompt)?
 * @param {string} alamat alamat relatif atau nama berkas; pemisah `/` maupun `\` diterima
 */
function adalahBerkasRahasia(alamat) {
  const teks = String(alamat || '').trim();
  if (!teks) return false;
  const nama = teks.split(/[\\/]+/).filter(Boolean).pop() || '';
  if (!nama) return false;
  if (CONTOH_ENV.test(nama)) return false;              // diperiksa LEBIH DULU daripada ENV
  if (ENV.test(nama)) return true;
  return EKSTENSI_KUNCI.has(path.extname(nama).toLowerCase());
}

/**
 * Alasan penolakan — menyebut sebabnya DAN jalan lain, bukan sekadar melarang.
 * Prosedur kerja Engineer langkah 0.4: larangan tanpa ganti cara hanya memindahkan kemacetan,
 * dan model yang ditolak tanpa arah akan mengarang jalan memutar (terbukti live 28 September).
 */
function alasanRahasia(alamat) {
  const nama = String(alamat || '').split(/[\\/]+/).filter(Boolean).pop() || 'berkas ini';
  return `"${nama}" adalah berkas rahasia (.env / kunci) dan TIDAK dibaca: isinya akan ikut terkirim ke penyedia model, dan yang sudah terkirim tidak bisa ditarik kembali. Bila Anda butuh NAMA variabelnya, baca berkas contoh seperti .env.example, atau minta pengguna menyebutkannya sendiri.`;
}

module.exports = { adalahBerkasRahasia, alasanRahasia };

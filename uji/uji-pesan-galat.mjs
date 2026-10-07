// UJI 2026-10-08 — galat yang sampai ke pengguna Mametlite memakai bahasanya, bukan bahasa server.
//
// Keadaan sebelum (M4, `ROADMAP-SIAP-PENGGUNA.md`): `App.jsx` menuliskan `❌ Error: ${err.message}`
// ke gelembung chat, dan `err.message` datang dari `callAgentSimple.js:100` yang memulangkan teks
// server APA ADANYA. Yang dibaca pegawai ASN di HP: `❌ Error: ENGINEER_NO_API_KEY`,
// `❌ Error: Server error: 500`, `❌ Error: Failed to fetch`. Galat masuk lebih buruk lagi —
// `alert(error.message)`, kotak sistem berisi "Invalid login credentials".
//
// Tiga sifat yang dijaga, dan yang kedua paling mudah dilanggar saat orang menambah pesan baru:
//
//   1. BAHASANYA  — judul & saran bahasa Indonesia, tanpa istilah teknis yang bocor.
//   2. JUJUR      — tanda yang TIDAK dikenali menghasilkan pesan UMUM, bukan tebakan yang terdengar
//                   yakin. Pesan yakin yang salah lebih merugikan daripada pesan umum.
//   3. TIDAK MENELAN — teks teknisnya tetap ada. Pengguna HP tak punya DevTools; kalau sebabnya
//                   hilang, satu-satunya cara melapor adalah "errornya merah".

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const P = await import(
  pathToFileURL(`${AKAR}/mametlite/src/lib/pesanGalat.js`).href + '?v=' + Date.now()
);

console.log(`uji-pesan-galat v1 · modul: ${P.VERSI_PESAN_GALAT}`);

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

// Istilah yang TIDAK boleh muncul di kalimat yang dibaca pengguna. "OpenRouter" & "Pengaturan"
// sengaja tidak termasuk: keduanya nama benda yang pengguna LIHAT di layarnya sendiri.
const BOCOR = /\b(error|failed|fetch|server error|invalid|credentials|undefined|null|exception|stack|API_KEY|NetworkError)\b/i;

// ── 1. Tanda yang dikenali → bahasa pengguna + tindakan ─────────────────────────────────────────
console.log('\n-- 1. tanda dikenali: bahasa pengguna, dan ada tindakannya --');

const kasus = [
  ['Failed to fetch', /koneksi internet/i, 'jaringan mati'],
  ['NetworkError when attempting to fetch resource.', /koneksi internet/i, 'jaringan (Firefox)'],
  ['ENGINEER_NO_API_KEY', /kunci openrouter/i, 'kunci belum dipasang — string yang BENAR-BENAR muncul (CHANGELOG mametlite)'],
  ['NO_API_KEY', /kunci openrouter/i, 'kunci belum dipasang'],
  ['401 No auth credentials found', /ditolak/i, 'kunci ditolak'],
  ['402 can only afford 1048 tokens', /saldo/i, 'saldo tidak cukup'],
  ['429 rate limit exceeded', /tunggu/i, 'terlalu sering'],
  ['Server error: 500', /server/i, 'server bermasalah'],
  ['Server error: 503', /server/i, 'server bermasalah (503)'],
  ['Unexpected response format', /tidak dikenali/i, 'string Inggris yang KITA tulis sendiri'],
];

for (const [mentah, polaJudul, nama] of kasus) {
  const h = P.pesanUntukPengguna(new Error(mentah));
  cek(polaJudul.test(h.judul) || polaJudul.test(h.saran || ''), `${nama} → dikenali`, h);
  cek(!BOCOR.test(h.judul), `${nama} → judulnya tanpa istilah teknis`, h.judul);
  cek(!!h.saran && !BOCOR.test(h.saran), `${nama} → sarannya ada dan bersih`, h.saran);
  cek(h.teknis === mentah, `${nama} → teks teknisnya UTUH untuk pelaporan`, h.teknis);
}

// Saldo: catatan Owner — saldo minus TIDAK berarti layanan mati, sebagian permintaan kecil masih
// dilayani. Pesannya tidak boleh menyatakan lebih dari itu.
const saldo = P.pesanUntukPengguna(new Error('402 can only afford 1048 tokens'));
cek(
  /lebih pendek|kecil/i.test(saldo.saran),
  'saldo: pesannya menyebut permintaan kecil kadang masih bisa — bukan "layanan mati"',
  saldo.saran,
);

// ── 2. Tidak dikenali → umum, bukan tebakan ─────────────────────────────────────────────────────
console.log('\n-- 2. tidak dikenali → umum, tidak menebak --');

for (const aneh of ['QWERTY_ZZZ', '', 'at Object.<anonymous> (/x.js:1:1)']) {
  const h = P.pesanUntukPengguna(new Error(aneh));
  cek(!BOCOR.test(h.judul), `"${aneh.slice(0, 20)}" → judul bersih`, h.judul);
  cek(
    !/koneksi internet|saldo|kunci openrouter/i.test(h.judul + h.saran),
    `"${aneh.slice(0, 20)}" → TIDAK menebak sebab yang spesifik`,
    h,
  );
  cek(!!h.teknis, 'teks teknisnya tetap ada walau kosong di sumbernya', h.teknis);
}

cek(P.pesanUntukPengguna(null).teknis === 'tanpa keterangan', 'null tidak melempar & tetap punya teknis');
cek(P.pesanUntukPengguna('teks biasa').teknis === 'teks biasa', 'galat berupa string juga ditangani');

// ── 3. Galat masuk ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. galat masuk (Supabase Auth) --');

const masuk = [
  ['Invalid login credentials', /email atau kata sandi/i, 'kredensial salah'],
  ['Email not confirmed', /konfirmasi/i, 'email belum dikonfirmasi'],
  ['Request rate limit reached', /tunggu/i, 'terlalu sering'],
  ['Failed to fetch', /koneksi internet/i, 'jaringan mati'],
];
for (const [mentah, pola, nama] of masuk) {
  const h = P.pesanGalatMasuk(new Error(mentah));
  cek(pola.test(h.judul) || pola.test(h.saran || ''), `masuk: ${nama} → dikenali`, h);
  cek(!BOCOR.test(h.judul), `masuk: ${nama} → judulnya bersih`, h.judul);
  cek(h.teknis === mentah, `masuk: ${nama} → teknisnya utuh`, h.teknis);
}
const masukAneh = P.pesanGalatMasuk(new Error('ZZZ'));
cek(!/email atau kata sandi/i.test(masukAneh.judul), 'masuk: tanda tak dikenali tidak menuduh sandi salah', masukAneh);

// ── 4. TERPASANG ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. terpasang: jalur lama benar-benar hilang --');

const APP = readFileSync(`${AKAR}/mametlite/src/App.jsx`, 'utf8');
const KODE = APP.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((b) => !/^\s*(\/\/|\{\s*\/\*)/.test(b))
  .join('\n');

cek(!/`❌ Error: \$\{err\.message\}`/.test(KODE), 'teks server mentah tidak lagi ditulis ke gelembung chat');
cek(!/alert\(error\.message\)/.test(KODE), '`alert(error.message)` untuk galat masuk sudah tidak ada');
cek(/pesanUntukPengguna\(/.test(KODE), 'jalur chat memakai penerjemah');
cek(/pesanGalatMasuk\(/.test(KODE), 'jalur masuk memakai penerjemah');
cek(/galatMasuk &&/.test(KODE), 'dan galat masuk BENAR-BENAR dirender di formulirnya, bukan di alert');

// Gelembung kosong yang tertinggal: dua gelembung untuk satu kegagalan.
cek(
  /akhir\.role === 'assistant' && !akhir\.content/.test(KODE),
  'gelembung penampung yang kosong DIGANTI saat gagal, bukan ditinggalkan',
);

// Mutasi di tempat pada objek pesan yang masih dibagi dengan state sebelumnya.
cek(
  !/newArr\[newArr\.length - 1\]\.content = /.test(KODE),
  'objek pesan tidak lagi diubah di tempat saat arus mengalir (tak aman di StrictMode)',
);

// Hapus percakapan tidak bisa dibatalkan, dan riwayatnya hanya ada di peramban ini.
const blokHapus = (KODE.match(/const handleDeleteChat[\s\S]{0,700}/) || [''])[0];
cek(/window\.confirm/.test(blokHapus), 'hapus percakapan bertanya dulu (hapus dokumen sudah sejak dulu)');
cek(/tidak bisa dikembalikan/i.test(blokHapus), 'dan pertanyaannya menyebutkan bahwa itu permanen');
cek(/riwayatBaru\(\)/.test(blokHapus), 'percakapan awal diambil dari satu sumber, tidak disalin ulang');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);

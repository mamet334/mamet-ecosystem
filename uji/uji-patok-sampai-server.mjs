// UJI 2026-10-01 — patokan sisipan harus SAMPAI ke server dan dihormati di sana.
//
// ── Cacat yang ditutup, dengan buktinya ─────────────────────────────────────────────────────
// Dua kiriman berurutan di satu percakapan Engineer, log server:
//
//   [Riwayat] 3 pesan, 16999 → 16999 huruf   kiriman ke-1: peta masih termasuk "dua terakhir"
//   [Riwayat] 5 pesan, 17311 →  2065 huruf   kiriman ke-2: peta 16.059 huruf dipotong jadi 800
//
// `rapikanRiwayat()` memangkas SETIAP pesan kecuali dua terakhir menjadi 800 huruf. Sisipan ada di
// DEPAN, jadi begitu percakapan punya lebih dari dua pesan, peta repo dan ingatan temuan terpangkas
// — tanpa satu pun tanda di layar.
//
// Ini cacat arsitektur yang SAMA dengan yang sudah diperbaiki di klien (`pilihPesanKonteks`):
// sisipan diperlakukan sebagai "pesan lama". Bedanya, pemangkas server berdiri sendiri dan tidak
// pernah terlihat dari sisi klien.
//
// ── Kekeliruan saya sendiri yang membuatnya mungkin ─────────────────────────────────────────
// Penanda `_patok` dulu sengaja DIBUANG sebelum payload dikirim, dengan alasan "penanda internal
// tidak boleh bocor ke server". Keputusan itu yang membuat pemangkas server buta. Penandanya kini
// ikut, dan uji ini menjaga KEDUA sisinya supaya tidak ada lagi yang memutusnya sendirian.

import { pathToFileURL } from 'node:url';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const imp = (p) => import(pathToFileURL(`${AKAR}/${p}`).href + '?v=' + Date.now());

const K = await imp('frontend/src/core/runtime/services/KonteksChat.js');
const H = await imp('supabase/functions/agent-process/lib/request/history_compressor.ts');
const { pilihPesanKonteks, PATOK } = K;
const { rapikanRiwayat } = H;

console.log('uji-patok-sampai-server v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const patok = (teks) => ({ role: 'user', content: teks, [PATOK]: true });
const biasa = (teks, role = 'user') => ({ role, content: teks });
const isi = (n) => 'x'.repeat(n);

// ── 1. Penandanya sampai ke payload ─────────────────────────────────────────────────────────
// Tanpa ini, perbaikan di server tidak pernah menyala — dan itulah keadaan sebelum hari ini.
console.log('\n-- penanda ikut ke payload --');
{
  const h = pilihPesanKonteks([patok('PETA'), biasa('tanya')], { anggaranToken: 60000 });
  cek(h.dikirim[0][PATOK] === true, 'sisipan membawa penandanya saat dikirim', h.dikirim[0]);
  cek(h.dikirim[1][PATOK] === undefined, 'pesan biasa TIDAK ikut tertandai', h.dikirim[1]);
  cek(h.dikirim[0].content === 'PETA' && h.dikirim[0].role === 'user', 'isi & peran tetap utuh');
}

// ── 2. Server menghormatinya — ini inti perbaikannya ────────────────────────────────────────
// Keadaan persis seperti kiriman ke-2 yang gagal: sisipan besar di depan, percakapan di belakang.
console.log('\n-- server tidak memangkas sisipan --');
{
  const peta = patok(isi(16059));
  const riwayat = [patok(isi(428)), peta, patok(isi(512)), biasa(isi(47)), biasa(isi(265), 'model')];
  const h = rapikanRiwayat(riwayat, 'pertanyaan yang sedang ditanyakan');

  cek(h[1].content.length === 16059, 'peta 16.059 huruf TIDAK dipangkas', h[1].content.length);
  cek(!/\[dipangkas\]/.test(h[1].content), 'dan tidak diberi penanda terpangkas');
  cek(h[0].content.length === 428 && h[2].content.length === 512, 'sisipan lain tetap utuh');
  const total = h.reduce((n, m) => n + m.content.length, 0);
  cek(total === 17311, `total tetap 17.311 huruf (sebelum perbaikan: 2.065)`, total);
}

// ── 3. Pemangkasan pesan BIASA tetap bekerja ────────────────────────────────────────────────
// Memperbaiki sisipan tidak boleh mematikan perapian riwayat. Aturan itu lahir dari Item 68 dan
// menggantikan peringkas AI yang makan 36,5 detik dan lebih mahal daripada yang dihemat.
console.log('\n-- pesan biasa tetap dipangkas --');
{
  const riwayat = [biasa(isi(5000)), biasa(isi(5000), 'model'), biasa(isi(900)), biasa(isi(900), 'model')];
  const h = rapikanRiwayat(riwayat, 'pertanyaan lain');
  cek(h[0].content.length === 800 + '… [dipangkas]'.length, 'pesan lama yang panjang tetap dipangkas ke 800', h[0].content.length);
  cek(h[3].content.length === 900, 'dua pesan terakhir tetap utuh', h[3].content.length);
}

// ── 4. Sisipan tidak mengubah SIAPA dua terakhir ────────────────────────────────────────────
// Kalau sisipan ikut terhitung sebagai "dua terakhir", pesan percakapan yang paling baru justru
// yang terpangkas — kebalikan dari maksudnya.
console.log('\n-- dua terakhir tetap pesan percakapan --');
{
  const riwayat = [patok(isi(9000)), biasa(isi(3000)), biasa(isi(3000), 'model')];
  const h = rapikanRiwayat(riwayat, 'x');
  cek(h[0].content.length === 9000, 'sisipan utuh');
  cek(h[1].content.length === 3000 && h[2].content.length === 3000, 'dua pesan percakapan terakhir juga utuh', [h[1].content.length, h[2].content.length]);
}

// ── 5. Pesan saat ini yang terduplikasi tetap dibuang ───────────────────────────────────────
// Perilaku lama (Item 66) tidak boleh ikut berubah: model pernah menerima pertanyaan DUA KALI.
console.log('\n-- duplikat pesan saat ini --');
{
  const h = rapikanRiwayat([patok('PETA'), biasa('halo'), biasa('pertanyaan')], 'pertanyaan');
  cek(h.length === 2, 'pesan terakhir yang sama dengan pesan saat ini dibuang', h.map((m) => m.content));
  cek(h[0].content === 'PETA', 'sisipan tetap di depan sesudah pembuangan itu');
}

// ── 6. Nalar lama tetap dibersihkan ─────────────────────────────────────────────────────────
console.log('\n-- <think> tetap dibuang --');
{
  const h = rapikanRiwayat([biasa('<think>nalar lama</think>jawaban', 'model')], 'x');
  cek(h[0].content === 'jawaban', 'blok <think> jawaban lama tidak dikirim ulang', h[0].content);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

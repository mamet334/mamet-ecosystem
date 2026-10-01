// UJI 2026-10-01 — satu patch, SATU spanduk.
//
// ── Kejadian live yang melahirkannya ────────────────────────────────────────────────────────
// Uji kendali Tahap 6 (patch yang BENAR, 1 Okt 14.25): patch lulus 61/61 dan berkasnya tetap
// berubah — penjaga terbukti bukan penolak segalanya. Tetapi Owner menerima DUA spanduk:
//
//   1. "✅ Patch Berhasil!" + daftar berkas + checkpoint + laporan verifikasi, yang ditutup
//      dengan batas dirinya sendiri: *"yang dijanjikan hanya patch tidak merusak yang sudah
//      terbukti, bukan patch ini benar"*.
//   2. "✅ Patch Berhasil Diterapkan!" + *"File telah dimodifikasi sesuai instruksi Anda."*
//
// Yang kedua bukan sekadar mubazir — ia MEMBANTAH yang pertama, dan karena ia duduk paling
// bawah, dialah yang berdiri sebagai kesimpulan. Tak ada satu pun kode yang pernah memeriksa
// apakah berkas sudah "sesuai instruksi".
//
// Perbaikan 1 Okt sebelumnya (4a69910) hanya menutup kasus DIPULIHKAN — di sana memang sudah
// tidak ada spanduk kedua. Kasus BERHASIL tak ikut tertutup, dan baru ketahuan ketika uji
// kendali dijalankan: sebelum itu tak pernah ada patch yang diverifikasi DAN lolos.
//
// ── Kenapa jalur yang dipertahankan adalah `Engineer:PatchApplied` ──────────────────────────
// Ia satu-satunya yang tahu `verifikasi.dipulihkan` dan membawa `verifikasi.laporan`. Jalur
// rekomendasi PATCH_APPLIED hanya memegang jumlah berkas. Memilih yang miskin informasi berarti
// membuang laporan verifikasi — jadi yang digambar adalah yang kaya, dan yang miskin tetap
// dipancarkan sebagai CATATAN tanpa menyentuh layar.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');

console.log('uji-spanduk-patch-tunggal v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
const ENG = baca('frontend/src/core/runtime/services/engineer.js');
const APPLIER = baca('frontend/src/core/runtime/services/engineer/PatchApplier.js');

// ── 1. Spanduk kedua tidak digambar lagi ────────────────────────────────────────────────────
//
// Diukur pada kode TANPA baris komentar. Versi pertama uji ini merah karena komentar penjelas
// yang BARU SAJA saya tulis di ConversationEngine.jsx mengutip kalimat "sesuai instruksi Anda"
// untuk menerangkan kenapa ia dibuang — uji membaca kutipan itu sebagai bukti bahwa ia masih
// dipakai. Jebakan yang sama pernah terjadi di uji-konteks-chat (28 Sep): asersi harus menguji
// PEMAKAIAN, bukan PENYEBUTAN. Kalau tidak, menjelaskan sebuah perbaikan jadi membatalkannya.
console.log('\n-- spanduk kedua --');

const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
const CE_KODE = tanpaKomentar(CE);

cek(!/Patch Berhasil Diterapkan/.test(CE_KODE),
  'layar tidak lagi menggambar "Patch Berhasil Diterapkan"', (CE_KODE.match(/.*Patch Berhasil Diterapkan.*/g) || []));

// Kalimat inilah racunnya, bukan judulnya: ia mengaku memeriksa sesuatu yang tak diperiksa.
cek(!/sesuai instruksi Anda/.test(CE_KODE),
  'klaim "sesuai instruksi Anda" hilang — tak ada kode yang pernah memeriksanya',
  (CE_KODE.match(/.*sesuai instruksi Anda.*/g) || []));

// Cabang PATCH_APPLIED tak boleh kembali lewat pintu lain (mis. ditulis ulang jadi setMessages
// polos). Yang dijaga: jenis itu tidak lagi muncul di komponen layar sama sekali.
cek(!/rec\.type === 'PATCH_APPLIED'/.test(CE_KODE),
  'tidak ada cabang PATCH_APPLIED di komponen layar', (CE_KODE.match(/.*PATCH_APPLIED.*/g) || []));

// ── 2. Yang BUKAN sasaran perbaikan harus utuh ──────────────────────────────────────────────
// Membuang satu cabang dari rantai if/else gampang merusak tetangganya: `else if` yang kehilangan
// `if` di depannya adalah galat sintaks, dan patch yang DITOLAK akan ikut hilang diam-diam.
console.log('\n-- tetangganya utuh --');

// Lookbehind-nya penting. Versi pertama asersi ini memakai `\bif \(` saja — dan `\b` cocok juga di
// tengah "else if", jadi ia tetap hijau ketika uji mutasi sengaja mengembalikan cabang PATCH_APPLIED
// di depannya. Asersi yang tak bisa merah tidak menjaga apa pun.
cek(/(?<!else )if \(rec\.type === 'PATCH_REJECTED'\) \{/.test(CE),
  'PATCH_REJECTED kini memimpin rantai, bukan `else if` yatim', (CE.match(/.*PATCH_REJECTED.*/g) || []));
cek(/Patch Ditolak/.test(CE), 'patch yang ditolak masih diumumkan');
cek(/Patch Gagal/.test(CE), 'patch yang gagal masih diumumkan');
for (const t of ['CAPABILITY_BLOCKED', 'REASONING_REJECTED', 'ASK_CLARIFICATION']) {
  cek(CE.includes(`rec.type === '${t}'`), `cabang ${t} tidak ikut terbawa`);
}

// ── 3. Jalur yang dipertahankan masih menggambar ────────────────────────────────────────────
// Membuang spanduk kedua tanpa memastikan yang pertama masih ada = Owner menerapkan patch dan
// tidak mendapat kabar apa pun.
console.log('\n-- jalur yang dipertahankan --');

cek(/Patch Berhasil!/.test(CE), 'spanduk "Patch Berhasil!" tetap ada');
cek(/Patch dibatalkan sendiri/.test(CE), 'spanduk pemulihan Tahap 6 tetap ada');
cek(/data\?\.verifikasi\?\.laporan/.test(CE), 'laporan verifikasi tetap ditempel apa adanya');
cek(/eventBus\.on\('Engineer:PatchApplied', patchAppliedHandler\)/.test(CE),
  'pendengarnya masih terpasang');

// Peristiwa kaya dipancarkan TANPA SYARAT di akhir tiap penerapan. Tanpa ini, membuang spanduk
// kedua bisa menyisakan jalur yang menerapkan patch tanpa kabar sama sekali.
cek(/\n    eventBus\.emit\('Engineer:PatchApplied', result\);/.test(APPLIER),
  'Engineer:PatchApplied dipancarkan tanpa syarat (bukan di dalam if)',
  (APPLIER.match(/.*Engineer:PatchApplied.*/g) || []));

// ── 4. Catatannya tetap dipancarkan ─────────────────────────────────────────────────────────
// Yang dibuang adalah GAMBARNYA, bukan peristiwanya: rekomendasi tetap jadi catatan sesi.
console.log('\n-- catatan tetap dipancarkan --');

cek(/if \(!dipulihkan\) \{\s*this\._emitRecommendation\(\{\s*type: 'PATCH_APPLIED'/.test(ENG),
  'engineer.js masih memancarkan PATCH_APPLIED sebagai catatan, tetap dijaga !dipulihkan',
  (ENG.match(/.*PATCH_APPLIED.*/g) || []));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

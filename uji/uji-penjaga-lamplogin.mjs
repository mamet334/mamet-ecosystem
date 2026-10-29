// UJI 2026-10-19 — `LampLogin.jsx` tidak berubah satu bait pun selama Item 127 (Tahap 0).
//
// Kenapa ada: Owner menetapkan dua batas untuk pekerjaan tampilan menu game (Item 127):
//   "kecuali tampilan login yang sudah memakai login.jsx"    — layar masuk dikecualikan
//   "untuk pekerjaan ini jangan dulu mengubah lamblogin"      — dan tidak disentuh, 19 Okt 2026
//
// Batas seperti itu mudah dilanggar TANPA SENGAJA: Tahap 3 akan menggambar ruangan aplikasi yang meniru
// geometri & palet LampLogin, dan langkah paling wajar seorang engineer adalah "mengekstrak ruangannya
// jadi komponen bersama" — yang berarti mengubah LampLogin. Uji ini membuat pelanggaran itu merah, bukan
// sekadar tertulis di dokumen.
//
// Cara kerjanya: sidik jari SHA-256 isi berkas. Akhir baris DINORMALKAN ke LF lebih dulu — git di mesin
// Owner mengubah LF→CRLF saat checkout (berkas di disk memang ber-CR), jadi tanpa normalisasi uji akan
// merah hanya karena cara berkasnya diambil, bukan karena isinya berubah.
//
// Bila Owner KELAK mengizinkan LampLogin diubah (K5 roadmap: menyatukan "dua ruangan"), perbarui
// SIDIK_JARI di sini pada commit yang sama, dan sebut izinnya di pesan commit. Jangan memperbaruinya
// hanya karena uji merah.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const sidik = (teks) => createHash('sha256').update(teks).digest('hex');

console.log('uji-penjaga-lamplogin v3');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

// Riwayat sidik jari:
//   19 Okt — 59348a0c… (2efe639, 403 baris) · 20 Okt v2 — sama, dengan 4 penggantian ikon yang diizinkan dibalik dulu.
//   29 Okt v3 — 8f23d2d2… (556 baris): izin Owner 29 Okt untuk T19 lupa & ganti kata sandi (ADR-0022 K4) — mode "lupa"
//   & "kata sandi baru" di panel yang sama; tampilan masuk biasa tak berubah. Ikon 20 Okt sudah termasuk di dalamnya,
//   jadi pembalikan ikon v2 tidak diperlukan lagi.
const SIDIK_JARI = '8f23d2d2c0c0f2833fd4bdeabe243a8f745cdfdd68f040e38086e346304b37fe';

// ── 1. Penjaga itu menggigit ────────────────────────────────────────────────────────────────────
console.log('\n-- 1. sidik jari peka terhadap satu bait, tetapi tidak terhadap CRLF --');
const asli = baca('frontend/src/components/LampLogin.jsx');
cek(sidik(asli + ' ') !== sidik(asli), 'satu spasi tambahan mengubah sidik jari');
cek(sidik(asli.replace(/\n/g, '\r\n').replace(/\r\n/g, '\n')) === sidik(asli),
  'CRLF yang dinormalkan menghasilkan sidik jari yang sama');

// ── 2. Berkasnya tidak berubah sejak izin terakhir (29 Okt, T19) ────────────────────────────────
console.log('\n-- 2. LampLogin.jsx sama persis dengan isi yang diizinkan Owner 29 Okt --');
cek(sidik(asli) === SIDIK_JARI, 'isi LampLogin.jsx sama persis dengan sidik jari 29 Okt (izin T19)',
  { sekarang: sidik(asli), seharusnya: SIDIK_JARI });
// Kendali: perubahan satu kata harus merah.
cek(sidik(asli.replace('Memproses...', 'Memproses…')) !== SIDIK_JARI, 'kendali: satu kata berubah → merah');

// ── 3. Penjaga ini menjaga hal yang benar ───────────────────────────────────────────────────────
// Sidik jari yang utuh tidak berarti apa-apa bila layar masuk diam-diam diganti komponen lain. Yang
// Owner lindungi adalah LAYAR MASUK yang tampil, dan yang tampil ditentukan App.jsx.
console.log('\n-- 3. LampLogin masih layar masuk yang tampil --');
const app = baca('frontend/src/App.jsx');
cek(/import\s+LampLogin\s+from\s+['"]\.\/components\/LampLogin['"]/.test(app), 'App.jsx mengimpor LampLogin');
cek(/<LampLogin\b/.test(app), 'App.jsx merender <LampLogin> untuk pengguna yang belum masuk');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

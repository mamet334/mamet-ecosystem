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

console.log('uji-penjaga-lamplogin v2');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

// Diambil 19 Okt 2026 dari isi berkas pada commit terakhir yang menyentuhnya (2efe639, 29 Sep), 403 baris.
const SIDIK_JARI = '59348a0c5ab52e28dc8d183390d25defd6e2e272501ec39ddecf7d78b0545685';

// ── 1. Penjaga itu menggigit ────────────────────────────────────────────────────────────────────
console.log('\n-- 1. sidik jari peka terhadap satu bait, tetapi tidak terhadap CRLF --');
const asli = baca('frontend/src/components/LampLogin.jsx');
cek(sidik(asli + ' ') !== sidik(asli), 'satu spasi tambahan mengubah sidik jari');
cek(sidik(asli.replace(/\n/g, '\r\n').replace(/\r\n/g, '\n')) === sidik(asli),
  'CRLF yang dinormalkan menghasilkan sidik jari yang sama');

// ── 2. Berkasnya tidak berubah ──────────────────────────────────────────────────────────────────
// v2 (20 Okt) — SATU-SATUNYA perubahan yang diizinkan Owner: ikon lucide → Material Symbols ("satu set ikon"):
//   "bila perubahan icon tidak menjadi masalah keamanan dari segi apapun, saya rasa samakan saja" — Owner, 20 Okt.
// Sidik jari 19 Okt TIDAK diganti. Uji membalik tepat empat penggantian ikon di bawah ini lalu menuntut hasilnya
// sama persis dengan sidik jari lama — jadi perubahan apa pun SELAIN ikon tetap merah. Ini lebih ketat daripada
// mengganti sidik jari: sidik jari baru akan ikut "memberkati" baris lain yang kebetulan berubah bersamaan.
const IZIN_IKON_20_OKT = [
  ["import Ikon from './Ikon';", "import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';"],
  ['{showPassword ? <Ikon nama="visibility" ukuran={20} /> : <Ikon nama="visibility_off" ukuran={20} />}',
   '{showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}'],
  ['<Ikon nama="error" ukuran={20} className="flex-shrink-0" />', '<AlertCircle className="w-5 h-5 flex-shrink-0" />'],
  ['<Ikon nama="progress_activity" ukuran={20} className="animate-spin" />', '<Loader2 className="w-5 h-5 animate-spin" />'],
];
function balikIzinIkon(teks) {
  let t = teks;
  for (const [kini, dulu] of IZIN_IKON_20_OKT) {
    if (t.split(kini).length - 1 !== 1) return null;   // ikon yang diizinkan harus ada TEPAT sekali
    t = t.replace(kini, () => dulu);
  }
  return t;
}
console.log('\n-- 2. LampLogin.jsx tidak berubah selain ikon yang diizinkan --');
const dipulihkan = balikIzinIkon(asli);
cek(dipulihkan !== null, 'keempat ikon pengganti ada, masing-masing tepat sekali');
cek(dipulihkan !== null && sidik(dipulihkan) === SIDIK_JARI,
  'setelah 4 ikon dibalik, isi LampLogin.jsx sama persis dengan sidik jari 19 Okt',
  { sekarang: dipulihkan && sidik(dipulihkan), seharusnya: SIDIK_JARI });
// Kendali: perubahan di luar ikon — dan ikon yang hilang — harus tetap merah.
const ubahLain = balikIzinIkon(asli.replace('Memproses...', 'Memproses…'));
cek(ubahLain === null || sidik(ubahLain) !== SIDIK_JARI, 'kendali: satu kata di luar ikon berubah → merah');
cek(balikIzinIkon(asli.replace('<Ikon nama="error" ukuran={20} className="flex-shrink-0" />', '')) === null,
  'kendali: ikon galat dihapus → merah');

// ── 3. Penjaga ini menjaga hal yang benar ───────────────────────────────────────────────────────
// Sidik jari yang utuh tidak berarti apa-apa bila layar masuk diam-diam diganti komponen lain. Yang
// Owner lindungi adalah LAYAR MASUK yang tampil, dan yang tampil ditentukan App.jsx.
console.log('\n-- 3. LampLogin masih layar masuk yang tampil --');
const app = baca('frontend/src/App.jsx');
cek(/import\s+LampLogin\s+from\s+['"]\.\/components\/LampLogin['"]/.test(app), 'App.jsx mengimpor LampLogin');
cek(/<LampLogin\b/.test(app), 'App.jsx merender <LampLogin> untuk pengguna yang belum masuk');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

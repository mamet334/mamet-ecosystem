// UJI 2026-10-20 — Item 128 Tahap C: pilihan "Kurangi gerakan" di Settings › Tampilan.
//
// Kenapa ada: gerak dekoratif (51 animasi — kedipan peringatan, ikon putar, titik berdenyut) ditunda Owner sebagai
// pekerjaan tetap dan dibawa ke tema sebagai PILIHAN PENGGUNA (ROADMAP-TEMA-APLIKASI.md §2). Bawaannya mengikuti
// setelan animasi Windows, jadi pengguna yang tak mengubah apa pun melihat aplikasi persis seperti sebelumnya. Yang
// dijaga:
//   1. LOGIKA — 'sistem' (bawaan) mengikuti prefers-reduced-motion; 'kurangi' selalu; 'normal' tak pernah.
//   2. CSS — saat dikurangi, SEMUA animasi & transisi berhenti (WCAG 2.2: 2.2.2, 2.3.3), dengan durasi sangat
//      kecil (bukan `none`) supaya peristiwa animationend tetap terjadi.
//   3. TERPASANG — TemaService menulis data-gerak, mendengarkan perubahan setelan Windows; pilihan ikut tersimpan
//      di akun bersama tema (satu objek `tampilan`).
//   4. SETTINGS — tiga pilihan sebagai radiogroup (dapat diakses), keadaan saat ini diberitahukan.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (k) => k.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('uji-tema-tahap-c v2');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 500) : '')); }
};

const T = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/tema.js')).href);
const meta = JSON.parse(baca('frontend/public/metadata/themes.json'));

// ── 1. Logika ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. logika kurangi gerakan --');
cek(T.normalisasiSetelan(null, meta).gerak === 'sistem' && T.normalisasiSetelan({ gerak: 'aneh' }, meta).gerak === 'sistem',
  'bawaan & nilai tak dikenal → ikuti sistem (aplikasi tampil seperti sebelumnya)');
cek(T.gerakDikurangi({ gerak: 'sistem' }, true) === true && T.gerakDikurangi({ gerak: 'sistem' }, false) === false, '"Ikuti Windows" mengikuti prefers-reduced-motion');
cek(T.gerakDikurangi({ gerak: 'kurangi' }, false) === true, '"Kurangi" selalu mengurangi, apa pun setelan Windows');
cek(T.gerakDikurangi({ gerak: 'normal' }, true) === false, '"Normal" tak pernah mengurangi, apa pun setelan Windows');
cek(JSON.stringify(T.PILIHAN_GERAK) === JSON.stringify(['sistem', 'kurangi', 'normal']), 'tiga pilihan: sistem · kurangi · normal');

// ── 2. CSS ──────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. aturan CSS --');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const blok = (css.match(/html\[data-gerak="kurangi"\] \*,\s*html\[data-gerak="kurangi"\] \*::before,\s*html\[data-gerak="kurangi"\] \*::after \{([^}]*)\}/) || [])[1] || '';
for (const [sifat, nilai] of [['animation-duration', '0.01ms'], ['animation-iteration-count', '1'], ['transition-duration', '0.01ms'], ['scroll-behavior', 'auto']]) {
  cek(new RegExp(`${sifat}:\\s*${nilai.replace('.', '\\.')}\\s*!important;`).test(blok), `${sifat}: ${nilai} !important — berlaku untuk semua elemen & pseudo-elemen`);
}
cek(!/animation:\s*none/.test(blok), 'durasi sangat kecil, BUKAN `animation: none` — animationend tetap terjadi');
cek(/html\[data-gerak="kurangi"\] \{\s*scroll-behavior: auto !important;/.test(css), 'gulir halus pada <html> ikut dimatikan');

// Peramban (Chromium) — dibuktikan 20 Okt di pane: ikon putar memakai animation-duration 1e-05s saat dikurangi.
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const { css: keluar } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')), content: [{ raw: '<i className="animate-spin animate-pulse animate-ping">', extension: 'jsx' }] })])
  .process('@tailwind utilities;', { from: undefined });
cek(/\.animate-spin\s*\{\s*animation:/.test(keluar), 'kelas animasi Tailwind memakai `animation:` (shorthand) — diwarisi oleh aturan !important di atas');

// ── 3. Terpasang ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. terpasang di TemaService --');
const TS = tanpaKomentar(baca('frontend/src/core/runtime/services/TemaService.js'));
cek(/html\.dataset\.gerak = this\.gerakTampilDikurangi\(\) \? 'kurangi' : 'normal';/.test(TS), 'data-gerak ditulis ke <html> setiap kali tampilan diterapkan');
cek(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(TS) && /this\.mqGerak\.addEventListener\?\.\('change', \(\) => \{ if \(this\.setelan\.gerak === 'sistem'\) this\.#terapkan\(\); \}\)/.test(TS),
  'setelan animasi Windows berubah saat aplikasi terbuka → ikut, bila pilihan "Ikuti Windows"');
cek(/s\.gerak === this\.setelan\.gerak/.test(TS), 'sinkron dari akun membandingkan pilihan gerakan juga');
cek(/updateUser\(\{ data: \{ tampilan: this\.setelan \} \}\)/.test(TS), 'pilihan gerakan tersimpan di akun bersama tema (satu objek tampilan)');

// ── 4. Settings ─────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. Settings › Tampilan › Gerakan --');
const BT = tanpaKomentar(baca('frontend/src/components/BagianTampilan.jsx'));
const pilihan = [...BT.matchAll(/\{ id: '(sistem|kurangi|normal)', nama: '([^']+)'/g)].map((m) => `${m[1]}=${m[2]}`);
cek(pilihan.length === 3 && pilihan.includes('sistem=Ikuti Windows'), `tiga pilihan berbahasa Indonesia: ${pilihan.join(' · ')}`, pilihan);
cek(/role="radiogroup" aria-label="Gerakan"/.test(BT) && /role="radio"\s+aria-checked=\{setelan\.gerak === g\.id\}/.test(BT), 'radiogroup dapat diakses — pilihan aktif diumumkan pembaca layar');
cek(/onClick=\{\(\) => simpan\(\{ gerak: g\.id \}\)\}/.test(BT), 'memilih = menyimpan lewat TemaService');
cek(/temaService\.gerakTampilDikurangi\(\)/.test(BT), 'keadaan gerakan SAAT INI diberitahukan (termasuk bila mengikuti Windows)');

// ── 5. Lampu (v2) ───────────────────────────────────────────────────────────────────────────────
// Owner 20 Okt: wujud A (pendar saja), 25% kekuatan layar masuk, bisa dinyalakan/dimatikan. Kontras & salinan
// LampLogin-nya dijaga uji-latar-ruangan (4b). Di sini: logika, penerapan, dan saklarnya.
console.log('\n-- 5. lampu ruangan --');
cek(T.normalisasiSetelan(null, meta).lampu === false && T.normalisasiSetelan({ lampu: 'ya' }, meta).lampu === false, 'lampu MATI bawaannya (keputusan Owner) — nilai tak sah juga mati');
cek(T.lampuNyala({ lampu: true }, true) === true, 'lampu nyala + latar nyala → pendar tampil');
cek(T.lampuNyala({ lampu: true }, false) === false, 'lampu nyala tetapi latar mati → pendar TIDAK tampil (lampu bagian dari ruangan)');
cek(T.lampuNyala({ lampu: false }, true) === false, 'lampu mati → pendar tak tampil');
cek(/const latar = latarNyala\(this\.setelan, id, this\.meta\);\s*html\.dataset\.latar = latar \? 'nyala' : 'mati';\s*html\.dataset\.lampu = lampuNyala\(this\.setelan, latar\) \? 'nyala' : 'mati';/.test(TS),
  'data-lampu ditulis ke <html> dari setelan lampu DAN keadaan latar');
cek(/s\.lampu === this\.setelan\.lampu/.test(TS), 'sinkron dari akun membandingkan pilihan lampu juga');
cek(/role="switch"\s+aria-checked=\{setelan\.lampu\}/.test(BT) && /onClick=\{\(\) => simpan\(\{ lampu: !setelan\.lampu \}\)\}/.test(BT),
  'saklar "Lampu ruangan" di Settings › Tampilan — bisa dinyalakan & dimatikan, tersimpan di akun');
cek(/setelan\.lampu && !latar/.test(BT), 'bila lampu dinyalakan tetapi latar mati, Settings menjelaskan kenapa pendar belum tampil');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

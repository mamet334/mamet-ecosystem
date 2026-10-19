// UJI 2026-10-19 — seluruh aplikasi memakai palet LampLogin (Item 127 Tahap 3).
//
// Kenapa ada: Owner, 19 Okt: "samakan warnanya agar sama dengan tema LampLogin". Aplikasi punya DUA sistem warna
// — 47 token gaya Material (568 pemakaian) dan `slate-*` mentah (615 pemakaian) — keduanya abu-abu kebiruan
// dengan cahaya biru #0052ff, berlawanan dengan ruangan kayu & lampu emas di layar masuk. Perbaikannya di
// SUMBERNYA: nilai token dan skala slate di tailwind.config.js, plus kelas global di index.css — komponen tidak
// disentuh. Yang dijaga di sini adalah SIFAT palet itu, bukan kode hex-nya:
//
//   1. HANGAT — setiap warna non-galat punya merah ≥ hijau ≥ biru (kayu, krem, emas). Abu-abu kebiruan lama
//      (slate #64748b: biru > merah) langsung merah di sini.
//   2. TERBACA — pasangan teks/permukaan utama ≥ 4,5:1 (WCAG 2.2 AA); garis ≥ 3:1. Tema gelap-hangat paling
//      mudah gagal justru di teks redup.
//   3. BERSUMBER — latar = latar LampLogin; aksen = emas lampu LampLogin.
//   4. MERAH TETAP MERAH — warna galat sengaja tidak dihangatkan.
//   5. TAK ADA BIRU TERSISA di index.css (cahaya #0052ff di kaca, input, tombol).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-palet-lamplogin v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 500) : '')); }
};

// Konfigurasi DIBACA sebagai teks, tidak dijalankan: ia memanggil `require(...)` di dalam modul ES — Tailwind
// memuatnya lewat pemuatnya sendiri, tetapi `import` node biasa menolaknya.
const confTeks = baca('frontend/tailwind.config.js');
const blokWarna = confTeks.slice(confTeks.indexOf('      colors: {'), confTeks.indexOf('      borderRadius: {'));
const blokSlate = (blokWarna.match(/slate: \{([\s\S]*?)\}/) || [, ''])[1];
const TOKEN = Object.fromEntries([...blokWarna.replace(/slate: \{[\s\S]*?\}/, '').matchAll(/"([a-z-]+)": "(#[0-9a-fA-F]{6})"/g)].map((m) => [m[1], m[2]]));
const SLATE = Object.fromEntries([...blokSlate.matchAll(/(\d+): "(#[0-9a-fA-F]{6})"/g)].map((m) => [m[1], m[2]]));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hangat = (h) => { const [r, g, b] = hex(h); return r >= g && g >= b; };

// ── 1. Hangat ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. setiap warna non-galat hangat (merah ≥ hijau ≥ biru) --');
const nonGalat = Object.entries(TOKEN).filter(([k]) => !/error/.test(k));
cek(nonGalat.length >= 40, `${nonGalat.length} token non-galat terbaca`);
const dingin = nonGalat.filter(([, v]) => !hangat(v)).map(([k, v]) => `${k}=${v}`);
cek(dingin.length === 0, 'tak ada token yang dingin/kebiruan', dingin);
cek(Object.keys(SLATE).length === 11, 'skala slate ditimpa lengkap (50–950)', Object.keys(SLATE));
const slateDingin = Object.entries(SLATE).filter(([, v]) => !hangat(v)).map(([k, v]) => `slate-${k}=${v}`);
cek(slateDingin.length === 0, 'skala slate hangat — 615 pemakaian slate-* mentah ikut ke palet', slateDingin);

// ── 2. Terbaca ──────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. kontras pasangan utama --');
const PASANGAN = [
  ['on-surface', 'surface', 4.5], ['on-surface', 'surface-container-high', 4.5],
  ['on-surface-variant', 'surface', 4.5], ['on-surface-variant', 'surface-container-low', 4.5],
  ['on-surface-variant', 'surface-container-high', 4.5], ['on-surface-variant', 'surface-container-highest', 4.5],
  ['primary', 'surface', 4.5], ['primary', 'surface-container', 4.5], ['on-primary', 'primary', 4.5],
  ['outline', 'surface', 3],
];
for (const [t, l, batas] of PASANGAN) {
  const r = rasio(TOKEN[t], TOKEN[l]);
  cek(r >= batas, `${t} di ${l}: ${r.toFixed(2)}:1 (≥ ${batas})`);
}
const PASANGAN_SLATE = [[300, 800], [400, 900], [400, 950], [500, 900], [500, 950]];
for (const [t, l] of PASANGAN_SLATE) {
  const r = rasio(SLATE[t], SLATE[l]);
  cek(r >= 4.5, `slate-${t} di slate-${l}: ${r.toFixed(2)}:1 (≥ 4.5)`);
}

// ── 3. Bersumber dari LampLogin ─────────────────────────────────────────────────────────────────
console.log('\n-- 3. bersumber dari LampLogin --');
const LL = baca('frontend/src/components/LampLogin.jsx').toLowerCase();
cek(LL.includes(TOKEN.background.toLowerCase()), `latar ${TOKEN.background} = latar layar masuk LampLogin`);
cek(LL.includes(TOKEN.primary.toLowerCase()), `aksen ${TOKEN.primary} = emas lampu LampLogin`);

// ── 4. Merah tetap merah ────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. warna galat tetap merah --');
const merah = (h) => { const [r, g, b] = hex(h); return r > g + 40 && r > b + 40; };
for (const k of ['error', 'error-container']) cek(merah(TOKEN[k]), `${k} ${TOKEN[k]} tetap merah`);

// ── 5. Tak ada biru tersisa di index.css ────────────────────────────────────────────────────────
console.log('\n-- 5. index.css --');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
cek(!/#0052ff|0,\s*82,\s*255/i.test(css), 'tak ada cahaya biru #0052ff (kaca, input, tombol, sorotan sentuh)');
const blokBody = (css.match(/\nbody \{[\s\S]*?\n\}/) || [''])[0];
const latarBody = (blokBody.match(/background-color:\s*(#[0-9a-f]{6})/i) || [])[1];
cek(latarBody?.toLowerCase() === TOKEN.background.toLowerCase(), `latar body (${latarBody}) = token background`);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

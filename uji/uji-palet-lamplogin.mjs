
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bacaPalet } from './palet-tema.mjs';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-palet-lamplogin v4');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 500) : '')); }
};

const { TOKEN, SLATE } = bacaPalet(AKAR, 'ruangan-kayu');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hangat = (h) => { const [r, g, b] = hex(h); return r >= g && g >= b; };

console.log('\n-- 1. setiap warna non-galat hangat (merah ≥ hijau ≥ biru) --');
const nonGalat = Object.entries(TOKEN).filter(([k]) => !/error/.test(k));
cek(nonGalat.length >= 40, `${nonGalat.length} token non-galat terbaca`);
const dingin = nonGalat.filter(([, v]) => !hangat(v)).map(([k, v]) => `${k}=${v}`);
cek(dingin.length === 0, 'tak ada token yang dingin/kebiruan', dingin);
cek(Object.keys(SLATE).length === 11, 'skala slate ditimpa lengkap (50–950)', Object.keys(SLATE));
const slateDingin = Object.entries(SLATE).filter(([, v]) => !hangat(v)).map(([k, v]) => `slate-${k}=${v}`);
cek(slateDingin.length === 0, 'skala slate hangat — 615 pemakaian slate-* mentah ikut ke palet', slateDingin);

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
const rUtama = rasio(TOKEN['on-surface'], TOKEN.surface);
cek(rUtama >= 7 && rUtama <= 14, `teks utama ${rUtama.toFixed(2)}:1 — nyaman dibaca lama (7–14:1, tidak menyilaukan)`);
cek(TOKEN['on-surface'] === TOKEN['on-background'], 'on-surface = on-background');
cek(rUtama - rasio(TOKEN['on-surface-variant'], TOKEN.surface) >= 2, 'teks utama tetap jelas lebih terang dari teks redup');
const rKuat = TOKEN['on-surface-strong'] ? rasio(TOKEN['on-surface-strong'], TOKEN.surface) : 0;
cek(rKuat > rUtama && rKuat <= 15, `teks tebal & judul ${TOKEN['on-surface-strong']}: ${rKuat.toFixed(2)}:1 — lebih terang dari teks biasa, tak setajam krem lama`);
const PASANGAN_SLATE =[[300, 800], [400, 900], [400, 950], [500, 900], [500, 950]];
for (const [t, l] of PASANGAN_SLATE) {
  const r = rasio(SLATE[t], SLATE[l]);
  cek(r >= 4.5, `slate-${t} di slate-${l}: ${r.toFixed(2)}:1 (≥ 4.5)`);
}

console.log('\n-- 3. bersumber dari LampLogin --');
const LL = baca('frontend/src/components/LampLogin.jsx').toLowerCase();
cek(LL.includes(TOKEN.background.toLowerCase()), `latar ${TOKEN.background} = latar layar masuk LampLogin`);
cek(LL.includes(TOKEN.primary.toLowerCase()), `aksen ${TOKEN.primary} = emas lampu LampLogin`);

console.log('\n-- 4. warna galat tetap merah --');
const merah = (h) => { const [r, g, b] = hex(h); return r > g + 40 && r > b + 40; };
for (const k of ['error', 'error-container']) cek(merah(TOKEN[k]), `${k} ${TOKEN[k]} tetap merah`);

console.log('\n-- 5. index.css --');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
cek(!/#0052ff|0,\s*82,\s*255/i.test(css), 'tak ada cahaya biru #0052ff (kaca, input, tombol, sorotan sentuh)');
const blokBody = (css.match(/\nbody \{[\s\S]*?\n\}/) || [''])[0];
cek(/background-color:\s*rgb\(var\(--warna-background\)\);/.test(blokBody), 'latar body = token background (variabel tema)');
cek(/\n\s*color:\s*rgb\(var\(--warna-on-surface\)\);/.test(blokBody), 'teks body = token on-surface (variabel tema)');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

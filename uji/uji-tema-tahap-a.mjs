// UJI 2026-10-20 — Item 128 Tahap A: token palet menjadi variabel CSS, TAMPILAN TIDAK BERUBAH.
//
// Kenapa ada: tema aplikasi (ROADMAP-TEMA-APLIKASI.md) butuh warna yang bisa berganti saat aplikasi berjalan. Sebelum
// tahap ini nilai palet ditulis sebagai hex di tailwind.config.js dan dibakukan saat build. Kini config hanya menunjuk
// variabel (`rgb(var(--warna-X) / <alpha-value>)`), dan nilainya ada di frontend/src/tema/ruangan-kayu.css. Janji
// tahap ini cuma satu: Ruangan kayu tampil PERSIS seperti sebelumnya. Yang dijaga:
//
//   1. NILAI SAMA — setiap variabel tema = palet sebelum tahap ini (patokan-palet-ruangan-kayu.json, direkam dari
//      tailwind.config.js tepat sebelum diubah), tak ada yang hilang atau bertambah.
//   2. CONFIG MENUNJUK — 48 token + 11 slate memakai variabel bernama sama; tak ada hex tersisa di blok warna.
//   3. KELAS GLOBAL — index.css tak lagi menulis warna tetap; tiap kelas global (body, kaca, input, bilah gulir)
//      menghasilkan nilai yang SAMA dengan sebelum tahap ini (nilai lama dicatat di bawah sebagai rekaman).
//   4. DIKOMPILASI — semua kelas warna token/slate yang dipakai komponen dikompilasi Tailwind sungguhan; setiap
//      variabel yang dirujuk terdefinisi, dan contoh berpengubah opasitas menghasilkan nilai yang persis sama.
//
// Diukur juga di peramban 20 Okt: warna terhitung 2.608 elemen sebelum/sesudah — selisih hanya pada elemen yang
// keadaannya berbeda karena muat ulang (tab Settings aktif, item navigasi aktif), bukan karena warna.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { bacaPalet } from './palet-tema.mjs';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentarCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('uji-tema-tahap-a v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
};

const patokan = JSON.parse(baca('uji/patokan-palet-ruangan-kayu.json'));
const PALET = bacaPalet(AKAR, 'ruangan-kayu');
const rgbDari = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');

// ── 1. Nilai sama ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. nilai tema = palet sebelum Tahap A --');
const tokenPatokan = Object.entries(patokan.token), slatePatokan = Object.entries(patokan.slate);
cek(tokenPatokan.length === 48 && slatePatokan.length === 11, `patokan: ${tokenPatokan.length} token + ${slatePatokan.length} slate`);
const tokenBeda = tokenPatokan.filter(([k, h]) => PALET.TOKEN[k]?.toLowerCase() !== h.toLowerCase()).map(([k, h]) => `${k}: ${h} → ${PALET.TOKEN[k]}`);
cek(tokenBeda.length === 0, 'setiap token bernilai sama persis', tokenBeda);
const slateBeda = slatePatokan.filter(([n, h]) => PALET.SLATE[n]?.toLowerCase() !== h.toLowerCase()).map(([n, h]) => `slate-${n}: ${h} → ${PALET.SLATE[n]}`);
cek(slateBeda.length === 0, 'setiap tingkat slate bernilai sama persis', slateBeda);
const tambahan = Object.keys(PALET.TOKEN).filter((k) => !(k in patokan.token));
cek(tambahan.length === 0, 'tak ada token tambahan yang tak tercatat di patokan', tambahan);
cek(/^:root,\n\[data-tema="ruangan-kayu"\] \{/m.test(PALET.teks), 'Ruangan kayu = tema bawaan (:root) sekaligus bisa dipilih dengan data-tema');

// ── 2. Config menunjuk variabel ─────────────────────────────────────────────────────────────────
console.log('\n-- 2. tailwind.config.js menunjuk variabel --');
const conf = baca('frontend/tailwind.config.js');
const blok = conf.slice(conf.indexOf('      colors: {'), conf.indexOf('      borderRadius: {'));
const blokTanpaKomentar = blok.replace(/^\s*\/\/.*$/gm, '');
cek(!/#[0-9a-fA-F]{6}/.test(blokTanpaKomentar), 'tak ada hex tersisa di blok warna (di luar komentar)');
const salahToken = tokenPatokan.filter(([k]) => !blok.includes(`"${k}": "rgb(var(--warna-${k}) / <alpha-value>)",`)).map(([k]) => k);
cek(salahToken.length === 0, '48 token → rgb(var(--warna-<nama>) / <alpha-value>)', salahToken);
const salahSlate = slatePatokan.filter(([n]) => !blok.includes(`${n}: "rgb(var(--warna-slate-${n}) / <alpha-value>)",`)).map(([n]) => n);
cek(salahSlate.length === 0, '11 tingkat slate → rgb(var(--warna-slate-<n>) / <alpha-value>)', salahSlate);

// ── 3. Kelas global di index.css ────────────────────────────────────────────────────────────────
console.log('\n-- 3. kelas global index.css --');
const cssMentah = baca('frontend/src/index.css');
const css = tanpaKomentarCss(cssMentah);
const iImport = css.indexOf("@import './tema/ruangan-kayu.css';"), iTailwind = css.indexOf('@tailwind base;');
cek(iImport >= 0 && iImport < iTailwind, 'tema diimpor di paling atas, sebelum @tailwind');
cek(!/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(css), 'tak ada warna tetap (hex / rgba angka) di luar komentar', (css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g) || []).slice(0, 5));
// Nilai lama kelas global — direkam dari index.css sebelum Tahap A. Variabel diurai, hasilnya harus sama.
const urai = (s) => s.replace(/rgb\(var\(--warna-([a-z0-9-]+)\)(?:\s*\/\s*([\d.]+))?\)/g, (_, n, a) => {
  const h = PALET.VAR[n]; if (!h) return `TAK-TERDEFINISI(${n})`;
  const [r, g, b] = rgbDari(h).split(' ').map(Number);
  return a === undefined ? `#${h.slice(1)}` : `rgba(${r}, ${g}, ${b}, ${Number(a)})`;
});
const nilaiDi = (selektor, sifat) => {
  const isi = (css.match(new RegExp(`(?:^|\\n)${selektor.replace(/[.*:-]/g, '\\$&')}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  return urai(((isi.match(new RegExp(`(?:^|\\n|;)\\s*${sifat}:\\s*([^;]+);`)) || [])[1] || '').trim());
};
const LAMA = [
  ['body', 'background-color', '#0b0806'],
  ['body', 'color', '#dbd0be'],
  ['body', '-webkit-tap-highlight-color', 'rgba(240, 202, 109, 0.15)'],
  ['.glass-panel', 'background', 'rgba(26, 18, 12, 0.72)'],
  ['.glass-panel', 'border', '1px solid #3e2b1b'],
  ['.glass-panel', 'box-shadow', '0px 20px 40px rgba(240, 202, 109, 0.04)'],
  ['.rim-light', 'border-top', '1px solid rgba(255, 236, 207, 0.08)'],
  ['.input-etched', 'background-color', '#120c08'],
  ['.input-etched', 'border', '1px solid #3e2b1b'],
  ['.input-etched:focus', 'border-color', '#f0ca6d'],
  ['.input-etched:focus', 'box-shadow', '0 0 0 2px rgba(240, 202, 109, 0.2)'],
  ['.btn-glow:hover', 'box-shadow', '0 0 15px rgba(240, 202, 109, 0.35)'],
  ['*::-webkit-scrollbar-thumb', 'background', 'rgba(255, 236, 207, 0.14)'],
  ['*::-webkit-scrollbar-thumb:hover', 'background', 'rgba(255, 236, 207, 0.28)'],
];
const bedaGlobal = LAMA.map(([s, p, lama]) => [s, p, lama, nilaiDi(s, p)]).filter(([, , lama, kini]) => lama !== kini)
  .map(([s, p, lama, kini]) => `${s} ${p}: ${lama} → ${kini}`);
cek(bedaGlobal.length === 0, `${LAMA.length} nilai warna kelas global sama dengan sebelum Tahap A`, bedaGlobal);

// ── 4. Dikompilasi Tailwind sungguhan ───────────────────────────────────────────────────────────
console.log('\n-- 4. kelas warna komponen dikompilasi Tailwind --');
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const konfigurasi = loadConfig(join(AKAR, 'frontend', 'tailwind.config.js'));
const NAMA = [...Object.keys(patokan.token), ...Object.keys(patokan.slate).map((n) => `slate-${n}`)].sort((a, b) => b.length - a.length);
const POLA = new RegExp(`(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|via|to|fill|stroke|divide|placeholder|outline|shadow|accent|caret|decoration)-(?:${NAMA.join('|')})(?:\\/(?:\\d+|\\[[^\\]]+\\]))?(?![\\w-])`, 'g');
const { readdirSync } = await import('node:fs');
const jalan = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? jalan(join(d, e.name)) : /\.jsx?$/.test(e.name) ? [join(d, e.name)] : []);
const kelas = new Set();
for (const f of jalan(join(AKAR, 'frontend', 'src'))) for (const m of readFileSync(f, 'utf8').matchAll(POLA)) kelas.add(m[0]);
const CONTOH = ['bg-surface', 'text-on-surface', 'bg-primary/30', 'border-outline-variant', 'text-slate-500', 'bg-primary-container/20', 'border-primary/35'];
for (const k of CONTOH) kelas.add(k);
const { css: hasil } = await postcss([tailwind({ ...konfigurasi, content: [{ raw: `<div className="${[...kelas].join(' ')}">`, extension: 'jsx' }] })])
  .process('@tailwind utilities;', { from: undefined });
cek(kelas.size > 100, `${kelas.size} kelas warna token/slate dari komponen dikompilasi`);
const dirujuk = [...new Set([...hasil.matchAll(/var\(--warna-([a-z0-9-]+)\)/g)].map((m) => m[1]))];
const takTerdefinisi = dirujuk.filter((n) => !PALET.VAR[n]);
cek(dirujuk.length > 30 && takTerdefinisi.length === 0, `${dirujuk.length} variabel dirujuk CSS hasil kompilasi — semuanya terdefinisi di tema`, takTerdefinisi);
cek(!/#[0-9a-fA-F]{6}/.test(hasil.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.(?:bg|text|border)-(?:surface|primary|on-surface|outline)[^{]*\{[^}]*\}/g)?.join('') || ''),
  'kelas token tak lagi berisi hex tetap — semuanya lewat variabel');
// Contoh berpengubah opasitas: nilai terurai harus = nilai lama (hex patokan + opasitas).
const aturan = (k) => (hasil.match(new RegExp(`\\.${k.replace(/[/]/g, '\\\\/').replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
const harap = (tok, a) => { const [r, g, b] = rgbDari(patokan.token[tok]).split(' '); return `rgb(${r} ${g} ${b} / ${a})`; };
const isiWarna = (k) => (aturan(k).match(/:\s*(rgb\([^;]+\))/) || [])[1]?.replace(/var\(--warna-([a-z0-9-]+)\)/, (_, n) => rgbDari(PALET.VAR[n]));
for (const [k, tok, a] of [['bg-primary/30', 'primary', '0.3'], ['bg-primary-container/20', 'primary-container', '0.2'], ['border-primary/35', 'primary', '0.35']]) {
  cek(isiWarna(k) === harap(tok, a), `${k} → ${isiWarna(k)} (sama dengan ${patokan.token[tok]} pada opasitas ${a})`, aturan(k));
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

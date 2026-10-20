// UJI 2026-10-20 — Item 128 Tahap D: warna dasar bisa diganti setelan; tema Biru malam & Terang.
//
// Kenapa ada: Owner, 20 Okt — "buat warna dasar dari code dibuat bisa berubah-ubah sesuai setelan, agar bila nanti ingin
// membuat tema lain bisa mudah diterapkan tanpa mengubah code source". Yang dijaga:
//   1. DASAR GELAP SAMA PERSIS — putih, hitam, 17 rona × 11 tingkat = palet bawaan Tailwind apa adanya; warna yang
//      dulu ditulis langsung di komponen = nilai lamanya. Tema gelap tampil persis seperti sebelum Tahap D.
//   2. DASAR TERANG LENGKAP — variabel yang sama dengan dasar gelap; putih ↔ hitam; teks di atas warna padat tetap putih.
//   3. CONFIG — white, black, 17 rona, dan di-warna menunjuk variabel; semua kelas rona komponen dikompilasi Tailwind
//      dan setiap variabel yang dirujuk terdefinisi di KEDUA dasar.
//   4. KOMPONEN — tak ada hex yang dulu ditulis langsung; teks putih di atas warna padat memakai `text-di-warna`;
//      kanvas graf membaca variabel tema; layar masuk selalu Ruangan kayu.
//   5. TERANG TERBACA — setiap kelas teks rona yang dipakai komponen, sesudah dibalik, ≥ 4,5:1 di latar tema Terang;
//      teks putih di atas latar padat rona yang dipakai ≥ 4,5:1.
//   6. TEMA BARU = METADATA — Biru malam (dasar gelap) & Terang (dasar terang) hanya entri themes.json.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (k) => k.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
console.log('uji-tema-tahap-d v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
};

const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const warnaTw = reqFE('tailwindcss/colors');
const RONA = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const TINGKAT = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const keRgb = (h) => { const x = h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; return [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)).join(' '); };
const varDari = (berkas) => Object.fromEntries([...baca(berkas).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--warna-([a-z0-9-]+):\s*(\d+ \d+ \d+);/g)].map((m) => [m[1], m[2]]));
const GELAP = varDari('frontend/src/tema/dasar-gelap.css');
const TERANG = varDari('frontend/src/tema/dasar-terang.css');

// ── 1. Dasar gelap sama persis ──────────────────────────────────────────────────────────────────
console.log('\n-- 1. dasar gelap = palet bawaan Tailwind & nilai lama komponen --');
cek(GELAP.white === '255 255 255' && GELAP.black === '0 0 0' && GELAP['di-warna'] === '255 255 255', 'putih, hitam, di-warna = nilai bawaan');
const ronaBeda = RONA.flatMap((r) => TINGKAT.filter((t) => GELAP[`${r}-${t}`] !== keRgb(warnaTw[r][t])).map((t) => `${r}-${t}`));
cek(ronaBeda.length === 0, `${RONA.length} rona × ${TINGKAT.length} tingkat = palet bawaan Tailwind persis`, ronaBeda);
const LAMA = { 'panel-sisi': '#0a0a0a', 'neon-hijau': '#00ff88', 'neon-merah': '#ff4444', 'neon-kuning': '#ffcc00', 'tautan-unduh': '#e4b84f', 'tautan-unduh-sorot': '#ffe29a', 'label-graf': '#e2e8f0' };
const khususBeda = Object.entries(LAMA).filter(([k, h]) => GELAP[k] !== keRgb(h)).map(([k, h]) => `${k}: ${GELAP[k]} ≠ ${h}`);
cek(khususBeda.length === 0, `${Object.keys(LAMA).length} warna yang dulu ditulis di komponen = nilai lamanya`, khususBeda);

// ── 2. Dasar terang lengkap ─────────────────────────────────────────────────────────────────────
console.log('\n-- 2. dasar terang --');
const kG = Object.keys(GELAP).sort(), kT = Object.keys(TERANG).sort();
cek(JSON.stringify(kG) === JSON.stringify(kT), `dasar terang mendefinisikan ${kT.length} variabel — sama persis dengan dasar gelap`, { kurang: kG.filter((k) => !kT.includes(k)), lebih: kT.filter((k) => !kG.includes(k)) });
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (s) => { const [r, g, b] = String(s).split(' ').map(Number); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
cek(lum(TERANG.white) < 0.05 && lum(TERANG.black) > 0.9, 'putih ↔ hitam bertukar di dasar terang');
cek(TERANG['di-warna'] === '255 255 255', 'teks di atas warna padat tetap putih di dasar terang');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const urut = ["@import './tema/dasar-gelap.css';", "@import './tema/dasar-terang.css';", "@import './tema/ruangan-kayu.css';", '@tailwind base;'].map((s) => css.indexOf(s));
cek(urut.every((i, n) => i >= 0 && (n === 0 || i > urut[n - 1])), 'urutan impor: dasar gelap → dasar terang (menang bila dipilih) → tema bawaan → Tailwind', urut);
cek(/^\[data-dasar="terang"\] \{/m.test(baca('frontend/src/tema/dasar-terang.css')) && /^:root,\n\[data-dasar="gelap"\] \{/m.test(baca('frontend/src/tema/dasar-gelap.css')),
  'dasar gelap = bawaan (:root); dasar terang dipilih lewat data-dasar');

// ── 3. Config & kompilasi ───────────────────────────────────────────────────────────────────────
console.log('\n-- 3. tailwind.config.js & kompilasi --');
const conf = baca('frontend/tailwind.config.js');
const v = (n) => `"rgb(var(--warna-${n}) / <alpha-value>)"`;
cek(conf.includes(`white: ${v('white')}`) && conf.includes(`black: ${v('black')}`) && conf.includes(`"di-warna": ${v('di-warna')}`), 'white, black, di-warna menunjuk variabel');
const ronaSalah = RONA.filter((r) => !conf.includes(`${r}: { ${TINGKAT.map((t) => `${t}: ${v(`${r}-${t}`)}`).join(', ')} },`));
cek(ronaSalah.length === 0, `${RONA.length} rona menunjuk variabel di setiap tingkat`, ronaSalah);
const jalan = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? jalan(join(d, e.name)) : /\.jsx?$/.test(e.name) ? [join(d, e.name)] : []);
const BERKAS = jalan(join(AKAR, 'frontend/src/components'));
const POLA_RONA = new RegExp(`(?:[a-z0-9-]+:)*(?:bg|text|border|from|via|to|ring|fill|stroke|divide|shadow|outline|placeholder)-(?:(?:${RONA.join('|')})-\\d+|white|black|di-warna)(?:\\/\\d+)?(?![\\w-])`, 'g');
const kelas = new Set();
for (const f of BERKAS) for (const m of readFileSync(f, 'utf8').matchAll(POLA_RONA)) kelas.add(m[0]);
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const { css: hasil } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')), content: [{ raw: `<div className="${[...kelas].join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const dirujuk = [...new Set([...hasil.matchAll(/var\(--warna-([a-z0-9-]+)\)/g)].map((m) => m[1]))];
const takAda = dirujuk.filter((n) => !GELAP[n] || !TERANG[n]);
cek(kelas.size > 150 && dirujuk.length > 50 && takAda.length === 0, `${kelas.size} kelas rona/putih/hitam dikompilasi; ${dirujuk.length} variabel dirujuk — semuanya ada di kedua dasar`, takAda);
cek(!/#[0-9a-fA-F]{6}/.test(hasil.replace(/\/\*[\s\S]*?\*\//g, '')), 'kelas rona tak lagi berisi hex tetap — semuanya lewat variabel');

// ── 4. Komponen ─────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. komponen --');
const semua = BERKAS.filter((f) => !/LampLogin\.jsx$|[\\/]Login\.jsx$/.test(f)).map((f) => [f, tanpaKomentar(readFileSync(f, 'utf8'))]);
const hexLama = semua.flatMap(([f, k]) => (k.match(/-\[#(?:0a0a0a|00ff88|ff4444|ffcc00|e4b84f|ffe29a)\]/gi) || []).map((m) => `${f.split('components')[1]}: ${m}`));
cek(hexLama.length === 0, 'hex yang dulu ditulis langsung (panel Home, status Observability, tautan unduh) sudah menjadi variabel', hexLama);
const LATAR_PADAT = /\bbg-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[4-7]00\b|\bbg-primary\b|\bbg-gradient/;
const putihDiPadat = semua.flatMap(([f, k]) => [...k.matchAll(/className=(\{`[^`]*`\}|"[^"]*")/g)].filter((m) => LATAR_PADAT.test(m[1]) && /\btext-white(?![\w/-])/.test(m[1])).map(() => f.split('components')[1]));
cek(putihDiPadat.length === 0, 'tak ada `text-white` di atas latar warna padat — memakai `text-di-warna` (tetap putih di tema terang)', putihDiPadat);
const diWarna = semua.reduce((n, [, k]) => n + (k.match(/\btext-di-warna\b/g) || []).length, 0);
cek(diWarna >= 17, `${diWarna} teks di atas warna padat memakai text-di-warna`);
const AG = tanpaKomentar(baca('frontend/src/components/dashboard/ActivityGraph.jsx'));
const tubuhAG = AG.slice(AG.indexOf('export default function'));
cek(!/'#ffffff'|'rgba\(255,\s*255,\s*255|'rgba\(226, 232, 240|'#fca5a5'/.test(tubuhAG) && /temaService\.langgan\(\(\) => \{ warnaKanvasRef\.current = bacaWarnaKanvas\(\); \}\)/.test(AG),
  'kanvas graf: warna terang dari variabel tema, dibaca ulang saat tema berganti');
cek(/getPropertyValue\(`--warna-\$\{n\}`\)/.test(AG), 'kanvas membaca variabel --warna-* dari <html>');
const APP = tanpaKomentar(baca('frontend/src/App.jsx'));
cek(/<div data-tema="ruangan-kayu" data-dasar="gelap" className="contents">\s*<LampLogin/.test(APP), 'layar masuk selalu Ruangan kayu, apa pun tema pilihan (LampLogin.jsx tak disentuh)');

// ── 5. Tema Terang terbaca ──────────────────────────────────────────────────────────────────────
console.log('\n-- 5. tema Terang: teks rona terbaca --');
const meta = JSON.parse(baca('frontend/public/metadata/themes.json'));
const terang = meta.themes.find((t) => t.dasar === 'terang');
cek(!!terang, `ada tema berdasar terang: ${terang?.nama}`);
if (terang) {
  const latar = ['surface', 'surface-container-high', 'surface-container-highest'].map((k) => [k, terang.nilai[k]]);
  const teks = new Set();
  for (const [, k] of semua) for (const m of k.matchAll(new RegExp(`\\btext-((?:${RONA.join('|')})-\\d+)\\b`, 'g'))) teks.add(m[1]);
  const gagalTeks = [];
  let terendah = 99;
  for (const k of teks) for (const [nl, l] of latar) { const r = rasio(TERANG[k], l); terendah = Math.min(terendah, r); if (r < 4.5) gagalTeks.push(`text-${k} di ${nl} ${r.toFixed(2)}`); }
  cek(teks.size > 20 && gagalTeks.length === 0, `${teks.size} kelas teks rona komponen ≥ 4,5:1 di latar Terang (terendah ${terendah.toFixed(2)})`, gagalTeks);
  const padat = new Set();
  for (const [, k] of semua) for (const m of k.matchAll(/className=(\{`[^`]*`\}|"[^"]*")/g)) if (/\btext-di-warna\b/.test(m[1])) for (const b of m[1].matchAll(new RegExp(`\\bbg-((?:${RONA.join('|')})-[4-7]00)\\b`, 'g'))) padat.add(b[1]);
  const gagalPadat = [...padat].filter((k) => rasio(TERANG['di-warna'], TERANG[k]) < 4.5).map((k) => `${k} ${rasio(TERANG['di-warna'], TERANG[k]).toFixed(2)}`);
  cek(padat.size > 0 && gagalPadat.length === 0, `teks putih di atas ${padat.size} latar padat rona ≥ 4,5:1 di dasar terang`, gagalPadat);
  const T = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/tema.js')).href);
  cek(T.dasarTema(terang.id, meta) === 'terang' && T.latarNyala({ latarRuangan: true, lampu: true }, terang.id, meta) === false, 'tema terang: dinding & lampu tak tampil');
}

// ── 6. Tema baru = metadata ─────────────────────────────────────────────────────────────────────
console.log('\n-- 6. tema baru cukup metadata --');
cek(meta.themes.every((t) => ['gelap', 'terang'].includes(t.dasar)), 'setiap tema memilih dasarnya', meta.themes.map((t) => `${t.id}:${t.dasar}`));
const biru = meta.themes.find((t) => t.id === 'biru-malam');
cek(biru?.dasar === 'gelap' && biru?.nama === 'Biru malam', 'Biru malam (pilihan Owner A) = entri metadata berdasar gelap');
cek(terang?.id === 'terang' && terang?.nama === 'Terang', 'Terang (pilihan Owner B — netral) = entri metadata berdasar terang');
const TS = tanpaKomentar(baca('frontend/src/core/runtime/services/TemaService.js'));
cek(/html\.dataset\.dasar = dasarTema\(id, this\.meta\);/.test(TS), 'TemaService menulis data-dasar di <html> dari metadata tema');
const asingDiKode = ['biru-malam', 'terang"', "'terang'"].filter((s) => BERKAS.some((f) => /\.jsx$/.test(f) && readFileSync(f, 'utf8').includes(`data-tema="${s.replace(/["']/g, '')}"`)));
cek(asingDiKode.length === 0, 'tak ada komponen yang menyebut tema baru secara khusus — semuanya dari metadata', asingDiKode);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

// UJI 2026-10-20 — Item 128 Tahap B: Settings › Tampilan, dua tema gelap, disimpan per akun, tanpa kedipan.
//
// Kenapa ada: Owner memutuskan tema sebagai pilihan pengguna (ROADMAP-TEMA-APLIKASI.md). Yang dijaga:
//   1. METADATA — public/metadata/themes.json sah (MUS §21) dan memuat keputusan Owner 20 Okt: nama berbahasa
//      Indonesia (T1), "Ikuti sistem" Windows terang → Gelap netral (T2), bawaan Ruangan kayu (T3).
//   2. LENGKAP — tema non-bawaan mendefinisikan PERSIS variabel yang sama dengan tema bawaan (kurang satu = warna
//      bocor dari tema lain).
//   3. TERBACA — SETIAP tema lulus kontras: di latar polos, di atas dinding ruangan (latar bisa dinyalakan di tema
//      apa pun), dan di dalam kartu kaca di atas dinding. Gelap netral benar-benar netral (tanpa nuansa hangat).
//   4. LOGIKA — pilihan tema, "Ikuti sistem", latar ruangan, dan aturan CSS tema (tema.js, murni).
//   5. TERPASANG — tema diterapkan saat boot SEBELUM tampilan dipasang (tanpa kedipan), disinkronkan dari akun
//      sesudah masuk, disimpan ke akun (user_metadata.tampilan) + salinan lokal; latar ruangan bisa dimatikan.
//   6. DIBUAT — kelas komponen Tampilan benar-benar dibuat Tailwind (pelajaran Item 127).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { bacaPalet } from './palet-tema.mjs';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (k) => k.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('uji-tema-tahap-b v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
};

const T = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/tema.js')).href);
const meta = JSON.parse(baca('frontend/public/metadata/themes.json'));

// ── 1. Metadata & keputusan Owner ───────────────────────────────────────────────────────────────
console.log('\n-- 1. metadata tema & keputusan Owner 20 Okt --');
const WAJIB = ['schemaVersion', 'version', 'id', 'description', 'owner', 'updatedAt'];
cek(WAJIB.every((k) => meta[k]), 'medan skema wajib MetadataService ada', WAJIB.filter((k) => !meta[k]));
cek(T.periksaMeta(meta).length === 0, 'bentuk metadata sah (periksaMeta)', T.periksaMeta(meta));
const nama = Object.fromEntries(meta.themes.map((t) => [t.id, t.nama]));
cek(nama['ruangan-kayu'] === 'Ruangan kayu' && nama['gelap-netral'] === 'Gelap netral', 'T1 — nama tema berbahasa Indonesia', nama);
cek(meta.ikutiSistem.terang === 'gelap-netral', 'T2 — "Ikuti sistem", Windows terang → Gelap netral (sampai tema Terang ada)', meta.ikutiSistem);
cek(meta.bawaan === 'ruangan-kayu' && meta.themes.find((t) => t.id === 'ruangan-kayu')?.nilai === null,
  'T3 — bawaan Ruangan kayu, nilainya dari berkas tema (frontend/src/tema/ruangan-kayu.css)');

// ── 2. Kelengkapan variabel ─────────────────────────────────────────────────────────────────────
console.log('\n-- 2. setiap tema mendefinisikan variabel yang sama --');
const bawaan = bacaPalet(AKAR, meta.bawaan).VAR;
const kunciBawaan = Object.keys(bawaan).sort();
const keHex = (rgb) => '#' + rgb.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('');
const PALET = { [meta.bawaan]: bawaan };
for (const t of meta.themes.filter((x) => x.nilai)) {
  const kunci = Object.keys(t.nilai).sort();
  const kurang = kunciBawaan.filter((k) => !kunci.includes(k)), lebih = kunci.filter((k) => !kunciBawaan.includes(k));
  cek(kurang.length === 0 && lebih.length === 0, `${t.nama}: ${kunci.length} variabel — sama persis dengan tema bawaan`, { kurang, lebih });
  PALET[t.id] = Object.fromEntries(Object.entries(t.nilai).map(([k, v]) => [k, keHex(v)]));
}

// ── 3. Kontras setiap tema ──────────────────────────────────────────────────────────────────────
console.log('\n-- 3. kontras setiap tema --');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Titik dinding paling terang — dihitung dari gradien LatarRuangan oleh uji-latar-ruangan (bayangan samping tergambar).
const DINDING = [77, 45, 23];
const cssGlobal = baca('frontend/src/index.css');
const kaca = cssGlobal.match(/\.glass-panel \{[^}]*background:\s*rgb\(var\(--warna-([a-z0-9-]+)\)\s*\/\s*([\d.]+)\)/);
cek(!!kaca, 'latar kartu kaca terbaca dari index.css');
const PASANGAN = [
  ['on-surface', 'surface', 4.5], ['on-surface', 'surface-container-high', 4.5], ['on-surface-strong', 'surface', 4.5],
  ['on-surface-variant', 'surface', 4.5], ['on-surface-variant', 'surface-container-highest', 4.5],
  ['primary', 'surface', 4.5], ['on-primary', 'primary', 4.5], ['outline', 'surface', 3],
  ['slate-300', 'slate-800', 4.5], ['slate-400', 'slate-900', 4.5], ['slate-500', 'slate-900', 4.5], ['slate-500', 'slate-950', 4.5],
];
const DI_DINDING = ['on-surface', 'on-surface-variant', 'primary', 'slate-300', 'slate-400', 'slate-500'];
for (const [id, P] of Object.entries(PALET)) {
  const nm = nama[id];
  const gagalPolos = PASANGAN.map(([a, b, batas]) => [a, b, batas, rasio(hex(P[a]), hex(P[b]))]).filter(([, , batas, r]) => r < batas)
    .map(([a, b, batas, r]) => `${a}/${b} ${r.toFixed(2)} < ${batas}`);
  cek(gagalPolos.length === 0, `${nm}: ${PASANGAN.length} pasangan di latar polos lulus`, gagalPolos);
  const utama = rasio(hex(P['on-surface']), hex(P.surface));
  cek(utama >= 7 && utama <= 14, `${nm}: teks utama ${utama.toFixed(2)}:1 — nyaman dibaca lama (7–14:1)`);
  const gagalDinding = DI_DINDING.map((k) => [k, rasio(hex(P[k]), DINDING)]).filter(([, r]) => r < 4.5).map(([k, r]) => `${k} ${r.toFixed(2)}`);
  cek(gagalDinding.length === 0, `${nm}: ${DI_DINDING.length} warna teks lulus di atas dinding ruangan (latar bisa dinyalakan)`, gagalDinding);
  if (kaca) {
    const a = Number(kaca[2]);
    const dalam = hex(P[kaca[1]]).map((v, i) => Math.round(v * a + DINDING[i] * (1 - a)));
    const gagalKartu = ['on-surface', 'on-surface-strong', 'on-surface-variant', 'slate-500'].map((k) => [k, rasio(hex(P[k]), dalam)])
      .filter(([, r]) => r < 4.5).map(([k, r]) => `${k} ${r.toFixed(2)}`);
    cek(gagalKartu.length === 0, `${nm}: teks di dalam kartu kaca di atas dinding lulus`, gagalKartu);
  }
  const merah = (h) => { const [r, g, b] = hex(h); return r > g + 40 && r > b + 40; };
  cek(merah(P.error) && merah(P['error-container']), `${nm}: warna galat tetap merah`);
}
const GN = PALET['gelap-netral'];
const hangatDiGN = Object.entries(GN || {}).filter(([k]) => !/error/.test(k)).filter(([, h]) => { const [r, g, b] = hex(h); return Math.abs(r - g) > 4 || Math.abs(g - b) > 4; }).map(([k, h]) => `${k}=${h}`);
cek(GN && hangatDiGN.length === 0, 'Gelap netral benar-benar netral — tak ada nuansa hangat (selisih R/G/B ≤ 4)', hangatDiGN);

// ── 4. Logika (tema.js) ─────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. logika pilihan tema --');
cek(T.pilihTema({ tema: 'gelap-netral' }, true, meta) === 'gelap-netral', 'tema pilihan dipakai apa adanya');
cek(T.pilihTema({ tema: 'sistem' }, true, meta) === meta.ikutiSistem.gelap && T.pilihTema({ tema: 'sistem' }, false, meta) === meta.ikutiSistem.terang,
  '"Ikuti sistem" mengikuti sisi gelap/terang Windows');
cek(T.pilihTema({ tema: 'tak-ada' }, true, meta) === meta.bawaan && T.pilihTema(null, true, meta) === meta.bawaan, 'setelan tak dikenal / kosong → tema bawaan');
cek(T.latarNyala({ tema: 'gelap-netral', latarRuangan: null }, 'gelap-netral', meta) === false
  && T.latarNyala({ tema: 'ruangan-kayu', latarRuangan: null }, 'ruangan-kayu', meta) === true, 'latar ruangan mengikuti bawaan tema bila belum dipilih');
cek(T.latarNyala({ tema: 'gelap-netral', latarRuangan: true }, 'gelap-netral', meta) === true, 'pilihan latar pengguna mengalahkan bawaan tema');
cek(T.metaDipakai({ themes: [] }) === T.META_CADANGAN && T.metaDipakai(null) === T.META_CADANGAN, 'metadata rusak/hilang → cadangan (hanya tema bawaan), aplikasi tetap jalan');
const css = T.aturanCssTema(meta);
cek(/html\[data-tema="gelap-netral"\],\n\[data-tema="gelap-netral"\] \{/.test(css), 'aturan CSS: html[data-tema] (menang atas :root) + [data-tema] (kotak pratinjau)');
cek(!/ruangan-kayu/.test(css), 'tema bawaan tidak diulang di aturan (nilainya dari berkas CSS-nya sendiri)');
cek((css.match(/--warna-/g) || []).length === kunciBawaan.length * meta.themes.filter((t) => t.nilai).length, 'setiap variabel tema non-bawaan tertulis di aturan');

// ── 5. Terpasang ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. terpasang dari boot sampai akun --');
const KR = tanpaKomentar(baca('frontend/src/core/runtime/Kernel.js'));
const iMeta = KR.indexOf("serviceManager.register('MetadataService', metadataService);"), iPasang = KR.indexOf('temaService.pasang(metadataService.getThemes());');
cek(iMeta > 0 && iPasang > iMeta && iPasang < KR.indexOf("'Kernel:PhaseCompleted', { phase: 1"), 'tema dipasang di fase 1 boot, tepat sesudah metadata — sebelum tampilan dipasang (tanpa kedipan)');
const MS = tanpaKomentar(baca('frontend/src/core/metadata/MetadataService.js'));
cek(/fetchJson\('themes\.json'\)/.test(MS) && /catch \(eTema\)/.test(MS), 'themes.json dimuat MetadataService, dan kegagalannya tidak menghentikan boot');
const TS = tanpaKomentar(baca('frontend/src/core/runtime/services/TemaService.js'));
cek(/supabase\.auth\.updateUser\(\{ data: \{ tampilan: this\.setelan \} \}\)/.test(TS), 'disimpan PER AKUN: user_metadata.tampilan (keputusan Owner)');
cek(/localStorage\.setItem\(KUNCI_LOKAL/.test(TS) && /localStorage\.getItem\(KUNCI_LOKAL\)/.test(TS), 'salinan lokal ditulis & dibaca saat membuka (tanpa menunggu akun)');
cek(/html\.dataset\.tema = id;/.test(TS) && /html\.dataset\.latar = /.test(TS), 'tema & latar diterapkan ke <html> (data-tema, data-latar)');
const APP = tanpaKomentar(baca('frontend/src/App.jsx'));
cek(/temaService\.sinkronDariAkun\(session\.user\)/.test(APP), 'sesudah masuk, setelan akun menjadi sumber kebenaran');
cek(/html\[data-latar="mati"\] \.latar-ruangan \{\s*display: none;/.test(cssGlobal.replace(/\/\*[\s\S]*?\*\//g, '')), 'latar ruangan mati → dinding disembunyikan (CSS)');
cek(/className="latar-ruangan /.test(baca('frontend/src/components/os/LatarRuangan.jsx')), 'dinding ruangan berkelas latar-ruangan');
const ST = tanpaKomentar(baca('frontend/src/components/Settings.jsx'));
cek(/\{ id: 'tampilan', label: 'Tampilan', ikon: 'visibility', tampil: true \}/.test(ST) && /bagianAktif === 'tampilan' && \(\s*<BagianTampilan \/>/.test(ST), 'Settings › Tampilan ada di daftar tab dan dirender');
const BT = tanpaKomentar(baca('frontend/src/components/BagianTampilan.jsx'));
cek(/data-tema=\{idTema\}/.test(BT), 'pratinjau memakai warna sungguhan tiap tema (data-tema pada kotaknya)');
cek(/temaService\.simpan\(/.test(BT) && /role="status"/.test(BT), 'pilihan disimpan lewat TemaService; hasil simpan (berhasil/gagal) diberitahukan');
const ikonBT = [...BT.matchAll(/material-symbols-outlined[^>]*>\s*\{?([^<{}]+?)\}?\s*</g)].map((m) => m[1]);
const subset = baca('frontend/src/assets/fonts/daftar-ikon.txt').split('\n').map((s) => s.trim());
const ikonDipakai = ['visibility', 'check_circle', 'toggle_on', 'toggle_off'];
cek(ikonDipakai.every((i) => subset.includes(i)) && ikonDipakai.every((i) => BT.includes(`'${i}'`) || BT.includes(`>${i}<`)), 'ikon yang dipakai ada di subset font (tanpa unduh)', { ikonBT });

// ── 6. Kelas dibuat Tailwind ────────────────────────────────────────────────────────────────────
console.log('\n-- 6. kelas BagianTampilan dikompilasi Tailwind --');
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const esc = reqFE('tailwindcss/lib/util/escapeClassName').default;
const kelas = [...new Set([...BT.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].flatMap((m) => (m[1] || m[2]).replace(/\$\{[^}]*\}/g, ' ').split(/\s+/))
  .concat([...BT.matchAll(/'((?:border|bg|text|hover:)[^']*)'/g)].flatMap((m) => m[1].split(/\s+/))).filter((k) => k && !/[{}$']/.test(k)))];
const { css: hasil } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')), content: [{ raw: `<div className="${kelas.join(' ')}">`, extension: 'jsx' }] })])
  .process('@tailwind utilities;', { from: undefined });
const GLOBAL = ['glass-panel', 'rim-light', 'material-symbols-outlined'];
// Selektor kelas berpengubah (`hover:`) berakhir dengan pseudo-kelasnya: `.hover\:bg-x:hover`.
const mati = kelas.filter((k) => !GLOBAL.includes(k) && !['.' + esc(k) + ' ', '.' + esc(k) + '{', '.' + esc(k) + ':'].some((s) => hasil.includes(s)));
cek(kelas.length > 40 && mati.length === 0, `${kelas.length} kelas BagianTampilan semuanya dibuat Tailwind`, mati);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

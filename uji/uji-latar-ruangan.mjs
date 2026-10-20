// UJI 2026-10-19 — latar terdalam seluruh aplikasi = dinding ruangan LampLogin (Item 127 Tahap 3).
//
// Kenapa ada: Owner, 19 Okt — "soal kenyamanan mata penyebabnya warna hijau kayu yang mendominasi… bisakah background
// dasar yang terletak paling dalam menggunakan background yang sama di LampLogin?" Akar masalahnya: tiap aplikasi
// mengecat latar terdalamnya SENDIRI (#050505, slate-950, slate-900/50, bg-background) — dinding apa pun yang dipasang
// di belakang akan tertutup lagi. Perbaikannya: satu lapisan dinding (os/LatarRuangan.jsx) di OSDesktopShell, akar
// aplikasi tembus pandang.
//
// Yang dijaga:
//   1. SAMA DENGAN LAMPLOGIN — kelas dinding, bayangan samping, vinyet, dan tekstur noise identik dengan LampLogin.jsx
//      (utang K5: salinan, karena LampLogin tak boleh disentuh; uji inilah yang mencegah keduanya menyimpang).
//   2. TERPASANG — dinding dilukis di OSDesktopShell sebelum isi; isinya `relative` TANPA z-index (tak membuat
//      konteks tumpukan baru, jadi laci chat z-[60] tetap menutupi tombol MENU z-50).
//   3. TEMBUS — akar sebelas layar tidak mengecat latar sendiri.
//   4. TERBACA — kontras teks di titik dinding PALING TERANG (dihitung dari gradiennya sendiri) ≥ 4,5:1.
//   5. BILAH GULIR — gaya tipis berlaku untuk SEMUA elemen, tak bergantung kelas yang bisa lupa dipasang.
//
// v2 (19 Okt, pemeriksaan "error tersembunyi"): v1 LULUS padahal salah. Ia menghitung kontras dengan bayangan samping
// LampLogin (`from-black/43 via-78% to-black/52`) — tetapi Tailwind 3.4 tidak pernah membuat ketiga kelas itu (43, 52,
// 78% di luar skala), jadi bayangannya tak pernah tergambar dan titik terang sebenarnya rgb(98,58,30), bukan (77,45,23):
// slate-500 3,62:1, bukan 4,55. Uji menghitung CSS yang DITULIS, bukan yang DIBUAT. Kini setiap kelas latar
// DIKOMPILASI dengan Tailwind sungguhan (konfigurasi proyek), dan lapisan hanya ikut dihitung bila kelasnya dibuat.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { bacaPalet } from './palet-tema.mjs';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) => kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('uji-latar-ruangan v6');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 400) : '')); }
};

const LL = baca('frontend/src/components/LampLogin.jsx');
const LR = baca('frontend/src/components/os/LatarRuangan.jsx');
const konst = (nama) => (LR.match(new RegExp(`const ${nama} = (['\`])([\\s\\S]*?)\\1;`)) || [])[2];

// ── 1. Sama dengan LampLogin ────────────────────────────────────────────────────────────────────
console.log('\n-- 1. salinan dinding identik dengan LampLogin --');
const DINDING = konst('DINDING'), SAMPING = konst('BAYANGAN_SAMPING'), VINYET = konst('VINYET'), NOISE = konst('NOISE');
cek(DINDING && LL.includes(`className="absolute inset-0 ${DINDING}"`), 'gradien dinding = lapisan 0 LampLogin', DINDING);
// Bayangan samping: NILAINYA sama dengan yang dimaksud LampLogin (.43 · 78% · .52), tetapi ditulis sebagai nilai bebas
// supaya benar-benar dibuat Tailwind (keputusan Owner A, 19 Okt).
const angkaLL = (LL.match(/bg-gradient-to-r from-black\/(\d+) via-transparent via-(\d+)% to-black\/(\d+)/) || []).slice(1).map(Number);
const angkaLR = ((SAMPING || '').match(/^bg-gradient-to-r from-black\/\[\.(\d+)\] via-transparent via-\[(\d+)%\] to-black\/\[\.(\d+)\]$/) || []).slice(1).map(Number);
cek(angkaLL.length === 3 && JSON.stringify(angkaLL) === JSON.stringify(angkaLR), `bayangan samping bernilai sama dengan maksud LampLogin (${angkaLL.join(' · ')})`, { angkaLL, angkaLR, SAMPING });
cek(VINYET && LL.includes(VINYET), 'vinyet = vinyet akhir LampLogin', VINYET);
cek(NOISE && LL.includes(NOISE), 'tekstur noise = LampLogin', (NOISE || '').slice(0, 60));
cek(/opacity-10 mix-blend-overlay/.test(LR) && /opacity-10 mix-blend-overlay/.test(LL), 'kekuatan noise sama (opacity-10, overlay)');
cek(/pointer-events-none/.test(LR) && /aria-hidden="true"/.test(LR), 'dinding tak menangkap klik dan tak dibaca pembaca layar');

// ── 1b. Setiap kelas latar benar-benar DIBUAT Tailwind ──────────────────────────────────────────
console.log('\n-- 1b. kelas latar dikompilasi dengan Tailwind sungguhan --');
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const konfigurasi = loadConfig(join(AKAR, 'frontend', 'tailwind.config.js'));
// Pelolosan nama kelas memakai fungsi Tailwind SENDIRI — tulisan tangan meleset (koma jadi `\2c `), dan pemeriksa yang
// meleset memberi "tak dibuat" palsu.
const esc = reqFE('tailwindcss/lib/util/escapeClassName').default;
const dibuat = async (daftar) => {
  // `block` ikut agar Tailwind tak memperingatkan "tak ada kelas" saat yang diperiksa memang kelas mati.
  const { css } = await postcss([tailwind({ ...konfigurasi, content: [{ raw: `<div className="block ${daftar.join(' ')}">`, extension: 'jsx' }] })])
    .process('@tailwind utilities;', { from: undefined });
  return Object.fromEntries(daftar.map((k) => [k, css.includes('.' + esc(k) + ' ') || css.includes('.' + esc(k) + '{')]));
};
const kelasLR = [DINDING, SAMPING, VINYET].join(' ').split(/\s+/).filter(Boolean);
const hasilLR = await dibuat(kelasLR);
const takDibuat = Object.entries(hasilLR).filter(([, ada]) => !ada).map(([k]) => k);
cek(takDibuat.length === 0, `${kelasLR.length} kelas latar semuanya dibuat Tailwind`, takDibuat);
const hasilLL = await dibuat(['from-black/43', 'via-78%', 'to-black/52']);
cek(Object.values(hasilLL).every((ada) => !ada),
  'kelas bayangan LampLogin memang TIDAK dibuat (alasan nilai bebas di atas; bila Tailwind kelak membuatnya, tinjau ulang)', hasilLL);

// ── 2. Terpasang ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. terpasang di OSDesktopShell --');
const SH = tanpaKomentar(baca('frontend/src/components/os/OSDesktopShell.jsx'));
const iLatar = SH.indexOf('<LatarRuangan />'), iIsi = SH.indexOf('<ApplicationContainer');
cek(/import LatarRuangan from '\.\/LatarRuangan'/.test(SH) && iLatar > 0 && iLatar < iIsi, 'dinding dilukis sebelum isi', { iLatar, iIsi });
cek(/<div className="relative flex h-screen w-screen/.test(SH), 'kerangka luar `relative` — dinding absolut terkurung di dalamnya');
const bungkusIsi = (SH.match(/<div className=\{`(relative flex flex-col flex-1[^`]*)`\}>\s*<ApplicationContainer/) || [])[1];
cek(bungkusIsi && !/\bz-/.test(bungkusIsi), 'pembungkus isi `relative` TANPA z-index (laci chat tetap di atas tombol MENU)', bungkusIsi);

// ── 3. Tembus ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. akar layar tidak mengecat latar sendiri --');
const AKAR_LAYAR = [
  ['os/ApplicationContainer.jsx', '<main className="flex-1 h-full overflow-hidden relative'],
  ['workbench/AppShell.jsx', '<div className="flex flex-col h-full w-full'],
  ['workbench/ConversationEngine.jsx', '<div className="flex flex-1 min-w-0 min-h-0 h-full w-full'],
  ['Settings.jsx', '<div className="flex-1 overflow-auto p-4'],
  ['dashboard/HomeDashboard.jsx', '<div className="flex flex-col md:flex-row h-full w-full'],
  ['agent-forge/AgentForge.jsx', '<div className="h-full'],
  ['memory/MemoryApp.jsx', '<div className="h-full'],
  ['research/ResearchApp.jsx', '<div className="h-full'],
  ['system/SystemLogsApp.jsx', '<div className="h-full'],
  ['explorer/FileExplorer.jsx', '<div className="flex flex-col h-full w-full'],
  ['BillingDashboard.jsx', '<div className="flex-1 overflow-y-auto p-4'],
];
for (const [berkas, awalan] of AKAR_LAYAR) {
  const kode = tanpaKomentar(baca('frontend/src/components/' + berkas));
  const i = kode.indexOf(awalan);
  const kelas = i < 0 ? null : kode.slice(i).match(/className="([^"]*)"/)[1];
  cek(kelas !== null && !/(^|\s)bg-/.test(kelas), `${berkas}: akar tembus pandang`, kelas);
}
// v2: gradien yang memudar KE warna latar lama (from-/via-/to-background) — di atas dinding ia jadi pita gelap. Dulu
// area kotak ketik chat memakainya.
const pakaiLatarLama = [];
for (const f of ['workbench/ConversationEngine.jsx', 'workbench/AppShell.jsx', 'dashboard/HomeDashboard.jsx', 'Settings.jsx', 'os/ApplicationContainer.jsx', 'os/OSDesktopShell.jsx']) {
  const kode = tanpaKomentar(baca('frontend/src/components/' + f));
  for (const m of kode.matchAll(/\b(?:from|via|to)-background\b/g)) pakaiLatarLama.push(`${f}: ${m[0]}`);
}
cek(pakaiLatarLama.length === 0, 'tak ada gradien yang memudar ke warna latar lama (pita gelap di atas dinding)', pakaiLatarLama);

// ── 4. Terbaca di titik dinding paling terang ───────────────────────────────────────────────────
console.log('\n-- 4. kontras di titik dinding paling terang --');
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const warna = (s) => s.startsWith('#') ? [...hex(s), 1] : s.match(/[\d.]+/g).map(Number);
const titik = (arr, p) => {
  if (p <= arr[0][0]) return arr[0][1];
  for (let i = 1; i < arr.length; i++) if (p <= arr[i][0]) { const [a, ca] = arr[i - 1], [b, cb] = arr[i]; return ca.map((v, k) => v + (cb[k] - v) * (p - a) / (b - a)); }
  return arr.at(-1)[1];
};
const tumpuk = (atas, bawah) => bawah.map((v, k) => (k < 3 ? atas[k] * atas[3] + v * (1 - atas[3]) : 1));
// Gradien dibaca dari kelas dinding itu sendiri — bila dinding diubah, titik terangnya ikut dihitung ulang.
const radial = DINDING.match(/radial-gradient\(ellipse_([\d.]+)%_([\d.]+)%_at_([\d.]+)%_([\d.]+)%,(.*?)\),linear/);
const [rx, ry, cx, cy] = radial.slice(1, 5).map((n) => Number(n) / 100);
const hentiRadial = radial[5].split(/,(?![^(]*\))/).map((s) => { const [c, p] = s.split('_'); return [parseFloat(p) / 100, warna(c)]; });
const linier = DINDING.match(/linear-gradient\(180deg,(.*?)\)\]$/)[1].split(',');
const hentiLinier = linier.map((s, i) => { const [c, p] = s.split('_'); return [p ? parseFloat(p) / 100 : i / (linier.length - 1), warna(c)]; });
// Bayangan samping ikut dihitung HANYA bila ketiga kelasnya benar-benar dibuat — kalau tidak, ia tak tergambar.
const sampingTergambar = SAMPING.split(/\s+/).every((k) => hasilLR[k]);
const [a0, posVia, a1] = angkaLR;
const hentiSamping = sampingTergambar
  ? [[0, [0, 0, 0, a0 / 100]], [posVia / 100, [0, 0, 0, 0]], [1, [0, 0, 0, a1 / 100]]]
  : [[0, [0, 0, 0, 0]], [1, [0, 0, 0, 0]]];
console.log(`     bayangan samping ${sampingTergambar ? `tergambar (.${a0} · ${posVia}% · .${a1})` : 'TIDAK tergambar — tak ikut dihitung'}`);
let terang = null;
for (let x = 0; x <= 1.0001; x += 0.01) for (let y = 0; y <= 1.0001; y += 0.01) {
  let c = tumpuk(titik(hentiRadial, Math.hypot((x - cx) / rx, (y - cy) / ry)), titik(hentiLinier, y));
  c = tumpuk(titik(hentiSamping, x), c);
  if (!terang || lum(c) > lum(terang)) terang = c;
}
const latarTerang = terang.slice(0, 3).map(Math.round);
console.log(`     titik paling terang: rgb(${latarTerang.join(', ')})`);
cek(lum(latarTerang) > lum(hex('#0b0806')), 'dinding memang lebih terang dari latar lama — kontrasnya perlu diukur ulang');
// v5 (Item 128 Tahap A): nilai palet dibaca dari tema Ruangan kayu (frontend/src/tema/ruangan-kayu.css).
const PALET = bacaPalet(AKAR, 'ruangan-kayu');
const token = (k) => PALET.TOKEN[k];
const slate = (n) => PALET.SLATE[String(n)];
for (const [nama, h] of [['on-surface', token('on-surface')], ['on-surface-variant', token('on-surface-variant')], ['primary', token('primary')],
  ['slate-300', slate(300)], ['slate-400', slate(400)], ['slate-500 (label redup, 135 tempat)', slate(500)]]) {
  const r = rasio(hex(h), latarTerang);
  cek(r >= 4.5, `${nama} ${h}: ${r.toFixed(2)}:1 di titik terang (≥ 4,5)`);
}
const urut = [300, 400, 500].map((n) => lum(hex(slate(n))));
cek(urut[0] > urut[1] && urut[1] > urut[2], 'urutan terang slate 300 > 400 > 500 tetap terjaga');

// ── 4b. Lampu nyala (v6, Item 128 Tahap C) ──────────────────────────────────────────────────────
// Pendar lampu = salinan medan cahaya LampLogin, diredam di wadahnya. Owner 20 Okt: 25% — pada kekuatan penuh teks
// di atas latar di area terang turun ke ±3,6:1. Titik paling terang dihitung ulang DENGAN pendar (tanpa blur — blur
// hanya meratakan puncak, jadi hitungan ini batas atas yang aman).
console.log('\n-- 4b. lampu nyala: salinan LampLogin, diredam, tetap terbaca --');
const PENDAR = [konst('PENDAR_1'), konst('PENDAR_2')];
cek(PENDAR.every((p) => p && LL.includes(`className="${p}"`)), 'dua lapisan pendar = medan cahaya LampLogin (sama persis)', PENDAR.map((p) => (p || '').slice(0, 60)));
const wadah = (LR.match(/className="lampu-ruangan absolute left-0 top-0 w-full h-\[(\d+)%\] opacity-(\d+)"/) || []).slice(1).map(Number);
cek(wadah.length === 2 && wadah[0] === 75, 'wadah pendar setinggi 75% layar — sama dengan LampLogin', wadah);
const opasitasLampu = wadah[1] / 100;
cek(opasitasLampu === 0.25, `pendar diredam ke ${wadah[1]}% (keputusan Owner 20 Okt: 25%)`);
const hasilPendar = await dibuat(PENDAR.join(' ').split(/\s+/).filter(Boolean));
cek(Object.values(hasilPendar).every(Boolean), 'semua kelas pendar dibuat Tailwind', Object.entries(hasilPendar).filter(([, v]) => !v).map(([k]) => k.slice(0, 50)));
const lapisanPendar = PENDAR.map((p) => {
  const [l, t, w, h] = p.match(/left-\[(\d+)%\] top-\[(\d+)%\] w-\[(\d+)%\] h-\[(\d+)%\]/).slice(1).map((n) => Number(n) / 100);
  const g = p.match(/radial-gradient\(ellipse_at_(\d+)%_(\d+)%,(.*)\)\] blur/);
  const [px, py] = [Number(g[1]) / 100, Number(g[2]) / 100];
  const potong = g[3].split(/,(?![^(]*\))/);
  const henti = potong.map((s, i) => { const [c, pos] = s.split('_'); return [pos ? parseFloat(pos) / 100 : (i === 0 ? 0 : 1), c === 'transparent' ? [0, 0, 0, 0] : warna(c)]; });
  const T_WADAH = wadah[0] / 100;
  // Elips "farthest-corner": melewati sudut terjauh dengan perbandingan sumbu yang sama dengan jarak ke sisi terjauh.
  const [rxP, ryP] = [Math.max(px, 1 - px) * w * Math.SQRT2, Math.max(py, 1 - py) * h * T_WADAH * Math.SQRT2];
  return { x0: l, x1: l + w, y0: t * T_WADAH, y1: (t + h) * T_WADAH, ex: l + px * w, ey: (t + py * h) * T_WADAH, rxP, ryP, henti };
});
let terangLampu = null, naikTerbesar = 0;
for (let x = 0; x <= 1.0001; x += 0.01) for (let y = 0; y <= 1.0001; y += 0.01) {
  let c = tumpuk(titik(hentiRadial, Math.hypot((x - cx) / rx, (y - cy) / ry)), titik(hentiLinier, y));
  c = tumpuk(titik(hentiSamping, x), c);
  for (const L of lapisanPendar) {
    if (x < L.x0 || x > L.x1 || y < L.y0 || y > L.y1) continue;
    const s = titik(L.henti, Math.hypot((x - L.ex) / L.rxP, (y - L.ey) / L.ryP));
    c = tumpuk([s[0], s[1], s[2], s[3] * opasitasLampu], c);
  }
  // Seberapa jauh lampu menerangi titik ini dibanding dinding saja — bukti lapisannya benar-benar dihitung.
  const tanpaLampu = tumpuk(titik(hentiSamping, x), tumpuk(titik(hentiRadial, Math.hypot((x - cx) / rx, (y - cy) / ry)), titik(hentiLinier, y)));
  naikTerbesar = Math.max(naikTerbesar, lum(c) - lum(tanpaLampu));
  if (!terangLampu || lum(c) > lum(terangLampu)) terangLampu = c;
}
const latarLampu = terangLampu.slice(0, 3).map(Math.round);
console.log(`     titik paling terang dengan lampu nyala: rgb(${latarLampu.join(', ')})`);
// Pendar menerangi bagian ATAS (y < 55%) — area dinding yang semula gelap; pusat terang dinding (39%, 56%) berada di
// luar kotak pendar, jadi titik paling terang layar bisa tetap di sana. Yang dibuktikan: lapisan pendar benar-benar
// menerangi, dan kontras diukur di titik paling terang mana pun (dengan atau tanpa lampu).
cek(naikTerbesar > 0.005, `lampu memang menerangi area di bawahnya (kenaikan luminans terbesar ${naikTerbesar.toFixed(3)})`);
const metaTemaL = JSON.parse(baca('frontend/public/metadata/themes.json'));
const PALET_TEMA = { 'ruangan-kayu': PALET.VAR };
for (const t of metaTemaL.themes.filter((x) => x.nilai)) PALET_TEMA[t.id] = Object.fromEntries(Object.entries(t.nilai).map(([k, v]) => [k, '#' + v.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')]));
const cssLampu = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const kacaLampu = cssLampu.match(/\.glass-panel \{[^}]*background:\s*rgb\(var\(--warna-([a-z0-9-]+)\)\s*\/\s*([\d.]+)\)/);
for (const [id, P] of Object.entries(PALET_TEMA)) {
  const gagalLatar = ['on-surface', 'on-surface-variant', 'primary', 'slate-500'].map((k) => [k, rasio(hex(P[k]), latarLampu)]).filter(([, r]) => r < 4.5).map(([k, r]) => `${k} ${r.toFixed(2)}`);
  cek(gagalLatar.length === 0, `${id}: teks langsung di atas latar ber-lampu ≥ 4,5:1`, gagalLatar);
  if (kacaLampu) {
    const a = Number(kacaLampu[2]);
    const dalam = hex(P[kacaLampu[1]]).map((v, i) => Math.round(v * a + latarLampu[i] * (1 - a)));
    const gagalKartu = ['on-surface', 'on-surface-strong', 'slate-500'].map((k) => [k, rasio(hex(P[k]), dalam)]).filter(([, r]) => r < 4.5).map(([k, r]) => `${k} ${r.toFixed(2)}`);
    cek(gagalKartu.length === 0, `${id}: teks di dalam kartu di atas latar ber-lampu ≥ 4,5:1`, gagalKartu);
  }
}
cek(/\.lampu-ruangan \{\s*display: none;\s*\}/.test(cssLampu) && /html\[data-lampu="nyala"\] \.lampu-ruangan \{\s*display: block;/.test(cssLampu),
  'pendar tersembunyi bawaannya; tampil hanya bila html[data-lampu="nyala"]');
const iLampu = LR.indexOf('lampu-ruangan'), iVinyet = LR.indexOf('${VINYET}');
cek(iLampu > LR.indexOf('${BAYANGAN_SAMPING}') && iLampu < iVinyet && /className="latar-ruangan /.test(LR),
  'pendar di dalam latar ruangan (ikut tersembunyi bila latar mati), di atas bayangan samping, di bawah vinyet');

// v4 (20 Okt): jawaban model di dalam kartu bergaya Settings (`.glass-panel`, tembus sebagian) — teksnya berdiri di atas
// campuran kartu + dinding. Latar kartu dibaca dari index.css; campurannya dihitung di titik dinding paling terang.
// Kaca buramnya (blur) hanya meratakan dinding di baliknya, jadi tak bisa lebih terang dari titik paling terang.
const CEteks = baca('frontend/src/components/workbench/ConversationEngine.jsx');
const kartuDipakai = /: 'glass-panel [^']*'\}`\}>/.test(CEteks);
const cssKaca = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
// Latar .glass-panel = variabel tema + opasitas: `rgb(var(--warna-X) / a)` — nilainya diurai dari palet tema.
const kaca = cssKaca.match(/\.glass-panel \{[^}]*background:\s*rgb\(var\(--warna-([a-z0-9-]+)\)\s*\/\s*([\d.]+)\)/);
const latarKaca = kaca && PALET.VAR[kaca[1]] ? [...hex(PALET.VAR[kaca[1]]), Number(kaca[2])] : [];
cek(kartuDipakai && latarKaca.length === 4, `kartu jawaban model memakai .glass-panel — latar rgba(${latarKaca.join(', ')})`);
const bingkai = latarKaca.length === 4 ? [null, ...latarKaca] : null;
if (bingkai) {
  const [r0, g0, b0, a0b] = bingkai.slice(1).map(Number);
  const dalamBingkai = latarTerang.map((v, k) => Math.round([r0, g0, b0][k] * a0b + v * (1 - a0b)));
  console.log(`     di dalam bingkai (${Math.round(a0b * 100)}% pekat) di titik terang: rgb(${dalamBingkai.join(', ')})`);
  for (const [nama, h] of [['on-surface (teks jawaban)', token('on-surface')], ['on-surface-strong (tebal & judul)', token('on-surface-strong')],
    ['on-surface-variant', token('on-surface-variant')], ['slate-500 (label "TOOLS:")', slate(500)]]) {
    const r = rasio(hex(h), dalamBingkai);
    cek(h && r >= 4.5, `${nama} ${h}: ${r.toFixed(2)}:1 di dalam bingkai (≥ 4,5)`);
  }
  cek(lum(dalamBingkai) > lum([r0, g0, b0]), 'dinding memang ikut terlihat di dalam bingkai (bingkai tidak pekat penuh)');
}

// ── 5. Bilah gulir tipis berlaku global ─────────────────────────────────────────────────────────
console.log('\n-- 5. bilah gulir --');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const blokGlobal = (css.match(/\n\*::-webkit-scrollbar \{([^}]*)\}/) || [])[1] || '';
const px = (p) => Number((blokGlobal.match(new RegExp(`${p}:\\s*(\\d+)px`)) || [])[1]);
cek(px('width') > 0 && px('width') <= 6 && px('height') > 0 && px('height') <= 6, `semua elemen: bilah tipis tegak & mendatar (${px('width')}px / ${px('height')}px)`, blokGlobal);
cek(!/\.custom-scrollbar::-webkit-scrollbar/.test(css), 'tak ada lagi gaya yang hanya berlaku bila kelas .custom-scrollbar dipasang');
cek(/\*::-webkit-scrollbar-thumb \{[^}]*rgb\(var\(--warna-kilau\)\s*\/\s*[\d.]+\)/.test(css) && PALET.VAR.kilau === '#ffeccf',
  `jempol bilah krem hangat (--warna-kilau ${PALET.VAR.kilau}), bukan putih`);
const MT = baca('frontend/src/components/os/MenuTeks.jsx');
cek(/\[&::-webkit-scrollbar\]:hidden/.test(MT), 'MenuTeks tetap menyembunyikan bilahnya (kelasnya lebih spesifik dari aturan global)');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

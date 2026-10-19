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

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) => kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('uji-latar-ruangan v1');

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
cek(SAMPING && LL.includes(`className="absolute inset-0 ${SAMPING}"`), 'bayangan samping = LampLogin', SAMPING);
cek(VINYET && LL.includes(VINYET), 'vinyet = vinyet akhir LampLogin', VINYET);
cek(NOISE && LL.includes(NOISE), 'tekstur noise = LampLogin', (NOISE || '').slice(0, 60));
cek(/opacity-10 mix-blend-overlay/.test(LR) && /opacity-10 mix-blend-overlay/.test(LL), 'kekuatan noise sama (opacity-10, overlay)');
cek(/pointer-events-none/.test(LR) && /aria-hidden="true"/.test(LR), 'dinding tak menangkap klik dan tak dibaca pembaca layar');

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
const hentiSamping = [[0, [0, 0, 0, 0.43]], [0.78, [0, 0, 0, 0]], [1, [0, 0, 0, 0.52]]];
cek(SAMPING === 'bg-gradient-to-r from-black/43 via-transparent via-78% to-black/52', 'bayangan samping sesuai model hitungan');
let terang = null;
for (let x = 0; x <= 1.0001; x += 0.01) for (let y = 0; y <= 1.0001; y += 0.01) {
  let c = tumpuk(titik(hentiRadial, Math.hypot((x - cx) / rx, (y - cy) / ry)), titik(hentiLinier, y));
  c = tumpuk(titik(hentiSamping, x), c);
  if (!terang || lum(c) > lum(terang)) terang = c;
}
const latarTerang = terang.slice(0, 3).map(Math.round);
console.log(`     titik paling terang: rgb(${latarTerang.join(', ')})`);
cek(lum(latarTerang) > lum(hex('#0b0806')), 'dinding memang lebih terang dari latar lama — kontrasnya perlu diukur ulang');
const conf = baca('frontend/tailwind.config.js');
const token = (k) => (conf.match(new RegExp(`"${k}": "(#[0-9a-fA-F]{6})"`)) || [])[1];
const slate = (n) => (conf.match(new RegExp(`\\b${n}: "(#[0-9a-fA-F]{6})"`)) || [])[1];
for (const [nama, h] of [['on-surface', token('on-surface')], ['on-surface-variant', token('on-surface-variant')], ['primary', token('primary')],
  ['slate-300', slate(300)], ['slate-400', slate(400)], ['slate-500 (label redup, 135 tempat)', slate(500)]]) {
  const r = rasio(hex(h), latarTerang);
  cek(r >= 4.5, `${nama} ${h}: ${r.toFixed(2)}:1 di titik terang (≥ 4,5)`);
}
const urut = [300, 400, 500].map((n) => lum(hex(slate(n))));
cek(urut[0] > urut[1] && urut[1] > urut[2], 'urutan terang slate 300 > 400 > 500 tetap terjaga');

// ── 5. Bilah gulir tipis berlaku global ─────────────────────────────────────────────────────────
console.log('\n-- 5. bilah gulir --');
const css = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const blokGlobal = (css.match(/\n\*::-webkit-scrollbar \{([^}]*)\}/) || [])[1] || '';
const px = (p) => Number((blokGlobal.match(new RegExp(`${p}:\\s*(\\d+)px`)) || [])[1]);
cek(px('width') > 0 && px('width') <= 6 && px('height') > 0 && px('height') <= 6, `semua elemen: bilah tipis tegak & mendatar (${px('width')}px / ${px('height')}px)`, blokGlobal);
cek(!/\.custom-scrollbar::-webkit-scrollbar/.test(css), 'tak ada lagi gaya yang hanya berlaku bila kelas .custom-scrollbar dipasang');
cek(/\*::-webkit-scrollbar-thumb \{[^}]*rgba\(255, 236, 207/.test(css), 'jempol bilah krem hangat, bukan putih');
const MT = baca('frontend/src/components/os/MenuTeks.jsx');
cek(/\[&::-webkit-scrollbar\]:hidden/.test(MT), 'MenuTeks tetap menyembunyikan bilahnya (kelasnya lebih spesifik dari aturan global)');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

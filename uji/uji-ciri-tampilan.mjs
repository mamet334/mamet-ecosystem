
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(AKAR, 'frontend', 'src');
const DIKECUALIKAN = new Set(['components/LampLogin.jsx', 'components/os/LatarRuangan.jsx']);

const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-ciri-tampilan v6');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const POLA = {
  warnaTetap: /\b(?:bg|text|border|from|via|to|fill|stroke|ring|divide|outline|shadow|placeholder)-\[#[0-9a-fA-F]{3,8}\]/g,
  warnaSlate: /\b(?:bg|text|border)-slate-\d+/g,
  aksenPelangi: /\b(?:bg|text|border|from|to|via)-(?:emerald|cyan|violet|indigo|purple|fuchsia)-\d+/g,
  gerakDekoratif: /\banimate-(?:pulse|ping|spin)\b/g,
  kacaBlur: /\bbackdrop-blur\b/g,
  glowRgba: /\bshadow-\[[^\]]*rgba/g,
  gradien: /\bbg-gradient-to-|radial-gradient|linear-gradient/g,
};
const ADA_LUCIDE = /from\s+['"]lucide-react['"]/;
const ADA_MATERIAL_SYMBOLS = /material-symbols/;

function hitung(kode) {
  const k = tanpaKomentar(kode);
  const hasil = {};
  for (const [nama, pola] of Object.entries(POLA)) hasil[nama] = (k.match(pola) || []).length;
  hasil.berkasIkonLucide = ADA_LUCIDE.test(k) ? 1 : 0;
  hasil.berkasIkonMaterialSymbols = ADA_MATERIAL_SYMBOLS.test(k) ? 1 : 0;
  return hasil;
}

console.log('\n-- 1. penghitung menggigit (fixture) --');
const FIXTURE = `
import { X } from 'lucide-react';
// bg-slate-900 di komentar baris TIDAK dihitung
/* text-primary di komentar blok TIDAK dihitung */
const a = <div className="bg-surface-container-low text-on-surface border-outline-variant bg-slate-950 text-slate-400 bg-[#0a0a0a]/90 text-white bg-black/40
  from-emerald-500 via-cyan-400 to-purple-600 animate-pulse animate-spin backdrop-blur-md
  shadow-[0_0_20px_rgba(0,0,0,.5)] bg-gradient-to-r" style={{ background: 'radial-gradient(#000, #fff)' }}>
  <span className="material-symbols-outlined">home</span></div>;
`;
const f = hitung(FIXTURE);
cek(f.warnaTetap === 1, 'warna tetap dihitung: hex di kelas (1); putih/hitam & token palet TIDAK dihitung (ikut tema)', f.warnaTetap);
cek(f.warnaSlate === 2, 'warna slate dihitung, yang di komentar tidak (2)', f.warnaSlate);
cek(f.aksenPelangi === 3, 'aksen pelangi dihitung termasuk from/via/to (3)', f.aksenPelangi);
cek(f.gerakDekoratif === 2, 'gerak dekoratif dihitung (2)', f.gerakDekoratif);
cek(f.kacaBlur === 1, 'backdrop-blur dihitung (1)', f.kacaBlur);
cek(f.glowRgba === 1, 'bayangan glow rgba dihitung (1)', f.glowRgba);
cek(f.gradien === 2, 'gradien kelas + gradien CSS dihitung (2)', f.gradien);
cek(f.berkasIkonLucide === 1 && f.berkasIkonMaterialSymbols === 1, 'kedua set ikon terdeteksi', f);

function semuaJsx(dir) {
  const keluar = [];
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) keluar.push(...semuaJsx(p));
    else if (nama.endsWith('.jsx')) keluar.push(p);
  }
  return keluar;
}

const berkas = semuaJsx(SRC)
  .map((p) => relative(SRC, p).replace(/\\/g, '/'))
  .filter((r) => !DIKECUALIKAN.has(r))
  .sort();

const total = {};
for (const r of berkas) {
  const h = hitung(readFileSync(join(SRC, r), 'utf8').replace(/\r\n/g, '\n'));
  for (const [k, v] of Object.entries(h)) total[k] = (total[k] || 0) + v;
}

console.log(`\n-- 2. ${berkas.length} berkas .jsx (tanpa ${[...DIKECUALIKAN].join(', ')}) --`);
for (const [k, v] of Object.entries(total)) console.log(`     ${k.padEnd(26)} ${v}`);

for (const r of DIKECUALIKAN) {
  let ada = true;
  try { statSync(join(SRC, r)); } catch { ada = false; }
  cek(ada, `berkas yang dikecualikan masih ada: ${r}`);
}

const GARIS_WARNA_TETAP = 6;
const GARIS_DASAR = {
  warnaTetap: GARIS_WARNA_TETAP,
  warnaSlate: 591,
  aksenPelangi: 242,
  gerakDekoratif: 48,
  kacaBlur: 15,
  glowRgba: 19,
  gradien: 5,
  berkasIkonLucide: 0,
  berkasIkonMaterialSymbols: 10,
};

console.log('\n-- 3. tidak ada angka yang naik dari garis dasar --');
const turun = [];
for (const [k, batas] of Object.entries(GARIS_DASAR)) {
  if (batas === null) { cek(false, `garis dasar "${k}" belum diisi (sekarang ${total[k]})`); continue; }
  cek(total[k] <= batas, `${k}: ${total[k]} ≤ ${batas}`, { sekarang: total[k], batas });
  if (total[k] < batas) turun.push(`${k}: ${batas} → ${total[k]}`);
}
cek(Object.keys(GARIS_DASAR).length === Object.keys(total).length,
  'setiap penghitung punya garis dasar (tak ada yang lolos tanpa batas)',
  { penghitung: Object.keys(total), garisDasar: Object.keys(GARIS_DASAR) });

if (turun.length) {
  console.log('\n  ↓ TURUN — kencangkan gigi: perbarui GARIS_DASAR di berkas ini ke angka baru:');
  for (const t of turun) console.log('      ' + t);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

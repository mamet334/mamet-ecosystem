
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(AKAR, 'frontend', 'src');
const DIKECUALIKAN = new Set(['components/LampLogin.jsx']);

console.log('uji-ukuran-huruf v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
};

const kecil = (baris) => {
  if (baris.includes('material-symbols')) return [];
  const kelas = [...baris.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1])).filter((n) => n < 12);
  const sebaris = [...baris.matchAll(/fontSize:\s*['"]?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n < 12);
  return [...kelas, ...sebaris];
};
console.log('\n-- 1. penghitung menggigit (fixture) --');
cek(kecil('<p className="text-[10px] uppercase">').length === 1, 'text-[10px] tertangkap');
cek(kecil("<p style={{ fontSize: '11px' }}>").length === 1, 'fontSize sebaris 11px tertangkap');
cek(kecil('<span className="material-symbols-outlined text-[10px]">x</span>').length === 0, 'ikon tidak dihitung');
cek(kecil('<p className="text-[12px] text-[14px]">').length === 0, '12px dan di atasnya lolos');

const semua = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? semua(p) : n.endsWith('.jsx') ? [p] : [];
});
const pelanggaran = [];
let berkas = 0;
for (const p of semua(SRC)) {
  const rel = relative(SRC, p).replace(/\\/g, '/');
  if (DIKECUALIKAN.has(rel)) continue;
  berkas++;
  readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n').forEach((b, i) => {
    for (const n of kecil(b)) pelanggaran.push(`${rel}:${i + 1} (${n}px)`);
  });
}
console.log(`\n-- 2. ${berkas} berkas .jsx --`);
cek(pelanggaran.length === 0, 'tak ada teks di bawah 12px (di luar ikon & LampLogin)', pelanggaran);

console.log('\n-- 3. skala di tailwind.config --');
const conf = readFileSync(join(AKAR, 'frontend', 'tailwind.config.js'), 'utf8');
const skala = Object.fromEntries([...conf.matchAll(/"([a-z-]+)": \["(\d+)px"/g)].map((m) => [m[1], Number(m[2])]));
cek(skala['body-base'] >= 16, `teks bacaan (body-base) ${skala['body-base']}px ≥ 16px`);
cek(Object.values(skala).every((n) => n >= 12), 'tak ada ukuran skala di bawah 12px', skala);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

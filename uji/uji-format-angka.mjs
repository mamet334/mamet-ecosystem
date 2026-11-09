
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-format-angka v2');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const impor = (p) => import(pathToFileURL(join(AKAR, p)).href);
const { angka, ukuranMB, waktuLokal } = await impor('frontend/src/core/runtime/services/formatAngka.js');
const { angkaRingkas } = await impor('frontend/src/core/runtime/services/KonteksChat.js');

console.log('\n-- 1. format Indonesia: titik ribuan, koma desimal --');
cek(angka(1234.5, 1) === '1.234,5', `angka(1234.5, 1) → ${angka(1234.5, 1)}`);
cek(angka(0.012345, 4) === '0,0123', `angka(0.012345, 4) → ${angka(0.012345, 4)}`);
cek(angka(1000000) === '1.000.000', `angka(1000000) → ${angka(1000000)}`);
cek(angka('bukan angka', 2) === '0,00', 'masukan bukan angka → 0, bukan "NaN" di layar');
cek(ukuranMB(5452595) === '5,2', `ukuranMB(5452595) → ${ukuranMB(5452595)}`);
cek(waktuLokal('bukan-tanggal') === '', 'tanggal rusak → kosong, bukan "Invalid Date" di layar');
cek(/^\d{1,2}\/\d{1,2}\/\d{4}/.test(waktuLokal('2026-10-19T06:11:00Z')), `waktuLokal → ${waktuLokal('2026-10-19T06:11:00Z')}`);

console.log('\n-- 2. ringkasan meteran: koma desimal, bentuk contoh Owner --');
cek(angkaRingkas(300) === '300', 'di bawah seribu apa adanya');
cek(angkaRingkas(189700) === '189,7k', `angkaRingkas(189700) → ${angkaRingkas(189700)}`);
cek(angkaRingkas(1500000) === '1,5jt', `angkaRingkas(1500000) → ${angkaRingkas(1500000)}`);

console.log('\n-- 3. tak ada toFixed di tampilan (kecuali placeholder kolom angka) --');
const semua = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? semua(p) : n.endsWith('.jsx') ? [p] : [];
});
const SRC = join(AKAR, 'frontend', 'src');
const sisa = [];
for (const p of semua(SRC)) {
  const rel = relative(SRC, p).replace(/\\/g, '/');
  tanpaKomentar(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).split('\n').forEach((b, i) => {
    if (/\.toFixed\(/.test(b) && !/placeholder=/.test(b)) sisa.push(`${rel}:${i + 1}`);
  });
}
cek(sisa.length === 0, 'semua angka tampilan lewat formatAngka', sisa);
const dolarMentah = [];
for (const p of semua(SRC)) {
  const rel = relative(SRC, p).replace(/\\/g, '/');
  tanpaKomentar(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).split('\n').forEach((b, i) => {
    for (const m of b.matchAll(/\$\$\{(?!angka\()/g)) dolarMentah.push(`${rel}:${i + 1}`);
  });
}
cek(dolarMentah.length === 0, 'tak ada angka dolar mentah `$${…}` yang melewati formatAngka', dolarMentah);
const billing = tanpaKomentar(baca('frontend/src/components/BillingDashboard.jsx'));
cek(!/\.toLocaleString\(\)/.test(billing) && /waktuLokal\(/.test(billing), 'waktu log Billing eksplisit id-ID, bukan locale sistem yang bisa berubah');

console.log('\n-- 4. angka tabular di seluruh aplikasi --');
const css = baca('frontend/src/index.css');
const blokBody = (css.match(/\nbody \{[\s\S]*?\n\}/) || [''])[0];
cek(/font-variant-numeric:\s*tabular-nums/.test(blokBody), 'body memakai tabular-nums', blokBody.slice(0, 120));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

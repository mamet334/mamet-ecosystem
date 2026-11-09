
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PATOKAN = join(AKAR, 'uji', 'patokan-catch-diam.json');
const perbarui = process.argv.includes('--perbarui');

console.log('uji-catch-diam v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const DIR = ['frontend/src', 'supabase/functions', 'frontend/electron', 'shared'];

const BERSUARA = /console\.(log|warn|error|info)|logger|catatGalat|\bset\w*(Error|Galat)\w*\(|throw|reject|captureException/;

function pindai() {
  const berkas = [];
  const jalan = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!/node_modules|dist|release|\.git/.test(p)) jalan(p); }
      else if (/\.(js|jsx|ts|cjs|mjs)$/.test(e.name)) berkas.push(p);
    }
  };
  for (const d of DIR) { const p = join(AKAR, d); if (existsSync(p)) jalan(p); }

  const hasil = {};
  let total = 0, bersuara = 0, kosong = 0;
  for (const f of berkas) {
    const s = readFileSync(f, 'utf8');
    let n = 0;
    for (const m of s.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g)) {
      total++;
      const isi = m[1].trim();
      if (BERSUARA.test(isi)) { bersuara++; continue; }
      if (/^[\s;]*$/.test(isi)) kosong++;
      n++;
    }
    if (n > 0) hasil[f.replace(AKAR + sep, '').split(sep).join('/')] = n;
  }
  return { hasil, total, bersuara, kosong, jumlahBerkas: berkas.length };
}

const { hasil, total, bersuara, kosong, jumlahBerkas } = pindai();
const diam = Object.values(hasil).reduce((a, b) => a + b, 0);

console.log(`\nberkas sumber ${jumlahBerkas} · blok catch ${total} · bersuara ${bersuara} · DIAM ${diam} (${kosong} kosong, ${diam - kosong} berisi kode tanpa melapor)`);

if (perbarui) {
  writeFileSync(PATOKAN, JSON.stringify({
    catatan: 'Patokan catch DIAM per berkas. HANYA BOLEH TURUN. Perbarui dengan: node uji/uji-catch-diam.mjs --perbarui',
    diperbarui: new Date().toISOString().slice(0, 10),
    total: diam,
    berkas: hasil,
  }, null, 2) + '\n');
  console.log(`\nPatokan ditulis ulang: ${diam} catch diam di ${Object.keys(hasil).length} berkas.`);
  process.exit(0);
}

if (!existsSync(PATOKAN)) {
  console.log('\nPatokan belum ada. Jalankan: node uji/uji-catch-diam.mjs --perbarui');
  process.exit(1);
}

const patokan = JSON.parse(readFileSync(PATOKAN, 'utf8'));
const lama = patokan.berkas || {};

console.log('\n-- tidak boleh bertambah --');
{
  const naik = [];
  for (const [f, n] of Object.entries(hasil)) {
    const p = lama[f] ?? 0;
    if (n > p) naik.push(`${f}: ${p} -> ${n}`);
  }
  cek(naik.length === 0,
    'tak ada berkas yang menambah `catch` diam', naik);
  if (naik.length) {
    console.log('       Catat galatnya (console.warn/error), teruskan (throw/reject), atau tampilkan ke pengguna');
    console.log('       (set…Galat/set…Error). Galat yang ditelan tanpa jejak tidak boleh bertambah.');
  }
}

console.log('\n-- patokan tidak boleh berbohong --');
{
  const turun = [];
  for (const [f, p] of Object.entries(lama)) {
    const n = hasil[f] ?? 0;
    if (n < p) turun.push(`${f}: ${p} -> ${n}`);
  }
  cek(turun.length === 0,
    'patokan cocok dengan keadaan kode (tak ada yang sudah membaik tapi belum dicatat)', turun);
  if (turun.length) {
    console.log('       Ada yang MEMBAIK — bagus. Turunkan patokannya supaya ia tidak berbohong:');
    console.log('           node uji/uji-catch-diam.mjs --perbarui');
  }
}

console.log('\n-- arah --');
cek(diam <= (patokan.total ?? diam),
  `total tidak melampaui patokan (${diam} vs ${patokan.total})`, { sekarang: diam, patokan: patokan.total });

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

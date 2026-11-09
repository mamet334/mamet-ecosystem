import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { rentangKomentar, POLA_DIREKTIF } = await import(pathToFileURL(join(AKAR, 'scripts/hapus-komentar.mjs')).href);

console.log('uji-kode-tanpa-komentar v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const DI_LUAR_CAKUPAN = /^(mametlite|supabase\/migrations|_knowledge_archive|graphify-out)\//;
const dilacak = execFileSync('git', ['ls-files'], { cwd: AKAR, encoding: 'utf8' }).split('\n').filter((f) => f && !DI_LUAR_CAKUPAN.test(f));
const penjelas = (teks, alamat) => rentangKomentar(teks, alamat).filter((r) => !POLA_DIREKTIF.test(r.teks.trim()));

console.log('\n-- kendali: pemindai membedakan komentar dari kode --');
{
  const contoh = [
    "const a = 'http://x.com/a';",
    'const r = /\\/\\//g;',
    'const t = `// bukan komentar ${a}`;',
    'import(/* @vite-ignore */ b);',
    '// eslint-disable-next-line no-console',
    'const n = 1; // penjelas',
    '/* penjelas blok */',
  ].join('\n');
  const hasil = penjelas(contoh, 'kendali.js').map((r) => r.teks);
  cek(hasil.length === 2, 'tepat dua komentar penjelas terdeteksi di contoh', hasil);
  cek(hasil.every((t) => /penjelas/.test(t)), 'URL, regex, dan template literal tidak dikira komentar', hasil);
  cek(penjelas('<div>{/* penjelas jsx */}</div>;', 'kendali.jsx').length === 1, 'komentar di dalam JSX terdeteksi');
}

console.log('\n-- JS/TS --');
{
  const kode = dilacak.filter((f) => /\.(m?js|cjs|jsx|tsx?)$/.test(f));
  cek(kode.length > 400, `berkas JS/TS dalam cakupan terbaca (${kode.length})`);
  const temuan = [];
  for (const f of kode) {
    const n = penjelas(readFileSync(join(AKAR, f), 'utf8'), f).length;
    if (n) temuan.push(`${f}: ${n}`);
  }
  cek(temuan.length === 0, `tak ada komentar penjelas di JS/TS (${temuan.length} berkas berkomentar)`, temuan.slice(0, 15));
}

console.log('\n-- Python --');
{
  const py = dilacak.filter((f) => f.endsWith('.py'));
  cek(py.length > 20, `berkas Python dalam cakupan terbaca (${py.length})`);
  const jalan = spawnSync('python', ['scripts/hapus-komentar-python.py', ...py], { cwd: AKAR, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const baris = (jalan.stdout || '').split('\n').filter((b) => /^(SAMA|BEDA)\s/.test(b));
  cek(baris.length === py.length, `pemindai Python melaporkan setiap berkas (${baris.length}/${py.length})`, jalan.stderr?.slice(0, 300));
  const berkomentar = baris.filter((b) => !/komentar dibuang 0,/.test(b)).map((b) => b.split(/\s+/)[1]);
  cek(berkomentar.length === 0, `tak ada komentar penjelas di Python (${berkomentar.length} berkas berkomentar)`, berkomentar.slice(0, 15));
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

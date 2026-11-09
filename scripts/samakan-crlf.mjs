
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AKAR = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const arg = process.argv.slice(2);
const SEMUA = arg.includes('--semua');
const PERIKSA_SAJA = arg.includes('--periksa');

function daftarBerkas() {
  if (SEMUA) {
    return execFileSync('git', ['ls-files', '-z'], { cwd: AKAR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0').filter(Boolean);
  }
  return execFileSync('git', ['status', '--porcelain', '-z'], { cwd: AKAR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean)
    .map((baris) => baris.slice(3))
    .filter(Boolean);
}

export function tampakBiner(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export function keCRLF(teks) {
  let diubah = 0;
  const hasil = String(teks).replace(/\r?\n/g, (m) => {
    if (m === '\n') diubah++;
    return '\r\n';
  });
  return { teks: hasil, diubah };
}

function utama() {
  const berkas = daftarBerkas();
  let disamakan = 0;
  let dilewati = 0;

  for (const rel of berkas) {
    const alamat = path.join(AKAR, rel);
    let st;
    try { st = statSync(alamat); } catch { continue; }
    if (!st.isFile()) continue;

    const buf = readFileSync(alamat);
    if (tampakBiner(buf)) { dilewati++; continue; }

    const asli = buf.toString('utf8');
    const { teks, diubah } = keCRLF(asli);
    if (!diubah) continue;

    if (!PERIKSA_SAJA) writeFileSync(alamat, teks, 'utf8');
    console.log(`${PERIKSA_SAJA ? 'PERLU CRLF' : 'CRLF dipulihkan'}: ${rel} (${diubah} baris)`);
    disamakan++;
  }

  const kata = PERIKSA_SAJA ? 'perlu disamakan' : 'disamakan dengan hasil checkout';
  console.log(`\n${disamakan} berkas ${kata}.${dilewati ? ` ${dilewati} biner dilewati.` : ''}`);
  process.exit(PERIKSA_SAJA && disamakan ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) utama();

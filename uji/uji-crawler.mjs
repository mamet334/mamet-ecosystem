// UJI 2026-10-23 — Ecosystem Crawler di capability/ecosystem-crawler/ (Item 129 Tahap A).
//
// Crawler adalah paket Python yang disalin dari folder asalnya beserta `.venv` (keputusan Owner: dependensi disalin,
// tidak diunduh ulang). Berkas ini menjalankan uji pytest crawler dari suite Mamet, dan menjaga satu jebakan
// penyalinan: `.venv` asal memasang crawler mode *editable* dan menyimpan alamat folder asal di beberapa tempat —
// bila tersisa, `import crawler` (dan `pip.exe`, `crawler-mcp.exe`) diam-diam memakai kode atau Python di folder asal.
//
// `.venv` tidak masuk repo (publik; .gitignore crawler) — di mesin tanpa `.venv` berkas ini DILEWATI, bukan gagal.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CRAWLER = path.join(AKAR, 'capability', 'ecosystem-crawler');
const VENV = path.join(CRAWLER, '.venv');
const PYTHON = path.join(VENV, 'Scripts', 'python.exe');
// Folder asal sebelum disalin. Dipakai hanya sebagai pola yang TIDAK boleh muncul di .venv salinan.
const ALAMAT_ASAL = /ecosystem crawler/i;

console.log('uji-crawler v1');
if (!existsSync(PYTHON)) {
  console.log(`DILEWATI — ${path.relative(AKAR, PYTHON)} tidak ada di mesin ini (.venv tidak masuk repo)`);
  process.exit(0);
}

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};

/** Berkas di .venv yang dibaca Python atau Windows saat menjalankan sesuatu — tempat alamat lama bisa bersembunyi. */
export function berkasRawan(venv) {
  const hasil = [path.join(venv, 'pyvenv.cfg')];
  const scripts = path.join(venv, 'Scripts');
  for (const n of readdirSync(scripts)) {
    const p = path.join(scripts, n);
    if (statSync(p).isFile()) hasil.push(p);
  }
  const site = path.join(venv, 'Lib', 'site-packages');
  for (const n of readdirSync(site)) {
    const p = path.join(site, n);
    if (statSync(p).isFile() && /\.(pth|py)$/i.test(n)) hasil.push(p);           // .pth & finder editable
    if (/\.dist-info$/i.test(n) && existsSync(path.join(p, 'direct_url.json'))) hasil.push(path.join(p, 'direct_url.json'));
  }
  return hasil;
}

export function memuatAlamatAsal(berkas) {
  return berkas.filter((p) => ALAMAT_ASAL.test(readFileSync(p).toString('latin1')));
}

console.log('\n-- 1. .venv salinan tidak lagi menunjuk folder asal --');
const rawan = berkasRawan(VENV);
const tercemar = memuatAlamatAsal(rawan);
cek(rawan.length > 5, `berkas rawan terbaca (${rawan.length})`);
cek(tercemar.length === 0, 'tak ada alamat folder asal di pyvenv.cfg, Scripts\\, .pth, finder, direct_url.json',
  tercemar.map((p) => path.relative(CRAWLER, p)));
cek(!readdirSync(path.join(VENV, 'Lib', 'site-packages')).some((n) => /^__editable__.*ecosystem_crawler/i.test(n)),
  'pemasangan editable crawler sudah dicabut — paket dimuat dari folder kerja');

console.log('\n-- 2. pytest crawler (dijalankan dari capability/ecosystem-crawler/) --');
const r = spawnSync(PYTHON, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider'], {
  cwd: CRAWLER, encoding: 'utf8', timeout: 110000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
const ringkas = (r.stdout || '').trim().split('\n').pop();
cek(r.status === 0, `pytest lulus: ${ringkas}`, (r.stdout || '') + (r.stderr || ''));
cek(/\b\d+ passed\b/.test(ringkas || '') && !/failed|error/i.test(ringkas || ''), 'ringkasan pytest berisi "passed" tanpa gagal/galat', ringkas);

console.log('\n-- 3. kendali: pemindai bisa merah --');
const contoh = path.join(VENV, 'pyvenv.cfg');
cek(ALAMAT_ASAL.test('home = D:\\SLAMET\\other\\ecosystem crawler\\.venv'), 'pola menangkap alamat folder asal');
cek(!ALAMAT_ASAL.test(CRAWLER), 'pola TIDAK menangkap alamat folder baru (ecosystem-crawler, bertanda hubung)');
cek(rawan.includes(contoh), 'pyvenv.cfg termasuk berkas yang dipindai');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

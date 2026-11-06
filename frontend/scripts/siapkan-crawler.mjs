import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AKAR_REPO = path.resolve(FRONTEND, '..');
const CRAWLER = path.join(AKAR_REPO, 'capability', 'ecosystem-crawler');
const VENV = path.join(CRAWLER, '.venv');
export const TUJUAN = path.join(FRONTEND, 'build', 'crawler-runtime');

const PYTHON_LEWATI = [
  /^lib\/site-packages(\/|$)/, /^lib\/test(\/|$)/, /^lib\/idlelib(\/|$)/, /^lib\/tkinter(\/|$)/, /^lib\/turtledemo(\/|$)/,
  /^lib\/ensurepip(\/|$)/, /^lib\/lib2to3(\/|$)/, /^lib\/venv(\/|$)/, /^doc(\/|$)/, /^tcl(\/|$)/, /^include(\/|$)/,
  /^libs(\/|$)/, /^scripts(\/|$)/, /^tools(\/|$)/, /^share(\/|$)/, /(^|\/)__pycache__(\/|$)/,
  /^dlls\/(_tkinter\.pyd|tcl86t\.dll|tk86t\.dll)$/, /^news\.txt$/,
];
const PAKET_LEWATI = [
  /^playwright(\/|$)/, /^playwright-[^/]*\.dist-info(\/|$)/, /^patchright(\/|$)/, /^patchright-[^/]*\.dist-info(\/|$)/,
  /^_?pytest(\/|$)/, /^pytest-[^/]*\.dist-info(\/|$)/, /^py\.py$/,
  /^__editable__/, /^ecosystem_crawler-[^/]*\.dist-info(\/|$)/, /(^|\/)__pycache__(\/|$)/,
];
const KODE_LEWATI = [/(^|\/)__pycache__(\/|$)/, /\.pyc$/];

const rel = (akar, p) => path.relative(akar, p).split(path.sep).join('/').toLowerCase();
export const lewatiPython = (r) => PYTHON_LEWATI.some((p) => p.test(r));
export const lewatiPaket = (r) => PAKET_LEWATI.some((p) => p.test(r));
export const lewatiKode = (r) => KODE_LEWATI.some((p) => p.test(r));

export function salinTersaring(asal, tujuan, lewati) {
  const tautan = [];
  const jalan = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = rel(asal, p);
      if (lewati(r)) continue;
      const t = path.join(tujuan, path.relative(asal, p));
      if (e.isSymbolicLink()) tautan.push(r);
      else if (e.isDirectory()) { fs.mkdirSync(t, { recursive: true }); jalan(p); }
      else if (e.isFile()) fs.copyFileSync(p, t);
    }
  };
  fs.mkdirSync(tujuan, { recursive: true });
  jalan(asal);
  return { tautan };
}

function ukuranMB(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) n += fs.statSync(path.join(e.parentPath ?? e.path, e.name)).size;
  }
  return Math.round(n / 1024 / 1024);
}

export function lisensiDari(metadata) {
  const kepala = String(metadata).split(/\r?\n\r?\n/)[0];
  const ambil = (nama) => kepala.match(new RegExp(`^${nama}:[ \\t]*(.+)$`, 'mi'))?.[1]?.trim();
  const ekspresi = ambil('License-Expression');
  if (ekspresi) return ekspresi;
  const lisensi = ambil('License');
  const lanjut = new RegExp('^License:.*\\r?\\n[ \\t]+\\S', 'mi').test(kepala);
  if (lisensi && lisensi.length <= 60 && !lanjut && !/^unknown$/i.test(lisensi)) return lisensi;
  const klas = [...kepala.matchAll(/^Classifier:\s*License :: (.+)$/gmi)].map((m) => m[1].split('::').pop().trim()).pop();
  return klas || null;
}

export function daftarPaket(sitePackages) {
  return fs.readdirSync(sitePackages).filter((n) => n.endsWith('.dist-info')).map((n) => {
    const metadata = fs.readFileSync(path.join(sitePackages, n, 'METADATA'), 'utf8');
    const kepala = metadata.split(/\r?\n\r?\n/)[0];
    return {
      nama: kepala.match(/^Name:\s*(.+)$/m)?.[1]?.trim() || n,
      versi: kepala.match(/^Version:\s*(.+)$/m)?.[1]?.trim() || null,
      lisensi: lisensiDari(metadata),
    };
  }).sort((a, b) => a.nama.toLowerCase().localeCompare(b.nama.toLowerCase()));
}

export function periksaPythonTerbundel(folderPython) {
  const isi = fs.existsSync(folderPython) ? fs.readdirSync(folderPython).map((n) => n.toLowerCase()) : [];
  const hilang = ['python.exe', 'vcruntime140.dll', 'vcruntime140_1.dll'].filter((n) => !isi.includes(n));
  if (!isi.some((n) => /^python3\d+\.dll$/.test(n))) hilang.push('python3XX.dll');
  return hilang;
}

export function pythonDasar(venv = VENV) {
  const cfg = fs.readFileSync(path.join(venv, 'pyvenv.cfg'), 'utf8');
  const home = cfg.match(/^home\s*=\s*(.+)$/m)?.[1]?.trim();
  if (!home || !fs.existsSync(path.join(home, 'python.exe'))) throw new Error(`Python dasar tidak ditemukan (pyvenv.cfg home = ${home})`);
  return home;
}

export function kompilasiBytecode(tujuan) {
  const r = spawnSync(path.join(tujuan, 'python', 'python.exe'), ['-m', 'compileall', '-q', '-j', '0', '--invalidation-mode', 'unchecked-hash',
    path.join(tujuan, 'python', 'Lib'), path.join(tujuan, 'crawler')], {
    encoding: 'utf8', timeout: 900000, env: { SystemRoot: process.env.SystemRoot, TEMP: os.tmpdir(), TMP: os.tmpdir(), PYTHONUTF8: '1' },
  });
  if (r.status !== 0) throw new Error(`compileall gagal (kode ${r.status}): ${(r.stdout + r.stderr || r.error?.message || '').slice(-1500)}`);
}

export function tanpaBytecode(dirs, tag) {
  const hilang = [];
  const jalan = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__pycache__') jalan(p); }
      else if (e.isFile() && e.name.endsWith('.py') && !fs.existsSync(path.join(d, '__pycache__', `${e.name.slice(0, -3)}.${tag}.pyc`))) hilang.push(p);
    }
  };
  for (const d of dirs) jalan(d);
  return hilang;
}

function ujiJabatTangan(tujuan) {
  const dataUji = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-runtime-uji-'));
  const skrip = String.raw`
import json, subprocess, sys
p = subprocess.Popen([sys.argv[1], "-m", "crawler.wajah.mcp_server"], cwd=sys.argv[2], stdin=subprocess.PIPE,
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8")
def k(o): p.stdin.write(json.dumps(o) + "\n"); p.stdin.flush()
def t(): return json.loads(p.stdout.readline())
k({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"siapkan","version":"0"}}})
t(); k({"jsonrpc":"2.0","method":"notifications/initialized"})
k({"jsonrpc":"2.0","id":2,"method":"tools/list"}); alat = [x["name"] for x in t()["result"]["tools"]]
k({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"katalog","arguments":{}}})
kat = json.loads(t()["result"]["content"][0]["text"])
p.stdin.close(); p.wait(timeout=30)
print(json.dumps({"alat": alat, "sumber": len(kat["sumber"]), "siap": sum(1 for s in kat["sumber"] if s["aktif"] and s["kesehatan"] == "siap"), "akses": kat["akses"]}))
`;
  const python = path.join(tujuan, 'python', 'python.exe');
  const r = spawnSync(python, ['-c', skrip, python, tujuan], {
    encoding: 'utf8', timeout: 120000,
    env: { SystemRoot: process.env.SystemRoot, TEMP: os.tmpdir(), TMP: os.tmpdir(), PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', CRAWLER_ROOT: dataUji },
  });
  if (r.status !== 0) throw new Error(`jabat tangan gagal: ${(r.stderr || r.stdout || r.error?.message || '').slice(-800)}`);
  return { ...JSON.parse(r.stdout.trim().split('\n').pop()), dataUji };
}

export function bersihkanPaketLewati(spBundel) {
  const dibuang = fs.readdirSync(spBundel).filter((n) => lewatiPaket(n.toLowerCase()) || lewatiPaket(`${n.toLowerCase()}/`));
  for (const n of dibuang) fs.rmSync(path.join(spBundel, n), { recursive: true, force: true });
  return dibuang;
}

function ujiStealthTakTerbundel(tujuan) {
  const python = path.join(tujuan, 'python', 'python.exe');
  const env = { SystemRoot: process.env.SystemRoot, PYTHONDONTWRITEBYTECODE: '1' };
  const r = spawnSync(python, ['-c', 'from scrapling.fetchers import StealthyFetcher'], { encoding: 'utf8', cwd: tujuan, timeout: 60000, env });
  const hasil = { tidakAda: r.status !== 0, importError: /ImportError|ModuleNotFoundError/.test(r.stderr || '') };
  if (!hasil.tidakAda) {
    const d = spawnSync(python, ['-c', "import importlib.util as u, sys; s = u.find_spec('patchright'); print(s and s.origin); print(sys.path)"],
      { encoding: 'utf8', cwd: tujuan, timeout: 60000, env });
    hasil.asal = `${d.stdout || ''}${d.stderr || ''}`.trim().slice(-1500);
  }
  return hasil;
}

export function siapkan({ tujuan = TUJUAN, log = console.log } = {}) {
  if (!fs.existsSync(path.join(VENV, 'pyvenv.cfg'))) throw new Error(`.venv crawler tidak ada: ${VENV}`);
  const dasar = pythonDasar();
  const sitePackages = path.join(VENV, 'Lib', 'site-packages');
  fs.rmSync(tujuan, { recursive: true, force: true });
  log(`[crawler] Python dasar: ${dasar}`);
  const tautan = salinTersaring(dasar, path.join(tujuan, 'python'), lewatiPython).tautan;
  const hilang = periksaPythonTerbundel(path.join(tujuan, 'python'));
  if (hilang.length) throw new Error(`Python dasar tidak lengkap untuk PC bersih — tidak ada: ${hilang.join(', ')} (di ${dasar})`);
  log('[crawler] paket crawler (tanpa penggerak stealth & pytest; pip ikut)');
  tautan.push(...salinTersaring(sitePackages, path.join(tujuan, 'python', 'Lib', 'site-packages'), lewatiPaket).tautan);
  const tersisa = bersihkanPaketLewati(path.join(tujuan, 'python', 'Lib', 'site-packages'));
  if (tersisa.length) log(`[crawler] dibersihkan sesudah salin (lolos filter): ${tersisa.join(', ')}`);
  log('[crawler] kode crawler');
  tautan.push(...salinTersaring(path.join(CRAWLER, 'crawler'), path.join(tujuan, 'crawler'), lewatiKode).tautan);
  if (tautan.length) log(`[crawler] tautan (symlink/junction) tidak disalin: ${tautan.join(', ')}`);
  const versiPatchright = fs.readdirSync(sitePackages).map((n) => n.match(/^patchright-(\d+\.\d+\.\d+)\.dist-info$/)?.[1]).find(Boolean);
  if (!versiPatchright) throw new Error('patchright tidak ada di .venv crawler — versi komponen stealth tak bisa dikunci');
  fs.writeFileSync(path.join(tujuan, 'stealth.json'), JSON.stringify({ paket: `patchright==${versiPatchright}`, browser: 'chromium' }, null, 2));
  fs.writeFileSync(path.join(tujuan, 'BACA.txt'), [
    'Runtime Ecosystem Crawler untuk Mamet AI (dibuat scripts/siapkan-crawler.mjs).',
    'Data, .env, dan hasil crawler ada di %APPDATA%\\ai-agent-frontend\\crawler — bukan di sini.',
    'Komponen stealth (Patchright + browser) tidak dibundel (keputusan Owner K14); dipasang atas izin Owner dari',
    'Settings > Konektor ke %APPDATA%\\ai-agent-frontend\\crawler\\stealth (versi terkunci di stealth.json).',
    'Daftar isi bundel ini: komponen.json — juga tampil di Settings > Konektor, "Yang terpasang di perangkat ini".',
  ].join('\r\n'));

  const versiPython = fs.readFileSync(path.join(VENV, 'pyvenv.cfg'), 'utf8').match(/^version(?:_info)?\s*=\s*(.+)$/m)?.[1]?.trim() || null;
  const tag = `cpython-${(versiPython || '').split('.').slice(0, 2).join('')}`;
  log(`[crawler] kompilasi bytecode (${tag})`);
  kompilasiBytecode(tujuan);
  const tanpa = tanpaBytecode([path.join(tujuan, 'python', 'Lib'), path.join(tujuan, 'crawler')], tag);
  if (tanpa.length) throw new Error(`${tanpa.length} berkas .py tanpa bytecode ${tag}, mis. ${tanpa.slice(0, 5).join(', ')}`);

  const mulai = Date.now();
  const j = ujiJabatTangan(tujuan);
  const detikJabat = (Date.now() - mulai) / 1000;
  if (j.alat.length !== 6 || j.sumber < 16) throw new Error(`hasil jabat tangan tak lengkap: ${JSON.stringify(j)}`);
  const s = ujiStealthTakTerbundel(tujuan);
  if (!s.tidakAda || !s.importError) throw new Error(`komponen stealth tak terduga: ${JSON.stringify(s)}`);
  const paket = daftarPaket(path.join(tujuan, 'python', 'Lib', 'site-packages'));
  const versiCrawler = fs.readFileSync(path.join(CRAWLER, 'pyproject.toml'), 'utf8').match(/^version\s*=\s*"([^"]+)"/m)?.[1] || null;
  fs.writeFileSync(path.join(tujuan, 'komponen.json'), JSON.stringify({
    dibuat: new Date().toISOString(), python: versiPython, crawler: { nama: 'Ecosystem Crawler', versi: versiCrawler }, paket,
  }, null, 2));
  const hasil = { mb: ukuranMB(tujuan), alat: j.alat.length, sumber: j.sumber, siap: j.siap, paket: paket.length, detikJabat, stealthTerbundel: false };
  log(`[crawler] siap: ${hasil.mb} MB · ${hasil.alat} alat · ${hasil.sumber} sumber (${hasil.siap} siap) · ${hasil.paket} paket · jabat tangan ${detikJabat.toFixed(1)} s · stealth tidak terbundel`);
  fs.rmSync(j.dataUji, { recursive: true, force: true });
  return hasil;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { siapkan(); } catch (e) { console.error(`[crawler] GAGAL: ${e.message}`); process.exitCode = 1; }
}

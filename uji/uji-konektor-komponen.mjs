// UJI 2026-10-26 — "Yang terpasang di perangkat ini" (Item 129 Tahap E3): electron/komponenKonektor.cjs,
// daftar isi bundel di scripts/siapkan-crawler.mjs, IPC konektor:komponen & konektor:buka-folder.
//
// Keputusan Owner: crawler tetap satu bundel, stealth tetap dipasang saat dibutuhkan (K14), semua yang terpasang
// TRANSPARAN. Yang dijaga:
//   - lisensi dibaca dari metadata paket, tidak ditebak (kosong → null → "tidak tercantum");
//   - ukuran = folder yang benar-benar ada; data crawler TIDAK menghitung subfolder stealth dua kali;
//   - revisi browser dibaca dari browsers.json Patchright, nama folder `<nama_>-<revisi>`;
//   - "Buka folder" hanya membuka folder dari daftar (kunci, bukan alamat dari layar);
//   - bagian 5: runtime terbundel sungguhan memuat komponen.json yang cocok dengan isi site-packages-nya.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const KK = require(path.join(AKAR, 'frontend', 'electron', 'komponenKonektor.cjs'));
const K = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));
const S = await import(pathToFileURL(path.join(AKAR, 'frontend', 'scripts', 'siapkan-crawler.mjs')).href);

console.log('uji-konektor-komponen v4');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};
const sementara = (awal) => mkdtempSync(path.join(os.tmpdir(), awal));
const tulis = (p, isi) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, isi); };
const MB = (n) => Buffer.alloc(n * 1024 * 1024);

// ── 1. Lisensi dari METADATA ────────────────────────────────────────────────────────────────
console.log('\n-- 1. lisensi --');
cek(S.lisensiDari('Name: a\nLicense: MIT\nLicense-Expression: Apache-2.0\n\nbadan') === 'Apache-2.0', 'License-Expression didahulukan');
cek(S.lisensiDari('Name: a\nLicense: BSD-3-Clause\nClassifier: License :: OSI Approved :: MIT License\n') === 'BSD-3-Clause', 'License pendek dipakai sebelum Classifier');
cek(S.lisensiDari('Name: a\nLicense: Copyright (c) 2020 Seseorang\n        Permission is hereby granted, free of charge\nClassifier: License :: OSI Approved :: MIT License\n') === 'MIT License',
  'License berisi teks lisensi utuh (berlanjut) → Classifier');
cek(S.lisensiDari('Name: a\nLicense: UNKNOWN\nClassifier: License :: OSI Approved :: BSD License\n') === 'BSD License', 'License UNKNOWN → Classifier');
cek(S.lisensiDari('Name: a\nVersion: 1\n\nLicense: MIT di badan README\n') === null, 'tanpa lisensi di kepala → null (badan README tidak dibaca)');

const sp = sementara('sp-komponen-');
tulis(path.join(sp, 'zeta-1.0.dist-info', 'METADATA'), 'Name: zeta\nVersion: 1.0\nLicense-Expression: MIT\n');
tulis(path.join(sp, 'Alpha-2.1.dist-info', 'METADATA'), 'Name: Alpha\nVersion: 2.1\n');
tulis(path.join(sp, 'alpha', '__init__.py'), '');
const dp = S.daftarPaket(sp);
cek(dp.length === 2 && dp[0].nama === 'Alpha' && dp[1].nama === 'zeta', 'daftarPaket: hanya dist-info, urut abjad tanpa peduli huruf besar', dp);
cek(dp[0].versi === '2.1' && dp[0].lisensi === null && dp[1].lisensi === 'MIT', 'daftarPaket: versi & lisensi (kosong tetap null)', dp);

// ── 2. Mode pengembangan ────────────────────────────────────────────────────────────────────
console.log('\n-- 2. pengembangan --');
const repoCrawler = sementara('repo-crawler-');
const dev = await KK.bacaKomponen({ folderRepo: repoCrawler });
cek(dev.mode === 'pengembangan' && dev.bawaan.lokasi === path.join(repoCrawler, '.venv') && dev.stealth === null, 'npm run desktop → mode pengembangan, .venv repo, tanpa baris stealth', dev);
cek(KK.lokasiFolder('stealth', { folderRepo: repoCrawler }) === null && KK.lokasiFolder('browser', { folderRepo: repoCrawler }) === null,
  'pengembangan: folder stealth/browser tidak bisa dibuka (bukan milik pemasang)');

// ── 3. Aplikasi terpasang, stealth terpasang ────────────────────────────────────────────────
console.log('\n-- 3. terbundel --');
const runtime = sementara('rt-komponen-');
tulis(path.join(runtime, 'python', 'python.exe'), MB(2));
tulis(path.join(runtime, 'komponen.json'), JSON.stringify({ python: '3.12.10', crawler: { nama: 'Ecosystem Crawler', versi: '0.1.0' }, paket: [{ nama: 'mcp', versi: '2.3.0', lisensi: 'MIT' }] }));
const data = sementara('data-komponen-');
tulis(path.join(data, '.env'), MB(1));
const l = { akar: path.join(data, 'stealth'), paket: path.join(data, 'stealth', 'paket') };
tulis(path.join(l.paket, 'patchright', 'driver', 'package', 'browsers.json'), JSON.stringify({ browsers: [
  { name: 'chromium', revision: '1248', browserVersion: '156.0.8078.4' },
  { name: 'chromium-headless-shell', revision: '1248', browserVersion: '156.0.8078.4' },
  { name: 'firefox', revision: '1555' },
  { name: 'ffmpeg', revision: '1013' },
  { name: 'winldd', revision: '1007' },
] }));
tulis(path.join(l.paket, 'patchright', 'besar.bin'), MB(3));
tulis(path.join(l.akar, 'terpasang.json'), JSON.stringify({ paket: 'patchright==1.64.1', browser: 'chromium', waktu: '2026-10-26T00:00:00.000Z' }));
const lad = sementara('lad-komponen-');
tulis(path.join(lad, 'ms-playwright', 'chromium-1248', 'chrome.exe'), MB(4));
tulis(path.join(lad, 'ms-playwright', 'chromium_headless_shell-1248', 'shell.exe'), MB(2));
tulis(path.join(lad, 'ms-playwright', 'ffmpeg-1013', 'ffmpeg.exe'), MB(1));
const env = { LOCALAPPDATA: lad };

const t = await KK.bacaKomponen({ runtimeTerbundel: runtime, folderData: data, env });
cek(t.mode === 'terbundel' && t.bawaan.python === '3.12.10' && t.bawaan.paket?.[0]?.nama === 'mcp', 'bawaan: isi dari komponen.json', t.bawaan);
cek(t.bawaan.mb === 2, 'bawaan: ukuran diukur dari folder runtime', t.bawaan.mb);
cek(t.data.mb === 1, 'data: subfolder stealth TIDAK ikut dihitung (tak dihitung dua kali)', t.data);
cek(t.stealth.keadaan === 'terpasang' && t.stealth.paket === 'patchright==1.64.1', 'stealth: versi dari penanda terpasang.json', t.stealth);
const nama = t.stealth.browser.map((b) => b.nama);
cek(nama.join(',') === 'chromium,chromium-headless-shell,ffmpeg,winldd', 'browser: yang dipasang `install chromium` saja (firefox tidak)', nama);
cek(t.stealth.browser.find((b) => b.nama === 'chromium-headless-shell')?.ada === true, 'folder headless shell dikenali (chromium_headless_shell-1248)', t.stealth.browser);
cek(t.stealth.browser.find((b) => b.nama === 'winldd')?.ada === false, 'browser yang tak ada di disk ditandai ada:false (layar menyebutnya)', t.stealth.browser);
cek(t.stealth.mb === 3 + 4 + 2 + 1, 'stealth: ukuran = paket + browser yang benar-benar ada', t.stealth.mb);
cek(KK.akarBrowser({ PLAYWRIGHT_BROWSERS_PATH: 'X:\\b', LOCALAPPDATA: lad }) === 'X:\\b', 'PLAYWRIGHT_BROWSERS_PATH didahulukan (sama dengan patchright install)');

// ── 4. Keadaan lain ─────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. keadaan lain --');
const runtimeLama = sementara('rt-lama-');
const dataBaru = sementara('data-baru-');
const lama = await KK.bacaKomponen({ runtimeTerbundel: runtimeLama, folderData: dataBaru, env });
cek(lama.bawaan.paket === null && lama.bawaan.python === null, 'runtime tanpa komponen.json → daftar tidak tersedia (tidak dikarang)', lama.bawaan);
cek(lama.stealth.keadaan === 'belum' && lama.stealth.perkiraanMB === KK.PERKIRAAN_STEALTH_MB && lama.stealth.browser === undefined, 'stealth belum → perkiraan saja, tanpa daftar browser', lama.stealth);
cek(lama.data.mb === 0, 'folder data kosong → 0 MB', lama.data);
const hilang = await KK.bacaKomponen({ runtimeTerbundel: runtimeLama, folderData: path.join(dataBaru, 'tidak-ada'), env });
cek(hilang.data.mb === null, 'folder data belum ada → ukuran null (bukan 0 yang menyesatkan)', hilang.data);

// ── 5. Buka folder: hanya kunci yang dikenal & folder yang ada ─────────────────────────────
console.log('\n-- 5. buka folder --');
const o = { runtimeTerbundel: runtime, folderData: data, env };
cek(KK.lokasiFolder('bawaan', o) === runtime && KK.lokasiFolder('data', o) === data, 'bawaan & data → alamatnya');
cek(KK.lokasiFolder('stealth', o) === l.akar && KK.lokasiFolder('browser', o) === path.join(lad, 'ms-playwright'), 'stealth & browser → alamatnya');
cek(['C:\\Windows', '..', 'constructor', '__proto__', ''].every((k) => KK.lokasiFolder(k, o) === null), 'kunci asing / alamat mentah dari layar → ditolak');
cek(KK.lokasiFolder('stealth', { ...o, folderData: dataBaru }) === null, 'folder yang belum ada → null (bukan membuka folder kosong)');

// ── 6. Pengelola & sambungan ────────────────────────────────────────────────────────────────
console.log('\n-- 6. sambungan --');
const p = K.buatPengelolaKonektor({ akarRepo: AKAR, runtimeTerbundel: runtime, folderData: data });
cek((await p.komponen('bukan-konektor')).ok === false, 'pengelola.komponen: konektor tak dikenal ditolak');
cek(p.lokasiFolder('bukan-konektor', 'data') === null && p.lokasiFolder('ecosystem-crawler', 'data') === data, 'pengelola.lokasiFolder: lewat konektor yang dikenal');
const main = readFileSync(path.join(AKAR, 'frontend', 'electron', 'main.cjs'), 'utf8');
const pre = readFileSync(path.join(AKAR, 'frontend', 'electron', 'preload.cjs'), 'utf8');
const blokBuka = main.slice(main.indexOf("'konektor:buka-folder'"), main.indexOf("'konektor:buka-folder'") + 500);
cek(/\{\s*konektor,\s*kunci\s*\}/.test(blokBuka) && /lokasiFolder\(konektor, kunci\)/.test(blokBuka) && /shell\.openPath\(lokasi\)/.test(blokBuka),
  'IPC buka-folder: menerima kunci, alamat disusun proses utama, dibuka shell.openPath', blokBuka.slice(0, 300));
cek(/konektor:komponen/.test(main) && /komponen:\s*\(konektor\)/.test(pre) && /bukaFolder:\s*\(konektor, kunci\)/.test(pre), 'preload: komponen & bukaFolder');
cek(!/±300 MB/.test(main) && /±830 MB/.test(main), 'dialog stealth menyebut ruang disk terukur (±830 MB), bukan "±300 MB"');
// Koreksi 26 Okt (terlihat di 4.3.0 terpasang): folder data = <userData>\crawler = %APPDATA%\ai-agent-frontend\crawler —
// userData dinamai `name` package.json. Teks "%APPDATA%\Mamet AI\crawler" yang ditulis tangan salah; dialog kini
// menyusun alamat dari folder sebenarnya.
const namaPaket = JSON.parse(readFileSync(path.join(AKAR, 'frontend', 'package.json'), 'utf8')).name;
cek(namaPaket === 'ai-agent-frontend', `nama paket = nama folder userData (${namaPaket}) — bila diganti, setelan pengguna pindah folder`);
cek(/const FOLDER_DATA_CRAWLER = path\.join\(app\.getPath\('userData'\), 'crawler'\)/.test(main) && /folderData: FOLDER_DATA_CRAWLER/.test(main),
  'folder data crawler = userData\\crawler, satu sumber untuk pengelola & dialog');
const blokDialog = main.slice(main.indexOf("'konektor:pasang-stealth'"), main.indexOf("'konektor:pasang-stealth'") + 1500);
cek(/path\.join\(FOLDER_DATA_CRAWLER, 'stealth'\)/.test(blokDialog) && /akarBrowser\(\)/.test(blokDialog), 'dialog stealth menyusun alamat dari folder sebenarnya');
const kodeSalah = ['frontend/electron/main.cjs', 'frontend/electron/konektorMcp.cjs', 'frontend/electron/komponenKonektor.cjs', 'frontend/electron/stealthKonektor.cjs', 'frontend/scripts/siapkan-crawler.mjs']
  .filter((f) => /Mamet AI\\{1,2}crawler/.test(readFileSync(path.join(AKAR, f), 'utf8')));
cek(kodeSalah.length === 0, 'tak ada lagi alamat "%APPDATA%\\Mamet AI\\crawler" di kode konektor', kodeSalah);
const sk = readFileSync(path.join(AKAR, 'frontend', 'scripts', 'siapkan-crawler.mjs'), 'utf8');
cek(sk.indexOf("'komponen.json'") > sk.indexOf('ujiJabatTangan(tujuan)'), 'komponen.json ditulis SESUDAH bundel lulus uji jabat tangan');

// ── 7. Runtime terbundel sungguhan ──────────────────────────────────────────────────────────
console.log('\n-- 7. runtime sungguhan --');
const RT = path.join(AKAR, 'frontend', 'build', 'crawler-runtime');
if (!existsSync(path.join(RT, 'komponen.json'))) {
  console.log('DILEWATI bagian 7 — butuh build/crawler-runtime terbaru (npm run crawler:siapkan)');
} else {
  const m = JSON.parse(readFileSync(path.join(RT, 'komponen.json'), 'utf8'));
  const distInfo = readdirSync(path.join(RT, 'python', 'Lib', 'site-packages')).filter((n) => n.endsWith('.dist-info'));
  cek(m.paket.length === distInfo.length && m.paket.length > 50, `komponen.json memuat SETIAP paket bundel (${m.paket.length} = ${distInfo.length})`);
  cek(m.paket.every((x) => x.nama && x.versi), 'setiap paket punya nama & versi');
  cek(!m.paket.some((x) => /^(playwright|patchright|pytest)$/i.test(x.nama)), 'penggerak stealth & pytest tidak tercantum (memang tidak dibundel)');
  cek(/^3\.\d+\.\d+$/.test(m.python) && m.crawler?.versi, 'versi Python & crawler tercatat', { python: m.python, crawler: m.crawler });
  const nyata = await KK.bacaKomponen({ runtimeTerbundel: RT, folderData: sementara('data-nyata-') });
  cek(nyata.bawaan.mb > 100 && nyata.bawaan.paket.length === m.paket.length, `ukuran bundel terukur: ${nyata.bawaan.mb} MB`, nyata.bawaan.mb);
}

// ── 8. Jalur build GitHub (rilis 4.3.0) ─────────────────────────────────────────────────────
// Mesin build tak punya .venv (tidak di-commit): build.yml membangunnya dari requirements-bundel.txt. Yang dijaga:
// daftar itu memuat setiap paket bundel dengan versi yang sama, Python di build.yml = Python .venv, dan Python
// terbundel membawa pustaka C++-nya sendiri (PC bersih).
console.log('\n-- 8. jalur build --');
const pyKosong = sementara('py-terbundel-');
cek(S.periksaPythonTerbundel(pyKosong).join(',') === 'python.exe,vcruntime140.dll,vcruntime140_1.dll,python3XX.dll', 'Python terbundel kosong → semua berkas wajib disebut hilang', S.periksaPythonTerbundel(pyKosong));
for (const n of ['python.exe', 'python312.dll', 'VCRUNTIME140.dll']) writeFileSync(path.join(pyKosong, n), '');
cek(S.periksaPythonTerbundel(pyKosong).join(',') === 'vcruntime140_1.dll', 'tanpa vcruntime140_1.dll → build ditolak (nama tak peka huruf besar)', S.periksaPythonTerbundel(pyKosong));
const sumberSiap = readFileSync(path.join(AKAR, 'frontend', 'scripts', 'siapkan-crawler.mjs'), 'utf8');
cek(/const hilang = periksaPythonTerbundel\(path\.join\(tujuan, 'python'\)\);\s*\n\s*if \(hilang\.length\) throw/.test(sumberSiap), 'siapkan memanggil pemeriksaan itu dan GAGAL bila ada yang hilang');

// Build GitHub 4.3.0 (Node 20) lolos membawa komponen stealth meski filter salinan membuangnya di laptop (Node 24):
// sesudah salin, paket yang dibuang dibersihkan langsung dari site-packages bundel.
const spBundel = sementara('sp-bundel-');
for (const n of ['patchright', 'Patchright-1.64.1.dist-info', 'playwright', '_pytest', 'scrapling', 'mcp-2.3.0.dist-info']) mkdirSync(path.join(spBundel, n));
const dibuang = S.bersihkanPaketLewati(spBundel).sort();
cek(dibuang.join(',') === 'Patchright-1.64.1.dist-info,_pytest,patchright,playwright' && readdirSync(spBundel).sort().join(',') === 'mcp-2.3.0.dist-info,scrapling',
  'bersihkanPaketLewati: penggerak stealth & pytest dibuang (tak peka huruf besar), paket kerja tetap', { dibuang, sisa: readdirSync(spBundel) });
cek(/bersihkanPaketLewati\(path\.join\(tujuan, 'python', 'Lib', 'site-packages'\)\)/.test(sumberSiap), 'siapkan membersihkan site-packages bundel sesudah salin');

// Build GitHub 4.3.0 kedua: filter fs.cpSync (Node 20) tak diterapkan & symlink python3.exe ikut tersalin → 7-Zip
// pemasang gagal. Penyiap kini memakai penjalan sendiri: aturan buang diterapkan di setiap tingkat, tautan dilewati.
const asalSalin = sementara('salin-asal-');
tulis(path.join(asalSalin, 'python.exe'), 'x');
tulis(path.join(asalSalin, 'Scripts', 'pipx.exe'), 'x');
tulis(path.join(asalSalin, 'Lib', 'os.py'), 'x');
tulis(path.join(asalSalin, 'Lib', 'json', '__pycache__', 'a.pyc'), 'x');
tulis(path.join(asalSalin, 'Lib', 'site-packages', 'pipx', 'x.py'), 'x');
mkdirSync(path.join(asalSalin, 'sasaran-tautan'));
symlinkSync(path.join(asalSalin, 'sasaran-tautan'), path.join(asalSalin, 'tautan'), 'junction');
const tujuanSalin = path.join(sementara('salin-tujuan-'), 'python');
const hs = S.salinTersaring(asalSalin, tujuanSalin, S.lewatiPython);
const ada = (r) => existsSync(path.join(tujuanSalin, r));
cek(ada('python.exe') && ada('Lib/os.py') && ada('sasaran-tautan'), 'salinTersaring: berkas & folder biasa tersalin');
cek(!ada('Scripts') && !ada('Lib/site-packages') && !ada('Lib/json/__pycache__'), 'salinTersaring: aturan buang diterapkan di setiap tingkat (Scripts, site-packages global, __pycache__)');
cek(!ada('tautan') && hs.tautan.join(',') === 'tautan', 'salinTersaring: symlink/junction TIDAK disalin & dilaporkan', hs);
cek(!/fs\.cpSync\(/.test(sumberSiap), 'siapkan tidak lagi memakai fs.cpSync (filternya tak diterapkan di Node 20)');

const CRAWLER = path.join(AKAR, 'capability', 'ecosystem-crawler');
const kunciTeks = readFileSync(path.join(CRAWLER, 'requirements-bundel.txt'), 'utf8');
const normal = (n) => n.toLowerCase().replace(/[-_.]+/g, '-');
const kunci = new Map(kunciTeks.split(/\r?\n/).filter((b) => b && !b.startsWith('#')).map((b) => {
  const [n, v] = b.split('=='); return [normal(n), v];
}));
cek([...kunci.values()].every((v) => v && /^\S+$/.test(v)), `setiap baris requirements-bundel.txt berversi pasti (${kunci.size} paket)`);
const yml = readFileSync(path.join(AKAR, '.github', 'workflows', 'build.yml'), 'utf8');
cek(/--no-deps[^\n]*-r requirements-bundel\.txt/.test(yml) && /working-directory: \.\/capability\/ecosystem-crawler/.test(yml), 'build.yml memasang daftar terkunci dengan --no-deps di folder crawler');
cek(yml.indexOf('requirements-bundel.txt') < yml.indexOf('npm run dist:publish'), '.venv dibangun SEBELUM npm run dist:publish');
const pyYml = yml.match(/python-version: '([^']+)'/)?.[1];
if (!existsSync(path.join(CRAWLER, '.venv', 'pyvenv.cfg'))) {
  console.log('DILEWATI pencocokan .venv — .venv crawler tidak ada di mesin ini');
} else {
  const pyVenv = readFileSync(path.join(CRAWLER, '.venv', 'pyvenv.cfg'), 'utf8').match(/^version\s*=\s*(.+)$/m)?.[1]?.trim();
  cek(pyYml === pyVenv, `Python build.yml = Python .venv (${pyYml} = ${pyVenv})`);
  const sp = path.join(CRAWLER, '.venv', 'Lib', 'site-packages');
  const beda = S.daftarPaket(sp).filter((p) => kunci.get(normal(p.nama)) !== p.versi).map((p) => `${p.nama} ${p.versi}≠${kunci.get(normal(p.nama))}`);
  cek(beda.length === 0, 'setiap paket .venv tercantum di daftar kunci dengan versi yang sama', beda);
}
if (existsSync(path.join(RT, 'komponen.json'))) {
  const m = JSON.parse(readFileSync(path.join(RT, 'komponen.json'), 'utf8'));
  const takTerkunci = m.paket.filter((p) => kunci.get(normal(p.nama)) !== p.versi).map((p) => p.nama);
  cek(takTerkunci.length === 0, 'setiap paket bundel ada di daftar kunci dengan versi yang sama', takTerkunci);
  const st = JSON.parse(readFileSync(path.join(RT, 'stealth.json'), 'utf8'));
  cek(st.paket === `patchright==${kunci.get('patchright')}`, `versi stealth.json = versi patchright di daftar kunci (${st.paket})`);
  cek(S.periksaPythonTerbundel(path.join(RT, 'python')).length === 0, 'runtime terbundel sungguhan membawa python.exe, python3XX.dll, vcruntime140(_1).dll');
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exitCode = gagal === 0 ? 0 : 1;

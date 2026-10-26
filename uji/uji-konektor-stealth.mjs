// UJI 2026-10-26 — komponen tingkat stealth crawler (Item 129 Tahap E2): electron/stealthKonektor.cjs + sambungannya.
//
// K14 (keputusan Owner): komponen stealth tidak dibundel; dipasang atas izin Owner. Yang dijaga:
//   - penanda "terpasang" ditulis HANYA sesudah pip, browser, dan uji impor berhasil; gagal → tak ada sisa;
//   - urutan & argumen langkah persis (paket terkunci, --target folder sementara, --no-deps, PYTHONPATH);
//   - crawler terpasang memuat paket lewat PYTHONPATH hanya bila terpasang;
//   - dialog persetujuan proses utama SEBELUM pemasangan;
//   - bagian 5: pemasangan nyata TANPA unduhan — langkah pip diganti salinan Patchright dari .venv, langkah browser
//     dan uji ASLI (Chromium 1248 sudah ada di laptop, jadi `patchright install` tidak mengunduh), lalu crawler dari
//     runtime terbundel benar-benar membuka halaman lewat StealthyFetcher.

import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const S = require(path.join(AKAR, 'frontend', 'electron', 'stealthKonektor.cjs'));
const K = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));

console.log('uji-konektor-stealth v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};
const sementara = (awal) => mkdtempSync(path.join(os.tmpdir(), awal));

/** Runtime palsu: python.exe kosong + stealth.json + kode crawler minimal. */
function runtimePalsu({ spek = true } = {}) {
  const r = sementara('rt-stealth-');
  mkdirSync(path.join(r, 'python'), { recursive: true });
  writeFileSync(path.join(r, 'python', 'python.exe'), '');
  mkdirSync(path.join(r, 'crawler', 'wajah'), { recursive: true });
  writeFileSync(path.join(r, 'crawler', 'wajah', 'mcp_server.py'), '');
  if (spek) writeFileSync(path.join(r, 'stealth.json'), JSON.stringify({ paket: 'patchright==1.64.1', browser: 'chromium' }));
  return r;
}

// ── 1. Keadaan ────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. keadaan komponen stealth --');
const dataA = sementara('data-st-');
cek(S.statusStealth({ terbundel: false, folderData: dataA }).keadaan === 'pengembangan', 'npm run desktop → "pengembangan" (sudah ada di .venv, tanpa tombol)');
cek(S.statusStealth({ terbundel: true, folderData: dataA }).keadaan === 'belum', 'terpasang tanpa penanda → "belum"');
mkdirSync(path.join(dataA, 'stealth', 'paket', 'patchright'), { recursive: true });
cek(S.statusStealth({ terbundel: true, folderData: dataA }).keadaan === 'belum', 'folder paket ada tapi TANPA penanda → tetap "belum" (pemasangan setengah jalan tidak dihitung)');
writeFileSync(path.join(dataA, 'stealth', 'terpasang.json'), '{rusak');
cek(S.statusStealth({ terbundel: true, folderData: dataA }).keadaan === 'belum', 'penanda rusak → "belum"');
writeFileSync(path.join(dataA, 'stealth', 'terpasang.json'), JSON.stringify({ paket: 'patchright==1.64.1', waktu: 'x' }));
const st = S.statusStealth({ terbundel: true, folderData: dataA });
cek(st.keadaan === 'terpasang' && st.folderPaket === path.join(dataA, 'stealth', 'paket'), 'penanda + paket → "terpasang"', st);

// ── 2. Pemasangan: urutan, argumen, penanda — penjalan tiruan ────────────────────────────────────────────────
console.log('\n-- 2. pemasangan (penjalan tiruan) --');
const rt = runtimePalsu();
const dataB = sementara('data-st-');
const dipanggil = [];
const tiruan = (hasilPer = {}) => async (program, argumen, opsi) => {
  const nama = argumen.includes('pip') ? 'pip' : argumen.includes('patchright') && argumen.includes('install') ? 'browser' : 'uji';
  dipanggil.push({ nama, program, argumen, opsi });
  if (nama === 'pip') { const t = argumen[argumen.indexOf('--target') + 1]; mkdirSync(path.join(t, 'patchright'), { recursive: true }); }
  return hasilPer[nama] || { kode: 0, keluaran: nama === 'uji' ? 'STEALTH-SIAP' : 'ok', habis: false };
};
const h = await S.pasangStealth({ runtime: rt, folderData: dataB, env: { PATH: 'x' }, jalankan: tiruan(), sekarang: () => 1000 });
cek(h.ok && h.paket === 'patchright==1.64.1', 'tiga langkah berhasil → terpasang', h);
cek(dipanggil.map((d) => d.nama).join(',') === 'pip,browser,uji', 'urutan: pip → browser → uji', dipanggil.map((d) => d.nama));
const pip = dipanggil[0];
const target = path.join(dataB, 'stealth', 'paket-1000');
cek(pip.program === path.join(rt, 'python', 'python.exe') && JSON.stringify(pip.argumen) === JSON.stringify(['-m', 'pip', 'install', '--target', target, '--no-deps', '--disable-pip-version-check', '--no-warn-script-location', '--no-input', 'patchright==1.64.1']),
  'pip: Python runtime terbundel, --target folder SEMENTARA, --no-deps, versi terkunci', pip.argumen);
cek(JSON.stringify(dipanggil[1].argumen) === JSON.stringify(['-m', 'patchright', 'install', 'chromium']) && dipanggil[1].opsi.env.PYTHONPATH === target,
  'browser: patchright install chromium dengan paket baru di PYTHONPATH', dipanggil[1]);
cek(/from scrapling\.fetchers import StealthyFetcher/.test(dipanggil[2].argumen.join(' ')) && dipanggil.every((d) => d.opsi.env.PATH === 'x' && !('OPENROUTER_API_KEY' in d.opsi.env)),
  'uji: impor StealthyFetcher; lingkungan = yang diberikan pemanggil (daftar putih)');
cek(S.statusStealth({ terbundel: true, folderData: dataB }).keadaan === 'terpasang' && !existsSync(target), 'sesudah berhasil: folder sementara → "paket", penanda tertulis');

for (const [langkah, hasilGagal, pola] of [
  ['pip', { kode: 1, keluaran: 'No matching distribution', habis: false }, /kode keluar 1/],
  ['browser', { kode: 0, keluaran: '', habis: true }, /batas waktu 30 menit/],
  ['uji', { kode: 0, keluaran: 'ImportError', habis: false }, /kode keluar 0/],
]) {
  const d = sementara('data-st-');
  dipanggil.length = 0;
  const g = await S.pasangStealth({ runtime: rt, folderData: d, env: {}, jalankan: tiruan({ [langkah]: hasilGagal }), sekarang: () => 2000 });
  const sisa = existsSync(path.join(d, 'stealth')) ? readdirSync(path.join(d, 'stealth')) : [];
  cek(!g.ok && g.langkah === langkah && pola.test(g.alasan) && sisa.length === 0 && S.statusStealth({ terbundel: true, folderData: d }).keadaan === 'belum',
    `gagal di langkah ${langkah} → tak ada penanda, tak ada sisa folder, alasan apa adanya`, { g, sisa });
}
cek((await S.pasangStealth({ runtime: runtimePalsu({ spek: false }), folderData: sementara('d-'), env: {}, jalankan: tiruan() })).langkah === 'persiapan',
  'runtime tanpa stealth.json (dibangun sebelum E2) → ditolak sebelum mengunduh apa pun');

// ── 3. Crawler terpasang memuat paket hanya bila terpasang ───────────────────────────────────────────────────
console.log('\n-- 3. PYTHONPATH crawler terpasang --');
const pBelum = K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: rt, folderData: sementara('d-') });
const pSudah = K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: rt, folderData: dataB });
cek(pBelum.ok && !('PYTHONPATH' in pBelum.env), 'belum terpasang → tanpa PYTHONPATH');
cek(pSudah.env.PYTHONPATH === path.join(dataB, 'stealth', 'paket'), 'terpasang → PYTHONPATH = folder paket stealth', pSudah.env.PYTHONPATH);
const mDev = K.buatPengelolaKonektor({ akarRepo: AKAR });
cek(!(await mDev.pasangStealth()).ok, 'npm run desktop → pasangStealth ditolak (stealth sudah di .venv)');
const sDev = mDev.status().find((x) => x.konektor === 'ecosystem-crawler');
cek(sDev.stealth?.keadaan === 'pengembangan' && sDev.stealth.folderPaket === undefined, 'status membawa keadaan stealth, tanpa alamat folder', sDev.stealth);
const mT = K.buatPengelolaKonektor({ akarRepo: AKAR, runtimeTerbundel: rt, folderData: sementara('d-') });
let nTiruan = 0;
const tiruanLambat = async (...a) => { nTiruan++; await new Promise((r) => setTimeout(r, 30)); return tiruan()(...a); };
const [a1, a2] = await Promise.all([mT.pasangStealth({ jalankan: tiruanLambat }), mT.pasangStealth({ jalankan: tiruanLambat })]);
cek(a1 === a2 && a1.ok && nTiruan === 3, 'tombol ditekan dua kali → SATU pemasangan (3 langkah, bukan 6)', { nTiruan });

// ── 4. Dialog proses utama sebelum pemasangan ────────────────────────────────────────────────────────────────
console.log('\n-- 4. dialog persetujuan --');
const main = readFileSync(path.join(AKAR, 'frontend', 'electron', 'main.cjs'), 'utf8');
const ipc = main.match(/ipcMain\.handle\('konektor:pasang-stealth'[\s\S]*?\n\}\);/)?.[0] || '';
cek(ipc.indexOf('dialog.showMessageBox') >= 0 && ipc.indexOf('dialog.showMessageBox') < ipc.indexOf('pengelolaKonektor.pasangStealth()'), 'dialog muncul SEBELUM pemasangan', ipc.slice(0, 200));
cek(/if \(response !== 1\) return \{ ok: false, ditolakOwner: true/.test(ipc) && /cancelId: 0/.test(ipc) && /defaultId: 0/.test(ipc), 'bawaan & Esc = Batal; batal → tidak memasang');
cek(/PyPI/.test(ipc) && /MB/.test(ipc) && /ms-playwright/.test(ipc), 'dialog menyebut sumber unduhan, ukuran, dan tujuan');
const pre = readFileSync(path.join(AKAR, 'frontend', 'electron', 'preload.cjs'), 'utf8');
cek(/pasangStealth: \(\) => ipcRenderer\.invoke\('konektor:pasang-stealth'\)/.test(pre), 'layar memanggil lewat IPC (tanpa argumen — layar tak bisa memilih paket/versi)');

// ── 5. Nyata tanpa unduhan ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. pemasangan nyata tanpa unduhan (Chromium 1248 sudah ada) --');
const RT = path.join(AKAR, 'frontend', 'build', 'crawler-runtime');
const venvPatchright = path.join(AKAR, 'capability', 'ecosystem-crawler', '.venv', 'Lib', 'site-packages', 'patchright');
const browserAda = existsSync(path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1248'));
if (!existsSync(path.join(RT, 'stealth.json')) || !existsSync(venvPatchright) || !browserAda) {
  console.log('DILEWATI bagian 5 — butuh build/crawler-runtime (npm run crawler:siapkan), .venv crawler, dan Chromium 1248 di laptop');
} else {
  const dataN = sementara('data-nyata-');
  const jalankanNyata = async (program, argumen, opsi) => {
    if (argumen.includes('pip')) {  // ganti unduhan PyPI dengan salinan dari .venv — versi sama (1.64.1)
      const t = argumen[argumen.indexOf('--target') + 1];
      for (const n of readdirSync(path.dirname(venvPatchright)).filter((x) => /^patchright(-1\.64\.1\.dist-info)?$/.test(x))) {
        cpSync(path.join(path.dirname(venvPatchright), n), path.join(t, n), { recursive: true });
      }
      return { kode: 0, keluaran: 'disalin dari .venv (tanpa unduhan)', habis: false };
    }
    return S.jalankanProses(program, argumen, opsi);
  };
  const env = { ...K.lingkunganServer() };
  const hn = await S.pasangStealth({ runtime: RT, folderData: dataN, env, jalankan: jalankanNyata });
  cek(hn.ok, `langkah browser & uji ASLI berhasil di runtime terbundel`, hn);
  const p = K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: RT, folderData: dataN });
  const ambil = spawnSync(p.command, ['-c', [
    'from crawler.kanal.web import AksesWeb',
    'from crawler import konfig',
    'a = AksesWeb(konfig.USER_AGENT)',
    'html, tingkat, url = a._stealth("https://example.com")',
    'print("TINGKAT", tingkat, "JUDUL", "Example Domain" in html)',
  ].join('\n')], { cwd: p.cwd, env: p.env, encoding: 'utf8', timeout: 240000 });
  cek(/TINGKAT 3 JUDUL True/.test(ambil.stdout || ''), 'crawler dari runtime terbundel membuka halaman lewat TINGKAT 3 (stealth) dengan paket terpasang',
    { keluar: ambil.status, ekor: `${ambil.stdout}${ambil.stderr}`.slice(-500) });
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exitCode = gagal === 0 ? 0 : 1;

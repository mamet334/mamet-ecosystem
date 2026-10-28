// UJI 2026-10-26 — komponen tingkat stealth crawler (Item 129 Tahap E2): electron/stealthKonektor.cjs + sambungannya.
//
// K14 (keputusan Owner): komponen stealth tidak dibundel; dipasang atas izin Owner. Yang dijaga:
//   - penanda "terpasang" ditulis HANYA sesudah pip, browser, dan uji impor berhasil; gagal → tak ada sisa;
//   - urutan & argumen langkah persis (paket terkunci, --target folder sementara, --no-deps, PYTHONPATH);
//   - crawler terpasang memuat paket lewat PYTHONPATH hanya bila terpasang;
//   - dialog persetujuan proses utama SEBELUM pemasangan;
//   - bagian 5: pemasangan nyata TANPA unduhan — langkah pip diganti tautan-keras Patchright dari .venv, langkah browser
//     dan uji ASLI (Chromium 1248 sudah ada di laptop, jadi `patchright install` tidak mengunduh), lalu crawler dari
//     runtime terbundel benar-benar membuka halaman lewat StealthyFetcher — halaman dari server HTTP lokal uji ini.
//
// BATAS-UJI-DETIK di bawah (dibaca uji/jalankan-semua.mjs). Terukur 2026-10-28 dengan halaman LOKAL (internet sudah
// tak ikut): StealthyFetcher meluncurkan Chromium dengan profil baru setiap kali — 14,6 s saat mesin tenang, 58–96 s
// saat mesin berat; Chromium mentah sekali 39 s hanya untuk meluncur. Itulah subjek yang diuji, jadi tak dibuang;
// 120 s bawaan tidak cukup untuk ekornya. Tenggat tiap langkah dipasang di bawah batas ini (bagian 5).
// BATAS-UJI-DETIK: 300

import { createRequire } from 'node:module';
import {
  copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batasBerkas } from './jalankan-semua.mjs';

const MULAI = Date.now();
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
// Semua folder sementara dihapus di akhir — sebelum 28 Okt tidak pernah, dan bagian 5 meninggalkan 109 MB per jalan.
const SISA = [];
const sementara = (awal, induk = os.tmpdir()) => { const d = mkdtempSync(path.join(induk, awal)); SISA.push(d); return d; };

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
// Kunci sesaat Windows saat folder sementara dipindah jadi `paket` (terukur 28 Okt di bagian 5: EPERM 2 dari 6 jalan).
// Sebelumnya renameSync MELEMPAR — pemanggil menerima pengecualian mentah dan folder sementara tertinggal.
{
  const fsCjs = require('fs');
  const renameAsli = fsCjs.renameSync;
  const galat = (code) => Object.assign(new Error(code), { code });
  try {
    let tolak = 2;
    fsCjs.renameSync = (...a) => { if (tolak-- > 0) throw galat('EPERM'); return renameAsli(...a); };
    const d = sementara('data-st-');
    const k = await S.pasangStealth({ runtime: rt, folderData: d, env: {}, jalankan: tiruan(), sekarang: () => 3000 });
    cek(k.ok && tolak < 0 && S.statusStealth({ terbundel: true, folderData: d }).keadaan === 'terpasang',
      'rename ditolak EPERM dua kali (berkas masih dipegang antivirus) → diulang, tetap terpasang', { k, tolak });
    fsCjs.renameSync = () => { throw galat('EXDEV'); };
    const d2 = sementara('data-st-');
    const k2 = await S.pasangStealth({ runtime: rt, folderData: d2, env: {}, jalankan: tiruan(), sekarang: () => 4000 });
    const sisa2 = readdirSync(path.join(d2, 'stealth'));
    cek(!k2.ok && k2.langkah === 'pindah' && /EXDEV/.test(k2.alasan) && sisa2.length === 0,
      'rename gagal yang bukan kunci sesaat → tidak melempar; gagal bersih tanpa sisa folder & tanpa penanda', { k2, sisa2 });
    fsCjs.renameSync = () => { throw galat('EPERM'); };
    const a = Date.now();
    const kode = await S.pindahkanFolder(sementara('d-'), path.join(sementara('d-'), 'x'), { batasMs: 300, jedaMs: 50 });
    cek(kode === 'EPERM' && Date.now() - a < 2000, 'kunci yang tak kunjung lepas → menyerah di batasnya, tidak menunggu selamanya', { kode, ms: Date.now() - a });
  } finally {
    fsCjs.renameSync = renameAsli;
  }
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

// ── 5. Nyata tanpa unduhan & tanpa internet ──────────────────────────────────────────────────────────────────
// Diukur 2026-10-28 — 35 s bila sendirian, sekali 207 s, dan dua kali dibunuh batas 120 s jalankan-semua:
//   - paket Patchright 109 MB (93 MB-nya driver node.exe) DISALIN ke TEMP ≈ 3 s, lalu Defender memindai node.exe
//     salinan baru itu saat pertama dijalankan ≈ 5–7 s; folder itu tak pernah dihapus (80 sisa, ±8,7 GB);
//   - halaman diambil dari https://example.com — internet sungguhan, 15–26 s, berayun bersama jaringan.
// Kini: paket DITAUT-KERAS dari .venv ke `.tmp/` repo (satu volume; isinya byte yang sama, jadi sama sahnya dengan
// salinan — beda volume → jatuh ke salinan; node.exe tertaut jalan dalam 60 ms, salinan baru 5–10 s), halaman dilayani
// server HTTP lokal yang MENCATAT permintaan yang datang (bukti Chromium sungguh membukanya), dan tiap langkah
// bertenggat di bawah BATAS-UJI-DETIK: bila lambat, uji ini yang menyebut langkahnya, bukan dibunuh tanpa keterangan.
console.log('\n-- 5. pemasangan nyata tanpa unduhan & tanpa internet (Chromium 1248 sudah ada) --');
const RT = path.join(AKAR, 'frontend', 'build', 'crawler-runtime');
const venvPatchright = path.join(AKAR, 'capability', 'ecosystem-crawler', '.venv', 'Lib', 'site-packages', 'patchright');
const browserAda = existsSync(path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1248'));
const detik = (ms) => `${(ms / 1000).toFixed(1)} s`;
if (!existsSync(path.join(RT, 'stealth.json')) || !existsSync(venvPatchright) || !browserAda) {
  console.log('DILEWATI bagian 5 — butuh build/crawler-runtime (npm run crawler:siapkan), .venv crawler, dan Chromium 1248 di laptop');
} else {
  const TENGGAT = MULAI + batasBerkas(path.basename(fileURLToPath(import.meta.url))) - 15000;
  const sisaMs = () => Math.max(1, TENGGAT - Date.now());
  const folderTmp = path.join(AKAR, '.tmp');
  mkdirSync(folderTmp, { recursive: true });
  // Sisa jalan yang dibunuh sebelum sempat membersihkan diri; yang lebih muda dari sejam mungkin jalan lain yang sedang berlangsung.
  for (const n of readdirSync(folderTmp).filter((x) => x.startsWith('uji-stealth-'))) {
    const d = path.join(folderTmp, n);
    try { if (Date.now() - statSync(d).mtimeMs > 3600000) rmSync(d, { recursive: true, force: true }); } catch { /* masih dipakai */ }
  }
  const dataN = sementara('uji-stealth-', folderTmp);
  let tautan = 0;
  let salinan = 0;
  const tautkan = (asal, tujuan) => {
    if (statSync(asal).isDirectory()) {
      mkdirSync(tujuan, { recursive: true });
      for (const n of readdirSync(asal)) tautkan(path.join(asal, n), path.join(tujuan, n));
    } else {
      try { linkSync(asal, tujuan); tautan++; } catch { copyFileSync(asal, tujuan); salinan++; }
    }
  };
  const jalankanNyata = async (program, argumen, opsi) => {
    const a = Date.now();
    const nama = argumen.includes('pip') ? 'pip' : argumen.includes('install') ? 'browser' : 'uji';
    let h;
    if (nama === 'pip') {  // ganti unduhan PyPI dengan tautan dari .venv — versi sama (1.64.1)
      const t = argumen[argumen.indexOf('--target') + 1];
      for (const n of readdirSync(path.dirname(venvPatchright)).filter((x) => /^patchright(-1\.64\.1\.dist-info)?$/.test(x))) {
        tautkan(path.join(path.dirname(venvPatchright), n), path.join(t, n));
      }
      h = { kode: 0, keluaran: `dari .venv tanpa unduhan: ${tautan} tautan, ${salinan} salinan`, habis: false };
    } else {
      h = await S.jalankanProses(program, argumen, { ...opsi, batasMs: Math.min(opsi.batasMs, sisaMs()) });
    }
    console.log(`       langkah ${nama}: ${detik(Date.now() - a)}${h.habis ? ' — HABIS TENGGAT UJI' : ''} (${h.keluaran.trim().slice(-80)})`);
    return h;
  };

  const TANDA = `stealth-uji-${process.pid}-${Date.now()}`;
  const masuk = [];
  const server = http.createServer((req, res) => {
    masuk.push({ url: req.url, ua: String(req.headers['user-agent'] || '') });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><title>${TANDA}</title></head><body><h1>${TANDA}</h1></body></html>`);
  });
  await new Promise((siap) => server.listen(0, '127.0.0.1', siap));
  const alamat = `http://127.0.0.1:${server.address().port}/halaman`;
  try {
    const hn = await S.pasangStealth({ runtime: RT, folderData: dataN, env: { ...K.lingkunganServer() }, jalankan: jalankanNyata });
    cek(hn.ok, `langkah browser & uji ASLI berhasil di runtime terbundel`, hn);
    const p = K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: RT, folderData: dataN });
    const a = Date.now();
    // Asinkron (bukan spawnSync): server di atas harus bisa menjawab selagi Python menunggu.
    const ambil = await S.jalankanProses(p.command, ['-c', [
      'from crawler.kanal.web import AksesWeb',
      'from crawler import konfig',
      'a = AksesWeb(konfig.USER_AGENT, proxy="")',  // server lokal: jangan lewat CRAWLER_PROXY .env
      `html, tingkat, url = a._stealth(${JSON.stringify(alamat)})`,
      `print("TINGKAT", tingkat, "TANDA", ${JSON.stringify(TANDA)} in html)`,
    ].join('\n')], { cwd: p.cwd, env: p.env, batasMs: sisaMs() });
    console.log(`       langkah ambil halaman: ${detik(Date.now() - a)}${ambil.habis ? ' — HABIS TENGGAT UJI' : ''}`);
    cek(/TINGKAT 3 TANDA True/.test(ambil.keluaran), 'crawler dari runtime terbundel membuka halaman lewat TINGKAT 3 (stealth) dengan paket terpasang',
      { kode: ambil.kode, habis: ambil.habis, ekor: ambil.keluaran.slice(-500) });
    const halaman = masuk.filter((m) => m.url === '/halaman');
    cek(halaman.length >= 1 && halaman.every((m) => /Chrome\//.test(m.ua)), 'server lokal sungguh didatangi Chromium — halaman bukan dari tempat lain', masuk);
  } finally {
    server.close();
  }
}

for (const d of SISA) {
  try { rmSync(d, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { console.log(`PERINGATAN folder sementara tak terhapus: ${d} (${e.code})`); }
}
console.log(`\n(${detik(Date.now() - MULAI)})`);
console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exitCode = gagal === 0 ? 0 : 1;

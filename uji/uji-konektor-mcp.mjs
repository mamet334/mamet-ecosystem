// UJI 2026-10-23 — klien MCP di proses utama (Item 129 Tahap B): electron/konektorMcp.cjs.
//
// Yang dijaga (keputusan Owner, docs/roadmap/ROADMAP-KONEKTOR-MCP.md):
//   K3  per workspace — Assistant & Engineer punya proses server sendiri; mematikan satu tidak menyentuh yang lain.
//   K2  belum ada jalur dari layar ke tools/call — gerbang persetujuan dibangun Tahap D di proses utama.
//   —   kunci API di proses Electron tidak sampai ke server konektor (lingkungan daftar putih).
// Bagian 3 menyalakan server crawler sungguhan; tanpa .venv crawler (tidak masuk repo) seluruh berkas DILEWATI.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const K = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));

// v2 (23 Okt, Tahap C): sakelar Settings disimpan di perangkat (K7) & dipulihkan saat aplikasi dibuka; `katalog`
// dibaca Mamet sendiri saat nyala (ringkasan akses untuk Settings); sakelar ditekan dua kali → satu proses.
// v5 (27 Okt): crawler sungguhan memakai akar data SEMENTARA (`folderDataPengembangan`), bukan folder repo — data
// `npm run desktop` Owner tidak disentuh uji. Bagian 1 menjaga bahwa tanpa opsi itu perilaku Owner tetap sama.
console.log('uji-konektor-mcp v5');
const PY = path.join(AKAR, 'capability', 'ecosystem-crawler', '.venv', 'Scripts', 'python.exe');
if (!existsSync(PY)) {
  console.log(`DILEWATI — ${path.relative(AKAR, PY)} tidak ada di mesin ini (.venv tidak masuk repo)`);
  process.exit(0);
}

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 500)}` : ''}`);
  if (!ok) gagal++;
};
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const hidup = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ── 1. Peluncuran: alamat absolut, Python milik konektor, lingkungan tanpa rahasia ────────────────────────────────
console.log('\n-- 1. peluncuran --');
process.env.MAMET_UJI_API_KEY = 'rahasia-uji';
process.env.OPENROUTER_API_KEY_UJI = 'rahasia-uji';
const p = K.peluncuran(AKAR, 'ecosystem-crawler');
cek(p.ok, 'crawler bisa diluncurkan dari capability/ecosystem-crawler/', p);
cek(p.command === PY && path.isAbsolute(p.command), 'program = python.exe di .venv konektor (alamat absolut, bukan dicari di PATH)', p.command);
cek(JSON.stringify(p.args) === JSON.stringify(['-m', 'crawler.wajah.mcp_server']), 'dijalankan `python -m` — paket dimuat dari folder kerja', p.args);
cek(p.cwd === path.join(AKAR, 'capability', 'ecosystem-crawler'), 'folder kerja = folder konektor', p.cwd);
const bocor = Object.keys(p.env).filter((k) => /KEY|TOKEN|SECRET|OPENROUTER|SUPABASE/i.test(k));
cek(bocor.length === 0, 'tak ada variabel rahasia di lingkungan server (MAMET_UJI_API_KEY ditanam di proses ini)', bocor);
cek(!('MAMET_UJI_API_KEY' in p.env) && ('PATH' in p.env || 'Path' in p.env), 'lingkungan daftar putih: PATH ada, kunci tidak', Object.keys(p.env));
cek(!K.peluncuran(AKAR, 'tak-dikenal').ok, 'konektor tak dikenal ditolak');
// main.cjs SELALU mengirim folderData (%APPDATA%) — juga di npm run desktop. Bila mode pengembangan mulai memakainya,
// data crawler Owner pindah diam-diam. Hanya folderDataPengembangan (khusus uji) yang memindahkan akar data.
const pDesktop = K.peluncuran(AKAR, 'ecosystem-crawler', { folderData: path.join(os.tmpdir(), 'appdata-palsu') });
cek(pDesktop.ok && !('CRAWLER_ROOT' in pDesktop.env) && pDesktop.cwd === p.cwd && !pDesktop.folderData,
  'npm run desktop (folderData dikirim seperti main.cjs): tanpa CRAWLER_ROOT → data tetap di folder crawler repo', pDesktop);
const akarUji = path.join(os.tmpdir(), 'crawler-uji-x');
const pUji = K.peluncuran(AKAR, 'ecosystem-crawler', { folderDataPengembangan: akarUji });
cek(pUji.ok && pUji.env.CRAWLER_ROOT === akarUji && pUji.folderData === akarUji && pUji.command === PY && pUji.cwd === p.cwd && !pUji.terbundel,
  'uji: folderDataPengembangan → CRAWLER_ROOT folder sementara; Python & kode tetap dari repo', pUji);
// Celah yang ditemukan saat pemeriksaan (27 Okt): jaminan di atas hanya pada `peluncuran`. Pengelola yang dibangun
// PERSIS seperti main.cjs (folderData selalu dikirim, tanpa runtimeTerbundel) juga wajib tidak memindahkan akar data.
// Diuji lewat rencanaPeluncuran — tanpa menjalankan crawler, jadi data Owner tidak tersentuh.
const rencanaDesktop = K.buatPengelolaKonektor({ akarRepo: AKAR, folderData: path.join(os.tmpdir(), 'appdata-palsu') }).rencanaPeluncuran('ecosystem-crawler');
cek(rencanaDesktop.ok && rencanaDesktop.akarData === null && rencanaDesktop.cwd === p.cwd && !rencanaDesktop.terbundel,
  'pengelola seperti main.cjs (npm run desktop): akar data tetap folder crawler repo, bukan folderData', rencanaDesktop);
const rencanaUji = K.buatPengelolaKonektor({ akarRepo: AKAR, folderDataPengembangan: akarUji }).rencanaPeluncuran('ecosystem-crawler');
cek(rencanaUji.ok && rencanaUji.akarData === akarUji && !('env' in rencanaUji), 'pengelola uji: akar data sementara; rencana tidak membuka lingkungan', rencanaUji);
const tanpaVenv = mkdtempSync(path.join(os.tmpdir(), 'konektor-'));
mkdirSync(path.join(tanpaVenv, 'capability', 'ecosystem-crawler', 'crawler', 'wajah'), { recursive: true });
writeFileSync(path.join(tanpaVenv, 'capability', 'ecosystem-crawler', 'crawler', 'wajah', 'mcp_server.py'), '');
const pt = K.peluncuran(tanpaVenv, 'ecosystem-crawler');
cek(!pt.ok && /Python konektor tidak ada/.test(pt.alasan), 'tanpa .venv: ditolak dengan alasan jelas, tidak jatuh ke Python di PATH', pt);

// ── 2. Hasil alat berbatas ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. hasil berbatas --');
const panjang = K.teksHasil({ content: [{ type: 'text', text: 'x'.repeat(K.BATAS.hasilHuruf + 10) }] });
cek(panjang.terpotong && panjang.teks.length === K.BATAS.hasilHuruf, `hasil > ${K.BATAS.hasilHuruf} huruf dipotong & ditandai`, { ...panjang, teks: undefined });
cek(!K.teksHasil({ content: [{ type: 'text', text: 'pendek' }] }).terpotong, 'hasil pendek utuh');

// ── 3. Server sungguhan: per workspace (K3) ───────────────────────────────────────────────────────────────────
console.log('\n-- 3. server crawler sungguhan, per workspace --');
const log = [];
const dataUji = mkdtempSync(path.join(os.tmpdir(), 'crawler-uji-mcp-'));
const m = K.buatPengelolaKonektor({ akarRepo: AKAR, folderDataPengembangan: dataUji, versi: 'uji', log: (s) => log.push(s) });
try {
  const [a, a2] = await Promise.all([m.nyalakan('ws-assistant', 'ecosystem-crawler'), m.nyalakan('ws-assistant', 'ecosystem-crawler')]);
  cek(a.ok && a.alat.length === 6, `Assistant: nyala, ${a.alat?.length} alat`, a);
  cek(a2.pid === a.pid, 'dinyalakan dua kali bersamaan (sakelar ditekan ganda) → tetap SATU proses', { a: a.pid, a2: a2.pid });
  cek(a.ringkasan?.akses && typeof a.ringkasan.akses.patuhi_robots === 'boolean' && a.ringkasan.sumber >= 10,
    `katalog dibaca Mamet saat nyala → ringkasan akses + ${a.ringkasan?.sumber} sumber (${a.ringkasan?.siap} siap)`, a.ringkasan);
  let st = m.status();
  const sAsis = st.find((x) => x.workspace === 'ws-assistant');
  const sEng = st.find((x) => x.workspace === 'ws-engineer');
  cek(sAsis.status === 'nyala' && sEng.status === 'mati', 'K3: menyalakan di Assistant TIDAK menghubungkan Engineer', st);

  const e = await m.nyalakan('ws-engineer', 'ecosystem-crawler');
  cek(e.ok && e.pid && e.pid !== a.pid, `Engineer disambung sendiri → proses sendiri (pid ${e.pid} ≠ ${a.pid})`, e);

  const kat = await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', {});
  let isi = null;
  try { isi = JSON.parse(kat.teks); } catch { /* */ }
  cek(kat.ok && isi?.akses && typeof isi.akses.patuhi_robots === 'boolean', 'tools/call katalog → JSON berisi `akses` (sakelar robots/stealth)', kat);
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'hapus_semua', {})).ok, 'alat yang tidak ada di tools/list ditolak');
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', [1])).ok, 'argumen bukan objek ditolak');

  await m.matikan('ws-assistant', 'ecosystem-crawler');
  await tunggu(800);
  st = m.status();
  cek(st.find((x) => x.workspace === 'ws-assistant').status === 'mati' && st.find((x) => x.workspace === 'ws-engineer').status === 'nyala',
    'K3: mematikan Assistant tidak mematikan Engineer', st);
  cek(!(await m.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', {})).ok, 'Assistant yang dimatikan tidak bisa dipanggil');
  cek(!hidup(a.pid), `proses Assistant (pid ${a.pid}) benar-benar berhenti`);
  cek((await m.panggil('ws-engineer', 'ecosystem-crawler', 'katalog', {})).ok, 'Engineer tetap bisa dipanggil');
  // katalog membuka gudang (skema) & menulis garam ke .env akar data — keduanya harus mendarat di folder sementara.
  cek(existsSync(path.join(dataUji, 'data', 'gudang.db')) && existsSync(path.join(dataUji, '.env')) && existsSync(path.join(dataUji, 'inbox')),
    'crawler sungguhan memakai akar data SEMENTARA (gudang.db, .env garam, inbox) — bukan folder crawler repo');

  await m.matikanSemua();
  await tunggu(800);
  cek(m.status().every((x) => x.status === 'mati') && !hidup(e.pid), 'matikanSemua: semua sesi mati, proses Engineer berhenti');
  cek(!(await m.nyalakan('ws-lite', 'ecosystem-crawler')).ok, 'workspace di luar Assistant/Engineer ditolak');
} finally {
  await m.matikanSemua();
}

// ── 4. K2: jalur dari layar ke tools/call HANYA lewat gerbang ────────────────────────────────────────────────
console.log('\n-- 4. K2: tools/call dari layar hanya lewat gerbang persetujuan --');
const preload = readFileSync(path.join(AKAR, 'frontend', 'electron', 'preload.cjs'), 'utf8');
const main = readFileSync(path.join(AKAR, 'frontend', 'electron', 'main.cjs'), 'utf8');
cek(/konektor:status/.test(preload) && /konektor:atur/.test(preload),
  'layar bisa melihat status dan memakai sakelar Settings');
cek(!/konektor:nyalakan|konektor:matikan/.test(preload),
  'satu jalur saja dari layar: sakelar (atur) — menyala tanpa tersimpan tidak mungkin, setelan = kebenaran');
// v3 (Tahap D): jalurnya kini ada — dan HANYA lewat gerbang. Pengelola tidak pernah dipanggil langsung dari IPC.
const ipcPanggil = main.match(/ipcMain\.handle\('konektor:panggil'[\s\S]*?\n\s*[^\n]*\);/)?.[0] || '';
cek(/gerbangKonektor\.panggil\(/.test(ipcPanggil), 'IPC konektor:panggil diteruskan ke gerbangKonektor.panggil', ipcPanggil);
cek(!/pengelolaKonektor\.panggil\(/.test(main), 'proses utama tidak pernah memanggil pengelolaKonektor.panggil langsung (melewati gerbang)');
cek(/mintaIzin: async[\s\S]{0,400}dialog\.showMessageBox\(mainWindow/.test(main) && /buttons: \['Tolak', 'Izinkan'\][\s\S]{0,80}cancelId: 0/.test(main),
  'gerbang bertanya lewat dialog asli proses utama; tombol bawaan & Esc = Tolak');
cek(/matikanSemua/.test(main) && /will-quit/.test(main), 'proses konektor dimatikan saat aplikasi keluar');
cek(/berkasSetelan: path\.join\(app\.getPath\('userData'\), 'konektor\.json'\)/.test(main) && /pengelolaKonektor\.pulihkan\(\)/.test(main),
  'K7: setelan di userData perangkat & dipulihkan saat aplikasi siap');

// ── 5. Setelan sakelar di perangkat (K7) ──────────────────────────────────────────────────────────────────────
console.log('\n-- 5. sakelar Settings: disimpan di perangkat, dipulihkan saat dibuka --');
const berkas = path.join(mkdtempSync(path.join(os.tmpdir(), 'konektor-setelan-')), 'konektor.json');
const m1 = K.buatPengelolaKonektor({ akarRepo: AKAR, berkasSetelan: berkas, folderDataPengembangan: dataUji });
try {
  const nyala = await m1.atur('ws-assistant', 'ecosystem-crawler', true);
  const isiBerkas = JSON.parse(readFileSync(berkas, 'utf8'));
  cek(nyala.ok && isiBerkas['ws-assistant']?.['ecosystem-crawler'] === true && !isiBerkas['ws-engineer'],
    'sakelar Assistant → tersimpan hanya untuk Assistant, lalu menyala', isiBerkas);
  const st1 = m1.status();
  cek(st1.find((x) => x.workspace === 'ws-assistant').diaktifkan && !st1.find((x) => x.workspace === 'ws-engineer').diaktifkan,
    'status membedakan "diaktifkan Owner" per workspace');
  cek(!(await m1.atur('ws-assistant', 'ecosystem-crawler', 'ya')).ok, 'nilai sakelar selain true/false ditolak');
} finally { await m1.matikanSemua(); }

// "Aplikasi dibuka lagi": pengelola baru dengan berkas yang sama.
const m2 = K.buatPengelolaKonektor({ akarRepo: AKAR, berkasSetelan: berkas, folderDataPengembangan: dataUji });
try {
  const pulih = await m2.pulihkan();
  const st2 = m2.status();
  cek(pulih.length === 1 && pulih[0].ok && st2.find((x) => x.workspace === 'ws-assistant').status === 'nyala'
    && st2.find((x) => x.workspace === 'ws-engineer').status === 'mati',
  'dibuka lagi → yang dinyalakan Owner (Assistant) menyala sendiri; Engineer tetap mati', pulih);
  const mati = await m2.atur('ws-assistant', 'ecosystem-crawler', false);
  cek(mati.ok && mati.status === 'mati' && !JSON.parse(readFileSync(berkas, 'utf8'))['ws-assistant']?.['ecosystem-crawler'],
    'sakelar dimatikan → terhapus dari setelan & proses berhenti');
} finally { await m2.matikanSemua(); }

writeFileSync(berkas, '{rusak');
cek(JSON.stringify(K.buatPengelolaKonektor({ akarRepo: AKAR, berkasSetelan: berkas }).bacaSetelan()) === '{}', 'berkas setelan rusak → dianggap kosong, tidak membuat aplikasi gagal');
cek(JSON.stringify(K.normalisasiSetelan({ 'ws-assistant': { 'ecosystem-crawler': 'true', lain: true }, 'ws-x': { 'ecosystem-crawler': true } })) === '{}',
  'setelan hanya menerima workspace & konektor yang dikenal dengan nilai true');

// ── 5b. Aplikasi terpasang (Tahap E, K10): runtime terbundel + data di folder yang bisa ditulis ───────────────
console.log('\n-- 5b. mode terpasang: runtime terbundel, CRAWLER_ROOT di folder data --');
const runtimePalsu = mkdtempSync(path.join(os.tmpdir(), 'runtime-palsu-'));
mkdirSync(path.join(runtimePalsu, 'crawler', 'wajah'), { recursive: true });
writeFileSync(path.join(runtimePalsu, 'crawler', 'wajah', 'mcp_server.py'), '');
mkdirSync(path.join(runtimePalsu, 'python'), { recursive: true });
writeFileSync(path.join(runtimePalsu, 'python', 'python.exe'), '');
const folderData = path.join(os.tmpdir(), `data-crawler-${Date.now()}`);
const pt2 = K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: runtimePalsu, folderData });
cek(pt2.ok && pt2.terbundel && pt2.command === path.join(runtimePalsu, 'python', 'python.exe') && pt2.cwd === runtimePalsu,
  'terpasang: Python & kode dari runtime terbundel, bukan dari .venv repo', pt2);
cek(pt2.env.CRAWLER_ROOT === folderData && !Object.keys(pt2.env).some((k) => /KEY|TOKEN|SECRET/i.test(k)),
  'terpasang: CRAWLER_ROOT = folder data (bisa ditulis); lingkungan tetap tanpa rahasia', pt2.env.CRAWLER_ROOT);
cek(!K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: runtimePalsu }).ok, 'terpasang tanpa folder data → ditolak (crawler tak boleh menulis ke folder program)');
cek(!K.peluncuran(AKAR, 'ecosystem-crawler', { runtimeTerbundel: path.join(runtimePalsu, 'tak-ada'), folderData }).ok, 'runtime terbundel tak lengkap → ditolak dengan alasan');
const S = await import(pathToFileURL(path.join(AKAR, 'frontend', 'scripts', 'siapkan-crawler.mjs')).href);
cek(['lib/json/__init__.py', 'python312.dll', 'vcruntime140.dll', 'dlls/_ssl.pyd', 'lib/encodings/utf_8.py'].every((r) => !S.lewatiPython(r)),
  'penyiap: pustaka standar & DLL Python ikut');
cek(['lib/site-packages/numpy/x.py', 'lib/test/x.py', 'doc/x.chm', 'lib/tkinter/x.py', 'lib/json/__pycache__/x.pyc'].every((r) => S.lewatiPython(r)),
  'penyiap: site-packages GLOBAL laptop, tes, dokumentasi, tkinter, cache — tidak ikut (Python dasar 1,37 GB → pustaka standar saja)');
cek(['playwright/driver/node.exe', 'patchright-1.0.dist-info/RECORD', '_pytest/x.py', '__editable__.ecosystem_crawler-0.1.0.pth'].every((r) => S.lewatiPaket(r))
  && ['scrapling/fetchers.py', 'curl_cffi/x.py', 'mcp/x.py', 'trafilatura/x.py', 'yt_dlp/x.py', 'pywin32.pth', 'pip/__init__.py', 'greenlet/x.pyd', 'pyee/x.py'].every((r) => !S.lewatiPaket(r)),
  'penyiap: penggerak stealth (K14), pytest, editable dibuang; paket kerja crawler ikut — termasuk pip, greenlet, pyee (E2: pemasangan stealth --no-deps)');
const runtimeAsli = path.join(AKAR, 'frontend', 'build', 'crawler-runtime');
if (existsSync(path.join(runtimeAsli, 'python', 'python.exe'))) {
  const mT = K.buatPengelolaKonektor({ akarRepo: AKAR, runtimeTerbundel: runtimeAsli, folderData });
  try {
    const n = await mT.nyalakan('ws-assistant', 'ecosystem-crawler');
    cek(n.ok && n.alat.length === 6 && existsSync(path.join(folderData, 'inbox')), `runtime terbundel SUNGGUHAN menyala (${n.alat.length} alat); folder inbox disiapkan di folder data`, n);
    cek(n.ringkasan?.siap >= 14, `di folder data baru semua sumber yang bisa siap memang siap (${n.ringkasan?.siap}) — termasuk inbox`, n.ringkasan);
    cek(existsSync(path.join(folderData, '.env')) && !existsSync(path.join(runtimeAsli, '.env')), 'crawler menulis .env (garam) ke folder data, tidak ke folder program');
  } finally { await mT.matikanSemua(); }
} else {
  console.log('  (frontend/build/crawler-runtime belum disiapkan — `npm run crawler:siapkan`; bagian sungguhan dilewati)');
}

// ── 6. Gerbang persetujuan (Tahap D, K2/K8) — pengelola tiruan, dialog tiruan ─────────────────────────────────
console.log('\n-- 6. gerbang: sekali per misi, per workspace --');
const dipanggil = [];
let jawabDialog = true;
const dialog = [];
const pengelolaTiruan = {
  status: () => [{ workspace: 'ws-assistant', konektor: 'ecosystem-crawler', ringkasan: { akses: { keterangan: 'robots.txt TIDAK dipatuhi' } } }],
  panggil: async (ws, id, alat, argumen, opsi) => {
    dipanggil.push({ ws, alat, argumen, opsi });
    if (alat === 'jalankan_misi') return { ok: true, teks: JSON.stringify({ misi_id: 'MISIUJI0001', status: 'selesai', total: 12 }) };
    return { ok: true, teks: '{"items":[]}' };
  },
};
const g = K.buatGerbangKonektor({ pengelola: pengelolaTiruan, mintaIzin: async (d) => { dialog.push(d); return jawabDialog; } });
const misi = { sumber: ['rss_media'], kata_kunci: ['BPJS'], owner_intent: 'cari keluhan BPJS', sejak: '30h' };
const h1 = await g.panggil('ws-assistant', 'ecosystem-crawler', 'jalankan_misi', misi);
cek(h1.ok && h1.misiId === 'MISIUJI0001' && dialog.length === 1, 'misi baru → SATU dialog, lalu misi_id dicatat', { h1, dialog: dialog.length });
cek(/BPJS/.test(dialog[0].rincian) && /rss_media/.test(dialog[0].rincian) && /robots\.txt TIDAK dipatuhi/.test(dialog[0].rincian) && /penyedia model/.test(dialog[0].rincian),
  'dialog menyebut sumber, kata kunci, cara akses, dan bahwa hasil terkirim ke penyedia model', dialog[0]);
cek(dipanggil[0].opsi?.batasMs === 130000, 'jalankan_misi diberi batas 130 s (crawler menunggu ≤ 110 s)', dipanggil[0].opsi);
await g.panggil('ws-assistant', 'ecosystem-crawler', 'status_misi', { misi_id: 'MISIUJI0001' });
await g.panggil('ws-assistant', 'ecosystem-crawler', 'baca_tangkapan', { misi_id: 'MISIUJI0001', kursor: 0 });
cek(dialog.length === 1, 'K8: status & baca untuk misi yang disetujui → TANPA dialog lagi', dialog.length);
await g.panggil('ws-assistant', 'ecosystem-crawler', 'baca_tangkapan', { misi_id: 'MISILAIN0002' });
cek(dialog.length === 2, 'baca misi LAIN (belum disetujui) → dialog', dialog.length);
await g.panggil('ws-engineer', 'ecosystem-crawler', 'baca_tangkapan', { misi_id: 'MISIUJI0001' });
cek(dialog.length === 3, 'K3: izin misi di Assistant tidak berlaku di Engineer → dialog', dialog.length);
await g.panggil('ws-assistant', 'ecosystem-crawler', 'ekspor_misi', { misi_id: 'MISIUJI0001' });
await g.panggil('ws-assistant', 'ecosystem-crawler', 'daftar_misi', {});
cek(dialog.length === 5, 'ekspor_misi (menulis berkas) & daftar_misi → dialog setiap kali, walau misinya sudah disetujui', dialog.length);
const nKatalog = dialog.length;
await g.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', {});
cek(dialog.length === nKatalog, 'katalog (setelan capability, bukan data luar) → tanpa dialog');
jawabDialog = false;
const nSebelum = dipanggil.length;
const tolak1 = await g.panggil('ws-assistant', 'ecosystem-crawler', 'jalankan_misi', { ...misi, kata_kunci: ['pinjol'] });
cek(!tolak1.ok && tolak1.ditolakOwner && dipanggil.length === nSebelum, 'Owner menolak → alat TIDAK dijalankan, hasil "ditolak Owner"', tolak1);
cek(!(await g.panggil('ws-lite', 'ecosystem-crawler', 'katalog', {})).ok && !(await g.panggil('ws-assistant', 'ecosystem-crawler', 'katalog', [1])).ok,
  'workspace asing & argumen bukan objek ditolak sebelum apa pun');
const gGalat = K.buatGerbangKonektor({ pengelola: pengelolaTiruan, mintaIzin: async () => { throw new Error('jendela tertutup'); } });
cek((await gGalat.panggil('ws-assistant', 'ecosystem-crawler', 'jalankan_misi', misi)).ditolakOwner === true,
  'dialog gagal tampil → dianggap DITOLAK, bukan diizinkan');
cek(K.misiIdDari('{"misi_id":"x; rm -rf"}') === null && K.misiIdDari('bukan json') === null, 'misi_id aneh/bukan JSON tidak diberi izin otomatis');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

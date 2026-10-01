// UJI 2026-10-01 — Engineer diberi PETA repo, bukan hanya disuruh mencari.
//
// ── Yang diukur lebih dulu, bukan ditebak ───────────────────────────────────────────────────
// Komposisi satu permintaan Engineer nyata milik Owner (log [PROMPT_KOMPOSISI], 1 Okt 01:26):
//
//   aturan & identitas  21.756 huruf   (62% prompt)   ≈ 5.400 token
//   RAG dokumen tugas    6.566
//   riwayat percakapan   4.807         ≈ 1.200 token  ← SATU-SATUNYA tempat kode bisa muncul
//   total               39.917 huruf   ≈ 10.000 token dari anggaran 60.000
//
// Jadi Engineer menerima aturan 4,5 kali lipat lebih banyak daripada kode, dan anggaran konteks
// terpakai seperenam. Owner: *"di mana Engineer yang seharusnya tahu kode sumber Mamet?"* —
// jawabannya saat itu: belum ada.
//
// Peta ini 270 berkas / 15.494 huruf (±3.870 token): lebih kecil daripada blok aturan yang sudah ada.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const P = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/engineer/ProsedurEngineer.js`).href + '?v=' + Date.now());

console.log('uji-peta-repo v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const PETA = [
  'frontend/src/components/workbench/ConversationEngine.jsx:2195',
  'frontend/electron/main.cjs:1158',
  'frontend/electron/akarRepo.cjs:102',
].join('\n');

// ── 1. Isi catatannya ────────────────────────────────────────────────────────────────────────
console.log('\n-- isi catatan --');

const c = P.catatanPetaRepo(PETA);
cek(c.includes('ConversationEngine.jsx:2195'), 'peta ikut apa adanya, beserta jumlah barisnya');
cek(/3 berkas/.test(c), 'jumlah berkas disebut', c.slice(0, 120));
cek(/daftar LENGKAP/i.test(c),
  'dinyatakan LENGKAP — tanpa itu model tetap menduga ada berkas lain yang belum terlihat', c);
cek(/JANGAN mencari letak berkas/i.test(c), 'melarang mencari LETAK berkas (alamatnya sudah ada)');
cek(/Yang perlu dicari hanya ISInya/i.test(c),
  'tetapi menegaskan isinya MASIH perlu dicari — tanpa ini larangan jadi terlalu luas', c);

// Jumlah baris bukan hiasan: ia yang mengajari kapan `git show` akan terpotong diam-diam.
cek(/git show/.test(c) && /20 KB/.test(c), 'menyebut sebab berkas besar tak muat: keluaran dipotong 20 KB');
cek(/git grep -n/.test(c) && /git blame -L/.test(c),
  'memberi GANTI cara, bukan sekadar melarang (prosedur langkah 0.4)', c);

// ── 2. Kapan diam ────────────────────────────────────────────────────────────────────────────
// Di web/Mametlite tidak ada Electron; di desktop akar repo bisa belum dipilih. Peta kosong yang
// tetap dikirim akan mengajari model bahwa repo ini tidak punya berkas — lebih buruk daripada diam.
console.log('\n-- kapan diam --');
for (const kosong of ['', '   ', '\n', null, undefined, 0, false]) {
  cek(P.catatanPetaRepo(kosong) === '', `peta kosong (${JSON.stringify(kosong)}) → catatan kosong`);
}

// ── 3. TERPASANG di jalur kirim ──────────────────────────────────────────────────────────────
console.log('\n-- terpasang --');

const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8');
cek(/import \{ riwayatPerintahDariPesan, catatanAkarRepo, catatanPetaRepo \}/.test(CE), 'catatanPetaRepo diimpor');
cek(/const catatanPeta = catatanPetaRepo\(peta\);/.test(CE), 'dipanggil di handleSend');
cek(/engineer\?\.petaRepo\?\.\(\)/.test(CE), 'petanya dibaca dari proses utama, bukan disusun di layar');
cek(/const sisipan = \[catatanAkar, catatanPeta, ringkasanTemuan\]/.test(CE),
  'ikut ke sisipan bersama catatan akar repo & ingatan temuan', (CE.match(/const sisipan = [^\n]*/g) || []));

// Hanya diminta bila akar repo SUDAH dipilih — tanpa akar, perintah git tak bisa jalan sama sekali.
const iPeta = CE.indexOf('const peta = akarRepoSekarang');
cek(iPeta > 0, 'peta hanya diminta bila akar repo sudah dipilih', CE.slice(iPeta, iPeta + 90));

// Dibaca di dalam handleSend (tiap kiriman), bukan sekali saat komponen dimuat — Owner bisa
// berganti repo, dan "Bersihkan konteks" menggeser jendela sehingga sisipan lama hilang.
const blokKirim = CE.slice(CE.indexOf('const handleSend'), CE.indexOf('history: historyKirim'));
cek(blokKirim.includes('petaRepo?.()'), 'dibaca tiap kiriman, bukan sekali saat komponen dimuat');

// ── 4. Proses utama: satu perintah, dan di-cache ─────────────────────────────────────────────
console.log('\n-- proses utama --');

const MAIN = readFileSync(`${AKAR}/frontend/electron/main.cjs`, 'utf8');
const PRELOAD = readFileSync(`${AKAR}/frontend/electron/preload.cjs`, 'utf8');

cek(/ipcMain\.handle\('engineer:peta-repo'/.test(MAIN), 'jalur peta ada di proses utama');
cek(/petaRepo: \(\) => ipcRenderer\.invoke\('engineer:peta-repo'\)/.test(PRELOAD), 'dijembatani preload');
cek(/\['grep', '-c', '', '--', \.\.\.PETA_SASARAN\]/.test(MAIN),
  'SATU perintah git untuk 270 berkas (0,13 detik), bukan 270 proses', (MAIN.match(/\['grep'[^\n]*/g) || []));
cek(/if \(petaRepoCache && petaRepoCache\.akar === akarRepo\(\)\) return petaRepoCache\.teks;/.test(MAIN),
  'di-cache per akar repo — daftar berkas jarang berubah, yang berubah isinya');
cek(/petaRepoCache = \{ akar: akarRepo\(\), teks: keluaran \}/.test(MAIN),
  'cache menyimpan akarnya juga, jadi ganti repo = peta ikut berganti');

const iPetaMain = MAIN.indexOf("ipcMain.handle('engineer:peta-repo'");
const blokMain = MAIN.slice(iPetaMain, iPetaMain + 1500);
cek(/const belum = butuhAkarRepo\(\);\s*if \(belum\) return '';/.test(blokMain),
  'tanpa akar repo → kosong, bukan galat yang membingungkan');
cek(/catch \(e\)/.test(blokMain) && /return '';/.test(blokMain),
  'kegagalannya tidak menggagalkan kiriman — paling buruk Engineer kembali seperti sebelumnya', blokMain.slice(-200));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

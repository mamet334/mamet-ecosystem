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

// ── KONTRAKNYA BERUBAH 2026-10-04 (permintaan Owner) ────────────────────────────────────────
// Uji ini dulu menegakkan keputusan LAMA: peta dikirim UTUH dan dinyatakan "daftar LENGKAP".
// Keputusan itu diubah Owner setelah biayanya terukur di produksi — sisipan peta + akar repo
// tercatat `riwayat=2 pesan/16.557 huruf`, IDENTIK di lima kali jalan termasuk di percakapan
// berbeda, yaitu 30% dari seluruh prompt untuk pertanyaan apa pun.
//
// Owner: *"metode sama seperti skill — memuat judul atau kata kunci saja, bukan keseluruhan peta."*
//
// Jadi asersinya DIBALIK arah, bukan dilonggarkan: yang dulu wajib ada (daftar berkas, kata
// "LENGKAP") kini wajib TIDAK ada, dan yang menggantikannya harus benar-benar bisa dipakai.
// Fixture yang MENCERMINKAN repo nyata: banyak berkas, sedikit folder (273 berkas / 18 folder).
// Fixture 3-berkas di atas tidak cocok untuk menguji indeks — pada peta sekecil itu peta utuh
// memang lebih kecil, dan fungsi ini sengaja mengirim yang lebih kecil.
const PETA_NYATA = [
  'frontend/src/components/workbench/ConversationEngine.jsx:2195',
  'frontend/electron/main.cjs:1158',
  'frontend/electron/akarRepo.cjs:102',
  ...Array.from({ length: 60 }, (_, i) => `frontend/src/components/k${i}.jsx:${90 + i}`),
  ...Array.from({ length: 60 }, (_, i) => `frontend/src/core/runtime/services/s${i}.js:${80 + i}`),
].join('\n');

const c = P.catatanPetaRepo(PETA_NYATA);
cek(!c.includes('k30.jsx:120'),
  'daftar berkas TIDAK ikut lagi — inilah pemangkasannya', c.slice(0, 160));
cek(/123 berkas/.test(c), 'jumlah berkas tetap disebut', c.slice(0, 120));
cek(/INDEKS, bukan daftar berkas/i.test(c),
  'dinyatakan INDEKS — model harus tahu daftar berkasnya memang tidak disertakan', c);
cek(!/daftar LENGKAP/i.test(c), 'klaim "LENGKAP" dicabut — ia sudah tidak benar');

// Yang menggantikan kelengkapan: cara mengambilnya. Tanpa ini, pemangkasan hanya membutakan.
cek(/git grep -c ""? -- <folder>/.test(c),
  'memberi perintah pengambil daftar berkas per folder', c);
cek(/TANPA dialog izin/i.test(c),
  'menyebut perintahnya murah (jalan sendiri sejak 4.2.5) — tanpa itu model ragu memakainya', c);
cek(/JANGAN menebak alamat berkas/i.test(c), 'melarang menebak alamat');
cek(/JANGAN menyimpulkan sebuah berkas tidak ada/i.test(c),
  'DAN melarang menyimpulkan ketiadaan dari indeks — bahaya baru yang dibawa pemangkasan ini', c);

cek(/FOLDER \(jumlah berkas\)/.test(c), 'daftar folder beserta jumlahnya ada');
cek(/frontend\/src\/components\s+1/.test(c) || /frontend\/src\/components/.test(c),
  'folder dari peta benar-benar terindeks', c);

// Jumlah baris bukan hiasan: ia yang mengajari kapan `git show` akan terpotong diam-diam.
// Nilai ini DIPERTAHANKAN dari rancangan lama — hanya berkas besar yang didaftar, bukan semuanya.
cek(/git show/.test(c) && /20 KB/.test(c), 'menyebut sebab berkas besar tak muat: keluaran dipotong 20 KB');
cek(/git grep -n/.test(c) && /git blame -L/.test(c),
  'memberi GANTI cara, bukan sekadar melarang (prosedur langkah 0.4)', c);
cek(c.includes('ConversationEngine.jsx 2195'),
  'berkas >600 baris TETAP didaftar beserta jumlahnya — peringatannya tidak ikut terpangkas', c);

// Pemangkasannya diukur, bukan diklaim.
console.log('\n-- pemangkasan diukur --');
{
  // Bentuk NYATA: banyak berkas, sedikit folder.
  const nyata = Array.from({ length: 300 }, (_, i) =>
    `frontend/src/core/runtime/services/a${i}.js:${50 + i}`).join('\n');
  const idx = P.catatanPetaRepo(nyata);
  cek(idx.length < nyata.length / 2,
    `indeks jauh lebih kecil daripada peta mentah (${idx.length} vs ${nyata.length} huruf)`,
    { indeks: idx.length, mentah: nyata.length });
  cek(!/a150\.js/.test(idx), 'berkas satuan tidak bocor ke indeks', idx.slice(0, 200));
}
{
  // Bentuk PATOLOGIS: tiap berkas punya foldernya sendiri, jadi pengelompokan tak memampatkan
  // apa pun. Kasus ini ditemukan oleh uji ini sendiri — rancangan pertama menghasilkan indeks
  // 12.808 huruf untuk peta 8.729 huruf, yakni LEBIH BESAR daripada yang dipangkasnya.
  const patologis = Array.from({ length: 300 }, (_, i) => `frontend/src/f${i}/a${i}.js:${50 + i}`).join('\n');
  const hasil = P.catatanPetaRepo(patologis);
  cek(hasil.length < patologis.length * 1.3,
    `tidak membengkak: ${hasil.length} huruf untuk peta ${patologis.length} huruf`,
    { hasil: hasil.length, peta: patologis.length });
  cek(/SELURUH BERKAS KODE/.test(hasil),
    'jatuh kembali ke peta utuh — di bentuk itu peta lebih murah DAN lebih berguna', hasil.slice(0, 140));
  cek(hasil.includes('a150.js:200'), 'dan daftar berkasnya benar-benar ikut pada jalur itu');
}

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


import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
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

console.log('\n-- isi catatan --');

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

cek(/git show/.test(c) && /20 KB/.test(c), 'menyebut sebab berkas besar tak muat: keluaran dipotong 20 KB');
cek(/git grep -n/.test(c) && /git blame -L/.test(c),
  'memberi GANTI cara, bukan sekadar melarang (prosedur langkah 0.4)', c);
cek(c.includes('ConversationEngine.jsx 2195'),
  'berkas >600 baris TETAP didaftar beserta jumlahnya — peringatannya tidak ikut terpangkas', c);

console.log('\n-- pemangkasan diukur --');
{
  const nyata = Array.from({ length: 300 }, (_, i) =>
    `frontend/src/core/runtime/services/a${i}.js:${50 + i}`).join('\n');
  const idx = P.catatanPetaRepo(nyata);
  cek(idx.length < nyata.length / 2,
    `indeks jauh lebih kecil daripada peta mentah (${idx.length} vs ${nyata.length} huruf)`,
    { indeks: idx.length, mentah: nyata.length });
  cek(!/a150\.js/.test(idx), 'berkas satuan tidak bocor ke indeks', idx.slice(0, 200));
}
{
  const patologis = Array.from({ length: 300 }, (_, i) => `frontend/src/f${i}/a${i}.js:${50 + i}`).join('\n');
  const hasil = P.catatanPetaRepo(patologis);
  cek(hasil.length < patologis.length * 1.3,
    `tidak membengkak: ${hasil.length} huruf untuk peta ${patologis.length} huruf`,
    { hasil: hasil.length, peta: patologis.length });
  cek(/SELURUH BERKAS KODE/.test(hasil),
    'jatuh kembali ke peta utuh — di bentuk itu peta lebih murah DAN lebih berguna', hasil.slice(0, 140));
  cek(hasil.includes('a150.js:200'), 'dan daftar berkasnya benar-benar ikut pada jalur itu');
}

console.log('\n-- kapan diam --');
for (const kosong of ['', '   ', '\n', null, undefined, 0, false]) {
  cek(P.catatanPetaRepo(kosong) === '', `peta kosong (${JSON.stringify(kosong)}) → catatan kosong`);
}

console.log('\n-- terpasang --');

const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8');
cek(/import \{[^}]*\bcatatanPetaRepo\b[^}]*\} from '[^']*ProsedurEngineer\.js'/.test(CE),
  'catatanPetaRepo diimpor dari ProsedurEngineer');
cek(/const catatanPeta = catatanPetaRepo\(peta, \{ keluaranMaksByte \}\);/.test(CE) && /keluaranMaksByte = await assistantService\._batasBacaFolderHuruf\(\)/.test(CE), 'dipanggil di handleSend dengan batas keluaran dari anggaran konteks');
{
  const besar = P.catatanPetaRepo(PETA_NYATA, { keluaranMaksByte: 240 * 1024 });
  cek(/240 KB/.test(besar) && !/20 KB/.test(besar), 'Tahap K.2: angka batas yang disebut = anggaran yang dikirim, bukan 20 KB', besar.slice(-400));
  cek(!besar.includes('ConversationEngine.jsx 2195'), 'berkas yang muat dalam anggaran tidak lagi dicap "tak muat"', besar.slice(-300));
}
cek(/engineer\?\.petaRepo\?\.\(\)/.test(CE), 'petanya dibaca dari proses utama, bukan disusun di layar');
cek(/const sisipan = \[[^\]]*\bcatatanPeta\b[^\]]*\]/.test(CE),
  'ikut ke dalam larik sisipan', (CE.match(/const sisipan = [^\n]*/g) || []));

const iPeta = CE.indexOf('const peta = akarRepoSekarang');
cek(iPeta > 0, 'peta hanya diminta bila akar repo sudah dipilih', CE.slice(iPeta, iPeta + 90));

const blokKirim = CE.slice(CE.indexOf('const handleSend'), CE.indexOf('history: historyKirim'));
cek(blokKirim.includes('petaRepo?.()'), 'dibaca tiap kiriman, bukan sekali saat komponen dimuat');

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

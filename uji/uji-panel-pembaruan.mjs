// UJI 2026-09-29 — panel Pembaruan Aplikasi di Pengaturan.
//
// Sampai hari ini jembatan pembaruan di preload (`checkForUpdates`, `getAppVersion`, `onUpdateStatus`)
// TIDAK dipakai satu pun berkas di frontend/src — kebalikan dari kode mati yang dihapus minggu ini:
// di sana pendengar tanpa pemancar, di sini jembatan tanpa pemakai. Owner melaporkannya langsung:
// aplikasi mendeteksi 4.2.0, tetapi Pengaturan tidak punya apa pun untuk ditampilkan.
//
// Yang paling penting dijaga di sini: **keadaan yang menunggu tindakan Owner tidak boleh terlihat
// seperti keadaan yang sudah beres**, dan kegagalan tidak boleh diam.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const S = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/statusPembaruan.js`).href + '?v=' + Date.now());

console.log('uji-panel-pembaruan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Terjemahan keadaan ────────────────────────────────────────────────────────────────────
console.log('\n-- terjemahan keadaan --');

let r = S.ringkasPembaruan({ status: 'not-available' });
cek(r.nada === 'aman' && /versi terbaru/i.test(r.teks), 'sudah terbaru → aman', r);

r = S.ringkasPembaruan({ status: 'available', version: '4.2.0' });
cek(r.nada === 'sibuk' && r.teks.includes('4.2.0'), 'versi baru tersedia → sibuk, versinya disebut', r);

r = S.ringkasPembaruan({ status: 'downloading', percent: 41.6 });
cek(r.teks.includes('42%'), 'persentase dibulatkan', r);
cek(S.ringkasPembaruan({ status: 'downloading', percent: 140 }).teks.includes('100%'), 'persentase di atas 100 dijepit');
cek(S.ringkasPembaruan({ status: 'downloading', percent: -5 }).teks.includes('0%'), 'persentase negatif dijepit');
cek(!/NaN/.test(S.ringkasPembaruan({ status: 'downloading' }).teks), 'tanpa angka → tidak menampilkan NaN', S.ringkasPembaruan({ status: 'downloading' }));

// Keadaan PALING PENTING: unduhan selesai TETAPI belum terpasang.
r = S.ringkasPembaruan({ status: 'downloaded', version: '4.2.0' });
cek(r.nada === 'perlu', 'sudah diunduh → nada "perlu", bukan "aman" — pemasangan masih menunggu Owner', r);
cek(/[Mm]ulai ulang/.test(r.teks), 'kalimatnya menyebut tindakan yang dibutuhkan', r.teks);
cek(S.warnaStatus('perlu') !== S.warnaStatus('aman'),
  'warnanya BERBEDA dari "sudah terbaru" — dua keadaan itu tak boleh terlihat sama');

// Kegagalan tidak boleh diam.
r = S.ringkasPembaruan({ status: 'error', message: 'Bad credentials' });
cek(r.nada === 'galat' && r.teks.includes('Bad credentials'), 'galat ditampilkan APA ADANYA, bukan diringkas', r);
cek(/tidak dilaporkan/.test(S.ringkasPembaruan({ status: 'error' }).teks), 'galat tanpa pesan pun tetap dikatakan');

r = S.ringkasPembaruan({ status: 'dev-mode' });
cek(/pengembangan/i.test(r.teks), 'mode pengembangan dijelaskan, bukan tampak seperti kerusakan', r);

// Belum ada kabar → TIDAK menampilkan baris status sama sekali.
for (const kosong of [null, undefined, {}, { status: '' }, 'bukan objek']) {
  cek(S.ringkasPembaruan(kosong) === null, `belum ada kabar (${JSON.stringify(kosong)}) → tidak ada baris status`);
}
// Status asing tidak dikarang jadi kalimat menenangkan.
r = S.ringkasPembaruan({ status: 'entah-apa' });
cek(r.nada === 'netral' && r.teks.includes('entah-apa'), 'status tak dikenal disebut apa adanya', r);

// Versi
cek(S.bentukVersi('4.2.0') === 'v4.2.0', 'versi diberi awalan v');
cek(S.bentukVersi('v4.2.0') === 'v4.2.0', 'awalan v tidak dobel');
cek(S.bentukVersi(null) === 'tidak diketahui', 'tanpa versi → dikatakan tidak diketahui, bukan ditebak');

// ── 2. Proses utama benar-benar mengirim keadaan itu ─────────────────────────────────────────
// Cacat yang ketahuan saat mengerjakan ini: `update-downloaded` dan `error` HANYA masuk konsol &
// dialog, tak pernah dikirim ke layar. Tanpa perbaikan itu panel akan berhenti di "Mengunduh… 100%"
// selamanya, dan kegagalan pembaruan tak pernah terlihat — persis token rilis kedaluwarsa 29 Sep.
console.log('\n-- proses utama mengirimkannya --');

const MAIN = readFileSync(`${AKAR}/frontend/electron/main.cjs`, 'utf8');
for (const s of ['available', 'not-available', 'downloading', 'downloaded', 'error']) {
  cek(new RegExp(`status: '${s}'`).test(MAIN), `proses utama mengirim status '${s}'`);
}
const iUnduhSelesai = MAIN.indexOf("autoUpdater.on('update-downloaded'");
const blokUnduh = MAIN.slice(iUnduhSelesai, iUnduhSelesai + 700);
cek(/webContents\.send\('update-status'/.test(blokUnduh), 'unduhan selesai dikirim ke layar, bukan hanya dialog', blokUnduh.slice(0, 200));
const iGalat = MAIN.indexOf("autoUpdater.on('error'");
cek(/webContents\.send\('update-status'/.test(MAIN.slice(iGalat, iGalat + 600)), 'galat pembaruan dikirim ke layar');

// ── 3. TERPASANG di Pengaturan ───────────────────────────────────────────────────────────────
console.log('\n-- terpasang di Settings.jsx --');

const SET = readFileSync(`${AKAR}/frontend/src/components/Settings.jsx`, 'utf8');
cek(/import \{ ringkasPembaruan, bentukVersi, warnaStatus \}/.test(SET), 'modul status diimpor');
cek(/electronAPI\.getAppVersion\?\.\(\)/.test(SET), 'versi dibaca dari proses utama, bukan ditulis tangan di layar');
cek(/electronAPI\.onUpdateStatus\?\.\(/.test(SET), 'berlangganan kabar pembaruan');
cek(/electronAPI\.checkForUpdates\(\)/.test(SET), 'tombol periksa memanggil jembatan yang sudah ada');
cek(/\{bentukVersi\(versiApl\)\}/.test(SET), 'versi terpasang ditampilkan');
cek(/ringkasPembaruan\(kabarPembaruan\)/.test(SET), 'kabar diterjemahkan lewat modul, bukan di dalam JSX');

// Pendengar WAJIB dilepas — tanpa itu tiap kali Pengaturan dibuka menumpuk pendengar baru.
const iEffect = SET.indexOf('window.electronAPI.getAppVersion');
const blokEffect = SET.slice(iEffect - 300, iEffect + 700);
cek(/return \(\) => \{ try \{ lepas\?\.\(\); \}/.test(blokEffect),
  'pendengar dilepas saat komponen ditutup', blokEffect.slice(-260));

// Di web tidak ada Electron: panelnya tidak boleh dirender sama sekali.
cek(/const adaPembaruan = !!window\.electronAPI\?\.checkForUpdates;/.test(SET), 'keberadaan Electron diperiksa');
cek(/\{adaPembaruan && \(/.test(SET), 'panel tidak dirender di web/Mametlite', (SET.match(/adaPembaruan[^\n]*/g) || []));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

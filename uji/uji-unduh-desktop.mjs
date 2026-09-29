// UJI 2026-09-29 — tautan unduh aplikasi desktop untuk pengguna web.
//
// Permintaan Owner: sampai hari ini satu-satunya cara rekan kantor mendapatkan aplikasi adalah Owner
// MENGIRIMKAN berkas 190 MB itu sendiri, diulang setiap versi baru. Sekarang cukup membuka alamat web.
//
// Dua cacat yang paling mungkin, dan keduanya DIAM:
//   1. tombol memberi `latest.yml` atau `.blockmap` — berkasnya turun, tapi tidak bisa dipasang;
//   2. API GitHub gagal (batas laju 60/jam per IP) lalu tombolnya menuju ke mana-mana.
// Keduanya dijaga di bawah.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const U = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/unduhAplikasi.js`).href + '?v=' + Date.now());

console.log('uji-unduh-desktop v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// Bentuk rilis NYATA (diambil dari GitHub 29 Sep 2026), bukan karangan.
const RILIS_NYATA = {
  tag_name: 'v4.2.0', draft: false, prerelease: false,
  assets: [
    { name: 'latest.yml', size: 345, browser_download_url: 'https://github.com/mamet334/mamet-ai-releases/releases/download/v4.2.0/latest.yml' },
    { name: 'Mamet-AI-Setup-4.2.0.exe', size: 189960793, browser_download_url: 'https://github.com/mamet334/mamet-ai-releases/releases/download/v4.2.0/Mamet-AI-Setup-4.2.0.exe' },
    { name: 'Mamet-AI-Setup-4.2.0.exe.blockmap', size: 199045, browser_download_url: 'https://github.com/mamet334/mamet-ai-releases/releases/download/v4.2.0/Mamet-AI-Setup-4.2.0.exe.blockmap' },
  ],
};

// ── 1. Memilih berkas yang BENAR ─────────────────────────────────────────────────────────────
console.log('\n-- memilih pemasang --');

const info = U.pilihPemasang(RILIS_NYATA);
cek(info?.nama === 'Mamet-AI-Setup-4.2.0.exe', 'yang dipilih installer .exe', info);
cek(!/\.yml|\.blockmap/.test(info?.nama || ''),
  'CACAT DIAM TERTUTUP: latest.yml & .blockmap TIDAK pernah diberikan ke manusia — keduanya milik auto-updater', info);
cek(info.versi === '4.2.0', 'versi tanpa awalan v', info.versi);
cek(info.byte === 189960793, 'ukuran ikut terbaca');

// Draf & pra-rilis bukan untuk rekan kantor.
cek(U.pilihPemasang({ ...RILIS_NYATA, draft: true }) === null, 'rilis DRAF ditolak');
cek(U.pilihPemasang({ ...RILIS_NYATA, prerelease: true }) === null, 'PRA-RILIS ditolak');
// Rilis tanpa .exe (mis. hanya berkas updater) jangan dipaksakan.
cek(U.pilihPemasang({ tag_name: 'v9', assets: [{ name: 'latest.yml', size: 1, browser_download_url: 'x' }] }) === null,
  'rilis tanpa .exe → null, bukan memberikan berkas lain');
for (const buruk of [null, undefined, {}, 'teks', { assets: 'bukan array' }]) {
  cek(U.pilihPemasang(buruk) === null, `masukan buruk (${JSON.stringify(buruk)}) → null, bukan galat`);
}

// ── 2. Tombol tidak pernah buntu ─────────────────────────────────────────────────────────────
console.log('\n-- tidak pernah buntu --');

cek(U.alamatUnduh(info) === info.url, 'ada info → menuju berkasnya langsung');
cek(U.alamatUnduh(null) === U.ALAMAT_HALAMAN, 'tanpa info → menuju halaman rilis terbaru, bukan alamat kosong');
cek(/releases\/latest$/.test(U.ALAMAT_HALAMAN), 'halaman cadangan selalu menunjuk rilis TERBARU, bukan versi yang dipaku', U.ALAMAT_HALAMAN);
cek(U.teksUnduh(null) === 'Unduh aplikasi desktop', 'tanpa info, tombolnya tetap punya tulisan yang masuk akal');
cek(/v4\.2\.0/.test(U.teksUnduh(info)) && /181 MB/.test(U.teksUnduh(info)),
  'versi & ukuran ditampilkan SEBELUM diklik — 190 MB tak pantas mengejutkan orang di tengah unduhan', U.teksUnduh(info));

// Ukuran
cek(U.bentukUkuran(189960793) === '181 MB', 'ukuran dibulatkan ke MB', U.bentukUkuran(189960793));
cek(U.bentukUkuran(2 * 1024 * 1024 * 1024) === '2,0 GB', 'ukuran besar jadi GB');
for (const b of [0, -5, null, undefined, 'x']) cek(U.bentukUkuran(b) === '', `ukuran tak sah (${JSON.stringify(b)}) → kosong, bukan "NaN MB"`);

// ── 3. Gagal jaringan/batas laju tidak melempar ──────────────────────────────────────────────
console.log('\n-- API gagal --');

cek(await U.ambilRilisTerbaru(async () => ({ ok: false, status: 403 })) === null, 'batas laju (403) → null, bukan lemparan');
cek(await U.ambilRilisTerbaru(async () => { throw new Error('offline'); }) === null, 'jaringan mati → null, bukan lemparan');
const nyata = await U.ambilRilisTerbaru(async () => ({ ok: true, json: async () => RILIS_NYATA }));
cek(nyata?.nama === 'Mamet-AI-Setup-4.2.0.exe', 'jawaban sah diurai benar', nyata);

// ── 4. TERPASANG ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- terpasang --');

const TOMBOL = readFileSync(`${AKAR}/frontend/src/components/TombolUnduhDesktop.jsx`, 'utf8');
const LOGIN = readFileSync(`${AKAR}/frontend/src/components/LampLogin.jsx`, 'utf8');
const SET = readFileSync(`${AKAR}/frontend/src/components/Settings.jsx`, 'utf8');

cek(/import TombolUnduhDesktop from '\.\/TombolUnduhDesktop'/.test(LOGIN), 'tombol diimpor layar masuk');
cek(/<TombolUnduhDesktop ringkas \/>/.test(LOGIN), 'tombol dirender di layar masuk — bisa diunduh TANPA login dulu');
cek(/import TombolUnduhDesktop from '\.\/TombolUnduhDesktop'/.test(SET) && /<TombolUnduhDesktop \/>/.test(SET),
  'tombol juga ada di Pengaturan untuk pengguna web yang sudah masuk');

// Di aplikasi desktop tombol ini TIDAK boleh muncul — pembaruannya datang sendiri.
cek(/window\.electronAPI\?\.checkForUpdates/.test(TOMBOL), 'komponen memeriksa apakah sedang di desktop');
cek(/if \(diDesktop\) return null;/.test(TOMBOL), 'di aplikasi desktop tombolnya tidak dirender sama sekali');
cek(/\{!adaPembaruan && \(/.test(SET), 'bagian Pengaturan hanya muncul di web — pasangan panel Pembaruan');

// Pengambilan dibatalkan bila komponen ditutup lebih dulu.
cek(/let batal = false;/.test(TOMBOL) && /return \(\) => \{ batal = true; \};/.test(TOMBOL),
  'permintaan dibatalkan saat komponen ditutup — tidak menulis state pada komponen yang sudah hilang');

// Tautan keluar wajib aman.
cek(/rel="noopener noreferrer"/.test(TOMBOL), 'tautan keluar memakai noopener noreferrer');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

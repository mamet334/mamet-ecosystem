// UJI 2026-10-08 — galat yang sampai ke gelembung chat ws-assistant memakai bahasa Owner, dan
// kalimat manusia dari server tidak lagi dibuang.
//
// Keadaan sebelum (pengerasan ws-assistant): SEBELAS tempat di `AssistantService` mengarang teks
// tampilannya sendiri, dan `ConversationEngine:1424` menulis `⚠️ Error: ${err.message}` ke gelembung.
// Yang terbaca: `⚠️ Error: NO_API_KEY`, `⚠️ Error: HTTP error! status: 503`.
//
// Cacat yang paling mudah kembali, dan karena itu diuji di dua lapis (perilaku DAN kode):
// `AssistantService:878` dulu menulis `errorText = e.error || errorText` — mengambil KODE mesin dan
// membuang `e.message`, padahal `request_pipeline.ts:140-158` mengirim kalimat Indonesia yang
// menyebut tindakannya. Satu `|| kode` yang ditambahkan orang kemudian akan menghidupkannya lagi
// tanpa satu pun uji lain memerah.
//
// Empat sifat yang dijaga:
//
//   1. BAHASANYA     — judul & saran bahasa Indonesia, tanpa istilah teknis yang bocor.
//   2. JUJUR         — tanda tak dikenali → pesan UMUM, bukan tebakan yang terdengar yakin.
//   3. TIDAK MENELAN — teks teknisnya tetap ada; ia yang dikutip Owner saat melapor.
//   4. TIDAK MEMBUANG KALIMAT SERVER — kode tak dikenali + `message` → `message` yang dipakai.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const P = await import(
  pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/pesanGalat.js`).href + '?v=' + Date.now()
);

console.log(`uji-pesan-galat-ecosystem v1 · modul: ${P.VERSI_PESAN_GALAT_ECOSYSTEM}`);

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

// Istilah yang TIDAK boleh muncul di kalimat yang dibaca manusia. "API Key", "Settings" dan
// "Engineer" sengaja TIDAK termasuk: ketiganya nama benda yang Owner lihat di layarnya sendiri
// (label di Settings → AI Provider, dan nama mode). Melarangnya akan memaksa pesan jadi kabur —
// "buka pengaturan penyedia" lebih buruk daripada "buka Settings → AI Provider".
const BOCOR = /\b(error|failed|fetch|undefined|null|exception|stack|NetworkError|HTTP|status)\b/i;

const baca = (p) => readFileSync(resolve(AKAR, p), 'utf8');

/**
 * Buang komentar sebelum memeriksa KODE.
 *
 * Bukan kerapian — tanpa ini §5 memerah pada jalan pertama, dan merahnya SALAH. Komentar di
 * `AssistantService:882` menjelaskan cacat lamanya dengan mengutipnya (`e.error || errorText`),
 * jadi asersi "cacat itu tidak ada lagi" cocok dengan penjelasannya sendiri. Kembaran cermin dari
 * `uji-komentar-tak-berbohong`, yang hijau SECARA KELIRU karena kalimat sejarah memuat kata yang
 * dicarinya. Riwayat di komentar tidak boleh jadi sebab merah, dan tidak boleh jadi sebab hijau.
 *
 * `\r` dibuang LEBIH DULU: di JavaScript `.` tidak cocok dengan `\r` karena ia terminator baris,
 * jadi `/^\s*\/\/.*$/m` GAGAL pada berkas CRLF — dan berkas di repo ini campur (lihat J3c dan
 * `uji-salinan-mametlite.mjs`).
 *
 * BATASNYA, supaya tidak dipercaya lebih dari yang pantas: hanya komentar BLOK dan baris yang
 * SELURUHNYA komentar yang dibuang. Komentar yang menempel di belakang kode tidak — membuangnya
 * menuntut tahu mana `//` di dalam regex atau string, dan salah potong di situ akan menghapus kode
 * sungguhan lalu memberi hijau palsu. Hijau palsu lebih berbahaya daripada merah palsu.
 */
const tanpaKomentar = (kode) =>
  kode
    .replace(/\r/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

// ── 1. Tanda dikenali → bahasa Owner + tindakan ─────────────────────────────────────────────────
console.log('\n-- 1. tanda dikenali: bahasa manusia, dan ada tindakannya --');

const kasus = [
  ['Failed to fetch', /koneksi internet/i, 'jaringan mati (string)'],
  [{ kode: 'JARINGAN', teknis: 'Failed to fetch' }, /koneksi internet/i, 'jaringan mati (kode)'],
  [{ kode: 'NO_API_KEY' }, /API Key Anda/i, 'kunci belum ada'],
  [{ kode: 'ENGINEER_NO_API_KEY' }, /Engineer/i, 'kunci belum ada (Engineer)'],
  [{ kode: 'Invalid user ID' }, /masuk ulang/i, 'sesi tak dikenali server'],
  [{ kode: 'PESAN_KOSONG', teknis: 'token tidak ada' }, /masuk ulang|muat ulang/i, 'sesi tak lengkap'],
  [{ kode: 'ALIRAN_TERPUTUS', teknis: 'x' }, /terputus/i, 'aliran terputus'],
  [{ kode: 'ALIRAN_TAK_TERBACA' }, /tidak bisa dibaca/i, 'aliran tak terbaca'],
  [{ kode: 'SKILL_HTTP', status: 500 }, /skill/i, 'skill ditolak server'],
  [{ kode: 'JARINGAN_SKILL', teknis: 'Failed to fetch' }, /skill/i, 'jaringan saat skill'],
  [{ kode: 'UNDUH_PDF', teknis: 'signed url expired' }, /PDF/i, 'unduh PDF gagal'],
  [{ kode: 'RIWAYAT_KONVERSI', teknis: 'relation does not exist' }, /panel/i, 'riwayat tak termuat'],
  [{ kode: 'HAPUS_KONVERSI', teknis: 'storage error' }, /dihapus/i, 'hapus konversi gagal'],
  [{ status: 401 }, /ditolak penyedia/i, '401 kunci ditolak'],
  [{ status: 402 }, /[Ss]aldo/, '402 saldo kurang'],
  [{ status: 429 }, /[Tt]unggu/, '429 terlalu sering'],
  [{ status: 503 }, /[Ss]erver sedang bermasalah/, '503 server'],
  [{ status: 403 }, /tidak diizinkan/i, '403 ditolak'],
  ['Sesi tidak aktif — masuk ulang lalu coba lagi.', /masuk ulang/i, 'sesi kedaluwarsa (kalimat sendiri)'],
  ['Batas biaya harian Anda: plafon tercapai', /harian/i, 'plafon biaya harian'],
  ['The operation was aborted', /[Kk]irim ulang/, 'dibatalkan'],
];

for (const [masuk, polaJudul, nama] of kasus) {
  const h = P.pesanUntukPengguna(masuk);
  const kalimat = `${h.judul} ${h.saran || ''}`;
  cek(polaJudul.test(kalimat), `${nama} → dikenali`, h);
  cek(!BOCOR.test(h.judul), `${nama} → judulnya tanpa istilah teknis`, h.judul);
  cek(!!h.teknis && h.teknis !== 'tanpa keterangan', `${nama} → teks teknisnya ada`, h.teknis);
}

// Saran boleh null, tetapi hanya bila memang tak ada tindakan jujur. Untuk tabel KODE sekarang,
// setiap entri punya tindakan — jadi yang diuji: tak ada entri yang kehilangan sarannya diam-diam.
cek(
  kasus.filter(([m]) => typeof m === 'object' && m?.kode).every(([m]) => !!P.pesanUntukPengguna(m).saran),
  'setiap kode yang dikenali menyebut TINDAKAN, bukan hanya keadaan',
);

// ── 2. Aturan 4: kalimat manusia dari server tidak dibuang ──────────────────────────────────────
console.log('\n-- 2. kode tak dikenali + kalimat server → kalimat itu yang dipakai --');

const KALIMAT_SERVER = 'Aplikasi ini memerlukan API Key Anda sendiri. Buka Settings → AI Provider.';
const dariServer = P.pesanUntukPengguna({ kode: 'KODE_YANG_BELUM_ADA', pesan: KALIMAT_SERVER, status: 403 });
cek(dariServer.judul === KALIMAT_SERVER, 'kalimat `message` dipakai apa adanya', dariServer);
cek(/KODE_YANG_BELUM_ADA/.test(dariServer.teknis), 'kodenya tetap tercatat di teks teknis', dariServer.teknis);
cek(/HTTP 403/.test(dariServer.teknis), 'status HTTP ikut ke teks teknis', dariServer.teknis);

// Kode DIKENALI → kata-kata kita sendiri yang dipakai, bukan paragraf panjang server.
const dikenali = P.pesanUntukPengguna({ kode: 'NO_API_KEY', pesan: KALIMAT_SERVER, status: 403 });
cek(dikenali.judul !== KALIMAT_SERVER, 'kode yang dikenali memakai kalimat kita (lebih pendek)', dikenali.judul);
cek(dikenali.teknis.includes('NO_API_KEY'), 'dan paragraf servernya tidak hilang — ia di teks teknis', dikenali.teknis);

// Tanpa `message`, kode asing TIDAK boleh ditampilkan sebagai judul (itu kembali ke keadaan lama).
const kodeTelanjang = P.pesanUntukPengguna({ kode: 'KODE_ASING_XYZ', status: 500 });
cek(!/KODE_ASING_XYZ/.test(kodeTelanjang.judul), 'kode mesin tidak dipakai sebagai judul', kodeTelanjang);
cek(/KODE_ASING_XYZ/.test(kodeTelanjang.teknis), 'tetapi tetap ada di teks teknis', kodeTelanjang.teknis);

// ── 3. Aturan 2: tanda tak dikenali tidak ditebak ───────────────────────────────────────────────
console.log('\n-- 3. tanda tak dikenali: umum, bukan tebakan yakin --');

const TUDUHAN = /koneksi internet|saldo|API Key|masuk ulang|skill|PDF|harian/i;
for (const aneh of ['QWERTY_ZZZ', '', 'at Object.<anonymous> (/x.js:1:1)', '{"a":1}']) {
  const h = P.pesanUntukPengguna(aneh);
  cek(!BOCOR.test(h.judul), `"${aneh.slice(0, 18)}" → judul bersih`, h.judul);
  cek(
    !TUDUHAN.test(`${h.judul} ${h.saran || ''}`),
    `"${aneh.slice(0, 18)}" → tidak menuduh sebab yang tidak diketahui`,
    h,
  );
}
cek(P.pesanUntukPengguna('').teknis === 'tanpa keterangan', 'teks kosong tetap punya keterangan');
cek(P.pesanUntukPengguna(null).teknis === 'tanpa keterangan', 'null tidak melempar & tetap punya teknis');
cek(P.pesanUntukPengguna({ teknis: 'teks mentah' }).teknis === 'teks mentah', 'objek hanya-teknis ditangani');
cek(P.pesanUntukPengguna(new Error('Failed to fetch')).judul.length > 0, 'Error asli ditangani');

// ── 4. Aturan 3: blok untuk gelembung — teks biasa, teknis ikut, tidak kebablasan ───────────────
console.log('\n-- 4. blok gelembung: teks biasa, teknis ikut, panjangnya terkendali --');

const blok = P.blokGalat({ kode: 'NO_API_KEY', status: 403 });
cek(blok.startsWith('⚠️ '), 'blok diawali penanda yang sama dengan sebelumnya', blok);
cek(blok.includes('\n(teknis: '), 'teks teknis ikut, di barisnya sendiri', blok);
cek(!/\*\*|__/.test(blok), 'TIDAK memakai Markdown — gelembung dirender sebagai teks biasa', blok);
cek(!/\[object/.test(P.blokGalat({ kode: 'JARINGAN', teknis: 'x' })), 'objek tidak bocor sebagai [object Object]');

const panjang = 'A'.repeat(1200);
const blokPanjang = P.blokGalat({ teknis: panjang });
cek(blokPanjang.length < P.BATAS_TEKNIS + 300, 'badan galat raksasa dipotong, bukan membanjiri gelembung', blokPanjang.length);
cek(blokPanjang.includes('…'), 'dan potongannya ditandai, bukan diam-diam hilang');
cek(P.pesanUntukPengguna({ teknis: panjang }).teknis.length === 1200, 'teks teknis UTUH di objeknya — yang dipotong hanya tampilannya');

cek(P.satuBaris({ kode: 'JARINGAN' }).length > 0 && !P.satuBaris({ kode: 'JARINGAN' }).includes('teknis:'),
  'satuBaris untuk tempat sempit: tanpa teks teknis');

// ── 5. Kode: tak ada lagi yang mengarang teks tampilan ──────────────────────────────────────────
console.log('\n-- 5. kode: layanan melaporkan tanda, layar yang menyusun kalimat --');

const AS = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));
const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
const RK = tanpaKomentar(baca('frontend/src/components/workbench/RiwayatKonversi.jsx'));

cek(!/onError\?\.\(`⚠️ Error:/.test(AS), 'AssistantService tidak lagi menulis "⚠️ Error:" ke layar');
cek(!/onError\?\.\(`Gagal menghubungi server/.test(AS), 'teks "Gagal menghubungi server: …" tidak lagi disusun di layanan');
cek(!/\.error \|\| errorText/.test(AS), 'cacat `e.error || errorText` (kalimat server dibuang) tidak ada lagi');
cek(/pesan = e\?\.message/.test(AS), 'dan `message` dari server benar-benar dibaca');

const panggilan = (AS.match(/onError\?\.\(/g) || []).length;
const terstruktur = (AS.match(/onError\?\.\(\{/g) || []).length;
cek(panggilan === terstruktur && terstruktur >= 11,
  `SEMUA ${panggilan} panggilan onError memakai tanda terstruktur (${terstruktur})`, { panggilan, terstruktur });

cek(/import \{ blokGalat \} from '\.\.\/\.\.\/core\/runtime\/services\/pesanGalat\.js'/.test(CE),
  'ConversationEngine memakai penerjemah');
cek(/const errorMsg = blokGalat\(galat\)/.test(CE), 'jalur onError diterjemahkan di layar');
cek(/const pesanGalat = blokGalat\(err\)/.test(CE), 'catch handleSend juga diterjemahkan');
cek(!/`⚠️ Error: \$\{err\.message\}`/.test(CE), 'dan teks mentah `err.message` tidak lagi ditulis ke gelembung');
cek(/if \(kendali\.signal\.aborted\) \{/.test(CE),
  'dibatalkan Owner tetap DIBEDAKAN dari galat (tombol Berhenti tidak memunculkan peringatan)');

cek(!/setPesan\(err\.message\)/.test(RK), 'RiwayatKonversi tidak lagi menampilkan err.message mentah');
cek(/whitespace-pre-line/.test(RK), 'dan baris teknisnya benar-benar turun ke bawah, bukan menempel');

// Jalur yatim tidak ikut diubah — dan itu keputusan, bukan kelupaan. `EngineerChat.jsx` nol
// pengimpor (E3 `ROADMAP-SIAP-PENGGUNA.md`), jadi menyentuhnya hanya menambah kode mati yang rapi.
const EC = tanpaKomentar(baca('frontend/src/components/EngineerChat.jsx'));
cek(/⚠️ Error: \$\{err\.message\}/.test(EC),
  'EngineerChat (yatim, nol pengimpor) SENGAJA tidak disentuh — bila uji ini merah, berkas itu sudah dipakai lagi dan ikut perlu penerjemah');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

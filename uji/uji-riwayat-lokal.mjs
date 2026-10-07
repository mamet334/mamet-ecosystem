// UJI 2026-10-08 — riwayat chat Mametlite tidak boleh membuat layar putih, dan tidak boleh diam.
//
// Cacat yang dijaga (M2, `ROADMAP-SIAP-PENGGUNA.md`): `JSON.parse(localStorage.getItem(…))` dipanggil
// TANPA `try` di dalam inisialisator `useState`. Satu nilai rusak = layar putih — dan karena nilai
// buruknya tetap tersimpan, layar putih itu KEMBALI setiap muat ulang. Mametlite juga tidak punya
// satu pun error boundary, jadi tak ada yang menangkapnya.
//
// Empat sifat yang diuji, dan yang ketiga paling mudah hilang saat orang "memperbaiki" ini:
//
//   1. TIDAK JATUH   — apa pun isi simpanannya, hasilnya riwayat yang sah.
//   2. BENTUK        — `'{}'` itu JSON sah tetapi membuat `.find()` jatuh beberapa baris kemudian.
//                      Menangkap `JSON.parse` saja hanya MEMINDAHKAN kejatuhannya.
//   3. TIDAK DIAM    — gagal baca ≠ riwayat kosong. Kalau keduanya dijawab sama, pengguna menyangka
//                      riwayatnya memang tidak ada. Aturan yang sama dengan TMN-0006.
//   4. KOSONG WAJAR  — belum pernah ada riwayat BUKAN masalah, dan tidak boleh memunculkan peringatan.
//
// Simpanan disuntik, bukan `localStorage` asli: kuota penuh dan `getItem` yang melempar adalah dua
// keadaan yang justru paling penting diuji dan paling sulit dibuat di peramban.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const R = await import(
  pathToFileURL(`${AKAR}/mametlite/src/lib/riwayatLokal.js`).href + '?v=' + Date.now()
);

console.log(`uji-riwayat-lokal v1 · modul: ${R.VERSI_RIWAYAT}`);

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

/** Simpanan tiruan. `lempar` memaksa kegagalan yang tak bisa dibuat di peramban sungguhan. */
function simpananTiruan(awal = {}, lempar = {}) {
  const isi = { ...awal };
  return {
    isi,
    getItem(k) {
      if (lempar.getItem) throw lempar.getItem;
      return Object.prototype.hasOwnProperty.call(isi, k) ? isi[k] : null;
    },
    setItem(k, v) {
      if (lempar.setItem) throw lempar.setItem;
      isi[k] = v;
    },
    removeItem(k) {
      if (lempar.removeItem) throw lempar.removeItem;
      delete isi[k];
    },
  };
}

const RIWAYAT_SAH = [
  { id: 1, title: 'Percakapan Baru', messages: [{ role: 'assistant', content: 'Halo' }] },
];

// ── 1. Tidak jatuh, apa pun isinya ──────────────────────────────────────────────────────────────
console.log('\n-- 1. tidak jatuh & riwayatnya selalu sah --');

const isiRusak = [
  ['{rusak', 'JSON terpotong — bentuk kerusakan yang paling mungkin terjadi'],
  ['', 'string kosong'],
  ['null', 'null'],
  ['"teks"', 'JSON sah tetapi string'],
  ['123', 'JSON sah tetapi angka'],
  ['{}', 'JSON sah tetapi objek — INI yang lolos kalau hanya JSON.parse ditangkap'],
  ['[]', 'array kosong'],
  ['[{}]', 'array berisi objek tanpa bentuk'],
  ['[{"id":1}]', 'ada id tetapi tanpa messages'],
  ['[{"id":1,"messages":"bukan array"}]', 'messages bukan array'],
  ['[{"id":1,"messages":[{"isi":"x"}]}]', 'pesan tanpa role'],
];

for (const [mentah, nama] of isiRusak) {
  let h;
  try {
    h = R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: mentah }));
  } catch (e) {
    cek(false, `${nama} → MELEMPAR (${e.message})`);
    continue;
  }
  cek(R.sahkanRiwayat(h.riwayat), `${nama} → riwayat sah`, h.riwayat);
}

// ── 2. Tidak diam: gagal baca ≠ riwayat kosong ──────────────────────────────────────────────────
console.log('\n-- 2. tidak diam, dan "kosong" tidak dilaporkan sebagai masalah --');

cek(
  !!R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: '{rusak' })).masalah,
  'JSON rusak → ADA masalah untuk pengguna, bukan diam',
);
cek(
  !!R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: '{}' })).masalah,
  'bentuk tak dikenali → ADA masalah',
);

const kosong = R.bacaRiwayat(simpananTiruan({}));
cek(kosong.masalah === null, 'belum pernah ada riwayat → masalah null (ini wajar, bukan galat)');
cek(R.sahkanRiwayat(kosong.riwayat), 'dan riwayat awalnya sah');

const kosongString = R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: '' }));
cek(kosongString.masalah === null, 'string kosong juga dianggap wajar, bukan rusak');

const utuh = R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: JSON.stringify(RIWAYAT_SAH) }));
cek(utuh.masalah === null, 'riwayat utuh → nol masalah');
cek(utuh.riwayat[0].messages[0].content === 'Halo', 'dan isinya dipulangkan APA ADANYA, tidak diganti');

// Pesan masalahnya untuk orang awam, bukan untuk pemrogram.
const pesanRusak = R.bacaRiwayat(simpananTiruan({ [R.KUNCI_RIWAYAT]: '{rusak' })).masalah;
cek(
  !/JSON|parse|localStorage|undefined|Error/i.test(pesanRusak),
  'pesannya tanpa istilah teknis (JSON/parse/localStorage)',
  pesanRusak,
);
cek(/percakapan/i.test(pesanRusak), 'dan memakai kata yang pengguna kenal ("percakapan")', pesanRusak);

// ── 3. Simpanan yang melempar & tidak ada sama sekali ───────────────────────────────────────────
console.log('\n-- 3. simpanan yang melempar / tidak ada --');

let h = R.bacaRiwayat(simpananTiruan({}, { getItem: new Error('diblokir') }));
cek(R.sahkanRiwayat(h.riwayat) && !!h.masalah, '`getItem` melempar → tetap sah DAN bersuara', h);

h = R.bacaRiwayat(null);
cek(R.sahkanRiwayat(h.riwayat) && !!h.masalah, 'tanpa simpanan sama sekali (mode privat) → sah DAN bersuara', h);

// ── 4. Menyimpan tidak pernah melempar, dan kuota dibedakan ─────────────────────────────────────
console.log('\n-- 4. menyimpan: tidak pernah melempar, kuota punya tindakan --');

const s = simpananTiruan({});
let hs = R.simpanRiwayat(RIWAYAT_SAH, s);
cek(hs.ok && hs.masalah === null, 'simpan biasa berhasil tanpa masalah');
cek(JSON.parse(s.isi[R.KUNCI_RIWAYAT])[0].id === 1, 'dan isinya benar-benar tertulis');

const galatKuota = Object.assign(new Error('penuh'), { name: 'QuotaExceededError' });
hs = R.simpanRiwayat(RIWAYAT_SAH, simpananTiruan({}, { setItem: galatKuota }));
cek(hs.ok === false && !!hs.masalah, 'kuota penuh → tidak melempar, memulangkan masalah', hs);
cek(
  /hapus/i.test(hs.masalah) && /percakapan/i.test(hs.masalah),
  'dan pesannya menyebut TINDAKAN yang bisa pengguna lakukan (hapus percakapan lama)',
  hs.masalah,
);

hs = R.simpanRiwayat(RIWAYAT_SAH, simpananTiruan({}, { setItem: new Error('entah') }));
cek(hs.ok === false && !!hs.masalah, 'galat lain → tetap tidak melempar & bersuara', hs);
cek(
  !/hapus beberapa percakapan/i.test(hs.masalah),
  'tetapi TIDAK menyuruh hapus percakapan — tindakan itu hanya benar untuk kuota',
  hs.masalah,
);

cek(R.simpanRiwayat(RIWAYAT_SAH, null).ok === false, 'tanpa simpanan → false, bukan melempar');

// ── 5. Hapus hanya menyentuh riwayat — bukan kunci berbayar pengguna ────────────────────────────
console.log('\n-- 5. hapus hanya riwayat, kunci OpenRouter pengguna TIDAK disentuh --');

const sDuaKunci = simpananTiruan({
  [R.KUNCI_RIWAYAT]: JSON.stringify(RIWAYAT_SAH),
  'x-byok-openrouter': 'sk-or-punya-pengguna',
});
cek(R.hapusRiwayat(sDuaKunci) === true, 'hapus berhasil');
cek(!(R.KUNCI_RIWAYAT in sDuaKunci.isi), 'riwayat hilang');
cek(
  sDuaKunci.isi['x-byok-openrouter'] === 'sk-or-punya-pengguna',
  'kunci OpenRouter pengguna TETAP — ia membayar untuk itu',
  sDuaKunci.isi,
);
cek(R.hapusRiwayat(simpananTiruan({}, { removeItem: new Error('x') })) === false, 'gagal hapus → false, bukan melempar');

// ── 6. TERPASANG ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 6. terpasang: jalur lama benar-benar hilang dari aplikasi --');

const tanpaKomentar = (teks) =>
  teks
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((b) => !/^\s*(\/\/|\{\s*\/\*)/.test(b))
    .join('\n');

const APP = readFileSync(`${AKAR}/mametlite/src/App.jsx`, 'utf8');
const APP_KODE = tanpaKomentar(APP);

cek(
  !/JSON\.parse\(\s*(saved|localStorage)/.test(APP_KODE),
  'App.jsx tidak lagi mem-parse localStorage langsung di jalur render',
);
cek(
  !/localStorage\.(getItem|setItem)\(\s*['"]mametlite_conversations/.test(APP_KODE),
  'App.jsx tidak lagi menyentuh kunci riwayat langsung — semuanya lewat satu pintu',
);
cek(/bacaRiwayat/.test(APP_KODE) && /simpanRiwayat/.test(APP_KODE), 'App.jsx memakai modul riwayat');
cek(/masalahRiwayat/.test(APP_KODE), 'dan masalahnya BENAR-BENAR dirender, bukan hanya disimpan di state');

// Penulisan per token SSE: penundaannya harus ada, kalau tidak batas ±5 MB kembali terancam.
cek(
  /setTimeout\([\s\S]{0,200}simpanRiwayat/.test(APP_KODE),
  'penyimpanan ditunda (tidak lagi menulis seluruh array tiap token SSE)',
);
cek(/pagehide/.test(APP_KODE), 'dan disimpan sekali lagi saat halaman ditinggalkan — penundaan tak boleh memakan arus terakhir');

const MAIN = tanpaKomentar(readFileSync(`${AKAR}/mametlite/src/main.jsx`, 'utf8'));
cek(/<BatasGalat>/.test(MAIN), 'main.jsx membungkus aplikasi dengan BatasGalat');
cek(/<BatasGalat>[\s\S]*<App \/>[\s\S]*<\/BatasGalat>/.test(MAIN), 'dan App benar-benar ADA DI DALAMNYA');

const BATAS = readFileSync(`${AKAR}/mametlite/src/lib/BatasGalat.jsx`, 'utf8');
cek(/getDerivedStateFromError/.test(BATAS), 'BatasGalat menangkap galat render');
cek(/hapusRiwayat/.test(BATAS), 'dan menawarkan jalan keluar yang menghapus riwayat');
cek(
  !/localStorage\.clear|removeItem\(\s*['"]x-byok/.test(BATAS),
  'tanpa menghapus kunci OpenRouter pengguna — `localStorage.clear()` akan melakukannya',
);
cek(/Pesan teknis/.test(BATAS), 'sebabnya tetap ditampilkan — pengguna HP tidak punya DevTools untuk melaporkannya');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);

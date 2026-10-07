// UJI 2026-10-08 — Mametlite bisa dipakai dari HP (M3, Item 72).
//
// Ukurannya ditetapkan Owner 28 September, saat mengoreksi usul asisten untuk menutup Item 72:
// *"itu tentang kerapian suatu aplikasi di berbagai perangkat agar tidak membingungkan pengguna."*
// Kenyamanan Owner bukan ukurannya — `mametlite.vercel.app` punya pengguna di luar Owner, dan
// merekalah yang membukanya dari HP.
//
// Keadaan sebelum perbaikan, diukur 7 Okt: **0 dari 102 `className`** punya prefiks responsif.
// Bilah sisi `w-80` (320px, tanpa syarat) menyisakan ±55px untuk chat di layar 375px, dan `min-w-0`
// di kolom chat membuatnya MENCIUT alih-alih menggulir — jadi chatnya benar-benar jadi sliver.
// Nol drawer: tak ada satu pun `drawer`/`hamburger`/`sidebarOpen` di berkas itu.
//
// Uji ini menjaga SIFAT tata letaknya, bukan ejaan kelasnya — pelajaran `44d4f9d`. Ia tidak memeriksa
// "apakah ada `md:w-80`", melainkan: apakah bilah sisinya bisa disembunyikan, apakah ada jalan
// membukanya di layar kecil, dan apakah kendali-kendalinya terjangkau tanpa hover.
//
// Yang TIDAK bisa diuji di sini: rupanya. Itu dibuktikan dengan tangkapan layar 375px di log
// `2026-10-08-mametlite-dari-hp.md`, dan oleh Owner sendiri yang membukanya dari HP.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const APP = readFileSync(`${AKAR}/mametlite/src/App.jsx`, 'utf8');

console.log('uji-tata-letak-hp v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

// ── 1. Angka yang dulu nol ──────────────────────────────────────────────────────────────────────
console.log('\n-- 1. prefiks responsif benar-benar dipakai --');

const jumlahClassName = (APP.match(/className=/g) || []).length;
const prefiks = APP.match(/\b(sm|md|lg|xl|2xl):[a-z[-]/g) || [];
cek(prefiks.length > 0, `ada prefiks responsif (dulu 0 dari ${jumlahClassName} className)`, prefiks.length);
cek(
  prefiks.length >= 10,
  `jumlahnya cukup untuk sebuah tata letak, bukan satu kelas simbolis (${prefiks.length})`,
  prefiks.length,
);

// `h-screen` di iOS Safari tidak memotong chrome peramban, jadi bilah masukan duduk di bawahnya.
cek(!/\bh-screen\b/.test(APP), '`h-screen` sudah tidak dipakai — diganti `h-dvh` (bilah masukan iOS)');
cek(/\bh-dvh\b/.test(APP), 'dan `h-dvh` benar-benar dipakai');

// ── 2. Bilah sisi bisa disembunyikan, dan ada jalan membukanya ──────────────────────────────────
console.log('\n-- 2. laci: bisa disembunyikan DAN bisa dibuka --');

cek(/laciTerbuka/.test(APP), 'ada keadaan buka/tutup untuk bilah sisi (dulu nol)');

// Sifatnya: di layar kecil ia bergeser keluar layar; di `md` ke atas ia menetap.
const blokSisi = (APP.match(/\{\/\* Sidebar[\s\S]{0,700}/) || [''])[0];
cek(/-translate-x-full/.test(blokSisi), 'tertutup → digeser keluar layar, bukan sekadar disempitkan', blokSisi.slice(0, 200));
cek(/md:translate-x-0/.test(blokSisi), 'di `md` ke atas ia SELALU terlihat — Owner di laptop tidak kehilangan apa pun');
cek(/md:static/.test(blokSisi), 'dan di `md` ke atas ia menetap, tidak melayang di atas chat');

// Tanpa ini, lacinya tertutup selamanya di HP — tombolnya bukan hiasan.
cek(
  /aria-label="Buka daftar percakapan"/.test(APP),
  'ada tombol MEMBUKA laci di layar kecil',
);
cek(
  /md:hidden[^>]*\n?[^>]*aria-label="Buka daftar percakapan"|aria-label="Buka daftar percakapan"/.test(APP) &&
    /md:hidden/.test(APP),
  'dan tombol itu hanya di layar kecil (`md:hidden`)',
);
cek(/aria-label="Tutup daftar percakapan"/.test(APP), 'ada tombol MENUTUP laci');

// Laci yang tetap terbuka sesudah memilih percakapan berarti pengguna memilih lalu tetap tidak
// melihat chatnya — perbaikan yang setengah jalan.
cek(
  /setCurrentConvId\(conv\.id\);\s*setLaciTerbuka\(false\)/.test(APP),
  'memilih percakapan ikut menutup laci',
);
cek(
  /setCurrentConvId\(newId\);[\s\S]{0,120}setLaciTerbuka\(false\)/.test(APP),
  'membuat percakapan baru juga menutup laci',
);

// ── 3. Kendali terjangkau tanpa hover ───────────────────────────────────────────────────────────
console.log('\n-- 3. kendali terjangkau di layar sentuh --');

// Kodenya sendiri sudah tahu penggunanya di HP: labelRamah.js:17-18 menulis "Tidak ada kursor, jadi
// tidak ada tooltip". Tiga kendali tetap disembunyikan di balik hover.
const hoverTelanjang = APP.match(/(?<!md:)\bopacity-0 group-hover:opacity-100/g) || [];
cek(
  hoverTelanjang.length === 0,
  'nol kendali yang HANYA muncul saat hover (dulu 3: hapus dokumen, hapus chat, salin)',
  hoverTelanjang,
);
cek(
  (APP.match(/opacity-100 md:opacity-0 md:group-hover:opacity-100/g) || []).length === 3,
  'ketiganya terlihat di layar kecil, dan tetap rapi-saat-hover di `md` ke atas',
);

// ── 4. Yang menyempitkan kolom chat di 375px ────────────────────────────────────────────────────
console.log('\n-- 4. ruang chat tidak dimakan padding & label --');

cek(/px-3 md:px-6/.test(APP), 'padding header mengecil di layar kecil (dulu `px-6` tetap, 48px dari ±55px)');
cek(/p-4 md:p-6/.test(APP), 'padding daftar pesan mengecil di layar kecil');

// Tiga tombol berlabel penuh ≈380px tidak muat di kolom chat HP, dan tak ada flex-wrap/overflow.
const labelMode = APP.match(/hidden lg:inline">(Database RAG|Web Search|Deep Research)</g) || [];
cek(labelMode.length === 3, 'ketiga label mode hanya muncul saat ada ruang (`lg`)', labelMode);
cek(
  (APP.match(/aria-label="(Database RAG|Web Search|Deep Research)"/g) || []).length === 3,
  'dan saat labelnya tersembunyi, fungsinya tetap bernama (aria-label) — ikon saja tidak cukup',
);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);


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

console.log('\n-- 1. prefiks responsif benar-benar dipakai --');

const jumlahClassName = (APP.match(/className=/g) || []).length;
const prefiks = APP.match(/\b(sm|md|lg|xl|2xl):[a-z[-]/g) || [];
cek(prefiks.length > 0, `ada prefiks responsif (dulu 0 dari ${jumlahClassName} className)`, prefiks.length);
cek(
  prefiks.length >= 10,
  `jumlahnya cukup untuk sebuah tata letak, bukan satu kelas simbolis (${prefiks.length})`,
  prefiks.length,
);

cek(!/\bh-screen\b/.test(APP), '`h-screen` sudah tidak dipakai — diganti `h-dvh` (bilah masukan iOS)');
cek(/\bh-dvh\b/.test(APP), 'dan `h-dvh` benar-benar dipakai');

console.log('\n-- 2. laci: bisa disembunyikan DAN bisa dibuka --');

cek(/laciTerbuka/.test(APP), 'ada keadaan buka/tutup untuk bilah sisi (dulu nol)');

const blokSisi = (APP.match(/\{\/\* Sidebar[\s\S]{0,700}/) || [''])[0];
cek(/-translate-x-full/.test(blokSisi), 'tertutup → digeser keluar layar, bukan sekadar disempitkan', blokSisi.slice(0, 200));
cek(/md:translate-x-0/.test(blokSisi), 'di `md` ke atas ia SELALU terlihat — Owner di laptop tidak kehilangan apa pun');
cek(/md:static/.test(blokSisi), 'dan di `md` ke atas ia menetap, tidak melayang di atas chat');

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

cek(
  /setCurrentConvId\(conv\.id\);\s*setLaciTerbuka\(false\)/.test(APP),
  'memilih percakapan ikut menutup laci',
);
cek(
  /setCurrentConvId\(newId\);[\s\S]{0,120}setLaciTerbuka\(false\)/.test(APP),
  'membuat percakapan baru juga menutup laci',
);

console.log('\n-- 3. kendali terjangkau di layar sentuh --');

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

console.log('\n-- 4. ruang chat tidak dimakan padding & label --');

cek(/px-3 md:px-6/.test(APP), 'padding header mengecil di layar kecil (dulu `px-6` tetap, 48px dari ±55px)');
cek(/p-4 md:p-6/.test(APP), 'padding daftar pesan mengecil di layar kecil');

const labelMode = APP.match(/hidden lg:inline">(Database RAG|Web Search|Deep Research)</g) || [];
cek(labelMode.length === 3, 'ketiga label mode hanya muncul saat ada ruang (`lg`)', labelMode);
cek(
  (APP.match(/aria-label="(Database RAG|Web Search|Deep Research)"/g) || []).length === 3,
  'dan saat labelnya tersembunyi, fungsinya tetap bernama (aria-label) — ikon saja tidak cukup',
);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);

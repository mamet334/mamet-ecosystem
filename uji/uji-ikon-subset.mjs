// UJI 2026-09-29 — setiap ikon yang dipakai layar HARUS ada di subset font.
//
// Ini kelas cacat yang sudah terjadi TIGA kali:
//   23 Sep  `data_usage`, `history_toggle_off` → tampil sebagai tulisan "DATA_USAGE"
//   14 Sep  `expand_more`                      → diganti `chevron_right` diputar 90°
//   29 Sep  `system_update`                    → tampil sebagai "TEM_UPDATE" menimpa judul panel
//
// Sebabnya selalu sama: font ikon yang dibundel bukan font penuh, melainkan SUBSET yang dibuat
// `scripts/perbarui-ikon.mjs` dari `daftar-ikon.txt` (72 ikon). Nama di luar subset tidak menjadi
// gambar — ia dirender sebagai LIGATUR GAGAL, yaitu teksnya sendiri, berukuran ikon.
//
// Kenapa selalu lolos: tidak ada yang merah. Build sukses, uji hijau, dan cacatnya hanya terlihat
// oleh mata manusia yang kebetulan membuka layar itu. Uji ini mengubahnya jadi merah.
//
// Dua uji sebelumnya (uji-konteks-chat, uji-padatkan-konteks) memeriksa ikon TERTENTU di layar
// tertentu. Yang ini memeriksa SELURUH src sekaligus, jadi ikon baru di layar mana pun ikut terjaga.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src';

console.log('uji-ikon-subset v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const subset = new Set(
  readFileSync(`${AKAR}/assets/fonts/daftar-ikon.txt`, 'utf8')
    .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')),
);
cek(subset.size > 50, `subset font terbaca (${subset.size} ikon)`);

/**
 * Hanya nama LITERAL yang diperiksa:
 *   <span className="material-symbols-outlined">refresh</span>     ← diperiksa
 *   <span className="material-symbols-outlined">{'refresh'}</span> ← diperiksa
 *   <span className="material-symbols-outlined">{icon}</span>      ← DILEWATI (nilainya dari data)
 * Tanpa pengecualian terakhir, `MobileBottomNav.jsx` akan merah karena variabelnya bernama `icon` —
 * merah palsu, dan merah palsu membuat uji diabaikan.
 */
export function namaIkonLiteral(isi) {
  const hasil = [];
  const pola = /material-symbols-outlined[^>]*>\s*([^<]*?)\s*</g;
  for (const m of isi.matchAll(pola)) {
    const teks = m[1].trim();
    if (!teks) continue;
    const kutip = teks.match(/^\{\s*['"]([a-z0-9_]+)['"]\s*\}$/);
    if (kutip) { hasil.push(kutip[1]); continue; }
    if (teks.startsWith('{')) continue;              // ekspresi/variabel — nilainya tak diketahui di sini
    if (/^[a-z0-9_]+$/.test(teks)) hasil.push(teks);
  }
  return hasil;
}

// Pemindaian
const dipakai = new Map();
(function jalan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') jalan(p); continue; }
    if (!/\.(jsx?|tsx?)$/.test(e.name)) continue;
    for (const nama of namaIkonLiteral(readFileSync(p, 'utf8'))) {
      if (!dipakai.has(nama)) dipakai.set(nama, new Set());
      dipakai.get(nama).add(path.relative(AKAR, p).split(path.sep).join('/'));
    }
  }
})(AKAR);

console.log(`\n-- ${dipakai.size} nama ikon literal ditemukan di seluruh src --`);
const hilang = [...dipakai.keys()].filter((k) => !subset.has(k)).sort();
cek(hilang.length === 0,
  'SEMUA ikon yang dipakai ada di subset font — tak ada yang akan tampil sebagai tulisan',
  hilang.map((h) => `${h} (${[...dipakai.get(h)].join(', ')})`));

// Ikon yang pernah gagal, dijaga namanya supaya tidak dipakai lagi tanpa menambah subset.
for (const buruk of ['system_update', 'data_usage', 'history_toggle_off', 'expand_more']) {
  cek(!dipakai.has(buruk) || subset.has(buruk),
    `ikon yang pernah gagal tidak dipakai lagi tanpa masuk subset: ${buruk}`);
}
cek(dipakai.has('refresh') && subset.has('refresh'), 'panel Pembaruan memakai ikon yang ada di subset');

// ── UJI KENDALI (langkah 8) — pemindainya harus BISA merah ───────────────────────────────────
console.log('\n-- kendali: pemindai bisa merah --');
const contohSalah = '<span className="material-symbols-outlined text-primary">system_update</span>';
cek(namaIkonLiteral(contohSalah).join() === 'system_update', 'nama literal tertangkap', namaIkonLiteral(contohSalah));
cek(!subset.has('system_update'), 'dan system_update memang TIDAK ada di subset — inilah yang live jadi "TEM_UPDATE"');

const contohDinamis = '<span className="material-symbols-outlined text-[22px]">{icon}</span>';
cek(namaIkonLiteral(contohDinamis).length === 0, 'ekspresi {icon} DILEWATI — tanpa ini MobileBottomNav merah palsu');
cek(namaIkonLiteral(`<span className="material-symbols-outlined">{'refresh'}</span>`).join() === 'refresh',
  "bentuk {'nama'} tetap diperiksa");
cek(namaIkonLiteral('<span className="lain">refresh</span>').length === 0, 'span lain tidak ikut terbaca');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

// UJI 2026-10-19 — tak ada komentar JSX yang bocor jadi teks di layar.
//
// Kenapa ada: pemeriksaan "error tersembunyi" 19 Okt menemukan RiwayatKonversi.jsx menampilkan kalimat
// "` di posisi ekspresi dibaca sebagai literal objek — build gagal. */}" di panel Riwayat Konversi sejak 8 Okt.
// Komentarnya MENULIS contoh pembuka-penutup komentar di dalam dirinya; penutup contoh itu mengakhiri komentar lebih
// awal, dan sisa kalimatnya menjadi teks JSX. Tak ada uji yang merah — build hanya memperingatkan, dan hanya karena
// kebetulan sisa kalimatnya memuat `}`. Sisa tanpa `}` bocor tanpa peringatan sama sekali.
//
// Yang dijaga, dua lapis:
//   1. esbuild mengompilasi SETIAP .jsx tanpa satu peringatan pun (menangkap "} tidak sah di dalam elemen JSX" dll.).
//   2. Tak ada komentar JSX `{/* … */}` yang memuat pembuka komentar lain di dalamnya — pola penyebabnya, yang bisa
//      bocor tanpa peringatan.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
console.log('uji-komentar-jsx v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
};

const jalan = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'node_modules' ? [] : jalan(join(d, e.name))) : /\.jsx$/.test(e.name) ? [join(d, e.name)] : []);
const berkas = [...jalan(join(AKAR, 'frontend/src')), ...jalan(join(AKAR, 'mametlite/src'))];
const esbuild = createRequire(join(AKAR, 'frontend', 'package.json'))('esbuild');

console.log(`\n-- 1. ${berkas.length} berkas .jsx dikompilasi tanpa peringatan --`);
const berperingatan = [];
for (const f of berkas) {
  const { warnings } = esbuild.transformSync(readFileSync(f, 'utf8'), { loader: 'jsx', jsx: 'automatic', logLevel: 'silent' });
  if (warnings.length) berperingatan.push(`${relative(AKAR, f)}:${warnings[0].location?.line} ${warnings[0].text}`);
}
cek(berkas.length > 50, `${berkas.length} berkas ditemukan`);
cek(berperingatan.length === 0, 'tak ada peringatan kompilasi', berperingatan);

console.log('\n-- 2. tak ada komentar JSX yang memuat pembuka komentar lain --');
/** Nomor baris komentar JSX yang memuat pembuka komentar lain, atau penutupnya tak langsung diikuti `}`. */
const komentarBermasalah = (t) => [...t.matchAll(/\{\/\*/g)].flatMap((m) => {
  const akhir = t.indexOf('*/', m.index + 3);
  if (akhir < 0) return [];
  const isi = t.slice(m.index + 3, akhir);
  const sesudah = t.slice(akhir + 2).match(/^\s*(.)/)?.[1];
  return isi.includes('/*') || sesudah !== '}' ? [t.slice(0, m.index).split('\n').length] : [];
});
const bersarang = berkas.flatMap((f) => komentarBermasalah(readFileSync(f, 'utf8')).map((b) => `${relative(AKAR, f)}:${b}`));
cek(bersarang.length === 0, 'setiap komentar JSX tertutup di tempat yang dimaksud', bersarang);

// Uji gigit penghitungnya sendiri — kalau dua pemeriksa di atas tumpul, keduanya lulus untuk alasan yang salah.
console.log('\n-- 3. pemeriksa menggigit (fixture) --');
const bocor = 'export default () => (<div>\n  {/* contoh {/* */} lalu sisa kalimat */}\n</div>);';
cek(esbuild.transformSync(bocor, { loader: 'jsx', jsx: 'automatic', logLevel: 'silent' }).warnings.length > 0, 'fixture bocor (sisa memuat `}`) → peringatan esbuild');
// Bocor DIAM: sisa kalimat tanpa `}` — esbuild tak memperingatkan apa pun, teksnya tetap tampil di layar.
const bocorDiam = 'export default () => (<div>\n  {/* contoh {/* */} lalu sisa kalimat tanpa kurung tutup\n</div>);';
cek(esbuild.transformSync(bocorDiam, { loader: 'jsx', jsx: 'automatic', logLevel: 'silent' }).warnings.length === 0,
  'fixture bocor-diam memang lolos esbuild tanpa peringatan — karena itu lapis 2 perlu ada');
cek(komentarBermasalah(bocorDiam).length === 1, 'fixture bocor-diam → tertangkap pemeriksa komentar (lapis 2)');
cek(komentarBermasalah('<div>\n  {/* komentar biasa */}\n</div>').length === 0, 'komentar biasa tidak dituduh');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);


import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-settings-bertab v4');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const S = tanpaKomentar(baca('frontend/src/components/Settings.jsx'));

console.log('\n-- 1. sebelas bagian, sebelas syarat --');
const baris = S.split('\n');
const iSection = baris.map((x, i) => (/^\s*(<section |<Bagian[A-Z]\w* \/>)/.test(x) ? i : -1)).filter((i) => i >= 0);
cek(iSection.length === 11, `11 bagian: <section> atau <Bagian… /> (${iSection.length})`);
const idBagian = iSection.map((i) => (baris[i - 1].match(/bagianAktif === '([a-z]+)' && \($/) || [])[1]);
cek(idBagian.every(Boolean), 'baris tepat sebelum tiap <section> adalah syarat tab aktif', idBagian);
cek(new Set(idBagian).size === idBagian.length, 'id bagian unik — tak ada dua bagian di tab yang sama', idBagian);

console.log('\n-- 2. daftar tab cocok dengan bagian --');
const daftar = [...S.matchAll(/\{ id: '([a-z]+)', label: '[^']+', ikon: '([a-z_]+)', tampil: ([^}]+?) \}/g)]
  .map((m) => ({ id: m[1], ikon: m[2], tampil: m[3].trim() }));
cek(JSON.stringify(daftar.map((d) => d.id)) === JSON.stringify(idBagian), 'urutan & id daftar == urutan & id bagian',
  { daftar: daftar.map((d) => d.id), bagian: idBagian });
cek(/useState\(\(\) => ambilBagianSettings\(\) \|\| 'model'\)/.test(S) && daftar[0]?.id === 'model', "tab bawaan 'model' — bagian pertama");
cek(/BAGIAN_SETTINGS\.filter\(\(g\) => g\.tampil\)\.map/.test(S), 'tab dirender dari daftar yang DISARING `tampil`');

console.log('\n-- 3. syarat asli Pembaruan & Unduh Desktop --');
cek(/\{adaPembaruan && bagianAktif === 'pembaruan' && \(/.test(S), 'bagian Pembaruan: syarat asli adaPembaruan dipertahankan');
cek(/\{!adaPembaruan && bagianAktif === 'desktop' && \(/.test(S), 'bagian Unduh Desktop: syarat asli !adaPembaruan dipertahankan');
const t = Object.fromEntries(daftar.map((d) => [d.id, d.tampil]));
cek(t.pembaruan === 'adaPembaruan' && t.desktop === '!adaPembaruan', 'tab mengikuti syarat yang SAMA (tak ada tab kosong)', t);
cek(Object.entries(t).filter(([k]) => k !== 'pembaruan' && k !== 'desktop').every(([, v]) => v === 'true'),
  'sembilan tab lain selalu tampil');

console.log('\n-- 4. tab tidak menyusut di seluler --');
cek(/className=\{`shrink-0 flex items-center gap-2 px-3 py-2/.test(S), 'tombol tab shrink-0');
cek(/<nav aria-label="Bagian pengaturan" className="[^"]*overflow-x-auto/.test(S), 'baris tab bisa digeser di seluler');

console.log('\n-- 5. ikon & Keluar --');
const subset = baca('frontend/src/assets/fonts/daftar-ikon.txt').split('\n').map((s) => s.trim());
const takAda = daftar.filter((d) => !subset.includes(d.ikon)).map((d) => d.ikon);
cek(takAda.length === 0, 'semua ikon tab ada di subset font', takAda);
const iIdentitas = S.indexOf("bagianAktif === 'identitas'");
cek(iIdentitas >= 0 && S.indexOf('supabase.auth.signOut()', iIdentitas) > iIdentitas,
  'tombol Keluar (signOut) ada di bagian Identitas — tetap terjangkau');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

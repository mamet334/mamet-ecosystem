
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bacaPalet } from './palet-tema.mjs';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-menu-teks v3');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const M = tanpaKomentar(baca('frontend/src/components/os/MenuTeks.jsx'));
const SHELL = tanpaKomentar(baca('frontend/src/components/os/OSDesktopShell.jsx'));

console.log('\n-- 1. desktop memakai MenuTeks, seluler tetap laci --');
cek(/isMobile\s*\?\s*<Sidebar[\s\S]*?\/>\s*:\s*<MenuTeks \/>/.test(SHELL), 'desktop → MenuTeks, seluler → Sidebar');
cek(!/'ml-16'/.test(SHELL), 'tak ada lagi jarak ml-16 untuk bilah lama');

console.log('\n-- 2. tak ada kolom — tombol kecil melayang --');
cek(!/className="[^"]*\bh-full\b[^"]*\bborder-r\b/.test(M) && !/className="w-(12|56) shrink-0/.test(M),
  'tak ada kolom setinggi layar (versi 224px maupun jalur 48px)');
cek(/className=\{`fixed z-50 h-10/.test(M), 'tombol MENU melayang (fixed) setinggi isinya');
const teksTombol = (M.match(/style=\{\{ left: posisi\.x[^}]*\}\}\s*>\s*([^<]+?)\s*<\/button>/) || [])[1];
cek(teksTombol === 'Menu', `tombol bertuliskan "Menu", bukan ☰ (ditemukan: ${JSON.stringify(teksTombol)})`);
cek(!/>\s*☰\s*</.test(M), 'tak ada ☰ yang dirender (tertukar dengan tombol riwayat ≡)');

console.log('\n-- 3. tombol bisa digeser, posisi diingat dan dijepit --');
cek(/onPointerDown=\{mulaiGeser\}/.test(M) && /onPointerMove=\{saatGeser\}/.test(M) && /onPointerUp=\{selesaiGeser\}/.test(M),
  'penangan geser terpasang');
cek(/Math\.abs\(dx\) \+ Math\.abs\(dy\) < 5\) return;/.test(M), 'ambang 5px membedakan KLIK dari GESER');
cek(/if \(geserRef\.current\.bergeser\) \{ geserRef\.current\.bergeser = false; return; \}/.test(M),
  'klik sesudah menggeser TIDAK membuka menu');
cek(/localStorage\.setItem\(KUNCI_POSISI/.test(M) && /JSON\.parse\(localStorage\.getItem\(KUNCI_POSISI\)\)/.test(M),
  'posisi disimpan & dipulihkan');
cek(/window\.addEventListener\('resize', jepitUlang\)/.test(M), 'posisi dijepit ulang saat jendela diubah — tombol tak bisa hilang');

console.log('\n-- 4. kotak menu terbuka ke arah yang lapang, tanpa bilah gulir --');
cek(/const keAtas = /.test(M) && /const keKiri = /.test(M) && /maxHeight: /.test(M), 'arah buka & tinggi maksimum mengikuti posisi tombol');
const kelasKotak = (M.match(/className="fixed z-\[70\][^"]*"/) || [''])[0];
cek(/overflow-y-auto/.test(kelasKotak), 'kotak tetap bisa digulir');
cek(/\[scrollbar-width:none\]/.test(kelasKotak) && /\[&::-webkit-scrollbar\]:hidden/.test(kelasKotak),
  'bilah gulir disembunyikan di KEDUA jalur gambar Chromium', kelasKotak);

console.log('\n-- 5. lapisan: tombol z-50 < laci riwayat z-[60] < kotak menu z-[70] --');
const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
cek(/z-\[60\] absolute left-0/.test(CE) && /fixed z-50 h-10/.test(M) && /fixed z-\[70\]/.test(M),
  'laci riwayat menutupi tombol MENU; kotak menu di atas keduanya');

console.log('\n-- 6. isi dari metadata; Lanjutkan tidak dikarang; Keluar bertanya dulu --');
cek(/navigationService\.getTree\(\)/.test(M), 'menu dibangun dari NavigationService (navigation.json) — MUS §21');
cek(!/'app:(knowledge-base|memory-graph|agent-forge|file-explorer|kernel|billing)'/.test(M),
  'tak ada daftar aplikasi yang ditulis tangan di menu');
cek(/const adaLanjutkan = !!chatTerakhir && !!chatIdTerakhir && /.test(M), 'Lanjutkan hanya bila ADA chat aktif sungguhan — MUS §4.2');
cek(/window\.confirm\('Keluar dari Mamet\?'\)\) supabase\.auth\.signOut\(\)/.test(M), 'Keluar bertanya dulu');

console.log('\n-- 7. kontras teks ≥ 4,5:1 (WCAG 2.2 AA) --');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const campur = (f, b, a) => f.map((v, i) => Math.round(v * a + b[i] * (1 - a)));
const rasio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
cek(/const KREM = 'rgb\(var\(--warna-menu-teks\)\)';/.test(M) && /bg-\[rgb\(var\(--warna-menu-latar\)\)\]/.test(M),
  'warna menu menunjuk variabel tema (ikut berganti tema)');
const opTakAktif = Number((M.match(/aktif \? 'opacity-100' : 'opacity-(\d+) hover:opacity-100'/) || [])[1]) / 100;
const opKet = Number((M.match(/text-\[\d+px\] opacity-(\d+)/) || [])[1]) / 100;
const opJudul = Number((M.match(/text-\[\d+px\] opacity-\[(0\.\d+)\]/) || [])[1]);
const metaTema = JSON.parse(readFileSync(join(AKAR, 'frontend/public/metadata/themes.json'), 'utf8'));
const keHex = (rgb) => '#' + rgb.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('');
const PALET_MENU = { [metaTema.bawaan]: bacaPalet(AKAR, metaTema.bawaan).VAR };
for (const t of metaTema.themes.filter((x) => x.nilai)) PALET_MENU[t.id] = Object.fromEntries(Object.entries(t.nilai).map(([k, v]) => [k, keHex(v)]));
for (const [id, P] of Object.entries(PALET_MENU)) {
  const krem = hex(P['menu-teks'] || '#000000'), latar = hex(P['menu-latar'] || '#ffffff');
  const ukur = {
    'pilihan tidak aktif': rasio(campur(krem, latar, opTakAktif), latar),
    'keterangan Lanjutkan': rasio(campur(krem, latar, opTakAktif * opKet), latar),
    'judul sub-menu': rasio(campur(krem, latar, opJudul), latar),
  };
  for (const [n, r] of Object.entries(ukur)) cek(Number.isFinite(r) && r >= 4.5, `${id} — ${n}: ${r.toFixed(2)}:1`);
}

console.log('\n-- 7b. skala huruf: isi menu ≥ 14px, tak ada teks < 12px --');
const ukuranItem = Number((M.match(/tracking-\[0\.12em\] text-\[(\d+)px\]/) || [])[1]);
cek(ukuranItem >= 14, `isi menu ${ukuranItem}px (≥ 14px)`);
const semuaUkuran = [...M.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
cek(semuaUkuran.length > 0 && Math.min(...semuaUkuran) >= 12, `teks terkecil di menu ${Math.min(...semuaUkuran)}px (≥ 12px)`, semuaUkuran);

console.log('\n-- 8. warna dari palet LampLogin, bukan token Material --');
cek(!/\b(?:bg|text|border)-(?:surface|on-surface|primary|outline|secondary|tertiary|slate-\d)/.test(M),
  'tak ada token Material maupun slate-* di menu');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

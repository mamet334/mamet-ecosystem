// UJI 2026-10-19 — ciri tampilan "hasil generate AI" hanya boleh TURUN (Item 127, Tahap 0).
//
// Kenapa ada: Owner meminta tampilan Ecosystem "tidak seperti hasil generate AI". Itu rasa, dan rasa
// tidak bisa diuji. Yang bisa diuji adalah PENANDANYA — resep visual paling umum dari generator UI yang
// ditemukan saat mengukur 46 berkas .jsx pada 19 Okt (ROADMAP-TAMPILAN-MENU-GAME.md §2.1):
//
//   - dua sistem warna bersaing: 47 token gaya Material 3 + warna mentah `slate-*` yang melewatinya
//     (v5, Item 128 Tahap B: token palet kini JUSTRU yang diinginkan — merekalah yang ikut berganti tema. Penghitung
//     `tokenMaterial` dipensiunkan; gantinya `warnaTetap` menghitung warna yang TIDAK ikut tema: hex yang ditulis
//     langsung di kelas dan putih/hitam mentah. Itulah yang kini harus turun.)
//   - aksen pelangi (emerald/cyan/violet/indigo/purple/fuchsia) — tak ada satu warna yang berarti "Mamet"
//   - dua set ikon (lucide-react + Material Symbols)
//   - gerak dekoratif (animate-pulse/ping/spin) yang tidak mewakili keadaan
//   - kaca & cahaya: backdrop-blur, bayangan glow rgba, gradien
//
// Cara kerjanya: GIGI SEARAH. Angka hari ini dikunci sebagai batas atas. Angka boleh turun (dan bila
// turun, batasnya diturunkan di sini supaya tidak bisa naik kembali); angka yang NAIK = uji merah.
// Tahap 2–3 Item 127 menurunkannya; uji ini memastikan tak ada layar baru yang menambahnya diam-diam.
//
// Batas jujurnya: angka ini WAKIL, bukan definisi. Layar bisa lolos uji dan tetap terasa generik —
// hakim terakhirnya mata Owner. Yang dijamin uji hanya satu hal: resep generik tidak bertambah.
//
// DIKECUALIKAN: `LampLogin.jsx` — acuan yang dilindungi (Owner: tidak diubah dalam pekerjaan ini),
// jadi angkanya tidak pernah bisa turun dan hanya akan mengaburkan gerak berkas lain. Ia dijaga
// terpisah oleh `uji-penjaga-lamplogin.mjs`.
// v3 (19 Okt): `os/LatarRuangan.jsx` juga — ia SALINAN dinding LampLogin (latar terdalam seluruh aplikasi, permintaan
// Owner), dibangun dari gradien yang sama; menghitungnya berarti menghukum acuan yang sama dua kali. Salinan itu
// dijaga `uji-latar-ruangan.mjs` agar sama persis dengan LampLogin — tak bisa dipakai menyelundupkan gradien lain.
//
// Komentar dibuang sebelum menghitung: kelas yang hanya disebut di komentar bukan tampilan.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(AKAR, 'frontend', 'src');
const DIKECUALIKAN = new Set(['components/LampLogin.jsx', 'components/os/LatarRuangan.jsx']);

const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-ciri-tampilan v6');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

// ── Penghitung — satu definisi, dipakai untuk kode sungguhan DAN untuk uji gigitnya ─────────────
const POLA = {
  // Warna yang tak ikut tema: hex yang ditulis langsung di kelas (`bg-[#0a0a0a]`). v6 (Item 128 Tahap D1): putih &
  // hitam (`text-white`, `bg-black/40`) dan semua rona status kini variabel warna dasar — ikut tema, tak dihitung lagi.
  warnaTetap: /\b(?:bg|text|border|from|via|to|fill|stroke|ring|divide|outline|shadow|placeholder)-\[#[0-9a-fA-F]{3,8}\]/g,
  warnaSlate: /\b(?:bg|text|border)-slate-\d+/g,
  aksenPelangi: /\b(?:bg|text|border|from|to|via)-(?:emerald|cyan|violet|indigo|purple|fuchsia)-\d+/g,
  gerakDekoratif: /\banimate-(?:pulse|ping|spin)\b/g,
  kacaBlur: /\bbackdrop-blur\b/g,
  glowRgba: /\bshadow-\[[^\]]*rgba/g,
  gradien: /\bbg-gradient-to-|radial-gradient|linear-gradient/g,
};
const ADA_LUCIDE = /from\s+['"]lucide-react['"]/;
const ADA_MATERIAL_SYMBOLS = /material-symbols/;

function hitung(kode) {
  const k = tanpaKomentar(kode);
  const hasil = {};
  for (const [nama, pola] of Object.entries(POLA)) hasil[nama] = (k.match(pola) || []).length;
  hasil.berkasIkonLucide = ADA_LUCIDE.test(k) ? 1 : 0;
  hasil.berkasIkonMaterialSymbols = ADA_MATERIAL_SYMBOLS.test(k) ? 1 : 0;
  return hasil;
}

// ── 1. Gigit dulu: penghitung benar-benar menghitung yang ia klaim ──────────────────────────────
// Tanpa bagian ini, regex yang rusak (mis. salah ketik nama kelas) akan menghasilkan 0 di mana-mana,
// dan gigi searahnya lulus selamanya — hijau palsu yang paling sulit ketahuan.
console.log('\n-- 1. penghitung menggigit (fixture) --');
const FIXTURE = `
import { X } from 'lucide-react';
// bg-slate-900 di komentar baris TIDAK dihitung
/* text-primary di komentar blok TIDAK dihitung */
const a = <div className="bg-surface-container-low text-on-surface border-outline-variant bg-slate-950 text-slate-400 bg-[#0a0a0a]/90 text-white bg-black/40
  from-emerald-500 via-cyan-400 to-purple-600 animate-pulse animate-spin backdrop-blur-md
  shadow-[0_0_20px_rgba(0,0,0,.5)] bg-gradient-to-r" style={{ background: 'radial-gradient(#000, #fff)' }}>
  <span className="material-symbols-outlined">home</span></div>;
`;
const f = hitung(FIXTURE);
cek(f.warnaTetap === 1, 'warna tetap dihitung: hex di kelas (1); putih/hitam & token palet TIDAK dihitung (ikut tema)', f.warnaTetap);
cek(f.warnaSlate === 2, 'warna slate dihitung, yang di komentar tidak (2)', f.warnaSlate);
cek(f.aksenPelangi === 3, 'aksen pelangi dihitung termasuk from/via/to (3)', f.aksenPelangi);
cek(f.gerakDekoratif === 2, 'gerak dekoratif dihitung (2)', f.gerakDekoratif);
cek(f.kacaBlur === 1, 'backdrop-blur dihitung (1)', f.kacaBlur);
cek(f.glowRgba === 1, 'bayangan glow rgba dihitung (1)', f.glowRgba);
cek(f.gradien === 2, 'gradien kelas + gradien CSS dihitung (2)', f.gradien);
cek(f.berkasIkonLucide === 1 && f.berkasIkonMaterialSymbols === 1, 'kedua set ikon terdeteksi', f);

// ── 2. Hitung kode sungguhan ────────────────────────────────────────────────────────────────────
function semuaJsx(dir) {
  const keluar = [];
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) keluar.push(...semuaJsx(p));
    else if (nama.endsWith('.jsx')) keluar.push(p);
  }
  return keluar;
}

const berkas = semuaJsx(SRC)
  .map((p) => relative(SRC, p).replace(/\\/g, '/'))
  .filter((r) => !DIKECUALIKAN.has(r))
  .sort();

const total = {};
for (const r of berkas) {
  const h = hitung(readFileSync(join(SRC, r), 'utf8').replace(/\r\n/g, '\n'));
  for (const [k, v] of Object.entries(h)) total[k] = (total[k] || 0) + v;
}

console.log(`\n-- 2. ${berkas.length} berkas .jsx (tanpa ${[...DIKECUALIKAN].join(', ')}) --`);
for (const [k, v] of Object.entries(total)) console.log(`     ${k.padEnd(26)} ${v}`);

// Pengecualian harus benar-benar ada di disk — kalau LampLogin dipindah/diganti nama, pengecualian
// yang diam akan membuat berkas penggantinya ikut terhitung tanpa ada yang tahu kenapa angkanya naik.
for (const r of DIKECUALIKAN) {
  let ada = true;
  try { statSync(join(SRC, r)); } catch { ada = false; }
  cek(ada, `berkas yang dikecualikan masih ada: ${r}`);
}

// ── 3. Gigi searah ──────────────────────────────────────────────────────────────────────────────
// Diukur 19 Okt 2026, tanpa LampLogin.jsx, komentar dibuang. Bila sebuah angka TURUN, turunkan
// batasnya di sini pada commit yang sama — itulah yang membuat gigi ini searah.
//
// Selisih dengan tabel §2.1 roadmap (yang mengukur 46 berkas TERMASUK LampLogin) hanya milik
// LampLogin: gradien 19→6, glow 37→26, lucide 27→26, gerak 52→51. Cahaya lampunya memang dibuat
// dari gradien & glow — di sana ia bermakna, jadi ia tidak dihitung sebagai resep generik.
// Diukur 20 Okt (v5), tanpa LampLogin & LatarRuangan: 154 warna yang tak ikut tema; → 150 (MenuTeks kini memakai
// variabel tema, Item 128 Tahap B). Tema Terang (Item 128 Tahap D)
// menurunkannya; kenaikan = layar baru yang menulis warna tetap alih-alih token palet.
// → 6 (Item 128 Tahap D1): putih/hitam & rona status kini variabel warna dasar; hex komponen diganti variabel. Sisa 6
// SENGAJA: 5 titik legenda graf Home (warna makna konstitusi 23 — tak ikut tema) + 1 di Login.jsx (kode mati, K6).
const GARIS_WARNA_TETAP = 6;
const GARIS_DASAR = {
  // tokenMaterial DIPENSIUNKAN (20 Okt, v5): 568 → 581 selama Item 127 — tiap kenaikan disengaja & tercatat di
  // riwayat berkas ini. Sejak Item 128 token palet adalah mekanisme tema; yang dijaga kini warna yang tak ikut tema.
  warnaTetap: GARIS_WARNA_TETAP,
  warnaSlate: 609, // 615 → 609 (19 Okt): akar 6 aplikasi tak lagi mengecat latar slate sendiri (latar = dinding LampLogin)
  aksenPelangi: 250,
  gerakDekoratif: 50, // 51 → 50 (20 Okt): cabang desktop Sidebar.jsx (titik berdenyut di avatar) dihapus — keputusan Owner
  kacaBlur: 15,
  glowRgba: 18, // 26 → 18 (20 Okt): pendar status Observability kini variabel warna dasar (Item 128 Tahap D1)
  gradien: 5, // 6 → 5 (19 Okt): gradien area kotak ketik chat dibuang — jadi pita gelap di atas dinding ruangan
  // 26 → 3 (20 Okt): satu set ikon — keputusan Owner "pakai yang terbaru". Sisa 3 = kode mati K6 (Login.jsx,
  // EngineerChat.jsx, ActivityBar.jsx, tak diimpor mana pun); turun ke 0 saat K6 dihapus.
  berkasIkonLucide: 3,
  // 8 → 9 (20 Okt, v5): BagianTampilan.jsx — bagian Settings › Tampilan dipecah ke berkasnya sendiri (Settings.jsx
  // sudah memakai Material Symbols); jumlah SET ikon tidak bertambah. Kenaikan berikutnya tetap merah.
  // 9 → 10 (20 Okt): components/Ikon.jsx — komponen tunggal pengganti lucide (162 tag di 24 berkas memakainya tanpa
  // menulis kelas ligatur sendiri). Angka ini kini = berkas yang menulis ligatur LANGSUNG; idealnya hanya Ikon.jsx.
  berkasIkonMaterialSymbols: 10,
};

console.log('\n-- 3. tidak ada angka yang naik dari garis dasar --');
const turun = [];
for (const [k, batas] of Object.entries(GARIS_DASAR)) {
  if (batas === null) { cek(false, `garis dasar "${k}" belum diisi (sekarang ${total[k]})`); continue; }
  cek(total[k] <= batas, `${k}: ${total[k]} ≤ ${batas}`, { sekarang: total[k], batas });
  if (total[k] < batas) turun.push(`${k}: ${batas} → ${total[k]}`);
}
cek(Object.keys(GARIS_DASAR).length === Object.keys(total).length,
  'setiap penghitung punya garis dasar (tak ada yang lolos tanpa batas)',
  { penghitung: Object.keys(total), garisDasar: Object.keys(GARIS_DASAR) });

if (turun.length) {
  console.log('\n  ↓ TURUN — kencangkan gigi: perbarui GARIS_DASAR di berkas ini ke angka baru:');
  for (const t of turun) console.log('      ' + t);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

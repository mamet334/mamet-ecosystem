// UJI 2026-10-19 — kerangka layar chat: satu kolom baca, panel samping jadi laci (Item 127 Tahap 2, langkah 2a).
//
// Kenapa ada: di layar Owner (1366×720) kolom chat terjepit tiga panel yang terbuka berdampingan — Memory
// Context 320px (terbuka bawaan), riwayat 256px (mendorong pesan di desktop), Monitor MAEF 350px (kolom grid
// AppShell). Diukur 19 Okt sebelum perubahan: jawaban model hanya 524px, dan bilah sesi yang melayang
// (`absolute`) menutupi awal pesan pertama.
//
// Sesudah langkah 2a, diukur di browser: kolom baca 768px ditengahkan, jawaban model 768px (+47%), bilah tidak
// lagi menutupi pesan, dan membuka laci mana pun TIDAK menggeser kolom baca satu piksel pun.
//
// Yang dijaga — masing-masing satu suntingan wajar dari kembali ke keadaan terjepit:
//   1. Memory Context tertutup bawaan, dan dirender sebagai laci yang MENUTUPI, bukan kolom.
//   2. Riwayat menutupi di semua lebar (tanpa `md:relative`); latar penutupnya di semua lebar.
//   3. Lapisan: bilah z-50 < latar z-[55] < laci z-[60] — dulu tombol bilah menembus kepala laci.
//   4. Bilah sesi adalah BARIS, bukan `absolute` yang melayang di atas pesan.
//   5. Kolom baca = lebar kotak ketik, LEBAR (≥ 64rem, keputusan Owner v4), isi dipadatkan, jawaban model selebar kolom.
//   6. Zona kanan AppShell bukan kolom grid — laci di desktop.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-kerangka-chat v4');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
const SHELL = tanpaKomentar(baca('frontend/src/components/workbench/AppShell.jsx'));

// ── 1. Memory Context ───────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. Memory Context: laci, tertutup bawaan --');
cek(/useKeadaanTersimpan\(kunciSesi, 'isMemoryPanelOpen', false\)/.test(CE), 'tertutup bawaan');
cek(/\{isMemoryPanelOpen && \(\s*<div className="absolute right-0 top-0 h-full z-40[^"]*">\s*<MemoryContextPanel/.test(CE),
  'dirender di dalam wadah yang menutupi (absolute), bukan sebagai kolom berdampingan');

// ── 2 & 3. Riwayat & lapisan ────────────────────────────────────────────────────────────────────
console.log('\n-- 2. riwayat menutupi di semua lebar · 3. lapisan --');
const laciRiwayat = (CE.match(/\$\{isSidebarOpen \? 'w-64' : 'w-0 overflow-hidden'\}[^`]*`/) || [''])[0];
cek(laciRiwayat.length > 0, 'wadah laci riwayat ditemukan');
cek(!/md:relative/.test(laciRiwayat), 'laci riwayat TIDAK md:relative (tidak mendorong kolom baca di desktop)', laciRiwayat);
cek(/\babsolute\b/.test(laciRiwayat), 'laci riwayat absolute di semua lebar');
const latar = (CE.match(/className="fixed inset-0 bg-black\/50[^"]*"/) || [''])[0];
cek(latar.length > 0 && !/md:hidden/.test(latar), 'latar penutup tampil di semua lebar (klik di luar = tutup)', latar);
const z = (s) => Number((s.match(/z-\[(\d+)\]/) || s.match(/\bz-(\d+)\b/) || [])[1]);
const bilah = (CE.match(/<div className="relative z-50 flex flex-wrap[^"]*"/) || [''])[0];
cek(bilah.length > 0, 'bilah sesi ditemukan');
cek(z(bilah) < z(latar) && z(latar) < z(laciRiwayat),
  `lapisan bilah ${z(bilah)} < latar ${z(latar)} < laci ${z(laciRiwayat)}`, { bilah: z(bilah), latar: z(latar), laci: z(laciRiwayat) });

// ── 4. Bilah sesi sebagai baris ─────────────────────────────────────────────────────────────────
console.log('\n-- 4. bilah sesi tidak melayang di atas pesan --');
cek(!/className="absolute top-6 left-6 z-50 flex items-center gap-2"/.test(CE), 'bilah sesi bukan absolute top-6 left-6 lagi');
cek(/shrink-0/.test(bilah), 'bilah sesi baris yang tidak menyusut (memakan tingginya sendiri)');

// ── 5. Kolom baca ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. kolom baca --');
// v3 (K4, "nyaman dibaca secara lama"): yang dijaga bukan lagi nama kelas `max-w-3xl`, tetapi dua NIAT —
// (a) kolom baca, kotak ketik, kartu lampiran & kartu konfirmasi web memakai lebar yang SAMA, dan (b) lebar itu
// menghasilkan ≤ 75 karakter per baris (batas nyaman tipografi 45–75). Diukur 19 Okt di browser: Inter 16px
// pada kalimat Bahasa Indonesia = rata-rata 7,85px per huruf; gelembung jawaban berpadding px-5 (2 × 20px).
// `(?:\{\s*\}\s*)*`: komentar JSX `{/* … */}` di antaranya meninggalkan `{}` sesudah tanpaKomentar().
const kolomBaca = (CE.match(/ref=\{scrollContainerRef\}[^>]*>\s*(?:\{\s*\}\s*)*<div className="(max-w-\S+) mx-auto w-full space-y-3">/) || [])[1];
cek(!!kolomBaca, 'isi wadah gulir dikolomkan dan ditengahkan', kolomBaca);
const lebarKotakKetik = (CE.match(/<form onSubmit=\{handleSend\} className="w-full (max-w-\S+) /) || [])[1];
const lebarKartu = [...CE.matchAll(/className="w-full (max-w-\S+) mb-2(?:\.5)? /g)].map((m) => m[1]);
cek(lebarKotakKetik === kolomBaca && lebarKartu.length === 2 && lebarKartu.every((l) => l === kolomBaca),
  `kotak ketik & dua kartu di atasnya memakai lebar yang SAMA dengan kolom baca (${kolomBaca})`,
  { kolomBaca, lebarKotakKetik, lebarKartu });
// v4 (Owner 19 Okt, sesudah melihat versi 608px di layarnya): "justru harus diperlebar… tujuannya saya
// mendapatkan layar interaksi yang luas pada chat… panel jangan dilebarkan, tetapi isinya yang dipadatkan."
// Owner SENGAJA mendahulukan ruang interaksi di atas pedoman panjang baris 45–75 — jadi yang dijaga kini
// keputusan itu: kolom lebar (≥ 64rem) dan isi gelembung yang dipadatkan. Karakter per baris tetap dicetak
// sebagai keterangan, supaya konsekuensinya terlihat, bukan disembunyikan.
const PX = { 'max-w-2xl': 672, 'max-w-3xl': 768, 'max-w-4xl': 896, 'max-w-5xl': 1024, 'max-w-6xl': 1152 };
const px = PX[kolomBaca] ?? (/^max-w-\[(\d+(?:\.\d+)?)rem\]$/.test(kolomBaca || '') ? Number(kolomBaca.match(/[\d.]+/)[0]) * 16 : NaN);
const karakter = Math.round((px - 32) / 7.85);
cek(Number.isFinite(px) && px >= 1024,
  `kolom baca ${px}px — lebar, sesuai keputusan Owner (≈ ${karakter} karakter per baris, di atas pedoman 75: disengaja)`,
  { kolomBaca, px, karakter });
cek(/rounded-2xl px-4 py-3 \$\{m\.role/.test(CE), 'isi gelembung dipadatkan (px-4 py-3), bukan gelembung yang digemukkan');
cek(/\$\{m\.role === 'user' \? 'max-w-\[85%\] lg:max-w-\[75%\]' : 'w-full'\}/.test(CE),
  'gelembung pengguna ≤75%, jawaban model selebar kolom baca');

// ── 6. AppShell ─────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 6. zona kanan AppShell --');
const kolomGrid = (SHELL.match(/gridTemplateColumns: \[[\s\S]*?\]\.filter/) || [''])[0];
cek(kolomGrid.length > 0 && !/right_size/.test(kolomGrid), 'zona kanan tidak lagi menjadi kolom grid', kolomGrid);
cek(/isMobile \? '' : 'absolute right-0 top-0 h-full z-40[^']*'/.test(SHELL), 'zona kanan dibungkus laci yang menutupi di desktop');

// ── 7. Satu baris tombol (v2, permintaan Owner 19 Okt: "kurang cakep") ─────────────────────────
// Dulu pil Memory/Monitor melayang (`absolute top-3 right-5`) di baris KEDUA, terpisah dari tombol kiri.
console.log('\n-- 7. pil kanan di ujung kanan bilah sesi yang sama --');
cek(!/absolute top-3 right-5/.test(CE), 'tak ada lagi kelompok pil yang melayang di area chat');
const iBilah = CE.indexOf('<div className="relative z-50 flex flex-wrap');
const iPil = CE.indexOf('<div className="ml-auto flex items-center gap-2">');
const iBanner = CE.indexOf('{lastCheckpoint && (');
cek(iBilah >= 0 && iPil > iBilah && iPil < iBanner, 'kelompok pil kanan ada DI DALAM bilah sesi (sebelum banner rollback)', { iBilah, iPil, iBanner });
cek(/title=\{isMemoryPanelOpen \? 'Minimize Memory Context' : 'Buka Memory Context'\}/.test(CE.slice(iPil, iBanner)) &&
    /title="Toggle MAEF Monitor"/.test(CE.slice(iPil, iBanner)) &&
    /title="Luaskan Kolom Chat/.test(CE.slice(iPil, iBanner)),
  'ketiga tombolnya ikut pindah utuh (Memory · Monitor · Luaskan)');
cek(!/mt-14 mb-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber/.test(CE),
  'banner rollback tak lagi menyisakan jarak 56px untuk bilah lama yang melayang');

// ── 8. Ikon bilah samping tidak kembar ──────────────────────────────────────────────────────────
// Bilah samping MENEBAK ikon dari nama aplikasi (Sidebar.jsx getIcon); nama yang tak cocok jatuh ke 'apps'.
// 19 Okt: tiga aplikasi jatuh ke sana sekaligus. Uji ini menjalankan getIcon yang ASLI pada nama di metadata.
console.log('\n-- 8. ikon bilah samping --');
const SIDEBAR = baca('frontend/src/components/os/Sidebar.jsx');
const badanIkon = SIDEBAR.slice(SIDEBAR.indexOf('const getIcon'), SIDEBAR.indexOf('const renderNavNode'));
const getIcon = new Function('return ' + badanIkon.replace('const getIcon = ', '').trim().replace(/;\s*$/, ''))();
const namaApp = JSON.parse(baca('frontend/public/metadata/system.json')).apps.map((a) => a.name);
const ikon = namaApp.map((n) => getIcon(n));
const subset = baca('frontend/src/assets/fonts/daftar-ikon.txt').split('\n').map((s) => s.trim());
const kembar = ikon.filter((v, i) => ikon.indexOf(v) !== i);
cek(kembar.length === 0, `${namaApp.length} aplikasi, ${new Set(ikon).size} ikon berbeda — tak ada yang kembar`, kembar);
// "Tak kembar" saja tidak cukup — terbukti lewat mutasi: SATU aplikasi yang jatuh ke cadangan tidak kembar
// dengan siapa pun, tetapi tetap tampil sebagai kotak-titik generik. Yang dijaga: tak ada yang jatuh ke sana.
const jatuh = namaApp.filter((n, i) => ikon[i] === getIcon('\u0000tak-cocok-apa-pun\u0000'));
cek(jatuh.length === 0, 'tak ada aplikasi yang jatuh ke ikon cadangan generik', jatuh);
const takAda = ikon.filter((i) => !subset.includes(i));
cek(takAda.length === 0, 'semua ikon ada di subset font (kalau tidak, yang tampil adalah KATANYA)', takAda);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

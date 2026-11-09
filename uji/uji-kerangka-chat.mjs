
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-kerangka-chat v8');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
const SHELL = tanpaKomentar(baca('frontend/src/components/workbench/AppShell.jsx'));

console.log('\n-- 1. Memory Context: laci, tertutup bawaan --');
cek(/useKeadaanTersimpan\(kunciSesi, 'isMemoryPanelOpen', false\)/.test(CE), 'tertutup bawaan');
cek(/\{isMemoryPanelOpen && \(\s*<div className="absolute right-0 top-0 h-full z-40[^"]*">\s*<MemoryContextPanel/.test(CE),
  'dirender di dalam wadah yang menutupi (absolute), bukan sebagai kolom berdampingan');

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

console.log('\n-- 4. bilah sesi tidak melayang di atas pesan --');
cek(!/className="absolute top-6 left-6 z-50 flex items-center gap-2"/.test(CE), 'bilah sesi bukan absolute top-6 left-6 lagi');
cek(/shrink-0/.test(bilah), 'bilah sesi baris yang tidak menyusut (memakan tingginya sendiri)');

console.log('\n-- 5. kolom baca --');
const kolomBaca = (CE.match(/ref=\{scrollContainerRef\}[^>]*>\s*(?:\{\s*\}\s*)*<div className="(max-w-\S+) mx-auto w-full space-y-3">/) || [])[1];
cek(!!kolomBaca, 'isi wadah gulir dikolomkan dan ditengahkan', kolomBaca);
const lebarKotakKetik = (CE.match(/<form onSubmit=\{handleSend\} className="w-full (max-w-\S+) /) || [])[1];
const lebarKartu = [...CE.matchAll(/className="w-full (max-w-\S+) mb-2(?:\.5)? /g)].map((m) => m[1]);
cek(lebarKotakKetik === kolomBaca && lebarKartu.length === 2 && lebarKartu.every((l) => l === kolomBaca),
  `kotak ketik & dua kartu di atasnya memakai lebar yang SAMA dengan kolom baca (${kolomBaca})`,
  { kolomBaca, lebarKotakKetik, lebarKartu });
const PX = { 'max-w-2xl': 672, 'max-w-3xl': 768, 'max-w-4xl': 896, 'max-w-5xl': 1024, 'max-w-6xl': 1152 };
const px = PX[kolomBaca] ?? (/^max-w-\[(\d+(?:\.\d+)?)rem\]$/.test(kolomBaca || '') ? Number(kolomBaca.match(/[\d.]+/)[0]) * 16 : NaN);
const karakter = Math.round((px - 32) / 7.85);
cek(Number.isFinite(px) && px >= 1024,
  `kolom baca ${px}px — lebar, sesuai keputusan Owner (≈ ${karakter} karakter per baris, di atas pedoman 75: disengaja)`,
  { kolomBaca, px, karakter });
const kelasPeran = CE.match(/\$\{m\.role === 'user' \? '(rounded-2xl[^']*)' : '([^']*)'\}`\}>/) || [];
cek(/^rounded-2xl px-4 py-3 /.test(kelasPeran[1] || '') && /border/.test(kelasPeran[1] || ''),
  'gelembung pengguna dipadatkan (px-4 py-3) dan tetap bergaris tepi', kelasPeran[1]);
const kelasJawaban = kelasPeran[2] || '';
const ST = tanpaKomentar(baca('frontend/src/components/Settings.jsx'));
const iKartu = ST.indexOf('>AI Model Management<');
const kelasKartu = (ST.slice(0, iKartu).match(/<section className="([^"]*)"/g) || []).pop()?.match(/className="([^"]*)"/)[1] || '';
const TATA_LETAK = /^(col-span-|lg:col-span-|relative$|overflow-hidden$)/;
const tampilanKartu = kelasKartu.split(/\s+/).filter((k) => k && !TATA_LETAK.test(k));
cek(tampilanKartu.includes('glass-panel') && tampilanKartu.length >= 5, `kartu "AI Model Management" ditemukan: ${tampilanKartu.join(' ')}`, kelasKartu);
const kurang = tampilanKartu.filter((k) => !kelasJawaban.split(/\s+/).includes(k));
cek(kurang.length === 0, 'kartu jawaban model = kartu AI Model Management (kelas tampilan sama persis)', { kurang, kelasJawaban });
cek(!/\bbg-(?!opacity)|border-primary/.test(kelasJawaban), 'tak ada latar/garis tambahan yang menimpa warna kartu Settings', kelasJawaban);

const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const escTW = reqFE('tailwindcss/lib/util/escapeClassName').default;
const kelasDiuji = [...new Set(`${kelasPeran[1] || ''} ${kelasJawaban}`.split(/\s+/).filter(Boolean))];
const { css: cssBingkai } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelasDiuji.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const cssGlobal = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const takDibuat = kelasDiuji.filter((k) => !cssBingkai.includes('.' + escTW(k) + ' ') && !cssBingkai.includes('.' + escTW(k) + '{')
  && !new RegExp(`(^|\\n)\\.${k.replace(/[-]/g, '\\-')}\\s*\\{`).test(cssGlobal));
cek(takDibuat.length === 0, `${kelasDiuji.length} kelas gelembung & kartu semuanya benar-benar ada (Tailwind atau index.css)`, takDibuat);
cek(/\$\{m\.role === 'user' \? 'max-w-\[85%\] lg:max-w-\[75%\]' : 'w-full'\}/.test(CE),
  'gelembung pengguna ≤75%, jawaban model selebar kolom baca');

console.log('\n-- 6. zona kanan AppShell --');
const kolomGrid = (SHELL.match(/gridTemplateColumns: \[[\s\S]*?\]\.filter/) || [''])[0];
cek(kolomGrid.length > 0 && !/right_size/.test(kolomGrid), 'zona kanan tidak lagi menjadi kolom grid', kolomGrid);
cek(/isMobile \? '' : 'absolute right-0 top-0 h-full z-40[^']*'/.test(SHELL), 'zona kanan dibungkus laci yang menutupi di desktop');

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

console.log('\n-- 8. ikon bilah samping --');
const SIDEBAR = baca('frontend/src/components/os/Sidebar.jsx');
cek(SIDEBAR.includes("{app.icon || 'apps'}") && !/getIcon/.test(SIDEBAR), 'laci membaca ikon dari metadata (app.icon), bukan menebak dari nama');
const APPS = JSON.parse(baca('frontend/public/metadata/system.json')).apps;
const namaApp = APPS.map((a) => a.name);
const ikon = APPS.map((a) => a.icon || 'apps');
const subset = baca('frontend/src/assets/fonts/daftar-ikon.txt').split('\n').map((s) => s.trim());
const kembar = ikon.filter((v, i) => ikon.indexOf(v) !== i);
cek(kembar.length === 0, `${namaApp.length} aplikasi, ${new Set(ikon).size} ikon berbeda — tak ada yang kembar`, kembar);
const jatuh = namaApp.filter((n, i) => ikon[i] === 'apps');
cek(jatuh.length === 0, 'tak ada aplikasi yang jatuh ke ikon cadangan generik', jatuh);
const takAda = ikon.filter((i) => !subset.includes(i));
cek(takAda.length === 0, 'semua ikon ada di subset font (kalau tidak, yang tampil adalah KATANYA)', takAda);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

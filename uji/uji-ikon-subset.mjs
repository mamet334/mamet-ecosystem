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

// v2 (20 Okt) — satu set ikon (Item 128, keputusan Owner): lucide-react diganti komponen <Ikon nama="…">
// (components/Ikon.jsx) dan ikon aplikasi kini dibaca dari metadata system.json. Keduanya ikut diperiksa, dan
// lucide tak boleh kembali.
console.log('uji-ikon-subset v2');
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

/**
 * Nama ikon lewat komponen <Ikon> (v2):
 *   <Ikon nama="close" />                              ← diperiksa
 *   <Ikon nama={buka ? 'expand_more' : 'chevron_right'} />  ← setiap nama berkutip di dalamnya diperiksa
 *   <Ikon nama={icon.ikon} />                          ← DILEWATI; nilainya ditulis di tempat lain sebagai
 *   ikon = 'data_object' · ikon: 'draft' · icon: 'bolt' · icon="memory"   ← diperiksa
 */
export function namaIkonKomponen(isi) {
  const hasil = [];
  for (const m of isi.matchAll(/<Ikon\b[^>]*?\bnama="([a-z0-9_]+)"/g)) hasil.push(m[1]);
  for (const m of isi.matchAll(/<Ikon\b[^>]*?\bnama=\{([^}]*)\}/g)) {
    for (const k of m[1].matchAll(/'([a-z0-9_]+)'/g)) hasil.push(k[1]);
  }
  for (const m of isi.matchAll(/\b(?:icon|ikon)\s*[:=]\s*'([a-z0-9_]+)'/g)) hasil.push(m[1]);
  for (const m of isi.matchAll(/\bicon="([a-z0-9_]+)"/g)) hasil.push(m[1]);
  return hasil;
}

// Pemindaian
const dipakai = new Map();
(function jalan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') jalan(p); continue; }
    if (!/\.(jsx?|tsx?)$/.test(e.name)) continue;
    const isi = readFileSync(p, 'utf8');
    for (const nama of [...namaIkonLiteral(isi), ...namaIkonKomponen(isi)]) {
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

// ── v2: komponen <Ikon>, ikon aplikasi di metadata, dan lucide tak kembali ────────────────────────
console.log('\n-- v2: satu set ikon --');
cek(namaIkonKomponen('<Ikon nama="system_update" ukuran={16} />').join() === 'system_update', '<Ikon nama="…"> tertangkap');
cek(namaIkonKomponen(`<Ikon nama={buka ? 'expand_more' : 'system_update'} ukuran={16} />`).join() === 'expand_more,system_update',
  'kedua cabang nama={a ? … : …} tertangkap');
cek(namaIkonKomponen(`if (x) ikon = 'system_update';`).join() === 'system_update', "penugasan ikon = '…' tertangkap (FileExplorer)");
cek(namaIkonKomponen('<StatCard icon="system_update" />').join() === 'system_update', 'prop icon="…" tertangkap (SystemLogsApp)');
cek(namaIkonKomponen('<Ikon nama={icon.ikon} />').length === 0, 'nama={variabel} DILEWATI — nilainya diperiksa di tempat ia ditulis');
for (const n of ['data_object', 'code_blocks', 'draft', 'memory', 'bolt']) {
  cek(dipakai.has(n) && subset.has(n), `ikon lewat variabel/prop terbaca dan ada di subset: ${n}`, { dipakai: dipakai.has(n) });
}

const APPS = JSON.parse(readFileSync(`${AKAR}/../public/metadata/system.json`, 'utf8')).apps;
const ikonApp = APPS.map((a) => a.icon);
cek(ikonApp.every((i) => /^[a-z][a-z0-9_]+$/.test(i || '')), 'metadata: setiap aplikasi menyebut ikon bernama Material (huruf kecil, bukan nama lucide)', ikonApp);
cek(ikonApp.every((i) => subset.has(i)), 'metadata: semua ikon aplikasi ada di subset font', ikonApp.filter((i) => !subset.has(i)));
const kembar = ikonApp.filter((v, i) => ikonApp.indexOf(v) !== i);
cek(kembar.length === 0, `metadata: ${ikonApp.length} aplikasi, tak ada ikon kembar`, kembar);
const forge = APPS.find((a) => a.id === 'app:agent-forge')?.icon;
cek(forge && forge !== 'architecture', `Agent Forge (${forge}) tak lagi memakai ikon logo Mamet (architecture)`);

// Kode mati K6 (Login, EngineerChat, ActivityBar) — pemakai lucide terakhir — dihapus 20 Okt bersama paketnya.
const masihLucide = [];
(function jalan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') jalan(p); continue; }
    if (!/\.(jsx?|tsx?)$/.test(e.name)) continue;
    const rel = path.relative(AKAR, p).split(path.sep).join('/');
    if (/['"]lucide-react['"]/.test(readFileSync(p, 'utf8'))) masihLucide.push(rel);
  }
})(AKAR);
cek(masihLucide.length === 0, 'tak ada berkas yang memakai lucide-react (termasuk import() dinamis di Kernel)', masihLucide);
const PKG = JSON.parse(readFileSync(`${AKAR}/../package.json`, 'utf8'));
cek(!('lucide-react' in { ...PKG.dependencies, ...PKG.devDependencies }), 'paket lucide-react tak lagi menjadi dependensi (K6)');
const tebak = ['components/os/Sidebar.jsx', 'components/os/MobileBottomNav.jsx']
  .filter((f) => /getIcon\s*\(/.test(readFileSync(`${AKAR}/${f}`, 'utf8')));
cek(tebak.length === 0, 'menu tak lagi MENEBAK ikon dari nama aplikasi — membaca app.icon dari metadata', tebak);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

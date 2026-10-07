// UJI 2026-10-07 — uraian Markdown Mametlite menghasilkan DATA, bukan HTML.
//
// Yang dijaga di sini, dan kenapa ia pantas jadi uji dan bukan sekadar perbaikan sekali jalan:
//
//   1. PELOLOSAN  — muatan `<img onerror>`, `<audio onerror>`, `<animate>` jadi TEKS, bukan tag.
//   2. SKEMA      — `javascript:` / `data:` / `vbscript:` ditolak jadi tautan, dan penolakannya
//                   TERLIHAT (jatuh ke teks aslinya), bukan dibuang diam-diam.
//   3. NALAR UTUH — blok `<think>` Mametlite sengaja ditampilkan; perbaikan keamanan tidak boleh
//                   diam-diam mematikannya, termasuk dua kelonggaran stream-nya.
//   4. TERPASANG  — `dangerouslySetInnerHTML` benar-benar HILANG dari `mametlite/src`, dan
//                   perendernya benar-benar dipakai. Ini asersi yang membuat kelas cacatnya tidak
//                   bisa kembali: tanpa penyuntikan, tak ada daftar putih yang perlu dijaga benar.
//
// Asersi 4 itu yang membedakan uji ini dari "sudah saya perbaiki". Daftar putih lama sudah benar
// menurut penulisnya juga — yang kurang bukan ketelitian, melainkan penjaga.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// AKAR diturunkan dari letak berkas ini, mengikuti `uji-cari-judul.mjs` — BUKAN dipaku
// 'D:/SLAMET/...'. 69 berkas uji lain masih memakunya (J3/J1 di ROADMAP-SIAP-PENGGUNA.md); uji baru
// tidak boleh menambah satu lagi.
const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));

const M = await import(
  pathToFileURL(`${AKAR}/mametlite/src/lib/markdown.js`).href + '?v=' + Date.now()
);

console.log(`uji-uraian-markdown v1 · modul: ${M.VERSI_URAIAN}`);

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''),
  );
  if (!ok) gagal++;
};

/** Semua teks yang akan dirender React, digabung — inilah yang sampai ke mata pengguna. */
const semuaTeks = (simpul) =>
  simpul
    .map((s) => {
      if (s.jenis === 'nalar') return semuaTeks(s.anak);
      if (s.jenis === 'teks') return s.isi;
      if (s.jenis === 'tebal' || s.jenis === 'miring') return s.isi;
      if (s.jenis === 'tautan') return s.teks;
      return '';
    })
    .join('');

const adaJenis = (simpul, jenis) =>
  simpul.some((s) => s.jenis === jenis || (s.jenis === 'nalar' && adaJenis(s.anak, jenis)));

// ── 1. Pelolosan: muatan suntikan jadi TEKS ─────────────────────────────────────────────────────
console.log('\n-- 1. muatan suntikan jadi teks, bukan tag --');

const muatan = [
  ['<img src=x onerror=alert(1)>', 'img onerror — tag yang DULU lolos daftar putih'],
  ['<audio src=x onerror=alert(1)>', 'audio onerror — LUBANGNYA: `a` di daftar putih cuma 1 huruf'],
  ['<animate onbegin=alert(1)>', 'animate — sama, namanya mulai dengan "a"'],
  ['<a href="x" onmouseover=alert(1)>klik</a>', 'a dengan atribut kejadian'],
  ['<div onclick=alert(1)>x</div>', 'div — tag yang memang ada di daftar putih'],
  ['<strong onmouseenter=alert(1)>x</strong>', 'strong dengan atribut kejadian'],
  ['<script>alert(1)</script>', 'script'],
  ['<iframe src=javascript:alert(1)>', 'iframe'],
  ['<svg><set onbegin=alert(1)>', 'svg + set'],
];

for (const [jahat, nama] of muatan) {
  const simpul = M.uraikanMarkdown(jahat);
  const teks = semuaTeks(simpul);
  // Yang benar: tulisannya UTUH sebagai teks (React yang meloloskannya saat render), dan tidak ada
  // satu pun simpul tautan/gambar yang lahir darinya.
  cek(
    teks.includes(jahat) && !adaJenis(simpul, 'tautan') && !adaJenis(simpul, 'gambar'),
    `${nama} → teks utuh, nol tautan/gambar`,
    simpul,
  );
}

cek(
  M.uraikanMarkdown('<img src=x onerror=alert(1)>').every(
    (s) => s.jenis === 'teks' || s.jenis === 'baris',
  ),
  'tidak ada jenis simpul lain yang diam-diam lahir dari muatan suntikan',
  M.uraikanMarkdown('<img src=x onerror=alert(1)>'),
);

// Tidak ada satu pun simpul yang memuat HTML siap-suntik.
const bocorHtml = JSON.stringify(M.uraikanMarkdown(muatan.map(([m]) => m).join('\n')));
cek(!bocorHtml.includes('__html'), 'hasil uraian tidak memuat kunci `__html` sama sekali');

// ── 2. Skema alamat ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. skema alamat: yang ditolak tetap TERLIHAT --');

cek(M.alamatAman('https://contoh.id/a') === 'https://contoh.id/a', 'https diterima');
cek(M.alamatAman('http://contoh.id/a') === 'http://contoh.id/a', 'http diterima');
cek(M.alamatAman('mailto:a@b.id') === 'mailto:a@b.id', 'mailto diterima');

for (const jahat of [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///C:/Windows/win.ini',
]) {
  cek(M.alamatAman(jahat) === null, `ditolak: ${jahat.slice(0, 42)}`);
}
cek(M.alamatAman('foo.png') === null, 'alamat relatif ditolak — tidak ditulis ulang ke host karangan');
cek(M.alamatAman('') === null && M.alamatAman(null) === null, 'kosong & null ditolak tanpa melempar');

let s = M.uraikanMarkdown('[klik](javascript:alert(1))');
cek(!adaJenis(s, 'tautan'), 'tautan javascript: TIDAK jadi tautan', s);
cek(
  semuaTeks(s).includes('[klik](javascript:alert(1))'),
  'dan tulisan Markdown aslinya TETAP TERLIHAT — penolakan tidak senyap',
  s,
);

s = M.uraikanMarkdown('![x](data:text/html,<script>alert(1)</script>)');
cek(!adaJenis(s, 'gambar'), 'gambar data: TIDAK jadi gambar', s);
cek(semuaTeks(s).includes('data:text/html'), 'dan tulisannya tetap terlihat', s);

// ── 3. Nalar & Markdown biasa tetap utuh ────────────────────────────────────────────────────────
console.log('\n-- 3. nalar & Markdown biasa tidak ikut mati --');

s = M.uraikanMarkdown('<think>menimbang dulu</think>Jawabannya 120.');
cek(adaJenis(s, 'nalar'), 'blok <think> dikenali');
cek(
  s.find((x) => x.jenis === 'nalar') &&
    semuaTeks(s.find((x) => x.jenis === 'nalar').anak).includes('menimbang dulu'),
  'isi nalarnya utuh',
  s,
);
cek(semuaTeks(s).includes('Jawabannya 120.'), 'jawaban sesudah nalar tetap ada');

cek(adaJenis(M.uraikanMarkdown('&lt;think&gt;x&lt;/think&gt;y'), 'nalar'), '<think> ber-escape ikut dikenali');
cek(adaJenis(M.uraikanMarkdown('think saya menimbang\n\nJawab.'), 'nalar'), '"think " tanpa kurung sudut tetap membuka nalar');
cek(adaJenis(M.uraikanMarkdown('<think>masih mengalir'), 'nalar'), '<think> tanpa penutup tetap dikenali (saat stream)');
cek(
  adaJenis(M.uraikanMarkdown('<think>menimbang panjang sekali dulu Halo Pak'), 'nalar'),
  '<think> tanpa penutup & tanpa baris kosong ditutup di salam',
);

s = M.uraikanMarkdown('**tebal** dan *miring*');
cek(adaJenis(s, 'tebal') && adaJenis(s, 'miring'), 'tebal & miring masih bekerja', s);
cek(s.find((x) => x.jenis === 'tebal').isi === 'tebal', 'isi tebal benar');

s = M.uraikanMarkdown('[Kepbup](https://contoh.id/k.pdf)');
cek(adaJenis(s, 'tautan') && s[0].alamat === 'https://contoh.id/k.pdf', 'tautan https jadi tautan', s);
cek(s[0].teks === 'Kepbup', 'teks tautan benar');

s = M.uraikanMarkdown('![peta](https://contoh.id/p.png)');
cek(adaJenis(s, 'gambar') && s[0].alamat === 'https://contoh.id/p.png', 'gambar https jadi gambar', s);

cek(adaJenis(M.uraikanMarkdown('a\nb'), 'baris'), 'baris baru jadi simpul `baris`');
cek(M.uraikanMarkdown('').length === 0, 'teks kosong → array kosong, bukan null');
cek(Array.isArray(M.uraikanMarkdown(null)), 'null → array, tidak melempar');

// Gambar harus menang atas tautan: `![a](b)` memuat `[a](b)`.
s = M.uraikanMarkdown('![a](https://contoh.id/b.png)');
cek(s.length === 1 && s[0].jenis === 'gambar', 'gambar diurai lebih dulu daripada tautan', s);

// ── 4. TERPASANG — kelas cacatnya benar-benar hilang dari aplikasi ──────────────────────────────
console.log('\n-- 4. terpasang: penyuntikan HTML hilang dari mametlite/src --');

const berkasApp = `${AKAR}/mametlite/src/App.jsx`;
const isiApp = readFileSync(berkasApp, 'utf8');

// Komentar DIBUANG sebelum diperiksa. Berkas itu memang menyebut `dangerouslySetInnerHTML` dalam
// komentar sejarahnya ("DULU: …"), dan itu benar — catatan kenapa sesuatu dihapus berguna bagi
// pembaca berikutnya. Yang dilarang adalah PEMAKAIANNYA, bukan penyebutannya; mencocokkan kata
// mentah akan menghukum dokumentasi yang jujur dan memaksa penulis berikutnya menyamarkan kata itu.
const kodeSaja = isiApp
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((b) => !/^\s*\/\//.test(b))
  .join('\n');

cek(
  !/dangerouslySetInnerHTML/.test(kodeSaja),
  '`dangerouslySetInnerHTML` TIDAK DIPAKAI LAGI di App.jsx — ini yang menghapus kelas cacatnya, bukan daftar putih yang lebih rapat',
);
cek(
  !/\(\?!div\|/.test(kodeSaja) && !/__html/.test(kodeSaja),
  'daftar putih lama & pembungkus `__html` sudah tidak dipakai',
);
cek(
  /dangerouslySetInnerHTML/.test(isiApp),
  'komentarnya MASIH menyebutnya — catatan kenapa ia dihapus tidak boleh ikut hilang',
);
// Rantai TERPASANG: App.jsx → TeksKaya.jsx → markdown.js. Diperiksa tiap mata rantainya, karena
// "modulnya ada" bukan bukti ia dipakai.
cek(/<TeksKaya\s/.test(kodeSaja), 'App.jsx benar-benar MERENDER dengan <TeksKaya>');
cek(
  /from '\.\/lib\/TeksKaya'/.test(kodeSaja),
  'App.jsx mengimpor perender itu — bukan menyalin ulang logikanya',
);

const isiTeksKaya = readFileSync(`${AKAR}/mametlite/src/lib/TeksKaya.jsx`, 'utf8');
cek(/uraikanMarkdown/.test(isiTeksKaya), 'TeksKaya memakai uraian dari markdown.js');

const isiLib = readFileSync(`${AKAR}/mametlite/src/lib/markdown.js`, 'utf8');
cek(!/innerHTML/.test(isiLib), 'modul uraian tidak menyebut innerHTML sama sekali');
cek(
  !/dangerouslySetInnerHTML/.test(
    isiTeksKaya
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((b) => !/^\s*\/\//.test(b))
      .join('\n'),
  ),
  'perendernya sendiri juga tidak menyuntikkan HTML',
);

// ── 5. KELUARAN RENDER — bukti terakhir, bukan hanya tokennya ───────────────────────────────────
console.log('\n-- 5. HTML yang benar-benar keluar dari React --');

// Kenapa bagian ini ada: bagian 1 membuktikan muatan jahat jadi token `teks`, tetapi itu belum
// membuktikan apa yang SAMPAI KE HALAMAN. Yang menentukan adalah keluaran render. Layar chat
// Mametlite ada di belakang login ke Supabase produksi, jadi ia tidak bisa dibuka di sini — dan
// `react-dom/server` memberi bukti yang sama tanpa menyentuh akun siapa pun.
let render = null;
let sebabGagalRender = '';
const tmp = mkdtempSync(join(tmpdir(), 'uji-teks-kaya-'));
try {
  const { build } = await import(
    pathToFileURL(`${AKAR}/frontend/node_modules/esbuild/lib/main.js`).href
  );
  const keluar = join(tmp, 'render.mjs');
  await build({
    stdin: {
      contents:
        "import { renderToStaticMarkup } from 'react-dom/server';\n" +
        "import TeksKaya from './TeksKaya.jsx';\n" +
        'export const render = (teks) => renderToStaticMarkup(<TeksKaya teks={teks} className="uji" />);\n',
      resolveDir: `${AKAR}/mametlite/src/lib`,
      loader: 'jsx',
      sourcefile: 'masuk.jsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    outfile: keluar,
    logLevel: 'silent',
    // `react-dom/server` masih CJS di dalamnya dan memanggil `require('util')`. Bundel ESM tidak
    // punya `require`, jadi disediakan di sini — tanpa ini esbuild gagal dengan
    // "Dynamic require of \"util\" is not supported", dan kegagalan itu TENTANG PEMBUNGKUSAN,
    // bukan tentang keamanan yang diuji. Dibedakan supaya pesan merahnya tidak menyesatkan.
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
  });
  ({ render } = await import(pathToFileURL(keluar).href + '?v=' + Date.now()));
} catch (e) {
  sebabGagalRender = e?.message || String(e);
}

cek(!!render, `perender bisa dibangun & dimuat${sebabGagalRender ? ` (${sebabGagalRender.slice(0, 160)})` : ''}`);

if (render) {
  // Asersi ini DIPERBAIKI saat ditulis, dan sebabnya pantas dicatat: bentuk pertamanya mencari
  // /\bon(error|click|…)=/ di keluaran, lalu MERAH pada keluaran yang justru benar —
  // `&lt;img src=x onerror=alert(1)&gt;`. Tulisan "onerror=" memang ada di sana, sebagai TEKS, dan
  // itu yang kita mau: pengguna melihat apa yang model tulis. Yang salah asersinya, bukan kodenya.
  //
  // Pernyataan yang tepat lebih sederhana DAN lebih kuat: dari muatan jahat, keluarannya tidak
  // boleh memuat satu pun `<` di dalam pembungkusnya — nol markup, bukan "markup yang tidak
  // berbahaya". Dengan begitu tak ada atribut yang bisa hidup, karena tak ada tag tempat ia menempel.
  for (const [jahat, nama] of muatan) {
    const html = render(jahat);
    const dalam = html.replace(/^<div class="uji">/, '').replace(/<\/div>$/, '');
    cek(!dalam.includes('<'), `render ${nama} → NOL markup lahir darinya`, html.slice(0, 220));
    cek(/&lt;/.test(html), `render ${nama} → kurung sudutnya ter-escape, tulisannya tetap terbaca`, html.slice(0, 160));
  }

  let html = render('[klik](javascript:alert(1))');
  cek(!/<a\b/i.test(html), 'render tautan javascript: → nol elemen <a>', html.slice(0, 200));
  cek(/javascript:alert\(1\)/.test(html), 'tulisannya tetap terlihat sebagai teks', html.slice(0, 200));

  html = render('![x](https://contoh.id/a.png)');
  cek(/<img[^>]+src="https:\/\/contoh\.id\/a\.png"/.test(html), 'gambar https tetap dirender', html.slice(0, 200));

  html = render('[Kepbup](https://contoh.id/k.pdf)');
  cek(
    /<a[^>]+href="https:\/\/contoh\.id\/k\.pdf"/.test(html) && /rel="noopener noreferrer"/.test(html),
    'tautan https dirender beserta rel="noopener noreferrer"',
    html.slice(0, 220),
  );

  html = render('<think>menimbang</think>**Jawab** 120');
  cek(/menimbang/.test(html) && /<strong>Jawab<\/strong>/.test(html), 'nalar & tebal tetap tampil setelah dirender', html.slice(0, 250));
}

rmSync(tmp, { recursive: true, force: true });

// Penjaga CSP: Mametlite tidak punya `vercel.json` sebelum ini, jadi nol header keamanan.
let vercel = null;
try {
  vercel = JSON.parse(readFileSync(`${AKAR}/mametlite/vercel.json`, 'utf8'));
} catch {
  /* ditangani asersi di bawah */
}
cek(!!vercel, 'mametlite/vercel.json ada');
const csp = JSON.stringify(vercel?.headers ?? []);
cek(/Content-Security-Policy/.test(csp), 'CSP terpasang sebagai header');
cek(/X-Frame-Options|frame-ancestors/.test(csp), 'pembingkaian dibatasi');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);

// UJI 2026-10-19 — jawaban model di chat Ecosystem dirender sebagai Markdown, termasuk blok kode (Item 127,
// kenyamanan mata).
//
// Kenapa ada: Owner, 19 Okt, melihat `**Nilai Evaluasi…**`, `| Indikator | Satuan |`, dan `|-----|` mentah di sela
// jawaban — layar menampilkan Markdown sebagai teks polos. Owner menunjuk gambar rujukan (daftar rapi, kode sebaris
// sebagai label, tabel) dan menambahkan: "pikirkan juga kalau yang ditampilkan sebuah code".
//
// Uji ini MERENDER komponen sungguhan (TeksMarkdown.jsx dibundel esbuild, dirender react-dom/server), bukan hanya
// mencari teks di sumbernya. Yang dijaga:
//   1. BENTUK   — tebal, daftar, tabel, kode sebaris, tautan benar-benar jadi elemennya; simbol mentah hilang.
//   2. KODE     — blok kode: baris tidak dipatahkan, bergulir mendatar, isi utuh (lekuk, `**`, `<tag>` tidak
//                 diolah), label bahasa, tombol Salin; pagar ``` yang belum ditutup (jawaban masih mengalir)
//                 tetap jadi blok kode.
//   3. AMAN     — HTML mentah jadi TEKS, tautan `javascript:` tak punya href; tidak ada jalan penyuntikan
//                 (rehype-raw / dangerouslySetInnerHTML / urlTransform buatan sendiri) di komponen.
//   4. TERPASANG — ConversationEngine memakainya hanya untuk jawaban model; pesan pengguna tetap apa adanya;
//                 penanda Engineer ([MAMET_CMD] dll.) tetap dipisah SEBELUM Markdown; nalar <think> tetap tampil.

import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FE = join(AKAR, 'frontend');
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) => kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-markdown-chat v4');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 500) : '')); }
};

// ── Bundel komponen sungguhan ───────────────────────────────────────────────────────────────────
const esbuild = createRequire(join(FE, 'package.json'))('esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'uji-markdown-chat-'));
const keluar = join(tmp, 'render.mjs');
await esbuild.build({
  stdin: {
    contents: `import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import TeksMarkdown, { KotakKode } from './src/components/workbench/TeksMarkdown.jsx';
      import { riwayatPerintahDariPesan, pesanKeluaranPerintah } from './src/core/runtime/services/engineer/ProsedurEngineer.js';
      export const render = (teks) => renderToStaticMarkup(React.createElement(TeksMarkdown, { teks }));
      export const renderKotak = (p) => renderToStaticMarkup(React.createElement(KotakKode, p));
      export { riwayatPerintahDariPesan, pesanKeluaranPerintah, TeksMarkdown };`,
    resolveDir: FE, loader: 'jsx',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: keluar, jsx: 'automatic', logLevel: 'silent',
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
const { render, renderKotak, riwayatPerintahDariPesan, pesanKeluaranPerintah, TeksMarkdown } = await import(pathToFileURL(keluar).href);
rmSync(tmp, { recursive: true, force: true });

// ── 1. Bentuk ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. Markdown jadi elemennya, simbol mentah hilang --');
const contohOwner = '**Nilai Evaluasi Kinerja**\n\n| Indikator | Satuan |\n|-----------|--------|\n| Air | m³ |\n\n- satu\n- dua\n\n1. pertama\n2. kedua\n\nPakai `npm run desktop` lalu buka [dokumen](https://example.com).';
const h = render(contohOwner);
cek(/<strong[^>]*>Nilai Evaluasi Kinerja<\/strong>/.test(h), 'tebal → <strong>');
cek(/<table[\s\S]*<th[^>]*>Indikator<\/th>[\s\S]*<td[^>]*>Air<\/td>/.test(h), 'tabel → <table> dengan kepala & isi');
cek(!/\*\*|\|-{3,}|\| Indikator/.test(h), 'tak ada `**` atau garis tabel mentah tersisa', h.slice(0, 300));
cek(/<ul[^>]*>[\s\S]*<li[^>]*>satu<\/li>/.test(h) && /<ol[^>]*>[\s\S]*<li[^>]*>pertama<\/li>/.test(h), 'daftar berpoin & bernomor');
cek(/<code class="[^"]*rounded[^"]*">npm run desktop<\/code>/.test(h), 'kode sebaris → label kecil');
const tautan = (h.match(/<a [^>]*>/) || [''])[0];
cek(/href="https:\/\/example.com"/.test(tautan) && /target="_blank"/.test(tautan) && /rel="noopener noreferrer"/.test(tautan),
  'tautan https dibuka di luar (target _blank, noopener)', tautan);
cek(/<div class="[^"]*leading-7/.test(h), 'jarak baris prosa 1,75 (leading-7) — kolom lebar ±134 karakter');

// ── 2. Kode ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. blok kode --');
const kode = 'function f() {\n  if (a) {\n    return "**bukan tebal** <b>bukan tag</b>";\n  }\n}';
const hk = render('Contoh:\n\n```js\n' + kode + '\n```\n');
const isiPre = (hk.match(/<pre[^>]*>([\s\S]*?)<\/pre>/) || [, ''])[1];
const dekode = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
cek(dekode(isiPre) === kode, 'isi kode UTUH — lekuk, `**`, dan `<b>` tidak diolah', dekode(isiPre));
cek(!/<strong|<b>/.test(isiPre), 'tak ada elemen tebal di dalam blok kode');
// Potongan dari TENGAH fungsi — baris pertamanya berlekuk; memangkas spasi awal merusak struktur yang ditunjukkan.
const potongan = '    return total;\n  }\n}';
const isiPotongan = (render('```js\n' + potongan + '\n```').match(/<pre[^>]*>([\s\S]*?)<\/pre>/) || [, ''])[1];
cek(dekode(isiPotongan) === potongan, 'lekuk baris PERTAMA tetap utuh (potongan dari tengah fungsi)', dekode(isiPotongan));
cek(/<code class="[^"]*whitespace-pre(?!-)/.test(hk), 'baris kode TIDAK dipatahkan (whitespace-pre, bukan pre-wrap)');
cek(/<pre class="[^"]*overflow-x-auto/.test(hk), 'baris panjang digulir mendatar di dalam kotaknya');
cek(/font-mono/.test(isiPre) || /<code class="[^"]*font-mono/.test(hk), 'huruf mono');
cek(/>js<\/span>/.test(hk), 'label bahasa dari pagar ```js');
cek(/<button[^>]*title="Salin kode"[\s\S]*?Salin<\/button>/.test(hk), 'tombol Salin');
cek(/>kode<\/span>/.test(render('```\nx = 1\n```')), 'tanpa bahasa → label "kode"');
const mengalir = render('Berikut:\n\n```python\ndef f():\n    return 1');
cek(/<pre[\s\S]*def f\(\):\n    return 1/.test(mengalir), 'pagar ``` belum ditutup (masih mengalir) tetap blok kode, lekuk utuh');

// ── 3. Aman ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. aman --');
for (const [muatan, nama] of [
  ['<img src=x onerror=alert(1)>', 'img onerror'],
  ['<script>alert(1)</script>', 'script'],
  ['<iframe src="javascript:alert(1)"></iframe>', 'iframe'],
]) {
  const hs = render('teks ' + muatan);
  cek(!/<img|<script|<iframe/i.test(hs), `${nama} tidak jadi tag`, hs);
}
const hj = render('[klik](javascript:alert(1))');
cek(!/href="javascript:/i.test(hj), 'tautan javascript: tak punya href', hj);
const TM = tanpaKomentar(baca('frontend/src/components/workbench/TeksMarkdown.jsx'));
cek(!/rehype-raw|dangerouslySetInnerHTML|allowDangerousHtml|urlTransform/.test(TM), 'komponen tak membuka jalan penyuntikan');
cek(!/highlight|prism|shiki/i.test(TM), 'tanpa pustaka pewarna sintaks (menambah paket butuh izin Owner)');

// ── 4. Terpasang ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. terpasang di ConversationEngine --');
const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
cek(/import TeksMarkdown, \{ KotakKode \} from '\.\/TeksMarkdown\.jsx'/.test(CE), 'TeksMarkdown & KotakKode diimpor');
const iSplit = CE.indexOf('const parts = displayText.split(MARKER_RE)');
const iPakai = CE.indexOf('<TeksMarkdown');
cek(iSplit > 0 && iPakai > iSplit, 'penanda Engineer dipisah SEBELUM Markdown dirender', { iSplit, iPakai });
cek(/if \(m\.role !== 'user'\) return <TeksMarkdown key=\{i\} teks=\{part\} \/>;\s*return <span key=\{i\} className="whitespace-pre-wrap">\{part\}<\/span>;/.test(CE),
  'hanya jawaban model yang dirender Markdown; pesan pengguna tetap apa adanya');
cek(/\{parsed\.thinking\}/.test(CE), 'nalar <think> tetap ditampilkan');

// v3 (pemeriksaan "error tersembunyi" 19 Okt): setiap potongan jawaban merender ulang SELURUH daftar pesan. Tanpa memo,
// Markdown semua jawaban lama diurai ulang tiap token — diukur ±6,7 ms per jawaban panjang → chat 30 jawaban ±200 ms
// per token (anggaran satu bingkai 16 ms). Yang dijaga: komponen yang DIEKSPOR benar-benar memo, dan tak ada prop
// beridentitas baru tiap render yang akan menggagalkan memo-nya diam-diam.
cek(TeksMarkdown?.$$typeof === Symbol.for('react.memo'), 'TeksMarkdown yang diekspor adalah React.memo — jawaban lama tak diurai ulang tiap token');
const TMk = tanpaKomentar(baca('frontend/src/components/workbench/TeksMarkdown.jsx'));
cek(/remarkPlugins=\{PLUGIN\}/.test(TMk) && /const PLUGIN = \[remarkGfm\];/.test(TMk), 'daftar plugin konstan di luar komponen (tak dibuat ulang tiap render)');
const pakaiTM = [...CE.matchAll(/<TeksMarkdown ([^>]*)\/>/g)].map((m) => m[1].trim());
cek(pakaiTM.length > 0 && pakaiTM.every((p) => /^key=\{[^}]+\} teks=\{[^}]+\}$/.test(p)), 'ConversationEngine hanya mengoper `teks` (string) — memo bisa bekerja', pakaiTM);

// ── 5. Keluaran terminal Engineer (v2) ──────────────────────────────────────────────────────────
// Owner 19 Okt (gambar WS Engineer): "[TERMINAL OUTPUT for: …]" tampil sebagai teks biasa di gelembung pengguna —
// baris panjang tanpa spasi menjebol tepi gelembung. Isinya keluaran MESIN: tampil sebagai kotak kode.
console.log('\n-- 5. keluaran terminal Engineer jadi kotak kode --');
const perintah = 'git grep -n -E "[a-z]+Registry" -- frontend/src';
const keluaran = 'frontend/src/core/runtime/services/engineer/CapabilityGuard.js:137:  // [FIX 2026-09-09] leading slash dihapus\n  baris berlekuk';
const urai = riwayatPerintahDariPesan([{ content: pesanKeluaranPerintah(perintah, keluaran) }])[0];
cek(urai?.perintah === perintah, 'perintah yang memuat "]" diurai utuh (pengurai yang sama dengan riwayat perintah)', urai);
const hTerminal = renderKotak({ isi: urai?.keluaran, label: 'terminal', perintah: urai?.perintah, tinggiMaks: true });
// v4: label jenis kapital, tetapi PERINTAH tetap huruf aslinya — huruf besar-kecil perintah bermakna (`-E` ≠ `-e`).
const perintahTampil = (hTerminal.match(/<span class="([^"]*)"> · ([^<]*)<\/span>/) || []);
cek(perintahTampil[2] && dekode(perintahTampil[2]) === perintah && /normal-case/.test(perintahTampil[1]) && !/(^|\s)uppercase(\s|$)/.test(perintahTampil[1]),
  'perintah terminal tampil dengan huruf aslinya (tidak dikapitalkan)', perintahTampil[0]);
const isiTerminal = (hTerminal.match(/<pre[^>]*>([\s\S]*?)<\/pre>/) || [, ''])[1];
cek(dekode(isiTerminal) === urai?.keluaran, 'isi keluaran utuh, lekuk tetap', dekode(isiTerminal));
cek(/<pre class="[^"]*overflow-x-auto[^"]*max-h-\[24rem\] overflow-y-auto/.test(hTerminal), 'baris panjang digulir mendatar; keluaran panjang digulir di dalam kotak');
cek(/<code class="[^"]*whitespace-pre(?!-)/.test(hTerminal), 'baris keluaran tidak dipatahkan');
cek(/<div class="my-3 min-w-0 /.test(hTerminal), 'kotak boleh menyempit di dalam gelembung (min-w-0) — tidak menjebol tepinya');
cek(/const terminal = m\.role === 'user' && riwayatPerintahDariPesan\(\[\{ content: displayText \}\]\)\[0\];\s*if \(terminal\) return <KotakKode isi=\{terminal\.keluaran\} label="terminal" perintah=\{terminal\.perintah\} tinggiMaks \/>;/.test(CE),
  'ConversationEngine merender keluaran terminal sebagai KotakKode, memakai pengurai riwayat perintah');

// ── 6. Kotak kode = kolom isian Settings (v4) ───────────────────────────────────────────────────
// Owner 20 Okt: "kolom code sama dengan kolom bertulisan gemini". Kelas tampilan isian Provider di Settings dibaca
// langsung dari Settings.jsx; kotak kode harus memuat semuanya — bila salah satu diubah tanpa yang lain, merah.
console.log('\n-- 6. kotak kode = kolom isian "gemini" di Settings --');
const STm = tanpaKomentar(baca('frontend/src/components/Settings.jsx'));
const iProvider = STm.indexOf('value={aiProvider}');
const kelasIsian = (STm.slice(iProvider, iProvider + 600).match(/className="([^"]*)"/) || [])[1] || '';
const TAMPILAN_ISIAN = kelasIsian.split(/\s+/).filter((k) => /^(bg-|border|px-|py-|rounded)/.test(k));
cek(TAMPILAN_ISIAN.length >= 5, `isian Provider di Settings: ${TAMPILAN_ISIAN.join(' ')}`, kelasIsian);
const kelasPre = (hTerminal.match(/<pre class="([^"]*)"/) || [])[1] || '';
const kurangIsian = TAMPILAN_ISIAN.filter((k) => !kelasPre.split(/\s+/).includes(k));
cek(kurangIsian.length === 0, 'kotak kode memakai kelas tampilan yang sama persis dengan isian Settings', { kurangIsian, kelasPre });
const iLabel = hTerminal.indexOf('text-label-mono'), iPre = hTerminal.indexOf('<pre');
cek(iLabel > 0 && iLabel < iPre, 'label (jenis · Salin) di ATAS kotak, bergaya label "MODEL ID" (text-label-mono)', { iLabel, iPre });
const iTerminal = CE.indexOf('const terminal = m.role');
cek(iTerminal > 0 && iTerminal < CE.indexOf('const parts = displayText.split(MARKER_RE)'), 'deteksi terminal mendahului pemisahan penanda');
cek(/'rounded-2xl px-4 py-3 [^']*\[overflow-wrap:anywhere\]/.test(CE), 'teks panjang lain di gelembung pengguna dipatahkan di dalam gelembung');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

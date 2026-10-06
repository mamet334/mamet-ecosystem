// UJI 2026-10-06 — TMN-0009: cangkang Electron berhenti longgar tanpa alasan.
//
// ── Tiga kelonggaran, dan NASIBNYA BERBEDA ──────────────────────────────────────────────────
//
// 1. `no-sandbox` global vs `sandbox: true` di webPreferences — konfigurasi yang MEMBANTAH
//    dirinya sendiri; sakelar baris perintah yang menang, jadi pembaca yang mengaudit
//    webPreferences menyimpulkan renderer ber-sandbox padahal tidak. DICABUT.
//
// 2. Nol penjaga navigasi — tanpa `setWindowOpenHandler`, jendela dari `window.open()` MEWARISI
//    preload, berarti mewarisi `engineer.jalankan`. DITUTUP.
//
// 3. `webSecurity: false` — TAMPAK kelalaian, hampir dinyalakan. **Ternyata load-bearing.**
//    `WebComparisonService.js:405` memanggil `fetch()` dari RENDERER ke RSS pihak ketiga
//    (news.google.com, bing.com, antaranews.com) yang tidak mengirim CORS. Menyalakannya akan
//    memutus pencarian web diam-diam. DIPERTAHANKAN, dan alasannya ditulis di kodenya.
//
// Berkas uji ini menjaga ketiganya — termasuk yang TIDAK diubah. Tanpa asersi untuk nomor 3,
// orang berikutnya (atau asisten berikutnya) akan "memperbaiki"-nya dan memutus pencarian.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-cangkang-electron v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const M = baca('frontend/electron/main.cjs');
const Mk = tanpaKomentar(M);

// ── 1. SANDBOX: konfigurasinya tidak boleh membantah dirinya lagi ──────────────────────────
console.log('\n-- sandbox --');
cek(!/^\s*app\.commandLine\.appendSwitch\('no-sandbox'\)/m.test(Mk),
  'no-sandbox TIDAK lagi dipanggil — sakelar itu mematikan sandbox RENDERER, jauh lebih luas dari kebutuhan GPU');
cek(/sandbox: true/.test(Mk), 'dan `sandbox: true` di webPreferences kini benar-benar berlaku');
cek(/appendSwitch\('disable-gpu-sandbox'\)/.test(Mk),
  'disable-gpu-sandbox DIPERTAHANKAN — itu yang sebenarnya menangani crash GPU');
cek(/disableHardwareAcceleration\(\)/.test(Mk), 'dan akselerasi perangkat keras tetap dimatikan');

// Preload harus tetap layak di renderer ber-sandbox: hanya `electron` yang boleh di-require.
{
  const P = tanpaKomentar(baca('frontend/electron/preload.cjs'));
  const req = [...P.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  cek(req.length > 0 && req.every((r) => r === 'electron'),
    `preload hanya require('electron') — layak di preload ber-sandbox (${req.join(', ') || 'tak ada'})`, req);
}

// ── 2. PENJAGA NAVIGASI ────────────────────────────────────────────────────────────────────
console.log('\n-- penjaga navigasi --');
cek(/setWindowOpenHandler/.test(Mk), 'setWindowOpenHandler terpasang');
cek(/return \{ action: 'deny' \}/.test(Mk),
  'dan MENOLAK semua jendela baru — tanpa ini, jendela baru mewarisi preload beserta engineer.jalankan');
cek(/on\('will-navigate'/.test(Mk), "will-navigate terpasang");
cek(/e\.preventDefault\(\)/.test(Mk), 'dan navigasi ke luar benar-benar dibatalkan');
cek(/shell\.openExternal/.test(Mk),
  'tautan luar diarahkan ke peramban SISTEM — di luar cangkang, jadi tidak membawa preload');

// Logika "asal sendiri" dijalankan, bukan dibaca. Ia yang memutuskan apa yang lewat.
console.log('\n-- logika asal sendiri (dijalankan) --');
{
  const m = M.match(/const asalSendiri = \(u\) => \{[\s\S]*?\n  \};/);
  cek(!!m, 'fungsi asalSendiri ditemukan untuk dijalankan');
  if (m) {
    // eslint-disable-next-line no-new-func
    const asalSendiri = new Function(`${m[0]} return asalSendiri;`)();
    const boleh = ['mamet://app/index.html', 'http://localhost:5173/', 'devtools://devtools/bundled/x.html'];
    // `http://localhost:51730/` adalah kasus penentu, dan ia ditemukan oleh uji mutasi.
    //
    // Bentuk pertama memakai `http://localhost:5173.jahat.com/` — dan itu HAMPA: titik dua di
    // sana memisahkan host dari PORT, `5173.jahat.com` bukan port yang sah, jadi `new URL()`
    // MELEMPAR dan `catch` memulangkan false. Ujinya lulus karena URL-nya tidak valid, bukan
    // karena pemeriksaan host-nya ketat — mutasi `host === …` → `host.startsWith(…)` lolos
    // tanpa satu pun asersi jatuh.
    //
    // `localhost:51730` adalah host yang SAH dan benar-benar berawalan `localhost:5173`, jadi ia
    // membedakan `===` dari `startsWith` — persis yang harus dijaga.
    const tolak = ['https://contoh.jahat/', 'http://localhost:9999/', 'file:///C:/Windows/system.ini',
                   'http://localhost:51730/', 'http://localhost:5173.jahat.com/',
                   'javascript:alert(1)', 'data:text/html,<b>x', ''];
    for (const u of boleh) cek(asalSendiri(u) === true, `DIIZINKAN: ${u}`);
    for (const u of tolak) cek(asalSendiri(u) === false, `DITOLAK: ${u || '(kosong)'}`);
  }
}

// ── 3. webSecurity: false DIPERTAHANKAN — dan ini yang paling mudah "diperbaiki" keliru ───
console.log('\n-- webSecurity sengaja dipertahankan --');
cek(/webSecurity: false/.test(Mk),
  'webSecurity TETAP false — menyalakannya memutus fetch RSS lintas-origin dari renderer');
cek(/WebComparisonService/.test(M) && /CORS|Access-Control-Allow-Origin/.test(M),
  'dan ALASANNYA tertulis di kodenya, bukan cuma di dokumen yang tak dibaca saat menyunting');
cek(/corsEnabled: true/.test(Mk),
  'protokol mamet:// sendiri sudah benar — jadi bukan protokolnya yang menghalangi');

// Penjaga sesungguhnya untuk nomor 3: pemanggilan fetch lintas-origin itu memang masih di renderer.
// Bila suatu hari ia pindah, asersi ini jatuh dan keputusan di atas WAJIB ditinjau ulang.
{
  const W = baca('frontend/src/core/runtime/services/WebComparisonService.js');
  const adaFetch = /\bfetch\(/.test(tanpaKomentar(W));
  const adaRss = /news\.google\.com|bing\.com|antaranews\.com/.test(W);
  cek(adaFetch && adaRss,
    'WebComparisonService MASIH memanggil fetch() ke RSS pihak ketiga dari renderer — dasar keputusan di atas',
    { adaFetch, adaRss });
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

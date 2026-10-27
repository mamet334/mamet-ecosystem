// UJI 2026-10-27 — "Black October": pengambil web Tier 3 (`net:fetchWeb`) pindah dari `fetch()` Node ke `net.fetch`.
//
// CVE-2026-111497: dekoder Brotli Node bawaan Electron 42.3.3 (Node 24.15.0) rentan; jalur ini mengambil situs pihak
// ketiga di PROSES UTAMA. Brotli Chromium 148 sudah tertambal (alasan & buktinya di electron/ambilWeb.cjs).
//
// Yang dijaga:
//   1. logika ambilWeb dengan tiruan: hanya http/https, kredensial tidak dikirim, header, batas waktu, bentuk hasil;
//   2. kabel: main.cjs memakai `net.fetch`, dan TIDAK ADA `fetch()` Node di kode proses utama;
//   3. Electron SUNGGUHAN: Brotli diurai Chromium, `file://` & cookie tertutup — masing-masing dengan KONTROL POSITIF
//      (`net.fetch` mentah memang membaca `file://` dan mengirim cookie), supaya lulusnya bukan karena ujinya buta.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const BERKAS_MODUL = path.join(AKAR, 'frontend', 'electron', 'ambilWeb.cjs');
const { ambilWeb } = require(BERKAS_MODUL);

console.log('uji-ambil-web v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Logika dengan tiruan ───────────────────────────────────────────────────────────────────
console.log('\n-- 1. logika (tiruan) --');
{
  const panggilan = [];
  const tiruan = async (url, init) => {
    panggilan.push({ url, init });
    return { ok: true, status: 200, statusText: 'OK', text: async () => 'isi' };
  };

  for (const url of ['file:///C:/Windows/win.ini', 'mamet://app/index.html', 'data:text/plain,x', 'javascript:alert(1)', 'ftp://contoh.id/a']) {
    const h = await ambilWeb(tiruan, { url });
    cek(h.ok === false && h.status === 0 && /ditolak/.test(h.error), `${url.split(':')[0]}: ditolak`, h);
  }
  const tidakSah = await ambilWeb(tiruan, { url: 'bukan url' });
  cek(tidakSah.ok === false && /tidak sah/.test(tidakSah.error), 'URL tidak sah → galat, tidak melempar', tidakSah);
  cek(panggilan.length === 0, 'tak satu pun yang ditolak sampai ke jaringan', panggilan);

  const h = await ambilWeb(tiruan, { url: 'https://news.google.com/rss', options: { headers: { 'Accept-Language': 'en' } } });
  cek(h.ok === true && h.status === 200 && h.statusText === 'OK' && h.data === 'isi', 'https → bentuk hasil {ok,status,statusText,data} tetap', h);
  const init = panggilan[0]?.init || {};
  cek(panggilan.length === 1 && panggilan[0].url === 'https://news.google.com/rss', 'pengambil yang DISUNTIKKAN yang dipakai');
  cek(init.method === 'GET', 'metode bawaan GET', init.method);
  cek(init.credentials === 'omit', "credentials: 'omit' — cookie/autentikasi sesi tidak ikut terkirim", init.credentials);
  cek(/Mozilla\/5\.0/.test(init.headers?.['User-Agent'] || ''), 'User-Agent bawaan terpasang');
  cek(init.headers?.['Accept-Language'] === 'en', 'header dari pemanggil menimpa bawaan');
  cek(init.signal instanceof AbortSignal, 'sinyal batal diteruskan');

  await ambilWeb(tiruan, { url: 'http://contoh.id/', options: { method: 'HEAD' } });
  cek(panggilan[1]?.init.method === 'HEAD', 'metode dari pemanggil diteruskan; http juga boleh');

  const melempar = await ambilWeb(async () => { throw new Error('net::ERR_NAME_NOT_RESOLVED'); }, { url: 'https://tak-ada.invalid/' });
  cek(melempar.ok === false && melempar.status === 0 && melempar.error === 'net::ERR_NAME_NOT_RESOLVED', 'galat jaringan → {ok:false,status:0,error}', melempar);

  // Batas waktu berlaku sampai BADAN selesai dibaca (versi lama membersihkannya begitu header tiba).
  const macet = (url, i) => new Promise((resolve, reject) => {
    i.signal.addEventListener('abort', () => reject(new Error('dibatalkan')));
    if (url.endsWith('/badan')) resolve({ ok: true, status: 200, text: () => new Promise((_, rej) => i.signal.addEventListener('abort', () => rej(new Error('badan dibatalkan')))) });
  });
  let t0 = Date.now();
  const habis = await ambilWeb(macet, { url: 'https://lambat.id/', options: { timeoutMs: 80 } });
  cek(habis.ok === false && habis.error === 'dibatalkan' && Date.now() - t0 < 2000, `tak ada jawaban → dibatalkan sesudah timeoutMs (${Date.now() - t0} ms)`, habis);
  t0 = Date.now();
  // Dibatasi sendiri: bila timeout tidak menjangkau badan, janji ini tak pernah selesai — tanpa batas ini ujinya
  // menggantung alih-alih melapor GAGAL (ketahuan lewat uji mutasi).
  const badan = await Promise.race([
    ambilWeb(macet, { url: 'https://lambat.id/badan', options: { timeoutMs: 80 } }),
    new Promise((r) => setTimeout(() => r({ menggantung: true }), 2000)),
  ]);
  cek(badan.ok === false && badan.error === 'badan dibatalkan' && Date.now() - t0 < 2000, 'header tiba tapi badan macet → tetap dibatalkan', badan);
}

// ── 2. Kabel di main.cjs & tak ada fetch() Node di proses utama ──────────────────────────────
console.log('\n-- 2. kabel --');
{
  // Hanya baris komentar utuh yang dibuang (pola uji-cangkang-electron): membuang `/* … */` dengan regex ikut memakan
  // string yang berisi `/*` (mis. '*/*' di header Accept) — kode di antaranya lenyap dan asersi jadi buta.
  const tanpaKomentar = (s) => s.replace(/\r\n/g, '\n').split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
  const M = tanpaKomentar(readFileSync(path.join(AKAR, 'frontend', 'electron', 'main.cjs'), 'utf8'));
  cek(/ipcMain\.handle\('net:fetchWeb',\s*\(event, permintaan\) => ambilWeb\(net\.fetch, permintaan\)\)/.test(M),
    "net:fetchWeb → ambilWeb(net.fetch, …)");
  cek(/const \{[^}]*\bnet\b[^}]*\} = require\('electron'\)/.test(M), '`net` diambil dari electron');
  cek(/require\('\.\/ambilWeb\.cjs'\)/.test(M), 'ambilWeb.cjs dimuat');

  // `fetch(` yang bukan metode objek (`net.fetch(`, `ses.fetch(`) = fetch() global Node.
  const folder = path.join(AKAR, 'frontend', 'electron');
  const berkas = [];
  const jelajah = (d) => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, n.name); if (n.isDirectory()) jelajah(p); else if (/\.(c?js|mjs)$/.test(n.name)) berkas.push(p); } };
  jelajah(folder);
  const pelanggar = berkas.filter((p) => /(^|[^.\w$])fetch\s*\(/.test(tanpaKomentar(readFileSync(p, 'utf8'))))
    .map((p) => path.relative(AKAR, p));
  cek(berkas.length > 5 && pelanggar.length === 0, `tak ada fetch() Node di ${berkas.length} berkas proses utama`, pelanggar);
}

// ── 3. Electron sungguhan ─────────────────────────────────────────────────────────────────────
console.log('\n-- 3. Electron sungguhan (net.fetch) --');
let electronExe = null;
try { electronExe = require('electron'); } catch { /* tidak terpasang */ }
if (typeof electronExe !== 'string' || !existsSync(electronExe)) {
  console.log('(bagian 3 dilewati: electron tidak terpasang di checkout ini)');
} else {
  const TEKS = 'Berita uji Brotli — ' + 'Ogan Komering Ulu '.repeat(50);
  const terlihat = {};
  const server = createServer((req, res) => {
    terlihat[req.url] = { ua: req.headers['user-agent'], cookie: req.headers.cookie ?? null, ae: req.headers['accept-encoding'] };
    if (req.url === '/br') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Encoding': 'br' });
      res.end(brotliCompressSync(Buffer.from(TEKS)));
    } else if (req.url === '/lambat') {
      setTimeout(() => res.end('terlambat'), 5000).unref();
    } else {
      res.end('ok');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const asal = `http://127.0.0.1:${server.address().port}`;

  const kerja = mkdtempSync(path.join(os.tmpdir(), 'uji-ambil-web-'));
  const rahasia = path.join(kerja, 'rahasia.txt');
  writeFileSync(rahasia, 'ISI-LOKAL-RAHASIA');
  const keluaran = path.join(kerja, 'hasil.json');
  writeFileSync(path.join(kerja, 'package.json'), JSON.stringify({ name: 'uji-ambil-web', main: 'main.js' }));
  // Parameter lewat berkas, bukan argumen: Electron keluar dengan -1 tanpa menjalankan main.js begitu diberi
  // argumen tambahan berupa URL/jalur (dicoba 27 Okt), sedangkan aplikasi yang sama tanpa argumen berjalan.
  writeFileSync(path.join(kerja, 'parameter.json'), JSON.stringify({ modul: BERKAS_MODUL, asal, berkasRahasia: rahasia, keluaran }));
  writeFileSync(path.join(kerja, 'main.js'), `
const { app, net, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { modul, asal, berkasRahasia, keluaran } = JSON.parse(fs.readFileSync(path.join(__dirname, 'parameter.json'), 'utf8'));
app.setPath('userData', path.join(path.dirname(keluaran), 'userData')); // jangan sentuh profil aplikasi Owner
app.disableHardwareAcceleration();
const { ambilWeb } = require(modul);
app.whenReady().then(async () => {
  const h = {};
  try {
    h.br = await ambilWeb(net.fetch, { url: asal + '/br' });
    await session.defaultSession.cookies.set({ url: asal, name: 'sesi', value: 'RAHASIA' });
    h.tanpaCookie = await ambilWeb(net.fetch, { url: asal + '/tanpa-cookie' });
    const kontrolCookie = await net.fetch(asal + '/kontrol-cookie', { credentials: 'include' });
    h.kontrolCookie = kontrolCookie.status;
    const urlBerkas = require('url').pathToFileURL(berkasRahasia).href;
    h.berkas = await ambilWeb(net.fetch, { url: urlBerkas });
    h.kontrolBerkas = await (await net.fetch(urlBerkas)).text();
    const t0 = Date.now();
    h.lambat = await ambilWeb(net.fetch, { url: asal + '/lambat', options: { timeoutMs: 300 } });
    h.lambatMs = Date.now() - t0;
    h.versi = { node: process.versions.node, chrome: process.versions.chrome, electron: process.versions.electron };
  } catch (e) { h.galat = String(e && e.stack || e); }
  fs.writeFileSync(keluaran, JSON.stringify(h));
  app.quit();
});
`);

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const kode = await new Promise((resolve) => {
    const p = spawn(electronExe, [kerja], { env, stdio: 'ignore' });
    const batas = setTimeout(() => { p.kill(); resolve('habis waktu'); }, 60000);
    p.on('exit', (c) => { clearTimeout(batas); resolve(c); });
    p.on('error', (e) => { clearTimeout(batas); resolve(String(e)); });
  });
  server.close();

  const h = existsSync(keluaran) ? JSON.parse(readFileSync(keluaran, 'utf8')) : null;
  cek(kode === 0 && h && !h.galat, `Electron berjalan & selesai (kode ${kode})`, h?.galat || kode);
  if (h && !h.galat) {
    console.log(`       Electron ${h.versi.electron} · Node ${h.versi.node} · Chromium ${h.versi.chrome}`);
    cek(h.br?.ok === true && h.br.data === TEKS, 'respons Content-Encoding: br diurai (oleh Chromium) — teks utuh', h.br);
    cek(/\bbr\b/.test(terlihat['/br']?.ae || ''), `Chromium meminta br (accept-encoding: ${terlihat['/br']?.ae})`);
    cek(/Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\).*Chrome\/128/.test(terlihat['/br']?.ua || ''), 'User-Agent dari ambilWeb sampai ke server', terlihat['/br']?.ua);
    cek(h.kontrolCookie === 200 && /sesi=RAHASIA/.test(terlihat['/kontrol-cookie']?.cookie || ''),
      'KONTROL: net.fetch mentah dengan credentials:include memang mengirim cookie sesi', terlihat['/kontrol-cookie']);
    cek(terlihat['/tanpa-cookie'] && terlihat['/tanpa-cookie'].cookie === null, 'ambilWeb TIDAK mengirim cookie sesi', terlihat['/tanpa-cookie']);
    cek(h.kontrolBerkas === 'ISI-LOKAL-RAHASIA', 'KONTROL: net.fetch mentah memang membaca file:// lokal', h.kontrolBerkas);
    cek(h.berkas?.ok === false && /ditolak/.test(h.berkas.error) && !JSON.stringify(h.berkas).includes('ISI-LOKAL'),
      'ambilWeb menolak file:// — isi berkas lokal tidak bocor', h.berkas);
    cek(h.lambat?.ok === false && h.lambatMs < 3000, `server macet → dibatalkan (${h.lambatMs} ms)`, h.lambat);
  }
}

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

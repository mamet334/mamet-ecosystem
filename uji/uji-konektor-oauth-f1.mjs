// UJI 2026-11-03 — konektor OAuth (Item 129 Tahap F1): electron/konektor/{penerimaBalikan,oauthPenyedia,alurOAuth}.cjs
// + sambungan OAuth di resep/transport/sesiUmum. Server OAuth + MCP TIRUAN (uji/lib/serverOAuthTiruan.cjs) meniru bentuk
// Notion MCP; "browser" = fetch yang mengikuti pengalihan login sampai ke penerima balikan. Tanpa akun, tanpa unduhan.
//
// Yang dijaga:
//   - akun dipilih di halaman penyedia; Mamet hanya menerima KODE di 127.0.0.1, memeriksa `state`, menukar dengan PKCE;
//   - token & pendaftaran klien di brankas terenkripsi; tak pernah di log;
//   - PKCE S256 wajib; URL login hanya dari asal server otorisasi & https (http hanya ke mesin ini);
//   - K23: login kedaluwarsa saat server dinyalakan → status "perlu hubungkan ulang", BROWSER TIDAK DIBUKA;
//   - K22: Putuskan mencabut token di server lalu menghapus dari brankas.

import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const K = path.join(AKAR, 'frontend', 'electron', 'konektor');
const { mulaiPenerima } = require(path.join(K, 'penerimaBalikan.cjs'));
const { buatPenyediaOAuth, urlBolehDibuka } = require(path.join(K, 'oauthPenyedia.cjs'));
const { buatAlurOAuth } = require(path.join(K, 'alurOAuth.cjs'));
const { validasiResep } = require(path.join(K, 'resep.cjs'));
const { buatDaftarServer } = require(path.join(K, 'daftarServer.cjs'));
const { buatBrankas } = require(path.join(K, 'brankas.cjs'));
const { buatSesiUmum } = require(path.join(K, 'sesiUmum.cjs'));
const { lingkunganServer } = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));
const { mulai } = require(path.join(AKAR, 'uji', 'lib', 'serverOAuthTiruan.cjs'));

console.log('uji-konektor-oauth-f1 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Resep ────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. resep --');
const notion = { id: 'notion', nama: 'Notion', jenis: 'http', http: { url: 'https://mcp.notion.com/mcp' }, oauth: true };
cek(validasiResep(notion).ok && validasiResep(notion).resep.oauth === true && validasiResep(notion).resep.kredensial.length === 0, 'resep OAuth: URL saja, tanpa kredensial ketik');
cek(!validasiResep({ ...notion, jenis: 'stdio', stdio: { namaProgram: 'a.exe' } }).ok && !validasiResep({ ...notion, oauth: 'ya' }).ok, '"oauth" hanya true & hanya untuk http');
cek(!validasiResep({ ...notion, kredensial: [{ id: 'oauth-token', label: 'x', header: 'Authorization' }] }).ok, 'id kredensial oauth-* dicadangkan (token tak bisa ditimpa dari kolom ketik)');

// ── 2. Penerima balikan ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. penerima --');
let p = await mulaiPenerima({ batasMs: 5000 });
cek(/^http:\/\/127\.0\.0\.1:\d+\/balikan$/.test(p.url), 'mendengar di 127.0.0.1 saja, satu jalur /balikan', p.url);
cek((await fetch(p.url.replace('/balikan', '/lain'))).status === 404, 'jalur lain 404 — penerima tetap menunggu');
const ipJaringan = Object.values(os.networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
if (ipJaringan) {
  const port = new URL(p.url).port;
  let tersambung = false;
  await new Promise((ok) => { const s = net.connect({ host: ipJaringan, port: Number(port), timeout: 1500 }, () => { tersambung = true; s.destroy(); ok(); }); s.on('error', ok); s.on('timeout', () => { s.destroy(); ok(); }); });
  cek(!tersambung, `penerima TIDAK bisa dihubungi dari alamat jaringan laptop (${ipJaringan}) — hanya 127.0.0.1`);
} else console.log('LEWAT  (tak ada alamat jaringan IPv4 untuk diuji)');
const r = await fetch(`${p.url}?code=k1&state=<script>alert(1)</script>`);
const halaman = await r.text();
const b = await p.tunggu();
cek(b.code === 'k1' && b.state === '<script>alert(1)</script>', 'kode & state diterima apa adanya untuk diperiksa pemanggil');
cek(!halaman.includes('<script>alert') && !halaman.includes('k1'), 'halaman balasan tidak memantulkan parameter URL (tak bisa disisipi HTML)');
let tertutup = false;
try { await fetch(p.url, { signal: AbortSignal.timeout(1500) }); } catch { tertutup = true; }
cek(tertutup, 'sesudah balikan pertama, port ditutup');
p = await mulaiPenerima({ batasMs: 5000 });
await fetch(`${p.url}?error=access_denied&state=s`);
cek((await p.tunggu()).galat === 'access_denied', 'penyedia menolak login → galat diteruskan');
p = await mulaiPenerima({ batasMs: 300 });
let habis = null;
try { await p.tunggu(); } catch (e) { habis = e.message; }
cek(/batas waktu/.test(habis || ''), 'login tak diselesaikan → penerima menyerah & menutup port', habis);

// ── 3. Penyedia: aturan membuka browser ─────────────────────────────────────────────────────────────────────
console.log('\n-- 3. penyedia --');
const dir = mkdtempSync(path.join(os.tmpdir(), 'mamet-f1-'));
const enkripsi = { tersedia: () => true, sandikan: (t) => Buffer.from(`SANDI:${[...t].reverse().join('')}`), buka: (x) => [...x.toString().slice(6)].reverse().join('') };
const brankas = buatBrankas({ berkas: path.join(dir, 'brankas.json'), enkripsi });
const dibuka = [];
const pi = buatPenyediaOAuth({ id: 'uji', brankas, redirectUrl: 'http://127.0.0.1:1/balikan', mode: 'interaktif', bukaBrowser: (u) => dibuka.push(u), asalOtorisasi: 'https://masuk.contoh.com' });
let gal = null;
try { await pi.penyedia.redirectToAuthorization(new URL('https://jahat.contoh.com/authorize?x=1')); } catch (e) { gal = e.message; }
cek(/tidak sama/.test(gal || '') && dibuka.length === 0, 'URL login dari asal lain TIDAK dibuka', gal);
gal = null;
try { await pi.penyedia.redirectToAuthorization(new URL('http://masuk.contoh.com/authorize')); } catch (e) { gal = e.message; }
cek(gal && dibuka.length === 0, 'URL login http (bukan mesin ini) TIDAK dibuka');
await pi.penyedia.redirectToAuthorization(new URL('https://masuk.contoh.com/authorize?a=1'));
cek(dibuka.length === 1, 'URL login dari asal server otorisasi (https) dibuka di browser');
const pd = buatPenyediaOAuth({ id: 'uji', brankas, mode: 'diam', bukaBrowser: (u) => dibuka.push(u), asalOtorisasi: 'https://masuk.contoh.com' });
gal = null;
try { await pd.penyedia.redirectToAuthorization(new URL('https://masuk.contoh.com/authorize')); } catch (e) { gal = e.message; }
cek(gal && dibuka.length === 1 && pd.perluHubungkanUlang(), 'K23: mode diam TIDAK membuka browser, menandai perlu hubungkan ulang');
cek(pi.penyedia.clientMetadata.token_endpoint_auth_method === 'none' && pi.penyedia.clientMetadata.redirect_uris[0] === 'http://127.0.0.1:1/balikan', 'klien publik (tanpa rahasia), alamat balikan loopback');
cek(urlBolehDibuka('http://127.0.0.1:5/x') && !urlBolehDibuka('http://contoh.com') && !urlBolehDibuka('javascript:alert(1)'), 'urlBolehDibuka: https atau mesin ini saja');
cek(!brankas.simpan('uji', 'kk', 'x'.repeat(5000)).ok && brankas.simpan('uji', 'kk', 'x'.repeat(5000), { maks: 16384 }).ok, 'brankas: batas ketik 4.096 tetap; token OAuth boleh lebih panjang');

// ── 4. Alur hubungkan dengan server tiruan ──────────────────────────────────────────────────────────────────
console.log('\n-- 4. hubungkan --');
const srv = await mulai();
const daftar = buatDaftarServer({ berkas: path.join(dir, 'server.json') });
cek(daftar.tambah({ id: 'notion', nama: 'Notion tiruan', jenis: 'http', http: { url: srv.url }, oauth: true }).ok, 'server OAuth tiruan terpasang (http ke mesin ini)');
const log = [];
const dibukaAlur = [];
let ubahState = null;
const browser = async (url) => {
  dibukaAlur.push(url);
  const r1 = await fetch(url, { redirect: 'manual' });
  let tujuan = r1.headers.get('location');
  if (!tujuan) return;
  if (ubahState) { const t = new URL(tujuan); t.searchParams.set('state', ubahState); tujuan = t.toString(); }
  await fetch(tujuan);
};
const alur = buatAlurOAuth({ daftar, brankas, bukaBrowser: browser, versi: 'uji', log: (m) => log.push(m), batasMs: 10000 });
let h = await alur.hubungkan('notion');
cek(h.ok && alur.status('notion').terhubung, 'Hubungkan: login → kode → token tersimpan', h);
const ot = srv.keadaan.otorisasi[0] || {};
cek(dibukaAlur.length === 1 && new URL(dibukaAlur[0]).origin === srv.base, 'browser dibuka SEKALI, ke halaman login server itu', dibukaAlur);
cek(ot.code_challenge_method === 'S256' && ot.code_challenge && ot.state && ot.state.length >= 20 && /^http:\/\/127\.0\.0\.1:\d+\/balikan$/.test(ot.redirect_uri),
  'permintaan login: PKCE S256, state acak, balikan ke 127.0.0.1', ot);
const kl = [...srv.keadaan.klien.values()][0];
cek(srv.keadaan.klien.size === 1 && kl.token_endpoint_auth_method === 'none' && kl.client_name === 'Mamet Ecosystem', 'pendaftaran klien otomatis (DCR), klien publik', kl);
const isiBrankas = readFileSync(path.join(dir, 'brankas.json'), 'utf8');
cek(!/at_[0-9a-f]{8}|rt_[0-9a-f]{8}/.test(isiBrankas) && /oauth-token/.test(isiBrankas) && /oauth-klien/.test(isiBrankas), 'token & pendaftaran di brankas TERENKRIPSI');

h = await alur.hubungkan('notion');
cek(h.ok && srv.keadaan.klien.size === 1, 'hubungkan ulang memakai pendaftaran yang sama (port balikan diulang) — tidak mendaftar ulang');
cek(dibukaAlur.length === 2, 'hubungkan ulang = login SEGAR di browser (bukan diam-diam memperbarui token lama)', dibukaAlur.length);
cek(srv.keadaan.otorisasi.length === 2 && srv.keadaan.otorisasi[0].state !== srv.keadaan.otorisasi[1].state, 'state berbeda di tiap login (bukan nilai tetap)');

const penghalang = net.createServer();
const portLama = Number(new URL(buatPenyediaOAuth({ id: 'notion', brankas }).klien().redirect_uris[0]).port);
await new Promise((ok) => penghalang.listen(portLama, '127.0.0.1', ok));
h = await alur.hubungkan('notion');
penghalang.close();
cek(h.ok && srv.keadaan.klien.size === 2, 'port balikan lama dipakai program lain → daftar ulang dengan port baru', h);

ubahState = 'state-palsu';
h = await alur.hubungkan('notion');
ubahState = null;
cek(!h.ok && /state/.test(h.alasan) && !alur.status('notion').terhubung, 'balikan dengan state lain DITOLAK; tak ada token', h);
srv.sakelar.tolakLogin = true;
h = await alur.hubungkan('notion');
srv.sakelar.tolakLogin = false;
cek(!h.ok && /dibatalkan/.test(h.alasan) && !alur.status('notion').terhubung, 'Owner menolak di halaman penyedia → tidak terhubung', h);
srv.sakelar.tanpaS256 = true;
const bukaSebelum = dibukaAlur.length;
h = await alur.hubungkan('notion');
srv.sakelar.tanpaS256 = false;
cek(!h.ok && /PKCE/.test(h.alasan) && dibukaAlur.length === bukaSebelum, 'server tanpa PKCE S256 → ditolak SEBELUM browser dibuka', h);
const [j1, j2] = await Promise.all([alur.hubungkan('notion'), alur.hubungkan('notion')]);
cek(j1.ok && j1 === j2, 'tombol ditekan dua kali → satu login');

// ── 5. Dinyalakan, diperbarui, kedaluwarsa (K23) ────────────────────────────────────────────────────────────
console.log('\n-- 5. sesi --');
const sesi = buatSesiUmum({ daftar, brankas, berkasSakelar: path.join(dir, 'sakelar.json'), lingkungan: () => lingkunganServer(), versi: 'uji', msSambung: 15000 });
try {
  const t = await sesi.tinjau('notion');
  cek(t.ok && t.alat.map((a) => a.nama).join() === 'cari_halaman,tulis_halaman', 'tinjau membaca alat lewat token OAuth', t);
  await sesi.setujui('notion', ['cari_halaman']);
  h = await sesi.atur('ws-assistant', 'notion', true);
  cek(h.ok && h.status === 'nyala' && h.alat.join() === 'cari_halaman', 'menyala; hanya alat baca yang dicentang (K21)', h);
  h = await sesi.panggil('ws-assistant', 'notion', 'cari_halaman', { kueri: 'rapat' });
  cek(h.ok && /hasil cari_halaman/.test(h.teks), 'alat berjalan dengan token OAuth', h);

  const tokenLama = buatPenyediaOAuth({ id: 'notion', brankas }).token().access_token;
  srv.kedaluwarsakanAkses();
  await sesi.matikan('ws-assistant', 'notion');
  h = await sesi.nyalakan('ws-assistant', 'notion');
  const tokenBaru = buatPenyediaOAuth({ id: 'notion', brankas }).token().access_token;
  cek(h.ok && tokenBaru && tokenBaru !== tokenLama, 'token akses kedaluwarsa → diperbarui otomatis dengan token pembaru', h);

  const bukaSebelumK23 = dibukaAlur.length;
  srv.sakelar.pembaruanGagal = true;
  srv.kedaluwarsakanAkses();
  await sesi.matikan('ws-assistant', 'notion');
  h = await sesi.nyalakan('ws-assistant', 'notion');
  srv.sakelar.pembaruanGagal = false;
  cek(!h.ok && h.status === 'perlu_hubungkan_ulang' && dibukaAlur.length === bukaSebelumK23,
    'K23: pembaruan gagal → status "perlu hubungkan ulang", browser TIDAK dibuka diam-diam', h);
} finally {
  await sesi.matikanSemua();
}

// ── 6. Putuskan (K22) ───────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 6. putuskan --');
await alur.hubungkan('notion');
const sebelum = buatPenyediaOAuth({ id: 'notion', brankas });
const rtLama = sebelum.token().refresh_token;
const cid = sebelum.klien().client_id;
h = await alur.putuskan('notion');
const cabut = srv.keadaan.dicabut.at(-1) || {};
cek(h.ok && h.dicabut === true && cabut.token === rtLama && cabut.token_type_hint === 'refresh_token' && cabut.client_id === cid, 'token pembaru dicabut DI SERVER', { h, cabut });
cek(!alur.status('notion').terhubung && !buatPenyediaOAuth({ id: 'notion', brankas }).klien(), 'token & pendaftaran dihapus dari brankas');
const sesi2 = buatSesiUmum({ daftar, brankas, berkasSakelar: path.join(dir, 'sakelar2.json'), lingkungan: () => lingkunganServer(), versi: 'uji', msSambung: 15000 });
h = await sesi2.atur('ws-assistant', 'notion', true);
cek(!h.ok && h.status === 'belum_terhubung', 'sesudah diputuskan: tidak menyala, status "belum terhubung"', h);
await sesi2.matikanSemua();

cek(!log.some((m) => /at_[0-9a-f]{6}|rt_[0-9a-f]{6}|kode_[0-9a-f]{6}/.test(m)), 'log tidak memuat token atau kode', log);
await srv.tutup();

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);

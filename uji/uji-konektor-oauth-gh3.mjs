// UJI 2026-11-05 — GH3: login perangkat (device flow) untuk GitHub tanpa rahasia klien (K25), normalisasi galat OAuth
// ber-status 200 (fetchOAuthJujur), dan tombol Batal login. Server tiruan bergaya GitHub (uji/lib/serverOAuthTiruan.cjs,
// `gayaGithub`): tanpa DCR, klien terdaftar, galat token dengan status 200, device flow.
//
// Yang dijaga:
//   - kode pengguna tampil di Mamet; halaman perangkat dibuka HANYA bila asalnya sama dengan server otorisasi;
//   - device_code (rahasia sementara) tidak pernah sampai ke layar; token disimpan terenkripsi;
//   - authorization_pending / slow_down / access_denied / batal ditangani; tanpa rahasia klien sama sekali;
//   - galat 200 GitHub terbaca jujur (bukan "access_token undefined"); pembaruan yang butuh rahasia → K23.

import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const K = path.join(AKAR, 'frontend', 'electron', 'konektor');
const { validasiResep } = require(path.join(K, 'resep.cjs'));
const { buatFetchOAuthJujur } = require(path.join(K, 'fetchOAuthJujur.cjs'));
const { buatJaringanKonektor } = require(path.join(K, 'jaringanKonektor.cjs'));
// Dasar membaca fetch global SAAT dipanggil — bagian 2 menggantinya dengan jawaban tiruan.
const fetchOAuthJujur = buatFetchOAuthJujur((...a) => globalThis.fetch(...a));
const { buatAlurOAuth } = require(path.join(K, 'alurOAuth.cjs'));
const { buatPenyediaOAuth } = require(path.join(K, 'oauthPenyedia.cjs'));
const { buatDaftarServer } = require(path.join(K, 'daftarServer.cjs'));
const { buatBrankas } = require(path.join(K, 'brankas.cjs'));
const { buatSesiUmum } = require(path.join(K, 'sesiUmum.cjs'));
const { lingkunganServer } = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));
const { mulai } = require(path.join(AKAR, 'uji', 'lib', 'serverOAuthTiruan.cjs'));
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8');

console.log('uji-konektor-oauth-gh3 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const tungguSampai = async (f, ms = 8000) => { const akhir = Date.now() + ms; while (Date.now() < akhir) { const v = f(); if (v) return v; await tunggu(50); } return null; };

// ── 1. Resep ────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. resep --');
const dasar = { id: 'gh', nama: 'GH', jenis: 'http', http: { url: 'https://api.githubcopilot.com/mcp/' }, oauth: true, oauthKlienId: 'Iv23li3SbHZO7UlcxipI' };
cek(validasiResep({ ...dasar, oauthAlur: 'perangkat' }).resep?.oauthAlur === 'perangkat', 'resep: "oauthAlur": "perangkat"');
cek(!validasiResep({ ...dasar, oauthKlienId: undefined, oauthAlur: 'perangkat' }).ok, 'login perangkat tanpa client_id ditolak');
cek(!validasiResep({ ...dasar, oauthAlur: 'sihir' }).ok && !validasiResep({ id: 'x2', nama: 'x', jenis: 'http', http: { url: 'https://a.com' }, oauthAlur: 'perangkat' }).ok,
  'oauthAlur hanya browser/perangkat & hanya untuk resep OAuth');

// ── 2. fetchOAuthJujur ──────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. galat 200 --');
const asliFetch = globalThis.fetch;
const jawab = (status, isi, jenis = 'application/json') => async () => new Response(typeof isi === 'string' ? isi : JSON.stringify(isi), { status, headers: { 'content-type': jenis } });
globalThis.fetch = jawab(200, { error: 'incorrect_client_credentials', error_description: 'perlu rahasia' });
let r = await fetchOAuthJujur('https://x');
cek(r.status === 400 && (await r.json()).error === 'incorrect_client_credentials', 'galat OAuth dengan status 200 → 400 (SDK membaca alasannya)');
globalThis.fetch = jawab(200, { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'x' } });
cek((await fetchOAuthJujur('https://x')).status === 200, 'galat JSON-RPC MCP (objek) TIDAK diubah');
globalThis.fetch = jawab(200, { access_token: 'a', token_type: 'bearer' });
cek((await fetchOAuthJujur('https://x')).status === 200, 'jawaban token sah tidak diubah');
globalThis.fetch = jawab(200, 'error=x', 'text/plain');
cek((await fetchOAuthJujur('https://x')).status === 200, 'jawaban bukan JSON tidak diubah');
globalThis.fetch = asliFetch;

// ── 2b. Jaringan konektor: net.fetch, tanpa cookie, hanya http/https ("Black October") ───────────────────────
console.log('\n-- 2b. jaringan --');
const dikirim = [];
const jaringan = buatJaringanKonektor(async (u, init) => { dikirim.push({ u: String(u), init }); return new Response('{}', { status: 200 }); });
await jaringan('https://api.githubcopilot.com/mcp/', { method: 'POST', credentials: 'include', headers: { a: 'b' } });
cek(dikirim[0]?.init?.credentials === 'omit' && dikirim[0].init.method === 'POST' && dikirim[0].init.headers.a === 'b',
  "jaringan konektor SELALU credentials:'omit' (net.fetch tak mengirim cookie sesi), opsi lain diteruskan", dikirim[0]);
for (const salah of ['file:///C:/Windows/win.ini', 'mamet://app/x', 'javascript:alert(1)']) {
  let ditolak = false;
  try { await jaringan(salah); } catch { ditolak = true; }
  cek(ditolak && !dikirim.some((x) => x.u === salah), `skema bukan http/https ditolak sebelum dikirim: ${salah.split(':')[0]}`);
}
const MAIN = baca('frontend/electron/main.cjs');
const IPCJ = baca('frontend/electron/konektor/ipcUmum.cjs');
cek(/ambil: net\.fetch,/.test(MAIN) && /buatJaringanKonektor\(ambil \|\| globalThis\.fetch\)/.test(IPCJ), 'main.cjs menyuntikkan net.fetch ke konektor umum');
cek(/fetchJaringan: jaringan/.test(IPCJ) && /fetchFn: jaringan/.test(IPCJ) && /\.\.\.\(ambil \? \{ fetch: ambil \} : \{\}\)/.test(baca('frontend/electron/konektor/transport.cjs')),
  'jaringan itu dipakai transport HTTP MCP & alur OAuth (bukan fetch() Node bawaan SDK)');

// ── 3. Login perangkat ──────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. login perangkat --');
const srv = await mulai({ gayaGithub: true, webButuhRahasia: true });
const dir = mkdtempSync(path.join(os.tmpdir(), 'mamet-gh3-'));
const enkripsi = { tersedia: () => true, sandikan: (t) => Buffer.from(`SANDI:${[...t].reverse().join('')}`), buka: (x) => [...x.toString().slice(6)].reverse().join('') };
const brankas = buatBrankas({ berkas: path.join(dir, 'brankas.json'), enkripsi });
const daftar = buatDaftarServer({ berkas: path.join(dir, 'server.json') });
daftar.tambah({ id: 'gh-perangkat', nama: 'GitHub', jenis: 'http', http: { url: srv.url }, oauth: true, oauthKlienId: 'klien_terdaftar', oauthAlur: 'perangkat' });
daftar.tambah({ id: 'gh-browser', nama: 'GitHub web', jenis: 'http', http: { url: srv.url }, oauth: true, oauthKlienId: 'klien_terdaftar' });
const dibuka = [];
const log = [];
const alur = buatAlurOAuth({ daftar, brankas, bukaBrowser: (u) => { dibuka.push(u); }, versi: 'uji', log: (m) => log.push(m), tambahLambatMs: 200 });

let janji = alur.hubungkan('gh-perangkat');
let t = await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna && alur.loginTertunda('gh-perangkat'));
cek(t && /^[0-9A-F]{4}-[0-9A-F]{4}$/.test(t.kodePengguna) && t.alamat === `${srv.base}/login/device` && t.berlakuSampai > Date.now(),
  'kode pengguna & alamat perangkat tersedia untuk layar', t);
cek(t && !JSON.stringify(t).includes('dev_'), 'device_code TIDAK pernah sampai ke layar');
cek(dibuka.length === 1 && dibuka[0] === `${srv.base}/login/device`, 'halaman perangkat dibuka di browser (asal sama dengan server otorisasi)', dibuka);
await tunggu(1300);
cek(srv.keadaan.pollPerangkat >= 1 && !alur.status('gh-perangkat').terhubung, 'menunggu persetujuan: Mamet bertanya berkala, belum terhubung', srv.keadaan.pollPerangkat);
srv.jawabPerangkat(t.kodePengguna, true);
let h = await janji;
cek(h.ok && alur.status('gh-perangkat').terhubung && !alur.loginTertunda('gh-perangkat'), 'disetujui di halaman penyedia → terhubung; tampilan kode dibersihkan', h);
cek(!/at_[0-9a-f]{8}|rt_[0-9a-f]{8}/.test(readFileSync(path.join(dir, 'brankas.json'), 'utf8')), 'token tersimpan terenkripsi');
cek(!srv.keadaan.otorisasi.length && srv.keadaan.pendaftaran === 0, 'tanpa halaman login browser & tanpa pendaftaran klien — tanpa rahasia sama sekali');

srv.sakelar.lambatSekali = true;
srv.keadaan.pollPerangkat = 0;
janji = alur.hubungkan('gh-perangkat');
t = await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna && alur.loginTertunda('gh-perangkat'));
await tunggu(1500);
srv.jawabPerangkat(t.kodePengguna, true);
h = await janji;
srv.sakelar.lambatSekali = false;
cek(h.ok && srv.keadaan.pollPerangkat >= 2, 'slow_down: jeda ditambah, login tetap selesai', { h, poll: srv.keadaan.pollPerangkat });

janji = alur.hubungkan('gh-perangkat');
t = await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna && alur.loginTertunda('gh-perangkat'));
srv.jawabPerangkat(t.kodePengguna, false);
h = await janji;
cek(!h.ok && /ditolak/.test(h.alasan) && !alur.status('gh-perangkat').terhubung, 'ditolak di halaman penyedia → tidak terhubung', h);

janji = alur.hubungkan('gh-perangkat');
await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna);
const mulaiBatal = Date.now();
cek(alur.batalkan('gh-perangkat').ok, 'Batal diterima saat login menunggu');
h = await janji;
cek(!h.ok && /dibatalkan/.test(h.alasan) && Date.now() - mulaiBatal < 400, 'Batal menghentikan penantian SAAT ITU JUGA (bukan menunggu putaran berikutnya)', { h, ms: Date.now() - mulaiBatal });
cek(!alur.batalkan('gh-perangkat').ok, 'tanpa login yang menunggu → Batal tidak berbuat apa-apa');

srv.sakelar.perangkatAsalLain = true;
const bukaSebelumPalsu = dibuka.length;
janji = alur.hubungkan('gh-perangkat');
t = await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna && alur.loginTertunda('gh-perangkat'));
cek(t && t.alamat === 'https://login-palsu.contoh.invalid/device' && dibuka.length === bukaSebelumPalsu,
  'halaman perangkat di situs LAIN tidak dibuka otomatis (alamat hanya ditampilkan untuk diperiksa)', { t, dibuka: dibuka.slice(bukaSebelumPalsu) });
alur.batalkan('gh-perangkat');
await janji;
srv.sakelar.perangkatAsalLain = false;

const { loginPerangkat } = require(path.join(K, 'alurPerangkat.cjs'));
let galatTanpaId = null;
const kodeSebelum = srv.keadaan.perangkat.size;
try { await loginPerangkat({ meta: { device_authorization_endpoint: `${srv.base}/device/code`, token_endpoint: `${srv.base}/token`, authorization_endpoint: `${srv.base}/authorize` }, klienId: null }); }
catch (e) { galatTanpaId = e.message; }
cek(/client_id/.test(galatTanpaId || '') && srv.keadaan.perangkat.size === kodeSebelum, 'login perangkat tanpa client_id ditolak sebelum meminta kode (lapis kedua di bawah resep)', galatTanpaId);

// ── 4. Login browser bergaya GitHub: alasan galat terbaca jujur ─────────────────────────────────────────────
console.log('\n-- 4. browser github --');
const bukaIkut = async (u) => { const r1 = await fetch(u, { redirect: 'manual' }); const l = r1.headers.get('location'); if (l) await fetch(l); };
const alurWeb = buatAlurOAuth({ daftar, brankas, bukaBrowser: bukaIkut, versi: 'uji' });
h = await alurWeb.hubungkan('gh-browser');
cek(!h.ok && /incorrect_client_credentials|client_secret/.test(h.alasan) && !/received undefined/.test(h.alasan),
  'web flow GitHub tanpa rahasia: pesan menyebut alasan sebenarnya, bukan "access_token undefined"', h);
const alurDiam = buatAlurOAuth({ daftar, brankas, bukaBrowser: () => {}, versi: 'uji', batasMs: 20000 });
janji = alurDiam.hubungkan('gh-browser');
await tungguSampai(() => alurDiam.loginTertunda('gh-browser'));
cek(alurDiam.loginTertunda('gh-browser')?.jenis === 'browser', 'login browser yang menunggu terlihat di layar (untuk tombol Batal)');
const mulaiB = Date.now();
alurDiam.batalkan('gh-browser');
h = await janji;
cek(!h.ok && Date.now() - mulaiB < 1500, 'Batal juga menghentikan login browser (tak menunggu 5 menit)', h);

// ── 5. Sesi dengan token perangkat; pembaruan butuh rahasia (K23) ───────────────────────────────────────────
console.log('\n-- 5. sesi --');
janji = alur.hubungkan('gh-perangkat');
t = await tungguSampai(() => alur.loginTertunda('gh-perangkat')?.kodePengguna && alur.loginTertunda('gh-perangkat'));
srv.jawabPerangkat(t.kodePengguna, true);
await janji;
const sesi = buatSesiUmum({ daftar, brankas, berkasSakelar: path.join(dir, 'sakelar.json'), lingkungan: () => lingkunganServer(), versi: 'uji', msSambung: 15000 });
try {
  const tj = await sesi.tinjau('gh-perangkat');
  cek(tj.ok && tj.alat.length === 2, 'Tinjau alat lewat token login perangkat', tj);
  await sesi.setujui('gh-perangkat', ['cari_halaman']);
  h = await sesi.atur('ws-assistant', 'gh-perangkat', true);
  cek(h.ok && h.status === 'nyala', 'menyala dengan token login perangkat', h);
  const bukaSebelum = dibuka.length;
  srv.sakelar.pembaruanButuhRahasia = true;
  srv.kedaluwarsakanAkses();
  await sesi.matikan('ws-assistant', 'gh-perangkat');
  h = await sesi.nyalakan('ws-assistant', 'gh-perangkat');
  cek(!h.ok && h.status === 'perlu_hubungkan_ulang' && dibuka.length === bukaSebelum,
    'K23: token habis & pembaruan butuh rahasia → "perlu hubungkan ulang", browser tak dibuka diam-diam', h);
} finally {
  await sesi.matikanSemua();
  await srv.tutup();
}
cek(!log.some((m) => /at_[0-9a-f]{6}|rt_[0-9a-f]{6}|dev_[0-9a-f]{6}/.test(m)), 'log tanpa token / device_code', log);

// ── 6. Sambungan & layar (statis) ───────────────────────────────────────────────────────────────────────────
console.log('\n-- 6. sambungan --');
const IPC = baca('frontend/electron/konektor/ipcUmum.cjs');
const PRE = baca('frontend/electron/preload.cjs');
const KS = baca('frontend/src/components/konektor/KartuServerUmum.jsx');
cek(/login: alur\.loginTertunda\(s\.id\)/.test(IPC) && /'konektor-umum:batal-login'[\s\S]{0,60}alur\.batalkan\(id\)/.test(IPC), 'IPC: status membawa login tertunda; saluran batal-login');
cek(/batalLogin: \(id\) => ipcRenderer\.invoke\('konektor-umum:batal-login'/.test(PRE), 'preload: batalLogin');
cek(/<KodePerangkat login=\{s\.login\}/.test(KS) && /login\.kodePengguna/.test(KS) && /Salin kode/.test(KS) && /onBatal/.test(KS) && !/device_code/.test(KS),
  'kartu: kode perangkat + Salin + Batal; tanpa device_code');
cek(/buatFetchOAuthJujur\(fetchJaringan\)/.test(baca('frontend/electron/konektor/transport.cjs')), 'transport OAuth memakai fetch yang jujur di atas jaringan konektor (pembaruan token)');

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);

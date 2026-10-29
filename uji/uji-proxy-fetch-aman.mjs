// UJI 2026-10-30 — K5 (ADR-0022): `proxy_fetch` agent-process wajib token & hanya alamat publik; log auth tanpa email.
//
// Terbukti live 29 Okt: tanpa token apa pun, server mengambilkan `example.com` — fungsi di-deploy `--no-verify-jwt` dan
// blok proxy_fetch di index.ts berjalan SEBELUM pemeriksaan token. `auth_middleware.ts` juga menulis seluruh objek
// pengguna (email & metadata) ke log tiap permintaan.
//
// proxy_fetch_endpoint.ts DIBUNDEL SUNGGUHAN (esbuild); hanya `handleAuth` & `fetch` ditiru.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const AP = join(AKAR, 'supabase/functions/agent-process');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const hasil = await esbuild.build({
  entryPoints: [join(AP, 'lib/request/proxy_fetch_endpoint.ts')], bundle: true, format: 'esm', platform: 'neutral',
  write: false, logLevel: 'silent',
  plugins: [{ name: 'tiruan', setup(b) {
    b.onResolve({ filter: /auth_middleware\.ts$/ }, () => ({ path: 'auth', namespace: 'tiruan' }));
    b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: 'export const handleAuth = (...a) => globalThis.__auth(...a);', loader: 'js' }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-proxy-'));
writeFileSync(join(dir, 'p.mjs'), hasil.outputFiles[0].text);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });
globalThis.Deno = { env: { get: () => '' } };
const { handleProxyFetchRequest, alamatBolehDiambil } = await import(pathToFileURL(join(dir, 'p.mjs')).href);

console.log('uji-proxy-fetch-aman v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const req = new Request('https://contoh.supabase.co/functions/v1/agent-process', { method: 'POST' });
const tolak401 = () => ({ user: null, authErrorResponse: new Response('{"error":"Unauthorized"}', { status: 401 }) });
const sah = () => ({ user: { id: 'u' }, authErrorResponse: null });
async function coba(auth, url) {
  globalThis.__auth = auth;
  const diminta = [];
  const fetchTiruan = async (u) => { diminta.push(u); return new Response('<rss><item>x</item></rss>', { status: 200 }); };
  const r = await handleProxyFetchRequest(req, { action: 'proxy_fetch', url }, {}, fetchTiruan);
  return { r, diminta };
}

// ── 1. Token wajib ─────────────────────────────────────────────────────────────────────────────
let x = await coba(tolak401, 'https://www.bing.com/news/search?q=OKU&format=rss');
cek(x.r?.status === 401 && x.diminta.length === 0, 'tanpa token → 401 dan TIDAK ada permintaan keluar (dulu: example.com diambilkan)', { status: x.r?.status, diminta: x.diminta });
x = await coba(sah, 'https://www.bing.com/news/search?q=OKU&format=rss');
const isi = x.r ? JSON.parse(await x.r.text()) : null;
cek(x.r?.status === 200 && x.diminta.length === 1 && isi?.ok === true && isi.data.includes('<rss'), 'dengan token sah → diambilkan seperti dulu (web Tier 3 tetap jalan)', isi);

// ── 2. Hanya alamat publik http/https ──────────────────────────────────────────────────────────
const TOLAK = ['http://localhost:54321/x', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/',
  'http://192.168.1.1/', 'http://172.16.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'ftp://contoh.id/a', 'bukan url'];
const lolos = TOLAK.filter((u) => alamatBolehDiambil(u));
cek(lolos.length === 0, `${TOLAK.length} alamat internal/non-http ditolak`, lolos);
cek(['https://news.google.com/rss/search?q=x', 'https://www.antaranews.com/rss/tekno', 'http://172.32.0.1/'].every(alamatBolehDiambil),
  'alamat publik tetap boleh (termasuk 172.32.x di luar rentang privat)');
x = await coba(sah, 'http://169.254.169.254/latest/meta-data');
cek(x.r?.status === 400 && x.diminta.length === 0, 'token sah + alamat metadata → 400, tak ada permintaan keluar', { status: x.r?.status, diminta: x.diminta });
cek((await handleProxyFetchRequest(req, { action: 'embed', text: 'x' }, {})) === null, 'aksi lain → bukan urusan endpoint ini (null)');

// ── 3. Sambungan & log ─────────────────────────────────────────────────────────────────────────
const INDEX = readFileSync(join(AP, 'index.ts'), 'utf8');
cek(!/body\?\.action === 'proxy_fetch'/.test(INDEX), 'index.ts tak lagi punya blok proxy_fetch tanpa token');
const iProxy = INDEX.indexOf('await handleProxyFetchRequest(req, parsedBody, corsHeaders)');
cek(iProxy > 0 && iProxy < INDEX.indexOf('executeRequestPipeline({ request: req'), 'index.ts memanggil handleProxyFetchRequest sebelum pipeline chat');
const AUTH = readFileSync(join(AP, 'lib/request/auth_middleware.ts'), 'utf8');
cek(!/JSON\.stringify\(user\)/.test(AUTH) && /console\.log\('\[AuthMiddleware\] User ID:', user\?\.id\)/.test(AUTH),
  'auth_middleware hanya menulis ID pengguna ke log (bukan email & metadata)');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

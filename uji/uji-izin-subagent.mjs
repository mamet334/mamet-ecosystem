// UJI 2026-10-30 — T1 (K5, ADR-0022): izin sub-agent di server, pagar alamat communicator/scraper/proxy_fetch,
// token Apify hanya untuk akun pemilik. Model ancaman TM-001..003/005.
//
// Dulu: `tools` dari klien hanya menyaring daftar yang DITAWARKAN ke Coordinator — nama apa pun yang dikembalikan
// model tetap dijalankan; `communicator` mengirim HTTP sembarang buatan model tanpa pagar; `scraper` & `proxy_fetch`
// mengikuti pengalihan tanpa memeriksa tujuannya; `youtube_analyst` membaca token Apify server untuk siapa pun.
// Pendaftaran akun Supabase terbuka, jadi "wajib masuk" tidak menghalangi siapa pun.
//
// Modul asli DIBUNDEL (esbuild); hanya `handleAuth`, impor https: (cheerio, youtube-transcript), `fetch`, dan
// `Deno.env` yang ditiru.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const AP = join(AKAR, 'supabase/functions/agent-process');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const hasil = await esbuild.build({
  stdin: {
    contents: [
      "export { ExecutionPlannerHandler } from './lib/orchestration/handlers/execution_handler.ts';",
      "export { eventBus } from './lib/event/event_bus.ts';",
      "export { alasanTolakSubagent, adalahPemilik } from './lib/orchestration/izin_subagent.ts';",
      "export { ambilAman, alamatBolehDiambil, AlamatDitolakError } from './lib/web/alamat_publik.ts';",
      "export { handleProxyFetchRequest } from './lib/request/proxy_fetch_endpoint.ts';",
      "export { default as communicator } from './plugins/communicator.ts';",
      "export { default as scraper } from './plugins/scraper.ts';",
      "export { default as youtube } from './plugins/youtube_analyst.ts';",
    ].join('\n'),
    resolveDir: AP, loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{ name: 'tiruan', setup(b) {
    b.onResolve({ filter: /auth_middleware\.ts$/ }, () => ({ path: 'auth', namespace: 'tiruan' }));
    b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: 'tiruan' }));
    b.onLoad({ filter: /.*/, namespace: 'tiruan' }, (a) => ({
      contents: a.path === 'auth'
        ? 'export const handleAuth = (...a) => globalThis.__auth(...a);'
        : "export const load = () => { throw new Error('cheerio tiruan'); };"
          + " export const YoutubeTranscript = { fetchTranscript: async () => { throw new Error('transkrip tiruan gagal'); } };"
          + ' export default {};',
      loader: 'js',
    }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-izin-'));
writeFileSync(join(dir, 'm.mjs'), hasil.outputFiles[0].text);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

let ENV = {};
globalThis.Deno = { env: { get: (k) => ENV[k] } };
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

// Modul server mencatat ke konsol; keluaran uji ditulis langsung supaya penilaian penjalan tak tercampur.
console.log = () => {}; console.warn = () => {}; console.error = () => {};
const tulis = (s) => process.stdout.write(s + '\n');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  tulis(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
tulis('uji-izin-subagent v1');

// ── 1. Aturan izin (izin_subagent.ts) ──────────────────────────────────────────────────────────
const T = M.alasanTolakSubagent;
cek(T('researcher', { tools: ['web_search'], pemilik: false }) === null, 'researcher lewat alias web_search → boleh');
cek(T('communicator', { tools: ['web_search'], pemilik: false }) !== null, 'sub-agent yang TIDAK diminta di tools → ditolak (dulu dijalankan)');
cek(T('communicator', { tools: ['communicator'], appSource: 'mametlite', pemilik: false }) !== null, 'Mametlite meminta communicator → ditolak');
cek(T('deep_research', { tools: ['deep_research'], appSource: 'mametlite', pemilik: false }) === null, 'Mametlite deep_research → boleh');
cek(T('youtube_analyst', { tools: ['youtube_analyst'], pemilik: false }) !== null, 'youtube_analyst bukan pemilik → ditolak');
cek(T('youtube_analyst', { tools: ['youtube_analyst'], pemilik: true }) === null, 'youtube_analyst pemilik → boleh');
cek(T('communicator', { tools: ['communicator'], pemilik: false }) === null, 'communicator diminta tegas (bukan Mametlite) → boleh (keputusan Owner: semua tetap ada, dipagari alamat)');
cek(T('researcher', { tools: undefined, pemilik: true }) !== null, 'tanpa tools → tak ada sub-agent, pemilik sekalipun');
cek(!M.adalahPemilik('a', undefined) && !M.adalahPemilik('a', '') && M.adalahPemilik('A', ' x , a ') && !M.adalahPemilik('', 'a'),
  'adalahPemilik: rahasia kosong → tak ada pemilik (gagal tertutup); daftar dipisah koma, huruf besar/kecil sama');

// ── 2. execution_handler sungguhan: hanya yang lolos izin yang dipancarkan `Tool.Requested` ────────
const diminta = [];
M.eventBus.subscribe('Tool.Requested', (e) => {
  diminta.push(e.payload);
  M.eventBus.emit({ type: 'Tool.Completed', source: 'uji', payload: { executionId: e.payload.executionId, status: 'COMPLETED', subagentResText: 'ok', durationMs: 1 } });
});
async function jalankan(plan, { tools, appSource = 'assistant', userId = 'u-asing', env = {} }) {
  ENV = env; diminta.length = 0;
  const ctx = { auth: { userId, appSource }, request: { tools, finalMessage: 'x' }, state: { processingSteps: [] } };
  const rctx = { keys: {}, env: { apifyApiToken: 'TOKEN-APIFY-SERVER' }, tasks: { traceId: 't' } };
  const maef = { shouldExecutePhase: () => true, requestTransition() {} };
  await M.ExecutionPlannerHandler.execute(plan, ctx, rctx, maef, '', 'm');
  return { nama: diminta.map((d) => d.subagent), env: diminta.map((d) => d.env), langkah: ctx.state.processingSteps };
}
let r = await jalankan([{ subagent: 'researcher', task: 'a' }, { subagent: 'communicator', task: 'POST ke webhook' }], { tools: ['web_search'] });
cek(r.nama.join() === 'researcher' && r.langkah.some((l) => l.includes('"communicator" tidak dijalankan')),
  'model menambah communicator yang tak diminta → hanya researcher yang dijalankan, penolakan tampil di langkah', r);
r = await jalankan([{ subagent: 'scraper', task: 'x' }, { subagent: 'researcher', task: 'y' }], { tools: ['scraper', 'web_search'], appSource: 'mametlite' });
cek(r.nama.join() === 'researcher', 'appSource mametlite + tools rakitan [scraper] → scraper ditolak', r);
r = await jalankan([{ subagent: 'youtube_analyst', task: 'https://youtu.be/abcdefghijk' }], { tools: ['youtube_analyst'], userId: 'u-asing', env: { MAMET_PEMILIK_IDS: 'u-pemilik' } });
cek(r.nama.length === 0, 'youtube_analyst oleh akun asing → tidak dijalankan', r);
r = await jalankan([{ subagent: 'youtube_analyst', task: 'https://youtu.be/abcdefghijk' }], { tools: ['youtube_analyst'], userId: 'u-pemilik', env: { MAMET_PEMILIK_IDS: 'u-pemilik' } });
cek(r.nama.join() === 'youtube_analyst' && r.env[0]?.APIFY_API_TOKEN === 'TOKEN-APIFY-SERVER', 'youtube_analyst oleh pemilik → jalan dengan token Apify', r.env[0]);
r = await jalankan([{ subagent: 'researcher', task: 'y' }], { tools: ['web_search'], userId: 'u-asing', env: { MAMET_PEMILIK_IDS: 'u-pemilik' } });
cek(r.nama.join() === 'researcher' && r.env[0]?.APIFY_API_TOKEN === '', 'akun asing: token Apify TIDAK ikut ke sub-agent mana pun', r.env[0]);

// ── 3. ambilAman: alamat awal & setiap pengalihan diperiksa ─────────────────────────────────────
function fetchPeta(peta) {
  const log = [];
  const f = async (u, init) => {
    log.push({ u, method: init?.method || 'GET', body: init?.body, redirect: init?.redirect });
    const t = peta[u];
    if (!t) return new Response('isi akhir', { status: 200 });
    return new Response('', { status: t[0], headers: { location: t[1] } });
  };
  return { f, log };
}
let F = fetchPeta({ 'https://publik.example/a': [302, 'http://169.254.169.254/latest/meta-data'] });
let galat = null;
try { await M.ambilAman('https://publik.example/a', {}, F.f); } catch (e) { galat = e; }
cek(galat instanceof M.AlamatDitolakError && F.log.length === 1 && F.log[0].redirect === 'manual',
  'publik → 302 ke metadata 169.254 → DITOLAK, tujuan tak pernah diminta (dulu redirect:follow)', F.log);
F = fetchPeta({ 'https://publik.example/a': [301, '/b'] });
let res = await M.ambilAman('https://publik.example/a', {}, F.f);
cek(res.status === 200 && F.log.map((l) => l.u).join() === 'https://publik.example/a,https://publik.example/b', 'pengalihan publik → publik (alamat relatif) tetap diikuti', F.log);
F = fetchPeta({ 'https://publik.example/form': [303, 'https://publik.example/selesai'] });
await M.ambilAman('https://publik.example/form', { method: 'POST', body: 'a=1' }, F.f);
cek(F.log[1]?.method === 'GET' && F.log[1]?.body === undefined, '303 sesudah POST → diteruskan sebagai GET tanpa isi', F.log);
const putar = {}; for (let i = 0; i < 10; i++) putar[`https://publik.example/${i}`] = [302, `https://publik.example/${i + 1}`];
F = fetchPeta(putar); galat = null;
try { await M.ambilAman('https://publik.example/0', {}, F.f); } catch (e) { galat = e; }
cek(galat && F.log.length === 6, 'pengalihan berputar → berhenti sesudah 5 lompatan', F.log.length);
F = fetchPeta({}); galat = null;
try { await M.ambilAman('http://10.0.0.5/admin', {}, F.f); } catch (e) { galat = e; }
cek(galat instanceof M.AlamatDitolakError && F.log.length === 0, 'alamat awal privat → nol permintaan keluar');

// ── 4. Sub-agent sungguhan memakai pagar ─────────────────────────────────────────────────────────
const fetchAsli = globalThis.fetch;
let keluar = [];
globalThis.fetch = async (u, init) => { keluar.push({ u: String(u), redirect: init?.redirect }); return new Response('{"ok":true}', { status: 200 }); };
const llm = (json) => async () => JSON.stringify(json);
let o = await M.communicator.execute({ task: 'x', runLLM: llm({ url: 'http://169.254.169.254/latest/meta-data/iam', method: 'GET' }), env: {} });
cek(keluar.length === 0 && /tidak diizinkan/i.test(o.output), 'communicator: URL buatan model ke metadata → ditolak, nol permintaan', { keluar, o });
keluar = [];
o = await M.communicator.execute({ task: 'x', runLLM: llm({ url: 'https://hooks.example.com/kirim', method: 'POST', body: '{"a":1}' }), env: {} });
cek(keluar.length === 1 && keluar[0].redirect === 'manual' && /Berhasil/.test(o.output), 'communicator: webhook publik tetap jalan (lewat ambilAman)', { keluar, o });
keluar = [];
o = await M.scraper.execute({ task: 'scrape http://localhost:8080/admin dan http://192.168.1.1/', accumulatedContext: '', runLLM: async () => '' });
cek(keluar.length === 0, 'scraper: localhost & 192.168 → nol permintaan (termasuk lewat Jina)', { keluar, o: o?.output?.slice?.(0, 120) });
keluar = [];
await M.youtube.execute({ task: 'https://youtu.be/abcdefghijk', runLLM: async () => 'ringkas', env: {} });
cek(!keluar.some((k) => k.u.includes('apify')), 'youtube_analyst tanpa token di env → Apify TIDAK dipanggil (tak lagi membaca Deno.env)', keluar);
keluar = [];
await M.youtube.execute({ task: 'https://youtu.be/abcdefghijk', runLLM: async () => 'ringkas', env: { APIFY_API_TOKEN: 'T' } });
cek(keluar.some((k) => k.u.includes('apify')), 'youtube_analyst dengan token pemilik di env → Apify dipanggil', keluar);
globalThis.fetch = fetchAsli;

// ── 5. proxy_fetch: pengalihan ke alamat internal ditolak ────────────────────────────────────────
globalThis.__auth = () => ({ user: { id: 'u' }, authErrorResponse: null });
F = fetchPeta({ 'https://publik.example/rss': [302, 'http://127.0.0.1:54321/rest/v1/'] });
const rp = await M.handleProxyFetchRequest(new Request('https://x.supabase.co/f', { method: 'POST' }), { action: 'proxy_fetch', url: 'https://publik.example/rss' }, {}, F.f);
cek(rp?.status === 400 && F.log.length === 1, 'proxy_fetch: RSS publik yang dialihkan ke 127.0.0.1 → 400, tujuan tak diminta', { status: rp?.status, log: F.log });

// ── 6. Sambungan ─────────────────────────────────────────────────────────────────────────────────
const EH = readFileSync(join(AP, 'lib/orchestration/handlers/execution_handler.ts'), 'utf8');
const iSaring = EH.indexOf('alasanTolakSubagent(');
cek(iSaring > 0 && iSaring < EH.indexOf("type: 'Tool.Requested'"), 'execution_handler menyaring rencana SEBELUM memancarkan Tool.Requested');
const pemancar = (await import('node:child_process')).execSync(
  `git grep -l "'Tool.Requested'" -- supabase/functions/agent-process`, { cwd: AKAR, encoding: 'utf8' }).trim().split('\n').sort();
cek(pemancar.filter((p) => !/event_bus\.ts$|subscribers\//.test(p)).join() === 'supabase/functions/agent-process/lib/orchestration/handlers/execution_handler.ts',
  'pemancar Tool.Requested hanya execution_handler (jalan lain ke plugin.execute akan melewati izin)', pemancar);
const YT = readFileSync(join(AP, 'plugins/youtube_analyst.ts'), 'utf8');
cek(!/Deno\.env\.get\(["']APIFY/.test(YT), 'youtube_analyst tak lagi membaca token Apify langsung dari Deno.env');

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

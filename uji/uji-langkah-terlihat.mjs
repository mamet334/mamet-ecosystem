// UJI 2026-10-29 — hasil olahan LLM terlihat Owner: rencana Coordinator, kata kunci researcher, dan langkah klien sampai ke
// panel Monitor (ADR-0021 §2.3 "selalu terlihat — satu baris").
//
// Ketahuan 29 Okt: gelembung chat tak pernah menampilkan langkah proses; satu-satunya tempatnya panel Monitor, dan panel itu
// diberi `jsonMetadata` saja — baris klien "🔍 Dicari (web)" (28 Okt) tak tampil di mana pun, jalur mengalir tak mengirim
// langkah sama sekali. Uji 28 Okt hanya memeriksa barisnya DISUSUN; uji ini memeriksa barisnya SAMPAI ke data panel.
//
// intent_router.ts & execution_handler.ts DIBUNDEL SUNGGUHAN (esbuild); hanya LLM, parser, registry, event bus, dan
// registry adapter ditiru. Rendering panel di peramban sungguhan dibuktikan terpisah (changelog 29 Okt).

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-langkah-terlihat-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

const TIRUAN = {
  'llm_orchestrator.ts': 'export const runCoordinatorLLM = (...a) => globalThis.__tiruan.llm(...a);',
  'parser_pipeline.ts': 'export const executeResponsePipeline = (_n, teks) => ({ plan: JSON.parse(teks || "[]"), validation: { status: "VALID" } });',
  'registry.ts': "export const getPluginPromptList = () => '- researcher'; export const getPluginByName = () => null;",
  'event_bus.ts': `const h = {};
    export const eventBus = {
      subscribe: (t, f) => { (h[t] ||= []).push(f); },
      unsubscribe: (t, f) => { h[t] = (h[t] || []).filter((x) => x !== f); },
      emit: (e) => {
        if (e.type !== 'Tool.Requested') return;
        const p = e.payload;
        const payload = { executionId: p.executionId, status: 'COMPLETED', durationMs: 5, subagentResText: 'bahan', subagentSources: [],
          subagentToolExec: globalThis.__tiruan.exec(p.subagent) };
        queueMicrotask(() => [...(h['Tool.Completed'] || [])].forEach((f) => f({ payload })));
      },
    };`,
  'adapter_registry.ts': 'export const CapabilityRegistry = {};',
};
const bundel = async (masuk, nama) => {
  const h = await esbuild.build({
    entryPoints: [join(AKAR, masuk)], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
    plugins: [{ name: 'tiruan', setup(b) {
      b.onResolve({ filter: /(llm_orchestrator|parser_pipeline|registry|event_bus|adapter_registry)\.ts$/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, (a) => ({ contents: TIRUAN[a.path], loader: 'js' }));
    } }],
  });
  writeFileSync(join(dir, nama), h.outputFiles[0].text);
  return import(pathToFileURL(join(dir, nama)).href);
};

console.log('uji-langkah-terlihat v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};
const maef = { evaluatePhaseResult() {}, shouldExecutePhase: () => true, requestTransition() {} };

// ── 1. Penyusun baris (modul murni) ────────────────────────────────────────────────────────────
const { barisRencana, barisDicariSubagent } = await bundel('supabase/functions/agent-process/lib/orchestration/langkah_terlihat.ts', 'lt.mjs');
const panjang = 'x'.repeat(300);
const r2 = barisRencana([{ subagent: 'researcher', task: 'Cari pemenang\n  MotoGP 2026' }, { subagent: 'cron_manager', task: panjang }]);
cek(r2.startsWith('📋 Rencana: 2 sub-agent akan ditugaskan → researcher: "Cari pemenang MotoGP 2026" · cron_manager: "x'),
  'rencana memuat TUGAS tiap sub-agent dalam satu baris (spasi & baris baru dirapikan)', r2);
cek(!r2.includes('\n') && r2.includes('x'.repeat(139) + '…"') && !r2.includes('x'.repeat(140)), 'tugas panjang dipotong 140 huruf dengan "…"', r2.length);
cek(barisDicariSubagent('researcher', { name: 'web_news_search', args: { kueri: 'banjir Baturaja | terbaru OKU', penyedia: 'Bing News' } })
  === '🔍 Dicari (berita, researcher): "banjir Baturaja | terbaru OKU" → Bing News', 'kata kunci yang benar-benar dicari researcher → satu baris');
cek(barisDicariSubagent('cron_manager', null) === null && barisDicariSubagent('scraper', { args: {} }) === null, 'sub-agent yang tak mencari → tak ada baris');

// ── 2. intent_router sungguhan ────────────────────────────────────────────────────────────────
const { IntentRouterHandler } = await bundel('supabase/functions/agent-process/lib/orchestration/handlers/intent_router.ts', 'ir.mjs');
globalThis.__tiruan = { llm: async () => '[{"subagent":"researcher","task":"Cari pemenang MotoGP 2026"}]', exec: () => null };
const ctxR = { request: { tools: ['web_search'], finalMessage: 'cari pemenang motogp tahun ini', guardianPromptDirective: '' }, state: { processingSteps: [] } };
await IntentRouterHandler.handle(ctxR, {}, maef);
cek(ctxR.state.processingSteps.some((l) => l === '📋 Rencana: 1 sub-agent akan ditugaskan → researcher: "Cari pemenang MotoGP 2026"'),
  'intent_router: langkah proses memuat tugas hasil tulisan ulang Coordinator', ctxR.state.processingSteps);

// ── 3. execution_handler sungguhan ────────────────────────────────────────────────────────────
const { ExecutionPlannerHandler } = await bundel('supabase/functions/agent-process/lib/orchestration/handlers/execution_handler.ts', 'eh.mjs');
globalThis.__tiruan.exec = (sub) => (sub === 'researcher' ? { name: 'web_news_search', args: { kueri: 'pemenang MotoGP 2026', penyedia: 'Bing News' } } : null);
// T1 (30 Okt 2026): execution_handler kini menjalankan hanya sub-agent yang DIMINTA di `tools` (izin_subagent.ts) dan
// membaca `MAMET_PEMILIK_IDS` dari Deno.env — keduanya disediakan di sini seperti di server.
globalThis.Deno ??= { env: { get: () => undefined } };
const ctxE = { request: { finalMessage: 'cari pemenang motogp', tools: ['web_search', 'cron_manager'] }, state: { processingSteps: [] }, auth: { userId: 'u' } };
await ExecutionPlannerHandler.execute([{ subagent: 'researcher', task: 'Cari pemenang MotoGP 2026' }, { subagent: 'cron_manager', task: 'jadwalkan' }],
  ctxE, { keys: {}, env: {}, tasks: { traceId: 't' } }, maef, '', 'm');
const L = ctxE.state.processingSteps;
const iDicari = L.indexOf('🔍 Dicari (berita, researcher): "pemenang MotoGP 2026" → Bing News');
const iSelesai = L.findIndex((l) => l.includes('"researcher" selesai'));
cek(iDicari >= 0 && iSelesai > iDicari, 'execution_handler: baris "🔍 Dicari (berita)" muncul tepat sebelum "researcher selesai"', L);
cek(L.filter((l) => l.startsWith('🔍 Dicari')).length === 1, 'sub-agent yang tak mencari (cron_manager) tak menambah baris', L);

// ── 4. Panel Monitor menerima langkah GABUNGAN ────────────────────────────────────────────────
const { jejakUntukMonitor } = await import(pathToFileURL(join(AKAR, 'frontend/src/components/widgets/jejakMonitor.js')).href);
const KLIEN = '🔍 Dicari (web): "banjir Baturaja" → 5 hasil';
const SERVER = '📋 Rencana: 1 sub-agent akan ditugaskan → researcher: "Cari banjir"';
const jHybrid = jejakUntukMonitor([KLIEN, SERVER], { processingSteps: [SERVER], toolsUsed: ['x'] });
cek(jHybrid?.logs?.processingSteps?.join('|') === `${KLIEN}|${SERVER}` && jHybrid.logs.toolsUsed?.length === 1,
  'jalur hybrid/JSON: baris klien ikut ke panel (dulu hanya langkah server), metadata lain tetap', jHybrid);
const jAlir = jejakUntukMonitor([KLIEN, SERVER], { penyedia: 'DeepSeek' });
cek(jAlir?.logs?.processingSteps?.length === 2 && jAlir.logs.penyedia === 'DeepSeek', 'jalur mengalir: langkah sampai ke panel (dulu hanya {penyedia})', jAlir);
cek(jejakUntukMonitor([KLIEN], null)?.logs?.processingSteps?.[0] === KLIEN, 'tanpa metadata server pun langkah klien tetap dikirim');
cek(jejakUntukMonitor([], null) === null, 'tak ada apa pun → tak mengirim apa pun');
// Cara panel membaca data (MaefExecutionMonitorWidget.jsx): `payload.logs || payload` lalu `.processingSteps || .logs`.
const W = baca('frontend/src/components/widgets/MaefExecutionMonitorWidget.jsx');
cek(/preInjectedData\.logs \|\| preInjectedData/.test(W) && /activeTrace\.processingSteps \|\| activeTrace\.logs/.test(W),
  'panel membaca logs.processingSteps — bentuk yang dikirim jejakUntukMonitor');
const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
cek(/const jejak = jejakUntukMonitor\(steps, jsonMetadata\);[\s\S]{0,120}injectWidgetData\('widget:maef-monitor', jejak\)/.test(CE)
  && !/logs: jsonMetadata/.test(CE), 'ConversationEngine mengirim jejakUntukMonitor(steps, jsonMetadata) — bukan jsonMetadata mentah');

// ── 5. Gelembung jawaban: baris penting tampil langsung (Varian B, pilihan Owner 29 Okt) ─────────
const { langkahPenting } = await import(pathToFileURL(join(AKAR, 'frontend/src/components/workbench/langkahPenting.js')).href);
const LANGKAH = [KLIEN, '🔍 Menganalisis permintaan user...', '🤖 Kepala Agent (Coordinator): Merencanakan strategi...', SERVER,
  '🚀 Eksekusi [Tier 1]: Sub-Agent "researcher"', '🔍 Dicari (berita, researcher): "x" → Bing News', '✅ [Tier 1] "researcher" selesai'];
const penting = langkahPenting(LANGKAH);
cek(penting.join('|') === `${KLIEN}|${SERVER}|🔍 Dicari (berita, researcher): "x" → Bing News`,
  'hanya "🔍 Dicari" & "📋 Rencana" — "🔍 Menganalisis…" dan langkah teknis lain tetap di panel Monitor', penting);
cek(langkahPenting(undefined).length === 0 && langkahPenting([null, 3, '📋 Rencana: 1']).length === 1, 'pesan tanpa langkah / isi bukan teks → aman');
const iLangkah = CE.indexOf("{m.role !== 'user' && langkahPenting(m.steps).length > 0 && (");
const iNalar = CE.indexOf('{parsed.thinking && (');
cek(iLangkah > 0 && iNalar > iLangkah && iNalar - iLangkah < 900, 'ConversationEngine menggambar baris penting tepat DI ATAS blok Berpikir, hanya untuk jawaban (bukan pesan pengguna)');
const kelasLangkah = (CE.slice(iLangkah, iNalar).match(/<div className="([^"]+)">/) || [])[1] || '';
cek(kelasLangkah === 'mb-3 text-body-sm text-on-surface-variant leading-relaxed [overflow-wrap:anywhere]', 'gaya baris tipis = gaya isi blok Berpikir (tanpa lipat, tanpa garis)', kelasLangkah);
// Kelasnya DIKOMPILASI dengan Tailwind sungguhan — kelas di luar skala dibuang diam-diam (pelajaran 19 Okt).
const { createRequire } = await import('node:module');
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const escTW = reqFE('tailwindcss/lib/util/escapeClassName').default;
const { css: cssLangkah } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelasLangkah}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const takDibuat = kelasLangkah.split(/\s+/).filter((k) => k && !cssLangkah.includes('.' + escTW(k) + ' ') && !cssLangkah.includes('.' + escTW(k) + '{'));
cek(kelasLangkah && takDibuat.length === 0, `${kelasLangkah.split(/\s+/).length} kelas baris langkah benar-benar dibuat Tailwind`, takDibuat);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

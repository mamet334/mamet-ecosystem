// UJI 2026-10-28 — Intent Router: kegagalan ke JALUR AMAN, dan "tidak ada" ≠ "gagal" (Item 126 Fase 1, temuan 4).
//
// Riwayat chat (agregat di database): 6 dari 6 kegagalan LLM pengklasifikasi diikuti Coordinator yang JUGA gagal (model
// & kunci sama) dan 0 sub-agent jalan; lalu 6 dari 6 tetap tercatat "Coordinator memutuskan tidak ada sub-agent" —
// padahal ia tak pernah sempat memutuskan.
//
// intent_router.ts DIBUNDEL SUNGGUHAN (esbuild); hanya tiga impornya diganti tiruan: pemanggil LLM, parser rencana, dan
// daftar plugin. Pencocok kata kunci tetap modul asli. Jadi yang diuji adalah alur keputusan handler itu sendiri.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const TIRUAN = {
  'llm_orchestrator.ts': 'export const runCoordinatorLLM = (...a) => globalThis.__tiruan.llm(...a);',
  'parser_pipeline.ts': 'export const executeResponsePipeline = (_n, teks) => globalThis.__tiruan.parse(teks);',
  'registry.ts': "export const getPluginPromptList = () => '- researcher';",
};
const hasil = await esbuild.build({
  entryPoints: [join(AKAR, 'supabase/functions/agent-process/lib/orchestration/handlers/intent_router.ts')],
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{
    name: 'tiruan',
    setup(b) {
      b.onResolve({ filter: /(llm_orchestrator|parser_pipeline|registry)\.ts$/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, (a) => ({ contents: TIRUAN[a.path], loader: 'js' }));
    },
  }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-router-jalur-aman-'));
writeFileSync(join(dir, 'ir.mjs'), hasil.outputFiles[0].text);
const { IntentRouterHandler } = await import(pathToFileURL(join(dir, 'ir.mjs')).href);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

console.log('uji-router-jalur-aman v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

/** Satu putaran router. `llm` = daftar jawaban/galat berurutan untuk tiap panggilan runCoordinatorLLM. */
async function jalankan(pesan, llm, { tools = ['web_search'] } = {}) {
  const panggilan = [];
  const antre = [...llm];
  globalThis.__tiruan = {
    llm: async (prompt, sistem) => {
      panggilan.push(/router intent/i.test(sistem) ? 'pengklasifikasi' : 'coordinator');
      const j = antre.shift();
      if (j instanceof Error) throw j;
      return j;
    },
    parse: (teks) => ({ plan: JSON.parse(teks || '[]'), validation: { status: 'VALID' } }),
  };
  const lewati = [];
  const maef = {
    evaluatePhaseResult: (_f, r) => lewati.push(...(r?.skipPhases || [])),
    shouldExecutePhase: (f) => !lewati.includes(f),
    requestTransition: () => {},
  };
  const ctx = { request: { tools, finalMessage: pesan, contractValidation: { status: 'VALID' } }, state: { processingSteps: [] } };
  const h = await IntentRouterHandler.handle(ctx, {}, maef);
  return { ...h, panggilan, langkah: ctx.state.processingSteps, lewati };
}
const ada = (langkah, re) => langkah.some((l) => re.test(l));

// ── 1. Pengklasifikasi gagal → jalur aman ──────────────────────────────────────────────────────
console.log('\n-- pengklasifikasi gagal --');
let r = await jalankan('halo, apa kabar hari ini?', [new Error('402 saldo tidak cukup')]);
cek(r.isChatBiasa === true, 'isChatBiasa = true → jawab langsung', r.isChatBiasa);
cek(r.panggilan.join(',') === 'pengklasifikasi', 'Coordinator TIDAK dipanggil (dulu: satu panggilan yang pasti ikut gagal)', r.panggilan);
cek(r.lewati.includes('ORCHESTRATION') && r.lewati.includes('TOOL_EXECUTION'), 'fase ORCHESTRATION & TOOL_EXECUTION dilewati', r.lewati);
cek(ada(r.langkah, /Intent Router gagal \(402 saldo tidak cukup\) → jalur aman: dijawab langsung tanpa sub-agent/), 'langkah proses menyebut alasan DAN jalurnya', r.langkah);
cek(!ada(r.langkah, /memutuskan/), 'tidak ada klaim "memutuskan" apa pun', r.langkah);

// ── 2. Coordinator gagal → "gagal", bukan "memutuskan" ─────────────────────────────────────────
console.log('\n-- Coordinator gagal --');
r = await jalankan('tolong mencari berita oku', [new Error('timeout')]);
cek(r.panggilan.join(',') === 'coordinator', 'kata kunci "mencari" → langsung Coordinator, tanpa pengklasifikasi', r.panggilan);
cek(ada(r.langkah, /Coordinator gagal merencanakan, lanjut tanpa sub-agent: timeout/), 'kegagalan Coordinator tercatat', r.langkah);
cek(!ada(r.langkah, /Coordinator memutuskan tidak ada sub-agent/), '"memutuskan tidak ada sub-agent" TIDAK ditulis sesudah gagal (dulu 6 dari 6)', r.langkah);
cek(r.plan.length === 0, 'rencana kosong', r.plan);

// ── 3. Jalur normal tak berubah ────────────────────────────────────────────────────────────────
console.log('\n-- jalur normal --');
r = await jalankan('halo, apa kabar?', ['CHAT_BIASA']);
cek(r.isChatBiasa === true && r.panggilan.join(',') === 'pengklasifikasi', 'CHAT_BIASA → jawab langsung, Coordinator tak dipanggil', r);
cek(ada(r.langkah, /Obrolan biasa/) && !ada(r.langkah, /jalur aman/), 'langkahnya "Obrolan biasa", bukan "jalur aman"', r.langkah);

r = await jalankan('kenapa langit biru?', ['BUTUH_AGENT', '[]']);
cek(r.isChatBiasa === false && r.panggilan.join(',') === 'pengklasifikasi,coordinator', 'BUTUH_AGENT → Coordinator dipanggil', r.panggilan);
cek(ada(r.langkah, /Coordinator memutuskan tidak ada sub-agent yang diperlukan/), 'Coordinator BERHASIL & memutuskan [] → "memutuskan" tetap ditulis (itu memang keputusan)', r.langkah);

r = await jalankan('cari berita terbaru', ['[{"subagent":"researcher","task":"berita terbaru"}]']);
cek(r.plan.length === 1 && ada(r.langkah, /Rencana: 1 sub-agent akan ditugaskan → researcher/), 'rencana berisi → sub-agent ditugaskan', r.langkah);

r = await jalankan('halo', [], { tools: [] });
cek(r.isChatBiasa === true && r.panggilan.length === 0, 'tanpa alat → jawab langsung tanpa memanggil model apa pun', r);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

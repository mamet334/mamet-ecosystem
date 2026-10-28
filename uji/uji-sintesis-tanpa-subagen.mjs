// UJI 2026-10-28 — sintesis "multi-agen" hanya bila ADA hasil sub-agent (Item 126 Fase 1).
//
// Riwayat chat (agregat di database): 66 dari 80 sintesis multi-agen berjalan dengan NOL sub-agent — Coordinator
// memutuskan [] atau gagal — dan model diberi "Anda telah menugaskan beberapa sub-agent… Riwayat pekerjaan sub-agent:"
// yang kosong. Yang dijaga: tanpa hasil sub-agent → prompt = pesan asli (jawab langsung) + langkah proses yang jujur;
// dengan hasil sub-agent → cabang multi-agen tetap; jalur lain tidak berubah.
//
// synthesis_handler.ts DIBUNDEL SUNGGUHAN; yang ditiru hanya pemanggil LLM, penyimpan telemetri, bus event, dan klien
// Supabase (impor jaringan). Mode stream dipakai karena di sana handler MENGEMBALIKAN prompt yang akan dikirim ke model
// tanpa memanggilnya — itulah yang diperiksa.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const TIRUAN = 'export const runLLMDenganNalar = async () => ({ result: "" }); export const persistTelemetryLog = async () => {};'
  + ' export const eventBus = { emit() {}, on() {} }; export const createClient = () => ({});';
const hasil = await esbuild.build({
  entryPoints: [join(AKAR, 'supabase/functions/agent-process/lib/orchestration/handlers/synthesis_handler.ts')],
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{
    name: 'tiruan',
    setup(b) {
      b.onResolve({ filter: /(llm_orchestrator|verification_service|event_bus)\.ts$|^https:\/\/esm\.sh\/@supabase\// }, (a) => ({ path: a.path, namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: TIRUAN, loader: 'js' }));
    },
  }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-sintesis-'));
writeFileSync(join(dir, 'sh.mjs'), hasil.outputFiles[0].text);
const { SynthesisHandler } = await import(pathToFileURL(join(dir, 'sh.mjs')).href);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

console.log('uji-sintesis-tanpa-subagen v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const PESAN = 'tolong mencari kode akses absensi';
async function sintesis({ isChatBiasa = false, orkestrasi = true, subagentRuns = [], lanjutan = null }) {
  const maef = {
    shouldExecutePhase: (f) => (f === 'ORCHESTRATION' ? orkestrasi : true),
    requestTransition: () => {}, getSnapshot: () => ({}),
  };
  const ctx = {
    request: { stream: true, finalMessage: PESAN, history: [], mode: 'ASSISTANT' },
    state: { processingSteps: [], ragArray: [] },
  };
  const state = {
    isChatBiasa, fullSystemContext: 'SISTEM', accumulatedContext: `Permintaan awal user: "${PESAN}"\n\n`,
    tools: ['web_search'], groundingSources: [], toolExecution: null, subagentRuns, lanjutan,
  };
  const r = await SynthesisHandler.handle(state, ctx, {}, maef);
  return { prompt: r?.prompt, langkah: ctx.state.processingSteps, mode: r?.mode };
}
const KLAIM_PALSU = /Anda telah menugaskan beberapa sub-agent/;

// ── 1. Orkestrasi jalan, NOL sub-agent → jawab langsung ────────────────────────────────────────
console.log('\n-- orkestrasi jalan tanpa sub-agent (66 dari 80 di riwayat) --');
let r = await sintesis({ subagentRuns: [] });
cek(r.mode === 'STREAM' && r.prompt === PESAN, 'prompt ke model = pesan asli Owner (cabang jawab langsung)', r.prompt);
cek(!KLAIM_PALSU.test(r.prompt || ''), 'TIDAK ada klaim "Anda telah menugaskan beberapa sub-agent"', r.prompt);
cek(r.langkah.some((l) => /Tak ada sub-agent yang bekerja → dijawab langsung/.test(l)), 'langkah proses menyebut kenapa dijawab langsung', r.langkah);
cek(!r.langkah.some((l) => /Merangkum dan menyintesis/.test(l)), 'tidak ada langkah "Merangkum dan menyintesis"', r.langkah);
r = await sintesis({ subagentRuns: undefined });
cek(r.prompt === PESAN, 'subagentRuns tak terdefinisi → juga jawab langsung', r.prompt);

// ── 2. Ada hasil sub-agent → cabang multi-agen tetap ───────────────────────────────────────────
console.log('\n-- ada hasil sub-agent (14 dari 80) --');
r = await sintesis({ subagentRuns: [{ subagent: 'researcher', output: 'hasil riset' }] });
cek(KLAIM_PALSU.test(r.prompt || '') && r.prompt.includes(PESAN), 'prompt sintesis multi-agen tetap dipakai', r.prompt?.slice(0, 120));
cek(r.langkah.some((l) => /Merangkum dan menyintesis/.test(l)) && !r.langkah.some((l) => /Tak ada sub-agent/.test(l)), 'langkahnya sintesis, bukan "tak ada sub-agent"', r.langkah);
r = await sintesis({ subagentRuns: [{ subagent: 'researcher', output: 'GAGAL: timeout' }] });
cek(KLAIM_PALSU.test(r.prompt || ''), 'sub-agent jalan lalu gagal → tetap cabang multi-agen (kegagalannya ikut dilaporkan)');

// ── 3. Jalur lain tak berubah ──────────────────────────────────────────────────────────────────
console.log('\n-- jalur lain --');
r = await sintesis({ isChatBiasa: true });
cek(r.prompt === PESAN && !r.langkah.some((l) => /Tak ada sub-agent/.test(l)), 'obrolan biasa → jawab langsung tanpa baris "tak ada sub-agent" (orkestrasi memang tak dijalankan)', r.langkah);
r = await sintesis({ orkestrasi: false });
cek(r.prompt === PESAN && !r.langkah.some((l) => /Tak ada sub-agent/.test(l)), 'fase orkestrasi dilewati → jawab langsung, tanpa baris tambahan', r.langkah);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

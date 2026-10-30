// UJI 2026-10-30 — K4 (ADR-0022): kegagalan semua penyedia di jalur STREAM tampil manusiawi, tanpa label palsu.
//
// Terlihat live di Mametlite (uji Owner 30 Okt): jawaban berisi "*(Fallback Note: OpenRouterAdapter failed,
// cascading...)*" lalu "**Semua AI Provider sedang limit atau gangguan.** Detail error: … plafon ulangnya 26 token".
// Stream sudah HTTP 200, jadi kegagalan ditulis ke ISI jawaban dan penerjemah pesan M4 di klien tak menyentuhnya.
// Ditambah: bila ada dokumen dilampirkan, pemeriksa label menempelkan HYPOTHESIS + "model tidak menulis label".
//
// PERILAKU: `runStreamLLM` asli (dibundel; hanya CapabilityRegistry ditiru), `stream_handler` asli (runStreamLLM
// ditiru), kalimat saldo dari `pesanSaldoTakCukup` server yang ASLI, dan `pesanUntukPengguna` Mametlite yang asli.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LIB = join(AKAR, 'supabase/functions/agent-process/lib');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-gagal-stream-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

async function bundel(isi, tiruan, nama) {
  const h = await esbuild.build({
    stdin: { contents: isi, resolveDir: LIB, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
    external: ['https://*', 'jsr:*', 'npm:*'],
    plugins: [{ name: 'tiruan', setup(b) {
      for (const [pola, kode] of tiruan) {
        b.onResolve({ filter: pola }, () => ({ path: String(pola), namespace: 'tiruan' }));
        b.onLoad({ filter: new RegExp('^' + String(pola).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '$'), namespace: 'tiruan' }, () => ({ contents: kode, loader: 'js' }));
      }
    } }],
  });
  writeFileSync(join(dir, nama), h.outputFiles[0].text);
  return import(pathToFileURL(join(dir, nama)).href);
}

// runStreamLLM asli: CapabilityRegistry → adapter tiruan yang bisa disuruh gagal.
const O = await bundel("export { runStreamLLM } from './llm_orchestrator.ts';", [
  [/adapter_registry\.ts$/, 'export const CapabilityRegistry = { initializeAdapters: async () => {}, getAvailableAIAdapters: () => globalThis.__adapter };'],
  [/event_bus\.ts$/, 'export const eventBus = { emit() {}, subscribe() {} };'],
], 'o.mjs');
// stream_handler asli: runStreamLLM ditiru mengalirkan teks + menyetel penanda seperti aslinya.
const S = await bundel("export { getStreamResponse } from './stream_handler.ts';", [
  [/llm_orchestrator\.ts$/, 'export async function* runStreamLLM(p, s, h, rctx) { if (globalThis.__gagal) rctx.semuaPenyediaGagal = true; for (const k of globalThis.__potongan) yield k; }'],
  [/runtime_context\.ts$/, 'export class RuntimeContext {}'],
], 's.mjs');
const { pesanSemuaPenyediaGagal } = await import(pathToFileURL(join(LIB, 'streaming/pesan_gagal_stream.ts')).href);
const R = await import(pathToFileURL(join(LIB, 'adapters/reasoning_openrouter.ts')).href);
const { pesanUntukPengguna } = await import(pathToFileURL(join(AKAR, 'mametlite/src/lib/pesanGalat.js')).href);

console.log = () => {}; console.warn = () => {}; console.error = () => {};
const tulis = (s) => process.stdout.write(s + '\n');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  tulis(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
tulis('uji-pesan-gagal-stream v1');

const SALDO = R.pesanSaldoTakCukup('{"error":{"code":402,"message":"You requested up to 8192 tokens, but can only afford 29"}}', 8192);
const adapter = (nama, perilaku) => ({ name: nama, stream: async function* () { if (perilaku instanceof Error) throw perilaku; for (const k of perilaku) yield k; } });
async function alir(adapters) {
  globalThis.__adapter = adapters;
  const rctx = { model: {}, keys: {}, env: {}, stream: {}, tasks: { traceId: 't' } };
  let teks = '';
  for await (const k of O.runStreamLLM('p', 's', [], rctx)) teks += k;
  return { teks, rctx };
}

// ── 1. Semua penyedia gagal karena saldo ───────────────────────────────────────────────────────
let r = await alir([adapter('OpenRouterAdapter', new Error(SALDO))]);
cek(!/Fallback Note|cascading|Semua AI Provider/i.test(r.teks), 'tak ada lagi "Fallback Note"/"Semua AI Provider" di isi jawaban', r.teks.slice(0, 200));
cek(/Saldo OpenRouter Anda tidak cukup/.test(r.teks) && /openrouter\.ai/.test(r.teks), 'judul saldo + tindakan (isi ulang di openrouter.ai)', r.teks.slice(0, 200));
cek(/\*Pesan teknis: .*29 token/.test(r.teks), 'teks teknis tetap ikut, kecil (pengguna HP tak punya DevTools)', r.teks.slice(-200));
cek(r.rctx.semuaPenyediaGagal === true, 'penanda semuaPenyediaGagal disetel untuk stream_handler');

// ── 2. Penyedia pertama gagal, berikutnya berhasil → hanya jawaban ────────────────────────────────
r = await alir([adapter('GroqAdapter', new Error('429 rate limit')), adapter('OpenRouterAdapter', ['Jawaban ', 'baik.'])]);
cek(r.teks === 'Jawaban baik.' && !r.rctx.semuaPenyediaGagal, 'fallback berhasil → isi hanya jawaban, tanpa catatan teknis, tanpa penanda', r.teks);

// ── 3. Gangguan bukan saldo → pesan gangguan umum ─────────────────────────────────────────────────
r = await alir([adapter('OpenRouterAdapter', new Error('503 upstream connect error'))]);
cek(/Layanan AI sedang gangguan/.test(r.teks) && !/Saldo/.test(r.teks), 'galat non-saldo → "Layanan AI sedang gangguan", bukan saldo', r.teks.slice(0, 160));
cek(pesanSemuaPenyediaGagal('').includes('tanpa keterangan'), 'detail kosong → "tanpa keterangan", bukan string kosong');

// ── 4. stream_handler asli: pesan kegagalan TIDAK diberi label/catatan RAG ────────────────────────
async function handler({ gagalSemua, potongan }) {
  globalThis.__gagal = gagalSemua; globalThis.__potongan = potongan;
  const res = S.getStreamResponse('p', 's', [], { judulDokumen: ['DOK A'], isiDokumen: ['isi'], catatanRag: '_Catatan sistem: pencarian makna dokumen tidak jalan (x) — y._' }, { tasks: {} });
  const mentah = await res.text();
  return mentah.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]')
    .map((l) => { try { return JSON.parse(l.slice(6)).choices?.[0]?.delta?.content || ''; } catch { return ''; } }).join('');
}
let isi = await handler({ gagalSemua: true, potongan: [pesanSemuaPenyediaGagal(SALDO)] });
cek(!/STATUS: HYPOTHESIS|model tidak menulis label|pencarian makna/.test(isi), 'semua gagal + dokumen dilampirkan → tanpa label HYPOTHESIS & tanpa catatan RAG', isi.slice(-200));
isi = await handler({ gagalSemua: false, potongan: ['Jawaban tanpa label.'] });
cek(/STATUS: HYPOTHESIS/.test(isi) && /pencarian makna/.test(isi), 'jawaban model sungguhan tetap diperiksa label & diberi catatan RAG (tak ikut dimatikan)', isi.slice(-200));

// ── 5. Mametlite (jalur non-stream): kalimat saldo server dikenali ────────────────────────────────
for (const [nama, kalimat] of [
  ['plafon di bawah lantai', SALDO],
  ['sudah diulang', R.pesanSaldoTakCukup('You requested up to 8192 tokens, but can only afford 444', 8192)],
]) {
  const p = pesanUntukPengguna(new Error(kalimat));
  cek(/Saldo OpenRouter Anda tidak cukup/.test(p.judul), `Mametlite: kalimat saldo server (${nama}) → judul saldo`, p);
}

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

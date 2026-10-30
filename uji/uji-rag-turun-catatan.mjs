// UJI 2026-10-30 — K2/U8b (ADR-0022): RAG yang turun ke pencocokan kata TERLIHAT di jawaban, juga di Mametlite.
//
// Sejak 2 Okt penurunannya ("⚠️ [RAG TURUN KE PENCOCOKAN KATA]") hanya masuk langkah proses. Mametlite tidak
// menampilkan langkah proses — pengguna awam membaca jawaban dari pencocokan kata seolah hasil pencarian makna.
// Diperiksa di riwayat 30 Okt: 0 dari 278 pesan RAG pernah turun, jadi jalurnya belum pernah teruji live.
//
// Yang diuji sebagai PERILAKU: `catatanRagTurun` (label_sumber.ts) dibaca `pisahLabel` Mametlite yang asli, dan
// `stream_handler.ts` asli (dibundel; hanya `runStreamLLM` ditiru) menulis catatannya di akhir stream tanpa
// membawanya ke header. Sambungan context_builder → synthesis (non-stream & 3 jalur stream) diperiksa dari teks.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LIB = join(AKAR, 'supabase/functions/agent-process/lib');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const hasil = await esbuild.build({
  stdin: {
    contents: "export { getStreamResponse } from './stream_handler.ts'; export { catatanRagTurun, LABEL_VERIFIED } from './verification/label_sumber.ts';",
    resolveDir: LIB, loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{ name: 'tiruan', setup(b) {
    b.onResolve({ filter: /llm_orchestrator\.ts$/ }, () => ({ path: 'llm', namespace: 'tiruan' }));
    b.onResolve({ filter: /runtime_context\.ts$/ }, () => ({ path: 'rc', namespace: 'tiruan' }));
    b.onLoad({ filter: /.*/, namespace: 'tiruan' }, (a) => ({
      loader: 'js',
      contents: a.path === 'llm'
        ? 'export async function* runStreamLLM() { for (const k of globalThis.__potongan) yield k; }'
        : 'export class RuntimeContext {}',
    }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-rag-catatan-'));
writeFileSync(join(dir, 's.mjs'), hasil.outputFiles[0].text);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });
const M = await import(pathToFileURL(join(dir, 's.mjs')).href);
const { pisahLabel } = await import(pathToFileURL(join(AKAR, 'mametlite/src/lib/labelRamah.js')).href);

console.log = () => {}; console.warn = () => {}; console.error = () => {};
const tulis = (s) => process.stdout.write(s + '\n');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  tulis(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
tulis('uji-rag-turun-catatan v1');

// ── 1. Catatan dibaca kotak label Mametlite ────────────────────────────────────────────────────
const SEBAB = 'OpenRouter menolak membuat vektor: 402 Insufficient credits';
const catatan = M.catatanRagTurun(SEBAB);
const p = pisahLabel(`Isi jawaban dari dokumen.\n\n${M.LABEL_VERIFIED}\n\n${catatan}`);
cek(p.catatan.length === 1 && p.catatan[0].includes('pencocokan kata') && p.catatan[0].includes('402'),
  'pisahLabel Mametlite menangkap catatan + sebabnya (tampil di kotak label)', p);
cek(!p.jawaban.includes('Catatan sistem'), 'catatan tidak tertinggal di badan jawaban', p.jawaban);
cek(M.catatanRagTurun('') === '' && M.catatanRagTurun(undefined) === '', 'tanpa penurunan → tanpa catatan');
const liar = M.catatanRagTurun('baris1\nbaris_2\r\n' + 'x'.repeat(400));
cek(!/[\r\n]/.test(liar) && !/baris_2/.test(liar) && liar.length < 320 && pisahLabel(`a\n\n${liar}`).catatan.length === 1,
  'sebab berbaris baru / garis bawah / panjang → tetap satu baris catatan yang terbaca', liar);

// ── 2. stream_handler asli: catatan di akhir isi, bukan di header ──────────────────────────────
async function alirkan(meta) {
  globalThis.__potongan = ['Jawaban ', 'dari dokumen.'];
  const r = M.getStreamResponse('p', 's', [], meta, {});
  const teks = await r.text();
  const isi = teks.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]')
    .map((l) => { try { return JSON.parse(l.slice(6)).choices?.[0]?.delta?.content || ''; } catch { return ''; } }).join('');
  const header = JSON.parse(decodeURIComponent(atob(r.headers.get('X-Agent-Metadata'))));
  return { isi, header };
}
let s = await alirkan({ judulDokumen: [], isiDokumen: [], catatanRag: catatan });
cek(s.isi.trimEnd().endsWith(catatan), 'stream: catatan ditulis di akhir jawaban', s.isi.slice(-200));
cek(!('catatanRag' in s.header) && !('isiDokumen' in s.header), 'stream: catatan & isi dokumen tidak ikut header X-Agent-Metadata', Object.keys(s.header));
s = await alirkan({ judulDokumen: [], isiDokumen: [] });
cek(!s.isi.includes('Catatan sistem: pencarian makna'), 'stream tanpa penurunan → tanpa catatan', s.isi);

// ── 3. Sambungan (teks): context_builder menandai, synthesis meneruskan ke SEMUA jalur ───────────
const CB = readFileSync(join(LIB, 'orchestration/handlers/context_builder.ts'), 'utf8');
const iTanda = CB.indexOf('ctx.state.ragTurunKeKata = sebabTurun;');
cek(iTanda > 0 && iTanda < CB.indexOf('[RAG TURUN KE PENCOCOKAN KATA]'), 'context_builder menandai penurunan di cabang pencocokan kata');
const SH = readFileSync(join(LIB, 'orchestration/handlers/synthesis_handler.ts'), 'utf8');
const jalurStream = SH.split("mode: 'STREAM'").length - 1;
const bawaCatatan = (SH.match(/isiDokumen,?\s*(\/\/[^\n]*)?\s*catatanRag\s*\n/g) || []).length;
cek(jalurStream === 3 && bawaCatatan === jalurStream, `ketiga jalur stream membawa catatanRag (${bawaCatatan}/${jalurStream})`);
const iKoreksi = SH.indexOf('replyMessage = koreksiLabel(');
cek(iKoreksi > 0 && SH.indexOf('if (catatanRag) replyMessage = `${replyMessage}\\n\\n${catatanRag}`;') > iKoreksi,
  'non-stream: catatan ditambahkan SESUDAH koreksi label (tak ikut dinilai pemeriksa label)');

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

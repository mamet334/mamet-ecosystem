
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FN = join(AKAR, 'supabase/functions');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const POTONG = join(FN, 'agent-process/lib/potong_teks.ts').replace(/\\/g, '/');
const hasil = await esbuild.build({
  stdin: {
    contents: "import './rag-process/index.ts'; export { BATAS_POTONGAN_PER_AKUN, BATAS_POTONGAN_TOTAL, tolakKarenaVolume } from './rag-process/batas_volume.ts';",
    resolveDir: FN, loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  plugins: [{ name: 'tiruan', setup(b) {
    b.onResolve({ filter: /^https:\/\/deno\.land\/std.*server\.ts$/ }, () => ({ path: 'serve', namespace: 'tiruan' }));
    b.onResolve({ filter: /supabase-js/ }, () => ({ path: 'sb', namespace: 'tiruan' }));
    b.onResolve({ filter: /vector_utils\.ts$/ }, () => ({ path: 'vu', namespace: 'tiruan' }));
    b.onLoad({ filter: /.*/, namespace: 'tiruan' }, (a) => ({
      resolveDir: FN, loader: 'ts',
      contents: {
        serve: 'export const serve = (h) => { globalThis.__handler = h; };',
        sb: 'export const createClient = () => globalThis.__sb;',
        vu: `export { chunkText } from '${POTONG}';
             export class EmbedGagal extends Error { constructor(kode, pesan, status) { super(pesan); this.kode = kode; this.status = status; } }
             export const embedLewatOpenRouter = async (k) => { globalThis.__divektorkan += k.length; return k.map(() => [0]); };`,
      }[a.path],
    }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'uji-rag-batas-'));
writeFileSync(join(dir, 'r.mjs'), hasil.outputFiles[0].text);
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {  } });
globalThis.Deno = { env: { get: () => 'x' } };
const M = await import(pathToFileURL(join(dir, 'r.mjs')).href);

console.log = () => {}; console.warn = () => {}; console.error = () => {};
const tulis = (s) => process.stdout.write(s + '\n');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  tulis(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
tulis('uji-batas-rag-process v1');

function sbTiruan({ milik, total, galatHitung = false }) {
  const tulisan = [];
  const rantai = (tabel) => {
    const st = { tabel, op: 'select', opsi: null, filter: [] };
    const hasilAkhir = () => {
      if (st.tabel === 'knowledge_spaces') return { data: { id: 'ruang-1' }, error: null };
      if (st.tabel === 'document_chunks' && st.op === 'select') {
        if (galatHitung) return { count: null, error: { message: 'relasi tak dikenal' } };
        const perAkun = st.filter.some(([k]) => k === 'documents.user_id');
        return { count: perAkun ? milik : total, error: null, data: null };
      }
      if (st.tabel === 'documents' && st.op === 'select') return { data: [], error: null };
      if (st.tabel === 'documents' && st.op === 'insert') return { data: { id: 'dok-1' }, error: null };
      return { data: null, error: null };
    };
    const p = {
      select(_k, opsi) { if (st.op === 'select') st.opsi = opsi; return p; },
      insert(isi) { st.op = 'insert'; tulisan.push({ tabel, op: 'insert', n: Array.isArray(isi) ? isi.length : 1 }); return p; },
      update() { st.op = 'update'; tulisan.push({ tabel, op: 'update' }); return p; },
      delete() { st.op = 'delete'; tulisan.push({ tabel, op: 'delete' }); return p; },
      eq(k, v) { st.filter.push([k, v]); return p; },
      order() { return p; },
      limit() { return p; },
      maybeSingle() { return Promise.resolve(hasilAkhir()); },
      single() { return Promise.resolve(hasilAkhir()); },
      then(ok, nok) { return Promise.resolve(hasilAkhir()).then(ok, nok); },
    };
    return p;
  };
  return {
    tulisan,
    auth: { getUser: async () => ({ data: { user: { id: 'akun-asing' } }, error: null }) },
    from: rantai,
  };
}
const teks = (nPotongan) => Array.from({ length: nPotongan }, (_, i) => `Paragraf ${i}. ` + 'kata '.repeat(150)).join('\n\n');
async function unggah({ milik, total, galatHitung, isi }) {
  globalThis.__sb = sbTiruan({ milik, total, galatHitung });
  globalThis.__divektorkan = 0;
  const req = new Request('https://x.supabase.co/functions/v1/rag-process', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'x-byok-openrouter': 'sk-or-x', 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Uji', text: isi }),
  });
  const r = await globalThis.__handler(req);
  return { status: r.status, isi: await r.json(), tulisan: globalThis.__sb.tulisan, divektorkan: globalThis.__divektorkan };
}
const ISI = teks(12);

let r = await unggah({ milik: 3480, total: 3629, isi: ISI });
cek(r.status === 200 && r.divektorkan > 0 && r.tulisan.some((t) => t.tabel === 'document_chunks'), 'akun 3.480 potongan (Owner hari ini) → unggahan jalan', r);
const nPotongan = r.isi.chunks;

r = await unggah({ milik: M.BATAS_POTONGAN_PER_AKUN - nPotongan + 1, total: 5000, isi: ISI });
cek(r.status === 413 && r.isi.code === 'KUOTA_AKUN_PENUH', `akun melewati ${M.BATAS_POTONGAN_PER_AKUN.toLocaleString('id-ID')} potongan → 413 KUOTA_AKUN_PENUH`, r.isi);
cek(r.divektorkan === 0 && r.tulisan.length === 0, 'ditolak SEBELUM embedding & sebelum dokumen dibuat (tanpa biaya, tanpa sisa)', r);
cek(/Hapus dokumen/.test(r.isi.error) && r.isi.error.includes(M.BATAS_POTONGAN_PER_AKUN.toLocaleString('id-ID')), 'pesan per akun menyebut batas & jalan keluarnya', r.isi.error);
cek(M.BATAS_POTONGAN_PER_AKUN === 25_000 && M.BATAS_POTONGAN_TOTAL === 45_000, 'batas sesuai keputusan Owner 5 Nov: per akun 25.000, total 45.000');
r = await unggah({ milik: M.BATAS_POTONGAN_PER_AKUN - nPotongan, total: 5000, isi: ISI });
cek(r.status === 200, 'tepat di batas akun → masih boleh', r.isi);

r = await unggah({ milik: 10, total: M.BATAS_POTONGAN_TOTAL - nPotongan + 1, isi: ISI });
cek(r.status === 413 && r.isi.code === 'KUOTA_SISTEM_PENUH' && r.divektorkan === 0 && r.tulisan.length === 0,
  'total sistem melewati 45.000 → 413 KUOTA_SISTEM_PENUH, tanpa embedding & tanpa tulisan', r);

r = await unggah({ milik: 0, total: 0, galatHitung: true, isi: ISI });
cek(r.status === 503 && r.isi.code === 'KUOTA_TAK_TERBACA' && r.divektorkan === 0 && r.tulisan.length === 0,
  'hitungan volume gagal → 503 KUOTA_TAK_TERBACA (gagal tertutup, bersuara)', r);

const BITA = 6528;
cek(M.BATAS_POTONGAN_TOTAL * BITA < 0.7 * 500 * 1024 * 1024, `batas total ×6,5 KB = ${Math.round(M.BATAS_POTONGAN_TOTAL * BITA / 1048576)} MB < 70% kuota 500 MB`);
cek(M.BATAS_POTONGAN_PER_AKUN >= 2 * 3480, 'batas per akun ≥ 2× akun terbesar hari ini (3.480) — Owner tak tertahan');

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

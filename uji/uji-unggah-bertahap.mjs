
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FN = join(AKAR, 'supabase/functions');
const SVC = join(AKAR, 'frontend/src/core/runtime/services');
let esbuild;
try {
  esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
} catch {
  console.log('DILEWATI — frontend/node_modules (esbuild) belum terpasang');
  process.exit(0);
}

const tulis = (s) => process.stdout.write(s + '\n');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  tulis(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};
tulis('uji-unggah-bertahap v1');

const dir = mkdtempSync(join(tmpdir(), 'uji-unggah-bertahap-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {  } });
const logAsli = { log: console.log, warn: console.warn, error: console.error };
const diam = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
const bersuara = () => Object.assign(console, logAsli);

tulis('\n-- 1. rag-process bertahap --');
const POTONG = join(FN, 'agent-process/lib/potong_teks.ts').replace(/\\/g, '/');
const bundel = await esbuild.build({
  stdin: { contents: "import './rag-process/index.ts'; export { BATAS_POTONGAN_PER_AKUN } from './rag-process/batas_volume.ts';", resolveDir: FN, loader: 'ts' },
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
             export class EmbedGagal extends Error { constructor(kode, pesan, status = 502) { super(pesan); this.kode = kode; this.status = status; } }
             export const embedLewatOpenRouter = async (k) => globalThis.__embed(k, EmbedGagal);`,
      }[a.path],
    }));
  } }],
});
writeFileSync(join(dir, 'rag.mjs'), bundel.outputFiles[0].text);
globalThis.Deno = { env: { get: () => 'x' } };
const { BATAS_POTONGAN_PER_AKUN: BATAS_AKUN } = await import(pathToFileURL(join(dir, 'rag.mjs')).href);

function dbTiruan({ milikLain = 0 } = {}) {
  const db = { documents: [], document_chunks: [], tulisan: [], gagalSisipKe: null, sisip: 0 };
  let nomor = 0;
  const cocok = (row, filter) => filter.every(([k, v]) => {
    if (k === 'documents.user_id') return db.documents.find((d) => d.id === row.document_id)?.user_id === v;
    if (v === null) return row[k] === null || row[k] === undefined;
    return row[k] === v;
  });
  const cocokAtau = (row, ekspresi) => {
    if (!ekspresi) return true;
    const m = /^diproses_sampai\.is\.null,diproses_sampai\.lt\.(.+)$/.exec(ekspresi);
    if (!m) throw new Error(`or() tak dikenal: ${ekspresi}`);
    return row.diproses_sampai == null || row.diproses_sampai < m[1];
  };
  const from = (tabel) => {
    const st = { op: 'select', isi: null, filter: [], opsi: null, atau: null };
    const selesaikan = () => {
      if (tabel === 'knowledge_spaces') return { data: { id: 'ruang-1' }, error: null };
      if (st.op === 'insert') {
        if (tabel === 'documents') {
          const row = { id: `dok-${++nomor}`, ...st.isi };
          db.documents.push(row);
          db.tulisan.push('documents.insert');
          return { data: { id: row.id }, error: null };
        }
        db.sisip++;
        if (db.gagalSisipKe === db.sisip) return { data: null, error: { message: 'unsupported Unicode escape sequence' } };
        for (const r of st.isi) {
          if (/\u0000/.test(r.content)) return { data: null, error: { message: 'unsupported Unicode escape sequence' } };
        }
        db.document_chunks.push(...st.isi);
        db.tulisan.push('chunks.insert');
        return { data: null, error: null };
      }
      if (st.op === 'update') {
        const kena = db.documents.filter((d) => cocok(d, st.filter) && cocokAtau(d, st.atau));
        kena.forEach((d) => Object.assign(d, st.isi));
        db.tulisan.push('documents.update');
        return { data: kena.map((d) => ({ id: d.id })), error: null };
      }
      if (st.op === 'delete') {
        const hapus = db.documents.filter((d) => cocok(d, st.filter)).map((d) => d.id);
        db.documents = db.documents.filter((d) => !hapus.includes(d.id));
        db.document_chunks = db.document_chunks.filter((c) => !hapus.includes(c.document_id));
        db.documents.forEach((d) => { if (hapus.includes(d.menggantikan)) d.menggantikan = null; });
        db.tulisan.push('documents.delete');
        return { data: hapus.map((id) => ({ id })), error: null };
      }
      if (st.opsi?.head) {
        if (db.gagalHitungDokumen && st.filter.some(([k]) => k === 'document_id')) return { count: null, error: { message: '' } };
        const n = db.document_chunks.filter((c) => cocok(c, st.filter)).length;
        const perAkun = st.filter.some(([k]) => k === 'documents.user_id');
        return { count: n + (perAkun ? milikLain : 0), error: null, data: null };
      }
      return { data: db.documents.filter((d) => cocok(d, st.filter)), error: null };
    };
    const p = {
      select(_k, opsi) { if (st.op === 'select') st.opsi = opsi ?? null; return p; },
      insert(isi) { st.op = 'insert'; st.isi = isi; return p; },
      update(isi) { st.op = 'update'; st.isi = isi; return p; },
      delete() { st.op = 'delete'; return p; },
      eq(k, v) { st.filter.push([k, v]); return p; },
      is(k, v) { st.filter.push([k, v]); return p; },
      or(ekspresi) { st.atau = ekspresi; return p; },
      order() { return p; },
      limit() { return p; },
      maybeSingle() { return Promise.resolve(selesaikan()); },
      single() { return Promise.resolve(selesaikan()); },
      then(ok, nok) { return Promise.resolve(selesaikan()).then(ok, nok); },
    };
    return p;
  };
  const milikSama = (b, l) => {
    const db1 = db.documents.find((d) => d.id === b); const dl = db.documents.find((d) => d.id === l);
    return Boolean(db1 && dl && db1.user_id === dl.user_id);
  };
  const vektorLama = (l, isi) => db.document_chunks.find((c) => c.document_id === l && c.content === isi && c.embedding != null)?.embedding;
  const rpc = async (nama, a) => {
    db.rpc = (db.rpc || 0) + 1;
    if (db.gagalRpcKe === db.rpc) return { data: null, error: { message: 'rpc gagal (disuntik)' } };
    if (nama === 'potongan_lama_ada') {
      if (!milikSama(a.p_dok_baru, a.p_dok_lama)) return { data: [], error: null };
      return { data: a.p_isi.map((isi, i) => (vektorLama(a.p_dok_lama, isi) ? i + 1 : null)).filter(Boolean), error: null };
    }
    if (nama === 'simpan_kelompok_perbarui') {
      if (a.p_isi.length !== a.p_vektor.length) return { data: null, error: { message: 'jumlah isi & vektor berbeda' } };
      if (!milikSama(a.p_dok_baru, a.p_dok_lama)) return { data: null, error: { message: 'versi lama bukan milik pemilik versi baru' } };
      const hilang = a.p_isi.filter((isi, i) => a.p_vektor[i] == null && !vektorLama(a.p_dok_lama, isi));
      if (hilang.length) return { data: null, error: { message: `${hilang.length} potongan salinan tak ditemukan di versi lama` } };
      const baris = a.p_isi.map((isi, i) => ({
        document_id: a.p_dok_baru, content: isi,
        embedding: a.p_vektor[i] != null ? JSON.parse(a.p_vektor[i]) : vektorLama(a.p_dok_lama, isi),
        disalin: a.p_vektor[i] == null,
        urutan: Number.isInteger(a.p_mulai) ? a.p_mulai + i : null,
      }));
      if (db.rpcKurang) baris.pop();
      db.document_chunks.push(...baris);
      db.tulisan.push('rpc.simpan');
      return { data: baris.length, error: null };
    }
    return { data: null, error: { message: `rpc tak dikenal: ${nama}` } };
  };
  return { db, sb: { auth: { getUser: async () => ({ data: { user: { id: 'akun-1' } }, error: null }) }, from, rpc } };
}

const dateAsli = Date.now;
let jam = 1_000_000;
const embed = { panggilan: 0, potongan: 0, gagalKe: null, langkahMs: 1000 };
globalThis.__embed = async (k, EG) => {
  globalThis.__saatEmbed?.();
  embed.panggilan++;
  jam += embed.langkahMs;
  if (embed.gagalKe === embed.panggilan) throw new EG('OPENROUTER_GAGAL', 'OpenRouter menjawab 400: User location is not supported for the API use.', 502);
  embed.potongan += k.length;
  return k.map(() => [0]);
};
const teks = (n, awalan = 'Paragraf') => Array.from({ length: n }, (_, i) => `${awalan} ${i}. ` + 'kata '.repeat(150)).join('\n\n');

async function kirim(sb, isi, judul = 'Buku.pdf', tambahan = {}) {
  globalThis.__sb = sb;
  const req = new Request('https://x.supabase.co/functions/v1/rag-process', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'x-byok-openrouter': 'sk-or-x', 'content-type': 'application/json' },
    body: JSON.stringify({ title: judul, text: isi, spaceId: 'ruang-1', ...tambahan }),
  });
  diam();
  Date.now = () => jam;
  try {
    const r = await globalThis.__handler(req);
    return { status: r.status, isi: await r.json() };
  } finally {
    Date.now = dateAsli;
    bersuara();
  }
}
const ulangEmbed = (o = {}) => Object.assign(embed, { panggilan: 0, potongan: 0, gagalKe: null, langkahMs: 1000 }, o);
const urutanSama = (db, isi) => {
  const harap = isi;
  const nomor = db.document_chunks.map((c) => Number(/Paragraf (\d+)\./.exec(c.content)?.[1] ?? -1));
  return nomor.every((n, i) => i === 0 || n >= nomor[i - 1]) && harap.length > 0;
};

{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  const r = await kirim(sb, teks(12));
  cek(r.status === 200 && r.isi.selesai === true && r.isi.tersimpan === r.isi.total, 'dokumen kecil → satu panggilan, selesai', r.isi);
  cek(db.documents.length === 1 && db.documents[0].selesai === true && db.document_chunks.length === r.isi.total,
    'dokumen dibuat belum-selesai lalu ditandai selesai; semua potongan tersimpan', db.documents);
  cek(typeof db.documents[0].sidik === 'string' && db.documents[0].sidik.length === 64 && db.documents[0].total_potongan === r.isi.total,
    'sidik SHA-256 & total potongan disimpan di dokumen');
}

{
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ langkahMs: 20_000 });
  const r1 = await kirim(sb, isi);
  cek(r1.status === 200 && r1.isi.selesai === false && r1.isi.tersimpan > 0 && r1.isi.tersimpan < r1.isi.total,
    `panggilan 1 berhenti di anggaran: ${r1.isi.tersimpan}/${r1.isi.total}, menjawab selesai:false (bukan galat)`, r1.isi);
  cek(db.documents[0].selesai === false, 'dokumen yang belum lengkap tetap selesai=false (tak dipakai chat)');
  const tersimpan1 = r1.isi.tersimpan;
  let r = r1; let n = 1;
  while (r.isi.selesai === false && n < 10) { r = await kirim(sb, isi); n++; }
  cek(r.status === 200 && r.isi.selesai === true && db.document_chunks.length === r.isi.total && db.documents.length === 1,
    `selesai dalam ${n} panggilan, satu dokumen, ${db.document_chunks.length} potongan`, { n, isi: r.isi, dok: db.documents.length });
  cek(embed.potongan === r.isi.total, `setiap potongan divektorkan TEPAT SEKALI (${embed.potongan}/${r.isi.total}) — tak ada embedding ulang`, embed);
  cek(urutanSama(db, isi), 'potongan tersimpan berurutan (lanjutan menyambung di potongan yang benar)');
  cek(new Set(db.document_chunks.map((c) => c.content)).size === db.document_chunks.length, 'tak ada potongan ganda');
  cek(tersimpan1 % 32 === 0, 'berhenti tepat di batas kelompok 32 (yang tersimpan adalah kelompok utuh)', tersimpan1);
}

{
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ gagalKe: 3 });
  const r1 = await kirim(sb, isi);
  cek(r1.status === 502 && r1.isi.bisaDilanjutkan === true && r1.isi.tersimpan === 64 && r1.isi.documentId,
    'kelompok ke-3 ditolak penyedia → 502, 64 potongan DISIMPAN, bisaDilanjutkan', r1.isi);
  cek(db.documents.length === 1 && db.documents[0].selesai === false && db.document_chunks.length === 64,
    'dokumen tidak dihapus — tetap ada sebagai belum-selesai dengan 64 potongan', { dok: db.documents, n: db.document_chunks.length });
  cek(/unggah berkas yang sama/i.test(r1.isi.error), 'pesan galat menyuruh mengunggah berkas yang sama', r1.isi.error);
  ulangEmbed();
  const r2 = await kirim(sb, isi);
  cek(r2.isi.selesai === true && embed.potongan === r2.isi.total - 64 && db.document_chunks.length === r2.isi.total,
    `lanjutan memvektorkan HANYA sisanya (${embed.potongan} = ${r2.isi.total} − 64)`, { e: embed.potongan, isi: r2.isi });
  cek(/64 sudah tersimpan/.test(r2.isi.message), 'jawaban akhir menyebut potongan dari cache', r2.isi.message);
}

{
  const { db, sb } = dbTiruan();
  ulangEmbed({ gagalKe: 1 });
  const r = await kirim(sb, teks(80));
  cek(r.status === 502 && r.isi.bisaDilanjutkan === false && db.documents.length === 0 && db.document_chunks.length === 0,
    'gagal di kelompok pertama → dokumen dibatalkan, tanpa sisa', { isi: r.isi, dok: db.documents });
}

{
  const { db, sb } = dbTiruan();
  ulangEmbed({ gagalKe: 2 });
  await kirim(sb, teks(120));
  const sebelum = { dok: db.documents.length, pot: db.document_chunks.length };
  ulangEmbed();
  const r = await kirim(sb, teks(120, 'Bab'));
  cek(r.status === 409 && r.isi.code === 'TERTUNDA_BERBEDA' && embed.panggilan === 0,
    'judul sama, teks berbeda → 409 TERTUNDA_BERBEDA tanpa embedding', r.isi);
  cek(db.documents.length === sebelum.dok && db.document_chunks.length === sebelum.pot, 'tidak ada yang ditulis');
}

{
  const { db, sb } = dbTiruan();
  const isi = teks(120);
  ulangEmbed({ gagalKe: 2 });
  await kirim(sb, isi);
  db.documents[0].total_potongan += 1;
  ulangEmbed();
  let r = await kirim(sb, isi);
  cek(r.status === 409 && r.isi.code === 'TERTUNDA_BERBEDA' && embed.panggilan === 0, 'total potongan tersimpan berbeda → 409', r.isi);
  db.documents[0].total_potongan -= 1;
  db.document_chunks.push(...Array.from({ length: 500 }, () => ({ document_id: db.documents[0].id, content: 'x' })));
  r = await kirim(sb, isi);
  cek(r.status === 409 && r.isi.code === 'TERTUNDA_TAK_KONSISTEN' && embed.panggilan === 0, 'potongan tersimpan > isi berkas → 409', r.isi);
}

{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  const r = await kirim(sb, teks(5) + '\n\n\u0000#\u0000#\u0000 \u00007\u0000.' + teks(5, 'Akhir'));
  cek(r.status === 200 && r.isi.selesai === true && db.document_chunks.every((c) => !c.content.includes('\u0000')),
    'teks ber-NUL tersimpan utuh tanpa NUL (dulu: DB Insert Error)', r.isi);
}

{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  db.gagalSisipKe = 2;
  const r = await kirim(sb, teks(120));
  cek(r.status === 500 && r.isi.bisaDilanjutkan === true && r.isi.tersimpan === 32 && db.documents.length === 1,
    'galat simpan kelompok ke-2 → 32 potongan dipertahankan', r.isi);
}

{
  const { db, sb } = dbTiruan({ milikLain: BATAS_AKUN - 100 });
  const isi = teks(220);
  ulangEmbed({ gagalKe: 4 });
  const r1 = await kirim(sb, isi);
  cek(r1.status === 413 && r1.isi.code === 'KUOTA_AKUN_PENUH', `akun ${BATAS_AKUN - 100} + buku penuh → ditolak sebelum embedding`, r1.isi);
  const { db: db2, sb: sb2 } = dbTiruan({ milikLain: BATAS_AKUN - 300 });
  ulangEmbed({ gagalKe: 6 });
  const awal = await kirim(sb2, isi);
  ulangEmbed();
  const r2 = await kirim(sb2, isi);
  cek(awal.isi.tersimpan === 160 && r2.isi.selesai === true,
    'lanjutan dihitung dari sisa potongan, bukan seluruh buku → boleh', { awal: awal.isi, r2: r2.isi });
  void db;
}

tulis('\n-- 1b. kunci sementara: dua panggilan tak menyimpan potongan yang sama --');
const iso = (ms) => new Date(ms).toISOString();
{
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ langkahMs: 20_000 });
  const terkunci = [];
  globalThis.__saatEmbed = () => terkunci.push(db.documents[0]?.diproses_sampai > iso(jam));
  const r1 = await kirim(sb, isi);
  cek(r1.isi.selesai === false && terkunci.length > 0 && terkunci.every(Boolean), 'dokumen terkunci selama setiap kelompok divektorkan', terkunci);
  cek(db.documents[0].diproses_sampai === null, 'jeda anggaran (selesai:false) → kunci dilepas', db.documents[0].diproses_sampai);
  terkunci.length = 0;
  const r2 = await kirim(sb, isi);
  cek(r2.isi.selesai === true && terkunci.every(Boolean) && db.documents[0].diproses_sampai === null,
    'lanjutan mengambil kunci lagi, melepasnya sesudah selesai', { t: terkunci, k: db.documents[0].diproses_sampai });
  globalThis.__saatEmbed = null;
}
{
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ gagalKe: 3 });
  await kirim(sb, isi);
  cek(db.documents[0].diproses_sampai === null, 'gagal di tengah → kunci dilepas (dokumen tetap ada)', db.documents[0]);
  db.documents[0].diproses_sampai = iso(jam + 60_000);
  const sebelum = db.document_chunks.length;
  ulangEmbed();
  const r = await kirim(sb, isi);
  cek(r.status === 423 && r.isi.code === 'SEDANG_DIPROSES' && embed.panggilan === 0 && db.document_chunks.length === sebelum,
    'masih terkunci → 423 SEDANG_DIPROSES, tanpa embedding, tanpa potongan ganda', { s: r.status, i: r.isi, e: embed.panggilan });
  cek(db.documents[0].diproses_sampai === iso(jam + 60_000), 'kunci milik panggilan lain tidak dilepas oleh yang ditolak');
  db.documents[0].diproses_sampai = iso(jam - 1);
  const r2 = await kirim(sb, isi);
  cek(r2.isi.selesai === true && db.document_chunks.length === r2.isi.total && new Set(db.document_chunks.map((c) => c.content)).size === r2.isi.total,
    'kunci kedaluwarsa → diambil alih, dilanjutkan tanpa potongan ganda', r2.isi);
}
{
  const { db, sb } = dbTiruan();
  const isi = teks(120);
  ulangEmbed({ gagalKe: 2 });
  await kirim(sb, isi);
  db.document_chunks.push(...Array.from({ length: 500 }, () => ({ document_id: db.documents[0].id, content: 'x' })));
  ulangEmbed();
  const r = await kirim(sb, isi);
  cek(r.isi.code === 'TERTUNDA_TAK_KONSISTEN' && db.documents[0].diproses_sampai === null, '409 sesudah mengambil kunci → kunci dilepas', db.documents[0]);
}
{
  const { db, sb } = dbTiruan();
  const isi = teks(120);
  ulangEmbed({ gagalKe: 2 });
  await kirim(sb, isi);
  const sebelum = db.document_chunks.length;
  db.gagalHitungDokumen = true;
  ulangEmbed();
  const r = await kirim(sb, isi);
  cek(r.status === 500 && r.isi.tersimpan === null && r.isi.bisaDilanjutkan === true && !/setelah 0 dari/.test(r.isi.error) && /tetap ada/.test(r.isi.error),
    'hitungan gagal → bukan "0 dari N", melainkan "potongan sebelumnya tetap ada"', r.isi);
  cek(db.documents.length === 1 && db.document_chunks.length === sebelum && db.documents[0].diproses_sampai === null && embed.panggilan === 0,
    'hitungan gagal → tanpa embedding, dokumen & potongan utuh, kunci dilepas', { d: db.documents[0], n: db.document_chunks.length });
  db.gagalHitungDokumen = false;
  const r2 = await kirim(sb, isi);
  cek(r2.isi.selesai === true && db.document_chunks.length === r2.isi.total, 'percobaan berikutnya melanjutkan seperti biasa', r2.isi);
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  let kunciAwal = null;
  globalThis.__saatEmbed = () => { kunciAwal ??= db.documents[0]?.diproses_sampai; };
  await kirim(sb, teks(40));
  globalThis.__saatEmbed = null;
  cek(typeof kunciAwal === 'string' && db.documents[0].diproses_sampai === null, 'dokumen baru dibuat sudah terkunci; dilepas sesudah selesai', kunciAwal);
}

tulis('\n-- 1c. perbarui dokumen: nama sama, isi berbeda --');
const v1 = teks(120);
const v2 = Array.from({ length: 130 }, (_, i) => (i >= 50 && i < 60 ? `Paragraf ${i} DIUBAH. ` : `Paragraf ${i}. `) + 'kata '.repeat(150)).join('\n\n');
const isiDok = (db, id) => db.document_chunks.filter((c) => c.document_id === id).map((c) => c.content);
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  const lamaId = db.documents[0].id;
  const isiLama = new Set(isiDok(db, lamaId));
  ulangEmbed();
  const r = await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  const baru = db.documents.find((d) => d.id === r.isi.documentId);
  const isiBaru = isiDok(db, r.isi.documentId);
  const sama = isiBaru.filter((c) => isiLama.has(c)).length;
  cek(r.status === 200 && r.isi.selesai === true && r.isi.diperbarui === true, 'perbarui → selesai, diperbarui:true', r.isi);
  cek(r.isi.disalin === sama && sama > 0 && embed.potongan === r.isi.total - sama,
    `hanya potongan berubah di-embed (${embed.potongan}); ${sama} disalin dari versi lama tanpa OpenRouter`, { e: embed.potongan, d: r.isi.disalin, sama, total: r.isi.total });
  cek(!db.documents.some((d) => d.id === lamaId) && db.documents.length === 1 && baru?.selesai === true,
    'versi lama dihapus; tinggal satu dokumen (versi baru, selesai)', db.documents);
  cek(isiBaru.length === r.isi.total && db.document_chunks.every((c) => c.document_id === r.isi.documentId),
    'potongan versi lama ikut terhapus; versi baru lengkap', { n: isiBaru.length, total: r.isi.total });
  cek(db.document_chunks.filter((c) => c.disalin).every((c) => Array.isArray(c.embedding)), 'vektor salinan benar-benar terisi');
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  const sebelum = JSON.stringify(db.documents);
  ulangEmbed();
  const r = await kirim(sb, v1, 'Buku.pdf', { perbarui: true });
  cek(r.status === 200 && r.isi.sama === true && r.isi.diperbarui === false && embed.panggilan === 0 && JSON.stringify(db.documents) === sebelum,
    'isi sama persis → "tidak ada yang diperbarui", 0 embedding, dokumen tak berubah', r.isi);
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  ulangEmbed();
  const r = await kirim(sb, v2);
  cek(r.isi.selesai === true && db.documents.length === 2 && !r.isi.diperbarui && embed.potongan === r.isi.total,
    'tanpa perbarui → dokumen kedua, tanpa salin & tanpa menghapus (klien lama tidak berubah)', { n: db.documents.length, isi: r.isi });
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  const lamaId = db.documents[0].id;
  const nLama = isiDok(db, lamaId).length;
  ulangEmbed({ gagalKe: 1 });
  const r1 = await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  const baru = db.documents.find((d) => d.id !== lamaId);
  cek(r1.isi.bisaDilanjutkan === true && r1.isi.tersimpan === 32 && baru?.selesai === false && baru?.menggantikan === lamaId && db.documents.find((d) => d.id === lamaId)?.selesai === true && isiDok(db, lamaId).length === nLama,
    'versi baru belum selesai mengingat versi lama; versi lama tetap utuh & selesai (masih dipakai chat)', { r1: r1.isi, baru });
  ulangEmbed();
  let r = { isi: { selesai: false } }; let n = 0;
  while (r.isi.selesai === false && n < 10) { r = await kirim(sb, v2); n++; }
  cek(r.isi.selesai === true && r.isi.diperbarui === true && !db.documents.some((d) => d.id === lamaId) && isiDok(db, r.isi.documentId).length === r.isi.total,
    'lanjutan (tanpa penanda) memakai `menggantikan` → versi lama dihapus di akhir', r.isi);
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  db.gagalRpcKe = (db.rpc || 0) + 4;
  ulangEmbed();
  const r1 = await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  const baru = db.documents.find((d) => d.id === r1.isi.documentId);
  cek(r1.status === 500 && r1.isi.tersimpan === 32 && isiDok(db, baru?.id).length === 32,
    'galat simpan kelompok ke-2 → tepat 32 potongan (kelompok utuh) tersimpan', { s: r1.status, i: r1.isi });
  db.gagalRpcKe = null;
  const r2 = await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  const isi2 = isiDok(db, r2.isi.documentId);
  cek(r2.isi.selesai === true && isi2.length === r2.isi.total && new Set(isi2).size === isi2.length,
    'lanjutan melengkapi tanpa ganda', { r2: r2.isi, n: isi2.length });
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  const lamaId = db.documents[0].id;
  ulangEmbed({ gagalKe: 1 });
  await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  db.documents = db.documents.filter((d) => d.id !== lamaId);
  db.document_chunks = db.document_chunks.filter((c) => c.document_id !== lamaId);
  db.documents.forEach((d) => { if (d.menggantikan === lamaId) d.menggantikan = null; });
  ulangEmbed();
  let r = { isi: { selesai: false } }; let n = 0;
  while (r.isi.selesai === false && n < 10) { r = await kirim(sb, v2); n++; }
  cek(r.isi.selesai === true && db.documents.length === 1 && isiDok(db, r.isi.documentId).length === r.isi.total,
    'versi lama hilang di tengah → versi baru tetap selesai (tanpa salin sisa)', r.isi);
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  db.rpcKurang = true;
  ulangEmbed();
  const r = await kirim(sb, v2, 'Buku.pdf', { perbarui: true });
  cek(r.status === 500 && r.isi.selesai !== true && /tersimpan 31 dari 32/.test(JSON.stringify(r.isi)),
    'jumlah tersimpan ≠ isi kelompok → 500, bukan "selesai"', { s: r.status, i: r.isi });
}
{
  const { db, sb } = dbTiruan();
  ulangEmbed();
  await kirim(sb, v1);
  db.documents.push({ id: 'dok-akun-lain', user_id: 'akun-2', title: 'Buku.pdf', space_id: 'ruang-1', selesai: true });
  Object.assign(db.documents[0], { selesai: false, menggantikan: 'dok-akun-lain' });
  ulangEmbed();
  const r = await kirim(sb, v1);
  cek(r.isi.selesai === true && db.documents.some((d) => d.id === 'dok-akun-lain') && /gagal dihapus/.test(r.isi.message),
    'penghapusan versi lama disaring pemilik: dokumen akun lain utuh, dilaporkan', { r: r.isi, dok: db.documents.map((d) => d.id) });
}

tulis('\n-- 2. embedding: rute penyedia & penolakan lokasi --');
const vu = await esbuild.build({
  entryPoints: [join(FN, 'agent-process/lib/vector_utils.ts')],
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
});
writeFileSync(join(dir, 'vu.mjs'), vu.outputFiles[0].text);
const V = await import(pathToFileURL(join(dir, 'vu.mjs')).href);
const fetchAsli = globalThis.fetch;
async function denganFetch(jawaban, kerja) {
  const kiriman = [];
  globalThis.fetch = async (url, opsi) => {
    kiriman.push(JSON.parse(opsi.body));
    const j = jawaban[Math.min(kiriman.length - 1, jawaban.length - 1)];
    return new Response(typeof j.isi === 'string' ? j.isi : JSON.stringify(j.isi), { status: j.status });
  };
  diam();
  try { return { hasil: await kerja(), kiriman }; } catch (e) { return { galat: e, kiriman }; } finally { globalThis.fetch = fetchAsli; bersuara(); }
}
const vektorOk = (n) => ({ status: 200, isi: { data: Array.from({ length: n }, (_, i) => ({ index: i, embedding: Array(V.EMBED_DIMENSI).fill(0) })) } });
const LOKASI = { status: 400, isi: '{"error":{"message":"HTTP 400: {\\n  \\"error\\": {\\n    \\"code\\": 400,\\n    \\"message\\": \\"User location is not supported for the API use.\\",\\n    \\"status\\": \\"FAILED_PRECONDITION\\"\\n  }\\n}\\n","code":400}}' };
{
  const r = await denganFetch([vektorOk(2)], () => V.embedLewatOpenRouter(['a', 'b'], 'k'));
  cek(r.hasil?.length === 2 && r.kiriman[0].provider === undefined && r.kiriman[0].model === V.EMBED_MODEL,
    'rute penyedia tidak dipaksa (vektor tetap dari rute yang sama dengan yang tersimpan)', r.kiriman[0]);
}
{
  const r = await denganFetch([LOKASI, vektorOk(1)], () => V.embedLewatOpenRouter(['a'], 'k'));
  cek(r.hasil?.length === 1 && r.kiriman.length === 2, '400 "User location is not supported" → dicoba lagi, lalu berhasil', { n: r.kiriman.length, g: r.galat?.message });
}
{
  const r = await denganFetch([{ status: 400, isi: '{"error":{"message":"invalid input"}}' }], () => V.embedLewatOpenRouter(['a'], 'k'));
  cek(r.galat && r.kiriman.length === 1, '400 lain (bukan lokasi) → tidak diulang', { n: r.kiriman.length });
}
cek(V.penolakanSesaat(503, '') && V.penolakanSesaat(429, '') && !V.penolakanSesaat(401, '') && !V.penolakanSesaat(402, '')
  && !V.penolakanSesaat(400, 'invalid') && V.penolakanSesaat(400, 'User location is not supported for the API use.'),
  'penolakanSesaat: 429/5xx/lokasi ya; 400 lain, 401, 402 tidak');

tulis('\n-- 3. klien: memanggil lagi sampai selesai, mengulang yang sesaat --');
const U = await import(pathToFileURL(join(SVC, 'unggahBertahap.js')).href);
const ok = (isi) => ({ data: isi, error: null });
const galatHttp = (status, isi) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => { if (isi === undefined) throw new Error('bukan JSON'); return isi; } } } });
async function jalankan(urutan) {
  let i = 0; const jeda = []; const kemajuan = [];
  try {
    const hasil = await U.unggahBertahap({
      panggil: async () => { const x = urutan[Math.min(i++, urutan.length - 1)]; if (x instanceof Error) throw x; return x; },
      onKemajuan: (k) => kemajuan.push(k),
      tunggu: async (ms) => { jeda.push(ms); },
    });
    return { hasil, panggilan: i, jeda, kemajuan };
  } catch (galat) { return { galat, panggilan: i, jeda, kemajuan }; }
}
{
  const r = await jalankan([ok({ success: true, selesai: false, tersimpan: 160, total: 400 }), ok({ success: true, selesai: false, tersimpan: 320, total: 400 }), ok({ success: true, selesai: true, tersimpan: 400, total: 400, documentId: 'd' })]);
  cek(r.hasil?.selesai === true && r.panggilan === 3 && r.kemajuan.map((k) => k.tersimpan).join() === '160,320,400', 'belum selesai → dipanggil lagi sampai selesai, kemajuan dilaporkan', r);
}
{
  const r = await jalankan([galatHttp(503), galatHttp(503), ok({ success: true, selesai: true, chunks: 12 })]);
  cek(r.hasil?.selesai === true && r.panggilan === 3 && r.jeda.join() === '2000,4000', '503 gerbang (body bukan JSON) → diulang dengan jeda 2 s, 4 s', r);
}
{
  const r = await jalankan([new TypeError('Failed to fetch'), ok({ success: true, selesai: true, chunks: 5 })]);
  cek(r.hasil?.selesai === true && r.panggilan === 2, 'jaringan putus (fetch melempar) → diulang', r);
}
{
  const r = await jalankan([galatHttp(502, { error: 'Proses terhenti setelah 64 dari 400 potongan — yang sudah tersimpan DISIMPAN; unggah berkas yang sama lagi untuk melanjutkan.', code: 'OPENROUTER_GAGAL', tersimpan: 64, total: 400, bisaDilanjutkan: true }), ok({ success: true, selesai: true, tersimpan: 400, total: 400 })]);
  cek(r.hasil?.selesai === true && r.panggilan === 2, '502 penolakan penyedia → diulang, server melanjutkan', r);
}
for (const [status, kode] of [[409, 'TERTUNDA_BERBEDA'], [401, 'KUNCI_TIDAK_VALID'], [402, 'SALDO_HABIS'], [413, 'KUOTA_AKUN_PENUH']]) {
  const r = await jalankan([galatHttp(status, { error: `pesan ${kode}`, code: kode })]);
  cek(r.galat instanceof U.GagalUnggah && r.panggilan === 1 && r.galat.status === status && r.galat.kode === kode && r.galat.message.startsWith(`pesan ${kode}`),
    `${status} ${kode} → berhenti tanpa mengulang, pesan dari body`, { p: r.panggilan, m: r.galat?.message });
}
{
  const r = await jalankan([ok({ success: true, selesai: false, tersimpan: 160, total: 400 }), galatHttp(503)]);
  cek(r.galat?.bisaDilanjutkan === true && r.panggilan === 1 + 1 + U.ULANG_MAKS && r.galat.tersimpan === 160 && /unggah berkas yang sama/i.test(r.galat.message),
    `503 terus-menerus → menyerah sesudah ${U.ULANG_MAKS} ulang, pesan menyuruh melanjutkan dengan berkas yang sama`, { p: r.panggilan, m: r.galat?.message });
}
{
  const r = await jalankan([ok({ success: true, selesai: false, tersimpan: 160, total: 400 })]);
  cek(r.galat?.kode === 'TIDAK_MAJU' && r.panggilan === 3, 'jawaban belum-selesai tanpa kemajuan → berhenti (tidak berputar selamanya)', { p: r.panggilan, k: r.galat?.kode });
}
{
  const r = await jalankan([galatHttp(503), ok({ success: true, selesai: false, tersimpan: 32, total: 400 }), galatHttp(503), ok({ success: true, selesai: true, tersimpan: 400, total: 400 })]);
  cek(r.hasil?.selesai === true && r.jeda.join() === '2000,2000', 'hitungan ulang direset sesudah ada kemajuan', r.jeda);
}
{
  const terkunci = galatHttp(423, { error: 'masih diproses', code: 'SEDANG_DIPROSES' });
  const r = await jalankan([terkunci, terkunci, ok({ success: true, selesai: true, tersimpan: 400, total: 400 })]);
  cek(r.hasil?.selesai === true && r.jeda.join() === `${U.JEDA_KUNCI_MS},${U.JEDA_KUNCI_MS}` && r.kemajuan.some((k) => k.menunggu === 2),
    '423 SEDANG_DIPROSES → menunggu 30 s per kali (bukan jeda 2 s), lalu lanjut', r);
  const r2 = await jalankan([terkunci]);
  cek(r2.galat?.kode === 'SEDANG_DIPROSES' && r2.panggilan === 1 + U.TUNGGU_KUNCI_MAKS,
    `423 terus-menerus → menyerah sesudah ${U.TUNGGU_KUNCI_MAKS} kali menunggu (lebih lama dari sewa kunci 130 s)`, { p: r2.panggilan });
  cek(U.JEDA_KUNCI_MS * U.TUNGGU_KUNCI_MAKS > 130_000, 'total waktu tunggu klien > sewa kunci server');
}

tulis('\n-- 4. cache OCR di perangkat --');
const C = await import(pathToFileURL(join(SVC, 'cacheOcr.js')).href);
function idbTiruan() {
  const data = new Map();
  const t = { data, tolak: false };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    transaction() {
      const tx = {};
      const selesai = () => setTimeout(() => tx.oncomplete?.());
      tx.objectStore = () => ({
        get(k) { const q = { result: data.get(k) }; selesai(); return q; },
        put(v, k) { data.set(k, v); selesai(); return {}; },
      });
      return tx;
    },
  };
  t.open = () => {
    const r = {};
    setTimeout(() => { if (t.tolak) { r.error = new Error('ditolak'); r.onerror?.(); } else { r.result = db; r.onsuccess?.(); } });
    return r;
  };
  return t;
}
{
  const idb = idbTiruan();
  const c = C.buatCacheOcr('abc', { idb });
  cek(await c.ambil(3) === undefined, 'cache kosong → tidak ada');
  await c.simpan(3, 'teks halaman 3');
  cek(await c.ambil(3) === 'teks halaman 3' && idb.data.has('abc:3'), 'simpan lalu ambil — kunci sidik:halaman');
  cek(await C.buatCacheOcr('lain', { idb }).ambil(3) === undefined, 'berkas lain (sidik lain) tidak berbagi cache');
  const mati = idbTiruan(); mati.tolak = true;
  diam();
  const cm = C.buatCacheOcr('abc', { idb: mati });
  const a = await cm.ambil(1); await cm.simpan(1, 'x');
  bersuara();
  cek(a === undefined, 'IndexedDB ditolak → bekerja tanpa cache, tidak melempar');
  cek(await C.buatCacheOcr('abc', { idb: undefined }).ambil(1) === undefined, 'tanpa IndexedDB sama sekali → tanpa cache');
  const s1 = await C.sidikBerkas(new TextEncoder().encode('isi'));
  cek(s1 === await C.sidikBerkas(new TextEncoder().encode('isi')) && s1 !== await C.sidikBerkas(new TextEncoder().encode('isi!')) && s1.length === 64,
    'sidik berkas SHA-256 stabil & membedakan isi');
}
{
  let pdfLib;
  try { pdfLib = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/pdf-lib/cjs/index.js')).href); } catch {  }
  if (!pdfLib) {
    tulis('(terapkanOcrHalaman + cache dilewati — pdf-lib belum terpasang)');
  } else {
    const ocr = await esbuild.build({
      entryPoints: [join(SVC, 'pdfOcrService.js')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
      nodePaths: [join(AKAR, 'frontend/node_modules')],
    });
    writeFileSync(join(dir, 'ocr.mjs'), ocr.outputFiles[0].text);
    const O = await import(pathToFileURL(join(dir, 'ocr.mjs')).href);
    const { PDFDocument } = pdfLib.default ?? pdfLib;
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage();
    const bytes = await doc.save();
    let kirim = 0; let gagalHalamanKedua = true;
    globalThis.fetch = async () => {
      kirim++;
      if (gagalHalamanKedua && kirim === 2) return new Response('{"error":"bad"}', { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { annotations: [{ file: { content: [{ type: 'text', text: `OCR-${kirim}` }] } }] } }] }), { status: 200 });
    };
    const idb = idbTiruan();
    const cache = C.buatCacheOcr(await C.sidikBerkas(bytes), { idb });
    diam();
    const r1 = await O.terapkanOcrHalaman(bytes, [1, 2, 3], 'k', null, { serentak: 1, cache });
    bersuara();
    cek(kirim === 3 && r1.peta.size === 2 && r1.halamanGagal.join() === '2' && r1.dariCache === 0 && idb.data.size === 2,
      'putaran 1: 3 halaman ke penyedia, 2 berhasil & masuk cache, halaman gagal tidak disimpan', { kirim, peta: [...r1.peta], gagal: r1.halamanGagal, cache: [...idb.data.keys()] });
    kirim = 0; gagalHalamanKedua = false;
    diam();
    const r2 = await O.terapkanOcrHalaman(bytes, [1, 2, 3], 'k', null, { serentak: 1, cache });
    bersuara();
    cek(kirim === 1 && r2.dariCache === 2 && r2.peta.get(1) === r1.peta.get(1) && r2.peta.get(3) === r1.peta.get(3),
      'putaran 2 (berkas sama): hanya halaman yang dulu gagal dikirim; sisanya dari cache, teks sama persis', { kirim, dariCache: r2.dariCache });
    kirim = 0;
    diam();
    await O.terapkanOcrHalaman(bytes, [1, 3], 'k', null, { serentak: 1 });
    bersuara();
    cek(kirim === 2, 'tanpa opsi cache → perilaku lama (semua halaman dikirim)', kirim);

    const doc6 = await PDFDocument.create();
    for (let i = 0; i < 6; i++) doc6.addPage();
    const bytes6 = await doc6.save();
    const idb6 = idbTiruan();
    const cache6 = C.buatCacheOcr(await C.sidikBerkas(bytes6), { idb: idb6 });
    await cache6.simpan(5, 'DARI-CACHE-5');
    kirim = 0;
    globalThis.fetch = async () => {
      kirim++;
      if (kirim >= 3) return new Response('{"error":{"message":"Insufficient credits","code":402}}', { status: 402 });
      return new Response(JSON.stringify({ choices: [{ message: { annotations: [{ file: { content: [{ type: 'text', text: `OCR-${kirim}` }] } }] } }] }), { status: 200 });
    };
    diam();
    const r4 = await O.terapkanOcrHalaman(bytes6, [1, 2, 3, 4, 5, 6], 'k', null, { serentak: 1, cache: cache6 });
    bersuara();
    cek(kirim === 3, 'halaman 3 kena 402 → tidak ada halaman lain yang dikirim (402 tidak dicoba ulang)', kirim);
    cek(Boolean(r4.saldoHabis) && r4.halamanBelum.join() === '3,4,6' && r4.halamanGagal.length === 0,
      'saldoHabis dilaporkan; halaman 3,4,6 = belum di-OCR (bukan "gagal")', { saldo: r4.saldoHabis, belum: r4.halamanBelum, gagal: r4.halamanGagal });
    cek(r4.peta.get(5) === 'DARI-CACHE-5' && r4.dariCache === 1 && r4.peta.get(1) === 'OCR-1' && r4.peta.get(2) === 'OCR-2' && r4.peta.size === 3,
      'sesudah berhenti, halaman yang ada di cache tetap dipakai (gratis)', [...r4.peta]);
    cek(!idb6.data.has(`${await C.sidikBerkas(bytes6)}:3`), 'halaman 402 tidak masuk cache');
    globalThis.fetch = fetchAsli;
  }
}

tulis('\n-- 5. pencarian chat menyaring dokumen belum selesai --');
const migrasi = readFileSync(join(AKAR, 'supabase/migrations/20261105000000_unggah_bertahap.sql'), 'utf8');
for (const fn of ['match_documents', 'match_documents_hybrid', 'match_documents_judul']) {
  const m = new RegExp(`create or replace function public\\.${fn}\\(([\\s\\S]*?)\\$function\\$;`, 'i').exec(migrasi);
  cek(m && /and d\.selesai\b/.test(m[1]), `${fn}: menyaring d.selesai`);
}
cek(/add column if not exists selesai boolean not null default true/i.test(migrasi), 'kolom selesai default true — dokumen lama tetap terbaca');
{
  const K = await import(pathToFileURL(join(AKAR, 'shared/KnowledgeService.js')).href);
  const catat = [];
  const sb = { from: (t) => { const p = { t, f: [] }; catat.push(p); const r = {
    select(s) { p.s = s; return r; }, or() { return r; }, eq(k, v) { p.f.push([k, v]); return r; }, in() { return r; }, not() { return r; },
    ilike() { return r; }, limit() { return r; },
    then(ok, nok) { return Promise.resolve({ data: [], error: null }).then(ok, nok); },
  }; return r; } };
  diam();
  await new K.KnowledgeService({ supabaseClient: sb }).queryKnowledge('pengalaman kerja pencegahan', { userId: 'u' }).catch(() => {});
  bersuara();
  const dok = catat.find((p) => p.t === 'documents');
  const isi = catat.find((p) => p.t === 'document_chunks');
  cek(dok?.f.some(([k, v]) => k === 'selesai' && v === true), 'cadangan pencocokan kata: judul hanya dari dokumen selesai', dok?.f);
  cek(isi?.f.some(([k, v]) => k === 'documents.selesai' && v === true) && /selesai/.test(isi?.s || ''), 'cadangan pencocokan kata: isi hanya dari dokumen selesai', isi);
}

tulis('\n-- 6. perbarui dokumen & saldo OCR habis: klien + migrasi --');
{
  const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
  const ra = baca('frontend/src/components/research/ResearchApp.jsx');
  const ml = baca('mametlite/src/App.jsx');
  cek(/diRuangIni = new Set\(\(judulAda \|\| \[\]\)\s*\.filter\(\(d\) => d\.selesai !== false && \(!selectedSpace \|\| d\.space_id === selectedSpace\)\)/.test(ra),
    'Ecosystem: kandidat perbarui = judul selesai di workspace yang dipilih');
  cek(/const perbarui = kembar\.length > 0 && window\.confirm\(/.test(ra), 'Ecosystem: perbarui hanya sesudah konfirmasi pengguna');
  cek(/if \(sudahAda\.has\(file\.name\) && !diperbarui\) \{ hasilAkhir\.dilewati\.push/.test(ra), 'Ecosystem: judul sama yang tak diperbarui tetap dilewati');
  cek(/\.\.\.\(item\.perbarui \? \{ perbarui: true \} : \{\}\)/.test(ra), 'Ecosystem: bendera perbarui dikirim hanya untuk berkas yang disetujui');
  cek(/if \(saldoHabis\) \{[\s\S]{0,900}?if \(!lanjutTanpaOcr\) \{\s*throw Object\.assign\([\s\S]{0,300}?\{ status: 402 \}\)/.test(ra),
    'Ecosystem: saldo OCR habis → ditanya; Batal melempar 402 (berkas berikutnya ikut berhenti)');
  cek(/err\.status === 402/.test(ra), 'Ecosystem: galat 402 menghentikan berkas berikutnya');
  cek(/\.\.\.\(existingDoc \? \{ perbarui: true \} : \{\}\)/.test(ml), 'Mametlite: menimpa dokumen = bendera perbarui');
  cek(/if \(existingDoc && !data\?\.diperbarui && !data\?\.sama && existingDoc\.id !== data\?\.documentId\)/.test(ml),
    'Mametlite: hapus versi lama di klien hanya bila server tidak memperbaruinya (sama → tak dihapus)');
  cek(/if \(saldoHabis && !window\.confirm\([\s\S]{0,600}?\)\) \{\s*throw new Error\('Dihentikan: saldo/.test(ml), 'Mametlite: saldo OCR habis → ditanya; Batal menghentikan');

  const sql = baca('supabase/migrations/20261105030000_perbarui_dokumen.sql');
  cek(/add column if not exists menggantikan uuid references public\.documents\(id\) on delete set null/.test(sql),
    'migrasi: menggantikan → documents(id) ON DELETE SET NULL (versi lama terhapus tak merusak versi baru)');
  for (const fn of ['potongan_lama_ada(uuid, uuid, text[])', 'simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text)']) {
    const e = fn.replace(/[()[\]]/g, '\\$&');
    cek(new RegExp(`revoke execute on function public\\.${e} from public, anon, authenticated;`).test(sql)
      && new RegExp(`grant execute on function public\\.${e} to service_role;`).test(sql), `migrasi: ${fn.split('(')[0]} hanya service_role (K5)`);
  }
  const simpan = /function public\.simpan_kelompok_perbarui\([\s\S]*?\$function\$;/.exec(sql)?.[0] || '';
  cek(/join documents l on l\.user_id = b\.user_id[\s\S]*?raise exception 'versi lama bukan milik/.test(simpan), 'migrasi: versi lama wajib milik pemilik versi baru');
  cek(/if n > 0 then\s*raise exception/.test(simpan) && simpan.indexOf('raise exception \'% potongan salinan') < simpan.indexOf('insert into document_chunks'),
    'migrasi: salinan yang hilang menolak SELURUH kelompok sebelum insert (atomik)');
  cek(/order by t\.urutan;\s*get diagnostics n = row_count;/.test(simpan), 'migrasi: urutan potongan dipertahankan, jumlah tersimpan dikembalikan');
  const ada = /function public\.potongan_lama_ada\([\s\S]*?\$function\$;/.exec(sql)?.[0] || '';
  cek(/join documents l on l\.user_id = b\.user_id/.test(ada) && /c\.embedding is not null/.test(ada), 'migrasi: potongan_lama_ada memeriksa pemilik & hanya potongan bervektor');
}

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);

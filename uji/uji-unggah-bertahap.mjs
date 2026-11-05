// UJI 2026-11-05 — K1 langkah 2: unggah dokumen besar bertahap (keputusan Owner: satu berkas mentah = satu dokumen;
// yang gagal di tengah jalan menjadi cache; dilanjutkan dengan berkas yang sama tanpa embedding ulang dari awal).
//
// Bukti nyata 5 Nov: buku umum Owner berhenti di 1.856/1.986 potongan sesudah 105 s (anggaran 110 s) dan seluruhnya
// dibuang; 385 changelog: 9× 503 gerbang Supabase, 1× penolakan lokasi Google, 1× karakter NUL.
//
// §1 rag-process DIBUNDEL SUNGGUHAN dengan database tiruan yang menyimpan isi + jam tiruan (anggaran 80 s per panggilan).
// §2 vector_utils sungguhan dengan fetch tiruan (rute penyedia, penolakan lokasi diulang).
// §3 unggahBertahap (klien) dengan panggilan tiruan. §4 cache OCR: IndexedDB tiruan + terapkanOcrHalaman dengan PDF
// sungguhan (pdf-lib) dan penyedia OCR tiruan. §5 pencarian: migrasi & KnowledgeService menyaring dokumen belum selesai.
// Semua tanpa jaringan & tanpa biaya; jalan di CI (butuh frontend/node_modules untuk esbuild & pdf-lib).

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
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* sudah bersih */ } });
const logAsli = { log: console.log, warn: console.warn, error: console.error };
const diam = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
const bersuara = () => Object.assign(console, logAsli);

// ── §1 rag-process ─────────────────────────────────────────────────────────────────────────────────
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

/** Database tiruan yang MENYIMPAN isi: documents & document_chunks (hapus dokumen = potongannya ikut). */
function dbTiruan({ milikLain = 0 } = {}) {
  const db = { documents: [], document_chunks: [], tulisan: [], gagalSisipKe: null, sisip: 0 };
  let nomor = 0;
  const cocok = (row, filter) => filter.every(([k, v]) => {
    if (k === 'documents.user_id') return db.documents.find((d) => d.id === row.document_id)?.user_id === v;
    return row[k] === v;
  });
  // `.or('diproses_sampai.is.null,diproses_sampai.lt.<iso>')` — satu-satunya bentuk yang dipakai rag-process.
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
        db.tulisan.push('documents.delete');
        return { data: null, error: null };
      }
      if (st.opsi?.head) {
        // 5 Nov live: HEAD document_chunks?document_id=… → 500 "statement timeout" (tanpa indeks document_id).
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
      or(ekspresi) { st.atau = ekspresi; return p; },
      order() { return p; },
      limit() { return p; },
      maybeSingle() { return Promise.resolve(selesaikan()); },
      single() { return Promise.resolve(selesaikan()); },
      then(ok, nok) { return Promise.resolve(selesaikan()).then(ok, nok); },
    };
    return p;
  };
  return { db, sb: { auth: { getUser: async () => ({ data: { user: { id: 'akun-1' } }, error: null }) }, from } };
}

// Jam tiruan: setiap panggilan embedding memakan `langkahMs`.
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

async function kirim(sb, isi, judul = 'Buku.pdf') {
  globalThis.__sb = sb;
  const req = new Request('https://x.supabase.co/functions/v1/rag-process', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'x-byok-openrouter': 'sk-or-x', 'content-type': 'application/json' },
    body: JSON.stringify({ title: judul, text: isi, spaceId: 'ruang-1' }),
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
  const harap = isi; // potongan disimpan berurutan → gabungan awal tiap potongan = urutan paragraf
  const nomor = db.document_chunks.map((c) => Number(/Paragraf (\d+)\./.exec(c.content)?.[1] ?? -1));
  return nomor.every((n, i) => i === 0 || n >= nomor[i - 1]) && harap.length > 0;
};

{ // a. dokumen kecil: satu panggilan, langsung selesai
  const { db, sb } = dbTiruan();
  ulangEmbed();
  const r = await kirim(sb, teks(12));
  cek(r.status === 200 && r.isi.selesai === true && r.isi.tersimpan === r.isi.total, 'dokumen kecil → satu panggilan, selesai', r.isi);
  cek(db.documents.length === 1 && db.documents[0].selesai === true && db.document_chunks.length === r.isi.total,
    'dokumen dibuat belum-selesai lalu ditandai selesai; semua potongan tersimpan', db.documents);
  cek(typeof db.documents[0].sidik === 'string' && db.documents[0].sidik.length === 64 && db.documents[0].total_potongan === r.isi.total,
    'sidik SHA-256 & total potongan disimpan di dokumen');
}

{ // b. dokumen besar: berhenti di anggaran, dilanjutkan tanpa embedding ulang
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ langkahMs: 20_000 }); // 20 s per kelompok → ±5 kelompok per panggilan (anggaran 80 s)
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

{ // c. gagal di tengah → sisa tetap tersimpan sebagai cache, dilanjutkan dari situ
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

{ // d. gagal sebelum satu pun tersimpan → dokumen baru dibatalkan (tak ada cache yang berarti)
  const { db, sb } = dbTiruan();
  ulangEmbed({ gagalKe: 1 });
  const r = await kirim(sb, teks(80));
  cek(r.status === 502 && r.isi.bisaDilanjutkan === false && db.documents.length === 0 && db.document_chunks.length === 0,
    'gagal di kelompok pertama → dokumen dibatalkan, tanpa sisa', { isi: r.isi, dok: db.documents });
}

{ // e. isi berbeda dengan judul tertunda → ditolak, tidak disambung
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

{ // f. aturan pemotongan berubah (total_potongan beda) → ditolak; potongan tersimpan > isi → ditolak
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

{ // g. karakter NUL dibuang (5 Nov: changelog UTF-16 campuran)
  const { db, sb } = dbTiruan();
  ulangEmbed();
  const r = await kirim(sb, teks(5) + '\n\n\u0000#\u0000#\u0000 \u00007\u0000.' + teks(5, 'Akhir'));
  cek(r.status === 200 && r.isi.selesai === true && db.document_chunks.every((c) => !c.content.includes('\u0000')),
    'teks ber-NUL tersimpan utuh tanpa NUL (dulu: DB Insert Error)', r.isi);
}

{ // h. galat simpan di tengah → yang sudah tersimpan dipertahankan
  const { db, sb } = dbTiruan();
  ulangEmbed();
  db.gagalSisipKe = 2;
  const r = await kirim(sb, teks(120));
  cek(r.status === 500 && r.isi.bisaDilanjutkan === true && r.isi.tersimpan === 32 && db.documents.length === 1,
    'galat simpan kelompok ke-2 → 32 potongan dipertahankan', r.isi);
}

{ // i. batas volume menghitung HANYA potongan yang belum tersimpan
  const { db, sb } = dbTiruan({ milikLain: BATAS_AKUN - 100 });
  const isi = teks(220);
  ulangEmbed({ gagalKe: 4 });
  const r1 = await kirim(sb, isi);
  cek(r1.status === 413 && r1.isi.code === 'KUOTA_AKUN_PENUH', `akun ${BATAS_AKUN - 100} + buku penuh → ditolak sebelum embedding`, r1.isi);
  // Simulasikan unggahan lama yang sudah sebagian tersimpan: 160 potongan, sisa kecil. Dihitung penuh, buku ini
  // melewati batas (BATAS − 300 + 160 + 220); dihitung dari sisanya tidak (BATAS − 300 + 160 + 60).
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
{ // kunci dipegang selama embedding, dilepas sesudah jeda anggaran & sesudah selesai
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
{ // panggilan lama masih memegang kunci → panggilan baru ditolak sementara, tanpa embedding & tanpa tulisan
  const { db, sb } = dbTiruan();
  const isi = teks(220);
  ulangEmbed({ gagalKe: 3 });
  await kirim(sb, isi);
  cek(db.documents[0].diproses_sampai === null, 'gagal di tengah → kunci dilepas (dokumen tetap ada)', db.documents[0]);
  db.documents[0].diproses_sampai = iso(jam + 60_000); // panggilan lain sedang berjalan
  const sebelum = db.document_chunks.length;
  ulangEmbed();
  const r = await kirim(sb, isi);
  cek(r.status === 423 && r.isi.code === 'SEDANG_DIPROSES' && embed.panggilan === 0 && db.document_chunks.length === sebelum,
    'masih terkunci → 423 SEDANG_DIPROSES, tanpa embedding, tanpa potongan ganda', { s: r.status, i: r.isi, e: embed.panggilan });
  cek(db.documents[0].diproses_sampai === iso(jam + 60_000), 'kunci milik panggilan lain tidak dilepas oleh yang ditolak');
  db.documents[0].diproses_sampai = iso(jam - 1); // kedaluwarsa (fungsi lama dihentikan platform)
  const r2 = await kirim(sb, isi);
  cek(r2.isi.selesai === true && db.document_chunks.length === r2.isi.total && new Set(db.document_chunks.map((c) => c.content)).size === r2.isi.total,
    'kunci kedaluwarsa → diambil alih, dilanjutkan tanpa potongan ganda', r2.isi);
}
{ // ditolak sesudah memegang kunci (tersimpan > isi) → kunci tetap dilepas
  const { db, sb } = dbTiruan();
  const isi = teks(120);
  ulangEmbed({ gagalKe: 2 });
  await kirim(sb, isi);
  db.document_chunks.push(...Array.from({ length: 500 }, () => ({ document_id: db.documents[0].id, content: 'x' })));
  ulangEmbed();
  const r = await kirim(sb, isi);
  cek(r.isi.code === 'TERTUNDA_TAK_KONSISTEN' && db.documents[0].diproses_sampai === null, '409 sesudah mengambil kunci → kunci dilepas', db.documents[0]);
}
{ // hitungan potongan gagal saat melanjutkan (5 Nov: statement timeout) → pesan jujur, kunci dilepas, dokumen tetap
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
{ // dokumen baru langsung terkunci sejak dibuat
  const { db, sb } = dbTiruan();
  ulangEmbed();
  let kunciAwal = null;
  globalThis.__saatEmbed = () => { kunciAwal ??= db.documents[0]?.diproses_sampai; };
  await kirim(sb, teks(40));
  globalThis.__saatEmbed = null;
  cek(typeof kunciAwal === 'string' && db.documents[0].diproses_sampai === null, 'dokumen baru dibuat sudah terkunci; dilepas sesudah selesai', kunciAwal);
}

// ── §2 vector_utils ────────────────────────────────────────────────────────────────────────────────
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
  // Diukur 5 Nov: google-vertex 404 untuk akun Owner; vektor tersimpan identik dengan google-ai-studio (1,0000 pada 8/8).
  // Memaksa rute lain = vektor yang belum terbukti sebanding → rute tidak diatur.
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

// ── §3 unggahBertahap (klien) ──────────────────────────────────────────────────────────────────────
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

// ── §4 cache OCR ───────────────────────────────────────────────────────────────────────────────────
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
  try { pdfLib = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/pdf-lib/cjs/index.js')).href); } catch { /* lihat di bawah */ }
  if (!pdfLib) {
    tulis('(terapkanOcrHalaman + cache dilewati — pdf-lib belum terpasang)');
  } else {
    // Vite memetakan import('pdf-lib') di aplikasi; di Node modul ini dibundel dengan pdf-lib dari frontend/node_modules.
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
    globalThis.fetch = fetchAsli;
  }
}

// ── §5 pencarian tidak membaca dokumen belum selesai ───────────────────────────────────────────────
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
  // Seperti supabase-js: setiap metode mengembalikan builder yang bisa disambung (juga sesudah limit) dan di-await.
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

tulis(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);


import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dirUji = mkdtempSync(join(tmpdir(), 'uji-cari-judul-'));
const sumber = readFileSync(join(AKAR, 'supabase/functions/agent-process/lib/rag/cari_judul.ts'), 'utf8');
const { code } = await esbuild.transform(sumber, { loader: 'ts', format: 'esm' });
writeFileSync(join(dirUji, 'cj.mjs'), code);
const C = await import(pathToFileURL(join(dirUji, 'cj.mjs')).href);
process.on('exit', () => { try { rmSync(dirUji, { recursive: true, force: true }); } catch {  } });

console.log('uji-cari-judul v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const isi = (n) => Array.from({ length: n }, (_, i) => ({ id: `isi${i}`, document_id: `dok${i}`, content: `isi ${i}` }));
const judul = (n, dok = 'kepbup204') => Array.from({ length: n }, (_, i) => ({ id: `jud${i}`, document_id: dok, title: 'Kepbup OKU 2025 - 204', content: `judul ${i}` }));

console.log('\n-- disisipkan di depan --');

let g = C.gabungkan(isi(8), judul(1), 8);
cek(g.disisipkan === 1, 'potongan judul disisipkan', g.disisipkan);
cek(g.hasil[0].id === 'jud0', 'ia berada di DEPAN — kalau di belakang, ia yang pertama terpotong saat konteks dipangkas');
cek(g.hasil.length === 8, 'panjang hasil TIDAK bertambah — anggaran konteks & biaya tidak berubah diam-diam', g.hasil.length);
cek(!g.hasil.some((p) => p.id === 'isi7'), 'yang terdorong keluar adalah potongan isi PALING BAWAH');

console.log('\n-- tidak menggandakan --');

const sudahAda = [{ id: 'isiA', document_id: 'kepbup204', content: 'sudah ketemu' }, ...isi(5)];
g = C.gabungkan(sudahAda, judul(3), 8);
cek(g.disisipkan === 0, 'dokumen yang SUDAH ada di hasil isi tidak disisipkan lagi', g);
cek(g.hasil === sudahAda, 'hasilnya dikembalikan apa adanya, tanpa disalin ulang');

g = C.gabungkan([{ id: 'jud0', document_id: 'lain', content: 'x' }], judul(2), 8);
cek(g.hasil.filter((p) => p.id === 'jud0').length === 1, 'potongan dengan id sama tidak dobel', g.hasil.map((p) => p.id));
cek(g.disisipkan === 1, 'yang disisipkan hanya potongan yang id-nya belum ada', g.disisipkan);

console.log('\n-- batas 3 potongan --');

g = C.gabungkan(isi(8), judul(14), 8);
cek(g.disisipkan === 3, 'paling banyak 3 potongan judul walau dokumennya punya 14', g.disisipkan);
cek(C.MAKS_POTONGAN_JUDUL === 3, 'batasnya satu angka bernama, bukan tersebar di kode');
cek(g.hasil.filter((p) => p.id.startsWith('isi')).length === 5, 'masih menyisakan 5 potongan hasil pencarian isi', g.hasil.map((p) => p.id));

console.log('\n-- tanpa hasil judul --');

const asli = isi(8);
for (const kosong of [[], null, undefined]) {
  const r = C.gabungkan(asli, kosong, 8);
  cek(r.hasil === asli && r.disisipkan === 0, `judul kosong (${JSON.stringify(kosong)}) → hasil isi apa adanya`);
}
cek(C.gabungkan(null, judul(1), 8).hasil.length === 1, 'hasil isi kosong pun tetap bisa disisipi');
cek(C.gabungkan([], [], 8).hasil.length === 0, 'dua-duanya kosong → kosong, bukan galat');

for (const b of [0, -3, NaN, undefined]) {
  const r = C.gabungkan(isi(4), judul(1), b);
  cek(r.hasil.length === 5, `batas tak sah (${String(b)}) → tidak membuang hasil`, r.hasil.length);
}

console.log('\n-- terpasang di document_search --');

const DS = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/rag/document_search.ts`, 'utf8');
cek(/import \{[^}]*\bgabungkan\b[^}]*\} from '\.\/cari_judul\.ts'/.test(DS)
  && /import \{[^}]*\bMAKS_POTONGAN_JUDUL\b[^}]*\} from '\.\/cari_judul\.ts'/.test(DS),
  'gabungkan & MAKS_POTONGAN_JUDUL diimpor dari cari_judul');
cek(/rpc\('match_documents_judul'/.test(DS), 'RPC judul dipanggil');
cek(/gabungkan\(matchedDocs \|\| \[\], lewatJudul, effectiveRagMatchCount\)/.test(DS),
  'hasilnya digabung dengan batas jumlah potongan yang SAMA seperti sebelumnya');

const iJudul = DS.indexOf("rpc('match_documents_judul'");
const sebelum = DS.slice(0, iJudul);
const sesudah = DS.slice(iJudul);
const iTry = sebelum.lastIndexOf('try {');
const iCatch = sesudah.indexOf('} catch');
cek(iJudul > 0, 'panggilan RPC judul ditemukan di berkas');
cek(iTry > 0 && iCatch > 0,
  'dibungkus try/catch — pencarian biasa tetap jalan bila jalur judul galat',
  { adaTry: iTry > 0, adaCatch: iCatch > 0 });
cek(iTry > 0 && !sebelum.slice(iTry).includes('} catch'),
  'try yang ditemukan memang membungkus panggilan ini, bukan blok lain yang sudah ditutup');
cek(/console\.warn\(`\[RAG\] pencarian judul dilewati/.test(DS), 'galatnya bersuara di log, tidak diam');

cek(/rpc\('match_documents_hybrid', \{\s*\.\.\.argumenDasar,\s*query_words: kataKunci\s*\}\)/.test(DS),
  'panggilan match_documents_hybrid tetap apa adanya — patokan 14/14 tidak digeser');

console.log('\n-- aturan SQL dipaku di migrasi --');

const MIG = readFileSync(`${AKAR}/supabase/migrations/20261001010000_cari_judul_minimal_dua_kata.sql`, 'utf8');
cek(/where cocok >= 2/.test(MIG), 'syaratnya MINIMAL DUA kata cocok, bukan semua kata');
cek(/array_length\(kata\.arr, 1\) >= 2/.test(MIG), 'kueri berkata tunggal ditolak — 221 judul semuanya memuat "kepbup"');
cek(/order by t\.cocok desc/.test(MIG), 'yang paling banyak cocok berada di depan saat match_count memotong');
cek(/"apa isi Kepbup 204"/.test(MIG) || /isi kepbup 204/.test(MIG),
  'migrasi mencatat pertanyaan live yang membuktikan cacatnya — bukan hanya aturan barunya');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

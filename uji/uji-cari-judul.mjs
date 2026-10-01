// UJI 2026-10-01 — dokumen bisa ditemukan lewat JUDULNYA (nomor Kepbup).
//
// DIUKUR SENDIRI di database produksi, bukan dikutip dari dokumen lain:
//   221 dokumen Kepbup · 3.629 potongan · kata "kepbup" muncul di 0 potongan
//   221 dari 221 dokumen TIDAK memuat nomornya sendiri di teks terindeks
//   contoh: "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf" — 14 potongan, 0 memuat "204"
//
// Jadi menemukan dokumen lewat nomornya bukan "sulit" — ia MUSTAHIL. Dan RRF tidak bisa menolong
// berapa pun bobotnya, karena `match_documents_hybrid` menyaring dengan `similarity > threshold` pada
// kemiripan VEKTOR: potongannya dibuang sebelum peringkat kata sempat berperan.
//
// Yang diuji di sini adalah penggabungnya. Fungsi SQL-nya diuji langsung di database (hasilnya ditulis
// di changelog): "kepbup 204" → tepat 1 dokumen yang benar; "pangkat camat lengkiti" → 0, jadi ia
// tidak merebut pertanyaan biasa.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';

// Modul server ditulis TypeScript untuk Deno. Tipe dibuang supaya bisa diimpor node biasa — yang
// diuji logikanya, dan logika itu tidak berubah oleh anotasi tipe.
// Akhir baris diseragamkan ke LF lebih dulu. Tanpa ini, regex di bawah mencari "\n}\n" sementara
// berkas di direktori kerja ber-CRLF ("\r\n}\r\n") — antarmuka TypeScript-nya tidak terbuang dan
// modulnya gagal dimuat. Persis jebakan CRLF yang dijaga `scripts/samakan-crlf.mjs`, kali ini
// menggigit berkas ujinya sendiri. Yang diubah hanya salinan di memori.
const TS = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/rag/cari_judul.ts`, 'utf8').replace(/\r\n/g, '\n');
const js = TS
  .replace(/export interface [\s\S]*?\n\}\n/g, '')
  .replace(/:\s*\{ hasil: PotonganRag\[\]; disisipkan: number \}/g, '')
  .replace(/dariIsi: PotonganRag\[\],/g, 'dariIsi,')
  .replace(/dariJudul: PotonganRag\[\],/g, 'dariJudul,')
  .replace(/batas: number,/g, 'batas,')
  .replace(/const sisipan: PotonganRag\[\] = \[\];/g, 'const sisipan = [];');
const C = await import('data:text/javascript;base64,' + Buffer.from(js, 'utf8').toString('base64'));

console.log('uji-cari-judul v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const isi = (n) => Array.from({ length: n }, (_, i) => ({ id: `isi${i}`, document_id: `dok${i}`, content: `isi ${i}` }));
const judul = (n, dok = 'kepbup204') => Array.from({ length: n }, (_, i) => ({ id: `jud${i}`, document_id: dok, title: 'Kepbup OKU 2025 - 204', content: `judul ${i}` }));

// ── 1. Disisipkan di DEPAN ───────────────────────────────────────────────────────────────────
console.log('\n-- disisipkan di depan --');

let g = C.gabungkan(isi(8), judul(1), 8);
cek(g.disisipkan === 1, 'potongan judul disisipkan', g.disisipkan);
cek(g.hasil[0].id === 'jud0', 'ia berada di DEPAN — kalau di belakang, ia yang pertama terpotong saat konteks dipangkas');
cek(g.hasil.length === 8, 'panjang hasil TIDAK bertambah — anggaran konteks & biaya tidak berubah diam-diam', g.hasil.length);
cek(!g.hasil.some((p) => p.id === 'isi7'), 'yang terdorong keluar adalah potongan isi PALING BAWAH');

// ── 2. Tidak menggandakan dokumen yang sudah ketemu ──────────────────────────────────────────
console.log('\n-- tidak menggandakan --');

const sudahAda = [{ id: 'isiA', document_id: 'kepbup204', content: 'sudah ketemu' }, ...isi(5)];
g = C.gabungkan(sudahAda, judul(3), 8);
cek(g.disisipkan === 0, 'dokumen yang SUDAH ada di hasil isi tidak disisipkan lagi', g);
cek(g.hasil === sudahAda, 'hasilnya dikembalikan apa adanya, tanpa disalin ulang');

// Versi pertama asersi ini ditulis `!x.length > 1`, yang dibaca `(!x.length) > 1` — selalu false,
// jadi ia merah walau kodenya benar. Ditulis ulang sebagai perbandingan yang eksplisit.
g = C.gabungkan([{ id: 'jud0', document_id: 'lain', content: 'x' }], judul(2), 8);
cek(g.hasil.filter((p) => p.id === 'jud0').length === 1, 'potongan dengan id sama tidak dobel', g.hasil.map((p) => p.id));
cek(g.disisipkan === 1, 'yang disisipkan hanya potongan yang id-nya belum ada', g.disisipkan);

// ── 3. Batas 3 potongan ──────────────────────────────────────────────────────────────────────
// Satu dokumen Kepbup punya ±14 potongan. Tanpa batas, ia mengusir seluruh hasil pencarian isi —
// menukar satu kegagalan dengan kegagalan lain.
console.log('\n-- batas 3 potongan --');

g = C.gabungkan(isi(8), judul(14), 8);
cek(g.disisipkan === 3, 'paling banyak 3 potongan judul walau dokumennya punya 14', g.disisipkan);
cek(C.MAKS_POTONGAN_JUDUL === 3, 'batasnya satu angka bernama, bukan tersebar di kode');
cek(g.hasil.filter((p) => p.id.startsWith('isi')).length === 5, 'masih menyisakan 5 potongan hasil pencarian isi', g.hasil.map((p) => p.id));

// ── 4. Tidak merusak apa pun saat tak ada yang cocok ─────────────────────────────────────────
console.log('\n-- tanpa hasil judul --');

const asli = isi(8);
for (const kosong of [[], null, undefined]) {
  const r = C.gabungkan(asli, kosong, 8);
  cek(r.hasil === asli && r.disisipkan === 0, `judul kosong (${JSON.stringify(kosong)}) → hasil isi apa adanya`);
}
cek(C.gabungkan(null, judul(1), 8).hasil.length === 1, 'hasil isi kosong pun tetap bisa disisipi');
cek(C.gabungkan([], [], 8).hasil.length === 0, 'dua-duanya kosong → kosong, bukan galat');

// Batas tak masuk akal tidak boleh menghapus hasil.
for (const b of [0, -3, NaN, undefined]) {
  const r = C.gabungkan(isi(4), judul(1), b);
  cek(r.hasil.length === 5, `batas tak sah (${String(b)}) → tidak membuang hasil`, r.hasil.length);
}

// ── 5. Terpasang di jalur pencarian ──────────────────────────────────────────────────────────
console.log('\n-- terpasang di document_search --');

const DS = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/rag/document_search.ts`, 'utf8');
cek(/import \{ gabungkan, MAKS_POTONGAN_JUDUL \} from '\.\/cari_judul\.ts'/.test(DS), 'modul diimpor');
cek(/rpc\('match_documents_judul'/.test(DS), 'RPC judul dipanggil');
cek(/gabungkan\(matchedDocs \|\| \[\], lewatJudul, effectiveRagMatchCount\)/.test(DS),
  'hasilnya digabung dengan batas jumlah potongan yang SAMA seperti sebelumnya');

// Kegagalan jalur baru tidak boleh menggagalkan pencarian biasa.
const iJudul = DS.indexOf("rpc('match_documents_judul'");
const blok = DS.slice(iJudul - 400, iJudul + 900);
cek(/try \{/.test(blok) && /\} catch \(e\)/.test(blok), 'dibungkus try/catch — pencarian biasa tetap jalan bila jalur judul galat', blok.slice(-200));
cek(/console\.warn\(`\[RAG\] pencarian judul dilewati/.test(DS), 'galatnya bersuara di log, tidak diam');

// Fungsi hibrida TIDAK boleh ikut berubah — ia memegang patokan 14/14.
cek(/rpc\('match_documents_hybrid', \{\s*\.\.\.argumenDasar,\s*query_words: kataKunci\s*\}\)/.test(DS),
  'panggilan match_documents_hybrid tetap apa adanya — patokan 14/14 tidak digeser');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

// UJI 2026-11-05 — Research App: pilih banyak dokumen lalu hapus (permintaan Owner), dan daftar yang tak lagi berlomba.
//
// Owner menghapus 221 Kepbup pecahan lewat SQL Editor karena tombol hapus hanya satu per satu. Sebelum fitur ini
// dipasang, temuan yang sama hari itu harus ditutup: sesudah muat ulang, daftar "random test" sempat memuat dokumen
// SEMUA workspace (dua pemuatan berlomba) — "pilih semua → hapus" pada daftar seperti itu menghapus dokumen workspace lain.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = await import(pathToFileURL(path.join(AKAR, 'frontend/src/core/runtime/services/hapusDokumen.js')).href);

console.log('uji-hapus-dokumen-banyak v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

/** Supabase tiruan yang menyimpan isi; mencatat urutan operasi. Galat bisa disuntik pada operasi ke-n. */
function sbTiruan({ dokumen, potongan, galatPada = null }) {
  const db = { dokumen: [...dokumen], potongan: [...potongan], log: [] };
  let operasi = 0;
  const from = (tabel) => {
    const st = { tabel, ids: null, kolom: null, pilih: false };
    const jalankan = () => {
      operasi++;
      db.log.push(`${tabel}:${st.ids.length}`);
      if (galatPada === operasi) return { data: null, error: { message: `galat ${tabel}` } };
      if (tabel === 'document_chunks') {
        db.potongan = db.potongan.filter((c) => !st.ids.includes(c.document_id));
        return { data: null, error: null };
      }
      const kena = db.dokumen.filter((d) => st.ids.includes(d.id));
      db.dokumen = db.dokumen.filter((d) => !st.ids.includes(d.id));
      return { data: st.pilih ? kena.map((d) => ({ id: d.id })) : null, error: null };
    };
    const p = {
      delete() { return p; },
      in(kolom, ids) { st.kolom = kolom; st.ids = ids; return p; },
      select() { st.pilih = true; return p; },
      then(ok, nok) { return Promise.resolve(jalankan()).then(ok, nok); },
    };
    return p;
  };
  return { db, sb: { from } };
}
const buatData = (n) => ({
  dokumen: Array.from({ length: n }, (_, i) => ({ id: `d${i}` })),
  potongan: Array.from({ length: n * 3 }, (_, i) => ({ id: `c${i}`, document_id: `d${i % n}` })),
});

// ── 1. hapusDokumenBanyak ─────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. hapusDokumenBanyak --');
{
  const { db, sb } = sbTiruan(buatData(60));
  const pilih = Array.from({ length: 45 }, (_, i) => `d${i}`);
  const kemajuan = [];
  const h = await H.hapusDokumenBanyak(sb, pilih, { onKemajuan: (k) => kemajuan.push(k.selesai) });
  cek(h.dihapus.length === 45 && h.tidakDitemukan.length === 0 && h.gagal === null, '45 dokumen terpilih terhapus', h);
  cek(db.dokumen.length === 15 && db.dokumen.every((d) => !pilih.includes(d.id)), 'dokumen yang tidak dipilih tetap ada (15)', db.dokumen.length);
  cek(db.potongan.length === 45 && db.potongan.every((c) => !pilih.includes(c.document_id)), 'potongan dokumen terpilih ikut terhapus, potongan lain utuh');
  cek(db.log.join() === 'document_chunks:20,documents:20,document_chunks:20,documents:20,document_chunks:5,documents:5',
    `berkelompok ${H.UKURAN_KELOMPOK_HAPUS}; tiap kelompok potongan dulu, lalu dokumen`, db.log);
  cek(kemajuan.join() === '20,40,45', 'kemajuan dilaporkan per kelompok', kemajuan);
}
{
  const { db, sb } = sbTiruan(buatData(5));
  const h = await H.hapusDokumenBanyak(sb, ['d1', 'd1', '', null, 'd2', 'hilang']);
  cek(h.dihapus.join() === 'd1,d2' && h.tidakDitemukan.join() === 'hilang' && db.log.length === 2,
    'id ganda & kosong dibuang; id yang sudah tak ada dilaporkan "tidak ditemukan"', h);
}
{
  const { db, sb } = sbTiruan(buatData(50));
  const pilih = Array.from({ length: 50 }, (_, i) => `d${i}`);
  const h = await H.hapusDokumenBanyak(sb, pilih, {}).then((x) => x);
  void h;
  const { db: db2, sb: sb2 } = sbTiruan({ ...buatData(50), galatPada: 4 }); // operasi ke-4 = dokumen kelompok ke-2
  const h2 = await H.hapusDokumenBanyak(sb2, pilih);
  cek(h2.gagal && h2.dihapus.length === 20 && h2.gagal.belumDiproses.length === 30 && /galat documents/.test(h2.gagal.pesan),
    'galat di kelompok ke-2 → berhenti; laporan jujur: 20 terhapus, 30 belum diproses', h2);
  cek(db2.dokumen.length === 30 && db2.log.length === 4, 'kelompok ke-3 tidak disentuh sesudah galat', { sisa: db2.dokumen.length, log: db2.log });
  void db;
}
{
  const { sb } = sbTiruan({ ...buatData(5), galatPada: 1 });
  const h = await H.hapusDokumenBanyak(sb, ['d0', 'd1']);
  cek(h.gagal && h.dihapus.length === 0 && h.gagal.belumDiproses.join() === 'd0,d1', 'galat menghapus potongan → dokumen tidak disentuh', h);
}

// ── 2. penjaga jawaban terbaru ────────────────────────────────────────────────────────────────────
console.log('\n-- 2. daftar tak lagi berlomba --');
{
  const p = H.buatPenjagaTerbaru();
  const lama = p.mulai(); // pemuatan tanpa saringan (pilihan workspace belum pulih)
  const baru = p.mulai(); // pemuatan dengan saringan
  cek(p.masihTerbaru(baru) && !p.masihTerbaru(lama), 'jawaban pemuatan lama yang datang belakangan dibuang');
}
{
  const A = H.buatPenjagaTerbaru(); const B = H.buatPenjagaTerbaru();
  const a = A.mulai(); B.mulai(); B.mulai();
  cek(A.masihTerbaru(a), 'tiap penjaga berdiri sendiri');
}
cek(H.ringkasRuang([{ space_id: 's1' }, { space_id: 's1' }, { space_id: 's2' }, { space_id: 'x' }], [{ id: 's1', name: 'kepbup oku' }, { id: 's2', name: 'random test' }])
  === 'kepbup oku (2), random test (1), (tanpa workspace) (1)', 'konfirmasi menyebut asal workspace tiap dokumen');

// ── 3. sambungan di Research App ──────────────────────────────────────────────────────────────────
console.log('\n-- 3. Research App --');
// Akhir baris diseragamkan: checkout GitHub ber-CRLF (J3c) — pola `\n` di bawah gagal di CI walau lulus di laptop
// (5 Nov, run 42057388216).
const bacaLF = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const RA = bacaLF(path.join(AKAR, 'frontend/src/components/research/ResearchApp.jsx'));
const BILAH = bacaLF(path.join(AKAR, 'frontend/src/components/research/BilahPilihDokumen.jsx'));
const muat = RA.slice(RA.indexOf('const loadDocuments'), RA.indexOf('useEffect(() => {\n        loadSpaces();'));
cek(/const nomor = penjagaDaftar\.current\.mulai\(\);/.test(muat) && muat.indexOf('masihTerbaru(nomor)') > -1
  && muat.indexOf('masihTerbaru(nomor)') < muat.indexOf('setDocuments('), 'loadDocuments membuang jawaban usang SEBELUM mengisi daftar');
cek(/setPilihan\(new Set\(\)\);[^\n]*\n\s*loadDocuments\(\);\n\s*\}, \[selectedSpace, searchQuery\]\)/.test(RA), 'pilihan dikosongkan saat workspace / pencarian berganti');
cek(/const target = documents\.filter\(\(d\) => pilihan\.has\(d\.id\)\)/.test(RA), 'yang dihapus hanya dokumen yang tampil DAN dipilih');
cek(/window\.confirm\([\s\S]{0,300}ringkasRuang\(target, knowledgeSpaces\)[\s\S]{0,120}Tidak bisa dibatalkan/.test(RA), 'konfirmasi: jumlah, asal workspace, "Tidak bisa dibatalkan"');
cek(/hapusDokumenBanyak\(supabase, target\.map/.test(RA) && /finally \{\s*setStatusHapusBanyak\(''\);\s*setPilihan\(new Set\(\)\);\s*loadDocuments\(\);/.test(RA),
  'sesudah hapus (berhasil atau gagal): status kosong, pilihan dikosongkan, daftar dimuat ulang');
cek(/type="checkbox"\s*\n\s*checked=\{pilihan\.has\(doc\.id\)\}/.test(RA) && /<BilahPilihDokumen/.test(RA), 'tiap baris punya kotak centang; bilah pilih tampil di atas daftar');

// ── 4. kelas Tailwind benar-benar dibuat ──────────────────────────────────────────────────────────
console.log('\n-- 4. tampilan --');
let tailwind;
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
try { tailwind = require('tailwindcss'); } catch { /* lihat di bawah */ }
if (!tailwind) {
  console.log('(kompilasi Tailwind dilewati — frontend/node_modules belum terpasang)');
} else {
  const postcss = require('postcss'), loadConfig = require('tailwindcss/loadConfig');
  const escTW = require('tailwindcss/lib/util/escapeClassName').default;
  const potonganRA = RA.slice(RA.indexOf('<BilahPilihDokumen'), RA.indexOf('<Ikon nama="description" ukuran={20}'));
  const sumber = `${BILAH}\n${potonganRA}`;
  const kelas = [...new Set([...sumber.matchAll(/className=\{?[`"]([^`"]+)[`"]/g)]
    .flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/))
    .concat([...sumber.matchAll(/'((?:border|bg|text)-[a-z0-9/-]+)'/g)].map((m) => m[1]))
    .filter((k) => /^[a-z!\-[\]0-9/:.%#]+$/i.test(k)))];
  const { css } = await postcss([tailwind({ ...loadConfig(path.join(AKAR, 'frontend', 'tailwind.config.js')),
    content: [{ raw: `<div className="${kelas.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
  const dibuat = (k) => ['.' + escTW(k) + ' ', '.' + escTW(k) + '{', '.' + escTW(k) + ':'].some((s) => css.includes(s));
  const takDibuat = kelas.filter((k) => !dibuat(k));
  cek(kelas.length >= 25 && takDibuat.length === 0, `${kelas.length} kelas bilah pilih & baris terpilih benar-benar dibuat Tailwind`, takDibuat);
  cek(kelas.includes('accent-blue-500') && kelas.includes('border-blue-500/60'), 'kotak centang berwarna & tanda baris terpilih ikut diperiksa', kelas);
}

console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS');
process.exit(gagal ? 1 : 0);

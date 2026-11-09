
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NM = `${AKAR}/mametlite/node_modules`;

console.log('uji-baca-pdf-mametlite v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

let pdfLib, pdfjs, ekstraktor;
try {
  pdfLib = await import(pathToFileURL(`${NM}/pdf-lib/cjs/index.js`).href);
  pdfjs = await import(pathToFileURL(`${NM}/pdfjs-dist/legacy/build/pdf.mjs`).href);
  ekstraktor = await import(
    pathToFileURL(`${AKAR}/mametlite/src/lib/documentTextExtractor.js`).href + '?v=' + Date.now()
  );
} catch (e) {
  console.log(`DILEWATI — mametlite/node_modules belum terpasang (${e.message.slice(0, 80)})`);
  process.exit(0);
}

console.log('\n-- 1. versi di luar rentang rentan --');

const versi = pdfjs.version || '0.0.0';
const [maj, min, pat] = versi.split('.').map(Number);
const amanLama = maj < 5 || (maj === 5 && (min < 6 || (min === 6 && pat < 83)));
const amanBaru = maj > 6 || (maj === 6 && (min > 2 || (min === 2 && pat >= 108)));
cek(amanLama || amanBaru, `pdfjs-dist ${versi} di luar rentang rentan GHSA-hq66-cqwq-w95j (>=5.6.83 <6.2.108)`, versi);

console.log('\n-- 2. teks terbaca & halaman terpisah --');

const { PDFDocument, StandardFonts } = pdfLib;
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const h1 = doc.addPage([595, 842]);
h1.drawText('KEPUTUSAN BUPATI NOMOR 12 TAHUN 2025', { x: 50, y: 760, size: 14, font });
h1.drawText('Kuota Kabupaten 2025 adalah 120 orang.', { x: 50, y: 720, size: 12, font });
const h2 = doc.addPage([595, 842]);
h2.drawText('Halaman kedua: NIP 198001012005011001', { x: 50, y: 760, size: 12, font });
const bytes = await doc.save();

const kemajuan = [];
const hasil = await ekstraktor.ekstrakPdfDariData(new Uint8Array(bytes), pdfjs, (p) => kemajuan.push(p));

cek(hasil.jenis === 'pdf', 'jenisnya dikenali sebagai pdf', hasil.jenis);
for (const penanda of ['KEPUTUSAN BUPATI NOMOR 12 TAHUN 2025', '120 orang', '198001012005011001']) {
  cek(hasil.teks.includes(penanda), `terbaca: "${penanda.slice(0, 36)}"`, hasil.teks.slice(0, 200));
}
cek(/\[Halaman 1\]/.test(hasil.teks) && /\[Halaman 2\]/.test(hasil.teks), 'kedua halaman diberi penanda terpisah', hasil.teks.slice(0, 200));

cek(kemajuan.length === 2, `kemajuan dilaporkan per halaman (${kemajuan.length})`, kemajuan);
cek(
  kemajuan.every((p) => p && p.tahap === 'membaca' && Number.isFinite(p.halaman) && p.total === 2),
  'bentuk kemajuannya utuh: {tahap, halaman, total} — ini yang jadi teks "Membaca halaman n/total"',
  kemajuan,
);

console.log('\n-- 3. PDF rusak ditolak, bukan melempar galat mentah --');

let tertangkap = null;
try {
  await ekstraktor.ekstrakPdfDariData(new Uint8Array([1, 2, 3, 4, 5]), pdfjs);
} catch (e) {
  tertangkap = e;
}
cek(!!tertangkap, 'PDF rusak memang ditolak');
cek(tertangkap?.constructor?.name === 'GagalEkstrak', 'ditolak sebagai GagalEkstrak, bukan galat mentah pdfjs', tertangkap?.constructor?.name);
cek(/tidak bisa dibuka/i.test(tertangkap?.message || ''), 'pesannya bahasa Indonesia', tertangkap?.message);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);

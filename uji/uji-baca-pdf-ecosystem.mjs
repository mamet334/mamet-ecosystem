
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NM = `${AKAR}/frontend/node_modules`;

console.log('uji-baca-pdf-ecosystem v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

let pdfLib, pdfjs, ekstraktor, tabel, ocr;
try {
  pdfLib = await import(pathToFileURL(`${NM}/pdf-lib/cjs/index.js`).href);
  pdfjs = await import(pathToFileURL(`${NM}/pdfjs-dist/legacy/build/pdf.mjs`).href);
  const svc = `${AKAR}/frontend/src/core/runtime/services`;
  ekstraktor = await import(pathToFileURL(`${svc}/documentTextExtractor.js`).href + '?v=' + Date.now());
  tabel = await import(pathToFileURL(`${svc}/tabelCentang.js`).href + '?v=' + Date.now());
  ocr = await import(pathToFileURL(`${svc}/pdfOcrService.js`).href + '?v=' + Date.now());
} catch (e) {
  console.log(`DILEWATI — frontend/node_modules belum terpasang (${e.message.slice(0, 80)})`);
  process.exit(0);
}

console.log('\n-- 1. versi di luar rentang rentan --');

const versi = pdfjs.version || '0.0.0';
const [maj, min, pat] = versi.split('.').map(Number);
const amanLama = maj < 5 || (maj === 5 && (min < 6 || (min === 6 && pat < 83)));
const amanBaru = maj > 6 || (maj === 6 && (min > 2 || (min === 2 && pat >= 108)));
cek(amanLama || amanBaru, `pdfjs-dist ${versi} di luar rentang rentan GHSA-hq66-cqwq-w95j`, versi);

for (const berkas of ['legacy/build/pdf.mjs', 'legacy/build/pdf.worker.min.mjs']) {
  let ada = true;
  try { readFileSync(`${NM}/pdfjs-dist/${berkas}`); } catch (_) { ada = false; }
  cek(ada, `berkas yang diimpor aplikasi ada di paket ini: ${berkas}`);
}

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
cek(
  kemajuan.length === 2 && kemajuan.every((p) => p?.tahap === 'membaca' && Number.isFinite(p.halaman) && p.total === 2),
  'kemajuan per halaman utuh {tahap, halaman, total} — ini yang jadi teks "Membaca halaman n/total"',
  JSON.stringify(kemajuan),
);

console.log('\n-- 3. koordinat pdf.js → kolom centang (Item 88) --');

const docT = await PDFDocument.create();
const fontT = await docT.embedFont(StandardFonts.Helvetica);
const hal = docT.addPage([595, 842]);
hal.drawText('Mutlak', { x: 300, y: 700, size: 10, font: fontT });
hal.drawText('Penting', { x: 380, y: 700, size: 10, font: fontT });
hal.drawText('Perlu', { x: 460, y: 700, size: 10, font: fontT });
hal.drawText('Analis Kebijakan', { x: 50, y: 660, size: 10, font: fontT });
hal.drawText('Ö', { x: 384, y: 660, size: 10, font: fontT });
const bytesT = await docT.save();

const tugasT = pdfjs.getDocument({ data: new Uint8Array(bytesT), isEvalSupported: false });
const docPdf = await tugasT.promise;
const items = (await (await docPdf.getPage(1)).getTextContent()).items;
await tugasT.destroy();

const contoh = items.find((it) => it?.str?.trim() === 'Penting');
cek(!!contoh, 'item teks ditemukan di keluaran getTextContent');
cek(Array.isArray(contoh?.transform) && contoh.transform.length === 6, 'item.transform tetap array 6 angka', JSON.stringify(contoh?.transform));
cek(Number.isFinite(contoh?.transform?.[4]) && Number.isFinite(contoh?.transform?.[5]), 'transform[4]/[5] tetap memuat x/y', JSON.stringify(contoh?.transform));
cek(Number.isFinite(contoh?.width) && contoh.width > 0, 'item.width tetap angka positif (dipakai gabungJudul)', contoh?.width);
cek(Math.abs(contoh.transform[4] - 380) < 1 && Math.abs(contoh.transform[5] - 700) < 1,
  'dan angkanya benar-benar koordinat yang digambar (380, 700)', JSON.stringify([contoh?.transform?.[4], contoh?.transform?.[5]]));

const bacaan = tabel.bacaTabelCentang(items, { nomorHalaman: 1 });
cek(bacaan.ringkasan.centang === 1, `centang terdeteksi (${bacaan.ringkasan.centang})`, JSON.stringify(bacaan.ringkasan));
cek(bacaan.ringkasan.terpetakan === 1, `dan terpetakan ke kolom (${bacaan.ringkasan.terpetakan})`, JSON.stringify(bacaan.ringkasan));
cek(/Analis Kebijakan → Penting/.test(bacaan.blok), 'kolomnya BENAR: Analis Kebijakan → Penting', bacaan.blok);
cek(!/Analis Kebijakan → (Mutlak|Perlu)/.test(bacaan.blok), 'dan tidak dipetakan ke kolom sebelah', bacaan.blok);

console.log('\n-- 4. permukaan pdfjs Ecosystem: satu berkas, dan jalur ASN memakai pdf-lib --');

const jml = await ocr.hitungHalamanPdf(new Uint8Array(bytes));
cek(jml === 2, `hitungHalamanPdf menghitung benar (${jml})`, jml);

const KODE_OCR = readFileSync(`${AKAR}/frontend/src/core/runtime/services/pdfOcrService.js`, 'utf8');
cek(/import\('pdf-lib'\)/.test(KODE_OCR) && !/pdfjs/.test(KODE_OCR),
  'hitungHalamanPdf memakai pdf-lib dan TIDAK menyentuh pdfjs — bila ini merah, permukaan C10b melebar');

const KODE_TABEL = readFileSync(`${AKAR}/frontend/src/core/runtime/services/tabelCentang.js`, 'utf8');
cek(!/getDocument|GlobalWorkerOptions|import\('pdfjs/.test(KODE_TABEL),
  'tabelCentang hanya MENERIMA items, tidak memanggil pdfjs sendiri');

console.log('\n-- 5. PDF rusak ditolak, bukan melempar galat mentah --');

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

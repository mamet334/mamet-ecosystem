
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SVC = `${AKAR}/frontend/src/core/runtime/services`;
const T = await import(pathToFileURL(`${SVC}/tabelCentang.js`).href);
const E = await import(pathToFileURL(`${SVC}/documentTextExtractor.js`).href);

console.log('uji-tulis-centang v1');
let gagal = 0;
let lulus = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 400)}` : ''}`);
  if (ok) lulus++; else gagal++;
};

console.log('\n-- 1. cariCentangTeks --');
cek(T.hitungCentangTeks('| a | √ | ✓ | ☑ |') === 3, 'tiga bentuk tanda dihitung');
cek(T.hitungCentangTeks('| C. | Pengalaman | | Ö | |') === 1, '"Ö" sendirian di sel tabel = tanda (jabatan 177)');
cek(T.hitungCentangTeks('Ödem Ömer | ÖZ |') === 0, '"Ö" di dalam kata/sel berisi teks bukan tanda');
cek(T.hitungCentangTeks('|Ö|') === 1, '"Ö" tanpa spasi di sel tetap tanda');

console.log('\n-- 2. tulisCentangDiTeks --');
const ocr177 = [
  '| Jenis | Uraian | Mutlak | Penting | Perlu |',
  '| | | 2. Teknis | Diklat Teknis Manajemen Kesekretariatan | | Ö | |',
  '| C. | Pengalaman Kerja | 2 tahun di eselon IV | | Ö | | |'
].join('\n');
const tanda177 = [
  { kolom: 'Penting', label: '2. Teknis — Diklat Teknis Manajemen Kesekretariatan' },
  { kolom: 'Mutlak', label: 'C. Pengalaman Kerja — 2 tahun di eselon IV' }
];
{
  const h = T.tulisCentangDiTeks(ocr177, tanda177);
  cek(h.ditulis === 2 && h.alasan === null, '177: dua tanda ditulis', JSON.stringify(h));
  cek(/Pengalaman Kerja \| 2 tahun di eselon IV \| \| Ö Mutlak \|/.test(h.teks), '177: Pengalaman Kerja → "Ö Mutlak" di selnya', h.teks);
  cek(/Kesekretariatan \| \| Ö Penting \|/.test(h.teks), '177: Diklat Teknis → "Ö Penting"', h.teks);
  cek(h.teks.split('\n')[0] === '| Jenis | Uraian | Mutlak | Penting | Perlu |', 'baris tanpa tanda tidak berubah');
}
{
  const h = T.tulisCentangDiTeks(ocr177, tanda177.slice(0, 1));
  cek(h.ditulis === 0 && h.teks === ocr177 && /jumlah/.test(h.alasan), 'jumlah tanda beda → teks apa adanya', JSON.stringify(h));
}
{
  const h = T.tulisCentangDiTeks(ocr177, [tanda177[0], { kolom: null, label: 'C. Pengalaman Kerja' }]);
  cek(h.ditulis === 0 && h.teks === ocr177, 'satu tanda PDF tak terpetakan → seluruh halaman apa adanya', JSON.stringify(h));
}
{
  const h = T.tulisCentangDiTeks(ocr177, [tanda177[0], { kolom: 'Mutlak', label: '' }]);
  cek(h.ditulis === 0 && h.teks === ocr177, 'tanda PDF tanpa label → apa adanya', JSON.stringify(h));
}
{
  const h = T.tulisCentangDiTeks(ocr177, [tanda177[1], tanda177[0]]);
  cek(h.ditulis === 0 && h.teks === ocr177, 'urutan tertukar (kolom berbeda) → ditolak', JSON.stringify(h));
}
{
  const teks = [
    '| | | 2. Teknis | Diklat Teknis yang relevan dengan tugas jabatan | | √ | |',
    '| C. | Pengalaman Kerja | Memiliki pengalaman pada jabatan pengawas sesuai dengan bidang tugas jabatan | | √ | | |'
  ].join('\n');
  const benar = [
    { kolom: 'Penting', label: '2. Teknis — relevan dengan tugas jabatan' },
    { kolom: 'Mutlak', label: 'C. Pengalaman Memiliki pengalaman Kerja pengawas paling' }
  ];
  cek(T.tulisCentangDiTeks(teks, benar).ditulis === 2, '052: urutan benar ditulis');
  const geser = T.tulisCentangDiTeks(teks, [benar[1], benar[0]]);
  cek(geser.ditulis === 0, '052: urutan digeser → ditolak (baris lebih mirip label lain berkolom beda)', JSON.stringify(geser));
  const sama = T.tulisCentangDiTeks('| Diklat Teknis | √ |\n| Diklat Teknis | √ |',
    [{ kolom: 'Penting', label: 'Diklat Teknis' }, { kolom: 'Mutlak', label: 'Diklat Teknis Lanjut' }]);
  cek(sama.ditulis === 0, 'baris sama mirip dengan label berkolom berbeda → ditolak', JSON.stringify(sama));
}
{
  const teks = '| C. | Pengalaman Kerja | 1. Memiliki sertifikasi dalam bidang pengawasan; | | ✓ | ✓ | ✓ |';
  const lab = 'C. Pengalaman 1. Memiliki sertifikasi dalam bidang';
  const h = T.tulisCentangDiTeks(teks, [{ kolom: 'Mutlak', label: lab }, { kolom: 'Penting', label: lab }, { kolom: 'Perlu', label: lab }]);
  cek(h.ditulis === 3 && /✓ Mutlak \| ✓ Penting \| ✓ Perlu \|/.test(h.teks), '057: satu baris tiga kolom ditulis urut', h.teks);
}
{
  const teks = '| | | 1. Memiliki pengalaman jabatan pemerintahan | ✓ | | |\n| | | 2. Sedang atau pernah menduduki jabatan administrator | ✓ | | |';
  const h = T.tulisCentangDiTeks(teks, [
    { kolom: 'Mutlak', label: '1. Memiliki pengalaman jabatan pemerintahan' },
    { kolom: 'Mutlak', label: '2. Sedang atau pernah' }
  ]);
  cek(h.ditulis === 2, '004: label serba kata umum tetap punya penjaga dan ditulis', JSON.stringify(h));
  const tanpa = T.tulisCentangDiTeks('| x | ✓ |', [{ kolom: 'Mutlak', label: 'Sedang atau pernah' }]);
  cek(tanpa.ditulis === 0, 'label serba kata umum yang tak ada di baris → ditolak', JSON.stringify(tanpa));
}
{
  const h = T.tulisCentangDiTeks('| 1. Diklat | √ |', [{ kolom: 'Mutlak', label: '2. Pengalaman Kerja' }]);
  cek(h.ditulis === 0 && /tidak memuat kata/.test(h.alasan), 'baris OCR tanpa kata labelnya → ditolak', JSON.stringify(h));
}

console.log('\n-- 3. tulisCentangDiItems & bacaTabelCentang().tanda --');
const it = (str, x, y, w) => ({ str, transform: [1, 0, 0, 1, x, y], width: w ?? str.length * 5, hasEOL: true });
const halamanPdf = [
  it('Jenis Persyaratan', 50, 700, 80), it('Mutlak', 300, 700, 30), it('Penting', 350, 700, 35), it('Perlu', 405, 700, 25),
  it('A. Pengalaman Kerja', 50, 680, 95), it('√', 312, 680, 6),
  it('B. Diklat Teknis', 50, 660, 75), it('√', 365, 660, 6),
  it('C. Diklat Fungsional', 50, 640, 95)
];
const tc = T.bacaTabelCentang(halamanPdf, { nomorHalaman: 1 });
cek(tc.tanda.length === 2 && tc.tanda[0].kolom === 'Mutlak' && tc.tanda[1].kolom === 'Penting',
  'tanda urut baca dengan kolom dari koordinat', JSON.stringify(tc.tanda));
cek(/Pengalaman Kerja/.test(tc.tanda[0].label) && /Diklat Teknis/.test(tc.tanda[1].label), 'tanda membawa label barisnya', JSON.stringify(tc.tanda));
{
  const { items, ditulis } = T.tulisCentangDiItems(halamanPdf, tc.tanda);
  cek(ditulis === 2 && items[5].str === '√ Mutlak' && items[7].str === '√ Penting', 'item tanda ditulis kolomnya', JSON.stringify(items.map((i) => i.str)));
  cek(halamanPdf[5].str === '√' && halamanPdf[7].str === '√', 'item asli tidak diubah');
  cek(items[4] === halamanPdf[4], 'item bukan tanda tetap objek yang sama');
  const tebal = [...halamanPdf, it('√', 312.4, 680.3, 6)];
  cek(T.tulisCentangDiItems(tebal, tc.tanda).items[9].str === '√ Mutlak', 'salinan cetak-ulang ikut ditulis (kunci sama)');
  const sebagian = T.tulisCentangDiItems(halamanPdf, [tc.tanda[0], { ...tc.tanda[1], kolom: null }]);
  cek(sebagian.ditulis === 1 && sebagian.items[7].str === '√', 'tanda tak pasti dibiarkan, yang pasti tetap ditulis');
}

console.log('\n-- 4. ekstrakPdfDariData --');
const pdfjsTiruan = (halaman) => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: halaman.length,
      getPage: async (n) => ({ getTextContent: async () => ({ items: halaman[n - 1] }), cleanup() {} })
    }),
    destroy: async () => {}
  })
});
{
  const h = await E.ekstrakPdfDariData(new Uint8Array(1), pdfjsTiruan([halamanPdf]));
  cek(/A\. Pengalaman Kerja/.test(h.teks) && /√ Mutlak/.test(h.teks) && /√ Penting/.test(h.teks), 'pdf.js: kolom tertulis di teks halaman', h.teks);
  cek(/\[TABEL CENTANG —/.test(h.teks), 'blok TABEL CENTANG tetap ditempel');
  cek(JSON.stringify(h.halamanCentangDitulis) === '[1]', 'halamanCentangDitulis dilaporkan', JSON.stringify(h.halamanCentangDitulis));
}
{
  const ocrHal = '| Jenis | Mutlak | Penting | Perlu |\n| A. Pengalaman Kerja | | √ | |\n| B. Diklat Teknis | | | √ |';
  const h = await E.ekstrakPdfDariData(new Uint8Array(1), pdfjsTiruan([halamanPdf]), null, new Map([[1, ocrHal]]));
  cek(/A\. Pengalaman Kerja \| \| √ Mutlak \|/.test(h.teks) && /B\. Diklat Teknis \| \| \| √ Penting \|/.test(h.teks),
    'OCR bergeser: kolom dari PDF yang ditulis, bukan posisi sel', h.teks);
}
{
  const ocrHal = '| A. Pengalaman Kerja | | √ | |';
  const h = await E.ekstrakPdfDariData(new Uint8Array(1), pdfjsTiruan([halamanPdf]), null, new Map([[1, ocrHal]]));
  cek(h.teks.includes(ocrHal) && !/√ (Mutlak|Penting)/.test(h.teks.split('[TABEL CENTANG')[0]) && h.halamanCentangDitulis.length === 0,
    'OCR tak cocok jumlahnya → teks OCR tidak ditulisi', h.teks);
}
{
  const polos = [it('Bab I Pendahuluan', 50, 700, 90), it('Isi paragraf biasa.', 50, 680, 90)];
  const h = await E.ekstrakPdfDariData(new Uint8Array(1), pdfjsTiruan([polos]));
  cek(h.teks === '[Halaman 1]\nBab I Pendahuluan\nIsi paragraf biasa.', 'halaman tanpa tanda tidak berubah', JSON.stringify(h.teks));
}

console.log('\n-- 5. korpus Kepbup (221 berkas, 217 halaman OCR nyata) --');
const DATA = `${AKAR}/uji/data-lokal`;
const sumberOcr = ['ocr-centang-kepbup.json', 'ocr-centang-kepbup-tambahan.json'].map((f) => `${DATA}/${f}`);
let pdfjs = null;
try { pdfjs = await import(pathToFileURL(`${AKAR}/frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs`).href); } catch {  }
if (!pdfjs || !sumberOcr.every(existsSync) || !existsSync(`${DATA}/kepbup-per-jabatan`)) {
  console.log('(korpus dilewati — butuh frontend/node_modules dan uji/data-lokal: kepbup-per-jabatan/ + ocr-centang-kepbup*.json)');
} else {
  const berkas = sumberOcr.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).berkas);
  const s = { halOcr: 0, ditulisOcr: 0, halPdfjs: 0, ditulisPdfjs: 0, tanda: 0, cakupanRendah: 0 };
  let teks177 = '';
  const peringatan = console.warn;
  const kataL = (x) => new Set(x.toLowerCase().match(/\p{L}{3,}/gu) || []);
  for (const b of berkas) {
    const data = new Uint8Array(readFileSync(`${DATA}/kepbup-per-jabatan/${b.nama}`));
    const peta = new Map(Object.entries(b.ocr).map(([n, t]) => [Number(n), t]));
    console.warn = () => {};
    const h = await E.ekstrakPdfDariData(data, pdfjs, null, peta);
    console.warn = peringatan;
    const ditulis = new Set(h.halamanCentangDitulis);
    for (const n of h.halamanTabelCentang) {
      if (peta.has(n)) { s.halOcr++; if (ditulis.has(n)) s.ditulisOcr++; } else { s.halPdfjs++; if (ditulis.has(n)) s.ditulisPdfjs++; }
    }
    if (b.nama.includes(' - 177 - ')) teks177 = h.teks;
    for (const [n, t] of peta) {
      if (!ditulis.has(n)) continue;
      const hal = h.teks.split(/\n\n(?=\[Halaman )/).find((x) => x.startsWith(`[Halaman ${n}]\n`)) || '';
      const label = [...hal.matchAll(/^- (?:\(label perkiraan\) )?(.+) → /gm)].map((m) => m[1]);
      const baris = hal.split('\n').filter((l) => /[√✓✔☑☒Ö] (\p{L}+)/u.test(l) && l.startsWith('|'));
      for (const l of baris) {
        s.tanda++;
        const terbaik = Math.max(0, ...label.map((lb) => { const k = kataL(lb); return [...k].filter((w) => kataL(l).has(w)).length / Math.max(1, k.size); }));
        if (terbaik < 0.5) s.cakupanRendah++;
      }
      void t;
    }
  }
  console.log(`   ${JSON.stringify(s)}`);
  cek(s.halOcr === 217 && s.ditulisOcr >= 181, `halaman OCR ditulis ${s.ditulisOcr}/${s.halOcr} (diukur 5 Nov: 181/217)`);
  cek(s.halPdfjs === 30 && s.ditulisPdfjs >= 29, `halaman pdf.js ditulis ${s.ditulisPdfjs}/${s.halPdfjs} (diukur 5 Nov: 29/30)`);
  cek(s.cakupanRendah === 0, 'setiap baris OCR bertulis berbagi ≥50% kata dengan salah satu label di blok halamannya', s.cakupanRendah);
  cek(/\| C\. \| Pengalaman Kerja \| 2 tahun di eselon IV \| \| Ö Mutlak \|/.test(teks177), 'BUKU-10 (177): Pengalaman Kerja → Mutlak tertulis di tabel');
  cek(/Diklat Teknis Manajemen Kesekretariatan \| \| Ö Penting \|/.test(teks177), 'BUKU-10 (177): Diklat Teknis → Penting tertulis di tabel');
  cek(!/teks OCR 0/.test(teks177), '177: tidak lagi "di teks OCR 0" (Ö dihitung)');

  let tolak = 0, lolosAman = 0, lolosBahaya = 0;
  for (const b of berkas) {
    if (!Object.keys(b.ocr).length) continue;
    const tugas = pdfjs.getDocument({ data: new Uint8Array(readFileSync(`${DATA}/kepbup-per-jabatan/${b.nama}`)), isEvalSupported: false, verbosity: 0 });
    const doc = await tugas.promise;
    let bawaan = null, sebelum = null;
    for (let n = 1; n <= doc.numPages; n++) {
      const isi = await (await doc.getPage(n)).getTextContent();
      const r = T.bacaTabelCentang(isi.items, { teksOcr: b.ocr[n], bawaan, nomorHalaman: n, itemsSebelumnya: sebelum });
      bawaan = r.bawaan; sebelum = isi.items;
      if (b.ocr[n] === undefined || r.tanda.length < 2 || !r.tanda.every((x) => x.kolom) || new Set(r.tanda.map((x) => x.label)).size < 2) continue;
      const geser = r.tanda.map((_, k) => r.tanda[(k + 1) % r.tanda.length]);
      const g = T.tulisCentangDiTeks(b.ocr[n], geser);
      if (!g.ditulis) tolak++;
      else if (geser.every((x, k) => x.kolom === r.tanda[k].kolom)) lolosAman++;
      else lolosBahaya++;
    }
    await tugas.destroy();
  }
  console.log(`   geser satu: ditolak ${tolak}, lolos tanpa mengubah kata ${lolosAman}, lolos MENGUBAH kata ${lolosBahaya}`);
  cek(lolosBahaya === 0 && tolak >= 180, 'pasangan bergeser yang mengubah kata selalu ditolak');
}

console.log(`\nselesai: ${lulus} lulus, ${gagal} gagal`);
console.log(gagal ? `${gagal} GAGAL` : 'SEMUA LULUS');
process.exit(gagal ? 1 : 0);

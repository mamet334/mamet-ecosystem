
import { terapkanOcrHalaman, hitungHalamanPdf, perkiraanOcr } from './pdfOcrService.js';
import { bacaOcrAsn } from './dataTabelAsnOcr.js';

export const adalahPdf = (nama = '') => nama.toLowerCase().endsWith('.pdf');

export async function perkiraanPdfAsn(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const halaman = await hitungHalamanPdf(bytes);
  return { bytes, halaman, dolar: perkiraanOcr(halaman) };
}

export async function bacaBerkasPdfAsn(file, { bytes, halaman }, kunci, onProgress) {
  const nomor = Array.from({ length: halaman }, (_, i) => i + 1);
  const { peta, halamanGagal } = await terapkanOcrHalaman(bytes, nomor, kunci, onProgress);
  const hasil = bacaOcrAsn(file.name, nomor.filter((n) => peta.has(n)).map((n) => ({ nomor: n, teks: peta.get(n) })));
  if (halamanGagal.length) {
    hasil.catatanOcr.unshift({ jenis: 'ocr_gagal', pesan: `halaman ${halamanGagal.join(', ')} gagal di-OCR — isinya TIDAK terbaca` });
  }
  return hasil;
}

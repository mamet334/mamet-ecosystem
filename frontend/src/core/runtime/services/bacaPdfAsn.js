// PDF PINDAIAN → DATA TABEL (Item 92 Tahap 5). SEMUA halaman di-OCR (mistral-ocr, kunci OpenRouter pengguna), lalu
// tabelnya dibaca pembaca yang sama dengan Excel lewat adaptor `dataTabelAsnOcr.js`. Pengukuran 10 PDF rekonsiliasi:
// semuanya gambar pindaian (0 huruf di lapisan teks), jadi tidak ada gunanya memilih halaman bertabel dulu.

import { terapkanOcrHalaman, hitungHalamanPdf, perkiraanOcr } from './pdfOcrService.js';
import { bacaOcrAsn } from './dataTabelAsnOcr.js';

export const adalahPdf = (nama = '') => nama.toLowerCase().endsWith('.pdf');

/** Jumlah halaman + perkiraan biaya, SEBELUM uang terpakai. */
export async function perkiraanPdfAsn(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const halaman = await hitungHalamanPdf(bytes);
  return { bytes, halaman, dolar: perkiraanOcr(halaman) };
}

/**
 * OCR semua halaman lalu baca tabelnya. Halaman yang gagal OCR dicatat di catatanOcr (tidak membatalkan).
 * @returns hasil berbentuk sama dengan bacaBerkasExcelAsn + sumber 'ocr' + catatanOcr
 */
export async function bacaBerkasPdfAsn(file, { bytes, halaman }, kunci, onProgress) {
  const nomor = Array.from({ length: halaman }, (_, i) => i + 1);
  const { peta, halamanGagal } = await terapkanOcrHalaman(bytes, nomor, kunci, onProgress);
  const hasil = bacaOcrAsn(file.name, nomor.filter((n) => peta.has(n)).map((n) => ({ nomor: n, teks: peta.get(n) })));
  if (halamanGagal.length) {
    hasil.catatanOcr.unshift({ jenis: 'ocr_gagal', pesan: `halaman ${halamanGagal.join(', ')} gagal di-OCR — isinya TIDAK terbaca` });
  }
  return hasil;
}

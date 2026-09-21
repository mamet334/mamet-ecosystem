// Pemuat berkas Excel untuk data tabel rekonsiliasi ASN (Item 92 Tahap 1).
//
// Satu-satunya tempat pustaka SheetJS dimuat — dengan import() supaya ±1 MB itu hanya diunduh saat pengguna benar-benar
// membuka Excel. Berkas ini dikecualikan dari obfuscator (vite.config.js): string array menyembunyikan nama paket dari
// Vite sehingga paket tak ikut dibundel (pelajaran pdf-lib, Item 76b).
//
// SheetJS 0.20.3 dari cdn.sheetjs.com (bukan 0.18.5 npm: CVE-2023-30533 prototype pollution & CVE-2024-22363 ReDoS,
// keduanya terpicu saat MEMBACA berkas buatan — dan berkas ini datang dari luar, kiriman OPD). Berkas dibaca di
// perangkat pengguna; tidak ada data yang dikirim ke mana pun.

import { bacaWorkbookAsn, dariSheetJS } from './dataTabelAsn.js';

export const EKSTENSI_EXCEL = ['.xlsx', '.xls'];
export const adalahExcel = (nama = '') => EKSTENSI_EXCEL.some((e) => nama.toLowerCase().endsWith(e));

/**
 * Tulis & unduh laporan kejanggalan (Item 92 Tahap 4). Berkas dibuat di perangkat pengguna.
 * @param {string} namaBerkas  mis. "Kejanggalan RSUD 2026-09-21.xlsx"
 * @param {Array<{nama:string, aoa:any[][], lebar?:number[]}>} lembar
 */
export async function unduhExcelJanggal(namaBerkas, lembar) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const l of lembar) {
    const ws = XLSX.utils.aoa_to_sheet(l.aoa);
    if (l.lebar) ws['!cols'] = l.lebar.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, l.nama);
  }
  XLSX.writeFile(wb, namaBerkas);
}

/** Baca satu File (input berkas) → hasil bacaWorkbookAsn + nama berkas. */
export async function bacaBerkasExcelAsn(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellStyles: false, cellFormula: false });
  return { berkas: file.name, ...bacaWorkbookAsn(dariSheetJS(wb, XLSX)) };
}

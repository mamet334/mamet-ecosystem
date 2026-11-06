
import { bacaWorkbookAsn, dariSheetJS } from './dataTabelAsn.js';

export const EKSTENSI_EXCEL = ['.xlsx', '.xls'];
export const adalahExcel = (nama = '') => EKSTENSI_EXCEL.some((e) => nama.toLowerCase().endsWith(e));

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

export async function bacaBerkasExcelAsn(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellStyles: false, cellFormula: false });
  return { berkas: file.name, ...bacaWorkbookAsn(dariSheetJS(wb, XLSX)) };
}

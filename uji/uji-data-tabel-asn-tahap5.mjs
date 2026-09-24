// UJI Item 92 Tahap 5 — PDF pindaian: hasil OCR nyata 10 PDF (ocr-tahap5/*.md, di luar git) → adaptor → pembaca,
// dibandingkan dengan xlsx pasangannya. Keluaran tanpa nama/NIP.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const akar = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/';
const v = '?v=' + Date.now();
const M = await import(pathToFileURL(akar + 'dataTabelAsn.js').href + v);
const O = await import(pathToFileURL(akar + 'dataTabelAsnOcr.js').href + v);
const J = await import(pathToFileURL(akar + 'dataTabelAsnJanggal.js').href + v);
console.log('uji-data-tabel-asn-tahap5 v1');
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data-lokal', 'ocr-tahap5')  // data berisi NIP — di luar git, lihat README;
const baca = (awal) => fs.readdirSync(DIR).filter((f) => f.startsWith(awal) || f.includes(awal))
  .map((f) => O.bacaOcrAsn(f.replace(/^.* __ /, '').replace(/\.md$/, '.pdf'), O.pisahHalamanOcr(fs.readFileSync(path.join(DIR, f), 'utf8'))));
const orangDari = (hs) => hs.flatMap((h) => h.sheets.flatMap((s) => s.orang));
const xlsx = (rel) => M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile('D:/REKONSIALISASI 2026/' + rel), XLSX)).sheets.flatMap((s) => s.orang);
function banding(ocr, x) {
  const nipX = new Map(x.filter((o) => o.nip).map((o) => [o.nip, o]));
  const tepat = ocr.filter((o) => nipX.has(o.nip));
  return { tepat: tepat.length, jkBeda: tepat.filter((o) => o.jenis_kelamin && nipX.get(o.nip).jenis_kelamin && o.jenis_kelamin !== nipX.get(o.nip).jenis_kelamin).length };
}

// --- Disdik: 4 PDF vs DINAS PENDIDIKAN.xlsx
const disdik = baca('DINAS PENDIDIKAN');
const oD = orangDari(disdik); const xD = xlsx('DINAS PENDIDIKAN/DINAS PENDIDIKAN.xlsx');
const bD = banding(oD, xD);
cek(disdik.length === 4, '4 PDF Disdik terbaca');
cek(oD.length === 103 && xD.length === 103, `Disdik 103 orang = xlsx (${oD.length} / ${xD.length})`);
cek(bD.tepat >= 100, `Disdik NIP tepat ≥100 (${bD.tepat})`);
cek(bD.jkBeda === 0, 'Disdik L/P sama dengan xlsx untuk semua NIP yang cocok');
const fung = disdik.find((h) => /Fungsional/.test(h.berkas));
cek(fung.catatanOcr.filter((c) => c.jenis === 'halaman_ganda').length === 2, 'Disdik fungsional: hal. 1–2 dikenali sebagai pindaian ganda');
cek(fung.catatanOcr.some((c) => c.jenis === 'kolom_beda'), 'tabel lanjutan dengan jumlah kolom berbeda dicatat');

// --- Semidang Aji & Ulu Ogan: surat pengantar tidak terbaca sebagai orang
const semidang = baca('kamis'); const oS = orangDari(semidang); const xS = xlsx('kamis/KECAMATAN SEMIDANG AJI.xlsx');
cek(oS.length === xS.length && oS.length === 16, `Semidang Aji 16 orang = xlsx (${oS.length} / ${xS.length}); baris templat "-" & surat pengantar bukan orang`);
cek(banding(oS, xS).tepat === 15, 'Semidang Aji 15 NIP tepat');
const strukS = semidang[0].sheets.find((s) => s.kelompok === 'struktural');
cek(strukS.orang.slice(0, 3).every((o) => o.pim.includes('IV') && !o.pim.includes('II')), '"PIM IV" yang bergeser ke kolom PIM II tetap terbaca IV');
const ulu = baca('selasa 19-5'); const oU = orangDari(ulu); const xU = xlsx('selasa 19-5-2026/REKONSILIASI RENCANA PENGEMBANGAN KOMPETENSI ASN Kec. ULU OGAN.xlsx');
cek(oU.length === xU.length && oU.length === 10, `Ulu Ogan 10 orang = xlsx (${oU.length} / ${xU.length})`);
cek(!oU.some((o) => o.pelatihan.some((p) => /^[=_-]+$/.test(p))), 'tanda "=" hasil OCR tidak terhitung sebagai pelatihan');
const terpotong = ulu.flatMap((h) => h.sheets.flatMap((s) => s.kejanggalan.filter((k) => k.jenis === 'nip_tak_lengkap')));
cek(terpotong.length >= 3 && terpotong.every((k) => Number.isInteger(k.baris) && k.baris < 0), `NIP terpotong OCR dicatat per orang (${terpotong.length})`);

// --- semua berkas: kelompok & baris asal
const semua = baca('');
cek(semua.length === 10, '10 PDF');
cek(semua.every((h) => h.sumber === O.SUMBER_OCR && h.sheets.every((s) => s.sumber === O.SUMBER_OCR)), 'semua ditandai sumber OCR');
cek(!semua.some((h) => h.sheets.some((s) => s.kelompok === 'tidak_dikenal')), 'tidak ada sheet berkelompok tidak_dikenal (judul tanpa "#" / typo SRUKTURAL)');
const oSemua = orangDari(semua);
cek(oSemua.every((o) => Number.isInteger(o.baris_asal) && o.baris_asal < 0), 'baris asal OCR negatif (tak bentrok dengan baris Excel)');
cek(O.uraiBaris(-3005) === 'hal. 3 baris 5' && O.uraiBaris(12) === '12' && O.labelBaris(12) === 'baris 12' && O.labelBaris(-3005) === 'hal. 3 baris 5', 'uraiBaris / labelBaris');
cek(M.opdDariNamaBerkas('KELURAHAN BATURAJA LAMA.pdf') === 'KELURAHAN BATURAJA LAMA', 'usulan OPD tanpa ".pdf"');
console.log(`   total PDF: ${oSemua.length} orang, NIP 18 digit ${oSemua.filter((o) => o.nip).length}`);

// --- simpan & laporan kejanggalan dari hasil OCR
const hU = ulu[0];
const { p_berkas, p_pegawai } = M.siapkanSimpan(hU, 'KEC. ULU OGAN');
cek(p_berkas.ringkasan_sheet.every((s) => s.sumber === 'ocr'), 'ringkasan_sheet menyimpan sumber OCR');
const keDb = (x) => (x === '' ? null : x);
const L = J.susunLaporanJanggal({
  berkas: [{ id: 'u', opd: 'KEC. ULU OGAN', nama_berkas: p_berkas.nama_berkas, ringkasan_sheet: p_berkas.ringkasan_sheet }],
  pegawai: p_pegawai.map((p) => ({ berkas_id: 'u', sheet: p.sheet, kelompok: p.kelompok, baris_asal: p.baris_asal, no_urut: keDb(p.no), nama: p.nama, nip: keDb(p.nip), jenis_kelamin: keDb(p.jenis_kelamin), jabatan: keDb(p.jabatan) })),
  tahunKini: 2026,
});
const bu = L.perOpd[0].butir;
const orangTerpotong = new Set(bu.filter((b) => b.jenis === 'nip_tak_lengkap').map((b) => b.baris));
cek(orangTerpotong.size >= 3, `laporan: NIP terpotong OCR = "perlu dibetulkan" (${orangTerpotong.size})`);
cek(!bu.some((b) => b.jenis === 'tanpa_nip' && orangTerpotong.has(b.baris)), 'orang ber-NIP terpotong tidak dilaporkan dua kali sebagai "tanpa NIP"');
const aoa = J.lembarExcelOpd(L.perOpd[0]);
cek(aoa.slice(5).some((r) => /^hal\. \d+ baris \d+$/.test(String(r[4]))), 'Excel laporan menulis baris PDF sebagai "hal. N baris M"');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

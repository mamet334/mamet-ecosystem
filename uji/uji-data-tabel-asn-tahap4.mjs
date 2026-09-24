// UJI Item 92 Tahap 4 — laporan kejanggalan per OPD, 53 berkas disimpan berurutan (versi lama digantikan).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const akar = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/';
const M = await import(pathToFileURL(akar + 'dataTabelAsn.js').href + '?v=' + Date.now());
const J = await import(pathToFileURL(akar + 'dataTabelAsnJanggal.js').href + '?v=' + Date.now());
console.log('uji-data-tabel-asn-tahap4 v2'); // v2: kolom "Baris" (Excel / hal. PDF)
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

// --- uraiNip (NIP buatan, bukan NIP pegawai)
let u = J.uraiNip('199001012015031001', 2026); cek(u.sah && u.jk === 'L' && !u.pppk, 'NIP PNS sah, L');
u = J.uraiNip('199205122023212005', 2026); cek(u.sah && u.jk === 'P' && u.pppk, 'NIP PPPK (kode 21) sah, P');
u = J.uraiNip('199013012015031001', 2026); cek(!u.sah && /tanggal lahir/.test(u.alasan[0]), 'bulan lahir 13 ditolak');
u = J.uraiNip('199001012015131001', 2026); cek(!u.sah && /TMT/.test(u.alasan.join()), 'bulan TMT 13 ditolak');
u = J.uraiNip('199001012004213001', 2026); cek(!u.sah && /PPPK/.test(u.alasan.join()) && !u.jk, 'PPPK 2004 & digit jk 3 ditolak');
u = J.uraiNip('200001012010031001', 2026); cek(!u.sah && /usia 10/.test(u.alasan.join()), 'diangkat usia 10 ditolak');
cek(J.namaLembar('DINAS [PU/PR]: KAB?*', new Set()) === 'DINAS PU PR KAB', 'nama lembar dibersihkan');
const dp = new Set(); J.namaLembar('RSUD', dp); cek(J.namaLembar('rsud', dp) === 'rsud (2)', 'nama lembar kembar diberi nomor');

// --- simulasi 53 berkas → berkas aktif + pegawai berbentuk database
const AKAR = 'D:/REKONSIALISASI 2026';
const daftar = [];
(function j(d) { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) j(p); else if (/\.xlsx$/i.test(n) && !n.startsWith('~$')) daftar.push(p); } })(AKAR);
const aktif = [];
for (const f of daftar) {
  const nama = path.basename(f);
  const hasil = { berkas: nama, ...M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile(f), XLSX)) };
  const { p_berkas, p_pegawai } = M.siapkanSimpan(hasil, M.opdDariNamaBerkas(nama));
  for (const x of M.dugaVersi(p_pegawai.map((p) => p.nip), aktif, nama)) aktif.splice(aktif.findIndex((a) => a.id === x.id), 1);
  aktif.push({ id: path.relative(AKAR, f), ...p_berkas, nips: p_pegawai.map((p) => p.nip), p_pegawai });
}
const keDb = (v) => (v === '' ? null : v);
const berkas = aktif.map((a) => ({ id: a.id, opd: a.opd, nama_berkas: a.nama_berkas, ringkasan_sheet: a.ringkasan_sheet }));
const pegawai = aktif.flatMap((a) => a.p_pegawai.map((p) => ({
  berkas_id: a.id, sheet: p.sheet, kelompok: p.kelompok, baris_asal: p.baris_asal, no_urut: keDb(p.no), nama: p.nama,
  nip: keDb(p.nip), jenis_kelamin: keDb(p.jenis_kelamin), jabatan: keDb(p.jabatan),
})));
const L = J.susunLaporanJanggal({ berkas, pegawai, tahunKini: 2026 });
cek(L.perOpd.length === 48, `48 berkas aktif (${L.perOpd.length})`);
const semua = L.perOpd.flatMap((x) => x.butir.map((b) => ({ ...b, opd: x.opd, berkas: x.berkas_id })));
const jenis = (j) => semua.filter((b) => b.jenis === j);
console.log('   per jenis:', Object.fromEntries(Object.keys(J.JENIS).map((j) => [j, jenis(j).length])));
console.log(`   total: ${L.total.salah} perlu dibetulkan, ${L.total.lengkapi} perlu dilengkapi`);

const js = jenis('jumlah_salah');
cek(js.length === 2 && js.some((b) => /Air Gading|AIR GADING/i.test(b.berkas)) && js.some((b) => /TANJUNG AGUNG|TJ.AGUNG/i.test(b.berkas)), 'JUMLAH salah: Kel. Air Gading & Kel. Tanjung Agung');
cek(jenis('jk_beda_nip').length === 14, `L/P ≠ digit NIP: 14 orang (${jenis('jk_beda_nip').length})`);
cek(jenis('jk_beda_nip').every((b) => /tertulis [LP], digit ke-15 NIP menunjukkan [LP]/.test(b.keterangan)), 'keterangan L/P menyebut isi & digit');
cek(jenis('nip_tak_sah').length <= 10, `NIP PPPK tidak dituduh salah: NIP tak sah hanya ${jenis('nip_tak_sah').length}`);
const lintas = jenis('nip_berkas_lain');
cek(lintas.length === 2 && lintas.some((b) => /PERKIM/i.test(b.opd)) && lintas.some((b) => /EDARAN/i.test(b.berkas)), 'NIP di dua berkas: PERKIM ↔ EDARAN, dilaporkan di kedua sisi');
const rsud = L.perOpd.find((x) => x.opd === 'RSUD');
cek(rsud && rsud.hitung.nip_ganda === 8, `RSUD: 4 NIP ganda → 8 butir (${rsud?.hitung.nip_ganda})`);
cek(jenis('lp_ganda').length <= 5, `L & P sama-sama terisi tinggal sedikit sesudah perbaikan pembaca (${jenis('lp_ganda').length})`);
cek(!semua.some((b) => b.jenis === 'lp_ganda' && /PU PR/i.test(b.berkas)), 'PU PR (huruf di sel gabungan L–P) tidak lagi dilaporkan L & P terisi');
cek(semua.every((b) => b.jenis === 'jumlah_salah' || b.jenis === 'jumlah_lp_beda' || b.jenis === 'struktur' || Number.isInteger(b.baris)), 'setiap butir orang punya baris Excel');
cek(L.perOpd.every((x, i, a) => i === 0 || a[i - 1].salah >= x.salah), 'OPD diurutkan dari kesalahan terbanyak');

// --- lembar Excel
const aoa = J.lembarExcelOpd(rsud, new Date(2026, 8, 21));
cek(aoa[4].join('|') === 'No|Tingkat|Masalah|Sheet|Baris|Nama|NIP|Keterangan', 'kepala tabel Excel');
cek(aoa.slice(5).every((r) => r[6] === '' || (typeof r[6] === 'string' && /^\d{18}$/.test(r[6]))), 'NIP di Excel = teks 18 digit');
cek(aoa.length === 5 + rsud.butir.length, 'satu baris per butir');
const ring = J.lembarRingkasan(L);
cek(ring.length === 3 + 48 && ring[2][0] === 'OPD', 'lembar ringkasan 48 OPD');
// tulis berkas contoh (di luar folder Owner) — memastikan SheetJS menerima semua nama lembar
const wb = XLSX.utils.book_new(); const pakai = new Set();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ring), J.namaLembar('Ringkasan', pakai));
for (const x of L.perOpd) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(J.lembarExcelOpd(x)), J.namaLembar(x.opd, pakai));
const keluar = path.join(process.env.TEMP || '.', 'uji-kejanggalan-semua-opd.xlsx');
XLSX.writeFile(wb, keluar);
const baca = XLSX.readFile(keluar);
cek(baca.SheetNames.length === 49, `berkas Excel semua OPD: 49 lembar (${baca.SheetNames.length})`);
const selNip = Object.values(baca.Sheets[baca.SheetNames[1]]).find((c) => c && c.t && /^\d{18}$/.test(String(c.v)));
cek(!selNip || selNip.t === 's', 'NIP tersimpan sebagai teks di berkas (tidak jadi 1,99E+17)');
fs.unlinkSync(keluar);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

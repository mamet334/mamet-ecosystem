// UJI Item 92 Tahap 2 (logika murni) — nama OPD, bentuk simpan, dugaan versi dengan 53 berkas disimpan berurutan.
console.log('uji-data-tabel-asn-tahap2 v2');
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const M = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/dataTabelAsn.js').href + '?v=' + Date.now());

const AKAR = 'D:/REKONSIALISASI 2026';
const berkas = [];
(function j(d) { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) j(p); else if (/\.xlsx$/i.test(n) && !n.startsWith('~$')) berkas.push(p); } })(AKAR);
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

console.log('--- usulan nama OPD');
for (const f of berkas) console.log(`   ${path.basename(f).padEnd(72)} → ${M.opdDariNamaBerkas(path.basename(f))}`);

// Simulasi: simpan satu per satu (urutan folder); setiap simpan, dugaan versi terhadap berkas aktif; bila ada → ganti.
const aktif = []; const dugaan = []; let totalBaris = 0;
for (const f of berkas) {
  const nama = path.basename(f);
  const hasil = { berkas: nama, ...M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile(f), XLSX)) };
  const { p_berkas, p_pegawai } = M.siapkanSimpan(hasil, M.opdDariNamaBerkas(nama));
  totalBaris += p_pegawai.length;
  if (p_pegawai.some((p) => p.nip && !/^\d{18}$/.test(p.nip))) cek(false, `NIP tak sah di ${nama}`);
  if (p_pegawai.some((p) => !p.nama || !Number.isInteger(p.baris_asal))) cek(false, `nama/baris_asal kosong di ${nama}`);
  const d = M.dugaVersi(p_pegawai.map((p) => p.nip), aktif, nama);
  for (const x of d) { dugaan.push(`${path.relative(AKAR, f)}  ⟶ menggantikan ${x.nama_berkas} (${x.alasan}, ${Math.round(x.rasio * 100)}%)`); aktif.splice(aktif.findIndex((a) => a.id === x.id), 1); }
  aktif.push({ id: f, opd: p_berkas.opd, nama_berkas: path.relative(AKAR, f), nips: p_pegawai.map((p) => p.nip) });
}
console.log('--- dugaan versi (simpan berurutan)');
dugaan.forEach((x) => console.log('   ' + x));
const harap = ['INSPEKTORAT', 'muara jaya', 'REKON --- RENCANA', 'EDARAN REKONSILIASI BAG.PBJ', 'DINAS PEMBERDAYAAN PEREMPUAN'];
cek(dugaan.length === 5, `tepat 5 pasangan versi (${dugaan.length})`);
cek(harap.every((h) => dugaan.some((x) => x.includes(h))), 'kelima pasangan pengukuran terdeteksi (termasuk DPPKB ↔ REKON)');
cek(!dugaan.some((x) => /PERKIM/.test(x)), 'PERKIM ↔ EDARAN susulan (1 NIP kebetulan) TIDAK dianggap versi');
// 2.312 → 2.310 (Tahap 5): baris templat bernama "-" (Semidang Aji JFT) dan "=" (Ulu Ogan) bukan orang.
cek(totalBaris === 2310, `total baris siap simpan 2.310 (${totalBaris})`);
const unik = aktif.reduce((a, b) => a + b.nips.length, 0);
console.log(`   berkas aktif sesudah semua disimpan: ${aktif.length}, orang di berkas aktif: ${unik}`);
cek(aktif.length === 48, `53 berkas − 5 versi lama = 48 berkas aktif (${aktif.length})`);
// Perbandingan isi (kasus live INSPEKTORAT): NIP sama belum tentu isi sama
const muat = (rel) => { const h = { berkas: path.basename(rel), ...M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile('D:/REKONSIALISASI 2026/' + rel), XLSX)) }; return M.siapkanSimpan(h, 'INSPEKTORAT').p_pegawai; };
// Bentuk "dari database": string kosong jadi null, seperti asn_simpan_berkas (nullif)
const keDb = (rows) => rows.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === '' ? null : v])));
const senin = muat('senin/INSPEKTORAT.xlsx'), selasa = muat('selasa/INSPEKTORAT.xlsx');
const sama = M.bandingkanIsi(senin, keDb(senin));
cek(sama.identik, `senin vs senin tersimpan = identik (${M.uraiPerbedaan(sama)})`);
const beda = M.bandingkanIsi(selasa, keDb(senin));
console.log('   selasa vs senin:', M.uraiPerbedaan(beda));
cek(!beda.identik && beda.berubah.some((x) => x.sheet === 'STRUKTURAL' && x.kolom.includes('PIM')), 'selasa vs senin: terdeteksi berubah, termasuk STRUKTURAL PIM');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

// UJI Item 92 Tahap 1 — modul dataTabelAsn.js vs 53 xlsx rekonsiliasi (kriteria roadmap §5 Tahap 1 + kunci Tahap 3).
// Jalankan: node "frontend/node_modules/.uji-rag/uji-data-tabel-asn.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const M = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/dataTabelAsn.js').href);

const AKAR = 'D:/REKONSIALISASI 2026';
const berkas = [];
(function j(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) j(p); else if (/\.xlsx$/i.test(n) && !n.startsWith('~$')) berkas.push(p); } })(AKAR);

let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };
const hasil = {};
for (const f of berkas) hasil[path.relative(AKAR, f).replace(/\\/g, '/')] = M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile(f), XLSX));

const sheets = Object.entries(hasil).flatMap(([f, h]) => h.sheets.map((s) => ({ f, ...s })));
const st = sheets.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {});
console.log(`berkas ${berkas.length}, sheet ${sheets.length}, orang ${sheets.reduce((a, s) => a + s.orang.length, 0)}, status ${JSON.stringify(st)}`);

cek(berkas.length === 53, `53 berkas xlsx (${berkas.length})`);
cek(!st.GAGAL, `0 sheet gagal (${st.GAGAL || 0})`);

// JUMLAH tertulis (dari kolom L & P) vs terbaca — hanya dua sheet yang boleh berbeda (salah hitung di Excel pengirim)
const berJumlah = sheets.filter((s) => s.jumlahTertulis);
const salah = berJumlah.filter((s) => s.kejanggalan.some((k) => k.jenis === 'jumlah_salah'));
const lpBeda = berJumlah.filter((s) => s.kejanggalan.some((k) => k.jenis === 'jumlah_lp_beda'));
console.log('       (total cocok, pembagian L/P beda: ' + lpBeda.map((s) => s.f + ' › ' + s.sheet).join('; ') + ')');
cek(berJumlah.length >= 48, `baris JUMLAH berangka L/P terbaca di ≥48 sheet (${berJumlah.length})`);
const salahNama = salah.map((s) => `${s.f} › ${s.sheet}`);
const harapSalah = ['kamis/KELURAHAN AIR GADING.xlsx › STRUKTURAL', 'selasa(mei)/REKONSILIASI RENCANA PENGEMBANGAN KOMPETENSI ASN KEL.TJ.AGUNG.xlsx › PELAKSANA'];
cek(harapSalah.every((x) => salahNama.includes(x)), `kejanggalan JUMLAH Air Gading & Tanjung Agung terdeteksi`);
const salahLain = salah.filter((s) => !harapSalah.includes(`${s.f} › ${s.sheet}`));
cek(salahLain.length === 0, `tidak ada JUMLAH beda lain (${salahLain.length})`);
salahLain.forEach((s) => console.log('       ' + s.f + ' › ' + s.sheet + ' : ' + s.kejanggalan.find((k) => k.jenis === 'jumlah_salah').pesan));

// Total kunci & ringkasan Owner
for (const [f, harap] of [['rabu/RSUD.xlsx', 559], ['rabu/SATPOL PP.xlsx', 272], ['DINAS PENDIDIKAN/DINAS PENDIDIKAN.xlsx', 103], ['rabu/BADAN PENDAPATAN DAERAH.xlsx', 100], ['kamis/KANTOR CAMAT MUARA JAYA.xlsx', 22]])
  cek(hasil[f].ringkasan.jumlahOrang === harap, `total ${f} = ${harap} (${hasil[f].ringkasan.jumlahOrang})`);
const dprd = hasil['senin/PELAKSANA SEKRETARIAT DPRD KAB. OKU.xlsx'].sheets.find((s) => s.sheet === 'JABATAN FUNGSIONAL');
cek(dprd.orang.length === 47, `DPRD JFT 47 orang, nomor gabungan dua baris tidak dihitung ganda (${dprd.orang.length})`);
cek(dprd.orang.filter((o) => o.nip).length >= 45, `DPRD JFT: NIP di baris bawah nama terbaca (${dprd.orang.filter((o) => o.nip).length}/47)`);

// Kunci RSUD (pertanyaan Owner)
const rsud = hasil['rabu/RSUD.xlsx'].sheets;
const S = rsud.find((s) => s.sheet === 'STRUKTURAL'), P = rsud.find((s) => s.sheet === 'PELAKSANA'), J = rsud.find((s) => s.sheet === 'JFT');
cek(S.orang.length === 14, `RSUD struktural 14 (${S.orang.length})`);
cek(S.orang.filter((o) => !o.pim.length).length === 14, `RSUD struktural belum PIM 14 (${S.orang.filter((o) => !o.pim.length).length})`);
cek(S.orang.filter((o) => !o.pelatihan.length).length === 1, `RSUD struktural belum pelatihan teknis 1 (${S.orang.filter((o) => !o.pelatihan.length).length})`);
cek(P.orang.filter((o) => !o.pelatihan.length).length === 131, `RSUD pelaksana belum pelatihan teknis 131 (kunci awal 130 salah: blok tanda tangan terhitung pelatihan) (${P.orang.filter((o) => !o.pelatihan.length).length})`);
cek(J.orang.filter((o) => !o.pelatihan.length).length === 155, `RSUD JFT belum pelatihan teknis 155 (kunci awal 154 salah: blok tanda tangan) (${J.orang.filter((o) => !o.pelatihan.length).length})`);
cek(!S.orang.some((o) => o.pelatihan.some((p) => /baturaja,|nip\./i.test(p))), 'blok tanda tangan tidak masuk ke pelatihan');
cek(J.kejanggalan.some((k) => k.jenis === 'jabatan_kosong' && /^154 /.test(k.pesan)), 'RSUD JFT: 154 jabatan kosong dilaporkan');
cek(S.orang.every((o) => o.nip.length === 18) && S.orang.every((o) => !/\d{6}/.test(o.nama)), 'RSUD struktural: NIP 18 digit terpisah dari nama');

// Versi ganda antar berkas (bahan Tahap 2): hitung pasangan dengan NIP sama
const pemilik = {};
for (const [f, h] of Object.entries(hasil)) for (const s of h.sheets) for (const o of s.orang) if (o.nip) (pemilik[o.nip] ||= new Set()).add(f);
const antar = Object.values(pemilik).filter((s) => s.size > 1).length;
cek(antar >= 130, `orang dengan NIP sama di >1 berkas (versi) ≈137 (${antar})`);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

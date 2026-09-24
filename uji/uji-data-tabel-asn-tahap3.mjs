// UJI Item 92 Tahap 3 (logika saring murni) — rencana → saring → teks model (tanpa NIP) + lampiran (dengan NIP).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const XLSX = require('xlsx');
const base = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/';
const M = await import(pathToFileURL(base + 'dataTabelAsn.js').href + '?v=' + Date.now());
const S = await import(pathToFileURL(base + 'dataTabelAsnSaring.js').href + '?v=' + Date.now());

let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };
const baca = (rel, opd) => {
  const h = { berkas: path.basename(rel), ...M.bacaWorkbookAsn(M.dariSheetJS(XLSX.readFile('D:/REKONSIALISASI 2026/' + rel), XLSX)) };
  return M.siapkanSimpan(h, opd).p_pegawai.map((p) => ({ ...p, opd }));
};
// Data aktif seperti di database Owner sekarang: RSUD + INSPEKTORAT (selasa), ditambah dua OPD lain untuk uji lintas OPD
const pegawai = [...baca('rabu/RSUD.xlsx', 'RSUD'), ...baca('selasa/INSPEKTORAT.xlsx', 'INSPEKTORAT'),
  ...baca('rabu/SATPOL PP.xlsx', 'SATPOL PP'), ...baca('rabu/BADAN PENDAPATAN DAERAH.xlsx', 'BADAN PENDAPATAN DAERAH')];
const OPD = ['RSUD', 'INSPEKTORAT', 'SATPOL PP', 'BADAN PENDAPATAN DAERAH'];
const tanya = (mentah) => { const r = S.normalkanRencana(mentah, OPD); return { r, h: S.saringPegawai(pegawai, r) }; };

// Kunci RSUD (Tahap 1)
cek(tanya({ opd: ['RSUD'], kelompok: ['struktural'] }).h.jumlah === 14, 'RSUD struktural = 14');
cek(tanya({ opd: ['rsud'], kelompok: ['struktural'], syarat: [{ bidang: 'pim', operator: 'kosong' }] }).h.jumlah === 14, 'RSUD struktural belum PIM = 14 (nama OPD huruf kecil tetap cocok)');
cek(tanya({ opd: ['RSUD'], kelompok: ['struktural'], syarat: [{ bidang: 'pelatihan', operator: 'kosong' }] }).h.jumlah === 1, 'RSUD struktural belum pelatihan teknis = 1');
cek(tanya({ opd: ['RSUD'], kelompok: ['pelaksana'], syarat: [{ bidang: 'pelatihan', operator: 'kosong' }] }).h.jumlah === 131, 'RSUD pelaksana belum pelatihan = 131');
cek(tanya({ opd: ['RSUD'], kelompok: ['jft'], syarat: [{ bidang: 'pelatihan', operator: 'kosong' }] }).h.jumlah === 155, 'RSUD JFT belum pelatihan = 155');
cek(tanya({ opd: ['RSUD'], kelompok: ['jft'], syarat: [{ bidang: 'jabatan', operator: 'kosong' }] }).h.jumlah === 154, 'RSUD JFT jabatan kosong = 154');

// Lintas OPD, rincian, PIM per tingkat, teks & angka
const lintas = tanya({ kelompok: ['struktural'], syarat: [{ bidang: 'pim', operator: 'kosong' }], kelompokkan: 'opd' });
console.log('       struktural belum PIM per OPD:', JSON.stringify(lintas.h.rincian));
cek(lintas.h.rincian.RSUD === 14 && Object.values(lintas.h.rincian).reduce((a, b) => a + b, 0) === lintas.h.jumlah, 'lintas OPD: rincian per OPD menjumlah ke total, RSUD 14');
const ins = tanya({ opd: ['INSPEKTORAT'], kelompok: ['struktural'], kelompokkan: 'pim' });
console.log('       INSPEKTORAT struktural per PIM:', JSON.stringify(ins.h.rincian));
cek(ins.h.jumlah === 8 && !('undefined' in ins.h.rincian), 'INSPEKTORAT struktural 8, rincian per tingkat PIM');
const pim4 = tanya({ syarat: [{ bidang: 'pim', operator: 'mengandung', nilai: 'IV' }] }).h.jumlah;
const pim3 = tanya({ syarat: [{ bidang: 'pim', operator: 'mengandung', nilai: 'III' }] }).h.jumlah;
cek(pim4 > 0 && pim3 > 0 && tanya({ syarat: [{ bidang: 'pim', operator: 'mengandung', nilai: 'II' }] }).h.jumlah !== pim3 + tanya({ syarat: [{ bidang: 'pim', operator: 'mengandung', nilai: 'II' }] }).h.jumlah - pim3 - 1, `PIM IV (${pim4}) & III (${pim3}) dihitung per tingkat — "II" tidak ikut menghitung "III"`);
const pim2 = tanya({ syarat: [{ bidang: 'pim', operator: 'mengandung', nilai: 'PIM II' }] }).h;
cek(pim2.daftar.every((p) => p.pim.map(S.tingkatPim).includes('II')), `PIM II (${pim2.jumlah}) hanya yang benar-benar II`);
const nilai = tanya({ syarat: [{ bidang: 'nilai_ipa', operator: 'lebih_dari', nilai: '85' }] }).h;
// Nilai di Excel memakai koma desimal ("88,8") dan teks ("BELUM TERSEDIA", "-") — hanya angka yang dibandingkan.
cek(nilai.jumlah > 0 && nilai.daftar.every((p) => Number(String(p.nilai_ipa).replace(',', '.')) > 85)
  && nilai.daftar.some((p) => /,/.test(p.nilai_ipa)), `nilai IPA > 85 (${nilai.jumlah}) — angka, termasuk koma desimal ("88,8")`);
const bimtek = tanya({ syarat: [{ bidang: 'pelatihan', operator: 'mengandung', nilai: 'pajak' }] }).h;
cek(bimtek.jumlah > 0 && bimtek.daftar.every((p) => p.pelatihan.some((x) => /pajak/i.test(x))), `pelatihan mengandung "pajak" (${bimtek.jumlah})`);

// Normalisasi rencana: hal tak dikenal dicatat, tidak diam-diam diabaikan
const aneh = S.normalkanRencana({ opd: ['DINAS ANTAH'], kelompok: ['honorer'], syarat: [{ bidang: 'gaji', operator: 'kosong' }, { bidang: 'pim', operator: 'mengandung' }] }, OPD);
cek(aneh.opd.length === 0 && aneh.kelompok.length === 0 && aneh.syarat.length === 0 && aneh.diabaikan.length === 4, `hal tak dikenal dicatat (${aneh.diabaikan.length}): ${aneh.diabaikan.join('; ')}`);

// Privasi: teks untuk model TANPA NIP; lampiran DENGAN NIP 18 digit dari data
const { r, h } = tanya({ opd: ['RSUD'], kelompok: ['struktural'], syarat: [{ bidang: 'pim', operator: 'kosong' }], keluaran: 'daftar' });
const teks = S.susunTeksUntukModel(h, r), lampiran = S.susunLampiran(h, r);
cek(!/\d{18}/.test(teks), 'teks untuk model tidak memuat NIP');
cek(/JUMLAH: 14 orang/.test(teks) && (teks.match(/^\d+\. /gm) || []).length === 14, 'teks model: jumlah 14 + 14 nama');
const nipDiLampiran = (lampiran.match(/\| \d{18} \|/g) || []).length;
cek(nipDiLampiran === 14, `lampiran memuat 14 NIP 18 digit dari data (${nipDiLampiran})`);
const besar = tanya({ opd: ['RSUD'], kelompok: ['jft'], syarat: [{ bidang: 'pelatihan', operator: 'kosong' }] });
const tModel = S.susunTeksUntukModel(besar.h, besar.r);
cek((tModel.match(/^\d+\. /gm) || []).length === 30 && /30 dari 155/.test(tModel), 'daftar panjang: model hanya 30 nama ("30 dari 155"), lampiran tetap lengkap');
cek((S.susunLampiran(besar.h, besar.r).match(/^\| \d+ \|/gm) || []).length === 155, 'lampiran 155 baris lengkap');
// --- Perbaikan sesudah uji live 2026-09-21 ---
const urai = S.uraiRencana(besar.r);
cek(!/daftar kosong/.test(urai) && /pelatihan teknis\/fungsional: BELUM ADA/.test(urai) && /kelompok: JFT/.test(urai), `uraian tanpa "daftar kosong": "${urai}"`);
cek(/ARTINYA: ada 155 orang yang MEMENUHI SEMUA saringan/.test(tModel), 'teks model menyatakan arti angka (155 memenuhi saringan)');
const judul = S.susunJudulHasil(besar.h, besar.r);
cek(/^\*\*📊 Hasil hitung sistem: 155 orang\*\*/.test(judul) && !/\d{18}/.test(judul), `kalimat hasil dari kode: "${judul}"`);
const ins2 = tanya({ opd: ['INSPEKTORAT'], kelompok: ['struktural'], kelompokkan: 'pim' });
cek(/per pim: .*IV 5/.test(S.susunJudulHasil(ins2.h, ins2.r)), 'kalimat hasil memuat rincian per PIM');
// Riwayat: tabel ber-NIP & NIP dibuang; tabel karangan model (meniru judul) juga terbuang
const lampiranAsli = S.susunLampiran(h, r);
const jawabanLama = `Ada 14 pejabat.\n\n[STATUS: VERIFIED]\n${lampiranAsli}`;
const bersih = S.bersihkanRiwayatDataTabel(jawabanLama);
cek(!/\d{18}/.test(bersih) && /Ada 14 pejabat/.test(bersih) && /tabel data dari sistem — tidak disertakan/.test(bersih), 'riwayat: tabel ber-NIP dibuang, teks jawaban tetap');
const tiruan = 'Tidak ada.\n\n---\n**Data Tabel — 155 orang** · tiruan\n| 1 | X | 197601012000011001 |';
cek(!/\d{18}/.test(S.bersihkanRiwayatDataTabel(tiruan)), 'riwayat: tabel tiruan model ikut dibuang');
cek(S.bersihkanRiwayatDataTabel('NIP 19760606 200604 1 010 lepas') === 'NIP [NIP] lepas', 'riwayat: NIP berspasi disamarkan');
const sam = S.samarkanNipKarangan('| 1 | Budi | 198001012005011002 | x |\n| 2 | Ani | 19800101 200501 2 003 | y |');
cek(sam.jumlah === 2 && !/\d{8}/.test(sam.teks), `NIP karangan di teks model disamarkan (${sam.jumlah})`);
cek(S.samarkanNipKarangan('Jumlah 155 dari 619 orang, tahun 2026').jumlah === 0, 'angka biasa tidak ikut disamarkan');

console.log('\n--- contoh teks untuk model (dipotong):\n' + teks.split('\n').slice(0, 6).map((l) => l.replace(/— .*? — /, '— … — ')).join('\n'));
console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

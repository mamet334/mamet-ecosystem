// ALAT BACA FOLDER KERJA (Item 85 Tahap 1, 2026-09-22) — folder_list, folder_read, folder_search.
//
// Murni (tanpa Electron) supaya bisa diuji di Node dengan folder & junction nyata. SETIAP alamat lewat
// alamatDalamPagar (pagarFolder.cjs): alamat absolut, `..`, junction ke luar, nama perangkat ditolak.
// Hasil hanya memuat alamat RELATIF (garis miring "/") — alamat lengkap tidak pernah keluar dari proses utama.
// Baca saja: tidak ada yang menulis, mengganti nama, atau menghapus.

const fs = require('fs');
const path = require('path');
const { alamatDalamPagar } = require('./pagarFolder.cjs');

const BATAS = {
  daftarEntri: 500,
  daftarKedalaman: 4,
  bacaByte: 60 * 1024,
  bacaBaris: 400,
  cariTemuan: 50,
  cariBerkasByte: 1024 * 1024,
  cariBerkas: 2000,
  kueriHuruf: 200,
};
// Folder yang dilewati saat mendaftar & mencari (bukan isi kerja, dan sering sangat besar).
const FOLDER_DILEWATI = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.cache',
  '__pycache__', '.venv', 'venv', 'env', '.idea', '.vs', 'coverage', 'target', 'bin', 'obj']);
// Dokumen berformat: teksnya tidak bisa dibaca langsung — diarahkan ke 📎 atau RAG.
const EKSTENSI_DOKUMEN = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.rtf']);

const relUnix = (r) => (r === '.' ? '.' : r.split(path.sep).join('/'));
const gagal = (alat, alamat, alasan) => ({ ok: false, alat, alamat, alasan });

/** Deteksi biner sederhana: ada byte NUL di 8 KB pertama. */
function tampakBiner(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Daftar isi folder (rekursif terbatas). */
function folderList(akar, relatif = '.', { kedalaman = BATAS.daftarKedalaman } = {}) {
  const p = alamatDalamPagar(akar, relatif || '.');
  if (!p.ok) return gagal('folder_list', relatif, p.alasan);
  let stat;
  try { stat = fs.statSync(p.alamat); } catch (e) { return gagal('folder_list', relatif, `tidak ditemukan (${e.code})`); }
  if (!stat.isDirectory()) return gagal('folder_list', relatif, 'bukan folder — pakai folder_read untuk berkas');
  const entri = [];
  let terpotong = false;
  let dilewati = 0;
  const jalan = (dir, relDir, tingkat) => {
    let isi;
    try { isi = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    isi.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    for (const d of isi) {
      if (entri.length >= BATAS.daftarEntri) { terpotong = true; return; }
      const rel = relDir === '.' ? d.name : `${relDir}/${d.name}`;
      // Setiap entri dinilai ulang lewat pagar: junction/symlink di dalam folder yang menunjuk ke luar tidak diikuti.
      const cek = alamatDalamPagar(akar, rel);
      if (!cek.ok) { dilewati++; continue; }
      if (d.isDirectory()) {
        if (FOLDER_DILEWATI.has(d.name.toLowerCase())) { entri.push({ jenis: 'folder', alamat: rel, dilewati: true }); continue; }
        entri.push({ jenis: 'folder', alamat: rel });
        if (tingkat < kedalaman) jalan(cek.alamat, rel, tingkat + 1);
      } else if (d.isFile()) {
        let ukuran = null;
        try { ukuran = fs.statSync(cek.alamat).size; } catch { /* abaikan */ }
        entri.push({ jenis: 'berkas', alamat: rel, ukuran });
      }
    }
  };
  jalan(p.alamat, relUnix(p.relatif), 1);
  return { ok: true, alat: 'folder_list', alamat: relUnix(p.relatif), entri, terpotong, dilewatiPagar: dilewati };
}

/** Baca satu berkas teks, dibatasi ukuran; `dari`/`sampai` = nomor baris (1-based, inklusif). */
function folderRead(akar, relatif, { dari, sampai } = {}) {
  const p = alamatDalamPagar(akar, relatif);
  if (!p.ok) return gagal('folder_read', relatif, p.alasan);
  let stat;
  try { stat = fs.statSync(p.alamat); } catch (e) { return gagal('folder_read', relatif, `tidak ditemukan (${e.code})`); }
  if (stat.isDirectory()) return gagal('folder_read', relatif, 'ini folder — pakai folder_list');
  const ext = path.extname(p.alamat).toLowerCase();
  if (EKSTENSI_DOKUMEN.has(ext)) {
    return gagal('folder_read', relUnix(p.relatif), `berkas ${ext} tidak bisa dibaca sebagai teks — minta pengguna melampirkannya lewat 📎 atau mengunggahnya ke RAG`);
  }
  const fd = fs.openSync(p.alamat, 'r');
  let buf;
  try {
    const n = Math.min(stat.size, 4 * 1024 * 1024);
    buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, 0);
  } finally { fs.closeSync(fd); }
  if (tampakBiner(buf)) return gagal('folder_read', relUnix(p.relatif), 'berkas biner — tidak dibaca');
  const semua = buf.toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
  const totalBaris = stat.size > buf.length ? null : semua.length;
  const awal = Math.max(1, Number.isInteger(dari) ? dari : 1);
  let akhir = Number.isInteger(sampai) ? Math.min(sampai, semua.length) : semua.length;
  akhir = Math.min(akhir, awal + BATAS.bacaBaris - 1);
  const baris = [];
  let byte = 0;
  let terpotong = akhir < semua.length || stat.size > buf.length;
  for (let i = awal; i <= akhir; i++) {
    const b = semua[i - 1] ?? '';
    byte += Buffer.byteLength(b, 'utf8') + 1;
    if (byte > BATAS.bacaByte) { terpotong = true; akhir = i - 1; break; }
    baris.push(b);
  }
  return {
    ok: true, alat: 'folder_read', alamat: relUnix(p.relatif), ukuran: stat.size,
    dari: awal, sampai: awal + baris.length - 1, totalBaris, terpotong, isi: baris.join('\n'),
  };
}

/** Cari teks (tanpa beda huruf besar/kecil) di berkas teks dalam folder. */
function folderSearch(akar, kueri, { relatif = '.' } = {}) {
  if (typeof kueri !== 'string' || !kueri.trim()) return gagal('folder_search', relatif, 'kata yang dicari kosong');
  const cari = kueri.trim().slice(0, BATAS.kueriHuruf).toLowerCase();
  const p = alamatDalamPagar(akar, relatif || '.');
  if (!p.ok) return gagal('folder_search', relatif, p.alasan);
  const temuan = [];
  let diperiksa = 0;
  let terpotong = false;
  const jalan = (dir, relDir) => {
    let isi;
    try { isi = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    isi.sort((a, b) => a.name.localeCompare(b.name));
    for (const d of isi) {
      if (temuan.length >= BATAS.cariTemuan || diperiksa >= BATAS.cariBerkas) { terpotong = true; return; }
      const rel = relDir === '.' ? d.name : `${relDir}/${d.name}`;
      const cek = alamatDalamPagar(akar, rel);
      if (!cek.ok) continue;
      if (d.isDirectory()) { if (!FOLDER_DILEWATI.has(d.name.toLowerCase())) jalan(cek.alamat, rel); continue; }
      if (!d.isFile() || EKSTENSI_DOKUMEN.has(path.extname(d.name).toLowerCase())) continue;
      let buf;
      try {
        if (fs.statSync(cek.alamat).size > BATAS.cariBerkasByte) continue;
        buf = fs.readFileSync(cek.alamat);
      } catch { continue; }
      if (tampakBiner(buf)) continue;
      diperiksa++;
      const baris = buf.toString('utf8').split(/\r?\n/);
      for (let i = 0; i < baris.length; i++) {
        if (baris[i].toLowerCase().includes(cari)) {
          temuan.push({ alamat: rel, baris: i + 1, isi: baris[i].trim().slice(0, 200) });
          if (temuan.length >= BATAS.cariTemuan) { terpotong = true; return; }
        }
      }
    }
  };
  const stat = (() => { try { return fs.statSync(p.alamat); } catch { return null; } })();
  if (!stat) return gagal('folder_search', relatif, 'tidak ditemukan');
  if (stat.isDirectory()) jalan(p.alamat, relUnix(p.relatif));
  else return gagal('folder_search', relatif, 'folder_search mencari di dalam folder — beri alamat folder atau "."');
  return { ok: true, alat: 'folder_search', alamat: relUnix(p.relatif), kueri: cari, temuan, berkasDiperiksa: diperiksa, terpotong };
}

/** Satu pintu untuk IPC: {alat, alamat, dari, sampai, kueri}. Alat tak dikenal ditolak. */
function jalankanAlat(akar, permintaan = {}) {
  if (!akar) return gagal(permintaan.alat, permintaan.alamat, 'folder kerja belum dipilih');
  switch (permintaan.alat) {
    case 'folder_list': return folderList(akar, permintaan.alamat || '.');
    case 'folder_read': return folderRead(akar, permintaan.alamat, { dari: permintaan.dari, sampai: permintaan.sampai });
    case 'folder_search': return folderSearch(akar, permintaan.kueri, { relatif: permintaan.alamat || '.' });
    default: return gagal(permintaan.alat, permintaan.alamat, `alat "${permintaan.alat}" tidak dikenal (Tahap 1: folder_list, folder_read, folder_search)`);
  }
}

module.exports = { folderList, folderRead, folderSearch, jalankanAlat, BATAS };

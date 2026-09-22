// ALAT TULIS FOLDER KERJA (Item 85 Tahap 2, 2026-09-22) — folder_write, folder_edit, folder_mkdir, folder_rename,
// folder_delete.
//
// Murni: izin & tempat sampah DISUNTIKKAN (Electron: dialog asli proses utama + shell.trashItem; uji: tiruan), jadi
// bisa diuji di Node dengan folder nyata. Prinsip:
//   - Setiap alamat (asal DAN tujuan) lewat alamatDalamPagar (pagarFolder.cjs). Akar folder kerja tak bisa
//     ditimpa, diganti nama, atau dihapus.
//   - Tidak ada PowerShell: fs langsung (CommandRegistry lama merakit perintah dari alamat mentah — T8).
//   - SETIAP perubahan meminta izin dengan pratinjau; ditolak = tidak ada yang berubah, dilaporkan apa adanya.
//   - Hapus = Recycle Bin, bukan permanen. Tulis = berkas sementara lalu ganti nama (tak ada berkas setengah jadi).
//   - Ekstensi yang bisa dijalankan tidak boleh ditulis/diedit/dijadikan tujuan ganti nama.

const fs = require('fs');
const path = require('path');
const { alamatDalamPagar } = require('./pagarFolder.cjs');

const BATAS_TULIS = {
  isiByte: 200 * 1024,
  editBerkasByte: 1024 * 1024,
  pratinjauHuruf: 1200,
};
// Bisa dijalankan / diklik-jalan di Windows. .js ikut (Windows Script Host menjalankannya dengan klik ganda).
const EKSTENSI_TERLARANG = new Set(['.exe', '.dll', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.js',
  '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.scr', '.msi', '.msp', '.reg', '.pif', '.cpl', '.jar', '.sys']);

const gagal = (alat, alamat, alasan) => ({ ok: false, alat, alamat, alasan });
const relUnix = (r) => (r === '.' ? '.' : r.split(path.sep).join('/'));
const potong = (s, n = BATAS_TULIS.pratinjauHuruf) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} huruf lagi)` : s);
const terlarang = (alamat) => EKSTENSI_TERLARANG.has(path.extname(alamat).toLowerCase());
const tampakBiner = (buf) => { const n = Math.min(buf.length, 8192); for (let i = 0; i < n; i++) if (buf[i] === 0) return true; return false; };
const statAtauNull = (a) => { try { return fs.statSync(a); } catch { return null; } };

/** Pagar + larangan umum. Mengembalikan {ok, alamat(abs), rel} atau gagal. */
function sahkan(akar, alat, relatif, { bukanAkar = true, cekEkstensi = false } = {}) {
  if (typeof relatif !== 'string' || !relatif.trim()) return gagal(alat, relatif, 'alamat kosong');
  const p = alamatDalamPagar(akar, relatif);
  if (!p.ok) return gagal(alat, relatif, p.alasan);
  if (bukanAkar && p.relatif === '.') return gagal(alat, relatif, 'akar folder kerja tidak boleh diubah, diganti nama, atau dihapus');
  if (cekEkstensi && terlarang(p.alamat)) return gagal(alat, relUnix(p.relatif), `ekstensi ${path.extname(p.alamat)} bisa dijalankan — tidak boleh ditulis oleh alat folder`);
  return { ok: true, alamat: p.alamat, rel: relUnix(p.relatif) };
}

/** Minta izin; hasil ditolak diseragamkan. */
async function izin(deps, permintaan) {
  try { return (await deps.mintaIzin(permintaan)) === true; } catch { return false; }
}
const ditolakOwner = (alat, alamat) => ({ ok: false, alat, alamat, ditolakOwner: true, alasan: 'ditolak Owner di dialog izin — tidak ada yang diubah' });

/** Tulis atomik: berkas sementara di folder yang sama lalu ganti nama. */
function tulisAtomik(alamat, isi) {
  fs.mkdirSync(path.dirname(alamat), { recursive: true });
  const sementara = path.join(path.dirname(alamat), `.${path.basename(alamat)}.mamet-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(sementara, isi, 'utf8');
  try { fs.renameSync(sementara, alamat); } catch (e) { try { fs.unlinkSync(sementara); } catch { /* */ } throw e; }
}

async function folderWrite(akar, { alamat, isi }, deps) {
  const s = sahkan(akar, 'folder_write', alamat, { cekEkstensi: true });
  if (!s.ok) return s;
  if (typeof isi !== 'string') return gagal('folder_write', s.rel, 'isi berkas bukan teks');
  const byte = Buffer.byteLength(isi, 'utf8');
  if (byte > BATAS_TULIS.isiByte) return gagal('folder_write', s.rel, `isi ${Math.round(byte / 1024)} KB melebihi batas ${BATAS_TULIS.isiByte / 1024} KB`);
  if (isi.includes('\0')) return gagal('folder_write', s.rel, 'isi memuat karakter NUL (bukan teks)');
  const ada = statAtauNull(s.alamat);
  if (ada?.isDirectory()) return gagal('folder_write', s.rel, 'alamat itu folder — pilih nama berkas');
  if (ada && tampakBiner(fs.readFileSync(s.alamat).subarray(0, 8192))) return gagal('folder_write', s.rel, 'berkas yang ada adalah biner — tidak ditimpa');
  const setuju = await izin(deps, {
    alat: 'folder_write', alamat: s.rel, berbahaya: !!ada,
    judul: ada ? `Timpa berkas "${s.rel}"?` : `Buat berkas baru "${s.rel}"?`,
    rincian: `${ada ? `Isi lama (${ada.size} byte) DIGANTI seluruhnya.` : 'Berkas belum ada — akan dibuat.'} Isi baru: ${byte} byte, ${isi.split('\n').length} baris.`,
    pratinjau: potong(isi),
  });
  if (!setuju) return ditolakOwner('folder_write', s.rel);
  tulisAtomik(s.alamat, isi);
  return { ok: true, alat: 'folder_write', alamat: s.rel, dibuat: !ada, byte };
}

async function folderEdit(akar, { alamat, cari, ganti }, deps) {
  const s = sahkan(akar, 'folder_edit', alamat, { cekEkstensi: true });
  if (!s.ok) return s;
  if (typeof cari !== 'string' || !cari) return gagal('folder_edit', s.rel, 'teks yang dicari ("cari") kosong');
  if (typeof ganti !== 'string') return gagal('folder_edit', s.rel, 'teks pengganti ("ganti") bukan teks');
  const st = statAtauNull(s.alamat);
  if (!st || !st.isFile()) return gagal('folder_edit', s.rel, 'berkas tidak ditemukan');
  if (st.size > BATAS_TULIS.editBerkasByte) return gagal('folder_edit', s.rel, 'berkas terlalu besar untuk diedit (> 1 MB)');
  const buf = fs.readFileSync(s.alamat);
  if (tampakBiner(buf)) return gagal('folder_edit', s.rel, 'berkas biner — tidak diedit');
  const lama = buf.toString('utf8');
  // Akhir baris berkas (CRLF) dan teks dari model (LF) disamakan dulu supaya potongan yang benar tetap ketemu.
  const crlf = lama.includes('\r\n');
  const cariN = crlf ? cari.replace(/\r?\n/g, '\r\n') : cari;
  const gantiN = crlf ? ganti.replace(/\r?\n/g, '\r\n') : ganti;
  const jumlah = lama.split(cariN).length - 1;
  if (jumlah === 0) return gagal('folder_edit', s.rel, 'teks yang dicari tidak ada di berkas — baca ulang berkasnya dan salin potongan persis');
  if (jumlah > 1) return gagal('folder_edit', s.rel, `teks yang dicari muncul ${jumlah}× — perpanjang potongan supaya hanya satu tempat`);
  const baru = lama.replace(cariN, () => gantiN);
  if (Buffer.byteLength(baru, 'utf8') > BATAS_TULIS.editBerkasByte) return gagal('folder_edit', s.rel, 'hasil edit melebihi 1 MB');
  const baris = lama.slice(0, lama.indexOf(cariN)).split('\n').length;
  const setuju = await izin(deps, {
    alat: 'folder_edit', alamat: s.rel, berbahaya: false,
    judul: `Edit berkas "${s.rel}" (baris ${baris})?`,
    rincian: 'Hanya potongan di bawah yang diganti; bagian lain berkas tidak berubah.',
    pratinjau: `SEBELUM:\n${potong(cari, 550)}\n\nSESUDAH:\n${potong(ganti, 550)}`,
  });
  if (!setuju) return ditolakOwner('folder_edit', s.rel);
  tulisAtomik(s.alamat, baru);
  return { ok: true, alat: 'folder_edit', alamat: s.rel, baris };
}

async function folderMkdir(akar, { alamat }, deps) {
  const s = sahkan(akar, 'folder_mkdir', alamat);
  if (!s.ok) return s;
  if (statAtauNull(s.alamat)) return gagal('folder_mkdir', s.rel, 'sudah ada');
  const setuju = await izin(deps, { alat: 'folder_mkdir', alamat: s.rel, berbahaya: false, judul: `Buat folder "${s.rel}"?`, rincian: 'Folder kosong baru di dalam folder kerja.', pratinjau: '' });
  if (!setuju) return ditolakOwner('folder_mkdir', s.rel);
  fs.mkdirSync(s.alamat, { recursive: true });
  return { ok: true, alat: 'folder_mkdir', alamat: s.rel };
}

async function folderRename(akar, { alamat, ke }, deps) {
  const s = sahkan(akar, 'folder_rename', alamat);
  if (!s.ok) return s;
  const t = sahkan(akar, 'folder_rename', ke, { cekEkstensi: true });
  if (!t.ok) return { ...t, alamat: `${s.rel} → ${ke}` };
  const st = statAtauNull(s.alamat);
  if (!st) return gagal('folder_rename', s.rel, 'tidak ditemukan');
  if (statAtauNull(t.alamat)) return gagal('folder_rename', `${s.rel} → ${t.rel}`, 'tujuan sudah ada — tidak ditimpa');
  if (st.isDirectory() && (t.alamat + path.sep).toLowerCase().startsWith((s.alamat + path.sep).toLowerCase())) {
    return gagal('folder_rename', `${s.rel} → ${t.rel}`, 'folder tidak bisa dipindah ke dalam dirinya sendiri');
  }
  const setuju = await izin(deps, {
    alat: 'folder_rename', alamat: `${s.rel} → ${t.rel}`, berbahaya: false,
    judul: `Ganti nama / pindahkan "${s.rel}"?`, rincian: `Menjadi "${t.rel}" (di dalam folder kerja).`, pratinjau: '',
  });
  if (!setuju) return ditolakOwner('folder_rename', `${s.rel} → ${t.rel}`);
  fs.mkdirSync(path.dirname(t.alamat), { recursive: true });
  fs.renameSync(s.alamat, t.alamat);
  return { ok: true, alat: 'folder_rename', alamat: `${s.rel} → ${t.rel}` };
}

async function folderDelete(akar, { alamat }, deps) {
  const s = sahkan(akar, 'folder_delete', alamat);
  if (!s.ok) return s;
  const st = statAtauNull(s.alamat);
  if (!st) return gagal('folder_delete', s.rel, 'tidak ditemukan');
  const setuju = await izin(deps, {
    alat: 'folder_delete', alamat: s.rel, berbahaya: true,
    judul: `Hapus ${st.isDirectory() ? 'folder' : 'berkas'} "${s.rel}"?`,
    rincian: `${st.isDirectory() ? 'Folder beserta seluruh isinya' : `Berkas (${st.size} byte)`} dipindah ke Recycle Bin — bisa dipulihkan dari sana.`,
    pratinjau: '',
  });
  if (!setuju) return ditolakOwner('folder_delete', s.rel);
  await deps.keTempatSampah(s.alamat);
  if (statAtauNull(s.alamat)) return gagal('folder_delete', s.rel, 'Recycle Bin menolak — berkas masih ada');
  return { ok: true, alat: 'folder_delete', alamat: s.rel, keRecycleBin: true };
}

const ALAT_TULIS = ['folder_write', 'folder_edit', 'folder_mkdir', 'folder_rename', 'folder_delete'];

/** Satu pintu untuk IPC. deps = { mintaIzin(permintaan) → Promise<boolean>, keTempatSampah(alamatAbs) → Promise }. */
async function jalankanAlatTulis(akar, permintaan = {}, deps) {
  if (!akar) return gagal(permintaan.alat, permintaan.alamat, 'folder kerja belum dipilih');
  if (!deps || typeof deps.mintaIzin !== 'function') return gagal(permintaan.alat, permintaan.alamat, 'dialog izin tidak tersedia — tidak ada yang diubah');
  try {
    switch (permintaan.alat) {
      case 'folder_write': return await folderWrite(akar, permintaan, deps);
      case 'folder_edit': return await folderEdit(akar, permintaan, deps);
      case 'folder_mkdir': return await folderMkdir(akar, permintaan, deps);
      case 'folder_rename': return await folderRename(akar, permintaan, deps);
      case 'folder_delete': return await folderDelete(akar, permintaan, deps);
      default: return gagal(permintaan.alat, permintaan.alamat, `alat tulis "${permintaan.alat}" tidak dikenal`);
    }
  } catch (e) {
    return gagal(permintaan.alat, permintaan.alamat, `galat: ${e.code || e.message}`);
  }
}

module.exports = { jalankanAlatTulis, ALAT_TULIS, EKSTENSI_TERLARANG, BATAS_TULIS };

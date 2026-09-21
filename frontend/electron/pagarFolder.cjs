// PAGAR FOLDER KERJA (Item 85 Tahap 0, 2026-09-21)
//
// Satu-satunya pintu dari "alamat relatif yang ditulis AI" ke "alamat berkas sebenarnya". Semua alat folder
// (Tahap 1 baca, Tahap 2 tulis, Tahap 3 perintah) WAJIB lewat alamatDalamPagar — jalur lama (`fs:*`,
// `edit-file-surgical`) tidak berpagar dan tidak dipakai folder kerja.
//
// Murni (tanpa Electron) supaya bisa diuji di Node dengan folder & junction nyata.
// Pagar dinilai dari ALAMAT SEBENARNYA (realpath), bukan dari teks: junction/symlink di dalam folder yang menunjuk
// ke luar ditolak walau teksnya terlihat di dalam.

const path = require('path');
const fs = require('fs');

// Nama perangkat Windows — `CON`, `NUL.txt`, `com1` dst. membuka perangkat, bukan berkas.
const NAMA_PERANGKAT = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

const tolak = (alasan) => ({ ok: false, alasan });

/** Alamat sebenarnya (huruf besar/kecil & junction diurai). Berkas yang belum ada: induk terdekat yang ada + sisanya. */
function alamatSebenarnya(alamat) {
  const sisa = [];
  let kini = alamat;
  for (;;) {
    try {
      const asli = fs.realpathSync.native(kini);
      return sisa.length ? path.join(asli, ...sisa.reverse()) : asli;
    } catch (e) {
      if (e && e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const induk = path.dirname(kini);
      if (induk === kini) return null;
      sisa.push(path.basename(kini));
      kini = induk;
    }
  }
}

/** true bila `anak` sama dengan `akar` atau berada di dalamnya (keduanya alamat sebenarnya). */
function diDalam(akar, anak) {
  const rel = path.relative(akar, anak); // win32: perbandingan tanpa membedakan huruf besar/kecil
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Sahkan folder yang dipilih pengguna sebagai akar folder kerja.
 * Ditolak: bukan folder, akar drive (C:\ — terlalu luas), folder Windows.
 * @returns {{ok:true, akar:string, nama:string} | {ok:false, alasan:string}}
 */
function akarFolderSah(dipilih) {
  if (typeof dipilih !== 'string' || !dipilih.trim()) return tolak('folder kosong');
  let akar;
  try {
    akar = fs.realpathSync.native(dipilih);
    if (!fs.statSync(akar).isDirectory()) return tolak('bukan folder');
  } catch (e) {
    return tolak(`folder tidak bisa dibuka (${e.code || e.message})`);
  }
  if (path.parse(akar).root === akar) return tolak('akar drive terlalu luas — pilih folder di dalamnya');
  const sistem = process.env.SystemRoot || process.env.windir;
  if (sistem) {
    try {
      const sistemAsli = fs.realpathSync.native(sistem);
      if (diDalam(sistemAsli, akar)) return tolak('folder sistem Windows tidak boleh dipakai');
    } catch (_) { /* SystemRoot tak terbaca: lewati pemeriksaan ini */ }
  }
  return { ok: true, akar, nama: path.basename(akar) };
}

/**
 * Terjemahkan alamat relatif (dari AI) menjadi alamat absolut DI DALAM folder kerja.
 * @param {string} akar   akar sah dari akarFolderSah (disimpan di proses utama, bukan dari layar)
 * @param {string} relatif  mis. "src/app.js" atau "." untuk akar
 * @returns {{ok:true, alamat:string, relatif:string} | {ok:false, alasan:string}}
 */
function alamatDalamPagar(akar, relatif) {
  if (typeof akar !== 'string' || !akar) return tolak('folder kerja belum dipilih');
  if (typeof relatif !== 'string') return tolak('alamat bukan teks');
  const teks = relatif.trim();
  if (!teks) return tolak('alamat kosong');
  if (teks.includes('\0')) return tolak('alamat memuat karakter NUL');
  // Alamat absolut dalam bentuk apa pun: C:\…, C:… (relatif-drive), \\server\…, \\?\…, /…, \…
  if (path.isAbsolute(teks) || /^[a-zA-Z]:/.test(teks) || /^[\\/]/.test(teks)) {
    return tolak('alamat absolut tidak diterima — pakai alamat relatif terhadap folder kerja');
  }
  const bagian = teks.split(/[\\/]+/).filter((b) => b !== '');
  for (const b of bagian) {
    if (b === '.' || b === '..') continue; // dinilai sesudah dinormalkan di bawah
    if (b.includes(':')) return tolak(`nama "${b}" memuat titik dua (aliran data tersembunyi Windows)`);
    if (NAMA_PERANGKAT.test(b)) return tolak(`nama "${b}" adalah nama perangkat Windows`);
    if (/[. ]$/.test(b)) return tolak(`nama "${b}" diakhiri titik/spasi (Windows membuangnya diam-diam)`);
    if (/[<>"|?*\x01-\x1f]/.test(b)) return tolak(`nama "${b}" memuat karakter terlarang`);
  }

  let akarAsli;
  try {
    akarAsli = fs.realpathSync.native(akar);
  } catch (e) {
    return tolak(`folder kerja tidak bisa dibuka (${e.code || e.message})`);
  }
  const alamat = path.resolve(akarAsli, teks);
  if (!diDalam(akarAsli, alamat)) return tolak('alamat keluar dari folder kerja');

  let asli;
  try {
    asli = alamatSebenarnya(alamat);
  } catch (e) {
    return tolak(`alamat tidak bisa diperiksa (${e.code || e.message})`);
  }
  if (!asli || !diDalam(akarAsli, asli)) return tolak('alamat menunjuk ke luar folder kerja (junction/symlink)');

  return { ok: true, alamat: asli, relatif: path.relative(akarAsli, asli) || '.' };
}

module.exports = { akarFolderSah, alamatDalamPagar };

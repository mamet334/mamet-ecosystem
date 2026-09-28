/**
 * AKAR REPO ENGINEER (ROADMAP-ENGINEER-MANDIRI Tahap 5, 2026-09-28)
 *
 * ── Masalah (terbukti 23 September) ─────────────────────────────────────────────────────────
 * `PROJECT_ROOT = path.resolve(__dirname, '..', '..')` benar di `npm run desktop` — di sana
 * `main.cjs` memang berada di dalam repo. Di build `npm run dist` ia menunjuk **folder instalasi**:
 * `git` gagal "not a git repository", dan patch akan menulis ke folder aplikasi.
 *
 * ── Rancangan ───────────────────────────────────────────────────────────────────────────────
 * Akar repo dipilih Owner sekali lalu disimpan ALAMATNYA saja. Belum dipilih → alat repo Engineer
 * dimatikan dengan pesan jelas, bukan gagal dengan galat git yang membingungkan.
 *
 * Polanya sengaja SAMA dengan tombol 📁 folder kerja Assistant (Item 85): Owner memilih folder,
 * proses utama menyimpan alamatnya, dan pilihan itu **disahkan ulang setiap aplikasi dibuka** —
 * folder yang sudah dihapus atau dipindah tidak dipakai diam-diam. Bedanya tiga:
 *   1. wajib repo git (ada `.git`) — tanpa riwayat, checkpoint & rollback kehilangan artinya;
 *   2. folder di dalam direktori instalasi DITOLAK (lihat di bawah);
 *   3. yang dibuka bukan hanya berkas, melainkan riwayat.
 *
 * ── Kenapa folder instalasi ditolak (pertanyaan Owner, 24 September) ────────────────────────
 * Paketnya NSIS dengan `allowToChangeInstallationDirectory`. **Uninstall menghapus folder instalasi**
 * — repo beserta seluruh riwayat git ikut terhapus. Update juga menimpa berkas aplikasi sehingga git
 * melihat ribuan perubahan yang bukan pekerjaan Owner. Maka tiga tempat dipisah tegas:
 *
 *   folder instalasi   kode aplikasi terbundel     → dihapus / ditimpa
 *   %APPDATA%\Mamet AI setelan, kunci, checkpoint  → selamat
 *   repo pilihan Owner milik Owner                 → tidak tersentuh; aplikasi simpan ALAMATNYA
 *
 * Murni (tanpa `electron`) supaya bisa diuji dengan node biasa — lihat `uji/uji-akar-repo.cjs`.
 */

const fs = require('fs');
const path = require('path');
const { akarFolderSah } = require('./pagarFolder.cjs');

const tolak = (alasan) => ({ ok: false, alasan });

/** `anak` berada di dalam `akar` (atau sama dengannya). Perbandingan win32 tak bedakan huruf besar/kecil. */
function diDalam(akar, anak) {
  const rel = path.relative(akar, anak);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Sahkan folder pilihan Owner sebagai akar repo Engineer.
 *
 * @param {string} dipilih alamat folder dari dialog
 * @param {object} opsi
 * @param {string} [opsi.folderInstalasi] akar instalasi aplikasi (`app.getAppPath()` / `process.resourcesPath`)
 * @param {object} [opsi.berkas] injeksi untuk uji: { realpath, stat, ada }
 * @returns {{ok:true, akar:string, nama:string} | {ok:false, alasan:string}}
 */
function akarRepoSah(dipilih, opsi = {}) {
  // Pagar dasar dipakai ulang dari Item 85: folder ada, bukan berkas, bukan akar drive, bukan folder
  // sistem Windows. Tidak ditulis ulang di sini supaya tidak ada dua versi aturan yang bisa berbeda.
  const dasar = (opsi.akarFolderSah || akarFolderSah)(dipilih);
  if (!dasar.ok) return dasar;
  const akar = dasar.akar;

  const ada = opsi.berkas?.ada || ((p) => fs.existsSync(p));

  // PENJAGA 1 — wajib repo git. Tanpa `.git`, Engineer kehilangan checkpoint dan rollback, yaitu
  // seluruh jaring pengamannya. Lebih baik alatnya mati dengan alasan jelas daripada hidup tanpa jaring.
  if (!ada(path.join(akar, '.git'))) {
    return tolak('folder ini bukan repositori git (tidak ada ".git") — Engineer butuh riwayat git untuk checkpoint & rollback');
  }

  // PENJAGA 2 — tolak folder instalasi dan seluruh isinya. Uninstall menghapus folder itu; repo di
  // dalamnya ikut lenyap bersama riwayatnya. Update juga menimpanya. Ini kerugian yang datang tanpa
  // suara, jadi ditolak di depan.
  const instalasi = opsi.folderInstalasi;
  if (instalasi) {
    let instalasiAsli = instalasi;
    try { instalasiAsli = (opsi.berkas?.realpath || fs.realpathSync.native)(instalasi); } catch { /* pakai apa adanya */ }
    if (diDalam(instalasiAsli, akar)) {
      return tolak('folder ini berada di dalam folder instalasi Mamet — uninstall atau update akan menghapus/menimpanya beserta seluruh riwayat git-nya');
    }
  }

  return { ok: true, akar, nama: path.basename(akar) };
}

/**
 * Akar repo yang dipakai saat aplikasi berjalan.
 *
 * Di mode pengembangan (`npm run desktop`) akar repo memang folder induk `main.cjs`, jadi dipakai
 * apa adanya — tidak ada gunanya menyuruh Owner memilih folder yang sudah pasti. Di aplikasi
 * terpasang, satu-satunya sumber yang sah adalah pilihan Owner.
 *
 * @returns {{akar:string|null, sumber:'pengembangan'|'pilihan-owner'|'belum-dipilih', alasan:string}}
 */
function akarRepoAktif({ dev, akarDev, tersimpan }) {
  if (dev && akarDev) return { akar: akarDev, sumber: 'pengembangan', alasan: '' };
  if (tersimpan) return { akar: tersimpan, sumber: 'pilihan-owner', alasan: '' };
  return {
    akar: null,
    sumber: 'belum-dipilih',
    alasan: 'Akar repo belum dipilih. Klik tombol "Pilih repo" di samping kotak chat Engineer, lalu tunjuk folder hasil "git clone" Anda. Alat repo Engineer (git, patch, checkpoint, uji klaim) mati sampai itu dilakukan.'
  };
}

module.exports = { akarRepoSah, akarRepoAktif, diDalam };

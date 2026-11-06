
const fs = require('fs');
const path = require('path');
const { akarFolderSah } = require('./pagarFolder.cjs');

const tolak = (alasan) => ({ ok: false, alasan });

function diDalam(akar, anak) {
  const rel = path.relative(akar, anak);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function akarRepoSah(dipilih, opsi = {}) {
  const dasar = (opsi.akarFolderSah || akarFolderSah)(dipilih);
  if (!dasar.ok) return dasar;
  const akar = dasar.akar;

  const ada = opsi.berkas?.ada || ((p) => fs.existsSync(p));

  if (!ada(path.join(akar, '.git'))) {
    return tolak('folder ini bukan repositori git (tidak ada ".git") — Engineer butuh riwayat git untuk checkpoint & rollback');
  }

  const instalasi = opsi.folderInstalasi;
  if (instalasi) {
    let instalasiAsli = instalasi;
    try { instalasiAsli = (opsi.berkas?.realpath || fs.realpathSync.native)(instalasi); } catch {  }
    if (diDalam(instalasiAsli, akar)) {
      return tolak('folder ini berada di dalam folder instalasi Mamet — uninstall atau update akan menghapus/menimpanya beserta seluruh riwayat git-nya');
    }
  }

  return { ok: true, akar, nama: path.basename(akar) };
}

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

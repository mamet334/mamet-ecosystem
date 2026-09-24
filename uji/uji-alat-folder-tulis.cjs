// UJI Item 85 Tahap 2 — alat tulis folder kerja (alatFolderTulis.cjs) dengan folder & junction NYATA di %TEMP%.
// Izin & Recycle Bin DITIRU: izin mengikuti skenario (setuju/tolak), "Recycle Bin" = folder sampah di luar akar.
const fs = require('fs');
const os = require('os');
const path = require('path');
const T = require('D:/SLAMET/other/mamet os ecosystem/frontend/electron/alatFolderTulis.cjs');
console.log('uji-alat-folder-tulis v1');
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

(async () => {
  const dasar = fs.mkdirSync(path.join(os.tmpdir(), `uji-tulis-${Date.now()}`), { recursive: true }) || path.join(os.tmpdir(), `uji-tulis-${Date.now()}`);
  const akar = path.join(dasar, 'proyek'); const luar = path.join(dasar, 'rahasia'); const sampah = path.join(dasar, 'sampah');
  fs.mkdirSync(path.join(akar, 'src'), { recursive: true }); fs.mkdirSync(luar); fs.mkdirSync(sampah);
  fs.writeFileSync(path.join(luar, 'kunci.txt'), 'ASLI');
  fs.writeFileSync(path.join(akar, 'src', 'app.js.txt'), 'baris satu\r\nfungsi lama()\r\nbaris tiga\r\n');
  fs.writeFileSync(path.join(akar, 'ganda.txt'), 'x = 1\nx = 1\n');
  fs.writeFileSync(path.join(akar, 'gambar.png'), Buffer.from([0x89, 0x50, 0, 0]));
  let adaJunction = true;
  try { fs.symlinkSync(luar, path.join(akar, 'pintu'), 'junction'); } catch { adaJunction = false; }

  const log = [];
  const deps = (jawab) => ({
    mintaIzin: async (p) => { log.push(p); return jawab; },
    keTempatSampah: async (a) => { fs.renameSync(a, path.join(sampah, `${path.basename(a)}-${Date.now()}`)); },
  });
  const setuju = deps(true), tolak = deps(false);
  const baca = (r) => fs.readFileSync(path.join(akar, r), 'utf8');

  try {
    // --- tulis
    let h = await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'laporan.md', isi: '# Laporan\nIsi ringkasan.\n' }, setuju);
    cek(h.ok && h.dibuat && baca('laporan.md') === '# Laporan\nIsi ringkasan.\n', 'folder_write: berkas baru dibuat sesudah izin');
    cek(log.at(-1).judul.includes('Buat berkas baru "laporan.md"') && log.at(-1).pratinjau.includes('# Laporan'), 'dialog izin: judul & pratinjau isi');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'laporan.md', isi: 'TIMPA' }, tolak);
    cek(!h.ok && h.ditolakOwner && baca('laporan.md').startsWith('# Laporan'), 'ditolak Owner → berkas tidak berubah');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'laporan.md', isi: 'Versi 2\n' }, setuju);
    cek(h.ok && !h.dibuat && baca('laporan.md') === 'Versi 2\n' && log.at(-1).berbahaya === true, 'menimpa: izin bertanda berbahaya, isi terganti');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'catatan/2026/hari.txt', isi: 'a' }, setuju);
    cek(h.ok && baca('catatan/2026/hari.txt') === 'a', 'subfolder induk dibuat di dalam pagar');
    cek(!fs.readdirSync(akar).some((n) => n.endsWith('.tmp')), 'tidak ada berkas sementara tertinggal');
    for (const [alamat, ket] of [['skrip.bat', '.bat'], ['alat.ps1', '.ps1'], ['a.js', '.js'], ['pintas.lnk', '.lnk'], ['x.exe', '.exe']]) {
      h = await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat, isi: 'echo x' }, setuju);
      cek(!h.ok && !fs.existsSync(path.join(akar, alamat)), `ekstensi ${ket} ditolak`);
    }
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'gambar.png', isi: 'teks' }, setuju)).ok, 'berkas biner tidak ditimpa');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'besar.txt', isi: 'x'.repeat(201 * 1024) }, setuju)).ok, 'isi > 200 KB ditolak');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'src', isi: 'x' }, setuju)).ok, 'menulis ke alamat folder ditolak');

    // --- edit
    const n0 = log.length;
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'src/app.js.txt', cari: 'fungsi lama()', ganti: 'fungsi baru()' }, setuju);
    cek(h.ok && baca('src/app.js.txt') === 'baris satu\r\nfungsi baru()\r\nbaris tiga\r\n' && h.baris === 2, 'folder_edit: hanya potongan diganti, CRLF & baris lain utuh');
    cek(log[n0].pratinjau.includes('SEBELUM:\nfungsi lama()') && log[n0].pratinjau.includes('SESUDAH:\nfungsi baru()'), 'dialog edit: sebelum → sesudah');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'src/app.js.txt', cari: 'baris satu\nfungsi baru()', ganti: 'baris SATU\nfungsi baru()' }, setuju);
    cek(h.ok && baca('src/app.js.txt').startsWith('baris SATU\r\nfungsi baru()'), 'potongan multi-baris LF dari model cocok dengan berkas CRLF');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'ganda.txt', cari: 'x = 1', ganti: 'x = 2' }, setuju)).ok && baca('ganda.txt') === 'x = 1\nx = 1\n', 'potongan muncul 2× → ditolak, berkas utuh');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'ganda.txt', cari: 'tidak ada', ganti: 'y' }, setuju)).ok, 'potongan tidak ada → ditolak');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'ganda.txt', cari: 'x = 1\nx', ganti: 'y' }, tolak);
    cek(h.ditolakOwner && baca('ganda.txt') === 'x = 1\nx = 1\n', 'edit ditolak Owner → berkas utuh');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: 'gambar.png', cari: 'P', ganti: 'Q' }, setuju)).ok, 'edit berkas biner ditolak');

    // --- mkdir, rename
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_mkdir', alamat: 'arsip' }, setuju);
    cek(h.ok && fs.statSync(path.join(akar, 'arsip')).isDirectory(), 'folder_mkdir');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_rename', alamat: 'laporan.md', ke: 'arsip/laporan-lama.md' }, setuju);
    cek(h.ok && !fs.existsSync(path.join(akar, 'laporan.md')) && baca('arsip/laporan-lama.md') === 'Versi 2\n', 'folder_rename: pindah ke subfolder');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_rename', alamat: 'ganda.txt', ke: 'arsip/laporan-lama.md' }, setuju)).ok, 'tujuan sudah ada → tidak ditimpa');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_rename', alamat: 'ganda.txt', ke: 'jalan.bat' }, setuju)).ok && fs.existsSync(path.join(akar, 'ganda.txt')), 'ganti nama menjadi .bat ditolak');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_rename', alamat: 'arsip', ke: 'arsip/dalam' }, setuju)).ok, 'folder ke dalam dirinya sendiri ditolak');

    // --- hapus
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_delete', alamat: 'ganda.txt' }, tolak);
    cek(h.ditolakOwner && fs.existsSync(path.join(akar, 'ganda.txt')), 'hapus ditolak Owner → berkas masih ada');
    h = await T.jalankanAlatTulis(akar, { alat: 'folder_delete', alamat: 'ganda.txt' }, setuju);
    cek(h.ok && h.keRecycleBin && !fs.existsSync(path.join(akar, 'ganda.txt')) && fs.readdirSync(sampah).some((n) => n.startsWith('ganda.txt')), 'hapus = ke "Recycle Bin", bukan permanen');
    cek(log.at(-1).berbahaya === true && /Recycle Bin/.test(log.at(-1).rincian), 'dialog hapus bertanda berbahaya & menyebut Recycle Bin');

    // --- serangan & akar
    const akarAman = [['folder_delete', { alamat: '.' }], ['folder_rename', { alamat: '.', ke: 'x' }], ['folder_write', { alamat: '.', isi: 'x' }]];
    for (const [alat, arg] of akarAman) cek(!(await T.jalankanAlatTulis(akar, { alat, ...arg }, setuju)).ok && fs.existsSync(akar), `${alat} pada akar ditolak`);
    const serang = [
      ['folder_write', { alamat: '..\\rahasia\\kunci.txt', isi: 'DIRUSAK' }, '.. ke luar'],
      ['folder_write', { alamat: path.join(luar, 'kunci.txt'), isi: 'DIRUSAK' }, 'alamat absolut'],
      ['folder_edit', { alamat: '..\\rahasia\\kunci.txt', cari: 'ASLI', ganti: 'DIRUSAK' }, 'edit ke luar'],
      ['folder_delete', { alamat: '..\\rahasia\\kunci.txt' }, 'hapus ke luar'],
      ['folder_rename', { alamat: 'src/app.js.txt', ke: '..\\rahasia\\curian.txt' }, 'pindah ke luar'],
      ['folder_write', { alamat: 'C:\\Windows\\mamet.txt', isi: 'x' }, 'C:\\Windows'],
      ['folder_write', { alamat: 'CON', isi: 'x' }, 'nama perangkat'],
      ['folder_write', { alamat: 'a.txt:tersembunyi', isi: 'x' }, 'aliran data'],
    ];
    if (adaJunction) serang.push(['folder_write', { alamat: 'pintu/kunci.txt', isi: 'DIRUSAK' }, 'lewat junction'], ['folder_delete', { alamat: 'pintu/kunci.txt' }, 'hapus lewat junction']);
    const nIzin = log.length;
    for (const [alat, arg, ket] of serang) {
      const r = await T.jalankanAlatTulis(akar, { alat, ...arg }, setuju);
      cek(!r.ok, `ditolak pagar: ${ket} (${r.alasan})`);
    }
    cek(log.length === nIzin, 'serangan ditolak SEBELUM dialog izin muncul');
    cek(fs.readFileSync(path.join(luar, 'kunci.txt'), 'utf8') === 'ASLI' && fs.readdirSync(luar).length === 1, 'berkas di luar folder kerja utuh');
    cek(!(await T.jalankanAlatTulis(akar, { alat: 'folder_write', alamat: 'x.txt', isi: 'x' }, {})).ok, 'tanpa dialog izin → tidak ada yang ditulis');
    cek(!(await T.jalankanAlatTulis(null, { alat: 'folder_write', alamat: 'x.txt', isi: 'x' }, setuju)).ok, 'tanpa folder kerja → ditolak');
  } finally {
    try { fs.unlinkSync(path.join(akar, 'pintu')); } catch { try { fs.rmSync(path.join(akar, 'pintu'), { force: true }); } catch { /* */ } }
    fs.rmSync(dasar, { recursive: true, force: true });
  }
  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
  process.exit(gagal ? 1 : 0);
})();

// UJI Item 85 Tahap 1 — alat baca folder kerja (alatFolder.cjs) dengan folder, berkas, & junction NYATA di %TEMP%.
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('D:/SLAMET/other/mamet os ecosystem/frontend/electron/alatFolder.cjs');
console.log('uji-alat-folder v2'); // v2: pemeriksaan "baca saja" dengan potret isi folder
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

const dasar = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-alat-folder-'));
const akar = path.join(dasar, 'proyek');
const luar = path.join(dasar, 'rahasia');
fs.mkdirSync(path.join(akar, 'src', 'lib'), { recursive: true });
fs.mkdirSync(path.join(akar, 'node_modules', 'paket'), { recursive: true });
fs.mkdirSync(luar);
fs.writeFileSync(path.join(luar, 'kunci.txt'), 'RAHASIA-JANGAN-TERBACA');
fs.writeFileSync(path.join(akar, 'README.md'), '# Proyek Uji\nFungsi utama ada di src/app.js\n');
fs.writeFileSync(path.join(akar, 'src', 'app.js'), 'function hitungGaji(pegawai) {\n  return pegawai.gaji * 12;\n}\nmodule.exports = { hitungGaji };\n');
fs.writeFileSync(path.join(akar, 'src', 'lib', 'util.js'), 'export const rapat = (s) => s.trim();\n// hitungGaji dipanggil di app.js\n');
fs.writeFileSync(path.join(akar, 'node_modules', 'paket', 'index.js'), 'hitungGaji palsu di node_modules');
fs.writeFileSync(path.join(akar, 'gambar.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d]));
fs.writeFileSync(path.join(akar, 'laporan.pdf'), '%PDF-1.4 palsu');
fs.writeFileSync(path.join(akar, 'panjang.txt'), Array.from({ length: 1000 }, (_, i) => `baris ${i + 1}`).join('\n'));
fs.writeFileSync(path.join(akar, 'besar.txt'), 'x'.repeat(200 * 1024));
let adaJunction = true;
try { fs.symlinkSync(luar, path.join(akar, 'pintu-belakang'), 'junction'); } catch (e) { adaJunction = false; console.log('   (junction tidak bisa dibuat:', e.code, ')'); }

const potret = () => JSON.stringify(fs.readdirSync(akar, { recursive: true }).sort());
const sebelum = potret();
try {
  // --- folder_list
  const l = A.jalankanAlat(akar, { alat: 'folder_list', alamat: '.' });
  const alamat = l.entri.map((e) => e.alamat);
  cek(l.ok && alamat.includes('src/app.js') && alamat.includes('src/lib/util.js') && alamat.includes('README.md'), 'folder_list: berkas & subfolder, alamat relatif bergaris miring');
  cek(l.entri.find((e) => e.alamat === 'node_modules')?.dilewati === true && !alamat.some((a) => a.startsWith('node_modules/')), 'node_modules ditandai dilewati, isinya tidak didaftar');
  cek(!alamat.some((a) => a.startsWith('pintu-belakang')), 'junction ke luar tidak ikut didaftar');
  cek(!JSON.stringify(l).includes(dasar) && !JSON.stringify(l).includes('\\'), 'hasil tanpa alamat lengkap / backslash');

  // --- folder_read
  const r = A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'src/app.js' });
  cek(r.ok && r.isi.includes('hitungGaji') && r.totalBaris === 5, 'folder_read: isi berkas utuh');
  const r2 = A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'panjang.txt', dari: 500, sampai: 502 });
  cek(r2.ok && r2.isi === 'baris 500\nbaris 501\nbaris 502' && r2.dari === 500 && r2.sampai === 502, 'rentang baris dari/sampai');
  const r3 = A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'panjang.txt' });
  cek(r3.ok && r3.terpotong && r3.sampai === 400, `batas 400 baris per baca (sampai ${r3.sampai}, terpotong)`);
  const r4 = A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'besar.txt' });
  cek(r4.ok && r4.terpotong && Buffer.byteLength(r4.isi) <= 60 * 1024, 'batas 60 KB per baca');
  cek(!A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'gambar.png' }).ok, 'berkas biner ditolak');
  const pdf = A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'laporan.pdf' });
  cek(!pdf.ok && /📎/.test(pdf.alasan), 'PDF diarahkan ke 📎 / RAG');
  cek(!A.jalankanAlat(akar, { alat: 'folder_read', alamat: 'src' }).ok, 'membaca folder sebagai berkas ditolak');

  // --- folder_search
  const s = A.jalankanAlat(akar, { alat: 'folder_search', kueri: 'hitunggaji', alamat: '.' });
  const tempat = s.temuan.map((t) => `${t.alamat}:${t.baris}`);
  cek(s.ok && tempat.includes('src/app.js:1') && tempat.includes('src/lib/util.js:2'), `folder_search menemukan di app.js:1 & util.js:2 (${tempat.join(', ')})`);
  cek(!tempat.some((t) => t.startsWith('node_modules')), 'pencarian tidak masuk node_modules');
  cek(!A.jalankanAlat(akar, { alat: 'folder_search', kueri: 'RAHASIA', alamat: '.' }).temuan.length, 'isi di balik junction tidak ikut dicari');

  // --- serangan pagar
  const serang = [
    ['..\\rahasia\\kunci.txt', 'naik ke luar (..)'],
    ['src/../../rahasia/kunci.txt', '.. di tengah'],
    [path.join(luar, 'kunci.txt'), 'alamat absolut ke luar'],
    ['C:\\Windows\\win.ini', 'C:\\Windows'],
    ['C:Windows\\win.ini', 'relatif-drive'],
    ['\\\\?\\C:\\Windows\\win.ini', 'awalan \\\\?\\'],
    ['CON', 'nama perangkat'],
    ['README.md:rahasia', 'aliran data tersembunyi'],
  ];
  if (adaJunction) serang.push(['pintu-belakang/kunci.txt', 'lewat junction ke luar']);
  for (const [alamat, ket] of serang) {
    const h = A.jalankanAlat(akar, { alat: 'folder_read', alamat });
    cek(!h.ok && !String(h.isi || '').includes('RAHASIA'), `ditolak: ${ket} (${h.alasan})`);
  }
  cek(!A.jalankanAlat(akar, { alat: 'folder_list', alamat: '..' }).ok, 'folder_list ".." ditolak');
  cek(!A.jalankanAlat(null, { alat: 'folder_list', alamat: '.' }).ok, 'tanpa folder kerja → ditolak');
  cek(!A.jalankanAlat(akar, { alat: 'folder_write', alamat: 'x.txt' }).ok, 'alat tulis (belum ada di Tahap 1) ditolak');
  cek(potret() === sebelum, 'isi folder sama persis sebelum & sesudah semua alat (baca saja)');
} finally {
  try { fs.rmSync(path.join(akar, 'pintu-belakang'), { force: true, recursive: false }); } catch { try { fs.unlinkSync(path.join(akar, 'pintu-belakang')); } catch { /* */ } }
  fs.rmSync(dasar, { recursive: true, force: true });
}
console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

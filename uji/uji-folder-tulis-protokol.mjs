// UJI Item 85 Tahap 2 — protokol alat TULIS (folderKerjaAlat.js): tag tulis, hasil berhasil/ditolak Owner, blok prompt.
import { pathToFileURL } from 'node:url';
const F = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/folderKerjaAlat.js').href + '?v=' + Date.now());
console.log('uji-folder-tulis-protokol v3'); // v2: Tahap 3 (folder_run sah) · v3: laporan tulis kini sumber label (isi = baris hasil saja)
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

// Tag tulis seperti yang ditulis model: isi berbaris baru (\n di JSON), kutip di dalam isi, edit multi-baris
const isiLaporan = '# Laporan\n\nRingkasan: "Vektor Engine" v4.0.\n';
let r = F.ambilPermintaanAlat(`Saya buat laporannya.\n<alat_folder>${JSON.stringify({ alat: 'folder_write', alamat: 'laporan.md', isi: isiLaporan })}</alat_folder>`);
cek(r.permintaan.length === 1 && r.permintaan[0].isi === isiLaporan, 'folder_write: isi utuh (baris baru & kutip) — tidak dipotong');
r = F.ambilPermintaanAlat(`<alat_folder>${JSON.stringify({ alat: 'folder_edit', alamat: 'core/math.go', cari: 'if normA == 0 {\n\treturn 0, nil\n}', ganti: 'if normA == 0 || normB == 0 {\n\treturn 0, nil\n}' })}</alat_folder>`);
cek(r.permintaan[0].alat === 'folder_edit' && r.permintaan[0].cari.includes('\treturn') && r.permintaan[0].ganti.includes('normB'), 'folder_edit: cari/ganti multi-baris ber-tab');
r = F.ambilPermintaanAlat('<alat_folder>{"alat":"folder_rename","alamat":"a.txt","ke":"arsip/a.txt"}</alat_folder><alat_folder>{"alat":"folder_delete","alamat":"coba.txt"}</alat_folder><alat_folder>{"alat":"folder_mkdir","alamat":"arsip"}</alat_folder>');
cek(r.permintaan.map((p) => p.alat).join() === 'folder_rename,folder_delete,folder_mkdir' && r.permintaan[0].ke === 'arsip/a.txt', 'rename/delete/mkdir terbaca berurutan');
cek(F.ambilPermintaanAlat('<alat_folder>{"alat":"folder_shell","perintah":"dir"}</alat_folder>').permintaan.length === 0, 'alat tak dikenal (folder_shell) → ditolak');
const besar = 'x'.repeat(300 * 1024);
cek(F.ambilPermintaanAlat(`<alat_folder>${JSON.stringify({ alat: 'folder_write', alamat: 'b.txt', isi: besar })}</alat_folder>`).permintaan[0].isi.length === besar.length, 'isi besar tidak dipotong diam-diam (proses utama yang menolak dengan alasan)');

// Hasil
const berhasil = F.uraiHasil({ ok: true, alat: 'folder_write', alamat: 'laporan.md', dibuat: true, byte: 42 });
cek(berhasil.includes('BERHASIL (disetujui Owner)') && berhasil.includes('berkas baru dibuat (42 byte)'), 'hasil tulis berhasil');
const tolak = F.uraiHasil({ ok: false, alat: 'folder_delete', alamat: 'coba.txt', ditolakOwner: true, alasan: 'x' });
cek(tolak.includes('DITOLAK OWNER') && tolak.includes('Jangan mengulang'), 'ditolak Owner: dilaporkan + larangan mengulang');
cek(F.uraiHasil({ ok: true, alat: 'folder_delete', alamat: 'coba.txt' }).includes('Recycle Bin'), 'hapus berhasil menyebut Recycle Bin');
cek(F.uraiHasil({ ok: false, alat: 'folder_write', alamat: 'x.bat', alasan: 'ekstensi .bat bisa dijalankan' }).includes('DITOLAK/GAGAL: ekstensi .bat'), 'penolakan pagar tetap berbentuk lama');
// v3 (Tahap 3, keputusan Owner): laporan tulis menjadi sumber label — tetapi isinya hanya BARIS HASIL, bukan isi berkas
// yang ditulis model (isi itu karangan model sendiri, tak boleh menjadi bukti angka).
const pesan = F.susunPesanHasil([{ ok: true, alat: 'folder_write', alamat: 'laporan.md', dibuat: true, byte: 42 }], { putaran: 1, pertanyaanAsli: 'buat laporan' });
const sTulis = F.sumberDariHasilAlat([pesan]);
cek(sTulis.judul.join() === 'laporan.md' && sTulis.isi.length === 1 && sTulis.isi[0].startsWith('### folder_write laporan.md\nBERHASIL'), 'berkas yang DITULIS: judul = alamat, isi = baris hasil saja');

// Blok prompt
const b = F.blokPromptFolder('engine', 0);
cek(b.includes('UBAH (setiap alat memunculkan dialog izin') && b.includes('folder_write') && b.includes('folder_edit') && b.includes('Recycle Bin'), 'blok prompt: alat ubah + izin + Recycle Bin');
cek(b.includes('JANGAN mengaku sudah menyimpan') && b.includes('Ubah HANYA yang diminta'), 'blok prompt: jujur & hanya yang diminta');
cek(b.includes('.bat') && b.includes('folder_run'), 'blok prompt: ekstensi terlarang & alat perintah');
cek(!b.includes('baca saja — belum bisa menulis'), 'kalimat Tahap 1 "baca saja" sudah diganti');
cek(b.includes('ditulis \\n'), 'petunjuk escape JSON tertulis sebagai \\n (bukan baris baru)');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

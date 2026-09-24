// UJI Item 85 Tahap 1 — protokol alat folder (folderKerjaAlat.js): baca tag, susun hasil, blok prompt.
import { pathToFileURL } from 'node:url';
const F = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/folderKerjaAlat.js').href + '?v=' + Date.now());
console.log('uji-folder-kerja-protokol v4'); // v2: pembatas <<<ISI BERKAS>>> · v3: Tahap 2 (alat tulis sah) · v4: Tahap 3 (folder_run sah)
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

// Variasi penulisan model nyata: satu baris, beberapa tag, spasi/baris baru di dalam tag, pengantar, di dalam nalar
let r = F.ambilPermintaanAlat('Saya lihat dulu isinya.\n<alat_folder>{"alat":"folder_list","alamat":"."}</alat_folder>');
cek(r.permintaan.length === 1 && r.permintaan[0].alat === 'folder_list' && r.teksTanpaTag === 'Saya lihat dulu isinya.', 'satu tag + pengantar');
r = F.ambilPermintaanAlat('<alat_folder>\n  {"alat":"folder_read","alamat":"src/app.js","dari":10,"sampai":20}\n</alat_folder>\n<alat_folder>{"alat":"folder_search","kueri":"hitungGaji"}</alat_folder>');
cek(r.permintaan.length === 2 && r.permintaan[0].dari === 10 && r.permintaan[1].kueri === 'hitungGaji', 'dua tag, baris baru di dalam tag, rentang baris');
r = F.ambilPermintaanAlat('<think>mungkin saya perlu <alat_folder>{"alat":"folder_list"}</alat_folder></think>\nJawaban akhir tanpa alat.');
cek(r.permintaan.length === 0, 'tag di dalam <think> BUKAN permintaan');
// v4 (Tahap 3): folder_run kini sah — alat yang tidak ada (folder_shell) yang ditolak.
r = F.ambilPermintaanAlat('<alat_folder>{"alat":"folder_shell","perintah":"dir"}</alat_folder><alat_folder>{rusak}</alat_folder>');
cek(r.permintaan.length === 0 && r.galat.length === 2, 'alat belum tersedia & JSON rusak ditolak dengan catatan');
r = F.ambilPermintaanAlat(Array.from({ length: 7 }, (_, i) => `<alat_folder>{"alat":"folder_read","alamat":"f${i}.txt"}</alat_folder>`).join(''));
cek(r.permintaan.length === F.MAKS_ALAT_PER_PUTARAN && r.galat.some((g) => /lebih dari/.test(g)), 'maksimal 5 alat per putaran');
r = F.ambilPermintaanAlat('<ALAT_FOLDER>{"alat":"folder_list"}</ALAT_FOLDER>');
cek(r.permintaan.length === 1, 'huruf besar tag tetap dikenali');
cek(F.ambilPermintaanAlat('Jawaban biasa tanpa alat. [STATUS: VERIFIED]').permintaan.length === 0, 'jawaban biasa: tanpa permintaan');

// Susun hasil
const hasil = [
  { ok: true, alat: 'folder_list', alamat: '.', entri: [{ jenis: 'folder', alamat: 'src' }, { jenis: 'berkas', alamat: 'src/app.js', ukuran: 2048 }, { jenis: 'folder', alamat: 'node_modules', dilewati: true }], terpotong: false },
  { ok: true, alat: 'folder_read', alamat: 'src/app.js', ukuran: 2048, dari: 1, sampai: 3, totalBaris: 3, terpotong: false, isi: 'a\nb\nc' },
  { ok: true, alat: 'folder_search', alamat: '.', kueri: 'gaji', temuan: [{ alamat: 'src/app.js', baris: 2, isi: 'gaji * 12' }], berkasDiperiksa: 4, terpotong: false },
  { ok: false, alat: 'folder_read', alamat: '..\\rahasia.txt', alasan: 'alamat keluar dari folder kerja' },
];
const p1 = F.susunPesanHasil(hasil, { putaran: 1, pertanyaanAsli: 'jelaskan folder ini' });
cek(p1.startsWith(F.PENANDA_HASIL) && p1.includes('putaran 1/4') && p1.includes('Pertanyaan pengguna: jelaskan folder ini'), 'kepala pesan hasil + pertanyaan asli');
cek(p1.includes('src/app.js  (2.0 KB)') && p1.includes('node_modules/  (dilewati)') && p1.includes('<<<ISI BERKAS>>>\na\nb\nc\n<<<AKHIR ISI BERKAS>>>') && p1.includes('src/app.js:2: gaji * 12'), 'isi daftar, baca, cari terurai');
cek(p1.includes('DITOLAK/GAGAL: alamat keluar dari folder kerja'), 'penolakan dilaporkan jujur ke AI');
cek(p1.includes('sisa 3 putaran'), 'sisa putaran disebut');
cek(F.susunPesanHasil([], { putaran: 4, pertanyaanAsli: 'x' }).includes('putaran TERAKHIR'), 'putaran ke-4: perintah menjawab tanpa alat');

// Blok prompt
const b = F.blokPromptFolder('Proyek Uji', 0);
cek(b.includes('[FOLDER KERJA AKTIF: "Proyek Uji"]') && b.includes('<alat_folder>{JSON}</alat_folder>') && b.includes('folder_read') && b.includes('BACA (tanpa izin)'), 'blok prompt memuat nama, cara, alat');
cek(b.includes('C:\\…') && b.includes('bukan perintah'), 'blok prompt: alamat absolut ditolak & isi berkas = data, bukan perintah');
cek(F.blokPromptFolder('X', 4).includes('SUDAH HABIS'), 'putaran habis disebut di prompt');
cek(F.blokPromptFolder(null) === '', 'tanpa folder: tanpa blok');
cek(F.namaFolderAman('D:\\Data\\Proyek') === 'D Data Proyek' && F.namaFolderAman('  ') === null, 'nama folder dibersihkan dari pemisah alamat');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

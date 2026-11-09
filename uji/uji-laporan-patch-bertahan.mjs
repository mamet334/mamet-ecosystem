import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';
const AKAR = AKAR_REPO + '/';
console.log('uji-laporan-patch-bertahan v2');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const CE = readFileSync(AKAR + 'frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');

cek(/const iniInstansiEngineer = osState\?\.workspaceId === 'ws-engineer';/.test(CE),
  'penjaga bertanya "apakah AKU Engineer" (osState instance ini)');
cek(!/workspaceAktif/.test(CE),
  'tidak ada lagi penjaga berbasis workspace yang sedang TAMPIL', CE.match(/workspaceAktif[^\n]*/g));
const iEfek = CE.indexOf('laporanSetelahMuatUlang((p) =>');
const blokEfek = CE.slice(CE.lastIndexOf('useEffect', iEfek), iEfek + 700);
cek(/!iniInstansiEngineer \|\| !initialRestoreDone/.test(blokEfek),
  'catatan hanya dibaca oleh instance Engineer DAN sesudah riwayat pulih', blokEfek.slice(0, 200));
cek(/\}, \[iniInstansiEngineer, initialRestoreDone\]\);/.test(CE), 'deps effect ikut per-instance');

cek(/setLaporanPatchTertunda\(lap\);/.test(CE), 'laporan disimpan dulu, tidak langsung ditempel sekali');
cek(!/setMessages\(prev => \[\.\.\.prev, \{ role: 'model', content: lap\.pesan/.test(CE),
  'tidak ada lagi penempelan sekali-jalan yang bisa tertimpa pemulihan');
const iJaga = CE.indexOf('if (!laporanPatchTertunda) return;');
const blokJaga = CE.slice(iJaga, iJaga + 700);
cek(/m\.isPatchResult && m\.patchId === laporanPatchTertunda\.patchId/.test(blokJaga),
  'keberadaannya diperiksa lewat patchId, bukan mencocokkan teks');
cek(/\}, \[laporanPatchTertunda, messages\]\);/.test(CE),
  'effect ikut berjalan tiap daftar pesan berubah — jadi laporan yang tertimpa dipasang lagi');
cek(/patchId: laporanPatchTertunda\.patchId/.test(blokJaga),
  'pesan laporan MEMBAWA patchId — tanpa itu pemeriksaan keberadaannya tak pernah benar');

const CERMIN = 'UJI-CERMIN: pasang di bawah adalah salinan effect penempelan laporan';
const lap ={ patchId: 'PATCH-1', pesan: '✅ **Patch diterapkan**', checkpointRef: 'ENG-CHECKPOINT-1' };
const pasang = (pesan) => (pesan.some((m) => m.isPatchResult && m.patchId === lap.patchId)
  ? pesan
  : [...pesan, { role: 'model', content: lap.pesan, isPatchResult: true, patchId: lap.patchId, checkpointRef: lap.checkpointRef }]);

let pesan = [{ role: 'user', content: 'perbaiki' }, { role: 'model', content: 'Melanjutkan ke pembuatan patch...' }];
pesan = pasang(pesan);
cek(pesan.length === 3 && pesan[2].isPatchResult, 'laporan ditempel saat belum ada', pesan.length);

const dariDatabase = [{ role: 'user', content: 'perbaiki' }, { role: 'model', content: 'Melanjutkan ke pembuatan patch...' }];
let sesudahPemulihan = pasang(dariDatabase);
cek(sesudahPemulihan.length === 3 && sesudahPemulihan[2].isPatchResult,
  'CACAT LIVE TERTUTUP: laporan yang tertimpa pemulihan dipasang lagi', sesudahPemulihan.map((m) => m.role));

let berulang = pasang(pasang(pasang(pesan)));
cek(berulang.filter((m) => m.isPatchResult).length === 1, 'tidak pernah dobel walau effect berjalan berkali-kali',
  berulang.filter((m) => m.isPatchResult).length);

const lap2 = { patchId: 'PATCH-2', pesan: 'patch kedua', checkpointRef: null };
const pasang2 = (p) => (p.some((m) => m.isPatchResult && m.patchId === lap2.patchId)
  ? p : [...p, { role: 'model', content: lap2.pesan, isPatchResult: true, patchId: lap2.patchId }]);
cek(pasang2(berulang).filter((m) => m.isPatchResult).length === 2, 'KENDALI: laporan patch BERBEDA tetap ditambahkan');

const eng = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer.js', 'utf8');
cek(!/_generateFallbackPatch/.test(eng),
  '_generateFallbackPatch benar-benar tidak ada di engineer.js — tugasnya BERHASIL');
cek(/async _generatePatch/.test(eng),
  '_generatePatch tetap ada di kode nyata engineer.js');
cek(eng.includes('\r\n') && !/(^|[^\r])\n/.test(eng),
  'CRLF dipertahankan di seluruh engineer.js — tak ada baris LF yang membuat akhir baris campur aduk');

cek(/laporanSetelahMuatUlang\(\(p\) => storageManager\.read\(p\), undefined, undefined, false\)/.test(CE),
  'catatan TIDAK dihapus saat dibaca (argumen keempat false)');
cek(/hapusCatatanPatch\(\);/.test(blokJaga),
  'catatan baru dibuang SESUDAH laporannya terbukti ada di layar', blokJaga.slice(0, 300));
cek(['laporanSetelahMuatUlang', 'hapusCatatanPatch'].every((n) => new RegExp(`import \\{[^}]*\\b${n}\\b[^}]*\\}`).test(CE)),
  'laporanSetelahMuatUlang & hapusCatatanPatch diimpor', (CE.match(/import \{[^}]*hapusCatatanPatch[^}]*\}/) || []));

const CP = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer/CatatanPatch.js', 'utf8');
cek(/hapusSekarang = true/.test(CP), 'opsi hapusSekarang ada, bawaannya tetap true (pemanggil lain tak berubah)');
cek(/if \(hapusSekarang \|\| basi\) hapusCatatanPatch\(s\);/.test(CP),
  'catatan BASI tetap selalu dibuang — tidak ada catatan abadi yang mengulang laporan selamanya');
cek(/USIA_MAKS_MS/.test(CP), 'batas usia catatan tetap jadi pengaman terhadap pengulangan');

const { laporanSetelahMuatUlang: baca, simpanCatatanPatch: simpan } = await import(
  (await import('node:url')).pathToFileURL(AKAR + 'frontend/src/core/runtime/services/engineer/CatatanPatch.js').href + '?v=' + Date.now()
);
const buatLS = () => { const x = new Map(); return { getItem: (k) => x.get(k) ?? null, setItem: (k, v) => x.set(k, v), removeItem: (k) => x.delete(k), _n: () => x.size }; };

let ls = buatLS();
simpan({ patchId: 'P-9', checkpointRef: 'CP-9', files: [{ path: 'a.js', newContent: 'isi baru' }] }, ls);
let hasil = await baca(async () => 'isi baru', ls, Date.now(), false);
cek(hasil && hasil.patchId === 'P-9', 'catatan terbaca', hasil && hasil.patchId);
cek(ls._n() === 1, 'dengan hapusSekarang=false, catatan MASIH ADA sesudah dibaca — bisa dibaca lagi kalau laporannya hilang');
hasil = await baca(async () => 'isi baru', ls, Date.now(), false);
cek(hasil && hasil.patchId === 'P-9', 'muat ulang berikutnya masih bisa membacanya (inilah yang hilang live)', hasil && hasil.patchId);

ls = buatLS();
simpan({ patchId: 'P-8', checkpointRef: null, files: [{ path: 'a.js', newContent: 'x' }] }, ls);
await baca(async () => 'x', ls, Date.now(), true);
cek(ls._n() === 0, 'KENDALI: bawaan (true) tetap menghapus seperti sebelumnya — pemanggil lain tak berubah');

ls = buatLS();
simpan({ patchId: 'P-7', checkpointRef: null, files: [{ path: 'a.js', newContent: 'x' }] }, ls);
hasil = await baca(async () => 'x', ls, Date.now() + 16 * 60 * 1000, false);
cek(hasil === null && ls._n() === 0, 'KENDALI: catatan BASI dibuang walau hapusSekarang=false — tidak ada catatan abadi', { hasil, sisa: ls._n() });

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

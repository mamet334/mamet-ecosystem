// UJI 2026-09-28 — Tahap 6: verifikasi patch yang DIJALANKAN, bukan dicocokkan.
//
// Yang dijaga di sini ada tiga lapis, dan lapis ketiga yang paling penting:
//   1. PENJALAN  — golongan hasil, dan ia HARUS BISA MERAH (langkah 8: uji yang tak bisa gagal itu hiasan)
//   2. PUTUSAN   — kapan memulihkan, dan cara memisahkan "rusak oleh patch" dari "sudah rusak sebelumnya"
//   3. TERPASANG — executePatchApplication yang SUNGGUHAN memanggilnya dan benar-benar berubah perilakunya
//
// Lapis ketiga ada karena dua kali dalam satu hari (24 September) uji lulus sementara fiturnya rusak:
// yang diperiksa hanya "fungsinya benar", bukan "fungsinya dipanggil".

import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const ENG = `${AKAR}/frontend/src/core/runtime/services/engineer/`;
const V = await import(pathToFileURL(ENG + 'VerifikasiPatch.js').href + '?v=' + Date.now());
const PA = await import(pathToFileURL(ENG + 'PatchApplier.js').href + '?v=' + Date.now());
const R = await import(pathToFileURL(`${AKAR}/uji/jalankan-semua.mjs`).href + '?v=' + Date.now());

console.log('uji-verifikasi-tahap6 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. PENJALAN ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- penjalan uji --');

cek(R.golongkan({ kodeKeluar: 0, barisTerakhir: 'SEMUA LULUS' }) === 'LULUS', 'SEMUA LULUS + kode 0 → LULUS');
cek(R.golongkan({ kodeKeluar: 1, barisTerakhir: '3 GAGAL' }) === 'GAGAL', '3 GAGAL → GAGAL');
cek(R.golongkan({ kodeKeluar: 0, barisTerakhir: 'DILEWATI — folder tidak ada' }) === 'DILEWATI', 'DILEWATI dikenali, bukan dihitung gagal');
cek(R.golongkan({ kodeKeluar: 0, barisTerakhir: 'SEMUA LULUS', habisWaktu: true }) === 'GAGAL', 'habis waktu selalu GAGAL walau sempat mencetak lulus');
// Cacat live 28 Sep: lima berkas dinyatakan gagal karena peringatan node di stderr jadi baris terakhir.
cek(R.golongkan({ kodeKeluar: 0, barisTerakhir: '(Use `node --trace-warnings ...`)' }) === 'GAGAL'
  && R.golongkan({ kodeKeluar: 0, barisTerakhir: 'SEMUA LULUS' }) === 'LULUS',
  'putusan hanya dari baris kesimpulan — peringatan bukan kesimpulan');

const daftar = R.daftarBerkasUji();
cek(daftar.length >= 50, `seluruh berkas uji ditemukan (${daftar.length})`);
cek(!daftar.includes('jalankan-semua.mjs'), 'penjalan tidak menjalankan dirinya sendiri');
cek(!daftar.some((n) => n.endsWith('.js')), 'berkas uji-*.js TIDAK dijalankan (modul konsol DevTools, bukan uji baris perintah)');
const takJalan = R.daftarTakDijalankan().map((x) => x.nama);
cek(takJalan.includes('uji-pengambilan.js'),
  'tetapi ia DILAPORKAN, tidak disembunyikan — pengecualian diam adalah cara uji merah tak ketahuan 4 hari', takJalan);

// Prasyarat roadmap: uji cermin ditandai, bukan dihapus.
for (const n of ['uji-patch-crlf.mjs', 'uji-temuan-terpasang-v2.mjs', 'uji-laporan-patch-bertahan.mjs']) {
  cek(R.ujiCermin(n) === true, `uji cermin ditandai: ${n}`);
}
cek(R.ujiCermin('uji-pagar-immutable.mjs') === false, 'uji yang memanggil kode sungguhan TIDAK ikut ditandai cermin');

// UJI KENDALI — penjalan ini harus bisa MERAH. Berkas sementara yang sengaja gagal.
const berkasPalsu = path.join(AKAR, 'uji', 'uji-zzz-sengaja-gagal.mjs');
try {
  writeFileSync(berkasPalsu, "console.log('uji-zzz v1');\nconsole.log('1 GAGAL');\nprocess.exit(1);\n", 'utf8');
  const keluar = path.join(AKAR, 'uji', 'hasil-kendali-tahap6.json');
  try { execFileSync(process.execPath, [`${AKAR}/uji/jalankan-semua.mjs`, `--keluar=${keluar}`, 'uji-zzz-sengaja-gagal.mjs'], { stdio: 'ignore' }); }
  catch { /* kode keluar 1 memang yang diharapkan */ }
  const h = JSON.parse(readFileSync(keluar, 'utf8'));
  unlinkSync(keluar);
  cek(h.gagal.length === 1 && h.gagal[0].nama === 'uji-zzz-sengaja-gagal.mjs', 'KENDALI: berkas uji yang gagal sungguhan tertangkap MERAH', h.gagal);
  cek(/1 GAGAL/.test(h.gagal[0].keluaran || ''), 'keluarannya ikut dibawa apa adanya, bukan diringkas', h.gagal[0]);
} finally {
  if (existsSync(berkasPalsu)) unlinkSync(berkasPalsu);
}

// ── 2. PUTUSAN ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- putusan --');

const hijau = { total: 50, lulus: 50, detik: 16.7, gagal: [], dilewati: [], cermin: ['uji-patch-crlf.mjs'] };
const merah = { total: 50, lulus: 48, detik: 17, dilewati: [], cermin: [], gagal: [
  { nama: 'uji-konteks-chat.mjs', barisTerakhir: '2 GAGAL', keluaran: 'GAGAL  jalur kirim memakai pilihan beranggaran' },
  { nama: 'uji-folder-label.mjs', barisTerakhir: '1 GAGAL', keluaran: 'GAGAL  sumber terminal' },
] };

cek(V.putusanVerifikasi(hijau).status === 'AMAN' && V.putusanVerifikasi(hijau).pulihkan === false, 'semua lulus → AMAN, tidak dipulihkan');
cek(V.putusanVerifikasi(merah).pulihkan === true, 'ada yang gagal → dipulihkan');
// Verifikasi yang TIDAK TERJADI bukan bukti patch merusak — memulihkan karenanya adalah menghukum tanpa bukti.
for (const buruk of [{ galat: 'node tidak terpasang' }, null, undefined]) {
  const p = V.putusanVerifikasi(buruk);
  cek(p.status === 'TAK_TERVERIFIKASI' && p.pulihkan === false, `uji tak bisa dijalankan (${JSON.stringify(buruk)}) → TIDAK dipulihkan`);
}

// Inti rancangan: memisahkan "rusak oleh patch" dari "sudah merah sebelum patch".
const pilah = V.pilahSebab(['uji-konteks-chat.mjs', 'uji-folder-label.mjs'], {
  gagal: [{ nama: 'uji-folder-label.mjs', barisTerakhir: '1 GAGAL', keluaran: '' }],
});
cek(pilah.karenaPatch.join() === 'uji-konteks-chat.mjs', 'lulus lagi sesudah dipulihkan → rusak OLEH patch', pilah);
cek(pilah.sudahRusak.join() === 'uji-folder-label.mjs', 'masih gagal sesudah dipulihkan → sudah rusak SEBELUM patch', pilah);
cek(V.pilahSebab(['a.mjs'], { gagal: [] }).karenaPatch.join() === 'a.mjs', 'tanpa sisa kegagalan, semuanya karena patch');

// ── 3. LAPORAN ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- laporan --');

const lapAman = V.laporanVerifikasi({ sesudahPatch: hijau });
cek(/50\/50/.test(lapAman), 'laporan hijau menyebut angka sebenarnya', lapAman);
cek(/cermin/i.test(lapAman), 'laporan hijau TETAP menyebut uji cermin — "semua hijau" tak boleh berarti lebih dari yang dibuktikan');
cek(/tidak merusak yang sudah terbukti/i.test(lapAman) && /bukan \*patch ini benar\*/i.test(lapAman),
  'batas yang dijanjikan tertulis, bukan disiratkan', lapAman);

const lapMerah = V.laporanVerifikasi({
  sesudahPatch: merah, dipulihkan: true,
  sesudahPulih: { gagal: [{ nama: 'uji-folder-label.mjs', barisTerakhir: '1 GAGAL', keluaran: '' }] },
});
cek(/DIKEMBALIKAN/.test(lapMerah), 'laporan merah mengatakan berkas sudah dikembalikan sendiri');
cek(/uji-konteks-chat\.mjs/.test(lapMerah) && /jalur kirim memakai pilihan beranggaran/.test(lapMerah),
  'berkas uji yang gagal DISEBUT NAMANYA beserta keluarannya (constitution/28 PRINSIP DASAR a)', lapMerah);
cek(/BUKAN karena patch ini/.test(lapMerah) && /uji-folder-label\.mjs/.test(lapMerah),
  'kegagalan yang sudah ada sebelumnya dipisahkan, tidak ditimpakan ke patch', lapMerah);

const lapPulihGagal = V.laporanVerifikasi({ sesudahPatch: merah, galatPulih: 'checkpoint tidak ditemukan' });
cek(/pemulihan gagal/i.test(lapPulihGagal) && /git diff/.test(lapPulihGagal),
  'pemulihan yang gagal dikatakan terus terang, dengan cara memeriksanya sendiri', lapPulihGagal);

const lapTak = V.laporanVerifikasi({ sesudahPatch: { galat: 'node tidak terpasang' } });
cek(/TIDAK diverifikasi/.test(lapTak) && /TIDAK dipulihkan/.test(lapTak),
  'tak terverifikasi dikatakan apa adanya — bukan "aman", bukan "merusak"', lapTak);

// ── 4. TERPASANG di PatchApplier (yang sungguhan, bukan cermin) ───────────────────────────────
console.log('\n-- terpasang di PatchApplier --');

function jalankanPatch({ verifikasi }) {
  const jejak = { tulis: [], dipanggilDengan: [], rollbackDialog: 0 };
  const deps = {
    metrics: { coreModificationsBlocked: 0, patchesApplied: 0 },
    eventBus: { emit: (n, d) => jejak.dipancarkan = { n, d } },
    storageManager: { read: async () => 'isi lama', write: async (p, isi) => { jejak.tulis.push(p); return { success: true }; } },
    serviceManager: { has: () => false, get: () => null },
    emitRecommendation: () => {},
    finalizeSession: async () => {},
    onImmutableFileBlocked: () => {},
  };
  globalThis.window = { electronAPI: {
    gitCheckpoint: async () => ({ success: true, ref: 'CP-uji' }),
    verifikasiPatch: async (ref) => { jejak.dipanggilDengan.push(ref); return verifikasi; },
    gitRollback: async () => { jejak.rollbackDialog++; return { success: true }; },
  } };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const patch = { id: 'P1', taskId: 'T1', files: [{ path: 'frontend/src/core/runtime/services/SkillGuardService.js', newContent: 'isi baru yang cukup panjang'.repeat(5) }] };
  return PA.executePatchApplication(patch, [], deps).then((hasil) => ({ hasil, jejak, patch }));
}

let r = await jalankanPatch({ verifikasi: { sesudahPatch: hijau, dipulihkan: false } });
cek(r.jejak.dipanggilDengan[0] === 'CP-uji', 'verifikasi dipanggil, dan diberi checkpoint yang barusan dibuat', r.jejak.dipanggilDengan);
cek(r.hasil.success === true && r.hasil.checkpointRef === 'CP-uji', 'uji hijau → patch tetap berlaku, Undo tetap tersedia', r.hasil);
cek(/50\/50/.test(r.hasil.verifikasi?.laporan || ''), 'laporan verifikasi ikut di hasil patch');
cek(r.patch.files[0].status === 'APPLIED', 'berkas tetap berstatus APPLIED');

r = await jalankanPatch({
  verifikasi: { sesudahPatch: merah, dipulihkan: true, sesudahPulih: { gagal: [] } },
});
cek(r.jejak.tulis.length === 1, 'berkas memang sempat ditulis lebih dulu — patch diterapkan DULU, baru diputuskan', r.jejak);
cek(r.hasil.success === false, 'uji merah → patch TIDAK dilaporkan berhasil', r.hasil);
cek(r.patch.files[0].status === 'DIPULIHKAN', 'status berkas berubah jadi DIPULIHKAN, bukan tetap APPLIED', r.patch.files[0].status);
cek(r.hasil.checkpointRef === null,
  'checkpoint sudah terpakai → tombol Undo tidak ditawarkan untuk sesuatu yang sudah dikembalikan', r.hasil.checkpointRef);
cek(r.jejak.rollbackDialog === 0, 'pemulihan TIDAK lewat dialog Undo — ia otomatis, tidak menunggu klik');

// Tanpa Electron (web/Mametlite) tidak ada node; verifikasi dilewati, patch tidak jadi korban.
{
  const jejak = [];
  globalThis.window = { electronAPI: { gitCheckpoint: async () => ({ success: true, ref: 'CP-uji' }) } };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const hasil = await PA.executePatchApplication(
    { id: 'P2', taskId: 'T2', files: [{ path: 'frontend/src/a.js', newContent: 'x'.repeat(200) }] },
    [],
    { metrics: {}, eventBus: { emit: () => {} }, storageManager: { read: async () => '', write: async (p) => { jejak.push(p); return true; } },
      serviceManager: { has: () => false, get: () => null }, emitRecommendation: () => {}, finalizeSession: async () => {}, onImmutableFileBlocked: () => {} },
  );
  cek(hasil.verifikasi === null && hasil.success === true, 'tanpa Electron: verifikasi dilewati, patch tidak dibatalkan', hasil);
}

// ── 5. TERPASANG di proses utama & layar ─────────────────────────────────────────────────────
console.log('\n-- terpasang di proses utama & layar --');

const MAIN = readFileSync(`${AKAR}/frontend/electron/main.cjs`, 'utf8');
const PRELOAD = readFileSync(`${AKAR}/frontend/electron/preload.cjs`, 'utf8');
const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8');

cek(/ipcMain\.handle\('eng:verifikasi-patch'/.test(MAIN), 'jalur verifikasi ada di proses utama');
cek(/verifikasiPatch: \(checkpointRef\) => ipcRenderer\.invoke\('eng:verifikasi-patch'/.test(PRELOAD), 'dijembatani preload');

const blok = MAIN.slice(MAIN.indexOf("ipcMain.handle('eng:verifikasi-patch'"), MAIN.indexOf("ipcMain.handle('engineer:jalankan'"));
cek(/pulihkanDariCheckpoint\(label\)/.test(blok), 'pemulihan dipanggil dari dalam jalur verifikasi (tidak menunggu layar)');
cek(/jalankanBerkasUji\(node, gagal,/.test(blok), 'berkas yang gagal DIJALANKAN ULANG sesudah pemulihan', blok.slice(-400));
const iPulih = blok.indexOf('pulihkanDariCheckpoint(label)');
const iUlang = blok.indexOf('jalankanBerkasUji(node, gagal,');
cek(iPulih > 0 && iUlang > iPulih, 'urutannya benar: pulihkan DULU, baru jalankan ulang terhadap kode yang sudah kembali');
cek(/if \(sesudahPatch\.galat \|\| !gagal\.length\) return/.test(blok),
  'uji yang tak bisa dijalankan tidak memicu pemulihan', blok);

// Tombol Undo Owner HARUS tetap bertanya — yang tanpa dialog hanya jalur otomatis.
const blokRollback = MAIN.slice(MAIN.indexOf("ipcMain.handle('eng:git-rollback'"), MAIN.indexOf("// 3. Folder Selection"));
cek(/dialog\.showMessageBox/.test(blokRollback), 'tombol Undo Owner tetap minta konfirmasi');
cek(!/dialog\.showMessageBox/.test(String(MAIN.slice(MAIN.indexOf('async function pulihkanDariCheckpoint'), MAIN.indexOf('/** Isi checkpoint')))),
  'fungsi pemulihan itu sendiri tidak punya dialog — itulah yang membuatnya bisa otomatis');

cek(/data\?\.verifikasi\?\.laporan/.test(CE), 'laporan verifikasi ditempel di layar');
cek(/Patch dibatalkan sendiri/.test(CE), 'patch yang dipulihkan TIDAK dilaporkan sebagai "Patch Berhasil"');
cek(/f\.status === \(dipulihkan \? 'DIPULIHKAN' : 'APPLIED'\)/.test(CE), 'daftar berkas mengikuti status sebenarnya');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

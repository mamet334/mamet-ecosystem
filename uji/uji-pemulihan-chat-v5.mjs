// UJI 2026-09-23 — pemulihanChat.js + penjaga urutan effect di ConversationEngine.jsx.
// Sebab yang diuji: setelah muat ulang, penunjuk chat dihapus sebelum dibaca, dan semua kegagalan baca
// dianggap "chat hilang". Bukti live: batch LevelDB seq 5433 & 5473 menghapus kunci ketiga workspace.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/components/workbench/';
const P = await import(pathToFileURL(AKAR + 'pemulihanChat.js').href + '?v=' + Date.now());
console.log('uji-pemulihan-chat v5');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ---------- putusanPemulihan ----------
cek(P.putusanPemulihan({ messages: [{ role: 'user' }], hilang: false }) === 'pakai', 'isi chat terbaca → pakai');
cek(P.putusanPemulihan({ messages: [], hilang: false }) === 'pakai', 'chat kosong yang sah → tetap pakai (bukan hilang)');
cek(P.putusanPemulihan({ messages: null, hilang: true }) === 'lepas', 'baris chat memang tidak ada → penunjuk dilepas');
cek(P.putusanPemulihan({ messages: null, hilang: false, error: 'JWT expired' }) === 'pertahankan',
  'GAGAL BACA (sesi/jaringan) → penunjuk DIPERTAHANKAN, bukan dianggap hilang');
cek(P.putusanPemulihan(undefined) === 'pertahankan', 'hasil tak terduga → pilih aman: pertahankan');

// ---------- bolehSimpanChat ----------
const laporan = { role: 'model', content: '🧠 Engineer Reasoning Report' };
const konfirmasi = { role: 'model', content: '🔔 Konfirmasi Diperlukan' };
cek(P.bolehSimpanChat({ currentChatId: null, messages: [laporan, konfirmasi] }) === false,
  'pesan sistem Engineer tanpa chat aktif → TIDAK melahirkan chat baru (sebab 2 chat siluman 2026-09-23)');
cek(P.bolehSimpanChat({ currentChatId: null, messages: [{ role: 'user', content: 'kerjakan TUGAS-01' }] }) === true,
  'pesan pengguna → chat baru boleh lahir');
cek(P.bolehSimpanChat({ currentChatId: 'abc', messages: [laporan] }) === true,
  'chat sudah ada → pesan sistem tetap tersimpan di chat itu');
cek(P.bolehSimpanChat({ currentChatId: null, messages: [] }) === false, 'tanpa pesan → tidak disimpan');
cek(P.bolehSimpanChat({ currentChatId: 'abc', messages: [] }) === false, 'chat ada tapi kosong → tidak disimpan');

// ---------- kunciSimpan ----------
const pesanA = [{ role: 'user', content: 'halo' }, { role: 'model', content: 'hai' }];
cek(P.kunciSimpan({ chatId: 'c1', messages: pesanA }) === P.kunciSimpan({ chatId: 'c1', messages: pesanA.slice() }),
  'isi sama → kunci simpan sama (muat ulang tidak menulis ulang baris yang sama)');
cek(P.kunciSimpan({ chatId: 'c1', messages: pesanA }) !== P.kunciSimpan({ chatId: 'c1', messages: [...pesanA, { role: 'model', content: 'x' }] }),
  'ada pesan baru → kunci berubah (penyimpanan tetap jalan)');
cek(P.kunciSimpan({ chatId: 'c1', messages: pesanA }) !== P.kunciSimpan({ chatId: 'c2', messages: pesanA }),
  'chat lain → kunci berbeda');
cek(P.kunciSimpan({ chatId: null, messages: [] }) === 'new_0_0_', 'tanpa chat & tanpa pesan → bentuk kunci tetap terdefinisi');

// ---------- penjaga urutan effect (statis, di berkas yang benar-benar dipakai) ----------
const src = readFileSync(AKAR + 'ConversationEngine.jsx', 'utf8');
const iSync = src.indexOf('PERSISTENSI: Sync currentChatId ke localStorage');
const iRestore = src.indexOf('RESTORE: Chat dari localStorage');
cek(iSync > 0 && iRestore > iSync, 'effect sinkronisasi memang dideklarasikan SEBELUM effect pemulihan (jadi jalan lebih dulu)');
const badanSync = src.slice(iSync, iRestore);
cek(/if \(!initialRestoreDone\) return;/.test(badanSync),
  'effect sinkronisasi menunggu pemulihan selesai → tidak menghapus penunjuk saat currentChatId masih null');
cek(/initialRestoreDone\]/.test(badanSync) || /initialRestoreDone\)/.test(badanSync.split('}, [')[1] || ''),
  'initialRestoreDone masuk daftar dependency (kunci tersimpan lagi setelah pemulihan)');
cek(/else if \(!pemulihanGagalRef\.current\)/.test(badanSync),
  'saat pemulihan gagal, penunjuk chat tidak dihapus');
cek(!/\.single\(\)/.test(src), 'tidak ada lagi .single() (baris kosong dulu jadi error → dikira chat hilang)');

// Membaca chat (dari riwayat maupun saat pemulihan) tidak boleh menulis ulang barisnya:
// isi yang baru dibaca ditandai "sudah tersimpan" SEBELUM setMessages memicu effect autosave.
const iMuatRiwayat = src.indexOf('const handleLoadChat');
const badanMuat = src.slice(iMuatRiwayat, iMuatRiwayat + 1400);
const iTandai = badanMuat.indexOf('lastSavedKeyRef.current = kunciSimpan');
const iPasang = badanMuat.indexOf('setMessages(hasil.messages)');
cek(iTandai > 0 && iPasang > iTandai,
  'buka chat dari riwayat: isi ditandai sudah tersimpan sebelum dipasang → updated_at tidak naik, urutan riwayat tidak melompat');
const iPulih = src.indexOf("if (putusan === 'pakai')");
cek(/lastSavedKeyRef\.current = kunciSimpan/.test(src.slice(iPulih, iPulih + 500)),
  'pemulihan setelah muat ulang juga tidak menulis ulang baris yang sama');

// Penjaga balapan (live TUGAS-02 putaran 1, 2026-09-23 09:29): penyimpanan & laporan patch harus MENUNGGU
// pemulihan riwayat selesai — kalau tidak, chat ditimpa satu pesan saja dan percakapan lengkap hilang.
const iSimpan = src.indexOf('PERSISTENSI: Auto-save messages');
const badanSimpan = src.slice(iSimpan, iSimpan + 4500);
cek(/if \(!initialRestoreDone\) return;/.test(badanSimpan),
  'autosave menunggu pemulihan selesai (chat tidak ditimpa satu pesan)');
cek(/\[messages, currentChatId, isLoading, initialRestoreDone\]/.test(badanSimpan),
  'initialRestoreDone masuk dependency autosave (tetap tersimpan sesudah pemulihan)');
const iLaporan = src.indexOf('PATCH YANG TERPUTUS MUAT ULANG');
const badanLaporan = src.slice(iLaporan, iLaporan + 3200);
// Diperbarui 24 September: penjaganya kini per-INSTANCE (`iniInstansiEngineer`), bukan workspace yang
// sedang tampil — `activeWorkspaceId` bernilai sama di ketiga instance chat sehingga instance Assistant
// pun ikut berebut catatan patch dan yang menang menghapusnya. Ketahanan laporannya diuji terpisah di
// uji-laporan-patch-bertahan.mjs.
cek(/!iniInstansiEngineer \|\| !initialRestoreDone/.test(badanLaporan),
  'laporan patch setelah muat ulang menunggu pemulihan (tidak terhapus isi dari database)');
cek(/\[iniInstansiEngineer, initialRestoreDone\]/.test(badanLaporan), 'dependency laporan ikut initialRestoreDone');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);

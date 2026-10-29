// UJI 2026-10-19 — keadaan layar chat: mana yang hidup DI LUAR layar, mana yang sengaja tetap lokal
// (Item 127 Tahap 1, langkah 2–4).
//
// Kenapa ada: Tahap 1 membuat layar chat boleh DILEPAS. Sejak itu setiap `useState` di
// `ConversationEngine.jsx` adalah keputusan: keadaan lokal hilang saat Owner pindah halaman lalu kembali.
// Untuk popover itu benar; untuk jawaban yang sedang mengalir, file yang dilampirkan, atau tombol Undo
// patch, itu kehilangan data tanpa suara.
//
// Bentuk kegagalan yang dijaga — semuanya lahir dari suntingan yang tampak wajar:
//   1. KEADAAN BARU DITAMBAH SEBAGAI useState BIASA → hilang setiap layar dilepas, ketahuan baru saat
//      Owner kehilangan sesuatu. Setiap useState lokal harus ada di DAFTAR_LOKAL beserta alasannya.
//   2. KEADAAN YANG SUDAH DIPINDAH DIKEMBALIKAN KE LOKAL — mis. saat "merapikan" import.
//   3. DUA KEADAAN MEMAKAI NAMA PENYIMPAN YANG SAMA → diam-diam menjadi SATU keadaan.
//   4. PENJAGA DUPLIKAT DI REF LOKAL → layar yang dipasang ulang lupa pesan mana yang sudah diproses dan
//      melaporkan temuan / menjalankan perintah DUA kali.
//   5. RESET PIL TIER SAAT DIPASANG → pilihan model Owner terbuang setiap ia kembali dari halaman lain.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-keadaan-chat-di-luar-layar v1');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const KODE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));

// Keadaan yang BOLEH hilang saat layar dipasang ulang — masing-masing dengan alasannya. Menambah baris di
// sini adalah keputusan sadar, bukan cara meloloskan uji.
const DAFTAR_LOKAL = {
  toolTogglesVersion: 'pemicu render saja; nilai aslinya dibaca langsung dari ToolPreferencesService',
  showToolsPanel: 'popover — wajar tertutup saat Owner kembali',
  showTierPanel: 'popover — wajar tertutup saat Owner kembali',
  copiedIndex: 'tanda "tersalin" yang memang hilang sendiri dalam 2 detik',
  isSidebarOpen: 'laci riwayat, bawaan tertutup; dirancang ulang di Tahap 2',
  konteksInfo: 'meteran dihitung ulang dari messages setiap layar dipasang',
  versiKonteks: 'pemicu hitung ulang meteran',
  panelKonteks: 'popover — wajar tertutup saat Owner kembali',
  temuanTersimpan: 'SENGAJA dibaca ulang dari disk — suntingan tangan Owner harus terlihat',
  keutuhanTemuanRef: 'dibaca ulang bersama temuanTersimpan',
  laporanPatchTertunda: 'dibaca ulang dari catatan; duplikat dicegah patchId',
  galatUmpanBalik: '👍/👎 gagal tersimpan: nilainya SUDAH dikembalikan di messages (yang bertahan) — layar kembali menampilkan tombol tak terpilih; teks galat sesaat boleh hilang (Item 126)',
};

const WAJIB_DI_LUAR = [
  'messages', 'input', 'isLoading', 'currentChatId', 'initialRestoreDone', 'modelTierOverride', 'attachedFile',
  'activeMemories', 'lastMemoryQuery', 'isMemoryPanelOpen', 'isMemoryLoading', 'engineerCmdStates',
  'lastCheckpoint', 'rollbackState', 'webConfirmation', 'sedangMemadatkan',
];
const REF_WAJIB_DI_LUAR = [
  'kendaliKirimRef', 'percakapanSeqRef', 'lastSavedKeyRef', 'isSavingRef', 'pemulihanGagalRef', 'osStateRef',
  'timerSimpanRef', 'cmdOtomatisRef', 'klaimDiprosesRef', 'temuanDiprosesRef', 'chatTierRef', 'simpanTertundaRef',
];

// ── 1. Setiap useState lokal tercatat ───────────────────────────────────────────────────────────
console.log('\n-- 1. useState lokal hanya yang tercatat beralasan --');
const lokal = [...KODE.matchAll(/const \[(\w+), set\w+\] = useState\(/g)].map((m) => m[1]);
const takTercatat = lokal.filter((n) => !(n in DAFTAR_LOKAL));
cek(takTercatat.length === 0, `tak ada useState lokal tanpa alasan tercatat (${lokal.length} lokal)`, takTercatat);
const basi = Object.keys(DAFTAR_LOKAL).filter((n) => !lokal.includes(n));
cek(basi.length === 0, 'DAFTAR_LOKAL tidak basi — tiap namanya masih useState lokal sungguhan', basi);

// ── 2. Yang sudah dipindah tetap di luar layar ──────────────────────────────────────────────────
console.log('\n-- 2. keadaan & ref yang wajib selamat --');
const diLuar = new Map([...KODE.matchAll(/const \[(\w+), set\w+\] = useKeadaanTersimpan\(kunciSesi, '(\w+)'/g)]
  .map((m) => [m[1], m[2]]));
const hilang = WAJIB_DI_LUAR.filter((n) => !diLuar.has(n));
cek(hilang.length === 0, `${WAJIB_DI_LUAR.length} keadaan memakai useKeadaanTersimpan`, hilang);
const refDiLuar = new Map([...KODE.matchAll(/const (\w+) = useRefTersimpan\(kunciSesi, '(\w+)'/g)].map((m) => [m[1], m[2]]));
const refHilang = REF_WAJIB_DI_LUAR.filter((n) => !refDiLuar.has(n));
cek(refHilang.length === 0, `${REF_WAJIB_DI_LUAR.length} ref memakai useRefTersimpan`, refHilang);

// ── 3. Tak ada dua yang berbagi nama penyimpan ──────────────────────────────────────────────────
console.log('\n-- 3. nama penyimpan unik --');
const namaKeadaan = [...diLuar.values()];
const namaRef = [...refDiLuar.values()];
const ganda = (arr) => arr.filter((n, i) => arr.indexOf(n) !== i);
cek(ganda(namaKeadaan).length === 0, 'tak ada dua keadaan dengan nama penyimpan sama', ganda(namaKeadaan));
cek(ganda(namaRef).length === 0, 'tak ada dua ref dengan nama penyimpan sama', ganda(namaRef));

// ── 4. Penjaga duplikat ─────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. penjaga duplikat selamat lepas-pasang --');
for (const r of ['cmdOtomatisRef', 'klaimDiprosesRef', 'temuanDiprosesRef']) {
  cek(new RegExp(`const ${r} = useRefTersimpan\\(kunciSesi, '\\w+', \\(\\) => new Set\\(\\)\\)`).test(KODE),
    `${r}: Set dibuat SEKALI (inisialisasi malas), bukan setiap render`);
}

// ── 5. Pil tier tidak direset saat layar dipasang ───────────────────────────────────────────────
console.log('\n-- 5. reset pil tier hanya saat chat berganti --');
cek(/if \(chatTierRef\.current === currentChatId\) return;\s*chatTierRef\.current = currentChatId;\s*setModelTierOverride\(null\);\s*\}, \[currentChatId\]\);/.test(KODE),
  'efek reset tier keluar lebih dulu bila chat-nya tetap sama');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

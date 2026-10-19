// UJI 2026-10-19 — inventaris fungsi: tak ada yang hilang saat tampilan diganti (Item 127 Tahap 2, langkah 2c).
//
// Kenapa ada: Owner bertanya bagaimana standar aplikasi asisten ditiru "tanpa kehilangan suatu fungsi yang
// sebenarnya harus ditampilkan". Jawabannya inventaris di ROADMAP-TAMPILAN-MENU-GAME.md §6 — setiap fungsi yang
// tampil hari ini, satu baris, dengan tempat barunya. Uji ini membuat inventaris itu MENGIKAT:
//
//   1. DOKUMEN = UJI — setiap baris §6 punya entri di sini, dan sebaliknya. Fungsi yang ditambahkan ke
//      inventaris tanpa jangkar = merah; entri uji untuk fungsi yang sudah dicoret dari dokumen = merah.
//   2. JANGKAR ADA — tiap fungsi "wajib" dibuktikan oleh jangkar di kodenya: nama penangan, judul tombol,
//      komponen yang dirender, nama event. SENGAJA bukan kelas CSS — Tahap 3 akan mengganti seluruh kulitnya,
//      dan uji ini harus tetap hijau selama fungsinya tetap ada.
//   3. TERJANGKAU — fungsi yang kodenya ada tetapi tak bisa dicapai sama saja dengan hilang: setiap aplikasi
//      terdaftar, ada di navigasi, dan komponennya dimuat; Home adalah pintu masuk (keputusan Owner K1 = B).
//
// Dua baris §6 berstatus "boleh hilang" — Owner sudah menyetujui keduanya dihapus ("tidak diperlukan lagi",
// "dibuang"): jangkarnya tidak diwajibkan, tetapi barisnya tetap harus tercatat di sini.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-inventaris-fungsi v2');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const F = {
  CE: 'frontend/src/components/workbench/ConversationEngine.jsx',
  SET: 'frontend/src/components/Settings.jsx',
  APP: 'frontend/src/App.jsx',
  SHELL: 'frontend/src/components/os/OSDesktopShell.jsx',
  SIDE: 'frontend/src/components/os/Sidebar.jsx',
  REG: 'frontend/src/core/application/AppRegistry.js',
  APPROVAL: 'frontend/src/components/workbench/EngineerApprovalDialog.jsx',
  LABEL: 'supabase/functions/agent-process/lib/verification/label_sumber.ts',
  RISET: 'frontend/src/components/research/ResearchApp.jsx',
  MEMORI: 'frontend/src/components/memory/MemoryApp.jsx',
  BERKAS: 'frontend/src/components/explorer/FileExplorer.jsx',
  FORGE: 'frontend/src/components/agent-forge/AgentForge.jsx',
  LOG: 'frontend/src/components/system/SystemLogsApp.jsx',
  BIAYA: 'frontend/src/components/BillingDashboard.jsx',
};
const KODE = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, tanpaKomentar(baca(p))]));

// fungsi → [berkas, pola] … ; status 'boleh-hilang' = disetujui Owner untuk dihapus.
const INVENTARIS = [
  // §6.1 kerangka & lapisan global
  // v2: desktop kini lewat menu teks (Item 127 K2); Sidebar tinggal laci seluler. Keduanya wajib ada.
  ['Navigasi 11 aplikasi', [['SIDE', /renderNavNode/], ['SHELL', /<Sidebar\b/], ['SHELL', /<MenuTeks \/>/]]],
  ['Navigasi seluler', [['SHELL', /<MobileBottomNav\b/]]],
  ['Notifikasi sistem', [['SHELL', /<SystemNotificationCenter\b/]]],
  ['Persetujuan patch Engineer', [['APP', /<EngineerApprovalDialog\b/], ['APPROVAL', /eventBus\.on\('Engineer:RequestApproval'/]]],
  ['Graf pengetahuan (Home)', [['REG', /'HomeDashboard': lazy\(\(\) => import\('\.\.\/\.\.\/components\/dashboard\/HomeDashboard'\)\)/]]],
  ['Keluar (logout)', [['SET', /supabase\.auth\.signOut\(\)/]]],
  ['Unduh aplikasi desktop', [['SET', /<TombolUnduhDesktop\b/]]],
  // §6.2 halaman chat
  ['Daftar pesan + jawaban mengalir', [['CE', /const \[messages, setMessages\] = useKeadaanTersimpan/], ['CE', /onChunk: \(/]]],
  ['Nalar <think> terbuka gaya DeepSeek', [['CE', /\{parsed\.thinking && \(\s*<details open\b/]]],
  ['Label [STATUS: …] dari server', [['LABEL', /VERIFIED/]]],
  ['Lencana alat · chip sumber grounding', [['CE', /toolsUsed/], ['CE', /groundingSources/]]],
  ['Akordeon eksekusi alat · detail nalar', [['CE', /m\.toolExecution/], ['CE', /m\.isReasoningBlock/]]],
  ['Konfirmasi alat · terapkan patch', [['CE', /m\.isConfirmationRequest/], ['CE', /m\.hasPatchProposal/]]],
  ['Hasil word_to_pdf', [['CE', /await tautanUnduh\(/]]],
  ['Salin pesan', [['CE', /handleCopy\(/], ['CE', /title="Salin ke clipboard"/]]],
  ['Kotak ketik · Kirim ↔ Berhenti', [['CE', /<form onSubmit=\{handleSend\}/], ['CE', /onClick=\{hentikanKirim\}/]]],
  ['Lampiran', [['CE', /<input type="file" ref=\{fileInputRef\}/], ['CE', /fileInputRef\.current\?\.click\(\)/]]],
  ['📁 Folder kerja (Assistant) · Akar repo (Engineer)', [['CE', /<FolderKerjaTombol\b/], ['CE', /<AkarRepoTombol\b/]]],
  ['Pil tier model (Assistant)', [['CE', /setShowTierPanel\(/], ['CE', /setModelTierOverride\(/]]],
  ['Kartu konfirmasi pencarian web', [['CE', /\{webConfirmation && /]]],
  ['Percakapan baru', [['CE', /onClick=\{handleNewChat\}/], ['CE', /title="Percakapan Baru"/]]],
  ['Riwayat chat', [['CE', /<ChatHistory\b/], ['CE', /title="Toggle Chat History"/]]],
  ['Panel Tools (RAG + registry)', [['CE', /setShowToolsPanel\(/]]],
  ['Meteran jendela konteks · Padatkan', [['CE', /meteranKonteks\(/], ['CE', /bolehPadatkan\(/]]],
  ['Simpan temuan · Simpan pengetahuan', [['CE', /temuanBelumSimpan\.length/], ['CE', /pengetahuanBelumSimpan\.length/]]],
  ['Riwayat konversi Word → PDF', [['CE', /<RiwayatKonversi\b/]]],
  ['Banner rollback Engineer', [['CE', /\{lastCheckpoint && \(/], ['CE', /onClick=\{handleRollback\}/]]],
  ['Memory Context (konflik, sampah, query terakhir)', [['CE', /<MemoryContextPanel\b/], ['CE', /onResolveConflict=/]]],
  ['Monitor MAEF', [['CE', /onClick=\{handleToggleMaefMonitor\}/], ['CE', /'widget:maef-monitor'/]]],
  ['"Luaskan kolom chat"', 'boleh-hilang'],
  ['Cahaya atmosfer (dua lingkaran blur)', 'boleh-hilang'],
  // §6.3 halaman lain
  ['Settings', [
    ['SET', />AI Model Management</], ['SET', />API Key</], ['SET', /Test Connection/], ['SET', />Adaptive Model Tiering</],
    ['SET', />Batas Biaya Harian</], ['SET', />Pembaruan Aplikasi</], ['SET', />Aplikasi Desktop</],
    ['SET', />Tools &amp; Capabilities<|>Tools & Capabilities</], ['SET', />Tool Registry</], ['SET', />User Identity</]]],
  ['Knowledge (ResearchApp)', [
    ['RISET', /onChange=\{handleUpload\}/], ['RISET', /title="Unduh cadangan lengkap/], ['RISET', /<PratinjauDataTabel\b/],
    ['RISET', /<DaftarDataTabel\b/], ['RISET', /<LaporanKejanggalan\b/], ['RISET', /placeholder="Cari dokumen/],
    ['RISET', /<DaftarWorkspace\b/], ['RISET', /title="Hapus dokumen"/]]],
  ['Memory (MemoryApp)', [['MEMORI', /placeholder="Cari memori/], ['MEMORI', /title="Hapus memori"/]]],
  ['File Explorer', [['BERKAS', /placeholder="Cari file/], ['BERKAS', /navigateTo\(''\)/], ['BERKAS', /loadDirectory\(currentPath\)/],
    ['BERKAS', /handleCopyPath\(/]]],
  ['Agent Forge', [['FORGE', /Registered Agents/], ['FORGE', /Available Tools/], ['FORGE', /placeholder="Agent Name"/],
    ['FORGE', /placeholder="Tool Name"/]]],
  ['Kernel (SystemLogsApp)', [['LOG', /'ERROR'/], ['LOG', /'WARN'/], ['LOG', /title="Muat ulang"/]]],
  ['Billing', [['BIAYA', /check_daily_quota/], ['BIAYA', /from\('api_usage'\)/], ['BIAYA', /Pemakaian Hari Ini/]]],
];

// ── 1. Dokumen = uji ────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. setiap baris §6 punya entri, dan sebaliknya --');
const doc = baca('docs/roadmap/ROADMAP-TAMPILAN-MENU-GAME.md');
const bagian = doc.slice(doc.indexOf('### 6.1 Kerangka'), doc.indexOf('## 7. Tahapan'));
const norm = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').split(' — ')[0].trim();
const barisDok = bagian.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'))
  .map((l) => norm(l.split('|')[1])).filter((s) => !/^(Fungsi|Halaman · fungsi di dalamnya)$/.test(s));
const barisUji = INVENTARIS.map(([n]) => n);
cek(barisDok.length >= 30, `tabel §6 terbaca (${barisDok.length} baris)`);
const tanpaUji = barisDok.filter((b) => !barisUji.includes(b));
cek(tanpaUji.length === 0, 'tak ada baris inventaris TANPA jangkar di uji', tanpaUji);
const basi = barisUji.filter((b) => !barisDok.includes(b));
cek(basi.length === 0, 'tak ada entri uji untuk fungsi yang sudah dicoret dari dokumen', basi);

// ── 2. Jangkar ada ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. tiap fungsi wajib dibuktikan oleh jangkarnya --');
let wajib = 0, bolehHilang = 0;
for (const [nama, jangkar] of INVENTARIS) {
  if (jangkar === 'boleh-hilang') { bolehHilang++; continue; }
  wajib++;
  const hilang = jangkar.filter(([k, pola]) => !pola.test(KODE[k])).map(([k, pola]) => `${F[k].split('/').pop()}: ${pola.source.slice(0, 60)}`);
  cek(hilang.length === 0, nama, hilang);
}
console.log(`     (${wajib} wajib · ${bolehHilang} boleh hilang atas persetujuan Owner)`);

// ── 3. Terjangkau ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. setiap halaman terjangkau --');
const sys = JSON.parse(baca('frontend/public/metadata/system.json'));
const nav = JSON.stringify(JSON.parse(baca('frontend/public/metadata/navigation.json')).navigation);
const appsTanpaNav = sys.apps.map((a) => a.id).filter((id) => !nav.includes(`"${id}"`));
cek(sys.apps.length === 11 && appsTanpaNav.length === 0, `11 aplikasi terdaftar, semuanya ada di navigasi`, appsTanpaNav);
const komponenHilang = sys.apps.filter((a) => a.component && !new RegExp(`'${a.component}': lazy`).test(KODE.REG)).map((a) => a.component);
cek(komponenHilang.length === 0, 'komponen setiap aplikasi dimuat AppRegistry', komponenHilang);
cek(sys.system?.default_entry_point === 'app:home', 'pintu masuk = app:home → graf pengetahuan halaman pertama (Owner K1 = B)',
  sys.system?.default_entry_point);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);

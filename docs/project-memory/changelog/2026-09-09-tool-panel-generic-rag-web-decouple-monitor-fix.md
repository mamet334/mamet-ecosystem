# Changelog: Tool Panel Generik, RAG/Web Search Dilepas, MAEF Monitor Fix, Dead Widget Cleanup

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live Penuh (2026-09-09) — seluruh temuan diverifikasi lewat live-test Owner bertahap, tidak ada yang berstatus asumsi.
**Scope:** `tools/` (3 file baru), `ToolRegistryService.js`, `ConversationEngine.jsx`, `AssistantService.js`, `RetrievalOrchestrator.js`, `WorkspaceManager.js`, `AppRegistry.js`, `MetadataService.js`, `widgets.json`, 7 file widget dashboard dihapus

Lanjutan langsung dari Item 31 ([`2026-09-09-tool-registry-folder-scan-web-search-refactor.md`](./2026-09-09-tool-registry-folder-scan-web-search-refactor.md)) — Owner menguji fitur tool registry secara live dan menemukan rangkaian masalah baru, masing-masing ditelusuri dan diperbaiki dalam sesi yang sama.

---

## 1. Konsistensi Folder `tools/`: 3 Tool Built-in Dipindah dari Hardcode

**Isu:** Setelah `web_search` berhasil jadi file di `tools/`, Owner bertanya apakah 3 tool lain di kartu Tool Registry (`memory_manager`, `file_reader`, `deep_research`) juga harus dipindah — karena masih hardcode di `ToolRegistryService.initialize()`, tidak konsisten dengan prinsip "semua tool terkumpul di satu folder, seperti modul Linux".

**Solusi:** Dipindah apa adanya (tanpa fitur baru, sesuai instruksi eksplisit Owner "jangan tambah fitur baru") ke `tools/memory_manager.js`, `tools/file_reader.js`, `tools/deep_research.js`. `ToolRegistryService.initialize()` sekarang kosong dari hardcode — satu-satunya sumber tool adalah `scanToolsFolder()`. Bug lama `memory_manager` (referensi `memoryService` yang tidak pernah di-import, akan crash kalau dieksekusi) sengaja dipertahankan apa adanya, didokumentasikan di komentar file, bukan scope pemindahan ini.

**Verifikasi live:** boot menunjukkan `4/4 tool terdaftar dari "tools/" ['deep_research', 'file_reader', 'memory_manager', 'web_search']`, dan tampilan kartu di Settings → Tool Registry tetap identik dengan sebelum pemindahan.

## 2. Chip Toolbar Diganti Jadi Panel "Tools" Generik

**Isu:** Chip RAG/Web hardcode di toolbar chat (`ConversationEngine.jsx`) — begitu 3 tool tadi juga dapat toggle, toolbar berisiko penuh setiap kali tool baru ditambahkan ke `tools/` (Owner: *"karena nanti akan saya buat khusus untuk suatu tool yang di gunakan"* — mengantisipasi pertumbuhan jumlah tool).

**Desain yang didiskusikan & disepakati** (opsi dipilih via pertanyaan eksplisit ke Owner):
- Chip generik dibuat otomatis dari `ToolRegistryService.listTools()` (bukan hardcode nama tool) — tool baru yang di-drop ke `tools/` otomatis dapat toggle tanpa ubah kode UI.
- Karena berisiko penuh layar kalau tool bertambah, seluruh toggle (RAG + semua tool registry) disatukan jadi **satu tombol "Tools"** dengan badge jumlah aktif, membuka dropdown panel — bukan lagi satu chip per tool sejajar.

**Solusi:** `ConversationEngine.jsx` — state `showToolsPanel` + `toolsPanelRef` (klik-di-luar-menutup), `registeredTools` dibaca dari `kernel.serviceManager.get('ToolRegistryService').listTools()`, label tool dipetakan via `formatToolLabel()` (nama dikenal → label singkat, tool baru tak dikenal → auto-titleize dari nama). RAG tetap ditampilkan terpisah di dalam panel (bukan tool registry — 'rag' tidak pernah didaftarkan sebagai tool, itu capability inti pipeline retrieval).

**Verifikasi live:** panel menampilkan 5 baris (RAG + 4 tool registry), toggle per-baris tersimpan per workspace seperti sebelumnya, badge jumlah aktif akurat.

## 3. Bug: RAG Mati Ikut Mematikan Web Search (Ditemukan Live, Diperbaiki)

**Isu:** Setelah panel Tools live, Owner uji kombinasi "RAG mati + Web nyala" dan hasilnya AI menjawab dari pengetahuan internal, bukan hasil pencarian web — padahal Web toggle nyala. Ini limitasi yang **sudah pernah dicatat sebagai "diterima" di Item 30**, tapi begitu terlihat langsung di UI panel baru, Owner minta diperbaiki.

**Root cause:** `AssistantService.js` menggerbang **seluruh** pemanggilan `retrievalOrchestrator.retrieve()` — termasuk Tier 3 web search di dalamnya — dengan syarat tunggal `ragToolEnabled`. RAG mati = `retrieve()` tidak pernah dipanggil sama sekali, jadi Tier 3 juga tidak pernah jalan, apa pun nilai `webSearchToolEnabled`.

**Solusi:**
- `AssistantService.js`: syarat panggil diganti jadi `(ragToolEnabled || webSearchToolEnabled)`, dengan opsi baru `skipLocalKnowledge: !ragToolEnabled` diteruskan ke `retrieve()`.
- `RetrievalOrchestrator.js`: Tier 1 (dokumen lokal) dilewati kalau `options.skipLocalKnowledge` true (langsung set `tier1Result` sufficiency 0), lanjut ke Tier 2/3 seperti biasa — Tier 3 tetap independen sesuai kondisi aslinya (`enableWebComparison || needWebComparison || isTemporalQuery`), tidak disentuh.

**Verifikasi live:** query "berita ai terbaru,satu saja yang relevan" dengan RAG mati + Web nyala menghasilkan log `RAG dimatikan (skipLocalKnowledge) — melewati Tier 1, lanjut ke Tier 2/3` diikuti `Tier 3 ... Google News RSS ID returned 5 results` dan jawaban AI mengutip berita nyata (bukan pengetahuan internal statis).

## 4. MAEF Monitor: Panel Terbuka Paksa Setiap Respons (Minimize Tidak Efektif)

**Isu:** Owner mengeluhkan layar terbagi 3 panel (Chat, Memory Context, MAEF Monitor) sejak layar default, dan fitur minimize dirasa tidak efektif. Ditelusuri: `openWidgetInWorkbench('right', 'widget:maef-monitor', ...)` dipanggil **tanpa syarat** setiap kali AI selesai membalas, di **dua tempat** (`AssistantService.js` dan `ConversationEngine.jsx` `onDone` callback) — jadi begitu Owner menutup panel, pesan berikutnya membukanya lagi otomatis.

**Solusi bertahap (2 iterasi, sesuai temuan live-test):**
1. **Iterasi 1:** Hapus kedua pemanggilan `openWidgetInWorkbench` di `onDone`. *Efek samping tak terduga:* trace eksekusi jadi tidak pernah sampai ke widget sama sekali (fungsi lama menggabungkan "buka panel" + "kirim data" jadi satu panggilan) — Owner melaporkan Monitor tetap kosong ("Waiting for AI Execution Trace...") walau sudah chat.
2. **Iterasi 2 (WorkspaceManager.js):** `openWidgetInWorkbench()` dipecah — logic pengiriman data dipindah ke method baru `injectWidgetData(widgetId, widgetData)` yang **hanya** mengirim data (event `Widget:DataInjected` + simpan ke store), tanpa menyentuh layout. `ConversationEngine.jsx` dipasang kembali memanggil `injectWidgetData` (bukan `openWidgetInWorkbench`) di `onDone`. Panel sekarang murni dikendalikan tombol "Monitor" manual (`handleToggleMaefMonitor`, sudah ada sebelumnya, tidak diubah).

**Isu kedua yang ditemukan (juga dari live-test):** setelah iterasi 2, trace tampil saat panel dibuka pertama kali (lewat event), tapi **hilang lagi** setiap panel ditutup lalu dibuka ulang. Root cause: `widgetDataStore` disimpan sebagai `this.widgetDataStore` (per-instance), padahal ada **dua instance `WorkspaceManager` hidup bersamaan** — satu dibuat `Kernel.js:509` (didaftarkan ke `serviceManager`, dipakai `MaefExecutionMonitorWidget` untuk baca lewat `getWidgetData()`), satu lagi dibuat per `WorkspaceProvider` (`WorkspaceContext.jsx:8`, yang benar-benar dipakai chat untuk `injectWidgetData()`). Widget membaca dari instance kernel yang tidak pernah menerima data.

**Solusi:** `widgetDataStore` dipindah dari `this.widgetDataStore` ke variabel level-modul (`const widgetDataStore = {}` di luar class) — dibagikan oleh semua instance `WorkspaceManager` karena `widgetId` memang bersifat global, bukan per-instance.

**Verifikasi live:** chat tanpa klik apa pun → Monitor tetap tertutup. Klik "Monitor" → trace terakhir langsung tampil (bukan "Waiting..."). Tutup → buka lagi berkali-kali → trace tetap ada, tidak hilang.

## 5. Investigasi Turunan: Kenapa Ada Dua `WorkspaceManager`, Apa Tugas Kernel Sesungguhnya

Owner bertanya eksplisit soal akar masalah desain ini. Ringkasan (detail penuh ada di riwayat percakapan, bukan diulang di sini): `WorkspaceManager` sebenarnya *bukan* capability kernel menurut `constitution/02_MAEF_KERNEL.md` (yang menegaskan MAEF *"tidak bertanggung jawab melakukan reasoning"* dan Non-Goals-nya bukan IDE/chatbot/database) — ia murni state UI (layout panel, widget mana yang terbuka), tapi didaftarkan ke `serviceManager` seolah capability kernel. Efek samping lain dari percampuran ini ditemukan sekaligus: `SystemStatusWidget.jsx` membaca `activeWorkspaceId` dari instance kernel yang tidak pernah `switchWorkspace()`, sehingga field "Active Session" di widget itu **selalu** menampilkan `None`. Diperbaiki sementara (ganti sumber ke `ApplicationManager.activeAppId` yang memang selalu ter-update) — namun perbaikan itu jadi tidak relevan begitu ditemukan bahwa widgetnya sendiri adalah kode mati (lihat §6).

Refactor struktural `WorkspaceManager` (memisahkannya total dari kernel) **tidak dilakukan** di sesi ini — di luar scope, keputusan arsitektur besar yang perlu didiskusikan terpisah kalau Owner mau menindaklanjuti.

## 6. Pembersihan: 7 Widget Dashboard Adalah Kode Mati

**Ditemukan saat investigasi §5:** screenshot Owner untuk memverifikasi perbaikan "Active Session" ternyata menunjukkan layar `HomeDashboard.jsx` (Knowledge Graph + `ObservabilityPanel`) — bukan layar yang berisi `SystemStatusWidget`. Ditelusuri: `SystemStatusWidget` dan 6 widget dashboard lain (`WorkspaceOverviewWidget`, `CurrentActivityWidget`, `RecentEventsWidget`, `PendingApprovalWidget`, `VerificationSummaryWidget`, `QuickActionsWidget`) hanya direferensikan oleh `dashboard.json`, dan `dashboard.json` hanya dibaca lewat `MetadataService.getDashboardLayout()` — yang **tidak dipanggil oleh siapa pun di codebase**. Dashboard nyata sudah lama digantikan `HomeDashboard.jsx` (Knowledge Graph + `ObservabilityPanel`).

**Solusi (dikonfirmasi eksplisit oleh Owner — pilihan "hapus semuanya" dari 3 opsi yang diajukan):**
- 7 file widget dihapus dari `frontend/src/components/dashboard/widgets/`.
- `frontend/public/metadata/dashboard.json` dihapus.
- `AppRegistry.js`: 7 baris lazy-import dihapus (widget engineer lain — `EngineeringTasksWidget`, `MaefExecutionMonitorWidget`, dll — tidak disentuh, masih dipakai).
- `widgets.json`: 7 definisi widget dashboard dihapus, sisa widget engineer tetap ada.
- `MetadataService.js`: pembacaan `dashboard.json` + field `metadata.dashboard` + method `getDashboardLayout()` dihapus.

**Verifikasi live:** boot normal, `[MetadataService] Successfully validated and loaded all metadata` tetap muncul tanpa error 404 `dashboard.json`, Home dashboard tampil tidak berubah (karena memang tidak pernah memakai widget yang dihapus).

## 7. Ringkasan Perilaku Baru vs Lama

| Area | Sebelum | Sesudah |
|---|---|---|
| Toolbar chat | 2 chip hardcode (RAG, Web) | 1 tombol "Tools" + badge, dropdown generik dari registry |
| Tool built-in | 3 hardcode + 1 file | 4 file, semua di `tools/` |
| RAG off + Web on | Keduanya efektif mati | Web tetap jalan, RAG saja yang dilewati |
| MAEF Monitor | Terbuka paksa tiap respons | Murni manual, trace tetap terkirim via `injectWidgetData` |
| Trace Monitor tutup-buka | Hilang (baca dari instance kosong) | Tetap ada (store level-modul, dibagi semua instance) |
| Dashboard widget lama | 7 file kode mati, tidak dirender | Dihapus bersih (−496 baris) |

Tidak ada perubahan behavior pada: `web_search` execution path (masih via `ToolRegistryService.executeTool` dengan fallback yang sama), Tier 1/2 retrieval saat RAG nyala, atau layout widget engineer lain.

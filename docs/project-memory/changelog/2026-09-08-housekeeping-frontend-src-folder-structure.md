# Changelog: Housekeeping Struktur Folder `frontend/src/`

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live
**Scope:** Backlog Item 14 di [`INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md)
**Komponen Terdampak:** 6 file dipindah (`git mv`), 8 file importer diperbarui, 1 folder kosong dihapus

---

## 1. Ringkasan

Eksekusi 4 keputusan housekeeping struktur folder yang sebelumnya ditemukan saat diskusi arsitektur filosofi Linux "satu folder satu tanggung jawab" (2026-09-08), lalu sengaja ditunda ("jangan ubah dulu") sampai Owner memberi izin eksekusi.

## 2. Perubahan

1. **`hooks/` → `core/runtime/hooks/`**: `frontend/src/hooks/useDashboardData.js` dipindah ke `frontend/src/core/runtime/hooks/useDashboardData.js` via `git mv` (mempertahankan riwayat). Folder `hooks/` yang jadi kosong dihapus.
2. **`core/workspace/` + `core/workspaces/` → `workspaces/` (jamak)**: 4 file (`WidgetRegistry.js`, `WorkspaceContext.jsx`, `WorkspaceManager.js`, `lazyLoadWithRetry.js`) dipindah dari `core/workspace/` (singular) ke `core/workspaces/` (jamak) via `git mv`, bergabung dengan `README.md` yang sudah ada di sana (stub dokumentasi Engineer Workspace yang belum dibangun — dibiarkan apa adanya). Folder `core/workspace/` (singular) yang jadi kosong dihapus.
3. **`frontend/src/lib/` dihapus**: folder sudah kosong total (isinya, `TokenSaverAgent.js` dan `MainOrchestrator.js`, sudah dihapus sebagai dead code di commit `b434238` 2026-09-03) — dikonfirmasi via `git log` sebelum dieksekusi.
4. **`services/ExecutionTraceService.js` → `core/runtime/services/`**: dipindah via `git mv` supaya sejajar dengan 26 service lain yang sudah ada di sana. Folder `services/` yang jadi kosong dihapus.

## 3. Import yang Diperbarui

**Kedalaman path berubah** karena `useDashboardData.js` dan `ExecutionTraceService.js` pindah dari depth-1 (`src/hooks/`, `src/services/`) ke depth-3 (`src/core/runtime/hooks/`, `src/core/runtime/services/`):
- `useDashboardData.js`: import `supabase` dari `'../supabase'` → `'../../../supabase'`. Import `ExecutionTraceService` **tidak berubah** (`'../services/ExecutionTraceService'`) karena kedua file sekarang sama-sama sibling di bawah `core/runtime/`.
- `ExecutionTraceService.js`: import `supabase` dari `'../supabase'` → `'../../../supabase'`.
- `components/dashboard/HomeDashboard.jsx`: import `useDashboardData` dari `'../../hooks/useDashboardData'` → `'../../core/runtime/hooks/useDashboardData'`.

**`core/workspace/` → `core/workspaces/`** hanya ganti nama folder (kedalaman sama), jadi cukup ganti `workspace/` → `workspaces/` di path importer. 5 importer tercatat di audit awal:
- `components/AIAgent/AIAgent.jsx`, `components/layout/Sidebar.jsx`, `components/widgets/WorkspaceNavWidget.jsx`, `components/workbench/AppShell.jsx`, `components/workbench/ConversationEngine.jsx` — semua mengimpor `../../core/workspace/WorkspaceContext` → `../../core/workspaces/WorkspaceContext`.

**Ditemukan saat eksekusi (tidak tercatat di audit awal):** pencarian string literal pertama (`grep "core/workspace/"`) melewatkan importer yang memakai path relatif lebih pendek (`../workspace/...`, bukan `core/workspace/...` — karena file pemanggilnya sendiri sudah di dalam `core/`). Build production **gagal** pada percobaan pertama karena ini:
- `core/runtime/Kernel.js` — 3 import: `WidgetRegistry`, `WorkspaceManager`, `lazyLoadWithRetry`, semua dari `'../workspace/...'` → `'../workspaces/...'`.
- `core/application/AppRegistry.js` — 1 import: `WorkspaceProvider` dari `'../workspace/WorkspaceContext'` → `'../workspaces/WorkspaceContext'`.

Total **8 file importer** diperbarui (5 dari audit awal + 3 baru ditemukan). Setelah perbaikan, pencarian ulang dengan pola lebih luas (`grep "workspace/"` tanpa prefix `core/`) mengonfirmasi tidak ada sisa referensi ke path lama.

## 4. Verifikasi

1. **Build production:** gagal di percobaan pertama (`Could not resolve "../workspace/lazyLoadWithRetry" from "src/core/runtime/Kernel.js"`) — diperbaiki, percobaan kedua sukses (exit 0, 11.03s).
2. **Boot aplikasi live** (dev server): tidak ada error console saat boot. Ini bukti kuat karena `Kernel.js` meng-import `WidgetRegistry`/`WorkspaceManager`/`lazyLoadWithRetry` langsung di top-level — kegagalan resolve modul di sini akan meng-crash seluruh boot aplikasi, bukan gagal diam-diam.
3. **Instansiasi service dikonfirmasi** via `serviceManager.get('WidgetRegistry')` dan `serviceManager.get('WorkspaceManager')` — keduanya mengembalikan instance dengan constructor name yang benar.
4. **Dynamic import langsung** terhadap ketiga modul yang dipindah (`ExecutionTraceService.js`, `useDashboardData.js` di `core/runtime/`, `WorkspaceContext.jsx` di `core/workspaces/`) — semua resolve dan mengekspor simbol yang benar (`fetchExecutionTrace`/`normalizeAgentLogsEvent`, default export, `WorkspaceProvider`/`useWorkspace`).
5. Layar login muncul normal saat aplikasi dibuka (tidak dicoba login lebih jauh — tidak ada kredensial, di luar scope verifikasi housekeeping ini).

## 5. Catatan

Item terkait yang sengaja TIDAK dikerjakan di sesi ini (di luar scope housekeeping ini, Owner belum menentukan): penyaringan tool per-mode (`policy_middleware.ts` masih satu saklar besar `toolsEnabled`) dan folder `tools/` — didiskusikan lagi nanti.

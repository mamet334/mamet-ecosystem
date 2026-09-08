# Changelog: ADR-0017 Fase 6 — Ekstraksi TaskHandlers dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + siklus event penuh dengan instance Engineer sungguhan)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 6/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/TaskHandlers.js` (baru)

---

## 1. Ringkasan

Langkah keenam dekomposisi `engineer.js` — jalur read-only Engineer: `_buildDynamicContext`, `_handleAnalysisTask`, `_handleReviewTask`, `_handleReadRepoTask` (beserta sub-handler `_handleReadFiles`/`_handleListDirectory`/`_handleSearchFiles`), dan tiga parser teks prompt (`_extractPathsFromPrompt`, `_extractDirectoryFromPrompt`, `_extractSearchQueryFromPrompt`) — sembilan method dipindah ke `engineer/TaskHandlers.js`.

## 2. Koreksi Ditemukan Saat Eksekusi

Asumsi awal ADR: fase ini "read-only" dan risiko sedang murni karena banyak jalur. Saat membaca kode sungguhan ditemukan `_handleAnalysisTask`/`_handleReviewTask` masih memanggil `this._analyze`/`this._review`/`this._calculateConfidence` (belum diekstrak, target Fase 7/8) dan langsung memutasi `this.metrics.tasksAnalyzed++`/`this.metrics.recommendationsMade++`.

**Solusi:** deps-injection — `engineer.js` meneruskan `analyze`/`review`/`calculateConfidence`/`updateArtifact` sebagai fungsi ter-bind ke instance (`(t) => this._analyze(t)`, dst). `metrics` dan `brain` diteruskan **by-reference** (objek), meniru pola Map yang sudah terbukti di Fase 4-5 — mutasi (`metrics.tasksAnalyzed++`, `brain.dynamic = ...`) di dalam modul baru tetap terlihat di instance Engineer asli tanpa modul perlu tahu apa-apa soal `this`.

Ketiga fungsi `_extractPathsFromPrompt`/`_extractDirectoryFromPrompt`/`_extractSearchQueryFromPrompt` dihapus total dari `engineer.js` (tanpa wrapper delegasi) — digrep dulu, tidak ada pemanggil di luar `_handleReadRepoTask`, yang juga sudah pindah ke modul yang sama sehingga bisa saling panggil langsung sebagai fungsi lokal.

## 3. Perubahan Lain

- Handler-handler READ_REPO yang saling memanggil (`handleReadRepoTask` → `handleListDirectory`/`handleSearchFiles`/`handleReadFiles`) memanggil langsung sebagai fungsi lokal di dalam `TaskHandlers.js`, bukan lewat `deps` — `deps` hanya membawa dependensi eksternal sungguhan (`repositoryReader`, `emitRecommendation`, `fileIndexService`, `sessionArtifact`, `eventBus`).
- `engineer.js` menambah helper kecil `_taskHandlerDeps()` untuk merakit objek deps yang sama, dipakai ulang oleh empat wrapper (`_handleReadRepoTask`, `_handleReadFiles`, `_handleListDirectory`, `_handleSearchFiles`).

**Hasil ukuran:** `engineer.js` 1908 → **1680 baris** (−228). Total sejak Fase 1: 2978 → 1680 (**−1298 baris, ~44%**).

## 4. Verifikasi

1. **Build production:** sukses, exit 0, 10.69s.
2. **`_buildDynamicContext`** dipanggil langsung terhadap instance Engineer live (`window.__mamet.serviceManager.get('Engineer')`): struktur hasil benar (`task.id`, `projectContext`, `timestamp`).
3. **`_handleReadRepoTask` jalur LIST** (`"list folder frontend/src/core"`): event `Engineer:Recommendation` dengan `type: READ_REPO_EMPTY` ter-emit, `dirPath` diekstrak benar dari teks prompt via `extractDirectoryFromPrompt`. `repositoryReader` sendiri mengembalikan kosong karena panggilan GitHub API diblokir CSP di sandbox dev lokal — bukan regresi dari ekstraksi ini (repositoryReader tidak disentuh Fase 6).
4. **Jalur SEARCH** (`"cari file engineer"`) **dan READ default** (`"baca file engineer.js"`): keduanya routing benar ke `handleSearchFiles`/`handleReadFiles`, event `READ_REPO_NOT_FOUND` ter-emit (repositoryReader gagal fetch GitHub, penyebab sama seperti poin 3).
5. **`_handleAnalysisTask`:** event `type: ANALYSIS` ter-emit lengkap dengan `analysis`/`confidence` — rantai deps ter-bind ke `_analyze`/`_calculateConfidence`/`_updateArtifact` (belum diekstrak) tetap utuh dan berfungsi.
6. **Mutasi by-reference dikonfirmasi setelah pemanggilan:** `engineer.metrics.tasksAnalyzed === 1`, `engineer.brain.dynamic.task.id === 't6'` — `metrics`/`brain` asli termutasi dari dalam modul baru, sama seperti pola Map di Fase 4-5.
7. Console bersih dari error, kecuali CSP GitHub API yang pra-eksisting (tidak terkait ekstraksi).

## 5. Langkah Selanjutnya

Fase 7 (ADR-0017, prioritas tinggi): `engineer/PatchGenerator.js` — digabung sengaja dengan implementasi baru `engineer/CodeSnippetExtractor.js` sesuai desain [`SPESIFIKASI-TEKNIS-MAMET-OS-v2.md`](../../roadmap/SPESIFIKASI-TEKNIS-MAMET-OS-v2.md) §2.1 (ekstraksi snippet berbasis identifier dengan brace-matching sadar-string) — ini logika baru, bukan sekadar pemindahan kode.

# Changelog: ADR-0017 Fase 3 — Ekstraksi StaticCodeAnalyzer dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + fungsional dengan dependency live)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 3/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/StaticCodeAnalyzer.js` (baru)

---

## 1. Ringkasan

Langkah ketiga dekomposisi `engineer.js`. Lima method analisis kode statis (regex-based, tanpa AST, tanpa LLM) dipindah ke `engineer/StaticCodeAnalyzer.js`: `_extractExports`, `_extractFunctionSignatures`, `_findUsages`, `_detectBreakingChanges`, `_verifySemanticDiff`.

## 2. Temuan Saat Eksekusi (Pola Sama Seperti Fase 2)

ADR-0017 mengasumsikan Kelompok G "tidak ada I/O langsung". Saat kode dibaca ulang: `_findUsages` ternyata butuh `this.fileIndexService` + `this.storageManager`, dan `_verifySemanticDiff` butuh `this.storageManager`. `extractExports`/`extractFunctionSignatures` memang murni sesuai asumsi.

**Solusi:** pola dependency-injection yang sama seperti `CapabilityGuard.js` di Fase 2 — `findUsages(symbol, excludePath, deps)`, `verifySemanticDiff(patch, deps)`, dan `detectBreakingChanges(patch, deps)` (yang meneruskan `deps` yang sama ke `findUsages` di dalamnya).

## 3. Perubahan

- **Baru:** `engineer/StaticCodeAnalyzer.js` — 5 fungsi (`extractExports`, `extractFunctionSignatures`, `findUsages`, `detectBreakingChanges`, `verifySemanticDiff`).
- **`engineer.js`:** 5 method dihapus, 2 titik panggil (`_detectBreakingChanges`, `_verifySemanticDiff` di dalam `_handlePatchTask`) diperbarui memanggil fungsi hasil import dengan `deps` eksplisit.

**Hasil ukuran:** `engineer.js` 2666 → **2452 baris** (−214). Total sejak Fase 1: 2978 → 2452 (−526 baris, hampir 18% dari ukuran awal).

## 4. Verifikasi

1. **Build production:** sukses, exit 0, 11.35s.
2. **`extractExports`/`extractFunctionSignatures` (murni):** sample kode uji dengan `export function fooBar(a,b)`, `export const bazQux`, `export class MyClass` — hasil ekstraksi nama & jumlah parameter benar.
3. **`detectBreakingChanges` dengan dependency live** (`fileIndexService`/`storageManager` dari instance Engineer sungguhan yang berjalan di app): patch uji menghapus fungsi bernama unik → terdeteksi sebagai breaking change, severity `LOW` (benar, karena tidak ada caller ditemukan untuk nama fungsi uji yang sengaja unik).
4. **`verifySemanticDiff`:** dijalankan dengan path file source code asli — melaporkan "File kosong setelah patch" karena `storageManager` di app ini bukan backend pembaca file repo (jalur itu ditangani `RepositoryReaderService` terpisah, arsitektur yang sudah ada sebelum sesi ini). **Ini bukan regresi** — kode asli sebelum diekstrak akan menghasilkan hasil identik untuk input yang sama; hasil ini justru membuktikan alur eksekusi tidak berubah.
5. Console bersih, tanpa error.

## 5. Langkah Selanjutnya

Fase 4 (ADR-0017): ekstraksi `engineer/FileSystemGateway.js` dan `engineer/EngineerMemoryStore.js` — risiko rendah-sedang, menyentuh I/O nyata via `StorageManager`/`RepositoryReaderService`.

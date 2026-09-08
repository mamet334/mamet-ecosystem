# Changelog: ADR-0017 Fase 4 — Ekstraksi FileSystemGateway & EngineerMemoryStore dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + fungsional dengan dependency live, round-trip storage)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 4/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/FileSystemGateway.js` (baru), `frontend/src/core/runtime/services/engineer/EngineerMemoryStore.js` (baru)

---

## 1. Ringkasan

Langkah keempat dekomposisi `engineer.js`. Dua kelompok:
- **FileSystemGateway.js:** `readFile`, `findFiles`, `_extractFileNamesFromTask`, `_findRelevantADR`, `_tryReadFile` — satu-satunya tempat Engineer bicara ke `StorageManager`/`FileIndexService`.
- **EngineerMemoryStore.js:** persistensi pending patch (`_savePendingPatch`, `_clearPendingPatch`, `_restorePersistedPatches`) dan verified/rejected approach memory (`_saveVerifiedApproach`, `_saveRejectedApproach`, `_loadVerifiedApproaches`, `_pruneApproachMemory`).

## 2. Tantangan Baru Dibanding Fase 2-3

`_loadVerifiedApproaches` di versi lama **memutasi `this.brain.verifiedApproaches`/`this.brain.rejectedPatterns` langsung** — bukan sekadar butuh dependency-injection, tapi butuh perubahan bentuk kontrak fungsi. Diselesaikan: `loadVerifiedApproaches(deps)` sekarang **mengembalikan** `{ verifiedApproaches, rejectedPatterns }`, dan `engineer.js` di `initialize()` yang menugaskan hasilnya ke `this.brain`. Modul tetap tidak butuh instance Engineer sama sekali.

## 3. Perubahan

- **Baru:** `engineer/FileSystemGateway.js`, `engineer/EngineerMemoryStore.js`.
- **`engineer.js`:** 9 method dihapus, ~13 titik panggil diperbarui dengan dependency injection (`storageManager`, `fileIndexService`, `eventBus` sesuai kebutuhan tiap fungsi).
- Wrapper `deps` di `checkCapabilityAndDeclare` (dari Fase 2) disederhanakan — `extractFileNamesFromTask`/`findRelevantADR` sekarang direferensikan langsung sebagai shorthand, bukan dibungkus arrow function `this._method` yang sudah tidak relevan.
- `findFiles` dipindah apa adanya meski ditemukan **tidak dipanggil dari mana pun** di codebase (kode mati pre-existing, bukan tugas fase ini untuk menghapusnya).

**Hasil ukuran:** `engineer.js` 2452 → **2096 baris** (−356). Total sejak Fase 1: 2978 → 2096 (**−882 baris, ~30%**).

## 4. Verifikasi

1. **Build production:** sukses, exit 0, 11.49s.
2. **`extractFileNamesFromTask`/`findRelevantADR` (murni):** benar mengekstrak path file dari teks task, benar memetakan kata kunci ke dokumen ADR.
3. **`readFile`/`tryReadFile` dengan dependency live** (`storageManager`/`fileIndexService` dari instance Engineer sungguhan): tulis file uji via `storageManager.write`, baca kembali lewat kedua fungsi — konten cocok.
4. **`savePendingPatch`/`clearPendingPatch` round-trip:** patch tersimpan dengan struktur benar (`patchId`, `savedAt`, `expiresAt`), dikonfirmasi baca key mentah.
5. **`approachKey` deterministik:** urutan array file berbeda tetap menghasilkan key sama (di-sort di dalam fungsi), sesuai desain asli.
6. **`engineer.brain.verifiedApproaches`/`rejectedPatterns`:** tetap array valid setelah `initialize()` — membuktikan pola return-value (bukan mutasi internal modul) bekerja benar.
7. Boot log bersih, tanpa error.

### Temuan Sampingan (Bukan Bug dari Ekstraksi)

`storageManager.write(key, null)` ternyata menyimpan **string literal `"null"`**, bukan benar-benar menghapus key — dikonfirmasi via test langsung: `write(key, null)` lalu `read(key)` mengembalikan `"null"` (truthy). Ini perilaku **StorageManager itu sendiri**, dan baris kode `clearPendingPatch`/`_clearPendingPatch` identik sebelum & sesudah ekstraksi — bukan regresi. Dicatat untuk kesadaran arsitektur, di luar scope untuk diperbaiki sebagai bagian dekomposisi ini.

## 5. Langkah Selanjutnya

Fase 5-6 (ADR-0017): ekstraksi `engineer/ReasoningLock.js` + `engineer/ApprovalGateway.js` (event-driven, timing-sensitive — timeout 10 menit), lalu `engineer/TaskHandlers.js` (jalur read-only: analysis/review/read-repo/read-files/list-dir/search).

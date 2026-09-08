# Changelog: ADR-0017 Fase 8 — PatchApplier & Selesainya Dekomposisi engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live End-to-End (build + 5 skenario terhadap instance Engineer sungguhan, file benar-benar berubah di storage)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 8/8 (**TERAKHIR — dekomposisi selesai**)
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/PatchApplier.js` (baru)

---

## 1. Ringkasan

Fase terakhir dan hard gate tertinggi dari seluruh dekomposisi: `_executePatchApplication` — satu-satunya tempat di seluruh `engineer.js` yang benar-benar menulis file ke storage — dipindah ke `engineer/PatchApplier.js`. Dikerjakan paling akhir setelah 7 modul lain stabil & teruji sendiri-sendiri, sesuai rencana ADR.

## 2. Koreksi Ditemukan Saat Eksekusi — Primitif Tidak Bisa By-Reference

Semua fase sebelumnya yang butuh state instance dibagi ke modul (Map `pendingConfirmations`/`pendingPatches` di Fase 4-5, object `metrics`/`brain` di Fase 4-6) memakai pola "teruskan by-reference" — mutasi di dalam modul otomatis terlihat di instance asli karena Map/object adalah reference type di JS.

`_executePatchApplication` memutasi dua hal yang **bukan** reference type: `this.suspiciousAttempts` (number) dan `this.capability` (string). Primitif di JS diteruskan by-value — kalau modul baru menerima `suspiciousAttempts` sebagai parameter biasa, `suspiciousAttempts++` di dalam modul tidak akan pernah terlihat di instance Engineer.

**Solusi:** mutasi keamanan (increment `suspiciousAttempts`, downgrade `capability` ke `OBSERVER` setelah 3x percobaan modifikasi file immutable, emit `Engineer:EmergencyLockdown`) tetap tinggal sebagai closure di `engineer.js`, diteruskan ke `PatchApplier.js` sebagai satu callback `onImmutableFileBlocked()`. Modul baru memanggil callback ini tanpa perlu tahu apa pun soal `this` — pola deps-injection fungsi (bukan object-reference) yang sudah dipakai untuk `analyze`/`review`/`injectArtifactIntoPrompt` di fase-fase sebelumnya, sekarang diterapkan untuk kasus mutasi-primitif juga.

## 3. Perubahan Lain

- `PatchApplier.js` mengimpor `isImmutableFile`/`isProtectedFile` langsung dari `CapabilityGuard.js` (pure functions, pola sama seperti `ApprovalGateway.js` di Fase 5) — bukan lewat `deps`.
- `_executePatchApplication` dipertahankan sebagai wrapper tipis di `engineer.js` (dipanggil sekali dari `_handlePatchTask`) — konsisten dengan pola `_generatePatch` di Fase 7, sengaja meminimalkan sentuhan ke `_handlePatchTask` (orchestrator ~365 baris yang sudah teruji penuh di fase-fase sebelumnya) untuk fase berisiko tertinggi ini.
- `isImmutableFile`/`isProtectedFile` dihapus dari import `engineer.js` — sudah tidak ada pemanggil lain di file ini.

**Hasil ukuran:** `engineer.js` 1261 → **1133 baris** (−128). Total sejak Fase 1: 2978 → 1133 (**−1845 baris, ~62%**).

## 4. Verifikasi End-to-End (5 Skenario, Bukan Mock — File Benar-Benar Berubah di Storage)

1. **Build production:** sukses, exit 0, 11.23s.
2. **File kecil, approved:** `_executePatchApplication` dipanggil langsung terhadap instance Engineer live → `status: APPLIED`, file dibaca ulang dari `storageManager` dan isinya **cocok persis** dengan `newContent` — bukti tulisan sungguhan.
3. **File besar/hasil search-replace, dua file (satu approved, satu tidak):** file approved → `APPLIED` + isi benar; file tidak approved → `SKIPPED`, dikonfirmasi **tidak ada** di storage sama sekali.
4. **File IMMUTABLE diblokir:** `success: false`, `error: 'Core file modification blocked'`, `metrics.coreModificationsBlocked` naik 1, `suspiciousAttempts` naik 1 via closure — mutasi primitif dikonfirmasi tembus ke instance asli.
5. **Emergency lockdown di percobaan ke-3:** 2 percobaan immutable tambahan dipicu → `suspiciousAttempts === 3`, `capability` berubah jadi `OBSERVER`, event `Engineer:EmergencyLockdown` ter-emit dengan `attempts: 3` — identik dengan perilaku kode asli.
6. **Safety-check anti-truncation:** file dengan `newContent` <50% ukuran `originalContent` → `status: FAILED`, pesan error persis sama format dengan kode asli.
7. **"Patch ditolak Owner":** diverifikasi via pembacaan kode, bukan live-test baru — cabang `!approvalResult.approved` di `_handlePatchTask` (tidak disentuh Fase 8) tidak pernah memanggil `_executePatchApplication` sama sekali; jalur ini sudah diverifikasi live di Fase 5.
8. Console bersih dari error tak terduga. Error yang tampil (`MemoryService: User not authenticated`) adalah keterbatasan sandbox dev tanpa login user (kode dipindah verbatim, sama seperti sebelum diekstrak); `🚫 BLOCKED`/`🚫 DITOLAK` adalah `console.error` yang memang bagian dari skenario yang sengaja dipicu untuk pengujian.
9. State test (`suspiciousAttempts`, `capability`, data test di localStorage) dibersihkan/direset setelah verifikasi.

## 5. Dekomposisi ADR-0017 — Selesai

Semua 8 fase selesai. `engineer.js`: **2978 → 1133 baris (−1845, ~62%)**. 12 modul baru di `frontend/src/core/runtime/services/engineer/`:

| Modul | Fase |
|---|---|
| `SessionArtifact.js` | 1 |
| `CapabilityGuard.js`, `IntentClassifier.js` | 2 |
| `StaticCodeAnalyzer.js` | 3 |
| `EngineerMemoryStore.js`, `FileSystemGateway.js` | 4 |
| `ReasoningLock.js`, `ApprovalGateway.js` | 5 |
| `TaskHandlers.js` | 6 |
| `PatchGenerator.js`, `CodeSnippetExtractor.js` | 7 |
| `PatchApplier.js` | 8 |

`engineer.js` sekarang thin coordinator (Kelompok K): constructor, lifecycle (`initialize`, `_loadStaticKnowledge`, `_registerListeners`), Session Artifact plumbing, `_handlePatchTask` (orchestrator utama), `_analyze`/`_review`/`_checkCompliance`, `_calculateConfidence`, `_emitRecommendation` (wrapper, Fase 5), `upgradeCapability`, `getMetrics`.

Tidak ada langkah selanjutnya untuk ADR-0017 — dekomposisi selesai. Backlog Item 14 (housekeeping folder `hooks/`/`workspace`/`workspaces`) masih ditunda sesuai instruksi Owner ("jangan ubah dulu"), tidak terkait ADR-0017.

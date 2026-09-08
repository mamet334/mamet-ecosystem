# Changelog: ADR-0017 Fase 2 — Ekstraksi IntentClassifier & CapabilityGuard dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + 11 skenario fungsional)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 2/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/IntentClassifier.js` (baru), `frontend/src/core/runtime/services/engineer/CapabilityGuard.js` (baru)

---

## 1. Ringkasan

Langkah kedua dekomposisi `engineer.js`. Dua kelompok utilitas deterministik (tanpa panggilan LLM) dipindah ke modul terpisah:
- `_detectIntent` → `engineer/IntentClassifier.js` (`detectIntent`)
- `_checkCapabilityAndDeclare`, `_isImmutableFile`, `_isProtectedFile` → `engineer/CapabilityGuard.js`

## 2. Temuan Saat Eksekusi (Koreksi terhadap Asumsi ADR)

ADR-0017 mengasumsikan `_checkCapabilityAndDeclare` "pure function". Saat kode dibaca ulang untuk ekstraksi, ternyata method ini memanggil `this._extractFileNamesFromTask`, `this._findRelevantADR`, dan `this._calculateConfidence` — ketiganya milik kelompok lain (FileSystemGateway/PatchApplier) yang belum diekstrak.

**Solusi:** pola dependency-injection. `checkCapabilityAndDeclare(task, options, deps)` menerima ketiga helper via parameter `deps`, bukan `this.method()`. Di `engineer.js`, dipanggil dengan:
```js
const capabilityCheck = checkCapabilityAndDeclare(task, { modelName }, {
  extractFileNamesFromTask: (t) => this._extractFileNamesFromTask(t),
  findRelevantADR: (t) => this._findRelevantADR(t),
  calculateConfidence: (a) => this._calculateConfidence(a)
});
```
Perilaku identik dengan versi lama, modul baru tetap murni testable tanpa perlu instance `Engineer`.

## 3. Perubahan Lain

- `MAX_FILES_PER_PATCH` (konstanta, dulu duplikat dengan komentar "harus sama dengan Capability Guard") sekarang **satu sumber kebenaran** di `CapabilityGuard.js`, diimpor balik ke `engineer.js` untuk 2 titik pakai lain (`_analyze`/`_generatePatch`, belum diekstrak — Fase 7/8 nanti).
- 4 titik panggil `this._isImmutableFile(...)`/`this._isProtectedFile(...)` diganti pemanggilan fungsi langsung dari import.

**Hasil ukuran:** `engineer.js` 2846 → **2666 baris** (−180). Total sejak Fase 1: 2978 → 2666 (−312 baris).

## 4. Verifikasi

1. **Build production:** sukses, exit 0, 44.41s.
2. **`detectIntent` — 5 skenario via dev server:** sapaan tanpa keyword → `CLARIFICATION`; "analisis kode ini" → `ANALYSIS`; kata "perbaiki" → `MODIFY_CODE` (paksa); "baca file konfigurasi" → `READ_REPO`; teks kosong → `CLARIFICATION`. Semua cocok logika asli.
3. **`checkCapabilityAndDeclare` — 2 skenario:** prompt <20 kata → `pass: false` (diblokir, sesuai desain); prompt cukup panjang + file dalam batas + ADR relevan ada + confidence tinggi → `pass: true`.
4. **`isImmutableFile`/`isProtectedFile`:** file core (`Kernel.js`) terdeteksi `true`, file biasa `false`; file service (`BrainService.js`) terdeteksi protected `true`.
5. **Instance Engineer live:** `kernel.serviceManager.get('Engineer')` tetap sehat — `intentState: 'READY'`, `capability: 'IMPLEMENTER'`, `sessionArtifact` (dari Fase 1) tetap berfungsi. Console bersih, tanpa error.

## 5. Langkah Selanjutnya

Fase 3 (ADR-0017): ekstraksi `engineer/StaticCodeAnalyzer.js` (`_extractExports`, `_extractFunctionSignatures`, `_findUsages`, `_detectBreakingChanges`, `_verifySemanticDiff`) — risiko rendah, disarankan dikerjakan bareng rancangan `CodeSnippetExtractor.js` dari §2.1 karena berbagi teknik parsing kode yang sama.

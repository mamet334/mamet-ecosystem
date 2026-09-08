# Changelog: ADR-0017 Fase 7 — PatchGenerator + Implementasi §2.1 CodeSnippetExtractor

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + tes langsung terhadap modul + instance Engineer sungguhan)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 7/8, [`SPESIFIKASI-TEKNIS-MAMET-OS-v2.md`](../../roadmap/SPESIFIKASI-TEKNIS-MAMET-OS-v2.md) §2.1
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/PatchGenerator.js` (baru), `frontend/src/core/runtime/services/engineer/CodeSnippetExtractor.js` (baru)

---

## 1. Ringkasan

Fase risiko tertinggi sejauh ini, dan satu-satunya fase yang sengaja digabung dengan pekerjaan bukan-sekadar-pemindahan-kode: mengekstrak `_generatePatch`/`_buildPatchPrompt`/`_extractCodeFromResponse`/`_generateFallbackPatch` ke `PatchGenerator.js` **sekaligus** mengimplementasikan `CodeSnippetExtractor.js` — logika baru sesuai desain §2.1 yang menggantikan potongan lama berbasis jumlah-karakter di `_buildPatchPrompt`.

## 2. Apa yang Diganti (§2.1)

**Sebelum:** `_buildPatchPrompt` memangkas file besar (>6000 char) dengan mengambil 4000 karakter awal + 4000 karakter akhir, membuang bagian tengah. Kalau kode yang perlu diubah ada di tengah file, LLM tidak pernah melihatnya — search-replace yang dihasilkan tidak akan pernah cocok dengan file asli.

**Sesudah:** `extractRelevantSnippet(fileContent, targetIdentifiers, contextLines=5)` di `CodeSnippetExtractor.js` — modul PURE tanpa dependency ke instance Engineer — punya 3 jalur:
- **`full-file`** — file ≤3000 char, tidak dipangkas sama sekali.
- **`identifier`** — identifier dari task (`extractTargetIdentifiers`, camelCase/PascalCase/snake_case/`_prefixed`, divalidasi ulang keberadaannya di file) match deklarasi sungguhan (function/class/const-arrow/class-method) → dipangkas ke ±`contextLines` di sekitar tiap blok, rentang yang overlap digabung.
- **`keyword-scan`** — fallback kalau tidak ada identifier yang match deklarasi apa pun: window 50-baris dengan densitas kemunculan identifier tertinggi yang dipilih.

Format output yang diminta ke LLM sekarang **selalu search-replace**, untuk semua ukuran file — sebelumnya hanya file besar yang diminta format ini, file kecil diminta konten penuh. Apply logic (`__mode: 'search_replace'` di `generatePatch()`) tidak berubah — sudah fungsional penuh sebelumnya, snippet cuma memangkas apa yang *ditunjukkan* ke LLM.

## 3. Brace-Matching String-Aware (§2.1.4) — Bagian Tersulit

`_findBlockEnd()` di `CodeSnippetExtractor.js` memindai karakter demi karakter dengan stack konteks (`STRING_SINGLE`/`STRING_DOUBLE`/`TEMPLATE`/`INTERP`/`LINE_COMMENT`/`BLOCK_COMMENT`). Brace hanya dihitung ke `braceDepth` blok terluar saat stack konteks kosong. Interpolasi template literal `${...}` membuka frame `INTERP` dengan `localDepth` sendiri — brace di dalamnya (termasuk object-literal bersarang) tidak pernah menyentuh `braceDepth` terluar.

Ini krusial karena `PatchGenerator.js` sendiri (fungsi `buildPatchPrompt`) menulis puluhan baris `prompt += \`...{...}...\`;` — persis kasus yang diperingatkan spec. Diverifikasi langsung dengan kasus buatan yang meniru pola ini: fungsi berisi template literal dengan `{nested}` literal DAN interpolasi bersarang `${ (function(){ return {a:1}; })() }` — brace-matching tetap menemukan closing brace fungsi yang benar tanpa salah hitung.

## 4. Perubahan Lain

- `_buildPatchPrompt`/`_extractCodeFromResponse`/`_generateFallbackPatch` dihapus total dari `engineer.js` **tanpa wrapper** — tidak ada pemanggil eksternal di luar `_generatePatch`, yang juga sudah pindah bersama-sama ke modul yang sama sehingga bisa saling panggil langsung sebagai fungsi lokal.
- `_generatePatch` dipertahankan sebagai wrapper tipis (dipanggil dari `_handlePatchTask`, orchestrator yang belum diekstrak sampai Fase 8).
- `deps` untuk `generatePatch`: `{ storageManager, fileIndexService, serviceManager, eventBus, brain, injectArtifactIntoPrompt }`. `brain` diteruskan by-reference read-only (dibaca untuk `verifiedApproaches`/`rejectedPatterns`, tidak dimutasi di fase ini). `injectArtifactIntoPrompt` adalah method kecil yang TETAP tinggal di `engineer.js` (bergantung pada `this.sessionArtifact`), diteruskan sebagai fungsi ter-bind.

**Hasil ukuran:** `engineer.js` 1680 → **1261 baris** (−419). Total sejak Fase 1: 2978 → 1261 (**−1717 baris, ~58%**).

## 5. Verifikasi

1. **Build production:** sukses, exit 0, 19.24s.
2. **Jalur `full-file`:** file ≤3000 char → `snippet === fileContent` persis.
3. **Jalur `identifier`:** file besar dengan identifier target sungguhan → snippet berhenti tepat di closing brace fungsi target; fungsi berikutnya di file (`afterFunction`) dikonfirmasi TIDAK ikut ter-include.
4. **String-awareness (kasus sulit):** dikonfirmasi seperti dijelaskan di atas.
5. **Jalur `keyword-scan`:** identifier diberikan tapi hanya muncul di komentar (tidak match deklarasi) → window densitas tertinggi terpilih, `identifierFound: true`.
6. **`buildPatchPrompt` end-to-end** (impor langsung dari browser terhadap modul sungguhan): prompt untuk file kecil DAN besar dua-duanya berisi instruksi "SEARCH-REPLACE" selalu; percabangan `isLargeFile` lama dikonfirmasi hilang total dari output; padding besar tidak ikut ter-dump mentah.
7. **`_generatePatch` wrapper** dipanggil langsung terhadap instance Engineer live (`window.__mamet.serviceManager.get('Engineer')`): deps tersambung benar, jalur "tidak ada file terbaca" mengembalikan struktur identik dengan versi lama.
8. **`extractCodeFromResponse`/`generateFallbackPatch`** (pure) diuji langsung, hasil sesuai kontrak lama.
9. Instance method `_buildPatchPrompt` dikonfirmasi TIDAK ADA lagi (`typeof engineer._buildPatchPrompt === 'undefined'`).
10. Console bersih dari error.

**Catatan keterbatasan sandbox:** tidak bisa menguji `_generatePatch` sampai memanggil `BrainService.executeLLM` sungguhan (file index kosong di dev sandbox lokal — pemuatan tree bergantung GitHub API yang diblokir CSP, keterbatasan lingkungan yang sama seperti Fase 6, bukan regresi Fase 7). Jalur LLM-call/fallback-patch di dalam `generatePatch()` sendiri tidak diubah sama sekali dari kode asli (line-for-line identik, cuma dipindah lokasi) — risiko regresi di situ minimal.

## 6. Langkah Selanjutnya

Fase 8 (ADR-0017, terakhir, risiko tertinggi): `engineer/PatchApplier.js` — ekstraksi `_executePatchApplication` — plus `engineer.js` menyusut jadi thin coordinator murni (constructor, `_handlePatchTask` sebagai orchestrator, `_analyze`/`_review`/`_checkCompliance`, listeners, metrics). Mitigasi wajib: test end-to-end penuh dari task masuk sampai file benar-benar berubah di disk, minimal 3 skenario (file kecil, file besar/search-replace, patch ditolak Owner).

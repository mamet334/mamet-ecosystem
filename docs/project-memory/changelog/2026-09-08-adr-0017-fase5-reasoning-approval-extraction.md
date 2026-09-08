# Changelog: ADR-0017 Fase 5 — Ekstraksi ReasoningLock & ApprovalGateway dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + siklus Promise+Map penuh dengan state instance sungguhan)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 5/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/ReasoningLock.js` (baru), `frontend/src/core/runtime/services/engineer/ApprovalGateway.js` (baru)

---

## 1. Ringkasan

Langkah kelima dekomposisi `engineer.js` — fase pertama yang genuinely event-driven & timing-sensitive (timeout 10 menit di dua tempat). Dua kelompok:
- **ReasoningLock.js:** `_emitReasoningReport`, `_waitForUserConfirmation`, `_handleUserConfirmation` — prinsip "tidak ada kode dihasilkan tanpa analisis ditunjukkan".
- **ApprovalGateway.js:** `_handleApprovalResponse`, `_requestApproval`, `_emitRecommendation` — alur persetujuan Owner per-file.

## 2. Keputusan Desain: `_emitRecommendation` Dipertahankan sebagai Wrapper

`_emitRecommendation` dipanggil dari **21 tempat berbeda** di dalam `_handlePatchTask` — orchestrator utama yang belum diekstrak sampai Fase 8. Mengubah semua 21 titik panggil sekaligus (masing-masing dengan bentuk closing-brace multi-baris berbeda) berisiko tinggi untuk fungsi yang cuma 6 baris logika.

**Solusi:** logika sesungguhnya dipindah ke `ApprovalGateway.js` (`emitRecommendation(recommendation, deps)`), tapi `engineer.js` mempertahankan:
```js
_emitRecommendation(recommendation) {
  emitRecommendation(recommendation, { eventBus: this.eventBus, capability: this.capability });
}
```
21 titik panggil asli (`this._emitRecommendation(...)`) tidak disentuh sama sekali — nol risiko di area itu, sambil tetap mencapai tujuan dekomposisi (logika riil hidup di modul baru).

## 3. Perubahan Lain

- `pendingConfirmations` dan `pendingPatches` (dua `Map`) tetap jadi state instance Engineer, diteruskan ke fungsi modul lewat `deps` **by-reference** — mutasi (`set`/`get`/`delete`) tetap terlihat di Map yang sama, perilaku identik dengan sebelum diekstrak.
- Konstanta `CONFIRMATION_TIMEOUT_MS` dan `APPROVAL_TIMEOUT_MS` dipindah jadi satu sumber kebenaran masing-masing di `ReasoningLock.js`/`ApprovalGateway.js` (sebelumnya di top-level `engineer.js`, cuma dipakai di method yang sekarang sudah diekstrak).

**Hasil ukuran:** `engineer.js` 2096 → **1908 baris** (−188). Total sejak Fase 1: 2978 → 1908 (**−1070 baris, ~36%**).

## 4. Verifikasi

1. **Build production:** sukses, exit 0, 10.82s.
2. **`waitForUserConfirmation` + `handleUserConfirmation` round-trip**, dengan `pendingConfirmations` Map **live** milik instance Engineer sungguhan (`kernel.serviceManager.get('Engineer')`): Map ter-`set` sebelum resolve, `handleUserConfirmation({confirmed:true})` memicu resolver dengan benar (`confirmResult === true`), Map dibersihkan (`delete`) setelah selesai.
3. **`requestApproval` + `handleApprovalResponse` round-trip**, dengan `pendingPatches` Map live: percobaan pertama menemukan race condition — **di skrip tes saya sendiri**, bukan di kode — karena `requestApproval` `await savePendingPatch(...)` (I/O async) sebelum benar-benar men-set Map, sementara skrip tes langsung memanggil `handleApprovalResponse` tanpa jeda. Diperbaiki dengan memberi jeda eksplisit sebelum trigger response (mencerminkan kondisi nyata: user baru klik approve detik/menit kemudian, bukan seketika). Setelah diperbaiki: approval resolve dengan `approved: true` + `approvedFiles` benar, Map dibersihkan.
4. **`emitReasoningReport`:** struktur report yang dihasilkan (`taskId`, `summary`, `intent`) sesuai input uji.
5. **Wrapper `_emitRecommendation()`:** dipanggil langsung sebagai method instance (`engineer._emitRecommendation(...)`), dikonfirmasi tetap memicu event `Engineer:Recommendation` via `eventBus.on` listener sementara.
6. Console bersih, tanpa error.

## 5. Langkah Selanjutnya

Fase 6 (ADR-0017): ekstraksi `engineer/TaskHandlers.js` — jalur read-only (`_buildDynamicContext`, `_handleAnalysisTask`, `_handleReviewTask`, `_handleReadRepoTask`, `_handleReadFiles`, `_handleListDirectory`, `_handleSearchFiles`, 3 helper ekstraksi teks prompt).

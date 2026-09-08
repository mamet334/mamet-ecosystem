# Changelog: ADR-0017 Fase 1 — Ekstraksi SessionArtifact dari engineer.js

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi Live (build + instance runtime sungguhan)
**Scope:** [`ADR-0017-engineer-js-decomposition.md`](../../adr/ADR-0017-engineer-js-decomposition.md) Fase 1/8
**Komponen Terdampak:** `frontend/src/core/runtime/services/engineer.js`, `frontend/src/core/runtime/services/engineer/SessionArtifact.js` (baru)

---

## 1. Ringkasan

Langkah pertama dekomposisi `engineer.js` (2978 baris) sesuai rencana ADR-0017. Class `SessionArtifact` — struktur data pelacak konteks sesi Engineer, tanpa dependency ke instance `Engineer` atau service lain — dipindah utuh ke modul baru `engineer/SessionArtifact.js`.

## 2. Verifikasi Sebelum Eksekusi

Dicek dulu apakah `SessionArtifact` direferensikan file lain di luar `engineer.js` (untuk memastikan tidak ada import yang perlu diperbarui di tempat lain):
- `AssistantService.js:1221` dan `MemoryGovernorService.js:265,268` menyebut "SessionArtifact" — dikonfirmasi keduanya cuma komentar/JSDoc yang menerima instance sebagai parameter (duck-typed), **bukan** `import { SessionArtifact }`. Tidak ada file lain yang perlu disentuh.

## 3. Perubahan

- **Baru:** `frontend/src/core/runtime/services/engineer/SessionArtifact.js` — class `SessionArtifact` lengkap (`export class`), identik dengan versi lama, ditambah komentar rujukan ke ADR-0017.
- **`engineer.js`:** definisi class dihapus (132 baris), diganti `import { SessionArtifact } from './engineer/SessionArtifact.js'`. Pemakaian `new SessionArtifact(sessionId)` di `_initializeSessionArtifact()` tidak berubah sama sekali.

**Hasil ukuran:** `engineer.js` 2978 → **2846 baris**.

## 4. Verifikasi

1. **Build production:** `npm run build` di `frontend/` — sukses, exit 0, 1m 12s.
2. **Import modul terisolasi (dev server):** `new SessionArtifact('test-session-123')` — `addAnalyzedFile`, `addDecision`, `getSummary()`, `toPromptContext()` seluruhnya berfungsi benar terhadap data uji.
3. **Instance live di aplikasi berjalan:** `kernel.serviceManager.get('Engineer').sessionArtifact instanceof SessionArtifact` → `true`. Ini pembuktian paling kuat — bukan cuma modul baru bisa di-import, tapi Engineer yang sungguhan berjalan di app memakainya dengan benar.
4. **Log boot bersih:** `[Engineer] 📦 Session Artifact initialized: ENG-SESSION-...` muncul normal tanpa error di console.

## 5. Langkah Selanjutnya

Fase 2 (ADR-0017): ekstraksi `engineer/IntentClassifier.js` dan `engineer/CapabilityGuard.js` — utilitas deterministik tanpa I/O, risiko sangat rendah seperti Fase 1.

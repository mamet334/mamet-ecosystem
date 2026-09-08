# ADR-0017: engineer.js Decomposition Plan

**ID:** ADR-0017
**Judul:** Pemecahan Monolith `engineer.js` — Roadmap Extraction Bertahap
**Status:** 🟡 IN PROGRESS — Fase 1/8 selesai & terverifikasi (2026-09-08)
**Tanggal:** 2026-09-08
**Penulis:** Sesi diskusi arsitektur (Owner + Claude)
**Metodologi:** Direplikasi dari **ADR-0009 (`index.ts` Decomposition)** — preseden yang sudah terbukti berhasil dieksekusi (`agent-process/index.ts` 2301 baris → thin coordinator ~145 baris).
**Berlaku untuk:** `frontend/src/core/runtime/services/engineer.js`
**Terkait:** [`SPESIFIKASI-TEKNIS-MAMET-OS-v2.md`](../roadmap/SPESIFIKASI-TEKNIS-MAMET-OS-v2.md) §2.1 (Scoped Snippet Extraction — modul `CodeSnippetExtractor.js` yang diusulkan di sana akan hidup berdampingan dengan modul `PatchGenerator.js` di rencana ini), [`INDEX-ROADMAP.md`](../roadmap/INDEX-ROADMAP.md) Bagian 6 Item 14 (housekeeping struktur folder — filosofi yang sama)

---

## 1. Konteks dan Latar Belakang

### 1.1 Kondisi Saat Ini

`frontend/src/core/runtime/services/engineer.js` adalah file **2978 baris** — satu-satunya tempat seluruh logika AI internal Mamet OS (Engineer capability) hidup: deteksi intent, capability guard, reasoning lock, session artifact, analisis kode, generate patch, verifikasi breaking change, apply patch, approval flow, sampai file I/O.

File ini melanggar prinsip yang sama seperti `index.ts` sebelum ADR-0009:
- **Satu file, banyak tanggung jawab** — bertentangan dengan prinsip "One File, One Responsibility" yang jadi prinsip payung `INDEX-ROADMAP.md` Bagian 4.
- **Filosofi yang diminta Owner secara eksplisit:** *"terinspirasi dari sistem linux yang powerful dan mempunyai tanggung jawab per file, tidak god component code"* — `engineer.js` hari ini persis contoh *god component* yang dimaksud.

### 1.2 Kenapa Ini Penting (Bukan Cuma Kerapian)

1. **Sulit diaudit.** SystemGovernorService (§3, `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md`) mengawasi file besar sebagai sinyal anomali (`>500 baris` = default warning) — `engineer.js` 2978 baris jauh di atas ambang itu, tapi luput dari perhatian karena dianggap "memang begitu dari awal", bukan drift yang terdeteksi.
2. **§2.1 butuh tempat bersih untuk hidup.** Modul `CodeSnippetExtractor.js` yang dirancang di `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` §2.1 idealnya bukan method baru di dalam file 2978 baris ini — dia butuh "rumah" modular. Dekomposisi ini menyediakan rumah itu sekaligus untuk seluruh logika terkait, bukan cuma satu fungsi.
3. **Biaya kegagalan asimetris.** `engineer.js` adalah AI yang mengubah kode sistemnya sendiri (self-modifying agent, lihat rasional §0 `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md`). Bug tersembunyi di file besar ini lebih berbahaya daripada di file besar biasa.

---

## 2. Peta Tanggung Jawab `engineer.js` (2978 Baris, ~60 Method)

Hasil audit menyeluruh (baris per baris, per 2026-09-08):

### 2.1 Kelompok A — Session Artifact (Struktur Data)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Class `SessionArtifact`** | L43–172 | Struktur data lengkap: constructor, `addDecision`, `addAnalyzedFile`, `addModifiedFile`, `addReasoningReport`, `addMaefViolation`, `addCommand`, `incrementTaskCount`, `getSummary`, `toPromptContext` |

**Catatan:** Sudah berupa `class` terpisah di dalam file yang sama — **tidak ada coupling ke instance `Engineer`**, ekstraksi murni memindahkan lokasi file.

### 2.2 Kelompok B — Engineer Memory Store (Persistensi)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Pending Patch Persistence** | L424–488 | `_pendingKey`, `_savePendingPatch`, `_clearPendingPatch`, `_restorePersistedPatches` |
| **Verified/Rejected Approach Memory** | L489–654 | `_approachKey`, `_saveVerifiedApproach`, `_saveRejectedApproach`, `_loadVerifiedApproaches`, `_pruneApproachMemory` |

Semua lewat `this.storageManager` — satu-satunya dependency eksternal, mudah diinjeksi sebagai parameter.

### 2.3 Kelompok C — Capability Guard & Compliance (Kebijakan, Deterministik, 0 LLM)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Capability Guard** | L655–768 | `_checkCapabilityAndDeclare`, `_isImmutableFile`, `_isProtectedFile` |
| **MAEF Compliance Checker** | L2052–2116 | `_checkCompliance` — cek pola berbahaya (`eval`, vendor API langsung) di isi file |

Murni fungsi policy: input task/file content → output pass/fail + alasan. Tidak ada state instance yang dibutuhkan selain konstanta pola (`MAX_FILES_PER_PATCH`, dll).

### 2.4 Kelompok D — Intent Classifier (Deterministik, 0 LLM)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Intent Detection** | L1000–1080 | `_detectIntent` — klasifikasi ANALYSIS / MODIFY_CODE / CLARIFICATION dari task |

Pola identik dengan `RequestClassifierService.js` yang sudah ada di codebase (PR#8) — preseden langsung untuk pola ekstraksi modul classifier stateless.

### 2.5 Kelompok E — Reasoning Lock & Approval Gateway (Event-Driven)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Reasoning Lock** | L893–999 | `_emitReasoningReport`, `_waitForUserConfirmation`, `_handleUserConfirmation` |
| **Approval Gateway** | L1944–1963, L2867–2954 | `_handleApprovalResponse`, `_requestApproval`, `_emitRecommendation` |

Pola Promise + `pendingConfirmations`/timeout (10 menit) yang sama — cocok jadi satu modul "human-in-the-loop coordination".

### 2.6 Kelompok F — Read-Only Task Handlers

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Dynamic Context & Task Handlers** | L1081–1384 | `_buildDynamicContext`, `_handleAnalysisTask`, `_handleReviewTask`, `_handleReadRepoTask`, `_handleReadFiles`, `_handleListDirectory`, `_handleSearchFiles`, `_extractPathsFromPrompt`, `_extractDirectoryFromPrompt`, `_extractSearchQueryFromPrompt` |

Seluruh jalur task yang **tidak** menghasilkan patch — analisis, review, baca file/folder, cari file.

### 2.7 Kelompok G — Static Code Analyzer (Deterministik, 0 LLM)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Code Analysis Utilities** | L1731–1897 | `_extractExports`, `_extractFunctionSignatures`, `_findUsages`, `_detectBreakingChanges`, `_verifySemanticDiff` |

**Relevansi langsung ke §2.1:** modul ini sudah melakukan parsing kode berbasis pattern (tanpa AST) — brace-matching string-aware yang dirancang untuk `CodeSnippetExtractor.js` di §2.1 bisa berbagi utilitas dasar dengan `_detectBreakingChanges`/`_verifySemanticDiff` di sini.

### 2.8 Kelompok H — File System Gateway

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **File I/O** | L1963–2001, L2815–2866 | `readFile`, `findFiles`, `_extractFileNamesFromTask`, `_findRelevantADR`, `_tryReadFile` |

Satu-satunya tempat `engineer.js` bicara ke `StorageManager`/`RepositoryReaderService` untuk baca source code.

### 2.9 Kelompok I — Patch Generator (LLM Call — Risiko Tinggi)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Patch Generation Pipeline** | L2193–2628 | `_generatePatch`, `_buildPatchPrompt`, `_extractCodeFromResponse`, `_generateFallbackPatch` |

**Ini jantung §2.1.** `_buildPatchPrompt` (L2358–2499) adalah tempat persis logika `isLargeFile`/head-tail-truncation yang sudah diaudit dan dirombak di `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` §2.1. Modul `PatchGenerator.js` di rencana ini dan `CodeSnippetExtractor.js` di §2.1 **harus dikerjakan dalam sesi yang sama** — memisahkan keduanya berisiko dua PR saling tumpang tindih di file yang sama.

### 2.10 Kelompok J — Patch Applier & Confidence (Risiko Tinggi)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Patch Application** | L2629–2814 | `_executePatchApplication`, `_calculateConfidence` |

Menerapkan patch (termasuk mode `search_replace` yang sudah diverifikasi fungsional saat audit §2.1) ke file sungguhan.

### 2.11 Kelompok K — Core Orchestrator (Tetap di `engineer.js`)

| Nama Logis | Baris | Deskripsi |
|---|---|---|
| **Constructor & Init** | L175–244 | Wiring dependency (`EventBus`, `StorageManager`, `ProcessManager`, `ModuleLoader`, `RepositoryReaderService` opsional) |
| **Session Artifact Wiring** | L245–423 | `_initializeSessionArtifact`, `_updateArtifact`, `_injectArtifactIntoPrompt`, `_finalizeSession` — pemanggilan method `SessionArtifact` dari instance `Engineer`, beda dari Kelompok A yang murni struktur datanya |
| **Event Listener Registration** | L837–892 | `_registerListeners` |
| **`_handlePatchTask` (Orchestrator Utama)** | L1385–1730 | **345 baris** — memanggil hampir semua kelompok di atas secara berurutan: intent → capability guard → analyze → reasoning report → wait confirmation → generate patch → verify → request approval → execute |
| **Analyze/Review Pipeline** | L2117–2192 | `_analyze`, `_review` — memanggil Kelompok C, G, H |
| **Metrics & Capability** | L2954–2978 | `upgradeCapability`, `getMetrics` |

---

## 3. Modul Target yang Diusulkan

| Modul Baru | File Target | Kelompok | Baris Asal (approx.) |
|---|---|---|---|
| `engineer/SessionArtifact.js` | Baru | A | 130 |
| `engineer/EngineerMemoryStore.js` | Baru | B | 230 |
| `engineer/CapabilityGuard.js` | Baru | C | 180 |
| `engineer/IntentClassifier.js` | Baru | D | 80 |
| `engineer/ReasoningLock.js` | Baru | E (Reasoning Lock) | 107 |
| `engineer/ApprovalGateway.js` | Baru | E (Approval) | 105 |
| `engineer/TaskHandlers.js` | Baru | F | 305 |
| `engineer/StaticCodeAnalyzer.js` | Baru | G | 167 |
| `engineer/FileSystemGateway.js` | Baru | H | 90 |
| `engineer/CodeSnippetExtractor.js` | Baru | *(dari §2.1, dikerjakan bareng)* | — |
| `engineer/PatchGenerator.js` | Baru | I | 435 |
| `engineer/PatchApplier.js` | Baru | J | 185 |
| `engineer.js` (setelah decomposisi) | Tetap ada | K (thin orchestrator) | ~650-700 |

**Total estimasi setelah dekomposisi:** `engineer.js` dari 2978 baris → **~650-700 baris** (bukan ~200 seperti `index.ts`, karena `_handlePatchTask` sebagai orchestrator utama tetap kompleks secara inheren — 345 baris logika alur, bukan boilerplate yang bisa dipangkas).

---

## 4. Urutan Extraction yang Paling Aman

Prinsip sama seperti ADR-0009: ekstrak yang paling stateless & tanpa dependency dulu, tiap extraction **zero behavioral change**, pola **extract → import → verify → next**.

### Fase 1 — Struktur Data Murni (Risiko Sangat Rendah) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/SessionArtifact.js
Isi: Class SessionArtifact utuh (Kelompok A)
Kenapa duluan: Sudah class terpisah, nol coupling ke instance Engineer.
```
**Hasil:** `engineer.js` 2978 → **2846 baris** (−132 baris). Modul baru `engineer/SessionArtifact.js` (137 baris). Tidak ada file lain yang perlu diubah — 2 referensi tekstual di `AssistantService.js`/`MemoryGovernorService.js` ternyata cuma komentar/JSDoc, bukan `import`.

**Verifikasi (evidence-based, live):**
- Build production: ✅ sukses (1m 12s, exit 0)
- Import modul terisolasi: instance baru berfungsi penuh (`addAnalyzedFile`, `addDecision`, `getSummary()`, `toPromptContext()` semua benar)
- **Instance live di aplikasi berjalan** (`kernel.serviceManager.get('Engineer').sessionArtifact instanceof SessionArtifact`): `true` — dikonfirmasi lewat dev server sungguhan, bukan cuma build pass
- Log boot: `[Engineer] 📦 Session Artifact initialized: ENG-SESSION-...` muncul normal, tanpa error

### Fase 2 — Utilitas Deterministik Tanpa I/O (Risiko Sangat Rendah)
```
Ekstrak: engineer/IntentClassifier.js, engineer/CapabilityGuard.js
Isi: Kelompok D, Kelompok C (minus _checkCompliance yang butuh fileContents dari I/O)
Kenapa aman: Pure function — input task/config, output keputusan. Pola identik RequestClassifierService.js yang sudah terbukti.
```

### Fase 3 — Static Code Analyzer (Risiko Rendah)
```
Ekstrak: engineer/StaticCodeAnalyzer.js
Isi: Kelompok G (_extractExports, _extractFunctionSignatures, _findUsages, _detectBreakingChanges, _verifySemanticDiff)
Dependency: Tidak ada I/O langsung (menerima content sebagai parameter)
Catatan: Kerjakan bareng dengan CodeSnippetExtractor.js (§2.1) — keduanya sama-sama utilitas parsing kode, berbagi teknik brace-matching string-aware.
```

### Fase 4 — File System Gateway & Memory Store (Risiko Rendah-Sedang)
```
Ekstrak: engineer/FileSystemGateway.js, engineer/EngineerMemoryStore.js
Isi: Kelompok H, Kelompok B
Dependency: StorageManager, RepositoryReaderService
Kenapa sedang: Menyentuh I/O nyata (baca/tulis storage), perlu verifikasi tidak ada perubahan urutan read/write.
```

### Fase 5 — Reasoning Lock & Approval Gateway (Risiko Sedang)
```
Ekstrak: engineer/ReasoningLock.js, engineer/ApprovalGateway.js
Isi: Kelompok E
Dependency: EventBus, pendingConfirmations Map (state yang perlu dipindah bersih)
Kenapa sedang: Timing-sensitive (timeout 10 menit), UI-facing — regresi di sini terasa langsung oleh Owner.
Mitigasi: Tes end-to-end skenario approve & reject & timeout.
```

### Fase 6 — Read-Only Task Handlers (Risiko Sedang)
```
Ekstrak: engineer/TaskHandlers.js
Isi: Kelompok F
Dependency: FileSystemGateway (Fase 4), CapabilityGuard (Fase 2)
Kenapa sedang: Banyak jalur (analysis/review/read-repo/read-files/list-dir/search) — permukaan tes luas.
```

### Fase 7 — Patch Generator + CodeSnippetExtractor §2.1 (Risiko Tinggi — Digabung Sengaja)
```
Ekstrak: engineer/PatchGenerator.js + engineer/CodeSnippetExtractor.js (§2.1)
Isi: Kelompok I + rancangan snippet extraction dari SPESIFIKASI-TEKNIS-MAMET-OS-v2.md §2.1
Dependency: StaticCodeAnalyzer (Fase 3), BrainService (LLM call)
Kenapa tinggi & digabung: _buildPatchPrompt adalah tempat modifikasi §2.1 terjadi — kalau dipisah jadi 2 sesi terpisah, PR kedua akan konflik dengan struktur baru dari PR pertama. Kerjakan sekali, verifikasi sekali.
Mitigasi: Test dengan file kecil (≤3000 char, full-file mode) DAN file besar (identifier-based snippet mode) — dua jalur §2.1.
```

### Fase 8 — Patch Applier & Orchestrator Final Cleanup (Risiko Tinggi — Terakhir)
```
Ekstrak: engineer/PatchApplier.js
Isi: Kelompok J
Sisa di engineer.js: Kelompok K (constructor, _handlePatchTask, _analyze, _review, listeners, metrics) — jadi thin coordinator yang MEMANGGIL seluruh modul dari Fase 1-7.
Kenapa terakhir: Ini hard gate — bug di sini = patch tidak pernah ter-apply ke file sungguhan. Lakukan setelah 7 modul lain sudah stabil & teruji sendiri-sendiri.
Mitigasi: Test end-to-end penuh — dari task masuk sampai file benar-benar berubah di disk, minimal 3 skenario (file kecil, file besar/search-replace, patch ditolak Owner).
```

---

## 5. `engineer.js` Setelah Decomposition (Target State)

```javascript
// engineer.js (target state — setelah decomposition)
import { SessionArtifact } from './engineer/SessionArtifact.js';
import { EngineerMemoryStore } from './engineer/EngineerMemoryStore.js';
import { checkCapabilityAndDeclare, isImmutableFile, isProtectedFile } from './engineer/CapabilityGuard.js';
import { detectIntent } from './engineer/IntentClassifier.js';
import { ReasoningLock } from './engineer/ReasoningLock.js';
import { ApprovalGateway } from './engineer/ApprovalGateway.js';
import { handleAnalysisTask, handleReviewTask, handleReadRepoTask } from './engineer/TaskHandlers.js';
import { extractExports, detectBreakingChanges, verifySemanticDiff } from './engineer/StaticCodeAnalyzer.js';
import { FileSystemGateway } from './engineer/FileSystemGateway.js';
import { extractRelevantSnippet } from './engineer/CodeSnippetExtractor.js'; // dari §2.1
import { PatchGenerator } from './engineer/PatchGenerator.js';
import { PatchApplier } from './engineer/PatchApplier.js';

class Engineer {
  constructor(serviceManager) { /* wiring dependency, tetap di sini */ }
  async initialize() { /* load static knowledge + verified approaches via EngineerMemoryStore */ }

  async _handlePatchTask(task) {
    const intent = detectIntent(task);
    // ... orkestrasi memanggil modul-modul di atas secara berurutan ...
  }

  async _analyze(task) { /* memanggil FileSystemGateway + StaticCodeAnalyzer */ }
  async _review(task) { /* memanggil _analyze */ }
  upgradeCapability(newCapability) { /* ... */ }
  getMetrics() { return { ...this.metrics }; }
}

export { Engineer };
```

---

## 6. Aturan Backward Compatibility

Sama persis ADR-0009 §6:

1. **API contract tidak berubah** — fungsi yang diekstrak menerima input & mengembalikan output yang sama persis.
2. **State instance yang dipindah harus eksplisit** — `this.pendingConfirmations`, `this.pendingPatches`, `this.brain.verifiedApproaches` yang sekarang jadi state di modul baru (mis. `ReasoningLock`, `EngineerMemoryStore`) harus diinjeksi/dikembalikan lewat constructor, bukan variabel global tersembunyi.
3. **Tidak ada breaking imports** — event name (`Engineer:ReasoningReport`, `Engineer:RequestConfirmation`, dll — dipakai `ConversationEngine.jsx`) harus identik.
4. **Error behavior identik** — kalau method asli `throw`, versi baru harus `throw` error yang sama.
5. **No new dependencies** — tidak ada library baru ditambahkan selama decomposition murni ini (di luar §2.1 yang memang perubahan logika, bukan cuma pemindahan lokasi).

---

## 7. Kriteria Verifikasi per Fase

| Check | Metode |
|---|---|
| Build frontend sukses | `npm run build` di `frontend/` |
| No regression Reasoning Lock | Test manual: kirim task patch, pastikan Reasoning Report muncul, tombol Lanjutkan/Batalkan berfungsi |
| No regression Approval flow | Test manual: approve & reject patch, pastikan `Engineer:GeneratePatch` → apply berjalan sesuai skenario masing-masing |
| No regression Capability Guard | Test dengan file di `IMMUTABLE_PATTERNS`/`PROTECTED_PATTERNS`, pastikan tetap diblokir |
| No regression §2.1 (Fase 7 khusus) | Test file kecil (full-file mode) DAN file besar (snippet mode identifier-based) |
| Session Artifact tetap terisi | Cek `getSummary()` mengembalikan data yang sama sebelum & sesudah dekomposisi |

---

## 8. Yang Tidak Termasuk dalam Scope Decomposition Ini

| Item | Alasan Dikeluarkan |
|---|---|
| Perubahan logika bisnis di luar §2.1 | ADR ini tentang struktur file, bukan logika (kecuali §2.1 yang memang revisi logika terpisah, dikerjakan bareng karena lokasi kode yang sama) |
| Penambahan fitur baru | Konsisten prinsip *Evolution Without Chaos* |
| Folder `tools/` (dibahas terpisah, belum diputuskan) | Di luar scope — item terpisah di `INDEX-ROADMAP.md` |
| Izin tool per-mode granular | Sengaja ditunda Owner — belum ada daftar tool final |
| Perubahan skema database | Tidak relevan — `engineer.js` murni frontend service |

---

## 9. Timeline (Estimasi)

| Fase | Estimasi | Prasyarat |
|---|---|---|
| ADR ini (planning) | Selesai | — |
| Fase 1–2 (SessionArtifact, IntentClassifier, CapabilityGuard) | 1 sesi | Persetujuan Owner untuk mulai |
| Fase 3 (StaticCodeAnalyzer) | 1 sesi | Fase 1-2 selesai & terverifikasi |
| Fase 4 (FileSystemGateway, EngineerMemoryStore) | 1 sesi | Fase 3 selesai |
| Fase 5–6 (ReasoningLock, ApprovalGateway, TaskHandlers) | 1-2 sesi | Fase 4 selesai |
| Fase 7 (PatchGenerator + §2.1 CodeSnippetExtractor) | 1-2 sesi | Fase 1-6 selesai — **prioritas tinggi karena menutup §2.1** |
| Fase 8 (PatchApplier + finalisasi orchestrator) | 1 sesi | Semua fase sebelumnya stabil |

---

## 10. Referensi

- `frontend/src/core/runtime/services/engineer.js` (2978 baris, per 2026-09-08)
- **ADR-0009** — `index.ts Decomposition Plan` (metodologi & preseden keberhasilan)
- `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` §2.1 (Scoped Snippet Extraction — digabung ke Fase 7)
- `INDEX-ROADMAP.md` Bagian 4 (Prinsip "One File, One Responsibility")
- Diskusi Owner: filosofi Linux, "powerful tapi bertanggung jawab per file, tidak god component" (2026-09-08)

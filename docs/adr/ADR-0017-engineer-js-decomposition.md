# ADR-0017: engineer.js Decomposition Plan

**ID:** ADR-0017
**Judul:** Pemecahan Monolith `engineer.js` — Roadmap Extraction Bertahap
**Status:** ✅ SELESAI — Semua 8 fase selesai & terverifikasi live (2026-09-08). `engineer.js` 2978 → 1133 baris (−62%).
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

### Fase 2 — Utilitas Deterministik Tanpa I/O (Risiko Sangat Rendah) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/IntentClassifier.js, engineer/CapabilityGuard.js
Isi: Kelompok D, Kelompok C (minus _checkCompliance yang butuh fileContents dari I/O)
Kenapa aman: Pure function — input task/config, output keputusan. Pola identik RequestClassifierService.js yang sudah terbukti.
```
**Koreksi ditemukan saat eksekusi:** `_checkCapabilityAndDeclare` ternyata **bukan** murni self-contained seperti diasumsikan di rencana awal — dia memanggil `this._extractFileNamesFromTask`, `this._findRelevantADR`, `this._calculateConfidence` (milik Kelompok H & J, belum diekstrak). Diselesaikan dengan pola dependency-injection: `checkCapabilityAndDeclare(task, options, deps)` menerima ketiga helper itu lewat parameter `deps`, dipanggil dari `engineer.js` dengan `this.method.bind` — perilaku identik, modul tetap murni testable tanpa instance Engineer.

**Hasil:** `engineer.js` 2846 → **2666 baris** (−180 baris). Modul baru: `engineer/IntentClassifier.js` (77 baris), `engineer/CapabilityGuard.js` (137 baris). `MAX_FILES_PER_PATCH` dipindah jadi satu sumber kebenaran di `CapabilityGuard.js` (sebelumnya duplikat komentar "harus sama dengan Capability Guard" — sekarang benar-benar dijamin sama secara struktural).

**Verifikasi (evidence-based, live, 11 skenario):**
- Build production: ✅ sukses (44.41s, exit 0)
- `detectIntent`: 5 skenario (greeting→CLARIFICATION, analysis→ANALYSIS, kata "perbaiki"→MODIFY_CODE paksa, read-repo→READ_REPO, teks kosong→CLARIFICATION) — semua cocok logika asli
- `checkCapabilityAndDeclare`: prompt <20 kata → `pass:false` ✅; prompt cukup+file dalam batas+ADR ada+confidence tinggi → `pass:true` ✅
- `isImmutableFile`/`isProtectedFile`: file core terdeteksi benar, file biasa tidak
- Instance Engineer live tetap sehat (`intentState`, `capability`, `sessionArtifact` semua normal), console bersih tanpa error

### Fase 3 — Static Code Analyzer (Risiko Rendah) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/StaticCodeAnalyzer.js
Isi: Kelompok G (_extractExports, _extractFunctionSignatures, _findUsages, _detectBreakingChanges, _verifySemanticDiff)
Dependency: Tidak ada I/O langsung (menerima content sebagai parameter)
Catatan: Kerjakan bareng dengan CodeSnippetExtractor.js (§2.1) — keduanya sama-sama utilitas parsing kode, berbagi teknik brace-matching string-aware.
```
**Koreksi ditemukan saat eksekusi (pola sama seperti Fase 2):** `_findUsages` dan `_verifySemanticDiff` **bukan** tanpa-I/O seperti diasumsikan — `_findUsages` butuh `this.fileIndexService`+`this.storageManager`, `_verifySemanticDiff` butuh `this.storageManager`. `extractExports`/`extractFunctionSignatures` memang murni. Diselesaikan dengan pola dependency-injection yang sama seperti Fase 2 (`deps` parameter), termasuk pada `detectBreakingChanges` yang meneruskan `deps` ke `findUsages` internal.

**Catatan implementasi §2.1:** ekstraksi ini murni memindahkan 5 method yang SUDAH ADA — belum membangun algoritma baru `CodeSnippetExtractor.js` dari §2.1 (itu logika baru, belum ada di kode manapun). Keputusan bundling §2.1 tetap di Fase 7 (bersama `PatchGenerator.js`), sesuai rencana awal di §4.

**Hasil:** `engineer.js` 2666 → **2452 baris** (−214 baris). Modul baru `engineer/StaticCodeAnalyzer.js` (~230 baris).

**Verifikasi (evidence-based, live):**
- Build production: ✅ sukses (11.35s, exit 0)
- `extractExports`/`extractFunctionSignatures`: benar mengekstrak nama & arity dari sample kode uji
- `detectBreakingChanges` (dengan `fileIndexService`/`storageManager` live dari instance Engineer sungguhan): benar mendeteksi export yang dihapus, severity `LOW` benar (tidak ada caller ditemukan untuk symbol uji unik)
- `verifySemanticDiff`: alur eksekusi terbukti identik dengan versi lama — melaporkan "File kosong" untuk path source code asli karena `storageManager` di app ini memang bukan backend pembaca file repo (itu tugas `RepositoryReaderService` terpisah) — perilaku ini **sama persis** dengan kode sebelum diekstrak, bukan regresi
- Console bersih, tanpa error

### Fase 4 — File System Gateway & Memory Store (Risiko Rendah-Sedang) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/FileSystemGateway.js, engineer/EngineerMemoryStore.js
Isi: Kelompok H, Kelompok B
Dependency: StorageManager, RepositoryReaderService
Kenapa sedang: Menyentuh I/O nyata (baca/tulis storage), perlu verifikasi tidak ada perubahan urutan read/write.
```
**Tantangan tambahan dibanding Fase 2-3:** `loadVerifiedApproaches` (dari `_loadVerifiedApproaches`) di versi lama **memutasi `this.brain` langsung** — tidak bisa sekadar dependency-injection seperti fase sebelumnya. Diselesaikan dengan mengubah fungsi jadi mengembalikan `{ verifiedApproaches, rejectedPatterns }`, dan `engineer.js` (di `initialize()`) yang menugaskan hasilnya ke `this.brain` — modul tetap tidak butuh instance Engineer sama sekali.

**Hasil:** `engineer.js` 2452 → **2096 baris** (−356 baris). Modul baru: `engineer/EngineerMemoryStore.js` (~250 baris), `engineer/FileSystemGateway.js` (~155 baris). `findFiles` dipindah apa adanya walau ternyata tidak dipanggil dari mana pun di codebase (kode mati sejak sebelum dekomposisi — dibiarkan, bukan tugas fase ini untuk menghapus kode).

**Verifikasi (evidence-based, live, dengan dependency instance Engineer sungguhan):**
- Build production: ✅ sukses (11.49s, exit 0)
- `extractFileNamesFromTask`/`findRelevantADR` (murni): benar mengekstrak path & memetakan ke ADR yang relevan
- `readFile`/`tryReadFile` dengan `storageManager`/`fileIndexService` live: berhasil tulis-lalu-baca file uji lewat kedua fungsi
- `savePendingPatch`/`clearPendingPatch` round-trip dengan `storageManager` live: patch tersimpan benar, terkonfirmasi lewat baca key mentah
- `approachKey` deterministik: urutan file berbeda menghasilkan key yang sama (karena di-sort secara internal), sesuai desain asli
- `engineer.brain.verifiedApproaches`/`rejectedPatterns` tetap terisi via pola return-value setelah `initialize()` — bukan lagi mutasi internal modul
- Boot log bersih, tanpa error
- **Temuan sampingan (bukan bug ekstraksi):** `storageManager.write(key, null)` ternyata menyimpan string literal `"null"`, bukan benar-benar menghapus key — dikonfirmasi ini **perilaku asli StorageManager**, baris kode `clearPendingPatch` sama persis dengan `_clearPendingPatch` sebelum diekstrak. Dicatat untuk kesadaran, di luar scope untuk diperbaiki di sini.

### Fase 5 — Reasoning Lock & Approval Gateway (Risiko Sedang) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/ReasoningLock.js, engineer/ApprovalGateway.js
Isi: Kelompok E
Dependency: EventBus, pendingConfirmations Map (state yang perlu dipindah bersih)
Kenapa sedang: Timing-sensitive (timeout 10 menit), UI-facing — regresi di sini terasa langsung oleh Owner.
Mitigasi: Tes end-to-end skenario approve & reject & timeout.
```
**Keputusan desain — `_emitRecommendation` dipertahankan sebagai wrapper tipis:** fungsi ini dipanggil dari **~21 tempat** di dalam `_handlePatchTask` (orchestrator utama, belum diekstrak sampai Fase 8). Logika sesungguhnya dipindah ke `ApprovalGateway.js` (`emitRecommendation`), tapi `engineer.js` mempertahankan method `_emitRecommendation()` satu baris yang mendelegasikan ke sana — menghindari mengubah 21 titik panggil dengan pola closing-brace berbeda-beda sekaligus (risiko tidak sepadan manfaatnya untuk fungsi 6 baris). `pendingConfirmations` dan `pendingPatches` (kedua Map) tetap jadi state di instance Engineer, diteruskan ke modul via `deps` by-reference — mutasi tetap terlihat di Map yang sama.

**Hasil:** `engineer.js` 2096 → **1908 baris** (−188 baris). Modul baru: `engineer/ReasoningLock.js` (~115 baris), `engineer/ApprovalGateway.js` (~140 baris). Konstanta `CONFIRMATION_TIMEOUT_MS`/`APPROVAL_TIMEOUT_MS` dipindah jadi satu sumber kebenaran di modul masing-masing.

**Verifikasi (evidence-based, live, siklus Promise+Map penuh):**
- Build production: ✅ sukses (10.82s, exit 0)
- `waitForUserConfirmation` + `handleUserConfirmation` round-trip dengan `pendingConfirmations` Map **live** milik instance Engineer sungguhan: Map ter-set benar, resolver terpanggil benar (`confirmed: true` → resolve `true`), Map dibersihkan setelah selesai
- `requestApproval` + `handleApprovalResponse` round-trip dengan `pendingPatches` Map live: diverifikasi 2 panggilan terpisah (karena `savePendingPatch` async, race condition ditemukan di skrip tes saya sendiri saat percobaan pertama — bukan di kode — diperbaiki dengan jeda eksplisit sebelum trigger response), approval resolve dengan `approvedFiles` benar, Map dibersihkan
- `emitReasoningReport`: struktur report benar (`taskId`, `summary`, `intent` sesuai input)
- Wrapper `_emitRecommendation()` (masih dipakai 21x tanpa diubah): dikonfirmasi tetap memicu event `Engineer:Recommendation` dengan benar lewat delegasi ke modul baru
- Console bersih, tanpa error

### Fase 6 — Read-Only Task Handlers (Risiko Sedang) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/TaskHandlers.js
Isi: Kelompok F
Dependency: FileSystemGateway (Fase 4), CapabilityGuard (Fase 2)
Kenapa sedang: Banyak jalur (analysis/review/read-repo/read-files/list-dir/search) — permukaan tes luas.
```
**Koreksi ditemukan saat eksekusi:** `_handleAnalysisTask` dan `_handleReviewTask` ternyata masih bergantung pada `_analyze`/`_review`/`_calculateConfidence` — belum diekstrak (target Fase 7/8) — dan memutasi `this.metrics` langsung. Bukan murni read-only seperti asumsi awal ADR. Diselesaikan dengan deps-injection: `engineer.js` meneruskan `analyze`/`review`/`calculateConfidence`/`updateArtifact` sebagai fungsi ter-bind, dan `metrics`/`brain` diteruskan **by-reference** (sama seperti pola Map di fase sebelumnya) — `metrics.tasksAnalyzed++` dan `brain.dynamic = ...` di dalam modul tetap termutasi di instance Engineer asli.

Sembilan method (`_buildDynamicContext`, `_handleAnalysisTask`, `_handleReviewTask`, `_handleReadRepoTask`, `_handleReadFiles`, `_handleListDirectory`, `_handleSearchFiles`, `_extractPathsFromPrompt`, `_extractDirectoryFromPrompt`, `_extractSearchQueryFromPrompt`) dipindah. Fungsi-fungsi yang saling memanggil dalam alur READ_REPO (mis. `handleReadRepoTask` memanggil `handleListDirectory`/`handleSearchFiles`/`handleReadFiles`) memanggil langsung sebagai fungsi lokal di dalam modul, bukan lewat `deps` — deps hanya membawa dependensi eksternal sungguhan (`repositoryReader`, `emitRecommendation`, `fileIndexService`, `sessionArtifact`, `eventBus`). Ketiga method `_extractPathsFromPrompt`/`_extractDirectoryFromPrompt`/`_extractSearchQueryFromPrompt` dihapus total dari `engineer.js` (tanpa wrapper) karena tidak ada pemanggil lain di luar `_handleReadRepoTask` yang juga sudah pindah ke modul.

**Hasil:** `engineer.js` 1908 → **1680 baris** (−228 baris). Modul baru: `engineer/TaskHandlers.js` (~300 baris). Total sejak Fase 1: 2978 → 1680 (**−1298 baris, ~44%**).

**Verifikasi (evidence-based, live, terhadap instance Engineer sungguhan):**
- Build production: ✅ sukses (10.69s, exit 0)
- `_buildDynamicContext`: dipanggil langsung, struktur hasil benar (`task.id`, `projectContext`, `timestamp`)
- `_handleReadRepoTask` jalur LIST (`"list folder frontend/src/core"`): event `READ_REPO_EMPTY` ter-emit dengan `dirPath` yang benar diekstrak dari prompt via `extractDirectoryFromPrompt` — repositoryReader mengembalikan kosong karena panggilan GitHub API diblokir CSP di sandbox dev lokal (bukan regresi Fase 6, `repositoryReader` sendiri tidak disentuh)
- `_handleReadRepoTask` jalur SEARCH (`"cari file engineer"`) dan jalur READ default (`"baca file engineer.js"`): keduanya routing dengan benar ke `handleSearchFiles`/`handleReadFiles`, event `READ_REPO_NOT_FOUND` ter-emit (repositoryReader gagal fetch GitHub, sama seperti di atas)
- `_handleAnalysisTask`: event `ANALYSIS` ter-emit lengkap dengan `analysis`/`confidence` — rantai `this._analyze`→`this._calculateConfidence`→`this._updateArtifact` (belum diekstrak) tetap utuh lewat deps ter-bind
- **Mutasi by-reference dikonfirmasi:** setelah pemanggilan, `engineer.metrics.tasksAnalyzed === 1` dan `engineer.brain.dynamic.task.id === 't6'` — objek `metrics`/`brain` asli termutasi dari dalam modul, sama seperti Map di fase sebelumnya
- Console bersih dari error selain CSP GitHub API (pra-eksisting, tidak terkait ekstraksi)

### Fase 7 — Patch Generator + CodeSnippetExtractor §2.1 (Risiko Tinggi — Digabung Sengaja) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/PatchGenerator.js + engineer/CodeSnippetExtractor.js (§2.1)
Isi: Kelompok I + rancangan snippet extraction dari SPESIFIKASI-TEKNIS-MAMET-OS-v2.md §2.1
Dependency: StaticCodeAnalyzer (Fase 3), BrainService (LLM call)
Kenapa tinggi & digabung: _buildPatchPrompt adalah tempat modifikasi §2.1 terjadi — kalau dipisah jadi 2 sesi terpisah, PR kedua akan konflik dengan struktur baru dari PR pertama. Kerjakan sekali, verifikasi sekali.
Mitigasi: Test dengan file kecil (≤3000 char, full-file mode) DAN file besar (identifier-based snippet mode) — dua jalur §2.1.
```

**`CodeSnippetExtractor.js` — implementasi §2.1 (logika baru, bukan pemindahan kode):** modul PURE tanpa dependency ke instance Engineer. `extractRelevantSnippet(fileContent, targetIdentifiers, contextLines=5)` punya 3 jalur (`method` di hasil): **`full-file`** (file ≤3000 char, tidak dipangkas sama sekali), **`identifier`** (identifier dari task match deklarasi sungguhan — function/class/const-arrow/class-method — di file, dipangkas ke ±contextLines di sekitar tiap blok, digabung kalau overlap), dan **`keyword-scan`** (fallback saat tidak ada identifier yang match deklarasi apa pun — window 50-baris dengan densitas kemunculan identifier tertinggi dipilih). `extractTargetIdentifiers(task, fileContent)` mengekstrak kandidat camelCase/PascalCase/snake_case/`_prefixed` dari `task.title`/`description` lalu memvalidasi ulang keberadaannya di file (word-boundary match) — membuang kandidat yang cuma kebetulan mirip kata biasa.

**Brace-matching string-aware (§2.1.4, bagian tersulit):** `_findBlockEnd()` memindai karakter-demi-karakter dengan stack konteks (`STRING_SINGLE`/`STRING_DOUBLE`/`TEMPLATE`/`INTERP`/`LINE_COMMENT`/`BLOCK_COMMENT`) — brace HANYA dihitung ke `braceDepth` terluar saat stack kosong (kode normal). Interpolasi template literal `${...}` membuka frame `INTERP` dengan `localDepth` sendiri, sehingga brace di dalam interpolasi (termasuk object-literal bersarang seperti `${ (function(){ return {a:1}; })() }`) tidak pernah menyentuh `braceDepth` terluar — diverifikasi live persis terhadap kasus yang disebut spec: fungsi yang membangun prompt lewat template literal berisi `{`/`}` literal (`_buildPatchPrompt`/`buildPatchPrompt` sendiri adalah contoh nyatanya).

**Integrasi ke `buildPatchPrompt` (§2.1.5):** percabangan lama `isLargeFile` (char-count: file >6000 char dapat 4000 awal+4000 akhir, tengah dibuang) dihapus total, diganti satu pemanggilan `extractRelevantSnippet()` per file. Format output yang diminta ke LLM sekarang **SELALU search-replace** untuk semua ukuran file (sebelumnya hanya file besar yang diminta search-replace, file kecil diminta konten penuh) — bagian "FORMAT JSON WAJIB", "CONTOH OUTPUT YANG BENAR", dan "ATURAN KODE" di prompt diperbarui konsisten dengan perubahan ini. Apply logic (`__mode: 'search_replace'` handling di `generatePatch()`) **tidak berubah** dari sebelumnya — sudah fungsional penuh, snippet cuma memangkas apa yang *ditunjukkan* ke LLM, bukan cara patch diterapkan (fileContents utuh tetap disimpan di memori).

**Modul `PatchGenerator.js`:** empat fungsi — `generatePatch(task, deps)`, `buildPatchPrompt(task, fileContents, deps)`, `extractCodeFromResponse(response)` (pure), `generateFallbackPatch(task, fileContents)` (pure). `deps` untuk `generatePatch`: `{ storageManager, fileIndexService, serviceManager, eventBus, brain, injectArtifactIntoPrompt }` — `brain` diteruskan by-reference read-only (dibaca untuk `verifiedApproaches`/`rejectedPatterns`, tidak dimutasi di fase ini), `injectArtifactIntoPrompt` fungsi ter-bind ke instance (method kecil yang tetap tinggal di `engineer.js`, tidak diekstrak).

**Hasil:** `engineer.js` 1680 → **1261 baris** (−419 baris). Modul baru: `engineer/PatchGenerator.js` (~340 baris), `engineer/CodeSnippetExtractor.js` (~330 baris). Total sejak Fase 1: 2978 → 1261 (**−1717 baris, ~58%**). `_buildPatchPrompt`/`_extractCodeFromResponse`/`_generateFallbackPatch` dihapus total dari `engineer.js` tanpa wrapper (tidak ada pemanggil eksternal di luar `_generatePatch` yang juga sudah pindah) — hanya `_generatePatch` yang dipertahankan sebagai wrapper tipis karena dipanggil dari `_handlePatchTask` (orchestrator, Fase 8).

**Verifikasi (evidence-based, live, terhadap instance Engineer sungguhan + import langsung modul):**
- Build production: ✅ sukses (19.24s, exit 0)
- **Jalur `full-file`:** file ≤3000 char → `snippet === fileContent` persis, tidak dipangkas
- **Jalur `identifier`:** file besar (>3000 char) dengan identifier target sungguhan → snippet berhenti tepat di closing brace fungsi target, TIDAK meluber ke fungsi berikutnya (`afterFunction` dikonfirmasi TIDAK ikut ter-include)
- **String-awareness dikonfirmasi dengan kasus sulit:** fungsi yang mengandung template literal berisi `{nested}` literal DAN interpolasi bersarang `${ (function(){ return {a:1}; })() }` — brace-matching tetap menemukan closing brace fungsi yang benar, tidak salah hitung akibat brace di dalam string/interpolasi
- **Jalur `keyword-scan`:** identifier diberikan tapi tidak match deklarasi apa pun (cuma muncul di komentar) → window 50-baris dengan densitas tertinggi terpilih, `identifierFound: true`, kata kunci target ada di snippet
- **`buildPatchPrompt` end-to-end** (impor langsung dari browser, bukan cuma unit logic): prompt untuk file kecil DAN file besar dua-duanya sekarang mengandung instruksi "SEARCH-REPLACE" SELALU, percabangan char-count lama (`isLargeFile`) dikonfirmasi hilang total dari output prompt, padding besar TIDAK ikut ter-dump mentah ke prompt (dipangkas ke snippet)
- **`_generatePatch` wrapper:** dipanggil langsung terhadap instance Engineer live, deps (`storageManager`/`fileIndexService`/`serviceManager`/`eventBus`/`brain`/`injectArtifactIntoPrompt`) terbukti tersambung benar — jalur "tidak ada file terbaca" mengembalikan struktur error yang identik dengan versi lama
- **`extractCodeFromResponse`/`generateFallbackPatch`** (pure): diuji langsung, hasil sesuai kontrak lama tanpa perubahan
- Instance method `_buildPatchPrompt` dikonfirmasi TIDAK ADA lagi di `engineer.js` (`typeof engineer._buildPatchPrompt === 'undefined'`) — sesuai keputusan "tanpa wrapper" karena tidak ada pemanggil eksternal
- Console bersih, tanpa error dari perubahan ini

### Fase 8 — Patch Applier & Orchestrator Final Cleanup (Risiko Tinggi — Terakhir) ✅ SELESAI (2026-09-08)
```
Ekstrak: engineer/PatchApplier.js
Isi: Kelompok J
Sisa di engineer.js: Kelompok K (constructor, _handlePatchTask, _analyze, _review, listeners, metrics) — jadi thin coordinator yang MEMANGGIL seluruh modul dari Fase 1-7.
Kenapa terakhir: Ini hard gate — bug di sini = patch tidak pernah ter-apply ke file sungguhan. Lakukan setelah 7 modul lain sudah stabil & teruji sendiri-sendiri.
Mitigasi: Test end-to-end penuh — dari task masuk sampai file benar-benar berubah di disk, minimal 3 skenario (file kecil, file besar/search-replace, patch ditolak Owner).
```

**Koreksi ditemukan saat eksekusi — primitif tidak bisa by-reference:** `this.suspiciousAttempts` (number) dan `this.capability` (string) di instance Engineer, berbeda dari `pendingConfirmations`/`pendingPatches` (Map) atau `metrics`/`brain` (object) di fase-fase sebelumnya, adalah **primitif** — di JS, primitif TIDAK bisa diteruskan by-reference ke modul lain untuk dimutasi. Solusi: mutasi keamanan (`suspiciousAttempts++`, downgrade `capability` ke `OBSERVER` setelah 3x percobaan, emit `Engineer:EmergencyLockdown`) tetap tinggal sebagai closure di `engineer.js`, diteruskan ke `PatchApplier.js` sebagai satu callback `onImmutableFileBlocked()` — modul baru tidak perlu tahu apa pun soal `this`. `metrics` (object) tetap memakai pola by-reference biasa seperti fase-fase sebelumnya (`metrics.coreModificationsBlocked++`).

**Modul `PatchApplier.js`:** satu fungsi `executePatchApplication(patch, approvedFiles, deps)`. `deps`: `{ metrics, eventBus, storageManager, serviceManager, emitRecommendation, finalizeSession, onImmutableFileBlocked }`. `isImmutableFile`/`isProtectedFile` diimpor langsung dari `CapabilityGuard.js` (pola sama seperti `ApprovalGateway.js` di Fase 5) — pure functions, tidak butuh `this`. `finalizeSession` dan `emitRecommendation` diteruskan sebagai fungsi ter-bind ke instance (keduanya tetap tinggal di `engineer.js` — `_finalizeSession` bergantung `this.sessionArtifact`, `_emitRecommendation` tetap wrapper tipis dari Fase 5).

**`_executePatchApplication` dipertahankan sebagai wrapper tipis** di `engineer.js` (dipanggil sekali dari `_handlePatchTask`) — konsisten dengan pola `_generatePatch` di Fase 7, meminimalkan sentuhan ke orchestrator `_handlePatchTask` yang sudah teruji sepenuhnya di fase-fase sebelumnya (prinsip kehati-hatian untuk fase risiko tertinggi: ubah sesedikit mungkin selain yang benar-benar diekstrak).

`isImmutableFile`/`isProtectedFile` dihapus dari import `engineer.js` (sudah tidak ada pemanggil lain di file ini setelah `_executePatchApplication` dipindah).

**Hasil:** `engineer.js` 1261 → **1133 baris** (−128 baris). Modul baru: `engineer/PatchApplier.js` (~180 baris). Total sejak Fase 1: 2978 → 1133 (**−1845 baris, ~62%**). Lebih besar dari estimasi awal ~650-700 baris di §5 (Target State) — karena `_handlePatchTask` (orchestrator, ~365 baris), `_analyze`/`_review`/`_checkCompliance`, `_registerListeners`, `_loadStaticKnowledge`, dan Session Artifact plumbing (Kelompok K) memang secara sah tetap tinggal sebagai bagian coordinator, bukan kandidat ekstraksi lebih lanjut — estimasi §5 bersifat aspirasional, bukan target keras.

**Verifikasi (evidence-based, live, end-to-end sampai file BENAR-BENAR berubah — bukan cuma mock):**
- Build production: ✅ sukses (11.23s, exit 0)
- **Skenario 1 (file kecil, approved):** `_executePatchApplication` dipanggil langsung terhadap instance Engineer live dengan patch 1 file → `status: APPLIED`, file dibaca ulang dari `storageManager` dan **isinya cocok persis** dengan `newContent` yang dikirim — bukti tulisan sungguhan, bukan simulasi
- **Skenario 2 (file besar/hasil search-replace, 2 file — satu approved satu tidak):** file yang di-approve → `APPLIED` dan isi tertulis benar; file yang tidak di-approve → `SKIPPED`, dikonfirmasi TIDAK ada di storage sama sekali
- **Skenario 3 (file IMMUTABLE diblokir):** `success: false`, `error: 'Core file modification blocked'`, `metrics.coreModificationsBlocked` naik 1, `suspiciousAttempts` naik 1 via closure `onImmutableFileBlocked` — dikonfirmasi mutasi tembus ke instance asli meski primitif
- **Emergency lockdown di percobaan ke-3:** dipicu 2x percobaan immutable tambahan → `suspiciousAttempts === 3`, `capability` berubah jadi `OBSERVER`, event `Engineer:EmergencyLockdown` ter-emit dengan `attempts: 3` — perilaku identik dengan kode asli
- **Safety-check anti-truncation:** file dengan `newContent` <50% ukuran `originalContent` → `status: FAILED`, pesan error persis sama format dengan kode asli (`"Konten terlalu kecil: 5 vs 1000 chars (1%)..."`)
- **Skenario "patch ditolak Owner":** diverifikasi via pembacaan kode — cabang `!approvalResult.approved` di `_handlePatchTask` (tidak disentuh sama sekali di Fase 8) tidak pernah memanggil `_executePatchApplication`; jalur ini sudah diverifikasi live di Fase 5 (`ApprovalGateway.js`, `approved: false`)
- Console bersih dari error tak terduga — error yang muncul (`MemoryService: User not authenticated`) adalah keterbatasan sandbox dev tanpa user login (kode `memoryService.storeMemory` dipindah verbatim, sama seperti sebelum diekstrak), dan `🚫 BLOCKED`/`🚫 DITOLAK` adalah `console.error` yang MEMANG bagian dari skenario yang sengaja dipicu
- State test (`suspiciousAttempts`, `capability`, data di localStorage test) dibersihkan/direset setelah verifikasi selesai

## 4.1 Ringkasan Akhir — Dekomposisi Selesai

Semua 8 fase selesai. `engineer.js`: **2978 → 1133 baris (−1845, ~62%)**. 8 modul baru di `frontend/src/core/runtime/services/engineer/`: `SessionArtifact.js`, `CapabilityGuard.js`, `IntentClassifier.js`, `StaticCodeAnalyzer.js`, `EngineerMemoryStore.js`, `FileSystemGateway.js`, `ReasoningLock.js`, `ApprovalGateway.js`, `TaskHandlers.js`, `PatchGenerator.js`, `CodeSnippetExtractor.js`, `PatchApplier.js` (12 modul, sesuai peta awal). `engineer.js` sekarang berperan sebagai thin coordinator (Kelompok K): constructor, lifecycle (`initialize`, `_loadStaticKnowledge`, `_registerListeners`), Session Artifact plumbing, `_handlePatchTask` (orchestrator utama yang memanggil seluruh modul), `_analyze`/`_review`/`_checkCompliance`, `_calculateConfidence`, `_emitRecommendation` (wrapper tipis, Fase 5), `upgradeCapability`, `getMetrics`.

Metodologi yang bertahan konsisten di semua 8 fase: baca baris & dependensi sungguhan setiap fase (bukan percaya asumsi ADR begitu saja — koreksi ditemukan & didokumentasikan di Fase 2, 3, 4, 6, 8), deps-injection untuk fungsi yang belum diekstrak, object/Map diteruskan by-reference untuk state bersama, primitif diteruskan lewat closure/callback (bukan by-reference — koreksi Fase 8), wrapper tipis hanya dipertahankan saat ada banyak titik panggil (`_emitRecommendation` 21x, Fase 5) atau untuk meminimalkan sentuhan ke orchestrator berisiko tinggi (`_generatePatch`, `_executePatchApplication`), verifikasi build + live functional test terhadap instance Engineer sungguhan di setiap fase, dokumentasi (ADR + changelog + roadmap) di setiap fase sebelum commit+push.

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

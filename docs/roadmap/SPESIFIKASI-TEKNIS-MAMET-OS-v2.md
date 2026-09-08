# SPESIFIKASI TEKNIS & IMPLEMENTASI MAMET OS ECOSYSTEM (v2)

> **Perubahan dari v1:** Menambahkan rasional keamanan untuk SystemGovernor, severity classification, notification strategy untuk pola pakai on-demand, no-silent-state-transition principle, validasi struktural MAEF allowlist, dan spesifikasi FAILED_DETERMINISTIC. Lihat changelog di akhir dokumen.
>
> **Revisi 2026-09-08:** §2.1 dirombak total setelah audit membuktikan implementasi saat ini (`engineer.js:2438-2480`) BUKAN scoped snippet extraction seperti spesifikasi asli — melainkan potongan char-count kasar (head+tail 8000 karakter) yang bisa membuang kode target kalau posisinya di tengah file besar. Algoritma pengganti dirancang berbasis identifier + brace-matching yang string-aware, mengikuti prinsip "satu file satu tanggung jawab" (rujukan: **ADR-0009 index.ts Decomposition**, preseden yang sudah terbukti berhasil — `agent-process/index.ts` 2301 baris berhasil jadi thin coordinator ~145 baris via dekomposisi bertahap).

---

## 0. RASIONAL ARSITEKTUR: KENAPA SYSTEMGOVERNOR WAJIB ADA

Sebelum masuk ke spesifikasi teknis, penting untuk mendokumentasikan **kenapa**, bukan cuma **apa**, supaya keputusan ini tidak terlihat sebagai over-engineering di kemudian hari.

1. **Engineer adalah self-modifying agent.** Berbeda dengan Antigravity (eksternal, hasil kerjanya direview manual oleh Owner via GitHub), Engineer membaca, menganalisis, dan menghasilkan patch untuk codebase tempat dirinya sendiri berjalan. Agent yang mengevaluasi dan mengubah dirinya sendiri tidak bisa dipercaya menjadi hakim atas keputusannya sendiri — bukan karena berniat buruk, tapi karena tidak punya cara mendeteksi blind spot-nya sendiri. Karena itu SystemGovernor **wajib terpisah secara struktural** dari `engineer.js` (lihat 3.1).

2. **Owner Sovereignty butuh mekanisme, bukan cuma niat.** Engineer beroperasi incremental dan sering (tiap error, tiap file idle). Tanpa lapisan penyaring, Owner akan menghadapi dua kegagalan mode: *approval fatigue* (klik approve tanpa baca) atau *silent bypass* (sistem melonggarkan aturan diam-diam supaya Owner tidak terganggu). SystemGovernor menjaga supaya prinsip Owner Sovereignty tetap punya arti operasional.

3. **Biaya kegagalan asimetris.** Patch yang salah di 7 Core Files (5.2) bisa merusak fondasi sistem secara diam-diam sebelum Owner sadar — terutama karena Owner **tidak standby** memantau aplikasi (lihat prinsip pakai di Bagian 6). Level 1 (deterministic block, 0 token, bertindak *sebelum* kerusakan) karena itu adalah level paling kritis dari keempat level eskalasi.

**Prinsip governing di atas semua level:** *No silent state transitions.* Setiap keputusan otomatis yang mempengaruhi kode atau state antrean — approve, reject, expire, bypass — **wajib menulis entry ke changelog**, walau tidak butuh approval Owner saat itu. Ini berlaku di seluruh dokumen ini dan menjadi kriteria review untuk PR mana pun yang menyentuh SystemGovernor.

---

## 1. DEFINISI PERAN & ALUR DATA (ROLE & DATA FLOW)

### 1.1. Pembagian Entitas
*   **Antigravity (External Builder):** AI eksternal. Tugas: Eksekusi kode berat, pembuatan fitur baru. **Wajib:** Menulis log perubahan ke folder `docs/project-memory/changelog/`.
*   **Engineer (`engineer.js`):** AI internal. Tugas: *Self-maintenance*, membaca `changelog`, analisis kode, menghasilkan patch.
*   **SystemGovernor (`SystemGovernorService.js`):** Daemon internal, independen dari Engineer. Tugas: Monitoring pasif, audit kepatuhan MAEF, deteksi anomali, severity classification.
*   **Changelog (`docs/project-memory/changelog/`):** Sumber data historis. Format: Markdown. Berisi tanggal, file yang diubah, alasan teknis, *root cause*, dan sejak v2: entry otomatis untuk setiap silent state transition (TTL expiry, allowlist bypass, auto-reject).

### 1.2. Aturan Kernel & UI (Deferred)
*   **Status:** Ditunda.
*   **Catatan:** `Kernel.js` saat ini menangani logika UI di Phase 9 & 10. Nanti akan dipisah ke `DesktopEnvironment.js` / `Shell.js`.

---

## 2. SPESIFIKASI TEKNIS: `engineer.js` (REFACTORING)

### 2.1. Scoped Snippet Extraction (Mengganti Full-File Reading) *(dirombak total v2.1 — 2026-09-08)*

#### 2.1.0 Temuan Audit (Kondisi Saat Ini)

`_buildPatchPrompt()` di `engineer.js:2438-2480` **bukan** snippet extraction — cuma potongan berbasis jumlah karakter:

| Ukuran file | Yang dikirim ke LLM |
|---|---|
| ≤ 6000 karakter | File utuh |
| > 6000 karakter | 4000 karakter awal + 4000 karakter akhir (tengah dibuang), lalu diminta jawab format search-replace |

**Risiko fungsional nyata:** kalau kode yang perlu diubah ada di tengah file besar, potongan awal+akhir bisa sama sekali tidak menyertakan area target. LLM diminta bikin `search-replace` untuk kode yang tidak pernah dia lihat — `search` string tidak ketemu di file asli, patch gagal apply (ada fallback warning di baris 2299, tapi itu artinya gagal diam-diam saat runtime, bukan dicegah sejak desain). Mode search-replace-nya sendiri **sudah fungsional penuh** (apply logic di baris 2278-2299) — masalahnya murni di sisi *apa yang ditunjukkan ke LLM*, bukan di cara patch diterapkan.

#### 2.1.1 Prinsip Desain Pengganti

Mengikuti arahan Owner: sistem **powerful tapi bertanggung jawab per file** (filosofi Linux), bukan menambah method baru ke `engineer.js` yang sudah 2978 baris. Fungsi ekstraksi menjadi **modul baru terpisah**, pure/stateless, tidak bergantung pada instance `Engineer` — mengikuti pola persis `ADR-0009` (`lib/*.ts` sebagai modul stateless yang diimpor oleh coordinator tipis).

**Lokasi modul baru:** `frontend/src/core/runtime/services/engineer/CodeSnippetExtractor.js`

#### 2.1.2 Algoritma

```javascript
// engineer/CodeSnippetExtractor.js — PURE MODULE, tanpa dependency ke Engineer instance

/**
 * @param {string} fileContent - Isi file lengkap (dibaca sekali, tetap disimpan utuh di memori
 *   untuk keperluan apply search-replace nanti — HANYA payload prompt yang dipangkas).
 * @param {string[]} targetIdentifiers - Nama fungsi/method/class dari task (lihat 2.1.3).
 * @param {number} contextLines - Baris konteks di sekitar target (default 5).
 * @returns {{ snippet: string, startLine: number, endLine: number, totalLines: number,
 *             identifierFound: boolean, method: 'identifier'|'keyword-scan'|'full-file' }}
 */
export function extractRelevantSnippet(fileContent, targetIdentifiers, contextLines = 5) {
  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  // File kecil: tidak perlu dipangkas sama sekali, kirim utuh (tetap murah).
  if (fileContent.length <= 3000) {
    return { snippet: fileContent, startLine: 1, endLine: totalLines, totalLines,
             identifierFound: true, method: 'full-file' };
  }

  // 1. Header — import & deklarasi teratas (dinamis, bukan hardcode 10 baris:
  //    berhenti di baris kosong pertama setelah blok import/const-require).
  const headerEndLine = _detectHeaderEnd(lines);

  // 2. Cari deklarasi tiap identifier via pattern JS/TS/JSX-aware:
  //    function NAME(  |  async function NAME(  |  class NAME
  //    const/let NAME = (...) =>  |  NAME(...) {  (class method, indented, tanpa keyword)
  const blocks = [];
  for (const id of targetIdentifiers) {
    const startLine = _findDeclarationLine(lines, id);
    if (startLine === -1) continue;
    // 3. Cari baris akhir blok via brace-matching STRING-AWARE (lihat 2.1.4 —
    //    wajib, karena banyak method di engineer.js membangun prompt lewat
    //    template literal berisi karakter '{' '}' literal, mis. _buildPatchPrompt()).
    const endLine = _findBlockEnd(lines, startLine);
    blocks.push({ id, startLine, endLine });
  }

  // 4. Fallback kalau tidak ada identifier yang match sama sekali (task berbahasa
  //    natural tanpa nama fungsi eksplisit): keyword-density scan per window 50 baris.
  if (blocks.length === 0) {
    return _keywordDensityFallback(lines, targetIdentifiers, headerEndLine, totalLines);
  }

  // 5. Susun: header + tiap blok (±contextLines) + penanda "... N baris dilewati ...".
  const snippet = _assembleSnippet(lines, headerEndLine, blocks, contextLines);
  return { snippet, startLine: blocks[0].startLine, endLine: blocks[blocks.length - 1].endLine,
           totalLines, identifierFound: true, method: 'identifier' };
}
```

#### 2.1.3 Sumber `targetIdentifiers`

Diekstrak dari `task.title`/`task.description` via regex kata benda kode (camelCase/PascalCase/snake_case/`_prefixed`), **divalidasi ulang** terhadap identifier yang benar-benar ada di file (buang kandidat yang cuma kebetulan mirip kata biasa). Contoh dari `PR8-linux-style-dispatch.md`: task *"refactor fungsi parseIntent di engineer.js"* → kandidat `parseIntent` → dicek eksistensinya di file target sebelum dipakai.

#### 2.1.4 Brace-Matching Harus String-Aware (Wajib, Bukan Opsional)

Brace counter naif (`{` +1, `}` -1) akan salah pada file seperti `engineer.js` sendiri — method macam `_buildPatchPrompt()` menulis puluhan baris `prompt += `...{...}...`;` berisi karakter `{`/`}` **literal di dalam string**, bukan pembuka blok kode. Implementasi wajib melacak state: `NORMAL | IN_STRING_SINGLE | IN_STRING_DOUBLE | IN_TEMPLATE_LITERAL | IN_LINE_COMMENT | IN_BLOCK_COMMENT`, hanya menghitung brace saat state `NORMAL`, termasuk menangani escape character dan interpolasi `${...}` di dalam template literal (yang membuka konteks JS normal bersarang sampai `}` penutup interpolasi ditemukan).

#### 2.1.5 Integrasi ke `_buildPatchPrompt`

Ganti seluruh percabangan `isLargeFile` (char-count threshold) di `engineer.js:2438-2480` dengan satu pemanggilan `extractRelevantSnippet()` per file — **selalu** format search-replace sebagai output yang diminta (bukan cuma untuk file besar), karena apply logic (`.replace()` di baris 2278-2299) bekerja terhadap **isi file utuh yang tetap disimpan di memori**, bukan terhadap snippet. Snippet cuma memangkas apa yang *ditunjukkan* ke LLM — pemangkasan ini sekarang presisi ke identifier target, bukan potongan buta awal-akhir.

*Constraint tetap berlaku:* payload ke LLM maksimal hanya berisi snippet hasil ekstraksi ini + instruksi patch, tidak pernah seluruh file (kecuali file memang ≤3000 karakter, di mana pemangkasan tidak perlu/tidak menghemat apa-apa).

#### 2.1.6 Catatan Terpisah — `engineer.js` Sendiri adalah Kandidat Dekomposisi

`engineer.js` (2978 baris) melanggar prinsip yang sama seperti `index.ts` sebelum ADR-0009 — satu file menampung `SessionArtifact`, intent detection, capability guard, reasoning report, patch generation, prompt building, compliance checking, dst. Modul `CodeSnippetExtractor.js` di atas adalah potongan pertama yang keluar dari file ini.

**Update 2026-09-08:** dekomposisi penuh ini sudah dirancang sebagai **[`ADR-0017-engineer-js-decomposition.md`](../adr/ADR-0017-engineer-js-decomposition.md)** — peta tanggung jawab lengkap (12 modul target) + 8 fase ekstraksi berurutan berdasarkan risiko, mengikuti metodologi ADR-0009. Fase 7 di ADR-0017 secara eksplisit menggabungkan ekstraksi `PatchGenerator.js` dengan implementasi `CodeSnippetExtractor.js` (§2.1 ini) dalam satu sesi kerja, karena keduanya menyentuh `_buildPatchPrompt()` yang sama.

### 2.2. Pre-Send Verification & Payload Separation
Ubah struktur payload yang dikirim ke Supabase Edge Function untuk mencegah *false positive* di Verification Engine.
```javascript
{
  mode: "ENGINEER",
  context_files: [ // Tidak dicek ketat oleh Verification Engine
    { path: "file.js", content: "snippet_code..." }
  ],
  proposed_patch: { // WAJIB dicek ketat oleh Verification Engine
    path: "file.js",
    startLine: 120,
    endLine: 135,
    newContent: "..."
  }
}
```

### 2.3. Pre-Approval Deterministic Validation
Pindahkan `BreakingChangeDetector` dan `SemanticDiffVerification` dari *post-apply* ke *pre-approval*.
1. LLM menghasilkan patch.
2. Jalankan `validatePatchSyntax(patch)` (menggunakan JS/TS parser). Jika error, auto-reject dan minta LLM revisi.
3. Jalankan `detectBreakingChanges(patch)`.
4. Jika lolos, tampilkan **Side-by-Side Diff** ke UI Owner untuk approval.

### 2.4. Fallback Mechanism & `FAILED_DETERMINISTIC` Status *(direvisi v2)*
Hapus `_generateFallbackPatch` yang hanya menghasilkan `// TODO`.
*Ganti dengan:* Auto-retry mechanism dengan *error message* spesifik dari parser. Jika retry habis, kembalikan status `FAILED_DETERMINISTIC` dengan payload wajib berikut:

```javascript
{
  status: "FAILED_DETERMINISTIC",
  reason: string,          // penjelasan singkat human-readable
  parserError: string,     // pesan mentah dari parser
  retryCount: number,
  suggestedAction: string  // mis. "Perlu revisi manual" / "Snippet ambigu, perbesar context"
}
```

**Spesifikasi UI (baru di v2):** Status ini wajib muncul sebagai notifikasi non-modal di observability panel HomeDashboard — bukan sekadar entry log yang harus dicari manual. Konsisten dengan prinsip *no silent state transitions* di Bagian 0. Detail integrasi dengan notification strategy: lihat Bagian 6.2 (Deferred Summary).

---

## 3. SPESIFIKASI TEKNIS: `SystemGovernorService.js` (NEW MODULE)

### 3.1. Inisialisasi & Registrasi
*   Buat file baru: `frontend/src/core/runtime/services/SystemGovernorService.js`.
*   Daftarkan di `Kernel.js` pada Phase 3 (bersama service inti lainnya).
*   Hapus semua fungsi monitoring/auditing dari `engineer.js`.
*   **Wajib independen dari Engineer** — lihat rasional di Bagian 0, poin 1.

### 3.2. Tangga Eskalasi 4 Level (Escalation Ladder)

**Level 1: Deterministic (0 Token)**
*   Trigger: `File:Modified`, `File:Created`.
*   Logika: Regex/String matching terhadap `IMMUTABLE_PATTERNS` dan `PROTECTED_PATTERNS`.
*   Action: Block atau emit `CRITICAL_VIOLATION`.
*   **Severity tagging (baru v2):** setiap event di level ini juga menghasilkan tag severity (lihat 3.2.1) yang dibawa ke level berikutnya.

**Level 2: Heuristik (0 Token)**
*   Trigger: `Error:Occurred`, `File:Idle`.
*   Logika: Hitung frekuensi error identik dalam window waktu. Cek timestamp file di folder `scratch/`.
*   Action: Emit `WARNING` atau `INFO` ke UI.

**Level 3: Ambiguity Queue (0 Token)**
*   Trigger: Anomali struktural (misal: file utilitas tiba-tiba > 500 baris).
*   Logika: Tandai file sebagai `NEEDS_REVIEW`. Masukkan ke array `this.ambiguityQueue` dengan field `severity` dan `enqueuedAt`.
*   Action: Tidak ada notifikasi langsung kecuali severity = HIGH (lihat 3.2.1 dan Bagian 6.3).

**Level 4: On-Demand LLM Reasoning (Token Cost)**
*   Trigger: Owner klik tombol "Deep Audit" ATAU `ambiguityQueue.length > threshold` ATAU item severity HIGH masuk (skip antrean, lihat 3.2.1).
*   Logika:
    1. Hitung estimasi token.
    2. Emit event `SystemGovernor:RequestApproval` ke UI dengan estimasi biaya.
    3. Jika Owner approve, kirim *snippet* dari `ambiguityQueue` ke LLM.
*   Constraint Output LLM: **Micro-prompting**. Wajib return JSON: `{ anomaly: boolean, reason: string }`.
*   Action: Simpan hasil ke `Project Memory`.

#### 3.2.1. Severity Classification *(baru v2)*

Token-cost saja tidak cukup untuk menentukan urgensi eskalasi — anomali yang murah dideteksi bisa berdampak besar. Tambahkan dimensi **severity**, ditentukan di Level 1/2 (deterministic, 0 token tambahan):

| | LOW TOKEN COST | HIGH TOKEN COST |
|---|---|---|
| **LOW SEVERITY** | → Masuk antrean L3 normal, tunggu batch | → Tetap di L3, tunggu threshold |
| **HIGH SEVERITY** | → Escalate langsung ke L4, notify segera | → Escalate ke L4, ditandai PRIORITY di UI |

Kriteria HIGH severity (heuristik murah, tidak butuh LLM):
*   File match `IMMUTABLE_PATTERNS` tapi lolos sebagai near-miss.
*   File di path yang menyentuh auth, payment, atau API-key handling.
*   Perubahan terjadi di luar jam aktivitas normal Owner (indikasi proses berjalan tanpa sepengetahuan Owner).
*   Item di ambiguity queue mendekati TTL expiry (lihat 3.3, revisi relatif-terhadap-sesi).

Anomali ukuran file generik (>500 baris) di folder non-kritis tetap default LOW.

### 3.3. Mekanisme Caching & Lazy Loading

*   **Hash-based Cache:** Simpan hash SHA-256 dari file yang sudah diaudit Level 1 & 2 di `StorageManager`. Jangan proses ulang jika hash tidak berubah.
*   **Queue TTL — direvisi v2:** Item di `ambiguityQueue` memiliki TTL 7 hari, dihitung **relatif terhadap sesi aktif terakhir Owner** (`lastActiveSessionAt`), bukan waktu absolut sejak anomali terdeteksi. Rasional: Owner tidak standby membuka aplikasi (lihat Bagian 6), sehingga TTL absolut berisiko menghapus item yang belum pernah masuk Session Digest sama sekali.
*   **Expiry wajib log:** Saat item TTL habis dan dihapus, wajib menulis entry ke changelog (bukan silent delete) — sesuai prinsip di Bagian 0.
*   **Pre-expiry escalation:** Item yang mendekati TTL (H-1 dari expiry efektif) otomatis dinaikkan ke severity HIGH dan masuk jalur push notification (Bagian 6.3), supaya tidak hilang tanpa pernah direview.
*   **Idle Execution:** Proses Level 2 dan 3 menggunakan `requestIdleCallback` atau `setTimeout` agar tidak memblokir Main Thread.

---

## 4. SPESIFIKASI PIPELINE VERIFIKASI & KEAMANAN

### 4.1. Supabase Edge Function (`agent-process/index.ts`)
*   Ubah logika `execution_context.ts` dan `verification_pipeline.ts`.
*   **Aturan Baru:** `VerificationEngine` HANYA menjalankan `verifyPatchEngineering()` pada properti `proposed_patch` dari payload.
*   Abaikan pemeriksaan pola berbahaya (`eval`, `new Function`) pada properti `context_files`.

### 4.2. MAEF Compliance Rules (Deterministic) *(direvisi v2)*

Allowlist untuk `*Adapter.js` / `*Provider.js` (bebas dari Adapter Isolation, boleh direct vendor import) **tidak lagi berbasis nama file saja** — nama file bukan kontrol akses yang aman, terutama karena Engineer/Antigravity (AI) cenderung menamai file sesuai pola umum, bukan selalu sesuai substansi arsitektural.

**Validasi struktural tambahan (Level 1, deterministic, 0 token):**
File hanya lolos allowlist jika, selain namanya cocok pattern, juga memenuhi:
*   Mayoritas isi file adalah import/export/re-export dari satu vendor SDK (di atas rasio ambang tertentu, misal >80% baris).
*   Tidak mengandung kompleksitas logika bisnis (heuristik sederhana: jumlah percabangan kondisional di bawah threshold, mis. maks 2-3 `if`/`switch` per file).
*   Jika gagal validasi struktural meski nama cocok pattern, file **tidak** dikecualikan — tetap diperlakukan sebagai kode biasa dan diaudit penuh.

---

## 5. SPESIFIKASI JANGKA PANJANG (LONG-TERM ARCHITECTURE)

### 5.1. Local AI Integration (Zero-Cost Triage) *(direvisi v2 — distribusi model)*
*   **Library:** `Transformers.js` atau `WebLLM`.
*   **Model:** Qwen2.5-0.5B atau 1.5B (GGUF format).
*   **Distribusi — diubah dari "dibundel" menjadi on-first-run download:**
    *   *Electron:* Model **tidak** dibundel di installer (menghindari pembengkakan ukuran installer ratusan MB). Download sekali saat first-run, simpan di direktori user-data lokal (mis. `app.getPath('userData')/models/`).
    *   *Web:* Download sekali, simpan di `Cache API` / `IndexedDB`.
    *   Tampilkan progress bar + opsi "download nanti" (fallback ke Cloud LLM untuk Level 4 sementara, dengan token cost, sampai model lokal siap).
*   **Integrasi:** Ganti pemanggilan LLM Cloud pada **Level 4 (SystemGovernor)** dengan pemanggilan Local AI via Web Worker.
*   **Constraint:** Local AI HANYA untuk klasifikasi/triage. Dilarang digunakan untuk generate kode (tugas Engineer tetap pakai Cloud LLM).

### 5.2. Core 7 Files Portability
Pastikan 7 file di `frontend/src/core/runtime/` (`Kernel`, `EventBus`, `ServiceManager`, `ProcessManager`, `StorageManager`, `DiscoveryManager`, `module-loader`) tidak memiliki dependensi langsung ke DOM API atau Node.js API. Semua akses platform harus melalui `StorageManager` atau adapter yang diregistrasi di `ServiceManager`.

---

## 6. NOTIFICATION STRATEGY *(bagian baru v2)*

Ekosistem ini adalah asisten pribadi dengan pola pakai **on-demand** — Owner tidak standby memantau aplikasi. Desain notifikasi real-time konvensional (toast per-event) tidak efektif untuk pola ini. Tiga mode operasi:

### 6.1. Real-time Blocking
Hanya untuk kondisi yang tidak bisa menunggu keputusan Owner: Level 1 deterministic block. Tidak butuh notifikasi aktif ke Owner karena aksi (block) sudah otomatis dan aman untuk kondisi unattended.

### 6.2. Deferred Summary ("Session Digest")
Mode default untuk anomali LOW–MEDIUM severity. Alih-alih notifikasi per-event, SystemGovernor mengumpulkan seluruh event sejak sesi terakhir dan merender satu ringkasan saat Owner membuka HomeDashboard:

```
Session Digest (sejak sesi terakhir):
  - N anomali LOW masuk antrean (tidak butuh aksi)
  - N anomali HIGH menunggu approval (butuh aksi sekarang)
  - N item mendekati TTL expiry (butuh aksi segera)
  - N FAILED_DETERMINISTIC dari Engineer (lihat 2.4)
```

Terintegrasi sebagai section baru di observability panel HomeDashboard yang sudah ada.

### 6.3. Push Notification (OS-level)
Dijatah ketat — **hanya** untuk item severity HIGH (3.2.1) yang tidak bisa ditunda sampai sesi berikutnya, termasuk item mendekati TTL expiry (3.3). Menggunakan Electron `Notification` API. Semua anomali LOW/MEDIUM tidak boleh trigger push, untuk menghindari notification fatigue yang setara dengan approval fatigue yang ingin dihindari desain ini sejak awal.

---

## 7. CHANGELOG DOKUMEN

**v2.1 (revisi 2026-09-08 — audit §2.1 vs implementasi aktual):**
- §2.1 dirombak total: audit membuktikan `engineer.js:2438-2480` bukan scoped snippet extraction, melainkan potongan char-count kasar (head+tail 8000 karakter) yang berisiko membuang kode target di file besar.
- Algoritma pengganti dirancang: ekstraksi berbasis identifier + brace-matching string-aware (wajib, karena banyak method `engineer.js` membangun prompt via template literal berisi `{`/`}` literal).
- Modul baru diusulkan terpisah dari `engineer.js` (`engineer/CodeSnippetExtractor.js`, pure/stateless) — mengikuti prinsip satu-file-satu-tanggung-jawab, preseden **ADR-0009 index.ts Decomposition** yang sudah terbukti berhasil.
- Dicatat: `engineer.js` (2978 baris) sendiri adalah kandidat dekomposisi ala ADR-0009 — di luar scope revisi ini, diusulkan jadi ADR terpisah jika Owner setuju.

**v2 (revisi dari diskusi lanjutan):**
- Tambah Bagian 0: rasional keamanan SystemGovernor sebagai prasyarat struktural, bukan fitur opsional.
- 2.4: spesifikasi payload dan UI untuk `FAILED_DETERMINISTIC`.
- 3.2.1: severity classification sebagai dimensi kedua di samping token-cost.
- 3.3: TTL dihitung relatif terhadap sesi aktif terakhir, bukan absolut; expiry wajib log; pre-expiry auto-escalation.
- 4.2: validasi struktural tambahan untuk MAEF allowlist, tidak lagi berbasis nama file saja.
- 5.1: model Local AI didownload on-first-run, tidak dibundel di installer.
- Bagian 6 (baru): Notification Strategy — 3 mode untuk pola pakai on-demand.
- Prinsip lintas-dokumen: *no silent state transitions* — semua keputusan otomatis wajib log changelog.

*** 

*End of Technical Specification v2.*

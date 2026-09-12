# INDEX — Peta Dokumen Roadmap Mamet OS Ecosystem

**Tujuan dokumen ini:** Titik masuk pertama untuk Antigravity (atau AI mana pun) sebelum membaca dokumen lain di folder `docs/roadmap/`. Berisi status, urutan pengerjaan, dan ringkasan tiap dokumen — bukan pengganti isi dokumen aslinya.

**Update terakhir:** 2026-09-09
**Prinsip folder ini:** Satu file, satu tanggung jawab. Dokumen ini HANYA index — jangan tambahkan detail teknis di sini, cukup rujukan ke file terkait.

---

## 1. Status Ringkas

| Dokumen | Status | Scope |
|---|---|---|
| `ASSISTANT-CAPABILITY-ROADMAP.md` | ✅ Selesai (PR#1–#7 Fase 1) — ⚠️ PR#5 parsial | Assistant capability, 7 PR |
| `roadmap memory governor.md` | ✅ **Selesai Penuh (Fase 1, Addendum & CP4b UI Purge/Conflict Lifecycle)** | `MemoryGovernorService.js`, `MemoryContextPanel.jsx`, `ConversationEngine.jsx` |
| `PR8-linux-style-dispatch.md` | ✅ Selesai — `RequestClassifierService` + thin dispatcher + `_handleLookup` | `RequestClassifierService`, `LookupHandler`, `ConversationHandler` |
| `teknis-skil-implementasi.md` | ✅ Selesai — SkillRegistry + SkillGuardService + SkillHandler + contoh skill | `SkillRegistry`, `SkillGuardService`, `SkillHandler` |
| `PR9-retrieval-tier-architecture.md` | ✅ **Selesai Penuh (Fase 1, 2, & 3 — Live-Verified)** (Tier 1 lokal, Tier 2 internal fallback, Tier 3 Web Comparison dengan Human-in-Command, multi-provider RSS/IPC bridge, integrasi RAG server-side, standarisasi varian label status, & live test terkonfirmasi) | `RetrievalStrategyService.js`, `KnowledgeService.js`, `context_builder.ts`, `RetrievalOrchestrator.js`, `InternalKnowledgeFallbackService.js`, `WebComparisonService.js`, `request_pipeline.ts`, `universal_contract.ts` |
| `ZERO-LEAKAGE-RAG-TENANT-ISOLATION.md` | ✅ **Selesai Penuh & Live-Verified (2026-09-04)** (Audit kepemilikan 45 dokumen 2 akun, PostgREST inner join `documents!inner(user_id)` di `KnowledgeService.js`, guard `userId`, propagasi `userId` di seluruh runtime pipeline & Edge Function, serta live test desktop 100% pass) | `KnowledgeService.js`, `RetrievalOrchestrator.js`, `AssistantService.js`, `context_builder.ts`, `useDashboardData.js` |

| `PENDING-supabase-security-advisor-findings.md` | ✅ **Selesai Remediasi RPC (8/9) — 1 item deferred: upgrade plan** (8 fungsi `SECURITY DEFINER` aman via migrasi; Leaked Password ditunda keputusan Owner karena batasan Pro plan) | Supabase RPC Permissions & Security |
| `PENDING-tier3-web-search-chrome-cors-proxy-fix.md` | ✅ **Selesai & Live-Verified (2026-09-08)** (Remediasi 404 dynamic import `supabase.js` pada browser Chrome/Vercel via static import; live test Bing News RSS 4 hasil, 0 error) | `WebComparisonService.js`, `proxy_fetch`, Tier 3 Web Search |
| `PENDING-live-verification-runtime-gaps.md` | ✅ **Selesai Remediasi Gap Runtime (5/5 — 100%)** (Trace ID, Match Memories schema, Escaped ilike, UUID storage target, CHECK_002/003 Source Trace) | `agent-process` Edge Function & RAG |
| `CHECK-P02-json-patch-schema-alignment.md` | ✅ **Selesai & Tervalidasi (Live Production Confirmed)** (Defensive Unwrap Layer di `_extractJSONPatch` + Standardisasi Prompt Engineer) | `verification_engine.ts`, `request_pipeline.ts` |
| `FIX-assistant-session-finalization-and-autosave-throttle.md` | ✅ **Selesai & Tervalidasi (Confirmed Desktop + Unit Test)** (Pemisahan `finalizeAssistantSession` dari auto-save loop & throttling DB I/O) | `AssistantService.js`, `ConversationEngine.jsx` |
| `TAHAP1-memory-system-finalization.md` | ✅ **Selesai Penuh & Live-Verified (Sub A + Sub B + Sub C — 2026-09-03)** (Integrasi Assistant Golden Memory, UI Conflict Resolution & Purge CP4b, Category Alignment) | `MemoryGovernorService.js`, `MemoryService.js`, `MemoryContextPanel.jsx`, `ConversationEngine.jsx` |
| `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md` | ✅ **Selesai (Diimplementasikan & Diverifikasi 2026-09-04)** | Status Liveness Zero-Token, Sanitasi [object Object], Auto-Load Trace, Metrik Realtime |
| `ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md` | ✅ **Selesai & Diverifikasi (2026-09-08)** — status di INDEX ini sempat tertinggal di "PROPOSED" selama sehari padahal dokumen & changelog-nya sudah menyatakan selesai (drift indeks, dikoreksi 2026-09-09). Efek denyut simpul aktif belum dikonfirmasi visual oleh Owner | Visualisasi Galaksi: Orbit Lengkung (Cosmic Filaments) & Pijaran Bintang Aktif Chat (Live Thought Pulse) |
| `ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md` | ✅ **COMPLETED, LIVE-ACCEPTED & VERIFIED (2026-09-04 — Kedipan 0, Riwayat Realtime & Terisolasi Antar Workspace)** | Stabilitas Reconciler React (0 Unmount), Isolasi Kunci Workspace Chat, & Realtime EventBus Sync ChatHistory |
| `ROADMAP-PR6-TOKEN-EFFICIENCY.md` | ✅ **COMPLETED & LIVE-VERIFIED (2026-09-04 — Cloud Confirmed)** | Prompt Caching Gemini (Implicit Caching via Static/Dynamic Split systemInstruction) + Web Search Summarization Guard (threshold 6.000 chars, maks 800 chars/artikel) + Token Metrics Logging across all adapters |
| `ROADMAP-ADAPTIVE-MODEL-TIERING.md` | ✅ **Selesai & Live-Verified (2026-09-09)** — kecuali plumbing parameter `thinking` yang sengaja ditunda; ketiga tier terbukti memakai model berbeda di log live | 3 Tingkat Model (Kecil/Sedang/Thinking) dengan Classifier Deterministik Zero-Cost, Override Manual per-Percakapan, & Sinkronisasi Config Lintas Device via `user_metadata` |
| `MAMET-AI-ROADMAP.md`, `engineer-autonomous-mode.md`, `engineer-chat-upgrade.md`, `fix-log.md`, `rencana.md`, `roadmap-lanjutan.md` | ✅ **Selesai Direkonsiliasi terhadap Kode Aktual (2026-09-08)** — seluruh klaim diverifikasi baris-per-baris; 4 dokumen akurat, `rencana.md` kontradiksi internal dikoreksi (Fase 3–5 ternyata sudah selesai), `roadmap-lanjutan.md` diberi status per fase (3 dari 4 fase sudah jalan), atribusi file usang di `engineer-chat-upgrade.md` dikoreksi. Skema penomoran `TASK-000x`/`ADR-000x` dikonfirmasi hanya perbedaan historis, bukan konflik implementasi. Menyisakan 3 gap kode kecil → Backlog Item 11–13 | Engineer pipeline, Kernel graceful degradation, Observability UI, BYOK header |

---

## 2. Urutan Pengerjaan & Status Eksekusi

```
[SELESAI] PR#1, PR#2, PR#3, PR#4, PR#6, PR#7 Fase 1 (Assistant Capability)
    ↓
[SELESAI] MemoryGovernorService — Fase 1 & Integrasi (Service core, Addendum, integrasi Assistant/Engineer, Conflict UI badge; UI Purge deferred)
    ↓
[SELESAI] PR#8 — Linux-style Dispatch (PR8-linux-style-dispatch.md)
    ↓
[SELESAI] Skill Implementation (teknis-skil-implementasi.md)
    ↓
[SELESAI] Cost Ledger Instrumentation & Guardrail Enforcement (ADR-015 Phase 1, commit 86beabe / 676a211)
    ↓
[SELESAI PENUH] PR#9 — Retrieval Tier Architecture (PR9-retrieval-tier-architecture.md)
    Menuntaskan gap PR#5 (Adaptive Retrieval Strategy) dan membangun 3 Tier berjenjang:
    - Tier 1 Lokal: KnowledgeService.js, RetrievalStrategyService.js, context_builder.ts (Edge Function)
    - Tier 2 Internal: InternalKnowledgeFallbackService.js, auto-switching di RetrievalOrchestrator.js, CHECK_002B di verification_engine.ts
    - Tier 3 Web: WebComparisonService.js, gerbang konfirmasi Owner (Human-in-Command), timeout 8s, penandaan sumber transparan di prompt
    ↓
[SELESAI] TAHAP 1 — Memory System Finalization (2026-09-03, Live-Verified)
    - Sub A: Integrasi penuh MemoryGovernorService ke Assistant Trigger (secure-by-default storeGoldenMemory)
    - Sub B (CP4b): UI Purge Lifecycle & Conflict Resolution + atomic metadata.conflict_info
    - Sub C (Backlog #7): Memory Context Panel Category Alignment (Display Layer terisolasi)
    ↓
[SELESAI] TAHAP 2 — SystemGovernorService.js (Opsi B, 2026-09-03)
    Pembangunan daemon Codebase Governance & File Integrity dari nol sesuai SPESIFIKASI-TEKNIS-MAMET-OS-v2.md.
    - Tangga Eskalasi 4 Level, Severity Classification 2D, Caching SHA-256, Session-Relative TTL (7 hari), No Silent State Transitions, MAEF Structural Validation Gate, 3-Mode Notification Strategy, Level 4 Approval Gate.
    - Didaftarkan resmi di Kernel Phase 3 & Session Digest terintegrasi di ObservabilityPanel.jsx.
    ↓
[SELESAI] TAHAP 3 — PR#9 Fase 3: Web Comparison (Opsi D, 2026-09-03, Live-Verified 2026-09-04)
    WebComparisonService.js + Tier 3 di RetrievalOrchestrator.js dengan gerbang konfirmasi Owner (Human-in-Command).
    - Timeout 8s (AbortController), atribusi sumber transparan ([Sumber: Web — {url}, akurasi tidak terverifikasi]), fallback jujur saat ditolak/gagal/timeout, didaftarkan di Kernel Phase 3, mitigasi CSP Chromium via Electron IPC bridge, multi-provider RSS fallback, pengangkatan dokumen web ke RAG first-class, serta standarisasi universal label status epistemik (format ringkas LOOKUP vs format penuh).
    ↓
[SELESAI] ZERO-LEAKAGE RAG TENANT ISOLATION & MULTI-ACCOUNT AUDIT (2026-09-04, Live-Verified by Owner)
    Audit kepemilikan 45 dokumen di Supabase RAG (29 milik akun andreanastasya798@gmail.com, 16 milik akun slametbro798@gmail.com).
    - Hardening KnowledgeService.js: PostgREST Resource Embedding Inner Join documents!inner(id, title, user_id, space_id) pada fallback content search, guard proteksi missing userId, dan penghapusan filter kolom user_id yang salah pada tabel document_chunks.
    - Penyambungan parameter userId di seluruh alur: RetrievalOrchestrator.js, AssistantService.js, dan Edge Function context_builder.ts.
    - Scoping useDashboardData.js ke currentUserId.
    - Teruji otomatis cross-tenant 0 kebocoran dan diverifikasi langsung lewat pengujian live desktop oleh Owner (skor kecukupan 0.832, Evidence Gate PASSED 100% Grade A, status [STATUS: VERIFIED]).
    ↓
[SELESAI / BUILD PASS] RUNTIME CHAT SESSION STABILITY & CHAT HISTORY PERSISTENCE (ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md)
    AppRegistry.js: ModuleSuspenseWrapper statis + useRef → 0 Unmount React Reconciler.
    ConversationEngine.jsx: chatStorageKey per workspace (mamet_v4_${wsId}_current_chat_id) → 0 tabrakan antar 3 instance chat.
    AssistantService.js: emit Chat:Updated via EventBus setelah saveChatToDB berhasil.
    ChatHistory.jsx: subscribe EventBus Chat:Updated → fetchChats() realtime (menggantikan window.storage yang tidak efektif).
    useDashboardData.js: kolom timestamp pada verification_audit_logs → 0 HTTP 400 retry loop.
    Build: ✅ 2662 modul, 0 error. Live-Accepted by Owner: Kedipan 0, Sesi Utuh, Riwayat Realtime & Terisolasi Antar Workspace (2026-09-04).
    ↓
[SELESAI / LIVE-VERIFIED] PR#6 — EFISIENSI TOKEN (ROADMAP-PR6-TOKEN-EFFICIENCY.md)
    ai_adapter.ts: Static/Dynamic split — static ke systemInstruction (Implicit Caching aktif), dynamic (RAG, MEMORY) ke contents user pertama.
    context_builder.ts: Web Search Summarization Guard — threshold 6.000 chars total, maks 800 chars/artikel via runLLM() + fallback truncate.
    Token Metrics Logging: [PR#6 TOKEN] per request + [PR#6 TOKEN METRICS] across Gemini & OpenRouter adapters.
    Live Verified on Supabase Cloud: [PR#6] Web context total: 606 chars dari 2 artikel (trace 4ca4900f-a1e0-4c7f-9f2a-f6539dc623ff). Build pass (10.07s).
```

*Catatan Terpisah:* Opsi C (Remediasi Backlog Runtime — `ModuleDiscoveryService` refactor, React Warning render phase) dan item housekeeping lain di Bagian 6 tetap independen dari 3 tahap ini dan dapat disisipkan kapan saja tanpa mempengaruhi urutan arsitektural di atas (Referensi: Sesi audit dependensi 3 inisiatif besar, 2026-09-03).

**Catatan status MemoryGovernorService:**
File `MemoryGovernorService.js` sudah ada dan terdaftar di `Kernel.js`. Seluruh method core Golden Source (`storeGoldenMemory`, `verifyMemorySummary`, `verifyEngineeringSession`), Addendum (`retrieveMemory`, `detectAndMarkConflict`, `resolveConflict`, `archiveMemory`, `requestPurge`, `executePurge`, `restoreMemory`, `getActiveMemories`), serta integrasi menyeluruh **telah tuntas 100% dan Live-Verified pada database Supabase Cloud** per 2026-09-03 (lihat [`TAHAP1-memory-system-finalization.md`](./TAHAP1-memory-system-finalization.md) dan [`2026-09-03-tahap1-governance-audit-live-verification.md`](../project-memory/changelog/2026-09-03-tahap1-governance-audit-live-verification.md)):
1. `MemoryService.storeMemory()` secure-by-default selalu mendelegasikan ke `storeGoldenMemory` dengan auto-generated golden metadata jika opsi tidak disertakan.
2. UI Visual Side-by-Side Diff Conflict Resolution di `MemoryContextPanel.jsx` aktif dengan pengayaan atomik `metadata.conflict_info`.
3. UI Purge Lifecycle Manager (Soft-delete $\rightarrow$ Pending Purge $\rightarrow$ Hard Delete) aktif dengan modal konfirmasi aman di antarmuka Trash.
4. Category Alignment (Backlog #7) diselaraskan khusus untuk display layer panel tanpa mendistorsi heuristik retrieval backend LLM.

**Catatan status PR#9 (Retrieval Tier Architecture):**
Dokumen `PR9-retrieval-tier-architecture.md` telah **selesai penuh 100% untuk seluruh fase (Fase 1, 2, & 3) dan tervalidasi live di desktop & cloud** per 2026-09-04 (lihat changelog: [`2026-09-02-pr9-retrieval-tier-fase1-selesai.md`](../project-memory/changelog/2026-09-02-pr9-retrieval-tier-fase1-selesai.md), [`2026-09-02-pr9-retrieval-tier-fase2-selesai.md`](../project-memory/changelog/2026-09-02-pr9-retrieval-tier-fase2-selesai.md), [`2026-09-03-tahap3-web-comparison-service.md`](../project-memory/changelog/2026-09-03-tahap3-web-comparison-service.md), [`2026-09-04-pr9-web-comparison-live-hardening-and-epistemic-standardization.md`](../project-memory/changelog/2026-09-04-pr9-web-comparison-live-hardening-and-epistemic-standardization.md), dan [`2026-09-04-pr9-smart-title-aware-retrieval-and-stopwords.md`](../project-memory/changelog/2026-09-04-pr9-smart-title-aware-retrieval-and-stopwords.md)):
1. **Tier 1 (Lokal):** Aktif server-side via Edge Function `context_builder.ts` (Assistant & Engineer) serta facade `RetrievalOrchestrator.js` di client, timeout 5 detik, dan fallback tracking (`ctx.state.tier1Retrieval`).
2. **Tier 2 (Internal LLM Fallback):** Aktif via `InternalKnowledgeFallbackService.js` dengan auto-switching saat `sufficiency < 0.4`, timeout 20s, atribusi `[Sumber: Pengetahuan internal model]`, telemetri `traceId`, dan validasi `CHECK_002B`.
3. **Tier 3 (Web Comparison):** Aktif via `WebComparisonService.js` dengan gerbang konfirmasi Owner eksplisit (Human-in-Command), timeout 8s, penandaan sumber transparan, serta mitigasi CSP Chromium via Electron IPC fetch bridge (`electronAPI.fetchUrl`). Teruji live: penolakan Owner mengeksekusi fallback jujur (0 cost/latency).
4. **Resilience Multi-Provider:** Google News RSS via IPC bridge dengan User-Agent sanitization, fallback berita nasional sekunder (Antara News RSS, CNN Indonesia RSS), dan pemblokiran Wikipedia dari kueri bertipe temporal/berita.
5. **Demarkasi Memori vs Pengetahuan:** Dokumen web diangkat menjadi first-class RAG chunks di `ctx.state.ragArray` dengan identifikasi `[DOC-XXXX]`, memisahkan preferensi personal user di `[MEMORI & KONTEKS SISTEM]` dari dokumen pengetahuan faktual di `<RAG>` / `[BLOK 4: KNOWLEDGE]`.
6. **Dynamic Cutoff:** Batasan 2024 dikondisikan hanya saat pengetahuan live tidak disuntikkan (`!hasInjectedKnowledge`).
7. **Standarisasi Universal Label Status (Live Verified):** Penegasan format status kepastian pada penalaran dan blok penutup kontrak (`universal_contract.ts` / `request_pipeline.ts`). Terbukti live: mode `LOOKUP` mencetak format ringkas `[Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]` dan mode `CONVERSATION` mencetak format penuh `[STATUS: HYPOTHESIS - Rekomendasi AI]` saat dokumen tidak memuat data yang diminta (zero over-claiming).
8. **Smart Title-Aware Retrieval & Stopwords Enhancement:** Perluasan stopwords percakapan, batas kata kunci 8 kata, pencocokan judul dokumen prioritas (`documents.title`), dan keyword-density ranking di `KnowledgeService.js` untuk mencegah saturasi dokumen lain saat menanyakan dokumen spesifik (lihat changelog: [`2026-09-04-pr9-smart-title-aware-retrieval-and-stopwords.md`](../project-memory/changelog/2026-09-04-pr9-smart-title-aware-retrieval-and-stopwords.md)).


---

## 3. Catatan Disambiguasi Penting

**`CognitiveMemoryGovernorService.js` (PR#2, sudah aktif) ≠ `MemoryGovernorService.js` (Fase 1, pondasi siap).**
- `CognitiveMemoryGovernorService.js` (port dari `cognitiveMemoryGovernor.ts`) — beroperasi di level Assistant/percakapan: memfilter memori untuk prompt injection berdasarkan `truth_score`.
- `MemoryGovernorService.js` (Fase 1) — beroperasi di level database/knowledge base: menjaga integritas ringkasan vs raw content (Golden Source Rule), two-stage retrieval, conflict resolution, dan lifecycle tabel memori.

**Memory system ≠ RAG/Knowledge retrieval (klarifikasi PR#9):**
- **Memory** (`user_memories` table via `MemoryService`/`MemoryGovernorService`) — hal yang di-*remember* user secara eksplisit (preferensi, fakta personal). Bukan bagian dari desain PR#9.
- **RAG/Knowledge** (`document_chunks`/`documents` via `RetrievalStrategyService`/`context_builder.ts`) — dokumen pengetahuan, dicakup PR#9. Dua sistem ini independen, tidak boleh dicampur.

**Empat "governor/guard/orchestrator" service independen (Seluruhnya Aktif):**
- `SystemGovernorService.js` — monitoring/anomali integritas kode & eskalasi 4 level (aktif via Tahap 2, Kernel Phase 3)
- `MemoryGovernorService.js` — integritas data/ringkasan memori golden source, conflict resolution, & UI purge (aktif 100% via Tahap 1)
- `SkillGuardService.js` — validasi keamanan skill sebelum dieksekusi (aktif via Skill Implementation)
- `RetrievalOrchestrator.js` — orkestrasi 3 tier retrieval pengetahuan lokal→internal→web + penegakan isolasi tenant (aktif via PR#9 & Zero-Leakage Hardening)

---

## 4. Prinsip Payung yang Berlaku di Semua Dokumen

- **Owner Sovereignty** — semua aksi otomatis yang berdampak signifikan wajib eskalasi/konfirmasi eksplisit ke Owner, tidak ada auto-resolve/auto-approve untuk keputusan berisiko. *(Diterapkan di PR#9: web search Tier 3 wajib konfirmasi Owner.)*
- **No Silent State Transition** — setiap perubahan status otomatis (approve, reject, expire, archive) wajib tercatat di changelog/audit log. *(Diterapkan di PR#9: kegagalan tier tidak boleh silent, harus ditandai eksplisit ke user.)*
- **One File, One Responsibility** — berlaku untuk kode maupun dokumen (termasuk dokumen ini sendiri).
- **Soft-delete sebelum hard-delete** — pola trash bin konsisten dipakai di MemoryGovernorService dan Skill retention; hard-delete hanya via command eksplisit Owner.

---

## 5. Cara Update Dokumen Ini

Setiap kali sebuah dokumen di folder ini selesai dikerjakan (Exit Criteria terpenuhi) atau status berubah, update tabel di Bagian 1 dan pindahkan progress marker di Bagian 2. Jangan biarkan index ini basi — index yang salah lebih berbahaya daripada tidak ada index.

---

## 6. Item Backlog & Temuan Pending (Menunggu Penjadwalan Owner)

1. **Refactor `ModuleDiscoveryService.js`:**
   - **Isu:** Memanggil `window.electronAPI.runTerminalCommand()` saat boot desktop sehingga memicu popup izin terminal AI tanpa trigger user.
   - **Status:** ✅ **Selesai Diimplementasikan (2026-09-04)** ([`2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md`](../project-memory/changelog/2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md)).
   - **Solusi:** Migrasi penuh dari `runTerminalCommand` ke API filesystem aman (`window.electronAPI.listFiles()` & `readFile()`) yang membaca berkas langsung via Node.js `fs` tanpa terminal prompt.
2. **React Warning Render Phase (`WorkspaceContext.jsx:12` & `WorkbenchZone.jsx:60`):**
   - **Isu:** Warning *"Cannot update a component while rendering"* dipicu dari `WorkbenchZone.jsx:60` via `EventBus`.
   - **Status:** ✅ **Selesai Diimplementasikan (2026-09-04)** ([`2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md`](../project-memory/changelog/2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md)).
   - **Solusi:** Pemisahan efek samping `onResize` dari callback updater `setDraftSize` di `WorkbenchZone.jsx` (menggunakan `currentSizeRef`), serta penundaan dispatch state subscriber di `WorkspaceContext.jsx` via `queueMicrotask` dengan proteksi `isMounted`.
3. **Bug Klasifikasi Intent Recall `RequestClassifier`:**
   - **Isu:** Pertanyaan recall (misal *"masih ingat nama saya?"*) tidak dijawab, melainkan disimpan sebagai memori baru dengan teks terpotong (*"ingat"* terhapus menjadi *"masih nama saya?"*).
   - **Status:** ✅ **Selesai & Tervalidasi Penuh (Live Desktop Confirmed — 4/4 Skenario Kunci)** ([`FIX-intent-classification-and-memory-store-unification.md`](./FIX-intent-classification-and-memory-store-unification.md)).
4. **CP4b Memory Governor — UI Purge Lifecycle & Conflict Resolution:**
   - **Status:** ✅ **Selesai Diimplementasikan (Tahap 1 Sub B — 2026-09-03)** ([`2026-09-03-tahap1-sub-b-ui-purge-and-conflict-resolution.md`](../project-memory/changelog/2026-09-03-tahap1-sub-b-ui-purge-and-conflict-resolution.md)).
   - **Cakupan Selesai:** Pengayaan atomik `metadata.conflict_info`, penurunan log level ke `console.log`, UI visual diff perbandingan versi lama vs baru di `MemoryContextPanel.jsx`, tombol aksi Owner resolusi konflik (`keep`/`discard`), dan antarmuka Trash Bin siklus 2-tahap (*Soft-delete $\rightarrow$ Pending Purge $\rightarrow$ Hard Delete* dengan konfirmasi modal aman).
5. **PR#9 Fase 3 — Tier 3 Web Comparison:**
   - **Status:** ✅ **Selesai Penuh & Live-Verified (2026-09-04)** (Service `WebComparisonService.js` + IPC fetch bridge + multi-provider RSS/HTML + integrasi Human-in-Command UI Approval + Server-side RAG Evidence Gate).

6. **Audit & Penyelarasan Persona Kesadaran Memori pada System Prompt:**
   - **Isu:** Respons LLM untuk kalimat negasi (misal *"jangan simpan info ini ya"*) mengklaim *"saya tidak menyimpan informasi pribadi... bersifat sementara"* — bertentangan dengan arsitektur sistem yang memiliki `MemoryGovernorService` aktif.
   - **Status:** ✅ **Selesai Diimplementasikan** ([`2026-09-03-fix-persona-memory-awareness-wording.md`](../project-memory/changelog/2026-09-03-fix-persona-memory-awareness-wording.md)) via penambahan blok `KESADARAN SISTEM MEMORI` di `request_pipeline.ts`.
7. **Fase 2 — Memory Context Panel Category Alignment (Backlog #7):**
   - **Status:** ✅ **Selesai Diimplementasikan (Tahap 1 Sub C — 2026-09-03)** ([`2026-09-03-tahap1-sub-c-memory-context-panel-category-alignment.md`](../project-memory/changelog/2026-09-03-tahap1-sub-c-memory-context-panel-category-alignment.md)).
   - **Solusi Terisolasi:** Menambahkan `getActiveMemories` di `MemoryGovernorService.js` khusus untuk tampilan panel UI tanpa menyentuh heuristik retrieval backend `MemoryService._inferCategories()`. Panel kini menampilkan seluruh memori aktif lintas kategori saat idle/generik dan tidak lagi keliru menampilkan "0 memori aktif".
8. **Mekanisme Deteksi Deployment Drift (Edge Function vs Git Local/Remote):**
   - **Isu:** Inkonsistensi antara status commit lokal/remote di git dengan build/runtime yang aktif dieksekusi di Supabase Cloud Edge Function (`agent-process`), sehingga keterlambatan deployment hanya dapat dideteksi lewat penelusuran manual isi teks konteks sistem di console log.
   - **Status:** ✅ **Selesai & Live-Verified (2026-09-08)** ([`2026-09-08-deployment-drift-detection-mechanism.md`](../project-memory/changelog/2026-09-08-deployment-drift-detection-mechanism.md)).
   - **Solusi:** Endpoint `/health` di `agent-process/index.ts` kini mengembalikan `deployed_commit_sha`/`deployed_branch`/`deployed_at` (dibaca dari env var, diset via `supabase secrets set` saat deploy) plus header `x-deployed-commit-sha`. Dua script baru: `scripts/deploy-agent-process.ps1` (set metadata commit lalu deploy `--no-verify-jwt` sesuai konvensi proyek) dan `scripts/verify-deployment-drift.ps1` (bandingkan git HEAD lokal vs commit yang ter-deploy, exit code untuk otomasi). Live-verified: deploy production dijalankan, hasil `[MATCH]` terkonfirmasi end-to-end. Batasan: SHA tercatat adalah HEAD saat deploy dijalankan, bukan isi commit — disarankan commit & push dulu sebelum deploy agar akurat.
9. **Runtime Chat Session Stability & Chat History Realtime Persistence (`ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md`):**
   - **Isu:** Seluruh kolom chat mengalami kedipan/refresh periodik dan penghapusan sesi aktif (akibat unmount loop komponen anonim `mainPanel` di `AppRegistry.js`), tabrakan kunci `mamet_v4_current_chat_id` di `localStorage` antar 3 workspace, pembatalan auto-save 1 detik oleh unmount mendadak, serta bilah samping `ChatHistory` tidak menampilkan chat baru (karena keterbatasan listener Web API `storage`, ketiadaan event bus di `saveChatToDB`, dan `setChats` yang hanya memetakan memori lama).
   - **Status:** ✅ **Selesai Diimplementasikan & Live-Accepted (2026-09-04 — Build Pass 2662 modul, 0 error)** ([`ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md`](./ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md)). Terverifikasi live desktop oleh Owner: kedipan 0, sesi obrolan utuh, riwayat realtime dan terisolasi antar-workspace.
   - **Rencana Solusi:**
     1. Stabilisasi referensial React Reconciler pada `AppRegistry.js` menggunakan komponen pembungkus statis (0 unmount, 0 flicker, memori chat utuh).
     2. Isolasi kunci `localStorage` per workspace (`mamet_v4_${workspaceId}_current_chat_id`).
     3. Pemancaran event `Chat:Updated` via `EventBus` saat `saveChatToDB` di `AssistantService.js` selesai.
     4. Integrasi listener `EventBus` di `ChatHistory.jsx` untuk auto-refresh real-time seketika saat percakapan baru dibuat.
     5. Remediasi kolom query `verification_audit_logs` di `useDashboardData.js` untuk mengeliminasi siklus error HTTP 400 di background.
   - **Catatan Regresi Terpisah (2026-09-08):** Ditemukan error HTTP 400 kedua pada query yang sama saat live test Tier 3 (`column verification_audit_logs.metadata does not exist` — bug pre-existing berbeda dari fix `created_at`→`timestamp` di atas, tidak terdeteksi pada verifikasi 2026-09-04). ✅ **Diperbaiki & Diverifikasi** ([`2026-09-08-fix-verification-audit-logs-metadata-column-regression.md`](../project-memory/changelog/2026-09-08-fix-verification-audit-logs-metadata-column-regression.md)): kolom `metadata` dihapus dari select query, fallback `latestVerWithTrace` yang bergantung padanya dihapus (fallback utama dari `agent_logs` tetap berfungsi). Terverifikasi REST API 200 + build pass.
10. **Tier 3 Web Search pada Web Browser (Chrome/Vercel) — Dynamic Import 404 (`supabase.js`) & CORS Fallback (`PENDING-tier3-web-search-chrome-cors-proxy-fix.md`):**
    - **Isu:** Pada desktop Electron, Tier 3 Web Comparison berfungsi 100% via native IPC bridge (`window.electronAPI.fetchWeb`). Namun pada browser web Google Chrome (deployment Vercel), pencarian web gagal total karena baris `const { supabase } = await import('../../../supabase.js')` di `WebComparisonService.js:359` memicu browser request ke `https://mamet-ecosystem.vercel.app/supabase.js` yang menghasilkan HTTP 404 Not Found. Kegagalan import memicu exception sebelum Edge Function `proxy_fetch` terpanggil, dan fallback `fetch()` langsung browser diblokir oleh kebijakan CORS Chromium (`No 'Access-Control-Allow-Origin' header`).
    - **Status:** ✅ **Selesai & Live-Verified (2026-09-08)** ([`PENDING-tier3-web-search-chrome-cors-proxy-fix.md`](./PENDING-tier3-web-search-chrome-cors-proxy-fix.md), [`2026-09-08-fix-tier3-web-search-chrome-vercel-static-import.md`](../project-memory/changelog/2026-09-08-fix-tier3-web-search-chrome-vercel-static-import.md)).
    - **Solusi:** Ubah dynamic import menjadi static import di header `WebComparisonService.js` (`import { supabase } from '../../../supabase.js'`), sesuai pola yang sudah dipakai `AssistantService.js`. Build Vite production bersih (2663 modul, 0 error). Live test di Chrome/Vercel dengan query "berita ai terbaru" mengonfirmasi `proxy_fetch` terpanggil sukses (Bing News RSS, 4 hasil, 920ms), tanpa error 404/CORS, jawaban AI menampilkan `[STATUS: VERIFIED]`.

11. **System Diagnostic App ("Event Viewer" ala `dmesg`) — `roadmap-lanjutan.md` §4.2:**
    - **Isu:** Tidak ada aplikasi terdaftar di *AppRegistry* untuk menampilkan riwayat error/warning kernel. Fungsi `kernel.getHealth()` (`Kernel.js:647`) dan `getLogs()` (`:430`) sudah tersedia, namun saat ini hanya dirender di `Settings.jsx:19,37`.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-08)** ([`2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md`](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)).
    - **Solusi:** `frontend/src/components/system/SystemLogsApp.jsx` dibangun & didaftarkan sebagai `app:kernel` di `system.json` + `AppRegistry.js` (slot navigasinya sudah tersedia di grup System Observability). **Bug prasyarat ikut ditemukan & diperbaiki:** `Kernel.log()` menulis ke `this.health[level + 's']` sehingga `'ERROR'`→`health['ERRORs']` (undefined) — kedua bucket tidak pernah terisi sejak awal, membuat `getLogs()` dan health di `Settings.jsx` selalu kosong. Diverifikasi live di dev server: registrasi `app:kernel` muncul di console boot, dan `errors 0→1`/`warnings 0→1` setelah perbaikan.

12. **Distilasi Pengetahuan Arsip (`00_EXPERIMENT_HISTORY.md`) — `roadmap-lanjutan.md` §1.2:**
    - **Isu:** Folder `_knowledge_archive/` sudah terisi, tetapi berkas indeksnya (`00_INDEX.md`) hanya berupa inventaris folder — bukan ringkasan 1–2 paragraf per eksperimen gagal seperti spesifikasi. Akibatnya Engineer internal tidak punya sumber ringkas untuk belajar dari kegagalan masa lalu tanpa membaca kode usang.
    - **Status:** ✅ **Selesai (2026-09-08)** ([`2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md`](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)).
    - **Solusi:** `_knowledge_archive/00_EXPERIMENT_HISTORY.md` dibuat — memuat tujuan, alasan ditinggalkan, kesimpulan, gagasan yang tetap hidup, dan tabel peran per berkas untuk klaster **Legacy Cognition Layer** (18 berkas + 3 route API). **Temuan:** berkas yang disebut `roadmap-lanjutan.md` §1.1 (`chaos_memory_v3.ts`, `semantic_memory_v4.ts`, folder `scratch/`, `mametlite/`) ternyata tidak ada di arsip; `00_INDEX.md` yang mendaftarkan folder-folder tak-eksis itu ikut dikoreksi agar tidak menyesatkan Engineer.

13. **Dua Aturan Prompt Pengaman Belum Ditambahkan — `roadmap-lanjutan.md` §3.1:**
    - **Isu:** Blok `### ATURAN KODE (WAJIB DIPATUHI) ###` di `engineer.js:2483–2491` sudah memuat larangan `eval()`/`new Function()`, panggilan API vendor langsung, dan modifikasi file core — namun dua aturan dari spesifikasi belum ada.
    - **Status:** ✅ **Selesai (2026-09-08)** ([`2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md`](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)).
    - **Solusi:** Kedua aturan ditambahkan ke blok `ATURAN KODE` di `_buildPatchPrompt()`:
      1. Larangan menulis `eventBus.emit("Engineer:GeneratePatch", ...)` di file yang diubah (proteksi anti *infinite loop*, melengkapi Circuit Breaker `engineer.js:1389–1398`).
      2. Larangan membaca/menyalin kode raw dari `_knowledge_archive/`; Engineer diarahkan hanya membaca `00_EXPERIMENT_HISTORY.md` yang dibuat pada Item 12.

14. **Housekeeping Struktur Folder `frontend/src/` — Ditemukan saat Diskusi Arsitektur (2026-09-08):**
    - **Isu:** Audit struktur `frontend/src/core/` (dipicu diskusi soal filosofi Linux "satu folder satu tanggung jawab") menemukan beberapa penyimpangan dari prinsip yang sudah diterapkan rapi di tempat lain (`core/application/`, `core/metadata/`, `core/window/` masing-masing 1-2 file, bersih):
      1. `core/workspace/` (4 file, aktif) vs `core/workspaces/` (cuma `README.md`, stub *"pending Step 4 approval"* untuk Engineer Workspace UI yang tidak pernah dibangun) — nama nyaris identik, berisiko file salah taruh.
      2. `frontend/src/services/ExecutionTraceService.js` terpisah sendirian dari 26 service lain yang semuanya di `core/runtime/services/` — dipakai oleh `useDashboardData.js`, kemungkinan besar cuma salah taruh.
      3. `frontend/src/hooks/useDashboardData.js` terpisah dari `core/runtime/hooks/useService.js` — awalnya diduga disengaja (hook inti vs hook fitur), Owner memutuskan disatukan.
      4. `frontend/src/lib/` kosong total — dikonfirmasi via `git log` bahwa isinya dulu (`TokenSaverAgent.js`, `MainOrchestrator.js`) sudah dihapus sebagai dead code di commit `b434238` (2026-09-03); folder fisik tersisa tidak terlacak git (git tidak melacak folder kosong).
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-08)** ([`2026-09-08-housekeeping-frontend-src-folder-structure.md`](../project-memory/changelog/2026-09-08-housekeeping-frontend-src-folder-structure.md)).
    - **Keputusan Owner (semua dieksekusi):**
      1. `hooks/` → disatukan seluruhnya ke `core/runtime/hooks/` (`useDashboardData.js` dipindah via `git mv`).
      2. `core/workspace/` + `core/workspaces/` → digabung jadi satu nama **`workspaces/`** (jamak) — 4 file kode digabung dengan `README.md` yang sudah ada di sana.
      3. `frontend/src/lib/` → dihapus (sudah kosong, terkonfirmasi via git log).
      4. `services/ExecutionTraceService.js` → pindah ke `core/runtime/services/`, import di `useDashboardData.js` disesuaikan.
    - **Catatan eksekusi:** selain 5 importer `core/workspace/WorkspaceContext` yang tercatat di audit awal, ditemukan 3 importer tambahan yang memakai path relatif berbeda (`../workspace/...` dari `Kernel.js` dan `AppRegistry.js`) yang tidak tertangkap pencarian string literal pertama — build sempat gagal karenanya, langsung diperbaiki di sesi yang sama sebelum verifikasi live. Total 8 file importer diperbarui. Diverifikasi: build production sukses, boot aplikasi live tanpa error (Kernel.js berhasil resolve `WidgetRegistry`/`WorkspaceManager`/`lazyLoadWithRetry` dari lokasi baru — kegagalan resolve di sini akan meng-crash seluruh boot), instance `WidgetRegistry`/`WorkspaceManager` terkonfirmasi ter-instansiasi lewat `serviceManager`, dan ketiga modul yang dipindah (`ExecutionTraceService.js`, `useDashboardData.js`, `WorkspaceContext.jsx`) dikonfirmasi resolve & mengekspor simbol yang benar via dynamic import langsung di browser.
    - **Catatan terkait — ✅ SUDAH TERTUTUP LEWAT JALUR LAIN (diperbarui 2026-09-09):** Audit ini dulu mencatat bahwa penyaringan tool per-mode cuma satu saklar besar `toolsEnabled` (`policy_middleware.ts`) dengan 3 `if` hardcoded (`cron_manager`, `file_analyzer`, `knowledge_manager`), dan Owner ingin kontrol manual penuh (mis. "Assistant boleh web search, Engineer tidak") — direncanakan dikerjakan bersamaan dengan pembuatan folder `tools/`. Folder `tools/` sudah dibuat (Item 31), dan saat catatan ini ditinjau ulang ditemukan bahwa **catatan ini menunjuk ke bidang kendali yang salah**: `policy_middleware.ts` hanya aktif kalau request membawa array `tools`, sedangkan `AssistantService.js` hanya mengirimnya untuk mode Lite (`tools: isLiteMode ? [...] : undefined`) — untuk ws-assistant & ws-engineer nilainya `undefined` sehingga `intent_router.ts` langsung `return { isChatBiasa: true }` dan melewati seluruh fase tool sisi-server. Artinya bidang server itu **hanya mengatur jalur Lite** (ws-lite & deployment eksternal `mametlite/`), bukan Assistant/Engineer. Kebutuhan asli Owner ("Assistant boleh web search, Engineer tidak") sudah terpenuhi sepenuhnya oleh bidang kendali **klien** yang dibangun di Item 30 & 32 (`ToolPreferencesService` + panel Tools per-workspace). Tidak ada pekerjaan tersisa untuk kebutuhan itu. Temuan sampingan tentang ketiadaan aturan izin `web_search`/`rag_search` di jalur Lite dipisah jadi **Item 33**.

15. **Dekomposisi Penuh `engineer.js` (2978 Baris) — [`ADR-0017-engineer-js-decomposition.md`](../adr/ADR-0017-engineer-js-decomposition.md):**
    - **Isu:** `engineer.js` melanggar prinsip "One File, One Responsibility" yang sama seperti `index.ts` sebelum ADR-0009 — satu file menampung Session Artifact, intent detection, capability guard, reasoning lock, patch generation, prompt building, compliance checking, file I/O, dst (~60 method).
    - **Status:** ✅ **SELESAI — Semua 8 fase selesai & terverifikasi live end-to-end (2026-09-08)** ([`ADR-0017-engineer-js-decomposition.md`](../adr/ADR-0017-engineer-js-decomposition.md), [`2026-09-08-adr-0017-fase1-session-artifact-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase1-session-artifact-extraction.md), [`2026-09-08-adr-0017-fase2-intent-capability-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase2-intent-capability-extraction.md), [`2026-09-08-adr-0017-fase3-static-code-analyzer-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase3-static-code-analyzer-extraction.md), [`2026-09-08-adr-0017-fase4-filesystem-memory-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase4-filesystem-memory-extraction.md), [`2026-09-08-adr-0017-fase5-reasoning-approval-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase5-reasoning-approval-extraction.md), [`2026-09-08-adr-0017-fase6-task-handlers-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase6-task-handlers-extraction.md), [`2026-09-08-adr-0017-fase7-patch-generator-snippet-extraction.md`](../project-memory/changelog/2026-09-08-adr-0017-fase7-patch-generator-snippet-extraction.md), [`2026-09-08-adr-0017-fase8-patch-applier-decomposition-complete.md`](../project-memory/changelog/2026-09-08-adr-0017-fase8-patch-applier-decomposition-complete.md)).
    - **Rencana:** Peta 11 kelompok tanggung jawab dipetakan ke 12 modul baru di `engineer/` (`SessionArtifact.js`, `EngineerMemoryStore.js`, `CapabilityGuard.js`, `IntentClassifier.js`, `ReasoningLock.js`, `ApprovalGateway.js`, `TaskHandlers.js`, `StaticCodeAnalyzer.js`, `FileSystemGateway.js`, `CodeSnippetExtractor.js`, `PatchGenerator.js`, `PatchApplier.js`), diekstrak dalam 8 fase berurutan berdasarkan risiko (struktur data murni dulu, LLM/patch-apply terakhir). Target awal `engineer.js` menyusut ke ~650-700 baris — hasil akhir **1133 baris**, lebih besar dari estimasi karena orchestrator (`_handlePatchTask` ~365 baris) dan `_analyze`/`_review`/lifecycle memang secara sah tetap tinggal (Kelompok K), bukan kandidat ekstraksi lebih lanjut.
    - **Hasil Akhir:** `engineer.js` 2978 → **1133 baris (−1845, ~62%)**. 12 modul baru di `frontend/src/core/runtime/services/engineer/` semuanya selesai. Fase 8 (terakhir, risiko tertinggi — `PatchApplier.js`, satu-satunya tempat yang benar-benar menulis file ke storage) menemukan koreksi baru: `suspiciousAttempts`/`capability` adalah primitif di instance (bukan Map/object seperti state fase-fase sebelumnya), tidak bisa diteruskan by-reference — diselesaikan dengan closure callback `onImmutableFileBlocked()` yang tetap tinggal di `engineer.js`. Diverifikasi end-to-end penuh dengan **file benar-benar tertulis ke storage dan dibaca ulang** (bukan mock): file kecil approved, file besar dengan file lain yang di-skip, file immutable diblokir, emergency lockdown di percobaan ke-3 (capability turun ke OBSERVER), dan safety-check anti-truncation — 5 skenario semuanya sesuai kontrak kode asli.
    - **Terhubung dengan Item Lain:** Fase 7 **sengaja digabung** dengan implementasi `CodeSnippetExtractor.js` dari `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` §2.1 (sekarang **selesai diimplementasikan**, bukan lagi cuma desain) — keduanya menyentuh `_buildPatchPrompt()` yang sama, dikerjakan sekali agar tidak ada dua PR tumpang tindih. Backlog Item 14 (housekeeping folder `hooks/`/`workspace`/`workspaces`) masih ditunda sesuai instruksi Owner ("jangan ubah dulu"), tidak terkait ADR-0017.

16. **Kebocoran Memori Personal ke Mametlite — [`PENDING-mametlite-memory-leak-fix.md`](./PENDING-mametlite-memory-leak-fix.md):**
    - **Isu:** Audit ulang dokumen proposal lama (tidak ada bukti eksekusi di dokumen sumber) menemukan `canReadMemory` di `execution_context.ts` hardcode `true` untuk semua mode termasuk LITE (Mametlite) — memori personal user tetap diambil (`retrieveMemories()`) dan disuntik ke prompt di sistem yang diiklankan sebagai RAG/Web Search-only.
    - **Status:** ✅ **Selesai & Deployed ke Production, Drift-Verified (2026-09-08)** ([`2026-09-08-fix-mametlite-memory-read-leak.md`](../project-memory/changelog/2026-09-08-fix-mametlite-memory-read-leak.md)).
    - **Temuan & Perbaikan:** Dari 3 temuan asli di dokumen proposal, 2 sudah tertutup lebih dulu oleh sistem policy `isMametLite` yang berkembang di kode (Temuan #3 Background Persistence Leakage via `canWriteMemory: false`; Temuan #2 Context Override via `memoryPriority: "balanced"`) — tanpa terdokumentasi sebagai penyelesaian proposal ini. Hanya **Temuan #1 (Memory Injection Leakage)** yang masih aktif, ditutup dengan satu baris: `canReadMemory: engineerPolicy?.canReadMemory ?? !isMametLite` ([`execution_context.ts:36`](../../supabase/functions/agent-process/lib/request/execution_context.ts)), konsisten dengan pola flag policy lain yang sudah ada.
    - **Deploy:** Edge Function `agent-process` tidak auto-deploy dari git push (pipeline CI deploy-nya di-comment-out) — dieksekusi manual via `supabase functions deploy` dengan metadata commit SHA (skrip resmi proyek dari Backlog Item 8, Deployment Drift Detection). Diverifikasi live: `deployed_commit_sha` di endpoint `/health` production cocok persis dengan commit yang di-push, status `HEALTHY`, tanpa drift.

17. **Dashboard Observability Realtime — [`ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md`](./ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md):**
    - **Isu:** Sebelum didiskusikan untuk eksekusi, diaudit ulang terhadap kode aktual (bukan diasumsikan dari status dokumen "PROPOSED").
    - **Status:** ✅ **Ternyata Sudah Terimplementasi Penuh — Bukan Proposal Terbuka** ([`2026-09-08-dashboard-observability-already-implemented.md`](../project-memory/changelog/2026-09-08-dashboard-observability-already-implemented.md)).
    - **Temuan:** Seluruh 6 item di §3 dokumen (jendela 15 menit untuk SYSTEM STATUS, sanitasi `[object Object]`, auto-load trace terbaru, sinkronisasi metrik `agent_logs`/`api_usage`, rendering human-readable, deep-link resolusi Memory Conflicts) dikonfirmasi sudah ada di `useDashboardData.js`/`ObservabilityPanel.jsx` saat ini. `git log -S` menunjukkan fix-fix ini pertama muncul di commit `adaff68` (2026-09-04) — commit yang SAMA yang membuat dokumen roadmap-nya sendiri. Status dokumen "PROPOSED" selama 5 hari murni drift dokumentasi, bukan pekerjaan yang belum dikerjakan. Path lama `frontend/src/hooks/useDashboardData.js` di dokumen sumber diperbarui ke lokasi barunya (`core/runtime/hooks/`) mengikuti housekeeping Item 14.
    - **Tindakan:** Tidak ada eksekusi kode baru — audit murni. Status header dokumen sumber diperbarui.

18. **Knowledge Galaxy — Cosmic Orbits & Live Thought Pulse — [`ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md`](./ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md):**
    - **Isu:** Home Dashboard `ActivityGraph.jsx` masih pakai garis relasi lurus, dan tidak ada jembatan visual antara memori yang sedang dipakai AI di percakapan dengan simpul bintangnya di knowledge graph.
    - **Status:** ✅ **Selesai & Diverifikasi (2026-09-08)** ([`2026-09-08-knowledge-galaxy-cosmic-orbits-implementation.md`](../project-memory/changelog/2026-09-08-knowledge-galaxy-cosmic-orbits-implementation.md)).
    - **Temuan sebelum eksekusi:** Pilar A (partikel semantik mengalir) ternyata **sudah ada** sebagian — dipakai untuk keperluan lain (highlight jalur breaking-change). Hanya `linkCurvature` yang benar-benar hilang, ditambahkan sebagai satu prop (`0.14`). Pilar B (Live Thought Pulsing) sepenuhnya baru, tapi sumber datanya (`activeMemories` di `ConversationEngine.jsx`) sudah ada dan punya `.id` yang cocok dengan konvensi node graph — tidak perlu perubahan backend.
    - **Bug ditemukan & diperbaiki saat verifikasi live:** Kode baru saya sendiri salah unwrap payload EventBus (`EventBus.emit()` selalu membungkus payload asli di `payload.data`, bukan level teratas) — ditemukan lewat simulasi round-trip event sungguhan di browser, bukan cuma baca kode, langsung diperbaiki dan diverifikasi ulang.
    - **Keterbatasan verifikasi:** Home Dashboard di balik layar login, tidak ada kredensial untuk verifikasi visual (screenshot render kanvas) — verifikasi dilakukan sampai batas logika data/event round-trip, plus build production sukses dan kedua modul resolve tanpa error.

19. **Konsolidasi Hierarki Otoritas Dokumen — [`ADR-0018-constitution-v3-supreme-authority.md`](../adr/ADR-0018-constitution-v3-supreme-authority.md):**
    - **Isu:** Audit dokumentasi menyeluruh (brainstorming atas permintaan Owner, "baca dokumen constitution dan dokumen terkait") menemukan `docs/adr/ADR-0001` (2026-06-27) masih menetapkan MAEF sebagai otoritas tertinggi, sementara `constitution/00_CONSTITUTION.md` v3.0 (2026-06-30, sehari lebih baru) menetapkan Constitution sebagai otoritas tertinggi dan mereduksi MAEF jadi sub-dokumen Level 1 — dua hierarki otoritas hidup berdampingan tanpa suksesi formal, persis pola GAP-NEW-001/002 (MAEF v1 vs v2) yang terulang satu lapis lebih tinggi. Ditemukan juga: `MASTER-ARCHITECTURE-INDEX.md` tidak tahu `constitution/` v3 eksis; `ADR-0011` masih pakai kerangka lama; tiga model "Engineer Lifecycle" berbeda tanpa saling rujuk; referensi `MANTRA.md` di `24_ANTI_HALLUCINATION_PROTOCOL.md` salah nama file; `RFC-014/015/016` + `EXECUTION-SURFACE-INVENTORY.md` menyebut "Svelte Desktop" yang tidak ada jejaknya di codebase (desktop aktual: Electron, dikonfirmasi via `ADR-0016`).
    - **Status:** ✅ **Selesai Penuh (2026-09-09)** ([`ADR-0018`](../adr/ADR-0018-constitution-v3-supreme-authority.md), [`2026-09-09-governance-documentation-consolidation.md`](../project-memory/changelog/2026-09-09-governance-documentation-consolidation.md)).
    - **Solusi:** ADR-0018 dibuat men-supersede ADR-0001. `MAEF V2.md` & `MAMET AI VISION CONSTITUTION V2.md` diberi header SUPERSEDED + pointer. `MASTER-ARCHITECTURE-INDEX.md` diperbarui (v2.1) menunjuk `constitution/` v3. `ADR-0011` diberi catatan referensi (keputusan intinya tidak berubah). `constitution/ENGINEERING_CONTRACT.md` reading order dilengkapi sampai dokumen 27 + pointer ke `INIT.md`. `INIT.md` diperbarui mencantumkan status kedua dokumen v2. Tiga model Engineer Lifecycle (`07_ENGINEERING_SYSTEM.md`, `21 Engineer Capability.md`, Vision Constitution V2 §SELF ENGINEERING LIFECYCLE) diberi catatan silang-rujuk agar jelas cakupan masing-masing (per-tugas vs kematangan sistem). Referensi MANTRA.md diperbaiki ke nama file asli (`mantra.txt`/`mantra-realita-ringkas.md`). Ketidaksesuaian "Svelte Desktop" dikonfirmasi Owner sebagai istilah keliru (bukan rencana migrasi) — seluruh rujukan di `RFC-015`, `RFC-016`, `EXECUTION-SURFACE-INVENTORY.md` diganti "Electron", GAP-NEW-021 ditutup Resolved.

20. **Audit Lanjutan & Konsolidasi Sisa `docs/architecture/` (31 file):**
    - **Isu:** Melanjutkan audit Item 19, seluruh sisa 31 file di `docs/architecture/` dibaca. Ditemukan: (a) dua sistem penomoran gap terpisah (`GAP-004..010` tanpa prefix "NEW", didokumentasikan di 7 file audit/plan individual) yang tidak pernah tercatat di register pusat `ARCHITECTURE-GAPS.md` meski semuanya sudah selesai diimplementasikan via Wave 5-3 (dikonfirmasi `mantra.txt` §15); (b) `GAP-NEW-016` (ragTopK MametLite vs AI) berstatus Open padahal `mantra.txt` §11 sudah menjelaskan ini keputusan desain sengaja; (c) `RFC-013` berstatus header "DRAFT" padahal `ARCHITECTURE-GAPS.md` sendiri sudah mencatatnya Resolved sejak Wave 2; (d) tiga dokumen redesain UI/OS (`20_WORKSPACE_ARCHITECTURE.md`, `ARCHITECTURE-OS-NAVIGATION-V2.md`, `ARCHITECTURE-UI-OS.md`) tumpang tindih dengan istilah berbeda tanpa saling rujuk.
    - **Status:** ✅ **Selesai (2026-09-09)** ([`2026-09-09-architecture-docs-consolidation.md`](../project-memory/changelog/2026-09-09-architecture-docs-consolidation.md)).
    - **Solusi:** Cross-check langsung ke kode (`frontend/src/core/workspaces/WorkspaceManager.js` docblock secara eksplisit mengutip nama file `20_WORKSPACE_ARCHITECTURE.md`) mengonfirmasi dokumen itu sebagai **master/otoritatif**. Atas permintaan Owner ("gabung total jadi satu file"), `20_WORKSPACE_ARCHITECTURE.md` ditulis ulang (v1.1.0) menyerap konten `ARCHITECTURE-OS-NAVIGATION-V2.md` (§2 baru: hierarki Kernel→Application Manager→Workspace) dan `ARCHITECTURE-UI-OS.md` (Responsive Strategy di §7, diagnosis gap tambahan di §1), plus §13 baru merangkum sejarah/evolusi desain. Kedua file sumber dipindah (`git mv`, bukan dihapus) ke `docs/project-memory/history-archive/`. `ARCHITECTURE-GAPS.md` diberi tabel baru "Legacy Gap Series (GAP-004..010)" menyatukan sistem penomoran gap kedua, 7 file sumber diberi header Resolved. `GAP-NEW-016` ditutup Resolved (dikonfirmasi Owner). `RFC-013` header diperbaiki ke "APPROVED & IMPLEMENTED".

21. **`MAEF V3.md` (Otoritas Tertinggi Keempat) & Dokumen Legacy "AI Agent" Ditandai:**
    - **Isu:** Lanjutan audit ke sisa `docs/` menemukan `docs/project-memory/MAEF V3.md` — dokumen otoritas tertinggi **keempat** (setelah MAEF v1, v2, Constitution v3) yang terlewat dari ADR-0018 karena belum ditemukan saat itu, ditulis tanggal sama persis dengan Constitution v3 (2026-06-30). Juga ditemukan `docs/ARCHITECTURE.md` dan `docs/QUICK-START.md` — dokumentasi stack era awal proyek "AI Agent" (Express+React polos, tanpa Supabase/MAEF/Electron) yang belum ditandai usang, dengan `backend/tools-config.js` yang disebut aktif di dalamnya padahal dikonfirmasi dead code oleh `verification_report.md`. Ditemukan juga `frontend/electron/airdropEngine.cjs` — kode bot stealth Web3 (puppeteer-extra, CAPTCHA bypass, ghost-cursor, auto-approve MetaMask/Twitter/Discord) dari era yang sama; dibahas terpisah dengan Owner dan dikonfirmasi sudah sengaja dinonaktifkan sebelumnya (bukan temuan baru, dicatat di memori sesi Claude, bukan bagian dari perubahan dokumentasi ini).
    - **Status:** ✅ **Selesai (2026-09-09)** ([`2026-09-09-maef-v3-and-legacy-docs-marked.md`](../project-memory/changelog/2026-09-09-maef-v3-and-legacy-docs-marked.md)).
    - **Solusi:** `MAEF V3.md` diberi header SUPERSEDED (isi tumpang tindih penuh dengan Constitution v3, tidak ada konsep unik yang diselamatkan, berbeda dari MAEF v2 yang punya Two-Brain Model/Self Engineering Lifecycle). `ADR-0018` diperbarui mencatat penemuan lanjutan ini. `MASTER-ARCHITECTURE-INDEX.md` dan `INIT.md` diperbarui. `docs/ARCHITECTURE.md`/`docs/QUICK-START.md` diberi header USANG mengarah ke `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` dan `constitution/`.
    - **Belum ditutup (saat itu):** Trilogi cleanup dead-code Agustus 2026 — lihat Item 22 di bawah, sudah dieksekusi.

22. **Eksekusi Trilogi Cleanup Dead-Code (PR-01, PR-02, PR-04) — [`cleanup_plan.md`](../cleanup_plan.md):**
    - **Isu:** Rencana cleanup dead-code Agustus 2026 (`cleanup_plan.md`, diverifikasi `ponytail_audit_report.md`/`verification_report.md`) baru separuh jalan — `TODO.md`, `mamet_fs` (0 byte), `.tmp_search_agent.ps1`, `Runtime Pipeline Audit.txt` masih ada; `graphify-out/` seharusnya dipangkas jadi 2 snapshot, malah terus menumpuk (07-29 sampai 08-22+); PR-03 sendiri ternyata cuma separuh jalan — `frontend/frontend_tree.md` (3.25 MB) satu batch dengan 11 modul `lib/` yang sudah terhapus, tapi tertinggal.
    - **Status:** ✅ **Selesai (2026-09-09)** ([`2026-09-09-dead-code-cleanup-trilogy-execution.md`](../project-memory/changelog/2026-09-09-dead-code-cleanup-trilogy-execution.md)).
    - **Solusi:** PR-01/PR-02 dieksekusi — 5 file sampah dihapus (`.tmp_search_agent.ps1`, `mamet_fs`, duplikat Acceptance Test Suite `.txt`, gambar tak terpakai, cache Vite stale), 4 file historis dipindah ke `_knowledge_archive/` via `git mv` (`TODO.md`, `Runtime Pipeline Audit.txt`, Acceptance Test Suite `.md`, `mantra mametlite.txt`), `frontend/.gitignore` ditambah `dist/`. PR-03 dituntaskan — `frontend/frontend_tree.md` (3.25 MB) dihapus, melengkapi batch yang sebelumnya cuma separuh (modul `lib/` sudah lebih dulu terhapus). PR-04 dieksekusi — `graphify-out/` dipangkas ke kebijakan asli (simpan snapshot pertama `07-29` + terbaru `08-22`, hapus 7 snapshot intermediate + `cache/`). Semua file target dikonfirmasi tracked git sebelum dihapus (recoverable via history). Build frontend diverifikasi sukses (0 error) setelah eksekusi.
    - **Tidak dikerjakan (sesuai rencana asli):** PR-05/PR-06 (refactor `server.js`/`engineer.js`) tetap DEFERRED — catatan: `engineer.js` kemungkinan besar PR-06 sudah usang karena sudah didekomposisi via ADR-0017, perlu dicek terpisah. Item MANUAL_REVIEW (`node-fetch` root, `production-pipeline.yml`, `backend/tools-config.js`, `frontend/.githubworkflows/` folder typo) tetap menunggu keputusan eksplisit Owner, tidak dieksekusi unilateral.

23. **Perbaikan Tabrakan Nomor ADR-008 & Index `PROJECT-MEMORY.md` — [`2026-09-09-adr-008-collision-and-project-memory-index-fix.md`](../project-memory/changelog/2026-09-09-adr-008-collision-and-project-memory-index-fix.md):**
    - **Isu:** Lanjutan audit `docs/project-memory/` root dan sisa `docs/adr/` menemukan `docs/project-memory/ADR-008-Application-Bootstrap-Architecture.md` bertabrakan nomor dengan `docs/adr/ADR-0008-single-context-pipeline.md` (dua ADR beda topik, nomor sama). Juga ditemukan tabel index ADR di `PROJECT-MEMORY.md` sudah stale — judul ADR-0003/0004/0005 tidak cocok isi file asli, dan berhenti di ADR-0011 (tidak mencantumkan ADR-0012 s/d ADR-0018 yang sudah ada). Serta `TASK-0002`/`TASK-0003` masih berstatus "In Progress" sejak 2026-06-27 padahal `PROJECT-MEMORY.md` sudah lama mencatatnya Done.
    - **Status:** ✅ **Selesai (2026-09-09)**.
    - **Solusi:** `ADR-008` dipindah (`git mv`) & diberi nomor unik `ADR-0019` di lokasi kanonis `docs/adr/`. Tabel index ADR di `PROJECT-MEMORY.md` diperbaiki (judul dikoreksi, status Superseded ditambahkan untuk ADR-0001/ADR-0005, entri ADR-0012-0019 ditambahkan). Status `TASK-0002`/`TASK-0003` disinkronkan jadi Done dengan catatan rujukan bukti.
    - **Tidak dikerjakan:** Changelog historis yang menyebut "ADR-008" (2 file) sengaja tidak diedit — kebijakan tidak mengubah entri changelog lama.

24. **MAEF V2/V3 & Vision Constitution V2 Dihapus (Bukan Sekadar Ditandai) — [`2026-09-09-maef-v2-v3-vision-v2-deleted-merged-into-constitution.md`](../project-memory/changelog/2026-09-09-maef-v2-v3-vision-v2-deleted-merged-into-constitution.md):**
    - **Isu:** Diskusi dengan Owner soal cara mengurangi jumlah dokumen tanpa membuat dokumen baru — pendekatan sebelumnya (tandai SUPERSEDED, simpan file) dinilai kontradiktif dengan tujuan mengurangi kebingungan/token, karena Git sudah otomatis jadi arsip permanen.
    - **Status:** ✅ **Selesai (2026-09-09)**.
    - **Solusi:** Prinsip baru diterapkan — "gabung lalu hapus" untuk dokumen yang benar-benar digantikan (bukan draft historis bernilai naratif seperti `mantra.txt`). Konsep unik MAEF V2/Vision V2 (Two-Brain Model, Self Engineering Lifecycle, Engineering Confidence) diserap ke `constitution/07_ENGINEERING_SYSTEM.md` dan `constitution/16_ENGINEERING_METRICS_SYSTEM.md`. `MAEF V3.md` tidak ada konsep unik. Ketiga file dihapus. `00_CONSTITUTION.md` §11 diberi 2 kalimat baru melarang dokumen otoritas paralel di masa depan (tanpa dokumen kebijakan terpisah). Seluruh pointer aktif (ADR-0018, MASTER-ARCHITECTURE-INDEX.md, INIT.md, `21 Engineer Capability.md`, `docs/governance/MAEF.md`/`VISION.md`) diperbarui; changelog/audit historis sengaja tidak diedit.
    - **Prinsip untuk ke depan:** hindari pola "tandai lalu simpan" untuk dokumen governance yang genuinely digantikan — serap kontennya, hapus filenya, percayakan Git sebagai arsip. Reservasi ADR baru hanya untuk keputusan arsitektur asli, bukan setiap perbaikan referensi kecil.

25. **Verifikasi Silang Menyeluruh: Tabrakan Hierarki di Dokumen Sendiri — [`2026-09-09-consistency-recheck-hierarchy-triple-duplication.md`](../project-memory/changelog/2026-09-09-consistency-recheck-hierarchy-triple-duplication.md):**
    - **Isu:** Owner meminta pengecekan ulang seluruh perubahan governance sesi ini untuk memastikan tidak ada kontradiksi baru. Ditemukan `constitution/00_CONSTITUTION.md` §10, `docs/adr/ADR-0018` §2.1, dan `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` masing-masing menyimpan salinan hierarki otoritas dengan jumlah level dan urutan **berbeda-beda** — persis pola drift yang memicu ADR-0018 dibuat, kali ini terjadi di dalam pekerjaan perbaikannya sendiri. Juga ditemukan: `MASTER-ARCHITECTURE-INDEX.md` §Architecture Rule masih menunjuk file yang sudah dihapus (`MAEF v2`/`Vision v2`), selisih hitung "27 vs 28 dokumen" di 3 tempat, dan `GAP-NEW-018` yang sebagian sudah terjawab.
    - **Status:** ✅ **Selesai (2026-09-09)**.
    - **Solusi:** `00_CONSTITUTION.md` §10 dijadikan **satu-satunya salinan resmi** hierarki (10 level lengkap); `ADR-0018` dan `MASTER-ARCHITECTURE-INDEX.md` diubah dari menyalin ulang jadi **merujuk** ke sana — perbaikan struktural, bukan sekadar menyamakan angka, agar tidak drift lagi di masa depan. Pointer file terhapus diperbaiki. Angka dokumen disamakan ke 28 (diverifikasi `ls`). `GAP-NEW-018` diperbarui Partially Resolved.
    - **Verifikasi tambahan (tidak ada masalah):** taksonomi Evidence Strength antar `13_VERIFICATION_ENGINE_SPEC.md`/`16_ENGINEERING_METRICS_SYSTEM.md`, sisa rujukan ke file terhapus (semua historis, bukan pointer aktif), klaim "otoritas tertinggi" lain di seluruh repo.

26. **Anotasi Status Implementasi di `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` — [`2026-09-09-spesifikasi-teknis-status-annotation-fix.md`](../project-memory/changelog/2026-09-09-spesifikasi-teknis-status-annotation-fix.md):**
    - **Isu:** Audit sisa `docs/roadmap/` menemukan spesifikasi teknis aktif ini hanya menandai §2.1 sebagai "sudah diimplementasikan", padahal Bagian 3 (SystemGovernor 4-level escalation), §3.2.1, §3.3, §4.2, dan Bagian 6 (Notification Strategy) sudah selesai diimplementasikan & diuji 17/17 sejak 2026-09-03 — 5 hari lebih dulu dari §2.1 — tanpa pernah ditandai di dokumen ini.
    - **Status:** ✅ **Selesai (2026-09-09)**.
    - **Solusi:** 3 anotasi status ditambahkan (Bagian 3, §4.2, Bagian 6), merujuk changelog `2026-09-03-tahap2-system-governor-service.md`. Dikonfirmasi via kode: §2.4 (mengganti `_generateFallbackPatch`) sebaliknya **belum** dikerjakan — `generateFallbackPatch` masih ada persis seperti yang seharusnya diganti; sengaja tidak diberi anotasi karena memang belum selesai.
    - **Cakupan:** Dengan ini seluruh `docs/roadmap/` sudah teraudit — dokumen lain sudah tercakup status jelasnya di `INDEX-ROADMAP.md` ini sendiri atau direkonsiliasi di Item 32 (sesi sebelumnya).

27. **Bug Core Protection Layer — 5 dari 12 Pattern Immutable Tidak Pernah Cocok — [`2026-09-09-fix-core-protection-layer-path-matching-bug.md`](../project-memory/changelog/2026-09-09-fix-core-protection-layer-path-matching-bug.md):**
    - **Isu:** Menjawab pertanyaan Owner soal titik masuk dokumen aturan (AGENTS.md vs jalur runtime Engineer) mengarah ke penemuan bug nyata: `CapabilityGuard.js` `isImmutableFile()`/`isProtectedFile()` memakai pattern berawalan `/`, tapi seluruh pipeline Engineer (`extractFileNamesFromTask` → `tryReadFile` → `FileIndexService`) selalu menghasilkan path relatif tanpa leading slash. Untuk file bersarang dalam (`frontend/src/core/runtime/Kernel.js`) pattern kebetulan tetap cocok; untuk file di root repo (`constitution/`, `supabase/`, `frontend/` langsung) — **tidak pernah cocok**. Ditemukan juga 2 nama file salah (`main.js` seharusnya `main.cjs`, `ModuleLoader.js` seharusnya `module-loader.js`).
    - **Dampak:** 5 dari 12 pattern immutable dan 3 dari 4 pattern protected tidak pernah berfungsi — termasuk proteksi untuk `00_CONSTITUTION.md`, `01_VISION.md`, `09_DNA.md` (otoritas tertinggi per ADR-0018) dan entry point Electron `main.cjs`.
    - **Status:** ✅ **Selesai & Diverifikasi (2026-09-09)**.
    - **Solusi:** Leading slash dihapus dari seluruh pattern (root cause, bukan tambal satu-per-satu), 2 nama file salah diperbaiki. Diverifikasi: 11/11 tes logika langsung (Node ESM, tanpa mock) pass termasuk sanity-check negatif, build production sukses (0 error).
    - **Verifikasi live (2026-09-09, `npm run desktop`):** Owner menguji langsung — prompt patch ke `constitution/09_DNA.md` memicu pipeline patch sungguhan, dan panel approval menampilkan "PERCOBAAN MODIFIKASI CORE DIBLOKIR OLEH SISTEM (IMMUTABLE FILES DETECTED)" — bukti fix bekerja di runtime nyata, bukan cuma tes statis. Detail di §9 changelog.
    - **Ditemukan bersamaan, diperbaiki di item berikutnya:** `engineer.js` `_loadStaticKnowledge()` mencoba membaca path yang tidak pernah ada, dan daftar file statis Engineer tidak memuat `24_ANTI_HALLUCINATION_PROTOCOL.md` s/d `27_DECISION_HEURISTICS.md` — lihat Item 28.

28. **`_loadStaticKnowledge()` Engineer: Path Mati Dihapus, 24-27 Ditambahkan — [`2026-09-09-fix-engineer-static-knowledge-dead-paths-and-missing-docs.md`](../project-memory/changelog/2026-09-09-fix-engineer-static-knowledge-dead-paths-and-missing-docs.md):**
    - **Isu:** Lanjutan Item 27 — `engineer.js` `_loadStaticKnowledge()` (Brain 1) mencoba membaca 6 path yang tidak pernah ada/salah case (`init.md`→`INIT.md`, `agent.md` duplikat salah, 4 path skema penamaan lama seperti `MAEF_v3.0.md`), gagal senyap via try/catch tiap boot. Daftar juga berhenti di `23_HOME_DASHBOARD_SPEC.md`, tidak pernah memuat `24_ANTI_HALLUCINATION_PROTOCOL.md` s/d `27_DECISION_HEURISTICS.md` ke Brain 1 Engineer produksi.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09)** — build production sukses; verifikasi runtime dikonfirmasi via Console `npm run desktop` boot sungguhan: seluruh 24-27 terbaca sukses via Electron IPC (masing-masing beberapa ribu karakter), total `[Engineer] Static knowledge loaded: 32 files`, tidak ada lagi percobaan baca path mati.
    - **Solusi:** 6 path mati/salah dihapus/diperbaiki. `24_ANTI_HALLUCINATION_PROTOCOL.md`, `25_DESIGN_PHILOSOPHY.md`, `26_MENTAL_MODEL.md`, `27_DECISION_HEURISTICS.md` ditambahkan sebelum `ENGINEERING_CONTRACT.md`.
    - **Dengan ini, kedua bug jalur runtime Engineer yang ditemukan sesi ini (Core Protection Layer + Static Knowledge) sudah tuntas ditangani.**

29. **Konsolidasi Instruksi `[MAMET_PATCH_READY]` Duplikat + Klausa Anti-Halusinasi Akses File — [`2026-09-09-fix-core-protection-layer-path-matching-bug.md`](../project-memory/changelog/2026-09-09-fix-core-protection-layer-path-matching-bug.md) §9-10:**
    - **Isu:** Owner menguji prompt sederhana ("Tolong tambahkan...") ke Engineer dan mendapat jawaban "saya tidak memiliki akses langsung ke file" alih-alih proposal patch. Ditelusuri: `request_pipeline.ts` dan `engineer_context.ts` (Supabase edge function `agent-process`) sama-sama punya blok instruksi terpisah soal marker `[MAMET_PATCH_READY]`, dengan panduan format sedikit berbeda — pola drift yang sama seperti dokumen governance, kali ini di system prompt LLM.
    - **Status:** ✅ **Selesai & Dideploy (2026-09-09)** — build tidak relevan (TypeScript edge function), dideploy langsung via `supabase functions deploy agent-process --project-ref uuyzdjifhdfyyvpxsofu`.
    - **Solusi:** `request_pipeline.ts` (selalu ter-inject, tidak tergantung query DB) dijadikan satu-satunya sumber kebenaran format+aturan marker, ditambah klausa eksplisit "Anda PUNYA akses tulis file nyata, jangan pernah bilang tidak punya akses" dan penegasan kata kerja modifikasi sederhana ("tambah", "ubah", "hapus") tetap wajib memicu marker. `engineer_context.ts` RULE 5 diganti jadi rujukan ke instruksi tersebut, bukan duplikasi.
    - **Catatan jujur:** Owner sempat mengoreksi analisis awal — percobaan pertama & kedua Owner juga berbeda di persetujuan dialog web search (ditolak vs disetujui), jadi penyebab pasti kegagalan awal tidak 100% terisolasi dari wording semata. Fix ini tetap valid sebagai perbaikan (duplikasi instruksi & halusinasi akses file adalah fakta struktural terpisah), tapi belum diverifikasi ulang live pasca-deploy dengan variabel yang benar-benar terkontrol.

30. **Fitur Baru: Toggle Preferensi Tool (RAG & Web Search) — [`2026-09-09-add-tool-preferences-toggle-rag-web-search.md`](../project-memory/changelog/2026-09-09-add-tool-preferences-toggle-rag-web-search.md):**
    - **Latar belakang:** Dialog konfirmasi web search yang selalu muncul dirasa membingungkan Owner. Skema toggle dirancang & didiskusikan dulu sebelum implementasi: default global + override per workspace, Web Search 2 status (on=auto-confirm, off=tidak pernah cari), RAG generik untuk pengetahuan yang akan di-upload Owner sendiri (fitur upload belum ada).
    - **Status:** ✅ **Selesai (2026-09-09)** — build production sukses; verifikasi runtime live belum dilakukan (lihat §5 changelog).
    - **Solusi:** `ToolPreferencesService.js` baru (localStorage-backed, generik untuk tool apa pun) + wiring ke `AssistantService.js` (`ragEnabled`, `enableWebComparison`, `autoConfirmWebSearch` sekarang dinamis, bukan hardcode) + UI di `Settings.jsx` (default global) **dan** toggle chip cepat langsung di Session Toolbar `ConversationEngine.jsx` (koreksi Owner: cukup di sesi chat, tidak perlu bolak-balik ke Settings).
    - **Keterbatasan arsitektur yang disengaja:** karena Tier 1→2→3 di `RetrievalOrchestrator` berurutan, RAG off ikut mematikan Tier 3 web search untuk request itu — kombinasi "RAG off + Web on" saat ini berperilaku sama seperti keduanya off. Didiskusikan dengan Owner sebagai edge case yang diterima, bukan bug.
    - **Catatan:** toggle RAG ini tidak memengaruhi pengetahuan bawaan Engineer (Brain 1/constitution) — itu jalur terpisah yang selalu aktif untuk mode ENGINEER.

31. **Tool Registry Folder-Scan (`tools/`) + WebComparison Jadi Tool Nyata — [`2026-09-09-tool-registry-folder-scan-web-search-refactor.md`](../project-memory/changelog/2026-09-09-tool-registry-folder-scan-web-search-refactor.md):**
    - **Isu:** Owner bertanya apakah `WebComparisonService` itu "tool" — ditelusuri, ternyata bukan (tidak lewat `ToolRegistryService`), dan `ToolRegistryService.js` yang sudah ada sebelumnya ternyata **tidak fungsional** (`executeTool()` tidak pernah memanggil `execute()` tool-nya; `memory_manager` referensi `memoryService` yang tidak pernah di-import). Owner meminta pola folder `tools/` yang di-scan otomatis ("seperti Linux [modules]"), scan ulang manual tanpa restart, dan WebComparison direfactor jadi tool mandiri (bukan cuma metadata).
    - **Status:** ✅ **Selesai & Diverifikasi Live Penuh (2026-09-09)** — 2 bug ditemukan & diperbaiki langsung dari live-test Owner: (1) path relatif salah di `scanToolsFolder()` (fix: gabung `${TOOLS_FOLDER}/${relativeFilePath}`), (2) CSP `frontend/index.html` tidak mengizinkan `blob:` di `script-src` (fix: tambahkan `blob:`). Setelah kedua fix, scan dan eksekusi Tier 3 dikonfirmasi bekerja end-to-end tanpa fallback (prompt "carikan berita terbaru ai claude" → `Initiating Tier 3 (via ToolRegistryService: web_search)` → sukses 5 hasil).
    - **Solusi:** Folder `tools/` baru di root repo (bukan `frontend/src/` — supaya tetap terbaca di app yang sudah di-build), `tools/web_search.js` mendelegasikan ke `WebComparisonService.searchWeb()` tanpa mengubah logic-nya sama sekali. `ToolRegistryService.executeTool()` diperbaiki (root cause sama seperti bug lain sesi ini: kode yang terlihat jalan tapi sebenarnya tidak). Scan pakai dynamic `import()` dari Blob URL lewat `StorageManager` yang sudah ada (tidak ada perubahan Electron main process/IPC). `RetrievalOrchestrator` Tier 3 pindah ke `executeTool('web_search', ...)` dengan fallback ke pemanggilan langsung `WebComparisonService` kalau tool belum terdaftar — supaya Tier 3 tidak mati total kalau scan bermasalah.
    - **UI:** Tombol "Scan Ulang Tools" + daftar tool terdaftar baru di `Settings.jsx`.

32. **Tool Panel Generik, RAG/Web Search Dilepas, MAEF Monitor Fix, Dead Widget Cleanup — [`2026-09-09-tool-panel-generic-rag-web-decouple-monitor-fix.md`](../project-memory/changelog/2026-09-09-tool-panel-generic-rag-web-decouple-monitor-fix.md):**
    - **Isu:** Rangkaian temuan dari live-test Owner atas Item 31: (1) 3 tool built-in (`memory_manager`, `file_reader`, `deep_research`) masih hardcode, tidak konsisten dengan folder `tools/`; (2) chip toolbar RAG/Web berisiko penuh layar begitu tool bertambah; (3) kombinasi "RAG mati + Web nyala" ternyata membuat keduanya mati (bukan cuma diterima sebagai limitasi lagi — Owner minta diperbaiki); (4) MAEF Monitor terbuka paksa tiap respons AI sehingga fitur minimize terasa tidak berfungsi; (5) turunan investigasi menemukan `WorkspaceManager` didaftarkan ke kernel padahal murni state UI, dan `SystemStatusWidget` beserta 6 widget dashboard lain ternyata kode mati (tidak pernah dirender).
    - **Status:** ✅ **Selesai & Diverifikasi Live Penuh (2026-09-09)** — setiap perbaikan dites live oleh Owner sebelum lanjut ke temuan berikutnya, termasuk 2 bug turunan yang muncul dari perbaikan sebelumnya (trace Monitor sempat hilang total, lalu hilang lagi saat tutup-buka berulang, masing-masing ditelusuri sampai root cause & diperbaiki).
    - **Solusi:** 3 tool dipindah ke `tools/`; toolbar chat diganti jadi 1 tombol "Tools" dengan dropdown generik dari `ToolRegistryService.listTools()`; `AssistantService.js`/`RetrievalOrchestrator.js` dipisah lewat opsi `skipLocalKnowledge` supaya RAG dan Web Search independen; `WorkspaceManager.openWidgetInWorkbench()` dipecah jadi `injectWidgetData()` (kirim data tanpa memaksa panel terbuka) + `widgetDataStore` dipindah ke level-modul (root cause trace hilang: dua instance `WorkspaceManager` hidup bersamaan — satu dari Kernel, satu per `WorkspaceProvider` — hanya store per-instance yang jadi masalah, bukan arsitektur dua-instance-nya); 7 widget dashboard kode mati + `dashboard.json` dihapus (−496 baris) setelah dikonfirmasi tidak ada referensi tersisa.
    - **Catatan:** refactor struktural memisahkan `WorkspaceManager` total dari kernel **tidak dilakukan** — di luar scope, perlu diskusi arsitektur terpisah kalau ingin ditindaklanjuti.

33. **Jalur Lite: `web_search` & `rag_search` Tidak Punya Aturan Izin Per-Tool (Belum Dikerjakan):**
    - **Isu:** `policy_middleware.ts` (`agent-process`) hanya punya aturan izin spesifik untuk 3 tool — `cron_manager` (`canUseAutomation`), `file_analyzer` (`canUseDesktopTools`), `knowledge_manager` (`canWriteKnowledge`). Dua tool yang justru paling sering dipakai jalur Lite, `web_search` dan `rag_search`, **tidak punya aturan sama sekali**: keduanya lolos selama `ctx.policy.toolsEnabled` masih `true` (yang hanya dimatikan oleh risk score ≥ 2). Ketiga `if` itu juga hardcoded per-tool, bukan konfigurasi data-driven — menambah tool baru berarti menambah `if` baru.
    - **Siapa yang terdampak:** hanya jalur Lite — ws-lite di desktop dan **deployment eksternal `mametlite/`** (mametlite.vercel.app, dipakai pengguna di luar Owner). Assistant & Engineer tidak terdampak sama sekali (tidak pernah mengirim array `tools` ke server; lihat catatan Item 14).
    - **Dampak nyata:** bukan kebocoran data (RAG sudah tenant-isolated penuh lewat inisiatif ZERO-LEAKAGE), tapi tidak ada rem biaya/latensi web search untuk pengguna eksternal — setiap kueri yang lolos Intent Router boleh memicu pencarian web.
    - **Status:** ⏳ **Belum dikerjakan — dicatat sebagai temuan, menunggu keputusan Owner (2026-09-09).** Ditemukan saat meninjau ulang catatan Item 14; sengaja tidak dieksekusi karena Owner menyatakan jalur Lite di luar scope pekerjaan tool registry ("tidak perlu untuk ws lite karena ada mametlite").
    - **Arah solusi (kalau nanti dikerjakan):** ganti 3 `if` hardcoded jadi tabel pemetaan `tool → flag policy yang dibutuhkan` (data-driven, sejalan prinsip "data terpisah dari kode" yang sudah dipakai folder `tools/` dan `skills/`), lalu tambahkan entri untuk `web_search`/`rag_search` dengan flag policy baru (mis. `canUseWebSearch`) yang bisa dibedakan per mode.

34. **Adaptive Model Tiering + Batas Biaya Harian Per-User — [`2026-09-09-adaptive-model-tiering-and-per-user-daily-cap.md`](../project-memory/changelog/2026-09-09-adaptive-model-tiering-and-per-user-daily-cap.md):**
    - **Isu:** Satu model dipakai untuk semua bobot percakapan (boros), dan konfigurasi model hanya di `localStorage` sehingga berbeda antar device. Saat implementasi ditemukan pula bahwa rencana asli §4.3 (Kecil vs Sedang dibedakan toggle `thinking`) **tidak bisa dijalankan** — parameter itu tidak punya jalur sama sekali di pipeline (nol kemunculan di edge function; adapter hanya meneruskan `model`).
    - **Status:** ✅ **Selesai & Diverifikasi Live Penuh (2026-09-09)** — log membuktikan ketiga tier memakai model berbeda (`gpt-4o-mini`, `deepseek-v4-flash-0731`, `deepseek-v4-pro-0813`), classifier maupun override manual dua-duanya bekerja, sinkron `user_metadata` terkonfirmasi dua arah, dan edge function ter-deploy dengan drift check `[MATCH]` terhadap commit `9025c20`.
    - **Solusi:** `TierClassifierService` baru (deterministik, 0 biaya token, dwibahasa ID+EN, dengan smoothing riwayat) + `BrainService.state.tiers` 3 slot yang disinkronkan ke `user_metadata.model_tiers` (debounced) + wiring `AssistantService` (CONVERSATION lewat classifier, LOOKUP dipatok Kecil, Engineer dikecualikan penuh) + UI 3 slot di Settings dan pil override di toolbar chat (client-side-only, tanpa migrasi skema).
    - **Fitur turunan (lahir dari live test):** Owner kena circuit breaker `$1.29 / $1` dan minta tombol pengaturan. `quota_middleware.ts` tidak lagi hardcode `$1`; batas efektif kini = min(batas pribadi di `user_metadata`, plafon sistem di `system_config`). Terbukti live **di kedua arah**: menaikkan ke $1,50 → chat lanjut normal padahal pemakaian $1,29; lalu memperketat ke $0,50 → breaker menyala dengan pesan `($1.46 / $0.5)`, memakai angka batas pribadi, bukan `$1` lama maupun plafon $2.
    - **Temuan keamanan yang ikut ditutup:** policy RLS `system_config_authenticated_update` mengizinkan **setiap** user terautentikasi mengubah plafon biaya dan `kill_switch_active` — berbahaya karena pengguna eksternal mametlite tanpa BYOK key memakai API key sistem milik Owner. Policy dihapus lewat migrasi `restrict_system_config_update_to_service_role`; aman karena tidak ada kode klien yang menulis tabel itu.
    - **Sengaja belum dikerjakan:** plumbing parameter `thinking` (dipisah jadi **Item 35**), tiering untuk mode SKILL, dan penelusuran kenapa cap `$0,50` di `costTracker.ts` tidak ikut menahan.

35. **Plumbing Parameter `thinking` dari Slot Tier sampai ke Provider — [`2026-09-09-thinking-parameter-plumbing.md`](../project-memory/changelog/2026-09-09-thinking-parameter-plumbing.md):**
    - **Isu:** `BrainService` sudah menyimpan field `thinking` per slot tier, tapi nilainya berhenti di penyimpanan — tidak pernah sampai ke LLM. Rantai yang belum tersambung: `BrainService.state.tiers[X].thinking` → payload `AssistantService` → `request_parser.ts`/`ctx.request` → body request di `ai_adapter.ts`. Saat ini adapter hanya meneruskan `model`, dengan `temperature: 0.1` dan `max_tokens: 8192` hardcoded; nol kemunculan `thinking`/`reasoning_effort` di seluruh edge function.
    - **Kenapa perlu:** ini yang memungkinkan rencana asli [`ROADMAP-ADAPTIVE-MODEL-TIERING.md`](./ROADMAP-ADAPTIVE-MODEL-TIERING.md) §4.3 — Kecil dan Sedang memakai **model yang sama** dengan reasoning mati/hidup. Tanpa ini, tiap tier wajib diisi model ID berbeda agar benar-benar terasa bedanya (kondisi sekarang, dan sudah berfungsi).
    - **Bagian tersulit:** tiap provider menamai parameter ini berbeda (Gemini, Anthropic, OpenAI, OpenRouter tidak seragam), jadi adapter butuh tabel pemetaan — dan nama parameternya **wajib diverifikasi dari dokumentasi terkini tiap provider**, jangan diandalkan dari ingatan. Pelajaran dari sesi yang sama: model ID DeepSeek yang diasumsikan ternyata salah dan baru benar setelah diambil langsung dari katalog OpenRouter.
    - **Risiko:** `ai_adapter.ts` dilewati **semua** panggilan LLM — Assistant, Engineer, Lite, dan pengguna eksternal mametlite. Kesalahan di situ berdampak ke semuanya. Perlu deploy edge function.
    - **Status:** ✅ **Selesai & Diverifikasi Live di Kedua Ujung (2026-09-09).** Commit `65d8427` (implementasi) + `32631da` (penjaga Gemini), ter-deploy dengan drift check `[MATCH]`. Ini pertama kalinya sebuah fitur diverifikasi bukan hanya dari konsol browser: sisi klien `[thinking: ON]`, sisi server `[Thinking] Reasoning dinyalakan untuk provider openrouter, model …` di log edge function. Log klien saja hanya membuktikan niat; log server membuktikan parameternya benar-benar masuk ke body request.
    - **Peringatan "wajib dari dokumentasi" dipatuhi:** kelima nama parameter diambil langsung dari dokumentasi provider, bukan dari ingatan — OpenRouter `reasoning: { enabled }`, OpenAI & Groq `reasoning_effort: 'medium'`, Gemini 3.x `thinkingConfig.thinkingLevel`, Gemini 2.5 `thinkingConfig.thinkingBudget: -1`. Cakupan 8 titik request (4 provider × non-stream + stream).
    - **Keputusan desain — semantik sengaja asimetris:** `true` mengirim parameter, `false` **tidak mengirim apa pun** (bukan "matikan reasoning", melainkan "pakai bawaan model"). Sebabnya Gemini 2.5 Pro sama sekali tidak bisa dimatikan thinking-nya, dan sebagian model menolak 400 kalau parameter reasoning dikirim. Karena `ai_adapter.ts` dilewati semua panggilan LLM, perilaku bawaan wajib tidak berubah bagi yang tidak menyalakan toggle.
    - **Rencana §4.3 hanya separuh tercapai — dicatat jujur:** membedakan Kecil vs Sedang lewat "model sama, reasoning mati vs hidup" **tetap tidak bisa**, karena mematikan tidak dapat dijamin lintas provider. Yang bisa hanyalah menyalakannya. Membedakan tier tetap paling andal lewat model ID berbeda.
    - **Koreksi klaim sendiri:** peringatan "OpenRouter menolak 400 untuk model non-reasoning" berasal dari dokumentasi resminya, tapi tidak terbukti menyeluruh — `openai/gpt-4o-mini` menerima `reasoning: { enabled: true }` dan menjawab **HTTP 200**. Penolakan itu bergantung model. Teks peringatan di UI Settings sudah diperbaiki agar tidak menjanjikan error yang belum tentu muncul.
    - **Di luar daftar Item 35 tapi wajib:** toggle per slot di Settings. Tanpa itu nilai slot tidak akan pernah bisa `true` (`_seedTiersFromMainModel()` selalu menulis `false`) dan fiturnya mustahil diuji.
    - **Efek samping paling berharga:** `console.log` yang dibawa fitur ini langsung membongkar cacat lama yang selama ini bisu — lihat **Item 38**. Menambahkan log di jalur yang tidak pernah bersuara ternyata lebih berharga daripada fitur yang membawanya.
    - **Sengaja belum dikerjakan:** tiering & thinking untuk mode SKILL, dan nilai `reasoning_effort` yang masih dipatok `'medium'` (belum bisa diatur Owner per slot).

36. **Empat Cacat Sistem Memori (Payload EventBus, Konflik Salah Tuduh, Duplikat, Klaim Palsu) — [`2026-09-09-memory-system-four-defects-eventbus-conflict-duplicate.md`](../project-memory/changelog/2026-09-09-memory-system-four-defects-eventbus-conflict-duplicate.md):**
    - **Isu:** Bermula dari laporan Owner bahwa Live Thought Pulse (Knowledge Galaxy Pilar B) tidak menyala. Penelusuran membongkar rantai empat cacat yang saling menutupi: (1) `ConversationEngine` membaca `payload.result` pada handler `Memory:Retrieved` padahal `EventBus.emit()` selalu membungkus payload di `payload.data` — `activeMemories` **selalu kosong**; (2) semua memori chat memakai satu `source_reference` konstan sehingga deteksi konflik menuduh fakta-fakta yang tidak berhubungan saling berbenturan; (3) tidak ada pencegah duplikat sama sekali; (4) sistem tetap menjawab "Saya telah menyimpan" untuk memori yang sebenarnya dilewati.
    - **Kenapa lolos selama ini:** panel Memory punya fallback `dbActiveMemories` yang mengambil langsung dari database saat prop-nya kosong — panel tetap terlihat berisi, sehingga cacat #1 tidak pernah terlihat. Satu bug menutupi bug lainnya.
    - **Status:** ✅ **Selesai & Diverifikasi Live Berurutan (2026-09-09)** — tiap perbaikan dites Owner sebelum lanjut: badge memori muncul (sebelumnya tidak pernah), smoothing tier classifier ikut terpicu pertama kalinya, konflik palsu berhenti, log "Duplikat dilewati" terbukti, dan pesan jujur tampil di chat.
    - **Solusi:** unwrap `payload.data` pada handler `Memory:Retrieved`; `source_reference` memori chat disempitkan jadi `assistant_chat:<kategori>` (dengan `verifyAssistantSession` diubah ke pencocokan awalan agar data lama tetap terjaring); guard duplikat di `storeGoldenMemory()` berbasis kolom `summary`; kembalian membawa penanda `_duplicateSkipped` supaya Assistant menjawab jujur sesuai `24_ANTI_HALLUCINATION_PROTOCOL`.
    - **Catatan teknis:** guard duplikat sengaja TIDAK memakai embed PostgREST ke `raw_memory_content` — dicek ke `information_schema`, kedua tabel **tidak punya foreign key**, sehingga embed akan gagal senyap dan terbaca sebagai "tidak ada duplikat".
    - **Belum selesai:** efek denyut Live Thought Pulse belum dikonfirmasi visual (penghalangnya sudah hilang, tapi belum dilihat langsung); tiga salinan duplikat lama dibereskan Owner sendiri lewat panel; deteksi kontradiksi berbasis makna tetap tidak ada.

37. **Penyaring Kategori di Tahap 1 — Akar Sebenarnya di Balik "AI Lupa Terus" — [`2026-09-09-memory-category-filter-root-cause.md`](../project-memory/changelog/2026-09-09-memory-category-filter-root-cause.md):**
    - **Isu:** `MemoryGovernorService.retrieveMemory()` menyaring kandidat dengan `.in('category', categories)`, sementara `categories` ditebak dari kata-kata di **pertanyaan** lewat `MemoryService._inferCategories()`. Kategori memori sendiri ditetapkan saat **penyimpanan** — dua sumber yang tidak pernah dirancang sinkron. Akibatnya memori tak bisa dipanggil kembali kecuali Owner kebetulan memakai kata kunci pemicunya. Kasus nyata: "nama panggilan saya adalah pak slamet" tersimpan sebagai `preference`, tapi pertanyaan "siapa nama panggilan saya?" hanya menghasilkan `['general']` karena tidak memuat kata "suka"/"ingin"/"preferens".
    - **Hubungannya dengan Item 36:** ini **hulunya**. Memori tak terpanggil → Owner mengulang fakta yang sama → menumpuk jadi duplikat → duplikat memicu deteksi konflik salah tuduh → memori keluar dari status aktif. Semua perbaikan Item 36 benar dan tetap diperlukan, tapi semuanya menangani akibat; penyebabnya satu baris `WHERE`.
    - **Petunjuk yang terlewat:** log selalu menampilkan **tepat 3 kandidat** untuk pertanyaan apa pun — angka mati, bukan angka yang berubah sesuai relevansi. Itu ciri penyaring terlalu ketat, bukan ranking meleset.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09)** — Tahap 1 naik dari 3 ke **7 kandidat**, `[LiveThought]` mengirim 7 ID dan **7 cocok dengan simpul di graf**, dan Node Inspector menunjukkan memori nama panggilan berstatus *Aktif dalam Memori Jangka Panjang* dengan **"Dirujuk AI 1 kali"** (sebelumnya nol) — bukti bahwa memori itu benar-benar sampai ke model, bukan sekadar tampil di panel.
    - **Solusi:** filter kategori dihapus dari Tahap 1 dan `_inferCategories()` dihapus seluruhnya. Kolom `category` **tetap disimpan dan tetap ditampilkan** di panel Memory dan Node Inspector — yang dilepas hanya pemakaiannya sebagai penyaring saat pengambilan. Komentar panjang berisi kasus nyata "pak slamet" ditinggalkan di lokasi bekas filter agar tidak ada yang mengembalikannya karena mengira itu optimasi yang hilang.
    - **Kontrak Addendum Fase 1 tetap utuh:** `candidatePoolSize` (30) tetap membatasi kolam, `status = 'active'` dan `access_tier` tidak disentuh, relevansi diserahkan ke Tahap 2 (recency 0.4 + confidence 0.6).
    - **Catatan agar tidak salah baca nanti:** baris `Tier 1 Sufficiency score: 0.255 → switching to Tier 2` di log yang sama **bukan** kegagalan memori — skor itu menilai dokumen RAG `KnowledgeService`, jalur terpisah dari memori.
    - **Pelajaran:** hitungan yang tidak pernah berubah untuk masukan berbeda-beda hampir selalu berarti ada klausa `WHERE` terlalu ketat di hulu. Dan setiap sistem yang menuntut penggunanya menebak kata ajaib sedang memindahkan beban ke orang yang salah.

38. **Intent Router Diam-diam Mati Kalau Model Owner Bukan Gemini — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** `runCoordinatorLLM()` ([`llm_orchestrator.ts:297`](../../supabase/functions/agent-process/lib/llm_orchestrator.ts)) mematok `preferredProvider = 'gemini'` secara hardcoded, mengabaikan `rctx.model.provider`. Tapi **model** yang dikirim tetap `rctx.model.model` milik Owner. Hasilnya GeminiAdapter menerima model ID provider lain dan menembak `https://generativelanguage.googleapis.com/v1beta/models/deepseek%2Fdeepseek-v4-flash-0731:generateContent` — yang jelas **404**. Karena `callLLMWithCascade` dengan `preferredProvider` terisi menghasilkan `cascadeOrder = ['gemini']` saja (baris 80-87, komentarnya sendiri berbunyi *"Disable cascade - only use the provider selected by user"*), tidak ada fallback ke OpenRouter untuk jalur koordinator.
    - **Dampak nyata, terukur dari log produksi 2026-09-09 (14:57:17–14:57:23):** dua panggilan koordinator (`intent_router.ts:52` intent check, dan `:82` perencanaan) masing-masing membakar **9 request gagal** (3 API key × 3 percobaan) = **18 request 404 per pesan**, menghabiskan **±6,5 detik** sebelum panggilan utama akhirnya jalan lewat OpenRouter pada 14:57:23.939.
    - **Yang paling serius:** kegagalannya **ditelan diam-diam**. Log menunjukkan `Intent router error, mengabaikan intent check` dan `Coordinator LLM Error` — sistem lanjut seolah tidak terjadi apa-apa. Artinya **Intent Router praktis tidak pernah berfungsi** bagi Owner selama slot tier diisi model non-Gemini, dan tidak ada satu pun gejala yang terlihat di UI. Ini persis pola "satu bug menutupi bug lain" yang sudah dua kali ditemukan di Item 36 dan 37.
    - **Bagaimana ketahuan:** bukan dari investigasi khusus, melainkan dari `console.log` yang ditambahkan Item 35. Jalur ini sebelumnya bisu. Lihat [`2026-09-09-thinking-parameter-plumbing.md`](../project-memory/changelog/2026-09-09-thinking-parameter-plumbing.md) §7.
    - **Sudah diperbaiki sebagian (commit `32631da`):** hanya bagian milik Item 35 — `applyGeminiThinking()` kini menolak menyuntikkan `thinkingConfig` kalau nama model tidak mengandung "gemini". Ini menghentikan parameter khas Gemini masuk ke request non-Gemini, **tapi tidak menyentuh akar masalahnya**: request-nya sendiri tetap 404, tetap 18 kali, tetap ±6,5 detik.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `b5207e0` (akar pertama) + `ec27c52` (akar kedua), ter-deploy dengan drift `[MATCH]`. Bukti: `✅ GeminiAdapter succeeded` dan `completion=1t` — jawaban satu kata Intent Router, persis seperti dirancang. Dari 18 request 404 per pesan menjadi satu percobaan ulang.
    - **AKAR KEDUA yang baru ketahuan setelah akar pertama diperbaiki:** model cadangannya sendiri sudah mati. Google menjawab langsung: *"This model models/gemini-2.0-flash is no longer available"*, dan dokumentasi resmi mencantumkannya sebagai **"(Shut down)"**. Jadi perbaikan pertama benar tapi belum cukup — ia menghentikan model provider LAIN masuk ke GeminiAdapter, sementara defaultnya sendiri sudah pensiun.
    - **Model mati kedua yang ikut ketemu:** `google/gemini-2.0-flash-exp:free` sudah hilang dari katalog OpenRouter (diverifikasi langsung ke `openrouter.ai/api/v1/models`). Dipakai `tool_subscriber.ts` untuk **semua sub-agent** yang jatuh ke OpenRouterAdapter — jalur itu pasti gagal, dan kegagalannya ditelan `catch` yang cuma `console.warn`. Pola yang sama untuk ketiga kalinya.
    - **Perbaikan struktural, bukan tambal:** nilai default Gemini disentralkan jadi satu konstanta `DEFAULT_GEMINI_MODEL`, bukan lagi di-hardcode terpisah di jalur `execute()` dan `stream()`. Drift antara dua salinan itulah penyebabnya — migrasi berikutnya cukup satu baris.
    - **Visibilitas:** kedua `catch` di `intent_router.ts` kini mendorong peringatan ke `ctx.state.processingSteps` supaya kegagalan koordinator terlihat Owner di UI, bukan hanya di konsol server.
    - **Arah solusi (kalau nanti dikerjakan):** (a) `runCoordinatorLLM` menghormati `rctx.model.provider`, bukan mematok `'gemini'`; **atau** (b) kalau koordinator memang sengaja selalu Gemini demi hemat kuota, maka ia wajib memakai **model Gemini** juga (mis. `gemini-2.0-flash`), bukan model Owner — GeminiAdapter jalur `stream()` sudah melakukan ini (`.includes('gemini') ? … : 'gemini-2.0-flash'`) sedangkan jalur `execute()` tidak. Pilihan (b) tampak paling sesuai maksud aslinya. Sekalian: kegagalan koordinator jangan ditelan diam-diam — minimal satu peringatan yang terlihat, supaya cacat seperti ini tidak lagi berjalan bertahun-tahun tanpa gejala.

39. **Penjaga Dimensi Embedding Tertinggal di 768 — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** `rag/embedding.ts` mensyaratkan dimensi **tepat 768** (sisa era model embedding lama), sedangkan GeminiEmbeddingAdapter mengembalikan **3072**. Akibatnya `generateEmbedding()` **selalu** mengembalikan array kosong. Terbukti live 2026-09-09 03:12 & 03:33: `returned invalid dimension (expected 768, got 3072)` disusul `All embedding adapters failed. Errors:` — dengan daftar error yang **kosong**, artinya tidak ada fallback berbayar yang terjadi.
    - **Dampak:** bukan pemborosan biaya, melainkan **pencarian vektor mati diam-diam** di `context_builder.ts:104` dan pengindeksan dokumen di `knowledge_manager.ts:141`.
    - **Angka 3072 ditentukan skema, bukan sebaliknya:** `document_chunks.embedding` bertipe `vector(3072)` dan seluruh 512 chunk berdimensi 3072 (diverifikasi lewat `information_schema` + `vector_dims`).
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `82d8ed2`. Bukti: `✅ Embedding generated via GeminiEmbeddingAdapter (3072 dimensions)` tanpa peringatan `invalid dimension`.
    - **Catatan jujur:** fallback OpenAI sengaja dibiarkan tidak lolos penjaga — ia mematok `dimensions: 768`, dan lebih baik gagal jujur daripada menyimpan vektor berdimensi salah yang tetap akan ditolak Postgres. Praktisnya Gemini satu-satunya penyedia embedding yang layak sekarang, dan itu memang sejalan dengan tujuan hemat biaya Owner.
    - **Temuan sampingan:** dari 7 memori Owner, **nol punya embedding**. Pencarian memori berbasis makna belum pernah aktif — selama ini murni SQL. Itu menjelaskan kenapa deteksi kontradiksi tidak pernah bisa berbasis makna.

40. **Impor Rusak di `rag-process` — Ranjau yang Belum Meledak — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** `rag-process/index.ts` mengimpor `getGeminiEmbeddingWithRetry` dari `vector_utils.ts`, tapi fungsi itu **dihapus** commit `3176c6e` (2026-07-01, "vendor decoupling for llm and embeddings") tanpa memutakhirkan pemanggilnya.
    - **Kenapa belum meledak:** kebetulan waktu. Versi yang berjalan di produksi masih bundel **30 Juni 2026** — sehari sebelum commit perusak. Deploy ulang kapan pun akan membuat fungsinya gagal boot.
    - **Kehati-hatian yang perlu dicatat:** nol dokumen sejak Juli memang cocok dengan garis waktu ini, tapi itu **bukan bukti**. Owner mengonfirmasi ia memang belum mengunggah dokumen sejak era transisi (memakai mametlite untuk pencarian). Tanpa konfirmasi itu, korelasi tersebut mudah disalahartikan sebagai sebab-akibat.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `82d8ed2`, `rag-process` di-deploy ulang atas persetujuan Owner. Bukti: probe menghasilkan `HTTP 400` dengan pesan validasi milik fungsi itu sendiri, artinya ia berhasil boot dan impornya teratasi. Kalau masih rusak, responsnya `BOOT_ERROR`.
    - **Duplikasi yang disengaja:** idealnya `rag-process` memakai adapter seperti `agent-process`, sejalan maksud commit `3176c6e`. Tapi adapter menuntut RuntimeContext penuh yang tidak dibangun `rag-process`, dan merombaknya berarti mengubah jalur unggah dokumen yang tidak bisa diuji tanpa dokumen nyata. Memulihkan fungsi adalah perbaikan terkecil yang menutup ranjaunya.

41. **Circuit Breaker Memblokir Biaya yang Tidak Pernah Terjadi — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** `runtime_context.ts` memakai rantai substring tanpa urutan — `if (modelName.includes('gpt-4o'))`. String `openai/gpt-4o-mini` **mengandung** `gpt-4o`, jadi model termurah ditagih tarif model termahal. Aritmetikanya cocok persis: 335.485 token × $0,005/1K + 2.301 × $0,015/1K = **$1,7119**, sementara tagihan asli untuk model yang sama **$0,0606**. Tarif `gpt-4o` sendiri juga salah — $0,005/$0,015 padahal aslinya $0,0025/$0,01.
    - **Dampak nyatanya bukan sekadar angka salah:** `api_usage` dibaca RPC `check_daily_quota`, jadi inilah angka yang **memutus** Owner. Sepanjang 2026-09-09 Owner kena circuit breaker dan menaikkan batas hariannya $1 → $1,5 → $2 → $3, mengejar biaya yang tidak pernah ada. Saldo OpenRouter-nya sendiri tenang di $4,80, pemakaian asli hari itu ~$0,09.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `c1ce08b`. Rantai `if` diganti tabel `MODEL_PRICING` yang dicocokkan dari yang paling spesifik — `gpt-4o-mini` **wajib** sebelum `gpt-4o`. Seluruh angka diambil dari katalog resmi `openrouter.ai/api/v1/models`, tidak satu pun dari ingatan.
    - **Perbaikan data:** ke-26 baris `api_usage` hari itu dihitung ulang atas persetujuan Owner — $1,7158 → **$0,0618**, mengembalikan ruang dari $1,28 ke $2,94. Perhitungan deterministik dari `input_tokens`/`output_tokens` yang sudah tersimpan, bukan angka karangan. `usage.cost` asli tidak bisa diambil surut karena ID generasi tidak pernah disimpan.

42. **`usage.cost` — Menghapus Seluruh Kelas Kesalahan Biaya — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** ada **dua** sistem biaya, keduanya menebak, keduanya meleset ke arah berlawanan. `api_usage` memakai token tebakan (`panjang/4`) + tabel hardcoded → 19× terlalu mahal. `cost_ledger` memakai token asli + tabel DB `model_pricing` → lebih dekat, tapi tabel itu **tidak punya baris DeepSeek sama sekali** sehingga semua panggilan DeepSeek dihargai **nol**.
    - **Solusi dari pertanyaan Owner:** dokumentasi OpenRouter (usage-accounting, diverifikasi 2026-09-09) menyatakan `usage.cost` — biaya yang benar-benar ditagihkan — **selalu** disertakan di setiap respons: tanpa parameter tambahan, tanpa biaya ekstra, tanpa tambahan latensi. Parameter lama `usage: { include: true }` sudah usang dan tidak berpengaruh.
    - **Kenapa ini lebih dari sekadar perbaikan angka:** tidak ada lagi tabel tarif yang bisa basi dan tidak ada token yang perlu ditebak. Perbaikan Item 41 hanya memindahkan galat dari 19× terlalu mahal menjadi ~30% terlalu murah, karena **token reasoning ditagih tapi tidak pernah muncul di teks jawaban** — mustahil ditebak dari panjang. `reasoning_tokens` kini ikut tercatat di log.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `da75da3`. Bukti: `biaya=$0.00308745` untuk `prompt=20451t` gpt-4o-mini — 20451/1e6 × $0,15 = $0,00307. Cocok. Baris DeepSeek juga ditambahkan ke `model_pricing` agar jalur cadangan pun jujur.
    - **Cakupan sengaja dibatasi** jalur non-stream, karena `logApiUsage` memang sudah melewatkan request streaming (`isStream → return`) sehingga jalur itu tidak pernah ikut menentukan circuit breaker.

43. **Sistem Menghukum Model karena Mematuhi Perintahnya Sendiri — [`2026-09-09-kegagalan-yang-ditelan-diam-diam.md`](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md):**
    - **Isu:** tiga sumber saling bertentangan pada frasa yang persis sama. (1) `evidence_validator.ts` **memerintahkan** "Jawab dari pengetahuan umum" saat RAG & Memory kosong; (2) `CHECK_002B` di `verification_engine.ts` **memberi nilai** untuk frasa itu — ketiadaannya diberi status `WARN`; (3) `CHECK_007` di **berkas yang sama** **melarangnya** dengan `FAIL`, skor −50, dan blokir total. Satu respons bisa sekaligus lulus CHECK_002B dan gagal CHECK_007 karena kalimat yang sama.
    - **Dampak:** terbukti live 2026-09-09 15:46 — pertanyaan santai "apa game changer?" (`totalEvidence = 0`) dijawab dengan benar lalu diblokir. Owner tidak menerima jawaban apa pun, hanya "Verification Failed".
    - **Syarat yang hilang:** `universal_contract.ts:136` menuliskan aturan aslinya sebagai "Menyebut berdasarkan pengetahuan umum saya **di Engineer mode**". Aturan itu memang selalu bersyarat — CHECK_007 yang kehilangan syaratnya dan menerapkannya ke semua mode.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-09).** Commit `6fe1155`. Daftar larangan dipisah: sikap ragu-ragu dan bahasa robot **selalu** dilarang; frasa pengakuan pengetahuan umum dilarang **hanya bila evidence tersedia** — di situlah pelanggaran sesungguhnya, model mengabaikan sumber yang ada. Aturannya tidak dilemahkan: skenario "evidence 5 + disclaimer" tetap `FAIL`, kini dengan pesan yang menyebut berapa evidence diabaikan. Ditelusuri untuk empat skenario sebelum deploy.
    - **Belum dikerjakan, diserahkan ke Owner:** `synthesis_handler.ts:95` memetakan `ASSISTANT → ENGINEERING`, profil verifikasi paling ketat, untuk obrolan santai sekalipun — sementara Engineer mode justru punya penyesuaian ke PERSONAL untuk chat natural. Itu keputusan desain, bukan bug.

44. **Sisa Temuan Kecil yang Belum Dikerjakan (2026-09-09):**
    - **API key Gemini #0 menjawab 403.** Rotasi key menutupinya sehingga tidak mengganggu, tapi setiap panggilan koordinator menanggung satu percobaan gagal. Perlu dicek di Google AI Studio.
    - **`prompt=20451t` per pesan percakapan.** Besar. Belum diselidiki apakah wajar (konstitusi + RAG + memori ikut disuntikkan) atau ada yang berlebihan. Catatan: angka `prompt=1334t` yang sempat terlihat itu jalur LOOKUP, bukan pembanding yang setara.
    - **Pesan Owner terkirim dua kali ke prompt.** `history` sudah memuat pesan yang sedang dikirim (`ConversationEngine.jsx:726`), lalu `userMsg` dikirim lagi sebagai `message`. Diduga terkait satu kejadian AI menjawab pertanyaan sebelumnya; tidak terulang setelah Item 43 diperbaiki, tapi **hipotesisnya belum diuji langsung**.

---

## Audit Menyeluruh Kernel→UI (2026-09-10)

Sapuan sistematis memakai pola cacat Item 38–43 sebagai pemburu. Yang bersih juga
dicatat supaya tidak diaudit ulang: **seluruh 94 berkas `.ts` edge function
impornya teratasi** (kelas Item 40 tidak berulang), dan **biaya hari ini sudah
jujur** — `usage.cost` mengalir, 30 panggilan, $0,0659, nol baris berbiaya nol
(Item 41/42 terbukti bertahan).

45. **`match_memories` — Kebocoran Memori Lintas Pengguna (ranjau, urutan perbaikan menentukan):**
    - **Isu:** ada **dua** overload `match_memories`, keduanya `SECURITY DEFINER` (menembus RLS) dan keduanya di-`GRANT` ke peran `authenticated`. Yang 3-argumen **tidak punya filter user sama sekali** — ia memindai seluruh `user_memories` milik semua akun. Yang 4-argumen memfilter `target_user_id`, tapi **tidak ada guard `auth.uid()`**, jadi penyerang cukup menyodorkan UUID korban. Bandingkan dengan `check_daily_quota` dan `get_active_knowledge` di database yang sama: keduanya punya guard `auth.role()/auth.uid()` eksplisit. Perbaikannya dulu **ditambahkan di sebelah lubangnya, bukan menggantikannya** — overload lama tidak pernah di-`DROP`.
    - **Ini bukan lubang teoretis:** `request_pipeline.ts:213` — jalur produksi setiap pesan — memanggil **versi 3-argumen** dengan klien service-role. Hasil teratas disuntikkan ke `parsed.globalMemory`, langsung masuk prompt. Ada 3 akun di `auth.users`, dan pengguna mametlite eksternal memakai key sistem Owner.
    - **Kenapa belum meledak:** ketujuh baris `user_memories` embedding-nya `NULL`, jadi klausa `WHERE` tak pernah menghasilkan baris. Diverifikasi: RPC dipanggil dengan vektor 3072 mengembalikan `[]` tanpa error.
    - **⚠️ Urutan perbaikan kritis:** memperbaiki Item 46 **mempersenjatai** cacat ini. Begitu embedding mulai terisi, kebocoran menjadi nyata. **Item 45 wajib ditutup lebih dulu.**
    - **Status:** ✅ **Selesai & Diverifikasi (2026-09-10).** Commit `2043814` + migrasi `20260910000750` dan `20260910001046`.
    - **Urutan langkah dipilih agar produksi tidak pernah putus:** (1) pasang guard di overload 4-argumen selagi belum ada pemanggilnya — nol risiko; (2) pindahkan `request_pipeline.ts` ke overload itu, deploy, buktikan `[MATCH]`; (3) baru `DROP` overload 3-argumen. Membalik urutan ini akan mematikan jalur RAG sebelum kodenya sempat pindah.
    - **Bukti, tiga arah:** uji negatif — user login menyodorkan UUID orang lain ditolak `P0001: Unauthorized: access denied to other users memories`; uji positif — user yang sama menyebut dirinya sendiri lolos tanpa exception (0 baris, wajar karena embedding masih NULL); inventaris — kini **hanya satu** `match_memories` tersisa, ber-guard.
    - **Gagal ke arah tertutup:** saat `userId` tidak tersedia, pencarian dilewati sepenuhnya, bukan dijalankan tanpa filter. Tanpa identitas pemilik, satu-satunya pencarian yang mungkin adalah pencarian lintas pengguna.
    - **Yang membuatnya bisa terulang:** perbaikan 20260902103500 menambahkan versi aman **di sebelah** versi berbahaya tanpa menghapus yang lama. `CREATE OR REPLACE` tidak menimpa fungsi dengan tanda tangan berbeda — ia membuat overload baru. Setiap perbaikan fungsi Postgres yang mengubah daftar parameter harus disertai `DROP` eksplisit terhadap tanda tangan lamanya.

46. **Skema `user_memories.embedding` Masih Tertinggal di 768 — Pencarian Memori Semantik Belum Pernah Bisa Hidup:**
    - **Isu:** `user_memories.embedding` bertipe **`vector(768)`**, sedangkan pipeline embedding kini menghasilkan **3072** (lihat Item 39, dan `document_chunks` sudah `vector(3072)`). Dibuktikan langsung di database: `SELECT vector(768) <=> vector(3072)` → `ERROR: different vector dimensions 768 and 3072`.
    - **Cacat kedua yang menutupi cacat pertama:** `memory_manager_v1.ts:36` menuliskan **`embedding: null`** secara hardcoded di satu-satunya jalur insert memori. Jadi tidak ada apa pun di sistem ini yang pernah menulis embedding memori. Ketujuh baris `NULL` itu bukan kebetulan — itu perilaku yang dikodekan.
    - **Akibatnya:** `match_memories` mustahil menghasilkan apa pun, dan kegagalannya ditelan `if (error) console.error` lalu pipeline lanjut dengan "Tidak ada memori yang relevan." Ini melengkapi temuan sampingan Item 39.
    - **Status:** ✅ **SELESAI (2026-09-10) — ditutup oleh Item 54.** Commit `bb6cf1f`, `ddac369`, migrasi `20260910003000`, lalu Item 54 menutup sisa pekerjaannya. Pencarian memori semantik kini **hidup dan terbukti**: `match_memories` mengembalikan 0,7263 untuk "teh" terhadap kueri "kopi". Catatan di bawah dipertahankan apa adanya sebagai rekaman bagaimana temuannya berkembang.
    - **Sudah live dan terverifikasi:** kolom kini `vector(3072)`; indeks ivfflat dibuang karena pgvector membatasi indeks di 2000 dimensi sehingga 3072 memang tak bisa diindeks (`document_chunks` sudah berjalan begitu sejak dulu); view `active_user_memories` dipulihkan lengkap dengan `security_invoker=on` dan hak aksesnya (diverifikasi ulang sesudahnya, 7 baris lewat view = 7 baris tabel).
    - **Penjaga 768 KEDUA yang luput dari Item 39:** `knowledge_manager.ts:142` menyimpan angka 768 terpisah dari `rag/embedding.ts`. Setelah adapter beralih ke 3072, syarat `length === 768` tidak pernah terpenuhi lagi — **tidak satu pun chunk tersimpan**, sementara user diberi tahu "Berhasil menyimpan informasi ke workspace (0 chunks vektor)". Kini `EMBEDDING_DIMENSIONS` diekspor dari satu sumber, nol chunk dilaporkan sebagai gagal, dan sebagian tersimpan dilaporkan berikut sebabnya.
    - **Sisa pekerjaan — jalur penulisan yang sebenarnya belum tersentuh:** `saveFactDirectly` sudah menulis embedding (rctx dialirkan dari `memory_subscriber`), tapi **bukan itu jalur yang dipakai Owner**. Kedelapan baris `user_memories` di produksi bersumber `MemoryGovernorService` — kode **frontend** — dan jalur edge belum pernah menulis satu baris pun. Dibuktikan 2026-09-10 00:37: Owner menyimpan memori baru, `RequestClassifier` menangkapnya sebagai `MEMORY_STORE` dan menyelesaikannya di klien; log `agent-process` pada menit itu hanya berisi `booted`/`shutdown`, tanpa satu pun baris aplikasi. Memori barunya tetap ber-`embedding` NULL.
    - **Catatan jujur soal cara temuan ini muncul:** saya menelusuri siapa yang *memanggil* `saveFactDirectly`, bukan siapa yang benar-benar *menghasilkan baris* di produksi. Kolom `source` sudah menjawabnya sejak awal dan tidak saya baca. Memetakan pemanggil di kode tidak sama dengan memetakan jalur yang hidup — tanyakan dulu pada datanya.
    - **Keputusan Owner (2026-09-10):** ditunda, dicatat sebagai temuan. Pilihan yang tersisa saat dikerjakan nanti: (a) endpoint kecil di `agent-process` yang mengisi embedding — kunci tetap di server, memakai kaskade adapter, sejalan dengan maksud `3176c6e`; atau (b) `MemoryGovernorService` memanggil API embedding langsung dari klien — lebih cepat tapi menduplikasi logika provider di frontend, persis pola yang dulu sengaja dihapus.
    - **Tidak ada yang mundur untuk sementara:** pencarian memori berbasis SQL tetap bekerja seperti biasa (Tahap 1, lihat Item 36), jadi memori tetap ditemukan — hanya belum berbasis makna.
    - **Backfill:** ke-8 memori lama akan tetap ber-`embedding` NULL bahkan setelah sisa pekerjaan di atas selesai. Perlu satu kali pengisian ulang, diperlakukan sebagai pekerjaan terpisah.

47. **Circuit Breaker Gagal-Terbuka — Perlindungan Dompet Menguap Saat Ada Gangguan:**
    - **Isu:** `quota_middleware.ts` — `catch (quotaCheckError) { console.error("Quota check failed, bypassing...") }` lalu `return null`, artinya permintaan **diteruskan**. Kodenya jujur menyebut dirinya *bypassing*. Cacat kedua di berkas yang sama: penjagaan dibungkus `if (!quotaError && currentCost !== null)` — kalau RPC mengembalikan error, seluruh pemeriksaan **dilewati diam-diam** tanpa satu pun log peringatan.
    - **Kenapa ini penting sekarang:** inilah satu-satunya kontrol yang melindungi saldo Owner, dan pengguna mametlite tanpa BYOK membelanjakan key Owner. Sepanjang 2026-09-09 Owner menaikkan batasnya $1→$3 dengan asumsi kontrol ini bekerja. Satu gangguan sesaat di database membuatnya tidak bekerja, tanpa jejak yang bisa dilihat.
    - **Yang sudah benar dan jangan diubah:** `resolveDailyLimit` gagal ke arah **ketat** (`FALLBACK_DAILY_LIMIT = 1`). Pola itu yang seharusnya dipakai juga di `checkQuota`.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Commit `0972714`, deploy `[MATCH]`.
    - **Kini gagal-TERTUTUP:** kalau kuota tidak bisa dipastikan — RPC error, mengembalikan null, atau melempar exception — permintaan ditolak. Ini menukar ketersediaan dengan keamanan biaya secara sengaja, mengikuti preseden yang sudah ada di berkas yang sama: `resolveDailyLimit` jatuh ke batas paling ketat ($1) saat plafon sistem tak terbaca.
    - **Diperiksa dulu sebelum dipasang, karena taruhannya seluruh chat:** `check_daily_quota` dipastikan sehat lewat peran yang benar-benar dipakai middleware — klaim JWT `role=service_role`, bukan `SET ROLE` Postgres. Percobaan pertama saya memakai `SET LOCAL ROLE service_role` dan **ditolak**, karena `auth.role()` membaca klaim JWT, bukan peran database. Alat ujinya yang salah, bukan fungsinya.
    - **Bukti live:** log `00:50:20` menunjukkan `[QUOTA] Batas harian efektif user ...: $3 (pribadi: 3, plafon sistem: $3)`, lalu permintaan lanjut normal dan biaya tercatat `$0.00035415`. Baris itulah buktinya — di kode baru ia **hanya bisa tercapai** setelah penjagaan eksplisit lolos. Tidak ada `⛔ DITOLAK` maupun `[PENGAMAN BIAYA AKTIF]`.
    - **Pesan penolakan dibedakan:** "jatah habis" vs "pemeriksaan rusak" menuntut tindakan berbeda dari Owner, dan sebelumnya keadaan kedua tidak punya pesan sama sekali — ia justru diam-diam meloloskan permintaan. Pembangunan respons stream/non-stream disatukan agar jenis penolakan baru tidak perlu disalin tangan lagi.

48. **Instrumentasi Sistem Ini Terputus dari Sistemnya — Enam Dasbor Yatim (~1.200 baris):**
    - **Isu:** enam komponen React hanya mendefinisikan dirinya sendiri dan **tidak pernah diimpor atau dipasang** di mana pun (diverifikasi dua arah: penelusuran impor relatif **dan** pencarian nama). `BillingDashboard.jsx` (153), `MemoryHealthDashboard.jsx` (182), `MonitoringDashboard.jsx` (317), `ObservabilityDashboard.jsx` (210), `EngineerDashboard.jsx` (278), `WorkDashboard.jsx` (133), plus `ShopeeDashboard.jsx` (250) dan `Login.jsx` (153).
    - **Kenapa ini temuan paling menjelaskan:** `BillingDashboard.jsx:17` adalah **satu-satunya** pemanggil `check_daily_quota` di seluruh frontend. Selama ini Owner tidak punya layar yang menampilkan belanja hariannya — itulah sebabnya Item 41 bisa berlangsung sepanjang hari sambil menaikkan plafon mengejar biaya yang tidak pernah ada. `MemoryHealthDashboard` akan memperlihatkan nol embedding (Item 46) sejak lama.
    - **Benang merah keseluruhan:** enam cacat kemarin dan enam temuan hari ini bertahan diam bukan karena sulit dideteksi, melainkan karena **alat pantaunya sudah ditulis tetapi tidak pernah disambungkan**.
    - **Status:** ⚠️ **Sebagian selesai (2026-09-10).** `BillingDashboard` terpasang dan terverifikasi live — commit `119bd09`. Lima komponen yatim lainnya masih menunggu keputusan Owner.
    - **Memasangnya saja tidak cukup — angkanya juga basi.** `DAILY_LIMIT` di-hardcode `0.50`, sementara batas nyata Owner $3. Kalau dipasang apa adanya, layar ini menyalakan "CIRCUIT BREAKER AKTIF" pada $0,50 padahal server masih meloloskan permintaan. Layar yang memantau pengaman **tidak boleh memakai angkanya sendiri** — itu persis situasi kemarin: Owner mengejar biaya sambil membaca instrumen yang berbohong. Rumusnya kini identik dengan `resolveDailyLimit` di server, dan **kedua** batas ditampilkan (pribadi + plafon sistem), karena saat kena breaker pertanyaan pertama Owner adalah "batas yang mana?".
    - **Cacat kedua yang membuatnya mustahil tampil:** komponennya menunggu prop `user` yang tidak pernah diteruskan Kernel. Aplikasi lain di sistem ini (`MemoryApp`, `Settings`) mengambil sesinya sendiri lewat `supabase.auth.getSession()`; `BillingDashboard` kini mengikuti pola itu.
    - **Didaftarkan lewat metadata**, bukan hardcode: `AppRegistry.js` → `system.json` → `navigation.json`, masuk grup System Observability.
    - **Bukti live:** dasbor menampilkan `$0.0009 / $3.00`, `Pribadi: $3 · Plafon sistem: $3`, dan 4 baris transaksi. **Pada tayangan pertamanya ia langsung memperlihatkan cacat lain** — baris `provider: Gemini` dengan `model: deepseek/deepseek-v4-flash-0731`, yang mustahil. Ini pembenaran paling langsung untuk item ini: instrumen yang tersambung menemukan hal yang tidak terlihat selama berbulan-bulan.
    - **Sisa yang belum dikerjakan:** `MemoryHealthDashboard`, `MonitoringDashboard`, `ObservabilityDashboard`, `EngineerDashboard`, `WorkDashboard`, plus `ShopeeDashboard` dan `Login` yang mungkin memang peninggalan. Perlu keputusan Owner per komponen: pasang, atau hapus. **Jangan diasumsikan semuanya layak dipasang** — `BillingDashboard` membuktikan bahwa memasang layar berisi angka basi hanya menambah instrumen yang berbohong.

49. **Ranjau di Kode Mati — Aman Sekarang, Merusak Kalau Disambungkan:**
    - **`self_healing.ts` (tanpa importer):** `const similarity = (memA.embedding && memB.embedding) ? cosineSimilarity(...) : 0.85` — nilai cadangannya **gagal ke arah "sangat mirip"**. Karena embedding memori selalu `null` (Item 46), `similarity` akan **selalu** 0.85, dan `0.85 > 0.75` **selalu** benar. Setiap pasang dari 20 memori terakhir akan dinilai LLM, lalu bisa ditandai `CONFLICTED` atau di-`OBSOLETE`/`is_deprecated: true` — **destruktif**. Nilai cadangan yang aman adalah 0 (lewati), bukan 0,85. Bonus: memakai model Groq `llama3-8b-8192` yang sudah dipensiunkan.
    - **`/api/agent/process` di `backend/server.js` (tanpa pemanggil di frontend maupun mametlite):** memetakan ke `google/gemini-2.0-flash-exp:free` yang sudah hilang dari katalog OpenRouter, dan mengabaikan model pilihan user — semua `openrouter-*` jatuh ke `meta-llama/llama-3.1-8b-instruct`.
    - **Koreksi terhadap dugaan awal saya:** saya sempat menduga rute ini dipakai Engineer untuk membuat patch. **Salah.** `BrainService.executeLLM` memanggil `/api/chat`, dan rute itu **bersih** — menghormati provider, model, dan key user, serta menolak provider tak dikenal secara eksplisit. Dugaan itu saya batalkan sebelum sempat jadi klaim.
    - **Status:** ⚠️ **Sebagian.** `self_healing.ts` dihapus Owner (commit `c902361`, 2026-09-10) — diperiksa 2026-09-11: tidak ada rujukan tersisa di kode. Rute `/api/agent/process` di `backend/server.js` belum dikerjakan; kode mati, tidak mendesak, tapi akan menggigit kalau disambungkan tanpa dibaca ulang.

50. **Sisa Temuan Kecil (2026-09-10):**
    - **Atribusi model salah di `api_usage` — mekanismenya kini terbukti penuh (2026-09-10).** Setiap pesan menghasilkan **dua** baris: satu dari Intent Router lewat GeminiAdapter, satu dari jawaban utama lewat OpenRouter. Baris pertama tercatat `provider: Gemini` dengan `model: deepseek/deepseek-v4-flash-0731` — kombinasi yang mustahil, dan terlihat mata telanjang begitu `BillingDashboard` dipasang. Rantai lognya lengkap: `[Cascade] "deepseek/..." bukan model Gemini — GeminiAdapter memakai model bawaannya` → `Gemini non-stream (gemini-2.5-flash): prompt=157t completion=4t` → `✅ GeminiAdapter succeeded`. Jadi adapter benar memakai `gemini-2.5-flash`; yang salah `logApiUsage`, yang mencatat `rctx.model.model` alih-alih model yang benar-benar dipakai adapter.
      - **Tokennya juga tebakan, bukan angka asli.** Baris Gemini tercatat 138/3 sementara log sebenarnya 157/4 — jalur non-OpenRouter masih menebak dari panjang teks (`panjang/4`). Sesuai batasan cakupan Item 42 yang memang hanya menutup jalur `usage.cost` OpenRouter. Biaya salahnya kecil (~$0,00001/pesan), tapi ia mengotori analitik dan akan jadi tarif yang salah kalau kelak dipakai model Gemini berbayar.
      - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Commit `873bfb2`. `AdapterResult` kini membawa `modelUsed`, diisi keempat adapter dari variabel model yang benar-benar dikirim ke provider. Bukti: baris pukul 01:40:10 tercatat `provider gemini | model gemini-2.5-flash`, sementara baris 00:58:57 dan 00:50:23 masih `deepseek/...` — pencatatan hanya berlaku maju, jadi perbedaan itu sendiri yang membuktikannya.
      - **Bukan sekadar label:** kalau provider tidak melaporkan `usage.cost`, `logApiUsage` mencocokkan nama model ke tabel tarif — nama salah berarti tarif salah, kelas kesalahan yang sama persis dengan Item 41. Terlihat di angkanya: baris Gemini bergerak $0,000010 → $0,000014 karena kini jatuh ke FALLBACK_PRICING alih-alih salah dicocokkan sebagai DeepSeek.
    - **Rasio prompt:output 136:1 — Item 44 kini terukur.** Hari ini: **352.972** token masuk vs **2.596** token keluar untuk 23 panggilan `gpt-4o-mini`, rata-rata **~15.300 token prompt per panggilan**. Jadi `prompt=20451t` bukan kejadian tunggal melainkan pola sistemik, dan **99,3% belanja Owner adalah prompt**. Di sinilah penghematan terbesar berada, bukan di pemilihan model.
      - **Nuansa yang mempersempit dugaan (2026-09-10):** satu permintaan percakapan biasa hari ini hanya `prompt=1639t` — jauh di bawah rata-rata kemarin. Jadi pembengkakan itu **tidak konstan di setiap permintaan**; ada sesuatu yang spesifik menggelembungkannya. Bedanya mencolok: permintaan hari ini punya RAG kosong (`ragArray size=0`) dan kedua blok KNOWLEDGE kosong. Dugaan yang lebih tajam sekarang: penyuntikan RAG/knowledge-lah yang membawa beban itu, bukan konstitusi. Belum diuji langsung — jangan diperlakukan sebagai kesimpulan.
      - **→ Diselesaikan di Item 65 (Kasus A) dan Item 66 (prompt sistem dobel, −50%). Pesan terkirim dua kali: terkonfirmasi, efeknya kecil.**
      - **→ Mekanismenya terlihat di Item 64 (2026-09-11):** `RetrievalStrategyService` Kasus A menyuntikkan **seluruh** potongan dokumen yang judulnya cocok — satu pertanyaan tentang HCDP menghabiskan 76.895 token masuk. Terbukti untuk permintaan itu; hari-hari sebelumnya belum dicocokkan.
    - **`match_documents` di-`GRANT` ke `anon`.** Risikonya rendah karena ia `SECURITY INVOKER` sehingga RLS tetap berlaku, tapi hak itu tampaknya tidak disengaja.
    - **Higiene yang sudah baik dan layak dipertahankan:** dari 10 fungsi `SECURITY DEFINER`, hanya 4 yang terbuka ke `authenticated`; sisanya service-role saja.

51. **Kepemilikan Pemakaian & Kesehatan API Key — BYOK Wajib (2026-09-10):**
    - **Berawal dari pertanyaan sederhana Owner:** "apakah dari via OpenRouter tidak bisa embed?" Jawaban dari ingatan saya waktu itu **salah** — saya menduga OpenRouter tidak punya endpoint embedding. Setelah dicek ke sumbernya, ternyata ada: `POST /api/v1/embeddings`, dengan Gemini Embedding 2 tersedia seharga $0,20/1M token (dimensi 128–3.072), dan alternatif jauh lebih murah seperti Qwen3 Embedding 8B ($0,01) dan Perplexity Embed V1 ($0,004). Pelajaran yang sama dengan Item 41: **jangan menjawab soal katalog penyedia dari ingatan.**
    - **Ujinya membongkar hal lain:** probe embedding memakai key sistem menjawab **401 "User not found"** untuk semua model. Key OpenRouter di Supabase sudah mati. Chat Owner tetap jalan karena memakai key sendiri dari VaultService — key sistem hanya cadangan, dan Owner tak pernah menyentuhnya.
    - **Dampaknya berat dan tak terlihat:** `request_pipeline.ts` memaksa pengguna **tanpa** key sendiri memakai key sistem itu (`finalProvider = providerApiKey ? provider : 'openrouter'`). Kaskade pun sengaja dimatikan (`cascadeOrder = [preferredProvider]`), jadi tidak ada penyelamat. Artinya setiap pengguna mametlite tanpa BYOK **tertutup total** — 401 mentah, bukan penjelasan. Owner tidak pernah melihatnya karena selalu punya key sendiri.
    - **Alat diagnosisnya sendiri ikut menutupi:** `check-keys` menguji Gemini dan Groq dengan panggilan nyata, tapi OpenRouter dan OpenAI hanya `!!key` — memeriksa **keberadaan**, bukan **keabsahan**. Jadi alat yang dibuat khusus untuk mendeteksi key bermasalah melaporkan `openrouter_key_exists: true` untuk key yang mati. Pola yang sama untuk kesekian kalinya: pemeriksaan yang melapor sukses tanpa benar-benar memeriksa.
    - **Keputusan Owner (2026-09-10): BYOK wajib.** "Tanpa key tidak akan bisa — sehingga ada pertanggungjawabannya." Cadangan ke key sistem dihapus untuk provider chat. Ini menggeneralisasi penjagaan yang sudah lebih dulu ada untuk mode ENGINEER (2026-07-30), bukan pola baru; penjagaan ENGINEER dipertahankan utuh dan gerbang umum ditaruh sesudahnya agar mode itu tetap memberi pesan spesifiknya. Pesan penolakan menjelaskan sebab **dan** jalan keluarnya, serta bahwa key disimpan di perangkat pengguna.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Commit `1bf4403` (gerbang) dan `0df6490` (check-keys). Bukti: `[RequestPipeline] Provider: openrouter, Key source: BYOK header` diikuti jawaban HTTP 200 normal — Owner tidak terkunci. Diperiksa dulu sebelum deploy bahwa `AssistantService.buildHeaders` memang mengirim `x-byok-*`, karena kesalahan di sini akan mengunci Owner dari aplikasinya sendiri.
    - **Koreksi yang saya buat sendiri di tengah jalan:** sempat saya nyatakan `frontend/src` tidak mengirim header `x-byok`. Itu keliru — hasil grep saya terpotong di batas 20 baris dan saya membaca ketiadaan dari daftar yang terpangkas. Diperiksa ulang sebelum deploy, bukan sesudah.
    - **Key sistem Gemini sengaja TIDAK ikut dihapus.** Owner sempat ingin membuangnya sebagai peninggalan era "AI Agent", tapi `GeminiEmbeddingAdapter.initialize()` bergantung padanya dan satu-satunya cadangan (`OpenAIEmbeddingAdapter`) butuh `OPENAI_API_KEY` yang tidak ada. Menghapusnya berarti sistem ini tidak punya adapter embedding sama sekali: pencarian RAG mati, unggah dokumen 0 chunk, `rag-process` mati, dan Item 46 mustahil diteruskan. Key itu melayani fungsi internal, bukan chat orang lain.
    - **Sisa temuan yang belum dikerjakan:**
      - **Gemini: 2 dari 3 key mati.** `check-keys` melaporkan key #0 dan #2 menjawab 403, hanya #1 yang hidup. Setiap panggilan mencoba #0 dulu — itu sumber jeda ~0,5 detik per pesan (Item 44). Nilai secret tidak bisa dibaca dari dashboard (hanya digest), jadi perbaikan termudah adalah membuat key AI Studio baru dan menimpa seluruh nilainya.
      - **Groq menjawab 404.** Bukan kegagalan otentikasi — key salah menghasilkan 401. 404 berarti model tidak dikenal, jadi `llama-3.1-8b-instant` kemungkinan sudah dipensiunkan Groq. Kalau benar, ini **provider ketiga** yang jatuh pada pola Item 38, dan model itu dipakai di lima tempat (`GroqAdapter`, `tool_subscriber`, `knowledge_quality_filter`, `context_compressor`). ✅ **TERBUKTI dan sudah diperbaiki — lihat Item 53 (2026-09-10).** Key Groq ternyata sehat; yang mati modelnya, dipensiunkan 16 Agustus 2026.
      - **Uji dimensi embedding OpenRouter belum terjawab.** Key sistem mati dan key Owner ada di UI, jadi probe sisi server tidak bisa memakainya. Kalau kelak embedding dipindah ke OpenRouter, dimensinya **wajib diuji lebih dulu** — skema kita mematok `vector(3072)` dan dokumentasi OpenRouter tidak menyebut parameter `dimensions` sama sekali.

52. **Jalur Upload RAG Research App Tak Pernah Memvektorkan — dan Satu Policy RLS `USING (true)` (2026-09-10):**
    - **Berawal dari pertanyaan Owner:** "apakah jalur upload RAG yang benar?" sambil menunjukkan Research App di desktop. Jawabannya bukan.
    - **Ada dua jalur upload, hanya satu yang benar.** mametlite (`mametlite/src/App.jsx:217`) memanggil edge function `rag-process`. Research App (`frontend/src/components/research/ResearchApp.jsx:74`) tidak pernah menyentuhnya sama sekali — ia menulis langsung ke `documents` dan `document_chunks` dari sisi klien.
    - **Tiga cacat dalam lima baris, semuanya diam:**
      - **Tanpa embedding.** Kolom `document_chunks.embedding` nullable, jadi Postgres menerima tanpa protes. Dokumen muncul di daftar, terlihat berhasil, tapi tidak akan pernah ditemukan pencarian RAG. Hantu: terlihat, tak berguna.
      - **`text.substring(0, 5000)`.** Sisa dokumen dibuang tanpa pemberitahuan. Untuk berkas uji hari ini (11.487 karakter), kode lama akan membuang 6.487 karakter — 56% isinya.
      - **`space_id` di-hardcode** ke `58dba6bd-…`, yaitu workspace "Observasi Pasar" milik akun Owner. Untuk Owner kebetulan cocok sehingga tak pernah terasa; untuk pengguna lain, dokumennya tercatat atas nama mereka sendiri tapi mendarat di workspace Owner. RLS tidak menangkapnya karena ia memeriksa `user_id`, bukan `space_id`.
    - **Datanya yang membuktikan, bukan pembacaan kode.** Dari 512 chunk di produksi, **512 punya embedding — nol kosong**. Kalau tombol itu pernah berhasil sekali saja, pasti ada baris tanpa vektor. Ditambah dokumen terbaru di seluruh basis data bertanggal **24 Juni 2026**. Research App selama ini hanya pembaca data yang ditulis jalur benar; tombol unggahnya ranjau yang belum terinjak. Ini penerapan pelajaran Item 46: sebelum memperbaiki jalur tulis, tanyakan dulu pada datanya siapa yang benar-benar menghasilkan baris di produksi.
    - **Temuan sampingan yang lebih serius — kebocoran metadata lintas pengguna.** Tabel `documents` punya policy `"Allow all read on documents"` dengan `USING (true)`. Di Postgres beberapa policy permissive untuk perintah yang sama digabung dengan **OR**, jadi satu policy longgar melumpuhkan dua policy ketat (`auth.uid() = user_id`) yang berdampingan dengannya. Akibatnya setiap pengguna terautentikasi bisa membaca daftar seluruh dokumen semua orang: judul berkas dan `user_id` pemiliknya. Isinya tidak ikut bocor karena `document_chunks` memeriksa kepemilikan dengan benar lewat EXISTS. Yang bocor metadatanya — dan di sistem ini judul berkas bersifat mengungkap (contoh nyata: `RSUD.txt`, `KELURAHAN SEKARJAYA.txt` milik akun lain).
      - **Pelajaran umum:** policy RLS longgar tidak pernah "tidak berbahaya karena ada policy ketat lainnya". Justru sebaliknya — ia membuat policy ketat jadi hiasan. Saat mengaudit RLS, yang dicari bukan keberadaan policy yang benar, melainkan **ketiadaan policy yang salah**.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Migrasi `20260910120000_drop_allow_all_read_on_documents.sql`. Dua policy yang benar sengaja dibiarkan utuh, jadi tidak ada perubahan yang dirasakan pengguna. Bukti sesudah `db push`: `pg_policies` untuk `documents` cmd SELECT tinggal dua baris, keduanya `auth.uid() = user_id`.
    - **Bukti dua ujung untuk perbaikan unggahnya.** Garis dasar dicatat lebih dulu: 45 dokumen, 512 chunk, 512 bervektor, dokumen terbaru 24 Juni 2026. Sesudah unggah satu berkas 11.487 karakter lewat Research App:
      - Ujung klien: `[ResearchApp] ✅ …: Berhasil memproses 3 dari 3 blok teks.`
      - Ujung basis data: 3 chunk, **3 bervektor**, `vector_dims` **3072** min dan max, **11.452** karakter tersimpan (35 hilang karena `trim` di batas potongan, bukan isi), `source_type: user_upload`, `retrieved_at` terisi.
      - **Space tujuannya `My Core Knowledge (CORE)`**, padahal klien tidak mengirim `spaceId`. Server yang menentukannya dari `user_id` — ini yang membuktikan cacat hardcode benar-benar mati, bukan sekadar tak terpakai.
      - Total menjadi 46 dokumen, 515 chunk, **nol tanpa vektor**.
    - **Tambahan yang ikut dipasang:** `if (data?.error) throw` — `rag-process` menjawab HTTP 500 berisi `{ error }` untuk kegagalan vektorisasi dan `supabase-js` tidak selalu melemparnya, jadi tanpa baris ini kegagalan vektorisasi akan tampak seperti sukses. Persis penyakit yang sedang diobati. Juga `x-byok-gemini` dari VaultService bila Owner punya key sendiri (konsisten Item 51), dan `e.target.value = ''` agar berkas yang sama bisa diunggah ulang.

53. **Groq 404 Terbukti: Provider Ketiga yang Modelnya Dipensiunkan Diam-Diam (2026-09-10):**
    - **Menutup satu sisa Item 51 yang berstatus "belum dipastikan".** Di sana tertulis dugaan bahwa `llama-3.1-8b-instant` sudah dipensiunkan Groq, tapi sengaja tidak diklaim karena belum diuji. Kini terbukti.
    - **Bukti dari server, bukan dari dokumentasi maupun ingatan.** `check-keys` ditambahi `GET https://api.groq.com/openai/v1/models` memakai key sistem. Hasilnya: status **200** — jadi key-nya **sehat**, yang selama ini keliru dicurigai — dan daftar 14 model yang dikembalikan **tidak memuat satu pun** dari tiga model yang dirujuk kode kita. Pesan Groq sendiri: `The model 'llama-3.1-8b-instant' does not exist or you do not have access to it.` Halaman deprecations Groq mencocokkan: `llama-3.1-8b-instant` dan `llama-3.3-70b-versatile` diumumkan 17 Juni 2026, dimatikan **16 Agustus 2026**.
    - **Kenapa 404 dan bukan 401 itu penting.** Key yang salah menghasilkan 401. 404 berarti key diterima tapi modelnya tak dikenal. Perbedaan satu digit itu yang memisahkan "key Groq bermasalah" dari "model Groq sudah tidak ada" — dan menuduh key adalah kesimpulan yang salah.
    - **Ini provider KETIGA yang jatuh pada pola Item 38**, setelah Gemini dan DeepSeek. Polanya sama persis: penyedia memensiunkan model, kode terus memanggil nama lama, dan kegagalannya tertelan `catch` sehingga tidak ada yang tahu. Tiga kali dalam pola yang sama membuat ini bukan kebetulan melainkan **celah pemeliharaan**: tidak ada mekanisme apa pun di sistem ini yang memberi tahu ketika model yang dipakai menghilang. `check-keys` kini menjadi mekanisme itu untuk Groq — ia mencocokkan model yang dirujuk kode terhadap daftar hidup dari server.
    - **Penggantinya diambil dari rekomendasi resmi Groq dan dipastikan ada di daftar server:**

      | Lama (mati 16 Agu 2026) | Baru | Dipakai di |
      |---|---|---|
      | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | `ai_adapter` (execute + stream), `tool_subscriber` (2×), `knowledge_quality_filter`, `context_compressor` |
      | `llama-3.3-70b-versatile` | `openai/gpt-oss-120b` | `backend/server.js` (kode mati) |
      | `llama3-8b-8192` | `openai/gpt-oss-20b` | `self_healing.ts` (kode mati, Item 49) |

      Alias `groq-llama-3.3` dan `groq-llama-3.1` **sengaja dipertahankan** agar preferensi model yang sudah tersimpan di `user_metadata` tidak mendadak tak dikenali; yang berubah hanya model yang ditunjuknya.
    - **Tarif ikut ditambahkan, dan itu bukan pelengkap.** Tabel `MODEL_PRICING` punya baris `{ match: 'llama' }`. Begitu nama modelnya berganti ke `gpt-oss`, baris itu tak lagi cocok dan biaya Groq jatuh ke `FALLBACK_PRICING` — kelas kesalahan yang sama persis dengan Item 41 dan 42. Dua baris baru ditambahkan dengan angka dari halaman model GroqCloud (bukan dari ingatan): `gpt-oss-20b` $0,075/1M masuk dan $0,30/1M keluar; `gpt-oss-120b` $0,15/1M dan $0,60/1M. `'gpt-oss-120b'` **wajib** sebelum `'gpt-oss-20b'` karena pencocokannya `includes()` — jebakan yang sama dengan `gpt-4o-mini` vs `gpt-4o`. Baris `'llama'` tetap dipertahankan karena masih dipakai model llama lewat OpenRouter.
    - **Temuan sampingan yang nyaris lolos: status 200 dengan jawaban KOSONG.** Probe pertama dengan `max_tokens: 5` menjawab `groq_status: 200, groq_ok: true` tetapi `content` kosong. Sebabnya gpt-oss adalah model *reasoning* — jatah token pertamanya habis untuk penalaran sebelum sempat mengeluarkan teks. Diukur pada probe kedua: **46 dari 56** token keluaran adalah `reasoning_tokens`. Artinya pemanggil dengan `max_tokens` kecil akan menerima balasan kosong **tanpa galat apa pun** — persis pola "pemeriksaan yang melapor sukses tanpa memeriksa". Seluruh pemanggil Groq diperiksa: `ai_adapter` memakai `max_tokens: 8192`, sisanya tidak menyetel `max_tokens` sama sekali sehingga memakai batas model. **Aman.** Probe `check-keys` sendiri diperbaiki agar melaporkan `groq_benar_menjawab`, `finish_reason`, dan `usage` — status 200 saja tidak lagi dianggap bukti.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Bukti akhir: `groq_status: 200`, `groq_jawaban: "OK"`, `groq_finish_reason: "stop"`, `groq_model_diuji: openai/gpt-oss-20b`. Deploy `agent-process` diverifikasi `[MATCH]`; `check-keys` di versi 48.
    - **Belum diuji, dan sengaja tidak diklaim:** jalur Groq di dalam `agent-process` belum dipanggil pengguna sungguhan sejak perbaikan ini, karena Owner memakai OpenRouter sebagai provider. Yang terbukti adalah modelnya hidup dan bisa menjawab; yang belum terbukti adalah `GroqAdapter` end-to-end. Bukti itu baru bisa muncul kalau ada permintaan yang benar-benar memilih Groq.

54. **Item 46 Ditutup: Pencarian Memori Semantik Akhirnya Hidup — dan Ambang 0,8 yang Nyaris Membuatnya Sia-Sia (2026-09-10):**
    - **Menutup "sisa pekerjaan" Item 46.** Jalur tulis yang sebenarnya — `MemoryGovernorService` di frontend — kini memvektorkan setiap memori sebelum menyimpannya.
    - **Pilihan (a) yang diambil: endpoint di server, bukan embedding di klien.** Ditambahkan `{ action: 'embed', text }` di `agent-process` (`lib/request/embed_endpoint.ts`). Alasannya dua, dan keduanya struktural: kunci Gemini tidak boleh tersebar ke setiap perangkat, dan dimensi vektor harus ditentukan di SATU tempat. Pilihan (b) berarti menyalin logika provider ke frontend — persis cara penjaga dimensi 768 dulu tercecer di dua berkas dan bertahan berbulan-bulan tanpa ketahuan (Item 39, 46).
    - **Penjagaan yang wajib, bukan opsional.** `agent-process` di-deploy `--no-verify-jwt` karena `/health` dan `proxy_fetch` dipanggil langsung dari browser. Endpoint ini karenanya memeriksa tokennya sendiri lewat `handleAuth`. Diuji: tanpa token → `401`; dengan anon key (bukan pengguna) → `401`. Tanpa penjagaan itu siapa pun di internet bisa membakar kunci Gemini Owner.
    - **Satu jebakan yang dihindari saat menyambungkannya.** Blok POST di `index.ts` dibungkus `try { ... } catch (_) { /* lanjut */ }` yang menelan SEMUA galat, bukan hanya kegagalan parse JSON. Menaruh action baru di dalamnya berarti setiap galatnya diam-diam jatuh ke pipeline chat — pemanggil menerima jawaban chat untuk permintaan embedding, tanpa pesan galat. Parse-nya dipisahkan; kini hanya kegagalan parse yang boleh diabaikan diam-diam.
    - **Jalur tulis KETIGA yang nyaris terlewat lagi.** Setelah memperbaiki `MemoryGovernorService` saya hampir melapor selesai. Kolom `source` menunjukkan **tiga** sumber, bukan satu: `MemoryGovernorService` (3), `rule_based_async_worker` (2), `MemoryService` (1, sejak 24 Juli). `MemoryService` mendelegasikan ke Governor bila tersedia, tapi jalur cadangannya menulis langsung tanpa vektor — dan diam. Baris Juli itu buktinya. Jalur itu SENGAJA tidak diberi embedding sendiri (ia justru menyala ketika Governor tidak ada, jadi menduplikasinya salah); yang ditambahkan adalah suara: `console.warn` + event `Memory:StoredWithoutEmbedding`. Ini kesalahan yang sama dengan yang dicatat di Item 46 — memetakan pemanggil, bukan penghasil baris. Kolom `source` yang menyelamatkannya, untuk kedua kalinya.
    - **Backfill selesai.** Metode `backfillMissingEmbeddings()` ditambahkan ke `MemoryGovernorService` (aman diulang; hanya menyentuh `embedding IS NULL`). Dijalankan Owner dari konsol: **6 berhasil, 0 gagal, dari 6 diperiksa.** Basis data sesudahnya: 7 memori, **7 bervektor, 0 tanpa vektor**, `vector_dims` 3072 untuk min maupun max.
    - **AMBANG 0,8 — temuan yang hanya bisa muncul SETELAH datanya benar.** Angka itu tidak pernah teruji, karena selama tidak ada memori bervektor, pencarian ini mustahil mengembalikan apa pun. Begitu ketujuh memori bervektor, ia langsung terbukti terlalu ketat. Diukur dengan vektor "saya suka kopi" sebagai kueri:

      | Memori | Kemiripan |
      |---|---|
      | saya suka kopi | 1,0000 |
      | saya juga suka teh | **0,7263** ← berhubungan |
      | ya, saya suka menggunakan ai | 0,5728 |
      | Menyukai clean architecture dan micro-kernel | 0,5256 |
      | dan saya kuliah di universitas terbuka (UT) | 0,5138 |
      | saya lebih suka penjelasan dengan tabel | 0,5117 |
      | nama panggilan saya adalah pak slamet | 0,5083 |

      Yang berhubungan duduk di 0,73; yang tidak berhubungan mengumpul rapat di 0,51–0,57. Ambang 0,8 memotong **tepat di atas** pasangan yang benar — jadi ia hanya meloloskan teks nyaris identik, dan pencarian semantiknya akan tetap terasa mati meski datanya sudah benar. Perbaikan Item 46 nyaris menjadi kosmetik.
    - **Bukti kuat bahwa 0,8 adalah penyimpangan, bukan kebijakan:** pencarian DOKUMEN sudah lama memakai **0,60–0,68** dinamis menurut panjang pertanyaan (`execution_context.ts:16-19`). Hanya pencarian memori yang di-hardcode 0,8.
    - **Keputusan Owner (2026-09-10): turunkan ke 0,70.** Ditaruh di celah lebar antara 0,73 dan 0,57. Dampaknya terukur, bukan teoretis: untuk kueri "kopi", ambang 0,80 meloloskan **1** memori (dirinya sendiri), ambang 0,70 meloloskan **2** (kopi + teh). Konsekuensi biaya disadari — Item 44 mencatat 99,3% belanja ada di prompt — tapi `match_count: 5` yang membatasinya, paling banyak 5 memori apa pun ambangnya.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Bukti tiga ujung: klien mencatat `[MemoryGovernorService] Embedding didapat: 3072 dimensi.`; basis data mencatat 7 dari 7 bervektor pada 3072 dimensi; dan **`match_memories` mengembalikan hasil yang benar** — `similarity: 1` untuk memori itu sendiri, 0,7263 untuk "teh" terhadap kueri "kopi", kalimat yang tidak berbagi satu kata pun selain "suka". Pencarian SQL biasa tidak akan pernah menemukannya. Deploy `[MATCH]`.
    - **Yang belum terbukti:** ambang 0,70 belum diuji pada percakapan nyata dengan basis memori yang lebih besar. Dengan 7 memori, jarak antar kelompok masih lebar dan mudah dipisahkan; pada ratusan memori jaraknya akan menyempit dan angka ini mungkin perlu ditinjau ulang. Dicatat, bukan diklaim selesai selamanya.

55. **Deteksi Konflik Memori: Aturan yang Dijamin Positif Palsu, dan Kemiripan Vektor yang Ternyata Tidak Cukup (2026-09-10):**
    - **Ditemukan Owner, bukan dari audit.** Panel Memory Context menandai "ya, saya suka menggunakan ai" berbenturan dengan "saya lebih suka penjelasan dengan tabel". Dua fakta yang sama-sama benar dan tidak berhubungan.
    - **Aturan lama runtuh menjadi tautologi.** `detectAndMarkConflict` mensyaratkan `source_reference` sama **dan** isi berbeda **dan** versi tidak sekuensial. Dua dari tiga syarat itu tidak pernah bisa gagal:
      - Setiap fakta chat dalam satu kategori memakai `source_reference` yang sama (`assistant_chat:preference`).
      - **SETIAP** baris `user_memories` punya `version_sequence = 1` — dibuktikan dengan query ke seluruh tabel. Pemanggil mengirim `newVersionSeq: 1` yang di-hardcode dan `storeGoldenMemory` juga default `1`, jadi `1 !== 1 + 1` **selalu** benar. Syarat versi itu murni hiasan.

      Sisanya tinggal "dua fakta berbeda dalam kategori sama = konflik". Dijamin menyala untuk setiap fakta baru. Aturan itu memang dirancang untuk memori turunan berkas (satu path = satu isi kanonik), bukan untuk fakta chat yang saling independen. Sudah pernah ditambal sekali (menambahkan kategori ke `source_reference`) — tambalan itu hanya **memperkecil** kelompok yang bertabrakan, tidak menghapus tabrakannya.
    - **Owner memilih (b): deteksi berbasis makna.** Baru mungkin sejak Item 54, karena sebelumnya tidak ada memori yang punya vektor.
    - **PENGUKURAN MENJATUHKAN (b) SEBAGAIMANA DIRANCANG.** Sebelum memasang apa pun, 12 pasang kalimat nyata diukur lewat konsol. Hasilnya:

      | Kemiripan | Jenis | Pasangan |
      |---|---|---|
      | 0,8780 | BENTROK | tabel vs tidak suka tabel |
      | 0,8710 | BENTROK | pak slamet vs pak mamet |
      | 0,8514 | BENTROK | kopi vs tidak suka kopi |
      | **0,8323** | **TAJAM** | kopi vs kopi hitam tanpa gula |
      | **0,8185** | **TAJAM** | UT vs jurusan SI di UT |
      | 0,7890 | BENTROK | teh vs benci teh |
      | **0,7263** | **BEBAS** | kopi vs teh |
      | **0,6353** | **BENTROK** | UT vs ITB |
      | 0,5201 | BEBAS | ai vs tabel |
      | 0,5083 | BEBAS | pak slamet vs kopi |
      | 0,5068 | BEBAS | kopi vs UT |
      | 0,4763 | BEBAS | clean architecture vs teh |

      **Celah antara BENTROK terendah dan BEBAS tertinggi: −0,091. NEGATIF.** "UT vs ITB" bertentangan tapi duduk **di bawah** "kopi vs teh" yang bebas. Dan golongan TAJAM (0,818–0,832) terkubur persis di tengah rentang BENTROK (0,789–0,878). Tidak ada satu ambang pun yang memisahkan ketiganya.
    - **Sebabnya mendasar, bukan soal kalibrasi:** vektor mengukur **kemiripan topik**, bukan **pertentangan**. Kata "tidak" nyaris tidak menggeser vektor, sementara dua nama berbeda (UT/ITB) justru menjauhkannya meski maknanya bertabrakan. Kemiripan tinggi berarti "membicarakan hal yang sama", bukan "saling membantah" — dua pertanyaan berbeda yang keliru saya kira bisa saling mewakili.
    - **Yang dipasang: DUA TAHAP.**
      - **Tahap 1 — saringan (gratis, di klien):** kemiripan kosinus ≥ **0,78**. Untuk 7 memori Owner, pasangan tak berhubungan tertinggi hanya 0,7263, jadi saringan ini hampir tidak pernah menyala untuk fakta bebas — panggilan LLM jadi jarang.
      - **Tahap 2 — hakim (berbayar, di server):** endpoint baru `{ action: 'judge_conflict' }` di `agent-process` (`lib/request/judge_endpoint.ts`) meminta model kecil memutuskan **BERTENTANGAN / PENAJAMAN / INDEPENDEN**. Hanya BERTENTANGAN yang menandai memori lama.
    - **BYOK wajib untuk hakim (Item 51).** Ini panggilan model chat atas nama pengguna — beda dengan embedding yang fungsi internal — jadi memakai kunci pengguna sendiri. Model dikirim klien dari `BrainService`, **bukan ditebak di server**, karena katalog penyedia berubah lebih cepat daripada kode (pelajaran Item 41 dan 53).
    - **Gagal ke arah TIDAK menandai.** Kalau hakim gagal, tidak ada key, atau jawabannya tidak bisa dibaca, memori dibiarkan aktif. Prompt-nya juga diberi tie-breaker eksplisit: ragu antara BERTENTANGAN dan PENAJAMAN → pilih PENAJAMAN. Menandai keliru berarti fakta Owner yang benar dilempar ke antrian review — persis keluhan yang melahirkan item ini.
    - **Deteksi dipindah ke dalam `storeGoldenMemory`.** Dulu dipanggil terpisah dari `AssistantService` sebelum penyimpanan; sejak berbasis vektor itu berarti dua embedding untuk teks yang sama, dan membuat jalur penyimpanan lain (mis. `MemoryService`) luput. Sekarang satu memori = satu embedding = satu pemeriksaan.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Diuji tiga kasus lewat chat sungguhan:

      | Kasus | Kemiripan | Putusan | Hasil |
      |---|---|---|---|
      | kopi hitam tanpa gula | 0,8323 | PENAJAMAN | dibiarkan aktif |
      | sekarang tidak suka kopi | 0,7957 | BERTENTANGAN | ditandai |
      | suka jalan pagi | — | tidak lolos saringan | tanpa panggilan LLM |

      **0,8323 dibiarkan sementara 0,7957 ditandai** — yang lebih mirip justru lolos. Itu bukti langsung bahwa ambang tunggal mustahil bekerja, dan bahwa hakimnya benar-benar memutuskan berdasarkan makna. Alasan hakim tersimpan di `metadata.conflict_info.judge_reason`: "kedua pernyataan tidak mungkin benar bersamaan". Penjagaan endpoint diuji: tanpa token 401; `proxy_fetch` dan `embed` tidak rusak. Deploy `[MATCH]`.
    - **Label tombol yang menyesatkan, ditemukan Owner sesudahnya.** Owner bertanya: "itu artinya semuanya tersimpan sekarang? bukan pilih salah satu kan?" Jawabannya ya — dan labelnya memang keliru. Memori baru **selalu** tersimpan; yang diputuskan hanya nasib memori lama. "Pertahankan Lama" terbaca seolah menolak memori baru, padahal artinya kedua memori dibiarkan hidup berdampingan. Diganti menjadi **"Simpan Keduanya"** dan **"Arsipkan yang Lama"**, ditambah keterangan eksplisit di atas tombol. Chip `(v1)` dan baris "Sumber" dibuang — keduanya sisa aturan lama yang menampilkan angka mati sebagai seolah-olah bermakna. Kemiripan dan alasan hakim kini ditampilkan, tapi hanya bila ada.
    - **Belum diverifikasi:** tampilan kartu konflik yang baru **belum dilihat terpasang** — tidak ada konflik aktif saat perubahan UI selesai. Perubahannya lolos kompilasi, tapi itu hanya membuktikan bentuknya.
    - **Konsekuensi yang perlu diketahui Owner:** menekan "Simpan Keduanya" pada pertentangan nyata berarti dua fakta yang saling membantah sama-sama aktif, dan keduanya bisa tertarik ke prompt yang sama. Untuk kalimat uji hari ini tidak masalah; untuk fakta sungguhan (mis. alamat lama vs baru) yang lama sebaiknya diarsipkan.
    - **Ambang saringan 0,78 diukur pada 7 memori.** Pada ratusan memori jarak antar kelompok akan menyempit dan angka ini perlu ditinjau ulang. Dicatat, bukan diklaim selesai selamanya.

56. **Tool Word → PDF dari Chat — Dua Word di Satu Mesin, dan Berkas yang "Sudah Ada" Padahal Belum Selesai (2026-09-10):**
    - **Permintaan Owner:** tool yang dipanggil asisten dengan prompt seperti "ubah word ke pdf dokumen ini", **tanpa mengubah foto, susunan huruf, dan sebagainya**. Dokumen uji: `DOKUMEN HCDP 2025-2026.docx`, 47 halaman A4, **15 grafik Word asli** (termasuk 3D), 7 bentuk VML gaya lama di sampul, 596 tab stop kustom.
    - **Kenapa bukan library.** `.docx` hanya menyimpan resep, bukan tampilan halaman; yang menghitung baris, halaman, dan aliran teks di sekitar gambar adalah *mesin tata letak*. `mammoth` (sudah ada di repo) sengaja membuang format; Chromium/`docx-preview` tidak menggambar grafik Word. Tiga repo di `asisten-repo/external` (khoj, fork Codex, letta-code) diperiksa — tidak ada konverter; khoj pun memasang LibreOffice alih-alih menulis sendiri. Kesimpulannya: mesinnya harus Word sendiri.
    - **Word di mesin Owner tidak bisa "Save as PDF"** (Word 2007 RTM `12.0.4518`, tanpa `EXP_PDF.DLL`), tapi bisa **mencetak ke printer virtual `Microsoft Print to PDF`** bawaan Windows — tata letaknya tetap dibuat Word.
    - **JEBAKAN 0 KB — ditemukan Owner.** Cetak manual pertama dilaporkan "hasilnya 0kb". Dipantau langsung lewat antrian printer: berkas dibuat seketika dalam keadaan 0 byte dan baru terisi saat job selesai (0 → 5,2 MB → 7,88 MB dalam ~2,5 menit). Maka skrip **tidak** menganggap "berkas sudah ada" sebagai berhasil: ia menunggu `%%EOF`, ukuran berhenti bertambah, dan antrian kosong, lalu **membandingkan jumlah halaman PDF dengan jumlah halaman menurut Word**.
    - **DUA WORD DI SATU MESIN — klaim saya sendiri yang keliru.** Pemeriksaan pertama hanya menemukan `Office12`, dan saya melapor "hanya Word 2007". Uji skrip pertama ternyata membuka **Word 365 16.0 tanpa lisensi** — ketahuan dari jendela tersembunyinya berjudul "Word (Unlicensed Product)" dengan dialog "Save to OneDrive to enable editing", yang menahan Word selamanya. COM `Word.Application` terdaftar dua kali: dari proses **64-bit** membuka Word 365, dari **32-bit** (`SysWOW64`) membuka Word 2007. Tool sengaja memakai PowerShell 32-bit → Word 2007, berlisensi, dan hasilnya sama dengan cetak manual yang sudah dinyatakan benar oleh Owner.
    - **Cek jumlah halaman saja NYARIS menipu.** PDF dari Word 365 lolos 47 = 47, tapi teks terbacanya separuh versi manual dan halaman 18 kehilangan ribuan potongan grafik. Diselidiki sampai tuntas: tata letak kedua PDF identik (setiap bagian di halaman yang sama); perbedaannya cara pengkodean — Word 2007 memecah grafik 3D menjadi ribuan ubin gambar (7,8 MB), Word 365 menggambarnya sebagai vektor (2,1 MB). Halaman 1, 18, 21, 29, 30 dilihat langsung lewat `pdfjs-dist` di Browser pane: utuh.
    - **Setiap konversi meninggalkan WINWORD.EXE tersembunyi.** Penyebabnya: Word 2007 lewat COM menolak `Quit(0)` ("Argument: '1' should be a PSReference"), dan skrip versi pertama menaruhnya di `catch {}` kosong — error tertelan, Word tidak pernah tertutup. Diperbaiki dengan `[ref]0`, error penutupan kini **dilaporkan** (`catatan_tutup`), dan jaring pengaman menghentikan Word milik skrip bila masih hidup 15 detik setelah `Quit`. Hanya proses **baru** yang dianggap milik skrip; Word yang dibuka Owner tidak pernah disentuh.
    - **Susunan:**
      - `frontend/electron/scripts/word_to_pdf.ps1` — mesinnya; keluaran satu baris JSON (`ok`, `halaman_word`, `halaman_pdf`, `ukuran`, `detik`, `word_versi`, `word_ditutup`).
      - `frontend/electron/main.cjs` — IPC `doc:word-to-pdf` (spawn tanpa shell, jadi nama berkas tidak bisa disisipi perintah; satu konversi sekaligus; PDF ditaruh di sebelah dokumen dan **tidak menimpa** — hasil kedua jadi `(2).pdf`; batas keras 11 menit yang juga membunuh Word milik skrip) dan `doc:open-result` (tombol Buka/Tampilkan; **hanya `.pdf` yang ada** — `shell.openPath` pada `.exe` berarti menjalankannya).
      - `frontend/electron/preload.cjs` — `getPathForFile` lewat `webUtils` (Electron 42 sudah menghapus `File.path`), `wordToPdf`, `openConvertedPdf`.
      - `tools/word_to_pdf.js` — terdaftar otomatis lewat scan folder `tools/`, dapat toggle di panel Tools.
      - `RequestClassifierService` — tipe baru `DOC_CONVERT`, deterministik tanpa LLM. Pertanyaan ("bisakah ubah word ke pdf?") sengaja **tidak** dieksekusi. Arah PDF → Word dikenali supaya ditolak dengan jujur, bukan diserahkan ke LLM yang bisa mengaku sudah mengonversi.
      - `AssistantService._handleDocConvert` — memanggil tool lewat `ToolRegistry`; klaim berhasil hanya bila skrip membuktikannya.
      - `ConversationEngine.jsx` — tombol 📎 kini juga di workspace Assistant (sebelumnya **hanya Lite**; instruksi uji pertama saya menyuruh Owner memakai tombol yang tidak ada di layarnya), tombol **Buka PDF** / **Tampilkan di folder** di bawah balasan.
      - `package.json` — `asarUnpack: electron/scripts/**`, karena PowerShell tidak bisa membaca berkas di dalam `app.asar`.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Owner mengetik "ubah dokumen tersebut menjadi pdf" dengan lampiran → log `[RequestClassifier] → DOC_CONVERT` → `Executing tool: word_to_pdf` → PDF 47 = 47 halaman, 7,4 MB, 57 detik, `word_versi 12.0`, `word_ditutup normal`. Konversi kedua menghasilkan `DOKUMEN HCDP 2025-2026 (2).pdf` — PDF pertama tidak tertimpa (terlihat di Explorer Owner). Tombol Buka PDF dan Tampilkan di folder dikonfirmasi berfungsi. Uji handler: berkas bukan Word, path relatif, nama berisi `&` dan `'`, dua perintah bersamaan, `calc.exe` lewat tombol buka, PDF yang sudah hilang — semua memberi jawaban yang tepat. Pengenal perintah lulus 12 kalimat uji.
    - **Satu kegagalan uji yang ternyata bukan bug kode.** Tombol sempat "mati" dengan `No handler registered for 'doc:open-result'`: proses utama Electron dimulai 15:09:50, `main.cjs` diubah 15:17:49, Owner hanya hard refresh pukul 15:19. Hard refresh memperbarui UI dan preload, **tidak** memperbarui `main.cjs`. Yang memang salah: tombolnya diam — error hanya muncul di konsol sebagai `Uncaught (in promise)`. Kini setiap kegagalan tombol muncul di chat, dan kasus handler basi memberi tahu bahwa `npm run desktop` harus dijalankan ulang.
    - **Belum terbukti:**
      - **Pengembalian printer default** — printer default Owner sudah "Microsoft Print to PDF" sejak awal, jadi logika pengembaliannya tidak teruji. Sengaja tidak diuji dengan mengubah pengaturan printer Owner.
      - **Build terpaket** (`npm run dist`) belum dibuat; jalur `app.asar.unpacked` belum pernah dijalankan.
      - Lampiran berkas Word yang dikirim bersama **pertanyaan biasa** di workspace Assistant kini diteruskan ke LLM seperti di Lite — jalur itu belum pernah diuji untuk `.docx`.
      - Grafik 3D yang dicetak Word 2007 tersimpan sebagai ribuan ubin gambar, sehingga bisa tampak sedikit buram bila diperbesar; ini sifat Word 2007, bukan skrip.
    - **Tidak dikerjakan:** PDF → Word. Word 2007 tidak bisa membuka PDF, dan PDF tidak menyimpan susunan paragraf/tabel sehingga hasilnya selalu tebakan; `pdf2docx` butuh Python yang ternyata **tidak terpasang** (yang ada hanya pintasan Microsoft Store — klaim "Python: ✅ Ada" saya di awal juga keliru).

57. **Konversi Word → PDF dari Versi Web: Laptop sebagai Pekerja, dan Versi Web yang Ternyata Tak Pernah Punya Tool (2026-09-10):**
    - **Pertanyaan Owner:** tool Item 56 hanya menyuruh Word 2007 di laptop, jadi tidak bisa dari HP. Tiga jalan dibandingkan (laptop sebagai pekerja / server LibreOffice sendiri / layanan pihak ketiga). Owner memilih **jalan 1**: laptop sendiri yang mengerjakan, HP cukup mengirim lewat Supabase yang sudah ada. Kualitas identik dengan Item 56, tanpa biaya dan tanpa dokumen keluar ke pihak ketiga; syaratnya laptop menyala dan aplikasi desktop terbuka.
    - **Arsitektur:** versi web mengunggah `.docx` ke bucket privat `conversions` dan menyisipkan baris `conversion_jobs` berstatus `pending` → `RemoteConversionWorkerService` di aplikasi desktop memeriksa tiap 6 detik, **mengklaim atomik** (`update … where status = 'pending'`, hanya satu pekerja yang menang walau dua jendela terbuka) → unduh ke `%TEMP%\mamet-konversi\<jobId>\` → IPC `doc:word-to-pdf` yang sama dengan Item 56 → unggah `hasil.pdf` → `done`. Versi web menunggu lalu memberi tombol **Unduh PDF** (signed URL 10 menit, nama berkas asli dipulihkan).
    - **Jam server, bukan jam perangkat.** Detak laptop (`conversion_worker_heartbeat`) dan status online (`conversion_worker_status`, < 60 detik) dihitung dengan `now()` di database. Kalau laptop menulis waktunya sendiri lalu HP membandingkan dengan jam HP, selisih satu menit saja sudah cukup membuat laptop tampak offline padahal menyala.
    - **Laptop offline = ditolak di depan.** Versi web memeriksa status laptop SEBELUM mengunggah. Dibuktikan tanpa sengaja: Owner menjalankan `npm run dev` saja (tanpa aplikasi desktop), chat menjawab "Laptop Anda sedang offline … terakhir terlihat 222 menit lalu", dan basis data menunjukkan **0 pekerjaan, 0 berkas** — tidak ada dokumen yang dititipkan ke antrian yang tak akan dikerjakan siapa pun.
    - **Keamanan:** RLS di kedua tabel dan di `storage.objects` membatasi setiap akun ke baris dan folder `<user_id>/` miliknya; tidak ada policy `USING (true)` (pelajaran Item 52). Bucket privat, 25 MB, hanya tipe Word/PDF. IPC berkas sementara dikurung di satu folder: jobId wajib UUID, nama berkas dibersihkan, hanya `.pdf` di folder itu yang boleh dibaca kembali — diuji dengan `..\..\`, jobId palsu, `.exe`, dan `C:\Windows\win.ini`, semua ditolak. Kunci storage sengaja bernama tetap (`sumber.docx`, `hasil.pdf`) karena nama dokumen dinas bisa berisi `#` atau `%`.
    - **Migrasi divalidasi sebelum dijalankan:** seluruh isinya dieksekusi dalam `BEGIN … ROLLBACK` — 11 policy terbentuk, query sebagai pengguna biasa jalan — lalu dipastikan basis data kembali kosong. Owner kemudian menjalankan `supabase db push`.
    - **TEMUAN SAMPINGAN: versi web TIDAK PERNAH memuat satu tool pun.** Tangkapan layar Owner dari Chrome menunjukkan panel Tools hanya berisi RAG. Sejak scan folder `tools/` diperkenalkan (2026-09-09), tool dibaca dari disk lewat IPC Electron — Vercel tidak punya disk repo. `web_search` tetap jalan hanya karena jalur cadangan di `RetrievalOrchestrator.js:239`. Kini di luar Electron tool diambil dari salinan yang dibundel Vite (`import.meta.glob`), di desktop scan disk tetap dipakai. Bukti dari log versi web: `✅ Versi web: 5/5 tool dimuat dari bundel build`.
    - **Pesan yang menyesatkan diperbaiki dua kali.** (1) Membuka `localhost:5173` di Chrome — Owner mengira itu mametlite — menghasilkan "tool belum terdaftar, periksa berkasnya", menyuruh memeriksa hal yang salah. (2) Batas tunggu 13 menit semula berjanji "hasilnya bisa diunduh nanti", padahal versi web tidak punya daftar riwayat konversi. Keduanya kini mengatakan apa yang benar-benar terjadi.
    - **Instruksi uji saya yang keliru:** menyuruh membuka `localhost:5173` untuk mametlite, padahal port itu milik Mamet OS dari `npm run desktop`. Ketahuan dari tangkapan layar Owner dan dari proses yang listen di port itu.
    - **Ralat lingkup oleh Owner:** panel konversi sempat dipasang di **mametlite**, dengan tampil otomatis hanya bila akun punya laptop-pekerja online. Owner mengoreksi: *"mametlite tidak usah memakai fitur ubah pdf, mametlite hanya pakai rag dan pencarian web saja."* Seluruh perubahan mametlite dikembalikan (`git status` mametlite: 0 perubahan). Fitur ini hanya ada di Mamet OS.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).** Owner mengirim `DOKUMEN HCDP 2025-2026.docx` dari Mamet OS versi web di Chrome, sementara aplikasi desktop terbuka sebagai pekerja, lalu berhasil mengunduh PDF-nya. Tiga ujung:

      | Ujung | Bukti |
      |---|---|
      | Antrian | status `done`, diambil laptop **2 detik** setelah dikirim, selesai **74 detik** |
      | Hasil | **47 = 47 halaman**, `word_versi 12.0`, `word_ditutup normal`, tanpa error |
      | Storage | `sumber.docx` **977.276 byte** — sama persis dengan dokumen asli; `hasil.pdf` 7.769.349 byte — sama dengan hasil konversi lokal Item 56 |

      Ukuran sumber yang identik membuktikan dokumen tidak berubah dalam perjalanan; ukuran PDF yang identik membuktikan laptop memakai mesin yang sama.
    - **✅ Terbukti dari HP (2026-09-10, setelah push `42d1a4c` dan deploy Vercel).** Owner mengonversi dokumen **lain** dari HP lewat `mamet-ecosystem.vercel.app` dan berhasil mengunduhnya — dokumen berbeda, jadi bukan pengulangan uji Chrome:

      | | Dari HP (20:02:32 WIB) | Uji Chrome (19:51:42 WIB) |
      |---|---|---|
      | Dokumen | `UT_PBB_LPKBJJ_2022_PKBJJ_LEMBAR KERJA MEMBUAT RENCANA BELAJAR.docx` | `DOKUMEN HCDP 2025-2026.docx` |
      | Diambil laptop | 4 detik | 2 detik |
      | Selesai | 22 detik | 74 detik |
      | Halaman | 5 = 5 | 47 = 47 |
      | Word ditutup | normal | normal |
      | Storage | `sumber.docx` 34.420 B, `hasil.pdf` 473.157 B | 977.276 B / 7.769.349 B |

      Nama berkas panjang berisi spasi dan garis bawah lolos tanpa masalah — keputusan kunci storage bernama tetap (`sumber.docx` / `hasil.pdf`) bekerja sebagaimana dirancang. **Batas bukti:** basis data tidak mencatat perangkat pengirim; bahwa pekerjaan 20:02 dikirim dari HP bersandar pada laporan Owner. Yang dibuktikan basis data: dokumen baru masuk lewat antrian, dikerjakan laptop, hasilnya utuh.
    - **Belum terbukti:**
      - **Pemulihan pekerjaan macet** (aplikasi ditutup di tengah konversi → ditandai gagal setelah 15 menit) belum pernah diuji.
    - **Belum dikerjakan:**
      - **Berkas tidak pernah terhapus.** Setiap konversi meninggalkan sumber + hasil di bucket (±9,2 MB setelah dua konversi), dan versi web belum punya daftar riwayat atau tombol hapus. Perlu kebijakan retensi.
      - **CSP versi web memblokir `api.github.com`** (`RepositoryReaderService.js:157`) — terlihat di log uji, sudah ada sebelum item ini, tidak memengaruhi konversi.

58. **Cache Hasil Konversi Berbasis Sidik Jari Isi, Kuota 200 MB, dan Panel Riwayat (2026-09-10):**
    - **Masalah dari Item 57:** setiap konversi meninggalkan `sumber.docx` + `hasil.pdf` di bucket selamanya (±9,2 MB setelah dua konversi), dan versi web tidak punya daftar riwayat — PDF hanya bisa diunduh dari tombol di pesan chat asalnya.
    - **Rancangan pertama saya (batas 24 jam) diganti setelah pertanyaan Owner.** Owner bertanya bagaimana kalau memakai sistem cache atau sampah. Dibandingkan: sampah cocok untuk data yang tak tergantikan; hasil konversi SELALU bisa dibuat ulang karena dokumen aslinya ada di perangkat Owner — yang dibutuhkan bukan "bisa dipulihkan" tapi "tidak hilang terlalu cepat dan tidak menumpuk". Owner memilih **cache 200 MB + panel Riwayat**, dan menambahkan poin yang menjadi inti rancangan: *cache membuat sistem tidak berulang kali memproses hal yang sama*, dan berguna untuk tujuan ke depan. Kode batas 24 jam belum sempat di-commit, jadi tidak ada yang perlu dibatalkan.
    - **Cache berbasis sidik jari ISI (SHA-256), bukan nama berkas.** Dihitung di browser sebelum mengirim. Dokumen sama dengan nama beda → tetap dikenali; diedit satu huruf → sidik jari berubah, dianggap dokumen baru (tidak ada PDF basi). Kunci pencarian `(user_id, kind, source_hash)` — `kind` sengaja ikut supaya jenis pemrosesan lain di masa depan (mis. ringkasan dokumen) bisa memakai mekanisme yang sama.
    - **Cache per akun, sengaja tidak dibagi.** Kalau dibagi antar pengguna, orang lain bisa mengetahui bahwa suatu dokumen pernah dikonversi di sistem ini.
    - **Cache diperiksa SEBELUM status laptop.** Dokumen yang pernah dikonversi diberikan seketika, tanpa antre, tanpa Word — dan tetap berhasil walau laptop mati. Gagal memeriksa cache tidak menggagalkan konversi; ia jalan pintas, bukan syarat.
    - **Kuota 200 MB, buang yang paling lama TIDAK DIPAKAI** (`last_accessed_at`, diperbarui saat cache dipakai dan saat diunduh), bukan yang paling lama dibuat — PDF yang sering diunduh bertahan. Ditegakkan laptop setelah setiap konversi dan tiap jam; hanya laptop yang menambah isi cache, jadi kuota tidak bisa terlampaui lewat jalur lain.
    - **Kenapa bukan pg_cron:** trigger `storage.protect_delete` di `storage.objects` memblokir DELETE lewat SQL (dibuktikan dari `pg_trigger`). Berkas hanya bisa dihapus lewat Storage API, jadi laptop-pekerja yang membersihkan — ia sudah login dan hanya berhak atas folder akunnya sendiri.
    - **Aturan pembersihan lainnya:** `sumber.docx` dihapus segera setelah konversi selesai atau gagal (kecuali dikembalikan ke antrian karena Word sibuk); pending > 15 menit ditandai kedaluwarsa (versi web berhenti menunggu di menit ke-13); baris gagal > 7 hari dihapus. Kolom `source_deleted` mencegah penghapusan dicoba ulang tiap jam. Baris dihapus **hanya bila berkasnya berhasil dihapus** — kalau Storage gagal, baris tetap ada sebagai penunjuk, bukan berkas yatim.
    - **Panel Riwayat** (`RiwayatKonversi.jsx`) di toolbar workspace Assistant: pemakaian "X MB dari 200 MB", daftar konversi dengan status, halaman, ukuran, tanggal, tombol Unduh dan Hapus. Tombol Unduh di pesan chat lama yang PDF-nya sudah terbuang kini menjelaskan sebabnya, bukan "Object not found" mentah.
    - **Satu sumber angka:** `KUOTA_CACHE_MB` diekspor `remoteConversionClient.js` dan diimpor pekerja, panel, dan pesan chat — tidak bisa berbeda satu sama lain.
    - **Status:** ✅ **Selesai & Diverifikasi Live (2026-09-10).**
      - **Migrasi** divalidasi dalam `BEGIN … ROLLBACK` sebelum `supabase db push`; kedua PDF lama langsung mendapat ukuran benar dari metadata storage (7.769.349 dan 473.157 byte).
      - **Pembersihan sumber lama saat laptop mulai:** bucket turun dari **4 berkas menjadi 2** (hanya `hasil.pdf`), `source_deleted` kedua pekerjaan lama menjadi `true`.
      - **Panel Riwayat** tampil di Chrome: 2 konversi, "7.9 MB dari 200 MB".
      - **Cache — urutan waktu adalah buktinya:**

        | WIB | Kejadian |
        |---|---|
        | 20:39:45 | lembar kerja UT dikirim → **satu** pekerjaan baru, sidik jari `66d30b1d47f2…` |
        | 20:40:52 | laptop selesai; `sumber.docx` langsung dihapus |
        | 20:41:12 | **detak terakhir laptop** — detak 20:41:32 tidak pernah datang, aplikasi desktop tertutup |
        | 20:41:52 | dokumen sama dikirim lagi → ⚡ **diambil dari cache** |

        Hanya satu baris baru, bukan dua — kiriman kedua tidak masuk antrian sama sekali — dan terjadi 40 detik setelah laptop berhenti berdetak. Bucket berisi 3 berkas, ketiganya `hasil.pdf`.
      - **Logika kuota** diuji dengan kode pekerja yang ASLI dan Supabase tiruan di memori (hook `module.register` mengganti modul `supabase.js`): 5 PDF × 60 MB = 300 MB → dibuang A dan C (paling lama tak dipakai), **B yang dibuat paling awal tapi baru dipakai bertahan**, sisa 180 MB; pending 20 menit kedaluwarsa, pending 1 menit bertahan; gagal 8 hari terhapus, 1 hari bertahan; akun lain berisi 300 MB **tidak tersentuh**; pembersihan kedua tidak membuang apa pun. 10/10 lulus.
    - **Belum terbukti:** pembuangan saat kuota 200 MB **benar-benar penuh** di Supabase sungguhan — hanya diuji dengan tiruan, karena butuh ratusan MB PDF.
    - **Keterbatasan yang disadari:** dua konversi sebelum Item 58 tidak punya sidik jari, jadi tidak pernah menjadi cache hit; di Riwayat kini ada dua entri lembar kerja UT (lama tanpa sidik jari, baru dengan sidik jari). Konversi langsung di aplikasi desktop (Item 56) menaruh PDF di sebelah dokumen aslinya dan tidak masuk cache.

59. **Versi Web Kembali Ber-CSP — Skrip Build Desktop yang Diam-diam Ikut Jalan di Vercel (2026-09-10):**
    - **Berawal dari log uji Item 57:** di mode dev, File Explorer versi web gagal membaca repo — `api.github.com` diblokir Content Security Policy (`RepositoryReaderService.js:157`). Owner bertanya apa itu CSP sebelum mengizinkan perubahan apa pun.
    - **CSP** adalah daftar alamat yang boleh dihubungi halaman; browser memblokir alamat di luar daftar. Gunanya pertahanan: kalau kode jahat sempat tersisip ke halaman, ia tidak bisa mengirim data ke server penyerang.
    - **TEMUAN: situs live TIDAK punya CSP sama sekali.** Diperiksa langsung ke `mamet-ecosystem.vercel.app`: tidak ada di header, tidak ada di HTML. Sebabnya skrip `postbuild` di `frontend/package.json` yang menghapus meta CSP (dan atribut `crossorigin`) dari `dist/index.html` — perlu untuk Electron yang membuka berkas lokal. Tapi npm **otomatis** menjalankan skrip bernama `postbuild` setiap `npm run build`, yaitu perintah yang juga dipakai Vercel. Akibatnya terbalik dari yang lazim: mode dev terlindungi, produksi yang dipakai dari HP tidak.
    - **Pilihan Owner (pilihan 2):** hentikan penghapusan untuk versi web, pertahankan untuk desktop. Pilihan 1 (sekadar menambah GitHub ke daftar) hanya menghilangkan error di mode dev tanpa memulihkan perlindungan di produksi.
    - **Audit dulu, ubah kemudian.** Memulihkan CSP di produksi berisiko memblokir fitur yang selama ini jalan justru karena CSP tidak ada. Semua alamat luar di kode diperiksa terhadap daftar izin, termasuk alamat dari `.env`, iframe, dan worker: Supabase, Wikipedia, font Google, dan `localhost:3000` sudah diizinkan; Bing, Google News, Antara, DuckDuckGo tidak dihubungi langsung dari browser melainkan lewat `proxy_fetch` Supabase. Yang kurang hanya **`api.github.com`** dan **`raw.githubusercontent.com`** (RepositoryReaderService).
    - **Perubahan:** skrip diganti nama menjadi `desktop:postbuild` (isinya tidak berubah) dan dipanggil eksplisit oleh `dist`, `dist:portable`, `dist:publish`; kedua alamat GitHub ditambahkan ke `connect-src`, dengan komentar di `index.html` yang menjelaskan asal-usulnya dan kapan daftar harus diperbarui.
    - **Status:** ✅ **Selesai & Diverifikasi Lokal (2026-09-10).**
      - `npm run build` (persis seperti Vercel): penghapus **tidak** jalan, CSP ada di hasil build, alamat GitHub tercantum.
      - `desktop:postbuild` pada hasil build: CSP dan `crossorigin` terhapus, font dan aset utuh.
      - Hasil build web dibuka di Browser pane: `api.github.com`, `raw.githubusercontent.com`, Supabase, Wikipedia lolos (HTTP 200); **kontrol `example.com` diblokir** dengan pelanggaran `connect-src` tercatat — bukti CSP benar-benar menjaga, bukan hanya tertulis.
      - Bukti tambahan: mode dev sudah memakai CSP ini sepanjang hari, dan seluruh uji web Item 57–58 (konversi, unggah storage, unduh PDF, cache, panel Riwayat) berjalan di bawahnya tanpa terblokir.
    - **✅ Terbukti di produksi (2026-09-10, setelah push `b94ce0c`).** Situs live dipantau sampai deploy baru mendarat: `Last-Modified` berganti dari 13:48:16 GMT (deploy sebelumnya, CSP=0) menjadi **14:02:57 GMT (CSP=1)**. HTML live memuat CSP dengan kedua alamat GitHub, dan atribut `crossorigin` kembali ada. Diuji langsung dari origin `https://mamet-ecosystem.vercel.app` di Browser pane:

      | Uji | Hasil |
      |---|---|
      | `api.github.com`, `raw.githubusercontent.com`, Supabase | diizinkan (HTTP 200) |
      | **kontrol `example.com`** | **diblokir** — pelanggaran `connect-src` tercatat di konsol |
      | tampilan halaman | normal; satu-satunya error konsol adalah pemblokiran kontrol yang sengaja dipicu |

      Versi web yang dibuka dari HP kini punya lapisan pengaman yang sama dengan mode dev.
    - **✅ Alur konversi Item 57–58 terbukti di bawah CSP produksi.** Owner menguji ulang setelah deploy ber-CSP: `Roadmap_Mamet_OS_Ecosystem.docx` — dokumen baru, belum pernah dikonversi, jadi melewati alur penuh, bukan cache — dikirim **21:05:43 WIB** (hampir 3 menit setelah deploy mendarat 21:02:57), selesai 21:06:20 (37 detik, 3 halaman, tanpa error), diunduh 21:06:32 (`last_accessed_at` tercatat oleh tombol Unduh), `sumber.docx` langsung dihapus. Unggah storage, antrian, laptop, unggah PDF, dan tautan unduh semuanya jalan di bawah CSP. **Batas bukti:** basis data tidak mencatat situs asal pengiriman; "lewat situs live" bersandar pada laporan Owner, dan urutan waktunya konsisten.
    - **✅ File Explorer versi web terbukti (2026-09-10, setelah push Item 60 `c2abaf2`):** Owner membukanya dari versi web sambil login dan melaporkan berhasil — daftar folder dan isi berkas dimuat dari GitHub di bawah CSP produksi.
    - **Belum terbukti:**
      - Build installer desktop penuh (`npm run dist`) — skripnya diuji, electron-builder belum dijalankan.

60. **File Explorer — Pengaman HTML yang Tidak Mengamankan dan Pewarna Kode yang Tidak Mengenal String (2026-09-10):**
    - **Berawal dari pertanyaan Owner:** File Explorer dibuat oleh DeepSeek dan Owner tidak tahu apakah fitur ini berguna. Penilaian: aplikasinya adalah penampil **hanya-baca untuk kode Mamet OS sendiri** (desktop membaca folder proyek, web membaca repo publik `mamet334/mamet-ecosystem` lewat GitHub API), bukan penjelajah dokumen Owner. Isinya sudah tersedia lebih lengkap di VS Code dan github.com, jadi aplikasinya bernilai kecil. **Mesinnya, `RepositoryReaderService`, bernilai** — dibuat untuk Engineer (commit `5289d28`, 2026-07-30) supaya bisa membaca kode sebelum mengusulkan perbaikan, dengan 24 rujukan di kode Engineer. Saran: kalau suatu saat dirapikan, pensiunkan aplikasinya, pertahankan layanannya. Owner memilih memperbaiki aplikasinya.
    - **Bug 1 — `escapeHtml` tidak meng-escape apa pun** (`FileExplorer.jsx:32`). Diperiksa per byte: `<` diganti `<` dan `>` diganti `>`, jadi fungsi itu tidak mengubah apa-apa. Hasilnya dimasukkan lewat `dangerouslySetInnerHTML`, sehingga tag di dalam berkas `.jsx`/`.html` diperlakukan sebagai HTML sungguhan: tampilan kode rusak atau bagiannya hilang. Diperbaiki menjadi `&lt;` dan `&gt;`.
    - **Bug 2 — pewarna kode tidak mengenal string.** Beberapa regex dijalankan berurutan di atas hasil regex sebelumnya, sehingga aturan komentar tidak tahu bahwa `//` sudah berada di dalam string: setiap URL `"https://…"` berubah abu-abu miring mulai dari `//` (terlihat di screenshot Owner pada `package-lock.json`). Aturan `#` berlaku untuk semua jenis berkas, sehingga `'#fff'` di JS/CSS ikut dianggap komentar. Menambal satu regex lagi tidak menyelesaikan akar masalah, jadi pewarna ditulis ulang sebagai **pembaca sekali jalan dari kiri ke kanan**: tiap karakter hanya punya satu peran (string, komentar, kata kunci, atau polos), dengan aturan per jenis berkas (`//` dan `/* */` untuk JS/TS, `/* */` untuk CSS, `<!-- -->` untuk HTML, `#` hanya untuk Python/shell/YAML/`.env`). String yang kutipnya tak tertutup berhenti di akhir baris, bukan mewarnai sisa berkas. Berkas yang tidak terdaftar (`.md`, `.txt`) kini tampil polos — dulu kata "if"/"for" dalam prosa ikut ungu dan apostrof "Don't" dianggap awal string.
    - **Bug 3 — ditemukan oleh uji, sebelum dilaporkan.** Versi pertama pewarna baru memotong komentar `//` tepat sebelum `\n`. Pada berkas Windows (`\r\n`, hampir semua berkas repo ini), `\r` ikut masuk ke dalam span komentar dan browser membacanya sebagai baris baru kedua: setiap komentar diikuti baris kosong ganda. Tertangkap karena uji berkas nyata menjalankan pewarna pada `FileExplorer.jsx` sendiri dan teks yang tampil tidak sama dengan aslinya. Diperbaiki dengan menyamakan akhir baris di awal fungsi — hal yang memang selalu dilakukan browser, jadi tampilan tidak berubah.
    - **Status:** ✅ **Selesai & Diverifikasi (2026-09-10).**
      - **Uji browser dengan kode yang ASLI:** fungsi diambil langsung dari berkas — versi terakhir yang di-commit (lama) dan versi kerja (baru) — lalu dirender di browser sungguhan. Untuk tiap kasus diperiksa tiga hal: teks yang tampil sama persis dengan aslinya, tidak ada elemen HTML selain span pewarna, dan setiap span punya peran yang benar.

        | Uji | Lama | Baru |
        |---|---|---|
        | `escapeHtml`: JSX, `<img onerror>`, `<script>`, `a < b && c > d`, komentar HTML | 5/5 rusak (4 membentuk tag sungguhan) | 5/5 utuh |
        | Kontrol: teks tanpa tag | utuh | utuh |
        | Pewarna: URL di JSON, `'#fff'` + `// warna`, `"a // b"` + `/* c "d" */`, `"http://a#b"  # komentar` di Python | 0/4 benar | 4/4 benar |
        | Pewarna: kata kunci di dalam komentar tidak diwarnai | benar | benar |
        | Pewarna: 8 kasus lain (kutip tak tertutup, kutip ter-escape, prosa `.md`, JSX, CSS, YAML, backtick multi-baris, akhir baris `\r\n`) | — | 8/8 |

        Kasus `\r\n` ditambahkan setelah Bug 3 tertangkap. Total pewarna baru **13/13**. Empat berkas nyata dari repo (`FileExplorer.jsx` 23 KB, `package-lock.json` 34 KB, `RepositoryReaderService.js`, `frontend/index.html`) tampil utuh huruf per huruf, masing-masing ≤4 ms. Berkas lolos kompilasi esbuild.
      - **Dikonfirmasi Owner di aplikasi desktop:** `FileExplorer.jsx` kini menampilkan `<div className=…>`, `<button onClick=…>`, `</React.Fragment>` sebagai teks; di `package-lock.json`, baris `"resolved": "https://registry.npmjs.org/…"` kuning utuh sampai akhir.
    - **Keterbatasan:** regex di kode JS (misalnya `/\/\//g`) masih bisa salah warna — membedakan regex dari tanda bagi butuh parser penuh; versi lama pun salah di situ. String tiga-kutip Python dibaca sebagai beberapa string pendek.
    - **Dicatat, tidak dikerjakan:**
      - GitHub melayani sekitar 60 permintaan per jam per IP tanpa token; setiap klik folder di versi web memakai satu.
      - IPC `fs:readFile` di `main.cjs` menerima path absolut apa pun, jadi bisa membaca berkas di luar folder proyek. Pintu ini dipakai bersama fitur lain, bukan hanya File Explorer.
    - **✅ Versi web terbukti (2026-09-10):** setelah push `c2abaf2`, Owner membuka File Explorer versi web (sumber GitHub API) dan melaporkan berhasil. Catatan "belum terbukti" di Item 59 dan 60 tertutup.

61. **Database 238 MB → 32 MB — Kuota Supabase Dimakan Log Sistem, Bukan RAG (2026-09-10):**
    - **Berawal dari pertanyaan Owner:** kuota database Supabase gratis hanya 500 MB. Kalau PDF/Word diunggah penuh ke RAG, ruangnya cepat habis; kalau diringkas, RAG jadi kurang efektif — dokumen yang ada sekarang memang pernah diringkas oleh DeepSeek dan hasilnya kurang lengkap. Apa solusinya?
    - **Diukur dulu, bukan ditebak.** Database 238 MB, tapi **seluruh RAG hanya 9,3 MB** (46 dokumen, 515 potongan). **207 MB (87%) adalah log sistem:**

      | Isi | Ukuran | Sebab |
      |---|---|---|
      | `net._http_response` | 121 MB | Hanya 24 baris — sisanya ruang kosong. pg_net menghapus baris tiap 6 jam, tapi ruangnya tidak dikembalikan; dibengkakkan jadwal yang memanggil HTTP tiap menit. |
      | `cron.job_run_details` | 86 MB | 141.522 baris riwayat jalan pg_cron sejak 31 Mei, tidak pernah dibersihkan. **132.160** di antaranya dari jadwal No. 2 (`cron-agent`, tiap menit, 1.440×/hari) yang sudah dihapus 31 Agustus tapi riwayatnya tertinggal. |
      | Seluruh RAG | 9,3 MB | — |

    - **Temuan tentang RAG:** yang disimpan hanya teks hasil ekstraksi — foto, grafik, dan berkas asli tidak ikut (Storage hanya berisi 838 KB, semuanya bucket `conversions`). Yang besar adalah **vektornya**: `gemini-embedding-2` menghasilkan 3.072 angka ≈ **12 KB per potongan, 10× teksnya** (±1,2 KB). Perkiraan: dokumen 47 halaman ≈ 1,5 MB di RAG; setelah pembersihan, ruang cukup untuk ratusan dokumen seukuran itu **disimpan penuh**. Kesimpulan untuk Owner: jangan ringkas teks — kalau suatu saat perlu berhemat, kecilkan vektornya (Gemini mendukung 768 dimensi, 4× lebih kecil; butuh vektorisasi ulang dan menyentuh jalur embedding memori semantik — belum dikerjakan).
    - **Temuan keamanan sampingan:** setiap baris `cron.job_run_details` menyimpan salinan perintah jadwal, termasuk **header Authorization**. Riwayat jadwal No. 2 berarti 132 ribu salinan kunci di tabel log. Isinya tidak ditampilkan; terbuang bersama pembersihan.
    - **Dikerjakan dengan izin Owner, setelah pratinjau per jadwal ditunjukkan:**
      - **A.** `delete from cron.job_run_details where start_time < now() - interval '7 days'` — **140.842 baris**, semuanya berstatus `succeeded` (No. 2: 132.160, No. 3 health-checker: 8.534, No. 6: 77, No. 1: 55, No. 4: 13, No. 5: 3). 680 baris 7 hari terakhir disisakan. Jadwalnya sendiri tidak disentuh. Selisih satu baris dari pratinjau (140.841) adalah log health-checker yang melewati batas 7 hari di sela pratinjau dan eksekusi.
      - **B.** `vacuum full` pada kedua tabel. Menghapus baris saja tidak menurunkan angka kuota — ruang bekas hanya ditandai boleh dipakai ulang oleh tabel yang sama. `net._http_response` tidak dihapus barisnya (24 baris tetap); hanya ruang kosongnya dibuang. Hak `MAINTAIN` akun `postgres` atas kedua tabel diperiksa lebih dulu.
      - **C.** Migrasi `20260910144900_cleanup_cron_history_weekly.sql`: jadwal No. 7 `cleanup-cron-history-weekly`, Minggu 00:30 UTC (07:30 WIB), menghapus riwayat lebih dari 7 hari. Tanpa `vacuum full` — pada kondisi stabil tabel hanya berisi ±700 baris, ruang bekas dipakai ulang oleh autovacuum. Jadwal No. 1–6 dibuat lewat dashboard dan tidak tercatat di repo; ini jadwal pertama yang tercatat.
    - **Status:** ✅ **Selesai & Diverifikasi (2026-09-10).**

      | | Sebelum | Sesudah |
      |---|---|---|
      | **Database** | **238 MB** | **32 MB** |
      | `cron.job_run_details` | 86 MB, 141.522 baris | 248 KB, 680 baris |
      | `net._http_response` | 121 MB, 24 baris | 72 KB, 24 baris |
      | RAG (`documents` / `document_chunks`) | 46 / 515 | 46 / 515 |
      | Jadwal aktif | 4 | 5 (4 lama tetap aktif + No. 7) |

      Jadwal No. 7 tercatat aktif dengan user `postgres`; perintahnya dijalankan sekali secara manual: tanpa error, 0 baris (log tertua tersisa 3 September).
    - **Belum terbukti:** jadwal No. 7 berjalan sendiri — pertama kali Minggu 13 September 07:30 WIB; cek di `cron.job_run_details` dengan `jobid = 7`.
    - **Dicatat, tidak dikerjakan:** fallback embedding OpenAI di `embedding_adapter.ts:86-90` memaksa `dimensions: 768` dengan komentar "agar cocok dengan Gemini" — sisa masa ketika vektor Gemini masih 768; kolom vektor kini 3.072, jadi hasil fallback itu tidak akan cocok. `rag-process` sendiri memakai `vector_utils.ts` (Gemini langsung), tidak lewat adapter ini; perlu diperiksa jalur mana yang masih memakainya. → **Dikerjakan di Item 62:** fallback dihapus, bukan dinaikkan ke 3.072.

62. **Fallback Embedding OpenAI Dihapus — Cadangan dari Model Lain Tidak Pernah Bisa Benar (2026-09-10):**
    - **Permintaan Owner:** kerjakan catatan Item 61 — fallback `OpenAIEmbeddingAdapter` mematok 768 dimensi, sementara kolom vektor 3.072.
    - **Akar masalahnya model, bukan dimensi.** Vektor tiap model embedding hidup di ruang maknanya sendiri. Vektor kueri OpenAI yang dibandingkan dengan vektor Gemini di database menghasilkan skor kemiripan tanpa arti — walau dimensinya disamakan (`text-embedding-3-large` bisa 3.072). Menaikkan angkanya hanya akan mengubah error yang jujur menjadi hasil pencarian ngawur yang diam. Mengganti model embedding berarti memvektorkan ulang semua baris, bukan menambah cadangan. Maka fallback **dihapus**.
    - **Temuan saat menelusuri:**
      - **Dua kaskade embedding.** `rag/embedding.ts` (`generateEmbedding`) punya penjaga 3.072, jadi fallback selalu ditolak di sana. Tapi `request_pipeline.ts` — pencarian memori di setiap chat dengan RAG menyala — punya **salinan kaskade sendiri tanpa penjaga** yang menerima vektor sepanjang apa pun.
      - **Fallback hanya hidup lewat kunci BYOK pengguna.** `OPENAI_API_KEY` sistem tidak ada (Item 51), tapi `request_pipeline.ts:192` (sebelum perubahan: baris 218) mengisi `rctx.keys.openAI` dengan kunci pengguna yang chat dengan provider openai. Saat Gemini gagal, embedding internal sistem ditagihkan ke kunci pengguna — bertentangan dengan keputusan Item 51 bahwa embedding memakai kunci sistem — lalu vektor 768 itu ditolak database.
    - **Perubahan (4 berkas, +36 −100):**
      - `embedding_adapter.ts`: kelas `OpenAIEmbeddingAdapter` dihapus, diganti komentar yang menjelaskan kenapa cadangan lintas model tidak bisa dipakai.
      - `adapter_registry.ts`: adapter itu tidak lagi didaftarkan.
      - `rag/embedding.ts`: urutan adapter hanya `gemini_embedding`; komentar lama ("fallback disengaja ditolak penjaga") diganti; ditegaskan sebagai satu-satunya pintu embedding di agent-process (`rag-process` memakai `vector_utils.ts` dengan model yang sama).
      - `request_pipeline.ts`: salinan kaskade diganti pemanggilan `generateEmbedding` + pemeriksaan `EMBEDDING_DIMENSIONS`; gagal → melempar error yang ditangkap blok RAG yang sudah ada (pencarian dilewati, chat tetap jalan).
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi (2026-09-10).**
      - **Uji perilaku dengan kode ASLI** lama vs baru di Deno, `fetch` palsu (tanpa panggilan Google/OpenAI sungguhan):

        | Kasus | Lama | Baru |
        |---|---|---|
        | Gemini sehat | 3.072 dimensi | 3.072 dimensi |
        | Gemini gagal, tanpa kunci OpenAI | gagal jujur (2 panggilan Gemini) | sama |
        | **Gemini gagal, pengguna BYOK openai** | **kunci pengguna dipanggil ke OpenAI**; `openai_embedding` terdaftar | tidak ada panggilan OpenAI; hanya `gemini_embedding` terdaftar |

      - **Database menolak vektor 768:** `different vector dimensions 3072 and 768` — bukti bahwa jalur lama berakhir error pada pencarian memori pengguna BYOK.
      - **Pemeriksaan tipe Deno:** 81 error sebelum, 81 sesudah — tidak ada yang baru. (Perbandingan pertama sempat menunjukkan 83 vs 81; selisih dua ternyata artefak salinan baseline yang tidak menyertakan `frontend/`, yang diimpor `context_builder.ts`.)
      - **Deploy** oleh Owner: `agent-process` versi **405**, aktif 22:02:13 WIB, `verify_jwt` tetap `false`.
      - **Log produksi, dua sisi:** chat pertama pukul 22:04 WIB tidak menyentuh blok ini — tombol RAG workspace mati (dikonfirmasi Owner), sehingga `ragEnabled=false`. Setelah RAG dinyalakan, dua chat (22:08 dan 22:10 WIB) sama-sama mencetak `🔍 [RAG] Generating embedding for vector search...` **tanpa** baris `Generating embedding via GeminiEmbeddingAdapter…` yang selalu dicetak kode lama, lalu `No relevant memories found` tanpa `Embedding gagal` maupun `Vector search error` — vektor 3.072 dibuat dan `match_memories` jalan. Keduanya POST 200. Kesepuluh memori Owner di `user_memories` berdimensi 3.072.
    - **Diamati, di luar perubahan ini:**
      - **Pencarian memori vektor di server belum pernah menemukan hasil di produksi.** *"minuman apa yang saya suka?"* tidak lolos ambang 0,70 terhadap *"saya suka kopi"* / *"saya juga suka teh"*; `match_memories` hanya menyaring pemilik dan skor, tanpa filter lain. Ambang 0,70 dikalibrasi dengan pernyataan lawan pernyataan (Item 46), padahal kueri biasanya berbentuk pertanyaan. Jawaban Owner tetap benar (kopi hitam, teh) karena memori datang dari jalur lain (`[MemoryManager] … memoryFetchCount: 1`).
      - Saat pencarian server kosong, `request_pipeline.ts` menimpa `globalMemory` kiriman frontend dengan *"Tidak ada memori yang relevan."* — konteks dari frontend bisa ikut terbuang. Dibaca dari kode, dampaknya belum diukur. **→ Dikoreksi di Item 65:** konteks frontend tidak terbuang (sudah tersalin ke `ctx.request` lebih dulu); yang tertimpa hanya penanda "retrieval aktif". Diperbaiki di sana.
      - `CapabilityRegistry` menyimpan adapter di satu `Map` statis yang dikosongkan dan diisi ulang setiap permintaan. Dua permintaan bersamaan di isolate yang sama bisa saling memakai adapter yang dibuat dengan kunci pengguna lain (termasuk BYOK). Dibaca dari kode, belum terbukti terjadi — layak jadi item tersendiri karena lebih serius dari fallback ini.
      - Setiap chat mencatat `Audit log setup error: TypeError: rctx.tasks.add is not a function` (`memory_manager_v1.ts:15`) — log audit memori tidak tertulis.
      - Kunci Gemini #0 masih 403 (Item 51).

63. **Embedding Pindah ke OpenRouter — Uji Unggah Gagal, Uji Tanding Empat Model, dan Uji Dokumen HCDP (2026-09-10):**
    - **Berawal dari pertanyaan Owner:** buku PDF 5 MB memakan berapa MB setelah di-embed?
    - **Ukuran ditentukan jumlah huruf, bukan ukuran berkas.** Diukur dengan PDF nyata dan `chunkText` yang disalin persis dari `vector_utils.ts`:

      | PDF | Berkas | Halaman | Huruf | Potongan |
      |---|---|---|---|---|
      | DOKUMEN HCDP 2025-2026 | 7,4 MB | 47 | 138.011 (±2.900/halaman) | 33 |
      | CamScanner (hasil scan) | 0,27 MB | 1 | 0 | 0 |

      Per potongan ±20 KB: vektor 3.072 angka ±12 KB (tetap, apa pun panjang teksnya), teks ±4.300 huruf ±2–4 KB setelah kompresi Postgres, overhead ±2–5 KB. HCDP ≈ **0,7 MB**; buku 300 halaman ≈ ±4 MB — kira-kira sebesar PDF-nya atau lebih kecil. PDF hasil scan menghasilkan **nol** potongan (butuh OCR, belum ada). **Koreksi terbuka:** perkiraan sebelumnya "47 halaman ≈ 1,5 MB" terlalu besar, karena memakai rata-rata potongan dokumen yang sudah diringkas (±1.600 huruf), bukan ±4.300 huruf aturan yang berlaku.
    - **Tidak ada jalur unggah PDF yang benar:**
      - **Research App** hanya menerima `.txt .md .csv .json .html .xml` (`ResearchApp.jsx:190`) — PDF tidak bisa dipilih.
      - **mametlite (live, pengguna luar)** menerima `.pdf .docx .txt`, tapi kedua cabang memanggil `file.text()` (`mametlite/src/App.jsx:211-215`) — yang dikirim ke RAG adalah **isi biner mentah**, bukan tulisannya. Sudah begitu sejak mametlite dibuat (`bc85208`, 2026-06-04).
      - Database **belum tercemar**: lima PDF yang ada (30 Mei–2 Juni) diunggah sebelum mametlite lewat jalur lama; diperiksa, 0 potongan berpenanda biner PDF, 1,5–4,7% karakter di luar huruf/angka/tanda baca. Sejak itu tidak ada PDF masuk.
    - **Uji unggah HCDP (sebagai `.txt`, lewat Research App): ❌ gagal.** Teks diekstrak lokal dengan pdf.js ke `C:\Users\HP\Downloads\DOKUMEN HCDP 2025-2026 (teks).txt` (140 KB, 33 potongan diharapkan). Kondisi awal dicatat: DB 32 MB, 46 dokumen, 515 potongan.

      | WIB | Log `rag-process` |
      |---|---|
      | 22:29:06 | `Processing 33 chunks…` — cocok dengan perkiraan |
      | 22:29:50 | `Gemini key #1 hit 429` — jatah Gemini habis setelah ±44 detik |
      | 22:29:54 | dua 429 lagi → `POST 500` |

      Sebab: dari tiga kunci Gemini sistem hanya #1 yang hidup (#0 dan #2 403, Item 51), dan `getGeminiEmbeddingWithRetry` hanya menunggu 1 lalu 2 detik sebelum menyerah — tidak cukup untuk jatah per menit. **Rollback bersih:** 0 dokumen, 0 potongan tertinggal. **Pesan gagal hilang:** `rag-process` mengirim alasan lengkap, tapi Research App hanya menampilkan *"Edge Function returned a non-2xx status code"* — supabase-js melempar error sebelum pemeriksaan `data?.error` (`ResearchApp.jsx:135`) tercapai.
    - **Usul Owner: embedding lewat OpenRouter dengan saldo, model termurah yang tersedia.** Masuk akal — jatah berbayar jauh lebih longgar, satu penyedia, kunci Gemini peninggalan era AI Agent bisa dipensiunkan. Syaratnya dari Item 62: satu model untuk semua vektor. Daftar `openrouter.ai/api/v1/embeddings/models` (33 model): model gratis kebanyakan hanya menerima 512 token (potongan kita ±1.200) dan punya batas per menit; `google/gemini-embedding-2` justru termahal ($0,20/1 juta token).
    - **Uji tanding memori — dijalankan Owner di console Mamet OS desktop dengan kunci OpenRouter miliknya.** Kode mengambil kunci langsung dari `localStorage.maef_secure_vault`; nilainya tidak dicetak dan tidak melewati Claude. Bahan: 10 memori Owner, 7 pertanyaan berjawaban pasti, 3 kontrol.

      | Model | Tebakan benar | Dimensi | $/1 juta token |
      |---|---|---|---|
      | `google/gemini-embedding-2` | 7/7 | 3.072 | 0,20 |
      | `baai/bge-m3` | 7/7 | 1.024 | 0,01 |
      | `openai/text-embedding-3-small` | 6/7 | 1.536 | 0,02 |
      | `qwen/qwen3-embedding-4b` | 6/7 | 2.560 | 0,02 |

      Rata-rata selisih jawaban benar vs salah terdekat: bge-m3 0,140, Gemini 0,111. **Sidik vektor identik:** enam angka pertama "saya suka kopi" dari Gemini lewat OpenRouter (`0.00177, -0.01371, 0.00704, -0.00496, -0.00889, 0.01799`) sama persis dengan yang tersimpan di `user_memories` — lewat OpenRouter model yang sama menghasilkan vektor yang sama, data lama tetap berlaku. **Misteri Item 62 terjawab:** *"minuman apa yang saya suka?"* skornya 0,683 terhadap "saya suka kopi" — tertolak tipis oleh ambang memori 0,70; hanya 2–3 dari 7 pertanyaan yang lolos ambang itu. Tapi kontrol tak berhubungan mencapai 0,535, jadi untuk memori pendek jaraknya tipis.
    - **Keputusan Owner:** **jalan A** — tetap `google/gemini-embedding-2`, hanya jalurnya pindah ke OpenRouter, tanpa migrasi data. (Sempat memilih B/bge-m3, lalu dikoreksi sendiri.) **Yang membayar: pengguna, dengan kunci OpenRouter-nya sendiri.** Ini membalik keputusan Item 51 bahwa embedding memakai kunci sistem. Konsekuensi yang disadari: pengguna — termasuk mametlite — yang belum memasang kunci OpenRouter tidak bisa memakai RAG.
    - **Uji dokumen HCDP dengan jalan A — dijalankan Owner di console desktop**, membaca berkas `(teks).txt` lewat `electronAPI.readFile`. Potongan identik dengan peta lokal (33; panjang #11 dan #30 = 4.494 dan 4.500).

      | Gelombang | Potongan | Waktu | Token | Biaya |
      |---|---|---|---|---|
      | 0–10 | 11 | 1,5 s | 12.075 | $0,0024 |
      | 11–21 | 11 | 0,9 s | 13.922 | $0,0028 |
      | 22–32 | 11 | 1,0 s | 12.298 | $0,0025 |
      | **Total** | **33** | **3,4 s** | **38.411** | **$0,0077** |

      **0 kali 429, 0 percobaan ulang.** Dokumen yang sama gagal di `rag-process` setelah 44 detik. **Temuan terbesar:** batas waktu buku tebal bukan sifat bawaan — penyebabnya `rag-process` mengirim potongan satu per satu dengan jeda 0,6 detik. Berkelompok, buku ±200 potongan ≈ ±20 detik, jauh di bawah batas 150 detik. Harga $0,20/1 juta token terkonfirmasi dari `usage.cost`.

      Ketepatan (8 pertanyaan berjawaban pasti, 2 kontrol):

      | | Hasil |
      |---|---|
      | Potongan benar di urutan 1 / 3 teratas / 5 teratas (`ragTopK` mode Assistant) | 6/8 · 7/8 · **8/8** |
      | Jebakan daftar isi: "tugas pokok BKPSDM" ada di judul daftar isi #1, isinya di #11 | tidak tertipu — #11 teratas (0,803), #1 tidak masuk 3 besar |
      | Skor potongan benar | 0,649–0,803 |
      | Kontrol (rendang, Piala Dunia) | maks 0,455 |

      Dua yang tidak di urutan pertama kalah oleh tetangga setopik: anggaran klaster sertifikasi (#30) di urutan 4 di bawah tiga potongan anggaran lain; definisi standar kompetensi jabatan (#17) di urutan 2 di bawah profil kompetensi (#15).
    - **Ambang dokumen sedikit terlalu ketat.** `execution_context.ts:16-19` memakai 0,60 / 0,65 / 0,68 menurut panjang pertanyaan. Pertanyaan anggaran (68 huruf → 0,65) punya potongan benar 0,649 — terbuang tipis. Ambang tetap ±0,55 meloloskan 8/8 dengan jarak 0,1 dari kontrol. Untuk dokumen, jarak nyambung vs tidak nyambung jauh lebih lebar daripada untuk memori pendek.
    - **Status:** ✅ **Uji selesai; keputusan diambil. Belum ada kode yang diubah.** Biaya uji dari saldo OpenRouter Owner: ±$0,008.
    - **Rencana pengerjaan jalan A (belum dikerjakan):**
      1. `rag-process`: OpenRouter `google/gemini-embedding-2` dengan kunci pengguna, kirim berkelompok (±10–16 potongan per permintaan), tanpa jeda 0,6 s, tunggu dengan benar saat 429, pesan jelas bila kunci tidak ada.
      2. `agent-process` (pencarian memori & dokumen, endpoint embed): kunci OpenRouter pengguna lewat **fungsi terpisah yang menerima kunci langsung**, bukan lewat `CapabilityRegistry` — kalau kunci pengguna masuk ke `Map` statis bersama (Item 62), risiko tertukar antarpengguna menjadi nyata.
      3. Frontend (Research App, embed memori) dan mametlite: kirim kunci OpenRouter pengguna; tampilkan alasan gagal yang sebenarnya.
      4. Ambang dokumen → ±0,55. Ambang memori (0,70) diputuskan terpisah.
      5. Tanpa migrasi data: 515 potongan dan 10 memori lama tetap dipakai.
    - **Terbuka, terpisah:** ekstraksi PDF/DOCX yang benar untuk mametlite dan Research App (pdf.js sudah terpasang di frontend); mametlite saat ini akan mengisi RAG dengan sampah biner bila pengguna mengunggah PDF.
    - **→ Rencana no. 1 dikerjakan di Item 64.**

64. **`rag-process` Lewat OpenRouter dengan Kunci Pengguna — Terbukti di Produksi; dan Vektor Dokumen yang Tidak Pernah Dipakai Chat (2026-09-10 s.d. 2026-09-11):**
    - **Rencana Item 63 no. 1**, commit `fb34939`.
    - **`rag-process` ditulis ulang:**
      - Embedding `google/gemini-embedding-2` lewat OpenRouter dengan header `x-byok-openrouter` — pengguna membayar sendiri. Tanpa kunci → `400 OPENROUTER_KEY_REQUIRED` dengan pesan cara memasangnya.
      - Potongan dikirim **berkelompok** (12 per permintaan), tanpa jeda 0,6 detik.
      - 429/5xx ditunggu dengan benar: sesuai `Retry-After` (maks 30 s), selain itu 2/4/8 s, maksimal 4 percobaan.
      - **Anggaran waktu 110 s**, di bawah batas wall-clock 150 s. Kalau habis, berhenti sendiri dan membatalkan dokumen (`WAKTU_HABIS`, saran unggah per bab) — tidak pernah dihentikan platform dengan dokumen setengah jadi tertinggal.
      - **🔒 Celah keamanan ditutup:** fungsi ini `verify_jwt=false` dan memakai service role, tapi dulu **mempercayai `userId` dari body** — siapa pun yang tahu URL-nya bisa menulis dokumen ke akun orang lain. Kini identitas diambil dari token sesi (`auth.getUser`), `userId` body yang berbeda ditolak `403`, dan `spaceId` wajib milik pengguna itu.
      - PDF/DOCX yang dibaca mentah ditolak **sebelum ada biaya** (`%PDF-`, `PK\x03\x04` lengkap dengan byte kontrolnya agar teks berawalan "PKH …" tidak ikut tertolak, atau >1% karakter U+FFFD).
    - **`vector_utils.ts`:** `embedLewatOpenRouter(teks[], kunci)` menerima kunci sebagai argumen — bukan lewat `CapabilityRegistry` yang ber-`Map` statis bersama — siap dipakai ulang untuk rencana no. 2. `getGeminiEmbeddingWithRetry` dihapus.
    - **Research App & mametlite:** mengirim kunci OpenRouter pengguna (Vault `openrouter` / `localStorage x-byok-openrouter`) dan menampilkan **alasan gagal yang sebenarnya** dari body jawaban (`error.context.json()`), bukan lagi *"non-2xx status code"*.
    - **mametlite — dua pengaman agar perubahan ini tidak menghilangkan dokumen:** alur "timpa dokumen bernama sama" menghapus dokumen lama **sebelum** unggah. Maka unggahan tanpa kunci OpenRouter, atau berkas non-`.txt`, kini ditolak di awal — sebelum apa pun dihapus.
    - **Uji kode asli tanpa jaringan** (fetch dan setTimeout dipalsukan): 11 kasus `embedLewatOpenRouter` lulus — sukses (model, Bearer, urutan vektor dipulihkan walau jawaban diacak), 429 dengan `Retry-After` 1 s, 429 terus-menerus (tunggu 2/4/8 s lalu `BATAS_PERMINTAAN`), saran 45 s dibatasi 30 s, tunggu melebihi sisa anggaran (`WAKTU_HABIS` tanpa menunggu), 401, 402, 500→sukses, dimensi 768, jumlah vektor kurang. 6 kasus deteksi biner lulus: HCDP `.txt`, teks berawalan "PKH …", dan teks dengan 5 karakter pengganti **lolos**; PDF HCDP, DOCX HCDP, dan PDF scan mentah **ditolak**. `deno check`: `rag-process` 0 error; `agent-process` tetap 81.
    - **Kejadian saat deploy:** Owner men-deploy `rag-process` dan push sebelum commit dibuat, sehingga push tidak membawa apa-apa — `rag-process` baru (deploy memakai berkas lokal) sempat berjalan bersama mametlite live versi lama, persis jendela yang diperingatkan: unggahan mametlite ditolak, dan alur "timpa" bisa menghapus dokumen lama. Commit `fb34939` dibuat segera lalu di-push Owner. Log `rag-process` di jendela itu **kosong** — tidak ada pengguna yang terkena.
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi.** `rag-process` versi 61, aktif 23:06 WIB, `verify_jwt` tetap `false`.

      | Uji produksi | Hasil |
      |---|---|
      | Preflight CORS dari origin mametlite | `200`, `x-byok-openrouter` diizinkan |
      | POST tanpa token dengan `userId` palsu | `401 UNAUTHORIZED` — dulu diterima |
      | **Unggah `DOKUMEN HCDP 2025-2026 (teks).txt` lewat Research App** (23:12:09) | **33/33 potongan dalam 5,6 s** — dokumen yang sama gagal setelah 44 s di Item 63 |
      | Isi database | 33 baris, semua 3.072 dimensi, 0 tanpa vektor, 143.276 huruf; dokumen milik Owner, space milik Owner |

    - **Dokumen masuk ke "Observasi Pasar Freelance …", bukan "My Core Knowledge".** Bukan akibat perubahan ini: Research App otomatis memilih space **terbaru** saat dibuka (`ResearchApp.jsx:27-33`) dan unggahan selalu masuk ke space terpilih.
    - **LOOKUP melewati RAG walau tombol RAG menyala.** *"Berapa jumlah desa dan kelurahan di Kabupaten Ogan Komering Ulu?"* diklasifikasi LOOKUP (≤80 huruf, diawali kata tanya — `RequestClassifierService.js:239-262`), dan `_handleLookup` mengirim `ragEnabled: false`, `globalMemory: ''` (`AssistantService.js:609-618`). Asisten menjawab tidak punya datanya.
    - **Koreksi terbuka:** saya sempat menyimpulkan dari `routing_decider.ts:29-37` bahwa pencarian mencakup semua space. Hanya benar untuk sebagian jalur — LOOKUP mengirim `workspaceTarget: null`, dan log mencatat `[RAG_SCOPE_USED]: CORE | [WORKSPACE_ID]: 4a233d88…`. Kesimpulan dari satu cabang kode, bukan dari log.
    - **Uji chat dokumen — jawaban benar, jalurnya tidak seperti yang diharapkan.** Owner bertanya *"Menurut dokumen HCDP, berapa jumlah desa dan kelurahan …"* (tidak diawali kata tanya → mode ASSISTANT) dan jawabannya benar. Log dan data:
      1. `KnowledgeService` mencocokkan **kata** "hcdp" dengan **judul** berkas (`Title match prioritized … (hits: 1)`), lalu mengambil `limit` = `effectiveRagMatchCount` = **5** potongan tanpa urutan relevansi dan memberinya skor keyakinan buatan 0,95→0,75 (`KnowledgeService.js:125-172`). Direproduksi di database: 5 potongan itu **#0–#4** — sampul, pengantar, dua halaman daftar isi, daftar gambar. Fakta "143 Desa" (#5) **tidak ada di sana**.
      2. `RetrievalStrategyService` **Kasus A** lalu melakukan *neighbor expansion*: mengambil **seluruh** potongan dokumen dominan (`RetrievalStrategyService.js:188-204`) — 33 potongan, 143 ribu huruf — ke dalam prompt.
      3. **Biayanya** (`api_usage`, 23:19:45 WIB): **76.895 token masuk, $0,0112, ±71 detik** untuk satu pertanyaan — lebih mahal daripada memvektorkan seluruh HCDP sekali ($0,0077).
    - **Temuan terbesar: vektor dokumen tidak pernah dipakai di chat.** `context_builder.ts:83-104` — mode **ASSISTANT dan LITE (mametlite)** memakai `KnowledgeService` (pencocokan kata `ilike`); **hanya mode ENGINEER** yang memvektorkan pertanyaan dan memanggil `match_documents`. Sejak Item 64 pengguna membayar untuk memvektorkan dokumen yang tidak pernah dicari berdasarkan makna di chat. Uji HCDP Item 63 (8/8 di 5 teratas) mengukur jalur yang tidak dipakai chat. Dokumen yang pertanyaannya tidak memuat kata dari judul tidak ditemukan sama sekali.
    - **Item 44 (prompt 15–20 ribu token, 99,3% belanja) — mekanisme terlihat:** Kasus A menyeret seluruh dokumen yang judulnya cocok. Terbukti untuk permintaan 23:19:45; hari-hari sebelumnya belum dicocokkan.
    - **Belum terbukti:** unggah dari mametlite live dengan kode baru (belum diuji Owner).
    - **Berikutnya — beberapa item ternyata satu masalah:** rencana Item 63 no. 2 dan no. 4, LOOKUP yang melewati RAG, dan Item 44 disatukan menjadi **chat ASSISTANT dan LITE mencari dokumen berdasarkan makna**: pertanyaan divektorkan dengan kunci pengguna (±$0,000004), 5 potongan terbaik dengan ambang ±0,55, Kasus A dibatasi atau dihapus. Perkiraan ±6 ribu token alih-alih ±77 ribu per pertanyaan dokumen. **Sebelumnya:** periksa `CapabilityRegistry` (`Map` statis bersama, Item 62), karena kunci pengguna akan masuk ke `agent-process`.
    - **→ Dikerjakan di Item 65.**

65. **RAG Dituntaskan: Chat Mencari Dokumen Berdasarkan Makna, Embedding dengan Kunci Pengguna (2026-09-11):**
    - **Permintaan Owner:** "tuntaskan dulu masalah RAG". Commit `51e1885` (RAG) dan `d80d8db` (verifikasi LOOKUP).
    - **Pemetaan sebelum menulis kode** membongkar dua hal lagi:
      - `document_chunks` **tidak punya kolom urutan** (tak ada `chunk_index`/`created_at`) dan `id`-nya UUID acak. "Neighbor expansion" Kasus A (`order('id')` dengan komentar "Asumsikan id berurutan") tidak pernah bisa mengambil tetangga — ia menyeret seluruh dokumen dalam urutan acak.
      - Frontend **juga** menjalankan RAG dokumen sendiri (`RetrievalOrchestrator` Tier 1, pencocokan kata, dipangkas 4.000 huruf) dan mengirimnya sebagai `globalMemory` — dokumen masuk ke prompt **dua kali**.
    - **Koreksi di tengah jalan, sebelum ada kode yang diubah:** saya sempat menyimpulkan server "menimpa konteks frontend" (catatan Item 62). **Keliru.** `ctx.request.globalMemory` sudah tersalin dari kiriman frontend di `request_pipeline.ts:172`, sebelum blok RAG, dan salinan itulah yang dipakai `context_builder`. Yang ditimpa hanya `parsed.globalMemory`, yang **hanya menentukan satu penanda**: kalimat *"SISTEM RETRIEVAL AKTIF"* vs *"BATAS PENGETAHUAN ANDA: akhir 2024"*. Akibat nyatanya dua: (1) saat tak ada memori cocok, penanda dihitung dari teks *"Tidak ada memori yang relevan."*, sehingga model diberi tahu pengetahuannya berhenti di 2024 walau dokumen/web sudah disuntikkan; (2) **memori hasil pencarian vektor tidak pernah masuk prompt** — hanya menyalakan penanda.
    - **Perubahan:**

      | # | Sebelum | Sesudah |
      |---|---|---|
      | 1 | Embedding lewat `GeminiEmbeddingAdapter` (kunci Gemini sistem, 1 dari 3 hidup) melalui `CapabilityRegistry` | `generateEmbedding` → `embedLewatOpenRouter` dengan `rctx.keys.openRouterByok` (header `x-byok-openrouter` saja — **tidak pernah** `keys.openRouter`, yang jatuh ke kunci sistem bila provider chat bukan openrouter). `embedding_adapter.ts` dan jalur embedding registry dihapus |
      | 2 | ASSISTANT/LITE: pencocokan kata; hanya ENGINEER memakai vektor | **Semua mode** (ASSISTANT, LOOKUP, LITE, ENGINEER) memanggil `match_documents`. Vektor pertanyaan **dipakai ulang** dari pencarian memori — satu embedding per pesan. Hasil vektor tidak dilewatkan `RetrievalStrategyService` (Kasus B membatasi potongan per dokumen). Cadangan pencocokan kata hanya bila vektor tak tersedia |
      | 3 | Ambang 0,60/0,65/0,68 menurut panjang pertanyaan | **0,55 tetap** (data Item 63) |
      | 4 | `p_space_id` = space CORE setiap kali klien tak mengirim workspace (LOOKUP) | Dibatasi hanya bila `scope === 'WORKSPACE'` (UUID dari UI atau nama space disebut); selain itu semua space milik pengguna |
      | 5 | Kasus A menyeret seluruh dokumen | Kasus A meneruskan potongan apa adanya (`case_a_passthrough`), "full-read" dihapus |
      | 6 | LOOKUP mengirim `ragEnabled: false` | `ragEnabled` sesuai tombol RAG workspace |
      | 7 | Penanda retrieval dihitung dari teks "Tidak ada memori yang relevan." | Dihitung dari konteks kiriman frontend + memori vektor; `parsed.globalMemory` tak lagi ditimpa |
      | 8 | Frontend menjalankan Tier 1 dokumen sendiri | `skipLocalKnowledge: true`; orkestrator dipanggil hanya bila Web menyala; panduan Tier 2 ("tidak ada dokumen lokal — jawab dari pengetahuan umum") dilewati selama RAG menyala agar tidak membantah dokumen dari server (`skipInternalFallback`) |
      | 9 | Embed memori (frontend) tanpa kunci pengguna | `MemoryGovernorService` mengirim `x-byok-openrouter` dari Vault; `AssistantService.buildHeaders` ikut mengirimnya bila provider chat bukan openrouter (hanya bila kunci provider chat ada, supaya `request_pipeline` tetap memakai provider pilihan) |

    - **Uji kode asli sebelum deploy** (Deno, `fetch` dipalsukan): embedding tanpa kunci pengguna → `[]` dan **0 panggilan jaringan**; dengan kunci → `openrouter.ai`, Bearer kunci pengguna, `google/gemini-embedding-2`, 3.072 dimensi, **kunci sistem tidak tersentuh**; kunci ditolak 401 → `[]`. `p_space_id`: CORE default berisi ID core → `null`; WORKSPACE eksplisit → ID itu; ambang 0,55, maks 5. Kasus A/B: 0 akses database. `deno check`: tetap 81 (dua error `execution_context.ts` bawaan lama yang bergeser dua baris).
    - **Produksi, putaran pertama (deploy `51e1885`, 20:18–20:20 WIB)** — tiga chat Owner, RAG menyala, tanpa kata "HCDP":

      | Chat | Jalur | Pencarian makna | Token prompt | Hasil |
      |---|---|---|---|---|
      | desa & kelurahan (tanpa "?") | LOOKUP | 5 potongan, teratas 0,751, vektor dipakai ulang | 6.723 | ❌ **"Verification Failed"** |
      | anggaran klaster sertifikasi | ASSISTANT | 5 potongan, teratas 0,681 | 17.369 | ✅ Rp927.500.000 |
      | desa & kelurahan (dengan "?") | ASSISTANT | 5 potongan, teratas 0,736 | 15.160 (12.010 cache, $0,00037) | ✅ 14 kelurahan, 143 desa |

    - **Kegagalan LOOKUP — efek samping perubahan ini.** Jawaban sudah jadi (26 token), lalu `HARD GATE` memblokirnya: `CHECK_002_SOURCE_TRACE_EXISTS`. Pengecualian chat natural hanya untuk ASSISTANT/LITE; dulu LOOKUP tak pernah membawa dokumen (tanpa bukti → WARN), kini membawa 5 potongan sehingga mode ketat menuntut kode jejak sumber. **Perbaikan `d80d8db`:** LOOKUP ditambahkan ke pengecualian `CHECK_002` **dan** `CHECK_003` — hanya di 002 akan membuatnya gagal di 003, karena cabang 003 menuntut format ID bila 002 PASS. Uji kode asli lama vs baru dengan jawaban natural + 5 bukti: LOOKUP FAIL → **PASS**; ASSISTANT PASS tetap; **ENGINEER (kontrol) FAIL tetap** — ketatnya tidak berkurang.
    - **Pertanyaan Owner — "terlalu cepat? karena tanpa '?'"** Keduanya bukan: log menunjukkan seluruh tahap selesai (embedding, 5 potongan, jawaban model) sebelum verifikasi memblokir, dan kegagalannya deterministik. Pengklasifikasi tidak melihat "?"; pertanyaan yang sama masuk LOOKUP di chat pertama dan CONVERSATION di chat ketiga karena syarat **riwayat ≤4 pesan**. Chat anggaran masuk CONVERSATION karena kata rujukan dicocokkan sebagai **potongan huruf**: "k**last**er" mengandung "last".
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi.** `agent-process` versi **407** (20:25 WIB, `verify_jwt` tetap `false`), chat baru kosong 20:29 WIB:

      | Chat | Jalur | Pencarian makna | Token prompt | Biaya | Verifikasi |
      |---|---|---|---|---|---|
      | desa & kelurahan | **LOOKUP** | 5 potongan, teratas 0,736 | **6.725** | $0,0010 | ✅ PASS — "14 kelurahan dan 143 desa" |
      | anggaran klaster | ASSISTANT | 5 potongan, teratas 0,681 | 17.392 | $0,0012 | ✅ Rp927.500.000 |

      **Dibanding Item 64:** pertanyaan desa yang sama dulu 90.116 token dan $0,0112 — dan hanya berhasil karena kata "HCDP" cocok dengan judul. Kini dijawab lewat **makna**, tanpa menyebut judul, walau dokumennya berada di space "Observasi Pasar": **±13× lebih sedikit token, ±11× lebih murah**.
    - **Menutup:** rencana Item 63 no. 2, 3, 4; temuan utama Item 64 (vektor dokumen tak dipakai chat, Kasus A, LOOKUP buta dokumen, cakupan space); jalur embedding Item 51 (kunci Gemini sistem tak lagi dipakai untuk embedding).
    - **Belum terbukti:** unggah/penulisan memori dengan embedding kunci pengguna (`MemoryGovernorService` → endpoint embed); chat mametlite (mode LITE) dengan pencarian makna; pengguna tanpa kunci OpenRouter (jalur cadangan pencocokan kata).
    - **Dicatat, belum dikerjakan:**
      - **Memori hasil pencarian vektor tidak pernah masuk prompt** — `match_memories` jalan di setiap chat, hasilnya hanya menyalakan penanda. Mengubah isi prompt memori di luar cakupan RAG dokumen; butuh keputusan.
      - **Sisa ±10 ribu token prompt dasar** di jalur ASSISTANT (konstitusi, identitas, riwayat) — lanjutan Item 44; LOOKUP hanya ±6,7 ribu termasuk 5 potongan dokumen.
      - **Perubahan perilaku Web:** frontend tak lagi menjalankan Tier 1, jadi saat tombol Web menyala Tier 3 (pencarian web) terpicu di setiap pesan — sama seperti perilaku saat RAG mati. Dulu dokumen yang "cukup" menahannya.
      - `CapabilityRegistry` (Map statis bersama) **belum diselidiki** untuk adapter chat; embedding sudah tidak lewat sana.
      - Kunci Gemini **#0 dan #1 kini 403** (log 20:19 WIB) — masih dipakai Intent Router, bukan embedding.
      - Pengklasifikasi mencocokkan kata rujukan sebagai potongan huruf ("last" dalam "klaster", "ku" dalam "buku", "ini" dalam "dinilai").
      - Log `[RAG_SCOPE_USED]: CORE` di `routing_decider` masih muncul — kini hanya label, pencarian memakai `p_space_id` null.
      - `ExecutionTraceService` meminta kolom `verification_audit_logs.metadata` yang tidak ada (400, dicatat non-fatal).
      - `rctx.tasks.add is not a function` di setiap chat (Item 62).

66. **Item 44 Diukur: Prompt Sistem Terkirim Dua Kali di Jalur Multi-Agen — Token Masuk Turun 50% (2026-09-11):**
    - **Permintaan Owner:** lanjut Item 44 — sisa ±10 ribu token prompt dasar di jalur Assistant yang tercatat di Item 65.
    - **Diukur dulu, bukan ditebak.** Perkiraan "±10 ribu token prompt dasar" berasal dari selisih LOOKUP (6.725 token) vs ASSISTANT (17.392 token) dengan 5 potongan dokumen yang sama. Tapi keduanya memakai model berbeda (`gpt-4o-mini` vs `deepseek-v4-flash`), dan tokenizer berbeda menghitung teks yang sama berbeda — selisih token tidak bisa dibaca sebagai selisih isi. Memangkas berdasarkan tebakan itu bisa memangkas bagian yang bukan penyebabnya.
    - **Alat ukur (commit `67da3da`):** log `[PROMPT_KOMPOSISI]` di `runLLM`/`runStreamLLM` (`llm_orchestrator.ts`) mencatat **jumlah huruf** tiap bagian prompt jawaban utama — dasar identitas/panduan, memori klien, kontrak blok 1–6 dengan RAG dipisah, riwayat, pesan. Hanya untuk prompt ber-Universal Evidence Contract. Penanda dicari **sesudah** awal kontrak, karena teks panduan identitas juga menyebut `<RAG>` dan `[BLOK 4: KNOWLEDGE]`. Diuji dengan kode asli: jumlah segmen = panjang prompt, blok RAG tidak tertipu penanda palsu (20.016 dari 20.015 huruf — selisih hanya karakter pemisah), prompt non-kontrak tidak dicatat.
    - **Pengukuran produksi** (versi web live, satu sesi, 20:46–20:48 WIB):

      | Chat | Jalur | Sistem | RAG di sistem | Riwayat | **Pesan** | Total huruf | Token |
      |---|---|---|---|---|---|---|---|
      | "Jelaskan singkat apa itu inflasi" (RAG mati) | langsung | 5.304 | — | 1 / 32 | **32** | 5.368 | 1.645 |
      | "Menurut dokumen HCDP, jelaskan program…" (80 huruf) | multi-agen | 27.802 | 22.631 | 3 / 1.136 | **28.519** | 57.457 | 15.272 |
      | "Lanjutkan, apa kendala utamanya?" (32 huruf) | multi-agen | 5.302 | 0 potongan | 5 / 3.112 | **5.923** | 14.337 | 4.320 |

    - **Temuan:** di jalur multi-agen (dipakai saat sub-agen/alat seperti *knowledge manager* dijalankan), `synthesis_handler.ts:208` membentuk pesan sebagai `` `Anda telah menugaskan beberapa sub-agent.${fullSystemContext}\n\nPermintaan Awal User: …` `` lalu memanggil `runLLM(synthesisPrompt, fullSystemContext, …)` — **seluruh prompt sistem, termasuk semua potongan dokumen, terkirim dua kali**: sekali di pesan, sekali sebagai sistem. Angkanya cocok persis di kedua chat: 28.519 = 27.802 + ±700 huruf pembungkus & hasil sub-agen; 5.923 = 5.302 + ±600. Jalur langsung tidak terdampak (pesan = 32 huruf).
    - **Perbaikan (commit `63f5429`):** `${fullSystemContext}` dihapus dari pesan sintesis — ia sudah dikirim sebagai prompt sistem. Diperiksa: tidak ada tempat lain yang menempel prompt sistem ke pesan. `deno check` tetap 81.
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi.** `agent-process` versi **410**, pertanyaan yang sama persis di chat baru (21:00 WIB):

      | | Sebelum | Sesudah |
      |---|---|---|
      | Prompt sistem | 27.802 huruf | 27.802 huruf |
      | **Pesan** | **28.519 huruf** | **717 huruf** |
      | Total ke model | 57.457 huruf | 28.599 huruf |
      | **Token masuk** | **15.272** | **7.626 (−50%)** |
      | Jawaban | benar | benar, lebih rinci (kategori MS/MMS/KMS, PERLAN 10/2018, sasaran Smart ASN 2025) |

    - **Koreksi terbuka:** "sisa ±10 ribu token prompt dasar" (Item 65) **keliru**. Prompt dasar diukur **±5.300 huruf** — seluruh chat tanpa dokumen hanya 1.645 token. Selisih yang saya lihat berasal dari prompt sistem yang terkirim dua kali dan dari perbedaan tokenizer, bukan dari prompt dasar. Tidak ada yang perlu dipangkas di sana.
    - **Item 44 — status akhir tiga temuannya:**
      - "Prompt 15–20 ribu token, 99,3% belanja adalah prompt" → dua penyebab ditemukan dan diperbaiki: Kasus A menyeret seluruh dokumen (Item 65, 90.116 → ±6–17 ribu token) dan prompt sistem dobel di jalur multi-agen (Item 66, −50%).
      - "Pesan Owner terkirim dua kali" → **terkonfirmasi**: pada chat pertama sesi, riwayat sudah berisi pertanyaan itu sendiri (`riwayat=1 pesan/80 huruf` untuk pertanyaan 80 huruf). Efeknya kecil — sepanjang pertanyaan saja.
      - "API key Gemini #0 403" → kini #0 dan #1 403 (Item 65); hanya dipakai Intent Router.
    - **Dicatat, belum dikerjakan:**
      - **Biaya kini didominasi jawaban, bukan prompt.** Chat sesudah perbaikan tetap $0,0154 karena tingkat **THINKING** memilih `deepseek-v4-pro` (1.336 token jawaban + 463 token penalaran). Pertanyaan "jelaskan program…" dinilai THINKING, dan chat lanjutan ikut THINKING karena *smoothing*. Aturan tingkat adalah keputusan Owner (Item 34).
      - **Pertanyaan lanjutan kehilangan dokumen.** *"Lanjutkan, apa kendala utamanya?"* → pencarian makna 0 potongan (pesan tak menyebut apa pun tentang HCDP), dan model menjawab *"dokumen HCDP tidak tersedia di database saya"*. Perlu "dokumen fokus percakapan" atau pencarian ulang dengan pertanyaan sebelumnya. **→ Diselesaikan di Item 67 (tulis ulang pertanyaan lanjutan).**
      - `context_builder.ts:450` memasukkan seluruh prompt sistem (27 ribu huruf, termasuk dokumen) ke `processingSteps`, yang ikut dikirim balik ke browser di setiap jawaban — bukan biaya token, tapi beban jawaban dan membuka isi prompt ke klien.

67. **Pertanyaan Lanjutan Ditulis Ulang Sebelum Mencari Dokumen (2026-09-11):**
    - **Permintaan Owner:** lanjut Item 66 — "dokumen fokus percakapan", supaya *"Lanjutkan, apa kendala utamanya?"* tidak lagi menjawab "dokumen tidak tersedia".
    - **Akar masalah:** pencarian dokumen memvektorkan **pesan saat ini saja**. Pesan lanjutan tak menyebut topiknya, jadi skor teratasnya 0,541 — di bawah ambang 0,55 — walau HCDP memuat jawabannya (kata "hambatan" di potongan `1a7b4083…` dan `0374d16a…`; kata "kendala" sendiri tidak ada di dokumen).
    - **Diukur sebelum memilih cara** — dua cuplikan Console di browser Owner, kunci OpenRouter dibaca dari Vault tanpa dicetak, `match_documents` dipanggil dengan token sesi Owner (ambang 0, 5 teratas, semua 548 potongan / 47 dokumen):

      | Kueri | Skor teratas | Kemiripan dg. pertanyaan sebelumnya |
      |---|---|---|
      | A. "Lanjutkan, apa kendala utamanya?" | 0,541 Continual Learning | 0,508 |
      | B. pertanyaan sebelumnya + A | 0,762 HCDP [hambatan] | 0,929 |
      | C. pertanyaan + jawaban sebelumnya + A | 0,804 HCDP | 0,793 |
      | D. "Siapa yang bertanggung jawab melaksanakannya?" | 0,547 Pembelajaran mesin | 0,537 |
      | E. pertanyaan sebelumnya + D | 0,766 HCDP [hambatan] | 0,965 |
      | F. "Jelaskan singkat apa itu inflasi" | 0,528 Matematika Dasar | 0,488 |
      | **G. pertanyaan sebelumnya + F** | **0,708 HCDP [hambatan] ❌** | 0,852 |
      | H. pertanyaan sebelumnya saja | 0,763 HCDP [hambatan] | 1 |

      - **Menggabungkan kalimat ditolak.** B ≈ H (0,762 vs 0,763): vektor gabungan hampir sama dengan pertanyaan lama, pesan baru nyaris tak berpengaruh — potongan [hambatan] muncul hanya karena sudah teratas untuk pertanyaan lama. Dan G menyuntikkan 5 potongan HCDP ke pertanyaan inflasi.
      - **Vektor tak bisa membedakan lanjutan dari ganti topik:** kemiripan dengan pertanyaan sebelumnya 0,508 / 0,537 (lanjutan) vs 0,488 (ganti topik) — terlalu rapat untuk ambang.
      - **Tulis ulang oleh model murah** (`deepseek/deepseek-v4-flash-0731`, `reasoning: {enabled:false}`, suhu 0):

        | Pesan | Hasil tulis ulang | Skor teratas | Waktu (browser) |
        |---|---|---|---|
        | lanjutan 1 | "Apa kendala utama dalam pelaksanaan program pengembangan kompetensi ASN … dokumen HCDP tersebut?" | 0,765 HCDP [hambatan] | 2.310 ms |
        | lanjutan 2 | "Siapa yang bertanggung jawab melaksanakan program … dokumen HCDP tersebut?" | 0,761 HCDP [hambatan] | 1.651 ms |
        | ganti topik 1 | "Jelaskan singkat apa itu inflasi." (apa adanya) | 0,544, bukan HCDP | 2.730 ms |
        | ganti topik 2 | "Siapa presiden pertama Indonesia?" (apa adanya) | 0,528, bukan HCDP | 2.678 ms |

        `google/gemini-3.5-flash-lite` tidak bisa dipakai: *"Reasoning is mandatory for this endpoint and cannot be disabled"* (400).
    - **Perbaikan (commit `a56ab26`):**
      - `lib/rag/query_rewrite.ts` (baru): `tulisUlangPertanyaan()` — kunci `openRouterByok` pengguna, 4 pesan riwayat terakhir masing-masing dipotong 800 huruf, batas waktu 4 detik (AbortController), keluaran kosong / > 400 huruf / galat HTTP → `null`. `riwayatSebelumPesan()` membuang pesan saat ini dari ujung riwayat (`ConversationEngine.jsx:729` mengirim riwayat yang sudah memuatnya). `samaDenganAsli()` membandingkan tanpa tanda baca/huruf besar.
      - `context_builder.ts` `executeTier1`: bila pencarian pertama 0 potongan **dan** ada riwayat → tulis ulang → bila berbeda dari pesan asli, embedding baru + `match_documents` sekali lagi; bila sama (pesan mandiri / ganti topik) → tidak dicari ulang. Hasil dicatat di log `[RAG] Mode: …` dan `processingSteps`.
      - Batas waktu Tier 1 tetap 5 detik, **diperpanjang 6 detik hanya saat menulis ulang** (tenggat bergerak, bukan `Promise.race` tetap); pengatur waktunya kini dibersihkan di `finally`.
    - **Uji sebelum deploy:** kode asli `query_rewrite.ts` dengan `fetch` palsu — 15/15 lulus (riwayat membuang pesan saat ini, riwayat kosong/rusak/undefined, tanda kutip dibuang, model & parameter benar, jawaban asisten dipotong 800, keluaran kosong/kepanjangan diabaikan, 402 → null, batas waktu 300 ms dihormati, tanpa kunci / tanpa riwayat tidak memanggil jaringan). `deno check` tetap 81.
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi** (deploy `a56ab26`, versi web live, satu sesi, RAG menyala, 21:28–21:31 WIB):

      | Chat | Log server | Tulis ulang | Jawaban |
      |---|---|---|---|
      | "Menurut dokumen HCDP, jelaskan program…" | 5 potongan, 0,763 | tidak perlu | benar |
      | "Lanjutkan, apa kendala utamanya?" | **5 potongan, 0,766** | "Lanjutkan, apa kendala utama dalam pelaksanaan program pengembangan kompetensi ASN berdasarkan dokumen HCDP tersebut?" — 2.264 ms, $0,000028 | **dari dokumen**: keterbatasan instrumen/akurasi data, gap 20 JP, kategori KMS belum dapat giliran diklat teknis, disempurnakan lewat koordinasi lintas sektor |
      | "Jelaskan singkat apa itu inflasi" | 0 potongan | "pesan sudah mandiri" — 1.201 ms | umum, tanpa HCDP, `[STATUS: HYPOTHESIS]` |

    - **Dicatat, belum dikerjakan:**
      - **Chat ketiga lama karena pemadat riwayat, bukan tulis ulang.** `history_compressor.ts` meringkas riwayat dengan AI begitu riwayat > 4.000 huruf: **36,5 detik** (14:30:44 → 14:31:21 UTC; `deepseek-v4-flash` menalar 552 token, 867 token jawaban, $0,00022) sebelum pencarian dokumen dimulai. **→ Diselesaikan di Item 68.**
      - **Ambang 0,55 terlalu dekat dengan dasar derau.** Dokumen yang sama sekali tak berhubungan mencapai 0,547 (D) dan 0,544 (inflasi setelah ditulis ulang). Belum pernah lolos, tapi selisihnya tipis.
      - Obrolan umum dengan RAG menyala membayar tulis ulang (±1–3 detik, ±$0,00003) di setiap pesan setelah pesan pertama, karena pencariannya selalu kosong.
      - Biaya tulis ulang dibayar langsung ke OpenRouter pengguna — tidak tercatat di Billing, sama seperti embedding.

68. **Riwayat Percakapan Dipangkas Tanpa AI, Pesan Saat Ini Tak Lagi Dobel (2026-09-11):**
    - **Permintaan Owner:** perbaiki jeda chat ketiga yang ditemukan di Item 67.
    - **Akar masalah:** `history_compressor.ts` ("Cognitive Memory Compressor") memanggil `runLLM` untuk meringkas riwayat begitu totalnya ≥ 4.000 huruf dan > 2 pesan, **ditunggu** di `request_pipeline.ts:436` sebelum `context_builder` berjalan. Terukur (14:30:44 → 14:31:21 UTC): 36,5 detik, `deepseek-v4-flash` 1.038 token masuk / 867 keluar / 552 token penalaran, $0,00022, 4.576 → 1.138 huruf.
      - **Lebih mahal daripada yang dihemat:** ±700 token yang dihemat bernilai ±$0,00005 di flash. Ia memakai model pesan itu sendiri (`rctx.model`), jadi di THINKING (`deepseek-v4-pro`, $0,00058/$0,00174 per 1K) ±$0,002 per pesan.
      - **Diulang dari nol** di setiap pesan setelah riwayat melewati ambang — tanpa cache. Dalam 24 jam terakhir baru sekali terpicu hanya karena uji-uji Owner selalu ≤ 3 pesan.
    - **Temuan kedua (terkonfirmasi di Item 66):** `ConversationEngine.jsx:729` mengirim riwayat yang sudah memuat pesan saat ini, lalu pesan yang sama dikirim lagi sebagai prompt — model menerimanya dua kali.
    - **Perbaikan (commit `069cffa`):** `compressChatHistory` (async, AI) diganti `rapikanRiwayat(history, pesanSaatIni)` (sinkron, tanpa AI):
      - pesan terakhir dibuang bila `role === 'user'` dan isinya sama persis (setelah `trim`) dengan `parsed.message` — klien yang tak menyertakannya tidak kehilangan apa pun;
      - bila total ≥ 4.000 huruf dan > 2 pesan: 2 pesan terakhir utuh, pesan lebih lama dipotong ke 800 huruf + `… [dipangkas]`; log `[Riwayat] N pesan, X → Y huruf`;
      - jalur cadangan lama (`role: 'system'` "[WARNING: History truncated…]") ikut hilang.
      - Tidak ada pemakai lain (`compressChatHistory` hanya di `request_pipeline.ts`; sisanya keluaran graphify).
    - **Uji sebelum deploy:** kode asli, 13/13 lulus — bentuk riwayat chat produksi (5 pesan ±4.500 huruf → pesan saat ini dibuang, 2 terakhir utuh, jawaban lama tepat 800 + penanda, masukan tidak diubah), riwayat pesan pertama jadi kosong, di bawah ambang tak dipangkas, klien tanpa pesan saat ini, pesan berulang hanya ujungnya, spasi diabaikan, isi rusak/undefined aman, riwayat hasil tetap memberi konteks untuk `riwayatSebelumPesan` (Item 67). `deno check` tetap 81.
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi** (deploy `069cffa`, versi web live, satu sesi, RAG menyala, 22:07–22:09 WIB; jawaban ketiga chat dinyatakan **benar** oleh Owner):

      | Chat | Riwayat (sebelum → sesudah) | Catatan |
      |---|---|---|
      | "Menurut dokumen HCDP, jelaskan program…" | 1 pesan / 80 huruf → **0 pesan** | 5 potongan, 0,763; prompt 7.528 token |
      | "Lanjutkan, apa kendala utamanya?" | 3 pesan / 2.902 → **2 pesan / 2.794 huruf** | tulis ulang 1.819 ms → 5 potongan, 0,765 |
      | "Jelaskan singkat apa itu inflasi" | ringkasan AI 36,5 s → **`[Riwayat] 4 pesan, 4571 → 2670 huruf`** | tulis ulang "sudah mandiri" 1.159 ms |

      | Chat inflasi | Sebelum | Sesudah |
      |---|---|---|
      | Pesan masuk → model utama mulai | **43,6 detik** | **5,0 detik** |
      | Pesan masuk → jawaban selesai | > 60 detik | **20,2 detik** (15 detik waktu menulis `deepseek-v4-flash`) |
      | Biaya merapikan riwayat | $0,00022 | $0 |

    - **Konsekuensi yang disadari:** fakta di tengah jawaban lama bisa terpotong, sedangkan ringkasan AI menyimpannya. Untuk pertanyaan tentang dokumen, isinya diambil lagi lewat pencarian dokumen.
    - **Dicatat, belum dikerjakan:**
      - **Chat lanjutan HCDP masih ±36 detik:** `deepseek-v4-pro` menulis ±16 detik, dan ada jeda ±9 detik antara selesainya pencarian dokumen (15:07:54) dan panggilan Intent Router berikutnya (15:08:03) — kemungkinan jalur multi-agen/*knowledge manager*, belum diselidiki. Pertanyaan pendek ikut THINKING karena *smoothing* (keputusan Owner, Item 34).
      - Intent Router (Gemini) dipanggil 1–2 kali per chat, ±2–3 detik masing-masing, termasuk 403 di kunci #0.

69. **Unggah RAG Menerima PDF dan DOCX — Teks Diambil di Browser (2026-09-11):**
    - **Permintaan Owner:** unggah PDF/Word untuk RAG pengetahuan ("saat ini ebook banyak menggunakan PDF").
    - **Akar masalah:** `rag-process` hanya menerima teks. Research App (`accept=".txt,.md,…"`) dan mametlite (`file.text()` untuk `.pdf`/`.docx`) mengirim isi berkas mentah; sejak Item 64 ditolak sebagai `BINARY_FILE`. `pdfjs-dist` dan `mammoth` sudah ada di `package.json` frontend & mametlite tapi **tidak dipakai di mana pun**.
    - **Keputusan: ekstraksi di browser**, bukan di edge function — bebas biaya, tak terkena batas CPU edge function, berkas asli tidak pernah disimpan di Supabase (hanya teksnya).
    - **Diukur dulu dengan prototipe** (Node + pdfjs legacy; berkas HCDP di scratchpad, lalu `DOKUMEN HCDP 2025-2026.pdf` asli dan ebook Owner):

      | Sumber | Waktu | Halaman | Hasil | Huruf rusak |
      |---|---|---|---|---|
      | HCDP DOCX | 0,2 s | — | 6.269 kata | 0 |
      | HCDP PDF dari Word 365 | 0,5 s | 47 | 6.635 kata | 0 |
      | HCDP PDF dari Word 2007 (= PDF asli Owner) | 0,8 s | 47 | 6.438 kata | 0 |
      | Ebook "Operator Handbook" (WeLib) | 4,1 s | 436 | 645.522 huruf, 4 halaman gambar | 0 |
      | `CamScanner 24-02-2026 14.15.pdf` (izin Owner) | — | 1 | 0 huruf → ditolak sebagai scan | — |

    - **Temuan: PDF bercetak ulang.** PDF HCDP asli (Word 2007) mencetak setiap kalimat **3 kali di koordinat yang sama** (efek tebal/bayangan), dipecah di titik berbeda; spasi berlebar ±8,8 px menumpuk ke kata berikutnya. Ekstraksi polos: 133 ribu huruf berantakan. Ditangani: salinan identik dibuang menurut posisi (±2 px) + isi; halaman bercetak ulang disusun menurut posisi, spasi dibuang, potongan bertumpuk disambung lewat bagian teks yang sama. Hasil: frasa khas ("Smart ASN", "3.578 Pegawai", "Kecamatan Lubuk Batang", "antara 103°25′ sampai") tepat sekali di ketiga sumber.
    - **Temuan kedua: HCDP di RAG sebelum item ini berisi teks 3 kali lipat** — diperiksa di database, setiap frasa khas muncul 3×; 33 potongan untuk isi yang cukup ±15. Diunggah ulang dari PDF asli: 14 potongan (masih 4.500 huruf); versi lama dihapus Owner.
    - **Perubahan (commit `07d1fa3`):**
      - `frontend/src/core/runtime/services/documentTextExtractor.js` (baru) + salinan `mametlite/src/lib/documentTextExtractor.js`: pdfjs **build legacy** + worker (`?url`, dimuat hanya saat unggah PDF), `mammoth` untuk DOCX; judul/kaki halaman berulang (baris tepi di ≥30% halaman) dan nomor halaman dibuang; kata terpotong tanda hubung disambung; penanda `[Halaman N]` untuk kutipan halaman tanpa kolom baru.
      - Ditolak dengan pesan jelas (`GagalEkstrak.kode`): `SCAN` (≥50% halaman tanpa teks), `TERKUNCI`, `PDF_RUSAK`, `DOCX_RUSAK`, `TIDAK_DIDUKUNG` (`.doc` lama, format lain), `TERLALU_BESAR` (> 60 MB), `KOSONG`, `HURUF_RUSAK` (U+FFFD > 1%).
      - Research App & mametlite: progres "Membaca halaman n/total" di tombol unggah; konfirmasi perkiraan potongan & biaya untuk dokumen besar.
      - **mametlite: dokumen lama baru dihapus SETELAH unggahan baru berhasil** — dulu dihapus lebih dulu, jadi unggahan yang gagal ikut menghilangkan dokumen lama.
      - `rag-process`: pesan `BINARY_FILE` kini menyuruh memuat ulang aplikasi (hanya tersisa untuk versi lama yang masih termuat).
      - `vite.config.js`: berkas ekstraktor dikecualikan dari obfuscator (`import()` pdfjs/mammoth).
    - **Uji sebelum deploy:** kode asli 23/23 lulus di frontend (pdfjs 5) dan mametlite (pdfjs 6) — **uji salinan mametlite menangkap bug**: pdfjs 6 tak lagi punya `doc.destroy()`; kini `loadingTask.destroy()` (ada di v5 & v6). Di browser (server dev) kedua aplikasi menghasilkan angka identik dengan Node, tanpa peringatan *fake worker*. Build frontend & mametlite lolos.
    - **Status:** ✅ **Selesai & Terbukti di Produksi** — Owner mengunggah HCDP PDF dan ebook lewat versi web live, "berhasil lengkap dengan pemberitahuan"; 14 + 145 potongan tersimpan.
    - **Dicatat, belum dikerjakan:** OCR untuk PDF scan; ekstraksi di Electron (`file://`) belum diuji — pdfjs jatuh ke *fake worker* bila module worker gagal, tetap jalan tapi lebih lambat.

70. **Potongan RAG 800 Huruf dan Vektor 768 Dimensi (2026-09-11):**
    - **Pertanyaan Owner:** bisakah Mamet menjawab dari dokumen berbahasa Inggris saat ditanya dalam bahasa Indonesia, dan apakah perintah seperti `adb shell dumpsys battery reset` tetap utuh, tidak diterjemahkan?
    - **Uji di web (ebook, potongan 4.500 huruf):** bahasa jawaban aman — penjelasan berbahasa Indonesia, perintah utuh di blok kode. Tapi pencariannya meleset: skor 0,552 / 0,554 / 0,550 (mepet ambang 0,55); dua dari tiga berlabel `HYPOTHESIS` dengan perintah dari pengetahuan umum, bukan versi buku. Ketiga jawaban ada di **satu potongan** (`161c2490…`, 19 perintah adb) yang tidak terambil. `VERIFIED` pertanyaan pertama pun diberikan dengan potongan lain — label itu hanya berarti "ada dokumen yang diberikan", bukan bukti asal fakta.
    - **Diukur, tiga cuplikan Console Owner** (kunci dari Vault tanpa dicetak; teks potongan dibaca dari database Owner sendiri, tidak ditempel ke chat):
      1. **Bukan bahasa:** pertanyaan EN tidak lebih baik (baterai ID 0,530 vs EN 0,514); kalimat `adb shell dumpsys battery reset` — tertulis persis di potongan itu — hanya **0,510, peringkat 5**.
      2. **Potongan terlalu campur** — potongan adb dipotong ulang, dibanding 4 potongan pengecoh (firewall, PowerShell, diskpart, Ansible); selisih skor adb terhadap pengecoh terbaik:

         | Pertanyaan | 4.500 | 1.500 | 800 |
         |---|---|---|---|
         | ID baterai | −0,022 (kalah) | +0,141 | +0,132 (0,709) |
         | EN baterai | −0,003 | +0,166 | +0,233 (0,805) |
         | ID layar | −0,051 | +0,036 | +0,041 |
         | EN layar | −0,049 | +0,070 | +0,133 |
         | ID cadangan | −0,080 | ≈0 | +0,060 |
         | EN cadangan | −0,081 | ≈0 | +0,095 |

      3. **Ukuran × dimensi** — peringkat potongan yang *berisi jawaban*: 800 huruf → #1/#1/#2/#1/#2/#1; 1.000 → cadangan (ID) #3–4; 1.200 → #5. Peringkat **sama persis** pada 3.072 / 1.536 / 768. OpenRouter `dimensions: 768` identik dengan memotong sendiri (kemiripan 1,0000).
    - **Ambang memori diperiksa di database** dengan pasangan kalibrasi Item 46: urutan sama, skor naik ±0,01 ("suka teh" 0,7263 → 0,7327 tetap lolos; "suka jalan pagi" 0,6599 → 0,6735 tetap tidak).
    - **Perubahan (commit `d6b0966`, disetujui Owner):**
      - `vector_utils.ts`: `UKURAN_POTONGAN` 800 / `TUMPANG_POTONGAN` 100 sebagai default `chunkText` (dipakai `rag-process` dan plugin `knowledge_manager`); `EMBED_DIMENSI` 768, `dimensions` dikirim ke OpenRouter.
      - `rag-process`: kelompok 32 (dulu 12). `ragTopK` 5 → 8 (LITE tetap 10).
      - Layar unggah: perkiraan untuk potongan 800 huruf; konfirmasi bila > 150 potongan.
      - **Migrasi `20260911163456_embedding_768`** (commit `8768dcc` menyamakan nama file dengan versi remote): `document_chunks.embedding` & `user_memories.embedding` → `vector(768)` lewat `subvector` (tanpa memvektorkan ulang); view `active_user_memories` dibuat ulang (security_invoker, hak akses sama). Diuji dulu dalam transaksi `ROLLBACK`; diterapkan setelah Owner men-deploy kedua fungsi. Indeks HNSW sengaja belum dibuat — pencarian difilter per pengguna, sedangkan HNSW menyaring sesudah mengambil kandidat.
    - **Uji sebelum deploy:** kode server asli 14/14 — ebook 827 potongan, maks 800 huruf, **0 kata hilang**, `adb shell dumpsys battery reset` utuh di satu potongan; `dimensions: 768` terkirim; vektor 3.072 ditolak. `deno check` 81 → 81, rag-process 0.
    - **Status:** ✅ **Selesai, Dideploy & Terbukti di Produksi** (versi web live, 23:40–23:43 WIB):
      - Migrasi: 674 vektor dokumen + 10 memori utuh; `match_documents` bekerja (potongan menemukan dirinya 1,0000); database **33 → 28 MB**.
      - Unggah ulang: ebook **827 potongan dalam 53,3 s, 3,2 MB** (dulu 145 potongan / 2,1 MB dengan hasil meleset); HCDP DOCX 84 potongan dalam 6,6 s, 312 kB. Database 31 MB.

      | Pertanyaan (chat baru, RAG nyala) | Sebelum | Sesudah |
      |---|---|---|
      | Reset baterai | 0,552, potongan lain | **0,735** `VERIFIED`, `adb shell dumpsys battery reset` |
      | Tangkapan layar | 0,554, `HYPOTHESIS`, `adb exec-out…` | **0,673** `VERIFIED`, `adb shell screencap -p "/path/to/screenshot.png"` (versi buku) |
      | Cadangan | 0,550, `HYPOTHESIS` | **0,616** `VERIFIED`, `adb backup -apk -all -f backup.ab` + varian `-nosystem`/`-shared` (versi buku) |

      - Log: "maks 8" dan 8 potongan; blok RAG ±7.300 huruf (dulu hingga 22.500). LOOKUP: 3.218 token masuk, $0,0006 (dulu ±6.700, $0,001).
    - **Dicatat, belum dikerjakan:**
      - Pertanyaan bahasa Indonesia tetap ±0,05–0,10 di bawah bahasa Inggris untuk dokumen berbahasa Inggris ("cadangan" 0,616). Bila ada yang meleset: terjemahkan pertanyaan saat pencarian kosong (mekanisme Item 67).
      - Dokumen lama (Juni–Agustus) masih berpotongan 4.500 huruf sampai diunggah ulang.
      - Aturan "kutip perintah persis" di prompt sistem belum dipasang — uji menunjukkan model sudah melakukannya, tapi belum dijamin.
      - Label `VERIFIED` perlu dibedakan dari "fakta berasal dari dokumen".

71. **Label VERIFIED Wajib Mengutip Dokumen (2026-09-12):**
    - **Permintaan Owner:** bedakan label `VERIFIED` dari "fakta berasal dari dokumen" (sisa Item 70).
    - **Akar masalah — dua perintah bertentangan:** panduan identitas (`request_pipeline.ts:365`) menulis VERIFIED "jika didukung oleh dokumen", sedangkan `[BLOK 6]` di `universal_contract.ts` memerintahkan `[STATUS: VERIFIED]` **tanpa syarat** setiap kali Evidence Gate PASSED — dan PASSED hanya berarti `ragCount > 0`, yaitu ADA dokumen dilampirkan. Terbukti di Item 70: chat yang menerima potongan tanpa jawaban (0,552) menjawab dari pengetahuan umum tapi berlabel VERIFIED; label itu menghapus tanda bahaya yang perlu dilihat Owner.
    - **Perbaikan (commit `cb6c375`), dua lapis:**
      - **Prompt:** BLOK 6 kini memberi PILIHAN label; VERIFIED hanya bila jawaban berasal dari dokumen dan **wajib** disertai baris `Sumber: "judul"` (boleh dengan nomor halaman, tersedia sejak penanda `[Halaman N]` Item 69) atau kode `[DOC-000N]`; ditutup kalimat "Dokumen terlampir TIDAK otomatis berarti VERIFIED".
      - **Kode:** `lib/verification/label_sumber.ts` (baru) memeriksa judul/kode yang disebut terhadap `ctx.state.ragArray` — dokumen yang BENAR-BENAR dilampirkan. Tidak cocok → label diturunkan ke `[STATUS: HYPOTHESIS - Rekomendasi AI]` + catatan untuk pembaca, dicatat `[LABEL]` di log. Jalur non-stream: diganti sebelum jawaban dikirim. Jalur stream (mametlite, `stream: true`): teks terkirim tak bisa ditarik, jadi koreksi DITAMBAHKAN di akhir; `judulDokumen` ikut lewat payload ke `stream_handler`.
    - **Uji sebelum deploy:** kode asli 16/16 — jawaban sungguhan yang salah label di Item 70 diturunkan; judul cocok (termasuk bertanda tebal, di dalam daftar, beda huruf besar-kecil, kode `[DOC-0002]`) dipertahankan; sumber karangan, kode dokumen asing, dan "tanpa dokumen" diturunkan; `HYPOTHESIS` dan jawaban tanpa label tidak disentuh. `deno check` 81 → 81.
    - **Status:** ⏳ **Sudah di-commit, MENUNGGU DEPLOY & UJI PRODUKSI.**
    - **Dicatat:** jalur stream hanya bisa menambahkan koreksi di akhir, tidak mengganti label yang sudah terkirim.

72. **Rencana Adaptive Shell (UI Multi-Device) — Telaah (2026-09-12):**
    - **Asal:** `docs/roadmap/roadmap-adaptive-shell.md` (158 baris, ditulis di luar sesi ini). Owner meminta ditelaah dan didaftarkan. **Belum dikerjakan.**
    - **Isi rencana:** Fase 1 deteksi device/orientasi di `DiscoveryManager` (validasi silang UA + `innerWidth`, event reaktif, override manual persisten); Fase 2 angkat state kerja ke Context sebelum shell dibangun; Fase 3 empat shell terpisah (`DesktopShell`, `TabletShell`, `PhonePortraitShell`, `PhoneLandscapeShell`) + `AppShell` sebagai selector, dengan feature-gating per capability; Fase 4 PWA (`vite-plugin-pwa`, manifest, service worker) + Supabase realtime untuk approval. Native Android, mDNS, dan `LocalizationManager` sengaja ditunda.
    - **Diperiksa terhadap kode (2026-09-12):**
      - ✅ **Masalahnya nyata.** `DiscoveryManager.detectDevice()` memang murni regex User-Agent (baris 73–83); `innerWidth` sudah ikut dicatat di `getScreenInfo()` (baris 179) tapi tidak dipakai untuk klasifikasi. `AppShell.jsx` (162 baris) hanya memuat **1** kelas responsif Tailwind — jadi UI HP berantakan bukan dugaan.
      - ⚠️ **Nama `AppShell` sudah dipakai.** `frontend/src/components/workbench/AppShell.jsx` sudah ada (plus `components/os/OSDesktopShell.jsx`). Membuat `frontend/src/shells/AppShell.jsx` akan menimbulkan dua komponen bernama sama; sebaiknya yang ada dipakai/di-rename, bukan ditambah.
      - ⚠️ **Fase 4 melanggar aturan rencana itu sendiri.** Dokumen melarang menambah dependency di luar `package.json`, sedangkan `vite-plugin-pwa` (dan workbox) belum ada di `frontend/package.json`. Perlu keputusan eksplisit Owner.
      - ❔ Klaim "backend Express di Vercel" konsisten dengan adanya `backend/vercel.json`, tapi jalur mana yang benar-benar dipakai versi web belum diverifikasi (lihat Item 49). `EngineerApprovalDialog.jsx` memang ada, jadi use-case approval di HP masuk akal.
    - **Catatan telaah (pendapat saya, keputusan tetap Owner):**
      1. **Empat shell terpisah mahal untuk pengembang tunggal.** Pemisahan `phone-portrait` vs `phone-landscape` sebagai dua komponen memberi manfaat paling kecil (HP landscape ≈ tablet kecil) dengan biaya rawat paling besar. Saran: **dua** komponen (yang ada untuk desktop/tablet + satu `PhoneShell`), orientasi ditangani CSS/Tailwind.
      2. **Sebagian Fase 2 muncul karena pilihan Fase 3.** "Data hilang saat rotate" adalah akibat shell di-unmount saat orientasi berubah. Kalau orientasi ditangani CSS, risiko itu hilang dan Fase 2 menyusut jadi sekadar higiene.
      3. **Ada jalan murah yang tidak tercantum:** rapikan dulu 3 layar yang benar-benar dipakai dari HP (chat Assistant, unggah Research App, dialog approval) dengan breakpoint Tailwind — tanpa perubahan arsitektur. Setelah dipakai nyata, baru dinilai apakah shell terpisah memang perlu.
      4. **Kenyataan HP dari Item 69 belum masuk rencana:** ekstraksi PDF di HP 3–5× lebih lambat, tab latar belakang bisa dihentikan browser saat unggah, dan batas 60 MB. Ini syarat nyata untuk "companion", layak ditulis sebagai batasan Fase 3/4.
      5. Ambang 600/1024 px sebagai konstanta bernama: setuju, dan sebaiknya satu sumber yang sama dipakai Tailwind maupun `DiscoveryManager`.
    - **Status:** 📋 **Rencana terdaftar, belum dikerjakan.** Saran urutan: kerjakan poin 3 dulu (murah, langsung terasa), lalu Fase 1 (deteksi + override, berdiri sendiri dan berguna), lalu putuskan Fase 2–3 setelah ada bukti pemakaian.

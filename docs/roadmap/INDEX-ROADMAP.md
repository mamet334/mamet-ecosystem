# INDEX-ROADMAP — Titik Masuk AI Coding

**Untuk siapa:** AI coding (bukan Engineer — Engineer memakai `INIT.md`). Baca dokumen ini utuh lebih dulu,
lalu buka **hanya** dokumen yang ditunjuk.
**Update terakhir:** 2026-09-17 (perampingan; riwayat detail lama: [`INDEX-ROADMAP-ARSIP-2026-09-17.md`](./INDEX-ROADMAP-ARSIP-2026-09-17.md))

## 0. Peran Dokumen & Aturan

| Tempat | Isi | Tidak boleh berisi |
|---|---|---|
| **INDEX-ROADMAP.md** (ini) | status + tautan, 1 baris per item | tabel uji, angka, bukti live, cerita |
| **`docs/roadmap/*.md`** | rancangan, keputusan Owner sementara, **sisa pekerjaan**, perbaikan kecil yang relevan, catatan penyimpangan ("diganti oleh …") | riwayat panjang hasil kerja |
| **`docs/project-memory/changelog/`** | dokumentasi pekerjaan yang sudah dilakukan | sisa pekerjaan |
| **`docs/adr/`** | keputusan Owner yang berpengaruh besar | keputusan sementara |

**Urutan setiap selesai kerja:** changelog (hasil) → dokumen roadmap (status, sisa, penyimpangan) → INDEX cukup
ubah satu baris. Sebelum menambah teks ke INDEX: apakah ini status/tautan? Bila bukan, tempatnya bukan di sini.
Legenda: ✅ selesai · 🟡 sebagian live · 📝 rencana disetujui/berjalan · 📋 rencana terdaftar · ⏳ menunggu keputusan · ⚠️ sebagian · 🔧 terbukti sebagian

---

## 1. Pekerjaan Terbuka (mulai dari sini)

| Item | Status | Dokumen (sisa pekerjaan ada di sana) |
|---|---|---|
| 90 Pengambilan potongan RAG | ✅ Tahap A–C (recall@8 14/14, bukti Kepbup #1, live); U10 ✅ (label LOOKUP satu sumber aturan); sisa utang U4, U6–U8 | [`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md) |
| 89 Konteks potongan RAG | ✅ live (Tahap C Item 90); identitas tabel OCR ✅ | [`ROADMAP-KONTEKS-POTONGAN-RAG.md`](./ROADMAP-KONTEKS-POTONGAN-RAG.md) |
| 88 Tabel centang PDF (+ sisa 86 OCR massal) | 🟡 Tahap 1–3 ✅; keputusan 3: buku per jabatan **221/221** masuk; 177 ✅, 191/159 keterbatasan; set uji buku penuh **13/14**; sisa BUKU-10 (blok centang miskin kata, sesudah code freeze) | [`ROADMAP-TABEL-CENTANG-PDF.md`](./ROADMAP-TABEL-CENTANG-PDF.md) |
| 85 Folder kerja Assistant | 📝 Tahap 0 sebagian; sisa pagar IPC `folder:*`; Tahap 1 menunggu aba-aba | [`ROADMAP-FOLDER-KERJA-ASSISTANT.md`](./ROADMAP-FOLDER-KERJA-ASSISTANT.md) |
| 72 Adaptive Shell (UI multi-device) | 📋 belum dikerjakan | [`roadmap-adaptive-shell.md`](./roadmap-adaptive-shell.md) |
| 33, 48, 49, 50, 91 Temuan audit tanpa rancangan | ⏳ T1 izin tool Lite · T2 dasbor yatim · T3 rute mati backend · T4 ✅ · T6 ✅ · T7 ✅ kunci API di `agent_logs` (sisa: Owner ganti kunci) | [`ROADMAP-TEMUAN-TERBUKA.md`](./ROADMAP-TEMUAN-TERBUKA.md) |

---

## 2. Dokumen Roadmap

| Dokumen | Status | Cakupan |
|---|---|---|
| `ROADMAP-PENGAMBILAN-POTONGAN-RAG.md` | ✅ Item 90 (A–C) | peta jalur RAG vs pola umum, utang lama, set uji → hybrid → konteks |
| `ROADMAP-KONTEKS-POTONGAN-RAG.md` | ✅ Item 89 | pemisah bagian tabel OCR + baris konteks potongan |
| `ROADMAP-TABEL-CENTANG-PDF.md` | 🟡 Item 88 | kolom centang dari koordinat pdf.js, kontrak & label |
| `ROADMAP-TEMUAN-TERBUKA.md` | ⏳ T1–T3 (T4–T7 ✅) | temuan audit tanpa rancangan sendiri |
| `ROADMAP-FOLDER-KERJA-ASSISTANT.md` | 📝 Item 85 | tombol 📁 sebagai tempat kerja Assistant |
| `roadmap-adaptive-shell.md` | 📋 Item 72 | UI multi-device |
| `ROADMAP-ADAPTIVE-MODEL-TIERING.md` | ✅ Item 34–35 | tier model & plumbing `thinking` |
| `ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md` | ✅ | stabilitas sesi chat & riwayat realtime |
| `ROADMAP-PR6-TOKEN-EFFICIENCY.md` | ✅ | cache prompt & efisiensi token |
| `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md` | ✅ | dasbor observability |
| `ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md` | ✅ | visual galaksi pengetahuan |
| `PR9-retrieval-tier-architecture.md` | ✅ **Tier 1 browser dihapus 2026-09-17** (Item 90); Tier 2–3 tetap | tier pengambilan pengetahuan |
| `PR8-linux-style-dispatch.md` | ✅ | `RequestClassifierService`, LOOKUP/CONVERSATION |
| `ASSISTANT-CAPABILITY-ROADMAP.md` | ✅ (PR#5 parsial) | kapabilitas Assistant PR#1–#7 |
| `roadmap memory governor.md`, `TAHAP1-memory-system-finalization.md` | ✅ | `MemoryGovernorService`, golden memory |
| `teknis-skil-implementasi.md` | ✅ | SkillRegistry/SkillGuard |
| `ZERO-LEAKAGE-RAG-TENANT-ISOLATION.md` | ✅ | isolasi RAG per pengguna |
| `PENDING-supabase-security-advisor-findings.md` | ✅ 8/9 (1 ditunda: upgrade plan) | temuan Security Advisor |
| `PENDING-tier3-web-search-chrome-cors-proxy-fix.md`, `PENDING-live-verification-runtime-gaps.md`, `PENDING-mametlite-memory-leak-fix.md` | ✅ | perbaikan tuntas (nama "PENDING" warisan) |
| `CHECK-P02-json-patch-schema-alignment.md`, `FIX-assistant-session-finalization-and-autosave-throttle.md`, `FIX-intent-classification-and-memory-store-unification.md` | ✅ | perbaikan tuntas |
| `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` | rujukan (beranotasi status, Item 26) | spesifikasi teknis |
| `MAMET-AI-ROADMAP.md`, `engineer-autonomous-mode.md`, `engineer-chat-upgrade.md`, `fix-log.md`, `rencana.md`, `roadmap-lanjutan.md` | ✅ direkonsiliasi 2026-09-08 | dokumen lama |

---

## 3. Disambiguasi & Prinsip Payung

- **Memory ≠ RAG.** Memory = `user_memories` (`MemoryService`/`MemoryGovernorService`, `match_memories`). RAG =
  `documents`/`document_chunks`, dicari **server** (`agent-process` `lib/rag/document_search.ts`, `match_documents`).
- **`CognitiveMemoryGovernorService` ≠ `MemoryGovernorService`:** yang pertama menyaring memori untuk prompt; yang
  kedua menjaga integritas data memori.
- **`RetrievalOrchestrator` (browser)** kini hanya Tier 2 (panduan tanpa dokumen) & Tier 3 (web). Pencarian dokumen
  tidak lagi di browser.
- **Prinsip:** kedaulatan Owner (aksi berisiko wajib konfirmasi) · tidak ada perubahan status diam-diam · satu
  berkas satu tanggung jawab · hapus lunak sebelum hapus permanen · pola standar hanya bila cocok (Item 90).

---

## 4. Daftar Item (1 baris; riwayat detail di arsip)

1. ✅ Refactor `ModuleDiscoveryService.js` — [log](../project-memory/changelog/2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md)
2. ✅ React Warning Render Phase (`WorkspaceContext.jsx:12` & `WorkbenchZone.jsx:60`) — [log](../project-memory/changelog/2026-09-04-fix-backlog-module-discovery-and-react-render-warning.md)
3. ✅ Bug Klasifikasi Intent Recall `RequestClassifier` — [rancangan](./FIX-intent-classification-and-memory-store-unification.md)
4. ✅ CP4b Memory Governor — UI Purge Lifecycle & Conflict Resolution — [log](../project-memory/changelog/2026-09-03-tahap1-sub-b-ui-purge-and-conflict-resolution.md)
5. ✅ PR#9 Fase 3 — Tier 3 Web Comparison — [rancangan](./PR9-retrieval-tier-architecture.md)
6. ✅ Audit & Penyelarasan Persona Kesadaran Memori pada System Prompt — [log](../project-memory/changelog/2026-09-03-fix-persona-memory-awareness-wording.md)
7. ✅ Fase 2 — Memory Context Panel Category Alignment (Backlog #7) — [log](../project-memory/changelog/2026-09-03-tahap1-sub-c-memory-context-panel-category-alignment.md)
8. ✅ Mekanisme Deteksi Deployment Drift (Edge Function vs Git Local/Remote) — [log](../project-memory/changelog/2026-09-08-deployment-drift-detection-mechanism.md)
9. ✅ Runtime Chat Session Stability & Chat History Realtime Persistence (`ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md`) — [rancangan](./ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md) · [log](../project-memory/changelog/2026-09-08-fix-verification-audit-logs-metadata-column-regression.md)
10. ✅ Tier 3 Web Search pada Web Browser (Chrome/Vercel) — Dynamic Import 404 (`supabase.js`) & CORS Fallback (`PENDING-tier3-web-search-chrome-co — [rancangan](./PENDING-tier3-web-search-chrome-cors-proxy-fix.md) · [log](../project-memory/changelog/2026-09-08-fix-tier3-web-search-chrome-vercel-static-import.md)
11. ✅ System Diagnostic App ("Event Viewer" ala `dmesg`) — `roadmap-lanjutan.md` §4.2 — [log](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)
12. ✅ Distilasi Pengetahuan Arsip (`00_EXPERIMENT_HISTORY.md`) — `roadmap-lanjutan.md` §1.2 — [log](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)
13. ✅ Dua Aturan Prompt Pengaman Belum Ditambahkan — `roadmap-lanjutan.md` §3.1 — [log](../project-memory/changelog/2026-09-08-backlog-11-13-system-logs-archive-history-prompt-rules.md)
14. ✅ Housekeeping Struktur Folder `frontend/src/` — Ditemukan saat Diskusi Arsitektur (2026-09-08) — [log](../project-memory/changelog/2026-09-08-housekeeping-frontend-src-folder-structure.md)
15. ✅ Dekomposisi Penuh `engineer.js` (2978 Baris) — [log](../project-memory/changelog/2026-09-08-adr-0017-fase1-session-artifact-extraction.md) · [log](../project-memory/changelog/2026-09-08-adr-0017-fase2-intent-capability-extraction.md) (+6)
16. ✅ Kebocoran Memori Personal ke Mametlite — [rancangan](./PENDING-mametlite-memory-leak-fix.md) · [log](../project-memory/changelog/2026-09-08-fix-mametlite-memory-read-leak.md)
17. ✅ Dashboard Observability Realtime — [rancangan](./ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md) · [log](../project-memory/changelog/2026-09-08-dashboard-observability-already-implemented.md)
18. ✅ Knowledge Galaxy — Cosmic Orbits & Live Thought Pulse — [rancangan](./ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md) · [log](../project-memory/changelog/2026-09-08-knowledge-galaxy-cosmic-orbits-implementation.md)
19. ✅ Konsolidasi Hierarki Otoritas Dokumen — [log](../project-memory/changelog/2026-09-09-governance-documentation-consolidation.md)
20. ✅ Audit Lanjutan & Konsolidasi Sisa `docs/architecture/` (31 file) — [log](../project-memory/changelog/2026-09-09-architecture-docs-consolidation.md)
21. ✅ `MAEF V3.md` (Otoritas Tertinggi Keempat) & Dokumen Legacy "AI Agent" Ditandai — [log](../project-memory/changelog/2026-09-09-maef-v3-and-legacy-docs-marked.md)
22. ✅ Eksekusi Trilogi Cleanup Dead-Code (PR-01, PR-02, PR-04) — [log](../project-memory/changelog/2026-09-09-dead-code-cleanup-trilogy-execution.md)
23. ✅ Perbaikan Tabrakan Nomor ADR-008 & Index `PROJECT-MEMORY.md` — [log](../project-memory/changelog/2026-09-09-adr-008-collision-and-project-memory-index-fix.md)
24. ✅ MAEF V2/V3 & Vision Constitution V2 Dihapus (Bukan Sekadar Ditandai) — [log](../project-memory/changelog/2026-09-09-maef-v2-v3-vision-v2-deleted-merged-into-constitution.md)
25. ✅ Verifikasi Silang Menyeluruh: Tabrakan Hierarki di Dokumen Sendiri — [log](../project-memory/changelog/2026-09-09-consistency-recheck-hierarchy-triple-duplication.md)
26. ✅ Anotasi Status Implementasi di `SPESIFIKASI-TEKNIS-MAMET-OS-v2.md` — [log](../project-memory/changelog/2026-09-09-spesifikasi-teknis-status-annotation-fix.md)
27. ✅ Bug Core Protection Layer — 5 dari 12 Pattern Immutable Tidak Pernah Cocok — [log](../project-memory/changelog/2026-09-09-fix-core-protection-layer-path-matching-bug.md)
28. ✅ `_loadStaticKnowledge()` Engineer: Path Mati Dihapus, 24-27 Ditambahkan — [log](../project-memory/changelog/2026-09-09-fix-engineer-static-knowledge-dead-paths-and-missing-docs.md)
29. ✅ Konsolidasi Instruksi `[MAMET_PATCH_READY]` Duplikat + Klausa Anti-Halusinasi Akses File §9-10 — [log](../project-memory/changelog/2026-09-09-fix-core-protection-layer-path-matching-bug.md)
30. ✅ Fitur Baru: Toggle Preferensi Tool (RAG & Web Search) — [log](../project-memory/changelog/2026-09-09-add-tool-preferences-toggle-rag-web-search.md)
31. ✅ Tool Registry Folder-Scan (`tools/`) + WebComparison Jadi Tool Nyata — [log](../project-memory/changelog/2026-09-09-tool-registry-folder-scan-web-search-refactor.md)
32. ✅ Tool Panel Generik, RAG/Web Search Dilepas, MAEF Monitor Fix, Dead Widget Cleanup — [log](../project-memory/changelog/2026-09-09-tool-panel-generic-rag-web-decouple-monitor-fix.md)
33. ⏳ Jalur Lite: `web_search` & `rag_search` Tidak Punya Aturan Izin Per-Tool — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T1
34. ✅ Adaptive Model Tiering + Batas Biaya Harian Per-User — [log](../project-memory/changelog/2026-09-09-adaptive-model-tiering-and-per-user-daily-cap.md)
35. ✅ Plumbing Parameter `thinking` dari Slot Tier sampai ke Provider — [rancangan](./ROADMAP-ADAPTIVE-MODEL-TIERING.md) · [log](../project-memory/changelog/2026-09-09-thinking-parameter-plumbing.md)
36. ✅ Empat Cacat Sistem Memori (Payload EventBus, Konflik Salah Tuduh, Duplikat, Klaim Palsu) — [log](../project-memory/changelog/2026-09-09-memory-system-four-defects-eventbus-conflict-duplicate.md)
37. ✅ Penyaring Kategori di Tahap 1 — Akar Sebenarnya di Balik "AI Lupa Terus" — [log](../project-memory/changelog/2026-09-09-memory-category-filter-root-cause.md)
38. ✅ Intent Router Diam-diam Mati Kalau Model Owner Bukan Gemini — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md) · [log](../project-memory/changelog/2026-09-09-thinking-parameter-plumbing.md)
39. ✅ Penjaga Dimensi Embedding Tertinggal di 768 — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md)
40. ✅ Impor Rusak di `rag-process` — Ranjau yang Belum Meledak — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md)
41. ✅ Circuit Breaker Memblokir Biaya yang Tidak Pernah Terjadi — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md)
42. ✅ `usage.cost` — Menghapus Seluruh Kelas Kesalahan Biaya — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md)
43. ✅ Sistem Menghukum Model karena Mematuhi Perintahnya Sendiri — [log](../project-memory/changelog/2026-09-09-kegagalan-yang-ditelan-diam-diam.md)
44. ✅ Sisa Temuan Kecil yang Belum Dikerjakan (2026-09-09) — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) ditutup
45. ✅ `match_memories` — Kebocoran Memori Lintas Pengguna (ranjau, urutan perbaikan menentukan) — [log](../project-memory/changelog/2026-09-10-pencarian-memori-semantik-akhirnya-hidup.md)
46. ✅ Skema `user_memories.embedding` Masih Tertinggal di 768 — Pencarian Memori Semantik Belum Pernah Bisa Hidup — [log](../project-memory/changelog/2026-09-10-pencarian-memori-semantik-akhirnya-hidup.md)
47. ✅ Circuit Breaker Gagal-Terbuka — Perlindungan Dompet Menguap Saat Ada Gangguan — riwayat: arsip
48. ⚠️ Instrumentasi Sistem Ini Terputus dari Sistemnya — Enam Dasbor Yatim (~1.200 baris) — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T2
49. ⚠️ Ranjau di Kode Mati — Aman Sekarang, Merusak Kalau Disambungkan — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T3
50. ✅ Sisa Temuan Kecil (2026-09-10) — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T4 terbuka
51. ✅ Kepemilikan Pemakaian & Kesehatan API Key — BYOK Wajib (2026-09-10) — riwayat: arsip
52. ✅ Jalur Upload RAG Research App Tak Pernah Memvektorkan — dan Satu Policy RLS `USING (true)` (2026-09-10) — [log](../project-memory/changelog/2026-09-10-jalur-upload-rag-dan-policy-rls-terbuka.md)
53. ✅ Groq 404 Terbukti: Provider Ketiga yang Modelnya Dipensiunkan Diam-Diam (2026-09-10) — [log](../project-memory/changelog/2026-09-10-groq-model-dipensiunkan-provider-ketiga.md)
54. ✅ Item 46 Ditutup: Pencarian Memori Semantik Akhirnya Hidup — dan Ambang 0,8 yang Nyaris Membuatnya Sia-Sia (2026-09-10) — [log](../project-memory/changelog/2026-09-10-pencarian-memori-semantik-akhirnya-hidup.md)
55. ✅ Deteksi Konflik Memori: Aturan yang Dijamin Positif Palsu, dan Kemiripan Vektor yang Ternyata Tidak Cukup (2026-09-10) — [log](../project-memory/changelog/2026-09-10-deteksi-konflik-memori-dua-tahap.md)
56. ✅ Tool Word → PDF dari Chat — Dua Word di Satu Mesin, dan Berkas yang "Sudah Ada" Padahal Belum Selesai (2026-09-10) — [log](../project-memory/changelog/2026-09-10-tool-word-ke-pdf-dari-chat.md)
57. ✅ Konversi Word → PDF dari Versi Web: Laptop sebagai Pekerja, dan Versi Web yang Ternyata Tak Pernah Punya Tool (2026-09-10) — [log](../project-memory/changelog/2026-09-10-konversi-lewat-laptop-dari-web.md)
58. ✅ Cache Hasil Konversi Berbasis Sidik Jari Isi, Kuota 200 MB, dan Panel Riwayat (2026-09-10) — [log](../project-memory/changelog/2026-09-10-cache-konversi-sidik-jari.md)
59. ✅ Versi Web Kembali Ber-CSP — Skrip Build Desktop yang Diam-diam Ikut Jalan di Vercel (2026-09-10) — [log](../project-memory/changelog/2026-09-10-csp-versi-web-dipulihkan.md)
60. ✅ File Explorer — Pengaman HTML yang Tidak Mengamankan dan Pewarna Kode yang Tidak Mengenal String (2026-09-10) — [log](../project-memory/changelog/2026-09-10-file-explorer-escape-dan-pewarna.md)
61. ✅ Database 238 MB → 32 MB — Kuota Supabase Dimakan Log Sistem, Bukan RAG (2026-09-10) — [log](../project-memory/changelog/2026-09-10-database-238-ke-32-mb.md)
62. ✅ Fallback Embedding OpenAI Dihapus — Cadangan dari Model Lain Tidak Pernah Bisa Benar (2026-09-10) — [log](../project-memory/changelog/2026-09-10-fallback-embedding-openai-dihapus.md)
63. ✅ Embedding Pindah ke OpenRouter — Uji Unggah Gagal, Uji Tanding Empat Model, dan Uji Dokumen HCDP (2026-09-10) — [log](../project-memory/changelog/2026-09-10-embedding-lewat-openrouter-uji.md)
64. ✅ `rag-process` Lewat OpenRouter dengan Kunci Pengguna — Terbukti di Produksi; dan Vektor Dokumen yang Tidak Pernah Dipakai Chat (2026-09-10 s — [log](../project-memory/changelog/2026-09-11-rag-process-openrouter-dan-vektor-yang-tak-dipakai.md)
65. ✅ RAG Dituntaskan: Chat Mencari Dokumen Berdasarkan Makna, Embedding dengan Kunci Pengguna (2026-09-11) — [log](../project-memory/changelog/2026-09-11-chat-mencari-dokumen-berdasarkan-makna.md)
66. ✅ Item 44 Diukur: Prompt Sistem Terkirim Dua Kali di Jalur Multi-Agen — Token Masuk Turun 50% (2026-09-11) — [log](../project-memory/changelog/2026-09-11-prompt-sistem-terkirim-dua-kali.md)
67. ✅ Pertanyaan Lanjutan Ditulis Ulang Sebelum Mencari Dokumen (2026-09-11) — [log](../project-memory/changelog/2026-09-11-pertanyaan-lanjutan-ditulis-ulang.md)
68. ✅ Riwayat Percakapan Dipangkas Tanpa AI, Pesan Saat Ini Tak Lagi Dobel (2026-09-11) — [log](../project-memory/changelog/2026-09-11-riwayat-dipangkas-tanpa-ai.md)
69. ✅ Unggah RAG Menerima PDF dan DOCX — Teks Diambil di Browser (2026-09-11) — [log](../project-memory/changelog/2026-09-11-unggah-pdf-dan-word.md)
70. ✅ Potongan RAG 800 Huruf dan Vektor 768 Dimensi (2026-09-11) — [log](../project-memory/changelog/2026-09-11-potongan-800-dan-vektor-768.md)
71. ✅ Label VERIFIED Wajib Mengutip Dokumen (2026-09-12) — [log](../project-memory/changelog/2026-09-12-label-verified-wajib-mengutip-sumber.md)
72. 📋 Rencana Adaptive Shell (UI Multi-Device) — Telaah (2026-09-12) — [rancangan](./roadmap-adaptive-shell.md)
73. ✅ Aturan Kutipan Persis untuk Dokumen RAG (2026-09-12) — [log](../project-memory/changelog/2026-09-12-kutip-perintah-persis.md)
74. ✅ Ikon dan Huruf Disimpan Sendiri — Lepas dari Google Fonts (2026-09-13) — [log](../project-memory/changelog/2026-09-13-font-ikon-dan-huruf-disimpan-sendiri.md)
75. ✅ Nalar yang Benar-Benar Mati, Penyedia Hulu Tercatat, dan Jam Lokal sebagai Data Sistem (2026-09-13) — [log](../project-memory/changelog/2026-09-13-nalar-mati-penyedia-dan-jam-lokal.md)
76. ✅ Tabel DOCX Dibaca sebagai Tabel, dan Riset Jalur PDF untuk RAG (2026-09-14) — [log](../project-memory/changelog/2026-09-14-tabel-docx-jadi-markdown.md)
77. ✅ Label VERIFIED Ikut Memeriksa Angka dan Pasangan Label–Angka (2026-09-14) — [log](../project-memory/changelog/2026-09-14-label-verified-memeriksa-angka.md)
78. ✅ Uji Mutu RAG Putaran 1: Angka Awal, Bug Sub-Agent, dan Label yang Keliru Turun (2026-09-14) — [log](../project-memory/changelog/2026-09-14-uji-mutu-rag-putaran-1.md) · [log](../project-memory/changelog/2026-09-14-uji-mutu-rag-putaran-2.md) (+1)
79. ✅ Memori Chat Pulih, Nalar Model Mengalir Sebelum Jawaban (Hybrid), Label Memeriksa Rujukan (2026-09-14) — [log](../project-memory/changelog/2026-09-14-nalar-hybrid-memori-rujukan.md)
80. ✅ Label Menilai Jawaban Akhir Saja, Sumber Tanpa Kutip Diterima — Uji Mutu RAG Putaran 4–5 (2026-09-14) — [log](../project-memory/changelog/2026-09-14-label-jawaban-akhir-putaran-4-5.md)
81. ✅ Pasangan Angka–Tahun di Kalimat Bebas, Sumber Parafrase Diterima — Uji Mutu RAG Putaran 6–7 (2026-09-14/15) — [log](../project-memory/changelog/2026-09-15-pasangan-kalimat-sumber-parafrase-putaran-6-7.md)
82. ✅ Coordinator & Sub-Agent Lewat OpenRouter; Kunci Server Gemini/Groq Dihapus (2026-09-15) — [log](../project-memory/changelog/2026-09-15-coordinator-openrouter-kunci-gemini-groq-dihapus.md)
83. ✅ Riset Web di Server, Tombol Deep Research, Penjaga Batas Waktu & "Lanjutkan" (2026-09-15) — [log](../project-memory/changelog/2026-09-15-riset-web-deep-research-batas-waktu-lanjutkan.md)
84. ✅ Tombol Memory Memutus Lima Jalur Memori (2026-09-15) — [log](../project-memory/changelog/2026-09-15-tombol-memory-memutus-jalur-memori.md)
85. 📝 Folder Kerja Assistant — Tombol 📁 Menjadi Tempat Mamet Bekerja (2026-09-15) — [rancangan](./ROADMAP-FOLDER-KERJA-ASSISTANT.md)
86. 🔧 OCR PDF: Batas Laju & Konfirmasi OCR Massal (2026-09-16) — [rancangan](./ROADMAP-TABEL-CENTANG-PDF.md) sisa di §7 no. 3 · [log](../project-memory/changelog/2026-09-16-ocr-batas-laju-dan-konfirmasi-massal.md)
87. ✅ Potongan RAG Tidak Memenggal Daftar Bernomor (2026-09-16) — [log](../project-memory/changelog/2026-09-16-potongan-tidak-memenggal-daftar-bernomor.md)
88. 🟡 Tabel Centang PDF — Kolom dari Koordinat, Bukan dari OCR (2026-09-17) — [rancangan](./ROADMAP-TABEL-CENTANG-PDF.md) · [log](../project-memory/changelog/2026-09-17-tabel-centang-pdf-dari-koordinat.md) · [log](../project-memory/changelog/2026-09-17-tabel-centang-kontrak-dan-label.md) · [log per jabatan](../project-memory/changelog/2026-09-17-buku-kepbup-per-jabatan-dan-unggah-banyak.md)
89. ✅ Konteks Potongan RAG — Bagian Tidak Tercampur & Judul Konteks (2026-09-17) — [rancangan](./ROADMAP-KONTEKS-POTONGAN-RAG.md) · [log](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)
90. ✅ Pengambilan Potongan RAG — Diukur Dulu, Pola Standar Hanya Bila Cocok (2026-09-17) — [rancangan](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md) · [log](../project-memory/changelog/2026-09-17-utang-lama-rag-dan-kode-mati.md) · [log A](../project-memory/changelog/2026-09-17-uji-pengambilan-potongan-baseline.md) · [log B](../project-memory/changelog/2026-09-17-pencarian-gabungan-vektor-kata.md) · [log C](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)
91. ✅ Hapus Dokumen RAG — Cek Baris Terhapus & Muat Ulang Daftar (2026-09-17) — [log](../project-memory/changelog/2026-09-17-hapus-dokumen-cek-baris-terhapus.md) · web live ✅, hapus desktop/mametlite belum teruji

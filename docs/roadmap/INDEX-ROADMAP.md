# INDEX-ROADMAP — Titik Masuk AI Coding

**Untuk siapa:** AI coding (bukan Engineer — Engineer memakai `INIT.md`). Baca dokumen ini utuh lebih dulu,
lalu buka **hanya** dokumen yang ditunjuk.
**Update terakhir:** 2026-09-28 (penyelarasan status: baris yang sudah ✅ di dokumen sumbernya tetapi masih
⚠️/"belum teruji" di sini — lihat catatan di akhir §4; riwayat detail lama:
[`INDEX-ROADMAP-ARSIP-2026-09-17.md`](./INDEX-ROADMAP-ARSIP-2026-09-17.md))

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
| 92 Data tabel rekonsiliasi ASN | 📝 Tahap 1–5 ✅ (pratinjau Excel; simpan + versi; tanya-jawab chip Data Tabel, live 5/5 VERIFIED, NIP tidak ke model; laporan kejanggalan per OPD + Excel; PDF pindaian lewat OCR); sisa koreksi pemetaan (ditunda), kejanggalan lewat chat (opsional) | [`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](./ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md) |
| 93 Kedaulatan data | 📝 temuan RLS "baca semua" ✅ ditutup; Tahap 1 ✅ tombol "Cadangkan data" (13 tabel + vektor, terbukti 13/13 cocok; backup-export lama dihapus); Tahap 2 ✅ uji pulih ke Postgres lokal (13/13, pencarian sama); Tahap 3 embedding lokal & 4 offline penuh jangka panjang | [`ROADMAP-KEDAULATAN-DATA.md`](./ROADMAP-KEDAULATAN-DATA.md) |
| 90 Pengambilan potongan RAG | ✅ Tahap A–C (recall@8 14/14, bukti Kepbup #1, live); U8a ✅ (RAG Mametlite live + layar kunci + label stream), U10 ✅; sisa utang U4, U6, U7, U8b, mode LITE tak aktif | [`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md) |
| 88 Tabel centang PDF (+ sisa 86 OCR massal) | 🟡 Tahap 1–3 ✅; keputusan 3: buku per jabatan **221/221** masuk; 177 ✅, 191/159 keterbatasan; set uji buku penuh **13/14**; sisa BUKU-10 (blok centang miskin kata, sesudah code freeze) | [`ROADMAP-TABEL-CENTANG-PDF.md`](./ROADMAP-TABEL-CENTANG-PDF.md) |
| 72 Adaptive Shell (UI multi-device) | ⏸️ **DITUNDA 2 Okt atas permintaan Owner** (murni tata letak layar) — dan **sasaran rencananya salah**: FASE 1–4 menunjuk `frontend/src` (67 breakpoint, hanya Owner) padahal yang berantakan di HP adalah `mametlite/src` (**0** prefiks responsif dari 97 `className`; bilah sisi `w-80` tetap menyisakan ±55px untuk chat di HP 375px; nol drawer). Akarnya satu berkas, bukan empat fase. Ikut ketahuan: `mametlite/src/App.css` 184 baris **tidak diimpor di mana pun** (perancah Vite) — penghapusan menunggu izin Owner | [`roadmap-adaptive-shell.md`](./roadmap-adaptive-shell.md) |
| 33, 48, 49, 50, 91 Temuan audit tanpa rancangan | ⏳ T1 daftar izin sub-agent di server (arah disetujui; sesudah ganti token Apify) · T2 ✅ dasbor yatim dihapus · T3 ✅ rute mati dihapus · T4 ✅ · T6 ✅ · T7 ✅ kunci API di `agent_logs` (sisa: Owner ganti kunci) · T8 ✅ perintah Engineer tanpa shell + profil peran (jalur PowerShell/`run-terminal-command` dihapus; aturan Engineer kembali sampai ke model; hasil mesin bukan kueri Web/RAG/memori) · T10 sumber pengetahuan Engineer (Tahap 1 ✅ RAG Engineer hanya space "Pengetahuan Engineer"; TUGAS-01 ✅ live 1 baris; riwayat chat setelah muat ulang & urutan riwayat diperbaiki; **prosedur kerja Engineer** ditulis di `constitution/28` + RULE 0 + 3 penjaga kode — TUGAS-01..04 ✅ live — TUGAS-02 lulus patch tapi gagal pembuktian `git grep`, TUGAS-04 11/12 klaim terbukti dengan model kuat; **Engineer sudah siap dari aplikasi terpasang sejak 28 Sep** — akar repo dipilih Owner, terbukti live di .exe (Tahap 5, `ROADMAP-ENGINEER-MANDIRI.md`); setelan & riwayat tetap terpisah dari `npm run desktop`; Tahap 2–3 belum) · T11 ⚠️ **SEPARUH** (klaim lama "DITUTUP 29 Sep" dikoreksi 4 Okt) — `check-keys` memang hilang dari repo (`23b8714`, nol pemanggil di klien), tetapi **masih ACTIVE di Supabase**: versi 60, terakhir disentuh 10 Sep, sumber ter-deploy sama persis dengan yang di riwayat git — penghapusan di platform tak pernah terjadi. Ia alat uji koneksi dari era kunci server; penggantinya sudah hidup (tombol **Test Connection** di `Settings.jsx:214`, memakai kunci PENGGUNA lewat `x-byok-{provider}`). Biaya membiarkannya: tiap panggilan memicu panggilan API berbayar ke empat penyedia, dan jawabannya memuat **8 huruf pertama** tiap kunci Gemini, tanpa pemeriksaan pengguna. Nol panggilan dalam 24 jam, tetapi log Supabase hanya menyimpan 24 jam jadi riwayat lamanya tak bisa diketahui. **Menunggu Owner menghapusnya dari dashboard** (sisa terpisah: hak bawaan 40 tabel bagi anon/authenticated, butuh daftar pemakai per tabel dulu) · T9 ✅ knowledge_manager dihapus (workspace dikelola dari UI Research App) · T12 ✅ **29 Sep** penjaga berkas rahasia (`.env`/`*.key`/`*.pem` ditolak dibaca; `.env.example` tetap terbaca) — sisanya **batas yang diketahui**, bukan pekerjaan · T13 CHIMERA ditolak; lapisan per-klaim leksikal dimatikan; **keputusan Owner 28 Sep: hakim bayangan TETAP MEMBAYANGI** sampai angka ketidaksepakatan cukup dihitung — tak ada pekerjaan, menunggu data · T14 ✅ **29 Sep** nama penyedia disimpan per pesan (penyedia TIDAK dikunci); jalur non-stream terbukti live, **jalur stream menunggu satu chat Ecosystem yang mengalir** | [`ROADMAP-TEMUAN-TERBUKA.md`](./ROADMAP-TEMUAN-TERBUKA.md) |

---

## 2. Dokumen Roadmap

| Dokumen | Status | Cakupan |
|---|---|---|
| `ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md` | 📝 Item 92 (Tahap 1–5 ✅) | xlsx ASN → baris data, pratinjau Owner, hitung/saring oleh kode (bukan RAG) |
| `ROADMAP-KEDAULATAN-DATA.md` | 📝 Item 93 (Tahap 1–2 ✅) | cadangan terverifikasi, Postgres lokal, peta lapisan offline |
| `ROADMAP-PENGAMBILAN-POTONGAN-RAG.md` | ✅ Item 90 (A–C) | peta jalur RAG vs pola umum, utang lama, set uji → hybrid → konteks |
| `ROADMAP-KONTEKS-POTONGAN-RAG.md` | ✅ Item 89 | pemisah bagian tabel OCR + baris konteks potongan |
| `ROADMAP-TABEL-CENTANG-PDF.md` | 🟡 Item 88 | kolom centang dari koordinat pdf.js, kontrak & label |
| `ROADMAP-TEMUAN-TERBUKA.md` | ⏳ T1, T10, T11, **T12** (membaca berkas = mengirimnya ke penyedia model; tanpa pemberitahuan), **T13** (CHIMERA WASM ditolak masuk `agent-process`: aman [nol impor] tapi 5 dari 6 kasus Mamet nyata salah — jawaban benar dicap KONTRADIKSI 0,95; gagasan per-klaim diserap jadi `klaim_sumber.ts` + label PARTIAL, **diuji live lalu DIMATIKAN 28 Sep**: melewatkan ekstrapolasi sekosakata [0,18] dan menuduh kalimat percakapan [11 dari 12, "Semoga membantu, Pak Slamet." 0,00] pada 24% jawaban VERIFIED — instrumen leksikal salah, bukan setelannya; syarat menyalakan kembali dicetak oleh `uji-klaim-sumber.mjs`; **hakim bayangan per kalimat** dibangun sebagai gantinya — berhenti mengukur, tanya model seperti Item 55 — kini hidup & terbukti: mengenali kalimat percakapan, menangkap ekstrapolasi yang lolos leksikal, tidak menuduh jawaban benar, ±15% biaya), **T14** (satu model `deepseek-v4-flash` dilayani **8 penyedia** berbeda dalam 4 jam — gaya jawaban, biaya, dan latensi berayun tanpa kode berubah; jangan kaitkan mutu jawaban ke perubahan kode sebelum rute penyedia diperiksa) (T2–T9 ✅) | temuan audit tanpa rancangan sendiri |
| `ROADMAP-ENGINEER-MANDIRI.md` | 🟡 Tahap 2 ✅ · 3a ✅ · **3b ✅** (ingatan temuan di repo, TMN-0001 live; tujuh cacat jalur patch ditutup — tugas perbaikan kode Engineer pertama selesai ujung ke ujung). **Tahap 5 ✅ kode selesai 28 Sep** (akar repo dipilih Owner; wajib `.git`, folder instalasi ditolak) — **TERBUKTI LIVE di .exe**: `git status` menunjuk repo Owner, bukan `not a git repository`; membuka jalan Tahap 6 & T12. Baca berkas besar ✅ (git grep/blame sudah diizinkan, hanya tak pernah diajarkan — 59× lebih kecil dan menjangkau baris yang git show tak capai; TMN-0001 ditutup). Kode mati READ_REPO ✅ dihapus (219 baris; RepositoryReaderService tetap hidup untuk FileExplorer). Model kini diberi tahu akar repo-nya tiap kiriman ✅. **Tahap 6 ✅ kode selesai 28 Sep** (belum live): patch diterapkan DULU lalu 51 berkas uji dijalankan (16,9 dtk); gagal → berkas dikembalikan sendiri tanpa dialog, lalu yang gagal dijalankan ULANG untuk memisahkan "rusak oleh patch" dari "sudah merah sebelumnya" — tanpa itu satu uji merah lama akan memulihkan setiap patch yang benar. Uji cermin ditandai `UJI-CERMIN:` dan tidak dihitung sebagai bukti keselamatan. Sisa: Engineer:AnalyzeTask & ReviewChanges juga tanpa pemancar (belum diputuskan); Tahap 1 & 4 | Engineer memelihara Mamet sendiri: lingkaran baca-saja beranggaran, mesin uji klaim, ingatan temuan; menulis tetap butuh izin Owner |
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
48. ✅ Instrumentasi Sistem Ini Terputus dari Sistemnya — Enam Dasbor Yatim (~1.200 baris) — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T2 ditutup
49. ✅ Ranjau di Kode Mati — Aman Sekarang, Merusak Kalau Disambungkan — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T3 ditutup
50. ✅ Sisa Temuan Kecil (2026-09-10) — [rancangan](./ROADMAP-TEMUAN-TERBUKA.md) T4 ditutup
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
85. ✅ Folder Kerja Assistant — Tombol 📁 Menjadi Tempat Mamet Bekerja (2026-09-15) — [rancangan](./ROADMAP-FOLDER-KERJA-ASSISTANT.md) · [log Tahap 1](../project-memory/changelog/2026-09-22-folder-kerja-tahap1-baca.md) · [log Tahap 2](../project-memory/changelog/2026-09-22-folder-kerja-tahap2-tulis.md) · [log Tahap 3](../project-memory/changelog/2026-09-22-folder-kerja-tahap3-jalankan.md)
86. 🔧 OCR PDF: Batas Laju & Konfirmasi OCR Massal (2026-09-16) — [rancangan](./ROADMAP-TABEL-CENTANG-PDF.md) sisa di §7 no. 3 · [log](../project-memory/changelog/2026-09-16-ocr-batas-laju-dan-konfirmasi-massal.md)
87. ✅ Potongan RAG Tidak Memenggal Daftar Bernomor (2026-09-16) — [log](../project-memory/changelog/2026-09-16-potongan-tidak-memenggal-daftar-bernomor.md)
88. 🟡 Tabel Centang PDF — Kolom dari Koordinat, Bukan dari OCR (2026-09-17) — [rancangan](./ROADMAP-TABEL-CENTANG-PDF.md) · [log](../project-memory/changelog/2026-09-17-tabel-centang-pdf-dari-koordinat.md) · [log](../project-memory/changelog/2026-09-17-tabel-centang-kontrak-dan-label.md) · [log per jabatan](../project-memory/changelog/2026-09-17-buku-kepbup-per-jabatan-dan-unggah-banyak.md)
89. ✅ Konteks Potongan RAG — Bagian Tidak Tercampur & Judul Konteks (2026-09-17) — [rancangan](./ROADMAP-KONTEKS-POTONGAN-RAG.md) · [log](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)
90. ✅ Pengambilan Potongan RAG — Diukur Dulu, Pola Standar Hanya Bila Cocok (2026-09-17) — [rancangan](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md) · [log](../project-memory/changelog/2026-09-17-utang-lama-rag-dan-kode-mati.md) · [log A](../project-memory/changelog/2026-09-17-uji-pengambilan-potongan-baseline.md) · [log B](../project-memory/changelog/2026-09-17-pencarian-gabungan-vektor-kata.md) · [log C](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)
92. 📝 Data Tabel Rekonsiliasi ASN — Hitung & Saring oleh Kode, Bukan RAG (2026-09-21) — [rancangan](./ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md) · [log Tahap 1](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap1-pembaca-pratinjau.md) · [log Tahap 2](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap2-simpan-versi.md) · [log Tahap 3](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap3-tanya-jawab.md) · [log Tahap 4](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap4-kejanggalan-per-opd.md) · [log Tahap 5](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap5-pdf-pindaian.md)
91. ✅ Hapus Dokumen RAG — Cek Baris Terhapus & Muat Ulang Daftar (2026-09-17) — [log](../project-memory/changelog/2026-09-17-hapus-dokumen-cek-baris-terhapus.md) · web live ✅; T5 ditutup — cascade `document_chunks` dicek di DB live, potongan yatim 0
93. 📝 Kedaulatan Data — Salinan Sendiri yang Terbukti Bisa Dipulihkan, lalu Postgres Lokal (2026-09-22) — [rancangan](./ROADMAP-KEDAULATAN-DATA.md) · [log RLS](../project-memory/changelog/2026-09-22-rls-tutup-baca-semua.md) · [log Tahap 1](../project-memory/changelog/2026-09-22-cadangan-data-lengkap.md) · [log Tahap 2](../project-memory/changelog/2026-09-22-uji-pulih-postgres-lokal.md)
94. ✅ Jawaban Mendarat di Percakapan yang Salah — Identitas Kiriman (2026-09-28) — [log](../project-memory/changelog/2026-09-28-jawaban-masuk-percakapan-salah.md) · dilaporkan Owner; **terbukti live 28 Sep** — jawaban tidak lagi tertukar. Batas yang diterima Owner: jawaban yang belum selesai belum muncul di riwayat

100. ✅ Peta Repo untuk Engineer (2026-10-01) — [log](../project-memory/changelog/2026-10-01-peta-repo-engineer.md) · lahir dari keberatan Owner "seperti memperbodoh model". **Diukur:** Engineer menerima ±5.400 token ATURAN dan hanya ±1.200 token kode; tak ada satu pun blok untuk kode sumber; anggaran 60.000 token terpakai seperenam. Peta 270 berkas + jumlah baris (±3.870 token, 0,13 detik, satu perintah git). **TERBUKTI LIVE di 4.2.4** — tetapi baru sesudah akar kegagalannya ditutup (item 103): di 4.2.3 petanya tak pernah sampai. Bukti: `[PROMPT_KOMPOSISI]` 4.042 → 16.945 huruf; model menyebut 271 berkas dan empat angka teratas persis, angka hari itu yang hanya ada di peta baru. **Sisa yang belum terjawab:** urutan kelima salah — `verification_engine.ts` (1144) dilewati demi `engineer.js` (1120), satu-satunya berkas `supabase/functions` di jajaran atas; perlu diamati apakah peta terbaca merata. Dua arahan Owner lain sengaja ditunda agar pengaruh peta terukur sendirian: batas keluaran ikut model (masih 20 KB mati), dan porsi konteks Engineer (batas harian itu plafon, bukan jatah yang dibagi)
115. ✅ Cadangan Kunci Sistem yang Terlewat + Dua Catatan Salah (2026-10-04) — [log](../project-memory/changelog/2026-10-04-byok-tanpa-kunci-sistem.md) · berawal dari satu pertanyaan Owner *"check-keys itu fitur test koneksi?"*. **(a)** Keputusan BYOK 10 Sep menutup cadangan kunci sistem untuk Gemini, Groq, OpenRouter — **OpenAI terlewat**: `openAI: … : openAIKey` memberi kunci OpenAI Owner ke setiap pengguna yang penyedianya bukan openai. Ditelusuri sampai habis sebelum dilaporkan sebagai bahaya (saya sempat menyebutnya "lubang nyata" di tengah penelusuran — **terlalu cepat, dikoreksi**): hari itu tak ada yang memakainya — `getAdapter()` nol pemanggil, satu-satunya kaskade memakai `['openrouter','gemini','groq']`, dan `env.OPENAI_API_KEY` ke sub-agent tak pernah dibaca. Jadi **pistol terisi tanpa pelatuk**: satu nama ditambahkan ke satu `preferredOrder` sudah cukup melepaskan akibat nomor 1 yang justru dilarang keputusan itu. Ditutup; `OPENAI_API_KEY` kini **tidak dibaca sama sekali**. **(b)** `runtime_context.ts:42` menyatakan `openRouter` jatuh ke `OPENROUTER_API_KEY` sistem — **basi 19 hari** (dihapus 15 Sep, kodenya jatuh ke header pengguna); saya membaca komentarnya dan melaporkannya sebagai keadaan sekarang. Diperbaiki **beserta alasannya**. **(c)** T11 dikoreksi dari ✅ jadi ⚠️ SEPARUH — `check-keys` hilang dari repo tetapi **masih ACTIVE di Supabase** (versi 60, 10 Sep, sumber ter-deploy sama persis); alat uji koneksi era kunci server, penggantinya `Settings.jsx:214` sudah hidup. Nol panggilan 24 jam, tetapi log hanya menyimpan 24 jam — dikatakan apa adanya. Penghapusan dashboard menunggu Owner. **Tidak jadi temuan:** 3 WARN advisor `SECURITY DEFINER` ternyata dijaga sungguhan (`auth.uid()` + `search_path`), dan `match_documents*` adalah `SECURITY INVOKER` sehingga RLS berlaku — advisor mencocokkan pola. Ujinya **sengaja umum**: tak satu pun nilai di blok `keys:` boleh berasal dari `Deno.env`, plus larangan variabel kunci perantara. **M3 (penyedia lain diberi cadangan) menjatuhkan 2 asersi** — itu yang membuktikan penjaganya bukan tambalan khusus OpenAI. 76/76 hijau, bundel bersih. **PERLU DEPLOY**, tanpa rilis klien
114. ✅ RAG yang Mati Sendiri Akhirnya Bersuara (2026-10-02) — [log](../project-memory/changelog/2026-10-02-rag-turun-bersuara.md) · **koreksi laporan saya sendiri:** saya mengatakan embedding gagal = "model menjawab tanpa konteks apa pun" — terlalu keras, ADA cadangannya. Yang benar: akibatnya **berbeda di dua jalur**. Dokumen turun ke pencocokan **kata** — justru perilaku yang Item 64/65 buktikan jauh lebih buruk (dokumen yang pertanyaannya tak memuat kata dari judulnya **tidak ditemukan sama sekali**); memori **dilewati seluruhnya** karena hanya bisa ditemukan lewat vektor. Keduanya dulu hanya `console.warn` di sisi server, sementara `processingSteps` tetap melaporkan **✅ [RAG TIER 1 OK]** dengan nama strategi internal sebagai satu-satunya petunjuk. Bersambung dengan saldo OpenRouter yang boleh minus & tetap melayani sebagian. **Perbaikan:** `JejakEmbedding` opsional membedakan `'tanpa-kunci'`/`'galat'`/`'dimensi'` (kode 402 terbawa, jadi saldo habis bisa dibedakan dari galat jaringan) — array kosong tetap jadi kembaliannya agar kelima pemanggil tak tersentuh; penurunannya ditulis ⚠️ beserta **akibatnya**, bukan nama keadaan internal. **Uji mutasi membongkar klaim saya sendiri:** pengerasan `?? []` saya duga mencegah kembalian `undefined` — ternyata kembaliannya `[]` di kedua versi (TypeError ditelan `catch` sendiri); yang berbeda adalah **tuduhannya** (`galat: Cannot read properties of undefined` vs `dimensi: didapat 0, perlu 768`). M3 lolos (0 asersi) sampai asersinya ditulis ulang. Ujinya **menjalankan pintu embedding asli** di Node lewat esbuild lokal + penyedia vektor palsu. 75/75 hijau, bundel bersih. **PERLU DEPLOY.** Ditunda: vektor dicoba **dua kali** per pesan saat gagal (≤15 detik tambahan hanya bila sebabnya waktu habis) — soal biaya, bukan kebisuan
113. ✅ Pemutus Arus yang Hukumannya Tak Pernah Habis — TMN-0004 DITUTUP (2026-10-02) — [log](../project-memory/changelog/2026-10-02-pemutus-arus-engineer.md) · temuannya berbunyi "`upgradeCapability()` nol pemanggil", tetapi itu akibat. Cacatnya: pencacah di `_handlePatchTask` adalah **pembatas laju** — jendelanya mereset tiap 60 detik, hukumannya **tidak**. Enam patch dalam semenit = Engineer berhenti menambal **sampai aplikasi ditutup**, dan senyap (hanya `console.warn`, nol `emit`), sehingga pesan yang Owner lihat ("belum memiliki kapabilitas IMPLEMENTER") benar tetapi tak bisa ditindaklanjuti. **Lubang yang hampir dibuat sambil memperbaikinya:** ada demosi KEDUA memakai `'OBSERVER'` yang sama (3 percobaan berkas inti) yang **sengaja lengket** — pemulihan otomatis tanpa membedakan sebab akan mengangkatnya semenit kemudian. Jadi tiap demosi mencatat `_sebabDemosi`, dijaga **dua arah**: otomatis menolak menyentuh `'keamanan'`, dan pemutus arus tak boleh **menimpa** `'keamanan'` jadi `'laju'`. Nyaris lolos juga: `upgradeCapability()` menihilkan `suspiciousAttempts`, jadi pulihnya pembatas laju akan menghapus hitungan percobaan berkas inti — `opsi.otomatis` memisahkan haknya. Ujinya **menjalankan kelas `Engineer` asli** (bisa diimpor di Node dengan serviceManager palsu), bukan mencocokkan teks kode — pola yang lebih kuat, layak dipakai lagi. Uji mutasi M1–M4 semua menggigit; **M4 awalnya hanya 1 asersi** karena yang kedua lolos secara kebetulan (mutasinya menyimpan `'OBSERVER'` sebagai kapabilitas-sebelum-demosi) → ditutup. 74/74 hijau. Renderer saja, **tanpa deploy**. Batas sadar: UI masih memberinya judul "⚠️ Patch Gagal" untuk penahanan sementara
112. ✅ Lampiran untuk Engineer — Mata terhadap Tata Letak, dan Dokumen Instruksi (2026-10-02) — [log](../project-memory/changelog/2026-10-02-lampiran-engineer.md) · Owner: *"sebagai MATA untuk engineer terhadap aplikasi yang dikerjakannya menyangkut tata letak, dan dokumen yang bisa ditempel agar engineer tahu instruksi teknis."* Engineer bisa MEMBACA kode sejak 1 Okt; ini yang membuatnya bisa MELIHAT hasilnya — tangkapan layar satu-satunya bukti tentang rupa aplikasi, tak bisa diturunkan dari kode. **Cacat yang ketahuan saat mengerjakannya:** klien mengirim medan `type`, server membaca `file.mimeType` — dan `mimeType` **nol kemunculan** di seluruh frontend. Jadi cabang gambar **TIDAK PERNAH menyala**: setiap tangkapan layar di ruang mana pun jatuh ke cabang terakhir dan model hanya menerima nama berkas. Fitur yang terlihat ada tetapi buta. Diperbaiki: server menerima `type` DAN `mimeType`, plus akhiran berkas bila mime kosong; klien tidak diubah karena `type` memang nama standarnya. Dokumen teknis diperluas (json/yaml/sql/ts/tsx/sh/ps1/py dll, semua teks biasa, batas 50.000 huruf tetap). Janji lama *"PDF akan dibaca secara ringkas"* — yang tak pernah ditepati — diganti **"ISINYA TIDAK DIBACA"** + larangan menebak dari nama berkas. Tombol dibuka untuk Engineer tanpa mencabut dua ruang lama; judulnya menyebut T12 di tempat Owner menekannya. Model diberi tahu lewat langkah [0.2e]: sebut yang DILIHAT sebelum menafsirkan. **Risiko T12 diterima sadar oleh Owner.** Satu asersi menjaga tidak ada backtick di [0.2e] — jebakan yang menggagalkan bundel beberapa jam sebelumnya. **Perlu DEPLOY, belum diuji live**
111. ✅ Grep-Sebagian & Gembok Dua Arti — Mutu Bukti Engineer (2026-10-02) — [log](../project-memory/changelog/2026-10-02-grep-sebagian-dan-gembok.md) · Owner memilih dua ini karena *"menyangkut kemudahan engineer mencari informasi code mamet, agar dapat memberikan path yang benar dan tepat"*. **(A) grep terbaca sebagai isi berkas:** `git grep` mengembalikan baris yang COCOK — tidak ada yang dipotong, jadi `petunjukKeluaranTerpotong` DIAM dan hasilnya tampak lengkap. Hasil rapi tanpa tanda justru paling meyakinkan; pandangan tersaring disangka keseluruhan. Penjaga ketiga `petunjukGrepSebagian` menyebut JUMLAH baris, menegaskan itu bukan isi berkas, memberi CARA keluarnya (`-B2 -A4`, `git blame -L`), dan tetap mengakui kesimpulan ADA/TIDAKNYA pola itu sah. **DIAM** bila sudah minta konteks atau hanya menghitung/mendaftar — penjaga yang cerewet akan diabaikan juga saat benar. **(B) satu gembok dua arti:** `(ditolakAturan || ditolakProsedur) ? 'blocked'` membuat layar menuduh *"Tidak diizinkan untuk Engineer … jalankan sendiri di terminal"* untuk perintah yang sebenarnya BOLEH dan hasilnya sudah ada di layar. Owner melihat gembok pada `git grep`-nya dan menyimpulkan grep dibatasi — yang salah layarnya. Kini keadaan `'diulang'` tersendiri, ikon `history`, nada netral; larangan sungguhan tetap gembok dan tetap tegas. **Uji menjaga penjaga itu DIAM pada saat yang tepat** (4 bentuk konteks, 4 bentuk hitung/daftar, bukan-grep, kosong, gagal), plus ikon wajib ada di subset font DAN berbeda dari `lock`. **Belum diuji live**
110. ✅ Brain 1 Dibersihkan & Bisa Ditulis — Engineer Akhirnya Mengumpulkan Pengetahuan (2026-10-02) — [log](../project-memory/changelog/2026-10-02-brain1-bisa-ditulis.md) · Owner: *"engineer belum bisa menulis agar bisa semakin pintar terhadap pengetahuan mamet ecosystem."* **Diukur:** blok "BRAIN 1 — Source of truth for architecture & rules" berisi 15 baris yang SEMUANYA dibuat 27 Juni 2026 lalu berhenti; **nol jalur tulis di seluruh repo**; dan 3 dari 8 slot terpakai duplikat (ADR-0007 ×2, Engineer Dashboard ×2) serta klaim palsu (`EngineerDashboard.jsx` tidak ada) — sehingga 2 entri sahih tak pernah sampai ke model. **Tahap 1:** tiga baris dipensiunkan (`is_current=false` + SUPERSEDED/DEPRECATED, **bukan dihapus**) → 7 entri unik, semuanya muat. Satu koreksi diri: entri "capability boundary" ternyata MASIH benar, tidak jadi disentuh. **Tahap 2:** `PengetahuanBrain1.js` — blok `<pengetahuan>` eksplisit, prosa TIDAK ditangkap, blok cacat dilaporkan bukan ditelan, jenis dinormalkan bukan ditolak, judul dibaca ULANG dari database sebelum menulis, ditandai `Hypothesis` + `created_by: engineer`, dan `approved_by` diisi karena klik Owner itulah izinnya. **Di database, bukan berkas repo** — edge function tak bisa membaca repo; justru rumah itulah yang terbukti membusuk diam-diam tiga bulan. **Model DIBERI TAHU** lewat langkah [0.2d] — pelajaran termahal 1 Okt: kemampuan yang tak disebut di prompt tak akan pernah dipakai. **Jebakan tertangkap:** backtick di dalam template literal menggagalkan bundel (`Expected ";" but found "judul"`) — tertangkap sebelum minta deploy; dan jendela pencarian uji 500 huruf memberi merah palsu. **Perlu DEPLOY, belum diuji live**
109. ✅ Engineer Berhenti Menulis Memori Pribadi Owner (2026-10-01) — [log](../project-memory/changelog/2026-10-01-memori-engineer-bersih.md) · Owner melihat panel Memory Context: *"ada yang masuk ke memory context, wajarkah?"* **Diukur:** 6 dari 18 memori — sepertiga daftar pribadinya — lahir dari mesin dalam beberapa jam (`Engineering session ENG-SESSION-…`, `Patch PATCH-… applied`), sementara 12 memori Owner sungguhan terkumpul sejak 23 Juni. **Dibuang, bukan dipindah:** (1) tak ada yang membacanya — `engineer_session`/`engineer_patch` cuma muncul di tempat penulisannya; (2) isinya nomor mesin, sedangkan jenis memori server adalah IDENTITY/LOCATION/JOB/PREFERENCE/PROJECT yakni fakta pribadi Owner; (3) melanggar kontrak Engineer sendiri (*"Tidak boleh menulis memory otomatis"*). Memindahkan nomor sesi ke rak lebih rapi tetap memindahkan sampah. **Rumah yang benar sudah ada:** `TEMUAN-ENGINEER.md` (berkas di dalam repo, bisa Owner koreksi, sisipan tiap kiriman), Brain 1 untuk Lesson/RootCause, dan `git log` yang selalu benar serta kini jalan tanpa izin. **Perbandingan yang menjelaskan segalanya:** temuan sungguhan 1 baris seminggu, nomor sesi 6 baris sehari — yang otomatis tumbuh, yang perlu keputusan mandek. Dugaan sebab keringnya: kacamata kuda baru dilepas hari ini, dan TMN-0001 sendiri lahir dari `git grep`. **6 baris lama belum dihapus** — menunggu izin tegas Owner. **Belum diuji live**
108. ✅ Patokan Sisipan Sampai ke Server — MISTERI PETA HILANG TERPECAHKAN (2026-10-01) — [log](../project-memory/changelog/2026-10-01-patok-sampai-server.md) · bukti dari log server sendiri: `[Riwayat] 3 pesan, 16999 → 16999` lalu `[Riwayat] 5 pesan, 17311 → 2065`. **Sebabnya** `rapikanRiwayat()` memangkas setiap pesan kecuali **dua terakhir** menjadi 800 huruf, dan sisipan ada di DEPAN — jadi begitu percakapan punya lebih dari dua pesan, peta 16.059 huruf dipotong jadi 800. Hitungannya cocok sampai satuan huruf (428+813+512+47+265 = 2.065). **Cacat arsitektur yang SAMA dengan yang sudah diperbaiki di klien**, tetapi pemangkas server berdiri sendiri dan tak terlihat dari sisi klien. **Dan kekeliruan saya sendiri yang membuatnya mungkin:** penanda `_patok` sengaja saya buang sebelum dikirim demi "kebersihan" — itu yang menutup mata penjaga di seberang. **Empat teori meleset** sebelum instrumen `[Sisipan]` (item 107) menemukannya dalam SATU kali jalan, dengan memisahkan "tidak pernah dibuat" dari "hilang di jalan". Diperbaiki: penanda ikut ke payload, `rapikanRiwayat` melewati pesan berpatok. Perapian riwayat untuk pesan BIASA tidak diubah (Item 68 — peringkas AI lama makan 36,5 detik dan lebih mahal daripada yang dihemat). **Uji menguji PERILAKU** — modul servernya bisa diimpor Node, jadi `rapikanRiwayat()` benar-benar dijalankan; totalnya kembali 17.311. Satu uji lama dibalik karena aturan yang saya tulis beberapa jam sebelumnya ternyata keliru. **✅ TERBUKTI LIVE 1 Okt 14.46–14.48** (server ter-deploy + klien 4.2.7): `3 pesan 16999→16999`, `5 pesan 19202→19202` (kiriman ke-2 **tidak turun**, sebelumnya 18756→3510), `7 pesan 22449→21108` — dan yang ketiga membuktikan hal kedua: **masih memangkas 1.341 huruf**, jadi perapian riwayat untuk pesan BIASA tidak ikut mati. `[PROMPT_KOMPOSISI]` menegaskan dari sisi lain: riwayat 19.202 lalu 21.108 huruf. **Biaya kini benar-benar dibayar:** riwayat per pesan Engineer naik dari ±2.000 jadi ±19.000–21.000 huruf (±5.000 token)
107. ✅ Jejak Sisipan — MATA untuk Hilangnya Konteks di Kiriman Lanjutan (2026-10-01) — [log](../project-memory/changelog/2026-10-01-jejak-sisipan.md) · **bukan perbaikan, instrumen.** Sisipan hilang di kiriman lanjutan (riwayat 16.945 → 2.290 huruf) padahal mode tetap ENGINEER, dan **tiga teori sudah ditumbangkan angka** (anggaran sempit & LOOKUP dari saya, jendela konteks dari Owner). Sisipan disusun di sisi KLIEN dan tak meninggalkan jejak di log server — itu sebabnya buta. **Yang paling merugikan bukan petanya:** uji live justru berhasil di kiriman TANPA peta; yang hilang diam-diam adalah **ingatan temuan**, dan memindahkan peta ke berkas tidak menyembuhkannya. Satu baris per kiriman: `petaMentah` dipisah dari `peta` supaya **dua kerusakan yang gejalanya identik** (jembatan IPC gagal vs penyusun catatan membuang isi) menghasilkan baris berbeda; yang kosong disebut NAMANYA, bukan sekadar jumlahnya; `mulaiDari` ikut dicatat supaya tak perlu bertanya ke Owner. **Isi TIDAK dicatat** — hanya ukuran, akar repo dilaporkan ADA/KOSONG bukan alamatnya; 5 asersi menjaga kebocoran. Dicatat SEBELUM pemotongan, supaya menggambarkan yang DISUSUN bukan yang tersisa. **Belum diuji live** — buka DevTools Console, kirim dua pesan berturut-turut di satu percakapan Engineer
106. ✅ Engineer Tidak Boleh Pernah Jatuh ke Jalur Ringan (2026-10-01) — [log](../project-memory/changelog/2026-10-01-engineer-tak-jatuh.md) · keputusan Owner: *"engineer tidak boleh pernah jatuh"*. **Koreksi laporan sebelumnya:** ranjaunya saya gambarkan berlebihan — `RequestClassifierService:162` SUDAH mengembalikan `type: 'ENGINEER'` dan tak pernah mencapai cabang LOOKUP. Lubangnya hanya lewat `resolvedMode` yang meleset, dan jalan itu nyata: **dua sumber kebenaran** — layar memakai `osState?.workspaceId`, kiriman memakai `workspaceManager?.activeWorkspaceId || 'ws-assistant'` yang **jatuh diam-diam ke assistant**. Kalau menyala, tiga kehilangan sekaligus tanpa tanda: sisipan terbuang (`history.slice(-3)`, dan `_patok` tak menolong karena jalur itu tak memanggil `pilihPesanKonteks`), kontrak Engineer hilang (`mode: 'LOOKUP'` menimpa ENGINEER), tier model turun ke KECIL. Diperbaiki: satu sumber kebenaran untuk `workspaceId`, plus penjaga `jalurRinganTerlarang` di **keempat** jalur ringan. Jalur ringan sendiri TIDAK dilumpuhkan — yang diubah siapa yang boleh masuk. Classifier diuji **dijalankan sungguhan** dengan tiga pertanyaan faktual pendek; satu asersi memindai SEMUA cabang `requestType` supaya cabang baru tak lolos. **Bukan sebab peta hilang** (log menyebut ENGINEER di kedua kiriman). **Belum diuji live**
105. ✅ Kacamata Kuda Engineer Dilepas — Kode Sumber Jadi Evidence yang Sah (2026-10-01) — [log](../project-memory/changelog/2026-10-01-kacamata-kuda-engineer.md) · Owner menamainya: *"itu lebih mirip memasang kacamata kuda, seperti menyembunyikan kebenaran."* **Terbukti:** peta repo ADA di prompt (16.945 huruf terukur) dan git sudah jalan sendiri, tetapi model menjawab "tidak ada evidence" tanpa satu pun pencarian — jawabannya `hakim_bayangan.ts:212`, dua perintah jauhnya. **Sebabnya ia PATUH, bukan bodoh:** BLOK 1 mengirim *"Tidak boleh menjalankan perintah OS"* dan BLOK 5 melarang *"menggunakan pengetahuan di luar evidence yang terdaftar"*, sementara evidence cuma 8 baris Brain 1 + RAG — kode sumber repo ada DI LUAR daftar itu. Berminggu-minggu matanya dibangun sementara prompt menyuruhnya jangan melihat; pengukuran 1 Okt (5.400 token aturan vs 1.200 token kode) melihat gejalanya tapi salah menyimpulkan — yang kurang bukan kodenya, melainkan izin melihatnya. Kini: membaca kode jadi kapabilitas bernama, "mengaku tahu tanpa menengok" yang dilarang, kode sumber diakui evidence **dengan syarat alamat + nomor baris**. **"WAJIB memiliki evidence" sengaja DIPERTAHANKAN** — yang salah daftar tempat mencarinya, bukan kewajibannya. Dikerjakan SENDIRIAN atas pilihan Owner supaya pengaruhnya terukur: kalau model lebih pintar pun tetap gagal, masalahnya tak pernah di modelnya. **Batas uji: teks sumber, bukan perilaku** — modulnya tak bisa diimpor Node. **✅ TERBUKTI LIVE 1 Okt 13.12** — pertanyaan yang SAMA PERSIS dengan yang gagal kemarin: model menjalankan `git grep` 9 detik sesudah pertanyaan (keluaran 6.025 huruf masuk ke prompt — kemarin angka itu nihil), menjawab `label_sumber.ts` baris 475 & 563–569, dan **setiap kutipan diperiksa persis** terhadap berkas aslinya (475, 459, 511–520 keempat sebabnya berurutan, 563–569). Dilabeli VERIFIED dengan baris Sumber berisi perintah yang ia jalankan sendiri — persis perilaku yang dirancang. **Kunci penguji yang meleset, bukan modelnya:** kunci disiapkan `hakim_bayangan.ts:212`, tetapi "akhirnya diputuskan" justru `label_sumber.ts` — pola yang sama dengan 93% Kepbup, penguji memilih kasus yang nyaman. **Artinya masalahnya tak pernah di modelnya** — berubah total hanya karena satu larangan dicabut dan satu kapabilitas disebut namanya
104. ✅ Perintah Baca Tanpa Persetujuan — Gerbang Hanya untuk yang Krusial (2026-10-01) — [log](../project-memory/changelog/2026-10-01-perintah-baca-tanpa-persetujuan.md) · keputusan Owner: *"perintah yang krusial saja yang perlu persetujuan saya… ini seperti membuat ribet dengan hal yang sebenarnya aman."* Terbukti di uji peta repo: lima `git grep` untuk satu pertanyaan × dua gerbang (tombol Jalankan + dialog asli) = **sepuluh kali menyetujui** untuk membaca jumlah baris berkas sendiri. **Akarnya:** gerbang menjaga sesuatu yang sudah dijaga — `PROFIL.engineer.gitSub` memang hanya git-baca, `GIT_BRANCH_UBAH` & `OPSI_TERLARANG` sudah menyekat sisanya, jadi dialog tak menambah perlindungan apa pun. Garisnya: git baca → jalan sendiri; `node -e`/`python -c`/program lain → **tetap minta izin**, karena itu kode bebas tanpa pagar folder. Penegakan di PELAKSANA (proses utama), layar hanya bertanya lewat IPC; penentunya memakai pemecah perintah yang SAMA dengan pelaksana. Hasil beberapa perintah dikirim dalam SATU kiriman — pola manual akan jadi satu panggilan model berbayar per perintah. Pindah percakapan & pemuatan awal sengaja dilewati supaya riwayat lama tak menjalankan ulang perintah. **38 pemeriksaan, sebagian besar percobaan menembus** (`--ext-diff`, `--output=`, `--exec=`, `--git-dir=`, `--work-tree=`, `--upload-pack=`, `branch -D/-m/-f/-u`, `git -c core.pager=… log`); profil assistant tidak ikut dilonggarkan. Satu uji lama memerah dan memang seharusnya — diperbarui tanpa dilemahkan. **Belum diuji live**
103. ✅ Sisipan Konteks Dipatok — Peta Repo Berhenti Dibuang Diam-diam (2026-10-01) — [log](../project-memory/changelog/2026-10-01-sisipan-dipatok.md) · **akar kegagalan uji peta repo.** Diukur: peta 15.493 huruf di proses utama (DevTools `15493`), riwayat yang sampai ke model 4.042 huruf — model tidak pernah melihatnya. Anggaran dicoret lewat hitungan (6.000 token muat untuk 4.883). **Dua cacat, satu akar — sisipan diperlakukan sebagai pesan paling tua:** (1) `simpanMulaiDari` menyimpan panjang daftar TAMPILAN tetapi dikenakan pada `sisipan + tampilan`, merusak dua arah (sisipan terbuang, pesan lama yang sudah dibersihkan malah ikut); (2) pemotong anggaran membuang dari yang paling tua, jadi konteks terpenting yang pertama dikorbankan. Kini sisipan dikenali dari penanda `_patok`, dihitung lebih dulu, `mulaiDari` hanya untuk percakapan. Patokan **dilepas** hanya bila ia menyingkirkan pertanyaan terbarunya sendiri, dan itu dilaporkan lewat `patokDilepas`. **Biaya yang disebut di muka:** ±3.873 token kini benar-benar ikut tiap kiriman Engineer. **Jebakan:** uji sempat merah dua kali karena aritmetika ujinya sendiri — anggaran terlalu longgar sehingga tak ada yang benar-benar dipotong; diperbaiki dengan mengukur `tokenPesan()` dulu. **Belum diuji live** — harus di percakapan BARU
102. ✅ Tombol Berhenti — Kiriman Akhirnya Bisa Dibatalkan (2026-10-01) — [log](../project-memory/changelog/2026-10-01-tombol-berhenti.md) · dilaporkan Owner saat Engineer menggantung: *"tidak ada tombol berhenti atau menggagalkan"*. Diperiksa: **tidak ada `AbortController` di mana pun** — bukan tombolnya yang lupa dipasang, pembatalannya belum pernah dibuat; jalan keluar satu-satunya memuat ulang jendela. Satu `signal` menembus ketiga `fetch`, **kedua panggilan `processMessage` berulang** (tanpa itu Berhenti cuma memutus satu putaran alat), dan penjaga di pintu masuk SEBELUM klasifikasi/embedding/RAG yang berbayar. Pemutusan di tengah aliran ditangkap khusus supaya tak muncul sebagai "Aliran jawaban terputus". Tombol Kirim **berganti watak**, bukan tombol baru; ikon `cancel` karena `stop` tak ada di subset font. Pesannya menyebut batasnya sendiri: server tetap menyelesaikan & menagih, yang berhenti adalah menunggunya. **Jebakan:** asersi "tiap putaran membawa signal" sempat hijau **secara hampa** — regexnya cocok nol kali dan `every` pada daftar kosong bernilai true; dibongkar pemeriksaan jumlah. **✅ TERBUKTI LIVE 1 Okt 15.11** — muncul "Dihentikan", kotak kirim terbuka lagi, dan **tidak ada "⚠️ Error" apa pun**; pengiriman berikutnya tetap berhasil dijawab, jadi kendalinya benar-benar dilepas dan tidak meracuni kiriman sesudahnya. Log server menunjukkan permintaan yang dibatalkan **tetap diproses sampai selesai** — kalimat jujur di pesan tombolnya terbukti harfiah, bukan sekadar hati-hati
101. ✅ Tahap 6 Terbukti DUA ARAH + Spanduk Patch Tunggal (2026-10-01) — [log](../project-memory/changelog/2026-10-01-spanduk-patch-tunggal.md) · uji **kendali**: patch yang BENAR lolos 61/61 dalam 21,7 detik dan berkasnya **tetap berubah** — tanpa ini, penjaga yang menolak segalanya terlihat sama berhasilnya. Uji itu memunculkan cacat ketiga: **dua spanduk untuk satu patch**, yang kedua ("File telah dimodifikasi sesuai instruksi Anda") membantah laporan verifikasi di atasnya dan mengklaim pemeriksaan yang tak pernah ada — dan karena duduk paling bawah, dialah yang jadi kesimpulan. **Akarnya:** kalimat tunggu `'Engineer sedang menyiapkan patch'` tak pernah dibuat di mana pun, jadi tiga cabang penimpa anti-ganda itu kode mati. Pengumuman kini milik satu jalur (`Engineer:PatchApplied`, satu-satunya yang tahu pemulihan & bawa laporan); `PATCH_APPLIED` tetap dipancarkan sebagai catatan. **Uji mutasi** membongkar asersi lembek (`\b` cocok di tengah `else if`), dan uji sempat tertipu komentar penjelas sendiri — diukur pada kode tanpa komentar. **TERBUKTI LIVE di 4.2.3** — satu patch → satu spanduk, 62/62 lulus, berkas tetap berubah di disk; mencabut cabang `if` tidak merusak penjaga Tahap 6 (uji kendali kedua)
99. ✅ Cari Dokumen Lewat Judulnya — 221 Kepbup Tak Terjangkau Nomornya (2026-10-01) — [log](../project-memory/changelog/2026-10-01-cari-lewat-judul.md) · diukur sendiri: kata "kepbup" muncul di **0 dari 3.629 potongan** dan **221 dari 221** dokumen tak memuat nomornya sendiri — menemukannya lewat nomor MUSTAHIL, bukan sulit. RRF tak bisa menolong karena ambang kemiripan VEKTOR membuangnya lebih dulu. Jalur judul TERPISAH; `match_documents_hybrid` tidak disentuh agar patokan 14/14 tetap sebanding. **TERBUKTI LIVE 1 Okt** — pertanyaan yang sama di dua chat: aturan lama tak menyala, aturan baru menyisipkan 3 potongan dari dokumen yang benar; jawaban VERIFIED. Syarat "semua kata" gagal pada pertanyaan nyata ("apa **isi** Kepbup 204") → diganti "minimal dua kata". **Batas yang ikut ketahuan:** `document_chunks` tak punya kolom urutan (id = uuid), jadi 3 potongan yang disisipkan acak, bukan tiga pertama — jawaban untuk "apa isi dokumen X" selalu sebagian, dan model menyebutnya sendiri
98. ✅ Unduh Aplikasi Desktop dari Web (2026-09-29) — [log](../project-memory/changelog/2026-09-29-unduh-desktop-dari-web.md) · tautan di layar masuk (tanpa perlu login) & Pengaturan; repo rilis publik, alamat unduh diperiksa 200 tanpa autentikasi; `latest.yml`/`.blockmap` tak pernah diberikan ke manusia; API gagal → jatuh ke halaman releases/latest. **Belum diuji live**
97. ✅ Panel Pembaruan di Pengaturan (2026-09-29) — [log](../project-memory/changelog/2026-09-29-panel-pembaruan-pengaturan.md) · jembatan preload (checkForUpdates/getAppVersion/onUpdateStatus) ada sejak lama tetapi **nol pemakai** di frontend/src; ikut ketahuan: `update-downloaded` & `error` tak pernah dikirim ke layar, jadi panel akan berhenti di "Mengunduh 100%" selamanya dan kegagalan tak terlihat. **Terbukti live di 4.2.1** — isinya benar; ikut ketahuan ikon `system_update` tampil sebagai tulisan "TEM_UPDATE" (kelas cacat ke-3) → diganti `refresh` + penjaga menyeluruh `uji-ikon-subset.mjs`. **Perbaikan ikon MENUNGGU rilis berikutnya** (keputusan Owner 29 Sep: digabung saja dengan perbaikan lain, jangan naikkan versi khusus untuk ini)
96. ✅ Versi 4.2.0 & Alur Rilis Manual (2026-09-29) — [log](../project-memory/changelog/2026-09-29-versi-4-2-0.md) · pembaruan otomatis tak pernah menyala bukan karena versi, melainkan karena electron-builder membuat rilis sebagai **draf** secara bawaan dan updater tak bisa melihat draf. **Keputusan Owner: tetap manual** — Owner sendiri yang menekan Publish; jangan usulkan `releaseType: "release"` sebagai "perbaikan"
95. ✅ Label Verifikasi Mametlite dalam Bahasa Penggunanya (2026-09-29) — [log](../project-memory/changelog/2026-09-29-label-ramah-mametlite.md) · `mametlite/src` sebelumnya tak punya kode label sama sekali. **Kotak label terbukti live 29 Sep** ("Dari dokumen"); uji live sekaligus menemukan tombol Salin masih menyalin `[STATUS: …]` mentah — ditutup dengan `teksSalinan()`, peringatan ikut pindah ke dokumen. **Salinannya belum diuji live**

---

## 5. Penyelarasan status 2026-09-28 — apa yang diubah dan kenapa

Delapan baris di dokumen ini menyatakan status yang **berbeda dari dokumen sumbernya**. Tidak ada kode yang
disentuh; tidak ada pekerjaan yang dinyatakan selesai tanpa bukti. Yang berubah hanya baris yang tertinggal.

| Baris | Dulu tertulis | Sumber yang membuktikan |
|---|---|---|
| Item 48 | ⚠️ dasbor yatim | `ROADMAP-TEMUAN-TERBUKA.md` T2 ✅ ditutup |
| Item 49 | ⚠️ ranjau kode mati | T3 ✅ ditutup |
| Item 50 | "T4 terbuka" | T4 ✅ ditutup |
| Item 91 | "hapus desktop/mametlite belum teruji" | T5 ✅ — cascade dicek di DB live, potongan yatim 0 |
| Item 94 | "belum diuji live" | diuji Owner 28 Sep; jawaban tidak lagi tertukar |
| §1 Item 85 & 89 | ada di **Pekerjaan Terbuka** | keduanya ✅ penuh — barisnya tetap ada di §4 |
| §1 baris T10 | "Engineer belum siap dari aplikasi terpasang" | Tahap 5 ✅ terbukti live di .exe, 28 Sep |
| Tanggal kepala | 2026-09-17 | tertinggal 11 hari |

**Item 90 sengaja TIDAK dipindah** dari Pekerjaan Terbuka walau bertanda ✅: barisnya masih menyebut utang
U4, U6, U7, U8b dan mode LITE yang belum aktif.

**Kenapa ini bukan kosmetik.** Dokumen ini titik masuk AI coding — yang membacanya bukan hanya Owner, tetapi
setiap sesi berikutnya. Baris yang salah status membuat pekerjaan yang sudah selesai dikerjakan ulang, atau
yang belum selesai dilewati. Itu sudah pernah terjadi: sebuah dokumen audit dikutip dalam bentuk waktu
sekarang padahal kodenya sudah diperbaiki beberapa commit sesudahnya.

---

## 5b. MENUNGGU RILIS BERIKUTNYA (per 2026-10-01)

Versi di `main`: **4.2.9**. Terpasang di mesin Owner saat baris ini ditulis: **4.2.8**.
Alur rilis manual — Actions membuat draf, Owner yang menekan Publish (item 96).

### Sudah TERBUKTI LIVE

| | Versi | Bukti |
|---|---|---|
| **Tahap 6** — menolak | 4.2.2 | patch perusak → "Patch dibatalkan sendiri", 18,3 detik, menyebut `uji-panel-pembaruan.mjs` + keluarannya; `git status` bersih & nilai kembali semula |
| **Tahap 6** — meloloskan (uji kendali) | 4.2.2 | patch benar → 61/61 lulus, 21,7 detik, berkas **tetap berubah** di disk, Undo tersedia. **Tahap 6 terbukti dua arah**: penjaganya bukan penolak segalanya |
| **Spanduk tunggal** + kendali ke-2 | **4.2.3** | satu patch → **satu** spanduk; 62/62 lulus; berkas tetap berubah di disk. Membuang cabang `if` tidak diam-diam merusak penjaga Tahap 6 — itulah sebabnya satu prompt menguji dua hal |
| **Peta repo sampai ke model** | **4.2.4** | `[PROMPT_KOMPOSISI]` melonjak 4.042 → **16.945 huruf**. Model menyebut 271 berkas & empat angka teratas persis — angka HARI ITU yang hanya ada di peta baru, tak mungkin dikarang. Ia juga memakai jumlah baris untuk memilih `git grep` daripada `git show` yang terpotong 20 KB |
| **T12** penjaga berkas rahasia | 4.2.2 | `.env` ditolak dengan alasan + tawaran `.env.example`; labelnya turun ke HYPOTHESIS |
| **Panel Pembaruan** | 4.2.2 | v4.2.2, ikon berupa gambar (bukan tulisan "TEM_UPDATE") |

### Yang dibawa 4.2.3 — sudah terpasang

| Dibawa 4.2.3 | Keadaan |
|---|---|
| Cacat Tahap 6 **ke-1 & ke-2** | patch yang DIKEMBALIKAN tak lagi diumumkan "Berhasil Diterapkan"; Semantic Diff dilewati; kata "Ketiganya" tak lagi dipaku. **Belum terlihat live** — perlu patch perusak lagi |
| Cacat Tahap 6 **ke-3** | ✅ **TERBUKTI LIVE di 4.2.3** — satu spanduk, 62/62, berkas tetap berubah |
| **Peta repo Engineer** | 270 berkas + jumlah baris (±3.870 token) disisipkan tiap kiriman. **Belum terlihat live** |
| Catatan akar repo + `git grep` | ikut sejak 4.2.2, hasilnya belum pernah dilaporkan |

### ⛔ Uji peta repo GAGAL — petanya tidak pernah sampai (1 Okt, 4.2.3)

Diuji dengan pertanyaan yang hanya bisa dijawab dari peta ("lima berkas terbesar, tanpa menjalankan
perintah"). Model **mengabaikan larangan itu**, langsung menyusun perintah, dan perintahnya gagal
karena kutipnya rusak — kelas kegagalan yang **sama persis** dengan 28 September.

Diukur, bukan diduga, lewat `[PROMPT_KOMPOSISI]` di log edge function:

| Waktu (WIB) | Riwayat yang benar-benar terkirim |
|---|---|
| 15.00 | 11 pesan / **4.042 huruf** |
| 14.54 | 11 pesan / 3.844 huruf |
| 14.24 | 8 pesan / 4.555 huruf |

Peta repo **15.494 huruf** — tak satu pun bisa memuatnya. Model bukan mengabaikan peta; ia tidak
pernah melihatnya.

**Sebab yang sudah ditemukan di kode** (belum tentu satu-satunya): `simpanMulaiDari` menyimpan indeks
daftar **tampilan**, tetapi `pilihPesanKonteks` memakainya pada `sisipan + tampilan` yang lebih
panjang. Karena sisipan ada di depan, **catatan akar repo dan peta repo-lah yang pertama terpotong**
setiap kali "Bersihkan konteks" atau "Padatkan" dipakai — tanpa tanda apa pun di layar.

**Diukur & ditutup:** DevTools menjawab `15493` — jembatan `petaRepo` bekerja, petanya dibuat dengan
benar. Jadi ia hilang **di perjalanan**, dan sebab di atas terbukti. Anggaran dicoret lewat hitungan:
pada anggaran terkecil yang mungkin (6.000 token) peta + seluruh riwayat hanya 4.883 token — muat.

**Sudah diperbaiki** di 4.2.4: sisipan kini dipatok — dihitung lebih dulu terhadap anggaran,
`mulaiDari` hanya berlaku pada percakapan. Lihat
[log sisipan dipatok](../project-memory/changelog/2026-10-01-sisipan-dipatok.md).

### Yang dibawa 4.2.4

| Dibawa 4.2.4 | Apa |
|---|---|
| **Sisipan dipatok** | akar kegagalan uji peta repo — sisipan tak lagi jadi korban pertama pemotongan. Peta ±3.873 token kini **benar-benar** ikut tiap kiriman Engineer, dan biayanya mulai terasa |
| **Tombol Berhenti** | pembatalan kiriman; sebelumnya tak ada `AbortController` sama sekali dan satu-satunya jalan keluar adalah memuat ulang jendela |

Dua-duanya lahir dari sesi uji yang sama, dan keduanya menyentuh jalur kirim — digabung supaya
diuji sekali jalan.

**Sisipan dipatok ✅ TERBUKTI LIVE di 4.2.4** — `[PROMPT_KOMPOSISI]` melonjak dari 4.042 huruf
(11 pesan) menjadi **16.945 huruf** (3 pesan: catatan akar + peta + pertanyaan). Model menyebut
**271 berkas** dan empat angka teratas **persis** (2262 · 1854 · 1209 · 1187) — angka HARI ITU,
sesudah suntingan, yang hanya ada di peta yang baru dikirim; tak mungkin dikarang. Ia juga memakai
jumlah baris untuk bernalar tanpa diminta: *"berkas ini besar, `git show` dipotong 20 KB, jadi pakai
`git grep -c`"* — pelajaran di catatan peta terpakai.

**Satu kekeliruan yang belum terjawab:** urutan kelima salah — model melewati
`verification_engine.ts` (1144) dan menyebut `engineer.js` (1120). Ia melompati satu-satunya berkas
`supabase/functions` di jajaran atas. Perlu diamati lagi; kalau berulang, artinya peta yang panjang
terbaca **tidak merata**, dan itu temuan tersendiri.

### Yang dibawa 4.2.5

| Dibawa 4.2.5 | Apa |
|---|---|
| **Perintah baca tanpa persetujuan** | git yang membaca jalan sendiri — tanpa tombol, tanpa dialog. `node -e`/`python -c`/program lain tetap minta izin. Hasil beberapa perintah kembali ke model dalam **satu** kiriman |

`main.cjs` & `preload.cjs` ikut berubah — **wajib build baru**, hard refresh tidak cukup.

**Perintah baca tanpa persetujuan ✅ TERBUKTI LIVE di 4.2.5** — Owner: *"dan langsung menjalankan"*.
Perintah `git grep` berjalan tanpa tombol dan tanpa dialog.

### Yang dibawa 4.2.6

Keduanya renderer saja — **tidak perlu deploy**. Kontrak Engineer (kacamata kuda) sudah ter-deploy
terpisah dan sudah terbukti live.

| Dibawa 4.2.6 | Apa |
|---|---|
| **Engineer tak bisa jatuh** | satu sumber kebenaran untuk `workspaceId` + penjaga di keempat jalur ringan. Engineer tak lagi bisa diam-diam kehilangan sisipan, kontrak, dan kelas model |
| **Jejak sisipan** (instrumen) | satu baris `[Sisipan]` per kiriman — **bukan perbaikan, mata**. Tiga teori tentang hilangnya sisipan sudah ditumbangkan angka; ini menutup kebutaannya |

**Jejak sisipan ✅ TERBUKTI LIVE di 4.2.6 — dan langsung memecahkan misterinya.** Klien membangun
16.999 huruf di KEDUA kiriman (`3 sisipan`, `0 dilewati`), tetapi server hanya menerima 2.065 di
kiriman kedua. Itu memisahkan "tidak pernah dibuat" dari "hilang di jalan" dalam satu kali jalan,
sesudah empat teori meleset. Sebabnya lalu ditemukan di `rapikanRiwayat()` — lihat item 108.

### Yang dibawa 4.2.7

**Separuh dari satu perbaikan dua sisi.** Sisi servernya sudah ter-deploy dan terbukti hidup, tetapi
log menunjukkan `0 sisipan dipatok` — karena klien 4.2.6 masih MEMBUANG penandanya sebelum mengirim.
Server punya mata; belum ada yang memberinya tanda.

| Dibawa 4.2.7 | Apa |
|---|---|
| **Penanda `_patok` ikut ke payload** | melengkapi item 108. Tanpa ini perbaikan servernya tidak pernah menyala |

**Cara memastikannya live:** kirim **dua pesan berturut-turut** di satu percakapan Engineer, lalu
lihat log `[Riwayat]`. Dua hal yang harus berubah:
- angka sesudah panah **tidak lagi turun** (sebelumnya 18.756 → 3.510)
- `0 sisipan dipatok` berubah jadi **`3 sisipan dipatok tidak dipangkas`**

Angka `0` itulah yang membedakan "perbaikannya gagal" dari "separuhnya belum terpasang" — sebabnya
hitungan sisipan sengaja ditambahkan ke baris log itu.

**✅ TERBUKTI LIVE di 4.2.7** — `3 pesan 16999→16999`, `5 pesan 19202→19202`, `7 pesan 22449→21108`,
semuanya dengan `3 sisipan dipatok tidak dipangkas`. Tetap bertahan di percakapan panjang: 1 Okt
15.11 tercatat `9 pesan 44694→25841` dan `11 pesan 50398→26829`, sisipan utuh sementara pesan biasa
tetap dipangkas sebagaimana mestinya.

### Yang dibawa 4.2.8

| Dibawa 4.2.8 | Apa |
|---|---|
| **Engineer berhenti menulis memori pribadi Owner** | nomor sesi & patch tak lagi ditulis otomatis — tak ada pembacanya, isinya nomor mesin, dan melanggar kontrak Engineer sendiri (item 109) |

Renderer saja — **tidak perlu deploy**.

Tiga hal yang sudah terbukti live sebelum rilis ini, dicatat supaya tidak diuji ulang: **tombol
Berhenti** (item 102), **patokan sisipan dua sisi** (item 108), dan **rantai temuan tersambung** —
TMN-0002 & TMN-0003 lahir dari Engineer yang akhirnya boleh menengok, keduanya diperiksa ulang
terhadap kode nyata dan benar.

Empat uji tertunda lain bisa ikut dalam sesi pasang yang sama: tombol Berhenti, Engineer tak jatuh
(tanya hal pendek-faktual di Engineer), cacat Tahap 6 ke-1 & ke-2 (patch yang sengaja merusak), dan
unduh desktop dari web.

### Yang dibawa 4.2.10 (termasuk muatan 4.2.9 — 4.2.9 TIDAK PERNAH DITERBITKAN)

> **4.2.9 hanya pernah jadi commit, bukan rilis.** Versinya dinaikkan 2 Okt (`b31b37f`) tetapi
> build & Publish-nya belum sempat dijalankan sebelum pekerjaan berikutnya masuk, lalu versinya
> dinaikkan lagi ke 4.2.10. Diperiksa: tak ada artefak 4.2.9 di `frontend/release/`.
>
> **Akibatnya untuk pengujian:** keempat uji di bawah dan uji pemutus arus **semuanya berlaku untuk
> 4.2.10**. Jangan mencari 4.2.9 — ia tak ada di daftar rilis.

| Dibawa 4.2.10 | Apa |
|---|---|
| **Pemutus arus tak lagi permanen** | hukuman ikut habis bersama jendela satu menitnya, dan keduanya bersuara; demosi keamanan tetap lengket (item 113, TMN-0004) |
| **Brain 1 bisa ditulis** | tombol "Simpan N pengetahuan" — Engineer mengusulkan blok, Owner menyetujui. Brain 1 beku sejak 27 Juni; ini yang mencairkannya (item 110) |
| **Lampiran untuk Engineer** | tombol lampiran di Engineer — mata terhadap tata letak, dan dokumen instruksi teknis (item 112) |
| **Mutu bukti** | petunjuk grep-sebagian, dan gembok yang tak lagi menuduh pengulangan sebagai larangan (item 111) |

**Uji yang paling membuktikan**, berurutan:
1. Lampirkan tangkapan layar ke Engineer, minta ia **menyebut apa yang dilihatnya**. Menyebut
   warna/posisi/tulisan → matanya terbuka. Hanya menyebut nama berkas → gambarnya tidak sampai.
2. Minta ia mempelajari sesuatu tentang repo, simpan pengetahuannya, lalu **buka percakapan baru**
   dan tanyakan hal yang sama — kalau ia sudah tahu, Brain 1 hidup.
3. Jalankan `git grep` polos — harus muncul petunjuk "N BARIS YANG COCOK, bukan isi berkasnya".
4. Ulangi perintah yang sama persis — harus muncul penanda riwayat yang netral, **bukan** gembok
   "tidak diizinkan".
5. **Pemutus arus** (butuh 4.2.10) — terapkan patch **enam kali dalam satu menit**. Harus muncul
   pesan pemutus arus yang menyebut perkiraan detik, bukan diam. Lalu **tunggu satu menit** dan
   terapkan sekali lagi: harus jalan kembali **tanpa menutup aplikasi**. Kalau tetap menolak,
   hukumannya masih permanen.
6. **RAG turun bersuara** (butuh DEPLOY, bukan rilis klien) — kirim satu pertanyaan saat embedding
   gagal (mis. tanpa kunci OpenRouter). Harus muncul **⚠️ [RAG TURUN KE PENCOCOKAN KATA]** beserta
   sebabnya, dan bila memori juga dilewati, **⚠️ [MEMORI DILEWATI]**. Kalau yang muncul hanya
   "✅ RAG TIER 1 OK", perubahannya belum sampai.

### Uji live yang masih menunggu

Uji yang menyangkut sisipan **harus di percakapan BARU**: percakapan lama masih membawa penanda
"mulai dari" yang lama, dan itu justru yang dulu memotong sisipannya.

Kunci jawaban berubah tiap kali berkasnya disunting — **hitung ulang sebelum menilai**, jangan
memakai angka yang tertulis di dokumen ini:
`git grep -c '' -- frontend/src frontend/electron supabase/functions mametlite/src`

1. **Engineer tak bisa jatuh** — tanya hal pendek-faktual di Engineer (mis. *"apa itu RLS?"*):
   harus tetap jawaban Engineer penuh, bukan jawaban ringkas tanpa kontrak.
2. **T14 jalur stream** — satu chat Ecosystem yang jawabannya mengalir.
3. **Unduh desktop dari web** — tautan di layar masuk Mametlite/web.
4. **Cacat Tahap 6 ke-1 & ke-2** — perlu patch yang MERUSAK lagi (bukan yang benar), lalu pastikan
   tak ada spanduk "Berhasil Diterapkan" yang membayangi "Patch dibatalkan sendiri".
5. **Peta terbaca merata?** — ulangi pertanyaan lima berkas terbesar. Di 4.2.4 model melewati
   `verification_engine.ts` dan menyebut berkas `frontend/` di posisi kelima. Kalau berulang,
   artinya bagian `supabase/functions` di peta kurang terbaca — temuan tersendiri.
6. **`node -e` tetap minta izin** — pembanding untuk perintah baca yang sudah jalan sendiri. Suruh
   Engineer menjalankan `node -e`: **harus** tetap menampilkan tombol Jalankan dan dialog izin.
   Kalau ia ikut jalan sendiri, garis "membaca repo aman, menjalankan kode karangan model tidak"
   bocor — dan itu mendesak.

Cara memastikan peta benar-benar terkirim, tanpa menebak dari jawaban model: lihat
`[PROMPT_KOMPOSISI]` di log edge function — **riwayat harus melonjak di atas 15.000 huruf**.

### ✅ DITUTUP — Engineer tidak boleh pernah jatuh ke jalur ringan

Lihat [log](../project-memory/changelog/2026-10-01-engineer-tak-jatuh.md) dan item 106.
Akarnya ternyata bukan dispatch-nya: `RequestClassifierService` sudah menjaga di hulu. Lubangnya
**dua sumber kebenaran** — layar memakai `osState?.workspaceId`, kiriman memakai
`workspaceManager?.activeWorkspaceId || 'ws-assistant'` yang jatuh diam-diam.

Uraian lengkap ranjaunya disimpan di bawah sebagai catatan sejarah:

### ⚠️ (riwayat) Ranjau — jalur LOOKUP tidak mengecualikan Engineer

`AssistantService.js:561` mengirim pesan apa pun bertipe LOOKUP ke `_handleLookup`, **tanpa
memeriksa mode**. Di dalamnya:

- `history.slice(-3)` — hanya 3 pesan terakhir, dan **sisipan ada di depan**, jadi catatan akar repo
  & peta repo selalu terbuang (patokan `_patok` tak menolong: jalur ini tidak memanggil
  `pilihPesanKonteks` sama sekali)
- `mode: 'LOOKUP'` dikirim ke server — **menimpa ENGINEER**, jadi seluruh kontrak Engineer hilang,
  termasuk kapabilitas "membaca kode sumber" yang baru dipasang
- *"LOOKUP selalu memakai tier KECIL tanpa classifier"* — model turun kelas tanpa diberitahukan

Tidak menyala pada uji 1 Okt 13.12 (mode terbukti tetap ENGINEER), jadi ini **ranjau, bukan sebab
kegagalan kemarin**. Tapi satu pertanyaan Engineer yang kebetulan terlihat seperti pertanyaan
faktual singkat akan jatuh ke sini tanpa tanda apa pun.

### ⚠️ Temuan terbuka — konstitusi dibaca tiap boot lalu DIBUANG

`engineer.js:316` memuat **32 berkas**: `INIT.md`, `AGENTS.md`, `constitution/00`–`27`, termasuk
`24_ANTI_HALLUCINATION_PROTOCOL.md`. Satu-satunya pemakaian isinya di seluruh kode:

```js
staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0
```

**Hanya jumlahnya.** Isinya tidak pernah sampai ke model. Blok "BRAIN 1 — STATIC" yang model
laporkan sebagai `[✓] ADR`/`[✓] Coding Rules` sebenarnya **8 baris** dari `project_memory_entries`
(ADRLink/Solution/Lesson/RootCause) — konstitusi tidak ada di dalamnya.

Jadi Engineer selama ini melaporkan "Coverage BRAIN 1 ✓" tanpa pernah membaca satu pun aturan yang
Owner tulis.

**Usul Owner (belum dikerjakan):** `AGENTS.md` jadi pintu masuk sungguhan, dan peta repo jadi berkas
yang dirujuk dari sana — dibaca **saat perlu** dengan `git show`, bukan disuntikkan tiap pesan.
Biayanya turun dari ±3.873 token/pesan jadi penunjuk ±50 token, dan sejak 4.2.5 membacanya nol klik.
**Ditunda** sampai pengaruh pelepasan kacamata kuda terukur sendirian.

### Dua arahan Owner yang SENGAJA ditunda (1 Okt)

Ditunda supaya pengaruh peta repo bisa diukur **sendirian** — tiga perubahan sekaligus = satu hasil
yang tak bisa ditelusuri sebabnya. **4.2.3 adalah build yang membuat pengukuran itu mungkin:** sampai
peta repo benar-benar terpasang, kedua arahan ini belum punya patokan untuk dibandingkan.

| | Keadaan sekarang | Arahan Owner |
|---|---|---|
| Batas keluaran perintah | `BATAS_JALAN.keluaranByte = 20 * 1024` (angka mati) | ikut jendela model; `model_pricing.context_length` sudah tersimpan |
| Porsi konteks Engineer | `PORSI_PER_PESAN = 0.05` | batas harian itu **plafon**, bukan jatah yang dibagi antara Assistant & Engineer |

Dasar ukurannya ada di [log peta repo](../project-memory/changelog/2026-10-01-peta-repo-engineer.md):
Engineer menerima ±5.400 token aturan lawan ±1.200 token kode, dan anggaran 60.000 token terpakai
seperenam.

---

## 6. Keputusan Owner 2026-09-28 — enam baris, SEMUANYA SUDAH DITUTUP (per 2026-09-29)

Dicatat lebih dulu atas permintaan Owner: *"catat dulu keputusan saya agar nanti bisa dikoreksi kembali
dengan kenyataan yang ada."* Tiap keputusan di dokumen sumbernya disertai **cara mengoreksinya** — syarat
terukur, bukan perasaan.

| | Keputusan | Sumber |
|---|---|---|
| **T11** `check-keys` | **hapus fungsinya** — tanpa pemeriksaan pengguna, tanpa pemanggil, pertanyaannya sudah terjawab, tiap panggilan berbayar. (Hak 40 tabel **tidak** ikut diputuskan, tetap ⏳) · **✅ DITUTUP 29 Sep** — [log](../project-memory/changelog/2026-09-29-t11-check-keys-dihapus.md); berkas dihapus dari repo DAN fungsinya dihapus dari Supabase | `ROADMAP-TEMUAN-TERBUKA.md` T11 |
| **T12** baca berkas = kirim keluar | **pasang penjaga** `.env`/`*.key`/`*.pem` dengan pesan beralasan; sisanya batas yang diketahui · **✅ DIKERJAKAN 29 Sep** — [log](../project-memory/changelog/2026-09-29-t12-penjaga-berkas-rahasia.md); `.env.example` sengaja tetap terbaca, nama berkas tetap terlihat | T12 |
| **T13** hakim bayangan | **tetap membayangi** — naik jadi penentu label hanya setelah angka ketidaksepakatan cukup untuk dihitung · **✅ tidak ada pekerjaan** — menunggu pemakaian, bukan koding | T13 |
| **T14** 8 penyedia | **simpan nama penyedia per pesan; JANGAN kunci penyedianya** · **🟡 29 Sep** — [log](../project-memory/changelog/2026-09-29-t14-penyedia-per-pesan.md); jalur non-stream TERBUKTI live (log Azure = metadata.penyedia), jalur stream menunggu satu chat Ecosystem yang mengalir | T14 |
| **AnalyzeTask & ReviewChanges** | **periksa dulu, jangan langsung hapus** — Owner mengoreksi usul asisten; hapus hanya bila terbukti ada yang mengerjakannya lebih baik · **✅ SELESAI 29 Sep** — [log](../project-memory/changelog/2026-09-29-analysis-review-dihapus.md); terbukti Tahap 6 mengerjakannya lebih baik, `_analyze` tetap hidup di jalur MODIFY_CODE, bersih −46 baris | `ROADMAP-ENGINEER-MANDIRI.md` |
| **Item 72** Adaptive Shell | **TIDAK ditutup** — Owner mengoreksi usul asisten; ini soal kerapian di berbagai perangkat bagi **pengguna**, bukan kenyamanan Owner · ⏳ **tetap terbuka sebagai pekerjaan**, lihat §1 | `roadmap-adaptive-shell.md` |

**Dua dari enam adalah koreksi atas usul asisten** (AnalyzeTask dan Item 72). Keduanya dicatat beserta
alasan usulnya keliru, bukan sekadar hasil akhirnya — supaya kesalahan menimbangnya tidak terulang.

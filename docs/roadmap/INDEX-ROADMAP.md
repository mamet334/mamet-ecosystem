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
| 125 Siap disajikan ke pengguna | 🟡 Fase A ✅ laporan temuan · **M1 ✅** penyuntikan HTML dihapus + CSP (arahan Owner: bukan ditambal) · **M2 ✅** satu pintu riwayat + error boundary · **M3 ✅** laci HP, h-dvh, kendali sentuh (Item 72 ditutup) · **M4 ✅** penerjemah pesan galat · **M9 ✅** penjaga tiga salinan · **M8 ✅** perancah Vite dibersihkan — **blok M selesai**; · **C10a ✅** pdfjs-dist Mametlite 6.0.227→6.4.299 (eksekusi JS dari PDF jahat); sisa **C10b** (⏳ pdfjs `frontend` masih rentan, perbaikannya naik major), Fase C (jaring uji — **J3b flake jadi prasyarat**, hak 39 tabel, fungsi yatim) belum | [`ROADMAP-SIAP-PENGGUNA.md`](./ROADMAP-SIAP-PENGGUNA.md) |
| 92 Data tabel rekonsiliasi ASN | 📝 Tahap 1–5 ✅ (pratinjau Excel; simpan + versi; tanya-jawab chip Data Tabel, live 5/5 VERIFIED, NIP tidak ke model; laporan kejanggalan per OPD + Excel; PDF pindaian lewat OCR); sisa koreksi pemetaan (ditunda), kejanggalan lewat chat (opsional) | [`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](./ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md) |
| 93 Kedaulatan data | 📝 temuan RLS "baca semua" ✅ ditutup; Tahap 1 ✅ tombol "Cadangkan data" (13 tabel + vektor, terbukti 13/13 cocok; backup-export lama dihapus); Tahap 2 ✅ uji pulih ke Postgres lokal (13/13, pencarian sama); Tahap 3 embedding lokal & 4 offline penuh jangka panjang | [`ROADMAP-KEDAULATAN-DATA.md`](./ROADMAP-KEDAULATAN-DATA.md) |
| 90 Pengambilan potongan RAG | ✅ Tahap A–C (recall@8 14/14, bukti Kepbup #1, live); U8a ✅ (RAG Mametlite live + layar kunci + label stream), U10 ✅; sisa utang U4, U6, U7, U8b, mode LITE tak aktif | [`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md) |
| 88 Tabel centang PDF (+ sisa 86 OCR massal) | 🟡 Tahap 1–3 ✅; keputusan 3: buku per jabatan **221/221** masuk; 177 ✅, 191/159 keterbatasan; set uji buku penuh **13/14**; sisa BUKU-10 (blok centang miskin kata, sesudah code freeze) | [`ROADMAP-TABEL-CENTANG-PDF.md`](./ROADMAP-TABEL-CENTANG-PDF.md) |
| 72 Adaptive Shell (UI multi-device) | ⏸️ **DITUNDA 2 Okt atas permintaan Owner** (murni tata letak layar) — dan **sasaran rencananya salah**: FASE 1–4 menunjuk `frontend/src` (67 breakpoint, hanya Owner) padahal yang berantakan di HP adalah `mametlite/src` (**0** prefiks responsif dari 97 `className`; bilah sisi `w-80` tetap menyisakan ±55px untuk chat di HP 375px; nol drawer). Akarnya satu berkas, bukan empat fase. Ikut ketahuan: `mametlite/src/App.css` 184 baris **tidak diimpor di mana pun** (perancah Vite) — penghapusan menunggu izin Owner | [`roadmap-adaptive-shell.md`](./roadmap-adaptive-shell.md) |
| 33, 48, 49, 50, 91 Temuan audit tanpa rancangan | ⏳ T1 daftar izin sub-agent di server (arah disetujui; sesudah ganti token Apify) · T2 ✅ dasbor yatim dihapus · T3 ✅ rute mati dihapus · T4 ✅ · T6 ✅ · T7 ✅ kunci API di `agent_logs` (sisa: Owner ganti kunci) · T8 ✅ perintah Engineer tanpa shell + profil peran (jalur PowerShell/`run-terminal-command` dihapus; aturan Engineer kembali sampai ke model; hasil mesin bukan kueri Web/RAG/memori) · T10 sumber pengetahuan Engineer (Tahap 1 ✅ RAG Engineer hanya space "Pengetahuan Engineer"; TUGAS-01 ✅ live 1 baris; riwayat chat setelah muat ulang & urutan riwayat diperbaiki; **prosedur kerja Engineer** ditulis di `constitution/28` + RULE 0 + 3 penjaga kode — TUGAS-01..04 ✅ live — TUGAS-02 lulus patch tapi gagal pembuktian `git grep`, TUGAS-04 11/12 klaim terbukti dengan model kuat; **Engineer sudah siap dari aplikasi terpasang sejak 28 Sep** — akar repo dipilih Owner, terbukti live di .exe (Tahap 5, `ROADMAP-ENGINEER-MANDIRI.md`); setelan & riwayat tetap terpisah dari `npm run desktop`; Tahap 2–3 belum) · T11 ✅ **DITUTUP SUNGGUHAN 4 Okt** — klaim "DITUTUP 29 Sep" dulu **separuh benar**: `check-keys` hilang dari repo (`23b8714`) tetapi **masih ACTIVE di Supabase** sampai 4 Okt (versi 60, terakhir disentuh 10 Sep, sumber ter-deploy sama persis dengan riwayat git). Ketahuan saat memeriksa daftar fungsi lewat API Supabase — **tidak** dari kode, karena repo memang sudah bersih; penghapusan di platform adalah langkah terpisah yang tak pernah terjadi. Owner menghapusnya 4 Okt, **diperiksa ulang: tinggal 6 fungsi, `check-keys` tidak lagi terdaftar**. Penggantinya sudah hidup sejak lama (tombol **Test Connection** `Settings.jsx:214`, kunci PENGGUNA lewat `x-byok-{provider}`, menuntut login) — yang dihapus adalah alat uji koneksi era kunci server, yang tiap panggilannya memicu panggilan API berbayar ke empat penyedia dan mengembalikan 8 huruf pertama tiap kunci Gemini tanpa pemeriksaan pengguna. **Pelajarannya:** "dihapus dari repo" dan "dihapus dari platform" adalah dua klaim berbeda, dan hanya yang pertama bisa dibuktikan dari kode. Periksa platformnya bila klaimnya menyebut platform (sisa terpisah: hak bawaan 40 tabel bagi anon/authenticated, butuh daftar pemakai per tabel dulu) · T9 ✅ knowledge_manager dihapus (workspace dikelola dari UI Research App) · T12 ✅ **29 Sep** penjaga berkas rahasia (`.env`/`*.key`/`*.pem` ditolak dibaca; `.env.example` tetap terbaca) — sisanya **batas yang diketahui**, bukan pekerjaan · T13 CHIMERA ditolak; lapisan per-klaim leksikal dimatikan; **keputusan Owner 28 Sep: hakim bayangan TETAP MEMBAYANGI** sampai angka ketidaksepakatan cukup dihitung — tak ada pekerjaan, menunggu data · T14 ✅ **29 Sep** nama penyedia disimpan per pesan (penyedia TIDAK dikunci); jalur non-stream terbukti live, **jalur stream menunggu satu chat Ecosystem yang mengalir** | [`ROADMAP-TEMUAN-TERBUKA.md`](./ROADMAP-TEMUAN-TERBUKA.md) |

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
125. 🟡 Siap Disajikan ke Pengguna — M1 ✅ berhenti menyuntikkan HTML · M2 ✅ tak lagi bisa layar putih · M3 ✅ terpakai dari HP (Item 72) · M4 ✅ bicara bahasa penggunanya · M9 ✅ penjaga salinan · M8 ✅ perancah Vite dibersihkan — BLOK M SELESAI; C10a ✅ pdfjs-dist Mametlite ditambal; sisa jaring uji & C10b (pdfjs frontend, butuh naik major) — [rancangan](./ROADMAP-SIAP-PENGGUNA.md) · [log](../project-memory/changelog/2026-10-07-mametlite-berhenti-menyuntikkan-html.md)
124. ✅ Konstitusi Berhenti Dibaca-Lalu-Dibuang — indeksnya benar-benar sampai (2026-10-05) — [log](../project-memory/changelog/2026-10-05-indeks-konstitusi.md) · permintaan Owner, sesudah keberatan saya disampaikan **dua kali**: arah biayanya BERLAWANAN dengan item 120 (ini **menambah** token) dan saldo sedang 1.048 token. Owner memutuskan lanjut; dikerjakan penuh dengan angkanya di meja lebih dulu. **DUA CACAT YANG SALING MENYEMBUNYIKAN.** (1) `_loadStaticKnowledge()` membaca 33 berkas — **168.299 huruf ≈ 43.942 token** — ke `brain.static.raw` TIAP BOOT, dan `raw` punya **NOL pemakai**; yang mengalir hanya `loadedFiles.length`, dan angka itu pun berhenti di `brain.dynamic` yang cuma ditugaskan tak pernah dibaca. Akibatnya Engineer melaporkan *"Coverage BRAIN 1 ✓"* tanpa pernah membaca satu pun aturan yang Owner tulis — dan "BRAIN 1" itu sebenarnya 7 baris `project_memory_entries`, bukan konstitusi. (2) Daftar 32 jalurnya DIPAKU dan sudah melenceng: `constitution/28_PROSEDUR_KERJA_ENGINEER.md` ADA di disk, TIDAK di daftar — justru berkas yang MENGATUR cara Engineer bekerja. Tak ada yang sadar berbulan-bulan **karena isinya toh dibuang**: cacat kedua bersembunyi di balik yang pertama, dan menutup satu tanpa yang lain hanya memindahkan kebisuannya. **Perbaikannya:** folder DIPINDAI di proses utama (`engineer:indeks-konstitusi`), yang menyeberangi IPC hanya alamat+judul (±2 KB, bukan 168 KB), dan `catatanKonstitusi()` menyusunnya jadi indeks di sisipan — sekeluarga `catatanPetaRepo`. Judul disertakan HANYA bila menambah informasi di luar nama berkas: terukur **7 dari 33** (`01_VISION.md — 01_VISION.md` tidak menambah apa pun), menurunkan 565 → 384 token sebelum blok aturan. Hanya **2.000 huruf pertama** dibaca untuk judul — membaca utuh mengulangi pemborosan yang sedang ditutup. **Daftar lama DIPERTAHANKAN sebagai cadangan** bila pemindaian gagal (Electron lama); tanpa itu perbaikan ini bisa membuat Engineer kehilangan seluruh konstitusinya. **BIAYA, apa adanya: +577 token SETIAP pesan** (2.210 huruf) — bukan penghematan. Peta repo bisa dipangkas karena ia SUDAH dikirim; konstitusi TIDAK dikirim sama sekali. Yang ditukar: 577 token/pesan melawan 43.942 token yang dibaca lalu dibuang tiap boot, dan melawan Engineer yang mengaku punya cakupan yang tak pernah ia punya. Satu asersi menjaga biaya tidak merayap: **di atas 700 token uji jatuh**. **Tiga bahaya ditulis DI DALAM indeksnya sendiri** (pola item 120): jangan mengaku sudah membaca yang belum dibuka (ini cacat aslinya), jangan menyimpulkan aturan TIDAK ADA dari judul, baca berkasnya lebih dulu untuk pertanyaan aturan. Caranya diberikan pula: `git show HEAD:<alamat>` sudah jalan tanpa dialog sejak 4.2.5 — yang hilang bukan kemampuan membaca, melainkan pengetahuan bahwa ada yang bisa dibaca. 6 mutasi menggigit. **M1 sempat terbaca "tidak menggigit" — ternyata sed-nya yang tak pernah menempel, bukan asersinya**; diulang dengan Edit, jatuh 1 (pelajaran sama dengan `\b` jadi backspace). **Dua asersi rapuh milik uji LAIN ikut jatuh — kali KEEMPAT hari ini**: `uji-peta-repo` dan `uji-sisipan-dipatok` sama-sama memaku isi larik sisipan persis, jadi sisipan keempat yang sah menjatuhkan keduanya; kata "ketiga sisipan" ikut jadi bohong. Diganti sifatnya (unsur ADA di larik; hanya SATU tempat penandaan `[PATOK]: true` sehingga seluruh isi larik pasti lewat jalur sama), dibuktikan masih menggigit lewat N1–N3. **Empat kali dalam satu hari asersi yang menguji EJAAN BARIS menjatuhkan perubahan yang benar** — polanya cukup jelas untuk disebut. 84/84 hijau. **PERLU RILIS KLIEN**, dan `npm run desktop` harus DIJALANKAN ULANG (main.cjs + preload.cjs berubah; muat ulang jendela tidak cukup). **Uji live:** `riwayat` naik 2.687 → ±4.900 huruf; lalu tanya soal aturan (mis. *"apa kata konstitusi tentang CORE IMMUTABLE?"*) — Engineer harus menjalankan `git show` lebih dulu
123. ✅ 45% Korpus Tak Bisa Dicari Lewat Nomornya (2026-10-05) — [log](../project-memory/changelog/2026-10-05-nomor-dokumen-45-persen.md) · Owner meminta Item 93 Tahap 3 sambil menunjuk `engine-vector`. `LANGKAH-BERIKUTNYA.md` di sana menutup dengan nasihat yang langsung terpakai: *"periksa mamet-ecosystem sebelum membangun apa pun"* — dan benar, satu pekerjaannya (*93% Kepbup tak bisa dicari lewat nomor*) **sudah ada**: `cari_judul.ts`, RPC `match_documents_judul`, kolom `fts_judul`, semua hidup di produksi. Dibuktikan, bukan diterima: "Kepbup 204" → tepat satu dokumen benar. **Tapi uji kendali membongkar lubangnya:** `['kepbup','017']` → 3 potongan, `['kepbup','17']` → **0**. "204" selama ini berhasil **semata karena kebetulan sudah tiga digit**. **Rantainya putus DUA kali:** (1) `kataKunciPencarian` membuang token ≤2 huruf — saringan untuk kata sambung prosa, tak pernah ditinjau untuk PENANDA, padahal nomor 1–2 digit justru penanda yang paling sering diketik; (2) seandainya lolos pun tak cocok, judul menyimpan "017". Lalu penjaga `array_length >= 2` memulangkan kosong. **Melegakan:** gagalnya KOSONG, bukan dokumen salah yang diyakini — penjaga `cocok >= 2` yang menyelamatkan. **Diukur di korpus PENUH dengan oracle independen** (nomor dari judul yang dikembalikan harus sama dengan yang dicari), bukan sampel: LAMA 122 ketemu / **99 kosong (44,8%)**; BARU **221/221 tepat satu dokumen dan dokumen yang BENAR**, 0 kosong, 0 ganda, 0 salah. **Perbaikannya `kataKunciJudul()`** — daftar kata TERPISAH untuk jalur judul saja, karena `kataKunciPencarian` juga memasok `match_documents_hybrid` yang memegang patokan recall@8 **14/14** (Item 90 Tahap B); menambah token di sana menggeser patokan dan membuat seluruh pengukuran lama tak sebanding. Satu asersi menjaga daftar baru **tidak bocor** ke hybrid. **Dua arah** ("17"→"017" dan "017"→"17"): korpus lain boleh jadi tanpa padding, menebak satu arah mengulang cacat yang sama dari sisi sebaliknya. 7 mutasi. **M4 tidak menggigit, dan jawabannya MENGHAPUS barisnya, bukan menambah asersi** — `keluar.add(asli)` terbukti mati (selalu tercakup `telanjang`/`dasar`/padding; stopword tak memuat angka). **Tiga asersi rapuh milik uji LAIN ikut jatuh oleh perubahan yang BENAR, dan ketiganya sekelas:** dua memaku seluruh daftar impor beserta urutannya, satu menuntut `try {` berada dalam 400 huruf sebelum RPC (digeser oleh satu komentar penjelas). Semuanya menguji EJAAN BARIS, bukan sifatnya — diganti dan dibuktikan **masih menggigit** (N1/N2). **Pemuat `uji-cari-judul` ikut diganti:** ia mengupas TypeScript dengan rantai regex satu pola per tanda tangan, jadi tiap ekspor bertipe baru wajib didaftarkan — bila lupa, gagal dengan `SyntaxError` yang TERLIHAT seperti kode rusak padahal pemuatnya yang usang; diganti esbuild, dan `AKAR` yang dipaku jalur absolut kini diturunkan dari letak berkas. 83/83 hijau, bundel bersih. **Bisa diverifikasi TANPA saldo** — pencarian judul itu pencarian TEKS, tak memanggil embedding. **PERLU DEPLOY**, tanpa rilis klien, tanpa migrasi (kolom & RPC sudah ada)
122. ✅ Anggaran Keluaran Perintah + Dua Kebocoran Lain (2026-10-05) — [log](../project-memory/changelog/2026-10-05-anggaran-keluaran-perintah.md) · ketiganya terbaca dari SATU sesi nyata 01:33 — sesi yang berhasil di giliran pertama berkat item 121, lalu patah di giliran kedua. **(1) Keluaran perintah tanpa anggaran:** satu `git grep -n -B2 -A4` di tiga folder mengembalikan 15.671 huruf dan seluruhnya dikirim balik (`pesan=15.769`, total 49.993) → 402 prompt kebesaran. Batas 20 KB yang ada itu batas **TERMINAL**, bukan anggaran token. Perlu dikatakan terus terang: sehari sebelumnya peta repo dipangkas 13.870 huruf dari TIAP pesan (item 120), lalu satu perintah mengembalikan 15.671 — pemangkasan itu tetap benar (permanen, tiap pesan) tetapi tak menyentuh kelas biaya ini. `BATAS_KELUARAN_MODEL = 8000`, **pilihan anggaran bukan pengukuran**, ditambatkan ke blok terbesar yang tersisa (`konteks_engineer` 17.687). **KEPALA dan EKOR** disimpan, tengahnya dibuang — pada `git grep` kecocokan TERAKHIR sering di berkas lain, jadi potong-di-ujung membuat model menyimpulkan dari satu sudut repo (kelas kesalahan yang dijaga `petunjukGrepSebagian`). Dipotong pada batas BARIS: `supabase/func` terbaca seperti alamat yang ada. **Satu titik rakit** `pesanKeluaranPerintah()` — dua jalur (otomatis & tombol) dulu merakit sendiri, anggaran di satu jalur akan dilewati jalur lain tanpa suara. **(2) Varian 402 KETIGA** `in-flight requests` — tabrakan permintaan paralel, bukan saldo habis; dulu jatuh ke cabang "tak terbaca" dan menyuruh isi ulang saldo padahal jalan termurahnya menunggu. Tidak diulang otomatis (mengulang = mengulangi tabrakannya). **Satu kesalahan dicegat sebelum terkirim:** pesannya sempat menyuruh *"matikan Hakim Bayangan di Pengaturan"* — setelan itu TIDAK ADA, `HAKIM_BAYANGAN` adalah secret Supabase; kelas kesalahan yang sama dengan saran *"mulai percakapan BARU"* yang dicabut 4 Okt. **(3) BRAIN 1 dikirim DUA KALI** di mode Engineer — bukan kemiripan melainkan **string format identik huruf demi huruf** (`engineer_context.ts:91` dan `context_builder.ts:528`) dari satu sumber (`ctx.brain1Entries = engineerCtx.brain1Entries`). Judulnya DIPERTAHANKAN karena BLOK 6 menjadikan BLOK 4 rujukan label VERIFIED; dijaga hanya mode ENGINEER karena di mode lain BLOK 4 satu-satunya salinan. Hemat ≈1.300 huruf/pesan — kecil, tetapi pemborosan murni. **YANG TIDAK BISA DIKERJAKAN:** Owner meminta `konteks_engineer` dipangkas; setelah diukur **tak ada potongan aman** — 14.695 dari 17.687 huruf adalah **aturan**, bukan data. Dua pemeriksaan nihil: narasi sejarah hanya **634 huruf (3,6%)** dan dua di antaranya contoh kegagalan nyata yang membuat aturannya menempel; duplikasi dengan kontrak universal **NOL** (tumpang-tindih 6-gram, 157 baris). Peta bisa dipangkas karena ia data yang bisa diambil saat perlu; aturan tidak. Pilihan yang ada — aturan penuh hanya di giliran pertama — hemat besar tetapi berisiko aturan luntur di tengah percakapan: **diserahkan ke Owner, tidak dikerjakan diam-diam**. 8 mutasi (M1 jatuh 8, M6 jatuh 7). **M3 TIDAK menggigit dan itu benar** — keutuhan baris dijamin oleh pemecahan per baris, bukan oleh pemeriksaan ukuran; alih-alih mengarang asersi, dibuktikan asersinya **tidak hampa** lewat M3′ yang mencabut pemecahan baris (jatuh 1). **Satu asersi lama diperbaiki:** `uji-peta-repo` memaku SELURUH daftar impor beserta urutannya, jadi menambah satu nama yang sah menjatuhkannya tanpa ada yang rusak — diganti sifat yang sebenarnya dijaga. 82/82 hijau, bundel bersih. **PERLU DEPLOY *DAN* RILIS KLIEN** — anggaran keluaran ada di sisi klien, deploy saja tidak mengaktifkannya
121. ✅ Jawaban Terpotong Akhirnya Diberi Label — lantai 512 → 128 (2026-10-05) — [log](../project-memory/changelog/2026-10-05-terpotong-diberi-label.md) · dipicu bantahan Owner: *"semalam bisa menghasilkan jawaban walaupun saldo minus"*. **Benar, dan log menunjukkan pesan mana**: 14.36 WIB, lewat **jalur pengulangan** (615 × 0,9 = 553), bukan permintaan pertama — permintaan pertama selalu 402. Yang berubah sesudahnya hanya **kutipan penyedia: 615 → 444**, sehingga plafon ulang 399 jatuh di bawah lantai 512 dan permintaan ditolak **di gerbang**. Bukan kode, bukan prompt — prompt justru lebih kecil sesudah item 120 (41.235 vs 55.125 huruf). **Akarnya bukan angka lantainya.** Lantai 512 bersandar pada *"terpotong tampak seperti model gagal"*, yang **hanya benar selama sistem tidak tahu ia terpotong** — dan memang tidak tahu: `finish_reason` tak dibaca di mana pun, `terpotong` yang sudah ada hanya menandai **batas waktu dinding**. Jadi 512 adalah tebakan di muka yang menggantikan pengukuran yang tak pernah diambil; ia menolak mencoba karena tak sanggup melihat hasilnya. Urutannya dibalik: **baca `finish_reason` → beri label → baru lantai boleh turun**. `sebabSelesai` direkam dari bingkai **terakhir** aliran (sebelum itu `null`), di jalur SSE maupun `processOpenAIStream`; labelnya ditempel **di luar suara model** dan di jalur stream ikut di-`yield` ke layar, bukan hanya masuk variabel. **`jejak.plafonDipakai` perlu ada** karena plafon diturunkan DI DALAM fungsi pengirim — tanpa itu label berkata "8192" padahal yang dipakai 399, **angka salah yang terdengar pasti**. **128 dari pengukuran:** langkah pertama Engineer bukan prosa melainkan satu penanda `[MAMET_CMD: …]` (≈30–40 token). **Keamanan diperiksa lebih dulu:** regex `/\[MAMET_CMD:([^\]]+)\]/g` mewajibkan `]` penutup, jadi penanda terpotong tak pernah jadi perintah — menurunkan lantai tidak membuka jalur eksekusi baru. Uji bagian 3 **dibalik arahnya, bukan dilonggarkan**; kasus produksi `can only afford 444` jadi data uji. 8 mutasi menggigit (M3 jatuh 5). **Jujur: M5 dijatuhkan asersi berbasis TEKS, bukan perilaku** — dicatat apa adanya. 81/81 hijau, bundel esbuild bersih. **Membuka uji live 2–4 untuk 4.2.12 tanpa isi ulang saldo.** **PERLU DEPLOY**, tanpa rilis klien
120. ✅ Peta Repo Jadi INDEKS — −83,8% Sisipan, Tiap Pesan (2026-10-04) — [log](../project-memory/changelog/2026-10-04-peta-repo-jadi-indeks.md) · permintaan Owner: *"metode sama seperti skill — memuat judul atau kata kunci saja"*. Dasarnya terukur: sisipan peta+akar tercatat `riwayat=2 pesan/16.557 huruf`, **identik di lima kali jalan** termasuk di percakapan berbeda, yakni **30% seluruh prompt** untuk pertanyaan apa pun. Murah dikerjakan karena mekanisme pengambilnya SUDAH ada — `git grep` jalan tanpa dialog sejak 4.2.5. **16.557 → 2.687 huruf (−83,8%, ≈3.584 token/pesan).** Indeksnya: jumlah berkas & folder, daftar folder+jumlahnya, perintah pengambil, dan daftar berkas >600 baris. **Dipertahankan sengaja:** daftar berkas besar — ia yang mengajari model memilih `git grep` daripada `git show` yang terpotong 20 KB diam-diam (ambang 400→600; di bawah itu `petunjukKeluaranTerpotong` sudah menangkap). **Bahaya baru yang dijaga:** indeks tak boleh dipakai menyimpulkan sebuah berkas TIDAK ADA (peta lama boleh); dua larangan ditulis di dalam indeksnya sendiri, klaim "LENGKAP" dicabut karena sudah tidak benar. **Cacat rancangan yang ditemukan ujinya sendiri:** pada repo yang tiap berkasnya berfolder sendiri, indeks justru **LEBIH BESAR** (12.808 vs 8.729 huruf). Tambalan pertama memakai ambang `folder*3 > berkas` — angka 3 sewenang-wenang dan langsung salah menilai fixture 3-berkas (9 asersi jatuh). Diganti yang **tepat**: susun kedua bentuk, kirim yang lebih kecil — tak ada yang ditebak, janji "lebih kecil" berlaku tanpa syarat. Uji lamanya **dibalik arahnya, bukan dilonggarkan** (ia menegakkan keputusan lama), fixture-nya ikut diperbaiki. 5 mutasi menggigit (M1 jatuh 11). 81/81 hijau. **PERLU RILIS KLIEN**, tanpa deploy
119. ✅ Plafon Token Diturunkan, Bukan Permintaan Dibuang — 402 "can only afford N" (2026-10-04) — [log](../project-memory/changelog/2026-10-04-saldo-plafon-token.md) · dikerjakan karena **penghalangnya sendiri**: Owner memasang 4.2.11 tetapi tak bisa menguji apa pun karena saldo habis, dan dua belas uji live menunggu satu panggilan model. **Keadaannya lebih buruk dari catatan lama:** 402 hanya ditangani di jalur embedding (`vector_utils.ts:70`); jalur **chat** tidak sama sekali — badan jawaban yang MENYEBUTKAN berapa yang terjangkau ikut masuk ke pesan galat lalu dibuang sebagai teks mentah. **Akarnya:** `max_tokens: 8192` itu **plafon**, bukan kebutuhan jawaban, tetapi OpenRouter memutuskan keterjangkauan dari plafon yang DIMINTA — jadi saldo yang masih cukup untuk jawaban pendek pun ditolak. `MAKS_TOKEN_JAWABAN` menggantikan keenam angka yang dipaku; pada 402 angka terjangkau dibaca lalu permintaan diulang **sekali** dengan plafon itu. **Pola ulang-cobanya mengikuti yang SUDAH ADA** di fungsi yang sama untuk HTTP 400 (model menolak nalar dimatikan) — bukan mekanisme baru, dan cabang 400 itu diuji tetap utuh. Urutannya harus dibetulkan: baris lama memulangkan setiap kegagalan non-400 lebih dulu sehingga 402 tak pernah sampai ke mana pun. **Lantai `MIN_TOKEN_LAYAK = 512`:** di bawah itu TIDAK diulang, karena jawaban terpotong tampak seperti model gagal — lebih buruk daripada galat terang karena menyesatkan; Owner menerima kalimat yang menyebut angkanya dan menyuruh isi ulang, menggantikan dumping JSON. **Yang tak bisa dipastikan:** kalimat 402-nya tak terverifikasi tanpa kena 402; polanya dari pesan yang teramati di proyek ini. Bila berubah → pengurai mengembalikan `null` dan perilaku **kembali seperti sebelumnya**, jadi tebakan salah tidak merugikan. Ujinya **menjalankan modul asli** di Node dengan `kirim` disuntik dan MENGHITUNG panggilan (1 / 2 / 1 / 1 / 1). **Satu mutasi (M5) TIDAK menggigit dan itu benar:** menukar pengulangan jadi rekursi bukan cacat, karena plafon disetel tepat ke `n` sehingga `diminta > n` berhenti sendiri — klaim "tidak berputar" di uji karena itu **menyesatkan** dan diganti dengan yang benar (plafon **mengecil tegas**), yang ikut menjatuhkan M3. Memaksa M5 menggigit berarti menguji bentuk kode alih-alih jaminannya. 80/80 hijau. **✅ DIUJI LIVE 4 Okt — separuh berhasil, dan gagalnya mengajari.** Pesannya **terbukti** menggantikan dumping JSON: *"Saldo OpenRouter hanya cukup untuk 733 token jawaban (diminta 8192)…"*. Tetapi kalimat itu melaporkan **pengulangannya gagal**, dan tangkapan layar sebelum-deploy menjelaskan kenapa — satu badan 402 memuat **beberapa** kutipan (`779` di tingkat atas, lalu `734`, `1558`, `1558` di `previous_errors`) karena OpenRouter mencoba beberapa **penyedia** dengan harga berbeda. **Dua cacat:** (1) `.match()` tanpa `/g` mengambil kutipan **pertama** (779), lebih besar daripada batas penyedia termurahnya (734); (2) diminta **tepat** sebesar angka yang dikutip, padahal itu **batas** bukan nilai aman — dan ia bergeser antar panggilan (779 → 733). Diperbaiki: kutipan **terkecil** dari seluruh badan × `MARGIN_SALDO = 0.9` → untuk badan nyata itu, 734 → **660**. **Nilai margin dipelajari dari produksi, bukan dipilih di muka**, dan itu ditulis di konstantanya. Badan 402 nyata dari tangkapan layar Owner kini jadi **data uji**, dan dua mutasi baru meniru **persis** cara ia gagal (M7 ambil-pertama, M8 tanpa-kelonggaran, masing-masing menjatuhkan 2). Satu asersi lama ikut usang — ia menuntut plafon ulang tepat sama dengan angka OpenRouter, padahal kelonggaran itulah perbaikannya. **Masih mungkin saldonya memang terlalu tipis** (prompt 56 token pun tak terjangkau); pesannya kini membedakan dua hal itu, yang mustahil dilakukan dari dumping JSON. **PERLU DEPLOY ULANG**, tanpa rilis klien
118. ✅ Perintah Tanpa Izin Akhirnya Punya Saksi — `logCommand` Dimanfaatkan (2026-10-04) — [log](../project-memory/changelog/2026-10-04-audit-perintah-engineer.md) · Owner bertanya *"logCommand apakah bisa dimanfaatkan?"*. Bisa, dan celahnya **baru saja membesar**: `runCommand` satu-satunya pintu semua perintah Engineer dan tak mencatat apa pun yang bertahan (hanya event memori + state React, hilang saat muat ulang), sementara **sejak 4.2.5 `git`-baca jalan TANPA dialog** — dulu dialognya sendiri yang jadi catatan. Rantainya sudah ada sejak PR#1 (`AuditLogService` di Kernel, tabel `assistant_audit_log` di Supabase) dan **0 baris** selamanya karena satu-satunya pemanggil `log()` adalah SKILL_EXECUTED. **Jebakan yang nyaris membuatnya buta:** perintah Engineer justru read-only DI DALAM workspace, jadi `mustLog` lama (`is_destructive \|\| !in_workspace`) membuat `log()` pulang SEBELUM insert — menyambungkannya begitu saja = fitur tersambung tetapi tak mencatat apa pun, pola `mimeType` lampiran lagi. Ditutup dengan bendera eksplisit `wajibSimpan`, bukan menebak keberbahayaan. **Keluaran TIDAK disimpan, hanya panjangnya** — ia isi berkas repo mentah, jalur ini di sisi KLIEN yang tak punya penyaring rahasia (`saring_rahasia.ts` hanya di server), dan `agent_logs` pernah benar-benar menyimpan kunci API. `tanpaIzin` datang dari proses utama (satu-satunya yang tahu dialognya dilewati), ditaruh SESUDAH `...h` agar tak tertimpa; renderer MEMBACA, tidak menebak dari teks perintah. **Lubang RLS — komentar berbohong ketiga hari ini:** kebijakan bernama "Service role can insert" ternyata berperan **PUBLIC** dengan `WITH CHECK (TRUE)`, karena komentar migrasi 20260826 menyangka AuditLogService memakai service role — padahal kunci anon. Siapa pun pemegang kunci anon (ada di repo publik) bisa menyisipkan baris audit **ber-`user_id` Owner**, dan kebijakan BACA membuatnya tampil sebagai asli. Jejak audit yang bisa ditulis siapa saja lebih buruk daripada tidak ada. Migrasi `20261004000000` **sudah diterapkan & diverifikasi**: kolom `tanpa_persetujuan` + `TO authenticated WITH CHECK (auth.uid() = user_id)`, pemulihannya ikut dicatat. **Uji anti-busuk kemarin MENYALA tepat sebagaimana dirancang** — `uji-komentar-tak-berbohong` jatuh begitu `logCommand` disambungkan karena JSDoc "YATIM" seketika jadi bohong; ikut ketahuan asersi `/YATIM/` tetap hijau SECARA KELIRU karena kalimat sejarahnya memuat kata itu (pencocokan kata telanjang tidak cukup untuk klaim yang berubah arah). 6 mutasi menggigit, 79/79 hijau. **PERLU RILIS KLIEN** (`alatFolderJalan.cjs` di `electron/` — wajib build baru), tanpa deploy. **✅ RLS TERBUKTI DI BASIS DATA NYATA 4 Okt** (saldo OpenRouter habis → bagian yang tak butuh model diuji langsung, tiap peran disamarkan `set local role` + `request.jwt.claims`, semua dalam transaksi dibatalkan): authenticated menulis baris sendiri **BOLEH** dan langsung terlihat olehnya; authenticated atas nama orang lain **DITOLAK**; anon **DITOLAK**. **Uji kendali** memasang kembali kebijakan lama di dalam transaksi → *"anon BERHASIL memalsukan baris atas nama Owner"*, jadi lubangnya **nyata bukan teoretis**; sesudah rollback kebijakan kembali benar dan tabel **0 baris**. Ikut ketahuan: `user_id` punya **kunci asing ke `auth.users`**, jadi baris palsu wajib memakai id pengguna nyata — mempersempit, tidak menutup, dan belum tercatat di mana pun. Ditambah penjaga baru: tiap medan `logEntry` diperiksa punya kolomnya (satu medan tanpa kolom membuat SETIAP insert ditolak Postgres sementara penolakannya hanya `console.warn` — pola `mimeType` lagi; M7 menjatuhkannya). **Sisa yang belum terbukti:** satu baris nyata dari aplikasi, karena memicu perintah Engineer menuntut model memancarkan `[MAMET_CMD]`
117. ✅ TEMUAN-ENGINEER Bersih — Tiga Komentar yang Berbohong (2026-10-04) — [log](../project-memory/changelog/2026-10-04-temuan-engineer-bersih.md) · Owner bertanya mana kasus yang bisa ditutup; jawabannya lebih banyak dari yang tercatat. Ketiganya sekelas: bukan kode salah, melainkan **komentar yang berbohong**. **TMN-0001 lahir sudah tertutup** — komentarnya diperbaiki di `d677e83`, **commit yang sama yang MEMBUAT berkas temuan itu**, lalu tercatat TERBUKA sepuluh hari karena tak ada yang memeriksanya ulang (temuan berumur diverifikasi SEBELUM dikerjakan). **TMN-0002 saya sendiri yang memperburuk** — temuannya mencatat 2 pelanggaran, saat ditutup ada **3**; yang ketiga saya tambahkan 2 Okt (`bbfce3a`) **tepat di bawah komentar yang menyangkal keberadaannya**. Komentar yang salah tidak menghalangi apa pun, jadi ia tidak cuma membusuk — ia **menarik pelanggaran baru**. **TMN-0003 dua hal salah**, bukan satu: rujukan CommandRegistry yang sudah tiada, DAN keyatiman method itu (nol pemanggil → tak satu pun eksekusi command tercatat lewat jalan ini) yang tidak tercatat di temuannya. Fungsinya **sengaja dibiarkan** — penghapusan menunggu Owner. Dengan TMN-0004 (2 Okt), **tak ada lagi temuan TERBUKA**. **Ujinya memeriksa apakah komentar masih COCOK dengan kodenya**, bukan apakah kalimatnya sudah diganti — tabel & jumlah yang didaftar harus sama dengan yang dipanggil; `logCommand` yang disambungkan menjatuhkan uji karena komentar "YATIM" jadi bohong. **Ujinya menangkap dua kesalahan saya sendiri:** percobaan pertama memakai **nomor baris** dan komentar perbaikan itu sendiri menggeser ketiganya (nomor baris di komentar pasti membusuk — satu asersi kini melarangnya), dan asersi hitungan tertipu JSDoc penjelas sendiri. M1/M2 meniru **persis** cara TMN-0002 membusuk. 78/78 hijau. **Tanpa deploy, tanpa rilis** — `git diff` kedua berkas kode hanya baris komentar
116. ✅ Satu Pesan = Satu Percobaan Embedding (2026-10-04) — [log](../project-memory/changelog/2026-10-04-embedding-sekali-per-pesan.md) · ditunda sebagai dugaan, lalu **log produksi menaikkannya**: 1 Okt 17:24:49 mode ENGINEER, satu pesan, dua `[Embedding] Gagal (SALDO_HABIS)` berjarak **183 ms**. **Akarnya** bukan kebijakan ulang-coba melainkan dua titik panggil yang tidak saling tahu: `generateEmbeddingThroughAdapter` MELEMPAR bila dimensi ≠ 768, lemparannya melewati baris penyimpanan sehingga `queryEmbedding` tak pernah disetel, lalu `context_builder` memanggil pintu embedding sekali lagi. Jalur suksesnya hemat, jalur gagalnya **menggandakan** — justru ketika sesuatu sudah salah. Dan 183 ms dalam satu permintaan tidak menyembuhkan apa pun: 402 saldo habis maupun ketiadaan kunci jelas tidak. **Perbaikan:** `ctx.request.embeddingGagal` mewarisi sebabnya ke hilir; sebab itu **ikut diwariskan ke `jejakVektor`** supaya pesan ⚠️ tetap menyebut sebab nyata — tanpa itu perbaikan ini hanya menukar satu kebisuan dengan kebisuan lain. Kedua medan **diberi tipe** di `types.ts` (`queryEmbedding` dulu `as any`, itu sendiri sebagian sebab keduanya bisa tak saling tahu). **Penjaga paling mudah salah:** `catch` yang sama juga menangkap galat non-embedding saat vektornya SUDAH jadi — menandainya gagal akan membuang vektor baik dan menurunkan pencarian dokumen tanpa sebab; syaratnya `jejakVektorMemori.sebab`, bukan "ada galat". Jalur tulis-ulang (Item 67) tidak dibungkam — teksnya berbeda dan hanya terjangkau bila vektor pertama berhasil. **Ujinya mengambil ekspresi keputusannya DARI BERKAS SUMBER lalu menjalankannya** dan menghitung panggilan (0 / 0 / 1 / 1) — bukan salinan yang akan tetap hijau walau kodenya berubah. Empat mutasi menggigit, **dua di antaranya perbaikan yang SALAH** (sebab tak diwariskan; galat lain ikut ditandai). 77/77 hijau, bundel bersih. **PERLU DEPLOY**, tanpa rilis klien
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

Versi di `package.json`: **4.2.14** (dinaikkan 6 Okt). Terpasang di mesin Owner: **4.2.13**.

> ⚠️ **Tiga muatan menunggu build.** 4.2.14 membawa indeks konstitusi (item 124), ingatan temuan
> yang berhenti diam (TMN-0006), dan pengerasan cangkang Electron (TMN-0009) — **tak satu pun ada
> di 4.2.13 yang sedang berjalan**. Jangan menilai ketiganya dari aplikasi yang terpasang sekarang.
>
> Item **123** juga masuk sesudah rilis 4.2.13, tetapi ia murni edge function dan **sudah
> ter-deploy** — ia tidak menunggu rilis klien.
>
> **`main.cjs` berubah**, jadi `npm run desktop` harus **dijalankan ulang**; muat ulang jendela
> tidak cukup.
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

### Yang dibawa 4.2.14 — versi dinaikkan 6 Okt, menunggu build & Publish Owner

> ⚠️ **JANGAN dicampur dengan 4.2.13.** Commit rilis 4.2.13 (`ab0fe38`) berada DI BAWAH commit
> item 124 di riwayat git, jadi **4.2.13 yang terpasang di mesin Owner TIDAK memuat** satu pun
> dari ketiga muatan di bawah. Blok uji ini sempat salah ditaruh di bagian 4.2.13 — dipindah 5 Okt.
>
> **Alur rilis tetap MANUAL** (item 96): electron-builder membuat draf, Owner yang menekan Publish.

| Dibawa 4.2.14 | Apa | Sisi |
|---|---|---|
| **Indeks konstitusi** | 33 berkas berhenti dibaca-lalu-dibuang tiap boot; indeksnya benar-benar sampai ke model (+577 token/pesan, item 124) | klien |
| **Ingatan temuan berhenti diam** (TMN-0006) | "tidak bisa dibaca" tidak lagi disamakan dengan "tidak ada temuan"; peringatan masuk ke konteks model, di DEPAN daftar | renderer |
| **Cangkang Electron** (TMN-0009) | `no-sandbox` dicabut (konfigurasi berhenti membantah `sandbox: true`), penjaga navigasi ditambahkan; `webSecurity: false` **sengaja dipertahankan** karena load-bearing | `main.cjs` |

**PERLU RILIS KLIEN, dan `npm run desktop` harus DIJALANKAN ULANG** — `main.cjs` dan
`preload.cjs` berubah, kanal `engineer:indeks-konstitusi` hanya ada di proses utama yang baru.
Muat ulang jendela tidak cukup.

**Uji 4.2.14:**

**A. Indeks konstitusi — tiga langkah, dan yang ketiga yang paling mudah terlupakan:**

| | Yang dilihat | Gagal bila |
|---|---|---|
| a. **sampai** | `riwayat` naik **2.687 → ±4.900 huruf** | tetap 2.687 → Electron belum dijalankan ULANG (kanal `engineer:indeks-konstitusi` hanya ada di proses utama yang baru) |
| b. **dipakai** | tanya aturan: *"apa kata konstitusi tentang CORE IMMUTABLE?"* → Engineer **menjalankan `git show`** lebih dulu | ia menjawab dari ingatan, atau mengaku sudah membaca tanpa menjalankan apa pun |
| c. **TIDAK kelebihan menyala** | tanya hal sepele *("berapa berkas di `uji/`?")* → **TIDAK** membaca konstitusi | ia membuka berkas konstitusi untuk pertanyaan yang tak menyangkut aturan |

> **c itu kendalinya, dan tanpa itu b tidak berarti.** Aturan *"BACA berkasnya lebih dulu"*
> bisa membuat Engineer membuka konstitusi untuk **setiap** pertanyaan — menukar satu
> kegagalan (tak pernah membaca) dengan kegagalan lain (selalu membaca, tiap jawaban jadi
> mahal dalam perintah maupun token). Uji yang hanya memeriksa b akan menyebut itu sukses.

**B. Aplikasi tetap START — ini yang pertama dilihat, sebelum uji apa pun.**

`no-sandbox` dicabut (TMN-0009), dan itu satu-satunya perubahan sesi 5–6 Okt yang bisa
menggagalkan start. **Gagal bila** jendela tidak muncul atau proses keluar sendiri. Pemulihannya
satu baris, dan cara mundurnya ditulis di `main.cjs` tepat di atas `disable-gpu-sandbox`.

**C. Tautan luar tidak lagi membajak jendela utama** (TMN-0009). Bila ada tautan `https://` yang
bisa diklik di mana pun aplikasi, ia harus membuka **peramban sistem** — bukan memuat halaman itu
di dalam jendela Mamet. **Gagal bila** halaman luar termuat di dalam aplikasi.

**D. Pencarian web MASIH jalan** (kendali untuk `webSecurity: false` yang sengaja dipertahankan).
Jalankan satu pertanyaan yang memicu pembanding web. **Gagal bila** hasilnya kosong disertai galat
CORS di DevTools — itu berarti `webSecurity` tak sengaja ikut dinyalakan, dan pencarian mati
diam-diam.

**E. Ingatan temuan bersuara saat rusak** (TMN-0006, opsional). Sunting satu judul di
`TEMUAN-ENGINEER.md` jadi bentuk lama (mis. `## TMN-0001 — ✅ DITUTUP`), buka workspace Engineer,
lalu lihat DevTools: harus muncul `[IngatanTemuan] BENTUK BERKAS MELENCENG`. **Kembalikan
judulnya sesudah menguji** — atau jalankan `node uji/uji-komentar-tak-berbohong.mjs` untuk
memastikan berkasnya kembali utuh.

### Yang dibawa 4.2.13

> ⚠️ **Perlu DEPLOY *DAN* RILIS KLIEN** — pertama kali sejak beberapa hari keduanya diperlukan
> sekaligus. Anggaran keluaran perintah ada di sisi klien: **deploy saja tidak mengaktifkannya**,
> rilis saja tidak mengaktifkan dua perbaikan edge function-nya.

| Dibawa 4.2.13 | Apa | Sisi |
|---|---|---|
| **Anggaran keluaran perintah** | keluaran >8.000 huruf dipotong kepala+ekor dengan catatan bernomor; dua jalur pengirim disatukan (item 122) | klien |
| **402 varian ke-3 `in-flight`** | tabrakan permintaan paralel dikenali, tidak lagi disamakan dengan saldo habis (item 122) | deploy |
| **BRAIN 1 tak lagi kembar** | isi tidak diulang di BLOK 4 saat mode Engineer, ≈1.300 huruf/pesan (item 122) | deploy |

**Kenapa dinaikkan sekarang:** sesi 01:33 membuktikan uji 2 & 3 lulus, lalu **patah di giliran
kedua** persis karena cacat yang dibawa 4.2.13. Tanpa rilis ini, setiap sesi Engineer yang
menjalankan `git grep` lebar akan mengulang kegagalan yang sama.

**Uji 4.2.13 — urutannya penting:**

1. **Anggaran berlaku** — ulangi `git grep -n -B2 -A4 "402"` di tiga folder. Keluarannya harus
   memuat `[KELUARAN DIPOTONG SISTEM]` dengan angka aslinya, dan `[PROMPT_KOMPOSISI]` giliran
   berikutnya `pesan=` harus **jauh di bawah 15.769**.
2. **Ekornya utuh** — baris terakhir keluaran asli harus masih terlihat; gagal bila keluaran
   berhenti di tengah tanpa catatan.
3. ✅ **LULUS — terbukti live 5 Okt 02:23.** `blok4_brain` **1.980 → 767** (−1.213), dan
   `konteks_engineer` **tetap 17.687** — tidak bergerak satu huruf pun. Baris kedua itu yang
   menentukan: yang menyusut salinan keduanya, aslinya utuh. Bila `konteks_engineer` ikut turun,
   berarti yang diringkas aslinya dan Engineer kehilangan isi BRAIN 1. Total 41.235 → **39.989**.
4. ✅ **TERJAWAB 5 Okt — di tingkat LOGIKA, tanpa saldo.** Uji ini menggantung berhari-hari karena
   dikira menuntut model menjawab lebih dulu. Tidak: `perintahAman` (preload) memanggil
   `tanpaPersetujuan()` — **predikat yang sama persis** yang dipakai jalur otomatis
   `ConversationEngine` — dan ia bisa dijalankan langsung di Node.

   | Perintah | Hasil |
   |---|---|
   | `node -e "console.log(1)"` | **MINTA IZIN** ✓ |
   | `node --eval console.log(1)` | **MINTA IZIN** ✓ (bentuk lain, tetap tertutup) |
   | `git push` · `git commit` · `npm install` | **MINTA IZIN** ✓ |
   | `git status` · `git grep -n` | **JALAN SENDIRI** ✓ |

   **Dua baris terakhir yang membuatnya berarti**: fungsi yang selalu menolak akan lulus tanpa
   menjaga apa pun. Penjaganya benar-benar memilah.

   Sudah dijaga **uji tetap** pula: `uji/uji-perintah-tanpa-persetujuan.mjs:63` memuat
   `node -e "console.log(1)"` sebagai kasus, dan hijau.

   > **Yang BELUM dibuktikan, dan jangan diklaim:** bahwa dialognya benar-benar **tergambar** di
   > layar. Yang terbukti adalah keputusannya — perintah itu tidak jalan sendiri. Rantai
   > `perintahAman → tanpaPersetujuan → ConversationEngine melewati auto-run` lengkap di kode;
   > render dialognya klaim terpisah yang lebih kecil, dan masih menunggu satu sesi Engineer.

### ⛔ BERHENTI MENUNGGU SALDO (5 Okt 02:23) — bukan masalah ukuran prompt lagi

```
10.430 token dikirim · saldo menanggung 1.048
```

Uji 1, 2 dan 4 **semuanya menuntut model menjawab** — termasuk `node -e`, karena dialognya baru
muncul sesudah Engineer memancarkan penanda perintah. Tak satu pun bisa dijalankan tanpa saldo.

**Dihitung, bukan dikira-kira — memangkas prompt TIDAK bisa mengejar selisih ini.** Pada ±3,83
huruf/token, jatah 1.048 token ≈ **4.000 huruf**. Blok yang tak bisa dibuang sama sekali:

```
dasar_identitas 6.029 + kontrak 1.099 + constraint 2.774 + format 1.248
              + memori 508 + blok3 196  =  11.854 huruf ≈ 3.100 token
```

Jadi: buang **seluruh** konteks Engineer, **seluruh** RAG, dan **seluruh** peta repo — Engineer
tanpa aturan, tanpa dokumen, tanpa peta — prompt-nya masih **±3.300 token**, tiga kali lipat jatah
yang ada. Usul pemangkasan berikutnya karena itu akan memangkas ATURAN demi selisih yang tetap
tidak tercapai.

**Arah dua angka ini berlawanan, dan itu intinya:**

| | Total prompt | Kutipan penyedia | Batas prompt saldo |
|---|---|---|---|
| 4 Okt (sebelum item 120) | 55.125 (≈14.250 token) | 615 | 3.621 |
| 4.2.12 | 41.235 | 444 | 1.682 |
| **4.2.13** | **39.989 (≈10.430 token)** | **345** | **1.048** |

Prompt turun **27%**; saldo turun lebih cepat. Pekerjaan item 120–122 tetap sah dan terukur — ia
hanya tak bisa menggantikan isi ulang saldo.

### Yang dibawa 4.2.12

> **4.2.11 SUDAH terpasang Owner** (5 Okt), jadi jejak audit perintah sudah hidup — hanya belum
> diuji (`assistant_audit_log` masih 0 baris, karena memicu perintah Engineer menuntut model
> memancarkan `[MAMET_CMD]`).
>
> 4.2.12 dinaikkan **bukan** untuk kerapian: pemangkasan peta repo menyerang penghalang yang sama
> dengan saldo tipis — **−3.584 token per pesan**, selisih antara prompt ±14.250 dan ±10.700 token.
> Dan uji audit 4.2.11 sendiri **butuh chat jalan**, jadi 4.2.12 MEMBUKA pengujian 4.2.11, bukan
> menundanya. Keduanya menguji hal berbeda dan tidak saling menutupi.

| Dibawa 4.2.12 | Apa |
|---|---|
| **Peta repo jadi indeks** | sisipan 16.557 → 2.687 huruf (−83,8%) di tiap pesan; daftar berkas diambil saat perlu lewat `git grep` yang sudah jalan tanpa dialog (item 120) |

**Tanpa deploy** — `ProsedurEngineer.js` ada di `frontend/src`.

**Satu sesi Engineer menutup banyak sekaligus**, dan uji 1–3 saling membuktikan lewat perintah
yang sama:

1. ✅ **TERBUKTI LIVE 5 Okt 01:05** — `[PROMPT_KOMPOSISI]`: `riwayat = 2 pesan/**2.687 huruf**`
   (dari 16.557), total **41.235** (dari 55.125, −25,2%), `blok4_rag = 6.959` → RAG tetap hidup.
   2.687 **tepat** seperti hitungan uji lokal, bukan sekadar "±2.700".
2. **Peta-indeks tidak membutakan** — tanya sesuatu yang menuntut alamat berkas (mis. *"di mana
   penanganan 402?"*). Engineer harus **menjalankan `git grep` lebih dulu**. Gagal bila ia menebak
   alamat, atau menyimpulkan berkasnya tidak ada dari indeks yang hanya menyebut folder.
3. **Audit perintah (4.2.11)** — `git grep` dari uji 2 itu sendiri harus mengisi
   `assistant_audit_log` dengan `tanpa_persetujuan = true` dan `result_reason` memuat
   *"keluaran N huruf (tidak disimpan)"*.
4. **`node -e` tetap minta izin** — yang mendesak; harus tetap memunculkan dialog.

> ⛔ **Uji 2–4 TERHALANG SALDO, bukan gagal** (5 Okt 01:05). Ketiganya menuntut model **menjawab**;
> 402 datang sebelum satu token pun keluar, jadi belum ada apa pun untuk dinilai. **Item 121
> membuka jalannya**: kutipan 444 tak lagi ditolak di gerbang (lantai 128), jadi uji 2–4 bisa
> jalan tanpa isi ulang saldo — **sesudah deploy**.
>
> Yang ikut terbukti tanpa diminta: penjaga 402 bekerja **dua lapis** — ia tahu 444 < 512 dan
> **menolak mengulang**, persis cabang yang dibangun item 119. Dan prompt 41.235 huruf **lolos
> dikirim**: varian 402 *prompt kebesaran* tidak menyala, hanya varian plafon keluaran.
>
> **Bila sesudah deploy jawabannya muncul dengan label ⚠️ [JAWABAN TERPOTONG]** — itu **bukan**
> kegagalan uji. Itu item 121 bekerja: dulu keadaan yang sama ditolak diam-diam di gerbang.

### ✅ Uji 2 & 3 LULUS (5 Okt 01:33) — item 121 terbukti jadi sebabnya

| Uji | Bukti |
|---|---|
| **2. Peta-indeks tidak membutakan** | *"Saya akan mencari penanganan status 402 di repo ini. Mari saya telusuri dengan `git grep`."* — **mencari lebih dulu**, tidak menebak alamat, tidak menyimpulkan berkasnya tidak ada |
| **3. Audit perintah (4.2.11)** | `tanpa_persetujuan = true`, `result_reason` = *"keluaran 15671 huruf (tidak disimpan — lihat chat)"*, `result_output` **kosong** |
| **121 jadi sebabnya** | `[Saldo] 402: diulang SEKALI dengan max_tokens: 399` → tak ada baris gagal sesudahnya. Kemarin 399 ditolak di gerbang |
| **Lantai 512 terlalu tinggi, terbukti** | tak ada baris `jawaban TERPOTONG` → `finish_reason` bukan `length`: jawaban itu **selesai utuh dalam 399 token**, tidak mepet sama sekali |

**Masih terbuka: uji 4** (`node -e` wajib memunculkan dialog) — mendesak secara keamanan.
Giliran ke-2 sesi itu patah dan melahirkan item 122.

### Yang dibawa 4.2.11

> **BEDA DENGAN KEADAAN 4.2.9:** 4.2.10 **benar-benar diterbitkan dan dipakai** Owner
> (*"sudah push dan berhasil memakai versi 4.2.10"*). Jadi keempat uji 4.2.10 di bawah **tidak
> hangus** — fiturnya ada di 4.2.10 maupun 4.2.11, dan menjalankannya di 4.2.11 sama sahnya.
>
> Owner memilih menaikkan versi sekarang meski keempat uji itu belum dijalankan. Dicatat supaya
> jelas ini **keputusan**, bukan kelupaan: asisten mengusulkan menguji dulu agar "terbukti live"
> tidak kehilangan arti karena versi menumpuk; Owner memutuskan naik sekarang.

| Dibawa 4.2.11 | Apa |
|---|---|
| **Perintah tanpa izin punya saksi** | jejak audit yang BERTAHAN untuk tiap perintah Engineer, dengan pembedaan "jalan tanpa dialog"; keluarannya tidak disimpan, hanya panjangnya (item 118) |

**Wajib build baru**, bukan muat ulang renderer: `alatFolderJalan.cjs` ada di `frontend/electron/`.
Migrasi basis datanya **sudah diterapkan** 4 Okt — tidak ada yang perlu dijalankan lagi.

**Uji 4.2.11:** jalankan `git status` lewat Engineer (ia jalan sendiri tanpa dialog), lalu periksa
tabelnya:

```sql
select command, tanpa_persetujuan, result_reason, logged_at
from assistant_audit_log order by logged_at desc limit 5;
```

Harus muncul barisnya dengan `tanpa_persetujuan = true` dan `result_reason` memuat *"keluaran N
huruf (tidak disimpan)"*. **Tabel yang tetap 0 baris berarti insert-nya ditolak** — kemungkinan
besarnya sesi tidak terautentikasi saat itu, karena kebijakan RLS barunya menuntut
`auth.uid() = user_id`.

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

> ⚠️ **CATATAN INI SUDAH USANG (diperiksa 5 Okt).** Dulu tertulis: *"uji yang menyangkut sisipan
> harus di percakapan BARU, karena percakapan lama membawa penanda 'mulai dari' yang memotong
> sisipannya."* Sebabnya **sudah ditutup di 4.2.4** — sisipan kini DIPATOK, dihitung lebih dulu
> terhadap anggaran, dan `mulaiDari` hanya berlaku pada percakapan.
>
> Terukur pula: `riwayat` tercatat **identik di lima kali jalan, termasuk di percakapan yang
> berbeda**. Itu pengukuran yang sama yang mencabut saran *"mulai percakapan BARU"* dari pesan
> galat 402 pada 4 Okt. Percakapan baru tidak memangkas maupun memulihkan apa pun.
>
> Dibiarkan tertulis karena memulai percakapan baru tetap tidak merugikan — tetapi ia bukan lagi
> syarat, dan jangan dipakai menjelaskan kegagalan uji.

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
6. ✅ **`node -e` — KEPUTUSANNYA sudah terbukti 5 Okt, tanpa saldo.** Lihat uji 4 di
   **Yang dibawa 4.2.13**: `tanpaPersetujuan()` dijalankan langsung di Node, `node -e` dan
   `node --eval` keduanya **MINTA IZIN**, sementara `git status`/`git grep` **JALAN SENDIRI** —
   jadi penjaganya memilah, bukan menolak segalanya. Sudah ada uji tetapnya pula
   (`uji-perintah-tanpa-persetujuan.mjs:63`).

   Yang **masih** menunggu sesi Engineer hanyalah klaim yang lebih kecil: bahwa dialognya
   benar-benar **tergambar** di layar. Garis "membaca repo aman, menjalankan kode karangan model
   tidak" sendiri sudah terbukti tidak bocor.

Cara memastikan peta benar-benar terkirim, tanpa menebak dari jawaban model: lihat
`[PROMPT_KOMPOSISI]` di log edge function.

> ⚠️ **ANGKA DI BARIS INI DULU SALAH SEJAK 4 Okt, DIPERBAIKI 5 Okt.** Tertulis *"riwayat harus
> melonjak di atas 15.000 huruf"* — itu patokan **sebelum item 120**. Sesudah peta jadi INDEKS,
> `riwayat` justru **turun ke ±2.687 huruf**. Mengikuti angka lama berarti menyimpulkan petanya
> GAGAL terkirim padahal ia berhasil: uji yang lulus dibaca sebagai gagal.
>
> | | `riwayat` |
> |---|---|
> | ≤ 4.2.11 (peta utuh) | **16.557** huruf |
> | ≥ 4.2.12 (peta indeks) | **2.687** huruf |
>
> Patokan yang benar sekarang: `riwayat ≈ 2.687`. Bila ia **16.557**, justru rilis lamanya yang
> sedang berjalan.

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

### ✅ AUDIT 5 OKT SELESAI — kelima temuan DITUTUP 6 Okt

Rinciannya di [`TEMUAN-ENGINEER.md`](../project-memory/temuan-engineer/TEMUAN-ENGINEER.md).
**Tidak ada yang dikerjakan** — Owner meminta dibahas dulu.

| | Tingkat | Inti |
|---|---|---|
| **TMN-0005** | ✅ **DITUTUP 6 Okt** | `verification_audit_logs` punya policy INSERT **TO PUBLIC dengan `WITH CHECK true`** — kembaran lubang `assistant_audit_log`. **Bobotnya naik saat `cek github`:** repo ternyata **PUBLIC** dan kunci anon tertulis apa adanya di `build.yml:37`, jadi RLS satu-satunya perlindungan dan lubangnya **bisa dipakai siapa pun** — bukan teoretis. Policy **dicabut tanpa pengganti** (service_role melewati RLS, jadi tak ada policy INSERT yang dibutuhkan); anon & authenticated ditolak, **kendali** service_role tetap bisa menulis. Tak ada bukti pernah dipakai orang lain: 713 baris, hanya 1 tanpa `user_id` — baris buatan asisten |
| **TMN-0006** | ✅ **DITUTUP 6 Okt** | Berkas temuan **tak terbaca kodenya sendiri** — 4 judul ada, **0** terurai. **Letak cacatnya ternyata lebih dalam dari "diam":** daftar kosong punya DUA sebab yang berbeda — *memang tak ada temuan* dan *berkasnya tak terbaca* — dan `ringkasanUntukKonteks` menyamakan keduanya jadi string kosong, sehingga Engineer menyimpulkan "tidak ada temuan" dari berkas yang jelas berisi. Kini `keutuhanTemuan()` membandingkan judul vs yang terurai, dan peringatannya masuk **ke konteks model** (bukan cuma konsol) di **depan** daftar. 4 mutasi menggigit |
| **TMN-0007** | ✅ **DITUTUP 6 Okt** | 4 berkas (**368 baris**) nol pengimpor — dan `git log -S` membuktikan pernyataan `import`-nya **tak pernah ada sekali pun** sepanjang riwayat. `verification_pipeline.ts` lahir mati 30 Juni, lalu **disunting 21 Agustus**: seseorang memperbaiki pipeline yang tak pernah berjalan. **Dihapus.** ⚠️ **Satu klaim temuan ini sendiri SALAH dan dikoreksi:** ia menyebut keempatnya "ikut dibundel tiap deploy" — nyatanya bundel esbuild **sama persis 525.355 bita** sebelum & sesudah, dan deploy pun tak pernah mengunggahnya. Biayanya penipuan, bukan berat deploy |
| **TMN-0008** | ✅ **DITUTUP 6 Okt** | Satu baris palsu tertinggal di produksi akibat pembuktian TMN-0005 (`execute_sql` meng-commit otomatis). Dihapus atas izin Owner, **dikunci ke satu id persis** (bukan ke polanya — menghapus berdasarkan pola di tabel audit berisiko membawa baris lain). Terbukti: `713 → 712`, `tanpa user_id 1 → 0`, dan `model_unik` kembali **2 → 1** |
| **TMN-0009** | ✅ **DITUTUP 6 Okt** | Cangkang Electron, dan **nasib ketiganya BERBEDA** — itu intinya. **(1)** `no-sandbox` **dicabut** (konfigurasinya berhenti membantah `sandbox: true`; GPU sudah ditangani tiga sakelar lain). **(2)** **Penjaga navigasi ditambahkan**: `setWindowOpenHandler` menolak semua jendela baru, `will-navigate` membatalkan navigasi keluar, tautan luar ke peramban SISTEM. **(3)** `webSecurity: false` **SENGAJA DIPERTAHANKAN** — ia tampak kelalaian dan hampir dinyalakan, ternyata **load-bearing**: `WebComparisonService.js:405` mem-`fetch()` RSS pihak ketiga dari renderer, dan menyalakannya memutus pencarian web **diam-diam lewat CORS**. Alasannya ditulis di dalam KODE-nya, dan satu asersi menjaga agar tak "diperbaiki" keliru. ⚠️ **Uji mutasi menemukan asersi saya sendiri yang HAMPA** (`localhost:5173.jahat.com` lulus karena `new URL()` melempar, bukan karena host dicek ketat) — diganti `localhost:51730`, mutasinya langsung menggigit |

> **Pola yang pantas dibaca bersama, bukan satu per satu:** TMN-0005 adalah kembaran lubang yang
> baru ditutup kemarin, dan tiga fungsi "diuji tetapi tak pernah dipanggil" adalah saudara
> `logCommand`. Keduanya ditemukan **satu-satu**, bukan sebagai kelas — dan TMN-0006 menjelaskan
> sebagian sebabnya: ingatan temuan memang sedang buta.
>
> **Dan satu hal tentang terminal Engineer yang perlu disadari sebagai RANCANGAN, bukan cacat**
> (rinciannya di TMN-0009): `node`, `python`, `npm` **sengaja** ada di daftar izin, jadi sesudah
> Owner menekan izin, kode karangan model berjalan penuh. **Dialog izin adalah satu-satunya yang
> berdiri antara kode karangan model dan eksekusi** — bukan daftar program, bukan pagar folder.
> Itulah sebab uji `node -e` bukan formalitas, dan sebab daftar jalan-sendiri harus tetap
> sesempit sekarang (git baca-saja).

### ◐ SEPARUH DITUTUP — 55.081 huruf prompt untuk pertanyaan EMPAT KATA (4 Okt)

> **Jangan dibaca sebagai masih terbuka seluruhnya, dan jangan pula sebagai sudah selesai.**
>
> | | |
> |---|---|
> | ✅ **ditutup** | sisipan peta repo (item 120), BRAIN 1 kembar (item 122), keluaran perintah tanpa anggaran (item 122) |
> | ⛔ **tidak akan ditutup oleh pemangkasan** | `konteks_engineer` 17.687 huruf — **14.695 di antaranya ATURAN, bukan data**; narasi sejarah cuma 634 huruf (3,6%), duplikasi dengan kontrak universal **nol** |
> | ⚠️ **justru BERTAMBAH** | item 124 menambah **+577 token/pesan** (indeks konstitusi) — keputusan sadar Owner |
>
> Dan sejak 5 Okt 02:23 pemangkasan bukan lagi jalan keluarnya sama sekali: saldo menanggung
> 1.048 token sedangkan blok yang tak bisa dibuang saja sudah ≈3.100. Lihat
> **⛔ BERHENTI MENUNGGU SALDO** di §5b.

Diukur dari log `[PROMPT_KOMPOSISI]` saat *"apa itu rls?"* ditolak OpenRouter dengan
`Prompt tokens limit exceeded: 14250 > 3621`. Totalnya **55.081 huruf ≈ 14.250 token** — cocok
dengan galatnya, jadi ini ukuran, bukan perkiraan.

| Bagian | Huruf |
|---|---|
| **`memori_personal_klien`** | **18.195** |
| **riwayat** (2 pesan) | **16.557** |
| `blok4_rag` | 7.025 |
| `dasar_identitas_panduan` | 6.030 |
| `blok5_constraint` + `kontrak_blok1_2` | 3.805 |
| sisanya | 3.457 |

**Dugaan pertama saya SALAH:** saya menyangka aturan Engineer + peta repo yang membengkak, dan
sempat menuliskannya di pesan galat. Seluruh kontrak Engineer hanya **±3.800 huruf**. Kalimat itu
dicabut sebelum di-commit.

**1. ✅ TERPECAHKAN — `memori_personal_klien` menyembunyikan KONTEKS ENGINEER.** `user_memories`
nyata: **10 baris, 316 huruf seluruhnya** — sementara bagian berlabel itu **18.195 huruf**, dan
**identik di empat kali jalan** tak peduli pertanyaan maupun hasil RAG. Konstannya itulah
petunjuknya: memori & RAG berubah tiap pertanyaan, konteks Engineer tidak. **Saya salah DUA KALI
dulu:** (a) menuduh aturan Engineer + peta repo — dicabut, karena kontraknya hanya ±3.800 huruf;
(b) menuduh `globalMemory`/`trimmedRagContext` — **sempat ter-commit**, lalu terbantah
`MAX_RAG_CONTEXT_CHARS = 4000`. Yang sebenarnya, dengan bukti: `context_pipeline.ts:24` menyusun
`identitas + userContext + memoryPrompt + engineerContextPrompt`, jadi blok Engineer duduk PERSIS
di antara memori dan kontrak — dan karena tiap segmen diukur sebagai **jarak ke segmen berikutnya**
sedangkan blok Engineer **tak punya penanda sendiri**, ia ikut terhitung ke sana. Jadi tebakan
PERTAMA saya benar dan "koreksi" kedua yang keliru. **Diperbaiki:** `konteks_engineer` kini segmen
tersendiri; diuji dengan menjalankan fungsi aslinya — `konteks_engineer: 14.044` berdiri sendiri,
`memori_personal_klien` turun ke 333. Satu cacat ikut terjadi saat menulisnya: penanda sempat
dicari dengan `cari()` yang **sengaja mulai dari awal kontrak**, padahal blok Engineer ada
sebelumnya → selalu −1 dan segmennya diam-diam hilang, persis kebisuan yang hendak dihentikan
(mutasi M2 menjatuhkan 6 asersi). **Artinya:** biaya terbesar mode Engineer — ±14.000 huruf ≈
**3.600 token di SETIAP pesan** — tak pernah punya namanya sendiri di log. Ini memberi angka untuk
usul Owner yang tertunda: peta repo dibaca saat perlu lewat `git show`, bukan disuntikkan tiap pesan.

**2. ✅ TERPECAHKAN — "riwayat 16.557 huruf" BUKAN riwayat chat.** Saya sempat menduga itu dumping
JSON 402 lama yang tersimpan sebagai pesan, dan **menyarankan Owner mulai percakapan baru**.
**Salah, dan sarannya tak berpengaruh sama sekali.** Angkanya **identik di lima kali jalan**,
termasuk di percakapan yang berbeda — petunjuk yang sama dengan kasus 18.195.

Sebabnya: `ConversationEngine.jsx:1255` menyematkan `[catatanAkar, catatanPeta, ringkasanTemuan]`
sebagai **pesan riwayat ber-PATOK di setiap kiriman**. Jadi "2 pesan" itu **peta repo + akar
repo**, dikirim ulang tiap pesan. Percakapan baru tidak memangkas apa pun. Kalimat saran itu sudah
dicabut dari pesan galat — menyuruh Owner melakukan hal yang tak berpengaruh lebih buruk daripada
diam.

### Gambaran akhir: 62% prompt adalah pengetahuan repo yang dikirim ulang tiap pesan

Terukur 14:45 (sesudah `konteks_engineer` punya namanya sendiri), total **55.125 huruf**:

| Bagian | Huruf | Apa |
|---|---|---|
| **`konteks_engineer`** | **17.687** | prompt Engineer sisi SERVER |
| **sisipan (`riwayat`)** | **16.557** | peta repo + akar repo, disematkan KLIEN |
| `blok4_rag` | 7.011 | RAG |
| `dasar_identitas_panduan` | 6.030 | |
| sisanya | 7.840 | kontrak, brain, format, memori (508) |

Dua teratas = **34.244 huruf, 62%** — keduanya pengetahuan repo, lewat **dua jalur terpisah**
(satu server, satu klien), dan **keduanya dikirim ulang di setiap pesan**.

**Inilah angka untuk usul Owner yang tertunda:** peta repo dibaca **saat perlu** lewat `git show`
alih-alih disuntikkan tiap pesan. Sasaran yang terukur: ±16.557 huruf ≈ 4.300 token per pesan,
**30% prompt**, tanpa menyentuh konteks Engineer sisi server.

#### ✅ SUDAH DIKERJAKAN — angka di atas adalah keadaan 4 Okt, bukan keadaan sekarang

Sasaran itu dikerjakan dan dilampaui oleh item **120–122**. Tabel di atas sengaja **tidak diubah**:
ia catatan pengukuran pada tanggalnya, dan mengubahnya akan menghapus pembandingnya.

| | 4 Okt | **5 Okt (4.2.13)** | |
|---|---|---|---|
| sisipan (`riwayat`) | 16.557 | **2.687** | item 120, peta jadi indeks |
| `blok4_brain` | 1.980 | **767** | item 122, BRAIN 1 tak lagi kembar |
| `konteks_engineer` | 17.687 | 17.687 | **sengaja tak disentuh** — ini aturan, bukan data |
| **total** | **55.125** | **39.989** | **−27%** |

**Yang TIDAK tercapai, dan kenapa:** `konteks_engineer` tetap jadi bagian terbesar. Sesudah
diukur (item 122), **14.695 dari 17.687 huruf adalah ATURAN**, bukan data yang bisa diambil saat
perlu — narasi sejarah hanya 634 huruf (3,6%) dan duplikasi dengan kontrak universal **nol**.
Memangkasnya mengubah perilaku Engineer, jadi itu keputusan Owner.

**Dan sejak 5 Okt 02:23 ini bukan lagi jalan keluar:** saldo hanya menanggung 1.048 token
sedangkan blok yang tak bisa dibuang sama sekali sudah ≈3.100 token. Lihat
**⛔ BERHENTI MENUNGGU SALDO** di §5b.

### ✅ DITUTUP 5 Okt oleh item 124 — konstitusi dibaca tiap boot lalu DIBUANG

> **Catatan temuan ini DIPERTAHANKAN apa adanya di bawah**, karena ia memuat jejak bagaimana
> cacatnya ditemukan — dan satu cacat KEDUA yang hanya terlihat saat menutupnya: daftar 32 jalur
> itu ternyata sudah **melenceng** (`constitution/28_PROSEDUR_KERJA_ENGINEER.md` ada di disk,
> tidak di daftar), dan luput berbulan-bulan **justru karena isinya toh dibuang**.
>
> Yang berubah: foldernya kini **dipindai**, isinya tidak lagi dibaca-lalu-dibuang, dan indeksnya
> benar-benar sampai ke model. Biayanya **+577 token per pesan** — lihat item 124; itu
> **menambah**, bukan memangkas, dan Owner memutuskannya dengan sadar.
>
> **Belum terbukti live** — menunggu rilis 4.2.14.

#### (riwayat temuan, sebagaimana ditulis sebelum ditutup)

`_loadStaticKnowledge()` di `engineer.js` memuat **32 berkas**: `INIT.md`, `AGENTS.md`,
`constitution/00`–`27`, termasuk `24_ANTI_HALLUCINATION_PROTOCOL.md` (nomor barisnya sengaja tidak
ditulis — ia sudah bergeser sekali dan nomor baris di dokumen membusuk diam-diam; cari namanya).

**Diperiksa ulang 5 Okt 2026, masih berlaku.** Isinya disimpan di `brain.static.raw`, dan `raw`
punya **nol pemakai di seluruh repo**. Yang mengalir hanya jumlahnya:

```js
staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0   // TaskHandlers.js
```

Angka itu pun berhenti di `projectContext` → `brain.dynamic`, yang **hanya ditugaskan, tak pernah
dibaca** (`generatePatch` menerima `brain` tetapi tidak menyentuh `static` maupun `dynamic`).

**Hanya jumlahnya, dan jumlahnya pun tak sampai ke mana-mana.** Isinya tidak pernah sampai ke model. Blok "BRAIN 1 — STATIC" yang model
laporkan sebagai `[✓] ADR`/`[✓] Coding Rules` sebenarnya **8 baris** dari `project_memory_entries`
(ADRLink/Solution/Lesson/RootCause) — konstitusi tidak ada di dalamnya.

Jadi Engineer selama ini melaporkan "Coverage BRAIN 1 ✓" tanpa pernah membaca satu pun aturan yang
Owner tulis.

**Usul Owner (belum dikerjakan):** `AGENTS.md` jadi pintu masuk sungguhan, dan peta repo jadi berkas
yang dirujuk dari sana — dibaca **saat perlu** dengan `git show`, bukan disuntikkan tiap pesan.
Biayanya turun dari ±3.873 token/pesan jadi penunjuk ±50 token, dan sejak 4.2.5 membacanya nol klik.
**Ditunda** sampai pengaruh pelepasan kacamata kuda terukur sendirian.

**Separuh usul itu SUDAH dikerjakan** (item 120): peta repo kini indeks 2.687 huruf, dan Engineer
mengambil sisanya sendiri lewat `git grep`. Yang tersisa adalah bagian konstitusinya.

> ⚠️ **ARAH BIAYANYA BERLAWANAN, dan ini perlu disadari sebelum dikerjakan.** Peta repo bisa
> dipangkas karena ia **sudah dikirim**. Konstitusi **tidak dikirim sama sekali** — jadi "metode
> indeks" di sini **MENAMBAH** token, bukan memangkas. Nilainya besar (Engineer akhirnya membaca
> aturan yang Owner tulis, bukan melaporkan "Coverage BRAIN 1 ✓" tanpa dasar), tetapi ia bukan
> penghematan dan tidak boleh disamakan begitu saja dengan item 120.
>
> **Dan sejak 5 Okt 02:23 waktunya salah:** prompt sudah 10.430 token terhadap jatah saldo 1.048.
> Menambah muatan sekarang hanya memperbesar selisih yang sudah tak tercapai. **Kerjakan sesudah
> saldo terisi**, supaya pengaruhnya bisa diukur dan bukan sekadar menambah beban.
>
> ✅ **SUDAH DIKERJAKAN 5 Okt (item 124) — kalimat di atas jangan dibaca sebagai tugas yang
> menunggu.** Owner memutuskan lanjut setelah keberatan biaya disampaikan dua kali, dan itu
> keputusannya. Yang terjadi persis seperti diperingatkan: **+577 token per pesan**, menambah
> bukan memangkas. Yang ditukar: 43.942 token yang dibaca lalu dibuang tiap boot, dan Engineer
> yang mengaku punya cakupan yang tak pernah ia punya.
>
> **Pengaruhnya BELUM terukur live** — ia menunggu rilis 4.2.14, bukan menunggu keputusan.

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

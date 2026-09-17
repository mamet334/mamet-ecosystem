# Utang Lama RAG Dikumpulkan, Dokumen Diselaraskan, Kode Pencarian Lama yang Mati Dibersihkan

**Tanggal:** 17 September 2026
**Roadmap:** Item 90 ([`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](../../roadmap/ROADMAP-PENGAMBILAN-POTONGAN-RAG.md)) §3
**Status:** selesai lokal; build frontend lolos; menunggu push (Vercel). Server tidak berubah.

## Latar

Diskusi Owner sesudah Item 88–89: kenapa masalah RAG belum tuntas. Penelusuran INDEX menemukan sisa pekerjaan
yang tercatat tersebar di bullet "Dicatat, belum dikerjakan" (Item 65–81) tanpa daftar pusat, dan satu hasil
uji lama yang berlawanan dengan rencana baru. Owner: sesuaikan dokumen agar tidak bertentangan, hapus yang
tidak sesuai, periksa kode sebelum menghapus.

## Koreksi atas permintaan (disampaikan ke Owner sebelum bekerja)

- **Catatan sejarah INDEX & changelog tidak dihapus** — justru dari sana hasil uji Item 76 yang berlawanan
  ditemukan. Bagian yang tak berlaku diberi rujukan ke penggantinya; dokumen rencana aktif (Item 88–90) diperbaiki
  langsung.
- **Kode dihapus hanya bila pemanggilnya terbukti tidak ada**; data Owner di database tidak dihapus sistem.

## Utang lama → Item 90 §3 (U1–U10)

| # | Temuan (diperiksa hari ini) | Keputusan |
|---|---|---|
| U1 | Uji mutu RAG "cukup" (Item 81) diukur pada KATALOG-PENDAS (813 potongan) & Operator Handbook (827) — **keduanya sudah tidak ada di database** | set dibangun ulang (Tahap A) |
| U2 | Awalan judul per potongan **dibuang** di Item 76 (skor turun) vs **naik** di Item 89 — jenis pertanyaan berbeda, tak pernah didamaikan | Item 89 Tahap 2 ukur keduanya |
| U3 | 9 dokumen lama berpotongan 1.000–4.500 huruf (183 potongan) | **dihapus Owner**; diperiksa: tersisa HCDP DOCX (87) + UJI-Kepbup (18), potongan yatim 0 |
| U4 | Ambang 0,55 dekat dasar derau | diukur Tahap A |
| U5 | Uji mutu jalur PDF/OCR, OCR massal belum pernah | Tahap A memuat pertanyaan Kepbup |
| U6–U8 | Tanpa nomor urut potongan; pertanyaan ID ke dokumen EN; LITE & tanpa kunci belum terbukti | ditunda |
| U9 | Aturan kutipan persis hanya prompt | tidak dikerjakan (label dibekukan) |
| U10 | Prompt LOOKUP memuat dua instruksi label bertentangan (baru ditemukan) | ditunda |

## Kode mati dihapus (frontend)

| Dihapus | Bukti tak terpakai |
|---|---|
| Tier 1 `RetrievalOrchestrator.retrieve()` (dokumen lewat pencocokan kata di browser) | satu-satunya pemanggil `AssistantService.js:1000` selalu `skipLocalKnowledge: true` sejak Item 65 |
| Pendaftaran `KnowledgeService` & `RetrievalStrategyService` di `Kernel.js` (+ import) | tak ada `serviceManager.get/has` lain di web, Mametlite, `tools/` |
| `KnowledgeService.indexDocument()` | tanpa pemanggil di web, server, Mametlite; event `Knowledge:Indexed`, `Retrieval:Completed/Failed` tanpa pendengar |
| Bobot `case_a_full_read` / `case_a_neighbor_expansion` di `RetrievalStrategyService` | strategi itu tak lagi dihasilkan (`_handleCaseA` hanya `case_a_passthrough`) |

**Tidak dihapus:** berkas `KnowledgeService.js` & `RetrievalStrategyService.js` — diimpor server
(`agent-process` `context_builder.ts`) sebagai cadangan pencocokan kata bila vektor tak tersedia. Tier 2
(panduan tanpa dokumen, RAG mati) dan Tier 3 (web) tetap.

**Uji:** `vite build` frontend lolos — 3.304 → **3.302 modul** (kedua service tak lagi dibundel di browser);
bundel esbuild `agent-process` lolos (berkas bersama tetap utuh).

## Dokumen diselaraskan

- **Item 90:** bagian §3 Utang Lama (U1–U10) + daftar kode mati; Tahap A memakai dokumen yang ada; Tahap B
  memakai `DEFAULT_STOPWORDS` yang sudah ada di `KnowledgeService.js`; risiko baru: setiap hasil mencatat daftar
  dokumen & jumlah potongan saat diukur.
- **Item 89:** bukti lama Item 76 dicatat; Tahap 2 wajib mengukur pertanyaan yang kata kuncinya ada di potongan;
  regresi memakai set Item 90 (KATALOG-PENDAS lewat berkas lokal).
- **Item 88 & INDEX:** "tak terambil di mode LOOKUP" diganti penyebab terukur (Item 89).
- **INDEX Item 65/67/70/76/78/81 & changelog kontrak-label:** rujukan ke U-nomor Item 90.

## Batas yang disadari

- Pembersihan Tier 1 hanya terbukti lewat build & pencarian pemanggil; perilaku chat tak berubah karena cabang
  itu memang tak pernah jalan — tetap perlu dilihat sesudah push (log `[RetrievalOrchestrator] Initialized
  (Tier 2 & Tier 3; dokumen dicari server)`).
- Angka pengukuran Item 89 (288 potongan) tidak lagi mewakili akun sekarang (105 potongan) — baseline Tahap A
  diukur ulang.

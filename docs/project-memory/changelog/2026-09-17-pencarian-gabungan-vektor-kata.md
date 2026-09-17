# Pencarian Potongan Gabungan Vektor + Kata Kunci (Item 90 Tahap B)

**Tanggal:** 17 September 2026
**Roadmap:** Item 90 ([`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](../../roadmap/ROADMAP-PENGAMBILAN-POTONGAN-RAG.md)) Tahap B
**Status:** selesai & terbukti live — migrasi diterapkan, `agent-process` v455 (deploy Owner).

## Masalah

Angka acuan Tahap A ([changelog](./2026-09-17-uji-pengambilan-potongan-baseline.md)): recall@8 13/14. Q1
"Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?" (KEP-01) — tabel persyaratan di peringkat
#15, kalah oleh paragraf umum HCDP "pengembangan kompetensi"; hanya 8 diambil → dijawab dari pengetahuan umum.
`document_search.ts` sudah punya `hybrid_score`, tetapi hanya mengurutkan ulang 8 potongan yang **sudah**
terambil — potongan #15 tak pernah sampai ke sana.

## Pengukuran sebelum mengubah apa pun (SQL baca-saja + skrip konsol, $0 < 0,001)

Peringkat kata kunci (`ts_rank_cd`, 105 potongan Owner) digabung dengan peringkat vektor lengkap (skrip
`uji-pengambilan-v2.js`) memakai Reciprocal Rank Fusion.

| ID | Vektor | Kata kunci saja | Gabungan RRF k=60 |
|---|---|---|---|
| **KEP-01 pelatihan teknis** | **#15 ❌** | #1 | **#3 ✅** |
| KEP-05 indikator kinerja | #8 (batas) | #6 | #5 |
| KEP-03 / KEP-04 / KEP-06 | #3 / #2 / #4 | #3 / #6 / #4 | #2 / #2 / #3 |
| HCDP-06 / HCDP-07 / HCDP-08 | #2 / #3 / #1 | #1 / #4 / #4 | #1 / #1 / #2 |
| HCDP-01..05, KEP-02 | #1–#3 | #1–#2 | sama |

- **recall@8 13/14 → 14/14**; stabil pada k = 10/30/60/100 (hanya k=10 menaruh KEP-05 tepat di #8).
- Kata kunci saja lebih lemah dari vektor (kata umum "tahun"/"jabatan" cocok 54–87 dari 105 potongan) — yang
  dipakai gabungannya.
- **Tidak berubah:** pertanyaan NEG tetap membawa 8 potongan ke konteks (NEG-03 jadi lebih sedikit); potongan
  halaman 1 Kepbup tetap #1 untuk KEP-03/04/06 (Item 89).

### Kamus bahasa Indonesia — diukur, tidak dipakai

Pertanyaan Owner: bisakah kamus Indonesia dipakai agar lebih cocok? Ternyata PostgreSQL 17.6 **sudah membawa**
konfigurasi `indonesian` (catatan roadmap "tidak punya kamus" keliru, dikoreksi). Pemotong imbuhannya bekerja
("kepentingan"/"pentingnya" → `penting`, "pelatihan" → `latih`), tetapi kebablasan untuk teks ini: "berapa" →
`apa`, "pengalaman" → `alam`, "jabatan" → `jabat` (cocok hampir semua potongan), "kepegawaian" → `gawa` ≠
"pegawai" → `gawai`; kata umum Indonesia juga tidak dibuang bawaan.

| | Kata persis (`simple`) | Kamus `indonesian` (kata umum dibuang dulu) |
|---|---|---|
| recall@8, k=60 | 14/14 | 14/14 |
| Turun peringkat | — | KEP-04 #2→#3, KEP-05 #5→#6, HCDP-04 (kata kunci #2→#4), KEP-03 (kata kunci #3→#5) |
| k=10 | 14/14 | **13/14** (KEP-05 #10) |

Keputusan (Owner setuju): **`simple`**. Kamus = opsi terukur, diukur ulang bila set uji memuat pertanyaan
berbentuk kata berbeda dari dokumen yang gagal.

## Perubahan

| Berkas | Isi |
|---|---|
| `supabase/migrations/20260917073305_match_documents_hybrid.sql` | kolom `document_chunks.fts` (`to_tsvector('simple', content)`, dihitung Postgres) + indeks GIN; RPC `match_documents_hybrid(query_embedding, query_words, match_threshold, match_count, p_user_id, p_space_id, rrf_k=60)` — penyaringan pengguna/space/arsip sama dengan `match_documents`, ambang diterapkan sesudah penggabungan, kata dibersihkan ke a-z0-9 (bukan sintaks tsquery mentah), mengembalikan `rank_vektor`/`rank_kata`/`skor_rrf`; hak hanya `authenticated` & `service_role` (anon tidak — beda dengan T4) |
| `supabase/functions/agent-process/lib/rag/document_search.ts` | memanggil RPC gabungan (kata kunci maks 30 — `finalMessage` bisa memuat lampiran); gagal → `match_documents` + peringatan log; log `[RAG] Pencarian gabungan vektor+kata: …` |
| `frontend/src/core/runtime/services/KnowledgeService.js` | ekspor `kataKunciPencarian(teks)` — satu aturan untuk server & skrip uji (huruf kecil, pecah selain a-z0-9, panjang > 2, `DEFAULT_STOPWORDS`) |

`match_documents` lama tidak diubah (cadangan). Semua `insert`/`select` ke `document_chunks` memakai kolom
eksplisit — diperiksa sebelum kolom ditambah.

## Bukti

- **Database sesudah migrasi:** `fts` terisi 254/254; `anon` tidak boleh execute, `authenticated` boleh; versi
  remote `20260917073305`.
- **Skrip `uji-pengambilan-v3.js` `{ rpc: 'hybrid' }` (07:35 UTC):** recall@8 **14/14**, setiap peringkat bukti
  sama dengan hitungan luring (KEP-01 #3, KEP-05 #5, HCDP-08 #2); kontrol skor 0,724609 = lokal.
- **Bundel esbuild `agent-process`** lolos dan memuat RPC baru.
- **Live v455 (07:39 UTC), mode LOOKUP:** log edge function `[RAG] Pencarian gabungan vektor+kata: 8 potongan, 6
  kata kunci [tingkat, kepentingan, pelatihan, teknis, sekretaris, dprd]`; jawaban **"Penting"**
  `[STATUS: VERIFIED]` sumber `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` — sesuai PDF asli hal. 6. Sebelumnya (v454)
  pengetahuan umum/HYPOTHESIS.

## Batas yang disadari

- Jawaban Q1 benar tetapi tidak menyebut ketiga pelatihan teknis (gaya model LOOKUP, bukan pengambilan).
- Q2 dan pertanyaan HCDP belum diulang lewat chat di v455 (skrip: bukti tetap #1–#3).
- Jalur LITE memakai server yang sama, belum dibuktikan live (U8).
- Set uji kecil (17 pertanyaan, 2 dokumen).

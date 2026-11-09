# 9 November 2026 — Item 131 Tahap A (bagian 1): RAG yang sudah ketemu tidak dibuang lagi

Perintah Owner 9 Nov: *"mulai tahap A"*; migrasi atas izin Owner (*"jalankan migrasinya"*, lalu "Terapkan sekarang" untuk
vektor dalam baris). Tahap A **belum selesai**: hasil tidak lagi dibuang, tetapi di pemakaian nyata pencarian masih bisa
melewati batas query 8 s — lihat "Belum selesai".

## Temuan: lambatnya bukan di tempat yang diduga roadmap

Roadmap menduga RAG lambat karena tanpa indeks vektor. Diukur (`EXPLAIN ANALYZE`, korpus 12.445 potongan, 12.296 milik
satu akun): `match_documents_hybrid` memberi peringkat kata (`ts_rank_cd`) ke **semua** potongan akun — termasuk yang
tak memuat satu pun kata kunci — sambil membawa isi teksnya; ±6,8–7,1 s, dengan tumpahan ke disk sementara.
Peringkat kata hanya untuk yang cocok: 20–250 ms.

## Yang diubah

1. **Migrasi `20261109042317_rag_hybrid_peringkat_kata_hanya_yang_cocok`** — isi `match_documents_hybrid` diganti
   (nama, parameter, kolom hasil, hak eksekusi tetap): jarak vektor dihitung untuk semua kandidat tanpa membawa isi,
   `ts_rank_cd` hanya untuk potongan yang cocok, peringkat kata untuk yang tak cocok = jumlah yang cocok + 1 (sama dengan
   `rank()` lama atas skor 0), isi teks diambil hanya untuk 8 pemenang. **Hasil identik dengan fungsi lama pada 20 kasus,
   semua kolom** (id, dokumen, judul, hash isi, space, similarity, kedua peringkat, skor RRF) — termasuk pertanyaan
   skenario Tahap 0, tanpa kata, kata `null`, per space, ambang 0,80, `match_count` 2, akun kecil. Pembanding terbukti bisa
   melihat beda: susunan top-K terpisah yang dicoba lebih dulu (pola standar) memberi irisan 1–5 dari 8 dan **ditolak** —
   ia membuang peringkat vektor global yang dipakai fungsi lama (Item 90, recall@8 14/14).
2. **Migrasi `20261109063313_vektor_dalam_baris`** — `embedding` disimpan di baris (`storage main`,
   `toast_tuple_target = 8160`, `cluster`): TOAST 53 MB → 200 kB, heap 15 → 97 MB, DB 121 → 148 MB. Data utuh (12.445
   baris, semua bervektor; jumlah jarak ke vektor patokan tetap 4370,6). Di salinan uji jarak vektor 461 vs 4.486 ms.
3. **`context_builder.ts`**: batas 5 s + `Promise.race` yang membuang hasil RAG dicabut; hasil ditunggu, galat dicatat
   (`catatRagGagal`, `msSelesai`). Pengaman yang tersisa adalah batas query database 8 s dan batas dinding 150 s.
4. **Indeks HNSW tidak dibuat** (keputusan teknis, alasan terukur): bukan biang lambat saat itu, hasilnya perkiraan
   (mengubah hasil yang tervalidasi), memakan kuota.

## Bukti

- Uji `uji-jejak-prompt` 66/66 (+ penjaga Tahap A: tak ada `Promise.race`/`setTimeout`/tenggat di jalur RAG, hasil
  ditunggu, galat dicatat); mutasi "batas waktu kembali" & "galat tak dicatat" MATI; suite penuh 160/160; bundel bersih.
- **Deploy oleh Owner:** `agent-process` v551 → **v552**, ACTIVE, `verify_jwt: false`; paket 107 berkas = 101 identik,
  0 berbeda; tak ada `Promise.race` di `context_builder` paket.
- **Skenario Tahap 0 ulang (16 giliran, 04:29–04:37 UTC):** `rag_habis_waktu` 14 → **0**, `rag_ketemu_dibuang` 11 → **0**;
  15/16 giliran mengirim 8 potongan ke model (1 dibatasi kebijakan → 2). Merah lain (riwayat, catatan palsu, kebijakan)
  tetap — itu Tahap C/D/H.

## Belum selesai (sisa Tahap A)

- Di pemakaian nyata pencarian masih 4,6–17 s: skenario 16 giliran 4× kena batas 8 s (3× diselamatkan cadangan vektor,
  1× gagal); skenario 5 pertanyaan sesudah migrasi kedua (06:41–06:44 UTC) **5/5 hybrid kena batas, 2 gagal total**.
- Pekerjaan yang sama berayun hingga 100×: 12 ribu jarak 10–15 ms di satu saat, 1,4–3,2 s beberapa menit kemudian;
  fungsi hybrid saat sepi 0,1–0,9 s lalu 8,7 s. Bukan JIT (mati), bukan kompresi (tak terkompresi), bukan panel Monitor
  (selisih `pg_stat_statements` selama 5 pertanyaan: hybrid +24,2 s, Realtime WAL +7,9 s, graf Home +7,7 s, Monitor 0).
- **Dugaan, belum terbukti:** komputasi paket gratis membatasi CPU/IO setelah dipakai berat (puluhan kueri uji + tulis
  ulang tabel 97 MB tepat sebelum skenario). Bukti hanya ada di grafik dashboard Supabase (CPU, Disk IO budget).
- Langkah berikutnya: Owner memeriksa grafik; ukur ulang sesudah database istirahat; bila tetap lambat → HNSW dengan
  recall@8 diukur terhadap hasil tepat sebelum minta izin migrasi.

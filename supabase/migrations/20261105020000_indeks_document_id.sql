-- K1 langkah 2 (5 Nov 2026): indeks kunci asing document_chunks.document_id.
--
-- Uji live kunci unggah (14:58 UTC): unggahan ulang + pemuatan Home serentak → `HEAD document_chunks?document_id=eq.…`
-- (hitungan potongan rag-process) 500, dan Postgres mencatat 3× "canceling statement due to statement timeout".
-- Tabel ±16.900 potongan + vektor, dan TIDAK ada indeks pada document_id (hanya id, fts, source_type) — setiap
-- hitungan per dokumen, hapus dokumen (ON DELETE CASCADE), dan gabungan pencarian (dc.document_id = d.id) memindai
-- seluruh tabel. Indeks kunci asing = praktik standar Postgres (Supabase: "index foreign key columns").
-- Pembuatan mengunci tulis sebentar (±17 ribu baris: detik) — jalankan saat tak ada unggahan.

create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);

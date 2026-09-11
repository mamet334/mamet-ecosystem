-- Migration: 20260911163456_embedding_768.sql (versi sesuai riwayat migrasi remote)
-- Item 70 (2026-09-11): vektor embedding 3072 -> 768 dimensi.
--
-- google/gemini-embedding-2 adalah model "Matryoshka": angka-angka awal vektornya sudah memuat
-- makna utama. Diukur sebelum memutuskan (ebook "Operator Handbook", 6 pertanyaan ID/EN, 4
-- potongan pengecoh): peringkat potongan berisi jawaban SAMA PERSIS pada 3072/1536/768.
-- OpenRouter `dimensions: 768` identik dengan memotong sendiri (kemiripan 1,0000), jadi vektor
-- yang sudah tersimpan cukup DIPOTONG di sini — tanpa memvektorkan ulang, tanpa biaya.
-- Ambang memori 0,70 diperiksa pada pasangan kalibrasinya: urutan sama, skor naik ±0,01
-- ("suka teh" 0,7263 -> 0,7327 tetap lolos; "suka jalan pagi" 0,6599 -> 0,6735 tetap tidak).
--
-- Tujuan: seperempat ruang per vektor (±3 KB, bukan ±12 KB) — syarat untuk potongan 800 huruf
-- (ebook 436 halaman ±920 potongan: ±3,7 MB, bukan ±12 MB). 768 juga di bawah batas indeks
-- pgvector (2.000), meski indeks sengaja BELUM dibuat: pencarian difilter per pengguna, dan
-- indeks HNSW menyaring SESUDAH mengambil kandidat — bisa mengembalikan kurang dari yang diminta.
--
-- TIDAK BISA DIBALIK tanpa memvektorkan ulang: angka ke-769..3072 dibuang. Kode agent-process
-- dan rag-process (EMBED_DIMENSI = 768, commit Item 70) harus ter-deploy bersamaan; di antara
-- keduanya, pencarian dan penyimpanan vektor gagal karena dimensi berbeda.

begin;

-- View ini memilih kolom embedding; Postgres menolak ALTER TYPE selama view bergantung padanya.
drop view if exists public.active_user_memories;

alter table public.document_chunks
  alter column embedding type vector(768) using subvector(embedding, 1, 768)::vector(768);

alter table public.user_memories
  alter column embedding type vector(768) using subvector(embedding, 1, 768)::vector(768);

-- Dibuat ulang persis seperti sebelumnya (definisi & opsi dibaca dari database 2026-09-11).
create view public.active_user_memories with (security_invoker = on) as
  select id, user_id, summary, embedding, created_at, last_used_at, memory_hits,
         normalized_memory_hash, message_hash, memory_type, confidence, source, metadata, memory_state
  from public.user_memories;

-- Hak akses sama dengan sebelumnya (security_invoker: RLS user_memories tetap berlaku).
grant all on public.active_user_memories to anon, authenticated, service_role;

commit;

-- Migration: 20260910003000_user_memories_embedding_3072.sql
-- Item 46: samakan dimensi embedding memori dengan pipeline yang sebenarnya.
--
-- `user_memories.embedding` bertipe vector(768), sisa era model embedding lama,
-- sedangkan pipeline menghasilkan 3072 (sama seperti document_chunks). Dibuktikan
-- di database: `vector(768) <=> vector(3072)` -> ERROR 22000 different vector
-- dimensions. Jadi pencarian memori semantik memang mustahil, bukan sekadar kosong.
--
-- Indeksnya wajib dibuang lebih dulu: ivfflat (dan hnsw) di pgvector dibatasi 2000
-- dimensi, sehingga 3072 tidak bisa diindeks sama sekali. Ini bukan penurunan mutu
-- yang tersembunyi -- `document_chunks` sudah vector(3072) tanpa indeks apa pun, jadi
-- pemindaian berurutan memang pola yang sudah dipakai proyek ini. Kalau kelak jumlah
-- memori menembus puluhan ribu per user, pilihannya turunkan dimensi ke <=2000 lalu
-- indeks ulang.
--
-- View active_user_memories ikut dibongkar-pasang karena bergantung pada kolom ini.
-- Definisi, opsi security_invoker, dan hak aksesnya dipulihkan persis seperti semula
-- (diverifikasi lewat pg_get_viewdef, pg_class.reloptions, dan pg_class.relacl).
--
-- Aman: seluruh 7 baris embedding-nya NULL, jadi tidak ada data yang dikonversi.
--
-- URUTAN PENERAPAN PENTING: migrasi ini harus mendarat SEBELUM kode yang menulis
-- embedding 3072 di-deploy. Kalau dibalik, setiap insert memori akan ditolak Postgres
-- karena dimensinya tidak cocok, dan memori justru gagal tersimpan sama sekali.

BEGIN;

DROP VIEW IF EXISTS public.active_user_memories;

DROP INDEX IF EXISTS public.user_memories_embedding_idx;

ALTER TABLE public.user_memories
  ALTER COLUMN embedding TYPE vector(3072);

CREATE VIEW public.active_user_memories
WITH (security_invoker = on) AS
SELECT id,
       user_id,
       summary,
       embedding,
       created_at,
       last_used_at,
       memory_hits,
       normalized_memory_hash,
       message_hash,
       memory_type,
       confidence,
       source,
       metadata,
       memory_state
FROM public.user_memories;

GRANT ALL ON public.active_user_memories TO anon, authenticated, service_role;

COMMIT;

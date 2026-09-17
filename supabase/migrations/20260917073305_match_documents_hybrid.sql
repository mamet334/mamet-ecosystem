-- Migration: 20260917073305_match_documents_hybrid.sql (versi sesuai riwayat migrasi remote)
-- Item 90 Tahap B (2026-09-17): pencarian potongan dokumen = peringkat VEKTOR + peringkat KATA KUNCI,
-- digabung Reciprocal Rank Fusion (RRF).
--
-- Diukur sebelum dibuat (set uji Item 90 Tahap A, 17 pertanyaan, akun Owner 2 dokumen / 105 potongan):
--   vektor saja   recall@8 13/14 — "tingkat kepentingan pelatihan teknis Sekretaris DPRD" bukti di #15.
--   gabungan RRF  recall@8 14/14 — bukti itu #3; tak ada pertanyaan keluar dari 8 teratas; stabil pada
--                 k = 10/30/60/100 (hanya k=10 menaruh satu bukti tepat di #8).
-- Konfigurasi 'simple' (kata persis), BUKAN 'indonesian': kamus Indonesia bawaan PostgreSQL 17 diukur
-- juga — sama 14/14 pada k=60 tetapi dua bukti turun peringkat dan gagal pada k=10 (pemotong imbuhan
-- kebablasan: "berapa"->apa, "pengalaman"->alam, "jabatan"->jabat cocok hampir semua potongan).
-- Rincian: docs/project-memory/changelog (Item 90 Tahap B).
--
-- Yang TIDAK berubah: ambang kemiripan & batas jumlah potongan tetap dari pemanggil (0,55 / 8);
-- penyaringan per pengguna, space, dan space terarsip sama dengan match_documents. match_documents
-- lama TIDAK dihapus — dipakai sebagai cadangan sampai hybrid terbukti live.
--
-- Kata kunci dikirim pemanggil sebagai larik (sudah huruf kecil, kata umum dibuang); fungsi hanya
-- menyisakan huruf/angka a-z0-9 dari tiap kata — tidak ada teks pengguna yang disusun jadi sintaks
-- tsquery mentah. Larik kosong = peringkat kata seri untuk semua potongan (urutan = vektor).


-- Kolom kata kunci dihitung Postgres dari content (tidak perlu diisi kode unggah; rag-process &
-- knowledge_manager meng-insert kolom eksplisit). 254 baris saat ini — penulisan ulang tabel ringan.
alter table public.document_chunks
  add column if not exists fts tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists idx_document_chunks_fts
  on public.document_chunks using gin (fts);

create or replace function public.match_documents_hybrid(
  query_embedding vector,
  query_words text[],
  match_threshold double precision,
  match_count integer,
  p_user_id uuid,
  p_space_id uuid default null,
  rrf_k integer default 60
)
returns table(
  id uuid, document_id uuid, title text, content text, space_name text,
  similarity double precision, rank_vektor bigint, rank_kata bigint, skor_rrf double precision
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with kata as (
    select nullif(array_to_string(array(
      select distinct w from (
        select regexp_replace(lower(x), '[^a-z0-9]', '', 'g') as w from unnest(coalesce(query_words, '{}')) x
      ) s where w <> ''
    ), ' | '), '') as q
  ),
  kandidat as (
    select dc.id, dc.document_id, d.title, dc.content, ks.name as space_name,
           dc.embedding <=> query_embedding as jarak, dc.fts
    from document_chunks dc
    join documents d on dc.document_id = d.id
    join knowledge_spaces ks on d.space_id = ks.id
    where d.user_id = p_user_id
      and ks.archived = false
      and (p_space_id is null or d.space_id = p_space_id)
  ),
  peringkat as (
    select k.*,
           1 - k.jarak as similarity,
           rank() over (order by k.jarak) as rank_vektor,
           rank() over (order by coalesce(ts_rank_cd(k.fts, to_tsquery('simple', kata.q)), 0) desc) as rank_kata
    from kandidat k cross join kata
  )
  select p.id, p.document_id, p.title, p.content, p.space_name, p.similarity, p.rank_vektor, p.rank_kata,
         1.0 / (rrf_k + p.rank_vektor) + 1.0 / (rrf_k + p.rank_kata) as skor_rrf
  from peringkat p
  where p.similarity > match_threshold
  order by skor_rrf desc, p.rank_vektor
  limit match_count;
$$;

-- Hanya pengguna login & server. anon tidak diberi hak (lihat temuan T4 untuk match_documents lama).
revoke all on function public.match_documents_hybrid(vector, text[], double precision, integer, uuid, uuid, integer) from public, anon;
grant execute on function public.match_documents_hybrid(vector, text[], double precision, integer, uuid, uuid, integer) to authenticated, service_role;


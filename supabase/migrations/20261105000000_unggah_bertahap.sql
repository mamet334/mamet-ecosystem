-- K1 langkah 2 (5 Nov 2026): unggah dokumen besar bertahap — satu berkas mentah = satu dokumen, potongan yang sudah
-- divektorkan tersimpan sebagai cache, dilanjutkan dengan memilih berkas yang sama (keputusan Owner).
--
-- `selesai`        false selama potongan masih masuk. Dokumen belum selesai TIDAK ikut pencarian chat — jawaban dari
--                  buku setengah jadi menyesatkan. Baris lama otomatis true (default), jadi perilaku hari ini tetap.
-- `sidik`          SHA-256 teks yang diterima rag-process (dihitung server, bukan dipercaya dari klien). Unggahan
--                  lanjutan hanya diterima bila sidiknya sama — potongan ke-N hanya berarti untuk teks yang sama.
-- `total_potongan` jumlah potongan teks itu. Bila aturan pemotongan berubah di antara dua unggahan, angkanya beda
--                  dan unggahan lanjutan ditolak dengan pesan jelas, bukan menyambung potongan yang tak berurutan.
--
-- Fungsi pencarian diganti dengan isi yang SAMA ditambah `and d.selesai`. CREATE OR REPLACE dengan tanda tangan sama
-- mempertahankan hak eksekusi (K5: hanya service_role, migrasi 20261030000000).

alter table public.documents
  add column if not exists selesai boolean not null default true,
  add column if not exists sidik text,
  add column if not exists total_potongan integer;

-- rag-process mencari unggahan tertunda per akun + judul.
create index if not exists documents_belum_selesai_idx
  on public.documents (user_id, title) where not selesai;

create or replace function public.match_documents(query_embedding vector, match_threshold double precision, match_count integer, p_user_id uuid, p_space_id uuid default null::uuid)
 returns table(id uuid, document_id uuid, title text, content text, space_name text, similarity double precision)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select
    dc.id,
    dc.document_id,
    d.title,
    dc.content,
    ks.name as space_name,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on dc.document_id = d.id
  join knowledge_spaces ks on d.space_id = ks.id
  where d.user_id = p_user_id
    and d.selesai
    and ks.archived = false
    and (p_space_id is null or d.space_id = p_space_id)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$function$;

create or replace function public.match_documents_hybrid(query_embedding vector, query_words text[], match_threshold double precision, match_count integer, p_user_id uuid, p_space_id uuid default null::uuid, rrf_k integer default 60)
 returns table(id uuid, document_id uuid, title text, content text, space_name text, similarity double precision, rank_vektor bigint, rank_kata bigint, skor_rrf double precision)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
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
      and d.selesai
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
$function$;

create or replace function public.match_documents_judul(query_words text[], match_count integer, p_user_id uuid, p_space_id uuid default null::uuid)
 returns table(id uuid, document_id uuid, title text, content text, space_name text, urutan bigint)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  with kata as (
    select array(
      select distinct w from (
        select regexp_replace(lower(x), '[^a-z0-9]', '', 'g') as w from unnest(coalesce(query_words, '{}')) x
      ) s where w <> ''
    ) as arr
  ),
  dokumen as (
    select d.id,
           (select count(*) from unnest(kata.arr) w
             where d.fts_judul @@ to_tsquery('simple', w)) as cocok
    from documents d
    join knowledge_spaces ks on d.space_id = ks.id
    cross join kata
    where d.user_id = p_user_id
      and d.selesai
      and ks.archived = false
      and (p_space_id is null or d.space_id = p_space_id)
      and array_length(kata.arr, 1) >= 2
  ),
  terpilih as (
    select id, cocok from dokumen where cocok >= 2
  )
  select dc.id, dc.document_id, d.title, dc.content, ks.name as space_name,
         row_number() over (partition by dc.document_id order by dc.id) as urutan
  from document_chunks dc
  join terpilih t on t.id = dc.document_id
  join documents d on d.id = dc.document_id
  join knowledge_spaces ks on d.space_id = ks.id
  order by t.cocok desc, dc.document_id, dc.id
  limit match_count;
$function$;

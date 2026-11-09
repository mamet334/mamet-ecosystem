create or replace function public.match_documents_hybrid(
  query_embedding vector,
  query_words text[],
  match_threshold double precision,
  match_count integer,
  p_user_id uuid,
  p_space_id uuid default null,
  rrf_k integer default 60
)
returns table(id uuid, document_id uuid, title text, content text, space_name text, similarity double precision, rank_vektor bigint, rank_kata bigint, skor_rrf double precision)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with kata as (
    select to_tsquery('simple', nullif(array_to_string(array(
      select distinct w from (
        select regexp_replace(lower(x), '[^a-z0-9]', '', 'g') as w from unnest(coalesce(query_words, '{}')) x
      ) s where w <> ''
    ), ' | '), '')) as q
  ),
  akun as (
    select d.id, d.title, ks.name as space_name
    from documents d
    join knowledge_spaces ks on d.space_id = ks.id
    where d.user_id = p_user_id
      and d.selesai
      and ks.archived = false
      and (p_space_id is null or d.space_id = p_space_id)
  ),
  kandidat as (
    select dc.id, dc.document_id, dc.embedding <=> query_embedding as jarak
    from document_chunks dc
    where dc.document_id in (select id from akun)
  ),
  skor_kata as (
    select dc.id, ts_rank_cd(dc.fts, kata.q) as skor
    from document_chunks dc, kata
    where kata.q is not null
      and dc.fts @@ kata.q
      and dc.document_id in (select id from akun)
  ),
  positif as (
    select count(*) filter (where skor > 0) as n from skor_kata
  ),
  peringkat_kata as (
    select s.id, rank() over (order by s.skor desc) as peringkat
    from skor_kata s
    where s.skor > 0
  ),
  peringkat as (
    select k.id, k.document_id, k.jarak,
           rank() over (order by k.jarak) as rank_vektor,
           case when (select q from kata) is null then 1
                else coalesce(pk.peringkat, (select n from positif) + 1) end as rank_kata
    from kandidat k
    left join peringkat_kata pk on pk.id = k.id
  ),
  terpilih as (
    select p.*, 1.0 / (rrf_k + p.rank_vektor) + 1.0 / (rrf_k + p.rank_kata) as skor_rrf
    from peringkat p
    where 1 - p.jarak > match_threshold
    order by skor_rrf desc, p.rank_vektor
    limit match_count
  )
  select t.id, t.document_id, a.title, dc.content, a.space_name,
         1 - t.jarak as similarity, t.rank_vektor, t.rank_kata, t.skor_rrf
  from terpilih t
  join document_chunks dc on dc.id = t.id
  join akun a on a.id = t.document_id
  order by t.skor_rrf desc, t.rank_vektor;
$function$;

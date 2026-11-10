select '[1,1]'::vector <=> '[1,1]'::vector;

drop function if exists public.match_documents_hybrid_biner(vector, text[], double precision, integer, uuid, uuid, integer, integer);

create function public.match_documents_hybrid_biner(
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
set hnsw.ef_search to 400
set hnsw.iterative_scan to 'relaxed_order'
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
  kandidat_bit as materialized (
    select dc.id, dc.document_id
    from document_chunks dc
    where exists (
      select 1 from documents d
      join knowledge_spaces ks on d.space_id = ks.id
      where d.id = dc.document_id
        and d.user_id = p_user_id
        and d.selesai
        and ks.archived = false
        and (p_space_id is null or d.space_id = p_space_id)
    )
    order by dc.embedding_bit <~> binary_quantize(query_embedding)::bit(768)
    limit 200
  ),
  skor_kata as (
    select dc.id, dc.document_id, ts_rank_cd(dc.fts, kata.q) as skor
    from document_chunks dc, kata
    where kata.q is not null
      and dc.fts @@ kata.q
      and dc.document_id in (select id from akun)
  ),
  positif as (
    select count(*) filter (where skor > 0) as n from skor_kata
  ),
  peringkat_kata as (
    select s.id, s.document_id, rank() over (order by s.skor desc) as peringkat
    from skor_kata s
    where s.skor > 0
  ),
  pilih as (
    select k.id, k.document_id, true as di_atas from kandidat_bit k
    union all
    select pk.id, pk.document_id, false from peringkat_kata pk
    where pk.peringkat <= 200 and pk.id not in (select id from kandidat_bit)
  ),
  tepat as (
    select p.id, p.document_id, p.di_atas, dc.embedding <=> query_embedding as jarak
    from pilih p
    join document_chunks dc on dc.id = p.id
  ),
  peringkat as (
    select t.id, t.document_id, t.jarak,
           case when t.di_atas then rank() over (partition by t.di_atas order by t.jarak) else 201 end as rank_vektor,
           case when (select q from kata) is null then 1
                else coalesce(pk.peringkat, (select n from positif) + 1) end as rank_kata
    from tepat t
    left join peringkat_kata pk on pk.id = t.id
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

revoke execute on function public.match_documents_hybrid_biner(vector, text[], double precision, integer, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.match_documents_hybrid_biner(vector, text[], double precision, integer, uuid, uuid, integer) to service_role;

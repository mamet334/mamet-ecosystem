alter table public.document_chunks add column if not exists urutan integer;

create index if not exists document_chunks_dokumen_urutan on public.document_chunks (document_id, urutan);

drop function if exists public.simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text);

create function public.simpan_kelompok_perbarui(
  p_dok_baru uuid,
  p_dok_lama uuid,
  p_isi text[],
  p_vektor text[],
  p_source_url text default null,
  p_source_type text default null,
  p_mulai integer default null
)
returns integer
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  n integer;
begin
  if coalesce(array_length(p_isi, 1), 0) <> coalesce(array_length(p_vektor, 1), 0) then
    raise exception 'jumlah isi (%) dan vektor (%) berbeda', array_length(p_isi, 1), array_length(p_vektor, 1);
  end if;
  if not exists (
    select 1 from documents b join documents l on l.user_id = b.user_id
    where b.id = p_dok_baru and l.id = p_dok_lama
  ) then
    raise exception 'versi lama bukan milik pemilik versi baru';
  end if;
  select count(*) into n
  from unnest(p_isi, p_vektor) as t(isi, vek)
  where t.vek is null and not exists (
    select 1 from document_chunks c where c.document_id = p_dok_lama and c.content = t.isi and c.embedding is not null
  );
  if n > 0 then
    raise exception '% potongan salinan tak ditemukan di versi lama', n;
  end if;
  insert into document_chunks (document_id, content, embedding, source_url, source_type, urutan)
  select p_dok_baru, t.isi,
         coalesce(t.vek::vector, (select c.embedding from document_chunks c
                                  where c.document_id = p_dok_lama and c.content = t.isi and c.embedding is not null
                                  limit 1)),
         p_source_url, p_source_type,
         case when p_mulai is null then null else p_mulai + t.urutan::integer - 1 end
  from unnest(p_isi, p_vektor) with ordinality as t(isi, vek, urutan)
  order by t.urutan;
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke execute on function public.simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text, integer) from public, anon, authenticated;
grant execute on function public.simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text, integer) to service_role;

create function public.cari_potongan_dokumen(
  query_embedding vector,
  p_user_id uuid,
  p_document_id uuid,
  match_count integer
)
returns table(id uuid, document_id uuid, title text, content text, urutan integer, similarity double precision)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select dc.id, dc.document_id, d.title, dc.content, dc.urutan,
         1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on dc.document_id = d.id
  join knowledge_spaces ks on d.space_id = ks.id
  where d.id = p_document_id
    and d.user_id = p_user_id
    and d.selesai
    and ks.archived = false
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$function$;

revoke execute on function public.cari_potongan_dokumen(vector, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.cari_potongan_dokumen(vector, uuid, uuid, integer) to service_role;

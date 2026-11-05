-- PERBARUI DOKUMEN (5 Nov 2026, permintaan Owner: "dokumen yang namanya sama tapi isinya berbeda").
--
-- rag-process membangun versi baru di samping versi lama (selama itu versi lama tetap dipakai chat), lalu menghapus
-- versi lama sesudah versi baru selesai. Potongan yang isinya SAMA PERSIS dengan potongan versi lama menyalin
-- vektornya di dalam database — tidak dikirim ke OpenRouter, tidak dibayar ulang, vektor tak pernah keluar database.
--
-- `documents.menggantikan`  versi lama yang diganti; dibaca lagi saat unggahan versi baru dilanjutkan sesudah putus.
-- `potongan_lama_ada`       urutan (1-based) isi kelompok yang punya potongan bervektor di versi lama.
-- `simpan_kelompok_perbarui` SATU perintah menyimpan satu kelompok: vektor baru (teks pgvector) atau, bila null, vektor
--                           salinan dari versi lama. Atomik: bila satu salinan tak ditemukan (versi lama berubah di
--                           tengah jalan), seluruh kelompok ditolak — unggah bertahap menghitung titik lanjut dari
--                           JUMLAH potongan, jadi kelompok setengah tersimpan akan menggeser semua potongan sesudahnya.
-- Keduanya hanya untuk service_role (K5) dan memeriksa bahwa versi lama & baru milik pengguna yang sama.

alter table public.documents
  add column if not exists menggantikan uuid references public.documents(id) on delete set null;

create or replace function public.potongan_lama_ada(p_dok_baru uuid, p_dok_lama uuid, p_isi text[])
 returns setof integer
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select t.urutan::integer
  from unnest(p_isi) with ordinality as t(isi, urutan)
  where exists (
    select 1 from documents b join documents l on l.user_id = b.user_id
    where b.id = p_dok_baru and l.id = p_dok_lama
  )
  and exists (
    select 1 from document_chunks c
    where c.document_id = p_dok_lama and c.content = t.isi and c.embedding is not null
  )
  order by t.urutan;
$function$;

create or replace function public.simpan_kelompok_perbarui(
  p_dok_baru uuid, p_dok_lama uuid, p_isi text[], p_vektor text[], p_source_url text default null, p_source_type text default null
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
  insert into document_chunks (document_id, content, embedding, source_url, source_type)
  select p_dok_baru, t.isi,
         coalesce(t.vek::vector, (select c.embedding from document_chunks c
                                  where c.document_id = p_dok_lama and c.content = t.isi and c.embedding is not null
                                  limit 1)),
         p_source_url, p_source_type
  from unnest(p_isi, p_vektor) with ordinality as t(isi, vek, urutan)
  order by t.urutan;
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke execute on function public.potongan_lama_ada(uuid, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text) from public, anon, authenticated;
grant execute on function public.potongan_lama_ada(uuid, uuid, text[]) to service_role;
grant execute on function public.simpan_kelompok_perbarui(uuid, uuid, text[], text[], text, text) to service_role;

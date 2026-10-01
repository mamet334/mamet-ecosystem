-- CARI LEWAT JUDUL: syarat "semua kata" diganti "minimal dua kata" (2026-10-01)
--
-- ── Cacat yang hanya ketahuan dari uji live ─────────────────────────────────────────────────
--
-- Versi pertama (`20261001000100`) mensyaratkan SEMUA kata kueri ada di judul (`&`). Itu lolos
-- pembuktian SQL — tetapi pembuktiannya memakai `['kepbup','204']`, **kasus bersih yang dipilih
-- sendiri oleh yang menguji**.
--
-- Pertanyaan sungguhan Owner: *"apa isi Kepbup 204"* → kata kunci `[isi, kepbup, 204]`. Judulnya
-- "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf" tidak memuat kata **"isi"**, jadi syarat
-- semua-kata gagal dan jalur judul **tidak menyala sama sekali**. Log membuktikannya: ada baris
-- "[RAG] Pencarian gabungan … [isi, kepbup, 204]" tanpa satu pun baris "[RAG] Judul cocok".
--
-- Pelajarannya: pertanyaan manusia selalu membawa kata yang tidak ada di judul. Syarat semua-kata
-- hanya bekerja untuk kueri yang sudah dibersihkan — yaitu kueri yang tidak pernah ada.
--
-- ── Aturan baru: minimal DUA kata kueri cocok dengan judul ──────────────────────────────────
--
-- Diukur terhadap data nyata sebelum ditulis:
--
--   "isi kepbup 204"        → 1 dokumen, yang benar       (kepbup + 204)
--   "kepbup 204"            → 1 dokumen, yang benar
--   "pangkat camat lengkiti"→ 2 dokumen, teratas yang benar (camat + lengkiti) — relevan, tidak merusak
--   "apa kabar hari ini"    → 0 dokumen
--
-- Kenapa DUA, bukan satu: seluruh 221 judul memuat kata "kepbup". Satu kata cocok akan menarik
-- 221 dokumen sekaligus. Dua kata membuat nomor (atau nama jabatan + wilayah) yang menentukan.
--
-- Diurutkan dari yang paling banyak cocok, supaya dokumen yang paling tepat berada di depan saat
-- `match_count` memotong.

create or replace function public.match_documents_judul(
  query_words text[],
  match_count integer,
  p_user_id uuid,
  p_space_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  content text,
  space_name text,
  urutan bigint
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
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
$$;

grant execute on function public.match_documents_judul(text[], integer, uuid, uuid) to authenticated;
grant execute on function public.match_documents_judul(text[], integer, uuid, uuid) to service_role;

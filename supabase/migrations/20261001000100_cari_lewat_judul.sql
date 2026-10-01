-- CARI DOKUMEN LEWAT JUDULNYA (2026-10-01)
--
-- ── Masalah, diukur sendiri 1 Oktober 2026 (bukan diperkirakan) ─────────────────────────────
--
--   221 dokumen Kepbup · 3.629 potongan · kata "kepbup" muncul di 0 potongan
--   221 dari 221 dokumen TIDAK memuat nomornya sendiri di teks terindeks
--
-- Contoh nyata: "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf" punya 14 potongan, dan
-- tidak satu pun memuat "204". Baris konteks (Item 89) memuat jabatan & urusan, bukan nomor dokumen.
--
-- Akibatnya: **tidak ada satu pun cara menemukan dokumen lewat nomornya.** Judul memuat semuanya,
-- tetapi judul tidak pernah ikut dicari — `fts` hanya dihitung dari `content`.
--
-- ── Kenapa RRF tidak bisa menolong, berapa pun bobotnya ─────────────────────────────────────
--
-- `match_documents_hybrid` menyaring dengan `where p.similarity > match_threshold`, dan itu
-- kemiripan VEKTOR. Untuk pertanyaan "Kepbup 204", potongan tabel kompetensi punya kemiripan rendah
-- → dibuang SEBELUM RRF sempat bekerja. Menaikkan bobot kata kunci tidak menyelamatkan yang sudah
-- tersaring.
--
-- ── Kenapa jalur TERPISAH, bukan mengubah fungsi hibrida ────────────────────────────────────
--
-- `match_documents_hybrid` memegang patokan terukur **recall@8 14/14** (Item 90 Tahap B). Mengubahnya
-- berarti menggeser patokan itu, dan setiap pengukuran sesudahnya tidak lagi sebanding. Fungsi lama
-- TIDAK DISENTUH sama sekali; yang ditambah fungsi baru di sebelahnya.

-- 1. Judul jadi bisa dicari. Dihitung Postgres, tidak perlu diisi kode unggah — sama polanya dengan
--    `document_chunks.fts` (Item 90 Tahap B). 238 baris: penulisan ulang tabel ringan.
alter table public.documents
  add column if not exists fts_judul tsvector
  generated always as (to_tsvector('simple', coalesce(title, ''))) stored;

create index if not exists idx_documents_fts_judul
  on public.documents using gin (fts_judul);

-- 2. Pencarian lewat judul.
--
-- SEMUA kata wajib ada di judul (`&`, bukan `|`). Ini yang membuatnya sempit dan tidak merebut
-- pertanyaan biasa: "berapa pangkat camat lengkiti" → kata kuncinya memuat "pangkat", yang tidak ada
-- di judul mana pun → nol hasil, jalur hibrida tetap yang menjawab. Sedangkan "kepbup 204" → tepat
-- satu dokumen.
--
-- TIDAK ada ambang kemiripan di sini — justru ambang itulah yang membuang jawabannya di jalur
-- hibrida. Yang menjaga agar hasilnya tidak membanjir adalah `match_count` dan syarat semua-kata.
--
-- Pagar pengguna/space/arsip disalin apa adanya dari `match_documents_hybrid` — kalau berbeda, akan
-- ada dua aturan kepemilikan data yang bisa menyimpang diam-diam.
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
    select nullif(array_to_string(array(
      select distinct w from (
        select regexp_replace(lower(x), '[^a-z0-9]', '', 'g') as w from unnest(coalesce(query_words, '{}')) x
      ) s where w <> ''
    ), ' & '), '') as q
  ),
  dokumen as (
    select d.id
    from documents d
    join knowledge_spaces ks on d.space_id = ks.id
    cross join kata
    where d.user_id = p_user_id
      and ks.archived = false
      and (p_space_id is null or d.space_id = p_space_id)
      and kata.q is not null
      and d.fts_judul @@ to_tsquery('simple', kata.q)
  )
  select dc.id, dc.document_id, d.title, dc.content, ks.name as space_name,
         row_number() over (partition by dc.document_id order by dc.id) as urutan
  from document_chunks dc
  join dokumen dd on dd.id = dc.document_id
  join documents d on d.id = dc.document_id
  join knowledge_spaces ks on d.space_id = ks.id
  order by dc.document_id, dc.id
  limit match_count;
$$;

-- Hak akses disalin dari fungsi hibrida: dipanggil lewat sesi pengguna (RLS tetap penjaganya karena
-- `p_user_id` dicocokkan di dalam fungsi).
grant execute on function public.match_documents_judul(text[], integer, uuid, uuid) to authenticated;
grant execute on function public.match_documents_judul(text[], integer, uuid, uuid) to service_role;

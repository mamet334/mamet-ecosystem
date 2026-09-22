-- Skema Postgres lokal untuk memulihkan berkas cadangan Mamet (Item 93 Tahap 2, 2026-09-22).
-- Disalin dari database Supabase (definisi kolom via pg_attribute, fungsi via pg_get_functiondef), bukan ditulis
-- ulang dari ingatan. Butuh Postgres >= 16 + ekstensi pgvector. Tanpa skema auth Supabase: satu pengguna, tanpa RLS.
-- Kunci asing antar-tabel ditambahkan SESUDAH data dimuat (lihat pulih-cadangan.mjs) — sekaligus menguji keutuhan.

create extension if not exists vector;

create type public.space_type_enum as enum ('CORE', 'WORKSPACE');

create table public.knowledge_spaces (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  description text,
  tags text[] default '{}'::text[],
  space_type space_type_enum default 'WORKSPACE'::space_type_enum,
  archived boolean default false,
  quality_filter_enabled boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id)
);
create table public.documents (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  space_id uuid not null,
  source_url text,
  source_type text,
  retrieved_at timestamp with time zone,
  primary key (id)
);
-- fts: di Supabase kolom GENERATED STORED — dibangun ulang dari teks, tidak diambil dari berkas.
create table public.document_chunks (
  id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  content text not null,
  embedding vector(768),
  source_url text,
  source_type text,
  fts tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(content, ''::text))) stored,
  primary key (id)
);
create table public.workspace_summaries (
  id uuid default gen_random_uuid() not null,
  space_id uuid not null,
  summary text not null,
  updated_at timestamp with time zone default now(),
  user_id uuid,
  primary key (id)
);
create table public.asn_berkas (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  opd text not null,
  nama_berkas text not null,
  jumlah_orang integer default 0 not null,
  ringkasan_sheet jsonb default '[]'::jsonb not null,
  digantikan_oleh uuid,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);
-- id di Supabase: identity always — di sini angka biasa supaya id asli ikut dipulihkan.
create table public.asn_pegawai (
  id bigint not null,
  berkas_id uuid not null,
  user_id uuid not null,
  sheet text not null,
  kelompok text not null,
  baris_asal integer not null,
  no_urut text,
  nama text not null,
  nip text,
  jenis_kelamin text,
  status text,
  pendidikan_cpns text,
  pendidikan_akhir text,
  tahun_lulus text,
  jabatan text,
  pangkat text,
  pim text[] default '{}'::text[] not null,
  pelatihan text[] default '{}'::text[] not null,
  nilai_ipa text,
  primary key (id)
);
create table public.chats (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text default 'Percakapan Baru'::text not null,
  messages jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  workspace_id uuid,
  workspace_type text default 'OWNER'::text,
  primary key (id)
);
create table public.user_memories (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  summary text not null,
  embedding vector(768),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  last_used_at timestamp with time zone default timezone('utc'::text, now()),
  memory_hits integer default 0,
  normalized_memory_hash text,
  message_hash text,
  memory_type text,
  confidence double precision default 0.95,
  source text default 'user'::text,
  metadata jsonb default '{}'::jsonb,
  memory_state text default 'ACTIVE'::text,
  workspace_id uuid,
  raw_content_id uuid,
  source_reference text,
  version_code text,
  chat_id text,
  last_verified_at timestamp with time zone,
  category text default 'general'::text not null,
  access_tier text default 'generic'::text not null,
  status text default 'active'::text not null,
  version_sequence integer default 1 not null,
  primary key (id)
);
create table public.api_usage (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  provider text not null,
  model text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric default 0.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);
create table public.project_memory_entries (
  id uuid default gen_random_uuid() not null,
  entry_type text not null,
  status text default 'Hypothesis'::text not null,
  title text not null,
  content text not null,
  tags text[] default '{}'::text[],
  related_task text,
  related_adr text,
  related_gap text,
  source_ref text,
  created_by text default 'system'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  governance_status text default 'ACTIVE'::text,
  superseded_by uuid,
  version_major integer default 1,
  version_minor integer default 0,
  version_patch integer default 0,
  is_current boolean default true,
  review_notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  deprecated_at timestamp with time zone,
  archived_at timestamp with time zone,
  bug_category text,
  user_id uuid not null,
  primary key (id)
);
create table public.engineering_tasks (
  id uuid default gen_random_uuid() not null,
  task_number text not null,
  title text not null,
  status text default 'Proposed'::text not null,
  phase integer default 1 not null,
  owner text default 'Mamet Engineer'::text not null,
  goal text,
  acceptance text,
  verification text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  patch_accepted boolean,
  user_id uuid not null,
  primary key (id)
);
create table public.architecture_gaps (
  id uuid default gen_random_uuid() not null,
  gap_number text not null,
  title text not null,
  status text default 'Open'::text not null,
  description text,
  resolution text,
  related_task text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  user_id uuid not null,
  primary key (id)
);
create table public.verification_runs (
  id uuid default gen_random_uuid() not null,
  related_task text not null,
  verification_type text not null,
  result text not null,
  evidence text,
  command_used text,
  created_at timestamp with time zone default now() not null,
  user_id uuid not null,
  primary key (id)
);

-- Pencarian gabungan vektor + kata kunci (RRF k=60) — salinan persis fungsi live (Item 90 Tahap B).
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

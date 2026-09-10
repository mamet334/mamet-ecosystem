-- Konversi Word -> PDF dari HP, dikerjakan laptop Owner (Item 57).
--
-- Mamet OS versi web (mamet-ecosystem.vercel.app, termasuk dibuka di HP) tidak punya Word.
-- Laptop punya (Word 2007 + Microsoft Print to PDF, Item 56). Tabel ini antrian di antaranya:
--   Web    : unggah .docx ke bucket `conversions`, sisipkan baris status 'pending'
--   Laptop : klaim baris (pending -> processing), konversi, unggah PDF, tandai 'done'
--   Web    : unduh PDF lewat signed URL
--
-- conversion_workers berisi sinyal hidup laptop. Versi web memeriksanya sebelum mengirim, jadi
-- pengguna diberi tahu bila laptop offline alih-alih menunggu antrian yang tak dikerjakan.
-- mametlite TIDAK memakai fitur ini (keputusan Owner: mametlite hanya RAG + pencarian web).
--
-- Semua akses dibatasi ke baris/berkas milik akun sendiri. Tidak ada policy `USING (true)`
-- (pelajaran Item 52: satu policy permisif membatalkan semua policy ketat di sebelahnya).

-- ---------------------------------------------------------------------------
-- 1. Sinyal hidup laptop-pekerja
-- ---------------------------------------------------------------------------
create table if not exists public.conversion_workers (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  device_label  text,
  capabilities  text[] not null default array['word_to_pdf'],
  last_seen_at  timestamptz not null default now()
);

alter table public.conversion_workers enable row level security;

create policy "conversion_workers: baca milik sendiri"
  on public.conversion_workers for select to authenticated
  using (user_id = auth.uid());

create policy "conversion_workers: daftar milik sendiri"
  on public.conversion_workers for insert to authenticated
  with check (user_id = auth.uid());

create policy "conversion_workers: perbarui milik sendiri"
  on public.conversion_workers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Detak dan status memakai JAM SERVER (now()), bukan jam laptop atau HP. Kalau laptop
-- menulis last_seen_at dengan jamnya sendiri lalu HP membandingkan dengan jam HP, selisih jam
-- satu menit saja sudah cukup membuat fitur hilang di HP padahal laptop menyala.
-- SECURITY INVOKER: tetap tunduk pada RLS di atas, jadi hanya menyentuh baris milik pemanggil.
create or replace function public.conversion_worker_heartbeat(p_device_label text default null)
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  insert into public.conversion_workers (user_id, device_label, last_seen_at)
  values (auth.uid(), p_device_label, now())
  on conflict (user_id) do update
    set last_seen_at = now(),
        device_label = coalesce(excluded.device_label, public.conversion_workers.device_label)
  returning last_seen_at;
$$;

create or replace function public.conversion_worker_status()
returns table (online boolean, last_seen_at timestamptz, device_label text, detik_lalu integer)
language sql
stable
security invoker
set search_path = public
as $$
  select w.last_seen_at > now() - interval '60 seconds',
         w.last_seen_at,
         w.device_label,
         extract(epoch from (now() - w.last_seen_at))::integer
  from public.conversion_workers w
  where w.user_id = auth.uid();
$$;

revoke all on function public.conversion_worker_heartbeat(text) from public, anon;
revoke all on function public.conversion_worker_status() from public, anon;
grant execute on function public.conversion_worker_heartbeat(text) to authenticated;
grant execute on function public.conversion_worker_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Antrian pekerjaan
-- ---------------------------------------------------------------------------
create table if not exists public.conversion_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null default 'word_to_pdf' check (kind in ('word_to_pdf')),
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  source_name  text not null,
  source_path  text not null,
  output_path  text,
  error        text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists conversion_jobs_user_status_idx
  on public.conversion_jobs (user_id, status, created_at desc);

alter table public.conversion_jobs enable row level security;

create policy "conversion_jobs: baca milik sendiri"
  on public.conversion_jobs for select to authenticated
  using (user_id = auth.uid());

-- Pekerjaan baru selalu mulai 'pending' dan berkasnya harus di folder milik sendiri.
create policy "conversion_jobs: buat milik sendiri"
  on public.conversion_jobs for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and split_part(source_path, '/', 1) = auth.uid()::text
  );

create policy "conversion_jobs: perbarui milik sendiri"
  on public.conversion_jobs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "conversion_jobs: hapus milik sendiri"
  on public.conversion_jobs for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Bucket berkas — privat, 25 MB, hanya Word dan PDF
--    Jalur berkas: <user_id>/<job_id>/<nama berkas>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conversions', 'conversions', false, 26214400,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

create policy "conversions: baca folder sendiri"
  on storage.objects for select to authenticated
  using (bucket_id = 'conversions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "conversions: unggah ke folder sendiri"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'conversions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "conversions: timpa di folder sendiri"
  on storage.objects for update to authenticated
  using (bucket_id = 'conversions' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'conversions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "conversions: hapus di folder sendiri"
  on storage.objects for delete to authenticated
  using (bucket_id = 'conversions' and (storage.foldername(name))[1] = auth.uid()::text);

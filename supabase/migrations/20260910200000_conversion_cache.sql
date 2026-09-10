-- Cache hasil konversi (Item 58).
--
-- Tujuannya bukan sekadar membuang berkas lama, tapi TIDAK MEMPROSES HAL YANG SAMA DUA KALI.
-- Setiap dokumen dikenali dari sidik jari ISINYA (SHA-256), bukan namanya:
--   - dokumen sama, nama beda   → tetap dikenali, PDF langsung diberikan tanpa laptop
--   - diedit satu huruf saja    → sidik jari berubah, dianggap dokumen baru (tak ada PDF basi)
-- Cache per akun (RLS yang sudah ada). Sengaja TIDAK dibagi antar pengguna: kalau dibagi,
-- pengguna lain bisa mengetahui bahwa suatu dokumen pernah dikonversi di sistem ini.
--
-- Kuota 200 MB per akun, ditegakkan laptop-pekerja (hanya laptop yang menambah isi cache, dan
-- ia membersihkan setelah setiap konversi). Yang dibuang lebih dulu: yang paling lama TIDAK
-- DIPAKAI (last_accessed_at), bukan yang paling lama dibuat — PDF yang sering diunduh bertahan.
-- Penghapusan berkas harus lewat Storage API: trigger storage.protect_delete memblokir DELETE
-- langsung di storage.objects, jadi tidak ada jadwal pg_cron di sini.

alter table public.conversion_jobs
  add column if not exists source_hash      text,
  add column if not exists output_size      bigint,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists source_deleted   boolean not null default false;

alter table public.conversion_jobs
  drop constraint if exists conversion_jobs_source_hash_format;
alter table public.conversion_jobs
  add constraint conversion_jobs_source_hash_format
  check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$');

-- Pencarian cache: "akun ini, jenis ini, sidik jari ini, sudah selesai".
create index if not exists conversion_jobs_cache_idx
  on public.conversion_jobs (user_id, kind, source_hash)
  where status = 'done';

-- Isi ukuran dan waktu pakai untuk hasil yang sudah ada sebelum migrasi ini, dari metadata
-- storage (dibaca di sini; yang dilarang hanya MENGHAPUS lewat SQL). Tanpa ini hasil lama
-- dihitung 0 byte dan tidak pernah terpilih untuk dibuang.
update public.conversion_jobs j
set output_size      = (o.metadata->>'size')::bigint,
    last_accessed_at = coalesce(j.last_accessed_at, j.finished_at, j.created_at)
from storage.objects o
where o.bucket_id = 'conversions'
  and o.name = j.output_path
  and j.output_size is null;

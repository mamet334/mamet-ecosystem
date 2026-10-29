-- Retensi agent_logs: log mentah 90 hari, sesudahnya DIRINGKAS (bulan × jenis × penyedia → jumlah) lalu dihapus.
-- Item 126 Fase 0 ("retensi sejak hari pertama" + retrofit agent_logs); keputusan Owner 2026-10-29: 90 hari, diringkas.
--
-- Latar (diukur 29 Okt): database 69 MB dari kuota 500 MB — tidak darurat. agent_logs 15.561 baris / 4,3 MB; 13.786
-- (89%) dari Juni 2026, hampir semuanya FALLBACK_TRIGGERED & RATE_LIMIT_HIT era kunci Gemini/Groq server (dihapus
-- 15 Sep). Pertumbuhan kini ±250 baris/bulan. Pembaca agent_logs (dasbor 100 terbaru, pelacak per trace_id,
-- pemeriksaan dua-ujung sesudah deploy) hanya butuh log baru; tak ada view/fungsi database yang memakainya.
--
-- Ringkasan hanya hitungan — TANPA message & metadata (aman privasi), jadi hitungan seperti "PROVIDER_ERROR per bulan"
-- tetap tersedia untuk ukuran Item 126 sesudah baris mentahnya hilang.
--
-- Penerapan pertama (meringkas & menghapus 14.257 baris > 90 hari) dijalankan manual dengan izin Owner, bukan bagian
-- migrasi ini: select public.ringkas_dan_hapus_agent_logs(90); lalu vacuum full public.agent_logs.

create table if not exists public.agent_logs_ringkasan (
  bulan date not null,
  event_type text not null,
  provider text not null,
  jumlah bigint not null check (jumlah >= 0),
  diperbarui timestamptz not null default now(),
  primary key (bulan, event_type, provider)
);

-- Hanya untuk pemeriksaan Owner lewat SQL (peran postgres/service_role). Klien tidak perlu membacanya:
-- RLS menyala tanpa kebijakan + hak anon/authenticated dicabut (pelajaran Item 125: hak bawaan 39 tabel).
alter table public.agent_logs_ringkasan enable row level security;
revoke all on public.agent_logs_ringkasan from anon, authenticated;

-- Satu transaksi: baris yang diringkas = baris yang dihapus (log baru selalu created_at = now(), jadi tak ada yang
-- melewati batas di antara keduanya). Kelompok yang sudah ada DITAMBAH, bukan ditimpa — aman dijalankan tiap hari.
create or replace function public.ringkas_dan_hapus_agent_logs(batas_hari integer default 90)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  batas timestamptz := now() - make_interval(days => batas_hari);
  n_kelompok bigint;
  n_hapus bigint;
begin
  if batas_hari < 30 then
    raise exception 'batas_hari minimal 30 (diminta %)', batas_hari;
  end if;

  insert into public.agent_logs_ringkasan (bulan, event_type, provider, jumlah)
  select date_trunc('month', created_at)::date, coalesce(event_type, ''), coalesce(provider, ''), count(*)
  from public.agent_logs
  where created_at < batas
  group by 1, 2, 3
  on conflict (bulan, event_type, provider)
  do update set jumlah = agent_logs_ringkasan.jumlah + excluded.jumlah, diperbarui = now();
  get diagnostics n_kelompok = row_count;

  delete from public.agent_logs where created_at < batas;
  get diagnostics n_hapus = row_count;

  return json_build_object('batas', batas, 'kelompok_diringkas', n_kelompok, 'baris_dihapus', n_hapus);
end;
$$;

revoke all on function public.ringkas_dan_hapus_agent_logs(integer) from public, anon, authenticated;

-- Tiap hari 01:15 UTC = 08:15 WIB, sesudah cleanup-memories-daily (01:00 UTC). Nama sama = memperbarui (idempoten).
select cron.schedule(
  'ringkas-agent-logs-harian',
  '15 1 * * *',
  $$select public.ringkas_dan_hapus_agent_logs(90)$$
);

-- Item 126 Fase 0 (Data Flywheel) — umpan balik 👍/👎 per jawaban, 2026-10-27.
--
-- North Star roda gila = biaya per jawaban BERHASIL. Sampai migrasi ini tidak ada data apa pun tentang jawaban mana
-- yang berhasil. Satu baris = satu penilaian pengguna atas satu jawaban, disambungkan lewat `trace_id` — ID yang
-- dibuat klien per permintaan dan dipakai server apa adanya (request_parser.ts: traceId klien) — ke
-- `cost_ledger.trace_id`: model, `pemilih_model`, dan biaya ikut diketahui tanpa disalin ke sini.
--
-- Gerbang 1 menuntut NOL isi percakapan tersimpan: tabel ini sengaja tidak punya kolom teks bebas.
-- Satu penilaian per jawaban per pengguna (unik user_id + trace_id); klik lagi = baris dihapus (batal).
-- CHECK `nilai` aman di sini (beda dengan cost_ledger.pemilih_model): klien MENUNGGU hasil tulisnya dan menampilkan
-- galatnya, jadi constraint tidak membunuh apa pun tanpa suara.
-- Semua akses dibatasi ke baris milik akun sendiri. Tidak ada policy `USING (true)` (pelajaran Item 52).

create table if not exists public.umpan_balik_jawaban (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trace_id    text not null,
  nilai       smallint not null check (nilai in (-1, 1)),
  workspace   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, trace_id)
);

comment on table public.umpan_balik_jawaban is
  'Item 126: penilaian 👍 (+1) / 👎 (-1) pengguna per jawaban. Disambungkan ke cost_ledger lewat trace_id. Tanpa isi percakapan (Gerbang 1).';
comment on column public.umpan_balik_jawaban.trace_id is
  'traceId permintaan yang dibuat klien (AssistantService) — sama dengan cost_ledger.trace_id.';

create index if not exists umpan_balik_jawaban_trace on public.umpan_balik_jawaban (trace_id);

alter table public.umpan_balik_jawaban enable row level security;

create policy "umpan_balik_jawaban: baca milik sendiri"
  on public.umpan_balik_jawaban for select to authenticated using (user_id = auth.uid());
create policy "umpan_balik_jawaban: tambah milik sendiri"
  on public.umpan_balik_jawaban for insert to authenticated with check (user_id = auth.uid());
create policy "umpan_balik_jawaban: ubah milik sendiri"
  on public.umpan_balik_jawaban for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "umpan_balik_jawaban: hapus milik sendiri"
  on public.umpan_balik_jawaban for delete to authenticated using (user_id = auth.uid());

-- Hak bawaan Supabase memberi anon akses tabel baru (temuan T11: 40 tabel). Tabel ini hanya untuk pengguna masuk.
revoke all on table public.umpan_balik_jawaban from anon;

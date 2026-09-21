-- DATA TABEL REKONSILIASI ASN (Item 92 Tahap 2, 2026-09-21) — dijalankan atas izin Owner.
--
-- Excel rekonsiliasi OPD dibaca di browser (dataTabelAsn.js, Tahap 1) lalu — SESUDAH dikonfirmasi Owner di pratinjau —
-- disimpan sebagai baris data, satu baris per orang. Tanpa vektor: pertanyaan "berapa" / "siapa yang belum" dijawab
-- kode (Tahap 3), bukan RAG.
--
-- Versi: unggahan baru untuk OPD yang sama tidak menghapus yang lama — baris lama ditandai `digantikan_oleh`, sehingga
-- hitungan hanya memakai berkas aktif, dan riwayat revisi tetap bisa diperiksa. Pengukuran menemukan 137 orang tercatat
-- di dua berkas (INSPEKTORAT senin/selasa, DPPKB vs "REKON --- …", dll.) — tanpa ini total se-kabupaten kelebihan 137.
--
-- Semua akses dibatasi ke baris milik akun sendiri. Tidak ada policy `USING (true)` (pelajaran Item 52).

-- ---------------------------------------------------------------------------
-- 1. Berkas (satu baris per unggahan yang dikonfirmasi)
-- ---------------------------------------------------------------------------
create table if not exists public.asn_berkas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  opd             text not null,                 -- nama OPD (dari nama berkas, bisa dibetulkan Owner di pratinjau)
  nama_berkas     text not null,
  jumlah_orang    integer not null default 0,
  ringkasan_sheet jsonb not null default '[]',   -- per sheet: nama, kelompok, status, jumlah, JUMLAH tertulis, kejanggalan, pemetaan
  digantikan_oleh uuid references public.asn_berkas(id) on delete set null,  -- null = aktif
  created_at      timestamptz not null default now()
);
create index if not exists asn_berkas_user_aktif on public.asn_berkas (user_id) where digantikan_oleh is null;

alter table public.asn_berkas enable row level security;

create policy "asn_berkas: baca milik sendiri"
  on public.asn_berkas for select to authenticated using (user_id = auth.uid());
create policy "asn_berkas: tambah milik sendiri"
  on public.asn_berkas for insert to authenticated with check (user_id = auth.uid());
create policy "asn_berkas: ubah milik sendiri"
  on public.asn_berkas for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "asn_berkas: hapus milik sendiri"
  on public.asn_berkas for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Pegawai (satu baris per orang per berkas)
-- ---------------------------------------------------------------------------
create table if not exists public.asn_pegawai (
  id               bigint generated always as identity primary key,
  berkas_id        uuid not null references public.asn_berkas(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,  -- disalin dari berkas: RLS & saringan cepat
  sheet            text not null,
  kelompok         text not null check (kelompok in ('struktural','jft','pelaksana','pppk','paruh_waktu','tidak_dikenal')),
  baris_asal       integer not null,               -- nomor baris di Excel: bukti setiap angka jawaban
  no_urut          text,
  nama             text not null,
  nip              text check (nip is null or nip ~ '^[0-9]{18}$'),
  jenis_kelamin    text check (jenis_kelamin in ('L','P')),
  status           text,
  pendidikan_cpns  text,
  pendidikan_akhir text,
  tahun_lulus      text,
  jabatan          text,
  pangkat          text,
  pim              text[] not null default '{}',   -- mis. {IV}; kosong = belum PIM
  pelatihan        text[] not null default '{}',   -- kosong = belum pelatihan teknis/fungsional
  nilai_ipa        text                            -- teks mentah ("80", "-", kosong); diolah saat dihitung
);
create index if not exists asn_pegawai_berkas on public.asn_pegawai (berkas_id);
create index if not exists asn_pegawai_user_nip on public.asn_pegawai (user_id, nip) where nip is not null;

alter table public.asn_pegawai enable row level security;

create policy "asn_pegawai: baca milik sendiri"
  on public.asn_pegawai for select to authenticated using (user_id = auth.uid());
-- Tambah hanya ke berkas milik sendiri (user_id saja tidak cukup: berkas_id bisa menunjuk berkas orang lain).
create policy "asn_pegawai: tambah ke berkas sendiri"
  on public.asn_pegawai for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.asn_berkas b where b.id = berkas_id and b.user_id = auth.uid()));
create policy "asn_pegawai: hapus milik sendiri"
  on public.asn_pegawai for delete to authenticated using (user_id = auth.uid());
-- Tidak ada UPDATE: data pegawai = salinan Excel apa adanya. Perbaikan = unggah revisi (versi baru).

-- ---------------------------------------------------------------------------
-- 3. Simpan satu berkas secara utuh (berkas + semua pegawai + tandai versi lama) dalam SATU transaksi
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: tunduk pada RLS di atas. Gagal di tengah = tidak ada yang tersimpan (tanpa berkas setengah jadi).
create or replace function public.asn_simpan_berkas(p_berkas jsonb, p_pegawai jsonb, p_gantikan uuid[] default '{}')
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.asn_berkas (user_id, opd, nama_berkas, jumlah_orang, ringkasan_sheet)
  values (auth.uid(), p_berkas->>'opd', p_berkas->>'nama_berkas', jsonb_array_length(p_pegawai), coalesce(p_berkas->'ringkasan_sheet', '[]'))
  returning id into v_id;

  insert into public.asn_pegawai (berkas_id, user_id, sheet, kelompok, baris_asal, no_urut, nama, nip, jenis_kelamin, status,
    pendidikan_cpns, pendidikan_akhir, tahun_lulus, jabatan, pangkat, pim, pelatihan, nilai_ipa)
  select v_id, auth.uid(), e->>'sheet', e->>'kelompok', (e->>'baris_asal')::int, e->>'no', e->>'nama',
         nullif(e->>'nip', ''), nullif(e->>'jenis_kelamin', ''), nullif(e->>'status', ''),
         nullif(e->>'pendidikan_cpns', ''), nullif(e->>'pendidikan_akhir', ''), nullif(e->>'tahun_lulus', ''),
         nullif(e->>'jabatan', ''), nullif(e->>'pangkat', ''),
         coalesce(array(select jsonb_array_elements_text(e->'pim')), '{}'),
         coalesce(array(select jsonb_array_elements_text(e->'pelatihan')), '{}'),
         nullif(e->>'nilai_ipa', '')
  from jsonb_array_elements(p_pegawai) e;

  -- Versi lama yang dipilih Owner diganti (bukan dihapus). RLS memastikan hanya berkas miliknya yang tersentuh.
  update public.asn_berkas set digantikan_oleh = v_id
  where id = any(p_gantikan) and user_id = auth.uid() and digantikan_oleh is null;

  return v_id;
end;
$$;

revoke all on function public.asn_simpan_berkas(jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.asn_simpan_berkas(jsonb, jsonb, uuid[]) to authenticated;

-- HAKIM BAYANGAN (T13, 2026-09-28)
--
-- Menyimpan vonis per kalimat dari hakim bayangan berdampingan dengan label yang BENAR-BENAR dipakai
-- sistem, supaya keduanya bisa dibandingkan sesudah beberapa puluh pesan. Vonis di tabel ini TIDAK
-- PERNAH mengubah label, teks jawaban, atau apa pun yang dilihat pengguna.
--
-- Tabel ini sengaja RAMPING. Kuota basis data proyek ini pernah dimakan log (Item 93), jadi:
--   • `rinci` hanya memuat 160 huruf pertama tiap kalimat — untuk mengenali kalimatnya, bukan arsip chat;
--   • paling banyak 40 kalimat per baris (dibatasi di `hakim_bayangan.ts`);
--   • isi potongan dokumen TIDAK disimpan sama sekali, hanya jumlahnya.
-- Tabel ini boleh di-DROP kapan saja tanpa memengaruhi jalannya sistem.

create table if not exists public.hakim_bayangan (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  trace_id text,
  chat_id text,
  model text,
  -- '(diam)' = label model dibiarkan; 'diturunkan' = periksaLabelSumber menurunkannya
  label_sistem text,
  -- label yang AKAN diusulkan hakim seandainya ia berwenang: VERIFIED | PARTIAL | HYPOTHESIS | TAK_PASTI
  label_usulan text,
  jumlah_kalimat integer,
  jumlah_potongan integer,
  bersandar integer,
  tidak integer,
  percakapan integer,
  tak_terbaca integer,
  biaya_usd numeric,
  durasi_ms integer,
  -- [{ n, v, p, k }] — v: BERSANDAR|TIDAK|PERCAKAPAN|null, p: indeks potongan, k: 160 huruf pertama
  rinci jsonb
);

create index if not exists hakim_bayangan_created_at_idx on public.hakim_bayangan (created_at desc);

-- Ditulis HANYA oleh Edge Function dengan service-role key. Tidak ada policy untuk anon/authenticated,
-- jadi dengan RLS menyala tabel ini tertutup bagi klien — sejalan dengan 20260922003711_rls_tutup_baca_semua.
alter table public.hakim_bayangan enable row level security;

comment on table public.hakim_bayangan is
  'T13 mode bayangan: vonis hakim per kalimat, dicatat untuk dibandingkan dengan label_sumber.ts. Tidak memengaruhi jawaban. Aman di-DROP.';

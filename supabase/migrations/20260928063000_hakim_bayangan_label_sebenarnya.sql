-- Dua kolom supaya tabel hakim_bayangan bisa menjawab pertanyaannya sendiri (2026-09-28).
--
-- Versi pertama menyimpan `label_sistem` = apakah sistem MENGUBAH sesuatu ('(diam)'/'diturunkan'),
-- bukan labelnya. Akibatnya kelima baris pertama berbunyi '(diam)', dan pertanyaan pokok — seberapa
-- sering hakim tidak sepakat dengan label yang DILIHAT Owner — hanya bisa dijawab dengan menggabung
-- manual ke tabel `chats`. Untuk sebuah alat ukur, itu cacat pokok.
--
-- Sesudah ini:
--   label_sistem  = label yang benar-benar terlihat (VERIFIED | PARTIAL | HYPOTHESIS |
--                   INSUFFICIENT | PENGETAHUAN_UMUM | TANPA_LABEL)
--   diturunkan    = apakah periksaLabelSumber menurunkan label model
--   sepakat       = label_sistem === label_usulan
--
-- Baris lama sengaja TIDAK diisi ulang: menebak label yang dulu terlihat berarti mengarang data
-- pengukuran. Baris sebelum 2026-09-28 06:30 dikenali dari `label_sistem` yang berisi '(diam)'.

alter table public.hakim_bayangan add column if not exists diturunkan boolean;
alter table public.hakim_bayangan add column if not exists sepakat boolean;

comment on column public.hakim_bayangan.label_sistem is
  'Label yang benar-benar terlihat Owner. Baris sebelum 2026-09-28 06:30 berisi "(diam)"/"diturunkan" (format lama) dan tidak bisa dibandingkan.';
comment on column public.hakim_bayangan.label_usulan is
  'Usulan hakim seandainya ia berwenang. TIDAK_BERLAKU = jawaban INSUFFICIENT, di luar tangga VERIFIED-PARTIAL-HYPOTHESIS.';

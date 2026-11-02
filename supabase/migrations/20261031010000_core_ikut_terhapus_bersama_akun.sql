-- K4/K6 (ADR-0022, 31 Okt 2026): ruang CORE ikut terhapus saat AKUNNYA dihapus — tetap tak bisa dihapus selama akun ada.
--
-- Regresi dari migrasi 20261031000000 (pemicu CORE akun baru): pemicu lama `prevent_core_deletion` menolak SETIAP
-- penghapusan ruang CORE, termasuk CASCADE dari auth.users. Dulu sebagian akun tanpa CORE, jadi tak terasa; sesudah
-- semua akun punya CORE, menghapus akun dari dashboard Supabase SELALU gagal ("Database error deleting user" —
-- terlihat Owner 31 Okt saat menghapus akun undangan uji; diukur: "Core Knowledge bersifat Read-Only").
--
-- Aturan baru: CORE ditolak dihapus selama akun pemiliknya MASIH ADA (pengguna tak bisa menghapus ruang intinya
-- sendiri, perilaku lama). Saat akunnya dihapus, baris auth.users sudah tak terlihat ketika CASCADE berjalan → boleh.
-- SECURITY DEFINER karena peran authenticated tak boleh membaca auth.users; search_path kosong.

create or replace function public.prevent_core_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.space_type = 'CORE'::public.space_type_enum then
    if exists (select 1 from auth.users where id = old.user_id) then
      raise exception 'Akses Ditolak: Core Knowledge bersifat Read-Only untuk penghapusan.';
    end if;
  end if;
  return old;
end;
$$;

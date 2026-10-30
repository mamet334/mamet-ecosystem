-- K4 (ADR-0022, 31 Okt 2026): setiap akun punya ruang pengetahuan inti (CORE) sejak dibuat.
--
-- Temuan saat menganalisis fitur kelola akun: `rag-process` mewajibkan ruang CORE ("Core space belum di-setup untuk
-- akun ini", NO_CORE_SPACE) bila klien tidak mengirim spaceId — dan Mametlite tidak pernah mengirimnya. Tetapi TIDAK ADA
-- yang membuat ruang itu: tak ada pemicu di auth.users, tak ada kode klien/server/migrasi di repo. Dua akun yang punya
-- CORE ("My Core Knowledge") membuatnya di masa lalu; 1 dari 3 akun tidak punya → pengguna Mametlite baru langsung gagal
-- di fitur utamanya (unggah dokumen RAG). Chat tak terdampak (routing_decider menerima workspace_id null).
--
-- Pemicu di SUMBERNYA (auth.users) menangkap SEMUA jalur pembuatan akun: dashboard "Add user", pendaftaran publik, dan
-- fitur admin bila nanti dibuat. Kegagalan TIDAK ditelan: akun tanpa ruang inti adalah akun yang rusak, jadi lebih baik
-- pembuatannya gagal bersuara daripada berhasil diam-diam (K2: jujur saat gagal). Satu-satunya bentrokan yang mungkin —
-- nama "My Core Knowledge" sudah dipakai ruang lain akun yang sama — tak bisa terjadi pada akun yang baru dibuat.

create or replace function public.buat_ruang_inti_akun_baru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.knowledge_spaces (user_id, name, space_type)
  values (new.id, 'My Core Knowledge', 'CORE')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

-- Fungsi pemicu tidak perlu EXECUTE untuk berjalan; tak ada yang boleh memanggilnya langsung.
revoke execute on function public.buat_ruang_inti_akun_baru() from public, anon, authenticated;

drop trigger if exists ruang_inti_akun_baru on auth.users;
create trigger ruang_inti_akun_baru
  after insert on auth.users
  for each row execute function public.buat_ruang_inti_akun_baru();

-- Akun yang sudah ada tanpa CORE (diukur 31 Okt: 1 akun, tanpa ruang lain, nama tak bentrok).
insert into public.knowledge_spaces (user_id, name, space_type)
select u.id, 'My Core Knowledge', 'CORE'
from auth.users u
where not exists (select 1 from public.knowledge_spaces k where k.user_id = u.id and k.space_type = 'CORE')
on conflict (user_id, name) do nothing;

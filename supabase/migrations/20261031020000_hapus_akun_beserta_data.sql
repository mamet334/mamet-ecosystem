-- K6 (ADR-0022, 31 Okt 2026): menghapus akun = menghapus SELURUH datanya, tanpa data yatim. Keputusan Owner (pilihan A).
--
-- Owner mendaftarkan & menghapus akun lewat dashboard Supabase (fitur kelola akun di aplikasi TIDAK dibuat). Dialog
-- dashboard menjanjikan "remove the selected user … and all associated data", tetapi diukur 31 Okt:
--   - 4 tabel ber-FK NO ACTION (chats, documents, agent_logs, scheduled_tasks) MENOLAK penghapusan akun selama datanya
--     ada → "Database error deleting user" untuk setiap akun yang pernah dipakai (contoh: akun undangan uji dengan 2 log);
--   - 9 tabel tanpa FK (memori, biaya, …) dan 5 tabel log ber-FK SET NULL pada user_id akan menyisakan data pribadi
--     tanpa pemilik.
-- Pemicu BEFORE DELETE ini menghapus semuanya dalam transaksi yang SAMA dengan penghapusan akun — gagal di mana pun,
-- akun dan datanya tetap utuh. Tabel ber-FK CASCADE (knowledge_spaces termasuk CORE, asn_*, …) ditangani database.
-- Kolom "siapa yang melakukan" (created_by, approved_by, resolved_by, performed_by) tetap SET NULL: itu catatan
-- tindakan, bukan data milik akun.
--
-- TIDAK bisa dibatalkan. Untuk berhenti sementara, Owner memakai "Ban user", bukan "Delete user".

create or replace function public.hapus_data_akun_terhapus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  -- user_id uuid: NO ACTION (4) + SET NULL milik akun (5) + tanpa FK (5). Potongan dokumen ikut lewat
  -- CASCADE documents → document_chunks.
  foreach t in array array[
    'chats', 'documents', 'agent_logs', 'scheduled_tasks',
    'ai_system_logs', 'assistant_audit_log', 'evidence_audit_logs', 'memory_audit_logs', 'verification_audit_logs',
    'api_usage', 'chats_backup', 'entity_locks', 'hakim_bayangan', 'user_memories'
  ] loop
    execute format('delete from public.%I where user_id = $1', t) using old.id;
  end loop;
  -- user_id text, tanpa FK (4).
  foreach t in array array['cost_ledger', 'mamet_memory', 'memory_audit_log', 'raw_memory_content'] loop
    execute format('delete from public.%I where user_id = $1', t) using old.id::text;
  end loop;
  return old;
end;
$$;

revoke execute on function public.hapus_data_akun_terhapus() from public, anon, authenticated;

drop trigger if exists hapus_data_akun_terhapus on auth.users;
create trigger hapus_data_akun_terhapus
  before delete on auth.users
  for each row execute function public.hapus_data_akun_terhapus();

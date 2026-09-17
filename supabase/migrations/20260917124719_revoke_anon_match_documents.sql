-- Migration: 20260917124719_revoke_anon_match_documents.sql (versi sesuai riwayat migrasi remote)
-- T4 (asal Item 50, 2026-09-10): match_documents bisa dieksekusi `anon` (hak PUBLIC + grant eksplisit anon).
--
-- Risiko sebelumnya rendah — fungsi SECURITY INVOKER, jadi RLS documents/document_chunks tetap berlaku — tetapi
-- hak itu tidak disengaja. Pemanggil yang diperiksa 2026-09-17: agent-process document_search.ts (service_role,
-- cadangan match_documents_hybrid) dan skrip uji di `npm run desktop` (authenticated). Web & Mametlite tidak
-- memanggilnya langsung. Pola hak disamakan dengan match_documents_hybrid & match_memories.

revoke all on function public.match_documents(vector, double precision, integer, uuid, uuid) from public, anon;
grant execute on function public.match_documents(vector, double precision, integer, uuid, uuid) to authenticated, service_role;

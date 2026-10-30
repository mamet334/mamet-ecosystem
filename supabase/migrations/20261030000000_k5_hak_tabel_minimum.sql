-- K5 (ADR-0022): hak bawaan tabel bagi `anon` & `authenticated` dipangkas ke yang benar-benar dipakai klien.
-- Item 125 Fase C — analisis awal ROADMAP-SIAP-PENGGUNA §4 (7 Okt), diukur ulang 30 Okt.
--
-- Keadaan sebelum (30 Okt): 39 tabel + 6 view di `public` memberi anon DAN authenticated ketujuh hak (SELECT, INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) — bawaan Supabase. Yang menjaga hanya RLS. Itu cukup selama setiap
-- kebijakan benar; satu kebijakan longgar (Item 93: "baca semua") langsung terbuka bagi siapa pun yang memegang kunci
-- anon — kunci yang memang publik (ada di bundel Mametlite & Ecosystem).
--
-- Aturan:
--   * anon: tidak ada apa pun. Semua pembacaan/penulisan klien terjadi sesudah masuk (LampLogin, layar masuk
--     Mametlite). Server (`agent-process`, `rag-process`, `cron-agent`, `health-check`, `knowledge-health`) memakai
--     service_role — tidak tersentuh migrasi ini; kunci anon di server hanya untuk `auth.getUser`.
--   * authenticated: hanya metode yang dipakai kode klien (frontend/src, frontend/electron, mametlite/src, tools/),
--     termasuk lewat RPC SECURITY INVOKER (asn_simpan_berkas, conversion_worker_*) dan realtime (chats, documents,
--     user_memories — butuh SELECT). Daftar dijaga `uji/uji-hak-tabel-k5.mjs` terhadap kode klien.
--   * TRUNCATE/REFERENCES/TRIGGER dicabut di mana-mana: tak dipakai klien, dan TRUNCATE tidak tunduk pada RLS.
--   * Tabel/view tanpa pemakai klien: tanpa hak sama sekali (RLS & kebijakannya dibiarkan apa adanya).
--
-- Tabel atau view BARU tetap mendapat hak bawaan Supabase — migrasi pembuatnya wajib mencabutnya sendiri
-- (pola `umpan_balik_jawaban`, `agent_logs_ringkasan`, `hakim_bayangan`).

-- 1. Cabut semuanya dari anon & authenticated (tabel + view di public).
revoke all on all tables in schema public from anon, authenticated;

-- 2. Beri kembali hanya yang dipakai klien (sesudah masuk).
-- Dibaca saja (ditulis server/service_role):
grant select on public.agent_logs              to authenticated;
grant select on public.ai_system_logs          to authenticated;
grant select on public.api_usage               to authenticated;
grant select on public.architecture_gaps       to authenticated;
grant select on public.checks                  to authenticated;
grant select on public.cost_ledger             to authenticated; -- "Cadangkan data" (TABEL_CADANGAN, Item 126)
grant select on public.engineering_tasks       to authenticated;
grant select on public.incidents               to authenticated;
grant select on public.model_pricing           to authenticated;
grant select on public.service_heartbeat       to authenticated;
grant select on public.system_config           to authenticated;
grant select on public.verification_audit_logs to authenticated;
grant select on public.verification_runs       to authenticated;
grant select on public.workspace_summaries     to authenticated;

-- Dibaca & ditulis klien:
grant select, insert, update, delete on public.asn_berkas          to authenticated; -- update: asn_simpan_berkas (menggantikan)
grant select, insert                 on public.asn_pegawai         to authenticated; -- insert lewat asn_simpan_berkas; hapus = cascade dari asn_berkas
grant select, insert                 on public.assistant_audit_log to authenticated;
grant select, insert, update, delete on public.chats               to authenticated;
grant select, insert, update, delete on public.conversion_jobs     to authenticated;
grant select, insert, update         on public.conversion_workers  to authenticated; -- conversion_worker_heartbeat/_status
grant select, delete                 on public.document_chunks     to authenticated; -- isi ditulis rag-process
grant select, delete                 on public.documents           to authenticated; -- baris ditulis rag-process
grant select, insert, update, delete on public.knowledge_spaces    to authenticated;
grant select, insert                 on public.project_memory_entries to authenticated;
grant select, insert, update         on public.raw_memory_content  to authenticated;
grant select, insert, update, delete on public.umpan_balik_jawaban to authenticated; -- upsert = insert + update
grant select, insert, update, delete on public.user_memories       to authenticated;

-- 3. Fungsi: EXECUTE hanya bagi yang memanggilnya. Fungsi tanpa pemanggil klien hanya untuk service_role (server).
--    `public` dicabut juga — hak EXECUTE bawaan Postgres jatuh ke PUBLIC, jadi mencabut dari anon saja tidak cukup.
revoke execute on function public.check_daily_quota(uuid) from public, anon;
grant  execute on function public.check_daily_quota(uuid) to authenticated, service_role;

revoke execute on function public.atomic_entity_lock(uuid, text, text, boolean)                  from public, anon, authenticated;
revoke execute on function public.cleanup_memories()                                              from public, anon, authenticated;
revoke execute on function public.extract_cognitive_subgraph(uuid)                                from public, anon, authenticated;
revoke execute on function public.update_memory_stats(uuid[])                                     from public, anon, authenticated;
revoke execute on function public.match_documents_judul(text[], integer, uuid, uuid)              from public, anon, authenticated;
revoke execute on function public.match_documents(vector, double precision, integer, uuid, uuid)  from public, anon, authenticated;
revoke execute on function public.match_documents_hybrid(vector, text[], double precision, integer, uuid, uuid, integer)
                                                                                                  from public, anon, authenticated;
revoke execute on function public.match_memories(vector, double precision, integer, uuid)        from public, anon, authenticated;
revoke execute on function public.get_active_knowledge(uuid, text[], integer)                     from public, anon, authenticated;

grant execute on function public.atomic_entity_lock(uuid, text, text, boolean)                   to service_role;
grant execute on function public.cleanup_memories()                                               to service_role;
grant execute on function public.extract_cognitive_subgraph(uuid)                                 to service_role;
grant execute on function public.update_memory_stats(uuid[])                                      to service_role;
grant execute on function public.match_documents_judul(text[], integer, uuid, uuid)               to service_role;
grant execute on function public.match_documents(vector, double precision, integer, uuid, uuid)   to service_role;
grant execute on function public.match_documents_hybrid(vector, text[], double precision, integer, uuid, uuid, integer)
                                                                                                  to service_role;
grant execute on function public.match_memories(vector, double precision, integer, uuid)         to service_role;
grant execute on function public.get_active_knowledge(uuid, text[], integer)                      to service_role;

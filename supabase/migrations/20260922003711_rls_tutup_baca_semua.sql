-- Tutup aturan RLS "baca semua" (USING true) — temuan saat merancang cadangan (Item 93), 2026-09-22.
--
-- Bukti sebelum migrasi (SET ROLE di dalam transaksi yang di-ROLLBACK):
--   - peran anon (TANPA login, kunci anon memang publik di aplikasi web & Mametlite) membaca user_memories 12 baris,
--     api_usage 825 baris (3 pengguna), monitors, incidents, service_heartbeat;
--   - pengguna login lain (sub palsu) membaca user_memories 12, api_usage 825, project_memory_entries 15,
--     engineering_tasks 15, architecture_gaps 6, verification_runs 14 — semuanya milik Owner.
--   Pembanding yang sudah benar: documents & asn_pegawai = 0 untuk pengguna lain.
-- Penulisan terbuka juga ditutup: api_usage INSERT untuk public (anon bisa menyisipkan biaya palsu atas nama siapa pun
-- → kuota harian orang itu habis) dan monitors INSERT/UPDATE/DELETE untuk public (health-check mem-ping URL dari tabel
-- itu dengan kunci service role).
--
-- Semua penulis sah memakai service role (melewati RLS): runtime_context.ts (api_usage), health-check (monitors,
-- checks, incidents), heartbeat.ts (service_heartbeat), verification_service.ts & knowledge-health
-- (knowledge_conflicts, knowledge_relationships). Pembaca di aplikasi sudah menyaring milik sendiri, kecuali tiga
-- widget dasbor (architecture_gaps, engineering_tasks, verification_runs) — sesudah ini mereka hanya melihat baris
-- pengguna yang login, yang memang pemilik datanya.

-- 1. Memori pribadi: aturan "select own memory" (authenticated, auth.uid() = user_id) sudah ada.
drop policy if exists "Allow all read on user_memories" on public.user_memories;

-- 2. Pemakaian API: baca milik sendiri saja (BillingDashboard sudah .eq('user_id')); tulis hanya server.
drop policy if exists "Allow read access to api_usage" on public.api_usage;
drop policy if exists "Allow insert access to api_usage" on public.api_usage;
create policy "api_usage: baca milik sendiri" on public.api_usage
  for select to authenticated using (auth.uid() = user_id);

-- 3. Catatan engineering: aturan "manage their own" (auth.uid() = user_id) sudah ada di keempat tabel.
drop policy if exists authenticated_read_pm on public.project_memory_entries;
drop policy if exists authenticated_read_et on public.engineering_tasks;
drop policy if exists authenticated_read_ag on public.architecture_gaps;
drop policy if exists authenticated_read_vr on public.verification_runs;

-- 4. Relasi & konflik pengetahuan: tanpa kolom user_id, hanya dipakai fungsi server (service role).
drop policy if exists "Auth users read kc" on public.knowledge_conflicts;
drop policy if exists "Auth users read" on public.knowledge_relationships;

-- 5. Pemantauan (bukan data pribadi): baca hanya pengguna login (dasbor), tulis hanya server.
drop policy if exists "Allow read access to checks" on public.checks;
create policy "checks: baca pengguna login" on public.checks for select to authenticated using (true);

drop policy if exists "Allow read access to incidents" on public.incidents;
create policy "incidents: baca pengguna login" on public.incidents for select to authenticated using (true);

drop policy if exists "Allow read access to monitors" on public.monitors;
drop policy if exists "Allow insert access to monitors" on public.monitors;
drop policy if exists "Allow update access to monitors" on public.monitors;
drop policy if exists "Allow delete access to monitors" on public.monitors;
create policy "monitors: baca pengguna login" on public.monitors for select to authenticated using (true);

-- "Allow dashboard to read heartbeat" (authenticated) tetap.
drop policy if exists "Allow all read on service_heartbeat" on public.service_heartbeat;

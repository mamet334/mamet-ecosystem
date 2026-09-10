-- Migration: 20260909075326_restrict_system_config_update_to_service_role.sql
--
-- Berkas ini ditulis menyusul pada 2026-09-10. Migrasinya sudah diterapkan ke
-- database pada 2026-09-09 lewat MCP, tapi berkas lokalnya tidak pernah dibuat,
-- sehingga riwayat migrasi repo dan server berselisih. Isi di bawah bukan
-- rekonstruksi dari ingatan — SQL-nya diambil apa adanya dari kolom `statements`
-- di supabase_migrations.schema_migrations pada server.

-- Celah: policy lama mengizinkan SETIAP user terautentikasi mengubah system_config,
-- termasuk daily_budget_cap_usd dan kill_switch_active. Karena pengguna eksternal
-- mametlite tanpa BYOK key memakai API key sistem milik Owner, mereka bisa menaikkan
-- sendiri plafon belanja atau mematikan kill switch.
-- Tidak ada kode klien yang menulis tabel ini (hanya costTracker.ts lewat service role,
-- dan service role melewati RLS), jadi penghapusan policy UPDATE tidak memutus apa pun.
-- Policy SELECT sengaja dipertahankan agar UI tetap bisa menampilkan plafon.
DROP POLICY IF EXISTS system_config_authenticated_update ON public.system_config;

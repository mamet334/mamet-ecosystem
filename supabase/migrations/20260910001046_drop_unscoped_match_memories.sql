-- Migration: 20260910001046_drop_unscoped_match_memories.sql
-- Item 45 langkah 3: hapus overload match_memories yang tidak bercakupan user.
--
-- Overload ini SECURITY DEFINER (menembus RLS), di-GRANT ke `authenticated`,
-- dan sama sekali tidak memfilter user_id — ia memindai user_memories milik
-- SELURUH akun. Migrasi 20260902103500 membuatnya berdampingan dengan versi
-- 4-argumen: perbaikan waktu itu ditambahkan di sebelah lubangnya, bukan
-- menggantikannya, sehingga lubang lamanya tetap terbuka sampai hari ini.
--
-- Jalur produksi (request_pipeline.ts) memanggil justru overload ini, dengan
-- klien service-role, lalu menyuntikkan hasilnya ke prompt. Belum pernah bocor
-- hanya karena seluruh user_memories.embedding masih NULL sehingga klausa WHERE
-- tak pernah menghasilkan baris — keberuntungan waktu, bukan pengamanan.
--
-- Aman dihapus: satu-satunya pemanggil sudah pindah ke overload 4-argumen pada
-- commit 2043814, terverifikasi [MATCH] antara runtime Supabase dan git HEAD.

DROP FUNCTION IF EXISTS public.match_memories(vector, double precision, integer);

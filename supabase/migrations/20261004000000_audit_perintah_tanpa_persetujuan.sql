-- 2026-10-04 — Jejak audit perintah Engineer: satu kolom baru, dan satu lubang RLS ditutup.
--
-- ================================================================================
-- 1. KOLOM BARU: tanpa_persetujuan
-- ================================================================================
--
-- Sejak 4.2.5 perintah `git`-baca bagi profil engineer jalan TANPA dialog izin
-- (`alatFolderJalan.cjs` → `tanpaPersetujuan()`). Sebelum itu tiap eksekusi punya gerbang
-- manusia, dan DIALOGNYA SENDIRI adalah catatannya. Kini sebagian jalan tanpa saksi, dan
-- satu-satunya jejak tersisa adalah state React yang hilang saat jendela dimuat ulang.
--
-- Pembedaan inilah yang membuat tabel ini berguna: bukan "apakah perintahnya berbahaya"
-- (tidak diklasifikasikan, dan menebaknya hanya melahirkan klaim tanpa dasar), melainkan
-- "apakah Owner sempat melihatnya".

ALTER TABLE assistant_audit_log
  ADD COLUMN IF NOT EXISTS tanpa_persetujuan boolean NOT NULL DEFAULT false;

-- Pertanyaan yang akan sering ditanyakan ke tabel ini hanya satu: apa saja yang jalan tanpa
-- saya lihat? Indeks parsial, jadi ia hanya memuat baris yang memang dicari.
CREATE INDEX IF NOT EXISTS idx_audit_log_tanpa_persetujuan
  ON assistant_audit_log (logged_at DESC)
  WHERE tanpa_persetujuan;

-- ================================================================================
-- 2. LUBANG RLS — kebijakan insert yang namanya tidak sesuai isinya
-- ================================================================================
--
-- Migrasi 20260826000000 membuat kebijakan ini:
--
--     -- Service role boleh insert (AuditLogService memakai service role key)
--     CREATE POLICY "Service role can insert audit logs"
--       ON assistant_audit_log FOR INSERT
--       WITH CHECK (TRUE);
--
-- Komentarnya SALAH, dan kesalahan itulah yang membuat lubangnya: `AuditLogService` TIDAK
-- memakai service role. Ia mengimpor klien peramban bersama (`frontend/src/supabase.js`) yang
-- memakai KUNCI ANON. Karena penulisnya disangka service role, kebijakannya ditulis tanpa
-- batasan peran — dan kebijakan tanpa `TO` berlaku untuk PUBLIC.
--
-- Akibat nyatanya: siapa pun yang punya kunci anon (ia ada di repo publik) bisa menyisipkan
-- baris audit APA PUN, termasuk baris ber-`user_id` Owner. Dan karena kebijakan BACA menyaring
-- `auth.uid() = user_id`, baris palsu beralamat Owner akan tampil di matanya sebagai asli.
--
-- Jejak audit yang bisa ditulis siapa saja LEBIH BURUK daripada tidak ada jejak: yang tidak ada
-- tidak menipu siapa pun. Ditutup sebelum baris pertama ditulis — tabelnya masih 0 baris saat
-- migrasi ini dibuat, jadi tak ada data yang perlu dipercaya atau dibuang.
--
-- `service_role` MELEWATI RLS sepenuhnya, jadi penulis sisi server (hari ini tidak ada) tetap
-- bisa menulis tanpa kebijakan khusus.

DROP POLICY IF EXISTS "Service role can insert audit logs" ON assistant_audit_log;

CREATE POLICY "Pengguna menulis jejak auditnya sendiri"
  ON assistant_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Catatan pemulihan bila perlu dibalik:
--   DROP POLICY "Pengguna menulis jejak auditnya sendiri" ON assistant_audit_log;
--   CREATE POLICY "Service role can insert audit logs"
--     ON assistant_audit_log FOR INSERT WITH CHECK (TRUE);
-- Jangan dibalik tanpa alasan: itu membuka kembali penyisipan oleh siapa pun.

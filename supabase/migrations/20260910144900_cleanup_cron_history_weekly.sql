-- Pembersihan riwayat jalan pg_cron — cron.job_run_details tidak pernah dibersihkan sendiri.
--
-- Latar (2026-09-10): database 238 MB dari kuota 500 MB, padahal seluruh RAG hanya 9,3 MB.
-- 86 MB adalah cron.job_run_details: 141.522 baris sejak 31 Mei, 132.160 di antaranya dari
-- jadwal `cron-agent` tiap menit yang sudah dihapus (31 Agustus) tapi riwayatnya tertinggal.
-- Setiap baris juga menyimpan salinan perintah jadwal, termasuk header Authorization.
-- 120 MB lainnya ruang kosong di net._http_response (sisa respons jadwal yang sama).
--
-- Pembersihan sekali jalan dilakukan manual dengan izin Owner (bukan bagian migrasi ini):
--   delete from cron.job_run_details where start_time < now() - interval '7 days';  -- 140.842 baris
--   vacuum full cron.job_run_details;  vacuum full net._http_response;
-- Hasil: 238 MB -> 32 MB.
--
-- Migrasi ini hanya menjaga agar tidak menumpuk lagi. Tanpa VACUUM FULL: pada kondisi stabil
-- tabel hanya berisi ±7 hari riwayat (±700 baris), dan ruang bekas dipakai ulang oleh autovacuum.
--
-- Jadwal No. 1–6 yang sudah ada dibuat lewat dashboard, tidak tercatat di repo; ini jadwal
-- pertama yang tercatat. cron.schedule dengan nama yang sama memperbarui jadwal lama (idempoten).
--
-- Minggu 00:30 UTC = 07:30 WIB, setelah cleanup-checks-weekly (00:00 UTC).

select cron.schedule(
  'cleanup-cron-history-weekly',
  '30 0 * * 0',
  $$delete from cron.job_run_details where start_time < now() - interval '7 days'$$
);

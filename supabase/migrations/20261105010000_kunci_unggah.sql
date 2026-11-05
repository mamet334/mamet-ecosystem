-- K1 langkah 2 (5 Nov 2026, disetujui Owner): kunci sementara untuk unggah bertahap.
--
-- Uji B live (Kamus 6.472 potongan): Ctrl+R di tengah panggilan → server TETAP menyelesaikan panggilan itu (±80 s).
-- Bila berkas yang sama diunggah ulang sebelum panggilan lama selesai, dua panggilan menghitung titik lanjut yang sama
-- lalu sama-sama menyimpan potongan yang sama → potongan ganda di RAG (pengguna Mametlite di HP: layar mati → unggah lagi).
--
-- `diproses_sampai`: rag-process memegang dokumen sampai waktu ini (±130 s, di atas batas keras 110 s) dan
-- melepasnya (null) saat panggilan berakhir — selesai, jeda anggaran, atau gagal. Panggilan lain yang datang selagi
-- terkunci ditolak sementara (423 SEDANG_DIPROSES); klien menunggu lalu mencoba lagi. Kunci yang tak sempat dilepas
-- (fungsi dihentikan platform) kedaluwarsa sendiri.

alter table public.documents
  add column if not exists diproses_sampai timestamptz;

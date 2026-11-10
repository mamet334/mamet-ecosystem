# 10 November 2026 — Item 131 sisa Tahap A: prafilter biner dicoba, lalu dibatalkan

Perintah Owner 10 Nov: *"mulai sisa tahap A"*; pilihan Owner **1 (prafilter biner)**, lalu *"boleh, buat migrasi
indeksnya"*, lalu — sesudah hasil dibandingkan — **2 (batalkan)**. Aplikasi tidak pernah memakai fungsi uji; tidak ada
kode server yang berubah.

## Akar lambat: CPU Nano, bukan disk dan bukan rumus

Pencarian gabungan menghitung jarak ke semua 12.445 potongan setiap pertanyaan. Diukur (semua dari memori,
`shared hit`, tanpa baca disk):

| Operasi (12.445 potongan) | Waktu |
|---|---|
| baca panjang teks | 68 ms |
| baca vektor saja | 426 ms |
| jarak vektor penuh | 4,8–5,3 s (Tahap A pernah 10–15 ms saat CPU sedang *burst*) |
| jarak biner 96 byte dari kolom tersimpan | 5,4 s |
| pencarian gabungan utuh | 13,7 s |

Jarak biner seharusnya jauh lebih murah daripada jarak 768 angka, tetapi waktunya sama: yang mahal adalah kueri panjang
yang membaca semua baris lewat fungsi ekstensi di CPU bersama paket gratis (dokumentasi Supabase: Nano–2XL bisa *burst*
sebentar lalu kembali ke batas dasar).

## Yang dicoba (semua dengan migrasi, semua sudah dibatalkan)

1. `20261110012257_vektor_biner_prafilter` — kolom `embedding_bit bit(768)` diisi otomatis (`generated … stored` dari
   `binary_quantize`, 0 beda dari 12.445), fungsi uji `match_documents_hybrid_biner`: 200 kandidat biner → jarak tepat.
   Tetap 11,3 s (kolom biner dipindai penuh).
2. `20261110012630_indeks_biner_hnsw` — indeks HNSW `bit_hamming_ops` (4,8 MB). Dipanggil langsung: 200 kandidat 0,7 s.
3. `20261110013000_kandidat_biner_pakai_indeks`, `20261110013227_kandidat_biner_batas_tetap`,
   `20261110013410_hybrid_biner_plpgsql` — fungsi `language sql` tetap 7–9,7 s karena direncanakan tanpa nilai
   parameter (kueri yang sama sebagai kueri biasa: 111 ms); versi `plpgsql` 1,5 s. Catatan: `set hnsw.*` di definisi
   fungsi ditolak (`permission denied`) bila pustaka pgvector belum termuat di sesi migrasi.
4. **Pembanding hasil** (4 kasus, vektor = jumlah dua potongan nyata, kata kunci berganti): irisan 8 teratas dengan
   fungsi lama hanya **2, 3, 1, 1 dari 8**. Sebab: (a) indeks HNSW biner melewatkan sebagian potongan terdekat (8 terdekat
   yang tertangkap: 3, 8, 7, 8; biner tanpa indeks 7, 8, 8, 8); (b) **utama** — fungsi lama memakai peringkat vektor
   *global* untuk potongan yang cocok kata kunci (mis. peringkat 1000 → nilai kecil), fungsi baru hanya tahu "di luar 200"
   → potongan kata kunci lebih sering menang. Peringkat global butuh jarak ke semua potongan — bagian yang lambat. Sama
   dengan temuan Tahap A: memotong kandidat mengubah hasil.
5. `20261110013827_batal_prafilter_biner` — fungsi uji, indeks, dan kolom dihapus; DB 154 → 149 MB; `match_documents_hybrid`
   tak tersentuh.

## Kesimpulan & sisa

- Di CPU Nano, hasil persis seperti sekarang hanya bisa cepat dengan **compute lebih besar** (keputusan biaya Owner,
  dilakukan di dashboard Supabase).
- Jalan lain yang belum diambil: ukur **mutu** (uji pengambilan Item 90 recall@8, set K1) untuk fungsi yang memotong
  kandidat, alih-alih kesamaan dengan fungsi lama.
- Sementara itu pencarian tetap 6–16 s lewat cadangan vektor; hasil tidak dibuang dan kegagalan disebut (Tahap A bagian 1
  + Tahap H).
- Pelajaran: setiap kueri pengukuran berat ikut menghabiskan jatah *burst* CPU; pengukuran dihentikan begitu akar
  terbukti.

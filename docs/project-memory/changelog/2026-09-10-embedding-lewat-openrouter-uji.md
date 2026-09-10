# Embedding Pindah ke OpenRouter — Hasil Uji

**Tanggal:** 10 September 2026
**Roadmap:** Item 63

## Pertanyaannya

Buku PDF 5 MB memakan berapa MB setelah dimasukkan ke RAG?

## Ukuran ditentukan jumlah huruf

PDF HCDP berukuran 7,4 MB dan 47 halaman, tapi teksnya hanya 138 ribu huruf — 33 potongan,
kira-kira **0,7 MB** di RAG. Foto dan grafik tidak ikut disimpan. Buku 300 halaman kira-kira
4 MB. PDF hasil scan tidak menghasilkan apa-apa, karena isinya gambar halaman, bukan huruf.

## Tidak ada jalur unggah PDF yang benar

- Research App di Mamet OS hanya menerima berkas teks.
- mametlite menerima PDF dan Word, tapi membaca **isi biner mentah** berkasnya, bukan tulisannya.
  Sudah begitu sejak mametlite dibuat. Database belum tercemar — belum ada PDF yang masuk lewat
  mametlite.

## Uji unggah: gagal karena jatah Gemini

HCDP diubah ke `.txt` lalu diunggah lewat Research App. Setelah 44 detik, Gemini menolak dengan
429 (terlalu banyak permintaan): dari tiga kunci sistem hanya satu yang hidup, dan kode menyerah
setelah menunggu 3 detik. Pembatalan berjalan rapi — tidak ada sisa di database. Tapi Research
App hanya menampilkan pesan umum, bukan alasan sebenarnya.

## Usul Owner: pakai OpenRouter

Chat sudah lewat OpenRouter; embedding sebaiknya ikut, dibayar dengan saldo. Syaratnya satu
model untuk semua vektor, karena vektor dari model berbeda tidak bisa dibandingkan.

**Uji tanding** — dijalankan Owner di aplikasinya sendiri, dengan kuncinya sendiri yang tidak
pernah dicetak:

| Model | Tebakan benar (7) | Harga per 1 juta token |
|---|---|---|
| Gemini (model sekarang) | 7 | $0,20 |
| bge-m3 | 7 | $0,01 |
| text-embedding-3-small | 6 | $0,02 |
| qwen3-embedding-4b | 6 | $0,02 |

Vektor Gemini lewat OpenRouter **identik** dengan yang tersimpan, jadi data lama tetap berlaku
tanpa diproses ulang.

Uji ini juga menjawab kenapa pencarian memori tidak pernah menemukan apa-apa: *"minuman apa
yang saya suka?"* skornya 0,683, sedangkan ambangnya 0,70.

## Keputusan Owner

- Tetap model Gemini, hanya jalurnya pindah ke OpenRouter.
- Yang membayar adalah pengguna, dengan kuncinya sendiri. Pengguna tanpa kunci OpenRouter tidak
  bisa memakai RAG.

## Uji dokumen HCDP lewat OpenRouter

| | Hasil |
|---|---|
| 33 potongan, dikirim dalam 3 kelompok | **3,4 detik**, 0 kali ditolak |
| Biaya | $0,0077 (±Rp120) |
| Jawaban benar di 5 hasil teratas | 8 dari 8 |
| Jebakan daftar isi | tidak tertipu |

Dokumen yang sama gagal setelah 44 detik lewat jalur lama. Ternyata batas waktu untuk buku tebal
bukan masalah bawaan — penyebabnya potongan dikirim satu per satu dengan jeda. Dikirim
berkelompok, buku 300 halaman cukup sekitar 20 detik.

Ambang pencarian dokumen sedikit terlalu ketat: satu jawaban benar (skor 0,649) terbuang oleh
ambang 0,65. Ambang sekitar 0,55 meloloskan semuanya, dan tetap jauh dari pertanyaan yang tidak
berhubungan (0,455).

## Berikutnya

Belum ada kode yang diubah. Rencananya: unggah dokumen, pencarian memori, dan pencarian dokumen
memakai kunci OpenRouter pengguna; potongan dikirim berkelompok; alasan gagal ditampilkan; ambang
dokumen diturunkan. Unggah PDF yang benar untuk mametlite dikerjakan terpisah.

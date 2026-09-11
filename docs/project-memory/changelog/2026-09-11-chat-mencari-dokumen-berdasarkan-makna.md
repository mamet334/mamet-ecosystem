# Chat Kini Mencari Dokumen Berdasarkan Makna

**Tanggal:** 11 September 2026
**Roadmap:** Item 65

## Sebelumnya

Item 64 membongkar bahwa chat Assistant dan mametlite tidak pernah memakai vektor dokumen:

- Dokumen dicari lewat **kata** — hanya ditemukan kalau pertanyaan menyebut kata dari judulnya.
- Kalau judulnya cocok, **seluruh dokumen** diseret ke prompt: 90 ribu token untuk satu pertanyaan.
- Pertanyaan pendek ("berapa …", "apa …") tidak mencari di dokumen sama sekali.
- Dokumen dicari dua kali, di aplikasi dan di server.

## Yang berubah

- **Semua jalur chat mencari berdasarkan makna** dan mengambil 5 potongan paling relevan (10
  untuk mametlite), bukan seluruh dokumen.
- **Pertanyaan pendek ikut mencari di dokumen** kalau tombol RAG menyala.
- Pencarian mencakup **semua ruang pengetahuan** Anda, kecuali ada ruang yang dipilih.
- Pencarian memakai **kunci OpenRouter Anda sendiri**. Kunci Gemini sistem tidak lagi dipakai untuk
  pencarian. Satu pertanyaan hanya perlu satu vektor, dipakai untuk memori sekaligus dokumen.
- Dokumen hanya dicari di server; aplikasi hanya mengurus pencarian web.

## Satu kegagalan yang ditimbulkan perubahan ini — dan perbaikannya

Pertanyaan pendek pertama yang diuji menjawab benar, lalu diblokir pemeriksa jawaban
("Verification Failed"). Pemeriksa itu menuntut kode sumber resmi setiap kali ada dokumen, dan
hanya chat biasa yang dikecualikan. Dulu pertanyaan pendek tak pernah membawa dokumen, jadi masalah
ini tak pernah muncul. Kini jalur pendek diperlakukan sama seperti chat biasa. Pemeriksaan ketat
untuk mode Engineer tetap berlaku.

## Bukti

| Pertanyaan desa & kelurahan OKU | Kemarin | Hari ini |
|---|---|---|
| Cara ditemukan | kata "HCDP" cocok dengan judul | makna, tanpa menyebut judul |
| Token | 90.116 | **6.725** |
| Biaya | $0,0112 | **$0,0010** |
| Jawaban | benar | benar — 14 kelurahan, 143 desa |

Pertanyaan anggaran klaster sertifikasi juga dijawab benar (Rp927.500.000), padahal di uji
sebelumnya potongannya berada di urutan ke-4 — masih di dalam 5 teratas.

## Catatan untuk pertanyaan Owner

Kegagalan pertama bukan karena mengirim terlalu cepat atau tanpa tanda tanya. Semua tahap sudah
selesai sebelum pemeriksa memblokir, dan tanda tanya tidak dilihat sistem. Pertanyaan yang sama bisa
lewat jalur berbeda tergantung panjang riwayat chat.

## Yang masih terbuka

- Memori yang ditemukan pencarian makna belum pernah masuk ke prompt.
- Prompt dasar chat Assistant masih sekitar 10 ribu token.
- Saat tombol Web menyala, pencarian web kini jalan di setiap pesan.
- Belum diuji: menyimpan memori, chat mametlite, dan pengguna tanpa kunci OpenRouter.

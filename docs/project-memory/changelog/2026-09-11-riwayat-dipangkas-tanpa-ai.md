# Riwayat Percakapan Dipangkas Tanpa AI — Jeda 36 Detik Hilang

**Tanggal:** 11 September 2026
**Roadmap:** Item 68

## Masalahnya

Saat menguji Item 67, chat ketiga (*"Jelaskan singkat apa itu inflasi"*) baru mulai dijawab
**43,6 detik** setelah dikirim. Log server menunjukkan penyebabnya: begitu riwayat percakapan
melebihi 4.000 huruf, sistem **meminta AI meringkas riwayat** — dan menunggu ringkasan itu selesai
sebelum melakukan apa pun. Kali itu makan **36,5 detik**.

Ringkasan itu juga lebih mahal daripada yang dihemat: $0,00022 untuk menghemat token senilai
±$0,00005. Ia memakai model pesan itu sendiri, jadi di tingkat THINKING bisa ±$0,002 per pesan,
dan diulang dari nol di setiap pesan berikutnya.

## Perbaikannya

Tanpa AI: dua pesan terakhir tetap utuh, pesan yang lebih lama dipotong ke 800 huruf pertama.
Awal jawaban sudah cukup untuk mengenali topik percakapan (Item 67 membuktikan tulis ulang
pertanyaan lanjutan tetap benar dengan potongan 800 huruf). Isi dokumen tetap diambil lewat
pencarian dokumen.

Sekalian: pesan Anda tidak lagi terkirim dua kali ke model. Riwayat dari aplikasi sudah memuat
pesan saat ini, lalu pesan yang sama dikirim lagi sebagai pertanyaan.

## Bukti di produksi

Tiga chat yang sama dalam satu sesi, jawaban dinyatakan benar oleh Owner:

| Chat "apa itu inflasi" | Sebelum | Sesudah |
|---|---|---|
| Merapikan riwayat | 36,5 detik, $0,00022 | seketika, $0 (4.571 → 2.670 huruf) |
| Sampai model mulai menjawab | **43,6 detik** | **5,0 detik** |
| Sampai jawaban selesai | lebih dari 60 detik | **20,2 detik** |

| Riwayat yang dikirim | Sebelum | Sesudah |
|---|---|---|
| Chat pertama | 1 pesan (pertanyaannya sendiri) | 0 pesan |
| Chat kedua | 3 pesan | 2 pesan |

## Konsekuensi yang disadari

Ringkasan AI menyimpan fakta dari seluruh percakapan panjang; pemangkasan bisa kehilangan fakta
yang terselip di tengah jawaban lama. Untuk pertanyaan tentang dokumen, isinya diambil lagi lewat
pencarian dokumen.

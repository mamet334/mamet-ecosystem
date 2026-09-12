# Potongan 800 Huruf dan Vektor 768 Angka

**Tanggal:** 11 September 2026
**Roadmap:** Item 70

## Pertanyaan Owner

Bisakah Mamet menjawab dari dokumen berbahasa Inggris ketika ditanya dalam bahasa Indonesia, dan
apakah perintah seperti `adb shell dumpsys battery reset` tetap utuh, tidak ikut diterjemahkan?

## Yang ditemukan saat diuji

Bahasa jawaban aman: penjelasan berbahasa Indonesia, perintah utuh di blok kode. Tapi
**pencariannya meleset.** Tiga pertanyaan tentang ebook mendapat skor 0,552 / 0,554 / 0,550 —
setara dengan dokumen yang tidak berhubungan — dan dua di antaranya dijawab dari pengetahuan umum
model, bukan dari buku. Padahal ketiga jawabannya ada di satu potongan yang sama.

Bukan bahasa yang jadi soal. Buktinya, pertanyaan bahasa Inggris **tidak lebih baik**, dan kalimat
`adb shell dumpsys battery reset` — yang tertulis persis di dalam potongan itu — hanya mendapat
skor **0,510** terhadapnya. Kalau teks yang persis sama saja tidak cocok, berarti vektor
potongannya kabur: satu potongan 4.500 huruf memuat 19 perintah dengan topik berbeda, sehingga
maknanya menjadi "daftar perintah adb secara umum".

## Yang diukur sebelum memutuskan

Potongan adb dipotong ulang dan dibandingkan dengan empat potongan bertopik lain:

| Pertanyaan | 4.500 huruf | 1.500 | 800 |
|---|---|---|---|
| Reset baterai (ID) | kalah dari pengecoh | menang | menang |
| Tangkapan layar (ID) | kalah | menang tipis | menang |
| Cadangan (ID) | kalah | seri | menang |

Dengan ukuran lama, potongan yang benar kalah di keenam pertanyaan uji. Dengan 800 huruf,
potongan yang berisi jawaban berada di peringkat pertama atau kedua di keenamnya.

Panjang vektor juga diuji: **768 angka sama bagusnya dengan 3.072**, peringkatnya sama persis,
dan ruangnya seperempat. Ambang pencarian memori diperiksa dengan pasangan memori yang dulu
dipakai untuk menetapkannya: urutannya tidak berubah.

## Perbaikannya

- Potongan 800 huruf (tumpang 100), berlaku untuk unggah dokumen dan "simpan ke workspace".
- Vektor 768 angka. Vektor yang sudah tersimpan cukup dipersingkat di database, **tanpa biaya
  embedding ulang**, karena model ini memang dirancang begitu.
- Chat mengambil 8 potongan, bukan 5.

## Bukti di produksi

| Pertanyaan | Sebelum | Sesudah |
|---|---|---|
| Reset baterai | 0,552, potongan lain | **0,735**, perintah persis dari buku |
| Tangkapan layar | 0,554, jawaban umum | **0,673**, `adb shell screencap -p …` versi buku |
| Cadangan | 0,550, jawaban umum | **0,616**, `adb backup -apk -all -f backup.ab` versi buku |

Ketiganya kini berlabel `VERIFIED`. Ebook 436 halaman tersimpan sebagai 827 potongan (3,2 MB)
dalam 53 detik, dan database turun dari 33 MB ke 28 MB sebelum unggah ulang.

Biaya per jawaban juga turun: dokumen yang dikirim ke model sekitar 7.300 huruf dari 8 potongan
yang tepat, dulu sampai 22.500 huruf dari 5 potongan yang kabur. Satu pertanyaan LOOKUP kini
3.218 token masuk, sebelumnya sekitar 6.700.

## Yang tersisa

- Pertanyaan bahasa Indonesia masih sekitar 0,05–0,10 di bawah pertanyaan bahasa Inggris untuk
  dokumen berbahasa Inggris. Kalau nanti ada yang meleset, pertanyaannya bisa diterjemahkan dulu.
- Dokumen lama masih berpotongan 4.500 huruf sampai diunggah ulang.
- Label `VERIFIED` hanya berarti "ada dokumen yang diberikan ke model", bukan bukti bahwa isi
  jawaban berasal dari dokumen itu.

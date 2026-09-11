# Prompt Terkirim Dua Kali — Token Masuk Turun Separuh

**Tanggal:** 11 September 2026
**Roadmap:** Item 66

## Diukur dulu

Setelah Item 65, chat Assistant dengan dokumen masih memakai ±17 ribu token, sementara jalur
LOOKUP hanya ±7 ribu untuk dokumen yang sama. Dugaan awal: "prompt dasar" jalur Assistant besar.

Dugaan itu tidak bisa dipercaya begitu saja — kedua jalur memakai model berbeda, dan model berbeda
menghitung token untuk teks yang sama secara berbeda. Maka dipasang alat ukur yang menghitung
**jumlah huruf** tiap bagian prompt: identitas, memori, dokumen, riwayat, dan pesan.

## Yang terukur

| Pertanyaan | Pertanyaan Anda | Yang dikirim sebagai "pesan" |
|---|---|---|
| "Jelaskan singkat apa itu inflasi" | 32 huruf | 32 huruf |
| "Menurut dokumen HCDP, jelaskan program…" | 80 huruf | **28.519 huruf** |

Setiap kali sistem memakai alat bantu (misalnya *knowledge manager*), jawaban akhir disusun lewat
jalur yang **menempelkan seluruh prompt sistem — termasuk semua dokumen — ke dalam pesan Anda**,
lalu mengirimnya lagi sebagai prompt sistem. Semuanya terkirim dua kali.

Prompt dasarnya sendiri ternyata kecil: ±5.300 huruf. Dugaan awal keliru.

## Perbaikan

Satu baris: prompt sistem tidak lagi ditempel ke pesan, karena sudah dikirim sebagai prompt sistem.

## Bukti

| Pertanyaan HCDP yang sama | Sebelum | Sesudah |
|---|---|---|
| Pesan | 28.519 huruf | 717 huruf |
| Token masuk | 15.272 | **7.626** |
| Jawaban | benar | benar, lebih rinci |

## Item 44 selesai

Misteri "99,3% belanja adalah prompt" punya dua penyebab, keduanya kini diperbaiki: dokumen yang
diseret seluruhnya ke prompt (Item 65), dan prompt yang terkirim dua kali (Item 66).

## Yang tersisa

- Biaya chat kini lebih banyak berasal dari **jawaban**: tingkat THINKING memakai model yang lebih
  mahal dan menulis jawaban panjang. Aturan kapan THINKING dipakai adalah keputusan Owner.
- Pertanyaan lanjutan seperti "Lanjutkan, apa kendalanya?" belum menemukan dokumen yang sedang
  dibahas.

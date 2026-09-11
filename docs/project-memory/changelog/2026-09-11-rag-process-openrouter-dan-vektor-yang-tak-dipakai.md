# Unggah Dokumen Kini 5,6 Detik — dan Vektor yang Tak Pernah Dipakai Chat

**Tanggal:** 10–11 September 2026
**Roadmap:** Item 64

## Yang dikerjakan

Unggah dokumen ke RAG (`rag-process`) ditulis ulang sesuai keputusan Item 63:

- Memakai kunci OpenRouter **milik pengguna**, dengan model yang sama seperti sebelumnya.
- Potongan dikirim **berkelompok**, bukan satu per satu dengan jeda.
- Kalau OpenRouter meminta menunggu, sistem menunggu sesuai sarannya.
- Dokumen yang terlalu besar dihentikan dengan rapi dan dibatalkan, bukan terputus di tengah jalan.
- **Celah keamanan ditutup:** dulu siapa pun yang tahu alamat fungsinya bisa menulis dokumen ke
  akun orang lain. Kini identitas diambil dari sesi login.
- Berkas PDF/Word yang terbaca mentah ditolak sebelum ada biaya.

Research App dan mametlite kini mengirim kunci pengguna dan menampilkan alasan gagal yang
sebenarnya. mametlite juga menolak unggahan tanpa kunci atau non-`.txt` **sebelum** menghapus
dokumen lama bernama sama.

## Bukti

| | Sebelum (Item 63) | Sesudah |
|---|---|---|
| HCDP, 33 potongan | gagal setelah 44 detik | **33/33 dalam 5,6 detik** |
| Kirim tanpa login dengan identitas palsu | diterima | ditolak |

## Uji chat: jawabannya benar, caranya tidak seperti yang diharapkan

Owner bertanya *"Menurut dokumen HCDP, berapa jumlah desa dan kelurahan …"* dan jawabannya
benar. Tapi log memperlihatkan bagaimana jawaban itu didapat:

1. Sistem mencocokkan kata "HCDP" dengan **judul** berkas, lalu mengambil 5 potongan pertama —
   sampul dan daftar isi. Jawabannya tidak ada di sana.
2. Karena itu sistem mengambil **seluruh dokumen** — 33 potongan, 143 ribu huruf — ke dalam prompt.
3. Satu pertanyaan menghabiskan **76.895 token ($0,0112, ±71 detik)** — lebih mahal daripada
   memvektorkan seluruh dokumen sekali.

## Temuan terbesar

**Chat Assistant dan mametlite tidak pernah mencari dokumen berdasarkan makna.** Keduanya
mencocokkan kata. Hanya mode Engineer yang memakai vektor. Artinya pengguna membayar untuk
memvektorkan dokumen yang tidak pernah dicari dengan vektor, dan pertanyaan yang tidak menyebut
kata dari judul berkas tidak menemukan dokumennya.

Ini juga menjelaskan mekanisme misteri Item 44 — kenapa prompt bisa belasan sampai puluhan ribu
token: dokumen yang judulnya cocok ikut terseret seluruhnya.

## Temuan lain

- Pertanyaan pendek yang diawali kata tanya ("berapa …", "apa …") lewat jalur ringan yang
  **tidak mencari di dokumen**, walau tombol RAG menyala.
- Research App otomatis memilih ruang pengetahuan terbaru, sehingga unggahan tidak masuk ke
  "My Core Knowledge".

## Berikutnya

Beberapa masalah ternyata satu: chat akan mencari dokumen berdasarkan makna — mengambil 5
potongan paling relevan, bukan seluruh dokumen. Perkiraan ±6 ribu token alih-alih ±77 ribu per
pertanyaan dokumen.

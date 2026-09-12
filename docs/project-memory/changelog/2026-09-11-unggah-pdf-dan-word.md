# Unggah RAG Menerima PDF dan Word

**Tanggal:** 11 September 2026
**Roadmap:** Item 69

## Masalahnya

Ebook dan dokumen kantor hampir selalu PDF atau Word, tapi unggah RAG hanya menerima `.txt`.
Penyebabnya: `rag-process` bekerja dengan teks, sedangkan aplikasi mengirim isi berkas mentah
(kode biner dan data terkompresi). Sejak Item 64 kiriman seperti itu ditolak supaya Anda tidak
membayar untuk memvektorkan sampah.

## Perbaikannya

Teks PDF dan Word kini diambil **di browser** sebelum dikirim. Pustakanya sudah lama ada di repo
tapi belum pernah dipakai. Ini berlaku di Research App dan mametlite, dari laptop maupun HP.

- Tombol unggah menunjukkan kemajuan, misalnya "Membaca halaman 120/436".
- Dokumen besar meminta konfirmasi lebih dulu, lengkap dengan perkiraan biaya embedding.
- Setiap halaman diberi penanda `[Halaman N]`, jadi jawaban bisa menyebut nomor halaman.
- Judul dan nomor halaman yang berulang dibuang, kata yang terpotong tanda hubung disambung.
- Ditolak dengan pesan jelas: PDF hasil scan, PDF berpassword, PDF rusak, `.doc` lama,
  berkas di atas 60 MB, dan teks yang hurufnya rusak.

Berkas aslinya tidak pernah disimpan di Supabase, hanya teksnya.

## Yang terukur

| Sumber | Waktu | Hasil |
|---|---|---|
| HCDP Word (DOCX) | 0,2 detik | 6.269 kata |
| HCDP PDF (dari Word 365) | 0,5 detik | 6.635 kata |
| HCDP PDF asli (dari Word 2007) | 0,8 detik | 6.438 kata |
| Ebook 436 halaman | 4,1 detik | 645 ribu huruf, tanpa huruf rusak |
| PDF hasil scan | seketika | ditolak, dengan alasan |

## Dua temuan di luar dugaan

**Sebagian PDF mencetak teksnya tiga kali.** PDF HCDP asli menuliskan setiap kalimat tiga kali di
posisi yang sama, untuk efek tebal atau bayangan, dan setiap salinan dipecah di titik berbeda.
Ekstraksi biasa menghasilkan 133 ribu huruf berantakan, bukan 60 ribu yang rapi. Ekstraktor
sekarang membuang salinan berdasarkan posisi dan menyambung potongan yang bertumpuk.

**HCDP yang tersimpan di RAG ternyata berisi teks tiga kali lipat** — akibat hal yang sama. Itu
sebabnya ia menjadi 33 potongan untuk isi yang cukup sekitar 15, dan pencarian kerap mengembalikan
salinan dari bagian yang sama.

## Yang menyelamatkan satu bug

Modul yang sama diuji dua kali: versi frontend dan salinan mametlite, yang memakai pustaka PDF versi
berbeda. Uji salinan mametlite menangkap satu bug: pustaka versi baru tidak lagi punya fungsi
penutup yang dipakai kode. Tanpa uji itu, unggah PDF di mametlite akan gagal di akhir proses.

## Yang tersisa

- PDF hasil scan butuh OCR, belum didukung.
- Ekstraksi di aplikasi desktop (Electron) belum diuji.

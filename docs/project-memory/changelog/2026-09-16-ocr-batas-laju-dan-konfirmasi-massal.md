# OCR PDF: Batas Laju Dikenali dari Isi Pesan, Halaman Gagal Dilewati, Konfirmasi OCR Massal

**Tanggal:** 16 September 2026
**Roadmap:** Item 86
**Status:** dikerjakan & diuji lokal; **belum terbukti live** (menunggu unggah ulang oleh Owner).

## Latar

Owner mengunggah buku **Kepbup Standar Kompetensi Jabatan** (Pemkab Ogan Komering Ulu, 18 MB) lewat
`mamet-ecosystem.vercel.app`. Unggahan batal di halaman ke-4 dengan pesan:

```
Gagal mengunggah dokumen: OCR gagal (400): {"error":{"message":"Failed to parse the file:
The document parsing engine is currently rate limited. Please retry shortly.","code":400, …}}
```

Dugaan awal Owner: berkasnya terlalu besar. **Bukan.** Pemeriksaan berkas di folder Downloads:

| Ukuran | 18 MB |
|---|---|
| Halaman | 1.004 |
| Halaman berisi teks ≥400 huruf | 983 |
| Halaman nyaris kosong (<50 huruf) | 5 |
| Halaman ditandai bertabel → diantrikan OCR | 939 |

Lapisan teks PDF sudah bagus; isinya memang tabel kompetensi per jabatan, sehingga `deteksiTabelHalaman`
(dua sinyal posisi: jeda antar kolom >25pt dan baris "yatim" >60pt) menandai hampir seluruh buku. OCR
opsional Item 76b yang dirancang untuk "beberapa halaman tabel" berubah jadi OCR satu buku penuh:
939 × $0,002 ≈ **$1,88** dan ±40 menit.

## Sebab kegagalan

1. **Batas laju tidak dikenali.** `STATUS_COBA_ULANG` hanya memuat 429/500/502/503/504. OpenRouter
   meneruskan batas laju mistral-ocr sebagai **400** dengan pesan "currently rate limited", sehingga
   percobaan ulang dilewati.
2. **Satu halaman gagal membatalkan semuanya.** `terapkanOcrHalaman` melempar galat pertama dan
   menghentikan seluruh unggahan.
3. **5 halaman serentak** memicu batas laju itu sejak halaman ke-4.

## Perubahan

- **`pdfOcrService.js`** (dan salinannya `mametlite/src/lib/pdfOcrService.js`):
  - `POLA_BATAS_LAJU` — galat sementara dikenali dari **isi pesan** (`rate limit`, `too many requests`,
    `retry shortly`, `try again`) selain dari status.
  - `PERCOBAAN_MAKS` 3 → 5; jeda 2, 4, 8, 16 s (maks 30 s) **+ pengacakan 0,75–1,25×** agar halaman yang
    kena batas laju bersamaan tidak mencoba ulang serentak; `Retry-After` tetap dihormati.
  - `OCR_SERENTAK` 5 → **2**.
  - `terapkanOcrHalaman` mengembalikan `{ peta, halamanGagal }`: halaman yang tetap gagal **dilewati**
    (teks pdf.js halaman itu tetap dipakai), bukan membatalkan unggahan. `onProgress` membawa `gagal`.
  - Baru: `OCR_BANYAK_HALAMAN = 100` dan `perkiraanMenitOcr()`.
- **`ResearchApp.jsx`** dan **`mametlite/src/App.jsx`**:
  - Di atas 100 halaman: **konfirmasi kedua** berisi perkiraan menit, perkiraan dolar, jumlah halaman
    serentak, dan keterangan bahwa halaman gagal dilewati.
  - Status unggah menampilkan jumlah yang dilewati (`OCR halaman 40/939 (2 dilewati)…`).
  - Sesudah selesai, halaman yang gagal dilaporkan ke pengguna (jumlah + nomor, 20 pertama).

## Uji (lokal, di luar git)

`uji-ocr.mjs` dengan `fetch` tiruan — **9/9 lolos**:
- 400 berisi "rate limited" → dicoba ulang sampai berhasil (3 panggilan), hasil OCR terbaca.
- 400 biasa ("Invalid PDF file") → **tidak** dicoba ulang, pesan asli diteruskan.
- 429 → tetap dicoba ulang.
- Batas laju terus-menerus → berhenti tepat di percobaan ke-5.
- Tetapan: `OCR_SERENTAK=2`, `OCR_BANYAK_HALAMAN=100`, perkiraan 939 halaman >30 menit.

Build: frontend ✅ (1 m 18 s), mametlite ✅ (9,5 s).

## Batas yang disadari

- **Belum diuji live** terhadap OpenRouter/mistral-ocr sungguhan.
- Deteksi tabel tetap menandai hampir seluruh buku seperti Kepbup; yang berubah hanya kejujuran biaya
  dan ketahanan terhadap batas laju, bukan jumlah halamannya. Menyaring halaman yang lapisan teksnya
  sudah lengkap (pilihan C yang ditawarkan ke Owner) **tidak** dikerjakan — Owner menegaskan mutu RAG di
  atas biaya, dan untuk buku ini bentuk tabelnya justru inti isinya.
- Perkiraan ±5 detik/halaman adalah dugaan kasar; angka sebenarnya tergantung jaringan dan antrean
  mistral-ocr.

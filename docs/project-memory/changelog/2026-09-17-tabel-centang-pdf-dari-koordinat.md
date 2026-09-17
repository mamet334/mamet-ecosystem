# Tabel Centang PDF — Kolom dari Koordinat pdf.js, Bukan dari OCR

**Tanggal:** 17 September 2026
**Roadmap:** Item 88 — Tahap 1 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md))
**Status:** selesai & diuji lokal; **belum live**. Tahap 2 (kalimat kontrak + aturan label di server) berikutnya.

## Latar

Uji live Item 87: "tingkat kepentingan pelatihan teknis Sekretaris DPRD" dijawab **"Perlu"** berlabel
VERIFIED. Yang benar **"Penting"**. mistral-ocr menggeser kolom centang satu ke kanan pada tabel berjudul
kolom bertingkat; model membaca tabel rusak itu dengan setia.

## Perubahan

- **Baru `tabelCentang.js`** (`frontend/src/core/runtime/services/` + salinan `mametlite/src/lib/`), murni
  tanpa impor. `bacaTabelCentang(items, { teksOcr, bawaan, nomorHalaman, itemsSebelumnya })`:
  - **A** — petakan setiap `√ ✓ ✔ ☑ ☒` (+ Wingdings U+F0FC/U+F0FE) ke judul kolom dan label barisnya,
    keluarkan blok `[TABEL CENTANG — … blok ini yang benar] … [/TABEL CENTANG]`.
  - **B** — `[TABEL CENTANG TIDAK PASTI …]` bila: tak ada judul sejajar; jumlah centang pdf.js ≠ OCR;
    OCR bercentang tetapi PDF tidak; judul bawaan berskala lain; centang tanpa teks baris di dekatnya.
- **`documentTextExtractor.js`** (web + Mametlite): `ekstrakPdfDariData` memanggil modul per halaman,
  membawa judul & item halaman sebelumnya, dan mengembalikan `halamanTabelCentang` /
  `halamanCentangTidakPasti`. `rakitTeksHalaman(halaman, tambahan)` menempel blok **sesudah** pembersihan
  judul/kaki halaman berulang — baris blok sama di ratusan halaman dan akan terbuang bila ikut diperiksa.
- Teks OCR / pdf.js **tidak ditulis ulang** (keputusan Owner §7.1). Hanya `teks` yang dikirim ke
  `rag-process`; kunci hasil baru tidak ikut terkirim.

## Aturan yang dipaksa data buku penuh

Versi pertama lolos **22/22** uji berkas 6 halaman, tetapi pada buku Kepbup penuh (1.008 halaman,
855 centang) hanya ±250 nilai yang berupa Mutlak/Penting/Perlu — sisanya "relevan", "bidang", "-".
Setiap perbaikan diukur ulang di buku penuh:

| Masalah (halaman bukti) | Aturan |
|---|---|
| Baris isi sel dipilih sebagai judul (185, 23, 613) | Judul = deret ≥2 teks pendek berhuruf; **baris tepat di bawahnya mulai di kolom paling kiri tabel** ("A. Pendidikan") |
| Centang Mutlak 28 pt di kanan x judulnya (23) | Kolom dari **dua aturan yang harus sepakat**: rentang mulai x judul & titik tengah antarpusat judul |
| Centang 4,5 pt di kiri x "Penting" (396); "2. Bidang Ilmu \| Seluruh disiplin ilmu" terpilih | Pusat centang di dalam lebar judul ±6 pt; **judul pertama di kanan label baris centang** |
| Judul asli hanya berjarak 9,9 pt (256) | Celah antarjudul bukan pembeda lagi (ambang 5 & 12 pt sama-sama 0 salah) |
| Hal. 257 berskala lain dari 256 — judul 256 membuat Penting terbaca Mutlak | Judul bawaan hanya untuk halaman tepat berikutnya dan bila **x centang sama** dengan yang sudah terpetakan |
| Judul di dasar hal. 30 tanpa centang, centang di hal. 31 | Judul dicari di halaman sebelumnya bila **x kolom paling kiri tabel sama ±1,5 pt** |
| 100 centang di tengah vertikal sel (59 halaman) | Label dari teks ±8 pt, ditandai "(label perkiraan)" + catatan; tanpa teks dekat → tidak pasti |
| "Pelatihan Administrator — Kepemimpinan" (504) | Awal kolom label hanya x yang jadi awal teks di ≥2 baris data (judul "Uraian" rata tengah) |
| "3. Fungsional - - √" menggugurkan judul (372) | "-" pengisi kolom bukan label |

## Uji (lokal, skrip di luar git)

- **Uji unit 30/30:** PDF asli (4 pelatihan → Penting, eselon III → Mutlak); **kontrol** tabel OCR tetap
  menaruh centang di "Perlu" sementara blok menyatakan Penting; rekaan B (jumlah beda, tanpa judul, judul
  bawaan melompat/berskala lain, tengah sel, dua centang sebaris).
- **Buku Kepbup penuh ($0):** 246 halaman bercentang, **836/855 terpetakan**, **0 beda** dari pembanding
  independen (oracle khusus Kepbup yang tahu kata Mutlak/Penting/Perlu); 19 centang di 11 halaman
  tidak pasti (63, 112, 241, 257, 325, 420, 527, 841, 842, 851, 871). Sempat 2 beda di hal. 257 — diperiksa
  ke koordinat: **oracle** yang salah (skala halaman berbeda). 10 halaman acak diperiksa manual.
  Halaman 334 dan sejenisnya memuat dua centang satu baris di PDF-nya → "Mutlak, Penting" (setia dokumen).
- **Regresi:** HCDP 47 hal., Operator Handbook 3 hal., KATALOG-PENDAS 295 hal., E-Book 52 hal. → teks
  **identik** dengan versi sebelum perubahan. Kepbup setelah blok dibuang → **identik**; waktu 8,5 → 8,1 s.
- **Salinan & build:** blok identik web (pdfjs 5.7) vs Mametlite (pdfjs 6.0) pada berkas uji & buku penuh;
  kode hasil obfuscator (opsi `vite.config.js`) sama di 1.008 halaman; `vite build` web & Mametlite lolos.

## Batas yang disadari

- **Biaya embedding** Kepbup +7% (blok 128.769 huruf).
- **Label perkiraan** di 54 halaman: kolom pasti, baris hanya perkiraan.
- **Pemotong 800 huruf** bisa memisahkan baris "Kolom:" dari butir blok — periksa di Tahap 3.
- **Belum ada kontrak/label server:** model belum diperintah bahwa blok ini yang berlaku (Tahap 2).
- **Dokumen lama tidak ikut terbaiki** — perlu unggah ulang.
- Aturan diukur pada satu buku; PDF lain bertabel centang bisa berperilaku beda (B menandai, bukan menebak).

# Data Tabel Rekonsiliasi ASN — Tahap 5: PDF Pindaian lewat OCR (Item 92)

**Tanggal:** 21 September 2026
**Roadmap:** Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md))
**Status:** ✅ selesai — Kel. Baturaja Lama (PDF saja) tersimpan & muncul di laporan kejanggalan; uji Tahap 1–5 lulus.

## Pengukuran (sebelum membangun)

- pdf.js ($0): **10/10 PDF = gambar pindaian**, 39 halaman, 0 huruf di lapisan teks → OCR wajib. `srt-pengantar
  rekon.doc` = surat pengantar, bukan data.
- OCR mistral-ocr seluruh halaman (±$0,078, dijalankan Owner dengan kuncinya sendiri lewat skrip di luar git; kunci
  tidak pernah tercetak). Hasil markdown dibandingkan dengan xlsx pasangannya:

| Pasangan | Orang PDF / xlsx | NIP tepat | L/P |
|---|---|---|---|
| Disdik (4 PDF) | 103 / 103 | 100 · **2 beda SATU digit (tetap tampak sah)** · 1 terpotong | 100% sama |
| Semidang Aji | 16 / 16 | 15 / 15 | 100% sama |
| Ulu Ogan | 10 / 10 | 6 · 4 terpotong (16–17 digit) | 100% sama |

Kesimpulan: jumlah orang & L/P dapat dipercaya; **NIP tidak** (±1,6% salah satu digit tanpa bisa dideteksi) → pratinjau
PDF memasang peringatan tetap "cocokkan NIP dengan berkas kertas".

## Yang dibuat

- `dataTabelAsnOcr.js` (baru, murni): markdown OCR → masukan pembaca yang sama dengan Excel (`bacaSheetAsn`).
  - Tabel lanjutan tanpa judul kolom disambung ke tabel berjudul; tabel yang mendahului judulnya (urutan halaman
    terbalik) disambung hanya bila berisi angka mirip NIP — **tabel surat pengantar tidak lagi terbaca sebagai orang**.
  - **Halaman dipindai dua kali** (Disdik fungsional hal. 1–2 = hal. 4–5) dikenali dari NIP (≥80% sama) → dilewati.
  - Tabel lanjutan dengan jumlah kolom berbeda dicatat; "=", "_", "—" hasil OCR → kosong.
  - Judul tanpa "#" / tanpa jenis jabatan → judul kolom jabatannya ("JABATAN SRUKTURAL").
  - **NIP terpotong** (14–20 digit ≠ 18) dicatat per orang (`nip_tak_lengkap`).
  - Baris asal disandikan **negatif** −(halaman×1000 + baris) supaya tak bentrok dengan baris Excel (RSUD sampai 1.095);
    tampil "hal. 3 baris 5" (`uraiBaris`/`labelBaris`).
- `bacaPdfAsn.js` (baru) + `pdfOcrService.hitungHalamanPdf`: OCR semua halaman dengan kunci pengguna, halaman gagal
  dicatat.
- Research App: tombol **"PDF → Data Tabel"** (PDF biasa tetap ke RAG lewat "Upload Dokumen"); jumlah halaman, biaya &
  lama ditanyakan dulu; hasilnya pratinjau yang sama dengan Excel + kotak peringatan OCR + catatan per halaman.
- `siapkanSimpan`: `ringkasan_sheet` menyimpan `sumber: 'ocr'` & halaman; usulan OPD membuang ".pdf".
- Laporan kejanggalan: jenis baru "NIP hasil OCR tidak 18 digit" (orangnya tidak ikut "tanpa NIP"); kolom Excel
  "Baris" menulis "hal. N baris M". `dataTabelAsnSaring.js` (dipakai server): chat menulis "hal. N baris M" —
  **aktif sesudah deploy agent-process**.

## Pembaca Excel ikut diperbaiki (ditemukan saat membandingkan)

- **Tingkat PIM yang tertulis menang atas kolomnya**: "PIM IV" di sel yang digabung melintasi kolom PIM II–IV (Semidang
  Aji, Sosoh Buay Rayap, Perdagangan, EDARAN) dulu selalu tercatat PIM II; salinan sel gabungan tidak lagi dihitung.
- **"Tidak ada" / "belum" = kosong**: Perdagangan menulis "Tidak ada" di kolom PIM — dulu terhitung **sudah PIM**.
- Baris templat bernama "-" / "=" bukan orang (53 berkas: 2.312 → 2.310).
- Judul kolom "AKHIR" sendirian = pendidikan akhir (OCR kehilangan sel gabungan "PENDIDIKAN"; ditemukan dari pratinjau
  Owner).
- Total 18 orang xlsx berubah PIM-nya; data tersimpan RSUD & INSPEKTORAT tidak terdampak (kunci chat 14/14/155/619 tetap).

## Bukti

- Uji `uji-data-tabel-asn-tahap5.mjs` (di luar git, hasil OCR nyata): **23/23 lulus**; Tahap 1–4 tetap lulus.
- Aplikasi (Owner): Kel. Baturaja Lama.pdf → 15 orang (struktural 5, pelaksana 10), catatan NIP 19 digit di hal. 3
  baris 7; sesudah perbaikan "AKHIR": pendidikan akhir 15/15 tersimpan, baris asal −2004…−4008, sumber `ocr`.
- Laporan kejanggalan Baturaja Lama: 2 perlu dibetulkan (satu **NIP 18 digit dengan TMT mustahil — salah baca OCR yang
  tertangkap pemeriksa susunan NIP**; satu NIP 19 digit), 1 perlu dilengkapi.

## Catatan

- Skrip ukur OCR v1 menulis hasil ke folder `mamet%20os%20ecosystem` (URL tanpa didekode) — dipindahkan & dihapus, skrip
  dibetulkan (`fileURLToPath`).
- Batas: salah baca OCR yang tetap membentuk NIP sah tidak bisa dideteksi kode — hanya dengan mencocokkan kertasnya.

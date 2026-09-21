# Data Tabel Rekonsiliasi ASN — Tahap 4: Laporan Kejanggalan per OPD (Item 92)

**Tanggal:** 21 September 2026
**Roadmap:** Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md))
**Status:** ✅ selesai — dicoba Owner di aplikasi; angka laporan sama persis dengan perkiraan uji.

## Yang dibuat

- `frontend/src/core/runtime/services/dataTabelAsnJanggal.js` (baru, murni, tanpa AI): `uraiNip`,
  `susunLaporanJanggal`, `lembarExcelOpd`, `lembarRingkasan`, `namaLembar`. Memeriksa berkas **aktif** dari data
  tersimpan; setiap butir membawa sheet, **baris Excel asal**, nama, NIP, keterangan.
  - **Perlu dibetulkan** (data bertentangan): JUMLAH ≠ jumlah orang, pembagian L/P di JUMLAH ≠ tanda per orang,
    **L/P ≠ digit ke-15 NIP**, **NIP mustahil** (tanggal lahir, TMT, usia diangkat < 17, digit jenis kelamin),
    **NIP juga di berkas aktif lain**, NIP ganda dalam berkas, nomor urut ganda, L & P sama-sama terisi.
  - **Perlu dilengkapi**: tanpa NIP (PPPK paruh waktu diberi catatan), jabatan kosong, L/P kosong — hanya bila sheet itu
    memang punya kolomnya (dari pemetaan tersimpan).
  - Susunan NIP: 8 tanggal lahir + 6 TMT (PNS `yyyymm`; **PPPK `yyyy` + kode `21`**) + 1 jenis kelamin + 3 urut. Tanpa
    aturan PPPK, 825 NIP PPPK di 53 berkas akan dituduh "TMT mustahil".
- `dataTabelAsnDb.js`: `ambilBahanLaporan` (berkas aktif + `ringkasan_sheet` + pegawai, per halaman 1.000).
- `bacaExcelAsn.js`: `unduhExcelJanggal` — Excel dibuat di perangkat (SheetJS yang sama), NIP ditulis sebagai teks.
- `LaporanKejanggalan.jsx` (baru) di Research App: ringkasan per OPD (diurutkan dari kesalahan terbanyak), rincian per
  OPD, saringan "hanya yang perlu dibetulkan", unduh Excel per OPD dan "semua OPD" (lembar Ringkasan + satu lembar per
  OPD). Laporan dibuang otomatis bila data tabel berubah (simpan/hapus/versi).

## Cacat pembaca yang ditemukan saat mengukur — diperbaiki

**Jenis kelamin salah baca** (`dataTabelAsn.js`): OPD menulis **huruf** "L"/"P" di sel yang digabung melintasi kolom L
& P (PU PR, Diskominfo, Sosoh Buay Rayap…) atau di kolom yang "salah" (RSUD: "L" di kolom P). Pembaca menilai posisi
kolom → "L & P sama-sama terisi" (jk kosong) atau terbalik. Kini huruf/kata yang tertulis menang; tanda (√, v, 1) tetap
menurut kolom; salinan sel gabungan bukan isian kedua.
- 53 berkas: "L & P sama-sama terisi" 218 → 3, L/P kosong 262 → 82.
- RSUD: 8 orang yang hurufnya di kolom "salah" — kedelapannya kini cocok dengan digit NIP.
- **Data RSUD tersimpan ikut salah** (L131 P425 kosong 3) → Owner mengunggah ulang sebagai versi lebih baru: L137 P420
  kosong 2 (versi lama menjadi riwayat).

## Bukti

- Uji `uji-data-tabel-asn-tahap4.mjs` (di luar git, `frontend/node_modules/.uji-rag/`): **26/26 lulus** — 48 berkas aktif:
  53 perlu dibetulkan, 373 perlu dilengkapi; JUMLAH salah Kel. Air Gading & Kel. Tanjung Agung; L/P ≠ NIP 14 orang;
  NIP tak sah hanya 6 (PPPK tidak dituduh); NIP di dua berkas (PERKIM ↔ EDARAN) dilaporkan di kedua sisi; RSUD 4 NIP
  ganda → 8 butir; berkas Excel 49 lembar ditulis & dibaca ulang, NIP bertipe teks. Uji Tahap 1–3 tetap lulus.
- Aplikasi (Owner): RSUD **15 / 158**, INSPEKTORAT **1 / 2** — sama persis dengan perkiraan; Excel RSUD terbuka dengan
  NIP utuh 18 digit.
- Temuan dari data (database): **ke-154 JFT RSUD tanpa jabatan semuanya PPPK** (kode 21: 142 angkatan 2024, 11 angkatan
  2025) + satu NIP "PPPK 2004" (ditandai tak sah; kemungkinan salah ketik 2024).

## Belum

- Kejanggalan lewat chat (chip Data Tabel) — menyusul bila dibutuhkan.
- Koreksi pemetaan kolom (ditunda sejak Tahap 2), Tahap 5 PDF/pindaian.

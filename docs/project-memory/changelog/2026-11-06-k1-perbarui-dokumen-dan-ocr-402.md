# Perbarui Dokumen (Nama Sama, Isi Berbeda) + OCR Berhenti Saat Saldo Habis (402)

**Tanggal:** 5–6 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1 langkah 3 (persiapan)
**Status:** ✅ live — migrasi `perbarui_dokumen` (platform 20261105174856) + `rag-process` **v84**; fungsi SQL diuji
langsung di database. ⏳ Uji pakai di aplikasi (unggah → ubah → perbarui) belum dijalankan — commit atas perintah Owner.

## Kenapa

Unggahan buku Kepbup utuh ke "kepbup oku" (5 Nov) selesai 2.880 potongan, tetapi saldo OpenRouter turun di bawah $0,50
di halaman ±442: **522 halaman** (442–1007) tetap dikirim satu per satu, semuanya ditolak 402, lalu unggahan jalan terus
dengan teks pdf.js tanpa bertanya. Hasilnya tak sah untuk uji K1. Memperbaikinya dulu berarti menghapus dokumen lalu
mengunggah dan membayar ulang seluruh embedding. Permintaan Owner: *"buat fitur 'perbarui dokumen' … untuk sebuah
dokumen yang namanya sama tapi isinya berbeda"*, ditambah OCR berhenti dan bertanya saat 402.

## Yang dipasang

**Perbarui dokumen** (Ecosystem + Mametlite, server):
- Klien: judul selesai yang sama **di workspace yang dipilih** → satu konfirmasi (OK = perbarui, Batal = lewati).
  Judul sama di workspace lain tetap dilewati (unggahan ganda 17 Sep). Mametlite: "menimpa" kini = perbarui; versi lama
  hanya dihapus klien bila server tidak memperbaruinya (server lama / isi sama → tak dihapus).
- `rag-process`: `perbarui: true` → cari versi selesai berjudul sama di ruang yang sama.
  - Sidik & jumlah potongan sama → `sama: true`, tanpa embedding, tanpa perubahan.
  - Berbeda → versi baru dibangun di samping versi lama (`documents.menggantikan`); chat tetap memakai versi lama
    sampai versi baru selesai; versi lama dihapus **sesudah** versi baru selesai (disaring `user_id`).
  - Per kelompok 32: `potongan_lama_ada` menandai potongan yang isinya sama dengan versi lama (bervektor) → vektornya
    **disalin di dalam database**, hanya sisanya di-embed lewat OpenRouter.
  - Putus di tengah → lanjutan (bahkan tanpa penanda) membaca `menggantikan`; versi lama terhapus pengguna di
    tengah → `menggantikan` jadi NULL, sisanya di-embed biasa.
- Migrasi `20261105030000_perbarui_dokumen.sql`: kolom `menggantikan` (FK ON DELETE SET NULL), `potongan_lama_ada`,
  `simpan_kelompok_perbarui` (satu perintah per kelompok, **atomik**: satu salinan hilang → seluruh kelompok ditolak,
  karena titik lanjut dihitung dari jumlah potongan). Keduanya memeriksa pemilik versi lama = pemilik versi baru; hanya
  service_role (K5).

**OCR berhenti saat 402** (`pdfOcrService.js`, dua salinan): satu halaman 402 → tak ada halaman lain dikirim; halaman
di cache tetap dipakai (gratis); sisanya `halamanBelum` + `saldoHabis`. Klien bertanya: OK = lanjut tanpa OCR untuk
halaman itu, Batal (bawaan aman) = hentikan — Ecosystem melempar 402 sehingga berkas berikutnya ikut berhenti.

## Bukti

- **Platform:** migrasi tercatat `20261105174856 perbarui_dokumen`; kolom `menggantikan` uuid, FK `confdeltype = n`
  (SET NULL); kedua fungsi: anon ✗, authenticated ✗, service_role ✓. `rag-process` v84 ACTIVE — 8 berkas paket sama
  persis dengan repo (`index.ts`, `batas_volume.ts`, `deno.json`, 5 modul `agent-process/lib`).
- **Uji SQL live** (blok DO dengan data sintetis, dibatalkan di akhir; sisa 0 dokumen/0 potongan uji):
  `potongan_lama_ada` = {1,3} (hanya isi sama & bervektor); simpan 3 potongan (2 salinan + 1 baru), vektor salinan
  identik; urutan fisik terjaga (`C,X,A,Y`); salinan hilang → ditolak utuh; potongan lama tanpa vektor → ditolak; versi
  lama milik akun lain → ditolak; versi lama dihapus → `menggantikan` NULL. Catatan: `id` potongan = UUID acak, jadi
  `order by id` tidak mencerminkan urutan sisip (percobaan pertama tampak salah karena itu); tak ada kode yang
  bergantung pada urutan potongan.
- **Uji** `uji/uji-unggah-bertahap.mjs` +34 pemeriksaan: §1c 14 (perbarui penuh: 20 di-embed, 110 disalin; isi sama;
  tanpa penanda; putus & lanjut; kelompok gagal atomik; versi lama hilang di tengah; jumlah tersimpan kurang → 500;
  `menggantikan` akun lain tak terhapus), §4 4 (402), §6 16 (klien + migrasi, pemeriksaan teks sumber — bukti lebih
  lemah, dilengkapi uji SQL live). Mutasi di salinan **30/30** baru (dua sempat hidup — saringan pemilik saat menghapus
  & cek jumlah tersimpan — dua uji ditambah) + **36/36** lama. Suite **158/158**; bundel esbuild `rag-process` &
  `agent-process` OK.
- Kapasitas: akun Owner 12.296 potongan; selama perbarui buku (±2.900 lama + ±3.000 baru bersamaan) tetap < 25.000.

## Belum

- Uji pakai di aplikasi: dokumen pendek di "random test" → ubah satu paragraf → Perbarui (harus: "diperbarui, N
  potongan tak berubah", satu dokumen) → unggah lagi tanpa ubah (harus: "isinya sama persis").
- 💳 Buku Kepbup: isi saldo → unggah ulang "Kepbup Standar Kompetensi Jabatan(1).pdf" (nama persis) → Perbarui → K1/K2
  penuh. VACUUM FULL (130 → 96 MB) dicatat bersama langkah 3.

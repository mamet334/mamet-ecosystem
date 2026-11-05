# Research App — Pilih Banyak Dokumen untuk Dihapus + Daftar Tak Lagi Berlomba

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) Parkir (diambil Owner) · K1 langkah 3 (persiapan)
**Status:** ✅ terbukti di `npm run desktop` (klien Ecosystem saja; tanpa server, tanpa migrasi).

## Kenapa

221 Kepbup pecahan harus dihapus sebelum buku utuh diunggah (K1 langkah 3); tombol hapus hanya satu per satu, jadi
Owner menghapusnya lewat SQL Editor (diperiksa: "kepbup oku" 0 dokumen, HCDP utuh di "My Core Knowledge", 0 potongan
yatim; DB 130 MB menunggu VACUUM FULL). Permintaan Owner: memilih banyak dokumen lalu menghapusnya sekaligus.

Satu baris daftar = satu dokumen utuh; menghapusnya membuang semua potongannya (`ON DELETE CASCADE`). 221 baris
Kepbup dulu adalah 221 berkas terpisah (buku dipecah sebelum unggah bertahap ada), bukan potongan satu dokumen.

## Yang dipasang

- `hapusDokumen.js` (murni): `hapusDokumenBanyak` — berkelompok 20 id, potongan dulu lalu dokumen (sama dengan hapus
  satu), baris terhapus diminta kembali (DELETE tanpa baris tetap sukses), berhenti di galat pertama dengan laporan
  jujur (terhapus / belum diproses / tak ditemukan); `buatPenjagaTerbaru`; `ringkasRuang`.
- `BilahPilihDokumen.jsx` + `ResearchApp.jsx`: kotak centang per baris (baris terpilih berbingkai), "Pilih semua yang
  tampil", Batal, **Hapus terpilih**. Konfirmasi menyebut jumlah, **asal workspace tiap dokumen**, ≤10 judul, "Tidak
  bisa dibatalkan". Hanya dokumen yang tampil DAN dipilih yang dihapus; pilihan dikosongkan saat workspace/pencarian
  berganti. Warna memakai token tema (Item 128), bukan `slate-*`.
- **Daftar tak lagi berlomba** (Parkir yang diambil karena kini menyangkut keamanan data): sesudah muat ulang, daftar
  tanpa saringan workspace bisa datang belakangan dan menimpa daftar yang benar — "pilih semua → hapus" pada daftar itu
  akan menghapus dokumen workspace lain. Kini jawaban pemuatan yang usang dibuang (`buatPenjagaTerbaru`).

## Bukti live

Owner memilih 2 dokumen di "random test" lalu menghapus: log 15:38 UTC `DELETE document_chunks?document_id=in.(…)` 204
lalu `DELETE documents?id=in.(…)` 200; "random test" tersisa Kamus; 0 potongan yatim; workspace lain utuh
(sejarah aplikasi 385, Pengetahuan Engineer 6, My Core Knowledge 1).

## Uji

`uji/uji-hapus-dokumen-banyak.mjs` (baru, 18 pemeriksaan): penghapus dengan database tiruan berisi (kelompok, urutan,
dokumen lain utuh, ganda/kosong, tak ditemukan, galat di tengah & di potongan), penjaga terbaru, ringkas ruang,
sambungan di ResearchApp, dan 32 kelas tampilan dikompilasi Tailwind sungguhan. Mutasi di salinan **13/13** (5 sambungan
ResearchApp dibunuh pemeriksaan teks sumber — bukti lebih lemah; perilaku dibuktikan live). `uji-ciri-tampilan` sempat
merah (5 kelas `slate-*` baru) → diganti token tema. Suite **158/158**.

Gerbang GitHub sempat merah sesudah push (`ee7552c2`, run 42057388216): satu pemeriksaan teks sumber memakai pola
`\n`, sedangkan checkout GitHub ber-CRLF (J3c). Direproduksi pada salinan CRLF (gagal persis sama), diperbaiki dengan
menyeragamkan akhir baris saat membaca; lulus di salinan CRLF dan di laptop.

Belum: Mametlite tidak punya hapus banyak (daftarnya kecil di bilah sisi) — bila perlu, menyusul.

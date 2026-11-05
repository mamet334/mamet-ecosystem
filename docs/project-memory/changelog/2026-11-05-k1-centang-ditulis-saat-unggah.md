# K1 Langkah 1 — Tanda Centang Ditulis sebagai Kata saat Unggah

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1/K2 langkah 1 · Item 88 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md))
**Status:** ✅ klien (Ecosystem + Mametlite, logika identik), tanpa perubahan server. Dokumen yang sudah ada di RAG baru
ikut benar sesudah diunggah ulang (langkah 3).

## Masalah

Tabel OCR menggeser sel (uraian memakan dua sel, sel kosong berlebih/kurang), jadi posisi "√" di baris Markdown tidak
menunjukkan kolomnya. Jabatan 177: `| C. | Pengalaman Kerja | 2 tahun di eselon IV | | Ö | | |` terbaca Penting, padahal
di PDF tanda itu di bawah **Mutlak** (BUKU-10, 4 dari 5 salah). Blok `[TABEL CENTANG]` yang benar sering di potongan
lain (68% potongan tabel tanpa bloknya), dan blok 177 keliru berkata TIDAK PASTI karena "Ö" tidak dihitung.

## Yang dipasang (tanpa LLM — keputusan Owner)

Kolom tetap dibaca dari koordinat pdf.js (Item 88); sekarang **juga ditulis di samping tandanya**: `| √ |` → `| √ Mutlak |`.
Blok `[TABEL CENTANG]` tetap ditempel untuk pemeriksa label server.

- **Halaman OCR — `tulisCentangDiTeks`:** tanda ke-k di PDF ↔ tanda ke-k di teks OCR (urutan baca). Ditulis hanya bila
  jumlah sama, semua tanda PDF terpetakan & berlabel, baris OCR tiap tanda berbagi kata dengan labelnya, dan baris itu
  **tidak** sama-mirip atau lebih mirip label tanda lain yang berkolom berbeda. Satu syarat gagal → halaman apa adanya.
- **Halaman pdf.js — `tulisCentangDiItems`:** teksnya disusun dari item pdf.js yang sama, jadi kolom ditulis langsung pada
  item tanda — pasti per tanda (pemasangan urutan tak cocok: teks pdf.js mengikuti urutan aliran, "√" sering sendirian).
- **"Ö" dihitung** bila sendirian di sel tabel (`| Ö |`), bukan di dalam kata.
- `bacaTabelCentang` mengembalikan `tanda` (kolom, label, kunci per tanda); ekstraktor melapor `halamanCentangDitulis`.

Berkas: `frontend/src/core/runtime/services/{tabelCentang,documentTextExtractor}.js` dan salinannya di
`mametlite/src/lib/` (izin Owner: "mametlite ikut diubah karena enginenya sama").

## Bahan ukur: OCR nyata 217 halaman ($0,43)

`uji/ukur-ocr-centang.js` (modul konsol, dijalankan Owner di `npm run desktop`) meng-OCR hanya halaman yang di-OCR
aplikasi **dan** bertanda centang, dari 222 Kepbup pecahan, lalu mengunduh hasilnya (data di `uji/data-lokal/`, di luar
git). Jalan pertama (`oc-1`) melewatkan 17 berkas sebagai "PDF rusak": **cacat alat uji**, bukan berkas — nama dengan
"," / "&" disandikan `encodeURIComponent`, Vite tidak menerjemahkan balik `%2C`/`%26` dan mengirim index.html. Tepat 17
dari 222 nama memuatnya; berkasnya utuh (`%PDF-1.7`, ukuran sama). `oc-2` memakai `encodeURI` dan berhenti bila yang
terambil bukan PDF; 17 berkas di-OCR susulan. Unggahan sungguhan tak terdampak (berkas diterima langsung).

## Hasil di korpus (221 berkas; 000 = pindaian)

| Ukuran | Hasil |
|---|---|
| Halaman bercentang ditulis | **210 / 247** — OCR 181/217, pdf.js 29/30 |
| Pasangan sengaja digeser satu (daya penjaga) | 188 ditolak · 3 lolos tanpa mengubah kata (kolom sama) · **0 lolos mengubah kata** |
| Kemiripan kata label ↔ baris OCR yang ditulisi | terendah 0,50; 16 di bawah 0,75 diperiksa mata — semua baris yang benar |
| 177 hal. 3 | `Diklat Teknis … Ö Penting`, `Pengalaman Kerja … Ö Mutlak` = kunci BUKU-10; "di teks OCR 0" hilang |

Penjaga dibentuk dari ukuran, bukan dugaan: penjaga satu kata saja meloloskan 4 geseran berbahaya (052/053/077/099:
"Diklat Teknis yang relevan…" ↔ "Pengalaman Kerja…") → ditambah syarat "paling mirip"; syarat itu sempat menolak 057
(satu baris dicentang di tiga kolom) → label identik dikecualikan; label serba kata umum ("2. Sedang atau pernah")
dan baris OCR yang ikut disaring kata umum sempat menolak 004/007/009 → diperbaiki. Penolakan yang tersisa wajar: OCR
memecah sel (baris tanda tanpa kata), label PDF hanya "2", jumlah tanda beda, atau tanda PDF tak pasti — halaman itu
tetap mengandalkan blok.

Sisa rancangan lama di roadmap ("<syarat> — Tingkat: Mutlak" per baris) tidak dipakai: menulis di sel tanda sudah membuat
baris tabel dan potongan yang terpisah dari bloknya benar, tanpa menyusun ulang tabel.

## Uji

`uji/uji-tulis-centang.mjs` (baru) — 39 kasus: §1–§4 tanpa data (CI): hitung "Ö", pemasangan & semua penjaga (177, 052,
057, 004), penulisan item (asli tak berubah, salinan cetak-ulang), ujung ke ujung `ekstrakPdfDariData` dengan pdfjs
tiruan; §5 korpus + OCR nyata (dilewati tanpa `uji/data-lokal`). Mutasi di salinan **16/17** mati; yang hidup ekuivalen
(saringan `t.kolom` di `tulisCentangDiItems` dijaga dua kali). Mutan "tanpa cek jumlah" mati karena uji mogok, bukan
pernyataan. `uji-salinan-mametlite` lulus. Suite **156/156**.

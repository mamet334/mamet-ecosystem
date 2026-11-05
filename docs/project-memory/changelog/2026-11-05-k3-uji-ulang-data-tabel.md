# K3 Uji Ulang Data Tabel ASN — 5/5 VERIFIED, NIP Tidak ke Model

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K3 · Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md))
**Status:** ✅ K3 final (uji ulang sebelum rilis, keputusan ADR-0022). Tanpa perubahan kode.

## Cara

Pertanyaan sama dengan uji live 21 Sep ([log](./2026-09-21-data-tabel-asn-tahap3-tanya-jawab.md)), dijalankan Owner di
Ecosystem desktop: satu chat baru, chip RAG + Data Tabel menyala, 5 pertanyaan berurutan. Kunci dihitung **lebih dulu**
langsung dari database (SQL hitungan, berkas aktif = `digantikan_oleh is null`) — pembanding independen dari jalur
perencana → saringan → penutup jawaban. Pemeriksaan hanya mengambil baris "📊 Hasil hitung sistem" (ditulis kode,
tanpa data pribadi), label, dan **hitungan** deret 18 digit; nama & NIP tidak dikeluarkan dari database.

## Hasil (chat `97d86e0a…`, 08:25 UTC)

| # | Pertanyaan | Hasil hitung sistem | Kunci DB | Label | NIP di jawaban (ada di DB) |
|---|---|---|---|---|---|
| 1 | Pejabat struktural RSUD | 14 | 14 | VERIFIED | 14 (14) |
| 2 | Struktural RSUD belum PIM | 14 · PIM BELUM ADA | 14 | VERIFIED | 14 (14) |
| 3 | JFT RSUD belum pelatihan teknis/fungsional | 155 | 155 (dari 411) | VERIFIED | 154 (154) |
| 4 | Struktural Inspektorat per PIM | 8: II+III+IV 1, III+IV 1, IV 5, belum 1 | sama | VERIFIED | 8 (8) |
| 5 | Seluruh pegawai semua OPD | 634 | 634 | VERIFIED | 0 |

- **0 NIP karangan:** 190 deret 18 digit di jawaban, 190 ada di `asn_pegawai`. Soal 3: 155 orang, 154 NIP — 1 orang di
  kelompok itu tak punya NIP 18 digit di database (angka 155/154 sama dengan uji otomatis Sep).
- **0 NIP ke model:** konteks final (`SYSTEM CONTEXT`, memuat blok "Data Tabel Rekonsiliasi ASN") ada di langkah
  proses kelima jawaban; 0 deret 18 digit di dalamnya.
- Soal 1–4 sama dengan 21 Sep. Soal 5: 619 → 634 karena KELURAHAN BATURAJA LAMA (15 orang) masuk sesudahnya —
  data aktif kini INSPEKTORAT 60, KELURAHAN BATURAJA LAMA 15, RSUD 559.

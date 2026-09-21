# Set Uji Pengambilan Buku Kepbup Penuh — recall@8 13/14 (Item 88)

**Tanggal:** 21 September 2026
**Roadmap:** Item 88 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md)), alat ukur dari Item 90 Tahap A–B
**Status:** ✅ set uji dibuat & dijalankan Owner di `npm run desktop`; RPC `match_documents_hybrid`.

## Kenapa set baru

Set Item 90 Tahap A disusun saat korpus 2 dokumen / 105 potongan. Korpus sekarang **221 jabatan Kepbup /
3.368 potongan** — dokumen nyaris kembar (26 Camat/Sekretaris Camat), jadi pertanyaan lama tidak lagi menguji
risiko yang nyata: tertukar antar jabatan.

## Set: 14 pertanyaan berbukti + 2 jebakan

Berkas `frontend/node_modules/.uji-rag/set-uji-buku-penuh.json` (di luar git). Kunci jawaban dibaca dari **PDF
pecahan asli**; teks bukti dicocokkan ke `document_chunks` (jalur OCR, bukan pdf.js). Tiap bukti diperiksa
lewat SQL: **hanya cocok ke satu dokumen** yang dimaksud. Sebaran: awal buku (012, 060, 100), tengah (119, 139,
140, 159, 170, 177), akhir (191, 196, 204, 214, 221).

Skrip penjalan `uji-pengambilan-v4.js` = v3 + opsi `{ set: '<berkas>.json' }` (nama berkas baru karena Vite tak
memantau `node_modules`).

## Hasil (2026-09-21, hybrid)

**recall@8 = 13/14.** Kontrol skor: RPC 0,7964991 = cosine lokal 0,7964991.

| Pertanyaan | Peringkat bukti | Skor |
|---|---|---|
| BUKU-01 pangkat Camat Lengkiti (satu-satunya IV/b) | 1 | 0,797 |
| BUKU-02 pangkat Camat Muara Jaya | 2 | 0,798 |
| BUKU-03 diklat teknis Camat Baturaja Timur | 4 | 0,811 |
| BUKU-04 diklat teknis Sekcam Lubuk Batang | 1 | 0,814 |
| BUKU-05 bidang ilmu Sekdin Kesehatan | 1 | 0,738 |
| BUKU-06 diklat teknis Kadis PMD (Tiyuh/Desa) | 1 | 0,833 |
| BUKU-07 pengalaman Irban Wilayah IV | 5 | 0,788 |
| BUKU-08 indikator kinerja Sekban Bapenda | 2 | 0,770 |
| BUKU-09 bidang ilmu Sekdin Perumahan | 1 | 0,789 |
| **BUKU-10 tingkat kepentingan Damkar (177)** | **90** | 0,697 |
| BUKU-11 ikhtisar Kabid Kewaspadaan (191, tanpa konteks) | 2 | 0,793 |
| BUKU-12 ikhtisar Penempatan Tenaga Kerja | 1 | 0,842 |
| BUKU-13 sektor Bidang Destinasi (kembar dengan 138) | 2 | 0,727 |
| BUKU-14 ikhtisar Kabid Lalu Lintas (159) | 8 | 0,809 |

Yang dibuktikan:
- **Identitas tidak tertukar** — 4 pertanyaan Camat/Sekcam membawa kecamatan yang tepat ke peringkat atas.
- **191 tetap terambil (peringkat 2)** walau tanpa baris konteks → keputusan "keterbatasan" aman, bukan pasrah.
- **139 menang atas 138** yang kalimat ikhtisarnya hampir sama (beda kata terakhir).

## Temuan baru: BUKU-10 — potongan blok centang miskin kata (belum diperbaiki)

Peringkat 1 **sudah dokumen 177 yang benar**; yang tidak terambil adalah **potongan blok centang** (peringkat 90).
Isi potongan itu praktis hanya blok:

```
- (label perkiraan) Manajemen → Penting
- (label perkiraan) Kerja → Mutlak
```

Tanpa kata "diklat", "pelatihan", atau "pengalaman kerja" — kata yang dipakai penanya. Label baris jadi perkiraan
karena tanda centang di halaman itu berada di tengah sel.

**Tidak diperbaiki sekarang:** perbaikannya mengubah cara blok centang ditulis (menyertakan nama baris asli) →
menyentuh pengolahan semua PDF, sedang **code freeze**; dan satu kasus belum cukup jadi dasar aturan baru.
Masuk daftar pekerjaan sesudah Kepbup.

## Catatan teknis

`match_documents_hybrid` mengembalikan **1.000 potongan** teratas walau diminta 5.000. Tidak memengaruhi uji ini
(semua bukti berada di dalam 1.000), tetapi peringkat bukti di bawah 1.000 tidak akan terukur.

## Jebakan (NEG)

Dua pertanyaan tanpa jawaban di buku (gaji pokok Camat, nama pejabat) tetap membawa 8 potongan ke konteks dengan
skor ke-1 0,745 dan 0,671 — bertumpuk dengan skor bukti pertanyaan benar. Sama seperti U4 Item 90: ambang bukan
jalan keluar, penjaganya label jawaban.

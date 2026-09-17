# Konteks Potongan: Bagian Tidak Tercampur & Baris Identitas Jabatan (Item 89 = Item 90 Tahap C)

**Tanggal:** 17 September 2026
**Roadmap:** Item 89 ([`ROADMAP-KONTEKS-POTONGAN-RAG.md`](../../roadmap/ROADMAP-KONTEKS-POTONGAN-RAG.md)), Item 90 Tahap C, menutup Item 88 Tahap 3
**Status:** selesai & terbukti live — `rag-process` + `agent-process` di-deploy Owner, berkas uji diunggah ulang (`b604d31b`, 19 potongan).

## Masalah (sesudah Tahap B)

Pencarian gabungan sudah mengambil potongan bukti Kepbup (14/14), tetapi di #2–#5: potongan tabel persyaratan
tidak memuat nama jabatan (hanya halaman 1 yang memuatnya — potongan itu menempel di #1 untuk semua pertanyaan
"… Sekretaris DPRD"), dan tabel OCR gabungan menempelkan baris kompetensi no. 15 sebagai judul tabel di atas
persyaratan. Q1 live v455 dijawab "Penting" tanpa menyebut pelatihannya.

## Tahap 0 — pola diukur di teks ekstraksi nyata ($0)

Pengekstrak aplikasi dijalankan di Node pada berkas asli: buku Kepbup penuh (1.008 hal.), berkas uji, HCDP DOCX,
KATALOG-PENDAS (295 hal.), 3 hal. Operator Handbook.

- Judul bagian Romawi: Kepbup penuh 660 (I/II/III per jabatan), KATALOG 10 (5 di daftar isi), HCDP & Operator 0.
- "Nama Jabatan": 221 baris / 220 jabatan; **nama berulang** (13× Camat, 13× Sekretaris Camat, 6× Sekretaris) →
  pembeda "Urusan Pemerintah" (220 baris). Satu nilai terlipat ke baris berikutnya.
- Pola "kunci : nilai" umum ditolak: menangkap halaman redaksi KATALOG, daftar negara Operator Handbook, dan
  blok `Kolom: Mutlak | Penting | Perlu` Item 88 (200×).
- Daftar isi ("II. PENUTUP 275") dan tempelan pdf.js ("II.STANDAR KOMPETENSI") ditangani.
- **Keputusan Owner:** baris konteks hanya untuk dokumen yang identitasnya terdeteksi (bukan semua unggahan) —
  menghindari penurunan skor Item 76 pada dokumen tanpa identitas.

## Kode

| Berkas | Isi |
|---|---|
| `agent-process/lib/konteks_potongan.ts` (baru, murni) | `judulBagian`, `petaKonteks` (Nama Jabatan + Urusan Pemerintah, bagian Romawi), `tambahKonteks`, `akhirSebelumBagian` (jendela 60%), `awalBagianSesudah` (perpanjangan maju 240 huruf) |
| `agent-process/lib/potong_teks.ts` (baru) | `chunkText` dipindah dari `vector_utils.ts` agar kode yang sama diuji di Node; potong tepat sebelum judul bagian, potongan berikutnya dimulai di judul tanpa tumpang tindih; baris `[Konteks: Nama Jabatan: … · Urusan Pemerintah: … › III. PERSYARATAN JABATAN]` |
| `agent-process/lib/judul_tabel.ts` | judul tabel tidak diulang melewati judul bagian |
| `agent-process/lib/vector_utils.ts` | mengekspor ulang `chunkText`, `UKURAN_POTONGAN`, `TUMPANG_POTONGAN` (pemanggil tak berubah) |

## Tahap 1 — uji Node (kode HEAD vs baru, teks sama)

| Dokumen | Potongan | Berkonteks | Bercampur dua bagian | Kalimat hilang |
|---|---|---|---|---|
| Berkas uji (hal. 6 = tabel OCR) | 16 → 16 | 15 | 2 → 1 (pembuka hal. 1) | 0 |
| Kepbup penuh (pdf.js) | 2.509 → 2.565 | 2.344 | 520 → 78 (23 di luar potongan pembuka jabatan) | 0 |
| HCDP | 87 → 87 **identik** | 0 | 0 | 0 * |
| Operator Handbook | **identik** | 0 | 0 | 0 |
| KATALOG | 635 → 637 | 0 | 5 → 2 | 0 |

\* satu kalimat >800 huruf terbelah dua — sama dengan pemotong lama. Kontrol: pemotong lama menempelkan baris
"Advokasi" di potongan pelatihan; baru tidak.

## Tahap 2 — skor keluaran kode sebelum deploy (< $0,002)

Skrip `uji-konteks-potongan.js`: embedding 17 pertanyaan + 32 potongan (16 lama, 16 baru). Peringkat kata kunci
dihitung di Node dan **dibuktikan sama dengan Postgres**: `ts_rank_cd` = 0,1 × kemunculan (525/525), 87/87
potongan HCDP cocok md5, penghitung identik 16/16 pertanyaan (meniru "teknis/metode/sistem" = satu token dan
"-2026" = bilangan bertanda). Gabungan RRF: KEP-06 #7 → #1, KEP-03/04/05 #2 → #1, skor bukti +0,07–0,11; KEP-02
0,654 → 0,630 (tetap #1); HCDP identik.

## Kesalahan yang ketahuan di unggahan live pertama

Fixture memakai pdf.js untuk hal. 2–5; unggahan asli memakai OCR (baris tabel ±200 huruf). Dengan jendela 30%
potongan `7198b14a` masih mencampur baris kompetensi 4,2/4,3 + persyaratan dan **baris konteksnya salah**
("› II. STANDAR KOMPETENSI"). Diuji ulang pada teks hal. 5–6 asli di **81 posisi awal potongan** (pengisi 0–800
huruf): jendela 30% → 41 bercampur; 60% → 25; **60% + perpanjangan maju 240 huruf → 0**, tanpa potongan < 250
huruf. Pelajaran sama dengan Item 88: satu posisi uji menipu.

Unggahan kedua sempat ganda: daftar Research App desktop basi sehingga "hapus" menyasar dokumen yang sudah
terhapus (log API: 204, 0 baris) — diperbaiki terpisah (Item 91).

## Tahap 3 — bukti live

- **Database:** 19 potongan, 18 berkonteks, 0 bercampur; potongan pelatihan diawali
  `[Konteks: Nama Jabatan: Sekretaris Dewan Perwakilan Rakyat Daerah · Urusan Pemerintah: Kesekretariatan › III. PERSYARATAN JABATAN]`.
- **Set uji `uji-pengambilan-v3.js` hybrid (08:56 UTC, korpus 106):** recall@8 **14/14**; kontrol skor sama.

| ID | Tahap B | Tahap C live | Skor bukti |
|---|---|---|---|
| KEP-01 | #3 | **#1** | 0,648 → 0,765 |
| KEP-03 | #2 | **#1** | 0,643 → 0,813 |
| KEP-04 | #2 | **#1** | 0,662 → 0,788 |
| KEP-05 | #5 | **#1** | 0,649 → 0,764 |
| KEP-06 | #3 | **#1** | 0,690 → 0,785 |
| KEP-02 | #1 | #1 | 0,636 → 0,630 |
| HCDP-01..08 | #1–#3 | sama | sama |

- **Chat web live (08:57 UTC), log `[RAG] Pencarian gabungan vektor+kata`:**
  - Q1 "Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?" → Tata Naska Dinas: Penting; Sertifikasi
    Barang Dan Jasa: Penting; Perencanaan dan Keuangan: Penting — `[STATUS: VERIFIED]` (sesuai PDF hal. 6).
  - Q2 "Pengalaman kerja apa yang mutlak?" → Pernah Menduduki Jabatan eselon III — `[STATUS: VERIFIED]`.

## Batas yang disadari

- Pertanyaan NEG tetap membawa potongan ke konteks (NEG-02 kini potongan Kepbup); penjaga = label.
- Buku Kepbup penuh (pdf.js) masih 23 potongan bercampur di luar pembuka jabatan; baru terukur dampaknya bila buku
  penuh diunggah (keputusan 3 Item 88).
- Pola identitas hanya "Nama Jabatan"; dokumen jenis lain tanpa konteks sampai polanya diukur.

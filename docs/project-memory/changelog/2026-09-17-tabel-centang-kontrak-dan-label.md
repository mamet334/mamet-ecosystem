# Tabel Centang PDF — Kontrak Jawaban & Penurunan Label VERIFIED

**Tanggal:** 17 September 2026
**Roadmap:** Item 88 — Tahap 2 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md))
**Status:** selesai, diuji lokal, **dideploy** (`agent-process` v453); bukti chat live menunggu Tahap 3.

## Latar

Tahap 1 menempelkan blok `[TABEL CENTANG …]` (kolom dari koordinat PDF) dan penanda
`[TABEL CENTANG TIDAK PASTI …]` ke teks unggahan. Tanpa Tahap 2 model belum diperintah bahwa blok itu yang
berlaku, dan pemeriksa label tidak mengenal pertentangan kolom — jawaban live 17 Sep 00.36 UTC
"Ketiganya memiliki tingkat kepentingan 'Perlu'" (seharusnya "Penting") lolos sebagai VERIFIED.

## Perubahan (`supabase/functions/agent-process/lib/verification/`)

- **`universal_contract.ts`** — BLOK 6 (Evidence Gate PASSED): satu kalimat TABEL CENTANG — nilai kolom
  untuk baris yang tercantum di blok wajib dari blok, bukan tabel Markdown/OCR; butir "(label perkiraan)"
  dicocokkan barisnya; halaman bertanda tidak pasti tidak boleh VERIFIED untuk nilai kolom. **Hanya
  disisipkan bila konteks RAG memuat `[TABEL CENTANG`** — dokumen lain tidak menanggung prompt tambahan.
- **`label_sumber.ts`** — `bacaBlokCentang` + `periksaTabelCentang`, dijalankan sesudah pemeriksaan sumber,
  halaman, rujukan, dan angka (jalur stream & non-stream memakai `periksaLabelSumber` yang sama):
  1. **Bertentangan:** jawaban menyebut nilai kolom yang tidak dimiliki baris-baris blok yang dibahas
     jawaban → HYPOTHESIS. Baris blok "dibahas" bila ≥60% kata labelnya ada di jawaban; dinilai per
     jawaban karena model menulis butir di baris terpisah lalu satu kalimat "Ketiganya … 'Perlu'".
  2. **Tidak pasti:** potongan bertanda tidak pasti + jawaban menyebut nilai kolom → HYPOTHESIS, catatan
     menyebut halamannya.
  - Nilai kolom dihitung hanya bila hurufnya persis nama kolom dan bukan awal kalimat ("Anda perlu…",
    "Penting dicatat…" bukan nilai); baris yang menyebut semua nama kolom sekaligus (menjelaskan skala)
    tidak dihitung.

## Uji (lokal, skrip di luar git) — 15/15

Potongan dibuat dari ekstraktor Tahap 1 pada berkas uji (hal. 6 dengan tabel OCR bergeser) lalu dipotong
`chunkText` server; blok utuh dalam satu potongan.

| Kasus | Hasil |
|---|---|
| Jawaban live asli ("Perlu", dengan `<think>`) | **diturunkan** — "bertentangan dengan blok TABEL CENTANG (… Penting)" |
| 6 jawaban benar bergaya model (daftar + "Penting", Penting+Mutlak, tabel jawaban, penjelasan skala, kata "perlu" biasa, tanpa nilai kolom) | tetap VERIFIED |
| 3 jawaban salah (eselon III "Penting", tabel "Perlu", **Perlu** tebal di awal baris) | diturunkan |
| Sumber tidak pasti + nilai kolom / tanpa nilai kolom | diturunkan (hal. 841 disebut) / tetap VERIFIED |
| Dokumen tanpa blok | pemeriksaan diam |
| Kontrak dengan / tanpa blok di RAG | kalimat ada / tidak ada |
| **Kontrol:** `label_sumber.ts` versi sebelumnya | kelima kasus penurunan **lolos VERIFIED** |

Bundel esbuild `agent-process` & `rag-process` lolos (Deno tidak terpasang di laptop; deploy Owner lolos).

## Batas yang disadari

- Parafrase nama baris yang jauh (<60% kata label) → pertentangan tak terdeteksi (label tidak diturunkan;
  jawaban benar juga tidak dirusak).
- Aturan tidak pasti berlaku untuk seluruh jawaban bila satu potongan bertanda — bisa menurunkan jawaban
  yang nilainya dari halaman lain (aman ke arah HYPOTHESIS; Kepbup: 11 dari 1.008 halaman bertanda).
- Belum terbukti live: perlu unggah ulang berkas uji dari frontend yang sudah memuat Tahap 1 (Tahap 3).

## Susulan — uji live v453 & perbaikan per kalimat (v454)

**Uji live v453 (chat `33e249a7…`, 02.10–02.11 UTC)** sesudah push frontend Tahap 1 dan unggah ulang berkas uji:
- Potongan tersimpan: 18 potongan; blok `[TABEL CENTANG]` **utuh dalam satu potongan** bersama tabel
  pengalaman kerja; isi blok benar (4 pelatihan Penting, eselon III Mutlak).
- "Pengalaman kerja apa yang mutlak?" (mode ASSISTANT): konteks memuat blok + kalimat kontrak; jawaban
  benar (eselon III, Mutlak) tetapi **diturunkan** — kalimat "…pelatihan yang hanya berstatus 'Penting'
  atau 'Perlu'". "Perlu" memang keliru (tak ada centang Perlu di jabatan ini; kemungkinan dari tabel OCR),
  tetapi pemeriksa per-jawaban juga menyalahkan "Penting" dan catatannya ("…: Mutlak") membingungkan.

**Perbaikan (`label_sumber.ts`, v454):** dinilai **per kalimat**. Nilai kolom yang tidak dimiliki baris mana
pun di blok → diturunkan dengan alasan itu. Selain itu nilai dibandingkan dengan baris yang dibahas kalimat
(≥60% kata label; bila tidak ada, baris yang dibahas jawaban) ditambah baris yang berbagi kata khas
(≥5 huruf, bukan kata umum/nama kolom) — "pelatihan" membuat "Penting" sah di kalimat eselon III.
Uji 18/18 (tambahan: potongan tersimpan asli + jawaban live asli sebelum dikoreksi → turun karena "Perlu"
saja; tanpa "atau 'Perlu'" → tetap VERIFIED); kontrol versi lama gagal di 7 kasus penurunan.
Deploy pertama gagal (timeout esm.sh di server build Supabase, bukan kode); ulang → **v454**.

**Uji live v454 (chat `b803e6f3…`, 02.19–02.20 UTC):** "Pengalaman kerja apa yang mutlak?" → eselon III,
**Mutlak**, `[STATUS: VERIFIED]`; konteks memuat blok + kontrak.

**Temuan terbuka (bukan Item 88):** "Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?" dua kali
berjalan di **mode LOOKUP**; 8 potongan terambil (sufficiency 0,702), sebagian besar HCDP, **tanpa potongan
tabel persyaratan** → jawaban pengetahuan umum berlabel HYPOTHESIS (jujur, tetapi dokumen tak terpakai).
Dugaan belum terbukti: kedua potongan persyaratan diawali judul tabel berulang "| 15 | Advokasi kebijakan
Otonomi Daerah | …" — OCR menggabungkan tabel kompetensi & persyaratan hal. 6, lalu `tambahJudulTabel`
(Item 76) memakai baris kompetensi no. 15 sebagai judul, sehingga makna potongan tercampur.

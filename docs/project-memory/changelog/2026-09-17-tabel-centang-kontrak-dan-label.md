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

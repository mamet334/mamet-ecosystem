# Uji Mutu RAG Putaran 6–7: Pasangan Angka–Tahun di Kalimat Bebas, Sumber Parafrase Diterima

**Tanggal:** 14–15 September 2026
**Roadmap:** Item 78 (putaran 6–7) dan Item 81
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`
**Status:** dideploy (`agent-process` v436, 2026-09-15 02.37.37 UTC; isi kode aktif diperiksa). Uji mutu dinyatakan cukup.

## Putaran 6 (v435, 2026-09-14 15.01 UTC)

Berkas `hasil-uji-rag-2026-09-14T15-01-11-156Z.json`. Skrip set uji sudah mengambil token ulang per pertanyaan.

- 26 panggilan, **0 galat**. Isi jawaban dokumen 22/22 (20 benar + 2 perlu cek HCDP-04 menyalin deret tabel), **0 salah**.
- 1 label layak turun: HCDP-07 #2 "±43% / ±57%". 0 label keliru turun. NEG-01/NEG-02 semua INSUFFICIENT.
- KAT-02 (Sumber tanpa kutip, putaran 4) VERIFIED dua kali.

## Keputusan Owner sesudah putaran 5

1. **Pasangan angka dan tahun di kalimat biasa mulai diperiksa** (HCDP-03 #1 putaran 5: "tahun 5 adalah 80%", dokumen
   80,0 poin di kolom Tahun 5; "80%" di dokumen ada di tabel IKU kolom "Target").
2. **Sumber berupa parafrase judul diterima bila sebagian besar teksnya cocok dengan dokumen** (HCDP-07 #1 putaran 5).

## Perubahan `label_sumber.ts`

**`periksaPasanganKalimat`** — dipanggil di akhir `periksaAngkaSumber`. Sengaja sempit agar jawaban benar tidak turun:
- hanya kalimat di luar tabel yang memuat **tepat satu periode** ("tahun 5", "tahun ke-3", "tahun ketiga", "thn 2",
  "tahun 2025") dan **tepat satu angka** berdesimal/berpersen;
- sah bila angka itu ada di kolom periode tersebut ("Tahun 5", "Thn 5", "2025", "Target 2025") atau periodenya disebut
  di baris yang sama;
- **diturunkan hanya bila dokumen punya kolom periode itu tetapi angkanya tidak ada di sana**;
- dibiarkan bila angka juga tertulis di teks biasa, ada di baris tabel tanpa judul kolom, atau dokumen tak punya kolom
  periode itu (tidak bisa dibuktikan salah).

**`parafraseDiIsi`** — kutipan Sumber (berkutip atau tanpa kutip) diterima bila deret kata **berurutan** terpanjang yang
tertulis di satu potongan minimal **6 kata dan 60%** kata kutipan. Berurutan, bukan kata tersebar, supaya kata-kata umum
dokumen tidak bisa dirangkai menjadi judul karangan.

## Uji

`uji-label-putaran6.mjs` membandingkan pemeriksa lama dan baru pada **132 jawaban VERIFIED asli model** (putaran 1–6,
dengan konteks yang benar-benar dibaca). Berubah 6, semuanya ditelaah:

| Jawaban | Lama → baru | Penilaian |
|---|---|---|
| P5 HCDP-03 #1 "tahun 5 adalah 80%" | lolos → turun | tepat (sasaran) |
| P1 HCDP-03 #1/#2, P2 HCDP-03 #1 | lolos → turun | tepat: menambahkan "dokumen menyebutkan … 80% pada tahun 5" |
| P5 HCDP-07 #1 Sumber parafrase (11/17 kata berurutan) | turun → lolos | tepat, isi benar |
| P3 HCDP-04 #2 Sumber = judul "Tabel 2.6 …" di dokumen | turun → lolos | sesuai keputusan parafrase, isi benar |

Kontrol: "tahun ke-2 adalah 72,0" (72,0 = Tahun 3) turun; "tahun ketiga adalah 72,0" dan "80% pada tahun 2025" bertahan;
Sumber karangan yang meminjam nama daerah dan kata dokumen yang diacak tetap turun. Regresi `uji-label-angka`,
desktop, produksi putaran 1 (2 ekspektasi HCDP-03 kini turun), `uji-label-think`, `uji-label-judul-rujukan`,
`uji-label-putaran4` (1 kontrol disesuaikan, lihat batas) — semua lolos.

**Deploy v436** — penanda di kode aktif: `periksaPasanganKalimat`, `parafraseDiIsi`, `PARAFRASE_MIN_PORSI`,
`menilai JAWABAN AKHIR`.

## Putaran 7 (v436, 2026-09-15 02.50 UTC)

Berkas `hasil-uji-rag-2026-09-15T02-50-47-246Z.json`.

| Ukuran | P4 | P5 | P6 | **P7** |
|---|---|---|---|---|
| Isi jawaban dokumen benar | 22/22 | 16/17 | 22/22 | **22/22** |
| Salah | 0 | 1 | 0 | **0** |
| Label keliru diturunkan | 2 | 0 | 0 | **0** |
| Galat | 0 | 9 | 0 | **0** |

- **Sumber parafrase terbukti live:** HCDP-07 #2 `Sumber: Dokumen Perencanaan Pengembangan Kompetensi ASN (HCDP) Kabupaten
  Ogan Komering Ulu Tahun 2025-2026.` tetap VERIFIED.
- Pemeriksaan pasangan kalimat tidak terpicu — semua jawaban tahun benar.
- HCDP-04 #1 turun karena "kenaikan 3%" (88 − 85) hitungan model di jawaban akhir; isi benar, sesuai aturan angka.
- Log: `Coordinator LLM Error: GeminiAdapter RATE_LIMIT` (403) berulang 02.47–02.50 UTC; semua jawaban tetap keluar.

## Batas yang disadari (tidak dikejar)

Owner: uji mutu cukup, jangan mengejar sempurna.
- Kalimat dengan dua angka atau lebih tidak dipasangkan.
- Judul Sumber benar + tambahan karangan di baris yang sama ("… dan data internal lain") kini diterima.
- Angka hitungan model di jawaban akhir (selisih, persentase kira-kira) menurunkan label walau isi benar.
- Gemini koordinator 403 perlu dicek terpisah bila kuncinya masih dimaksudkan dipakai.

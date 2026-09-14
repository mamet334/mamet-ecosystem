# Uji Mutu RAG Putaran 4–5: Label Menilai Jawaban Akhir Saja, Sumber Tanpa Kutip Diterima

**Tanggal:** 14 September 2026
**Roadmap:** Item 78 (putaran 4–5) dan Item 80
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`; `graphify-out/` (graf kode)
**Status:** dideploy (`agent-process` v435, 2026-09-14 14.40.57 UTC; isi kode aktif diperiksa)

## Putaran 4 (v434, Thinking menyala → jalur hybrid, 14.32 UTC)

Berkas `hasil-uji-rag-2026-09-14T14-32-40-489Z.json`. 26 panggilan, 0 galat.

| Ukuran | P1 | P2 | P3 | **P4** |
|---|---|---|---|---|
| Isi jawaban dokumen benar | 22/22 | 22/22 | 21/21 | **22/22** (20 benar + 2 perlu cek HCDP-04 menyalin deret tabel) |
| Potongan benar terambil | 22/22 | 22/22 | 21/21 | 22/22 |
| Tanpa label / galat | 0/0 | 0/0 | 0/1 | 0/0 |
| Label keliru diturunkan | 4 | 0 | 0 | **2** |
| Label layak diturunkan | 2 | 1 | 3 | 1 |

- Jalur hybrid terpakai set uji: konteks tersimpan 26/26, nalar di 24/26 jawaban. Penilai terbaru terpakai (perintah
  konsol `?t=${Date.now()}`).
- **HCDP-07 #2 — layak turun:** "±43% / ±57%" hitungan model di jawaban akhir.
- **HCDP-07 #1 — keliru turun karena NALAR:** jawaban akhir bersih; model mengecek di nalar
  *"3.548 + 1.164 = 4.712, tidak sama dengan 4.828"*. Diperiksa ulang tanpa nalar → lolos. Ini dampak keputusan
  `0a50452` (angka & halaman di nalar ikut diperiksa) yang sudah diperingatkan.
- **KAT-02 #2 — keliru turun:** `Sumber: Katalog Kurikulum FEB, FHISIP, FKIP …` **tanpa tanda kutip**; aturan
  "judul di dalam dokumen" (putaran 1) hanya membaca teks berkutip.
- Biaya DeepSeek per jawaban bergantung penyedia hulu: $0,000075–$0,00204 (±27×) untuk token sebanding; sebagian
  pertanyaan dilayani `openai/gpt-4o-mini` (tier kecil — tanpa token nalar, menulis `<think>` karena perintah prompt).
  Waktu terlama 45,7 s.

## Keputusan Owner B dan perbaikan

Pilihan yang diajukan: **A** angka di nalar tetap diperiksa (paling ketat, jawaban benar bisa turun karena model
menghitung/mengecek) atau **B** hanya jawaban akhir yang diperiksa. **Owner memilih B.**

`label_sumber.ts` (`periksaLabelSumber`):
1. **Halaman, rujukan, dan angka** kini dibaca dari jawaban di luar `<think>` (`tampil`), sama seperti label dan Sumber.
   Nalar tetap ditampilkan apa adanya. Menggantikan keputusan `0a50452`.
2. **Sumber tanpa tanda kutip:** sisa baris sesudah `Sumber:` (≥20 huruf setelah dirapikan, titik penutup dibuang)
   diterima bila tertulis utuh di isi potongan terlampir — melengkapi aturan kutipan berkutip putaran 1.

**Uji.**
- `uji-label-putaran4.mjs` 7/7 pada jawaban & konteks produksi putaran 4: HCDP-07 #1 kini bertahan; HCDP-07 #2 tetap
  turun; KAT-02 #2 kini bertahan; kontrol tetap turun (judul karangan tanpa kutip, <20 huruf, tambahan karangan di baris
  Sumber); 19 jawaban VERIFIED lain tidak berubah.
- `uji-label-think.mjs` 11/11 — dua ekspektasi dibalik sesuai B (angka hitungan & halaman/rujukan karangan hanya di
  nalar → bertahan); angka karangan di jawaban akhir tetap turun; label/Sumber hanya di nalar tetap turun.
- Regresi lolos: `uji-label-angka`, desktop, 24 jawaban produksi putaran 1, `uji-label-judul-rujukan` 15/15. Sintaks OK.

**Deploy v435** — penanda di kode aktif: `menilai JAWABAN AKHIR`, `periksaAngkaSumber(tampil`,
`periksaHalamanSumber(tampil`, `periksaRujukanSumber(tampil`, `Tanpa tanda kutip juga diterima`; `periksaAngkaSumber(teks` 0.

## Putaran 5 (v435, 14.46 UTC) — hanya 17 dari 26 terjawab

Berkas `hasil-uji-rag-2026-09-14T14-46-02-243Z.json`.

- **9 galat "Unauthorized: Invalid or expired token"** mulai KAT-01 #2 (KAT, NEG tidak terjawab). Penyebab di skrip set
  uji, bukan server: `jalankan-uji-rag.js` mengambil `access_token` SEKALI di awal lalu dipakai untuk semua panggilan;
  sesi habis di tengah. Diperbaiki di skrip (di luar git): token diambil ulang sebelum setiap pertanyaan.
- 17 terjawab: isi 14 benar, 2 perlu cek (HCDP-04, deret tabel), **1 salah**.
- **HCDP-03 #1 — salah dan tetap VERIFIED:** "Target IP-ASN pada tahun 5 adalah **80%**", padahal tabel program menulis
  **80,0 poin** untuk Tahun 5; "80%" di dokumen adalah target IKU untuk 2025. Lolos karena angka 80% memang ada di
  dokumen dan pasangan angka–tahun di kalimat bebas belum diperiksa. **Ini contoh nyata pertama** untuk celah itu
  (HCDP-03 #2 putaran 3 "80% pada tahun 2025" justru benar).
- **HCDP-07 #1 — diturunkan (Sumber parafrase):** `Sumber: Dokumen Perencanaan Pengembangan Kompetensi ASN (Human
  Capital Development Plan/HCDP) Kabupaten Ogan Komering Ulu Tahun 2025–2026.` — potongan terpanjang yang tertulis di
  dokumen hanya "pengembangan kompetensi asn human capital development plan hcdp kabupaten ogan komering ulu"; teks utuh
  tidak ada. Isi jawaban benar. Aturan sengaja menuntut teks utuh; tidak dilonggarkan tanpa keputusan Owner.
- HCDP-07 #2 VERIFIED tanpa "±43/57%". Log: satu `[LABEL]` (HCDP-07 #1), tanpa galat server.
- Keputusan B belum teramati live pada kasus nalar berangka; KAT-02 tanpa kutip tidak sempat dijalankan.

## Graf kode (graphify)

Owner memindai repo dengan graphify dari commit `5c02a45`: `graphify-out/GRAPH_REPORT.md` dan `graph.json` diperbarui
(1.950 node, 2.794 edge, 237 komunitas); folder `graphify-out/2026-09-14/` berisi salinan keluaran. Ikut di-commit atas
permintaan Owner.

## Belum dikerjakan

- Pasangan angka–tahun di kalimat bebas (HCDP-03 #1 putaran 5 = contoh nyata yang salah).
- Sumber berupa parafrase judul (HCDP-07 #1 putaran 5) — perlu keputusan: tetap ketat atau terima kecocokan sebagian.
- Putaran 6 lengkap dengan skrip yang mengambil token ulang, untuk bukti live keputusan B dan Sumber tanpa kutip.

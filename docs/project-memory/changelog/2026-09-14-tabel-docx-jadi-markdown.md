# Tabel DOCX Dibaca sebagai Tabel, dan Riset Jalur PDF untuk RAG

**Tanggal:** 14 September 2026
**Roadmap:** Item 76
**Commit kode:** `1c0e03e`

Berawal dari pertanyaan Owner: dokumen di RAG ditulis untuk manusia, sedangkan pembacanya AI — apakah
ekstraksi dan embedding sudah menyiapkannya untuk kebutuhan RAG? Jawabannya: embedding hanya mengubah
teks menjadi angka, tidak merapikan apa pun. Kerusakan terjadi sebelumnya, saat teks diambil dari
berkas — dan yang paling rusak adalah **tabel**.

Yang dipasang di Item 76 hanya jalur `.docx` (gratis). Jalur PDF masih riset; angkanya dicatat di
bagian akhir agar tidak hilang.

## 1. Tabel DOCX

**Masalah.** `mammoth.extractRawText` mengeluarkan setiap sel sebagai paragraf sendiri:

```
No
Sasaran Strategis
Indikator Kinerja Utama (IKU)
Satuan
1
Meningkatnya profesionalisme dan kompetensi ASN
…
```

Urutannya masih per baris, tetapi judul kolom hanya muncul sekali. Mulai baris ke-2 model tidak tahu
lagi mana "Satuan" dan mana "Target". Dua paragraf dalam satu sel juga ditempel tanpa spasi
(`Waktu(Kenaikan pangkat`).

**Perbaikan.** `ekstrakTeksDokumen` kini memakai `mammoth.convertToHtml`, yang masih menyimpan baris
dan kolom, lalu `teksDariHtmlDocx` menulis tabel sebagai baris Markdown:

```
| No | Sasaran Strategis | Indikator Kinerja Utama (IKU) | Satuan | Deskripsi / Target Operasional |
| --- | --- | --- | --- | --- |
| 1 | Meningkatnya profesionalisme dan kompetensi ASN | • Nilai Indeks Profesionalitas ASN … |
```

| Kasus | Perlakuan |
|---|---|
| Tabel ≥2 kolom | baris Markdown; paragraf dalam sel dipisah ` / ` |
| Sel gabungan (`colspan`) | teksnya ditulis **sekali**, kolom sisanya kosong |
| Tabel satu kolom (kotak "OUTLINE") | tetap paragraf biasa |
| Baris yang semua selnya kosong (tata letak gambar) | dibuang |
| Tabel bersarang | diratakan ke dalam sel induknya |
| `\|` di dalam sel | di-escape agar kolom tidak bergeser |
| `&lt;n&gt;` | tag dibuang dulu, entitas didekode sesudahnya → `<n>` |
| Gambar | `opsiHtmlDocx` membuangnya — HTML Buku Materi Pokok 5,5 MB → 55 KB di memori browser |

Salinan `mametlite/src/lib/documentTextExtractor.js` diperbarui sama persis (beda hanya komentar kepala).

**Kode awal yang rusak.** Fungsi ini lebih dulu ditulis sesi lain, belum tersambung, dengan regex
penanda `/⟦T(d+)⟧/` — tanpa garis miring terbalik. Diuji langsung: setiap tabel **hilang**, tersisa
`⟦T0⟧`, dan komentarnya menulis "0 kata hilang" yang tidak pernah diuji pada kode itu. Diperbaiki, lalu
ditemukan masalah kedua: teks `⟦T0⟧` yang benar-benar ada di dokumen berubah menjadi `undefined`.
Penanda kini memakai karakter NUL (ditulis `\u0000` di sumber) — XML melarang karakter itu, jadi
mustahil muncul di teks DOCX — ditambah cadangan: nomor yang tidak dikenal dikembalikan apa adanya.

## Uji

**Kasus buatan: 11/11** — tabel dasar, entitas, `|` dalam sel, sel gabungan, tabel satu kolom, baris
kosong, tabel bersarang, dua tabel bersebelahan, teks mirip penanda `⟦T0⟧`, teks ` T1 ` biasa.

**Dokumen asli** — hasil sama di Node (`buffer`), di browser lewat Vite (`arrayBuffer`, build browser
mammoth) dan pada salinan mametlite:

| | HCDP | Buku Materi Pokok UT |
|---|---|---|
| Baris tabel Markdown | 48 | 42 |
| Kata sebelum → sesudah | 6.796 → 6.802 | 6.407 → 6.407 |
| Selisih kata | hanya kata yang dulu tertempel, kini terpisah (`Waktu(Kenaikan` → `Waktu` + `(Kenaikan`) | tidak ada |
| Sisa penanda / base64 | tidak ada | tidak ada |
| Waktu di browser | 289 ms | 90 ms |

Build frontend dan mametlite sukses.

**Mengapa uji browser perlu terpisah:** `mammoth` versi Node hanya menerima `path`/`buffer`/`file`,
versi browser (dipilih Vite lewat kolom `browser` di `package.json`) hanya `arrayBuffer`. Memanggil
`ekstrakTeksDokumen` di Node gagal "Could not find file in options" — bukan bug produksi.

## Keterbatasan yang disadari

- **Judul kolom tidak diulang di setiap potongan.** Diukur dengan potongan 800 huruf: 12 dari 20
  potongan HCDP dan 7 dari 12 potongan Buku yang berisi baris tabel tidak memuat baris judul kolom.
  Tidak ada baris tabel yang terpotong di tengah (terpanjang 479 huruf). Mengulang judul kolom belum
  dikerjakan — dampaknya ke skor pencarian belum diuji.
- **Dokumen `.docx` yang sudah tersimpan**, termasuk HCDP, baru mendapat tabel rapi setelah diunggah ulang.
- **Belum diuji lewat tombol unggah di aplikasi live** — fungsinya diuji langsung di browser dev.
- `.doc` lama tetap belum didukung (pengguna diminta menyimpan ulang sebagai `.docx`).

## 2. Riset jalur PDF (belum dipasang)

Tidak ada kode produksi. Dicatat karena skrip dan datanya hanya ada di scratchpad.

### Keadaan potongan di database — Operator Handbook (827 potongan)

| Ukuran | Hasil |
|---|---|
| Potongan yang memuat judul bagian buku | 79 (10%) |
| Tanpa penanda `[Halaman N]` | 395 (48%) |
| Diawali huruf kecil (terpotong di tengah) | 325 (39%) |
| Rata-rata baris < 30 huruf (tabel diratakan) | 424 (51%) |
| Bukan isi (daftar isi 19, akun Twitter 11, diawali daftar REFERENCE 34) | ±64 |
| Kolom urutan potongan | tidak ada |

Serpihan `X ⏎ P 7 8 ⏎ 1 ⏎ 0` di 11 potongan registry ternyata kolom versi Windows **XP, 7, 8, 10**. Buku
itu tidak pernah menyebut *daylight*/*standard time*; tabel zona waktunya hanya menulis "ST".

### Pembaca PDF OpenRouter — 3 halaman sulit (15 ADB, 300 zona waktu, 402 registry)

| Jalur | Biaya asli | Hasil |
|---|---|---|
| `cloudflare-ai` (gratis) | $0,00017 (token model saja) | kata menempel (`-slist only system`) — lebih buruk dari pdf.js |
| **`mistral-ocr`** ($2 / 1.000 hal) | $0,0062 | 94 baris tabel; perintah ↔ arti berpasangan; kolom XP/7/8/10 terbaca |
| native `gemini-2.5-flash-lite` | $0,00077 | kolom dipisah ke blok berbeda; teks diubah (`start\|startservice` → `start startservice`) |

Biaya parser ditagih ke model yang menerima permintaan (Gemini 2.5 Flash Lite), **tidak** muncul
sebagai model Mistral di dashboard. Terbukti dari `cost_details`: uji 30 halaman `cost` $0,06133 −
`upstream_inference_cost` $0,00133 = $0,06000 = 30 × $0,002.

### mistral-ocr 30 halaman (13–42)

5,6 detik, satu permintaan, **$0,0613**, hasil tetap per halaman; menemukan 10 awal bagian. Dibanding
teks pdf.js: 44 tag penutup palsu (`</value>` dari placeholder `<value>`), 30 entitas HTML, 5 notasi
LaTeX (`=Success` → `$\equiv$ Success`) — ketiganya pola tetap, bisa dibersihkan — dan **4 salah baca
kata** (`ignore_errors` → `ignore_error`, `iplocation` → `iplication`, `docs.aws.amazon.com` →
`docsAWS.amazon.com`, `<awsents>` → `</amsents>`). Salah ketik asli buku (`iphonesybinfo`, `ubunlts`,
`set status<n>`) dipertahankan.

**Dibuang setelah diuji:**

- **Pencocok ejaan Mistral ↔ pdf.js** — hanya menukar kesalahan: memulihkan nama modul Pacu `iam__…`
  (benar), tetapi juga `Sample` → `eample` (glitch pdf.js).
- **Awalan judul bagian di setiap potongan** — uji embedding A/B, 8 pertanyaan, model produksi
  `gemini-embedding-2` 768 dimensi: potongan benar tetap juara #1 di ketiga set (8/8), tetapi rata skor
  **turun**: tanpa awalan 0,7476; pdf.js + awalan 0,7021; Mistral + awalan 0,7139. Catatan: semua
  pertanyaan kata kuncinya ada di potongan — kasus kosakata berbeda belum diuji.

### Jalan tengah: detektor halaman tabel

pdf.js (gratis, huruf persis) tetap jalur utama; mistral-ocr hanya untuk halaman yang membutuhkannya.
Sinyal dari posisi teks pdf.js: **multi-kolom** (baris dengan celah horizontal > 25 pt) dan **baris
yatim** (baris yang mulai > 60 pt dari margin kiri = lanjutan sel kolom kanan).

| Aturan | Operator Handbook (436) | Buku Materi Pokok (32) | HCDP PDF (47) | E-Book Keinsinyuran (52) |
|---|---|---|---|---|
| A: multi ≥30% | 213 | — | — | — |
| C: yatim ≥15% | 185 | 6 (4 salah pilih) | salah pilih kata pengantar/grafik | salah pilih |
| B: multi ≥30% & yatim ≥15% | 140 | 2 | 4 | 0 |
| **B′: multi ≥30% & yatim ≥10%** | **152 (±$0,30)** | **3 — hal. 18, 22, 23, semuanya tabel rusak** | **4** | **0** |

Aturan A memilih tabel yang barisnya masih utuh di pdf.js (zona waktu `Ireland: Dublin GMT ST UTC`)
— tidak perlu OCR. Aturan C salah memilih sampul, poin berindentasi, dan kode menjorok. Yang masih
lolos dari B′: kunci jawaban dua kolom (Buku hal. 31). Belum diperiksa satu per satu: 4 halaman HCDP dan
12 halaman tambahan Operator Handbook yang dipilih B′.

**Belum dikerjakan untuk jalur PDF:** detektor di kode, pemisah halaman di browser (butuh `pdf-lib`),
panggilan mistral-ocr + pembersih, tampilan biaya saat unggah (opsional/otomatis belum diputuskan),
buku penuh dalam satu permintaan, dan uji apakah tabel hasil OCR benar-benar membuat jawaban lebih benar.

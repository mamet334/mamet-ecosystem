# Tabel DOCX Dibaca sebagai Tabel, dan Riset Jalur PDF untuk RAG

**Tanggal:** 14 September 2026
**Roadmap:** Item 76
**Commit kode:** `1c0e03e` (tabel DOCX → Markdown), `4022546` (judul kolom diulang per potongan),
`4604ccf` (Item 76b: detektor + OCR halaman bertabel PDF — tidak bekerja), `de75807` (perbaikan
detektor + OCR)
**Status:** DOCX dideploy & terbukti di produksi 14 September 2026; Item 76b (deteksi + OCR PDF)
terbukti live di `npm run desktop` setelah `de75807` (KATALOG-PENDAS, 14 September 2026); isi kode
`de75807` diperiksa live di kedua situs Vercel

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

## Di produksi: tabel rapi, lalu judul kolom yang harus diulang

**Deploy frontend & mametlite.** Diperiksa dari isi kode di situs live, bukan nama berkas (hash Vercel
berbeda dengan build lokal): `ResearchApp-B1nQesJc.js` (mamet-ecosystem) dan `index-lwTVUo04.js`
(mametlite) memuat penanda tabel baru dan `convertToHtml`, tanpa `extractRawText({arrayBuffer`.

**Unggahan HCDP pertama (02.44 UTC).** Unggahan sebelumnya ternyata berkas lain (sebuah ebook PDF) —
log `rag-process` menunjukkan hanya satu permintaan; diulang dengan berkas yang benar.

| | HCDP lama (11 Sep) | HCDP 02.44 UTC |
|---|---|---|
| Potongan | 84 | 87 (sama dengan uji lokal) |
| Potongan berisi baris tabel | 0 | 20 |
| Kata tertempel (`Waktu(Kenaikan`) | 1 | 0 |

HCDP lama dihapus Owner pukul 02.55 UTC.

**Jawaban salah (03.01 UTC).** *"Menurut dokumen HCDP, berapa target rasio jabatan fungsional
bersertifikat kompetensi pada tahun 3?"* dijawab **35,0%** (seharusnya **20,0%**), berlabel
`VERIFIED` — model sempat menyebut 20,0% lalu "mengoreksi" dirinya. Konteks yang benar-benar dikirim
tersimpan di `chats.messages[].metadata.processingSteps` (`[SYSTEM CONTEXT FINAL]`, 12.058 huruf,
8 potongan). Potongan DOC-0002 memuat

```
| 4 | Indeks Kepuasan Masyarakat (IKM) Layanan Kepegawaian | Skala | 78,5 | 80,0 | 82,5 | 84,0 | 85,5 | 85,5 |
| II | PROGRAM PENDIDIKAN DAN PELATIHAN (PENGEMBANGAN SDM) |  |  |  |  |  |  |  |
| 5 | Rasio Jabatan Fungsional Bersertifikat Kompetensi / (…) | % | 5,93% | 12,0% | 20,0% | 35,0% | 47,6% | 47,60% |
```

tetapi baris `| No | Nama Program / Indikator Kinerja | Satuan | Tahun 1 | … | Tahun 5 | Target Akhir |`
**tidak ada di konteks** — ia di potongan sebelumnya, yang tidak terambil. Model menebak 5,93% sebagai
nilai awal dan semua kolom bergeser satu. Pertanyaan pembanding pukul 03.02 (satuan indikator Nilai
Evaluasi Sistem Merit) dijawab benar — potongannya memuat judul kolom. `evidence_audit_logs.rag_docs`
hanya mencatat label `DOC-0001…`, bukan id potongan, jadi yang dibaca model hanya bisa dibuktikan dari
`processingSteps` itu.

**Perbaikan (commit `4022546`).** `lib/judul_tabel.ts` (baru, tanpa impor) dipanggil dari `chunkText`:
potongan yang **dimulai di tengah tabel Markdown** diawali baris judul + garis pemisah tabel itu.
Dimulai di baris judul → tidak ditempel; dimulai di garis pemisah → hanya judul; tabel tanpa garis
pemisah → tidak ditempel. Titik potong dan tumpang tidak berubah, jadi jumlah potongan sama; potongan
bisa melebihi 800 huruf sepanjang judulnya. Berlaku untuk `rag-process` dan `knowledge_manager`.

Uji 27/27 (Node; `chunkText` lama diambil dari git):

| Dokumen | Potongan | Bertabel tanpa judul kolom | Terpanjang |
|---|---|---|---|
| HCDP | 87 → 87 | 12 → **0** | 799 → 957 |
| Buku Materi Pokok | 76 → 76 | 7 → **0** | 796 → 796 |
| mantra.txt (tanpa tabel) | 32 → 32, **identik** | 0 → 0 | 795 → 795 |

Setiap potongan yang berubah persis = judul + potongan lama.

**Deploy Supabase** diperiksa dari kode yang aktif (`get_edge_function`): `rag-process` versi 65
(03.11.17 UTC) dan `agent-process` versi 422 (03.11.34 UTC), keduanya membundel `judul_tabel.ts`.

**Unggahan ulang (03.16 UTC)** — persis prediksi uji lokal: 87 potongan, terpanjang 957 huruf,
**0** potongan bertabel tanpa judul kolom, potongan "Rasio Jabatan" diawali `| No | Nama Program …`.

**Pertanyaan yang sama (03.18 UTC):**

| | 03.01 UTC (sebelum) | **03.18 UTC (sesudah)** |
|---|---|---|
| Model / riwayat | `deepseek-v4-flash-0731`, 0 pesan | sama |
| Potongan / skor teratas | 8 / 0,747 | 8 / **0,752** |
| Awal DOC-0002 (berisi baris "Rasio Jabatan") | `\| 4 \| Indeks Kepuasan…` | `\| No \| Nama Program … \| Target Akhir \|` |
| Jawaban | 35,0% ❌ `VERIFIED` | **20,0%** ✅, keenam kolom tepat |

Skor pencarian tidak turun karena judul kolom — berbeda dengan awalan judul bagian buatan di riset
PDF. Biaya sengaja tidak dibandingkan: 3.849 dari 4.051 token permintaan kedua ter-cache.

**Catatan cara memeriksa.** Satu pemeriksaan sempat melaporkan DOC tanpa judul kolom pada jawaban baru —
salah baca: kuerinya mengambil "chat yang terakhir diubah", dan chat lama tersimpan ulang pukul 03.19.
Ambil jawaban per pesan (`chats.messages[]` + `metadata.timestamp`), bukan per baris chat.

## Keterbatasan yang disadari

- **`VERIFIED` lolos pada jawaban yang salah.** Pemeriksa label mencocokkan kutipan sumber, bukan
  ketepatan angka — jawaban 35,0% mengutip dokumen yang benar.
- **Dokumen yang sudah tersimpan** baru mendapat tabel Markdown dan judul kolom per potongan setelah
  diunggah ulang (setelah deploy 14 Sep 03.11 UTC).
- Hanya tabel Markdown **bergaris pemisah** yang judulnya diulang. Teks PDF dari pdf.js tidak berupa
  tabel Markdown, jadi belum terbantu.
- Potongan bisa lebih panjang dari 800 huruf (HCDP: 957).
- `.doc` lama tetap belum didukung (pengguna diminta menyimpan ulang sebagai `.docx`).

## 2. Riset jalur PDF

Riset awalnya tidak berkode produksi — dicatat karena skrip dan datanya hanya ada di scratchpad.
Bagian **detektor + OCR** (dari 5 potongan pekerjaan di bawah) kini dipasang, lihat "Item 76b" di
akhir bagian ini. Sisanya (UI biaya persisten, kirim buku sekali jalan, uji mutu jawaban) masih
scratchpad.

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

**Belum dikerjakan untuk jalur PDF (saat riset ditulis):** detektor di kode, pemisah halaman di
browser (butuh `pdf-lib`), panggilan mistral-ocr + pembersih, tampilan biaya saat unggah
(opsional/otomatis belum diputuskan), buku penuh dalam satu permintaan, dan uji apakah tabel hasil
OCR benar-benar membuat jawaban lebih benar.

## Item 76b — Detektor + OCR dipasang (2026-09-14, commit `4604ccf`)

Owner memutuskan: OCR **opsional dengan preview biaya** (pola sama seperti gerbang konfirmasi
Human-in-Command di Tier 3 Web Search), dan scope dibatasi ke **detektor + pemisah halaman +
panggilan mistral-ocr untuk halaman terdeteksi** — 3 dari 5 potongan pekerjaan riset di atas. UI
biaya persisten, kirim buku sekali jalan, dan uji mutu jawaban disengaja belum digarap.

**Kode.** `documentTextExtractor.js` (frontend & mametlite, sama persis):
`kelompokkanBaris` (ekstraksi dari `susunBarisHalaman`, perilaku lama tidak berubah) menghasilkan
baris per-halaman lengkap dengan posisi `x`, dipakai `deteksiTabelHalaman` (aturan **B′**: baris
multi-kolom ≥30% DAN baris "yatim" ≥10%) untuk menandai nomor halaman bertabel — dikembalikan lewat
`ekstrakPdfDariData` sebagai `halamanBertabelTerdeteksi`. Fungsi yang sama menerima `petaOcr`
opsional (`Map<halaman, teks>`) untuk mengganti hasil pdf.js halaman tertentu dengan teks OCR.

File baru `pdfOcrService.js` (frontend & mametlite): `pisahHalamanPdf` memotong satu halaman jadi
PDF sendiri lewat `pdf-lib`, `ocrHalamanPdf` mengirimnya ke OpenRouter
(`plugins: [{id:'file-parser', pdf:{engine:'mistral-ocr'}}]`, model penerima
`google/gemini-2.5-flash-lite` — termurah di uji riset), `bersihkanHasilOcr` membuang 3 pola cacat
tetap yang ditemukan riset (tag penutup semu, entitas HTML lolos, notasi LaTeX `$\equiv$`).
`ResearchApp.jsx` / `App.jsx` mengambil kunci OpenRouter (BYOK) sekali di awal, menawarkan dialog
OCR bila ada halaman terdeteksi DAN ada kunci, lalu memanggil ulang `ekstrakTeksDokumen` dengan
`petaOcrHalaman` bila Owner menyetujui.

**Uji sebelum deploy.** 3 kasus buatan Node (teks biasa, tabel jelas dengan sel meluber ke baris
kedua, poin berindentasi — kasus yang salah pilih di aturan tunggal "C" pada riset): 3/3 lolos.
Refactor `susunBarisHalaman` → `kelompokkanBaris` dicek tidak mengubah keluaran. Build `frontend`
(3.110 modul) dan `mametlite` (2.242 modul) sukses.

**Koreksi: klaim "live-verified" versi `4604ccf` tidak benar.** Catatan sebelumnya menulis unggahan
Operator Handbook memicu dialog OCR dan selesai tervektorkan. Pemeriksaan database dan kode
menunjukkan:

- Berkas yang diunggah saat itu adalah KATALOG-PENDAS, bukan Operator Handbook; Operator Handbook di
  database masih versi 11 September.
- **Detektor tidak pernah menandai halaman yang benar.** `deteksiTabelHalaman` memakai
  `kelompokkanBaris`, yang memutus baris setiap `hasEOL` — di tabel pdf.js memberi `hasEOL` per sel,
  jadi setiap sel menjadi baris sendiri dan sinyal multi-kolom hilang. Hasil di Node: KATALOG-PENDAS
  0, Buku Materi Pokok 0, Operator Handbook 28 halaman (riset B′: 130 / 3 / 152).
- **OCR membaca kolom yang salah.** `ocrHalamanPdf` meminta model "menyalin ulang" lalu mengambil
  `message.content` — tulisan ulang Gemini — padahal hasil mistral-ocr ada di
  `choices[0].message.annotations[].file.content[]`. Pembersihnya juga membuang `=` dan tag HTML asli.
- Uji 3/3 kasus buatan tidak menangkap ini karena kasusnya tidak meniru `hasEOL` per sel pdf.js.

## Item 76b — Perbaikan dan bukti live (2026-09-14, commit `de75807`)

**Kode** (frontend & mametlite, isi sama):

- `deteksiTabelHalaman` mengelompokkan item pdf.js per **baris visual** (`y` dibulatkan per 3 pt,
  `TOLERANSI_Y_BARIS`), bukan per aliran teks. Baris multi-kolom = celah horizontal > 25 pt antar item
  berurutan; baris yatim = item pertama > 60 pt dari margin kiri halaman; halaman < 25 huruf dilewati.
- `ocrHalamanPdf` mengambil teks dari `annotations` (tanpa pembungkus `<file name=…>` / `</file>`);
  model penerima hanya diminta membalas "OK" dengan `max_tokens: 16`. Annotations kosong → `GagalOcr`
  berstatus `KOSONG`, bukan teks kosong yang diam-diam tersimpan.
- `bersihkanHasilOcr`: tag penutup palsu hanya dibuang bila berupa **deretan di akhir halaman** dan
  bukan elemen HTML (`</script>` atau `<p>…</p>` asli selamat); entitas didekode; `$\equiv$` → `=`;
  spasi ganda di tepi sel tabel dirapikan.
- `terapkanOcrHalaman` memuat PDF sumber **sekali** (versi awal memuat ulang seluruh berkas per halaman).

**Uji lokal:** 26/26 di frontend dan mametlite (sebelum perbaikan: 14 gagal). Himpunan halaman
terdeteksi pada 5 PDF sama dengan riset; teks Buku Materi Pokok tanpa OCR tidak berubah (47.800
huruf). Pembersih pada keluaran riset 30 halaman: tag palsu 44 → 0, entitas 30 → 0,
`ConsoleLogin=Success` pulih. Build kedua proyek sukses.

**Bukti live (`npm run desktop`, 14 September 2026 06.02 UTC).** Owner menghapus KATALOG-PENDAS lama,
mengunggah ulang dan menyetujui OCR. Proses berjalan dua putaran sesuai rancangan: pdf.js + deteksi,
OCR per halaman, lalu ekstraksi ulang dengan `petaOcrHalaman`. Log klien: 813/813 blok, 611.910 huruf.
Database (dokumen `46a1fa4a…`):

| Pemeriksaan | Hasil |
|---|---|
| Potongan / ber-embedding | 813 / 813 |
| Potongan berisi tabel Markdown (baris pemisah `\| --- \|`) | 519 |
| Potongan diawali baris tabel | 480 — semuanya membawa judul kolom (`4022546`) |
| Tag penutup palsu / entitas HTML / `$\equiv$` | 0 / 0 / 0 |
| `<br>`, gambar `![img`, baris tabel tak tertutup | 0 |

Contoh baris tersimpan: `| 5 | MKKI4201 | Pengantar Statistika | 3 | II.1 | SATS4121 | Metode
Statistika 1 (Edisi 3) | 3 | … | T |` di bawah judul `| No. | Mata Kuliah | | sks | Waktu Ujian |
Bahan Ajar yang Digunakan | | Paket Arahan per Semester dan sks | … | Ket | |` — kode, nama, sks,
waktu ujian, bahan ajar, dan paket semester berada di kolom masing-masing. Owner memeriksa hasilnya
benar.

**Keterbatasan yang diwariskan (belum digarap):**
- ~~OCR berjalan berurutan per halaman — unggahan ±130 halaman terasa lama.~~ Kini paralel, lihat
  "OCR paralel + coba ulang" di bawah (kecepatan live belum diukur).
- Salah baca kata oleh mistral-ocr (riset: 4 per 30 halaman) tidak terdeteksi otomatis; teks per
  halaman belum dibandingkan satu per satu dengan PDF asli.
- Unggahan dengan OCR baru dibuktikan di `npm run desktop`; belum ada unggahan uji di situs Vercel.
  Perbaikan detektor tidak bisa dicari sebagai teks di bundel (kode dipadatkan) — hanya tersirat dari
  commit yang sama.

**Deploy Vercel (diperiksa 14 September 2026, sesudah push `fbc5507`).** Skrip menelusuri bundel JS
yang dilayani situs, termasuk chunk yang dimuat belakangan. Penanda yang hanya ada di `de75807`
(`"Reply with OK."`, galat "annotations kosong", pembersih `$\equiv$`) plus `max_tokens:16`,
`halaman.pdf`, `mistral-ocr` ditemukan di keduanya:

| Situs | Berkas JS diperiksa | Penanda ditemukan di |
|---|---|---|
| mamet-ecosystem.vercel.app | 22 | `ResearchApp-C7ITVAp2.js` |
| mametlite.vercel.app | 5 | `index-DLax1SjZ.js` |

## Item 76b — OCR paralel + coba ulang (2026-09-14)

**Asal:** uji live KATALOG-PENDAS — Owner mencatat unggahan "cukup lama" karena ±130 halaman dikirim
ke mistral-ocr satu per satu; hampir seluruh waktunya menunggu jaringan, bukan memotong PDF.

**Kode** (`pdfOcrService.js`, frontend & mametlite, isi sama selain komentar SALINAN):

- `terapkanOcrHalaman` menjalankan hingga `OCR_SERENTAK = 5` pekerja; opsi `{ serentak }` untuk
  mengubahnya. PDF sumber tetap dimuat sekali. Hasil `Map` tetap urut sesuai daftar halaman meski
  halaman selesai tak berurutan; `onProgress` dipanggil tiap halaman selesai (`ke` = jumlah selesai),
  jadi status "OCR halaman X/Y" di `ResearchApp.jsx`/`App.jsx` tetap benar tanpa diubah.
- Satu halaman gagal → halaman yang belum dimulai tidak dikirim, galat pertama dilempar, unggahan
  dibatalkan seperti sebelumnya. Halaman yang sudah berjalan tetap selesai dan ditagih (maks. 4).
- `ocrHalamanPdf` mencoba ulang 429 dan 500/502/503/504 hingga 3 percobaan (jeda 1 s lalu 2 s, atau
  `Retry-After` maks. 30 s). Dengan permintaan serentak 429 lebih mungkin muncul; tanpa coba ulang
  satu halaman membatalkan seluruh unggahan. 401 dan galat lain langsung gagal.

**Uji** (`uji-76b.mjs`, fetch palsu untuk bagian OCR): 33 lolos / 1 gagal di frontend dan mametlite
— yang gagal hanya "Operator Handbook: berkas ada" (berkas asli sudah tak ada di Downloads). Uji
lama tetap lolos (deteksi KATALOG-PENDAS 130, Buku 3, HCDP 4, E-Book 0 = riset; teks Buku 47.800
huruf identik; pembersih; annotations; PDF dimuat sekali). Uji baru:

| Kasus | Hasil |
|---|---|
| Puncak permintaan serentak | 5; opsi `serentak: 1` → 1 |
| 12 halaman, jeda palsu 60–140 ms | ±480 ms (berurutan minimal 1.200 ms), kunci urut, progres 1..12 |
| 429 sekali lalu sukses | 2 permintaan, berhasil |
| 429 terus | berhenti di 3 percobaan, `GagalOcr(429)` |
| 401 | 1 permintaan, langsung gagal |
| Halaman ke-3 gagal | galat dilempar, 7 dari 12 dikirim |

Build `frontend` (3.110 modul) dan `mametlite` (2.242 modul) sukses.

**Belum terbukti:** belum ada unggahan live dengan kode ini — kecepatan nyata dan perilaku batas laju
OpenRouter pada 5 permintaan serentak belum diukur.
- Operator Handbook di database belum diunggah ulang dengan OCR.
- Belum ada UI biaya persisten (ledger) untuk unggahan — masih `window.confirm` sekali pakai.
- Buku penuh tetap diproses halaman-per-halaman untuk OCR, bukan satu permintaan mistral-ocr untuk
  seluruh buku.
- Uji mutu jawaban (apakah teks OCR benar-benar membuat jawaban RAG lebih tepat, bukan cuma lebih
  rapi) belum dibangun.
- Detektor belum diverifikasi angka persisnya terhadap tabel B′ hasil riset (152/3/4/0 halaman per
  buku) — uji live hanya mengonfirmasi dialog & OCR berjalan, bukan mencocokkan jumlah halaman
  persis dengan angka riset.

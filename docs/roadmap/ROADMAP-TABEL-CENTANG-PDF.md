# ROADMAP: TABEL CENTANG PDF — POSISI KOLOM DARI KOORDINAT, BUKAN DARI OCR

**Tipe Dokumen:** Engineering Roadmap
**Area:** Ekstraksi PDF di browser (`documentTextExtractor.js`, salinan Mametlite) & kontrak label jawaban (`agent-process`)
**Status:** 🟡 **Tahap 1–2 live 2026-09-17 (`agent-process` v454) — Tahap 3 sebagian; tertahan temuan pengambilan potongan → [Item 89](./ROADMAP-KONTEKS-POTONGAN-RAG.md) / [Item 90](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md)** (keputusan §7 nomor 1–2 diambil; nomor 3 menunggu)
**Tanggal:** 2026-09-17
**Roadmap Index:** Item 88

---

## 1. Masalah

Uji Item 87 pada `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` (halaman 4–9 buku Kepbup Standar Kompetensi
Jabatan OKU). Pertanyaan "Sebutkan pelatihan teknis yang dipersyaratkan untuk Sekretaris DPRD." dijawab
lengkap tiga butir, **tetapi** dengan tambahan:

> Ketiganya memiliki tingkat kepentingan "**Perlu**" … Pelatihan Kepemimpinan Pratama (tingkat kepentingan
> "**Perlu**"). — `[STATUS: VERIFIED]`

**Yang benar: "Penting".** Diukur langsung dari PDF dengan pdf.js (`getTextContent`, halaman 6):

| Isi | x di PDF | Kolom sebenarnya |
|---|---|---|
| Judul kolom **Mutlak / Penting / Perlu** | 374,1 / 437,9 / 494,6 | — |
| `√` (U+221A) Pelatihan Kepemimpinan Pratama | **437,9** | **Penting** |
| `√` Tata Naska Dinas / Sertifikasi Barang Dan Jasa / Perencanaan dan Keuangan | **437,9** | **Penting** |
| `√` Pengalaman: pernah menduduki jabatan eselon III | **374,1** | **Mutlak** |

Potongan hasil mistral-ocr yang tersimpan:

```
| Jenis Persyaratan | | Uraian | | Tingkat Pentingnya Terhadap Jabatan | | |
| | | | | Mutlak | Penting | Perlu |
| B. | Pelatihan | 1. Manajerial | | Pelatihan Kepemimpinan Pratama | | ✓ |
| | | 2. Teknis | | 1. Tata Naska Dinas | | ✓ |
```

Judul kolom bertingkat ("Tingkat Pentingnya Terhadap Jabatan" di atas tiga subkolom) membuat OCR menaruh
**uraian di slot kolom "Mutlak"**, sehingga setiap centang **bergeser satu kolom ke kanan**
(Penting → Perlu, Mutlak → Penting). Model membaca tabel yang sudah rusak itu dengan setia, sehingga
pemeriksa label (`label_sumber.ts`, Item 71/77) tidak punya alasan untuk menurunkan VERIFIED.

**Dampak:** untuk dokumen persyaratan jabatan, beda Mutlak / Penting / Perlu menentukan memenuhi syarat
atau tidak. Kesalahan ini tersembunyi, konsisten, dan berlabel terverifikasi.

---

## 2. Tujuan

1. **A — Kolom centang ditentukan dari koordinat pdf.js**, yang terbukti tepat sampai 0,1 pt, bukan dari
   susunan sel hasil OCR.
2. **B — Pengaman:** bila posisi centang tidak bisa dipastikan, halaman itu ditandai dan jawaban tentang
   tingkat kepentingan dari halaman itu **tidak boleh** berlabel VERIFIED.
3. Biaya tambahan **$0** — semua dikerjakan di browser dari data yang sudah dibaca pdf.js.

**Di luar cakupan:** membetulkan tabel OCR secara umum (semua jenis pergeseran kolom), tabel tanpa tanda
centang, dan PDF hasil scan (tanpa lapisan teks — koordinat tidak tersedia; ditangani B).

---

## 3. Titik Kait di Kode

`ekstrakPdfDariData()` (`frontend/src/core/runtime/services/documentTextExtractor.js`, salinan
`mametlite/src/lib/documentTextExtractor.js`) sudah memegang **keduanya** per halaman:

```js
const isi = await page.getTextContent();   // item pdf.js + koordinat (transform[4] = x, [5] = y)
const teksOcr = petaOcr?.get(n);           // teks mistral-ocr halaman itu (Item 76b)
```

Jadi A dan B dikerjakan di sana, sesudah OCR, tanpa panggilan jaringan dan tanpa perubahan server untuk
tahap pertama.

---

## 4. Rancangan A — Fakta Centang dari Koordinat

**Modul baru** `tabelCentang.js` (murni, tanpa impor, bisa diuji di Node — pola `judul_tabel.ts`).

### 4.1 Langkah per halaman

1. **Kumpulkan tanda centang** dari `isi.items`: `√` U+221A, `✓` U+2713, `✔` U+2714, `☑` U+2611,
   `☒` U+2612, serta glyph Wingdings/Symbol di area Private Use (mis. U+F0FC, U+F0FE) — daftar diperluas
   dari temuan uji, bukan ditebak.
2. **Temukan judul kolom**: item teks yang berada **di atas** centang pertama (y lebih besar) dan pusat-x
   nya sejajar dengan kelompok x centang (toleransi ±6 pt). Kata judul tidak di-hardcode ke
   "Mutlak/Penting/Perlu" — apa pun teksnya (mis. "Ya/Tidak", "Wajib/Dianjurkan") dipakai apa adanya.
3. **Petakan centang → kolom**: judul dengan jarak x terdekat. Tolak pemetaan bila jarak > 12 pt (→ B).
4. **Petakan centang → baris**: item teks di kiri centang pada y yang sama (±3 pt); bila kosong, baris
   terdekat di atasnya dalam pita baris itu (label baris bisa berlanjut beberapa baris, mis.
   "Pelatihan / Kepemimpinan / Pratama" — y 618,4 → 606,6).
5. **Judul tabel yang terbawa dari halaman sebelumnya**: tabel panjang di buku 1.004 halaman bisa
   melintasi halaman tanpa mengulang judul kolom. Pemetaan x judul halaman sebelumnya dipakai bila
   halaman ini punya centang tetapi tidak punya judul, **dan** x centang cocok dengan judul lama.

### 4.2 Keluaran: blok fakta, bukan menulis ulang sel

Teks halaman (OCR atau pdf.js) **tidak diubah**. Di akhir halaman ditambahkan blok:

```
[TABEL CENTANG — dibaca dari posisi tanda di PDF; bila berbeda dengan tabel di atas, blok ini yang benar]
Kolom: Mutlak | Penting | Perlu
- Pelatihan Kepemimpinan Pratama → Penting
- 1. Tata Naska Dinas → Penting
- 2. Sertifikasi Barang Dan Jasa → Penting
- 3. Perencanaan dan Keuangan → Penting
- Pernah Menduduki Jabatan eselon III → Mutlak
[/TABEL CENTANG]
```

**Alasan tidak menulis ulang sel Markdown OCR:** mencocokkan baris OCR ke baris PDF rawan salah pada tabel
bersel gabung — justru sumber masalah ini. Blok terpisah bisa diuji sendiri, tidak merusak teks yang sudah
benar, dan ikut terpotong bersama teks halamannya (Item 87 menjaga daftar tetap utuh).

### 4.3 Kontrak jawaban (server, satu kalimat)

Di blok aturan dokumen `request_pipeline.ts` / `universal_contract.ts`: bila konteks memuat
`[TABEL CENTANG …]`, nilai kolom untuk baris yang disebut di blok itu **wajib** diambil dari blok,
bukan dari tabel Markdown di atasnya.

---

## 5. Rancangan B — Periksa Silang & Penanda Tidak Pasti

Dijalankan untuk setiap halaman yang **memuat tanda centang** (di pdf.js ATAU di teks OCR).

| Kondisi | Tindakan |
|---|---|
| A berhasil memetakan semua centang pdf.js, dan jumlahnya = jumlah centang di teks OCR | Blok A saja |
| Jumlah centang pdf.js ≠ jumlah centang di OCR | Blok A + penanda **tidak pasti** |
| Ada centang yang ditolak A (tak ada judul sejajar, jarak > 12 pt, baris tak ditemukan) | Penanda **tidak pasti** untuk baris itu |
| OCR memuat centang tetapi pdf.js tidak (centang berupa gambar/vektor, atau halaman scan) | Penanda **tidak pasti** seluruh halaman |

Penanda:

```
[TABEL CENTANG TIDAK PASTI — posisi kolom tanda centang di halaman ini tidak bisa dipastikan dari PDF]
```

### 5.1 Label jawaban (server)

`label_sumber.ts` (Item 71/77) ditambah satu aturan: bila jawaban menyebut nilai kolom sebuah tabel
centang (mis. Mutlak/Penting/Perlu, atau judul kolom yang tercantum di blok) **dan** potongan sumbernya
memuat penanda tidak pasti, label VERIFIED **diturunkan** ke HYPOTHESIS dengan catatan
"tingkat kepentingan belum bisa dipastikan dari PDF — periksa dokumen asli halaman N".

---

## 6. Tahapan & Kriteria Selesai

### Tahap 1 — Modul A + B di browser (tanpa server) — ✅ selesai 2026-09-17
- [x] `tabelCentang.js` + dipasang di `ekstrakPdfDariData` (web & Mametlite).
- [x] Uji Node dengan **PDF asli** `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf`:
  - blok memuat 4 pelatihan → **Penting**, pengalaman eselon III → **Mutlak** (kebenaran dari koordinat §1);
  - **kontrol**: teks OCR tersimpan (centang di kolom Perlu) dibuktikan berbeda dari blok.
- [x] Regresi: PDF tanpa tabel centang (HCDP, Operator Handbook, KATALOG-PENDAS) → **tidak ada** blok atau
      penanda tambahan; teks identik dengan sebelumnya.
- [x] Uji B dengan data rekaan: jumlah centang berbeda, centang tanpa judul, halaman OCR bercentang tanpa
      centang pdf.js → penanda tidak pasti muncul.
- [x] Sampel buku penuh (tanpa OCR, $0): 1.008 halaman, 246 bercentang, **836/855 centang terpetakan,
      0 beda dari pembanding independen**, 19 tidak pasti (11 halaman); 10 halaman acak diperiksa manual.

**Penyimpangan dari rancangan §4.1 (dipaksa data buku penuh — rincian di changelog):**
- Judul kolom tidak lagi "item sejajar ±6 pt": centang harus di dalam lebar judul, judul pertama di kanan
  label baris, baris tepat di bawah judul mulai di kolom paling kiri tabel.
- Kolom ditentukan dua aturan yang harus sepakat (rentang dari x judul & titik tengah antarpusat judul).
- Judul dari halaman sebelumnya hanya bila skala halaman terbukti sama (x centang terpetakan sama, atau x
  kolom paling kiri tabel sama ±1,5 pt) — hal. 257 berskala lain dari hal. 256.
- Label: sel rata tengah (centang tanpa teks sebaris) → "(label perkiraan)" + catatan; centang tanpa teks
  dalam ±8 pt → tidak pasti.

**Temuan untuk Tahap 2–3:** biaya embedding Kepbup +7% (blok 128.769 huruf); pemotong 800 huruf bisa
memisahkan baris "Kolom:" dari butirnya — periksa potongan live.

### Tahap 2 — Kontrak & label (server) — ✅ selesai 2026-09-17, dideploy v453
- [x] Kalimat kontrak §4.3 — di BLOK 6 `universal_contract.ts`, hanya bila RAG memuat blok.
- [x] Aturan penurunan label §5.1 + uji meniru cara model menulis — memakai jawaban live asli "Perlu"
      (diturunkan) dan 6 jawaban benar bergaya model (tetap VERIFIED); 15/15, kontrol versi lama gagal.
      Tambahan di luar rencana: jawaban yang **bertentangan** dengan blok pasti juga diturunkan.

### Tahap 3 — Bukti live
- [x] Deploy, hapus & unggah ulang berkas uji dengan OCR — blok utuh dalam satu potongan.
- [ ] Tanya: "Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?" → **Penting**, berlabel VERIFIED.
      **Gagal 2× (v453, v454):** mode LOOKUP, potongan tabel persyaratan tidak terambil (8 potongan, sebagian besar HCDP) → jawaban pengetahuan umum, HYPOTHESIS. Bukan kesalahan blok. **→ Item 89** (terukur: potongan bercampur & tanpa nama jabatan) dikerjakan lewat **Item 90**.
- [x] Tanya: "Pengalaman kerja apa yang mutlak?" → **eselon III (Mutlak)**, VERIFIED (v454; v453 sempat salah turun → pemeriksa per kalimat).
- [x] Periksa `processingSteps`: blok `[TABEL CENTANG …]` dan kalimat kontrak ikut terkirim (mode ASSISTANT).

---

## 7. Keputusan Owner

1. ✅ **Diputuskan (2026-09-17): blok fakta terpisah (§4.2)**, bukan menulis ulang sel tabel OCR.
2. ✅ **Diputuskan (2026-09-17): Tahap 2 (server) sesudah Tahap 1 terbukti**, karena hasil Tahap 1 (jumlah
   halaman "tidak pasti" di buku penuh) menentukan seberapa penting aturan label.
3. ⏳ **Belum diputuskan:** (sisa Item 86 ikut di sini — jalur OCR batas laju 400 dan konfirmasi kedua >100 halaman belum pernah teruji live karena buku penuh belum diunggah) buku Kepbup penuh baru diunggah (OCR ±$1,88, ±40 menit) **setelah** Tahap 3
   lolos pada berkas uji.

---

## 8. Risiko & Batas yang Disadari

- **Centang berupa gambar/garis vektor** tidak muncul di `getTextContent` → A tidak bisa; B menandainya
  tidak pasti. Seberapa sering terjadi di buku Kepbup diukur di Tahap 1 (sampel penuh).
- **Judul kolom tertumpuk/diputar** (teks vertikal) bisa gagal disejajarkan → B.
- **Tabel lintas halaman** tanpa judul ulang bergantung pada pembawaan pemetaan halaman sebelumnya (§4.1.5);
  bila x tidak cocok, B.
- **Dokumen lama tidak ikut terbaiki** — perlu unggah ulang.
- **Mode "dokumen peraturan"** (nomor urut potongan + potongan tetangga, dibahas 2026-09-16) tetap
  rencana terpisah; roadmap ini tidak bergantung padanya.

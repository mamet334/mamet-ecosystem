# ROADMAP: KONTEKS POTONGAN RAG — BAGIAN TIDAK TERCAMPUR & JUDUL KONTEKS DI SETIAP POTONGAN

**Tipe Dokumen:** Engineering Roadmap
**Area:** Pemotongan teks unggahan (`agent-process/lib/vector_utils.ts` `chunkText`, `judul_tabel.ts`; dipakai `rag-process` & `knowledge_manager`)
**Status:** ✅ **Selesai & live 2026-09-17** (Tahap C [Item 90](./ROADMAP-PENGAMBILAN-POTONGAN-RAG.md)) — set uji 14/14, semua bukti Kepbup #1; Q1/Q2 VERIFIED di web live. [log](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)
**Tanggal:** 2026-09-17
**Roadmap Index:** Item 89 (temuan uji live Item 88 Tahap 3)

---

## 1. Masalah

Uji live Item 88 (v453 & v454, berkas `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` diunggah ulang dengan OCR):
**"Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?"** dua kali dijawab dari pengetahuan umum
(`[STATUS: HYPOTHESIS]`). Log `function_logs` 02.19.25 UTC: 8 potongan diambil (ambang 0,55, maks 8,
skor teratas 0,702) — **7 HCDP + 1 ikhtisar berkas uji**; potongan tabel persyaratan tidak ikut.

Isi dua potongan persyaratan yang tersimpan:

```
| 15 | Advokasi kebijakan Otonomi Daerah | 4 | Mampu mengembangkan strategi advokasi … | 4,1 | … | |   ← judul tabel berulang (Item 76)
| --- | --- | --- | --- | --- | --- | --- |
| | | | | 4,2 | Mengembangkan norma standar, prosedur … advokasi kebijakan otonomi daerah; | |    ← sisa tabel kompetensi
| | | | | 4,3 | Meningkatkan kapasitas pemangku kepentingan … | |
| III. PERSYARATAN JABATAN | | | | | | |                                                            ← bagian baru, di TENGAH tabel
| Jenis Persyaratan | | Uraian | | Tingkat Pentingnya Terhadap Jabatan | | |
| B. | Pelatihan | 1. Manajerial | | Pelatihan Kepemimpinan Pratama | | ✓ |
…
```

mistral-ocr menggabungkan tabel kompetensi dan tabel persyaratan halaman 6 menjadi **satu** tabel Markdown.
Akibatnya (a) `tambahJudulTabel` menempelkan baris kompetensi no. 15 sebagai "judul" potongan persyaratan,
(b) sisa baris kompetensi dan bagian persyaratan jatuh dalam satu potongan, dan (c) tidak ada potongan
persyaratan yang memuat **nama jabatan** — nama itu hanya ada di halaman 1 ("Nama Jabatan : Sekretaris
Dewan Perwakilan Rakyat Daerah").

---

## 2. Bukti Pengukuran (2026-09-17 02.30 UTC)

Skrip `frontend/node_modules/.uji-rag/selidiki-potongan-persyaratan.js` (di luar git) dari `npm run desktop`:
embedding lewat jalur aplikasi (`agent-process {action:'embed'}`, gemini-embedding-2, kunci pengguna, 9
panggilan), `match_documents` tanpa ambang atas 288 potongan milik Owner. **Kontrol:** skor varian A
(embedding ulang teks tersimpan) = skor database (0,648 / 0,650) → jalur ukur sejalan dengan server.

**Q1 "Apa tingkat kepentingan pelatihan teknis untuk Sekretaris DPRD?"** — skor ke-1 0,702, **ke-8 0,659**
(batas masuk):

| Potongan | A tersimpan | B tanpa judul berulang | C hanya bagian persyaratan | D "Persyaratan Jabatan Sekretaris Dewan Perwakilan Rakyat Daerah" + C |
|---|---|---|---|---|
| Pelatihan | 0,648 — **#16** | 0,646 — #16 | **0,696 — #2** | **0,768 — #1** |
| Pengalaman + blok centang | 0,650 — **#15** | **0,682 — #3** | **0,682 — #3** | **0,733 — #1** |

**Q2 kontrol "Pengalaman kerja apa yang mutlak?"** (sudah berhasil live): potongan pengalaman #1 (0,636);
semua varian tetap #1–#2 (D 0,622 sedikit di bawah C 0,644, tetap #1).

**Kesimpulan terukur:**
1. Potongan yang **mencampur dua bagian** kalah skor — membuang judul berulang saja tidak cukup bila sisa
   baris tabel lain masih ada (pelatihan B = A); memisahkan bagian (C) memasukkan keduanya ke 8 besar.
2. **Judul konteks** (nama jabatan + bagian) memberi kenaikan terbesar (+0,08 s.d. +0,12).
3. **Mode LOOKUP bukan penyebab**: mode ASSISTANT memakai vektor & batas 8 potongan yang sama.

Catatan jujur: varian D memakai nama jabatan yang **ditulis tangan**. Aturan otomatis bisa menghasilkan teks
lain — keluaran kode sebenarnya wajib diukur ulang (Tahap 2).

**Bukti lama yang berlawanan (Item 76, riset jalur PDF 2026-09-14 — U2 Item 90):** awalan judul bagian per
potongan pernah diuji A/B dengan 8 pertanyaan Operator Handbook dan **dibuang**: potongan benar tetap #1 (8/8)
tetapi rata skor **turun** 0,7476 → 0,7021 (pdf.js) / 0,7139 (Mistral). Semua pertanyaan itu kata kuncinya ada
di potongan; kasus "kosakata tidak ada di potongan" (seperti Q1 di atas) belum diuji saat itu. Kedua hasil
benar untuk jenis pertanyaannya masing-masing — rancangan B hanya diterima bila tidak merugikan jenis pertama
(Tahap 2).

---

## 3. Tujuan

1. **A — Bagian tidak tercampur:** baris judul bagian di tengah tabel Markdown (mis. `| III. PERSYARATAN
   JABATAN | | |`) memutus tabel: judul tabel lama tidak diulang melewatinya, dan titik potong mengutamakan
   awal bagian.
2. **B — Judul konteks di setiap potongan:** potongan diawali satu baris konteks dari teks sebelumnya yang
   terakhir terlihat (identitas dokumen/bagian), mis.
   `[Konteks: Nama Jabatan: Sekretaris Dewan Perwakilan Rakyat Daerah › III. PERSYARATAN JABATAN]`.
3. Tidak menurunkan mutu dokumen lain (set uji Item 90 Tahap A sebagai regresi).

**Di luar cakupan:** mengubah ambang/jumlah potongan (U4 Item 90), pencarian kata kunci (Tahap B Item 90), mode LOOKUP.

---

## 4. Rancangan A — Pemisah Bagian

- **Pengenal baris bagian** (murni, diuji Node): baris tabel yang sel berisinya hanya SATU dan teksnya
  berpola judul bagian — angka Romawi/huruf/angka + titik + teks berhuruf besar (`III. PERSYARATAN JABATAN`,
  `B. KOMPETENSI TEKNIS`) — atau baris teks biasa berpola sama di luar tabel.
- `judulTabelUntuk` (`judul_tabel.ts`) **berhenti naik** di baris bagian: potongan sesudahnya tidak diberi
  judul tabel sebelum baris bagian.
- `chunkText`: bila baris bagian ada di jendela akhir potongan (mis. 30% terakhir), titik potong dipindah
  **tepat sebelum** baris bagian (pola Item 87 `akhirTanpaDaftarTerpenggal`, tanpa melanggar batas keras).

## 5. Rancangan B — Baris Konteks

- **Sumber konteks** dari teks penuh SEBELUM posisi potongan, diperbarui saat membaca maju:
  1. identitas: baris kunci–nilai pendek berpola `Nama <X> : <nilai>` / `Judul : …` / `Nama Jabatan : …`
     (daftar pola dikumpulkan dari dokumen nyata di Tahap 0, bukan ditebak);
  2. bagian: baris bagian terakhir (pengenal §4) — diganti setiap bagian baru; identitas diganti saat
     identitas baru muncul (buku Kepbup: 220 jabatan).
- Baris konteks ditempel di **awal isi potongan** (disimpan & ikut dibaca model — lihat keputusan 1), maks
  ±160 huruf; tidak ditempel bila potongan sudah memuat teks konteks itu.
- `[Halaman N]` tidak dijadikan konteks (sudah ada penanda sendiri).

---

## 6. Tahapan & Kriteria Selesai

### Tahap 0 — Ukur pola konteks di dokumen nyata ($0)
- [x] Jalankan pengenal bagian & identitas pada teks ekstraksi: berkas uji (dengan tabel OCR tersimpan),
      buku Kepbup penuh (pdf.js), HCDP DOCX, KATALOG-PENDAS PDF (berkas lokal di Downloads; di database sudah
      terhapus) dan potongan 3 halaman Operator Handbook (ebook penuhnya tak ada lagi) — laporkan baris yang terdeteksi, salah deteksi, dan contoh baris konteks
      per dokumen.

### Tahap 1 — Kode A + B (lokal)
- [x] Modul murni + uji Node dengan **kontrol** (aturan dimatikan → potongan persyaratan tetap bercampur).
- [x] Regresi pemotongan: jumlah & isi potongan HCDP, KATALOG-PENDAS (berkas lokal), Kepbup dibandingkan versi sekarang — perubahan hanya
      baris konteks/titik potong di batas bagian; tidak ada teks hilang (uji Item 87 tetap lolos).

### Tahap 2 — Ukur skor sebelum deploy (±$0,001)
- [x] Diukur dengan **set uji Item 90 Tahap A**: embedding potongan **keluaran kode** (bukan tulisan tangan) →
      Q1 masuk 8 besar, Q2 tetap #1, dan pertanyaan yang kata kuncinya **ada** di potongan (HCDP) tidak turun
      di bawah batas masuk — jenis pertanyaan yang dulu membuat awalan judul dibuang (Item 76).

### Tahap 3 — Bukti live
- [x] Deploy `rag-process` (+ `agent-process`, berkas bersama), unggah ulang berkas uji.
- [x] Q1 → **Penting**, VERIFIED, blok `[TABEL CENTANG]` di konteks (sekaligus menutup Tahap 3 Item 88).
- [x] Q2 tetap benar.
- [x] Set uji Item 90 Tahap A diulang setelah dokumen diunggah ulang (keputusan 3).

**Hasil (2026-09-17, rincian di [changelog](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md)):**
- Tahap 0: judul Romawi & "Nama Jabatan" terdeteksi di Kepbup; HCDP/Operator Handbook 0 → potongan identik.
- Tahap 1: 0 kalimat hilang di 5 dokumen; kontrol lulus; Kepbup penuh bercampur 520 → 78.
- Tahap 2: skor keluaran kode (penghitung kata kunci dibuktikan = Postgres): KEP-06 #7 → #1, KEP-03/04/05 #2 → #1.
- Tahap 3: unggahan live pertama masih bercampur (fixture pdf.js ≠ OCR asli) → jendela 30% → 60% + perpanjangan
  maju 240 huruf (0/81 posisi bercampur); unggahan kedua: set uji 14/14, KEP-01..06 #1, Q1 menyebut ketiga
  pelatihan "Penting" VERIFIED, Q2 eselon III VERIFIED.

**Penyimpangan dari rancangan:**
- §5 baris konteks **hanya untuk dokumen yang identitasnya terdeteksi** (keputusan Owner 2026-09-17, mempersempit
  keputusan 2 "semua unggahan"); pemisah bagian (§4) tetap untuk semua.
- Identitas = "Nama Jabatan" **+ "Urusan Pemerintah"** (pembeda 13× Camat); pola kunci–nilai umum ditolak.
- §4 jendela 30% diganti **60% + perpanjangan maju** (`awalBagianSesudah`); `chunkText` pindah ke `potong_teks.ts`.

**Sisa pekerjaan:**
- Buku Kepbup penuh (pdf.js) masih 23 potongan bercampur di luar pembuka jabatan — diukur saat buku penuh
  diunggah (keputusan 3 Item 88).
- Pola identitas dokumen jenis lain ditambahkan hanya bila diukur seperti Tahap 0.

---

## 7. Keputusan Owner

1. ✅ **Diputuskan (2026-09-17): disimpan di isi potongan.** Pertanyaan semula: **baris konteks disimpan di isi potongan** (dibaca model juga — model tahu potongan ini milik jabatan
   mana; biaya ±160 huruf per potongan) **atau hanya dipakai saat membuat embedding** (isi tetap asli)?
   *Usulan: disimpan di isi* — untuk buku 220 jabatan dengan nama berulang (mis. Camat), model perlu tahu
   potongan milik siapa.
2. ✅ **Diputuskan (2026-09-17): semua unggahan.** Pertanyaan semula: **berlaku untuk semua unggahan** atau hanya PDF? *Usulan: semua*, dengan regresi Tahap 1–2 sebagai
   penjaga.
3. ✅ **Diputuskan (2026-09-17): unggah ulang sesudah deploy.** Pertanyaan semula: **unggah ulang dokumen lama** (HCDP, KATALOG-PENDAS, dll.) sesudah deploy untuk uji mutu RAG? *Catatan 2026-09-17: KATALOG-PENDAS & Operator Handbook sudah tidak ada di database; dokumen yang diunggah ulang = yang masih dipakai (U3 Item 90).*
   Biaya embedding kecil (HCDP ±90 potongan), tetapi dokumen lama tidak ikut terbaiki tanpa unggah ulang.

---

## 8. Risiko & Batas yang Disadari

- **Salah deteksi bagian/identitas** pada dokumen lain (daftar bernomor Romawi di prosa, "Nama : …" di
  formulir) → konteks keliru menempel. Diukur di Tahap 0; pola sempit lebih dulu.
- **Skor pertanyaan lain bisa bergeser** (Q2: D sedikit di bawah C) — Tahap 2 memeriksa pertanyaan HCDP.
- Potongan sedikit lebih panjang → biaya embedding & prompt naik sedikit.
- Dokumen lama tidak ikut terbaiki tanpa unggah ulang.
- Item 88 Tahap 3 (Q1 VERIFIED "Penting") **bergantung** pada item ini.

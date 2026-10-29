# ADR-0022: Definisi "Mamet Cukup" & Fase Hardening

**Status:** ACCEPTED — diputuskan Owner 2026-10-29 (keputusan atas pertanyaan terbuka di §7)
**Tanggal:** 2026-10-29
**Menafsirkan:** `constitution/01_VISION.md` *Success Measurement* ("tidak diukur dari banyaknya fitur") dan
`constitution/08_ROADMAP.md` Fase 1 *Foundation Stabilization* ("sistem dasar dapat berjalan tanpa konflik").
**Tidak mengubah teks Constitution** — keputusan Owner: ADR (29 Okt). AGENTS.md: AI tidak boleh mengubah Constitution.

## 1. Context

### 1.1 Pertanyaan Owner (29 Okt 2026)

> "Saya hanya bingung akan sampai mana aplikasi ini akan dibangun. Semua pekerjaan menimbulkan pekerjaan baru."

Pada hari yang sama sembilan pekerjaan selesai dan tercatat, dan hampir setiap pekerjaan membuka temuan baru (mis.
"rencana Coordinator tampil" membuka fakta bahwa gelembung chat tak pernah menggambar langkah proses; "kata *terbaru*"
membuka fakta bahwa model menerima berita 6 tahun lalu sebagai berita terbaru). Temuan itu **tanda pemeriksaan
bekerja**, bukan kegagalan. Yang salah: **setiap temuan otomatis diperlakukan sebagai kewajiban**, dan tidak ada
tulisan tentang arti "cukup" — jadi roadmap hanya bisa bertambah, dan laporan AI selalu ditutup "sisa yang bisa
dikerjakan…".

### 1.2 Yang dikatakan Constitution

- **Keberhasilan bukan banyaknya fitur** (`01_VISION` *Success Measurement*): membantu Owner, identitas konsisten,
  mudah dipelihara, mudah mengganti teknologi, Knowledge bertambah.
- **Mamet tidak dibangun sekali jadi** (`08_ROADMAP` *Final Statement*; `01_VISION` *Purpose*: "tumbuh bersama Owner
  sepanjang hidupnya"). Jadi "cukup" **tidak boleh** berarti "selesai".
- Fase hardening sudah disebut Owner sebelumnya: T19 (lupa & ganti kata sandi) "ditunda ke fase hardening" (20 Okt).

## 2. Decision

### 2.1 Arti "cukup"

**"Cukup" = garis dasar:** pekerjaan inti andal dan aman dipakai sehari-hari — oleh Owner (Mamet Ecosystem) dan oleh
orang awam (Mametlite). Sesudah garis dasar tercapai Mamet tetap berevolusi, tetapi **setiap perubahan tidak boleh
merusak garis dasar**.

### 2.2 Pekerjaan inti (keputusan Owner)

1. **Chat + RAG dokumen** — tanya-jawab dokumen kantor (Kepbup, buku jabatan, PDF/OCR) dengan jawaban benar dan sumber jelas.
2. **Data tabel ASN** — unggah Excel/PDF pegawai, tanya-jawab data, laporan kejanggalan per OPD.

**Bukan syarat "cukup"** (tetap hidup sebagai kemampuan, dipelihara, tetapi tidak dikeraskan sebagai prioritas):
Engineer, pencarian berita/researcher, konektor Ecosystem Crawler, tema, graf pengetahuan, Data Flywheel.

**Mametlite ikut** (keputusan Owner): ia dipakai orang awam — keamanan dan keandalannya justru paling perlu dikeraskan.

### 2.3 Kriteria garis dasar

Semua wajib, masing-masing **dibuktikan** (uji, log, atau platform — bukan klaim). Kolom "kini" = keadaan 29 Okt.

| # | Kriteria | Kini | Yang masih perlu |
|---|---|---|---|
| **K1** | RAG menemukan potongan yang benar **dan menjawab benar** | recall@8 **14/14** (Item 90) | set uji **mutu jawaban** yang sah dibangun ulang + lulus ambang §7 Q1 (semua pertanyaan pokok benar + sumber benar; "tidak ditemukan" yang jujur boleh, mengarang tidak) — *butuh saldo* |
| **K2** | RAG **jujur saat gagal** — embedding/saldo habis → pengguna diberi tahu, tidak menjawab seolah dari dokumen | RAG turun bersuara (2 Okt) | U8b: jalur tanpa kunci OpenRouter terbukti live, atau dinyatakan tak ada |
| **K3** | Data tabel ASN benar & NIP/nama tidak dikirim ke model | live **5/5 VERIFIED** (Item 92) | dipertahankan; ulang sekali sebelum rilis garis dasar |
| **K4** | Mametlite layak bagi orang awam | RAG Mametlite live, HP layak (Item 125 M3) | **T19** lupa & ganti kata sandi; isolasi data antar-pengguna diuji dengan dua akun |
| **K5** | Keamanan | RLS "baca semua" ditutup; rahasia tak masuk log (T7) | **hak bawaan 39 tabel** (Item 125 Fase C); kunci API yang pernah bocor **diganti** (T7, tindakan Owner); **T1** daftar izin sub-agent di server (§7 Q2) |
| **K6** | Data aman & bisa dipulihkan | cadangan 13/13 & uji pulih (Item 93 Tahap 1–2) | ulang sekali sebelum rilis garis dasar |
| **K7** | Stabil & sampai ke aplikasi terpasang | suite 129/129; galat bahasa manusia (M4) | uji goyah **J3b**; **rilis** yang membawa semua perubahan (4.4.0; chat & PDF Electron 45 diuji — *butuh saldo*) |

### 2.4 Aturan temuan baru (berlaku sejak ADR ini diterima)

1. Temuan yang menyentuh **K1–K7**, keamanan, atau kehilangan data → dikerjakan di fase hardening.
2. Temuan lain → **daftar parkir**. Parkir **bukan utang**: tidak ada kewajiban mengerjakannya; Owner boleh mengambil
   kapan saja, atau membiarkannya selamanya.
3. Laporan AI ditutup dengan **status K1–K7** ("K5: 1 dari 2 sisa"), bukan "sisa roadmap".

### 2.5 Fitur baru

**Tetap jalan** (keputusan Owner), dengan satu syarat: **tidak merusak garis dasar** — uji yang menjaga K1–K7 tetap
hijau, dan fitur yang menyentuh pekerjaan inti tetap melalui pratinjau/uji seperti biasa.

### 2.6 Akhir fase hardening

Semua K1–K7 terbukti → **rilis garis dasar 5.0.0** (§7 Q4) → ADR ini dicatat "garis dasar tercapai" + tanggal.
Sesudahnya siklusnya: **pakai → temuan dari pemakaian nyata → dikerjakan bila menyentuh inti**.

## 3. Alternatives

| Pilihan | Kenapa tidak |
|---|---|
| A. Tanpa definisi (keadaan sekarang) | Roadmap hanya bertambah; tak ada jawaban untuk "sampai mana" |
| B. Bekukan semua fitur selama hardening | Ditolak Owner — fitur tetap jalan |
| C. Tulis di Constitution | Mengubah Constitution; ADR cukup sebagai penafsiran (pola ADR-0021) |
| **D. ADR: garis dasar + K1–K7 + aturan temuan (dipilih)** | Garis selesai yang bisa diukur, tanpa menghentikan evolusi |

## 4. Consequences

**Positif** — "sampai mana" punya jawaban yang bisa diperiksa; sebagian besar isi roadmap menjadi parkir, bukan utang;
prioritas kerja jelas (inti dulu).
**Negatif / risiko** — K1 (mutu jawaban) dan K7 (uji rilis) **butuh saldo OpenRouter**, jadi garis dasar tidak bisa
tercapai tanpanya; daftar parkir bisa terasa "ditinggal" — dimitigasi aturan §2.4.2 (parkir bukan utang).

## 5. Pemetaan roadmap 29 Okt

**Masuk hardening:** T1 daftar izin sub-agent di server (K5) · T19 (K4) · isolasi data dua akun Mametlite (K4) · hak bawaan 39 tabel & fungsi yatim, Item 125
Fase C (K5) · ganti kunci T7 (K5, Owner) · U8b jalur tanpa kunci (K2) · set uji mutu jawaban RAG (K1) · uji goyah J3b
(K7) · rilis 4.4.0 + Node 24 & `icacls` di laptop Owner (K7) · ulang uji cadangan & Data Tabel sebelum rilis (K3, K6).

**Parkir:** Item 92 koreksi pemetaan Data Tabel (§7 Q3) · Item 126 Fase 1 bukti live & Fase 2–4 · Item 129 Tahap D · Item 88 BUKU-10 · Item 90 U4/U6/U7 · Item 93
Tahap 3–4 · T18 · graf Home & `graf-bercahaya` · Engineer (T10 Tahap 2–3, Engineer Mandiri Tahap 1 & 4).

Daftar kerja & status K1–K7: [`ROADMAP-HARDENING.md`](../roadmap/ROADMAP-HARDENING.md).

## 6. Related

`constitution/01_VISION.md`, `constitution/08_ROADMAP.md`, `constitution/04_OWNER_SOVEREIGNTY.md` · ADR-0021 ·
`docs/roadmap/INDEX-ROADMAP.md` · `ROADMAP-SIAP-PENGGUNA.md` (Item 125) · `ROADMAP-TEMUAN-TERBUKA.md` (T1, T7, T19).

## 7. Keputusan Owner (2026-10-29) — semua sesuai usul

| # | Pertanyaan | Keputusan |
|---|---|---|
| Q1 | Ambang lulus mutu jawaban RAG (K1) | Jawaban benar + sumber benar pada **semua** pertanyaan pokok; boleh "tidak ditemukan" yang jujur, tidak boleh jawaban mengarang |
| Q2 | T1 (daftar izin sub-agent di server) masuk hardening? | **Ya (K5)** — menyangkut keamanan server untuk semua pengguna, walau sub-agent bukan inti |
| Q3 | Item 92 "koreksi pemetaan" (Data Tabel) masuk hardening? | **Parkir** — kecuali Owner pernah menemui kolom yang salah dipetakan di data nyata |
| Q4 | Nomor versi rilis garis dasar | **5.0.0** — menandai "garis dasar tercapai", beda dari rilis biasa |

# 12 November 2026 — T10 Tahap 2: alat web teknis untuk Engineer

Keputusan Owner 12 Nov (jawaban atas usul T10): *"1. ya, 2. b, 3. sekalian — lakukan secara otonom"*.
1 = alat web teknis yang dipanggil model sendiri; 2b = Tahap 3 (isi space Engineer) ditutup sebagai dilampaui
`git grep`; 3 = sisa kecil (Undo, `IntentClassifier`) ikut ditangani.

## Yang dibangun

**`<alat_web>` (mode Engineer, mengikuti tombol Web, satu anggaran putaran alat di Settings):**

| Alat | Isi | Jalur ambil |
|---|---|---|
| `web_cari` | DuckDuckGo HTML: judul, URL asli, cuplikan (bukan sumber berita) | desktop (`fetchWeb`) |
| `web_baca` | teks utama halaman (`<main>`/`<article>`; head, script, nav, footer dibuang; `<pre>` jadi blok kode), 60.000 huruf per panggilan + `"dari"` untuk lanjutan | **server `proxy_fetch`** |
| `paket_npm` | versi `latest` & tanggalnya, dist-tag lain, engines, 10 versi terakhir menurut tanggal | desktop |
| `paket_pypi` | versi terbaru & tanggal unggah, requires-python, tautan, 10 versi terakhir, versi ditarik ditandai | desktop |
| `rilis_github` | rilis terbaru + catatan rilis utuh; `jumlah` sampai 10 (termasuk prarilis) | desktop |

- `shared/webAlat.js` (murni): urai tag, pagari argumen, URL dibangun kode untuk empat alat; hanya `web_baca` memakai
  alamat pilihan model sehingga ia lewat `proxy_fetch` yang memeriksa setiap pengalihan.
- `shared/alamatPublik.js`: pagar alamat publik **satu sumber** untuk server (`lib/web/alamat_publik.ts` mengimpornya) dan
  klien (`web_baca` ditolak lebih awal untuk localhost, jaringan lokal, metadata cloud, skema non-http).
- Isi web = data: tag alat, penanda isi, dan penanda `[HASIL ALAT WEB]` di dalam isi dinetralkan; baris `URL:` di dalam isi
  tidak menjadi sumber. Netralisasi `<alat_web>` juga ditambahkan ke isi RAG & konektor.
- Server: `request_parser` meneruskan `alatWeb` yang dipagari; `request_pipeline` menyisipkan blok prompt alat web
  **hanya** mode ENGINEER; `synthesis_handler` menjadikan URL, judul halaman, `npm <nama>`, `PyPI <nama>`,
  `github.com/<repo>/releases` sumber sah pemeriksa label (isi web ikut pemeriksa angka).
- Klien (`AssistantService`): putaran alat web sejajar folder/konektor/RAG, hitungan putaran bersama, catatan kaki
  "🌐 Web (dicatat dari proses utama, bukan dari kata model)".
- **Pencarian otomatis Engineer** di awal pertanyaan kini DuckDuckGo (web umum), bukan Bing News → Google News → Antara →
  Wikipedia. Mode Assistant tidak berubah. Yang hilang: berita teknologi otomatis — model memanggil `web_cari` sendiri.

## Cacat yang ditemukan & diperbaiki sekalian

- Pengurai DuckDuckGo lama (`WebComparisonService._parseHtmlResults`) mengisi judul dengan URL tampilan; kini memakai
  pengurai bersama (judul = teks tautan hasil). Berlaku juga untuk Assistant.
- `_safeFetch`: bila pengambilan desktop gagal (mis. HTTP 503) dan jalur server tak tersedia, status asli diganti **403
  karangan**; kini status asli diteruskan.
- Pengurai baru sendiri: hasil pertama hilang bila HTML diawali blok hasil (`split` lookahead tak memotong di posisi 0) —
  ditemukan uji mutasi, diganti indeks `matchAll`.

## Tahap 3 & sisa kecil

- **Tahap 3 (isi space "Pengetahuan Engineer") — dilampaui.** Engineer membaca repo langsung (`git grep`, selalu terkini).
  Salinan changelog di RAG ("sejarah aplikasi mamet ecosystem", 385 dokumen, 379 changelog) adalah potret 5 Nov dan
  makin basi; Engineer tetap terkunci ke space "Pengetahuan Engineer" (6 dokumen tugas uji). Cara mengoreksi: buat
  pilihan space Engineer di Settings bila pencarian makna atas sejarah ternyata dibutuhkan.
- **`IntentClassifier` — dilampaui, tidak diubah.** `detectIntent` tidak lagi di jalur hidup sejak `AnalyzeTask` dicabut
  (`uji-analysis-review-dihapus`); berkasnya sengaja dipertahankan sebagai bahan uji bercacat-diketahui
  (`uji-klaim-engineer`, kunci TUGAS-04). Memperbaikinya merusak bahan uji tanpa manfaat bagi pemakai.
- **Undo patch:** jalur kode `eng:git-rollback` teruji dengan repo git sungguhan (`uji-checkpoint-engineer` lulus);
  tombol di aplikasi belum diuji live.

## Bukti

- `uji/uji-alat-web-t10.mjs` **89 pemeriksaan** dengan data asli 12 Nov (`uji/fixtur-web/`: DuckDuckGo, registri npm
  `electron-updater`, PyPI `requests`, rilis `electron/electron`, halaman electronjs.org; email pengelola dibuang),
  pembanding independen (urut ulang `time`/`releases`, hitung tautan langsung), dan **AssistantService sungguhan**
  (dibundel esbuild, Supabase & server tiruan): tag model → alat dijalankan → `[HASIL ALAT WEB]` sampai ke model →
  jawaban akhir + catatan kaki; anggaran 1 putaran berhenti dengan pemberitahuan; Assistant & tombol Web mati tanpa
  alat web. **Mutasi 44/44 mati** di salinan scratchpad.
- Uji penjaga diperbarui: `uji-anggaran-prompt-efi`, `uji-alat-rag-b`, `uji-shared-t15` (14 modul shared di bundel),
  patokan `uji-catch-diam` 171 → 170 (catch pagar alamat pindah dari server ke shared; dua catch baru bersuara).
  Suite penuh 162/166 sebelum pembaruan itu; keempatnya lulus sesudahnya. Bundel esbuild `agent-process` bersih.
- **Platform:** `agent-process` **v564** — 116 berkas = 110 identik, 0 berbeda, 6 berkas tipe dikosongkan platform;
  `shared/webAlat.js` & `shared/alamatPublik.js` ikut.
- **Live (Owner, `npm run desktop` 4.5.0, Engineer, 12 Nov):** pertanyaan versi `electron-updater` & rilis
  `electron/electron` → pencarian otomatis "Dicari (web) … 5 hasil", lalu model meminta `paket_npm` + `rilis_github`
  (putaran alat 1/8); jawaban 6.8.11 (latest, 2026-10-20), v26 = 6.8.12, next = 7.0.0-alpha.13, v45.3.1 (2026-11-12)
  dengan dua perbaikannya — cocok dengan registri; [STATUS: VERIFIED] bertahan; catatan kaki
  "🌐 Web … 📦 npm electron-updater 6.8.11 · 🏷️ rilis electron/electron: v45.3.1".

## Batas yang diketahui

- `web_baca` belum terlihat live (pertanyaan uji hanya memicu registri & rilis).
- Pagar alamat memeriksa nama host/IP literal; nama domain yang di-resolve ke IP lokal (DNS rebinding) tidak tertangkap.
- Larangan mengirim isi berkas/rahasia ke `web_cari`/`web_baca` hanya di prompt.
- Bila satu jawaban memuat tag alat web **dan** tag alat lain, putaran itu hanya menjalankan alat web (pola yang sama
  dengan alat lain).

# 11 November 2026 — Item 131 Tahap I, E, F, G: prompt ramping, batas dari anggaran, web utuh, isi konektor sampai

Perintah Owner 10 Nov: *"mulai tahap I, e, f, dan g secara otonom"*. Keputusan Owner 6 Nov yang dipakai: anggaran putaran
alat = **angka sendiri** di Settings. Nilai bawaan 8 adalah usulan (lihat "Yang diusulkan").

## Tahap G — isi berkas konektor sampai ke model

`frontend/electron/konektorMcp.cjs` `teksHasil` hanya meneruskan bagian `text`; resource tertanam MCP ditulis
`[isi resource]` — itulah blok kosong saat membaca `README.md` lewat GitHub. Kini: resource teks dan blob teks (base64,
jenis teks atau tanpa jenis) diteruskan beserta alamatnya; blob biner / berjenis bukan-teks disebut apa adanya (alamat,
jenis, ukuran) tanpa datanya; tautan resource, gambar, audio, jenis tak dikenal diberi keterangan.

## Tahap F — hasil web tidak diringkas ulang

- Server `context_builder.ts`: peringkas LLM tambahan (`summarizeWebDoc`, ambang 6.000 huruf → 800 huruf per artikel,
  dibayar dua kali) dicabut; artikel diteruskan utuh.
- Klien `KonteksChat.js` `bagiAnggaranKonteks`: bila anggaran konteks sempit, artikel utuh dari depan (urutan relevansi)
  dipertahankan dan sisanya dilewati **per artikel** dengan catatan jumlahnya — tak ada artikel terpotong di tengah.

## Tahap E — batas kerja dari anggaran

- **E1/E2** `shared/anggaranAlat.js` (baru): satu anggaran **putaran alat per pertanyaan** untuk folder, konektor, dan
  alat RAG (bawaan 8, pagar 40; alat per putaran 10). Klien menghitung sisa dari semua jenis alat, mengirim `maks`/`sisa`,
  dan prompt menyebut "Paling banyak N putaran alat per pertanyaan (sisa S)". Klien lama (tanpa `maks`) tetap memakai
  angka lamanya (4 / 6). Setiap putaran kini membawa hitungan semua jenis alat dan memakai `onDone` asli (tak ada
  pembungkusan ganda). Settings → Batas Biaya: kolom "Putaran alat per pertanyaan" (disimpan di akun, `putaran_alat`).
- **Pembatas tersembunyi yang ikut dicabut:** batas baca folder 150 KB per pertanyaan → anggaran konteks Settings;
  hasil konektor dipotong dua kali (20.000 huruf di `shared` di atas 60.000 di Electron) → satu batas 60.000, dan
  catatan potongnya tak lagi menjanjikan "kursor" untuk konektor umum.
- **E3** `lib/adapters/kemampuan_model.ts` (baru): plafon jawaban OpenRouter dari katalog per model (terkecil di antara
  penyedia; tak pernah di bawah 8.192; katalog gagal → 8.192), dikurangi ukuran prompt agar muat di jendela model,
  plafon yang terjangkau saldo diingat 5 menit per kunci (tak menabrak 402 berulang, tak bocor antar pengguna).
  `pesanTerpotongPlafon` menyebut saldo hanya bila plafon memang diturunkan saldo.
- **E4 / sisa H**: label "[SISTEM DILINDUNGI OLEH MAMET HEALER]" diganti `catatanSubagenBerhenti` (sebab apa adanya +
  larangan mengarang hasil); tugas di atas 5 dan tugas yang kena batas waktu total kini diberitahukan ke model, bukan
  hanya log. **Angka batas waktu sub-agen (12 s / 24 s) dan 5 tugas tidak diubah** — belum ada ukuran durasi nyata.

## Tahap I — prompt sistem

- `lib/request/prompt_dasar.ts` (baru, bisa diuji): prompt dasar ±3.500 → **±1.650 huruf**. Aturan label hanya di BLOK 6.
  Dibuang karena bisa salah: "batas pengetahuan akhir 2024/awal 2025", "hak paten", larangan menyebut Google/OpenAI,
  nama model bawaan palsu (`gemini-2.5-flash`). Kalimat "tak ada dokumen" dibuat bersyarat (RAG server bisa menemukan
  dokumen sesudahnya).
- Perintah ZIP: dulu disisipkan ke **pesan pengguna** setiap kali teks kiriman memuat "zip" — termasuk isi dokumen hasil
  alat (temuan live 10 Nov). Kini petunjuk singkat di prompt sistem, hanya bila pertanyaan pengguna sendiri memuat kata
  "zip", tidak untuk pesan hasil alat/keluaran perintah.
- `universal_contract.ts`: garis hias dibuang; larangan khusus Engineer, baris "Brain 1/2: KOSONG", dan klaim
  "Kapabilitas" hanya untuk mode yang relevan; Assistant mendapat dua larangan umum. Engineer & LITE tak berubah isinya.

## Bukti

- Uji baru `uji-anggaran-prompt-efi.mjs` (76 pemeriksaan; kasus resource dipindah ke sini dari `uji-konektor-mcp`
  karena uji itu DILEWATI bila `.venv` crawler tak ada, termasuk di CI). **Mutasi 30/30 mati** di salinan scratchpad
  (4 sempat lolos: uji konektor terlewati, pola mutasi salah, dan kasus blob berjenis bukan-teks belum ada → ditambah).
  Uji lama disesuaikan (alat per putaran 10, anggaran lama untuk klien lama, label di BLOK 6, plafon dari katalog).
  Suite penuh 165: 163 lulus; `uji-ambil-web` & `uji-crawler` habis waktu saat berbarengan build Vite, lulus saat
  diulang sendiri. Bundel `agent-process`/`rag-process` bersih; build Vite klien lulus.
- **Platform:** `agent-process` **v558** lalu **v559** (perbaikan plafon dalam jendela) — 114 berkas = 108 identik, 0
  berbeda, 6 berkas tipe dikosongkan platform.
- **Live v558 (11 Nov 05:01–05:07 UTC, `npm run desktop` dijalankan ulang):**
  - Settings menampilkan kolom "Putaran alat per pertanyaan" (tangkapan layar Owner).
  - Alat RAG: `rag_daftar` 385 dari 385 dokumen; jawaban merangkum isi space.
  - Folder kerja: 2 putaran alat, `README.md` & `pyproject.toml` terbaca, `[STATUS: VERIFIED]` lolos.
  - **G:** konektor GitHub `get_file_contents` — model merangkum isi `README.md` repo dan membandingkannya dengan salinan
    lokal (dulu blok kosong).
  - **F:** pencarian web 5 hasil diteruskan utuh; model menyebut jujur bahwa data terbarunya 7 Nov.
  - **E3:** log `[KemampuanModel] deepseek/deepseek-v4-pro-0813: plafon jawaban 262144 token (katalog 262144)` —
    katalog terbaca; karena plafon = seluruh jendela, v559 mengurangi ukuran prompt.

## Belum selesai / temuan

- Mutu jawaban (set K1/K2) belum diukur ulang sesudah prompt dirampingkan (butuh DevTools + saldo).
- Blok petunjuk alat (folder ±4.300, RAG ±2.000, konektor) belum dirampingkan.
- E4: batas waktu sub-agen & 5 tugas belum berdasar anggaran.
- F: alat untuk meminta isi lengkap satu artikel belum dibuat.
- Label: jawaban dari `rag_daftar` yang menulis "Sumber: space …" diturunkan pemeriksa label (bukan judul dokumen);
  model juga keliru membaca aturan label alat RAG. Perlu dirapikan.
- v559 (plafon dalam jendela) belum punya bukti live percakapan panjang.
- Mametlite belum dibuktikan tidak rusak (prompt mode LITE ikut berubah).
- RAG tetap lambat (hybrid kena batas 8 s; 1× gagal total 05:01) — sisa Tahap A.

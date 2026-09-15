# Riset Web di Server, Tombol Deep Research, Penjaga Batas Waktu & "Lanjutkan"

**Tanggal:** 15 September 2026
**Roadmap:** Item 83 (melanjutkan Pilihan A dari Item 82)
**Status:** dideploy v441–v445, terbukti live (lihat "Bukti live").

## Latar

Item 82 menyisakan dua hal: sub-agent `researcher` memakai DuckDuckGo Lite yang dari server Supabase selalu kosong
(Pilihan A ditunda), dan di menu Tools desktop hanya RAG, Web, dan Word → PDF yang benar-benar dibaca kode. Deep
Research, Memory, dan File Reader hanya tampilan. Owner memilih **menyambungkan Deep Research dengan mengerjakan
Pilihan A dulu**.

## 1. Pencarian berita & pembacaan artikel di server (Pilihan A)

Modul baru `supabase/functions/agent-process/lib/web/pencarian_berita.ts`, dipakai `researcher` dan `deep_research`.

- **Mesin cari:** Bing News RSS (URL asli diambil dari `apiclick.aspx?…&url=`), cadangan Google News RSS ID/EN.
  - Setiap percobaan dicatat ke log: kueri, status HTTP, jumlah hasil, lama.
  - Kata kunci dicari lebih dulu: kata perintah seperti "cari, susun, laporan, pada, tahun…" dibuang.
  - **Pesan asli pengguna ikut dicari** bersama tugas Coordinator, lalu hasilnya digabung bergiliran tanpa duplikat.
    Coordinator sering memperluas tugas ("…berdasarkan pendapatan, valuasi, atau pangsa pasar") sehingga Bing hanya
    memberi 1–2 hasil (live v442), sedangkan pertanyaan asli memberi 4–8.
- **Isi artikel dibaca langsung** dari situs beritanya, bukan lewat `r.jina.ai`.
  - Survei dari komputer Owner: Kompas langsung 0,5–0,8 s dengan teks bersih; `r.jina.ai` 5–8,5 s berisi menu situs;
    tautan Google News diblokir Jina.
  - Teks diambil dari paragraf `<p>`, isi `<article>` didahulukan.
  - Menu tanpa tanda baca dibuang (Liputan6 menaruh menu ±1.400 huruf dalam satu `<p>`).
  - `<path>`/`<picture>` dan atribut berisi JavaScript tidak ikut (detik).
  - MSN dan tautan Google News dilewati.
  - Artikel dibaca paralel dengan batas waktu per artikel.
- `ambilGambarTerkait` (Yahoo lewat Jina) dibuang: lambat, dan tanpa rangkuman LLM tidak pernah sempat siap.

## 2. Sub-agent menyerahkan bahan mentah, bukan rangkuman LLM

Live v441: pencarian dan pembacaan dari server berhasil (Bing 5 hasil 0,3 s, 4 artikel 1,2 s), tetapi `researcher`
tetap dibuang `late`. Penyebabnya, `OpenRouterAdapter` memakai **model pilihan pengguna**, bukan `model` sub-agent.
Rangkuman deepseek-v4-flash 392 token makan 16,8 s, melewati batas 12 s.

- `researcher`: tanpa LLM. Bahan bernomor (daftar hasil + isi 2 artikel × 1.500 huruf, maks. 6.500) diserahkan ke
  jawaban akhir, yang memang bernalar dengan model pengguna. Tidak ada rangkuman ganda, dan model akhir melihat bukti
  aslinya.
- `deep_research`: tanpa LLM. Bahan = daftar 8 hasil + isi 4 artikel × 2.500 huruf (maks. 15.000), dengan instruksi
  laporan riset. Batas waktu plugin 25 s (`tool_subscriber.ts`), plugin lain tetap 12 s.
- `synthesis_handler.ts`: bila ada bahan Deep Research, larangan "format kaku seperti laporan" diganti instruksi
  menulis LAPORAN RISET (ringkasan, temuan, tabel bila datanya mendukung, kesimpulan, nomor sumber [n]).

## 3. Tombol Deep Research desktop tersambung

- `ToolPreferencesService.js`: `deep_research` **mati bawaan** (lebih lama, kredit lebih banyak).
- `AssistantService.js`: bila menyala (bukan mode Engineer), payload mengirim `tools: ['deep_research']` tanpa
  `web_search`. Tool web desktop tetap jalan di perangkat.
- `intent_router.ts`: bila `tools` memuat `deep_research` tanpa `web_search`, tugas `researcher` dari Coordinator
  dialihkan ke `deep_research` (langkah 🔬 terlihat). Mode Lite/Mametlite yang mengirim keduanya dibiarkan memilih.

## 4. Penjaga batas waktu dinding Supabase & "lanjutkan"

**Temuan (live v443):** chat Deep Research berakhir "⚠️ Aliran jawaban terputus". Metadata shutdown:
`reason: WallClockTime` tepat 150,0 s setelah permintaan, CPU 297 ms, memori 20 MB. Dugaan awal soal batas CPU
**keliru**. Laporan dengan nalar dari prompt ±31 ribu huruf belum selesai dalam 141 s. Semua token yang sudah
ditagih OpenRouter hilang.

**Keputusan Owner:** pilihan 2, penjaga waktu. Hasil yang sudah dibayar harus tersimpan, dan "lanjutkan" meneruskannya
tanpa mengulang proses. Paket berbayar Supabase (400 s) tidak dipilih. Bahan tidak dipangkas.

Modul baru `lib/streaming/batas_waktu.ts`.

- **Tenggat:**
  - `index.ts` mencatat `mulaiPermintaan` (dan umur worker ke log).
  - Tenggat = mulai + batas dinding (bawaan 150.000 ms, secret `BATAS_WAKTU_DINDING_MS` untuk paket lain; nilai
    < 30.000 dianggap salah ketik) − 20.000 ms untuk label, verifikasi, dan pengiriman `hasil`.
- **Pemotongan:**
  - Jawaban akhir selalu diminta sebagai stream ke OpenRouter (respons non-stream tak bisa dibaca sebagian).
  - `bacaSseOpenRouter` berhenti pada tenggat dan mengembalikan isi + nalar dengan `terpotong: true`.
  - Terpotong saat masih bernalar (isi kosong) tetap diterima, bukan galat.
  - Panggilan tanpa tenggat (Coordinator, sub-agent) tidak berubah.
- **Jawaban terpotong:**
  - Teks + `<think>` disimpan, ditambah catatan ⏸️ "Jawaban terpotong … ketik lanjutkan".
  - Respons membawa `terpotong` dan `bahanLanjutan { permintaan, bahan (hasil sub-agent), jawabanSebelumnya,
    nalarSebelumnya }`. Desktop sudah menyimpan metadata ini ke `chats.messages` dan mengirimnya kembali lewat riwayat.
- **"lanjutkan":**
  - Pola: lanjut/lanjutkan/teruskan/continue, boleh "tolong …", "… laporannya".
  - `core_engine.ts` melewati Intent Router, Coordinator, dan sub-agent.
  - `synthesis_handler.ts` meminta model meneruskan dari kata terakhir `<JAWABAN_SEBELUMNYA>`, dengan bahan dan analisis
    sebelumnya, **tanpa bernalar ulang** (`thinking: false`). Nalarnya sudah dibayar dan tampil di pesan sebelumnya.
  - Berantai bila lanjutan pun terpotong.
  - Desktop tidak mencari web/RAG untuk pesan "lanjutkan" sesudah jawaban terpotong.

## Uji (lokal, di luar git)

- `uji-pencarian-berita.mjs`: 20/20 (RSS Bing/Google, URL asli, urutan & gabung kueri, menu/JS dibuang, timeout).
- `uji-riset-live2.mjs`: tugas persis dari log live terhadap web sungguhan. Researcher 6 hasil (Kompas & Liputan6
  terbaca utuh), deep research 8 hasil, termasuk "Anthropic Capai Valuasi 965 Miliar Dolar AS, Geser OpenAI" (JawaPos).
- `uji-alih-deep-research.mjs`: 6/6. `uji-batas-waktu.mjs`: 36/36 (potong 479 ms untuk tenggat 450 ms, potong saat
  bernalar, rantai lanjutan, label tidak ikut ke jawaban sebelumnya, secret "150" diabaikan, lanjutan tanpa nalar).
- Regresi lolos: `uji-coordinator-openrouter` 8/8, nalar OpenRouter, SSE hybrid.

## Bukti live

- **v441:** Bing & situs berita terjangkau dari server. Researcher `late` karena rangkuman LLM 16,8 s. Deep Research:
  tombol terkirim, Coordinator memilih `deep_research`, tapi tugas panjang → Bing 0 hasil, Google News timeout.
- **v442:** researcher 4,5 s, deep research 0,6 s, tanpa `late`. Jawaban deep research berformat laporan, tetapi hanya
  1–2 sumber (tugas diperluas) dan isi Liputan6 terpotong menu.
- **v443:** researcher ±1 s, 7 sumber relevan. Deep research 7 artikel → jawaban akhir berhenti `WallClockTime` 150 s.
- **v444 (batas uji 60 s):** pemotongan detik ±38 tanpa galat, nalar 3.890 huruf & bahan 14,5 ribu huruf tersimpan;
  "lanjutkan" melewati Coordinator/sub-agent. Cacat: lanjutan bernalar ulang lalu terpotong lagi; label status terbawa
  sebagai jawaban sebelumnya; web desktop mencari kata "lanjutkan".
- **v445 (batas uji 60 s):** chat Deep Research → terpotong saat bernalar (nalar 2.108 huruf tersimpan). "lanjutkan"
  #1 → `ragArray size=0`, nalar 0, laporan langsung ditulis 1.384 huruf lalu terpotong (deepseek lewat Relace lambat).
  "lanjutkan" #2 (gpt-4o-mini) → meneruskan dari "### 2. Alibaba…", tabel & kesimpulan, selesai dengan label status.
  Tidak ada `WallClockTime` maupun "Aliran jawaban terputus". Secret uji sudah dihapus Owner (kembali 150 s).

## Batas yang disadari

- Sambungan lanjutan bisa mengulang beberapa baris terakhir (v445: ±3 baris bagian Alibaba).
- Mutu laporan tergantung model. Bila bahan tidak memuat peringkat, model menyusun sendiri dari yang ada (v445
  memasukkan startup XDOF sebagai "3 besar", dengan label HYPOTHESIS).
- Lanjutan hanya untuk jalur JSON/hybrid (desktop). Jalur SSE penuh tidak memakai tenggat.
- Situs yang isinya dimuat JavaScript (MSN) atau berisi daftar judul lain di awal teks (Beritasatu) tetap terbaca
  kurang bersih.
- Deep Research di desktop mengirim `tools: ['deep_research']`, sehingga daftar sub-agent yang ditunjukkan ke
  Coordinator hanya memuat deep_research + knowledge_manager.

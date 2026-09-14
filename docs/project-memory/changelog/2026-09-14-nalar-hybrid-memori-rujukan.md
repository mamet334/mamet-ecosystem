# Uji Mutu RAG Putaran 3, Memori Chat Pulih, Nalar Model Mengalir Sebelum Jawaban, Label Memeriksa Rujukan

**Tanggal:** 14 September 2026
**Roadmap:** Item 78 (putaran 3) dan Item 79
**Berkas kode:**
- Server `agent-process`: `index.ts`, `plugins/memory_manager_v1.ts`, `lib/adapters/ai_adapter.ts`,
  `lib/adapters/capability_adapter.ts`, `lib/adapters/reasoning_openrouter.ts`, `lib/llm_orchestrator.ts`,
  `lib/orchestration/handlers/synthesis_handler.ts`, `lib/request/history_compressor.ts`,
  `lib/request/request_parser.ts`, `lib/request/request_pipeline.ts`, `lib/runtime_context.ts`,
  `lib/verification/label_sumber.ts`
- Frontend: `src/components/workbench/ConversationEngine.jsx`, `src/core/runtime/services/AssistantService.js`

**Status:** dideploy (`agent-process` v434, 2026-09-14 14.12.49 UTC) dan terbukti live; frontend diuji Owner di
`npm run desktop`.

## 1. Uji mutu RAG putaran 3 (v429, 12.36 UTC)

Berkas `hasil-uji-rag-2026-09-14T12-36-22-766Z.json`; kode aktif v429 (deploy 12.29 UTC) memuat pemeriksaan label
di luar `<think>`.

| Ukuran | Putaran 1 (v426) | Putaran 2 (v427) | Putaran 3 (v429) |
|---|---|---|---|
| Isi jawaban dokumen benar (sesudah cek manual) | 22/22 | 22/22 | **21/21** (1 galat) |
| Potongan benar terambil | 22/22 | 22/22 | 21/21 |
| Tanpa label | 0 | 0 | 0 |
| Label keliru diturunkan | 4 | 0 | **0** |
| Label layak diturunkan | 2 | 1 | 3 |

- **Galat 503** pada HCDP-01 #1 (panggilan pertama, 183 ms) — bertepatan dengan deploy; tidak dibuktikan dari log.
- **Turun layak:** HCDP-07 #1 ("~43%/~57%" hitungan model), NEG-01 #1 (menebak "kisaran 55–60%" untuk 2030),
  HCDP-04 #2 (isi benar 88%, tetapi `Sumber:` berupa judul tabel, bukan dokumen).
- **Penilaian otomatis keliru:** KAT-02 ×2 "salah" dan NEG-01 #2 "tidak jujur" — konsol memakai modul penilai
  lama walau halaman dimuat ulang. Dinilai ulang dengan penilai terbaru: benar. Perintah konsol kini memakai
  `?t=${Date.now()}`.
- **HCDP-03 #2 "IP-ASN 80% pada tahun 2025" BUKAN celah label.** Sempat dilaporkan sebagai celah; pemeriksaan konteks
  menunjukkan dokumen memuat tabel IKU "Nilai Indeks Profesionalitas ASN (IP-ASN)" dengan Target **80% | 85%**
  pada kolom **2025 | 2026** (potongan lanjutan). Dokumen memang punya dua angka IP-ASN (80% untuk 2025 di IKU,
  80,0 poin untuk Tahun 5 di tabel program). Tidak ada aturan baru yang dibuat dari contoh ini.
- Sub-agent "researcher" tetap tidak terpanggil — perbaikan `shadowMode` (`c49a8ea`) belum terbukti berhasil.
- Log setiap panggilan penuh `Audit log setup error: TypeError: rctx.tasks.add is not a function` → bagian 2.

## 2. Memori chat tidak pernah dimuat sejak 1 Juli 2026

**Temuan.** `memory_manager_v1.ts` memanggil `rctx.tasks.add(promise)`, padahal `BackgroundTaskTracker`
(`runtime_context.ts`) hanya punya `fire(nama, promise)` dan `awaitAll()`. Di `retrieveMemories` pemanggilan itu
berada di dalam `try`, SESUDAH memori ditemukan → `TypeError` → `catch` → `return []`. Memori yang sudah ditemukan
dibuang.

`memory_audit_logs`: `memory_retrieval_success` terakhir pada minggu 29 Juni 2026; `3be8538` (1 Juli 2026) mengganti
pelacak tugas; sejak itu **0 sukses**, 200 `memory_retrieval_failed` "rctx.tasks.add is not a function" dalam 14 hari
terakhir (tercatat sejak 31 Agustus, saat pengambilan mulai menemukan memori).

**Perbaikan.** Tiga `.add` → `rctx?.tasks?.fire('MemoryAuditLog' | 'MemoryStatsUpdate', promise)`. Dua pembaruan
`update_memory_stats` memasang `.then` sebelum diserahkan ke pelacak (builder Supabase tidak dijamin punya `.catch`).

**Uji.** `uji-tasks-fire.mjs` 5/5: `memory_manager_v1.ts` diubah ke JS dengan impor luar diganti tiruan, dijalankan
bersama `createBackgroundTaskTracker` ASLI — tanpa "Audit log setup error", insert audit terkirim, tugas selesai lewat
`fire()`, tak ada lagi `tasks.add`.

**Bukti live** (chat `056a8d42…`, 13.34–13.38 UTC): 6 `memory_retrieval_success` (5–10 memori per pesan) — pertama
kali sejak Juli; "hai" tercatat `query_too_short`; "Audit log setup error" hilang dari `function_logs`. Jawaban memakai
memori: minuman (teh, "sekarang tidak suka kopi"), kuliah di UT, sapaan Pak Slamet.

## 3. Uji 7 pesan chat (13.34 UTC) — temuan

| Pesan | Temuan |
|---|---|
| hai | Penjaga label hilang menambah HYPOTHESIS (RAG menyala) — sesuai aturan, terasa berisik |
| Minuman / kuliah | Memori terbukti dimuat |
| Sistem merit (web) | VERIFIED lolos walau menulis **"PermenPANRB Nomor 19 Tahun 2026"** — potongan web terpotong `(PermenPANRB) Nomor 19 Tahun ...`, tahunnya dikarang; nomor/tahun peraturan bukan desimal/persen sehingga lolos pemeriksaan angka |
| Target rasio tahun 3 | Isi benar 20,0%, label turun hanya karena `Sumber: Dokumen HCDP 2025-2026 Kabupaten …` tanpa ".docx" |
| PNS laki-laki/perempuan | Model menyebut data "tidak termuat" lalu menampilkan 2.083/2.745/4.828 — angka benar, label INSUFFICIENT; cara model menjawab, bukan pemeriksa |
| Biaya SPP | INSUFFICIENT, benar |

Nalar tidak tampil sama sekali: `reasoning=0t` di semua jawaban (Thinking tier mati), dan adapter OpenRouter hanya
mengambil `message.content` — nalar yang dikirim terpisah dibuang.

## 4. Label: Sumber tanpa akhiran berkas, rujukan "Nomor N Tahun YYYY"

- `judulDisebut` — bila judul lengkap tidak cocok, nama berkas **tanpa akhiran** (`.docx/.pdf/.xlsx/.pptx/.txt/.md/
  .csv/.rtf/.odt`) dicocokkan; minimal 8 huruf supaya berkas pendek ("Laporan.pdf") tidak cocok dengan sembarang kalimat.
- `periksaRujukanSumber` — setiap `Nomor N Tahun YYYY` / `No. N Tahun YYYY` di jawaban VERIFIED wajib tertulis di
  potongan terlampir (huruf & tanda baca disamakan: "No." = "Nomor"). Gagal → turun dengan catatan "rujukan … tidak
  tertulis di dokumen yang dilampirkan". Dijalankan sesudah halaman, sebelum angka.
- **Uji** `uji-label-judul-rujukan.mjs` 15/15 dengan teks jawaban & konteks chat nyata: pesan 5 bertahan, judul lain
  tetap turun, "Laporan.pdf" tidak cocok; pesan 4 turun karena Nomor 19 Tahun 2026 (UU Nomor 20 Tahun 2023 yang
  tertulis tidak disebut), "Nomor 19" tanpa tahun bertahan, "No." = "Nomor", nomor berbeda turun, "tahun 2025" saja
  bukan rujukan, HYPOTHESIS tidak diperiksa. Regresi: `uji-label-angka` lolos, desktop lolos, 24 jawaban produksi
  lolos, `uji-label-think` lolos.

## 5. Nalar model ditampilkan seperti DeepSeek

Keputusan Owner: nalar AI **sengaja ditampilkan** (transparansi dan menjaga alur percakapan sesuai keinginan
pengguna) — sebagai blok lipat di atas jawaban, bukan disembunyikan dan bukan teks mentah bercampur jawaban.

### 5a. Tampilan (`ConversationEngine.jsx`)

- `parseThinkingContent` mengenali `<think>…</think>` (juga huruf besar dan tag belum tertutup saat streaming).
- Blok `<details open>`: ikon `psychology`, judul, panah; isi abu-abu bergaris kiri; tautan "Buka di Workbench"
  menggantikan tombol "[Deep Link]". Tombol salin hanya menyalin jawaban.
- Judul: "Berpikir…" selama nalar ditulis → "Berpikir selama N detik" (hybrid/stream) atau
  "Proses berpikir · respons N detik" (JSON: lama berpikir tak diketahui, yang ditulis lama seluruh respons) atau
  "Proses berpikir" (riwayat tanpa waktu).
- **Panah tampil sebagai kata `expand_more` terbalik** (tangkapan layar Owner): font ikon adalah subset 67 ikon
  (`daftar-ikon.txt`) dan `expand_more` tidak termasuk → diganti `chevron_right` (sudah ada di subset) diputar 90°.
  `npm run ikon` tidak dijalankan (mengunduh dari Google).
- Uji `uji-parse-think-ce.mjs` 5/5 (fungsi diambil langsung dari berkas).

### 5b. Nalar OpenRouter diteruskan

Kolom resmi (openrouter.ai/docs/use-cases/reasoning-tokens, dicek 2026-09-14): non-stream `message.reasoning` /
`message.reasoning_details`; stream `delta.reasoning_details` (`reasoning.text`→`text`, `reasoning.summary`→`summary`).

- `reasoning_openrouter.ts`: `teksNalar`, `sisipkanNalar` (nalar dibungkus `<think>` di depan jawaban),
  `pembungkusNalarStream`.
- Adapter OpenRouter mengembalikan `reasoning` sebagai kolom terpisah (`AdapterResult.reasoning`) — panggilan internal
  yang butuh JSON (ringkasan web, klasifikasi) tidak tersentuh. `runLLMDenganNalar` + `jawabanAkhir` di
  `synthesis_handler.ts` menyisipkan nalar **hanya bila `thinking === true`** — mametlite (tanpa `thinking`) tidak
  tiba-tiba menerima nalar. Jalur stream OpenRouter membungkus nalar dengan syarat yang sama.
- `rapikanRiwayat` membuang `<think>` dari jawaban lama sebelum dikirim ulang ke model.
- Uji `uji-nalar-openrouter.mjs` 16/16.
- Live (13.54 UTC, Thinking dinyalakan Owner): `reasoning=457t`, jawaban tersimpan diawali `<think>` — tetapi nalar
  **berbahasa Inggris**.

### 5c. Bahasa nalar

`request_pipeline.ts` panduan MAEF: "BAHASA NALAR: seluruh proses berpikir/penalaran Anda (termasuk penalaran internal
model) WAJIB ditulis dalam Bahasa Indonesia". Hanya perintah — **terbukti dipatuhi** DeepSeek pada uji Owner berikutnya
dan kedua chat bukti hybrid.

### 5d. Hybrid: nalar mengalir sebelum jawaban

Jalur JSON (`stream: false`) membuat nalar dan jawaban muncul bersamaan. Streaming penuh akan kehilangan penggantian
label (koreksi hanya bisa ditambahkan), konteks tersimpan (`[SYSTEM CONTEXT FINAL]` — dipakai verifikasi & set uji), dan
pipeline verifikasi pasca-jawaban. Owner memilih **hybrid**:

- Klien (`AssistantService.js`) mengirim `streamNalar: aiThinking === true` pada jalur CONVERSATION.
- `request_pipeline.ts`: `rctx.stream.streamNalar` hanya bila `!stream && streamNalar && thinking === true`.
- `index.ts`: permintaan hybrid dijawab `text/event-stream`; pipeline yang SAMA (`coreEngine.execute` →
  `awaitAll` → heartbeat → `streamController.pipe`) dijalankan di dalam aliran. Event: `nalar` (potongan),
  `nalar_selesai` (model mulai menulis jawaban), lalu `hasil` (`status` + isi Response JSON biasa) atau `galat`;
  komentar `: detak` tiap 10 detik.
- `synthesis_handler.ts` memasang `onNalar`/`onIsiMulai` ke `runLLMDenganNalar` → `callLLMWithMetadata` → adapter.
  `OpenRouterAdapter.execute` meminta `stream: true` hanya bila `input.onNalar` ada, lalu `bacaSseOpenRouter` merakit
  ulang bentuk respons non-stream (`content`, `reasoning`, `usage`, `provider`) — biaya, label, verifikasi,
  penyimpanan tidak berubah.
- Klien: `_bacaAliranHybrid` mengumpulkan nalar (`onNalar(teks, selesai)`), lalu data `hasil` diproses oleh cabang JSON
  yang sama (`onDone`, `finalizeAssistantSession`). `ConversationEngine.jsx` menampilkan nalar selagi mengalir; lama
  berpikir dihitung dari potongan nalar PERTAMA sampai `nalar_selesai` (pencarian dokumen tak dihitung).
- Uji `uji-sse-hybrid.mjs` 14/14 dengan aliran tiruan dipecah per 5–7 byte: server (rakitan isi & nalar, multibyte,
  `onIsiMulai` sekali sesudah nalar, usage & provider, error di tengah stream dilempar, tanpa nalar) dan klien
  (nalar bertahap, JSON utuh + `processingSteps`, `galat`, aliran putus, status 500). Sintaks semua berkas OK (esbuild).

**Bukti live v434** (isi kode aktif diperiksa: `periksaRujukanSumber`, `bacaSseOpenRouter`, `streamNalar`,
`tipe: 'hasil'`, `fire('MemoryAuditLog'`, `BAHASA NALAR`, `tanpaAkhiran`, pembuangan `<think>` dari riwayat; `tasks.add` 0):

| | Chat `12a02bc5…` — dengan web (14.14 UTC) | Chat `0fce6dad…` — RAG saja (14.16 UTC) |
|---|---|---|
| Dilampirkan | HCDP + Web Reference 1–5 | HCDP |
| Nalar | tampil lebih dulu, Bahasa Indonesia (dikonfirmasi Owner) | tampil lebih dulu, Bahasa Indonesia |
| Token nalar / biaya | 158 t / $0,00138 (Fireworks) | 226 t / $0,00076 (Reka) |
| Lama berpikir tersimpan | 1 detik | 1 detik |
| Label | VERIFIED bertahan | VERIFIED bertahan |
| Sumber | "Web Reference 1" dan "Web Reference 5" | "DOKUMEN HCDP 2025-2026.docx" |
| Rujukan | "UU Nomor 20 Tahun 2023" — tertulis di hasil web | "UU No. 20 Tahun 2023" — dokumen: "Undang-Undang Nomor 20 Tahun 2023" |
| Konteks tersimpan | ya | ya |
| Galat di log | tidak ada | tidak ada |

Selisih biaya mengikuti penyedia hulu (token sebanding), bukan jalur hybrid.

## Keterbatasan / belum dikerjakan

- **Angka & halaman di dalam nalar ikut diperiksa** (keputusan Owner, `0a50452`): nalar asli sering memuat angka
  coba-coba/hitungan — label bisa lebih sering turun. Belum terjadi pada uji live.
- Hybrid hanya mengalirkan nalar dari **OpenRouter**; adapter lain tetap mengirim jawaban utuh tanpa event nalar.
  Bila OpenRouter gagal di tengah dan kaskade pindah adapter, nalar parsial yang sudah tampil diganti jawaban akhir.
- Bahasa nalar hanya perintah prompt; model lain belum tentu patuh.
- Set uji mutu RAG dengan Thinking menyala kini lewat jalur hybrid (hasil akhir tetap JSON yang sama) — belum dijalankan.
- Sub-agent "researcher" yang berhasil belum pernah terlihat; pemeriksaan pasangan angka–tahun di kalimat bebas belum
  ada (menunggu contoh jawaban yang benar-benar salah).

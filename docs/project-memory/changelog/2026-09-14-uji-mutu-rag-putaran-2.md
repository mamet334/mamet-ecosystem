# Uji Mutu RAG Putaran 2: Label Tak Lagi Keliru Turun, Nalar `<think>` Disembunyikan

**Tanggal:** 14 September 2026
**Roadmap:** Item 78 (lanjutan putaran 1)
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`,
`frontend/src/components/workbench/ConversationEngine.jsx`
**Status:** di-commit; belum di-deploy (`agent-process`) dan belum di-push (frontend)

## Hasil putaran 2 (2026-09-14 12.16 UTC, `agent-process` v427)

Berkas: `hasil-uji-rag-2026-09-14T12-16-56-808Z.json`. 26 panggilan, 0 galat.

| Ukuran | Putaran 1 (v426) | Putaran 2 (v427) |
|---|---|---|
| Isi jawaban dokumen (sesudah cek manual) | 22/22 benar | **22/22 benar** |
| Potongan yang benar terambil | 22/22 | 22/22 |
| Tanpa label | 0 | 0 |
| Label keliru diturunkan sistem | 4 | **0** |
| Label layak diturunkan | 2 (HCDP-07 ×2) | 1 (HCDP-07 #2) |

- **Perbaikan judul di dalam dokumen terbukti:** KAT-02 ×2 (`Sumber: "Katalog Kurikulum FEB, FHISIP …"`) dan NEG-01 ×2
  kini bertahan VERIFIED.
- **Pemeriksa angka tetap bekerja:** HCDP-07 #2 menulis "~43% / ~57%" (hitungan model) → diturunkan. Log server
  12.14 UTC: `[LABEL] ASSISTANT: VERIFIED -> HYPOTHESIS (angka 43%, 57% tidak ada di dokumen yang dilampirkan)`.
  HCDP-07 #1 tidak menulis angka itu → bertahan.
- **Sub-agent:** `shadowMode` tidak muncul di langkah maupun `function_logs` (12.08–12.30 UTC), tetapi tidak
  satu pun pertanyaan memanggil sub-agent "researcher" → perbaikan `c49a8ea` **belum terbukti berhasil**,
  hanya tidak lagi terlihat gagal.
- HCDP-03 #1 masih menulis "80,0" lalu "80% pada tahun 5" (#2 konsisten "80,0 poin") — belum ditangani.

## Penilaian otomatis yang keliru (bukan kesalahan RAG)

Ringkasan konsol: benar 17, perlu cek 3, salah 2, label tidak jujur 4. Setelah diperiksa:

1. **KAT-02 ×2 "salah"** — penilai menuntut teks "tanpa ujian akhir"; model menulis "tidak memiliki Ujian Akhir
   Semester (UAS)" dan "Tanpa UAS". Butir `harus_memuat` kini boleh berupa **daftar cara penulisan** (satu cukup).
2. **NEG-01 ×2 "tidak jujur"** — konsol memakai modul penilai **lama dari cache Vite** (ringkasan tanpa
   `label_perlu_cek`). Penilai terbaru memberi `null` (perlu cek manual); isinya jujur: mengakui target 2030
   tidak ada lalu menampilkan tabel yang tertulis. **Muat ulang halaman (Ctrl+R) sebelum menjalankan set uji.**

Dinilai ulang dengan penilai terbaru: benar 19, perlu cek 3 (HCDP-01 #1, HCDP-04 ×2 menyalin deret tabel),
salah 0, tidak dinilai 4.

## Temuan: `<think>` bukan bocoran model, tetapi tampil di chat utama

- `request_pipeline.ts` **memerintahkan** model menulis nalar di `<think>…</think>` (panduan MAEF).
- `ChatMessages.jsx` (AI Agent) dan mametlite memisahkan tag itu. **`ConversationEngine.jsx`** — chat utama yang
  memanggil `AssistantService.processMessage` — hanya mencari penanda `' thinking'` / `' response'`, lalu
  menampilkan teks mentah di `<span className="whitespace-pre-wrap">` → nalar model **tampil sebagai teks
  jawaban**. Tabel `chats` 7 hari terakhir memuat ≥8 jawaban model yang diawali `<think>` (9–12 September).
- `label_sumber.ts` memeriksa seluruh teks termasuk nalar: angka coretan di `<think>` bisa menurunkan label
  yang sah, dan label/Sumber yang hanya tertulis di nalar bisa meloloskan jawaban.

## Perbaikan

1. `ConversationEngine.jsx` — `parseThinkingContent` mengenali `<think>…</think>` (juga huruf besar dan tag yang
   belum tertutup saat streaming). Nalar masuk tombol "View AI Reasoning Trace"; jawaban tampil tanpa tag.
   Penanda lama `' thinking'` tetap didukung.
2. `label_sumber.ts` — semua pemeriksaan (ada label, VERIFIED, Sumber, halaman, angka) membaca jawaban **di luar**
   blok `<think>` yang tertutup. Teks yang dikembalikan tetap utuh; penurunan mengganti label di teks utuh.
   `<think>` tak tertutup diperiksa seperti sebelumnya (seluruh teks).
3. Set uji (di luar git) — butir alternatif untuk KAT-02; penilai menilai jawaban tanpa blok `<think>`.

## Uji

- `uji-label-think.mjs` 7/7 kasus (jawaban produksi HCDP-06 bertahan; angka/halaman karangan hanya di nalar
  tidak menurunkan; angka karangan di jawaban tampil tetap turun; label atau Sumber hanya di nalar → turun;
  tag tak tertutup tetap diperiksa; tanpa `<think>` perilaku lama).
- `uji-parse-think-ce.mjs` 5/5 — fungsi diambil langsung dari `ConversationEngine.jsx`.
- Regresi: `uji-label-angka.mjs` lolos, `uji-label-desktop-b2fa16dd.mjs` 3/3, `uji-label-hasil-produksi.mjs`
  28/28, `uji-penilai-rag.mjs` 14/14; sintaks `ConversationEngine.jsx` OK (esbuild).

## Belum terbukti / sisa

- Deploy `agent-process` + push frontend, lalu putaran 3 set uji (muat ulang halaman dulu) dan lihat chat utama
  tidak lagi menampilkan `<think>`.
- Sub-agent "researcher" yang berhasil belum pernah terlihat.
- Satuan bertentangan HCDP-03; set uji masih 13 pertanyaan di `node_modules`.

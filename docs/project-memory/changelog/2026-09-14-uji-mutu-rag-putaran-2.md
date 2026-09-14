# Uji Mutu RAG Putaran 2: Label Tak Lagi Keliru Turun; Label & Sumber Wajib di Luar Nalar

**Tanggal:** 14 September 2026
**Roadmap:** Item 78 (lanjutan putaran 1)
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`
**Status:** dideploy (`agent-process` v429, 2026-09-14 12.29 UTC). Putaran 3 dan pekerjaan lanjutan:
[`2026-09-14-nalar-hybrid-memori-rujukan.md`](2026-09-14-nalar-hybrid-memori-rujukan.md)

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

## Temuan: `<think>` bukan bocoran — sengaja ditampilkan

- `request_pipeline.ts` **memerintahkan** model menulis nalar di `<think>…</think>` (panduan MAEF), dan
  `ConversationEngine.jsx` (chat utama) menampilkannya bersama jawaban. Tabel `chats` 9–12 September memuat ≥8
  jawaban model yang diawali `<think>`.
- **Keputusan Owner:** nalar AI sengaja ikut tampil — untuk transparansi dan menjaga alur percakapan tetap sesuai
  keinginan pengguna. Commit `b6cf10e` sempat menyembunyikannya di `ConversationEngine.jsx`; perubahan itu
  **dibatalkan** (berkas kembali identik dengan sebelum `b6cf10e`, belum pernah di-push).
- Celah di `label_sumber.ts`: label `[STATUS: VERIFIED]` atau `Sumber:` yang hanya tertulis di dalam nalar
  ikut dihitung, sehingga jawaban akhir tanpa label/Sumber bisa lolos VERIFIED.

## Perbaikan

1. `label_sumber.ts` — keberadaan label, label VERIFIED, dan kutipan Sumber dibaca dari jawaban **di luar** blok
   `<think>` yang tertutup. **Halaman dan angka tetap diperiksa pada seluruh teks termasuk nalar**, karena nalar
   dibaca pengguna: angka karangan di nalar ikut menurunkan label. Teks yang dikembalikan tetap utuh.
   `<think>` tak tertutup diperlakukan seperti sebelumnya.
2. Set uji (di luar git) — butir alternatif untuk KAT-02; isi dinilai dari jawaban di luar `<think>` (fakta
   wajib tertulis di jawaban akhir, bukan hanya di nalar).

## Uji

- `uji-label-think.mjs` 11/11 kasus: jawaban produksi HCDP-06 bertahan; angka dan halaman karangan yang hanya
  ada di nalar → turun; angka benar di nalar → bertahan; angka karangan di jawaban → turun; label hanya di nalar
  → penjaga tanpa label; Sumber hanya di nalar → turun; tag tak tertutup tetap diperiksa; tanpa `<think>` perilaku
  lama.
- Regresi: `uji-label-angka.mjs` lolos, `uji-label-desktop-b2fa16dd.mjs` lolos, `uji-label-hasil-produksi.mjs`
  semua lolos, `uji-penilai-rag.mjs` 14/14.

## Belum terbukti / sisa

- Deploy `agent-process`, lalu putaran 3 set uji (muat ulang halaman dulu).
- Sub-agent "researcher" yang berhasil belum pernah terlihat.
- Satuan bertentangan HCDP-03; set uji masih 13 pertanyaan di `node_modules`.

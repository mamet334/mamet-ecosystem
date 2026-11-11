# 11 November 2026 — K1/K2: uji mutu sesudah Item 131, kegagalan pencarian = batas yang diketahui

Owner menjalankan `uji/uji-mutu-rag-k1.js` (versi `k1-3`, set `k1-1`: 22 pokok + 4 tidak_ada, × 2 putaran) di
`npm run desktop` terhadap `agent-process` v562 (alat RAG aktif, prompt dasar yang dirampingkan). Berkas hasil:
`uji-mutu-k1-2026-11-11T06-41-58-678Z.json` (hanya nilai; disimpan Owner, tidak di repo).

**Keputusan Owner 11 Nov:** *"Terima sebagai batas yang diketahui."* — K1/K2 dinilai dari mutu jawaban; pencarian yang
gagal karena CPU paket gratis Supabase (Nano) dicatat sebagai batas yang diketahui, bukan kegagalan K1/K2. Owner belum
ingin naik ke paket berbayar.

## Hasil

| | Penilai otomatis (k1-3) | Diperiksa satu per satu |
|---|---|---|
| Putaran dengan pencarian gagal (statement timeout) | — | **8 / 52** |
| Putaran dengan pencarian berhasil | — | **44 / 44 benar** (sama dengan 5 Nov) |
| SALAH | 6 | semuanya putaran pencarian gagal; model menyebut "pencarian dokumen gagal (timeout)" dan **tidak mengarang** |
| PERLU_CEK | 10 | semuanya benar: nilai yang ditanya tepat, "pengecoh" = deret tahun lain yang disalin berlabel (pola 5 Nov) |
| tidak_ada | 1 SALAH, 1 PERLU_CEK | **8/8 jujur** (NEG-03 #2 "belum bisa memberikan angka pasti" + INSUFFICIENT dinilai "mengarang" — penilai keliru; NEG-01 #1 jujur tetapi berlabel VERIFIED) |
| Label bohong | 0 | 0 |

**Kesimpulan:** mutu jawaban tidak turun sesudah prompt dirampingkan dan alat RAG ditambahkan; Tahap H bekerja (setiap
kegagalan pencarian disebut apa adanya). Yang turun adalah keandalan pencarian: 8/52 putaran gagal (5 Nov: 0).

## Yang diubah

1. **Penilai** (`uji/lib/penilaiMutuRag.mjs`, modul konsol `k1-4`): hasil baru `RAG_GAGAL` untuk putaran yang
   pencariannya gagal (catatan sistem di jawaban atau langkah `[RAG TIER 1 FALLBACK]`) dan jawabannya tidak benar & tidak
   berlabel VERIFIED. Jawaban benar tetap BENAR; jawaban salah berlabel VERIFIED tetap SALAH. Satu soal dinilai dari
   putaran yang terukur; soal yang semua putarannya gagal mencari → `TIDAK_TERUKUR`. Ringkasan melaporkan `rag_gagal`
   terpisah. **Nilai ulang berkas 11 Nov:** SALAH 6 → 0, RAG_GAGAL 8/52, K1/K2 GAGAL → PERIKSA (sisa PERLU_CEK = jawaban
   benar di atas) — cocok persis dengan pemeriksaan manual.
2. **Model mencoba sekali lagi** (`catatan_jujur.ts`, `context_builder.ts`, `request_pipeline.ts`): bila pencarian
   otomatis gagal dan alat RAG aktif, catatan sistem meminta model mencoba `rag_cari` sekali dengan kata kuncinya sendiri
   sebelum menyerah (pada uji ini soal yang gagal di putaran 1 hampir selalu berhasil di putaran 2). Tanpa alat RAG
   (Mametlite) pesannya tetap.

## Bukti

- `uji-penilai-mutu-rag` & `uji-konteks-utuh-c` lulus; **mutasi 11/11 mati** di salinan scratchpad (1 sempat hidup →
  kasus "jawaban benar berlabel HYPOTHESIS saat pencarian gagal" ditambah). Bundel bersih.
- **Platform:** `agent-process` **v563** — 114 berkas = 108 identik, 0 berbeda, 6 berkas tipe dikosongkan platform.

## Belum dibuktikan

- Ajakan `rag_cari` sesudah pencarian gagal belum terlihat live (perlu kejadian timeout sungguhan).
- Penilai masih menandai "pengecoh" untuk deret tahun yang disalin berlabel (PERLU_CEK yang ternyata benar).

# Unggah Buku Besar Gagal, Sejarah Aplikasi Masuk RAG — Bukti Nyata untuk Langkah 2

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1 langkah 2 · K2
**Status:** 📝 temuan dicatat (tanpa perubahan kode aplikasi); dua berkas dokumen diperbaiki encoding-nya.

Owner mencoba aplikasi terpasang v4.4.1 dengan dokumen nyata sesudah langkah 1. Bukti dari log `rag-process` dan
database (hitungan & judul saja).

## 1. Buku "48 hukum kekuasaan" (PDF, ±2.179 potongan menurut perkiraan klien) — GAGAL, data bersih

- 08:41:36 UTC: 1.986 potongan, kelompok 32. 08:43:20: berhenti di **1.856 / 1.986** sesudah **105,1 detik** —
  OpenRouter `400 "User location is not supported for the API use." (FAILED_PRECONDITION)` dari model embedding
  Google; seluruh dokumen dibatalkan, server 502, dialog "Gagal" di aplikasi. Database: 0 dokumen, 0 potongan sisa.
- **Dua masalah sekaligus:** (a) tanpa penolakan itu pun anggaran 110 detik habis dengan 130 potongan tersisa — buku
  umum, bukan hanya Kepbup, butuh unggah bertahap (langkah 2); (b) 58 kelompok berhasil dengan kunci & server yang sama
  lalu satu ditolak lokasi — rute penyedia berganti di tengah jalan (bdk. satu model, banyak penyedia). Embedding
  58 kelompok tetap dibayar walau dokumen dibuang.

## 2. Sejarah aplikasi — 363 changelog + 22 dokumen `docs/project-memory/` ke workspace baru

Workspace "sejarah aplikasi mamet ecosystem": putaran pertama **352 berhasil · 11 gagal**; sesudah diunggah ulang
**385 dokumen, 2.832 potongan, judul unik** (379 bertanggal = persis berkas bertanggal di repo; 6 lain: JOURNEY ×2,
MAEF ×2, VISION, PROJECT-MEMORY). Akun Owner ±5.300 potongan (batas K5 10.000).

| Gagal | Penyebab | Pulih |
|---|---|---|
| 9 | **503 dari gerbang Supabase**, beruntun ±08:58 UTC, dalam milidetik — fungsi tak sempat berjalan (tanpa log fungsi) | unggah ulang |
| 1 | **Penolakan lokasi Google** (kedua hari ini), `2026-10-04-audit-perintah-engineer.md` | unggah ulang |
| 1 | **Berkas cacat**: `2026-07-28_engineer_debugging_fixes.md` — bagian "### 7. Bug Kritis…" (byte 3.917 dst.) tersimpan **UTF-16LE** di dalam berkas UTF-8 (kemungkinan ditambah lewat PowerShell `>>`), 851 byte NUL → Postgres `unsupported Unicode escape sequence` | diubah ke UTF-8 (isi sama, 5.538 → 4.728 byte), unggah ulang |

Pindai seluruh `docs/`: satu berkas lain ber-NUL — `history-archive/OWNER_MANIFESTO.md`, **seluruhnya UTF-16LE + BOM**;
diubah ke UTF-8 (1.620 huruf, tanpa NUL/pengganti). Tidak ikut diunggah.

## 3. Untuk rancangan langkah 2 (perubahan server, belum dikerjakan)

1. **Bertahap & bisa dilanjutkan** — setiap panggilan jauh di bawah 110 detik; terputus → lanjut dari kelompok terakhir
   (penting juga untuk HP: tab di latar belakang dihentikan peramban).
2. **Kelompok yang ditolak sesaat diulang** (503, penolakan lokasi), bukan membatalkan dokumen; periksa apakah rute
   penyedia embedding bisa dipatok (dokumentasi OpenRouter dulu).
3. **Karakter NUL dibersihkan** sebelum disimpan — satu karakter rusak tak boleh membuang dokumen.

## 4. Dampak ke uji K1

RAG mencari di **semua** workspace kecuali satu dipilih/disebut (`document_search.ts`). Changelog memuat kunci jawaban &
pengecoh K1 secara harfiah ("Pengalaman Kerja … Mutlak", "Penting (bukan Mutlak)", "Tahun 3 = 20,0%; Tahun 4 = 35,0%").
Saran (keputusan Owner sebelum langkah 3): uji pamungkas K1 dijalankan **dengan** changelog di korpus — kondisi nyata;
bila RAG terkecoh, itu cacat nyata.

## 5. Bukti Parkir tanpa biaya: metadata chat ramping

Chat uji K3 (desktop, 5 tanya-jawab): langkah proses tersimpan **sekali** (`steps`), 0 salinan
`metadata.processingSteps`; ukuran chat ±52 KB — sisa bukti "satu chat baru di desktop" dari
[metadata chat ramping](./2026-11-02-metadata-chat-ramping.md) terpenuhi.

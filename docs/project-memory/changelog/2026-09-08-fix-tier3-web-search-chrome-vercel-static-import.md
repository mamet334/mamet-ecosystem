# Changelog: Fix Tier 3 Web Search Chrome/Vercel — Static Import Supabase Client

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Live-Verified (Deployment Vercel + Pengujian Live Browser Chrome)
**Scope:** PR#9 (Retrieval Tier Architecture — Fase 3: Web Comparison), Backlog Item 10 (`PENDING-tier3-web-search-chrome-cors-proxy-fix.md`)
**Komponen Terdampak:** `frontend/src/core/runtime/services/WebComparisonService.js`
**Referensi Terkait:** [`docs/roadmap/PENDING-tier3-web-search-chrome-cors-proxy-fix.md`](../../roadmap/PENDING-tier3-web-search-chrome-cors-proxy-fix.md), [`docs/roadmap/INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md)

---

## 1. Latar Belakang

Backlog Item 10 di `INDEX-ROADMAP.md` mencatat bahwa Tier 3 Web Search berfungsi 100% di aplikasi Desktop Electron (via IPC bridge), namun gagal total di deployment browser web (Google Chrome di Vercel, `https://mamet-ecosystem.vercel.app`). Root cause telah dianalisis dan didokumentasikan sebelumnya (2026-09-05) di `PENDING-tier3-web-search-chrome-cors-proxy-fix.md`, namun perbaikan kode ditunda sesuai arahan eksplisit Owner saat itu.

## 2. Akar Masalah (Ringkasan)

Baris `const { supabase } = await import('../../../supabase.js')` di `WebComparisonService.js:359` menggunakan **dynamic import**. Saat Vite melakukan build production, dynamic import ini tidak dikenali sebagai bagian dari module graph statis, sehingga browser mengirim request native ke `https://mamet-ecosystem.vercel.app/supabase.js` — file yang tidak ada di root domain (sudah di-bundle ke chunk lain) — menghasilkan **HTTP 404**. Exception ini memutus eksekusi sebelum sempat memanggil Edge Function `proxy_fetch`, sehingga kode jatuh ke `fetch()` langsung dari browser yang diblokir **CORS** oleh Google News RSS.

## 3. Solusi yang Diterapkan

Mengikuti rencana solusi Langkah 1 dari dokumen PENDING (bukan Langkah 2/DI, karena pola static import sudah konsisten dipakai di `AssistantService.js:23` untuk file yang sama):

1. Menambahkan static import di bagian atas `WebComparisonService.js`:
   ```javascript
   import { supabase } from '../../../supabase.js';
   ```
2. Menghapus dynamic import `await import('../../../supabase.js')` di dalam method `_safeFetch`, karena `supabase` kini sudah tersedia sebagai referensi module-level.

Behavior Desktop Electron **tidak terpengaruh** — jalur IPC (`window.electronAPI.fetchWeb`) tetap diproses lebih dulu sebelum blok Supabase proxy bridge ini dievaluasi.

## 4. Verifikasi

### 4.1 Build Production (Local)
```
vite v5.4.21 building for production...
✓ 2663 modules transformed.
✓ built in 3m 7s
```
Tidak ada warning unresolved import terkait `supabase.js`. Exit code 0.

### 4.2 Live Test Browser Chrome (Post-Deploy Vercel)
Query: *"berita ai terbaru"*

Console log hasil live:
```
[WebComparisonService] Menggunakan Edge Function proxy_fetch untuk: https://www.bing.com/news/search?q=berita%20ai%20terbaru&format=rss
[WebComparisonService] Proxy fetch sukses (4015 chars)
[WebComparisonService] Bing News RSS returned 4 results
[WebComparisonService] ✅ Web search sukses (4 hasil, 920ms)
```
Tidak ada lagi error `GET /supabase.js 404` maupun blokir CORS. Jawaban AI berhasil menampilkan berita AI terkini dengan penutup status epistemik `[STATUS: VERIFIED]`.

### 4.3 Checklist Kriteria Verifikasi (dari dokumen PENDING)
- [x] Build Vite production berjalan bersih tanpa warning unresolved import.
- [x] Console log tidak lagi mencatat error `GET /supabase.js 404 (Not Found)`.
- [x] Console log mencatat `[WebComparisonService] Menggunakan Edge Function proxy_fetch untuk: ...` dan `Proxy fetch sukses`.
- [x] Query temporal/berita pada antarmuka web menghasilkan dokumen web valid, diangkat ke RAG.
- [x] Jawaban AI menampilkan fakta terkini dengan status epistemik sesuai (`[STATUS: VERIFIED]`).

## 5. Catatan Terpisah (Tidak Ditindaklanjuti dalam Sesi Ini)

Dua temuan lain muncul di console log pengujian live namun **tidak terkait** dengan fix ini dan tidak ditindaklanjuti:
1. `favicon.ico` 404 — kosmetik, tidak berdampak fungsi.
2. `verification_audit_logs?...` HTTP 400 pada `useDashboardData.js` — pre-existing issue query Supabase, di luar scope Tier 3 Web Search.

## 6. Daftar Berkas yang Dimodifikasi

| No | Berkas | Deskripsi Perubahan |
|---|---|---|
| 1 | `frontend/src/core/runtime/services/WebComparisonService.js` | Ganti dynamic import → static import untuk Supabase client |
| 2 | `docs/roadmap/PENDING-tier3-web-search-chrome-cors-proxy-fix.md` | Update status menjadi selesai & live-verified |
| 3 | `docs/roadmap/INDEX-ROADMAP.md` | Update status Backlog Item 10 |

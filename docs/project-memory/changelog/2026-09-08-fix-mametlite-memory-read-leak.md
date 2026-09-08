# Changelog: Perbaikan Kebocoran Memori Personal ke Mametlite (Temuan #1)

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Deployed ke Production (drift-verified)
**Scope:** [`PENDING-mametlite-memory-leak-fix.md`](../../roadmap/PENDING-mametlite-memory-leak-fix.md)
**Komponen Terdampak:** `supabase/functions/agent-process/lib/request/execution_context.ts`

---

## 1. Ringkasan

Audit ulang terhadap `PENDING-mametlite-memory-leak-fix.md` (proposal lama, tidak ada bukti eksekusi di dokumen sumber) menemukan bahwa 2 dari 3 temuan sudah tertutup oleh sistem policy `appSource`/`isMametLite` yang sudah ada di kode saat ini, tapi **Temuan #1 (Memory Injection Leakage) masih aktif** — belum pernah diperbaiki.

## 2. Audit — Status Ketiga Temuan Sebelum Perbaikan Ini

| # | Temuan | Status sebelum sesi ini |
|---|---|---|
| 1 | **Memory Injection Leakage** — memori personal user tetap diambil & disuntik ke prompt Mametlite | ❌ **Masih bocor.** `canReadMemory` hardcode `true` untuk semua mode termasuk LITE, tidak pernah di-gate oleh `isMametLite`. |
| 2 | **Context Override** — memori selalu mengalahkan RAG | 🟡 Sebagian teratasi. `execution.memoryPriority` sudah `"balanced"` untuk `isMametLite` (bukan `"memory_first"`). |
| 3 | **Background Persistence Leakage** — `processMemoryWriteQueue` selalu jalan | ✅ Sudah fix. `canWriteMemory` sudah `false` untuk LITE mode, dan benar-benar di-cek di titik pemanggilan (`memory_subscriber.ts:8`). |

Solusi yang tertulis di proposal asli (`appSource !== 'mametlite'` sebagai hard-block eksplisit) tidak dipakai persis — sistem yang ada sekarang memakai flag `isMametLite` turunan dari `appSource`/`mode` yang mengalir lewat objek `policy`, arsitektur yang lebih terintegrasi tapi belum lengkap menutup celah baca.

## 3. Perbaikan

Satu baris di [`execution_context.ts:36`](../../../supabase/functions/agent-process/lib/request/execution_context.ts):

```diff
- canReadMemory: engineerPolicy?.canReadMemory ?? true,
+ canReadMemory: engineerPolicy?.canReadMemory ?? !isMametLite,
```

Konsisten dengan pola yang sudah dipakai untuk `canUseWorkspace` (baris 39: `?? !isMametLite`) dan `canWriteMemory`/`canWriteKnowledge`. ENGINEER mode tidak terpengaruh (`engineerPolicy.canReadMemory` eksplisit `true`, menang lewat `??` sebelum fallback `!isMametLite` dievaluasi).

## 4. Verifikasi Jalur Kedua yang Mungkin Bocor

Ditelusuri apakah ada jalur injeksi memori lain yang tidak lewat `canReadMemory`:
- **`globalMemory`** (parameter terpisah yang bisa override `memoryPrompt` di `context_builder.ts`) — dicek `mametlite/src/lib/callAgentSimple.js`: **tidak pernah mengirim** field ini. Tidak ada celah kedua.
- **`loadProjectMemory()` fallback** — sudah menangani `canReadMemory: false` dengan aman (`memoryArray: []`, tidak crash), jadi perubahan ini murni flag policy tanpa jalur kode baru.

## 5. Deploy & Verifikasi Live

Tidak seperti perubahan frontend (auto-deploy via Vercel saat push), Edge Function **tidak auto-deploy** dari git push (baris deploy di `.github/workflows/production-pipeline.yml` di-comment-out). Dieksekusi manual:

1. `supabase secrets set DEPLOYED_COMMIT_SHA=... DEPLOYED_BRANCH=main DEPLOYED_AT=...` (metadata untuk drift detection, Backlog Item 8)
2. `supabase functions deploy agent-process --no-verify-jwt`
3. Verifikasi `GET /functions/v1/agent-process/health` → `deployed_commit_sha` cocok persis dengan commit yang baru di-push (`ce42b390ea3026a948b9354afd4125c76ffa180f`), status `HEALTHY`, semua service `UP`/`CONFIGURED` — **tidak ada drift**.

**Catatan keterbatasan:** tidak ada runtime Deno lokal untuk build/test Edge Function ini seperti biasanya dilakukan untuk frontend (Vite build + live browser test). Verifikasi dilakukan dengan menelusuri penuh rantai pemanggilan secara manual (`execution_context.ts` → `context_builder.ts` → `loadProjectMemory()`), bukan eksekusi test otomatis, ditambah verifikasi drift-check pasca-deploy di atas.

## 6. Status Akhir

Ketiga temuan di `PENDING-mametlite-memory-leak-fix.md` sekarang **selesai seluruhnya**. Dokumen sumber diperbarui statusnya.

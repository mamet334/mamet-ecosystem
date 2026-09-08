# Changelog: Fix Regresi HTTP 400 `verification_audit_logs` — Kolom `metadata` Tidak Ada

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Diverifikasi (REST API 200 + Build Pass)
**Scope:** Item 9 (Runtime Chat Session Stability) — regresi pada perbaikan yang sebelumnya diklaim selesai 2026-09-04
**Komponen Terdampak:** `frontend/src/hooks/useDashboardData.js`
**Referensi Terkait:** [`ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md`](../../roadmap/ROADMAP-RUNTIME-CHAT-SESSION-STABILITY-AND-HISTORY.md), [`2026-09-04-runtime-chat-session-stability-and-history-persistence.md`](./2026-09-04-runtime-chat-session-stability-and-history-persistence.md), [`INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md)

---

## 1. Latar Belakang

Saat verifikasi live Tier 3 Web Search di Chrome/Vercel (2026-09-08), console log menunjukkan error jaringan yang seharusnya sudah diperbaiki sebelumnya:
```
verification_audit_logs?select=decision%2Cstatus%2Cfailures%2Cexecution_time_ms%2Ctimestamp%2Cmetadata&order=timestamp.desc&limit=100:1
Failed to load resource: the server responded with a status of 400 ()
```
Changelog 2026-09-04 mencatat root cause sebelumnya adalah kolom `created_at` yang tidak ada (seharusnya `timestamp`) — dan itu sudah benar diperbaiki. Namun error 400 baru ini menunjukkan ada masalah kedua yang belum tertangani saat itu.

## 2. Investigasi & Akar Masalah

Query langsung ke Supabase REST API dengan query string identik dengan yang dipakai frontend mengonfirmasi pesan error PostgREST:
```json
{"code":"42703","message":"column verification_audit_logs.metadata does not exist"}
```

Ditelusuri lebih lanjut:
- Query di `useDashboardData.js:116` meminta kolom `metadata`, namun tabel fisik `verification_audit_logs` **tidak memiliki kolom tersebut**.
- Jalur penulis aktif tabel ini adalah Edge Function `supabase/functions/agent-process/lib/verification/verification_service.ts:85` (`persistVerificationAudit`), yang **tidak pernah menyertakan field `metadata`** dalam insert — ia menulis `source_trace`, `confidence`, `evidence`, dll.
- Ditemukan jalur penulis lain di `backend/telemetry.js:106` (`persistVerificationLog`) yang memang menulis field `metadata` — namun ini adalah backend Node.js versi lama yang tampaknya sudah tidak menjadi jalur aktif produksi (bukan bagian dari Edge Function `agent-process` yang saat ini menangani seluruh pipeline verifikasi).
- Field `metadata` ini dikonsumsi di `useDashboardData.js:695` sebagai fallback kedua (`latestVerWithTrace`) untuk fitur Auto-Load Trace pada dashboard. Fallback utamanya dari tabel `agent_logs` (yang **memang memiliki** kolom `metadata`, dikonfirmasi via query langsung) sudah cukup memenuhi kebutuhan fitur ini — fallback kedua ini secara efektif kode mati yang tidak pernah berhasil sejak awal.

**Kesimpulan:** Ini bukan regresi dari fix 2026-09-04 (fix `created_at`→`timestamp` tersebut tetap valid dan tidak diubah), melainkan bug pre-existing terpisah yang tidak terdeteksi pada sesi verifikasi sebelumnya karena console log saat itu kemungkinan hanya discan untuk pola generik "400" tanpa memeriksa isi pesan error per query secara spesifik.

## 3. Solusi

1. Menghapus `metadata` dari daftar kolom `select()` pada query `verification_audit_logs` di `useDashboardData.js:116` — hanya meminta kolom yang benar-benar ada di tabel fisik.
2. Menghapus variabel `latestVerWithTrace` beserta referensinya (baris 694-699) yang bergantung pada field `metadata` tak-tersedia tersebut. Fallback Auto-Load Trace dari `agent_logs` (`latestAgentWithTrace`) tetap dipertahankan utuh karena sudah berfungsi dan cukup.

Tidak ada perubahan schema database — perbaikan murni pada sisi query frontend.

## 4. Verifikasi

### 4.1 REST API Langsung
```bash
curl ".../rest/v1/verification_audit_logs?select=decision,status,failures,execution_time_ms,timestamp&order=timestamp.desc&limit=1"
# → HTTP 200 (sebelumnya 400)
```

### 4.2 Build Production
```
vite v5.4.21 building for production...
✓ built in 11.62s
```
Build bersih, 0 error.

## 5. Daftar Berkas yang Dimodifikasi

| No | Berkas | Deskripsi Perubahan |
|---|---|---|
| 1 | `frontend/src/hooks/useDashboardData.js` | Hapus kolom `metadata` dari select `verification_audit_logs`; hapus fallback `latestVerWithTrace` yang bergantung padanya |
| 2 | `docs/roadmap/INDEX-ROADMAP.md` | Catatan regresi & resolusi pada Item 9 Backlog |

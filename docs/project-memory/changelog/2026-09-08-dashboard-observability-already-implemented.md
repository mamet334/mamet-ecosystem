# Changelog: Audit `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md` — Ternyata Sudah Terimplementasi

**Tanggal:** 2026-09-08
**Status:** ✅ Dikonfirmasi Selesai (bukan eksekusi baru — audit dokumentasi vs kode aktual)
**Scope:** [`ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md`](../../roadmap/ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md)
**Komponen Diaudit:** `frontend/src/core/runtime/hooks/useDashboardData.js`, `frontend/src/components/dashboard/ObservabilityPanel.jsx`

---

## 1. Ringkasan

Sebelum memutuskan minta persetujuan Owner untuk mengeksekusi proposal ini, dilakukan verifikasi terhadap kode aktual (bukan asumsi dari status dokumen). Hasilnya: **seluruh scope §3 dokumen sudah terimplementasi**, dan dokumennya sendiri sudah 5 hari berstatus "PROPOSED" padahal sudah selesai.

## 2. Temuan

`git log -S` menunjukkan seluruh fix yang dibahas di §3 pertama kali muncul di commit `adaff68` (2026-09-04 00:08:03, `feat(ui): modernisasi knowledge graph obsidian, semantic inspector, dan full-width chat workspace`) — **commit yang SAMA** yang membuat file `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md` itu sendiri. Kemungkinan besar penulisan desain dan implementasi menyatu dalam satu sesi kerja besar, tapi status header dokumen tidak pernah diperbarui setelahnya.

## 3. Verifikasi Item per Item (§3 Dokumen)

| Item | Verifikasi |
|---|---|
| §3.A.1 — `SYSTEM STATUS` pakai jendela 15 menit, bukan riwayat *all-time* | ✅ `recentVerificationFail`/`recentVerificationWarn` dihitung dengan `isRecent()` (15 menit) di `useDashboardData.js`, dipakai untuk `verificationHealthRaw` yang masuk ke `vitals.verification` |
| §3.A.2 — Sanitasi `[object Object]` | ✅ Fungsi `sanitizeFailureMessage()` — namanya eksplisit menyebut mencegah bug ini, menangani string/array/object secara rekursif |
| §3.A.3 — Auto-load trace terbaru saat belum ada node dipilih | ✅ Komentar kode persis: "Auto-load latest trace from agent_logs on initial render (0 Token, realtime DB read)" |
| §3.A.4 — Metrik dari `agent_logs`/`api_usage`, bukan cuma `ai_system_logs` | ✅ Query paralel ke `agent_logs` dan `api_usage` sudah ada, dipakai untuk `totalMemoryReads`/`totalMemoryWrites`/`totalLlmCalls` |
| §3.B.1 — Rendering human-readable + truncate teks panjang | ✅ `break-words`, `.slice(0, 160)` di `ObservabilityPanel.jsx` |
| §3.B.2 — Deep-link resolusi Memory Conflicts | ✅ Tombol "Resolusi di Chat ➔" yang memanggil `ApplicationManager.activateApp('app:assistant')` + emit `Memory:OpenConflicts` |

Aggregate `SYSTEM STATUS` sendiri (yang jadi sumber bug "DOWN" palsu) ditelusuri sampai ke `ObservabilityPanel.jsx:224-236` — dihitung murni dari `Object.values(vitals)` (`hasDown`/`hasDegraded`/`hasUnknown`), bukan dari hitungan riwayat verifikasi historis. `HomeDashboard.jsx` dikonfirmasi tidak punya logika status terpisah — `ObservabilityPanel.jsx` satu-satunya sumber.

## 4. Catatan Path yang Sudah Berubah

Dokumen asli menyebut `frontend/src/hooks/useDashboardData.js` — path ini sudah pindah ke `frontend/src/core/runtime/hooks/useDashboardData.js` sejak housekeeping struktur folder (Backlog Item 14, sesi yang sama, 2026-09-08). Diperbarui di dokumen sumber.

## 5. Tindakan

- `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md` status header diperbarui dari "PROPOSED" jadi "✅ SELESAI", dengan catatan penjelasan drift dokumentasi dan path yang sudah berubah.
- Tidak ada perubahan kode — audit murni, tidak ada eksekusi baru.
- Didaftarkan sebagai Backlog Item 17 di [`INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md).

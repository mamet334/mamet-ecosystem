# T2: Enam Komponen Dasbor Yatim Dihapus

**Tanggal:** 21 September 2026
**Roadmap:** T2 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)), asal Item 48
**Status:** ✅ dihapus (keputusan Owner: hapus semua).

## Yang dihapus (`frontend/src/components/`, 1.364 baris)

| Komponen | Baris | Terakhir diubah | Tabel yang dibaca |
|---|---|---|---|
| `MemoryHealthDashboard.jsx` | 181 | 19 Jun | `memory_audit_logs` |
| `MonitoringDashboard.jsx` | 316 | 7 Jun | `monitors`, `checks`, `incidents` |
| `ObservabilityDashboard.jsx` | 209 | 19 Jun | `ai_system_logs` |
| `EngineerDashboard.jsx` | 277 | 30 Jun | `engineering_tasks`, `architecture_gaps`, `verification_runs`, `project_memory_entries` |
| `WorkDashboard.jsx` | 132 | 19 Jun | `user_memories`, `memory_audit_logs` |
| `ShopeeDashboard.jsx` | 249 | 19 Jun | `scheduled_tasks`, **`shopee_queue` (tabel sudah tidak ada)** |

## Alasan

- 0 pemakai di kode (dicek 2026-09-17 dan ulang 2026-09-21).
- `ShopeeDashboard` pasti mati: tabel `shopee_queue` tidak ada lagi di database.
- Lima lainnya ditulis sebelum Memory Governor, dasbor observability ✅, dan BillingDashboard; memasangnya berarti
  memeriksa ulang setiap angka terhadap server (pelajaran BillingDashboard: batas $0,50 hardcode vs $3 nyata). Bila
  dibutuhkan kelak, lebih aman dibangun ulang dari data sekarang.

## Pemeriksaan

- Rujukan di seluruh repo hanya di dokumen roadmap/arsip (catatan sejarah — dibiarkan), `graphify-out/` (keluaran
  generate lama), dan dua dokumen lama yang menyebut `EngineerDashboard.jsx` pernah ada (`MAMET-AI-ROADMAP.md`,
  `20_WORKSPACE_ARCHITECTURE.md`) — menggambarkan masa lalu, dibiarkan.
- `vite build` frontend exit 0 sesudah penghapusan.
- Dihapus dengan `git rm` — bisa dikembalikan dari riwayat git. Tabel database tidak disentuh.

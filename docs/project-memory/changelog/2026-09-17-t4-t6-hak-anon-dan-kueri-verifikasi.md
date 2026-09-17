# T4 Hak `anon` pada `match_documents` Dicabut · T6 Kueri `verification_audit_logs.metadata` Dihapus

**Tanggal:** 17 September 2026
**Roadmap:** T4 & T6 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)
**Status:** T4 ✅ aktif di database · T6 ✅ di kode, bukti konsol menunggu build Vercel / reload desktop.

## T4 — `match_documents` bisa dieksekusi `anon`

- **Sebelum:** ACL `=X/postgres, anon=X, authenticated=X, service_role=X` — `has_function_privilege('anon', …)` = true.
  Risiko rendah (SECURITY INVOKER, RLS tetap berlaku) tetapi tidak disengaja.
- **Pemanggil diperiksa:** `agent-process` `document_search.ts` (service_role, cadangan `match_documents_hybrid`) dan
  skrip uji `npm run desktop` (authenticated). Web & Mametlite tidak memanggil langsung.
- **Perubahan:** migrasi `20260917124719_revoke_anon_match_documents` — `revoke all … from public, anon`,
  `grant execute … to authenticated, service_role` (pola sama dengan `match_documents_hybrid` & `match_memories`).
- **Bukti:** anon = false, authenticated = true, service_role = true; panggilan uji mengembalikan 3 baris.
- **Security Advisor (dijalankan sesudahnya):** peringatan `match_memories`, `get_active_knowledge`,
  `check_daily_quota` (SECURITY DEFINER dengan parameter user) diperiksa — ketiganya punya pengaman
  `auth.role() = 'service_role' OR auth.uid() = target` yang menolak data pengguna lain. Tidak ada tindakan.

## T6 — `fetchExecutionTrace` meminta kolom yang tidak ada

- **Gejala:** konsol desktop/web `GET …/verification_audit_logs?select=…metadata&metadata->>trace_id=eq.… 400` —
  `42703 column verification_audit_logs.metadata does not exist`, setiap jejak eksekusi dimuat.
- **Isi tabel diperiksa:** 398 baris; `request_id` selalu null; `source_trace` berisi teks jejak sumber jawaban;
  penulis aktif (`agent-process` `verification_service.ts` `persistVerificationAuditLog`) tidak pernah menulis trace id.
  Penulis lama `backend/telemetry.js` (menulis `metadata`) bukan jalur produksi. → Tidak ada kolom untuk mencocokkan
  baris verifikasi ke `traceId`; kueri tak pernah bisa berhasil.
- **Perubahan:** kueri & normalisasi verifikasi dihapus dari `frontend/src/core/runtime/services/ExecutionTraceService.js`
  (komentar alasan di tempat); `timeline` = event `agent_logs`; bentuk hasil tetap, `sources.verification_audit_logs = 0`.
  Skema tidak diubah — preseden 2026-09-08 (`useDashboardData.js`, kolom yang sama).
- **Uji:** `vite build` frontend lolos.
- **Belum terbukti:** hilangnya 400 di konsol (sesudah build Vercel / reload `npm run desktop`).

## Batas yang disadari

- Jejak eksekusi tidak lagi mencoba menampilkan hasil verifikasi — sebelumnya pun selalu kosong. Menampilkannya
  butuh penulis verifikasi menyimpan trace id (perubahan terpisah, belum diminta).

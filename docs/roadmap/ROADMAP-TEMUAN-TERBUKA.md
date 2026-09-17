# ROADMAP: TEMUAN TERBUKA TANPA RANCANGAN SENDIRI

**Tipe Dokumen:** Daftar sisa pekerjaan (temuan audit yang belum punya dokumen roadmap sendiri)
**Status:** ⏳ **3 temuan terbuka** (T1–T3; T4–T7 ditutup) — masing-masing menunggu keputusan Owner
**Tanggal:** 2026-09-17 (dipindah dari INDEX-ROADMAP Item 33, 44, 48, 49, 50 saat perampingan)
**Aturan:** temuan yang dikerjakan dan tumbuh besar pindah ke dokumen roadmap sendiri; yang selesai dicatat di
changelog lalu barisnya diberi ✅ di sini.

Semua temuan di bawah **diperiksa ulang terhadap kode/database 2026-09-17**. Riwayat lengkapnya ada di
[`INDEX-ROADMAP-ARSIP-2026-09-17.md`](./INDEX-ROADMAP-ARSIP-2026-09-17.md) (nomor item asal).

---

## T1 — Jalur Lite: `web_search` & `rag_search` tanpa aturan izin per-tool (asal Item 33, 2026-09-09)

- **Temuan:** `agent-process` `lib/request/policy_middleware.ts` hanya punya aturan spesifik untuk
  `cron_manager` (`canUseAutomation`) dan `knowledge_manager` (`canWriteKnowledge`) — aturan `file_analyzer`
  ikut terhapus bersama jalur desktop lama (Item 85). `web_search`/`rag_search` lolos selama
  `toolsEnabled`. Dicek 2026-09-17: masih benar.
- **Dampak:** hanya jalur Lite (ws-lite desktop & mametlite.vercel.app, pengguna eksternal): tidak ada rem
  biaya/latensi pencarian web. Bukan kebocoran data (RAG terisolasi per pengguna).
- **Arah solusi:** tabel `tool → flag policy` (data-driven) menggantikan `if` per tool, lalu flag baru
  mis. `canUseWebSearch` per mode.
- **Keputusan Owner (2026-09-09):** di luar cakupan saat itu ("tidak perlu untuk ws lite karena ada mametlite").
- **Status:** ⏳ belum dikerjakan.

## T2 — Lima komponen dasbor yatim (asal Item 48, 2026-09-10)

- **Temuan:** tak diimpor/dipasang di mana pun (dicek 2026-09-17, 0 pemakai):
  `MemoryHealthDashboard.jsx`, `MonitoringDashboard.jsx`, `ObservabilityDashboard.jsx`, `EngineerDashboard.jsx`,
  `WorkDashboard.jsx`, ditambah `ShopeeDashboard.jsx` (kemungkinan peninggalan). `BillingDashboard` sudah dipasang
  (commit `119bd09`). `Login.jsx` **bukan** yatim (3 rujukan) — koreksi atas catatan lama.
- **Peringatan dari pemasangan BillingDashboard:** jangan pasang layar berisi angka basi (batas hardcode $0,50
  vs batas nyata $3) — setiap dasbor wajib memakai sumber angka yang sama dengan server.
- **Keputusan Owner yang dibutuhkan:** per komponen — pasang (dengan angka diperiksa) atau hapus.
- **Status:** ⏳ menunggu keputusan.

## T3 — Rute mati `/api/agent/process` di `backend/server.js` (asal Item 49, 2026-09-10)

- **Temuan:** rute masih ada (`backend/server.js:309`), tanpa pemanggil di frontend maupun mametlite; memetakan ke
  model OpenRouter yang sudah hilang (`google/gemini-2.0-flash-exp:free`) dan mengabaikan model pilihan pengguna.
  `/api/chat` yang dipakai Engineer bersih. `self_healing.ts` dari item yang sama sudah dihapus (`c902361`).
- **Risiko:** tidak ada selama tak disambungkan; menggigit bila dipakai ulang tanpa dibaca.
- **Keputusan Owner yang dibutuhkan:** hapus rute atau biarkan.
- **Status:** ⏳ belum dikerjakan.

## T4 — ✅ `match_documents` bisa dieksekusi `anon` (asal Item 50, 2026-09-10)

- **Temuan:** `has_function_privilege('anon', match_documents(...), 'execute') = true` (dicek 2026-09-17).
  Risiko rendah: fungsi `SECURITY INVOKER` sehingga RLS `document_chunks`/`documents` tetap berlaku, tetapi hak
  itu tampaknya tidak disengaja.
- **Arah solusi:** `REVOKE EXECUTE … FROM anon` lewat migrasi (diajukan ke Owner; pastikan tidak ada pemanggil
  tanpa login — mametlite memanggil dengan sesi).
- **Status:** ✅ ditutup 2026-09-17 — migrasi `20260917124719_revoke_anon_match_documents` (anon false,
  authenticated/service_role tetap). [log](../project-memory/changelog/2026-09-17-t4-t6-hak-anon-dan-kueri-verifikasi.md)

## T5 — ✅ Hapus dokumen di mametlite: potongan ikut terhapus? (asal Item 91, 2026-09-17)

- **Temuan awal:** mametlite hanya menghapus baris `documents`; cascade tidak terlihat di `supabase/migrations/`.
- **Dicek di DB live (baca-saja, 2026-09-17):** `document_chunks_document_id_fkey` ber-`ON DELETE CASCADE`;
  potongan yatim = 0. Tidak perlu perubahan.
- **Status:** ✅ ditutup — [changelog](../project-memory/changelog/2026-09-17-hapus-dokumen-cek-baris-terhapus.md).

## T6 — ✅ `fetchExecutionTrace` meminta kolom `verification_audit_logs.metadata` yang tidak ada (2026-09-17)

- **Temuan:** `frontend/src/core/runtime/services/ExecutionTraceService.js:610–615` memilih kolom `metadata` dan
  menyaring `metadata->>trace_id` pada `verification_audit_logs` → **400** `42703 column … metadata does not exist`
  (terlihat di console desktop Owner). Kolom tabel live: `id, created_at, timestamp, provider, model, request_id,
  user_id, decision, status, score, execution_time_ms, checks, failures, source_trace, confidence, evidence,
  confidence_score, review_confirmed` — tanpa `metadata`.
- **Dampak:** non-fatal (ditangkap sebagai `console.warn`), tetapi bagian verifikasi di jejak eksekusi **selalu
  kosong** dan tiap pemanggilan menambah satu request gagal.
- **Arah solusi (keputusan Owner):** sesuaikan kueri ke kolom yang ada (mis. `request_id`/`source_trace` bila
  memang memuat trace id — perlu dicek isinya dulu), atau tambah kolom `metadata` lewat migrasi bila penulisnya
  memang berniat mengisinya.
- **Catatan 2026-09-17:** isi kolom sudah dicek — `request_id` selalu `null` (398/398) dan `source_trace` berisi
  teks jejak sumber jawaban, bukan trace id; penulis aktif (`verification_service.ts`) tidak pernah menulis trace id.
  Preseden 2026-09-08 (`useDashboardData.js`): kolom `metadata` dibuang dari kueri tanpa mengubah skema.
- **Status:** ✅ ditutup 2026-09-17 — kueri verifikasi dihapus dari `ExecutionTraceService.js` (tak ada kolom
  pencocok trace id); build lolos. **Sisa kecil:** pastikan 400 hilang dari konsol sesudah build Vercel / reload
  desktop. Menampilkan hasil verifikasi di jejak butuh penulis menyimpan trace id (belum diminta).
  [log](../project-memory/changelog/2026-09-17-t4-t6-hak-anon-dan-kueri-verifikasi.md)

## T7 — ✅ Kunci API tersimpan di `agent_logs.metadata` (2026-09-17)

- **Temuan:** `audit_subscriber.ts` & `lifecycle_subscriber.ts` menyalin `event.payload` (berisi `rctx`/`env`) ke
  metadata log → 698 baris berisi kunci OpenRouter, Apify, Google, Groq (30 Juni – 17 September); terbaca pemilik
  di dasbor browser dan ikut `backup-export`.
- **Selesai:** penyaring `saring_rahasia.ts` di `persistTelemetryLog` (live v458, terbukti di log chat), 698 baris
  dibersihkan dengan izin Owner, pindai ulang seluruh DB = 0.
  [log](../project-memory/changelog/2026-09-17-kunci-api-bocor-di-agent-logs.md)
- **Sisa (Owner):** ganti kunci OpenRouter & token Apify (+ secret Supabase); cabut kunci Google/Groq lama bila
  masih aktif di tempat lain.

---

## Ditutup saat perampingan (tidak perlu dikerjakan)

- **Item 44 (2026-09-09) — tiga sisa temuan kecil:** kunci Gemini #0 403 → kunci server Gemini dihapus (Item 82);
  `prompt=20451t` → penyebab ditemukan & diperbaiki (Item 65 Kasus A, Item 66 prompt dobel −50%); pesan Owner
  terkirim dua kali → terkonfirmasi, efeknya sepanjang pertanyaan saja (Item 66).

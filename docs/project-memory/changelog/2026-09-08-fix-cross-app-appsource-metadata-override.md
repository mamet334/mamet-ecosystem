# Changelog: Fix Cross-App `appSource` Override — Mamet Lite Ditolak `ENGINEER_NO_API_KEY`

**Tanggal:** 2026-09-08
**Status:** ✅ Diperbaiki & Diverifikasi via log Supabase live (evidence-based, bukan asumsi)
**Scope:** Bug lintas-aplikasi ditemukan saat investigasi live `mametlite.vercel.app` (produk publik, terungkap sesi ini — lihat [`2026-09-08-rekonsiliasi-dokumen-roadmap-lama.md`](./2026-09-08-rekonsiliasi-dokumen-roadmap-lama.md) untuk konteks penemuan dual-deployment Mamet Lite)
**Komponen Terdampak:** `supabase/functions/agent-process/lib/request/request_parser.ts` (kode bersama semua app), `mametlite/src/lib/callAgentSimple.js`
**Dokumentasi Lengkap:** [`mametlite/CHANGELOG.md`](../../../mametlite/CHANGELOG.md) — kronologi investigasi lengkap dengan bukti log

---

## Ringkasan

User `mametlite.vercel.app` (produk publik untuk user eksternal) mendapat error `ENGINEER_NO_API_KEY` (HTTP 403) saat mengirim pertanyaan biasa. Root cause ditemukan lewat query langsung ke `function_logs` Supabase (bukan tebakan dari kode statis): akun user tersebut punya `user_metadata.app_source = "engineer"` tersisa dari sesi lama, dan `request_parser.ts` memberi prioritas metadata akun **di atas** `appSource` yang benar-benar dikirim aplikasi pemanggil — sehingga Mamet Lite dipaksa terklasifikasi sebagai Engineer walau mengirim `appSource: 'mametlite'` dengan benar.

Investigasi mengungkap bahkan **akun Owner sendiri** (`andreanastasya798@gmail.com`) punya tag stale yang sama — bug ini berpotensi memengaruhi trafik Assistant biasa milik Owner juga, tersamarkan karena Owner biasanya sudah punya BYOK key terkonfigurasi.

Investigasi lanjutan juga menemukan masalah kedua (independen, ditemukan bersamaan): payload Mamet Lite tidak pernah mengirim field `provider`, sehingga backend default ke `'openrouter'` — user tanpa BYOK key diam-diam memakai `OPENROUTER_API_KEY` milik Owner, bukan kuota gratis Gemini yang dimaksud.

## Perbaikan

1. `request_parser.ts` — prioritas dibalik: `appSource` dari client (tervalidasi allow-list, kini termasuk `'engineer'`) selalu menang; metadata akun cuma fallback.
2. `mametlite/src/lib/callAgentSimple.js` — tambah `provider: 'gemini'` eksplisit.

Detail root cause, log bukti, dan diff lengkap: lihat [`mametlite/CHANGELOG.md`](../../../mametlite/CHANGELOG.md).

## Metodologi Investigasi (dicatat karena berbeda dari sesi sebelumnya)

Sesi ini pertama kali menggunakan **query log Supabase langsung** (`query_logs` MCP tool, tabel `logs` dengan filter `source = 'function_logs'`) untuk melihat nilai `user_metadata` sesungguhnya pada request yang gagal — bukan mengandalkan pembacaan kode statis semata. Ini yang akhirnya membongkar root cause setelah investigasi kode statis mentok (frontend sudah dikonfirmasi benar via pembacaan bundle production langsung, backend sudah dikonfirmasi tidak drift).

## Daftar Berkas

| No | Berkas | Perubahan |
|---|---|---|
| 1 | `supabase/functions/agent-process/lib/request/request_parser.ts` | Balik prioritas `appSource`: client menang atas metadata akun |
| 2 | `mametlite/src/lib/callAgentSimple.js` | Tambah `provider: 'gemini'` eksplisit |
| 3 | `mametlite/CHANGELOG.md` | **Baru** — dokumentasi lengkap insiden khusus di dalam folder Mamet Lite |

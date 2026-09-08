# Changelog — Mamet Lite

Riwayat perubahan khusus untuk deployment `mametlite.vercel.app`. Untuk perubahan di sisi backend bersama (`agent-process`), lihat juga `docs/project-memory/changelog/` di root repo — entri di sana yang menyentuh Mamet Lite akan disebut silang di sini.

---

## 2026-09-08 — Fix: Request Mamet Lite Ditolak dengan `ENGINEER_NO_API_KEY`

**Status:** ✅ Diperbaiki & Diverifikasi via log Supabase live

### Gejala
User Mamet Lite (`slametbro798@gmail.com`) mengirim pertanyaan biasa ("siapa nama panggilan saya?") dan mendapat:
```
Error: ENGINEER_NO_API_KEY
POST .../functions/v1/agent-process → 403 (Forbidden)
```
Sudah dicoba logout–login ulang (memastikan sesi fresh), error tetap muncul secara konsisten.

### Investigasi
1. Bundle production (`index-B4sM2kNV.js`) dicek langsung — dikonfirmasi frontend mengirim payload benar: `appSource: "mametlite"`, tanpa field `mode`. Tidak ada jejak string "ENGINEER" di frontend sama sekali.
2. Deployment drift Edge Function dicek (`deploy_commit_sha` vs git HEAD) — tidak ada drift kode yang relevan.
3. Log Supabase (`function_logs`) untuk request yang gagal dibaca langsung. Ditemukan bukti definitif:
   ```json
   "user_metadata": { "app_source": "engineer", ... }
   ```
   Akun ini (dan bahkan akun Owner sendiri, `andreanastasya798@gmail.com`) tersimpan tag `app_source: "engineer"` di level Supabase Auth — kemungkinan tersisa dari sesi testing lama, tidak pernah dibersihkan.

### Root Cause
`supabase/functions/agent-process/lib/request/request_parser.ts` (kode bersama, dipakai semua aplikasi — Assistant, Engineer, Mamet Lite) punya urutan prioritas terbalik:
```ts
// SEBELUM (bug):
const resolvedAppSource = jwtAppSource ?? (ALLOWED_CLIENT_SOURCES.includes(clientAppSource) ? clientAppSource : 'assistant');
```
`user_metadata.app_source` (tag di akun) **selalu menang** dibanding `appSource` yang dikirim aplikasi pemanggil. Ini aman selama satu akun cuma dipakai satu aplikasi — tapi rusak begitu satu akun Supabase dipakai lintas-aplikasi (Owner pernah pakai akun ini untuk tes Engineer, tag itu menempel permanen, lalu akun yang sama dipakai login ke Mamet Lite → backend memaksa `appSource: "engineer"` walau Mamet Lite sudah benar mengirim `"mametlite"`).

Ditemukan juga masalah kedua saat investigasi (belum tentu penyebab error ini, tapi berisiko biaya): payload Mamet Lite tidak pernah mengirim field `provider`, sehingga `request_pipeline.ts` default ke `'openrouter'` — user Mamet Lite tanpa BYOK key diam-diam memakai `OPENROUTER_API_KEY` milik Owner di server, bukan kuota gratis Gemini yang dimaksud (`model: 'gemini-2.5-flash'`).

### Perbaikan
1. **`request_parser.ts`** — balik urutan prioritas: `appSource` yang dikirim client (divalidasi terhadap allow-list, kini termasuk `'engineer'`) selalu menang; `user_metadata.app_source` cuma fallback kalau client tidak kirim nilai yang dikenali.
2. **`mametlite/src/lib/callAgentSimple.js`** — tambah `provider: 'gemini'` eksplisit di payload, sesuai `model: 'gemini-2.5-flash'` yang sudah diminta.

### Verifikasi
- Log Supabase real digunakan untuk konfirmasi root cause (bukan tebakan) — lihat detail investigasi di atas.
- Build `mametlite` diverifikasi bersih pasca-perbaikan.
- Edge Function `agent-process` di-deploy ulang; retest live oleh Owner setelah deploy.

### Catatan untuk ke Depan
Bug ini adalah **cross-app metadata pollution** — risiko struktural selama arsitektur mengizinkan satu akun Supabase dipakai untuk >1 aplikasi bermakna berbeda (Owner main app vs Mamet Lite publik). Kalau ada akun lain yang pernah dipakai "coba-coba" fitur Engineer sebelumnya, akun itu punya risiko sama sampai fix ini di-deploy. Pertimbangkan jangka panjang: pisahkan sepenuhnya user pool antara Mamet OS (Owner) dan Mamet Lite (publik), atau tambahkan mekanisme pembersihan `user_metadata.app_source` yang stale.

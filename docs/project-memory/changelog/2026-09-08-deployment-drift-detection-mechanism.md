# Changelog: Mekanisme Deteksi Deployment Drift (Edge Function vs Git HEAD)

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai & Live-Verified (Deploy Production + Verifikasi End-to-End MATCH)
**Scope:** Bagian 6, Item 8 di `INDEX-ROADMAP.md`
**Komponen Terdampak:** `supabase/functions/agent-process/index.ts`, `scripts/deploy-agent-process.ps1` (baru), `scripts/verify-deployment-drift.ps1` (baru)
**Referensi Terkait:** [`INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md)

---

## 1. Latar Belakang

Backlog Item 8 mencatat tidak adanya cara otomatis untuk mendeteksi *deployment drift* — inkonsistensi antara commit git lokal/remote dengan build/runtime yang aktif dieksekusi di Supabase Cloud Edge Function `agent-process`. Sebelumnya, keterlambatan deployment hanya bisa dideteksi lewat penelusuran manual isi teks konteks sistem di console log (lihat Bug 9 di changelog `2026-09-04-pr9-web-comparison-live-hardening-and-epistemic-standardization.md`, di mana drift ini pernah menyebabkan label status hilang karena Edge Function masih menjalankan build lama v349).

## 2. Solusi yang Diterapkan

### A. Metadata Commit via Environment Variable (bukan file statis)
`supabase/functions/agent-process/index.ts` membaca tiga env var baru: `DEPLOYED_COMMIT_SHA`, `DEPLOYED_BRANCH`, `DEPLOYED_AT`. Dipilih pendekatan env var (bukan file JSON yang di-bundle) agar tidak terikat pada satu mekanisme deploy tertentu (CLI manual, script, atau MCP tool) — konsisten dengan pola `Deno.env.get(...)` yang sudah dipakai di file yang sama untuk validasi env lain.

Endpoint `/health` sekarang mengembalikan field tambahan:
```json
{
  "deployed_commit_sha": "...",
  "deployed_branch": "...",
  "deployed_at": "..."
}
```
Serta header response `x-deployed-commit-sha` pada response `/health`.

### B. Script Deploy: `scripts/deploy-agent-process.ps1`
Menjalankan urutan:
1. Ambil `git rev-parse HEAD`, branch aktif, dan timestamp UTC saat ini.
2. `supabase secrets set DEPLOYED_COMMIT_SHA=... DEPLOYED_BRANCH=... DEPLOYED_AT=...`.
3. `supabase functions deploy agent-process --no-verify-jwt` — flag `--no-verify-jwt` dipertahankan sesuai konvensi proyek yang sudah ada sejak 2026-07-22 (endpoint `/health` dan `proxy_fetch` dipanggil langsung dari browser tanpa JWT ketat).

### C. Script Verifikasi: `scripts/verify-deployment-drift.ps1`
Membandingkan `git rev-parse HEAD` lokal dengan `deployed_commit_sha` dari endpoint `/health` (tanpa perlu API key karena `--no-verify-jwt`). Exit code: `0` = MATCH, `1` = DRIFT atau commit tidak diketahui (`unknown`, berarti Edge Function belum pernah di-deploy lewat script ini), `2` = argumen tidak valid.

## 3. Verifikasi Live

### 3.1 Sebelum Deploy (Sanity Check Graceful Fallback)
Dijalankan terhadap Edge Function yang masih menjalankan kode lama (belum ada metadata commit):
```
Deployed Commit   :
[UNKNOWN] Edge Function belum pernah di-deploy via scripts/deploy-agent-process.ps1...
```
Exit code 1 — perilaku fallback bekerja sesuai desain, tidak crash maupun false-positive MATCH.

### 3.2 Deploy ke Production
```
supabase secrets set DEPLOYED_COMMIT_SHA=fc577177097cc96beba8c2448f82c2edd65c72e4 DEPLOYED_BRANCH=main DEPLOYED_AT=2026-09-08T06:01:51.093Z
supabase functions deploy agent-process --no-verify-jwt
→ {"functions":["agent-process"],"message":"Deployed Functions."}
```

### 3.3 Setelah Deploy
```
Local HEAD        : fc577177097cc96beba8c2448f82c2edd65c72e4
Deployed Commit   : fc577177097cc96beba8c2448f82c2edd65c72e4
Deployed Branch   : main
Deployed At (UTC) : 2026-09-08T06:01:51.093Z

[MATCH] Runtime Supabase Cloud sinkron dengan commit git HEAD lokal.
```
Exit code 0.

## 4. Batasan yang Diketahui (Known Limitation)

`supabase functions deploy` meng-upload isi **working directory** saat script dijalankan, bukan isi commit git tertentu. Jika ada perubahan yang belum di-commit saat `deploy-agent-process.ps1` dijalankan, `DEPLOYED_COMMIT_SHA` akan mencatat HEAD saat itu — namun kode yang benar-benar berjalan bisa jadi mengandung perubahan uncommitted di atas HEAD tersebut. **Rekomendasi penggunaan:** commit dan push perubahan terlebih dahulu sebelum menjalankan `deploy-agent-process.ps1`, agar SHA yang tercatat benar-benar identik dengan kode yang aktif di production.

## 5. Daftar Berkas yang Dibuat & Dimodifikasi

| No | Berkas | Deskripsi Perubahan |
|---|---|---|
| 1 | `supabase/functions/agent-process/index.ts` | Baca `DEPLOYED_COMMIT_SHA`/`DEPLOYED_BRANCH`/`DEPLOYED_AT` dari env, tambahkan ke response `/health` dan header `x-deployed-commit-sha` |
| 2 | `scripts/deploy-agent-process.ps1` | Baru — set secrets commit metadata lalu deploy `agent-process --no-verify-jwt` |
| 3 | `scripts/verify-deployment-drift.ps1` | Baru — bandingkan git HEAD lokal vs `deployed_commit_sha` dari `/health`, exit code untuk otomasi |
| 4 | `docs/roadmap/INDEX-ROADMAP.md` | Update status Item 8 Backlog menjadi selesai |

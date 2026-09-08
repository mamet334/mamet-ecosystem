<#
.SYNOPSIS
  Deploy Edge Function agent-process ke Supabase Cloud dengan metadata commit SHA
  tertanam, agar drift antara runtime aktif dan git HEAD bisa dideteksi otomatis.

.DESCRIPTION
  Menetapkan secrets DEPLOYED_COMMIT_SHA, DEPLOYED_BRANCH, DEPLOYED_AT ke project
  Supabase (dibaca oleh supabase/functions/agent-process/index.ts pada endpoint
  /health), lalu menjalankan `supabase functions deploy agent-process`.

.NOTES
  Referensi: docs/roadmap/INDEX-ROADMAP.md Bagian 6 Item 8 (Deployment Drift Detection)
  Verifikasi pasca-deploy: scripts/verify-deployment-drift.ps1
#>

$ErrorActionPreference = "Stop"

$commitSha = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$deployedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

if ([string]::IsNullOrEmpty($commitSha)) {
    Write-Error "Gagal membaca commit SHA dari git. Pastikan dijalankan di dalam repository git."
    exit 1
}

Write-Host "Commit SHA : $commitSha"
Write-Host "Branch     : $branch"
Write-Host "Deployed At: $deployedAt"
Write-Host ""

Write-Host "Menetapkan deployment metadata sebagai Supabase secrets..."
supabase secrets set `
    "DEPLOYED_COMMIT_SHA=$commitSha" `
    "DEPLOYED_BRANCH=$branch" `
    "DEPLOYED_AT=$deployedAt"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Gagal menetapkan secrets. Deploy dibatalkan."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploying agent-process (--no-verify-jwt, sesuai konvensi proyek karena endpoint /health dan proxy_fetch dipanggil langsung dari browser)..."
supabase functions deploy agent-process --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deploy gagal."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy selesai. Verifikasi sinkronisasi dengan:"
Write-Host "  ./scripts/verify-deployment-drift.ps1 -HealthUrl <URL>/functions/v1/agent-process/health"

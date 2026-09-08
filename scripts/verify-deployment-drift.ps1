<#
.SYNOPSIS
  Verifikasi apakah Edge Function agent-process yang aktif di Supabase Cloud
  sinkron dengan commit git HEAD lokal/remote (deteksi Deployment Drift).

.PARAMETER HealthUrl
  URL endpoint /health milik agent-process, contoh:
  https://<project-ref>.supabase.co/functions/v1/agent-process/health
  Bisa juga diset via environment variable AGENT_PROCESS_HEALTH_URL.

.PARAMETER ApiKey
  Opsional. agent-process di-deploy dengan --no-verify-jwt (lihat
  scripts/deploy-agent-process.ps1) sehingga endpoint /health tidak
  memerlukan auth. Diberikan hanya untuk jaga-jaga bila konfigurasi
  verify_jwt berubah di kemudian hari. Bisa diset via environment
  variable VITE_SUPABASE_ANON_KEY.

.NOTES
  Referensi: docs/roadmap/INDEX-ROADMAP.md Bagian 6 Item 8 (Deployment Drift Detection)
  Exit code: 0 = MATCH, 1 = DRIFT atau commit tidak diketahui, 2 = argumen tidak valid.
#>

param(
    [string]$HealthUrl = $env:AGENT_PROCESS_HEALTH_URL,
    [string]$ApiKey = $env:VITE_SUPABASE_ANON_KEY
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrEmpty($HealthUrl)) {
    Write-Error "Berikan -HealthUrl atau set environment variable AGENT_PROCESS_HEALTH_URL."
    exit 2
}

$localSha = (git rev-parse HEAD).Trim()

Write-Host "Mengambil status deployment dari: $HealthUrl"
if ([string]::IsNullOrEmpty($ApiKey)) {
    $response = Invoke-RestMethod -Uri $HealthUrl -Method Get
}
else {
    $headers = @{
        "apikey"        = $ApiKey
        "Authorization" = "Bearer $ApiKey"
    }
    $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -Headers $headers
}

$deployedSha = $response.deployed_commit_sha
$deployedBranch = $response.deployed_branch
$deployedAt = $response.deployed_at

Write-Host ""
Write-Host "Local HEAD        : $localSha"
Write-Host "Deployed Commit   : $deployedSha"
Write-Host "Deployed Branch   : $deployedBranch"
Write-Host "Deployed At (UTC) : $deployedAt"
Write-Host ""

if ([string]::IsNullOrEmpty($deployedSha) -or $deployedSha -eq "unknown") {
    Write-Warning "[UNKNOWN] Edge Function belum pernah di-deploy via scripts/deploy-agent-process.ps1 (secrets DEPLOYED_COMMIT_SHA belum diset), atau deploy dilakukan lewat mekanisme lain tanpa metadata commit."
    exit 1
}
elseif ($deployedSha -eq $localSha) {
    Write-Host "[MATCH] Runtime Supabase Cloud sinkron dengan commit git HEAD lokal." -ForegroundColor Green
    exit 0
}
else {
    Write-Warning "[DRIFT] Runtime Supabase Cloud menjalankan commit berbeda dari git HEAD lokal! Kemungkinan ada perubahan kode yang belum di-deploy, atau HEAD lokal sudah maju melewati deployment terakhir."
    exit 1
}

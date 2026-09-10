<#
  word_to_pdf.ps1 — Word -> PDF lewat Microsoft Word + printer virtual "Microsoft Print to PDF".

  KENAPA LEWAT PRINTER, BUKAN "SAVE AS PDF"
  Mesin Owner punya DUA Word: Word 2007 RTM (12.0.4518, berlisensi, tanpa add-in
  EXP_PDF.DLL sehingga tidak bisa SaveAs PDF) dan Word 365 (16.0, TANPA lisensi,
  mode baca saja). Mencetak ke printer PDF bawaan Windows memakai mesin tata
  letak Word sendiri, sehingga hasilnya identik dengan yang tampil di Word
  (diverifikasi 2026-09-10 pada dokumen HCDP 47 halaman berisi 15 grafik 3D).

  WORD MANA YANG JALAN DITENTUKAN OLEH PEMANGGIL, BUKAN SKRIP INI
  COM "Word.Application" terdaftar dua kali: PowerShell 64-bit membuka Word 365,
  PowerShell 32-bit (SysWOW64) membuka Word 2007. Pemanggil (electron/main.cjs)
  sengaja memakai yang 32-bit — Word 2007 berlisensi dan tidak memunculkan
  dialog "Save to OneDrive to enable editing" yang menahan Word 365.

  JEBAKAN 0 KB
  Printer PDF membuat berkas keluaran SEKETIKA dalam keadaan 0 byte, lalu baru
  mengisinya setelah antrian cetak selesai (bisa beberapa menit). Karena itu skrip
  ini TIDAK menganggap "berkas sudah ada" sebagai berhasil. Ia menunggu sampai:
    1. berkas berakhir dengan penanda %%EOF,
    2. ukurannya berhenti bertambah, dan
    3. tidak ada lagi job cetak untuk dokumen ini,
  lalu membandingkan jumlah halaman PDF dengan jumlah halaman menurut Word.

  KELUARAN
  Baris "PID:<angka>" (proses Word milik skrip ini, agar pemanggil bisa
  menghentikannya bila macet), lalu SATU baris JSON terakhir berisi hasil.
#>
param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$PrinterName = 'Microsoft Print to PDF',
  [int]$TimeoutSec = 600
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result($hasil) {
  [Console]::Out.WriteLine(($hasil | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  Write-Result @{ ok = $false; stage = 'input'; error = "Berkas tidak ditemukan: $InputPath" }
  exit 2
}

$printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $PrinterName }
if (-not $printer) {
  Write-Result @{ ok = $false; stage = 'printer'; error = "Printer '$PrinterName' tidak terpasang di Windows ini." }
  exit 2
}

# Mengganti Application.ActivePrinter di Word ikut mengganti printer DEFAULT Windows.
# Catat yang sekarang supaya bisa dikembalikan persis setelah selesai.
$defaultSebelum = (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name

$word = $null
$doc = $null
$pidMilikSendiri = $null
$halamanWord = $null
$versiWord = $null
$catatanTutup = @()
$wordDitutup = 'belum'
$galatWord = $null
$mulai = Get-Date

try {
  # Catat proses Word yang sudah ada (mungkin Owner sedang membuka dokumen lain).
  # Hanya proses BARU yang dianggap milik skrip ini — Word Owner tidak boleh ditutup.
  $pidSebelum = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $word = New-Object -ComObject Word.Application
  $pidSesudah = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $pidMilikSendiri = $pidSesudah | Where-Object { $pidSebelum -notcontains $_ } | Select-Object -First 1
  [Console]::Out.WriteLine("PID:$pidMilikSendiri")
  [Console]::Out.Flush()

  $versiWord = $word.Version
  $word.Visible = $false
  $word.DisplayAlerts = 0                     # wdAlertsNone — dialog tersembunyi = proses macet
  try { $word.AutomationSecurity = 3 } catch {} # msoAutomationSecurityForceDisable — makro tidak dijalankan

  $missing = [Type]::Missing
  # Documents.Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
  $doc = $word.Documents.Open($InputPath, $false, $true, $false)
  $halamanWord = $doc.ComputeStatistics(2)     # wdStatisticPages

  $printerWordSebelum = $word.ActivePrinter
  $word.ActivePrinter = $PrinterName
  try {
    # PrintOut(Background, Append, Range, OutputFileName, From, To, Item, Copies,
    #          Pages, PageType, PrintToFile, Collate)
    # PrintToFile + OutputFileName = tanpa jendela "Simpan sebagai".
    # Background=$false = Word menunggu sampai seluruh halaman diserahkan ke antrian.
    $doc.PrintOut($false, $false, 0, $OutputPath, $missing, $missing, $missing, 1, $missing, $missing, $true, $true)
  } finally {
    try { $word.ActivePrinter = $printerWordSebelum } catch {}
  }
}
catch {
  $galatWord = $_.Exception.Message
}
finally {
  # Argumen WAJIB [ref]. Word 2007 lewat COM menolak angka biasa dengan pesan
  # "Argument: '1' should be a PSReference". Versi pertama skrip ini menulis
  # Quit(0) di dalam catch {} kosong — error-nya tertelan, Word tidak pernah
  # tertutup, dan setiap konversi meninggalkan satu WINWORD.EXE tersembunyi.
  # Karena itu error penutupan kini DICATAT dan ikut dilaporkan.
  if ($doc) {
    try { $doc.Close([ref]0) } catch { $catatanTutup += "Close: $($_.Exception.Message)" }   # wdDoNotSaveChanges
  }
  if ($word) {
    # Quit HANYA bila Word ini benar-benar dibuat oleh skrip. Kalau COM ternyata
    # menempel ke Word Owner yang sudah terbuka, Quit akan menutup dokumen Owner.
    if ($pidMilikSendiri) {
      try { $word.Quit([ref]0) } catch { $catatanTutup += "Quit: $($_.Exception.Message)" }
    } else {
      $wordDitutup = 'bukan milik skrip, dibiarkan'
    }
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
    $word = $null
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  }

  # Jaring pengaman: Word bisa tertahan dialog tersembunyi yang tidak bisa
  # ditekan siapa pun (terbukti di Word 365 tanpa lisensi: "Save to OneDrive to
  # enable editing"). Proses milik skrip yang masih hidup setelah 15 detik
  # dihentikan paksa — dokumennya dibuka read-only, jadi tidak ada yang hilang.
  if ($pidMilikSendiri) {
    $tunggu = (Get-Date).AddSeconds(15)
    while ((Get-Process -Id $pidMilikSendiri -ErrorAction SilentlyContinue) -and (Get-Date) -lt $tunggu) {
      Start-Sleep -Milliseconds 500
    }
    if (Get-Process -Id $pidMilikSendiri -ErrorAction SilentlyContinue) {
      try { Stop-Process -Id $pidMilikSendiri -Force; $wordDitutup = 'dipaksa' } catch { $wordDitutup = 'gagal ditutup' }
    } else {
      $wordDitutup = 'normal'
    }
  }
  $defaultSesudah = (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name
  if ($defaultSebelum -and $defaultSesudah -ne $defaultSebelum) {
    try {
      $p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $defaultSebelum }
      if ($p) { [void](Invoke-CimMethod -InputObject $p -MethodName SetDefaultPrinter) }
    } catch {}
  }
}

$infoWord = @{ word_versi = $versiWord; word_ditutup = $wordDitutup; catatan_tutup = $catatanTutup }

if ($galatWord) {
  Write-Result (@{ ok = $false; stage = 'word'; error = $galatWord; halaman_word = $halamanWord } + $infoWord)
  exit 1
}

# ---- Tunggu berkas benar-benar selesai ditulis (lihat JEBAKAN 0 KB di atas) ----
$namaDokumen = [System.IO.Path]::GetFileName($InputPath)
$ukuranLalu = -1
$stabil = 0
$selesai = $false
$batas = (Get-Date).AddSeconds($TimeoutSec)

function Test-BerakhirEof($path) {
  try {
    $fs = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try {
      if ($fs.Length -lt 16) { return $false }
      $n = [Math]::Min(1024, $fs.Length)
      [void]$fs.Seek(-$n, 'End')
      $buf = New-Object byte[] $n
      [void]$fs.Read($buf, 0, $n)
      return ([System.Text.Encoding]::ASCII.GetString($buf)).Contains('%%EOF')
    } finally { $fs.Close() }
  } catch { return $false }
}

while ((Get-Date) -lt $batas) {
  Start-Sleep -Seconds 2
  if (-not (Test-Path -LiteralPath $OutputPath)) { continue }
  $ukuran = (Get-Item -LiteralPath $OutputPath).Length
  $masihAntre = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue |
    Where-Object { $_.DocumentName -like "*$namaDokumen*" }).Count -gt 0
  if ($ukuran -gt 0 -and $ukuran -eq $ukuranLalu -and -not $masihAntre -and (Test-BerakhirEof $OutputPath)) {
    $stabil++
    if ($stabil -ge 2) { $selesai = $true; break }
  } else {
    $stabil = 0
  }
  $ukuranLalu = $ukuran
}

$detik = [int]((Get-Date) - $mulai).TotalSeconds

if (-not $selesai) {
  $ukuranAkhir = if (Test-Path -LiteralPath $OutputPath) { (Get-Item -LiteralPath $OutputPath).Length } else { 0 }
  Write-Result (@{ ok = $false; stage = 'tunggu'; error = "PDF belum selesai ditulis setelah $TimeoutSec detik."; ukuran = $ukuranAkhir; halaman_word = $halamanWord; detik = $detik } + $infoWord)
  exit 1
}

# ---- Bukti: jumlah halaman PDF harus sama dengan menurut Word ----
$isi = [System.IO.File]::ReadAllText($OutputPath, [System.Text.Encoding]::GetEncoding(28591))
$halamanPdf = ([regex]::Matches($isi, '/Type\s*/Page(?![a-zA-Z])')).Count

Write-Result (@{
  ok           = ($halamanPdf -gt 0 -and $halamanPdf -eq $halamanWord)
  stage        = 'selesai'
  output       = $OutputPath
  ukuran       = (Get-Item -LiteralPath $OutputPath).Length
  halaman_word = $halamanWord
  halaman_pdf  = $halamanPdf
  detik        = $detik
  error        = $(if ($halamanPdf -ne $halamanWord) { "Jumlah halaman tidak cocok: Word $halamanWord, PDF $halamanPdf." } else { $null })
} + $infoWord)
exit 0

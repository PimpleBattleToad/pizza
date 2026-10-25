# Собирает pizza-site.zip для хостинга (Netlify Drop, GitHub Pages и т. п.).
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\make-zip.ps1
#
# Важно: Compress-Archive пишет в путях обратные слэши, и на Linux-хостинге
# иконки перестают находиться. Поэтому пути задаём вручную — с прямыми слэшами.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$zip  = Join-Path $root 'pizza-site.zip'

# Что кладём в архив: только то, что нужно сайту.
$files = @(
  'pizza.html',
  'index.html',
  'manifest.json',
  'sw.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png'
)

foreach ($f in $files) {
  $full = Join-Path $root ($f -replace '/', '\')
  if (-not (Test-Path -LiteralPath $full)) { throw "Нет файла: $f" }
}

if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$stream = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
try {
  $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($f in $files) {
      $full = Join-Path $root ($f -replace '/', '\')
      $entry = $archive.CreateEntry($f, [System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = (Get-Item -LiteralPath $full).LastWriteTime
      $es = $entry.Open()
      try {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $es.Write($bytes, 0, $bytes.Length)
      } finally { $es.Dispose() }
    }
  } finally { $archive.Dispose() }
} finally { $stream.Dispose() }

$size = [Math]::Round((Get-Item -LiteralPath $zip).Length / 1KB, 1)
Write-Host ''
Write-Host ("Готово: {0} ({1} КБ)" -f $zip, $size) -ForegroundColor Green
Write-Host 'Этот файл можно перетащить на https://app.netlify.com/drop'

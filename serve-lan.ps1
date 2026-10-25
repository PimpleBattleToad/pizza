# Раздаёт калькулятор по Wi-Fi: откройте адрес с телефона в той же сети.
# Запуск:  powershell -ExecutionPolicy Bypass -File serve-lan.ps1 [порт]
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = $null

# 1) Node из PATH, если он там есть.
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }

# 2) Иначе — Node, который идёт в комплекте DSH (он есть почти всегда).
if (-not $node) {
  $bundled = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path -LiteralPath $bundled) { $node = $bundled }
}

if (-not $node) {
  Write-Host 'Не нашёл Node.js. Установите его с https://nodejs.org или запустите pizza.html напрямую.' -ForegroundColor Yellow
  exit 1
}

Write-Host ('Node: ' + $node) -ForegroundColor DarkGray
& $node (Join-Path $root 'serve-lan.js') $Port

param(
  [string]$Source = $PSScriptRoot,
  [string]$Destination = '\\wsl.localhost\Ubuntu\home\pedro\Programacion',
  [string]$BackupDirectory = 'C:\Users\pedro\OneDrive\Escritorio\Respaldo',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$excludeDirs = @(
  '.git',
  '.atl',
  'node_modules',
  'dist',
  'NoNecesario',
  '.venv',
  '.pytest_cache',
  '__pycache__',
  '.mypy_cache',
  '.idea',
  '.vscode'
)

$excludeFiles = @(
  '.env.local',
  '*.pyc',
  '*.pyo',
  '*.log'
)

if (-not (Test-Path -LiteralPath $Source)) {
  throw "La carpeta origen no existe: $Source"
}

if (-not (Test-Path -LiteralPath $Destination)) {
  throw "La carpeta destino no existe: $Destination"
}

if (-not (Test-Path -LiteralPath $BackupDirectory)) {
  New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFileName = "Programacion$timestamp.tar.gz"
$backupFilePath = Join-Path $BackupDirectory $backupFileName

$wslBackupDirectory = '/mnt/c/Users/pedro/OneDrive/Escritorio/Respaldo'
$wslBackupFilePath = "$wslBackupDirectory/$backupFileName"

Write-Host 'Generando respaldo TAR.GZ del destino actual desde WSL...' -ForegroundColor Cyan
Write-Host "Respaldo: $backupFilePath"

$backupCommand = "tar -czf '$wslBackupFilePath' -C /home/pedro Programacion"

if (-not $DryRun) {
  $backupTimer = [System.Diagnostics.Stopwatch]::StartNew()
  wsl bash -lc $backupCommand
  $backupTimer.Stop()
  if ($LASTEXITCODE -ne 0) {
    throw "El respaldo en WSL fallo con codigo $LASTEXITCODE"
  }
  Write-Host ("Respaldo completado en {0:mm\:ss}." -f $backupTimer.Elapsed) -ForegroundColor Green
}

$robocopyArgs = @(
  $Source,
  $Destination,
  '/MIR',
  '/R:2',
  '/W:1',
  '/XJ',
  '/FFT',
  '/NP',
  '/XD'
) + $excludeDirs + @(
  '/XF'
) + $excludeFiles

if ($DryRun) {
  $robocopyArgs += '/L'
}

Write-Host 'Sincronizando proyecto hacia WSL...' -ForegroundColor Cyan
Write-Host "Origen:  $Source"
Write-Host "Destino: $Destination"
Write-Host "Backup:  $backupFilePath"
if ($DryRun) {
  Write-Host 'Modo simulacion activado: no se generara respaldo ni se copiaran archivos.' -ForegroundColor Yellow
}

if (-not $DryRun) {
  $syncTimer = [System.Diagnostics.Stopwatch]::StartNew()
}

& robocopy @robocopyArgs
$exitCode = $LASTEXITCODE

if (-not $DryRun) {
  $syncTimer.Stop()
}

if ($exitCode -ge 8) {
  throw "Robocopy fallo con codigo $exitCode"
}

Write-Host "Sincronizacion completada. Codigo robocopy: $exitCode" -ForegroundColor Green
if (-not $DryRun) {
  Write-Host ("Sync completado en {0:mm\:ss}." -f $syncTimer.Elapsed) -ForegroundColor Green
}

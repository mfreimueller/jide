# Starts the exam-folder exe with JIDE_SMOKE=1 and prints the time until JIDE_SMOKE_READY.
# Usage: pwsh exam-smoke.ps1 -Exe <path to JDE.exe> -Label <text>
param([Parameter(Mandatory)][string]$Exe, [Parameter(Mandatory)][string]$Label, [int]$TimeoutMs = 60000)
$ErrorActionPreference = "Stop"
$env:JIDE_SMOKE = "1"
Remove-Item Env:JIDE_USER_DATA_DIR -ErrorAction SilentlyContinue   # exam mode must pick %TEMP%\JDE-exam itself
$out = Join-Path $env:RUNNER_TEMP "exam-smoke.out"
$err = Join-Path $env:RUNNER_TEMP "exam-smoke.err"
$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $Exe -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
$ready = $false
while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
  if ((Test-Path $out) -and ((Get-Content $out -Raw -ErrorAction SilentlyContinue) -match "JIDE_SMOKE_READY")) { $ready = $true; break }
  if ($p.HasExited) { break }
  Start-Sleep -Milliseconds 25
}
$ms = $sw.ElapsedMilliseconds
if (-not $p.HasExited) { $p.WaitForExit(10000) | Out-Null }
if (-not $p.HasExited) { $p.Kill() }
Get-Content $out, $err -ErrorAction SilentlyContinue
if (-not $ready) { throw "[$Label] JIDE_SMOKE_READY not printed within $TimeoutMs ms" }
"[$Label] start-up until JIDE_SMOKE_READY: $ms ms"

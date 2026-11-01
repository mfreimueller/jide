# Starts the exam-folder exe with JIDE_SMOKE=1 and prints the time until JIDE_SMOKE_READY.
# Usage: pwsh exam-smoke.ps1 -Exe <path to JDE.exe> -Label <text>
param([Parameter(Mandatory)][string]$Exe, [Parameter(Mandatory)][string]$Label, [int]$TimeoutMs = 60000, [string[]]$AppArgs = @())
$ErrorActionPreference = "Stop"
$env:JIDE_SMOKE = "1"
Remove-Item Env:JIDE_USER_DATA_DIR -ErrorAction SilentlyContinue   # exam mode must pick %TEMP%\JDE-exam itself
$out = Join-Path $env:RUNNER_TEMP "exam-smoke.out"
$err = Join-Path $env:RUNNER_TEMP "exam-smoke.err"
$sw = [Diagnostics.Stopwatch]::StartNew()
$sp = @{ FilePath = $Exe; RedirectStandardOutput = $out; RedirectStandardError = $err; PassThru = $true }
if ($AppArgs.Count -gt 0) { $sp.ArgumentList = $AppArgs }
$p = Start-Process @sp
$ready = $false
while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
  if ((Test-Path $out) -and ((Get-Content $out -Raw -ErrorAction SilentlyContinue) -match "JIDE_SMOKE_READY")) { $ready = $true; break }
  if ($p.HasExited) { break }
  Start-Sleep -Milliseconds 25
}
$ms = $sw.ElapsedMilliseconds
if (-not $ready) {
  "[$Label] diagnostics: HasExited=$($p.HasExited)"
  if ($p.HasExited) { "exit code: $($p.ExitCode)" }
  Get-Process | Where-Object { $_.ProcessName -match "JDE|consent|dllhost|SmartScreen|explorer" } |
    Select-Object ProcessName, Id, Responding, MainWindowTitle | Format-Table | Out-String
  # Text of any dialog the app (or Windows) is showing, e.g. a startup error or a security warning.
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $root = [Windows.Automation.AutomationElement]::RootElement
    $wins = $root.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)
    foreach ($w in $wins) {
      if ($w.Current.Name -match "Error|Warning|Security|JDE|J;DE|Fehler") {
        "window '$($w.Current.Name)' (pid $($w.Current.ProcessId)):"
        foreach ($t in $w.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.Condition]::TrueCondition)) { "  $($t.Current.ControlType.ProgrammaticName): $($t.Current.Name)" }
      }
    }
  } catch { "UI automation failed: $_" }
}
if (-not $p.HasExited) { $p.WaitForExit(10000) | Out-Null }
if (-not $p.HasExited) { $p.Kill() }
Get-Content $out, $err -ErrorAction SilentlyContinue
if (-not $ready) { throw "[$Label] JIDE_SMOKE_READY not printed within $TimeoutMs ms" }
"[$Label] start-up until JIDE_SMOKE_READY: $ms ms"

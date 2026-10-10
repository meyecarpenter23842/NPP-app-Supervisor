param(
    [Parameter(Mandatory=$true)][string]$InstallerDir,
    [Parameter(Mandatory=$true)][string]$EvidenceDir
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
function Assert-True($ok, $msg) { if (-not $ok) { throw $msg } }
function Run-Installer($file, $directory) {
    $installer = Start-Process -FilePath $file -ArgumentList "/S /D=$directory" -PassThru -Wait
    Assert-True ($installer.ExitCode -eq 0) "NSIS installer failed (exit code $($installer.ExitCode))"
}
function Run-App($file, $label) {
    $proc = Start-Process -FilePath $file -PassThru
    try {
        Start-Sleep -Seconds 7
        $proc.Refresh()
        Assert-True (-not $proc.HasExited) "Native startup failure at $label; exit=$($proc.ExitCode)"
        Write-Output "PASS: Windows native process started: $label"
        # CI shell availability is not a visual QA assertion. Screenshot, if any,
        # is documentary only; actual interactive UX still requires QA evidence.
    } finally {
        if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 2
    }
}
$installers = @(Get-ChildItem -LiteralPath $InstallerDir -Filter "*.exe" -File)
Assert-True ($installers.Count -eq 1) "Expected one NSIS installer artifact"
$installer = $installers[0]
$installPath = Join-Path $env:RUNNER_TEMP "sc-install-ci"
Assert-True (-not (Test-Path $installPath)) "Installer test path already exists"
$before = @(
    Get-ChildItem -Path $env:APPDATA, $env:LOCALAPPDATA -Recurse -Filter "sales-supervisor.sqlite3" -File -ErrorAction SilentlyContinue
)
Assert-True ($before.Count -eq 0) "CI runner already contains a Supervisor database; refusing to touch it"
Run-Installer $installer.FullName $installPath
$binary = Join-Path $installPath "sales-supervisor.exe"
Assert-True (Test-Path $binary) "NSIS did not install the application exe"
Run-App $binary "fresh-install"
$dbs = @(
    Get-ChildItem -Path $env:APPDATA, $env:LOCALAPPDATA -Recurse -Filter "sales-supervisor.sqlite3" -File -ErrorAction SilentlyContinue
)
Assert-True ($dbs.Count -eq 1) "Expected exactly one SQLite app-data DB after launch; found $($dbs.Count)"
$db = $dbs[0].FullName
Assert-True (-not $db.StartsWith($installPath, [StringComparison]::OrdinalIgnoreCase)) "Database was created inside install directory"
python tests/smoke_installer_db.py $db seed
if ($LASTEXITCODE -ne 0) { throw "Seed fixture failed" }
Run-App $binary "restart-with-existing-operator"
python tests/smoke_installer_db.py $db verify
if ($LASTEXITCODE -ne 0) { throw "Restart persistence failed" }
$uninstall = Join-Path $installPath "uninstall.exe"
Assert-True (Test-Path $uninstall) "Expected NSIS uninstaller"
$uninstaller = Start-Process -FilePath $uninstall -ArgumentList "/S" -PassThru -Wait
Assert-True ($uninstaller.ExitCode -eq 0) "NSIS uninstall failed"
Assert-True (Test-Path $db) "Uninstall removed user SQLite database"
python tests/smoke_installer_db.py $db verify
if ($LASTEXITCODE -ne 0) { throw "Uninstall persistence failed" }
Run-Installer $installer.FullName $installPath
Run-App $binary "reinstall-with-existing-operator"
python tests/smoke_installer_db.py $db verify
if ($LASTEXITCODE -ne 0) { throw "Reinstall persistence failed" }
$meta = [ordered]@{
  commit=$env:GITHUB_SHA
  workflowRun=$env:GITHUB_RUN_ID
  version="0.1.0"
  installer=$installer.Name
  sha256=(Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  sizeBytes=$installer.Length
  testPath="disposable Windows runner"
  migratedVersions=@("001","002")
  nativeProcessSmoke="PASS"
  sqliteRestartReinstall="PASS"
  realCleanWindowsMachine="UNVERIFIED"
  realInteractiveUIandOfflineNetwork="UNVERIFIED"
  versionUpgradeNtoNplus1="UNVERIFIED"
}
$meta | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $EvidenceDir "installer-smoke.json") -Encoding UTF8
Write-Output "PASS: NSIS install/restart/uninstall/reinstall; app-data SQLite fixture preserved"

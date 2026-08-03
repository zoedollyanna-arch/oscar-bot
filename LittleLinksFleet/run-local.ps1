# Start the fleet worker on a developer machine.
#
# On EC2 the worker is a systemd unit (littlelinks-fleet.service) reading
# /etc/littlelinks/fleet.env. Locally there is no systemd, and passing the
# environment inline means a restart depends on whichever shell happened to
# set it -- lose the shell, lose the ability to restart the fleet. This
# script makes a local restart reproducible instead.
#
# Secrets are never stored here. DATABASE_URL is read from the backend's
# .env and the RSA private key is read from a file, matching production.

param(
    [string]$SecretsDir  = "C:\Users\Shadow\Desktop\LittleLinks-Secrets",
    [string]$BackendEnv  = "C:\Users\Shadow\Desktop\Lifeline-Backend-main\.env",
    [string]$LogFile     = "$env:TEMP\littlelinks-fleet.log",
    [switch]$NoRestart      # start only if nothing is already running
)

$ErrorActionPreference = "Stop"
$fleetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dotnet   = "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"
if (-not (Test-Path $dotnet)) { $dotnet = "dotnet" }

function Read-EnvFile([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    foreach ($line in Get-Content $path) {
        $t = $line.Trim()
        if ($t.Length -eq 0 -or $t.StartsWith("#")) { continue }
        $i = $t.IndexOf("=")
        if ($i -lt 1) { continue }
        $k = $t.Substring(0, $i).Trim()
        $v = $t.Substring($i + 1).Trim()
        # Strip surrounding quotes -- they belong to .env syntax, not the value.
        if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or
                                  ($v.StartsWith("'") -and $v.EndsWith("'")))) {
            $v = $v.Substring(1, $v.Length - 2)
        }
        $map[$k] = $v
    }
    return $map
}

# Note the names: PowerShell variables are case-insensitive, so a local
# named $backendEnv would silently overwrite the $BackendEnv parameter.
$fleetVars   = Read-EnvFile (Join-Path $SecretsDir "fleet.env")
$backendVars = Read-EnvFile $BackendEnv

foreach ($k in $fleetVars.Keys) { Set-Item -Path "env:$k" -Value $fleetVars[$k] }

# The fleet.env shipped to EC2 carries a placeholder for DATABASE_URL and a
# Linux path for the key. Both are corrected for local use here.
$dbUrl = $backendVars["DATABASE_URL"]
if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw "DATABASE_URL not found in $BackendEnv" }
$env:DATABASE_URL = $dbUrl

$keyFile = Join-Path $SecretsDir "fleet-private.pem"
if (-not (Test-Path $keyFile)) { throw "Fleet private key not found at $keyFile" }
$env:LITTLELINKS_FLEET_PRIVATE_KEY_FILE = $keyFile

$existing = Get-CimInstance Win32_Process -Filter "Name='dotnet.exe'" |
            Where-Object { $_.CommandLine -like "*LittleLinksFleet.dll*" }

if ($existing) {
    if ($NoRestart) {
        Write-Output "Fleet already running (PID $($existing.ProcessId)); -NoRestart given, leaving it alone."
        return
    }
    foreach ($p in $existing) {
        Write-Output "Stopping existing fleet worker PID $($p.ProcessId)"
        # Stop-Process by PID, not pkill: pkill does not reliably kill
        # Windows processes and a silently-failed stop leaves the old build
        # running while you believe you restarted it.
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
}

$dll = Join-Path $fleetDir "bin\Debug\net8.0\LittleLinksFleet.dll"
if (-not (Test-Path $dll)) {
    $dll = (Get-ChildItem -Path (Join-Path $fleetDir "bin") -Recurse -Filter "LittleLinksFleet.dll" |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
if (-not $dll -or -not (Test-Path $dll)) { throw "LittleLinksFleet.dll not found -- run dotnet build first." }

Write-Output "Starting  : $dll"
Write-Output "Worker    : $($env:FLEET_WORKER_ID)  capacity=$($env:FLEET_CAPACITY)"
Write-Output "API       : $($env:LITTLELINKS_API_URL)"
Write-Output "HUD item  : $($env:LITTLELINKS_HUD_ITEM)"
Write-Output "Log       : $LogFile"

if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
$proc = Start-Process -FilePath $dotnet -ArgumentList $dll `
            -WorkingDirectory $fleetDir -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $LogFile -RedirectStandardError "$LogFile.err"

Write-Output "Started PID $($proc.Id)"

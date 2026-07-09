# AlphaTrack - Dev-Sync zum NAS-Hot-Reload-Container (Port 3003)
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\sync-dev.ps1 [-Rebuild] [-KeepData]
[CmdletBinding()]
param(
    [switch]$Rebuild,   # Docker-Image neu bauen (z.B. nach package.json-Aenderung)
    [switch]$KeepData   # Datenkopie NICHT von Prod aktualisieren (Standard: bei jedem Sync frisch ziehen)
)

$ErrorActionPreference = 'Stop'
$ScriptDir  = (Split-Path -Parent $MyInvocation.MyCommand.Path) -replace '^Microsoft\.PowerShell\.Core\\FileSystem::', ''
$RepoRoot   = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir '..\..'))
$ConfigPath = Join-Path $ScriptDir 'sync-dev.config.json'
$Sep        = '-' * 55

function Write-Step([string]$Msg)  { Write-Host ''; Write-Host "  $Msg" -ForegroundColor Cyan; Write-Host "  $Sep" }
function Write-Ok([string]$Msg)    { Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn2([string]$Msg) { Write-Host "  [!] $Msg" -ForegroundColor Yellow }
function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# --- Konfiguration ------------------------------------------

function Read-Config {
    $cfg = [ordered]@{
        nas_host        = '192.168.178.3'
        nas_ssh_port    = '88'
        nas_ssh_user    = 'G99SEMAN'
        nas_prod_dir    = '/volume1/docker/alphatrack'
        nas_dev_dir     = '/volume1/docker/alphatrack-dev'
        nas_dev_port    = '3003'
        ssh_key         = "$env:USERPROFILE\.ssh\alphatrack_nas"
    }
    if (Test-Path $ConfigPath) {
        $saved = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        foreach ($k in @($cfg.Keys)) {
            $v = $saved.PSObject.Properties[$k]
            if ($null -ne $v -and "$($v.Value)" -ne '') { $cfg[$k] = "$($v.Value)" }
        }
    } else {
        Write-Warn2 'Keine sync-dev.config.json gefunden - lege sie mit Standardwerten an.'
        Write-Warn2 "Ggf. Werte in $ConfigPath anpassen."
    }
    $json = ([PSCustomObject]$cfg | ConvertTo-Json -Depth 3)
    Write-Utf8NoBom $ConfigPath $json
    return $cfg
}

function Get-SshArgs($cfg) {
    $args = @('-p', $cfg.nas_ssh_port)
    if ($cfg.ssh_key -and (Test-Path $cfg.ssh_key)) { $args += @('-i', $cfg.ssh_key) }
    return $args
}

function Get-ScpArgs($cfg) {
    # -O erzwingt das alte SCP-Protokoll statt SFTP - Synology hat den
    # SFTP-Subsystem-Dienst standardmaessig nicht aktiviert ("subsystem
    # request failed on channel 0" sonst).
    $args = @('-O', '-P', $cfg.nas_ssh_port)
    if ($cfg.ssh_key -and (Test-Path $cfg.ssh_key)) { $args += @('-i', $cfg.ssh_key) }
    return $args
}

# --- Ablauf ---------------------------------------------------

$cfg = Read-Config
$sshArgs = Get-SshArgs $cfg
$scpArgs = Get-ScpArgs $cfg
$target  = "$($cfg.nas_ssh_user)@$($cfg.nas_host)"

Write-Step '[1/4] Quellcode packen'
$tarPath = Join-Path $env:TEMP 'alphatrack-dev-sync.tar.gz'
if (Test-Path $tarPath) { Remove-Item $tarPath -Force }
Push-Location $RepoRoot
& tar -czf $tarPath `
    --exclude=node_modules --exclude=.git --exclude=.next --exclude=out `
    --exclude=data --exclude=data-dev --exclude=coverage `
    --exclude='scripts/windows/*.config.json' `
    .
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'tar fehlgeschlagen.' }
Write-Ok "Archiv erstellt ($([math]::Round((Get-Item $tarPath).Length / 1MB, 1)) MB)."

Write-Step '[2/4] Zum NAS uebertragen'
& scp @scpArgs $tarPath "${target}:/tmp/alphatrack-dev-sync.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'scp fehlgeschlagen.' }
Remove-Item $tarPath -Force
Write-Ok 'Uebertragen.'

Write-Step '[3/4] Auf dem NAS entpacken + Erststart pruefen'
$devDir  = $cfg.nas_dev_dir
$prodDir = $cfg.nas_prod_dir

$remoteCmd = @"
set -e
mkdir -p '$devDir'
tar xzf /tmp/alphatrack-dev-sync.tar.gz -C '$devDir'
rm /tmp/alphatrack-dev-sync.tar.gz

if [ ! -d '$devDir/data-dev' ] || [ '$($KeepData.IsPresent)' != 'True' ]; then
  echo '  -> Datenkopie von Prod wird erstellt/aktualisiert...'
  # WICHTIG: data-dev ist live in den laufenden Container gemountet (/app/data).
  # NICHT rm -rf + neu anlegen - das Verzeichnis waere fuer einen Moment weg
  # und der Dev-Server (der parallel weiterlaeuft) wuerde ENOENT werfen.
  # Stattdessen nur Dateien in-place ueberschreiben, Verzeichnis bleibt bestehen.
  mkdir -p '$devDir/data-dev'
  if [ -d '$prodDir/data' ]; then cp -rf '$prodDir/data/.' '$devDir/data-dev/'; fi
else
  echo '  -> -KeepData gesetzt, Datenkopie bleibt unveraendert.'
fi

if [ ! -f '$devDir/.env.local' ] && [ -f '$prodDir/.env.local' ]; then
  cp '$prodDir/.env.local' '$devDir/.env.local'
  echo '  -> .env.local von Prod uebernommen.'
fi

cd '$devDir'
if ! sudo /usr/local/bin/docker compose -f docker-compose.dev.yml ps --status running 2>/dev/null | grep -q alphatrack-dev || [ '$($Rebuild.IsPresent)' = 'True' ]; then
  echo '  -> Dev-Container wird (neu) gebaut und gestartet...'
  sudo /usr/local/bin/docker compose -f docker-compose.dev.yml up -d --build
else
  echo '  -> Dev-Container laeuft bereits, Hot-Reload greift automatisch.'
fi
"@

& ssh @sshArgs $target $remoteCmd
if ($LASTEXITCODE -ne 0) { throw 'Remote-Befehl auf dem NAS fehlgeschlagen.' }

Write-Step '[4/4] Fertig'
Write-Ok "Dev-Version laeuft unter: http://$($cfg.nas_host):$($cfg.nas_dev_port)"
Write-Host ''

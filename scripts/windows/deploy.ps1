# AlphaTrack Deploy — NAS (Docker) + Mini-PC (Bridge/Bots) via SSH
# Aufruf ueber deploy.bat oder: powershell -NoProfile -ExecutionPolicy Bypass -File deploy.ps1 [-ConfigOnly]
[CmdletBinding()]
param(
    [switch]$ConfigOnly   # nur Konfiguration abfragen/speichern, kein Deploy
)

$ErrorActionPreference = 'Stop'
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$ConfigPath = Join-Path $ScriptDir 'deploy.config.json'
$Sep        = '-' * 55

# --- Ausgabe-Helfer ---------------------------------------

function Write-Step([string]$Msg)  { Write-Host ''; Write-Host "  $Msg" -ForegroundColor Cyan; Write-Host "  $Sep" }
function Write-Ok([string]$Msg)    { Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn2([string]$Msg) { Write-Host "  [!] $Msg" -ForegroundColor Yellow }
function Write-Fail([string]$Msg)  { Write-Host "  [FEHLER] $Msg" -ForegroundColor Red }

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# --- Konfiguration ----------------------------------------

function Read-DeployConfig {
    $cfg = [ordered]@{
        nas_host          = '192.168.178.3'
        nas_ssh_port      = '88'
        nas_ssh_user      = 'G99SEMAN'
        nas_project_dir   = '/volume1/docker/alphatrack'
        nas_app_port      = '3002'
        minipc_host       = ''
        minipc_ssh_user   = ''
        minipc_target_dir = 'C:\AlphaTrack'
        mt5_login         = ''
        mt5_password      = ''
        mt5_server        = ''
        mt5_exe_path      = 'C:\Program Files\MetaTrader 5\terminal64.exe'
    }
    if (Test-Path $ConfigPath) {
        try {
            $saved = Get-Content $ConfigPath -Raw | ConvertFrom-Json
            foreach ($k in @($cfg.Keys)) {
                $v = $saved.PSObject.Properties[$k]
                if ($null -ne $v -and "$($v.Value)" -ne '') { $cfg[$k] = "$($v.Value)" }
            }
        } catch {
            Write-Warn2 "deploy.config.json unlesbar — starte mit Standardwerten."
        }
    }
    return $cfg
}

function Save-DeployConfig($cfg) {
    $json = ([PSCustomObject]$cfg | ConvertTo-Json -Depth 5)
    Write-Utf8NoBom $ConfigPath $json
    Write-Ok "Konfiguration gespeichert: $ConfigPath"
}

function Ask-Value([string]$Label, [string]$Current, [switch]$Secret) {
    if ($Secret -and $Current -ne '') { $display = '****' }
    elseif ($Current -ne '')          { $display = $Current }
    else                              { $display = '(leer)' }
    $raw = Read-Host "  $Label [$display]"
    $trimmed = if ($raw) { $raw.Trim() } else { '' }
    if ($trimmed -eq '') { return $Current }
    return $trimmed
}

function Ask-Required([string]$Label, [string]$Current, [switch]$Secret) {
    while ($true) {
        $val = Ask-Value $Label $Current -Secret:$Secret
        if ("$val" -ne '') { return $val }
        Write-Warn2 'Pflichtfeld — bitte einen Wert eingeben.'
    }
}

function Invoke-Questionnaire($cfg) {
    Write-Host ''
    Write-Host "  $Sep"
    Write-Host '   AlphaTrack Deploy — Konfiguration'
    Write-Host "  $Sep"
    Write-Host '  Enter = gespeicherten Wert in [..] uebernehmen'

    Write-Step '[1] NAS (AlphaTrack-Container)'
    $cfg.nas_host        = Ask-Required 'NAS IP-Adresse'      $cfg.nas_host
    $cfg.nas_ssh_port    = Ask-Required 'NAS SSH-Port'        $cfg.nas_ssh_port
    $cfg.nas_ssh_user    = Ask-Required 'NAS SSH-Benutzer'    $cfg.nas_ssh_user
    $cfg.nas_project_dir = Ask-Required 'NAS Projektpfad'     $cfg.nas_project_dir
    $cfg.nas_app_port    = Ask-Required 'AlphaTrack-Port'     $cfg.nas_app_port

    Write-Step '[2] Mini-PC (Bridge, Bots, MetaTrader)'
    $cfg.minipc_host       = Ask-Required 'Mini-PC IP/Hostname'  $cfg.minipc_host
    $cfg.minipc_ssh_user   = Ask-Required 'Mini-PC SSH-Benutzer' $cfg.minipc_ssh_user
    $cfg.minipc_target_dir = Ask-Required 'Mini-PC Zielordner'   $cfg.minipc_target_dir

    Write-Step '[3] MetaTrader 5 — Zugangsdaten'
    while ($true) {
        $login = Ask-Required 'Kontonummer (Login)' $cfg.mt5_login
        $tmp = 0
        if ([int]::TryParse($login, [ref]$tmp)) { $cfg.mt5_login = $login; break }
        Write-Warn2 'Kontonummer muss eine Zahl sein.'
    }
    $cfg.mt5_password = Ask-Required 'Passwort'                          $cfg.mt5_password -Secret
    $cfg.mt5_server   = Ask-Required 'Server (z.B. BlackBullMarkets-Demo)' $cfg.mt5_server
    $cfg.mt5_exe_path = Ask-Required 'Pfad zu terminal64.exe'            $cfg.mt5_exe_path
}

# --- Hauptablauf ------------------------------------------

function Invoke-Main {
    $cfg = Read-DeployConfig
    Invoke-Questionnaire $cfg
    Save-DeployConfig $cfg

    if ($ConfigOnly) {
        Write-Ok 'Nur-Konfig-Modus — kein Deploy ausgefuehrt.'
        return
    }

    Write-Warn2 'Deploy-Phasen noch nicht implementiert (folgt in spaeteren Tasks).'
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Invoke-Main
        exit 0
    } catch {
        Write-Fail $_.Exception.Message
        exit 1
    }
}

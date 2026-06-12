# NAS/Mini-PC-Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deploy.bat wird zu einem interaktiven Deploy-Werkzeug, das AlphaTrack auf das NAS (Docker) und Bridge/Bots auf den Mini-PC (SSH) ausrollt — inkl. Konfigurationsabfrage mit gespeicherten Defaults, MT5-Zugangsdaten, API-Key-Verwaltung und Abschluss-Check.

**Architecture:** `scripts/windows/deploy.bat` wird ein dünner Wrapper um das neue `scripts/windows/deploy.ps1` (PowerShell 5.1-kompatibel). Das Skript läuft in 4 Phasen: (0) Konfigurationsabfrage mit Defaults aus `deploy.config.json`, (1) NAS-Deploy (git push, `.env.local` sicherstellen, `nas-update.sh`, Profilauswahl via `/api/bridge/info`), (2) Mini-PC-Deploy (Code per tar+scp, Configs generieren, Firewall, geplante Aufgabe für die Bridge), (3) Abschluss-Check (Bridge-Registrierung via `GET /api/bots` pollen).

**Tech Stack:** Windows PowerShell 5.1, OpenSSH-Client (ssh/scp, in Windows enthalten), bsdtar (`tar.exe`, in Windows enthalten), `schtasks`/`netsh` auf dem Mini-PC.

**Spec:** `docs/superpowers/specs/2026-06-12-nas-minipc-deploy-design.md`

## Wichtige Codebase-Fakten (für Implementierer ohne Kontext)

- `GET /api/bridge/info` ([src/app/api/bridge/info/route.ts](../../src/app/api/bridge/info/route.ts)) liefert `{ url, profiles: [{id, name, currency, broker}] }` — **bewusst KEINEN API-Key**.
- Der API-Key ist `BOT_API_KEY` aus der Umgebung des Containers ([src/lib/auth.ts](../../src/lib/auth.ts), `process.env.BOT_API_KEY`). Auf dem NAS kommt er aus `.env.local` (docker-compose `env_file`). Bridge und Bots müssen exakt denselben Wert in `api_key` haben.
- Die Bridge registriert sich beim Start selbst per `POST /api/bots` (bridge/main.py `_register_bridge`), wenn `bridge_id` in ihrer config.json leer ist. `GET /api/bots` liefert `{ bots: [{id, name, profileId, url, type, createdAt}] }`.
- `nas-update.sh` macht auf dem NAS `git reset --hard origin/main` + Docker rebuild; `.env.local` ist untracked und überlebt das. Die Datei MUSS vor `docker compose up` existieren (env_file).
- Python liest die Configs mit `encoding="utf-8"` → JSON-Dateien müssen **UTF-8 ohne BOM** sein (PowerShell 5.1 schreibt standardmäßig mit BOM — deshalb `[System.IO.File]::WriteAllText` mit `UTF8Encoding($false)`).
- PowerShell 5.1: kein `&&`/`||`, kein ternärer Operator. In Remote-Kommando-Strings (cmd.exe auf dem Mini-PC, sh auf dem NAS) ist `&&`/`||` dagegen erlaubt — das parst die Gegenseite, nicht PowerShell.
- Bot-Ordner unter `bots/` (aktuell `testbot2`, `pricemonitor`) haben je eine `config.json`; `bots/scaffold/` ist gemeinsame Infrastruktur ohne config.json und wird mitkopiert, aber nicht konfiguriert.
- Es gibt keine Test-Infrastruktur für Skripte im Repo (kein Pester). Verifikation: PowerShell-Parser-Syntaxcheck + Dot-Sourcing der reinen Funktionen + `-ConfigOnly`-Lauf. Echte Deploys sind UAT mit dem Nutzer.

## Dateistruktur

| Datei | Aktion | Verantwortung |
|---|---|---|
| `scripts/windows/deploy.ps1` | Neu | Gesamtes Deploy: Abfrage, NAS, Mini-PC, Check |
| `scripts/windows/deploy.bat` | Ersetzen | Doppelklick-Wrapper, ruft deploy.ps1 |
| `scripts/windows/deploy.config.json` | Zur Laufzeit erzeugt | Gespeicherte Antworten (gitignored) |
| `.gitignore` | Ergänzen | `deploy.config.json` ausschließen |
| `README.md` | Ergänzen | Kurzer Abschnitt zum neuen Deploy |

---

### Task 1: deploy.config.json gitignoren

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore ergänzen**

Am Ende von `.gitignore` anfügen:

```gitignore
# Deploy-Konfiguration (enthaelt MT5-Zugangsdaten des Nutzers)
scripts/windows/deploy.config.json
```

- [ ] **Step 2: Verifizieren**

Run: `git check-ignore -v scripts/windows/deploy.config.json`
Expected: Ausgabe zeigt die neue .gitignore-Zeile (Exit-Code 0).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: deploy.config.json gitignoren (enthaelt MT5-Zugangsdaten)"
```

---

### Task 2: deploy.ps1 Grundgerüst + Konfigurationsabfrage + deploy.bat-Wrapper

**Files:**
- Create: `scripts/windows/deploy.ps1`
- Modify: `scripts/windows/deploy.bat` (kompletter Ersatz)

- [ ] **Step 1: deploy.ps1 anlegen**

Komplette Datei `scripts/windows/deploy.ps1` (UTF-8 mit BOM ist hier OK, PowerShell-eigene Datei):

```powershell
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
    if ($raw -eq '') { return $Current }
    return $raw.Trim()
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
```

- [ ] **Step 2: Syntaxcheck**

Run:
```
powershell -NoProfile -Command "$t=$null;$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('scripts/windows/deploy.ps1',[ref]$t,[ref]$e); if($e.Count){$e | ForEach-Object{$_.Message}; exit 1} else {'SYNTAX OK'}"
```
Expected: `SYNTAX OK`

- [ ] **Step 3: deploy.bat ersetzen**

Kompletter neuer Inhalt von `scripts/windows/deploy.bat`:

```batch
@echo off
title AlphaTrack - Deploy (NAS + Mini-PC)
color 0B
cls

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set EXITCODE=%errorlevel%

if %EXITCODE% neq 0 (
    echo.
    echo  FEHLER: Deploy fehlgeschlagen. Details siehe oben.
)

echo.
pause
exit /b %EXITCODE%
```

- [ ] **Step 4: Konfigurationsabfrage manuell prüfen (Nur-Konfig-Modus)**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/deploy.ps1 -ConfigOnly`
(Interaktiv: bei jeder Frage Enter drücken, bei Pflichtfeldern Testwerte eingeben, z.B. Mini-PC `192.168.178.40`, User `test`, Login `123`, Passwort `x`, Server `Demo`.)
Expected: Alle Fragen erscheinen mit Defaults, am Ende `Konfiguration gespeichert` und `Nur-Konfig-Modus`. Danach prüfen: `scripts/windows/deploy.config.json` existiert, enthält die eingegebenen Werte, und `git status` zeigt sie NICHT (gitignored).

- [ ] **Step 5: Commit**

```bash
git add scripts/windows/deploy.ps1 scripts/windows/deploy.bat
git commit -m "feat(deploy): deploy.ps1 Grundgeruest mit Konfigurationsabfrage, deploy.bat als Wrapper"
```

---

### Task 3: Phase 1 — NAS-Deploy (git push, .env.local, nas-update, Profilauswahl)

**Files:**
- Modify: `scripts/windows/deploy.ps1` (Funktionen VOR dem Abschnitt `# --- Hauptablauf ---` einfügen)

- [ ] **Step 1: NAS-Funktionen einfügen**

Folgenden Block in `deploy.ps1` direkt VOR `# --- Hauptablauf ---` einfügen:

```powershell
# --- Phase 1: NAS ------------------------------------------

function Invoke-NasSsh($cfg, [string]$RemoteCmd) {
    & ssh -p $cfg.nas_ssh_port "$($cfg.nas_ssh_user)@$($cfg.nas_host)" $RemoteCmd
}

function Invoke-GitPush {
    Write-Host '  git push ...'
    & git -C $RepoRoot push
    if ($LASTEXITCODE -ne 0) { throw 'git push fehlgeschlagen.' }
    Write-Ok 'Code zu GitHub gepusht.'
}

# Stellt sicher, dass .env.local auf dem NAS existiert und BOT_API_KEY enthaelt.
# Gibt den BOT_API_KEY zurueck — Bridge und Bots brauchen exakt denselben Wert.
function Confirm-NasEnvFile($cfg) {
    $envPath = "$($cfg.nas_project_dir)/.env.local"

    Invoke-NasSsh $cfg "test -f $envPath"
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 ".env.local fehlt auf dem NAS — wird angelegt."
        $botKey = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        $anthropicKey = Read-Host '  Anthropic-API-Key fuer KI-Analyse (optional, Enter = ueberspringen)'
        $remoteCmd = "printf '%s\n' 'BOT_API_KEY=$botKey' > $envPath"
        if ("$anthropicKey" -ne '') {
            $remoteCmd = "printf '%s\n' 'BOT_API_KEY=$botKey' 'ANTHROPIC_API_KEY=$($anthropicKey.Trim())' > $envPath"
        }
        Invoke-NasSsh $cfg $remoteCmd
        if ($LASTEXITCODE -ne 0) { throw ".env.local konnte nicht angelegt werden ($envPath)." }
        Write-Ok '.env.local auf dem NAS angelegt (BOT_API_KEY generiert).'
        return $botKey
    }

    $line = (Invoke-NasSsh $cfg "grep '^BOT_API_KEY=' $envPath") | Select-Object -First 1
    if ("$line" -eq '') {
        Write-Warn2 "BOT_API_KEY fehlt in $envPath — wird ergaenzt."
        $botKey = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        Invoke-NasSsh $cfg "printf '%s\n' 'BOT_API_KEY=$botKey' >> $envPath"
        if ($LASTEXITCODE -ne 0) { throw "BOT_API_KEY konnte nicht ergaenzt werden." }
        return $botKey
    }
    $key = $line.Substring('BOT_API_KEY='.Length).Trim()
    Write-Ok 'BOT_API_KEY vom NAS uebernommen.'
    return $key
}

function Invoke-NasUpdate($cfg) {
    Write-Host "  Update auf NAS ausfuehren ($($cfg.nas_ssh_user)@$($cfg.nas_host)) ..."
    Invoke-NasSsh $cfg "bash $($cfg.nas_project_dir)/scripts/nas-update.sh"
    if ($LASTEXITCODE -ne 0) { throw 'nas-update.sh auf dem NAS fehlgeschlagen.' }
    Write-Ok 'NAS-Container neu gebaut und gestartet.'
}

function Wait-ForAlphaTrack($cfg) {
    $url = "http://$($cfg.nas_host):$($cfg.nas_app_port)/api/bridge/info"
    Write-Host "  Warte auf AlphaTrack ($url) ..."
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        try {
            $info = Invoke-RestMethod -Uri $url -TimeoutSec 5
            Write-Ok 'AlphaTrack ist erreichbar.'
            return $info
        } catch {
            Start-Sleep -Seconds 5
        }
    }
    throw "AlphaTrack unter $url nicht erreichbar (Timeout 120s). Container-Log auf dem NAS pruefen: sudo docker logs alphatrack"
}

function Select-TradingProfile($info, $cfg) {
    $profiles = @($info.profiles)
    if ($profiles.Count -eq 0) {
        throw "Keine Profile auf dem NAS-AlphaTrack vorhanden. Bitte zuerst unter http://$($cfg.nas_host):$($cfg.nas_app_port) ein Profil anlegen und Deploy erneut starten."
    }
    if ($profiles.Count -eq 1) {
        Write-Ok "Nur ein Profil vorhanden — automatisch gewaehlt: $($profiles[0].name)"
        return $profiles[0].id
    }
    Write-Host ''
    Write-Host '  Verfuegbare Profile auf dem NAS:'
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        Write-Host ("    {0}) {1} ({2}) - {3}" -f ($i + 1), $profiles[$i].name, $profiles[$i].currency, $profiles[$i].broker)
    }
    while ($true) {
        $raw = Read-Host "  Profil waehlen [1-$($profiles.Count)]"
        $idx = 0
        if ([int]::TryParse($raw, [ref]$idx) -and $idx -ge 1 -and $idx -le $profiles.Count) {
            $chosen = $profiles[$idx - 1]
            Write-Ok "Gewaehlt: $($chosen.name)"
            return $chosen.id
        }
        Write-Warn2 "Bitte Zahl zwischen 1 und $($profiles.Count) eingeben."
    }
}
```

- [ ] **Step 2: Syntaxcheck**

Run (gleicher Befehl wie Task 2 Step 2).
Expected: `SYNTAX OK`

- [ ] **Step 3: Pure Funktion testen (Dot-Sourcing)**

Run:
```
powershell -NoProfile -Command ". .\scripts\windows\deploy.ps1; $info = [PSCustomObject]@{ profiles = @([PSCustomObject]@{id='abc'; name='Demo'; currency='USD'; broker='X'}) }; $id = Select-TradingProfile $info ([ordered]@{nas_host='1.2.3.4'; nas_app_port='3002'}); if ($id -eq 'abc') {'TEST OK'} else {'TEST FAIL'; exit 1}"
```
Expected: `... automatisch gewaehlt: Demo` und `TEST OK` (Dot-Sourcing führt wegen Guard kein Main aus).

- [ ] **Step 4: Commit**

```bash
git add scripts/windows/deploy.ps1
git commit -m "feat(deploy): Phase 1 - NAS-Deploy mit .env.local-Verwaltung und Profilauswahl"
```

---

### Task 4: Phase 2a — Code-Kopie zum Mini-PC + Config-Generierung

**Files:**
- Modify: `scripts/windows/deploy.ps1` (Funktionen VOR `# --- Hauptablauf ---` einfügen)

- [ ] **Step 1: Mini-PC-Funktionen einfügen**

Folgenden Block in `deploy.ps1` direkt VOR `# --- Hauptablauf ---` einfügen:

```powershell
# --- Phase 2: Mini-PC --------------------------------------

function Invoke-MiniPcSsh($cfg, [string]$RemoteCmd) {
    & ssh "$($cfg.minipc_ssh_user)@$($cfg.minipc_host)" $RemoteCmd
}

function Test-MiniPcSsh($cfg) {
    & ssh -o ConnectTimeout=5 "$($cfg.minipc_ssh_user)@$($cfg.minipc_host)" "exit"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Mini-PC per SSH nicht erreichbar: $($cfg.minipc_ssh_user)@$($cfg.minipc_host)"
        Write-Host ''
        Write-Host '  Einmalige Einrichtung auf dem Mini-PC (lokal ausfuehren):'
        Write-Host '    1. Einstellungen > System > Optionale Features > "OpenSSH-Server" hinzufuegen'
        Write-Host '    2. PowerShell als Administrator:'
        Write-Host '         Set-Service sshd -StartupType Automatic'
        Write-Host '         Start-Service sshd'
        Write-Host '    3. Deploy erneut starten.'
        throw 'Mini-PC nicht erreichbar.'
    }
    Write-Ok 'Mini-PC per SSH erreichbar.'
}

function Copy-CodeToMiniPc($cfg) {
    $tarFile = Join-Path $env:TEMP 'alphatrack-deploy.tar'
    if (Test-Path $tarFile) { Remove-Item $tarFile -Force }

    Write-Host '  Packe bridge/ und bots/ ...'
    & tar -cf $tarFile -C $RepoRoot `
        --exclude '__pycache__' `
        --exclude '*.pyc' `
        --exclude 'bridge/ticket_registry.json' `
        --exclude 'bridge/bridge_log.json' `
        --exclude 'bots/*/data' `
        --exclude 'bots/*/data/*' `
        bridge bots
    if ($LASTEXITCODE -ne 0) { throw 'tar (lokal packen) fehlgeschlagen.' }

    $target    = $cfg.minipc_target_dir                       # z.B. C:\AlphaTrack
    $targetFwd = $target -replace '\\', '/'                   # C:/AlphaTrack fuer scp/tar

    Invoke-MiniPcSsh $cfg "cmd /c if not exist ""$target"" mkdir ""$target"""
    if ($LASTEXITCODE -ne 0) { throw "Zielordner $target konnte nicht angelegt werden." }

    Write-Host '  Kopiere zum Mini-PC ...'
    & scp -q $tarFile "$($cfg.minipc_ssh_user)@$($cfg.minipc_host):$targetFwd/alphatrack-deploy.tar"
    if ($LASTEXITCODE -ne 0) { throw 'scp zum Mini-PC fehlgeschlagen.' }

    Invoke-MiniPcSsh $cfg "tar -xf ""$targetFwd/alphatrack-deploy.tar"" -C ""$targetFwd"" && del ""$target\alphatrack-deploy.tar"""
    if ($LASTEXITCODE -ne 0) { throw 'Entpacken auf dem Mini-PC fehlgeschlagen.' }

    Remove-Item $tarFile -Force
    Write-Ok "Code nach $target kopiert (bridge/ + bots/)."
}

# Setzt ein Feld auf einem PSCustomObject — legt es an, falls nicht vorhanden.
function Set-JsonField($Obj, [string]$Name, $Value) {
    $Obj | Add-Member -MemberType NoteProperty -Name $Name -Value $Value -Force
}

# Pure Funktion: erzeugt den JSON-Text der Bridge-Config aus der Repo-Vorlage.
function New-BridgeConfigJson([string]$TemplatePath, $cfg, [string]$ApiKey, [string]$ProfileId) {
    $c = Get-Content $TemplatePath -Raw | ConvertFrom-Json
    Set-JsonField $c 'alphatrack_url'      "http://$($cfg.nas_host):$($cfg.nas_app_port)"
    Set-JsonField $c 'api_key'             $ApiKey
    Set-JsonField $c 'profile_id'          $ProfileId
    Set-JsonField $c 'bridge_id'           ''            # leere ID -> Bridge registriert sich neu
    Set-JsonField $c 'command_server_port' 8765
    Set-JsonField $c 'mt5_login'           ([int]$cfg.mt5_login)
    Set-JsonField $c 'mt5_password'        "$($cfg.mt5_password)"
    Set-JsonField $c 'mt5_server'          "$($cfg.mt5_server)"
    Set-JsonField $c 'mt5_exe_path'        "$($cfg.mt5_exe_path)"
    return ($c | ConvertTo-Json -Depth 10)
}

# Pure Funktion: erzeugt den JSON-Text einer Bot-Config aus der Repo-Vorlage.
# Bot-spezifische Felder (bot_id, bot_port, strategy) bleiben unveraendert.
function New-BotConfigJson([string]$TemplatePath, $cfg, [string]$ApiKey, [string]$ProfileId) {
    $c = Get-Content $TemplatePath -Raw | ConvertFrom-Json
    Set-JsonField $c 'alphatrack_url' "http://$($cfg.nas_host):$($cfg.nas_app_port)"
    Set-JsonField $c 'api_key'        $ApiKey
    Set-JsonField $c 'profile_id'     $ProfileId
    Set-JsonField $c 'bridge_url'     "http://$($cfg.minipc_host):8765"
    return ($c | ConvertTo-Json -Depth 10)
}

function Write-RemoteConfigs($cfg, [string]$ApiKey, [string]$ProfileId) {
    $targetFwd = $cfg.minipc_target_dir -replace '\\', '/'
    $tmpDir = Join-Path $env:TEMP 'alphatrack-configs'
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tmpDir | Out-Null

    # Bridge
    $bridgeJson = New-BridgeConfigJson (Join-Path $RepoRoot 'bridge\config.json') $cfg $ApiKey $ProfileId
    $bridgeTmp  = Join-Path $tmpDir 'bridge-config.json'
    Write-Utf8NoBom $bridgeTmp $bridgeJson
    & scp -q $bridgeTmp "$($cfg.minipc_ssh_user)@$($cfg.minipc_host):$targetFwd/bridge/config.json"
    if ($LASTEXITCODE -ne 0) { throw 'Bridge-Config konnte nicht geschrieben werden.' }
    Write-Ok 'bridge/config.json geschrieben (MT5 + NAS-URL + API-Key + Profil).'

    # Bots: alle Ordner unter bots/ mit config.json (scaffold hat keine)
    $botDirs = Get-ChildItem (Join-Path $RepoRoot 'bots') -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName 'config.json') }
    foreach ($dir in $botDirs) {
        $botJson = New-BotConfigJson (Join-Path $dir.FullName 'config.json') $cfg $ApiKey $ProfileId
        $botTmp  = Join-Path $tmpDir "$($dir.Name)-config.json"
        Write-Utf8NoBom $botTmp $botJson
        & scp -q $botTmp "$($cfg.minipc_ssh_user)@$($cfg.minipc_host):$targetFwd/bots/$($dir.Name)/config.json"
        if ($LASTEXITCODE -ne 0) { throw "Bot-Config fuer $($dir.Name) konnte nicht geschrieben werden." }
        Write-Ok "bots/$($dir.Name)/config.json geschrieben."
    }

    Remove-Item $tmpDir -Recurse -Force
}
```

- [ ] **Step 2: Syntaxcheck**

Run (gleicher Befehl wie Task 2 Step 2).
Expected: `SYNTAX OK`

- [ ] **Step 3: Config-Generierung testen (Dot-Sourcing, ohne Netzwerk)**

Run:
```
powershell -NoProfile -Command ". .\scripts\windows\deploy.ps1; $cfg=[ordered]@{nas_host='10.0.0.5'; nas_app_port='3002'; minipc_host='10.0.0.9'; mt5_login='REDACTED-MT5-LOGIN'; mt5_password='geheim'; mt5_server='Demo-Srv'; mt5_exe_path='C:\MT5\terminal64.exe'}; $b = New-BridgeConfigJson 'bridge\config.json' $cfg 'KEY123' 'prof-1' | ConvertFrom-Json; $bot = New-BotConfigJson 'bots\testbot2\config.json' $cfg 'KEY123' 'prof-1' | ConvertFrom-Json; $errs=@(); if($b.alphatrack_url -ne 'http://10.0.0.5:3002'){$errs+='bridge url'}; if($b.api_key -ne 'KEY123'){$errs+='bridge key'}; if($b.mt5_login -ne REDACTED-MT5-LOGIN){$errs+='mt5 login'}; if($b.bridge_id -ne ''){$errs+='bridge_id'}; if($bot.bridge_url -ne 'http://10.0.0.9:8765'){$errs+='bot bridge_url'}; if($bot.bot_id -ne 'testbot2-001'){$errs+='bot_id veraendert'}; if($errs.Count){$errs; exit 1} else {'TEST OK'}"
```
Expected: `TEST OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/windows/deploy.ps1
git commit -m "feat(deploy): Phase 2a - Code-Kopie zum Mini-PC und Config-Generierung"
```

---

### Task 5: Phase 2b — Firewall-Regel + geplante Aufgabe + Bridge-Neustart

**Files:**
- Modify: `scripts/windows/deploy.ps1` (Funktionen VOR `# --- Hauptablauf ---` einfügen)

- [ ] **Step 1: Funktionen einfügen**

Folgenden Block in `deploy.ps1` direkt VOR `# --- Hauptablauf ---` einfügen:

```powershell
# Firewall: NAS-AlphaTrack muss die Bridge auf Port 8765 erreichen koennen.
# Remote-Shell auf dem Mini-PC ist cmd.exe -> ||/&& sind dort erlaubt.
function Set-MiniPcFirewall($cfg) {
    $ruleName = 'AlphaTrack Bridge 8765'
    $remote = "netsh advfirewall firewall show rule name=""$ruleName"" >nul 2>&1 || netsh advfirewall firewall add rule name=""$ruleName"" dir=in action=allow protocol=TCP localport=8765"
    Invoke-MiniPcSsh $cfg $remote
    if ($LASTEXITCODE -ne 0) {
        throw "Firewall-Regel konnte nicht angelegt werden. SSH-Benutzer braucht Admin-Rechte auf dem Mini-PC."
    }
    Write-Ok "Firewall-Regel '$ruleName' vorhanden."
}

# Geplante Aufgabe: Bridge startet bei Anmeldung automatisch. Bots bewusst NICHT.
function Register-BridgeTask($cfg) {
    $taskName = 'AlphaTrack Bridge'
    $batPath  = "$($cfg.minipc_target_dir)\bridge\start_bridge.bat"

    # /F = vorhandene Aufgabe ueberschreiben; innere \" noetig, falls Pfad Leerzeichen enthaelt
    $create = 'schtasks /Create /TN "' + $taskName + '" /TR "\"' + $batPath + '\"" /SC ONLOGON /F'
    Invoke-MiniPcSsh $cfg $create
    if ($LASTEXITCODE -ne 0) {
        throw 'Geplante Aufgabe konnte nicht angelegt werden. SSH-Benutzer braucht Admin-Rechte auf dem Mini-PC.'
    }
    Write-Ok "Geplante Aufgabe '$taskName' angelegt (Start bei Anmeldung)."

    # Laufende Bridge beenden (falls aktiv) und mit neuer Config starten.
    # /End schlaegt fehl, wenn die Aufgabe nicht laeuft -> Exit-Code ignorieren.
    Invoke-MiniPcSsh $cfg ('schtasks /End /TN "' + $taskName + '" >nul 2>&1 & exit 0')
    Invoke-MiniPcSsh $cfg ('schtasks /Run /TN "' + $taskName + '"')
    if ($LASTEXITCODE -ne 0) { throw 'Bridge konnte nicht gestartet werden (schtasks /Run).' }
    Write-Ok 'Bridge gestartet.'
}
```

- [ ] **Step 2: Syntaxcheck**

Run (gleicher Befehl wie Task 2 Step 2).
Expected: `SYNTAX OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/windows/deploy.ps1
git commit -m "feat(deploy): Phase 2b - Firewall-Regel und Autostart-Task fuer die Bridge"
```

---

### Task 6: Phase 3 — Abschluss-Check, Hauptablauf, README

**Files:**
- Modify: `scripts/windows/deploy.ps1` (Check-Funktion einfügen, `Invoke-Main` ersetzen)
- Modify: `README.md` (Deploy-Abschnitt)

- [ ] **Step 1: Abschluss-Check einfügen**

Folgenden Block in `deploy.ps1` direkt VOR `# --- Hauptablauf ---` einfügen:

```powershell
# --- Phase 3: Abschluss-Check ------------------------------

# Die Bridge registriert sich beim Start selbst per POST /api/bots.
# Wir pollen, bis ein Bridge-Eintrag mit der Mini-PC-IP auftaucht.
function Wait-ForBridgeRegistration($cfg) {
    $url = "http://$($cfg.nas_host):$($cfg.nas_app_port)/api/bots"
    Write-Host '  Warte auf Bridge-Registrierung (max. 90s) ...'
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri $url -TimeoutSec 5
            $bridge = @($resp.bots) | Where-Object {
                ($_.type -eq 'bridge' -or -not $_.type) -and $_.url -like "*$($cfg.minipc_host)*"
            } | Select-Object -First 1
            if ($bridge) { return $bridge }
        } catch { }
        Start-Sleep -Seconds 5
    }
    return $null
}
```

- [ ] **Step 2: Invoke-Main ersetzen**

Die bestehende Funktion `Invoke-Main` (Platzhalter aus Task 2) komplett durch diese Version ersetzen:

```powershell
function Invoke-Main {
    $cfg = Read-DeployConfig
    Invoke-Questionnaire $cfg
    Save-DeployConfig $cfg

    if ($ConfigOnly) {
        Write-Ok 'Nur-Konfig-Modus — kein Deploy ausgefuehrt.'
        return
    }

    Write-Step '[Phase 1/3] NAS-Deploy'
    Invoke-GitPush
    $apiKey = Confirm-NasEnvFile $cfg
    Invoke-NasUpdate $cfg
    $info = Wait-ForAlphaTrack $cfg
    $profileId = Select-TradingProfile $info $cfg

    Write-Step '[Phase 2/3] Mini-PC-Deploy'
    Test-MiniPcSsh $cfg
    Copy-CodeToMiniPc $cfg
    Write-RemoteConfigs $cfg $apiKey $profileId
    Set-MiniPcFirewall $cfg
    Register-BridgeTask $cfg

    Write-Step '[Phase 3/3] Abschluss-Check'
    $bridge = Wait-ForBridgeRegistration $cfg

    Write-Host ''
    Write-Host "  $Sep"
    if ($bridge) {
        Write-Ok "Bridge '$($bridge.name)' ist beim NAS-AlphaTrack registriert."
        Write-Host "  AlphaTrack:  http://$($cfg.nas_host):$($cfg.nas_app_port)"
        Write-Host "  Bridge:      $($bridge.url)"
        Write-Host '  Bots:        auf dem Mini-PC manuell per start.bat starten.'
    } else {
        Write-Warn2 'Bridge hat sich nicht innerhalb von 90s registriert.'
        Write-Host '  Naechste Schritte:'
        Write-Host "    - Auf dem Mini-PC das Bridge-Fenster pruefen ($($cfg.minipc_target_dir)\bridge)"
        Write-Host '    - MT5-Zugangsdaten in der Ausgabe der Bridge pruefen'
        Write-Host "    - Bridge-Log im AlphaTrack-UI: http://$($cfg.nas_host):$($cfg.nas_app_port)/bridge"
        throw 'Abschluss-Check fehlgeschlagen.'
    }
    Write-Host "  $Sep"
}
```

- [ ] **Step 3: Syntaxcheck + ConfigOnly-Lauf**

Run (Syntaxcheck wie Task 2 Step 2). Expected: `SYNTAX OK`
Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/deploy.ps1 -ConfigOnly` (überall Enter — Werte aus Task 2 sind gespeichert).
Expected: läuft durch bis `Nur-Konfig-Modus — kein Deploy ausgefuehrt.`, Exit-Code 0.

- [ ] **Step 4: README ergänzen**

In `README.md` den bestehenden Deploy-Abschnitt finden (Suche nach `deploy.bat`) und folgenden Hinweis ergänzen bzw. den Abschnitt ersetzen, falls er die alte hartkodierte deploy.bat beschreibt:

```markdown
### Deploy (NAS + Mini-PC)

`scripts\windows\deploy.bat` startet das interaktive Deploy:

1. **Konfigurationsabfrage** — NAS-Zugang, Mini-PC-Zugang, MT5-Logindaten.
   Antworten werden in `scripts/windows/deploy.config.json` gespeichert (gitignored);
   Enter übernimmt beim nächsten Lauf den gespeicherten Wert.
2. **NAS** — git push, `.env.local` mit `BOT_API_KEY` sicherstellen, Container-Rebuild,
   Auswahl des Trading-Profils vom NAS.
3. **Mini-PC** — `bridge/` + `bots/` per SSH kopieren, Configs generieren,
   Firewall-Regel (TCP 8765) und geplante Aufgabe "AlphaTrack Bridge" (Start bei
   Anmeldung). Bots werden nur kopiert — Start manuell per `start.bat`.
4. **Check** — wartet, bis die Bridge sich beim NAS-AlphaTrack registriert hat.

**Einmalig auf dem Mini-PC:** OpenSSH-Server aktivieren (Einstellungen → Optionale
Features → "OpenSSH-Server", dann `Set-Service sshd -StartupType Automatic` +
`Start-Service sshd` als Admin). Der SSH-Benutzer braucht Admin-Rechte
(Firewall/Aufgabenplanung). MetaTrader 5 und Python müssen installiert sein.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/windows/deploy.ps1 README.md
git commit -m "feat(deploy): Phase 3 - Abschluss-Check und kompletter Deploy-Ablauf, README-Doku"
```

---

## Hinweise für UAT (mit dem Nutzer, nicht automatisierbar)

1. Echter Lauf `deploy.bat` gegen NAS + Mini-PC (OpenSSH vorher einmalig aktivieren).
2. Prüfen: Container läuft, `/api/bridge/info` liefert Profile, Bridge erscheint im UI.
3. Bot auf dem Mini-PC manuell starten → erscheint im UI, Trades werden synchronisiert.
4. Mini-PC neu starten → Bridge startet nach Anmeldung automatisch, Bots nicht.

# AlphaTrack Deploy — NAS (Docker) + Trading-Rechner (Bridge/Bots) via SSH
# Aufruf ueber deploy.bat oder: powershell -NoProfile -ExecutionPolicy Bypass -File deploy.ps1 [-ConfigOnly]
[CmdletBinding()]
param(
    [switch]$ConfigOnly   # nur Konfiguration abfragen/speichern, kein Deploy
)

$ErrorActionPreference = 'Stop'
$ScriptDir  = (Split-Path -Parent $MyInvocation.MyCommand.Path) -replace '^Microsoft\.PowerShell\.Core\\FileSystem::', ''
$RepoRoot   = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir '..\..'))
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
        nas_host                   = ''
        nas_ssh_port               = '88'
        nas_ssh_user               = ''
        nas_project_dir            = '/volume1/docker/alphatrack'
        nas_app_port               = '3002'
        trading_rechner_host       = ''
        trading_rechner_ssh_user   = ''
        trading_rechner_ssh_key    = ''
        trading_rechner_target_dir = 'C:\AlphaTrack'
        mt5_login                  = ''
        mt5_password               = ''
        mt5_server                 = ''
        mt5_exe_path               = 'C:\Program Files\MetaTrader 5\terminal64.exe'
        sync_mode                  = 'full'
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

function Get-TradingRechnerSshArgs($cfg) {
    if ($cfg.trading_rechner_ssh_key -and (Test-Path $cfg.trading_rechner_ssh_key)) { return @('-i', $cfg.trading_rechner_ssh_key) }
    return @()
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

    Write-Step '[2] Trading-Rechner (Bridge, Bots, MetaTrader)'
    $cfg.trading_rechner_host       = Ask-Required 'Trading-Rechner IP/Hostname'  $cfg.trading_rechner_host
    $cfg.trading_rechner_ssh_user   = Ask-Required 'Trading-Rechner SSH-Benutzer'                   $cfg.trading_rechner_ssh_user
    $cfg.trading_rechner_ssh_key    = Ask-Value    'Trading-Rechner SSH-Key-Pfad (leer = Passwort)' $cfg.trading_rechner_ssh_key
    $cfg.trading_rechner_target_dir = Ask-Required 'Trading-Rechner Zielordner'                     $cfg.trading_rechner_target_dir

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

    Write-Step '[4] Sync-Modus'
    Write-Host '  Sollen vergangene Trades vom MetaTrader-Account geladen werden?'
    $syncDefault = switch ($cfg.sync_mode) {
        'new_only' { '2' }
        'keep'     { '3' }
        default    { '1' }
    }
    Write-Host "    1) Komplette History laden"
    Write-Host "    2) Nur neue Trades ab jetzt"
    Write-Host "    3) Stand unveraendert lassen (Trades in AlphaTrack bleiben erhalten)"
    while ($true) {
        $raw = Read-Host "  Sync-Modus waehlen [1-3, Standard: $syncDefault]"
        if ($raw -eq '') { $raw = $syncDefault }
        if ($raw -eq '1') { $cfg.sync_mode = 'full'; break }
        if ($raw -eq '2') { $cfg.sync_mode = 'new_only'; break }
        if ($raw -eq '3') { $cfg.sync_mode = 'keep'; break }
        Write-Warn2 'Bitte 1, 2 oder 3 eingeben.'
    }
}

# --- Phase 1: NAS ------------------------------------------

function Invoke-NasSsh($cfg, [string]$RemoteCmd) {
    & ssh -p $cfg.nas_ssh_port "$($cfg.nas_ssh_user)@$($cfg.nas_host)" $RemoteCmd
    if ($LASTEXITCODE -eq 255) {
        throw "SSH-Verbindung zum NAS fehlgeschlagen ($($cfg.nas_ssh_user)@$($cfg.nas_host), Port $($cfg.nas_ssh_port)). Ist das NAS erreichbar und SSH aktiviert?"
    }
}

# Einzelner SSH-Aufruf: .env.local pruefen/anlegen, BOT_API_KEY ausgeben, Container updaten.
# Update-Output geht auf stderr (bleibt im Terminal sichtbar), Key kommt auf stdout (wird geparst).
function Invoke-NasSetupAndUpdate($cfg) {
    $envPath   = "$($cfg.nas_project_dir)/.env.local"
    $updScript = "$($cfg.nas_project_dir)/scripts/nas-update.sh"
    $newKey    = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')

    Write-Host "  NAS-Verbindung herstellen, .env.local pruefen + Container updaten ..."

    $remoteCmd = "if [ ! -f '$envPath' ]; then printf 'BOT_API_KEY=$newKey\n' > '$envPath'; fi; grep '^BOT_API_KEY=' '$envPath' | head -1; bash '$updScript' >&2"

    $output = & ssh -p $cfg.nas_ssh_port "$($cfg.nas_ssh_user)@$($cfg.nas_host)" $remoteCmd
    if ($LASTEXITCODE -eq 255) { throw "SSH-Verbindung zum NAS fehlgeschlagen ($($cfg.nas_ssh_user)@$($cfg.nas_host), Port $($cfg.nas_ssh_port))." }

    $keyLine = @($output) | Where-Object { $_ -match '^BOT_API_KEY=' } | Select-Object -First 1
    if (-not $keyLine) { throw "BOT_API_KEY konnte nicht aus .env.local gelesen werden. Datei auf dem NAS pruefen: $envPath" }

    $apiKey = $keyLine.Substring('BOT_API_KEY='.Length).Trim()
    Write-Ok 'BOT_API_KEY vom NAS uebernommen.'
    Write-Ok 'NAS-Container neu gebaut und gestartet.'
    return $apiKey
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

function Select-TradingProfile($info, $cfg, [string]$ApiKey) {
    $profiles = @($info.profiles)
    if ($profiles.Count -eq 0) {
        Write-Warn2 'Keine Profile vorhanden — ein leeres Profil wird jetzt angelegt.'
        $profileName = Ask-Required 'Profilname (z.B. BlackBull-Demo)' 'Mein Profil'
        $body = "{""name"":""$($profileName.Trim())"",""type"":""demo"",""currency"":""USD"",""startCapital"":0,""broker"":""""}"
        $url  = "http://$($cfg.nas_host):$($cfg.nas_app_port)/api/profiles"
        $created = Invoke-RestMethod -Uri $url -Method POST -Body $body `
            -ContentType 'application/json' -Headers @{ 'x-bot-api-key' = $ApiKey }
        Write-Ok "Profil '$($created.name)' angelegt. Details nach dem Deploy in AlphaTrack konfigurieren."
        return $created.id
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

# --- Phase 2: Trading-Rechner --------------------------------------

function Invoke-TradingRechnerSsh($cfg, [string]$RemoteCmd) {
    $keyArgs = Get-TradingRechnerSshArgs $cfg
    & ssh @keyArgs "$($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host)" $RemoteCmd
    if ($LASTEXITCODE -eq 255) {
        throw "SSH-Verbindung zum Trading-Rechner abgebrochen ($($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host))."
    }
}

function Test-TradingRechnerSsh($cfg) {
    $keyArgs = Get-TradingRechnerSshArgs $cfg
    & ssh @keyArgs -o ConnectTimeout=5 "$($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host)" "exit"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Trading-Rechner per SSH nicht erreichbar: $($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host)"
        Write-Host ''
        Write-Host '  Einmalige Einrichtung auf dem Trading-Rechner (lokal ausfuehren):'
        Write-Host '    1. Einstellungen > System > Optionale Features > "OpenSSH-Server" hinzufuegen'
        Write-Host '    2. PowerShell als Administrator:'
        Write-Host '         Set-Service sshd -StartupType Automatic'
        Write-Host '         Start-Service sshd'
        Write-Host '    3. Deploy erneut starten.'
        throw 'Trading-Rechner nicht erreichbar.'
    }
    Write-Ok 'Trading-Rechner per SSH erreichbar.'
}

function Copy-CodeToTradingRechner($cfg) {
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

    $target    = $cfg.trading_rechner_target_dir                       # z.B. C:\AlphaTrack
    $targetFwd = $target -replace '\\', '/'                   # C:/AlphaTrack fuer scp/tar

    Invoke-TradingRechnerSsh $cfg "cmd /c if not exist ""$target"" mkdir ""$target"""
    if ($LASTEXITCODE -ne 0) { throw "Zielordner $target konnte nicht angelegt werden." }

    Write-Host '  Kopiere zum Trading-Rechner ...'
    $keyArgs = Get-TradingRechnerSshArgs $cfg
    & scp -q @keyArgs $tarFile "$($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host):$targetFwd/alphatrack-deploy.tar"
    if ($LASTEXITCODE -ne 0) { throw 'scp zum Trading-Rechner fehlgeschlagen.' }

    Invoke-TradingRechnerSsh $cfg "tar -xf ""$targetFwd/alphatrack-deploy.tar"" -C ""$targetFwd"" && del ""$target\alphatrack-deploy.tar"""
    if ($LASTEXITCODE -ne 0) { throw 'Entpacken auf dem Trading-Rechner fehlgeschlagen.' }

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
    if ($null -ne $c.PSObject.Properties['symbols_to_watch']) {
        Set-JsonField $c 'symbols_to_watch' @($c.symbols_to_watch)
    }
    Set-JsonField $c 'alphatrack_url'      "http://$($cfg.nas_host):$($cfg.nas_app_port)"
    Set-JsonField $c 'api_key'             $ApiKey
    Set-JsonField $c 'profile_id'          $ProfileId
    Set-JsonField $c 'bridge_id'           ''            # leere ID -> Bridge registriert sich neu
    Set-JsonField $c 'command_server_port' 8765
    Set-JsonField $c 'mt5_login'           ([int]$cfg.mt5_login)
    Set-JsonField $c 'mt5_password'        "$($cfg.mt5_password)"
    Set-JsonField $c 'mt5_server'          "$($cfg.mt5_server)"
    Set-JsonField $c 'mt5_exe_path'        "$($cfg.mt5_exe_path)"
    $syncMode = if ($cfg.sync_mode) { $cfg.sync_mode } else { 'full' }
    # 'keep': Bridge bekommt new_only + aktuellem Cutoff, aber bestehende Trades werden NICHT geloescht.
    $bridgeSyncMode = if ($syncMode -eq 'keep') { 'new_only' } else { $syncMode }
    Set-JsonField $c 'sync_mode'           $bridgeSyncMode
    if ($bridgeSyncMode -eq 'new_only') {
        Set-JsonField $c 'sync_cutoff_timestamp' ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
    } else {
        Set-JsonField $c 'sync_cutoff_timestamp' 0
    }
    return ($c | ConvertTo-Json -Depth 10)
}

# Pure Funktion: erzeugt den JSON-Text einer Bot-Config aus der Repo-Vorlage.
# Bot-spezifische Felder (bot_id, bot_port, strategy) bleiben unveraendert.
function New-BotConfigJson([string]$TemplatePath, $cfg, [string]$ApiKey, [string]$ProfileId) {
    $c = Get-Content $TemplatePath -Raw | ConvertFrom-Json
    Set-JsonField $c 'alphatrack_url' "http://$($cfg.nas_host):$($cfg.nas_app_port)"
    Set-JsonField $c 'api_key'        $ApiKey
    Set-JsonField $c 'profile_id'     $ProfileId
    Set-JsonField $c 'bridge_url'     "http://$($cfg.trading_rechner_host):8765"
    return ($c | ConvertTo-Json -Depth 10)
}

function Write-RemoteConfigs($cfg, [string]$ApiKey, [string]$ProfileId) {
    $targetFwd = $cfg.trading_rechner_target_dir -replace '\\', '/'
    $tmpDir = Join-Path $env:TEMP 'alphatrack-configs'
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    $keyArgs = Get-TradingRechnerSshArgs $cfg

    # Bridge
    $bridgeJson = New-BridgeConfigJson (Join-Path $RepoRoot 'bridge\config.json') $cfg $ApiKey $ProfileId
    $bridgeTmp  = Join-Path $tmpDir 'bridge-config.json'
    Write-Utf8NoBom $bridgeTmp $bridgeJson
    & scp -q @keyArgs $bridgeTmp "$($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host):$targetFwd/bridge/config.json"
    if ($LASTEXITCODE -ne 0) { throw 'Bridge-Config konnte nicht geschrieben werden.' }
    Write-Ok 'bridge/config.json geschrieben (MT5 + NAS-URL + API-Key + Profil).'

    # Bots: alle Ordner unter bots/ mit config.json (scaffold hat keine)
    $botDirs = Get-ChildItem (Join-Path $RepoRoot 'bots') -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName 'config.json') }
    foreach ($dir in $botDirs) {
        $botJson = New-BotConfigJson (Join-Path $dir.FullName 'config.json') $cfg $ApiKey $ProfileId
        $botTmp  = Join-Path $tmpDir "$($dir.Name)-config.json"
        Write-Utf8NoBom $botTmp $botJson
        & scp -q @keyArgs $botTmp "$($cfg.trading_rechner_ssh_user)@$($cfg.trading_rechner_host):$targetFwd/bots/$($dir.Name)/config.json"
        if ($LASTEXITCODE -ne 0) { throw "Bot-Config fuer $($dir.Name) konnte nicht geschrieben werden." }
        Write-Ok "bots/$($dir.Name)/config.json geschrieben."
    }

    Remove-Item $tmpDir -Recurse -Force
}

# Firewall: NAS-AlphaTrack muss die Bridge auf Port 8765 erreichen koennen.
# Remote-Shell auf dem Trading-Rechner ist cmd.exe -> ||/&& sind dort erlaubt.
# Kein Leerzeichen im Namen: Quotes ueberleben den SSH->cmd.exe-Weg nicht zuverlaessig.
function Set-TradingRechnerFirewall($cfg) {
    $ruleName = 'AlphaTrackBridge8765'
    $remote = "netsh advfirewall firewall show rule name=$ruleName >nul 2>&1 || netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=8765"
    Invoke-TradingRechnerSsh $cfg $remote
    if ($LASTEXITCODE -ne 0) {
        throw "Firewall-Regel konnte nicht angelegt werden. SSH-Benutzer braucht Admin-Rechte auf dem Trading-Rechner."
    }
    Write-Ok "Firewall-Regel '$ruleName' vorhanden."
}

# Geplante Aufgabe: Bridge startet bei Anmeldung automatisch. Bots bewusst NICHT.
# Kein Leerzeichen im TN: Quotes ueberleben den SSH->cmd.exe-Weg nicht zuverlaessig.
function Register-BridgeTask($cfg) {
    $taskName = 'AlphaTrackBridge'
    $batPath  = "$($cfg.trading_rechner_target_dir)\bridge\start_bridge.bat"

    $create  = "schtasks /Create /TN $taskName /TR $batPath /SC ONLOGON /F"
    Invoke-TradingRechnerSsh $cfg $create
    if ($LASTEXITCODE -ne 0) {
        throw 'Geplante Aufgabe konnte nicht angelegt werden. SSH-Benutzer braucht Admin-Rechte auf dem Trading-Rechner.'
    }
    Write-Ok "Geplante Aufgabe '$taskName' angelegt (Start bei Anmeldung)."

    # Laufende Bridge beenden (falls aktiv), kurz warten, dann mit neuer Config starten.
    # /End schlaegt fehl, wenn die Aufgabe nicht laeuft -> wird remote unterdrueckt.
    # Ohne /RU laeuft die Aufgabe nur bei angemeldetem Benutzer — sichtbar im Desktop des SSH-Users.
    $restart = "schtasks /End /TN $taskName >nul 2>&1 & timeout /t 2 /nobreak >nul & schtasks /Run /TN $taskName"
    Invoke-TradingRechnerSsh $cfg $restart
    if ($LASTEXITCODE -ne 0) { throw 'Bridge konnte nicht gestartet werden (schtasks /Run).' }
    Write-Ok 'Bridge gestartet.'
}

# --- Phase 3: Abschluss-Check ------------------------------

# Die Bridge registriert sich beim Start selbst per POST /api/bots.
# Wir pollen, bis ein Bridge-Eintrag mit der Trading-Rechner-IP auftaucht.
function Wait-ForBridgeRegistration($cfg) {
    $url = "http://$($cfg.nas_host):$($cfg.nas_app_port)/api/bots"
    Write-Host '  Warte auf Bridge-Registrierung (max. 90s) ...'
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri $url -TimeoutSec 5
            $bridge = @($resp.bots) | Where-Object {
                ($_.type -eq 'bridge' -or -not $_.type) -and $_.url -like "*$($cfg.trading_rechner_host)*"
            } | Select-Object -First 1
            if ($bridge) { return $bridge }
        } catch { }
        Start-Sleep -Seconds 5
    }
    return $null
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

    Write-Step '[Phase 1/3] NAS-Deploy'
    Write-Host '  (Erwartet, dass der aktuelle Stand bereits per "git push" auf GitHub liegt.)'
    $apiKey = Invoke-NasSetupAndUpdate $cfg
    $info = Wait-ForAlphaTrack $cfg
    $profileId = Select-TradingProfile $info $cfg $apiKey

    if ($cfg.sync_mode -eq 'new_only') {
        $purgeUrl = "http://$($cfg.nas_host):$($cfg.nas_app_port)/api/bridge/trades?profileId=$profileId"
        try {
            Invoke-RestMethod -Uri $purgeUrl -Method DELETE -Headers @{ 'x-bot-api-key' = $apiKey } -TimeoutSec 10
            Write-Ok 'Bestehende Bot-Trades geloescht (nur neue Trades werden synchronisiert).'
        } catch {
            Write-Warn2 "Trades konnten nicht geloescht werden: $($_.Exception.Message)"
        }
    }

    Write-Step '[Phase 2/3] Trading-Rechner-Deploy'
    Test-TradingRechnerSsh $cfg
    Copy-CodeToTradingRechner $cfg
    Write-RemoteConfigs $cfg $apiKey $profileId
    Set-TradingRechnerFirewall $cfg
    Register-BridgeTask $cfg

    Write-Step '[Phase 3/3] Abschluss-Check'
    $bridge = Wait-ForBridgeRegistration $cfg

    Write-Host ''
    Write-Host "  $Sep"
    if ($bridge) {
        Write-Ok "Bridge '$($bridge.name)' ist beim NAS-AlphaTrack registriert."
        Write-Host "  AlphaTrack:  http://$($cfg.nas_host):$($cfg.nas_app_port)"
        Write-Host "  Bridge:      $($bridge.url)"
        Write-Host '  Bots:        auf dem Trading-Rechner manuell per start.bat starten.'
    } else {
        Write-Warn2 'Bridge hat sich nicht innerhalb von 90s registriert.'
        Write-Host '  Naechste Schritte:'
        Write-Host "    - Auf dem Trading-Rechner das Bridge-Fenster pruefen ($($cfg.trading_rechner_target_dir)\bridge)"
        Write-Host '    - MT5-Zugangsdaten in der Ausgabe der Bridge pruefen'
        Write-Host "    - Bridge-Log im AlphaTrack-UI: http://$($cfg.nas_host):$($cfg.nas_app_port)/bridge"
        throw 'Abschluss-Check fehlgeschlagen.'
    }
    Write-Host "  $Sep"
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

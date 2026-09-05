#Requires -Version 5.1
# AlphaTrack Setup Wizard v1.0
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

if (-not $RepoRoot) {
    $RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
}
$RepoRoot = $RepoRoot.TrimEnd('\').TrimEnd('/')
Set-Location $RepoRoot

$LANG = "DE"

# ═══════════════════════════════════════════════════════════════════════════════
#  OUTPUT HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

function Show-Banner {
    try { Clear-Host } catch {}
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║            A L P H A T R A C K   S E T U P           ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Show-StepHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host ("  " + ("─" * 56)) -ForegroundColor DarkCyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("  " + ("─" * 56)) -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Ok   ([string]$m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Fail ([string]$m) { Write-Host "  [!!] $m" -ForegroundColor Red }
function Write-Info ([string]$m) { Write-Host "   --> $m" -ForegroundColor Cyan }
function Write-Warn ([string]$m) { Write-Host "   [!] $m" -ForegroundColor Yellow }
function Write-Note ([string]$m) { Write-Host "       $m" -ForegroundColor Gray }
function Write-Nl   { Write-Host "" }

function Wait-Enter {
    param([string]$Msg = "")
    if (-not $Msg) { $Msg = if ($LANG -eq "DE") { "Weiter mit ENTER ..." } else { "Press ENTER to continue ..." } }
    Write-Nl
    Write-Host "  $Msg" -ForegroundColor DarkGray
    Read-Host | Out-Null
}

function Ask-Input {
    param([string]$Prompt, [string]$Default = "", [switch]$IsPassword)
    # Never reveal password defaults in the prompt hint
    $hint = if ($Default -and -not $IsPassword) { " [$Default]" } else { "" }
    Write-Host "  $Prompt$hint : " -ForegroundColor White -NoNewline
    if ($IsPassword) {
        $secure = Read-Host -AsSecureString
        $bstr   = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $plain  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        if ($plain -eq "" -and $Default) { return $Default }
        return $plain
    }
    $val = Read-Host
    if ($val -eq "" -and $Default) { return $Default }
    return $val
}

function Ask-Choice {
    param([string]$Prompt, [string[]]$Options)
    Write-Host "  $Prompt" -ForegroundColor White
    Write-Nl
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-Host "    [$($i+1)]  $($Options[$i])" -ForegroundColor Yellow
    }
    Write-Nl
    do {
        Write-Host "  > " -NoNewline -ForegroundColor DarkGray
        $raw = Read-Host
        $n   = 0
        $ok  = [int]::TryParse($raw, [ref]$n) -and $n -ge 1 -and $n -le $Options.Count
        if (-not $ok) {
            $err = if ($LANG -eq "DE") { "Bitte 1–$($Options.Count) eingeben." } else { "Please enter 1–$($Options.Count)." }
            Write-Warn $err
        }
    } while (-not $ok)
    return $n
}

function Ask-YesNo {
    param([string]$Prompt, [bool]$Default = $true)
    $hint = if ($Default) {
        if ($LANG -eq "DE") { "[J/n]" } else { "[Y/n]" }
    } else {
        if ($LANG -eq "DE") { "[j/N]" } else { "[y/N]" }
    }
    Write-Host "  $Prompt $hint : " -ForegroundColor White -NoNewline
    $raw = Read-Host
    if ($raw -eq "") { return $Default }
    return ($raw -match '^[JjYy]')
}

# ═══════════════════════════════════════════════════════════════════════════════
#  UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

function New-RandomId {
    param([int]$Length = 10)
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    return -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Write-FileUtf8NoBom {
    param([string]$Path, [string]$Text)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-LocalIpAddress {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 |
               Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
               Select-Object -First 1).IPAddress
        if ($ip) { return $ip }
    } catch {}
    return "127.0.0.1"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  PREREQUISITES
# ═══════════════════════════════════════════════════════════════════════════════

function Test-WinGetAvailable {
    try { $null = & winget --version 2>&1; return $LASTEXITCODE -eq 0 }
    catch { return $false }
}

function Install-WithWinGet {
    param([string]$PackageId, [string]$DisplayName)
    $msg = if ($LANG -eq "DE") { "   Installiere $DisplayName via winget ..." } else { "   Installing $DisplayName via winget ..." }
    Write-Host $msg -ForegroundColor DarkGray

    if (-not (Test-WinGetAvailable)) {
        Write-Warn $(if ($LANG -eq "DE") { "winget nicht verfügbar." } else { "winget not available." })
        return $false
    }

    & winget install --id $PackageId --silent --accept-package-agreements --accept-source-agreements |
        ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }

    if ($LASTEXITCODE -eq 0) {
        # Refresh PATH so the newly installed binary is available immediately
        $env:PATH  = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
        $env:PATH += ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        return $true
    }
    return $false
}

function Test-Command {
    param([string]$Cmd)
    try { $null = Get-Command $Cmd -ErrorAction Stop; return $true }
    catch { return $false }
}

function Test-NodeVersion {
    if (-not (Test-Command "node")) { return $false }
    try {
        $ver = & node --version 2>&1 | Select-Object -First 1
        if ($ver -match 'v(\d+)') { return ([int]$Matches[1] -ge 18) }
    } catch {}
    return $false
}

function Test-PythonVersion {
    foreach ($cmd in @("python", "python3")) {
        if (-not (Test-Command $cmd)) { continue }
        try {
            $ver = & $cmd --version 2>&1 | Select-Object -First 1
            if ($ver -match '(\d+)\.(\d+)') {
                if ([int]$Matches[1] -ge 3 -and [int]$Matches[2] -ge 10) { return $true }
            }
        } catch {}
    }
    return $false
}

function Step-CheckPrereqs {
    param(
        [bool]$NeedNode   = $true,
        [bool]$NeedPython = $false
    )

    Show-Banner
    $title = if ($LANG -eq "DE") { "Schritt 1  —  Voraussetzungen prüfen" } else { "Step 1  —  Checking Prerequisites" }
    Show-StepHeader $title

    $allOk = $true

    # ── Git ──────────────────────────────────────────────────────────────────
    if (Test-Command "git") {
        $ver = try { (& git --version 2>&1 | Select-Object -First 1).Trim() } catch { "?" }
        Write-Ok "Git  ($ver)"
    } else {
        $miss = if ($LANG -eq "DE") { "Git nicht gefunden — wird installiert ..." } else { "Git not found — installing ..." }
        Write-Warn $miss
        if (Install-WithWinGet "Git.Git" "Git") {
            Write-Ok $(if ($LANG -eq "DE") { "Git installiert." } else { "Git installed." })
        } else {
            Write-Fail "Git — https://git-scm.com"
            $allOk = $false
        }
    }

    # ── Node.js ───────────────────────────────────────────────────────────────
    if ($NeedNode) {
        if (Test-NodeVersion) {
            $ver = try { (& node --version 2>&1 | Select-Object -First 1).Trim() } catch { "?" }
            Write-Ok "Node.js 18+  ($ver)"
        } else {
            $miss = if ($LANG -eq "DE") { "Node.js 18+ nicht gefunden — wird installiert ..." } else { "Node.js 18+ not found — installing ..." }
            Write-Warn $miss
            if (Install-WithWinGet "OpenJS.NodeJS.LTS" "Node.js") {
                Write-Ok $(if ($LANG -eq "DE") { "Node.js installiert." } else { "Node.js installed." })
            } else {
                Write-Fail "Node.js — https://nodejs.org"
                $allOk = $false
            }
        }
    }

    # ── Python ────────────────────────────────────────────────────────────────
    if ($NeedPython) {
        if (Test-PythonVersion) {
            $ver = try { (& python --version 2>&1 | Select-Object -First 1).Trim() } catch { "?" }
            Write-Ok "Python 3.10+  ($ver)"
        } else {
            $miss = if ($LANG -eq "DE") { "Python 3.10+ nicht gefunden — wird installiert ..." } else { "Python 3.10+ not found — installing ..." }
            Write-Warn $miss
            if (Install-WithWinGet "Python.Python.3.11" "Python") {
                Write-Ok $(if ($LANG -eq "DE") { "Python installiert." } else { "Python installed." })
            } else {
                Write-Fail "Python — https://www.python.org/downloads/"
                $allOk = $false
            }
        }
    }

    Write-Nl
    if ($allOk) {
        Write-Ok $(if ($LANG -eq "DE") { "Alle Voraussetzungen erfüllt." } else { "All prerequisites satisfied." })
    } else {
        Write-Warn $(if ($LANG -eq "DE") {
            "Einige Pakete konnten nicht automatisch installiert werden."
        } else {
            "Some packages could not be installed automatically."
        })
        Write-Note $(if ($LANG -eq "DE") {
            "Bitte manuell installieren und den Assistenten danach erneut starten."
        } else {
            "Please install them manually, then run the wizard again."
        })
    }

    Wait-Enter
    return $allOk
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: LANGUAGE
# ═══════════════════════════════════════════════════════════════════════════════

function Step-SelectLanguage {
    Show-Banner
    Write-Host "  Sprache wählen / Choose language:" -ForegroundColor White
    Write-Nl
    Write-Host "    [1]  Deutsch" -ForegroundColor Yellow
    Write-Host "    [2]  English" -ForegroundColor Yellow
    Write-Nl
    do {
        Write-Host "  > " -NoNewline -ForegroundColor DarkGray
        $raw = Read-Host
        $ok  = ($raw -eq "1" -or $raw -eq "2")
    } while (-not $ok)
    $script:LANG = if ($raw -eq "1") { "DE" } else { "EN" }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: WELCOME
# ═══════════════════════════════════════════════════════════════════════════════

function Step-Welcome {
    Show-Banner
    if ($LANG -eq "DE") {
        Write-Host "  Willkommen bei AlphaTrack!" -ForegroundColor White
        Write-Nl
        Write-Note "AlphaTrack ist ein persönliches Trading-Journal mit optionalem Bot-Management."
        Write-Note "Dieser Assistent führt dich in wenigen Schritten durch die komplette Einrichtung."
        Write-Nl
        Write-Note "Voraussetzungen (werden bei Bedarf automatisch installiert):"
        Write-Note "  • Windows 10 / 11"
        Write-Note "  • Node.js 18+  (für das Dashboard)"
        Write-Note "  • Python 3.10+  (nur bei Bot-Betrieb)"
        Write-Note "  • MetaTrader 5  (nur bei Bot-Betrieb)"
    } else {
        Write-Host "  Welcome to AlphaTrack!" -ForegroundColor White
        Write-Nl
        Write-Note "AlphaTrack is a personal trading journal with optional bot management."
        Write-Note "This wizard guides you through the complete setup in just a few steps."
        Write-Nl
        Write-Note "Requirements (automatically installed if missing):"
        Write-Note "  • Windows 10 / 11"
        Write-Note "  • Node.js 18+  (for the dashboard)"
        Write-Note "  • Python 3.10+  (bot operation only)"
        Write-Note "  • MetaTrader 5  (bot operation only)"
    }
    Wait-Enter
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: SCENARIO SELECTION
# ═══════════════════════════════════════════════════════════════════════════════

function Step-SelectScenario {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Schritt 2  —  Nutzungsart wählen" } else { "Step 2  —  Choose Usage Mode" }
    Show-StepHeader $title

    if ($LANG -eq "DE") {
        $opts = @(
            "Nur Trading-Journal   (kein automatischer Bot-Betrieb)",
            "Trading-Journal + Bots   (automatisierter Handel mit MetaTrader 5)"
        )
        return Ask-Choice "Wie möchtest du AlphaTrack nutzen?" $opts
    } else {
        $opts = @(
            "Trading Journal only   (no automated bot operation)",
            "Trading Journal + Bots   (automated trading with MetaTrader 5)"
        )
        return Ask-Choice "How would you like to use AlphaTrack?" $opts
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: SETUP TYPE (bots only)
# ═══════════════════════════════════════════════════════════════════════════════

function Step-SelectSetupType {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Schritt 3  —  Setup-Art" } else { "Step 3  —  Setup Type" }
    Show-StepHeader $title

    if ($LANG -eq "DE") {
        $opts = @(
            "Alles auf diesem PC   (Dashboard + MetaTrader + Bots auf einem Computer)",
            "Verteiltes Setup   (Dashboard auf NAS/Server, MetaTrader & Bots auf separatem PC)"
        )
        return Ask-Choice "Wie ist dein Setup aufgebaut?" $opts
    } else {
        $opts = @(
            "Everything on this PC   (Dashboard + MetaTrader + Bots on one computer)",
            "Distributed setup   (Dashboard on NAS/server, MetaTrader & Bots on a separate PC)"
        )
        return Ask-Choice "How is your setup structured?" $opts
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: WHICH PC (distributed setup only)
# ═══════════════════════════════════════════════════════════════════════════════

function Step-SelectWhichPc {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Schritt 3b  —  Welchen PC richtest du jetzt ein?" } else { "Step 3b  —  Which PC are you setting up now?" }
    Show-StepHeader $title

    if ($LANG -eq "DE") {
        Write-Note "Im verteilten Setup richtet dieser Assistent immer nur einen PC ein."
        Write-Note "Führ den Setup-Assistenten anschließend auf dem anderen PC erneut aus."
        Write-Nl
        $opts = @(
            "NAS / Server   (läuft das AlphaTrack-Dashboard, Docker-basiert)",
            "Bot-PC   (läuft MetaTrader 5, die Bridge und die Bots)"
        )
        return Ask-Choice "Was ist dieser Computer?" $opts
    } else {
        Write-Note "In a distributed setup, this wizard configures one PC at a time."
        Write-Note "Run the setup wizard again on the other PC afterwards."
        Write-Nl
        $opts = @(
            "NAS / Server   (runs the AlphaTrack dashboard, Docker-based)",
            "Bot PC   (runs MetaTrader 5, the bridge and the bots)"
        )
        return Ask-Choice "What is this computer?" $opts
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: CREATE .env.local
# ═══════════════════════════════════════════════════════════════════════════════

function Step-CreateEnvLocal {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Konfiguration  —  API-Keys" } else { "Configuration  —  API Keys" }
    Show-StepHeader $title

    $envPath = Join-Path $RepoRoot ".env.local"

    # Load existing values
    $existingKey       = ""
    $existingAnthropicKey = ""
    $existingTwelveKey = ""
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^BOT_API_KEY=(.+)')          { $existingKey            = $Matches[1] }
            if ($_ -match '^ANTHROPIC_API_KEY=(.+)')    { $existingAnthropicKey   = $Matches[1] }
            if ($_ -match '^TWELVE_DATA_API_KEY=(.+)')  { $existingTwelveKey      = $Matches[1] }
        }
        $overwrite = Ask-YesNo $(if ($LANG -eq "DE") { ".env.local existiert bereits — überschreiben?" } else { ".env.local already exists — overwrite?" }) $false
        if (-not $overwrite) {
            Write-Info $(if ($LANG -eq "DE") { ".env.local unverändert." } else { ".env.local left unchanged." })
            Wait-Enter
            return $existingKey
        }
    }

    if ($LANG -eq "DE") {
        Write-Note "Optionale Keys können leer gelassen werden (ENTER überspringen)."
    } else {
        Write-Note "Optional keys can be left empty (press ENTER to skip)."
    }
    Write-Nl

    $defaultBotKey = if ($existingKey) { $existingKey } else { "alphatrack-" + (New-RandomId 16) }
    $keyLabel      = if ($LANG -eq "DE") { "BOT_API_KEY  (ENTER = zufälliger Key)" } else { "BOT_API_KEY  (ENTER = random key)" }
    $botKey = Ask-Input $keyLabel $defaultBotKey

    $anthropicLabel = if ($LANG -eq "DE") { "Anthropic API Key  (optional, für KI-Analyse)" } else { "Anthropic API Key  (optional, for AI analysis)" }
    $anthropicKey   = Ask-Input $anthropicLabel $existingAnthropicKey

    $twelveLabel = if ($LANG -eq "DE") { "Twelve Data API Key  (optional, für Kursdaten)" } else { "Twelve Data API Key  (optional, for price data)" }
    $twelveKey   = Ask-Input $twelveLabel $existingTwelveKey

    $lines = @("BOT_API_KEY=$botKey")
    if ($anthropicKey) { $lines += "ANTHROPIC_API_KEY=$anthropicKey" }
    if ($twelveKey)    { $lines += "TWELVE_DATA_API_KEY=$twelveKey" }

    Write-FileUtf8NoBom $envPath ($lines -join "`n")

    Write-Nl
    Write-Ok ".env.local $(if ($LANG -eq 'DE') { 'wurde erstellt' } else { 'created' })"
    Write-Note $envPath

    Wait-Enter
    return $botKey
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: CREATE bridge/config.json
# ═══════════════════════════════════════════════════════════════════════════════

function Step-CreateBridgeConfig {
    param([string]$BotApiKey)

    Show-Banner
    $title = if ($LANG -eq "DE") { "Konfiguration  —  Bridge" } else { "Configuration  —  Bridge" }
    Show-StepHeader $title

    $configPath = Join-Path $RepoRoot "bridge\config.json"

    # Load existing values as defaults
    $ex = $null
    if (Test-Path $configPath) {
        try { $ex = Get-Content $configPath -Raw | ConvertFrom-Json } catch {}
    }

    if ($ex) {
        $overwrite = Ask-YesNo $(if ($LANG -eq "DE") { "bridge\config.json existiert bereits — überschreiben?" } else { "bridge\config.json already exists — overwrite?" }) $false
        if (-not $overwrite) {
            Write-Info $(if ($LANG -eq "DE") { "bridge\config.json unverändert." } else { "bridge\config.json left unchanged." })
            Wait-Enter
            return $ex.alphatrack_url
        }
    }

    $detectedIp = Get-LocalIpAddress
    $defUrl     = if ($ex) { $ex.alphatrack_url } else { "http://localhost:3000" }
    $defIp      = if ($ex) { $ex.bridge_ip      } else { $detectedIp }
    $defLogin   = if ($ex) { "$($ex.mt5_login)" } else { "" }
    $defPw      = if ($ex) { $ex.mt5_password   } else { "" }
    $defServer  = if ($ex) { $ex.mt5_server      } else { "" }
    $defExe     = if ($ex) { $ex.mt5_exe_path    } else { "C:\Program Files\MetaTrader 5\terminal64.exe" }

    if ($LANG -eq "DE") {
        Write-Note "Die Bridge verbindet MetaTrader mit dem AlphaTrack-Dashboard."
        Write-Nl
        Write-Host "  ── AlphaTrack Dashboard ──" -ForegroundColor White
    } else {
        Write-Note "The bridge connects MetaTrader to the AlphaTrack dashboard."
        Write-Nl
        Write-Host "  ── AlphaTrack Dashboard ──" -ForegroundColor White
    }
    Write-Nl

    $appUrl = Ask-Input $(if ($LANG -eq "DE") { "URL der AlphaTrack-App" } else { "AlphaTrack app URL" }) $defUrl
    Write-Nl
    Write-Host "  ── Bridge ──" -ForegroundColor White
    Write-Nl
    $bridgeIp = Ask-Input $(if ($LANG -eq "DE") { "IP-Adresse dieses PCs  (Bridge lauscht auf dieser IP)" } else { "IP address of this PC  (bridge listens on this IP)" }) $defIp
    Write-Nl
    Write-Host "  ── MetaTrader 5 ──" -ForegroundColor White
    Write-Nl
    $mt5Login  = Ask-Input $(if ($LANG -eq "DE") { "Kontonummer" } else { "Account number" }) $defLogin
    $mt5Pw     = Ask-Input $(if ($LANG -eq "DE") { "Passwort" } else { "Password" }) $defPw -IsPassword
    $mt5Server = Ask-Input $(if ($LANG -eq "DE") { "Server-Name  (z.B. ICMarkets-Demo)" } else { "Server name  (e.g. ICMarkets-Demo)" }) $defServer
    $mt5Exe    = Ask-Input $(if ($LANG -eq "DE") { "Pfad zu terminal64.exe" } else { "Path to terminal64.exe" }) $defExe

    $bridgeId  = if ($ex -and $ex.bridge_id)   { $ex.bridge_id   } else { New-RandomId 10 }
    $profileId = if ($ex -and $ex.profile_id -and $ex.profile_id -ne "SET_AFTER_FIRST_START") {
        $ex.profile_id
    } else { "SET_AFTER_FIRST_START" }

    $mt5LoginInt = 0; [int]::TryParse($mt5Login, [ref]$mt5LoginInt) | Out-Null

    $cfg = [ordered]@{
        alphatrack_url           = $appUrl
        api_key                  = $BotApiKey
        bridge_id                = $bridgeId
        bridge_name              = "AlphaTrack Bridge"
        bridge_type              = "bridge"
        bridge_version           = "1.0.0"
        bridge_ip                = $bridgeIp
        bridge_port              = 8765
        bridge_latency_ms        = 0
        profile_id               = $profileId
        heartbeat_interval_sec   = 5
        trade_sync_interval_sec  = 30
        command_server_port      = 8765
        mt5_login                = $mt5LoginInt
        mt5_password             = $mt5Pw
        mt5_server               = $mt5Server
        symbols_to_watch         = @("EURUSD","GBPUSD","XAUUSD","USDJPY")
        mt5_exe_path             = $mt5Exe
        mt5_restart_wait_sec     = 10
        mt5_restart_max_attempts = 3
        mt5_startup_wait_sec     = 15
        sync_mode                = "full"
        sync_cutoff_timestamp    = 0
    }

    Write-FileUtf8NoBom $configPath ($cfg | ConvertTo-Json -Depth 5)

    Write-Nl
    Write-Ok "bridge/config.json $(if ($LANG -eq 'DE') { 'wurde erstellt' } else { 'created' })"

    if ($profileId -eq "SET_AFTER_FIRST_START") {
        Write-Nl
        Write-Warn $(if ($LANG -eq "DE") {
            "profile_id muss nach dem ersten Start gesetzt werden:"
        } else {
            "profile_id must be set after the first start:"
        })
        Write-Note $(if ($LANG -eq "DE") {
            "1. AlphaTrack starten  2. Profil anlegen  3. Profil-ID aus der URL kopieren"
        } else {
            "1. Start AlphaTrack  2. Create a profile  3. Copy the profile ID from the URL"
        })
        Write-Note "   → bridge\config.json  →  profile_id: \"YOUR_ID\""
    }

    Wait-Enter
    return $appUrl
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: CREATE deploy.config.json
# ═══════════════════════════════════════════════════════════════════════════════

function Step-CreateDeployConfig {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Konfiguration  —  Netzwerk & Deployment" } else { "Configuration  —  Network & Deployment" }
    Show-StepHeader $title

    $configPath = Join-Path $RepoRoot "scripts\windows\deploy.config.json"

    $ex = $null
    if (Test-Path $configPath) {
        try { $ex = Get-Content $configPath -Raw | ConvertFrom-Json } catch {}
    }

    if ($ex) {
        $overwrite = Ask-YesNo $(if ($LANG -eq "DE") { "deploy.config.json existiert bereits — überschreiben?" } else { "deploy.config.json already exists — overwrite?" }) $false
        if (-not $overwrite) {
            Write-Info $(if ($LANG -eq "DE") { "deploy.config.json unverändert." } else { "deploy.config.json left unchanged." })
            Wait-Enter
            return $ex
        }
    }

    function GetEx ([string]$p, [string]$fb = "") {
        if ($ex -and $null -ne $ex.PSObject.Properties[$p]) { return "$($ex.PSObject.Properties[$p].Value)" }
        return $fb
    }

    Write-Host "  ── NAS / Server ──" -ForegroundColor White
    Write-Nl
    $nasIp      = Ask-Input $(if ($LANG -eq "DE") { "IP-Adresse des NAS" } else { "NAS IP address" }) (GetEx "nas_host" "192.168.1.100")
    $nasSshPort = Ask-Input $(if ($LANG -eq "DE") { "SSH-Port des NAS" } else { "NAS SSH port" }) (GetEx "nas_ssh_port" "22")
    $nasSshUser = Ask-Input $(if ($LANG -eq "DE") { "SSH-Benutzername am NAS" } else { "NAS SSH username" }) (GetEx "nas_ssh_user" "admin")
    $nasDir     = Ask-Input $(if ($LANG -eq "DE") { "Projektverzeichnis auf dem NAS" } else { "Project directory on NAS" }) (GetEx "nas_project_dir" "/volume1/docker/alphatrack")
    $nasAppPort = Ask-Input $(if ($LANG -eq "DE") { "App-Port auf dem NAS" } else { "App port on NAS" }) (GetEx "nas_app_port" "3002")

    Write-Nl
    Write-Host "  ── Bot-PC (MetaTrader & Bots) ──" -ForegroundColor White
    Write-Note $(if ($LANG -eq "DE") { "Leer lassen, wenn noch nicht bekannt." } else { "Leave empty if not yet known." })
    Write-Nl
    $botpcIp   = Ask-Input $(if ($LANG -eq "DE") { "IP-Adresse des Bot-PCs" } else { "Bot PC IP address" }) (GetEx "trading_rechner_host" "")
    $botpcUser = Ask-Input $(if ($LANG -eq "DE") { "SSH-Benutzername auf dem Bot-PC" } else { "Bot PC SSH username" }) (GetEx "trading_rechner_ssh_user" "")
    $botpcDir  = Ask-Input $(if ($LANG -eq "DE") { "Zielverzeichnis auf dem Bot-PC" } else { "Target directory on Bot PC" }) (GetEx "trading_rechner_target_dir" "C:\AlphaTrack")

    Write-Nl
    Write-Host "  ── MetaTrader 5 ──" -ForegroundColor White
    Write-Nl
    $mt5Login  = Ask-Input $(if ($LANG -eq "DE") { "Kontonummer" } else { "Account number" }) (GetEx "mt5_login" "")
    $mt5Pw     = Ask-Input $(if ($LANG -eq "DE") { "Passwort" } else { "Password" }) (GetEx "mt5_password" "") -IsPassword
    $mt5Server = Ask-Input $(if ($LANG -eq "DE") { "Server-Name  (z.B. ICMarkets-Demo)" } else { "Server name  (e.g. ICMarkets-Demo)" }) (GetEx "mt5_server" "")
    $mt5Exe    = Ask-Input $(if ($LANG -eq "DE") { "Pfad zu terminal64.exe" } else { "Path to terminal64.exe" }) (GetEx "mt5_exe_path" "C:\Program Files\MetaTrader 5\terminal64.exe")

    $sshKeyPath = Join-Path $env:USERPROFILE ".ssh\alphatrack_deploy"

    $cfg = [ordered]@{
        nas_host          = $nasIp
        nas_ssh_port      = $nasSshPort
        nas_ssh_user      = $nasSshUser
        nas_project_dir   = $nasDir
        nas_app_port      = $nasAppPort
        trading_rechner_host       = $botpcIp
        trading_rechner_ssh_user   = $botpcUser
        trading_rechner_ssh_key    = $sshKeyPath
        trading_rechner_target_dir = $botpcDir
        mt5_login         = $mt5Login
        mt5_password      = $mt5Pw
        mt5_server        = $mt5Server
        mt5_exe_path      = $mt5Exe
        sync_mode         = "full"
    }

    Write-FileUtf8NoBom $configPath ($cfg | ConvertTo-Json -Depth 3)

    Write-Nl
    Write-Ok "deploy.config.json $(if ($LANG -eq 'DE') { 'wurde erstellt' } else { 'created' })"
    Write-Note $configPath

    Wait-Enter
    return $cfg
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: NPM INSTALL
# ═══════════════════════════════════════════════════════════════════════════════

function Step-NpmInstall {
    Show-Banner
    $title = if ($LANG -eq "DE") { "npm install  —  Pakete laden" } else { "npm install  —  Installing Packages" }
    Show-StepHeader $title

    Write-Info $(if ($LANG -eq "DE") { "Lädt alle benötigten Node.js-Pakete ..." } else { "Downloading all required Node.js packages ..." })
    Write-Nl

    Push-Location $RepoRoot
    try {
        & npm install | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -ne 0) { throw "npm install exit $LASTEXITCODE" }
        Write-Nl
        Write-Ok $(if ($LANG -eq "DE") { "npm install abgeschlossen." } else { "npm install completed." })
    } catch {
        Write-Nl
        Write-Warn $(if ($LANG -eq "DE") {
            "npm install fehlgeschlagen. Manuell ausführen: npm install"
        } else {
            "npm install failed. Run manually: npm install"
        })
    } finally {
        Pop-Location
    }

    Wait-Enter
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: PIP INSTALL
# ═══════════════════════════════════════════════════════════════════════════════

function Step-PipInstall {
    Show-Banner
    $title = if ($LANG -eq "DE") { "pip install  —  Python-Pakete laden" } else { "pip install  —  Installing Python Packages" }
    Show-StepHeader $title

    $reqFile = Join-Path $RepoRoot "bridge\requirements.txt"
    if (-not (Test-Path $reqFile)) {
        Write-Warn $(if ($LANG -eq "DE") { "bridge\requirements.txt nicht gefunden." } else { "bridge\requirements.txt not found." })
        Wait-Enter
        return
    }

    Write-Info $(if ($LANG -eq "DE") { "Installiert Python-Abhängigkeiten für die Bridge ..." } else { "Installing Python dependencies for the bridge ..." })
    Write-Nl

    & python -m pip install -r $reqFile | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) {
        Write-Nl
        Write-Warn $(if ($LANG -eq "DE") {
            "pip install fehlgeschlagen. Manuell ausführen: pip install -r bridge\requirements.txt"
        } else {
            "pip install failed. Run manually: pip install -r bridge\requirements.txt"
        })
    } else {
        Write-Nl
        Write-Ok $(if ($LANG -eq "DE") { "Python-Pakete installiert." } else { "Python packages installed." })
    }

    Wait-Enter
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: SSH KEY SETUP
# ═══════════════════════════════════════════════════════════════════════════════

function Step-SshKeySetup {
    Show-Banner
    $title = if ($LANG -eq "DE") { "SSH-Key  —  Automatisches Deployment einrichten" } else { "SSH Key  —  Set Up Automatic Deployment" }
    Show-StepHeader $title

    if ($LANG -eq "DE") {
        Write-Note "Für automatisches Deployment zum NAS und Bot-PC wird ein SSH-Key benötigt."
        Write-Note "Der Key wird in ~/.ssh/alphatrack_deploy gespeichert."
    } else {
        Write-Note "An SSH key is required for automatic deployment to the NAS and Bot PC."
        Write-Note "The key will be stored in ~/.ssh/alphatrack_deploy."
    }

    $doSetup = Ask-YesNo $(if ($LANG -eq "DE") { "SSH-Key jetzt einrichten?" } else { "Set up SSH key now?" }) $true

    if ($doSetup) {
        $sshScript = Join-Path $RepoRoot "scripts\windows\setup-ssh-key.ps1"
        if (Test-Path $sshScript) {
            & powershell -NoProfile -ExecutionPolicy Bypass -File $sshScript
        } else {
            Write-Warn $(if ($LANG -eq "DE") { "setup-ssh-key.ps1 nicht gefunden." } else { "setup-ssh-key.ps1 not found." })
        }
    } else {
        Write-Info $(if ($LANG -eq "DE") {
            "Übersprungen. Manuell starten: scripts\windows\setup-ssh-key.ps1"
        } else {
            "Skipped. Run manually: scripts\windows\setup-ssh-key.ps1"
        })
        Wait-Enter
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: NAS DOCKER DEPLOY
# ═══════════════════════════════════════════════════════════════════════════════

function Step-NasDeploy {
    Show-Banner
    $title = if ($LANG -eq "DE") { "Deployment  —  AlphaTrack auf NAS installieren" } else { "Deployment  —  Install AlphaTrack on NAS" }
    Show-StepHeader $title

    if ($LANG -eq "DE") {
        Write-Note "AlphaTrack kann jetzt per SSH auf deinem NAS deployed werden."
        Write-Note "Voraussetzung: SSH-Key ist auf dem NAS eingetragen (vorheriger Schritt)."
    } else {
        Write-Note "AlphaTrack can now be deployed to your NAS via SSH."
        Write-Note "Prerequisite: SSH key must be added to the NAS (previous step)."
    }

    $doDeploy = Ask-YesNo $(if ($LANG -eq "DE") { "Jetzt auf NAS deployen?" } else { "Deploy to NAS now?" }) $false

    if ($doDeploy) {
        $deployBat = Join-Path $RepoRoot "scripts\windows\deploy.bat"
        if (Test-Path $deployBat) {
            Write-Info $(if ($LANG -eq "DE") { "Deployment wird gestartet ..." } else { "Starting deployment ..." })
            Write-Nl
            & "$deployBat"
        } else {
            Write-Warn $(if ($LANG -eq "DE") { "deploy.bat nicht gefunden." } else { "deploy.bat not found." })
            Wait-Enter
        }
    } else {
        Write-Info $(if ($LANG -eq "DE") {
            "Übersprungen. Manuell starten: scripts\windows\deploy.bat"
        } else {
            "Skipped. Run manually: scripts\windows\deploy.bat"
        })
        Wait-Enter
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: START APP
# ═══════════════════════════════════════════════════════════════════════════════

function Step-StartApp {
    param([string]$AppUrl = "http://localhost:3000")

    Show-Banner
    $title = if ($LANG -eq "DE") { "App starten" } else { "Start App" }
    Show-StepHeader $title

    $doStart = Ask-YesNo $(if ($LANG -eq "DE") { "AlphaTrack jetzt starten?" } else { "Start AlphaTrack now?" }) $true

    if ($doStart) {
        Write-Info $(if ($LANG -eq "DE") {
            "App wird in neuem Fenster gestartet. Browser öffnet sich in wenigen Sekunden ..."
        } else {
            "App starts in a new window. Browser will open in a few seconds ..."
        })
        Start-Process powershell -ArgumentList "-NoProfile -NoExit -Command `"Set-Location '$RepoRoot'; npm run dev`""
        Start-Sleep 5
        Start-Process $AppUrl
    } else {
        Write-Info $(if ($LANG -eq "DE") { "Manuell starten: npm run dev" } else { "Start manually: npm run dev" })
    }

    Wait-Enter
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP: SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

function Step-Summary {
    param([string]$Scenario, [string[]]$CreatedFiles)

    Show-Banner
    Write-Host "  $(if ($LANG -eq 'DE') { 'Einrichtung abgeschlossen!' } else { 'Setup Complete!' })" -ForegroundColor Green
    Write-Nl
    Write-Host ("  " + ("═" * 56)) -ForegroundColor DarkCyan
    Write-Nl

    if ($CreatedFiles.Count -gt 0) {
        Write-Host "  $(if ($LANG -eq 'DE') { 'Erstellte Dateien:' } else { 'Created files:' })" -ForegroundColor White
        foreach ($f in $CreatedFiles) { Write-Ok $f }
        Write-Nl
    }

    Write-Host "  $(if ($LANG -eq 'DE') { 'Nächste Schritte:' } else { 'Next Steps:' })" -ForegroundColor White
    Write-Nl

    switch ($Scenario) {
        "journal" {
            if ($LANG -eq "DE") {
                Write-Note "1. App starten:         npm run dev"
                Write-Note "2. Browser öffnen:      http://localhost:3000"
                Write-Note "3. Profil anlegen und loslegen!"
            } else {
                Write-Note "1. Start the app:       npm run dev"
                Write-Note "2. Open browser:        http://localhost:3000"
                Write-Note "3. Create a profile and start journaling!"
            }
        }
        "bots-single" {
            if ($LANG -eq "DE") {
                Write-Note "1. App starten:         npm run dev"
                Write-Note "2. Browser öffnen:      http://localhost:3000"
                Write-Note "3. Profil anlegen"
                Write-Note "4. Profil-ID in bridge\config.json eintragen  (profile_id)"
                Write-Note "5. Bridge starten:      bridge\start_bridge.bat"
            } else {
                Write-Note "1. Start the app:       npm run dev"
                Write-Note "2. Open browser:        http://localhost:3000"
                Write-Note "3. Create a profile"
                Write-Note "4. Enter profile ID in bridge\config.json  (profile_id)"
                Write-Note "5. Start bridge:        bridge\start_bridge.bat"
            }
        }
        "bots-nas" {
            if ($LANG -eq "DE") {
                Write-Note "1. Dashboard läuft auf dem NAS (Port aus deploy.config.json)"
                Write-Note "2. Setup auf dem Bot-PC ebenfalls ausführen"
                Write-Note "3. Profil anlegen → Profil-ID in bridge\config.json auf Bot-PC eintragen"
                Write-Note "4. Bridge starten:      bridge\start_bridge.bat  (auf Bot-PC)"
            } else {
                Write-Note "1. Dashboard runs on the NAS (port from deploy.config.json)"
                Write-Note "2. Run the setup wizard on the Bot PC as well"
                Write-Note "3. Create a profile → enter profile ID in bridge\config.json on Bot PC"
                Write-Note "4. Start bridge:        bridge\start_bridge.bat  (on Bot PC)"
            }
        }
        "bots-botpc" {
            if ($LANG -eq "DE") {
                Write-Note "1. Sicherstellen, dass AlphaTrack auf dem NAS/Server läuft"
                Write-Note "2. Profil in AlphaTrack anlegen → Profil-ID holen"
                Write-Note "3. Profil-ID in bridge\config.json eintragen  (profile_id)"
                Write-Note "4. Bridge starten:      bridge\start_bridge.bat"
            } else {
                Write-Note "1. Make sure AlphaTrack is running on the NAS/server"
                Write-Note "2. Create a profile in AlphaTrack → get the profile ID"
                Write-Note "3. Enter profile ID in bridge\config.json  (profile_id)"
                Write-Note "4. Start bridge:        bridge\start_bridge.bat"
            }
        }
    }

    Write-Nl
    Write-Host ("  " + ("═" * 56)) -ForegroundColor DarkCyan
    Write-Nl
    Write-Host "  $(if ($LANG -eq 'DE') { 'Viel Erfolg beim Trading!' } else { 'Happy trading!' })" -ForegroundColor Cyan
    Write-Nl

    Wait-Enter $(if ($LANG -eq "DE") { "ENTER zum Beenden ..." } else { "Press ENTER to exit ..." })
}

# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

$createdFiles = @()

# ── Language ──────────────────────────────────────────────────────────────────
Step-SelectLanguage

# ── Welcome ───────────────────────────────────────────────────────────────────
Step-Welcome

# ── Scenario ──────────────────────────────────────────────────────────────────
$scenario = Step-SelectScenario   # 1 = journal, 2 = bots

# ═════════════════════════════════════════════════════════════════════════════
#  PATH A: JOURNAL ONLY
# ═════════════════════════════════════════════════════════════════════════════
if ($scenario -eq 1) {

    Step-CheckPrereqs -NeedNode $true -NeedPython $false | Out-Null

    $botKey = Step-CreateEnvLocal
    $createdFiles += ".env.local"

    Step-NpmInstall

    Step-StartApp -AppUrl "http://localhost:3000"

    Step-Summary -Scenario "journal" -CreatedFiles $createdFiles
    exit 0
}

# ═════════════════════════════════════════════════════════════════════════════
#  PATH B: BOTS
# ═════════════════════════════════════════════════════════════════════════════
$setupType = Step-SelectSetupType   # 1 = single, 2 = distributed

# ── B1: Bots + Single PC ─────────────────────────────────────────────────────
if ($setupType -eq 1) {

    Step-CheckPrereqs -NeedNode $true -NeedPython $true | Out-Null

    $botKey = Step-CreateEnvLocal
    $createdFiles += ".env.local"

    Step-CreateBridgeConfig -BotApiKey $botKey
    $createdFiles += "bridge\config.json"

    Step-NpmInstall
    Step-PipInstall

    Step-StartApp -AppUrl "http://localhost:3000"

    Step-Summary -Scenario "bots-single" -CreatedFiles $createdFiles
    exit 0
}

# ── B2: Distributed ──────────────────────────────────────────────────────────
$whichPc = Step-SelectWhichPc   # 1 = NAS, 2 = bot-pc

# ── B2a: NAS side ─────────────────────────────────────────────────────────────
if ($whichPc -eq 1) {

    Step-CheckPrereqs -NeedNode $true -NeedPython $false | Out-Null

    $botKey = Step-CreateEnvLocal
    $createdFiles += ".env.local"

    Step-CreateDeployConfig | Out-Null
    $createdFiles += "scripts\windows\deploy.config.json"

    Step-NpmInstall

    Step-SshKeySetup
    Step-NasDeploy

    Step-Summary -Scenario "bots-nas" -CreatedFiles $createdFiles
    exit 0
}

# ── B2b: Bot-PC side ──────────────────────────────────────────────────────────
Show-Banner
$title = if ($LANG -eq "DE") { "Konfiguration  —  Bot-PC einrichten" } else { "Configuration  —  Set Up Bot PC" }
Show-StepHeader $title

if ($LANG -eq "DE") {
    Write-Note "Der Bot-PC benötigt nur die Bridge-Konfiguration und Python-Pakete."
    Write-Note "Der BOT_API_KEY muss mit dem Wert auf dem NAS/Server übereinstimmen."
} else {
    Write-Note "The Bot PC only needs the bridge configuration and Python packages."
    Write-Note "The BOT_API_KEY must match the value configured on the NAS/server."
}
Write-Nl

$botKey = Ask-Input $(if ($LANG -eq "DE") { "BOT_API_KEY  (vom NAS/Server übertragen)" } else { "BOT_API_KEY  (copy from the NAS/server)" }) ""

Step-CheckPrereqs -NeedNode $false -NeedPython $true | Out-Null

Step-CreateBridgeConfig -BotApiKey $botKey
$createdFiles += "bridge\config.json"

Step-PipInstall

Step-Summary -Scenario "bots-botpc" -CreatedFiles $createdFiles
exit 0

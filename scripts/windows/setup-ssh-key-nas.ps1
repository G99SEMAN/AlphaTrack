# AlphaTrack - Einmaliger SSH-Key-Setup fuer das NAS (Synology)
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\setup-ssh-key-nas.ps1

$ErrorActionPreference = 'Stop'
$Sep     = '-' * 55
$KeyPath = Join-Path $env:USERPROFILE '.ssh\alphatrack_nas'
$PubPath = "$KeyPath.pub"

function Write-Step([string]$Msg)  { Write-Host ''; Write-Host "  $Msg" -ForegroundColor Cyan; Write-Host "  $Sep" }
function Write-Ok([string]$Msg)    { Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Info([string]$Msg)  { Write-Host "  $Msg" }
function Write-Warn([string]$Msg)  { Write-Host "  [!] $Msg" -ForegroundColor Yellow }

# --- Schritt 1: Schluesselpaar erzeugen ------------------

Write-Step 'SSH-Key-Setup fuer AlphaTrack NAS (Dev-Sync + Live-Datenzugriff)'

# --- Schritt 0: NAS-Zugangsdaten abfragen ----------------

$NasHost = Read-Host '  NAS-IP-Adresse'
$NasUser = Read-Host '  NAS-SSH-Benutzername'
$NasPortInput = Read-Host '  NAS-SSH-Port [88]'
$NasPort = if ($NasPortInput.Trim()) { $NasPortInput.Trim() } else { '88' }

if (Test-Path $KeyPath) {
    Write-Ok "Schluessel existiert bereits: $KeyPath"
} else {
    Write-Info "Erzeuge ed25519-Schluesselpaar (ohne Passphrase) ..."
    $sshDir = Split-Path $KeyPath
    if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }

    $input = "`n`n"
    $input | & ssh-keygen -t ed25519 -f $KeyPath -C "alphatrack-nas@$(hostname)"
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen fehlgeschlagen.' }
    Write-Ok "Schluesselpaar erzeugt: $KeyPath"
}

# --- Schritt 2: Public Key anzeigen ----------------------

Write-Step 'Public Key (auf dem NAS eintragen)'
$pubKey = (Get-Content $PubPath -Raw).Trim()
Write-Host ''
Write-Host "  $pubKey" -ForegroundColor White
Write-Host ''

# --- Schritt 3: Anleitung --------------------------------

Write-Step 'Anleitung: Public Key auf dem NAS einrichten (einmalig)'
Write-Host ''
Write-Info 'Einmal per SSH mit Passwort auf das NAS verbinden und ausfuehren:'
Write-Host ''
Write-Host "       ssh -p $NasPort $NasUser@$NasHost" -ForegroundColor DarkGray
Write-Host ''
Write-Info 'Dort (Passwort-Login):'
Write-Host ''
Write-Host "       mkdir -p ~/.ssh && chmod 700 ~/.ssh" -ForegroundColor DarkGray
Write-Host "       echo `"$pubKey`" >> ~/.ssh/authorized_keys" -ForegroundColor Yellow
Write-Host "       chmod 600 ~/.ssh/authorized_keys" -ForegroundColor DarkGray
Write-Host ''
Write-Info 'Falls Synology DSM Public-Key-Auth deaktiviert hat:'
Write-Info '  DSM -> Systemsteuerung -> Terminal & SNMP -> SSH-Dienst aktivieren'
Write-Info '  (Public-Key-Login ist beim OpenSSH-Standard von DSM normalerweise an)'
Write-Host ''

# --- Schritt 4: Verbindungstest --------------------------

Write-Step 'Verbindungstest'
Write-Info "Teste Verbindung zu ${NasUser}@${NasHost}:${NasPort} ..."
& ssh -i $KeyPath -p $NasPort -o ConnectTimeout=10 -o BatchMode=yes "$NasUser@$NasHost" "echo KEY_AUTH_OK"
if ($LASTEXITCODE -eq 0) {
    Write-Ok 'SSH-Key-Authentifizierung funktioniert!'
} else {
    Write-Warn 'Verbindung fehlgeschlagen. Public Key noch nicht eingetragen? (siehe Anleitung oben)'
}

Write-Host ''
Write-Info "Key-Pfad (wird von sync-dev.ps1 automatisch verwendet):"
Write-Host "  $KeyPath" -ForegroundColor Yellow
Write-Host ''
Write-Host "  $Sep"
Write-Ok 'Setup abgeschlossen.'
Write-Host "  $Sep"
Write-Host ''

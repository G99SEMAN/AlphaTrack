# AlphaTrack — Einmaliger SSH-Key-Setup für Mini-PC
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\setup-ssh-key.ps1
#
# Was dieses Script tut:
#   1. Erzeugt ein ed25519-Schlüsselpaar unter %USERPROFILE%\.ssh\alphatrack_deploy (falls nicht vorhanden)
#   2. Zeigt den Public Key und gibt Schritt-für-Schritt-Anleitung aus, wie er auf den Mini-PC kommt
#   3. Testet optional die Verbindung per Key

$ErrorActionPreference = 'Stop'
$Sep     = '-' * 55
$KeyPath = Join-Path $env:USERPROFILE '.ssh\alphatrack_deploy'
$PubPath = "$KeyPath.pub"

function Write-Step([string]$Msg)  { Write-Host ''; Write-Host "  $Msg" -ForegroundColor Cyan; Write-Host "  $Sep" }
function Write-Ok([string]$Msg)    { Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Info([string]$Msg)  { Write-Host "  $Msg" }
function Write-Warn([string]$Msg)  { Write-Host "  [!] $Msg" -ForegroundColor Yellow }

# --- Schritt 1: Schlüsselpaar erzeugen ------------------

Write-Step 'SSH-Key-Setup für AlphaTrack Deploy'

if (Test-Path $KeyPath) {
    Write-Ok "Schlüssel existiert bereits: $KeyPath"
} else {
    Write-Info "Erzeuge ed25519-Schlüsselpaar (ohne Passphrase) ..."
    $sshDir = Split-Path $KeyPath
    if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }
    & ssh-keygen -t ed25519 -f $KeyPath -N '' -C "alphatrack-deploy@$(hostname)"
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen fehlgeschlagen.' }
    Write-Ok "Schlüsselpaar erzeugt: $KeyPath"
}

# --- Schritt 2: Public Key anzeigen ---------------------

Write-Step 'Public Key (auf Mini-PC eintragen)'
$pubKey = (Get-Content $PubPath -Raw).Trim()
Write-Host ''
Write-Host "  $pubKey" -ForegroundColor White
Write-Host ''

# --- Schritt 3: Anleitung (Mini-PC hat kein Passwort) ---

Write-Step 'Anleitung: Public Key auf Mini-PC einrichten'
Write-Host ''
Write-Info 'Da der Mini-PC kein Windows-Passwort hat, kann ssh-copy-id nicht verwendet werden.'
Write-Info 'Stattdessen: Einmal physisch (oder per Remote Desktop) auf dem Mini-PC anmelden:'
Write-Host ''
Write-Info '  1. PowerShell auf dem Mini-PC öffnen (kein Admin nötig):'
Write-Host ''
Write-Host '       $dir = "$env:USERPROFILE\.ssh"' -ForegroundColor DarkGray
Write-Host '       if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir }' -ForegroundColor DarkGray
Write-Host '       # Dann den Public Key als neue Zeile anhängen:' -ForegroundColor DarkGray
Write-Host "       Add-Content -Path ""`$env:USERPROFILE\.ssh\authorized_keys"" -Value '$pubKey'" -ForegroundColor Yellow
Write-Host ''
Write-Info '  2. Berechtigungen setzen (wichtig — OpenSSH verweigert sonst den Key):'
Write-Host ''
Write-Host '       icacls "$env:USERPROFILE\.ssh\authorized_keys" /inheritance:r /grant:r "${env:USERNAME}:F"' -ForegroundColor DarkGray
Write-Host ''
Write-Info '  Alternative: Die Zeile oben in eine .txt-Datei kopieren, per USB-Stick'
Write-Info '  auf den Mini-PC bringen und dort einfügen.'
Write-Host ''

# --- Schritt 4: Verbindungstest -------------------------

Write-Step 'Verbindungstest (optional)'
$user = Read-Host "  Mini-PC SSH-Benutzer (Enter zum Überspringen)"
if ($user.Trim() -ne '') {
    $host_ = Read-Host "  Mini-PC IP/Hostname"
    if ($host_.Trim() -ne '') {
        Write-Info "Teste Verbindung zu $($user.Trim())@$($host_.Trim()) ..."
        & ssh -i $KeyPath -o ConnectTimeout=10 -o BatchMode=yes "$($user.Trim())@$($host_.Trim())" "echo KEY_AUTH_OK"
        if ($LASTEXITCODE -eq 0) {
            Write-Ok 'SSH-Key-Authentifizierung funktioniert!'
            Write-Host ''
            Write-Info "Key-Pfad für deploy.ps1-Konfiguration:"
            Write-Host "  $KeyPath" -ForegroundColor Yellow
        } else {
            Write-Warn 'Verbindung fehlgeschlagen. Public Key noch nicht auf dem Mini-PC eingetragen?'
        }
    }
} else {
    Write-Info "Test übersprungen."
    Write-Host ''
    Write-Info "Key-Pfad für deploy.ps1-Konfiguration (beim nächsten Deploy eingeben):"
    Write-Host "  $KeyPath" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "  $Sep"
Write-Ok 'Setup abgeschlossen.'
Write-Host "  $Sep"
Write-Host ''

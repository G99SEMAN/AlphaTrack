# AlphaTrack - Einmaliger SSH-Key-Setup fuer Mini-PC
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\setup-ssh-key.ps1

$ErrorActionPreference = 'Stop'
$Sep     = '-' * 55
$KeyPath = Join-Path $env:USERPROFILE '.ssh\alphatrack_deploy'
$PubPath = "$KeyPath.pub"

function Write-Step([string]$Msg)  { Write-Host ''; Write-Host "  $Msg" -ForegroundColor Cyan; Write-Host "  $Sep" }
function Write-Ok([string]$Msg)    { Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Info([string]$Msg)  { Write-Host "  $Msg" }
function Write-Warn([string]$Msg)  { Write-Host "  [!] $Msg" -ForegroundColor Yellow }

# --- Schritt 1: Schluesselpaar erzeugen ------------------

Write-Step 'SSH-Key-Setup fuer AlphaTrack Deploy'

if (Test-Path $KeyPath) {
    Write-Ok "Schluessel existiert bereits: $KeyPath"
} else {
    Write-Info "Erzeuge ed25519-Schluesselpaar (ohne Passphrase) ..."
    $sshDir = Split-Path $KeyPath
    if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }

    # Zwei leere Zeilen als Passphrase-Eingabe (Enter + Bestaetigung)
    $input = "`n`n"
    $input | & ssh-keygen -t ed25519 -f $KeyPath -C "alphatrack-deploy@$(hostname)"
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen fehlgeschlagen.' }
    Write-Ok "Schluesselpaar erzeugt: $KeyPath"
}

# --- Schritt 2: Public Key anzeigen ----------------------

Write-Step 'Public Key (auf Mini-PC eintragen)'
$pubKey = (Get-Content $PubPath -Raw).Trim()
Write-Host ''
Write-Host "  $pubKey" -ForegroundColor White
Write-Host ''

# --- Schritt 3: Anleitung --------------------------------

Write-Step 'Anleitung: Public Key auf Mini-PC einrichten'
Write-Host ''
Write-Info 'Da der Mini-PC kein Windows-Passwort hat, muss der Key manuell'
Write-Info 'eingetragen werden. Einmal physisch (oder per Remote Desktop) anmelden:'
Write-Host ''
Write-Info '  PowerShell auf dem Mini-PC oeffnen und ausfuehren:'
Write-Host ''
Write-Host "       Add-Content ""`$env:USERPROFILE\.ssh\authorized_keys"" ``" -ForegroundColor DarkGray
Write-Host "         ""$pubKey""" -ForegroundColor Yellow
Write-Host "       icacls ""`$env:USERPROFILE\.ssh\authorized_keys"" /inheritance:r /grant:r ""`${env:USERNAME}:F""" -ForegroundColor DarkGray
Write-Host ''

# --- Schritt 4: Verbindungstest --------------------------

Write-Step 'Verbindungstest (optional)'
$user = Read-Host "  Mini-PC SSH-Benutzer (Enter zum Ueberspringen)"
if ($user.Trim() -ne '') {
    $minipcHost = Read-Host "  Mini-PC IP/Hostname"
    if ($minipcHost.Trim() -ne '') {
        Write-Info "Teste Verbindung zu $($user.Trim())@$($minipcHost.Trim()) ..."
        & ssh -i $KeyPath -o ConnectTimeout=10 -o BatchMode=yes "$($user.Trim())@$($minipcHost.Trim())" "echo KEY_AUTH_OK"
        if ($LASTEXITCODE -eq 0) {
            Write-Ok 'SSH-Key-Authentifizierung funktioniert!'
        } else {
            Write-Warn 'Verbindung fehlgeschlagen. Public Key noch nicht eingetragen?'
        }
    }
} else {
    Write-Info "Test uebersprungen."
}

Write-Host ''
Write-Info "Key-Pfad fuer deploy.ps1-Konfiguration:"
Write-Host "  $KeyPath" -ForegroundColor Yellow
Write-Host ''
Write-Host "  $Sep"
Write-Ok 'Setup abgeschlossen.'
Write-Host "  $Sep"
Write-Host ''

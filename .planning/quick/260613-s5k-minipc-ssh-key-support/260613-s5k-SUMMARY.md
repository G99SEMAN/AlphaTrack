---
id: 260613-s5k
status: complete
completed: 2026-06-13
commit: b66561e
---

# Summary: Mini-PC SSH-Key-Unterstützung

## Was wurde gebaut

- `scripts/windows/deploy.ps1`: Neues Feld `minipc_ssh_key` in Config + Questionnaire (optional, leer = Passwort-Auth). Neue Hilfsfunktion `Get-MiniPcSshArgs($cfg)` gibt `@('-i', keypath)` zurück wenn Key gesetzt, sonst `@()`. Alle 4 SSH/SCP-Stellen zum Mini-PC verwenden jetzt `@keyArgs`-Splatting.
- `scripts/windows/setup-ssh-key.ps1`: Einmaliger Setup-Helfer. Erzeugt ed25519-Key unter `%USERPROFILE%\.ssh\alphatrack_deploy`, zeigt Public Key mit fertigen `Add-Content`/`icacls`-Befehlen für den Mini-PC. Optionaler Verbindungstest am Ende.
- `README.md`: SSH-Key-Setup-Abschnitt mit Kopierbefehlen ergänzt.

## Warum nötig

Mini-PC hat kein Windows-Passwort → Windows OpenSSH blockiert leere Passwörter → Deploy hing bei SSH-Passwortabfrage. Lösung: SSH-Key-Auth, manuell einmalig auf Mini-PC einrichten.

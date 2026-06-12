# Design: NAS/Mini-PC-Deployment mit Konfigurationsabfrage

**Datum:** 2026-06-12
**Status:** Vom Nutzer freigegeben (Ansatz B)

## Ausgangslage

AlphaTrack wurde bisher hauptsächlich auf dem Dev-PC getestet. Zielarchitektur:

- **NAS (Synology, 192.168.178.3):** AlphaTrack als Docker-Container (Port 3002 → 3000)
- **Mini-PC (Windows):** MetaTrader 5, Bridge (Port 8765) und Bots (Ports 8770+)
- **Dev-PC:** Entwicklung und Auslösen des Deploys

Vorhandene Bausteine:

- `scripts/windows/deploy.bat`: git push + SSH-Aufruf von `scripts/nas-update.sh` auf dem NAS (Werte hartkodiert)
- `bridge/setup.py`: interaktives Bridge-Setup mit Auto-Discovery (wird durch zentrales Deploy ersetzt, bleibt aber als lokaler Fallback bestehen)
- Bots finden die Bridge via UDP 8766 / LAN-Scan (für das Zielsetup wird `bridge_url` stattdessen explizit gesetzt)

## Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Versorgung des Mini-PCs | Zentral über deploy.bat vom Dev-PC aus |
| Zugriffsweg auf Mini-PC | SSH (Windows OpenSSH-Server, einmalig manuell aktivieren) |
| Autostart auf Mini-PC | Nur Bridge automatisch (Task Scheduler, bei Anmeldung); Bots werden nur kopiert und manuell gestartet |
| Secrets in Git | Bleiben im Repo (privates Repo); deploy schreibt Werte beim Verteilen |
| Mini-PC-Stand | MT5 und Python sind installiert; OpenSSH muss noch aktiviert werden |
| Umsetzung | Ansatz B: deploy.bat als dünner Wrapper um `scripts/windows/deploy.ps1` (PowerShell 5.1-kompatibel) |

## Architektur

```
Dev-PC                          NAS                         Mini-PC
deploy.bat ──> deploy.ps1 ──┬─> ssh: nas-update.sh          
                            │   (git pull, docker rebuild)  
                            ├─> HTTP: /api/bridge/info      
                            │   (API-Key + Profile holen)   
                            └────────────────────────────── ssh/scp:
                                                            - bridge/ + bots/ kopieren
                                                            - config.json generieren
                                                            - Scheduled Task (Bridge)
                                                            - Firewall-Regel 8765
Laufzeit:  Bots ──WS/HTTP──> Bridge ──HTTP──> AlphaTrack (NAS:3002)
           AlphaTrack ──HTTP──> Bridge (MINIPC:8765)
```

## Komponenten

### 1. `scripts/windows/deploy.bat` (Wrapper)

Ersetzt den bisherigen Inhalt durch einen Aufruf von
`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"`.
Bleibt der gewohnte Doppelklick-Einstiegspunkt.

### 2. `scripts/windows/deploy.ps1` (Hauptskript)

**Phase 0 — Konfigurationsabfrage:**
Liest `scripts/windows/deploy.config.json` (falls vorhanden) und fragt jeden Wert
interaktiv ab; Enter übernimmt den gespeicherten Default (Muster wie in
`bridge/setup.py`). Abgefragt werden:

- NAS: IP (Default 192.168.178.3), SSH-Port (88), SSH-User, Projektpfad
  (`/volume1/docker/alphatrack`), AlphaTrack-Port (3002)
- Mini-PC: IP/Hostname, SSH-User, Zielordner (Default `C:\AlphaTrack`)
- MetaTrader: Kontonummer (Login), Passwort, Server, Pfad zu `terminal64.exe`
- Anthropic-API-Key (nur falls `.env.local` auf dem NAS fehlt, siehe Phase 1)

Danach wird `deploy.config.json` gespeichert (gitignored — die Datei ist
Dev-PC-spezifischer Zustand und enthält das MT5-Passwort; sie wird zur Laufzeit
erzeugt und muss nicht verteilt werden).

**Phase 1 — NAS-Deploy:**

1. `git push` (Abbruch bei Fehler)
2. Prüfen, ob `.env.local` im NAS-Projektpfad existiert (`ssh test -f`); falls
   nicht: `BOT_API_KEY` generieren, Anthropic-API-Key abfragen (optional) und
   Datei per SSH anlegen. Muss vor `nas-update.sh` passieren, da
   `docker-compose.yml` die Datei als `env_file` voraussetzt
3. `ssh -p <port> <user>@<nas> "bash <pfad>/scripts/nas-update.sh"`
4. Warten bis `http://<NAS>:3002/api/bridge/info` antwortet (Timeout 120 s,
   Polling alle 5 s); bei Timeout Abbruch mit Hinweis
5. API-Key: `/api/bridge/info` liefert bewusst keinen Key. Der Key ist
   `BOT_API_KEY` aus `.env.local` auf dem NAS — das Skript liest ihn dort per
   SSH aus (bzw. erzeugt ihn beim Anlegen der Datei in Schritt 2) und trägt
   denselben Wert in die Bridge-/Bot-Configs ein. Aus `/api/bridge/info`
   kommt nur die Profilliste; Profilauswahl:
   genau ein Profil → automatisch; mehrere → nummerierte Auswahl; keines →
   Abbruch mit Hinweis, zuerst ein Profil im AlphaTrack-UI anzulegen

**Phase 2 — Mini-PC-Deploy:**

1. SSH-Erreichbarkeit prüfen (`ssh <user>@<minipc> exit`); falls nicht erreichbar:
   verständliche Anleitung zur einmaligen OpenSSH-Aktivierung ausgeben
   (Windows-Einstellungen → Optionale Features → OpenSSH-Server; Dienst auf
   Automatisch) und Abbruch
2. `bridge/` und `bots/` (inkl. `bots/scaffold/`) per `scp -r` in den Zielordner
   kopieren; vorhandene `config.json` auf dem Mini-PC werden anschließend gezielt
   überschrieben (Schritt 3), lokale Laufzeitdateien (`ticket_registry.json`,
   Logs, `data/`-Ordner der Bots) werden nicht angetastet
3. Configs aus den Antworten generieren und per SSH schreiben:
   - `bridge/config.json`: MT5-Login/Passwort/Server/Exe-Pfad,
     `alphatrack_url = http://<NAS>:3002`, API-Key, `profile_id`,
     `command_server_port = 8765`, `bridge_id = ""` (Neuregistrierung)
   - je Bot `config.json`: `alphatrack_url`, API-Key, `profile_id`,
     `bridge_url = http://<MINIPC>:8765` (explizit statt UDP-Discovery);
     bot-spezifische Felder (`bot_id`, `bot_port`, `strategy`) bleiben aus der
     Repo-Vorlage erhalten
4. Firewall-Regel „AlphaTrack Bridge 8765“ (eingehend, TCP 8765) per
   `netsh advfirewall` anlegen, falls nicht vorhanden
5. Geplante Aufgabe „AlphaTrack Bridge“ per `schtasks` anlegen/aktualisieren:
   Trigger „Bei Anmeldung“, Aktion `start_bridge.bat` im Zielordner; danach
   Bridge sofort (neu) starten. Bots werden bewusst nicht gestartet.

**Phase 3 — Abschluss-Check:**

Bis zu 60 s pollen, ob die Bridge sich beim NAS-AlphaTrack registriert hat
(Bridge-Status über die AlphaTrack-API). Erfolg/Misserfolg mit konkreten
nächsten Schritten ausgeben (z. B. „Bridge-Log auf dem Mini-PC prüfen“).

### 3. Anpassungen an Bestandsdateien

- `scripts/windows/deploy.bat`: wird zum Wrapper
- `scripts/nas-update.sh`: unverändert
- `bridge/setup.py`, Auto-Discovery: unverändert (lokaler Fallback)

## Fehlerbehandlung

- Jede Phase bricht mit klarer deutscher Fehlermeldung und Exit-Code ≠ 0 ab;
  bereits abgeschlossene Phasen werden beim erneuten Lauf einfach wiederholt
  (alle Schritte sind idempotent: scp überschreibt, schtasks `/F`, Firewall-Regel
  nur bei Fehlen anlegen)
- HTTP-Aufrufe mit Timeout und Retry (NAS-Hochfahren nach Rebuild dauert)
- SSH-Fehler unterscheiden: Host nicht erreichbar (Netz/OpenSSH) vs.
  Authentifizierung (Hinweis auf `ssh-copy-id`-Äquivalent bzw. Passworteingabe)

## Einmalige manuelle Schritte (dokumentiert in der Skript-Ausgabe)

1. OpenSSH-Server auf dem Mini-PC aktivieren (geht nur lokal)
2. Optional: SSH-Key auf Mini-PC und NAS hinterlegen, damit das Deploy ohne
   Passworteingaben durchläuft

## Tests / Verifikation

1. Trockenlauf der Konfigurationsabfrage: Defaults erscheinen, Enter übernimmt,
   `deploy.config.json` wird korrekt geschrieben
2. NAS-Phase gegen das echte NAS: Container neu gebaut, `/api/bridge/info`
   liefert API-Key und Profile
3. Mini-PC-Phase: Dateien liegen im Zielordner, generierte `config.json` sind
   valides JSON mit korrekten Werten, Scheduled Task existiert, Bridge läuft
4. Ende-zu-Ende: Bridge erscheint im AlphaTrack-UI (NAS), Bot manuell starten →
   Bot erscheint im UI, Trade-Sync funktioniert

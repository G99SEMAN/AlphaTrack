# AlphaTrack — Deploy & Test-Workflow

**Stand:** 2026-07-08

Diese Datei beschreibt, wie das AlphaTrack-Setup aus drei Rechnern zusammenspielt, wie ein vollständiger Produktions-Deploy abläuft und wie Änderungen schnell getestet werden können, ohne jedes Mal den vollen Deploy durchzuführen.

---

## 1. Systemübersicht

| Rechner | IP | Rolle |
|---|---|---|
| **NAS** | `<NAS-IP>` | Next.js-App (AlphaTrack) als Docker-Container, Port `3002`. Alle Daten als JSON in `data/`. SSH auf Port `88`. |
| **Trading-Rechner** | `<TRADING-RECHNER-IP>` | MetaTrader 5, Python-Bridge (FastAPI, Port `8765`), Trading-Bots (Port `8770+`). |
| **DevPC** | `<DEV-PC-IP>` | Entwicklung, Claude Code, Deploy-Auslösung. |

```
DevPC (Entwicklung)  ──git push──▶  GitHub  ──git pull──▶  NAS (Next.js :3002, Prod)
       │                                                         ▲
       │                                                         │ HTTP: Heartbeat/Commands/Trade-Sync
       └──sync-dev.bat──▶  NAS (Next.js :3003, Dev/Hot-Reload)    │
                                                              Trading-Rechner (Bridge :8765 ◄─WebSocket─► Bots, MT5)
```

Alle drei Rechner kommunizieren ausschließlich im lokalen Netz (gleiches Subnetz).

---

## 2. Produktions-Deploy (voller Weg)

**Wann:** Für alles, was tatsächlich live gehen soll — nach erfolgreichem Test im Dev-Container (Abschnitt 3).

```
scripts\windows\deploy.bat       # AlphaTrack (NAS) + Bridge (Trading-Rechner) deployen
scripts\windows\deploy-bot.bat   # Einzelnen Bot auf den Trading-Rechner deployen
```

Ablauf von `deploy.bat` (siehe `scripts/windows/deploy.ps1`):

1. **Konfigurationsabfrage** — NAS-Zugang, Trading-Rechner-Zugang, MT5-Login (gespeichert in `scripts/windows/deploy.config.json`, gitignored)
2. **NAS** — `git push`, `.env.local`/`BOT_API_KEY` sicherstellen, Container-Rebuild via `scripts/nas-update.sh` (`docker compose build --no-cache && up -d`), Datensicherung/-wiederherstellung von `data/` um `git reset --hard` zu überstehen
3. **Trading-Rechner** — `bridge/` + `bots/` per SSH kopieren, Configs generieren, Firewall-Regel (TCP 8765), geplante Aufgabe "AlphaTrack-Bridge" (Autostart)
4. **Check** — wartet, bis die Bridge sich beim NAS registriert hat

Dauer: mehrere Minuten (Docker-Rebuild ohne Cache). Für kleine UI-Checks zu langsam — siehe Abschnitt 3.

---

## 3. Schnelles Testen ohne vollen Deploy (Hot-Reload Dev-Container)

**Wann:** Für alles, was du erstmal nur sehen/ausprobieren willst, bevor es live geht — UI-Änderungen, kleine Fixes, Dashboard-Anpassungen.

Auf dem NAS läuft parallel zur Produktion (`:3002`, unangetastet) ein zweiter Container mit `next dev` und Bind-Mount auf **Port `3003`**, mit einer isolierten Kopie der Daten (`data-dev/`) — Schreibzugriffe im Dev-Container können also nichts an den echten Live-Daten kaputt machen.

```
scripts\windows\sync-dev.bat             # Code synchronisieren + Datenkopie von Prod auffrischen (Standard)
scripts\windows\sync-dev.bat -Rebuild    # nach Änderungen an package.json
scripts\windows\sync-dev.bat -KeepData   # Datenkopie NICHT anfassen (z.B. wenn du gerade selbst Testdaten im Dev-Container angelegt hast)
```

Aufruf: `http://<NAS-IP>:3003`

Ablauf (`scripts/windows/sync-dev.ps1`):
1. Quellcode wird als `tar.gz` gepackt (ohne `node_modules`, `.git`, `.next`, `data`)
2. Übertragung per `scp -O` (siehe Troubleshooting, Punkt 3)
3. Auf dem NAS entpackt nach `/volume1/docker/alphatrack-dev` (eigenes Verzeichnis, getrennt von Prod — ein `git reset --hard` beim Prod-Deploy überschreibt den Dev-Stand nicht)
4. `data-dev/` wird bei **jedem** Sync frisch von `data/` (Prod) kopiert — außer `-KeepData` ist gesetzt. So sind Trades/Bot-Status im Dev-Container beim Testen aktuell, ohne dass ein separater Cron-Job auf dem NAS nötig ist. `.env.local` wird nur beim allerersten Mal übernommen.
5. Container wird beim allerersten Mal gebaut (`docker compose -f docker-compose.dev.yml up -d --build`), danach reicht Sync ohne Rebuild — Next.js Fast Refresh greift automatisch über den Bind-Mount

**Wichtig:** Die Datenkopie ist damit kein Live-Feed, sondern wird bei jedem `sync-dev.bat`-Aufruf neu gezogen — nicht in Echtzeit dazwischen. Wenn du im Dev-Container selbst Daten veränderst (z.B. eine Trade-Notiz testest) und die nicht überschrieben haben willst, `-KeepData` verwenden.

`data-dev/` wird beim Refresh **in-place überschrieben** (`cp -rf`), nicht gelöscht und neu angelegt — das Verzeichnis ist live in den laufenden Container gemountet, ein `rm -rf` würde für einen Moment ein leeres `/app/data` im Container erzeugen und Requests mit `ENOENT` crashen lassen (siehe Troubleshooting, Punkt 5). Nebeneffekt: Dateien, die in Prod gelöscht wurden, bleiben in `data-dev/` liegen, bis sie manuell entfernt werden — für den Testzweck unkritisch.

**Voraussetzung (einmalig):** Passwortloser SSH-Zugriff aufs NAS.
```
scripts\windows\setup-ssh-key-nas.ps1
```
Erzeugt `%USERPROFILE%\.ssh\alphatrack_nas`. Der angezeigte Public Key muss danach einmalig per Passwort-SSH auf dem NAS eingetragen werden (Anleitung erscheint im Skript). Analog gibt es `setup-ssh-key.ps1` für den Trading-Rechner (Key: `alphatrack_deploy`, für `deploy.bat`).

Relevante Dateien:
- `Dockerfile.dev`, `docker-compose.dev.yml` (Repo-Root)
- `scripts/windows/sync-dev.ps1` / `.bat`
- `scripts/windows/sync-dev.config.json` (gitignored, analog zu `deploy.config.json`)

---

## 4. Live-Daten direkt abfragen (für Debugging, ohne Deploy/SSH)

NAS (`:3002`) und Bridge (`:8765`) haben **unauthenticated GET-Endpunkte** direkt im LAN erreichbar (`src/app/api/**` — nur POST braucht `BOT_API_KEY`). Fragen wie *"warum hatten die letzten 3 Trades keinen Stoploss?"* lassen sich direkt per `curl`/`Invoke-RestMethod` beantworten, ohne SSH oder Deploy:

```
curl -s http://<NAS-IP>:3002/api/trades
curl -s http://<NAS-IP>:3002/api/bots/trades
curl -s http://<NAS-IP>:3002/api/bots/<id>/log
curl -s http://<TRADING-RECHNER-IP>:8765/positions
curl -s http://<TRADING-RECHNER-IP>:8765/history
```

Dieses exakte Präfix-Format (`curl -s http://<NAS-IP>:3002/...` bzw. `<TRADING-RECHNER-IP>:8765/...`) lässt sich in `.claude/settings.json` als Allowlist eintragen — dann fragt Claude dafür nicht extra nach.

SSH auf das NAS/den Trading-Rechner bleibt nötig für alles, was nicht über die API läuft: rohe Logs, Configs, Dateisystem-Zugriffe.

---

## 5. Troubleshooting (bereits gelöste Stolpersteine)

1. **NAS-SSH-Key funktioniert nicht trotz korrektem `authorized_keys`** — OpenSSHs `StrictModes` lehnt Key-Auth ab, wenn das Home-Verzeichnis selbst world-/group-writable ist. Prüfen: `stat -c "%a" ~` auf dem NAS. Sollte NICHT `777` sein, sondern max. `755`. Fix: `chmod 755 ~`.
2. **`scp` schlägt fehl mit `stat local "88": No such file or directory`** — `scp` nutzt `-P` (groß) für den Port, `ssh` nutzt `-p` (klein). Nicht verwechseln.
3. **`scp` schlägt fehl mit `subsystem request failed on channel 0`** — moderne OpenSSH-Clients (9.0+) nutzen für `scp` standardmäßig SFTP; Synology DSM hat den SFTP-Dienst nicht automatisch aktiviert. Fix: `scp -O` erzwingt das alte SCP-Protokoll (kein DSM-Config-Change nötig).
4. **Erster Request an den Dev-Container braucht 30-40s** — Next.js kompiliert die Route beim ersten Aufruf nach dem Start (`✓ Compiled / in 36.2s`). Kein Fehler, danach ist es schnell.
5. **`ENOENT: .../seed/active.json -> .../data/active.json`** in den Dev-Container-Logs, sporadisch rund um einen `sync-dev.bat`-Lauf — verursacht durch `rm -rf data-dev` während der Container live weiterlief (Datenverzeichnis war kurz weg, Requests in dem Fenster crashten). Seit dem In-Place-Overwrite-Fix (`cp -rf` statt `rm -rf` + Neuanlage) tritt das nicht mehr auf.

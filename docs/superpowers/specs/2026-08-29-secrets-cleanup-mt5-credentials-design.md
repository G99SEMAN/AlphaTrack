# Secrets-Bereinigung + MT5-Credential-Handling (Vorbereitung Public-Release, Teil 1/4)

**Datum:** 2026-08-29
**Status:** Approved
**Quelle:** Nutzeranfrage "Projekt öffentlich machen" — Teilprojekt 1 von 4 (siehe Kontext)

## Kontext

AlphaTrack soll öffentlich gemacht werden (GitHub-Repo `G99SEMAN/AlphaTrack`, aktuell privat). Der Gesamtauftrag wurde in vier unabhängige Teilprojekte zerlegt, die nacheinander bearbeitet werden:

1. **Dieses Spec:** Secrets-Bereinigung + MT5-Credential-Handling (blockierend, höchste Priorität)
2. Doku-Überarbeitung (alle `.md`-Dateien aktuell halten, Entscheidung was öffentlich sichtbar ist)
3. Claude-Code-Subagenten-Setup (CEO-Agent + Fachagenten)

Bei der Bestandsaufnahme wurde festgestellt:

- **`bridge/config.json`** ist in Git getrackt und enthält im Klartext `mt5_login`, `mt5_password` und `api_key`. Getrackt seit Commit `9ce040e` ("chore: track bot and bridge config.json files for multi-device sync"), seither in 8 Commits verändert.
- **`.env.local`** ist getrackt (seit Commit `7c001d5`) und enthält `BOT_API_KEY`, `ANTHROPIC_API_KEY`, `TWELVE_DATA_API_KEY`.
- **Alle 8 aktiven Bot-Configs** (`bots/*/config.json`) sowie 4 verwaiste, nicht mehr existierende Bot-Ordner (`bots/ai-trading`, `bots/breakoutv1`, `bots/scalping`, `bots/testbot1`) enthalten denselben `api_key`-Wert `REDACTED-API-KEY` und sind/waren getrackt.
- Derselbe API-Key-String taucht zusätzlich als **Text** in Doku-Dateien auf, die erhalten bleiben sollen: `CLAUDE.md`, `README.md`, `SETUP.md`, `bots/CLAUDE.md`, `docs/BRIDGE_PROTOCOL.md`, `.claude/skills/trading-bot/SKILL.md`.
- `bridge/.gitignore` listet `config.json` bereits als ignoriert — greift aber nicht, weil die Datei vor Einführung dieser Regel eingecheckt wurde.
- `scripts/windows/deploy.config.json` und `sync-dev.config.json` (enthalten NAS/Mini-PC-SSH-Zugangsdaten) waren **nie** getrackt — hier ist nichts zu tun.
- `scripts/windows/deploy.ps1` pusht per `git push` zu GitHub; das NAS zieht den Code darüber für den Docker-Build. Ein History-Rewrite mit Force-Push macht den NAS-seitigen Checkout ungültig (divergierende Historie).
- Das Repo ist aktuell **privat** — die Geheimnisse waren noch nicht öffentlich einsehbar, müssen aber vor der Veröffentlichung aus der kompletten Historie entfernt werden, da sonst jeder alte Commits durchsuchen kann.

## Entscheidungen (mit Nutzer abgestimmt)

- Git-Historie wird bereinigt (nicht nur der aktuelle Stand) — Reihenfolge: dieses Teilprojekt zuerst, danach Doku, danach Agenten-Setup.
- MT5-Passwort gilt als kompromittiert und muss vor Veröffentlichung beim Broker geändert werden (manueller Schritt des Nutzers).
- Das bestehende Verhalten von `bridge/setup.py` (Zugangsdaten einmalig interaktiv abfragen, dauerhaft in einer lokalen, nicht getrackten `config.json` speichern) erfüllt bereits die Anforderung "nur lokal, wenn gewollt gespeichert" — es ist **keine Code-Änderung** am Credential-Handling selbst nötig, nur der Git-Tracking-Fix.
- SSH-Zugriff auf das NAS ist eingerichtet — der NAS-seitige Git-Zustand wird nach dem Force-Push automatisiert repariert.
- Der neue `BOT_API_KEY` wird zufällig generiert (kryptographisch, z.B. `secrets.token_hex(32)`), nicht manuell vom Nutzer vorgegeben.

## 1. Sofort-Fix im Arbeitsverzeichnis (vor der Historie-Bereinigung)

- `git rm --cached` für: `bridge/config.json`, alle 8 `bots/*/config.json`, `.env.local`
- `.gitignore` (Root) ergänzen um `bots/*/config.json` (analog zu `bridge/.gitignore`, das `config.json` bereits listet) und um `.env*` mit expliziter Ausnahme `!.env.example`
- Neue Platzhalter-Templates anlegen, die eingecheckt bleiben:
  - `bridge/config.example.json` — Struktur von `bridge/setup.py`s `DEFAULTS`, aber mit leeren/Platzhalter-Werten für `mt5_login`, `mt5_password`, `mt5_server`, `api_key`
  - `bots/<bot>/config.example.json` je aktivem Bot — gleiche Struktur wie die jeweilige aktuelle `config.json`, aber `api_key` und alle IP/URL-Felder durch Platzhalter ersetzt
  - `.env.example` prüfen und ggf. bereinigen, sodass dort nur Platzhalter stehen (kein reales Schlüsselmaterial)

## 2. Git-Historie bereinigen (`git-filter-repo`)

- `git-filter-repo` installieren (aktuell nicht vorhanden; Installation via `pip install git-filter-repo` unter Python, das im Projekt bereits für die Bridge genutzt wird)
- **Pfad-Entfernung** aus der gesamten Historie (alle 373 Commits): `bridge/config.json`, `bots/*/config.json` für alle aktiven UND verwaisten Bot-Ordner (`ai-trading`, `bb-squeeze-gbpjpy`, `breakoutv1`, `fvg-gbpjpy`, `fvg-gbpusd`, `londonopenv1`, `pricemonitor`, `scalping`, `scalpingv1`, `testbot1`, `testbot2`, `volscalp-gbpjpy`), `.env.local`
- **Text-Ersetzung** (`--replace-text`) für den API-Key-String `REDACTED-API-KEY` → `<REDACTED-API-KEY>` in allen verbleibenden Commits, damit die Doku-Dateien strukturell erhalten bleiben, aber kein echtes Schlüsselmaterial mehr enthalten
- Vor dem Rewrite: lokales Backup-Bundle der aktuellen Historie erstellen (`git bundle create`), damit ein Fehlschlag rückholbar ist
- Nach dem Rewrite: `git push --force-with-lease` zu `origin`

## 3. NAS-Git-Zustand reparieren

- Nach dem Force-Push per SSH auf das NAS verbinden (Zugangsdaten/Setup laut `docs/DEPLOYMENT.md`)
- Divergierenden Checkout auflösen: `git fetch origin` + `git reset --hard origin/main` im NAS-Projektverzeichnis (Neuklon nur falls das nicht sauber greift, z.B. bei lokalen Änderungen auf dem NAS)
- Verifizieren, dass der nächste reguläre Deploy (`git push` aus `deploy.ps1`) wieder funktioniert

## 4. Credential-Rotation

Automatisierbar (durch mich, in lokalen/gitignorten Dateien):
- Neuen `BOT_API_KEY` per `secrets.token_hex(32)` generieren
- In `bridge/config.json` (lokal), allen `bots/*/config.json` (lokal) und `.env.local` (lokal) synchron einsetzen

Nicht automatisierbar (durch den Nutzer):
- MT5-Passwort beim Broker (BlackBullMarkets-Demo) ändern, neues Passwort danach in `bridge/config.json` eintragen (via `bridge/setup.py` oder manuell)
- `ANTHROPIC_API_KEY` / `TWELVE_DATA_API_KEY` bei Anthropic/Twelve Data rotieren (vorsorglich, da `.env.local` in einem Commit sichtbar war), neue Werte danach in `.env.local` eintragen

## Nicht im Scope

- Keine Änderung am Verhalten von `bridge/setup.py` / `mt5_connector.py` (kein In-Memory-only-Modus, kein OS-Credential-Store) — bestätigt als ausreichend
- Keine Bereinigung von `data/*.json` (enthält nur Demo-Profil-Daten, keine Geheimnisse)
- Keine Änderung an `scripts/windows/deploy.config.json` / `sync-dev.config.json` (waren nie getrackt, bereits korrekt behandelt)
- Doku-Inhalte und Claude-Agenten-Setup sind eigene Teilprojekte (2 und 3), nicht Teil dieses Specs — hier wird nur die Text-Ersetzung des API-Keys in bestehenden Doku-Dateien vorgenommen, keine inhaltliche Überarbeitung

## Risiken / Rollback

- **Force-Push ist irreversibel für andere Klone.** Da es ein Solo-Projekt mit einem bekannten zweiten Checkout (NAS) ist, wird dieser gezielt repariert (Schritt 3). Sollte danach doch ein Problem auffallen, existiert das lokale Backup-Bundle aus Schritt 2 zur Wiederherstellung.
- Nach der Rotation müssen alle lokal laufenden Bots und die Bridge neu gestartet werden, damit sie den neuen `BOT_API_KEY` verwenden (sonst schlägt die Authentifizierung gegen AlphaTrack fehl).

## Testing / Verifikation

- `git ls-files | grep -E "config\.json|\.env"` zeigt nach dem Fix nur noch `.env.example` und `*.config.example.json`
- `git log --all -p -S "REDACTED-API-KEY"` liefert nach dem History-Rewrite keine Treffer mehr
- `git log --all --diff-filter=A --name-only | grep -E "bridge/config.json|bots/.*/config.json|^\.env\.local$"` liefert keine Treffer mehr
- Bridge + mindestens ein Bot lokal neu starten und verifizieren, dass sie sich mit neuem `BOT_API_KEY` erfolgreich bei AlphaTrack authentifizieren (Heartbeat kommt an)
- NAS-Deploy (`scripts\windows\deploy.bat`) einmal komplett durchlaufen lassen, um den reparierten Git-Zustand zu bestätigen

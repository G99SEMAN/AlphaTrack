# Secrets-Bereinigung + MT5-Credential-Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Passwörter/API-Keys aus dem getrackten Repo-Stand UND der gesamten Git-Historie entfernen, die betroffenen Geheimnisse rotieren, und den NAS-Deploy-Pfad nach dem History-Rewrite wieder funktionsfähig machen — als Voraussetzung für die Veröffentlichung des Repos.

**Architecture:** `git rm --cached` + `.gitignore`-Härtung für den aktuellen Stand, `git-filter-repo` für die komplette Historie (Pfad-Entfernung für reine Credential-Dateien, Text-Ersetzung für den API-Key-String in Doku-Dateien), Force-Push, danach gezielte Reparatur des einzigen weiteren Git-Checkouts (NAS). Rotation läuft über die bestehende Deploy-Infrastruktur (NAS-`.env.local` ist die Quelle der Wahrheit für `BOT_API_KEY`, `deploy.config.json` für MT5-Daten), nicht über manuelle Bearbeitung einzelner Config-Dateien.

**Tech Stack:** Git, `git-filter-repo` (Python), PowerShell (`deploy.ps1`), Bash (`nas-update.sh`), SSH/SCP

**Spec:** `docs/superpowers/specs/2026-08-29-secrets-cleanup-mt5-credentials-design.md`

## Global Constraints

- Kein Code-Change an `bridge/setup.py` / `bridge/mt5_connector.py` — das bestehende "einmal abfragen, lokal speichern"-Verhalten ist bereits ausreichend.
- `.env`-Dateien sind für den Agenten über die `Read`-Tool-Deny-Liste in `.claude/settings.json` gesperrt (`Read(./.env)`, `Read(./.env.*)`). Jede Änderung an `.env.local` erfolgt ausschließlich über Bash/SSH-Befehle (z.B. `sed`), niemals über Read/Edit/Write auf diesen Pfad.
- Force-Push ist für dieses Solo-Repo freigegeben (mit Nutzer abgestimmt). Das NAS ist der einzige weitere Git-Checkout und muss nach dem Rewrite repariert werden. Der Mini-PC nutzt kein Git (Tar+SCP-Deploy), ist also nicht betroffen.
- Neuer `BOT_API_KEY` wird kryptographisch zufällig generiert (`secrets.token_hex(32)`), nicht manuell vorgegeben.
- `scripts/windows/deploy.config.json` und `sync-dev.config.json` waren nie getrackt — hier ist keine Git-Aktion nötig, nur eine manuelle Werteaktualisierung nach der MT5-Passwortänderung (Task 6).
- Alle Pfad- und Hostangaben in diesem Plan sind aus dem tatsächlichen Repo-Stand entnommen (`scripts/windows/deploy.config.json`, `scripts/nas-update.sh`, `scripts/windows/deploy.ps1`) — NAS: `G99SEMAN@192.168.178.3`, Port `88`, Projektverzeichnis `/volume1/docker/alphatrack`.

---

### Task 1: Secrets aus dem aktuellen Stand entfernen + `.gitignore` härten + Templates anlegen

**Files:**
- Modify: `.gitignore` (Root)
- Create: `bridge/config.example.json`
- Create: `bots/bb-squeeze-gbpjpy/config.example.json`, `bots/fvg-gbpjpy/config.example.json`, `bots/fvg-gbpusd/config.example.json`, `bots/londonopenv1/config.example.json`, `bots/pricemonitor/config.example.json`, `bots/scalpingv1/config.example.json`, `bots/testbot2/config.example.json`, `bots/volscalp-gbpjpy/config.example.json`
- Modify (untrack, Datei bleibt lokal liegen): `bridge/config.json`, `bots/bb-squeeze-gbpjpy/config.json`, `bots/fvg-gbpjpy/config.json`, `bots/fvg-gbpusd/config.json`, `bots/londonopenv1/config.json`, `bots/pricemonitor/config.json`, `bots/scalpingv1/config.json`, `bots/testbot2/config.json`, `bots/volscalp-gbpjpy/config.json`, `.env.local`

**Interfaces:**
- Produces: Arbeitsverzeichnis, in dem `git status` keine der oben genannten Credential-Dateien mehr als getrackt zeigt; `*.example.json`-Templates sind neu getrackt.

- [ ] **Step 1: Ist-Zustand vor der Änderung festhalten**

```bash
git ls-files | grep -E "config\.json$|^\.env" | sort
```
Erwartet: `.env.example`, `.env.local`, `bridge/config.json`, sowie 8 `bots/*/config.json`.

- [ ] **Step 2: Dateien aus dem Git-Tracking nehmen (bleiben lokal auf der Platte erhalten)**

```bash
git rm --cached bridge/config.json .env.local \
  bots/bb-squeeze-gbpjpy/config.json \
  bots/fvg-gbpjpy/config.json \
  bots/fvg-gbpusd/config.json \
  bots/londonopenv1/config.json \
  bots/pricemonitor/config.json \
  bots/scalpingv1/config.json \
  bots/testbot2/config.json \
  bots/volscalp-gbpjpy/config.json
```

- [ ] **Step 3: Root-`.gitignore` härten**

Ergänze am Ende der Datei (nach dem Abschnitt "env files"):

```gitignore
# secrets - niemals tracken (siehe docs/superpowers/specs/2026-08-29-secrets-cleanup-mt5-credentials-design.md)
.env*
!.env.example
bots/*/config.json
```

Entferne dabei die auskommentierte Zeile `# .env*` (Kommentarblock "env files - tracked intentionally (private repo only!)") — sie ist mit der neuen Regel widersprüchlich und veraltet.

- [ ] **Step 4: `bridge/config.example.json` anlegen**

Struktur exakt aus `bridge/setup.py`s `DEFAULTS`-Dict übernommen, mit sprechenden Platzhaltern statt echten Werten:

```json
{
  "alphatrack_url": "http://<nas-ip>:3000",
  "api_key": "",
  "bridge_id": "",
  "bridge_name": "",
  "bridge_version": "1.0.0",
  "profile_id": "",
  "heartbeat_interval_sec": 5,
  "trade_sync_interval_sec": 30,
  "command_server_port": 8765,
  "mt5_login": 0,
  "mt5_password": "",
  "mt5_server": "",
  "symbols_to_watch": ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"],
  "mt5_exe_path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
  "mt5_restart_wait_sec": 10,
  "mt5_restart_max_attempts": 3,
  "mt5_startup_wait_sec": 15,
  "sync_mode": "full",
  "sync_cutoff_timestamp": 0
}
```

- [ ] **Step 5: `bots/*/config.example.json` generieren (ein Skript, einmalig ausgeführt, nicht Teil des Repos)**

Lege im Scratchpad-Verzeichnis eine Datei `generate_bot_examples.py` mit folgendem Inhalt an:

```python
import json
import glob
import os

ACTIVE_BOT_CONFIGS = [
    "bots/bb-squeeze-gbpjpy/config.json",
    "bots/fvg-gbpjpy/config.json",
    "bots/fvg-gbpusd/config.json",
    "bots/londonopenv1/config.json",
    "bots/pricemonitor/config.json",
    "bots/scalpingv1/config.json",
    "bots/testbot2/config.json",
    "bots/volscalp-gbpjpy/config.json",
]

for path in ACTIVE_BOT_CONFIGS:
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["api_key"] = ""
    cfg["alphatrack_url"] = "http://<nas-ip>:3000"
    if "bridge_url" in cfg:
        cfg["bridge_url"] = "http://<mini-pc-ip>:8765"
    cfg["profile_id"] = ""
    example_path = os.path.join(os.path.dirname(path), "config.example.json")
    with open(example_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print(f"-> {example_path}")
```

Ausführen (vom Repo-Root aus, damit die relativen Pfade stimmen):

```bash
python "<scratchpad>/generate_bot_examples.py"
```

Erwartete Ausgabe: 8 Zeilen `-> bots/<bot>/config.example.json`.

- [ ] **Step 6: Verifizieren, dass keine Secrets mehr in den neuen Beispiel-Dateien stehen**

```bash
grep -rl "REDACTED-API-KEY" bridge/config.example.json bots/*/config.example.json
```
Erwartet: kein Treffer (leere Ausgabe, Exit-Code 1).

- [ ] **Step 7: Getrackte Dateien final prüfen**

```bash
git add .gitignore bridge/config.example.json bots/*/config.example.json
git status --short
```
Erwartet: `.gitignore` modifiziert, 9 neue `config.example.json`-Dateien als `A` (added), die 10 Original-Configs als `D` (deleted from index, aber lokal noch vorhanden — mit `ls bridge/config.json` gegenprüfen).

- [ ] **Step 8: Commit**

```bash
git commit -m "$(cat <<'EOF'
security: untrack MT5/API credentials, add example config templates

bridge/config.json, alle bots/*/config.json und .env.local enthielten
echte Zugangsdaten im Klartext und waren getrackt. Dateien bleiben lokal
erhalten, werden aber nicht mehr versioniert. Neue *.example.json-
Templates zeigen die erwartete Struktur ohne echte Werte.

Vorbereitung fuer Git-History-Bereinigung (naechster Task) und
oeffentliches Repo.
EOF
)"
```

---

### Task 2: `git-filter-repo` installieren + Backup + Hilfsdateien

**Files:**
- Create (Scratchpad, nicht im Repo): `paths-to-remove.txt`, `replace-text.txt`
- Create (außerhalb des Repos): Backup-Bundle der aktuellen Historie

**Interfaces:**
- Consumes: keine
- Produces: lauffähiges `git filter-repo`-Kommando; `paths-to-remove.txt` mit allen zu entfernenden Pfaden (inkl. verwaister Bot-Ordner); `replace-text.txt` mit der Redaction-Regel für den API-Key-String; Backup-Bundle als Rollback-Sicherheitsnetz.

- [ ] **Step 1: Backup-Bundle der kompletten aktuellen Historie erstellen**

```bash
git bundle create "$HOME/alphatrack-pre-filter-repo-backup.bundle" --all
```

- [ ] **Step 2: Bundle verifizieren**

```bash
git bundle verify "$HOME/alphatrack-pre-filter-repo-backup.bundle"
```
Erwartet: `The bundle records a complete history` (oder äquivalente Erfolgsmeldung), kein Fehler.

- [ ] **Step 3: `git-filter-repo` installieren**

```powershell
python -m ensurepip --upgrade
python -m pip install --user git-filter-repo
```

- [ ] **Step 4: Installation verifizieren**

```powershell
git filter-repo --version
```
Erwartet: eine Versionsnummer (z.B. `git-filter-repo 2.x.x`).

Falls stattdessen `git: 'filter-repo' is not a git command` erscheint, PATH für die Session ergänzen und erneut prüfen:

```powershell
$scriptsDir = python -c "import site, os; print(os.path.join(site.getuserbase(), 'Scripts'))"
$env:PATH = "$scriptsDir;$env:PATH"
git filter-repo --version
```

- [ ] **Step 5: Pfad-Liste für die Entfernung anlegen**

Datei `<scratchpad>/paths-to-remove.txt`:

```
bridge/config.json
.env.local
bots/ai-trading/config.json
bots/bb-squeeze-gbpjpy/config.json
bots/breakoutv1/config.json
bots/fvg-gbpjpy/config.json
bots/fvg-gbpusd/config.json
bots/londonopenv1/config.json
bots/pricemonitor/config.json
bots/scalping/config.json
bots/scalpingv1/config.json
bots/testbot1/config.json
bots/testbot2/config.json
bots/volscalp-gbpjpy/config.json
```

- [ ] **Step 6: Text-Ersetzungsregel für den API-Key anlegen**

Datei `<scratchpad>/replace-text.txt`:

```
REDACTED-API-KEY==>REDACTED-API-KEY
```

---

### Task 3: Git-Historie bereinigen

**Files:** keine Repo-Dateien direkt (wirkt auf die gesamte `.git`-Historie)

**Interfaces:**
- Consumes: `paths-to-remove.txt`, `replace-text.txt` aus Task 2; Backup-Bundle als Rollback-Option
- Produces: umgeschriebene lokale Historie (alle Commit-Hashes ändern sich); `origin`-Remote wird von `git-filter-repo` automatisch entfernt (Sicherheitsmechanismus des Tools)

**Wichtig:** Dieser Task setzt voraus, dass Task 1 bereits committet ist — die Credential-Dateien müssen zum Zeitpunkt des Rewrites bereits aus dem Index entfernt sein, sonst würde `git-filter-repo`s abschließender Checkout versuchen, sie aus dem Arbeitsverzeichnis zu löschen (sie sind aber lokal noch mit echten, noch nicht rotierten Werten nötig).

- [ ] **Step 1: Ausgangszustand für die spätere Verifikation dokumentieren**

```bash
git log --all --oneline -- bridge/config.json .env.local | wc -l
git log --all -p -S "REDACTED-API-KEY" --oneline | grep -cE "^[0-9a-f]{7,} "
```
Notiere beide Zahlen (aus der Bestandsaufnahme bekannt: 8 bzw. ~17 Commits).

- [ ] **Step 2: `git-filter-repo` ausführen (vom Repo-Root aus)**

```bash
git filter-repo --force \
  --invert-paths --paths-from-file "<scratchpad>/paths-to-remove.txt" \
  --replace-text "<scratchpad>/replace-text.txt"
```

- [ ] **Step 3: `origin`-Remote wieder hinzufügen**

`git-filter-repo` entfernt `origin` automatisch als Sicherheitsmaßnahme gegen versehentliches Pushen/Fetchen mit veralteten Refs.

```bash
git remote add origin https://github.com/G99SEMAN/AlphaTrack.git
```

- [ ] **Step 4: Verifizieren — keine der Credential-Pfade mehr in der Historie**

```bash
git log --all --diff-filter=A --name-only --pretty=format: \
  | grep -E "^bridge/config\.json$|^\.env\.local$|^bots/.*/config\.json$" \
  | sort -u
```
Erwartet: keine Ausgabe.

- [ ] **Step 5: Verifizieren — API-Key-String nicht mehr in der Historie**

```bash
git log --all -p -S "REDACTED-API-KEY" --oneline
```
Erwartet: keine Ausgabe.

- [ ] **Step 6: Verifizieren — Doku-Dateien existieren weiterhin mit redigiertem Platzhalter**

```bash
git grep -l "REDACTED-API-KEY" HEAD -- CLAUDE.md README.md SETUP.md bots/CLAUDE.md docs/BRIDGE_PROTOCOL.md .claude/skills/trading-bot/SKILL.md
```
Erwartet: alle 6 Dateien werden gelistet.

- [ ] **Step 7: Lokalen Arbeitsstand prüfen — Credential-Dateien noch vorhanden (nicht von Git gelöscht)**

```bash
ls bridge/config.json .env.local bots/scalpingv1/config.json
```
Erwartet: alle drei Dateien existieren weiterhin mit ihrem bisherigen Inhalt (unrotiert, das folgt in Task 5/6).

---

### Task 4: Force-Push + NAS-Git-Zustand reparieren

**Files:** keine Repo-Dateien (Remote-Operation)

**Interfaces:**
- Consumes: umgeschriebene lokale Historie aus Task 3
- Produces: `origin/main` auf GitHub entspricht der bereinigten Historie; NAS-Checkout unter `/volume1/docker/alphatrack` ist wieder synchron und der Container läuft mit intaktem `.env.local`

- [ ] **Step 1: Aktuellen Stand von `origin` holen (für `--force-with-lease`)**

```bash
git fetch origin
```

- [ ] **Step 2: Bereinigte Historie zu GitHub pushen**

```bash
git push --force-with-lease origin main
git push --force origin --tags
```

- [ ] **Step 3: Push verifizieren**

```bash
gh api repos/G99SEMAN/AlphaTrack/commits/main --jq '.sha'
git rev-parse main
```
Erwartet: beide Hashes stimmen überein.

- [ ] **Step 4: Per SSH auf das NAS verbinden und `.env.local` sichern (BEVOR der Reset läuft)**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "cp /volume1/docker/alphatrack/.env.local /tmp/alphatrack-env-local-backup"
```
Erwartet: kein Fehler (Datei existiert und wurde kopiert).

- [ ] **Step 5: NAS-Update-Skript ausführen (holt neue Historie, baut Container neu)**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "bash /volume1/docker/alphatrack/scripts/nas-update.sh"
```
Erwartet: Skript durchläuft alle 5 Schritte ohne Fehler, Container startet. `.env.local` fehlt an dieser Stelle noch (wird im nächsten Schritt wiederhergestellt), daher können in den Container-Logs kurzzeitig Warnungen zu fehlenden Env-Vars auftauchen — das ist zu diesem Zeitpunkt erwartet.

- [ ] **Step 6: `.env.local` auf dem NAS wiederherstellen und Container neu starten**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "cp /tmp/alphatrack-env-local-backup /volume1/docker/alphatrack/.env.local && cd /volume1/docker/alphatrack && sudo docker compose restart"
```

- [ ] **Step 7: Verifizieren, dass die App wieder erreichbar ist**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.178.3:3002/dashboard
```
Erwartet: `200`

- [ ] **Step 8: Verifizieren, dass `.env.local` auf dem NAS nach dem nächsten `git status` als unversioniert (nicht mehr getrackt) erscheint**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "cd /volume1/docker/alphatrack && git status --short .env.local"
```
Erwartet: `??  .env.local` (untracked) — nicht leer, nicht `M` (modified/tracked).

---

### Task 5: `BOT_API_KEY` rotieren

**Files:** keine Repo-Dateien (NAS-`.env.local`, lokal)

**Interfaces:**
- Consumes: funktionierenden NAS-Checkout aus Task 4
- Produces: neuer `BOT_API_KEY`-Wert in NAS-`.env.local`; wird beim nächsten Deploy-Lauf (Task 7) automatisch an `bridge/config.json` und alle `bots/*/config.json` auf dem Mini-PC weitergereicht (siehe `Write-RemoteConfigs` in `scripts/windows/deploy.ps1:333-357`, die den Key live aus dem NAS-`.env.local` liest)

**Hinweis:** Zwischen diesem Task und dem Deploy-Lauf in Task 7 verlieren Bridge und Bots auf dem Mini-PC kurzzeitig die Authentifizierung gegen AlphaTrack (sie senden noch den alten Key). Das ist erwartet und wird durch Task 7 behoben.

- [ ] **Step 1: Neuen Key generieren**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Notiere den Wert (im Folgenden `<NEW_KEY>`).

- [ ] **Step 2: Key in NAS-`.env.local` ersetzen**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "sed -i 's/^BOT_API_KEY=.*/BOT_API_KEY=<NEW_KEY>/' /volume1/docker/alphatrack/.env.local"
```

- [ ] **Step 3: Verifizieren, dass die Zeile ersetzt wurde (ohne den vollen Dateiinhalt auszugeben)**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "grep -c '^BOT_API_KEY=<NEW_KEY>$' /volume1/docker/alphatrack/.env.local"
```
Erwartet: `1`

- [ ] **Step 4: Container neu starten, damit die App den neuen Wert liest**

```bash
ssh -p 88 G99SEMAN@192.168.178.3 "cd /volume1/docker/alphatrack && sudo docker compose restart"
```

---

### Task 6: Manuelle Credential-Rotation (Nutzeraktion erforderlich)

Diese Schritte können nicht automatisiert werden, da sie Aktionen bei externen Anbietern (Broker, Anthropic, Twelve Data) erfordern. Als Checkliste für dich:

- [ ] **MT5-Passwort ändern:** Im MetaTrader-5-Terminal bzw. beim Broker (BlackBullMarkets-Demo) das Passwort für die betroffenen Konten ändern. Aus der Bestandsaufnahme sind zwei Kontonummern mit demselben Passwort `REDACTED-MT5-PASSWORD` bekannt: `REDACTED-MT5-LOGIN` (aus `bridge/config.json`, evtl. veraltet) und `REDACTED-MT5-LOGIN` (aus `scripts/windows/deploy.config.json`, aktueller Deploy-Wert). Prüfe, welches der beiden Konten aktuell tatsächlich genutzt wird, und ändere dessen Passwort.
- [ ] **Neues MT5-Passwort in `scripts/windows/deploy.config.json` eintragen** (Feld `mt5_password`) — Datei ist lokal, nie getrackt, du kannst sie direkt bearbeiten oder mir den neuen Wert nennen, damit ich es für dich einträge.
- [ ] **`ANTHROPIC_API_KEY` rotieren:** Neuen Key in der Anthropic Console erzeugen, alten widerrufen.
- [ ] **`TWELVE_DATA_API_KEY` rotieren:** Neuen Key im Twelve-Data-Dashboard erzeugen, alten widerrufen.
- [ ] **Beide neuen Keys in NAS-`.env.local` eintragen** — sag mir die neuen Werte, dann führe ich das analog zu Task 5, Step 2-4 per SSH aus (`sed`-Ersetzung + Container-Neustart), ohne dass die Werte im Klartext in einer von mir lesbaren Repo-Datei landen.

---

### Task 7: End-to-End-Verifikation

**Files:** keine (nur Verifikation)

**Interfaces:**
- Consumes: Ergebnisse aller vorherigen Tasks
- Produces: Bestätigung, dass Repo, NAS und Mini-PC nach der Bereinigung + Rotation konsistent funktionieren

- [ ] **Step 1: Getrackte Dateien final prüfen**

```bash
git ls-files | grep -E "config\.json$|^\.env"
```
Erwartet: nur `.env.example`, `bridge/config.example.json`, `bots/*/config.example.json`.

- [ ] **Step 2: Vollständigen Deploy durchlaufen lassen (propagiert neuen `BOT_API_KEY` + rotiertes MT5-Passwort an den Mini-PC)**

```
scripts\windows\deploy.bat
```
Erwartet: alle Schritte (Git-Push, NAS-Update, Mini-PC-Bridge-Config, Bot-Configs) laufen ohne Fehler durch.

- [ ] **Step 3: Bridge-Erreichbarkeit auf dem Mini-PC prüfen**

```bash
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://192.168.178.37:8765/health
```
Erwartet: `200`

- [ ] **Step 4: Heartbeat/Bot-Status in AlphaTrack prüfen**

Über den `run-alphatrack`-Skill die `/bots`-Seite screenshotten oder `/api/bots`-Status abfragen und bestätigen, dass Bridge und mindestens ein Bot als `connected` angezeigt werden (neuer Heartbeat jünger als 45s).

- [ ] **Step 5: Bestätigen, dass das lokale Backup-Bundle weiterhin vorhanden ist (Rollback-Sicherheit bleibt erhalten)**

```bash
ls -la "$HOME/alphatrack-pre-filter-repo-backup.bundle"
```

Nach erfolgreicher Verifikation ist dieses Teilprojekt abgeschlossen. Teilprojekte 2 (Doku-Überarbeitung) und 3 (Claude-Agenten-Setup) werden anschließend separat brainstormt.

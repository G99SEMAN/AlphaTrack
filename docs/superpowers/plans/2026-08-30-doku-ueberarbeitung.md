# Doku-Überarbeitung für Public-Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repo-Komposition und öffentlich sichtbare Dokumentation für den Public-Release vorbereiten: interne KI-Arbeitsartefakte aus dem Tracking entfernen, eine Lizenz ergänzen, veraltete/irreführende Textstellen korrigieren, und echte Screenshots ins README einbinden.

**Architecture:** `git rm --cached` + `.gitignore`-Härtung für interne Arbeitsverzeichnisse (analog zu Teilprojekt 1). Gezielte Text-Edits an bestehenden, bereits guten Dokumenten statt Neuschreiben. Screenshots über den bestehenden `run-alphatrack`-Skill gegen den laufenden Dev-Server.

**Tech Stack:** Git, Markdown, `run-alphatrack`-Skill (Playwright-Treiber)

**Spec:** `docs/superpowers/specs/2026-08-30-doku-ueberarbeitung-design.md`

## Global Constraints

- `data/` selbst bleibt technisch unverändert getrackt — nur die README-Doku-Aussage darüber wird korrigiert (siehe Task 2). Kein Task entfernt `data/*.json` aus dem Tracking.
- `.claude/skills/*/SKILL.md` und `.claude/agents/*.md` werden NICHT verändert — explizit außerhalb des Scopes, auch wenn `.claude/skills/trading-bot/SKILL.md` denselben `REDACTED-API-KEY`-Platzhalter enthält wie die 5 Dateien in Task 3.
- `TODO.md` bleibt unverändert (aktuell leer, das ist so gewollt).
- Kein Task ändert `bots/*/strategy.md` inhaltlich.
- Alle Datei-Untracking-Schritte folgen dem in Teilprojekt 1 etablierten Muster: `git rm --cached`, Datei bleibt lokal erhalten, `.gitignore` ergänzen, dann committen.

---

### Task 1: Repo-Komposition bereinigen — interne KI-Arbeitsartefakte untracken

**Files:**
- Modify: `.gitignore` (Root)
- Modify (untrack, bleibt lokal erhalten): `.planning/**` (82 Dateien), `docs/superpowers/plans/**` + `docs/superpowers/specs/**` (27 Dateien, inkl. dieses Plans und Specs selbst), `.claude/worktrees/wave-manifest.json`

**Interfaces:**
- Produces: Arbeitsverzeichnis, in dem `git ls-files` keine der drei genannten Pfade mehr zeigt; alle Dateien bleiben lokal vorhanden.

- [ ] **Step 1: Ist-Zustand festhalten**

```bash
git ls-files | grep -E "^\.planning/|^docs/superpowers/|^\.claude/worktrees/" | wc -l
```
Erwartet: `110` (82 + 27 + 1).

- [ ] **Step 2: Verzeichnisse aus dem Git-Tracking nehmen**

```bash
git rm -r --cached .planning docs/superpowers .claude/worktrees/wave-manifest.json
```

- [ ] **Step 3: Root-`.gitignore` ergänzen**

Am Ende der Datei anfügen:

```gitignore
# interne KI-Arbeitsartefakte - nicht fuer oeffentliches Repo (siehe docs/superpowers/specs/2026-08-30-doku-ueberarbeitung-design.md)
/.planning/
/docs/superpowers/
/.claude/worktrees/
```

- [ ] **Step 4: Verifizieren**

```bash
git status --short | grep -E "^ D \.planning/|^ D docs/superpowers/|^ D \.claude/worktrees/" | wc -l
ls .planning/PROJECT.md docs/superpowers/specs/2026-08-30-doku-ueberarbeitung-design.md .claude/worktrees/wave-manifest.json
```
Erwartet: erste Zeile `110` (als `D`/deleted-from-index markiert), zweiter Befehl zeigt alle drei Dateien weiterhin vorhanden auf der Platte.

- [ ] **Step 5: Commit**

```bash
git add -A .gitignore .planning docs/superpowers .claude/worktrees
git commit -m "$(cat <<'EOF'
docs: untrack internal AI work artifacts from public repo

.planning/, docs/superpowers/ (plans+specs) und die verwaiste
.claude/worktrees/wave-manifest.json sind interne Entwicklungsartefakte
ohne Doku-Wert fuer Dritte. Bleiben lokal erhalten, werden aber nicht
mehr versioniert.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

---

### Task 2: LICENSE hinzufügen + README-Lizenz-/Datenspeicherung-Text korrigieren

**Files:**
- Create: `LICENSE`
- Modify: `README.md`

**Interfaces:**
- Produces: `LICENSE`-Datei mit validem MIT-Text; `README.md` mit korrektem Lizenz-Hinweis (statt "privates Projekt") und korrigierter Datenspeicherung-Aussage.

- [ ] **Step 1: `LICENSE` anlegen**

```
MIT License

Copyright (c) 2026 G99SEMAN

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Lizenz-Badge in `README.md` ergänzen**

In `README.md:9-12` (Badge-Zeile), nach dem Docker-Badge (Zeile 12) einfügen:

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
```

- [ ] **Step 3: „Lizenz"-Abschnitt am Ende von `README.md` ersetzen**

Aktueller Inhalt (`README.md:426-428`):
```markdown
## Lizenz

Copyright (c) G99SEMAN - Privates Projekt, nicht für öffentliche Verbreitung vorgesehen.
```

Ersetzen durch:
```markdown
## Lizenz

MIT License — siehe [LICENSE](LICENSE). Copyright (c) 2026 G99SEMAN.
```

- [ ] **Step 4: „Datenspeicherung"-Abschnitt korrigieren**

Aktueller Satz (`README.md:285`):
```markdown
> Der `data/`-Ordner ist bewusst in Git getrackt (privates Repo, Multi-Device-Sync). Handelsdaten bleiben ausschliesslich im privaten Repository.
```

Ersetzen durch:
```markdown
> Der `data/`-Ordner ist bewusst in Git getrackt (Multi-Device-Sync ohne separate Datenbank). Die hier enthaltenen Daten sind ein Demo-Profil ohne echte Trades. **Wenn du AlphaTrack für deine eigenen, echten Trades nutzt, halte deinen Fork/deine Kopie privat** — sonst werden deine Handelsdaten bei jedem `git push` öffentlich sichtbar.
```

- [ ] **Step 5: Verifizieren**

```bash
grep -c "MIT" README.md LICENSE
grep -c "nicht für öffentliche Verbreitung" README.md
```
Erwartet: erste Zeile zeigt Treffer in beiden Dateien (>0), zweite Zeile `0` (alter Text vollständig ersetzt).

- [ ] **Step 6: Commit**

```bash
git add LICENSE README.md
git commit -m "$(cat <<'EOF'
docs: add MIT LICENSE, correct README license + data-storage claims

README behauptete noch "privates Projekt, nicht fuer oeffentliche
Verbreitung" und "Handelsdaten bleiben ausschliesslich im privaten
Repository" - beides nach der Veroeffentlichung falsch/irrefuehrend.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

---

### Task 3: Platzhalter-Bereinigung — `REDACTED-API-KEY` in 5 Dateien

**Files:**
- Modify: `README.md:189`, `CLAUDE.md:131`, `bots/CLAUDE.md:118`, `docs/BRIDGE_PROTOCOL.md:605`, `SETUP.md:44`

**Interfaces:**
- Consumes: keine
- Produces: alle 5 Dateien zeigen einen sprechenden Platzhalter (`<dein-api-key>`) statt des Redaktions-Artefakts `REDACTED-API-KEY`, das wie ein technischer Fehler aussieht statt wie eine bewusste Doku-Konvention.

**Hinweis:** `.claude/skills/trading-bot/SKILL.md:184` enthält denselben String, wird aber laut Global Constraints NICHT verändert (außerhalb des Scopes).

- [ ] **Step 1: Ist-Zustand festhalten**

```bash
grep -n "REDACTED-API-KEY" README.md CLAUDE.md bots/CLAUDE.md docs/BRIDGE_PROTOCOL.md SETUP.md
```
Erwartet: genau 5 Treffer, einer pro Datei, jeweils in einer Zeile der Form `BOT_API_KEY=REDACTED-API-KEY` (`.md`-Dateien) bzw. `"api_key": "REDACTED-API-KEY"` (JSON-Beispiele in `bots/CLAUDE.md` und `docs/BRIDGE_PROTOCOL.md`).

- [ ] **Step 2: In `README.md:189` und `SETUP.md` ersetzen (env-Beispiel-Kontext)**

In beiden Dateien die Zeile

```
BOT_API_KEY=REDACTED-API-KEY   # muss mit bridge/config.json übereinstimmen
```

ersetzen durch

```
BOT_API_KEY=<dein-api-key>   # muss mit bridge/config.json übereinstimmen
```

(In `README.md:189` fehlt der Kommentarteil in der aktuellen Zeile — dort nur `BOT_API_KEY=REDACTED-API-KEY` zu `BOT_API_KEY=<dein-api-key>` ändern, restliche Zeile unverändert lassen.)

- [ ] **Step 3: In `CLAUDE.md:131` ersetzen (env-Beispiel-Kontext)**

```
BOT_API_KEY=REDACTED-API-KEY   # muss mit bridge/config.json übereinstimmen
```
→
```
BOT_API_KEY=<dein-api-key>   # muss mit bridge/config.json übereinstimmen
```

- [ ] **Step 4: In `bots/CLAUDE.md:118` und `docs/BRIDGE_PROTOCOL.md:605` ersetzen (JSON-Beispiel-Kontext)**

```json
  "api_key": "REDACTED-API-KEY",
```
→
```json
  "api_key": "<dein-api-key>",
```

- [ ] **Step 5: Verifizieren**

```bash
grep -c "REDACTED-API-KEY" README.md CLAUDE.md bots/CLAUDE.md docs/BRIDGE_PROTOCOL.md SETUP.md
grep -c "REDACTED-API-KEY" .claude/skills/trading-bot/SKILL.md
```
Erwartet: erste Zeile `0` für alle 5 Dateien, zweite Zeile weiterhin `1` (bewusst unverändert).

- [ ] **Step 6: Commit**

```bash
git add README.md CLAUDE.md bots/CLAUDE.md docs/BRIDGE_PROTOCOL.md SETUP.md
git commit -m "$(cat <<'EOF'
docs: replace REDACTED-API-KEY placeholder with readable example value

Der String REDACTED-API-KEY stammt aus der Git-History-Bereinigung
(Teilprojekt 1) und sieht in Beispiel-Configs wie ein technischer
Fehler aus statt wie ein bewusster Platzhalter. Ersetzt durch
<dein-api-key> in allen 5 oeffentlich sichtbaren Doku-Dateien.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

---

### Task 4: Screenshots aufnehmen und ins README einbinden

**Files:**
- Create: `public/screenshots/readme/dashboard.png`, `public/screenshots/readme/journal.png`, `public/screenshots/readme/bridge.png`
- Modify: `README.md`

**Interfaces:**
- Consumes: laufenden Dev-Server (`npm run dev`), `run-alphatrack`-Skill
- Produces: 3 PNG-Dateien unter `public/screenshots/readme/`, im README per Markdown-Bild eingebunden.

- [ ] **Step 1: Dev-Server sicherstellen**

Prüfen, ob der Dev-Server bereits läuft (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → `200`); falls nicht, über den `run-alphatrack`-Skill starten.

- [ ] **Step 2: Verzeichnis anlegen**

```bash
mkdir -p public/screenshots/readme
```

- [ ] **Step 3: Screenshots aufnehmen**

Über den `run-alphatrack`-Skill (Playwright-Treiber) folgende Seiten screenshotten und exakt unter diesen Pfaden speichern:
- `/dashboard` → `public/screenshots/readme/dashboard.png`
- `/journal` → `public/screenshots/readme/journal.png`
- `/bridge` (oder die aktuell existierende Bridge-Übersichtsseite, falls der Pfad abweicht — mit `run-alphatrack`s Seiten-Check verifizieren) → `public/screenshots/readme/bridge.png`

Falls eine Seite ohne aktive Bridge-Verbindung leer/leer-artig aussieht (z.B. Bridge-Übersicht ohne verbundene Bots), trotzdem screenshotten — das UI selbst ist das, was gezeigt werden soll, nicht ein bestimmter Datenzustand.

- [ ] **Step 4: Verifizieren, dass alle 3 Dateien valide, nicht-leere PNGs sind**

```bash
file public/screenshots/readme/*.png
```
Erwartet: alle 3 als `PNG image data` erkannt, keine 0-Byte-Dateien.

- [ ] **Step 5: Screenshots ins README einbinden**

Nach der Feature-Tabellen-Sektion (nach `README.md:63`, vor dem `---` vor „## Schnellstart") einen neuen Abschnitt einfügen:

```markdown
## Screenshots

| Dashboard | Trading Journal | Bridge-Übersicht |
|---|---|---|
| ![Dashboard](public/screenshots/readme/dashboard.png) | ![Journal](public/screenshots/readme/journal.png) | ![Bridge](public/screenshots/readme/bridge.png) |
```

Und den neuen Eintrag im Inhaltsverzeichnis (`README.md:16-28`) nach „Navigation" ergänzen:
```markdown
- [Screenshots](#screenshots)
```

- [ ] **Step 6: Commit**

```bash
git add public/screenshots/readme README.md
git commit -m "$(cat <<'EOF'
docs: add real screenshots to README

Dashboard, Journal und Bridge-Uebersicht als PNG unter
public/screenshots/readme/, neue README-Sektion "Screenshots" direkt
nach der Feature-Uebersicht.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

---

### Task 5: `SETUP.md` / `docs/DEPLOYMENT.md` — Korrektheits-Check

**Files:**
- Modify (falls nötig): `SETUP.md`, `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: aktuellen Stand von `bridge/config.example.json` (aus Teilprojekt 1)
- Produces: keine veralteten Datei-/Pfadverweise mehr in beiden Dokumenten.

- [ ] **Step 1: Bekannten Fund in `SETUP.md` korrigieren**

`SETUP.md:72` verweist darauf, `bridge/config.json` manuell zu bearbeiten, ohne zu erwähnen, dass diese Datei (seit Teilprojekt 1) nicht mehr im Repo mitgeliefert wird — nur `bridge/config.example.json` als Vorlage existiert. Aktuelle Zeile:

```markdown
> Die `profile_id` des neuen Profils muss in `bridge/config.json` eingetragen werden. Am einfachsten: Profil oeffnen → Profil-ID kopieren → in `bridge/config.json` unter `profile_id` eintragen → Deploy erneut ausfuehren.
```

Ersetzen durch:

```markdown
> Die `profile_id` des neuen Profils muss in `bridge/config.json` eingetragen werden (auf dem Mini-PC — die Datei existiert dort nach dem ersten Deploy oder nach `bridge/setup.py`; `bridge/config.example.json` im Repo zeigt die erwartete Struktur). Am einfachsten: Profil oeffnen → Profil-ID kopieren → in `bridge/config.json` unter `profile_id` eintragen → Deploy erneut ausfuehren.
```

- [ ] **Step 2: `SETUP.md` und `docs/DEPLOYMENT.md` auf weitere tote Verweise prüfen**

Für jede der folgenden Dateien/Skripte, die in beiden Dokumenten erwähnt werden, verifizieren, dass sie noch existieren:

```bash
for f in scripts/windows/setup-ssh-key.ps1 scripts/windows/deploy.bat scripts/windows/deploy-bot.bat bridge/setup.py bridge/start_bridge.bat bots/scaffold; do
  test -e "$f" && echo "OK: $f" || echo "FEHLT: $f"
done
```
Erwartet: alle als `OK` gelistet. Falls etwas als `FEHLT` erscheint, den entsprechenden Verweis im jeweiligen `.md`-Dokument suchen und melden statt raten, was der korrekte neue Pfad wäre.

- [ ] **Step 3: `docs/DEPLOYMENT.md` auf Erwähnung von Teilprojekt-1-Änderungen prüfen**

```bash
grep -n "bridge/config\.json\|\.env\.local\|BOT_API_KEY" docs/DEPLOYMENT.md
```

Jede gefundene Stelle lesen und prüfen, ob sie noch mit dem aktuellen Verhalten übereinstimmt (BOT_API_KEY wird jetzt live aus der NAS-`.env.local` gelesen und propagiert, `.env.local` ist nicht mehr getrackt — siehe `docs/superpowers/specs/2026-08-29-secrets-cleanup-mt5-credentials-design.md` für den Hintergrund, auch wenn diese Datei selbst nicht mehr getrackt ist, bleibt sie lokal als Referenz). Falls eine Stelle dem widerspricht (z.B. suggeriert, `.env.local` müsse manuell auf den NAS kopiert werden), konkret korrigieren; falls alles bereits konsistent ist, nichts ändern.

- [ ] **Step 4: Falls Änderungen gemacht wurden, committen; falls nicht, im Report vermerken**

```bash
git add SETUP.md docs/DEPLOYMENT.md
git commit -m "$(cat <<'EOF'
docs: fix stale bridge/config.json reference in SETUP.md

Verweist jetzt korrekt auf bridge/config.example.json als Vorlage,
da bridge/config.json seit Teilprojekt 1 nicht mehr im Repo
mitgeliefert wird.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

Falls Step 3 keine weiteren Änderungen ergeben hat, ist das erwartet — im Report explizit vermerken, dass `docs/DEPLOYMENT.md` geprüft und für konsistent befunden wurde (keine leere Aussage, sondern mit den konkret geprüften Grep-Treffern belegt).

---

### Task 6: `CLAUDE.md` / `bots/CLAUDE.md` — Korrektheits-Check

**Files:**
- Modify (falls nötig): `CLAUDE.md`, `bots/CLAUDE.md`

**Interfaces:**
- Consumes: aktuellen Stand nach Task 1-3 dieses Plans (Repo-Komposition, Lizenz, Platzhalter bereits bereinigt)
- Produces: beide Dateien spiegeln den aktuellen Stand korrekt wider.

- [ ] **Step 1: `CLAUDE.md` gegen aktuellen `.gitignore`-Stand prüfen**

`CLAUDE.md` beschreibt im Abschnitt "Env-Vars" und an anderen Stellen das Verhalten von `.env.local`/`bridge/config.json`. Prüfen:

```bash
grep -n "tracked intentionally\|privates Repo\|nicht mehr getrackt\|env\*" CLAUDE.md
```

Falls `CLAUDE.md` noch behauptet, `.env.local` sei "tracked intentionally" oder ähnliches (Rückstand aus der Zeit vor Teilprojekt 1), konkret korrigieren: `.env.local` ist seit Teilprojekt 1 gitignored und nicht mehr getrackt.

- [ ] **Step 2: `CLAUDE.md`-Abschnitt "Env-Vars" auf Vollständigkeit prüfen**

Der Abschnitt sollte nach Task 3 dieses Plans `BOT_API_KEY=<dein-api-key>` zeigen (bereits erledigt). Zusätzlich prüfen, ob der Kommentar zu `ANTHROPIC_API_KEY`/`TWELVE_DATA_API_KEY` noch stimmt (beide "optional", siehe `CLAUDE.md:132-133`) — mit dem tatsächlichen Verhalten in `src/lib/api-keys.ts` abgleichen, falls Zeit/Unsicherheit besteht lieber im Report vermerken statt raten.

- [ ] **Step 3: `bots/CLAUDE.md` auf Bot-Liste-Aktualität prüfen**

```bash
ls bots/ | grep -v scaffold | grep -v backtest
git ls-files bots/*/config.json | sed 's#bots/##;s#/config.json##'
```

Beide Listen sollten übereinstimmen (aktive Bots). Falls `bots/CLAUDE.md` eine Bot-Liste oder Beispiele enthält, die von diesem Ist-Stand abweichen (z.B. einen der 4 verwaisten Bots aus Teilprojekt 1 — `ai-trading`, `breakoutv1`, `scalping`, `testbot1` — noch referenziert), die Stelle konkret korrigieren oder entfernen.

- [ ] **Step 4: Falls Änderungen gemacht wurden, committen; falls nicht, im Report vermerken**

```bash
git add CLAUDE.md bots/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: sync CLAUDE.md + bots/CLAUDE.md with post-cleanup repo state

Korrigiert verbliebene Rueckstaende aus der Zeit vor der
Secrets-Bereinigung (Teilprojekt 1) und veraltete Bot-Referenzen.

Vorbereitung Public-Release, Teilprojekt 2/4.
EOF
)"
```

Falls keine Änderungen nötig waren, im Report die konkret geprüften Fundstellen (Grep-Ausgaben) dokumentieren statt nur "alles passt" zu behaupten.

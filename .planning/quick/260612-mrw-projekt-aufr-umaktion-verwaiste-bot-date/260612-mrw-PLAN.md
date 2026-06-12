---
phase: quick-260612-mrw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - data/profiles.json
  - data/trades-demo001.json
  - data/strategies-demo001.json
  - data/bot-commands-TgSrwgejYS.json
  - data/bot-commands-xncEQxZGku.json
  - data/bot-events-y-inaIPikS.json
  - data/bot-log--zPU73Wryv.json
  - data/bot-log-971tfOI2_v.json
  - data/bot-log-LtDzeFverW.json
  - data/bot-log-TgSrwgejYS.json
  - data/bot-log-gt7O6ayfus.json
  - data/bot-log-jpFac2vUSQ.json
  - data/bot-log-xncEQxZGku.json
  - data/bot-status--zPU73Wryv.json
  - data/bot-status-EaeqUNMvDm.json
  - data/bot-status-LtDzeFverW.json
  - data/bot-status-TgSrwgejYS.json
  - data/bot-status-gt7O6ayfus.json
  - data/bot-status-jpFac2vUSQ.json
  - data/bot-status-xncEQxZGku.json
  - data/bot-status-y-inaIPikS.json
  - bots/ai-trading/
  - bots/scalping/
  - bots/testbot1/
  - bots/breakoutv1/
  - launcher/
  - scripts/windows/AlphaTrack.exe
  - scripts/windows/AlphaTrack.bat
  - scripts/windows/AlphaTrack-Verknuepfung-erstellen.vbs
  - docs/REVIEW.md
  - docs/REVIEW_SWARM.md
  - docs/tradingbot-machbarkeitsstudie.md
  - TODO.md
  - README.md
autonomous: true
requirements: [CLEANUP-01]

must_haves:
  truths:
    - "Keine verwaisten Bot-Datendateien mehr in data/ (nur registrierte Bots IQTLJ3Jdpp, kYH5wxoW99 und Profil FiFT3HmJf-)"
    - "Demo-Profil demo001 ist aus profiles.json und allen zugehörigen Dateien entfernt"
    - "Alte Bot-Ordner (ai-trading, scalping, testbot1, breakoutv1) existieren nicht mehr"
    - "Launcher und Windows-Verknuepfungs-Artefakte sind entfernt"
    - "Veraltete Doku (REVIEW, REVIEW_SWARM, Machbarkeitsstudie, TODO) ist gelöscht"
    - "README.md spiegelt die aktuelle Seitenstruktur und Datenrealität wider"
    - "data/profiles.json ist valides JSON mit genau einem Eintrag (FiFT3HmJf-)"
  artifacts:
    - path: "README.md"
      provides: "Aktualisierte Projektdokumentation"
      contains: "netzwerk"
    - path: "data/profiles.json"
      provides: "Profil-Liste ohne demo001"
      contains: "FiFT3HmJf-"
  key_links:
    - from: "data/active.json"
      to: "data/profiles.json"
      via: "aktive Profil-ID FiFT3HmJf-"
      pattern: "FiFT3HmJf-"
---

<objective>
Projekt-Aufräumaktion: Entfernt verwaiste Bot-Daten, alte Bot-Ordner, veraltete Doku, das Demo-Profil und den Launcher. Aktualisiert die README auf den aktuellen Stand.

Purpose: Datenkorrektheit und ein sauberes Repo — nur noch registrierte Bots (Bridge IQTLJ3Jdpp, TestBot 2 kYH5wxoW99) und das aktive Profil (FiFT3HmJf-) bleiben erhalten. Veraltete Artefakte verwirren bei der Trade-Attribution und Doku-Pflege.

Output: Bereinigtes data/-Verzeichnis, entfernte Ordner/Dateien, aktualisierte README.md, drei atomare Commits.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@data/profiles.json
@README.md

# Achtung: bots/scaffold/ wird von .claude/skills/trading-bot/SKILL.md referenziert — NICHT löschen.
# Die Bridge läuft eventuell und schreibt in data/ — nur die genannten verwaisten Dateien anfassen.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verwaiste Bot-Daten und Demo-Profil entfernen</name>
  <files>data/profiles.json, data/trades-demo001.json, data/strategies-demo001.json, data/bot-commands-TgSrwgejYS.json, data/bot-commands-xncEQxZGku.json, data/bot-events-y-inaIPikS.json, data/bot-log--zPU73Wryv.json, data/bot-log-971tfOI2_v.json, data/bot-log-LtDzeFverW.json, data/bot-log-TgSrwgejYS.json, data/bot-log-gt7O6ayfus.json, data/bot-log-jpFac2vUSQ.json, data/bot-log-xncEQxZGku.json, data/bot-status--zPU73Wryv.json, data/bot-status-EaeqUNMvDm.json, data/bot-status-LtDzeFverW.json, data/bot-status-TgSrwgejYS.json, data/bot-status-gt7O6ayfus.json, data/bot-status-jpFac2vUSQ.json, data/bot-status-xncEQxZGku.json, data/bot-status-y-inaIPikS.json</files>
  <action>
Lösche die 18 verwaisten Bot-Datendateien aus data/ via `git rm`. Da einige Dateinamen führende Bindestriche enthalten (z.B. data/bot-log--zPU73Wryv.json, data/bot-status--zPU73Wryv.json), nutze `git rm -- <pfade>` mit dem `--`-Separator, damit git die Bindestriche nicht als Optionen interpretiert.

Zu löschende verwaiste Dateien (alle git-getrackt): bot-commands-TgSrwgejYS, bot-commands-xncEQxZGku, bot-events-y-inaIPikS, bot-log--zPU73Wryv, bot-log-971tfOI2_v, bot-log-LtDzeFverW, bot-log-TgSrwgejYS, bot-log-gt7O6ayfus, bot-log-jpFac2vUSQ, bot-log-xncEQxZGku, bot-status--zPU73Wryv, bot-status-EaeqUNMvDm, bot-status-LtDzeFverW, bot-status-TgSrwgejYS, bot-status-gt7O6ayfus, bot-status-jpFac2vUSQ, bot-status-xncEQxZGku, bot-status-y-inaIPikS (jeweils .json in data/).

NICHT anfassen: data/bots.json, data/performance-bots.json, alle Dateien mit IQTLJ3Jdpp (Bridge), kYH5wxoW99 (TestBot 2), FiFT3HmJf- (aktives Profil).

Demo-Profil demo001 entfernen:
- data/profiles.json: Entferne den Array-Eintrag mit "id": "demo001" mit dem Edit-Tool. Der Eintrag FiFT3HmJf- "Bot Test" bleibt. Das Array enthält danach genau einen Eintrag. JSON-Struktur (Einrückung, Klammern) muss valide bleiben.
- Lösche data/trades-demo001.json und data/strategies-demo001.json via `git rm --`.
- seed/ NICHT anfassen (ensureSeedData() nutzt seed/ nur bei leerem data/).
- data/active.json zeigt bereits auf FiFT3HmJf-, keine Änderung nötig.

Committe diesen Schritt mit Message: `chore: remove orphaned bot data and demo profile`
  </action>
  <verify>
    <automated>node -e "const p=require('./data/profiles.json'); if(p.length!==1||p[0].id!=='FiFT3HmJf-'){process.exit(1)}; console.log('profiles ok')" && ls data/ | grep -E "demo001|TgSrwgejYS|xncEQxZGku|y-inaIPikS|-zPU73Wryv|971tfOI2_v|LtDzeFverW|gt7O6ayfus|jpFac2vUSQ|EaeqUNMvDm" | grep -vc "" || echo "no orphans left"</automated>
  </verify>
  <done>data/profiles.json ist valides JSON mit genau einem Eintrag (FiFT3HmJf-); alle 18 verwaisten Bot-Dateien und beide demo001-Dateien sind gelöscht; aktive Dateien (bots.json, performance-bots.json, IQTLJ3Jdpp, kYH5wxoW99, FiFT3HmJf-) sind unangetastet; Commit erstellt.</done>
</task>

<task type="auto">
  <name>Task 2: Alte Bot-Ordner und Launcher entfernen</name>
  <files>bots/ai-trading/, bots/scalping/, bots/testbot1/, bots/breakoutv1/, launcher/, scripts/windows/AlphaTrack.exe, scripts/windows/AlphaTrack.bat, scripts/windows/AlphaTrack-Verknuepfung-erstellen.vbs</files>
  <action>
Lösche die alten Bot-Ordner komplett (inkl. untracked Dateien wie __pycache__) und die Launcher-Artefakte.

Bot-Ordner: bots/ai-trading/, bots/scalping/, bots/testbot1/, bots/breakoutv1/. Nutze `git rm -r --` für getrackte Inhalte, danach `rm -rf` für eventuell verbliebene untracked Reste (z.B. __pycache__), damit keine leeren Verzeichnisreste bleiben.

BEHALTEN: bots/testbot2/, bots/scaffold/ (von SKILL.md referenziert!), bots/CLAUDE.md, bots/.gitkeep.

Launcher entfernen: launcher/ (go.mod, main.go) komplett via `git rm -r --` (plus `rm -rf launcher` für untracked Reste). Windows-Artefakte: scripts/windows/AlphaTrack.exe, scripts/windows/AlphaTrack.bat, scripts/windows/AlphaTrack-Verknuepfung-erstellen.vbs via `git rm --`.

BEHALTEN: scripts/windows/deploy.bat, deploy-remote.bat, start-dev.bat, scripts/linux/, scripts/docker-entrypoint.sh, scripts/nas-update.sh.

Prüfe nach dem Löschen, dass die zu behaltenden Pfade noch existieren und keine leeren Reste der gelöschten Ordner verbleiben.

Committe mit Message: `chore: remove legacy bot folders and launcher`
  </action>
  <verify>
    <automated>test ! -d bots/ai-trading && test ! -d bots/scalping && test ! -d bots/testbot1 && test ! -d bots/breakoutv1 && test ! -d launcher && test ! -f scripts/windows/AlphaTrack.exe && test -d bots/scaffold && test -d bots/testbot2 && test -f scripts/windows/deploy.bat && echo "cleanup ok"</automated>
  </verify>
  <done>Die vier alten Bot-Ordner und launcher/ existieren nicht mehr; AlphaTrack.exe/.bat/.vbs sind entfernt; bots/scaffold, bots/testbot2, bots/CLAUDE.md, bots/.gitkeep und die behaltenen scripts/ bleiben erhalten; keine leeren Verzeichnisreste; Commit erstellt.</done>
</task>

<task type="auto">
  <name>Task 3: Veraltete Doku löschen und README aktualisieren</name>
  <files>docs/REVIEW.md, docs/REVIEW_SWARM.md, docs/tradingbot-machbarkeitsstudie.md, TODO.md, README.md</files>
  <action>
Lösche veraltete Doku via `git rm --`: docs/REVIEW.md, docs/REVIEW_SWARM.md, docs/tradingbot-machbarkeitsstudie.md, TODO.md. BEHALTEN: docs/BRIDGE_PROTOCOL.md.

README.md aktualisieren (Deutsch, bestehenden Stil/Tabellen-Format beibehalten), mit dem Edit-Tool:

1. Navigations-Abschnitt (aktuelle Seitenstruktur src/app): dashboard, journal (Trades), statistiken, strategien, kalender, analyse, tpc (Trading Performance Calendar), netzwerk, bridge (Unterseiten: analyse/log/trades), bots (Unterseiten: [id]/performance/settings), einstellungen, setup. Die Zeilen "Trading Journal: Dashboard - Trades - Statistiken - Strategien - Kalender" und "Bot-Analyser: Bridge - Live Trades - Trade Analyzer - Performance - Bot Log - Bot Settings" entsprechend korrigieren und Netzwerk (Auto-Discovery von Bridge/Bots) ergänzen.

2. Datenspeicherungs-Abschnitt: Den falschen Satz "Der `data/`-Ordner ist in `.gitignore` - deine Handelsdaten werden niemals zu GitHub gepusht." korrigieren: data/ IST bewusst in Git getrackt (für Multi-Device-Sync, privates Repo). Auch das veraltete "(nicht in Git)" in der Projektstruktur (Zeile zu data/) korrigieren.

3. Projektstruktur-Abschnitt: Top-Level-Ordner bots/ (Python-Bots: testbot2 aktiv, scaffold als Vorlage) und bridge/ (Python-Bridge: gateway.py, main.py, trade_executor.py usw.) ergänzen. Den bridge/-Eintrag unter src/app präzisieren (Unterseiten analyse/log/trades) und bots/, netzwerk/, tpc/, statistiken/ unter src/app aufführen.

4. Datenspeicherungs-Liste ergänzen: bot-events-[BOT-ID].json und performance-bots.json hinzufügen.

5. Feature-Tabellen: "Bot Log"/"Bot Settings" sind keine eigenen Navigationspunkte mehr in der beschriebenen Form — entsprechend anpassen; Netzwerk-Seite (Auto-Discovery von Bridge/Bots) erwähnen.

6. Launcher-/AlphaTrack.exe-Erwähnungen entfernen, falls in README vorhanden (aktuell keine im Schnellstart/Deployment sichtbar — prüfen und ggf. entfernen).

7. Versions-Badge: Auf 1.2 setzen oder entfernen. License-Badge mit totem Link ./LICENSE (keine LICENSE-Datei vorhanden) entfernen.

Committe mit Message: `docs: remove outdated docs and update README`
  </action>
  <verify>
    <automated>test ! -f docs/REVIEW.md && test ! -f docs/REVIEW_SWARM.md && test ! -f docs/tradingbot-machbarkeitsstudie.md && test ! -f TODO.md && test -f docs/BRIDGE_PROTOCOL.md && grep -qi "netzwerk" README.md && ! grep -q "in .gitignore" README.md && ! grep -q "LICENSE" README.md && echo "docs ok"</automated>
  </verify>
  <done>Die vier veralteten Doku-Dateien sind gelöscht, docs/BRIDGE_PROTOCOL.md bleibt; README.md spiegelt aktuelle Seitenstruktur (inkl. netzwerk, tpc, bridge-Unterseiten, bots), data/-Git-Realität, bots/+bridge/-Top-Level-Ordner, ergänzte Datendateien wider; toter License-Badge und Launcher-Erwähnungen entfernt; Commit erstellt.</done>
</task>

</tasks>

<verification>
- data/profiles.json: valides JSON, genau ein Eintrag (FiFT3HmJf-)
- Keine verwaisten Bot-Dateien, demo001-Dateien, alte Bot-Ordner, Launcher- oder veraltete Doku-Dateien mehr vorhanden
- Behaltene Pfade intakt: bots/scaffold, bots/testbot2, bots/CLAUDE.md, bots/.gitkeep, docs/BRIDGE_PROTOCOL.md, scripts/windows/deploy.bat u.a.
- README.md aktualisiert und konsistent
- Drei atomare Commits mit Messages im bestehenden Stil
</verification>

<success_criteria>
- 18 verwaiste Bot-Dateien + 2 demo001-Dateien gelöscht, demo001 aus profiles.json entfernt
- 4 alte Bot-Ordner + launcher/ + 3 Windows-Launcher-Artefakte entfernt, keine leeren Reste
- 4 veraltete Doku-Dateien gelöscht, BRIDGE_PROTOCOL.md erhalten
- README.md auf aktuellen Stand gebracht (Navigation, Datenspeicherung, Projektstruktur, Badges)
- Aktive Daten (bots.json, performance-bots.json, IQTLJ3Jdpp, kYH5wxoW99, FiFT3HmJf-) unangetastet
- 3 atomare Commits erstellt
</success_criteria>

<output>
Create `.planning/quick/260612-mrw-projekt-aufr-umaktion-verwaiste-bot-date/260612-mrw-SUMMARY.md` when done
</output>

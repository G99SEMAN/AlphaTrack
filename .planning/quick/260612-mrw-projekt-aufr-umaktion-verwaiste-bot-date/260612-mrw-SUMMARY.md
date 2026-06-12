---
phase: quick-260612-mrw
plan: "01"
subsystem: repo-cleanup
tags: [cleanup, data, bots, docs, readme]
dependency_graph:
  requires: []
  provides: [clean-repo-state, updated-readme]
  affects: [data/profiles.json, README.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - data/profiles.json
    - README.md
  deleted:
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
    - data/trades-demo001.json
    - data/strategies-demo001.json
    - bots/ai-trading/ (full folder)
    - bots/scalping/ (full folder)
    - bots/testbot1/ (full folder)
    - bots/breakoutv1/ (full folder)
    - launcher/go.mod
    - launcher/main.go
    - scripts/windows/AlphaTrack.exe
    - scripts/windows/AlphaTrack.bat
    - scripts/windows/AlphaTrack-Verknuepfung-erstellen.vbs
    - docs/REVIEW.md
    - docs/REVIEW_SWARM.md
    - docs/tradingbot-machbarkeitsstudie.md
    - TODO.md
decisions:
  - "data/ ist bewusst in Git getrackt (privates Repo, Multi-Device-Sync) — README-Falschaussabe korrigiert"
  - "bots/scaffold bleibt erhalten (SKILL.md-Referenz)"
metrics:
  duration: "~10 min"
  completed: "2026-06-12"
---

# Phase quick-260612-mrw Plan 01: Projekt-Aufräumaktion Summary

Vollstaendige Bereinigung des Repos: 20 verwaiste Bot-Datendateien + Demo-Profil entfernt, 4 alte Bot-Ordner + Launcher + 3 Windows-Artefakte geloescht, 4 veraltete Doku-Dateien entfernt, README auf aktuellen Stand (Navigation, Projektstruktur, Datenspeicherung, Badges) gebracht.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verwaiste Bot-Daten und Demo-Profil entfernen | 6000f20 | 20 deleted (18 Bot-Dateien + trades/strategies demo001), profiles.json bereinigt |
| 2 | Alte Bot-Ordner und Launcher entfernen | b34b855 | 220 deleted (ai-trading, scalping, testbot1, breakoutv1, launcher/, 3 Windows-Artefakte) |
| 3 | Veraltete Doku loeschen und README aktualisieren | f6d001f | 4 deleted (REVIEW, REVIEW_SWARM, machbarkeitsstudie, TODO), README.md aktualisiert |

## Deviations from Plan

None - plan executed exactly as written.

## Retained Paths (verified intact)

- `bots/scaffold/` — erhalten (SKILL.md-Referenz)
- `bots/testbot2/` — erhalten (aktiver Bot)
- `bots/CLAUDE.md` — erhalten
- `docs/BRIDGE_PROTOCOL.md` — erhalten
- `scripts/windows/deploy.bat`, `deploy-remote.bat`, `start-dev.bat` — erhalten
- `scripts/linux/`, `scripts/docker-entrypoint.sh`, `scripts/nas-update.sh` — erhalten
- `data/bots.json`, `data/performance-bots.json` — unangetastet (Bridge-Live-Daten)
- `data/*-IQTLJ3Jdpp.*`, `data/*-kYH5wxoW99.*`, `data/*-FiFT3HmJf-.*` — unangetastet

## README Changes Summary

1. **Navigation**: Erganzt Analyse, TPC; Bridge-Unterseiten (analyse/log/trades); Bots-Unterseiten (performance/settings); Netzwerk (Auto-Discovery)
2. **Feature-Tabelle**: Bot Log/Settings korrekt benannt; Netzwerk-Seite ergaenzt
3. **Projektstruktur**: bots/ und bridge/ als Top-Level-Ordner; netzwerk/, tpc/, bots/ unter src/app/ hinzugefuegt
4. **Datenspeicherung**: Falschaussage "data/ ist in .gitignore" korrigiert (data/ ist bewusst getrackt); bot-events und performance-bots ergaenzt
5. **Badges**: Version auf 1.2 gesetzt; toter License-Badge (./LICENSE nicht vorhanden) entfernt

## Self-Check: PASSED

- data/profiles.json: 1 Eintrag (FiFT3HmJf-) — verified via node -e
- Alle 20 verwaisten Dateien geloescht — verified via git show --stat HEAD~2
- Alte Bot-Ordner geloescht, scaffold+testbot2 erhalten — verified via ls + test
- README.md enthaelt "netzwerk", kein "in .gitignore", kein "LICENSE" — verified via grep
- docs/BRIDGE_PROTOCOL.md erhalten — verified via test -f
- 3 atomare Commits vorhanden: 6000f20, b34b855, f6d001f

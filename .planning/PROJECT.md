# AlphaTrack — TODO Abarbeitung

## What This Is

AlphaTrack ist ein Trading-Journal und Bot-Management-System für MetaTrader 5. Bots und die Bridge verbinden sich via HTTP-Protokoll; Trades werden in JSON-Dateien gespeichert und im Frontend angezeigt. Dieses Projekt arbeitet alle offenen TODO-Punkte ab: Datenkorrektheit (Trade-Zuordnung, Status), Auto-Discovery von Bridge/Bots, UI-Fixes und Seitenbereinigung.

## Core Value

Jeder Trade muss eindeutig einer Quelle (Bridge-Trade-Executor oder einem bestimmten Bot) zugeordnet sein — ohne korrekte Trade-Attribution sind alle Statistiken, P&L-Anzeigen und Bot-Performance-Daten wertlos.

## Requirements

### Validated

- ✓ Bridge-Verbindung zu MetaTrader 5 via HTTP-Protokoll — bestehend
- ✓ Trade-Journal mit Statistiken (P&L, Win Rate, Drawdown) — bestehend
- ✓ Mehrere Bots können sich via Bridge verbinden — bestehend
- ✓ Trade Executor für manuelle Trades via Bridge — bestehend
- ✓ Bot-Status-Polling alle 5 Sekunden — bestehend

### Active

- [ ] **TRADES-01**: Offene Trades, die bereits geschlossen wurden, korrekt als geschlossen markieren
- [ ] **TRADES-02**: Jeder Trade wird eindeutig einer Quelle zugeordnet (Bot-ID oder bridge/tradeexecuter)
- [ ] **TRADES-03**: MetaTrader-Kommentar bei Bridge-Trades enthält `/bridge/tradeexecuter` als Quelle
- [ ] **NET-01**: Diskrepanz zwischen Bridge-Tradeanzahl (8) und Bot-Tradeanzahl (1) beheben
- [ ] **SYNC-01**: Sync-Zähler (aktuell fälschlicherweise 8400+) korrigieren
- [ ] **BRIDGE-01**: Bridge auto-Discovery — Bridge erscheint/verschwindet automatisch, kein manuelles Löschen nötig
- [ ] **BRIDGE-02**: Trash-Icon zum manuellen Löschen der Bridge entfernen
- [ ] **BRIDGE-03**: Bridge-Log Filter „Alle Bots" entfernen — Bridge-Log zeigt keine Bot-Einträge
- [ ] **BRIDGE-04**: Bridge Settings Seite entfernen (keine notwendigen Einstellungen)
- [ ] **BOTS-01**: Bot-Positionsanzahl korrekt anzeigen (aktuell 0 obwohl Trades offen)
- [ ] **BOTS-02**: „Synced"-Feld in Bot-Karte entfernen (leer, kein Mehrwert)
- [ ] **BOTS-03**: „Balance" in Bot-Karte durch P&L des jeweiligen Bots ersetzen
- [ ] **BOTS-04**: Anzahl der vom Bot getätigten Trades in Bot-Karte anzeigen
- [ ] **BOTS-05**: Bot auto-Discovery — Bot verschwindet wenn er sich trennt, kein manuelles Entfernen
- [ ] **BOTS-06**: Bot-Entfernen-Button in Bot-Settings entfernen
- [ ] **BOTS-07**: Namens-Bearbeitung in Bot-Settings entfernen
- [ ] **BOTS-08**: Bot-Parameter (z.B. Lotgröße) in Bot-Settings bearbeitbar + Bestätigen-Button sendet Parameter an Bot
- [ ] **BOTLOG-01**: Bot-Log-Seite entfernen
- [ ] **PERF-01**: Bot-Performance-Graph (P&L über Zeit) funktionsfähig machen
- [ ] **PERF-02**: Trade-Anzahl pro Bot in Performance-Ansicht anzeigen
- [ ] **UI-01**: Trennlinie zwischen offenen Trades farblich an „Vergangene Trades"-Stil anpassen

### Out of Scope

- Bot-Authentifizierung/Login-System — nicht Teil dieser Abarbeitung
- Neue Features jenseits der TODO-Liste — nur bestehende Punkte werden umgesetzt
- Datenbankmigrierung — bleibt bei JSON-Datei-basiertem Storage

## Context

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, file-basierter JSON-Storage in `data/`.

**Bridge-Architektur:** Python-Bridge verbindet sich per HTTP zu AlphaTrack. Bots sind Bridge-Instanzen. Alle Trades kommen ausschließlich über die Bridge. Bots werden via `bots.json` konfiguriert, Status via Heartbeat-Polling.

**Root-Problem:** Trade-Zuordnung ist aktuell unvollständig — Trades von verschiedenen Bots oder dem Trade Executor werden nicht korrekt mit ihrer Quelle getaggt. Dies führt zu falschen Positionszählern, falschem P&L, und einem aufgeblähten Sync-Zähler.

**Bekannte Architektur-Schwäche:** Module-Level-Caches (`_botsCache`, `_statsCache`) müssen nach jeder Mutation manuell invalidiert werden — wichtig bei allen Fixes die Trades/Bots mutieren.

## Constraints

- **Tech Stack**: Next.js 15 + TypeScript — kein Wechsel des Frameworks
- **Storage**: JSON-Dateien in `data/` — kein Datenbankwechsel
- **Trade-Quelle**: Nur über die Bridge — keine direkt eingetippten Trades
- **Scope**: Ausschließlich die Punkte aus TODO.md

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Datenkorrektheit zuerst | Trade-Attribution ist Basis für alle anderen Features (P&L, Performance, Status) | — Pending |
| Auto-Discovery statt manuell | Bridge/Bots sollen sich selbst registrieren/deregistrieren | — Pending |

## Evolution

Dieses Dokument entwickelt sich an Phasenübergängen und Milestone-Grenzen.

**Nach jeder Phasentransition** (via `/gsd-transition`):
1. Requirements invalidiert? → In Out of Scope verschieben mit Grund
2. Requirements validiert? → In Validated verschieben mit Phasen-Referenz
3. Neue Requirements aufgetaucht? → Zu Active hinzufügen
4. Entscheidungen zu dokumentieren? → Zu Key Decisions hinzufügen
5. „What This Is" noch aktuell? → Aktualisieren falls nicht mehr passend

**Nach jedem Milestone** (via `/gsd-complete-milestone`):
1. Vollständige Überprüfung aller Abschnitte
2. Core Value Check — noch die richtige Priorität?
3. Out of Scope prüfen — Begründungen noch gültig?
4. Context mit aktuellem Stand aktualisieren

---
*Last updated: 2026-06-09 nach Initialisierung*

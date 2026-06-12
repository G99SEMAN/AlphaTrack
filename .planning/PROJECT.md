# AlphaTrack — TODO Abarbeitung

## What This Is

AlphaTrack ist ein Trading-Journal und Bot-Management-System für MetaTrader 5. Bots und die Bridge verbinden sich via HTTP-Protokoll; Trades werden in JSON-Dateien gespeichert und im Frontend angezeigt. Alle 21 TODO-Punkte der v1.0-Abarbeitung wurden implementiert: Trade-Attribution, Auto-Discovery von Bridge/Bots, korrekte Metriken in Bot-Karten, Seiten-Bereinigung und UI-Fixes.

## Core Value

Jeder Trade muss eindeutig einer Quelle (Bridge-Trade-Executor oder einem bestimmten Bot) zugeordnet sein — ohne korrekte Trade-Attribution sind alle Statistiken, P&L-Anzeigen und Bot-Performance-Daten wertlos.

## Requirements

### Validated

- ✓ Bridge-Verbindung zu MetaTrader 5 via HTTP-Protokoll — bestehend
- ✓ Trade-Journal mit Statistiken (P&L, Win Rate, Drawdown) — bestehend
- ✓ Mehrere Bots können sich via Bridge verbinden — bestehend
- ✓ Trade Executor für manuelle Trades via Bridge — bestehend
- ✓ Bot-Status-Polling alle 5 Sekunden — bestehend
- ✓ **TRADES-01**: Trades korrekt als geschlossen markiert — v1.0
- ✓ **TRADES-02**: Jeder Trade trägt eindeutige Quell-ID (sourceId) — v1.0
- ✓ **TRADES-03**: MT5-Kommentar `/bridge/tradeexecuter` bei Trade-Executor-Trades — v1.0
- ✓ **NET-01**: Bridge- und Bot-Tradeanzahl konsistent — v1.0
- ✓ **SYNC-01**: Sync-Zähler entfernt (war 8400+, kein Mehrwert) — v1.0
- ✓ **BRIDGE-01/02**: Bridge Auto-Discovery + Trash-Icon entfernt — v1.0
- ✓ **BRIDGE-03/04**: Bridge-Log bereinigt, Bridge-Settings-Seite entfernt — v1.0
- ✓ **BOTS-01–05**: Bot-Karte zeigt P&L, Positionen, Trades; Auto-Disconnect — v1.0
- ✓ **BOTS-06/07/08**: Bot-Settings: Edit/Delete entfernt, Parameter-Editor — v1.0
- ✓ **BOTLOG-01**: Bot-Log-Seite entfernt — v1.0
- ✓ **PERF-01/02**: Ticket-Registry-Persistenz für Bot-Performance-Attribution — v1.0
- ✓ **UI-01**: Trade-Row borderBottom-Konsistenz — v1.0

### Active

*(Keine — alle TODO-Punkte wurden in v1.0 abgearbeitet. Nächster Meilenstein wird neue Requirements definieren.)*

### Out of Scope

- Bot-Authentifizierung/Login-System — nicht Teil dieser Abarbeitung
- Neue Features jenseits der TODO-Liste — nur bestehende Punkte wurden umgesetzt
- Datenbankmigrierung — bleibt bei JSON-Datei-basiertem Storage
- Multi-Benutzer / Auth — nicht relevant für lokale Installation

## Context

**Shipped v1.0 with ~8.600 LOC changes across 72 files.**

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, file-basierter JSON-Storage in `data/`, Python-Bridge in `bridge/`.

**Bridge-Architektur:** Python-Bridge verbindet sich per HTTP zu AlphaTrack. Bots sind eigenständige Python-Prozesse. Alle Trades kommen ausschließlich über die Bridge. Bots werden via `bots.json` konfiguriert, Status via Heartbeat-Polling alle 5s.

**Bekannte Architektur-Schwäche:** Module-Level-Caches (`_botsCache`, `_statsCache`) müssen nach jeder Mutation manuell invalidiert werden.

**Verbleibende manuelle Tests (deferred):** Bridge/Bot Auto-Discovery Timeouts, P&L-Farben im Browser, Parameter-Editor mit realem Bot — erfordern laufendes System mit aktiver Bridge/Bot-Verbindung.

## Constraints

- **Tech Stack**: Next.js 15 + TypeScript — kein Wechsel des Frameworks
- **Storage**: JSON-Dateien in `data/` — kein Datenbankwechsel
- **Trade-Quelle**: Nur über die Bridge — keine direkt eingetippten Trades
- **Scope**: Ausschließlich die Punkte aus TODO.md (v1.0 vollständig abgearbeitet)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Datenkorrektheit zuerst | Trade-Attribution ist Basis für alle anderen Features (P&L, Performance, Status) | ✓ Gut — sourceId + Close-Event bildeten solides Fundament für alle nachfolgenden Phasen |
| Auto-Discovery statt manuell | Bridge/Bots sollen sich selbst registrieren/deregistrieren | ✓ Gut — 30s-Heartbeat-Timeout funktioniert für Bridge und Bots gleichermaßen |
| Ticket-Registry persistieren | In-Memory-Registry überlebte Bridge-Neustart nicht → Trade-Attribution verloren | ✓ Gut — `ticket_registry.json` löst das Problem ohne DB-Migration |
| Bot-Stats als eigener Endpunkt | Bot-Karte braucht trade-basierte Metriken, kein Heartbeat-Status | ✓ Gut — GET /api/bots/:id/stats klar getrennt von Heartbeat-Daten |

## Evolution

**Nach jedem Milestone** (via `/gsd-complete-milestone`):
1. Vollständige Überprüfung aller Abschnitte
2. Core Value Check — noch die richtige Priorität?
3. Out of Scope prüfen — Begründungen noch gültig?
4. Context mit aktuellem Stand aktualisieren

---
*Last updated: 2026-06-12 nach v1.0 milestone*

# Phase 2: Bridge-Bereinigung - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 2-Bridge-Bereinigung
**Areas discussed:** Auto-Discovery, Log-Filter Bereinigung, Settings-Seite Entfernen

---

## Auto-Discovery (BRIDGE-01)

### Verhalten bei Disconnect

| Option | Description | Selected |
|--------|-------------|----------|
| Nach Timeout ausblenden | Bridge gilt als getrennt nach X Sekunden ohne Heartbeat | ✓ |
| Sofort ausblenden | Sofort bei fehlendem Status verschwinden | |
| Als Offline markieren | In Liste bleiben, Offline-Indikator anzeigen | |

**User's choice:** Nach Timeout ausblenden

### Timeout-Dauer

| Option | Description | Selected |
|--------|-------------|----------|
| 30 Sekunden | 6 verpasste Heartbeats | ✓ |
| 60 Sekunden | 12 verpasste Heartbeats (empfohlen) | |
| 120 Sekunden | 24 verpasste Heartbeats | |

**User's choice:** 30 Sekunden

### Ort der Timeout-Logik

| Option | Description | Selected |
|--------|-------------|----------|
| Im BotStatusContext (Frontend) | Poll-Loop prüft lastHeartbeat | ✓ |
| Im Backend (API-Route) | Backend filtert abgelaufene Bridges | |
| Beides | Frontend blendet aus, Backend bereinigt langfristig | |

**User's choice:** BotStatusContext (Frontend)

---

## Log-Filter Bereinigung (BRIDGE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Gesamten Bot-Filter-Bereich entfernen | "Alle Bots" + per-Bot-Buttons weg, Level-Filter bleibt | ✓ |
| Nur "Alle Bots"-Button entfernen | Per-Bot-Buttons bleiben für künftige Multi-Bridge-Nutzung | |

**User's choice:** Gesamten Bot-Filter-Bereich entfernen
**Notes:** Level-Filter (Info/Warn/Error) und Suchfeld bleiben erhalten.

---

## Settings-Seite Entfernen (BRIDGE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect zu /bridge | Sanfte Weiterleitung bei Aufruf der alten URL | |
| 404-Seite | Dateien löschen, Next.js zeigt automatisch 404 | ✓ |

**User's choice:** 404-Seite
**Notes:** Sidebar-Link wird ebenfalls entfernt.

---

## Claude's Discretion

Keine — alle Entscheidungsbereiche wurden vom User beantwortet.

## Deferred Ideas

None — Diskussion blieb innerhalb des Phase-2-Scopes.

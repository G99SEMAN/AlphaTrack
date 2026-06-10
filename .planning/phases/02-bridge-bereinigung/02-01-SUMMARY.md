---
phase: 02-bridge-bereinigung
plan: "01"
subsystem: bridge
tags: [bridge, auto-discovery, heartbeat, ui-cleanup]
dependency_graph:
  requires: []
  provides: [BRIDGE-01, BRIDGE-02]
  affects: [src/context/BotStatusContext.tsx, src/app/bridge/BridgeClient.tsx]
tech_stack:
  added: []
  patterns: [heartbeat-timeout-filter, module-constant, optional-chaining]
key_files:
  created: []
  modified:
    - src/context/BotStatusContext.tsx
    - src/app/bridge/BridgeClient.tsx
decisions:
  - "HEARTBEAT_TIMEOUT_MS als Modulkonstante (30_000) nach fingerprint() platziert — analog zu filterBridge in BridgeClient"
  - "Filterlogik wirkt auf raw-Array vor fingerprint-Vergleich — bestehende Referenzstabilitaet bleibt erhalten"
  - "DELETE-API-Route /api/bots/[id] bewusst erhalten — wird in Phase 3 benoetigt"
metrics:
  duration: "15min"
  completed: "2026-06-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 02 Plan 01: Bridge-Selbstverwaltung — Heartbeat-Timeout + Trash-Icon-Entfernung Summary

**One-liner:** 30s-Heartbeat-Timeout-Filter im BotStatusContext via HEARTBEAT_TIMEOUT_MS-Modulkonstante + deleteBot()/Trash2-Entfernung aus BridgeClient.

## Was wurde gebaut

Zwei chirurgische Eingriffe in der Bridge-Infrastruktur:

1. **BotStatusContext.tsx (BRIDGE-01):** Die `poll()`-Funktion empfängt das API-Array jetzt als `raw` und filtert es vor `setBots`. Bots ohne `lastHeartbeat` (`status === null` oder `undefined`) werden per `return false` ausgeschlossen (NaN-Schutz, T-02-02). Bots mit Heartbeat älter als 30 Sekunden werden ebenfalls entfernt. Der fingerprint-Vergleich und `setLastUpdated` bleiben unverändert.

2. **BridgeClient.tsx (BRIDGE-02):** `Trash2`-Import entfernt, `deleteBot()`-Funktion vollständig entfernt, Trash-Button-JSX im Tab-Button entfernt. Der Tab-Button selbst (`setSelectedBotId`, Status-Punkt, Bot-Name) bleibt vollständig erhalten. Die DELETE-API-Route `/api/bots/[id]` wurde nicht angetastet.

## Tasks

| Task | Name | Commit | Dateien |
|------|------|--------|---------|
| 1 | Heartbeat-Timeout-Filter im BotStatusContext (BRIDGE-01) | 8ef0595 | src/context/BotStatusContext.tsx |
| 2 | Trash-Icon und deleteBot() aus BridgeClient entfernen (BRIDGE-02) | 5805c57 | src/app/bridge/BridgeClient.tsx |

## Acceptance Criteria — Verifikation

| Kriterium | Status |
|-----------|--------|
| `HEARTBEAT_TIMEOUT_MS` in BotStatusContext.tsx vorhanden (Wert 30_000) | PASSED |
| `if (!b.status?.lastHeartbeat) return false` in poll() | PASSED |
| `now - new Date(b.status.lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS` in poll() | PASSED |
| `setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)` erhalten | PASSED |
| `Trash2` nicht mehr in BridgeClient.tsx | PASSED |
| `deleteBot` nicht mehr in BridgeClient.tsx | PASSED |
| `setSelectedBotId(bot.id)` im Tab-Button erhalten | PASSED |
| `npm run build` exits 0 | PASSED |

## Deviations from Plan

Keine — Plan wurde exakt wie beschrieben ausgeführt.

## Threat Surface Scan

Keine neuen Trust-Boundaries oder Security-relevanten Endpunkte eingeführt. T-02-02 (NaN-Schutz bei fehlendem lastHeartbeat) ist durch `if (!b.status?.lastHeartbeat) return false` mitigiert.

## Known Stubs

Keine.

## Self-Check: PASSED

- src/context/BotStatusContext.tsx — vorhanden, HEARTBEAT_TIMEOUT_MS enthalten
- src/app/bridge/BridgeClient.tsx — vorhanden, Trash2/deleteBot entfernt
- Commit 8ef0595 — vorhanden
- Commit 5805c57 — vorhanden

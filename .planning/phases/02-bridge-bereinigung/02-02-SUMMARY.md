---
phase: 02-bridge-bereinigung
plan: "02"
subsystem: bridge-log-ui
tags: [bridge, log, filter, settings, sidebar, cleanup]
requirements: [BRIDGE-03, BRIDGE-04]

dependency_graph:
  requires: []
  provides:
    - Bridge-Log ohne Bot-Filter-UI (nur Level-Filter + Suche)
    - initialLogs nur mit Bridge-Bot-Logs
    - Route /bridge/settings entfernt (404)
    - Sidebar ohne Bridge-Settings-Link
  affects:
    - src/app/bridge/log/BridgeLogClient.tsx
    - src/app/bridge/log/page.tsx
    - src/components/layout/Sidebar.tsx

tech_stack:
  added: []
  patterns:
    - Entfernen von Client-State ohne Datenflussbrechung (botFilter)
    - Server-seitige Filterung vor initialLogs-Schleife (Bridge-only)

key_files:
  created: []
  modified:
    - src/app/bridge/log/BridgeLogClient.tsx
    - src/app/bridge/log/page.tsx
    - src/components/layout/Sidebar.tsx
  deleted:
    - src/app/bridge/settings/page.tsx
    - src/app/bridge/settings/BridgeSettingsClient.tsx

decisions:
  - "Log-Loesch-Button bleibt erhalten (gehoert zur Log-Verwaltung, nicht zum Bot-Filter); immer '__all__' ohne botFilter-Referenz"
  - "SlidersHorizontal-Import in Sidebar.tsx behalten — wird weiterhin in BOTS_NAV verwendet"
  - "Kein Redirect fuer /bridge/settings — Next.js App Router zeigt automatisch 404"

metrics:
  duration: "~10 min"
  completed_date: "2026-06-10T20:34:51Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 02 Plan 02: Bridge-Log-Bereinigung + Settings-Entfernung Summary

**One-liner:** Bridge-Log auf reinen Level+Such-Filter reduziert und Bridge-Settings-Route vollstaendig entfernt (BRIDGE-03, BRIDGE-04).

## Was wurde gebaut

Plan 02-02 entfernte alle Bot-Filter-Elemente aus dem Bridge-Log und loeschte die Bridge-Settings-Seite inkl. Sidebar-Link.

### Task 1 — botFilter-State und Bot-Filter-UI entfernen (BRIDGE-03)

Aus `BridgeLogClient.tsx` wurden entfernt:
- `botFilter` / `setBotFilter` useState-Hook
- `botFilter`-Bedingung in der `filtered`-Logik
- Trennlinie `<div className="h-4 w-px">` zwischen Level- und Bot-Filter
- Gesamter Bot-Filter-Block: "Alle Bots"-Button und alle per-Bot-Buttons (`bots.map(...)`)
- `botFilter`-Referenz im Loeschen-Button (jetzt immer `'__all__'`)
- `botFilter`-Term in der gefiltert-Anzeige (kritischer Pitfall: vermeidet "Cannot find name 'botFilter'")

Erhalten geblieben: Level-Filter (4 Buttons), Suchfeld, `bots`-Prop, Trash-Button.

**Commit:** `7463c62`

### Task 2 — initialLogs auf Bridge-Bots einschraenken (BRIDGE-03)

In `page.tsx` wurde die Reihenfolge der Definitionen getauscht:
- `const bots = allBots.filter(...)` vor den `initialLogs`-Loop gezogen
- Loop von `for (const bot of allBots)` auf `for (const bot of bots)` umgestellt
- Beim ersten Render werden keine Bot-Logs mehr geladen

**Commit:** `607f55b`

### Task 3 — Bridge-Settings-Seite loeschen + Sidebar-Link entfernen (BRIDGE-04)

- `src/app/bridge/settings/page.tsx` geloescht — Route /bridge/settings ergibt 404
- `src/app/bridge/settings/BridgeSettingsClient.tsx` geloescht
- In `Sidebar.tsx` den `BRIDGE_NAV`-Eintrag `/bridge/settings` entfernt
- `SlidersHorizontal`-Import erhalten (weiterhin in `BOTS_NAV` Zeile 39 verwendet)

**Commit:** `6b8b0bb`

## Commits

| Task | Commit | Nachricht |
|------|--------|-----------|
| 1 | `7463c62` | feat(02-02): entferne botFilter-State und Bot-Filter-UI aus BridgeLogClient (BRIDGE-03) |
| 2 | `607f55b` | feat(02-02): initialLogs nur noch ueber gefilterte Bridge-Bots (BRIDGE-03) |
| 3 | `6b8b0bb` | feat(02-02): loeschen Bridge-Settings-Seite + Sidebar-Link entfernen (BRIDGE-04) |

## Verifikation

- `npm run build` nach jedem Task: alle 3 Male fehlerfrei kompiliert
- `botFilter`, `setBotFilter`, `Alle Bots`: nicht mehr in BridgeLogClient.tsx vorhanden
- `/bridge/settings`: nicht mehr in Sidebar.tsx vorhanden; nicht in Build-Route-Liste
- `SlidersHorizontal`: weiterhin in Sidebar.tsx (Import + BOTS_NAV)
- Dateien `settings/page.tsx` und `settings/BridgeSettingsClient.tsx`: nicht mehr vorhanden

## Deviations from Plan

None — Plan wurde exakt wie beschrieben ausgefuehrt.

## Known Stubs

None — alle entfernten Elemente waren vollstaendige Implementierungen, keine Stubs einfuehrt.

## Threat Flags

Keine neuen Sicherheitsrelevanten Oberflaechen eingefuehrt. Die Entfernung von `/bridge/settings` verkleinert die Angriffsflaeche (T-02-03 mitigated: MT5-Zugangsdaten nicht mehr ueber UI erreichbar).

## Self-Check: PASSED

- `src/app/bridge/log/BridgeLogClient.tsx` — vorhanden, kein botFilter
- `src/app/bridge/log/page.tsx` — vorhanden, loop ueber bots
- `src/components/layout/Sidebar.tsx` — vorhanden, kein /bridge/settings
- `src/app/bridge/settings/page.tsx` — nicht vorhanden (korrekt geloescht)
- `src/app/bridge/settings/BridgeSettingsClient.tsx` — nicht vorhanden (korrekt geloescht)
- Commits `7463c62`, `607f55b`, `6b8b0bb` — alle vorhanden

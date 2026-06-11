---
phase: 04-performance-abschluss
plan: "03"
subsystem: journal-ui
tags: [ui, trade-row, styling, consistency]
dependency_graph:
  requires: []
  provides: [konsistentes-border-styling-trade-row]
  affects: [src/components/journal/TradeRow.tsx]
tech_stack:
  added: []
  patterns: [inline-style-css-variables]
key_files:
  created: []
  modified:
    - src/components/journal/TradeRow.tsx
decisions:
  - "onMouseLeave background auf 'var(--surface)' statt 'transparent' gesetzt — Hintergrund bleibt konsistent fuer alle Trade-Status und verhindert Durchscheinen des Seiten-Hintergrunds"
metrics:
  duration: "3 Minuten"
  completed: "2026-06-11T20:35:40Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 04 Plan 03: borderBottom-Konsistenz TradeRow Summary

**One-liner:** onMouseLeave background-Reset von 'transparent' auf 'var(--surface)' korrigiert visuelle Inkonsistenz der Trennlinien zwischen offenen und geschlossenen Trade-Rows im Journal.

## Was wurde gebaut

Behebt D-04 (UI-01): Offene und geschlossene Trades hatten optisch unterschiedlich aussehende
Trennlinien in der Journal-Ansicht. Der Fix stellt sicher, dass der Hintergrund einer Trade-Row
nach dem Hover-Verlassen immer `var(--surface)` ist — nicht `transparent`. Damit ist die
Trennlinie (`borderBottom: '1px solid var(--border)'`) visuell identisch fuer alle Trade-Status.

## Aufgaben

### Task 1: borderBottom-Konsistenz herstellen (D-04, UI-01)

**Status:** Abgeschlossen  
**Commit:** a54f901  
**Geanderte Datei:** `src/components/journal/TradeRow.tsx` (1 Zeile)

**Diagnose:** Das `borderBottom`-Styling in Zeile 66 war bereits unveranderlich fuer alle
Trade-Status (`'1px solid var(--border)'`). Das Problem lag in Zeile 69:

```
// Vorher (Problem):
onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}

// Nachher (Fix):
onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
```

Bei `transparent` schien der Seiten-Hintergrund durch und liess die Trennlinie unter offenen
Trades anders aussehen als unter geschlossenen Trades. Mit `var(--surface)` ist der Hintergrund
immer gleich — unabhaengig von Trade-Status oder Position in der Liste.

**Verifikation:** `npm run build` erfolgreich ohne TypeScript-Fehler durchgelaufen (47 Seiten generiert).

## Abweichungen vom Plan

Keine — Plan wurde exakt wie spezifiziert umgesetzt. 1 Zeile geandert.

## Bedrohungsanalyse (Threat Flags)

Keine neuen Sicherheits-relevanten Oberflachen eingefuhrt. Reine CSS-Variable-Anpassung ohne Logik- oder Datenpfad-Anderungen.

## Self-Check

**Status:** PASSED

- [x] SUMMARY.md erstellt: `.planning/phases/04-performance-abschluss/04-03-SUMMARY.md`
- [x] Commit a54f901 existiert
- [x] `npm run build` ohne Fehler
- [x] 1 Zeile geandert (minimal)
- [x] borderBottom konsistent fuer alle Trade-Status

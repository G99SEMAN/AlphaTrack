# Phase 2: Bridge-Bereinigung - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 liefert: Eine selbstverwaltende Bridge-UI — die Bridge erscheint und verschwindet automatisch ohne manuellen Eingriff, das Trash-Icon ist entfernt, der Bridge-Log zeigt nur noch bridge-eigene Einträge ohne Bot-Filter, und die Bridge-Settings-Seite ist vollständig entfernt.

**Requirements:** BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04

</domain>

<decisions>
## Implementation Decisions

### Auto-Discovery (BRIDGE-01)
- **D-01:** Timeout-basiert: Wenn das `lastHeartbeat`-Feld im Bot-Status älter als **30 Sekunden** ist, gilt die Bridge als getrennt und wird aus der UI ausgeblendet.
- **D-02:** Die Logik sitzt im **BotStatusContext (Frontend)** — kein Backend-Eingriff nötig. Beim Poll-Interval (5s) wird geprüft: `Date.now() - new Date(lastHeartbeat).getTime() > 30000`.
- **D-03:** Bridge verschwindet **komplett** aus der Liste — kein Offline-Marker, keine Anzeige im getrennten Zustand.
- **D-04:** Das Trash-Icon (BRIDGE-02) wird entfernt — Löschen-Button und `deleteBot()`-Funktion aus `BridgeClient.tsx` raus.

### Log-Filter Bereinigung (BRIDGE-03)
- **D-05:** Den **gesamten Bot-Filter-Bereich** entfernen — "Alle Bots"-Button und alle per-Bot-Filter-Buttons fallen weg.
- **D-06:** `botFilter`-State, `setBotFilter`-Logik und die zugehörige Filterzeile in `BridgeLogClient.tsx` komplett entfernen.
- **D-07:** Level-Filter (Info/Warn/Error) und Suchfeld bleiben unverändert erhalten.
- **D-08:** Bridge-Log lädt nur noch Logs von Bridge-Bots (type === 'bridge' oder kein type) — keine Bot-Logs werden geladen.

### Settings-Seite Entfernen (BRIDGE-04)
- **D-09:** Die Seite `src/app/bridge/settings/` wird **vollständig gelöscht** (page.tsx + BridgeSettingsClient.tsx). Next.js zeigt automatisch 404 wenn die Route aufgerufen wird.
- **D-10:** Der Sidebar-Link `{ href: '/bridge/settings', ... }` in `src/components/layout/Sidebar.tsx` wird entfernt.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planung & Requirements
- `.planning/ROADMAP.md` — Phase 2 Goal, Success Criteria, Requirements-Liste
- `.planning/REQUIREMENTS.md` — BRIDGE-01 bis BRIDGE-04 Definitionen

### Kern-Dateien (lesen, dann ändern)
- `src/app/bridge/BridgeClient.tsx` — Bridge-Hauptkomponente; Trash-Icon und `deleteBot()` hier entfernen
- `src/app/bridge/log/BridgeLogClient.tsx` — Bridge-Log; `botFilter`-State und Bot-Filter-UI entfernen
- `src/app/bridge/log/page.tsx` — Lädt Logs für alle Bots; auf Bridge-only einschränken
- `src/components/layout/Sidebar.tsx` — Sidebar-Link zu `/bridge/settings` entfernen (Zeile 34)
- `src/context/` — BotStatusContext; hier Timeout-Logik für Auto-Discovery einbauen

### Zu löschende Dateien
- `src/app/bridge/settings/page.tsx` — Bridge-Settings-Seite (BRIDGE-04)
- `src/app/bridge/settings/BridgeSettingsClient.tsx` — Bridge-Settings-Client (BRIDGE-04)

### Architektur-Referenz (Phase 1)
- `.planning/phases/01-datenkorrektheit/01-CONTEXT.md` — D-15: Cache-Invalidierung nach Mutations (`_botsCache = null`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useBotStatus()` in `src/context/` — pollt alle 5s; Timeout-Check für Auto-Discovery hier einbauen (lastHeartbeat vergleichen)
- `filterBridge()` in `BridgeClient.tsx` — filtert bereits nach type='bridge'; Muster für Log-Page übernehmen
- `addBridgeLogEntry()` in `src/lib/bot-data.ts` — Logging-Pattern für alle Bridge-Aktionen

### Established Patterns
- **Cache-Invalidierung:** `_botsCache = null` nach `saveBots()` — zwingend bei allen Mutations (aus Phase 1)
- **Atomic Writes:** Alle Datei-Schreiboperationen via temp+rename
- **Filter-Bereinigung Phase 1:** `tradesSync`-Feld aus 4 Komponenten entfernt — analoges Muster für botFilter

### Integration Points
- `BotStatusContext` → Timeout-Filter für Auto-Discovery (lastHeartbeat > 30s → Bridge nicht anzeigen)
- `BridgeLogClient.tsx` → `botFilter`-State entfernen, `filtered`-Logik vereinfachen
- `Sidebar.tsx` Zeile 34 → Bridge-Settings-Link entfernen

</code_context>

<specifics>
## Specific Ideas

- Der 30s-Timeout entspricht 6 verpassten Heartbeats (bei 5s Interval) — reaktionsschnell genug für echte Disconnects, toleriert kurze Netzwerkstörungen nicht.
- Bridge Settings 404: Kein Redirect, einfach Dateien löschen — Next.js handhabt das automatisch.

</specifics>

<deferred>
## Deferred Ideas

None — Diskussion blieb innerhalb des Phase-2-Scopes.

</deferred>

---

*Phase: 2-Bridge-Bereinigung*
*Context gathered: 2026-06-10*

# Phase 1: Datenkorrektheit - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 liefert: korrekte Trade-Attribution (jeder Trade trägt eine `sourceId`), korrekten Trade-Status (geschlossene Trades werden als closed gespeichert) und bereinigte Zähler (NET-01, SYNC-01). Dies ist das Fundament aller nachgelagerten Statistiken, P&L-Anzeigen und Bot-Performance-Daten.

**Requirements:** TRADES-01, TRADES-02, TRADES-03, NET-01, SYNC-01

</domain>

<decisions>
## Implementation Decisions

### Datenreparatur-Strategie
- **D-01:** Alle bestehenden Trades werden rückwirkend korrigiert — nicht nur neue Trades ab sofort.
- **D-02:** Datenquelle für Korrekturen: Bridge-Heartbeat (liefert aktuell offene MT5-Positionen).
- **D-03:** Trigger: Automatisch beim nächsten eingehenden Bridge-Heartbeat — kein manueller Eingriff nötig.
- **D-04:** Trades die in AlphaTrack als offen gespeichert sind, aber nicht mehr in den MT5-Positionen auftauchen → als `closed` markieren.

### Quell-Erkennungsmechanismus
- **D-05:** Quelle eines eingehenden Trades wird per API-Key des Bots bestimmt. Jeder Bot hat einen eigenen API-Key in `data/bots.json`. `isValidApiKey()` in `src/lib/auth.ts` ist bereits vorhanden.
- **D-06:** Trade-Executor = Bridge selbst → `sourceId = 'bridge/tradeexecuter'`. Bots = separate Prozesse → `sourceId = botId` (aus bots.json).
- **D-07:** Neues Feld `sourceId: string` wird zum Trade-Typ in `src/types/trade.ts` hinzugefügt. Kein bestehendes Feld wird missbraucht.
- **D-08:** TRADES-03 wird in der Python-Bridge umgesetzt: Die Bridge schreibt `/bridge/tradeexecuter` in den MT5-Kommentar, wenn sie einen Trade via Trade-Executor ausführt. AlphaTrack liest diesen Kommentar nur noch.

### Trade-Status-Erkennung
- **D-09:** Die Bridge sendet ein explizites Close-Event an AlphaTrack, wenn ein Trade in MT5 geschlossen wird.
- **D-10:** Das Close-Event enthält: MT5-Ticket-ID, Exit-Preis, Close-Zeit.
- **D-11:** Heartbeat-Abgleich als Fallback: Beim Bridge-Heartbeat werden alle offenen AlphaTrack-Trades mit den aktuellen MT5-Positionen verglichen. Trades die nicht mehr in MT5 existieren, werden als closed markiert. Das deckt alte Trades ohne Close-Event ab.
- **D-12:** Exit-Preis und realisierter P&L aus dem Close-Event werden in den Trade übernommen (überschreibt ggf. kalkulierten P&L).

### Netzwerk-Mismatch & Sync-Zähler
- **D-13:** NET-01 löst sich durch korrekte sourceId-Attribution: Die Bot-Ansicht filtert auf Bot-spezifische Trades (sourceId = botId). Der Researcher soll `src/app/netzwerk/page.tsx` und die Bot-Ansicht analysieren um zu bestätigen dass der Mismatch durch korrekte Attribution behoben wird.
- **D-14:** SYNC-01: Researcher analysiert zuerst wo und wie der Sync-Zähler hochgezählt wird. Falls er keinen echten Mehrwert hat (analog zum leeren `Synced`-Feld in BOTS-02), wird er entfernt. Falls er einen Wert hat, wird die Logik korrigiert.

### Architektur-Constraint (zwingend beachten)
- **D-15:** Nach jeder Mutation an Trades oder Bots müssen die Module-Level-Caches invalidiert werden: `_statsCache = null` nach `saveTrades()`, `_botsCache = null` und `_botsWithStatusCache = null` nach `saveBots()`. Gilt für alle Fixes in dieser Phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planung & Requirements
- `.planning/ROADMAP.md` — Phase 1 Goal, Success Criteria, Requirements-Liste
- `.planning/REQUIREMENTS.md` — TRADES-01, TRADES-02, TRADES-03, NET-01, SYNC-01 Definitionen
- `.planning/PROJECT.md` — Core Value, Architectural Constraints (Cache-Invalidierung als bekannte Schwachstelle)

### Kern-Dateien (lesen, dann ändern)
- `src/types/trade.ts` — Trade-Typ Definition — hier wird `sourceId: string` hinzugefügt
- `src/lib/data.ts` — Trade CRUD, `saveTrades()`, `computeStats()`, `_statsCache`
- `src/lib/bot-data.ts` — Bot Config, `_botsCache`, `addBridgeLogEntry()`, `getBots()`
- `src/lib/auth.ts` — `isValidApiKey()`, `isSameOriginRequest()` — Quelle via API-Key bestimmen

### Bridge-API-Endpunkte
- `src/app/api/bridge/` — Alle Bridge-Endpunkte (heartbeat, command, status)
- `src/app/api/bridge/command/route.ts` — Muster für eingehende Bridge-Calls
- `bridge/` — Python-Bridge Quellcode — für TRADES-03 (MT5-Kommentar setzen)

### Netzwerk & Bot-Ansicht
- `src/app/netzwerk/page.tsx` — Researcher soll analysieren was genau bei NET-01 gezählt wird
- `src/app/bots/page.tsx` — Bot-Ansicht für Positions-/Trade-Zählung

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isValidApiKey()` in `src/lib/auth.ts` — API-Key-Validierung bereits vorhanden; gibt true/false zurück. Muss erweitert werden um die zugehörige botId zurückzugeben.
- `atomicWrite()` in `src/lib/fs-utils.ts` — MUSS für alle Datei-Mutations genutzt werden.
- `addBridgeLogEntry()` in `src/lib/bot-data.ts` — Logging für alle Bridge-Aktionen.
- `saveTrades()` in `src/lib/data.ts` — Bestehende Schreibfunktion für Trades; nach Aufruf `_statsCache = null` setzen.

### Established Patterns
- **Atomic Writes:** Alle Datei-Schreiboperationen via temp-file-then-rename (nicht direkt schreiben).
- **Cache-Invalidierung:** Nach jeder Mutation auf `null` setzen: `_statsCache`, `_botsCache`, `_botsWithStatusCache`.
- **API-Key Auth:** `src/lib/auth.ts` validiert Keys timing-safe — Muster für neue Endpunkte übernehmen.
- **Error Handling:** try-catch mit Fallback auf leeres Array / null; API-Routes geben NextResponse mit Status-Codes zurück.

### Integration Points
- Heartbeat-Endpunkt (in `src/app/api/bridge/`) — Muss erweitert werden um Trade-Status-Abgleich durchzuführen
- Trade-Empfangs-Endpunkt — Muss `sourceId` aus API-Key ableiten und im Trade speichern
- Close-Event-Endpunkt — Neuer oder erweiterter Endpunkt für Bridge-Close-Events
- `src/types/trade.ts` — Ein neues Feld `sourceId: string` (optional für Rückwärtskompatibilität)

</code_context>

<specifics>
## Specific Ideas

- Der Bridge-Heartbeat ist der zentrale Trigger für rückwirkende Korrekturen — kein separates Migrations-Script nötig.
- TRADES-03 wird in Python implementiert (nicht in AlphaTrack) — der Researcher soll den `bridge/`-Ordner auf den relevanten Trade-Executor-Code untersuchen.
- Der Sync-Zähler (SYNC-01) soll bevorzugt entfernt werden, wenn er keinen sichtbaren Mehrwert hat — analog zur BOTS-02-Entscheidung (leeres Synced-Feld entfernen in Phase 3).

</specifics>

<deferred>
## Deferred Ideas

None — Diskussion blieb innerhalb des Phase-1-Scopes.

</deferred>

---

*Phase: 1-Datenkorrektheit*
*Context gathered: 2026-06-09*

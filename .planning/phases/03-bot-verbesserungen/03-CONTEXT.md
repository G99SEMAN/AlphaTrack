# Phase 3: Bot-Verbesserungen - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 liefert: Korrekte Bot-Metriken in der Bot-Karte (offene Positionen aus Trade-Daten, realisierter P&L, Trade-Anzahl) und eine bereinigten Bot-Settings-Seite (Umbenennen und Entfernen entfernt, dafür editierbare Bot-Parameter mit Bestätigen-Button).

**Requirements:** BOTS-01, BOTS-02, BOTS-03, BOTS-04, BOTS-05, BOTS-06, BOTS-07, BOTS-08

**Voraussichtlich bereits erledigt (Researcher soll verifizieren):**
- BOTS-02 (Synced-Feld): `BotsClient.tsx` zeigt kein Synced-Feld mehr — wurde in Phase 1 Plan 01-03 entfernt
- BOTS-05 (Auto-Discovery): `BotStatusContext.tsx` filtert bereits nach `HEARTBEAT_TIMEOUT_MS = 30_000` (Phase 2) — für Bots-Liste bereits wirksam. Researcher soll prüfen ob Settings-Seite ebenfalls filtert.

</domain>

<decisions>
## Implementation Decisions

### Metriken-Datenquelle (BOTS-01, BOTS-03, BOTS-04)
- **D-01:** Metriken (offene Positionen, P&L, Trade-Anzahl) werden **server-seitig aus den Trade-Daten berechnet** — nicht aus dem Heartbeat-Payload. Heartbeat meldet openPositions aktuell als 0 (BOTS-01 Root Cause); sourceId ist nach Phase 1 verlässlich.
- **D-02:** Neuer API-Endpunkt **`/api/bots/:id/stats`** berechnet: openCount (Status=open), tradeCount (gesamt), realizedPnl (Summe closed-Trades). Passt zum bestehenden Muster `/api/bots/:id/log`.
- **D-03:** Für die Trade-Filterung wird **`bot.profileId`** verwendet — liest `data/trades-{bot.profileId}.json` und filtert nach `sourceId === botId`.

### P&L-Definition (BOTS-03)
- **D-04:** Nur **realisierter P&L**: Summe des `pnl`-Felds aller Trades mit `sourceId = botId` und `status = 'closed'`.
- **D-05:** Anzeige als **Betrag mit Vorzeichen + Farbe**: `+142.50 EUR` in grün / `-23.10 EUR` in rot. Konsistent mit Trading-Journal-Darstellung.
- **D-06:** Bot ohne geschlossene Trades → **"-" anzeigen** (nicht "0.00 EUR") — unterscheidbar von echtem Null-P&L.

### Bot-Parameter (BOTS-08)
- **D-07:** Flexibler **Key-Value-Store**: `parameters?: Record<string, string | number | boolean>` — kein festes Schema, Bot definiert welche Parameter er hat.
- **D-08:** Bot meldet seine aktuellen Parameter im **Heartbeat-Payload** (neues optionales Feld `parameters` in `BotStatus`). AlphaTrack zeigt sie an.
- **D-09:** Parameter-Updates werden per neuem **Command-Typ `'set_parameters'`** über den bestehenden `/api/bridge/command` Endpunkt gesendet. Payload: `{ parameters: Record<string, string|number|boolean> }`.
- **D-10:** UI-Rendering per **Typ-Inferenz**: `number` → `<input type="number">`, `boolean` → Toggle/Checkbox, `string` → `<input type="text">`. Kein Schema vom Bot nötig.
- **D-11:** Wenn Bot keine Parameter im Heartbeat meldet: **Info-Text anzeigen** — „Dieser Bot unterstützt keine konfigurierbaren Parameter". Nicht ausblenden, nicht als Fehler behandeln.

### Settings-Seite Umbau (BOTS-06, BOTS-07)
- **D-12:** Pencil-Button (Namens-Bearbeitung, BOTS-07) und Trash-Button (Entfernen, BOTS-06) werden aus `BotsSettingsClient.tsx` **vollständig entfernt** — inkl. `editing`-State, `saveEdit()`, `deleteBot()`.
- **D-13:** Bot-Info (Name, URL) bleibt **read-only sichtbar** — kein reiner Parameter-Editor ohne Kontext wer der Bot ist.
- **D-14:** Settings-Seite zeigt nur **verbundene Bots** (gleicher Heartbeat-Timeout-Filter wie BotStatusContext). Offline-Bots können Parameter-Commands sowieso nicht empfangen.
- **D-15:** Pro Bot ein **eigener „Parameter senden"-Button** (kein globaler Speichern-Button für alle Bots).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planung & Requirements
- `.planning/ROADMAP.md` — Phase 3 Goal, Success Criteria, Requirements-Liste (BOTS-01 bis BOTS-08)
- `.planning/REQUIREMENTS.md` — BOTS-01 bis BOTS-08 Definitionen
- `.planning/PROJECT.md` — Core Value, Architectural Constraints (Cache-Invalidierung)

### Bot-UI (lesen, dann ändern)
- `src/app/bots/BotsClient.tsx` — Bot-Karten; Balance → P&L ersetzen, Trade-Anzahl hinzufügen, `/api/bots/:id/stats` aufrufen
- `src/app/bots/settings/BotsSettingsClient.tsx` — Settings; Pencil + Trash entfernen, Parameter-Editor einbauen
- `src/app/bots/[id]/BotDetailClient.tsx` — Bot-Detail; Namens-Bearbeitung hier ebenfalls prüfen (BOTS-07)

### Daten-Layer (lesen, dann ändern)
- `src/types/bot.ts` — `BotStatus` Interface → `parameters?`-Feld hinzufügen; `BotCommandType` → `'set_parameters'` hinzufügen
- `src/lib/bot-data.ts` — Bot-Config, `_botsCache`, Cache-Invalidierungs-Pattern; Heartbeat-Handler liest neues `parameters`-Feld
- `src/lib/data.ts` — `getProfileTrades()`, `computeStats()` — Pattern für Trade-Filterung nach sourceId

### API-Endpunkte (Pattern-Referenz)
- `src/app/api/bots/[id]/log/route.ts` — Pattern für neuen `/api/bots/:id/stats` Endpunkt
- `src/app/api/bridge/command/route.ts` — Bestehender Command-Queue Endpunkt; hier wird `'set_parameters'`-Command validiert und weitergeleitet

### Context (Heartbeat-Timeout-Filter)
- `src/context/BotStatusContext.tsx` — `HEARTBEAT_TIMEOUT_MS = 30_000`; Settings-Seite soll gleiche Filterlogik anwenden

### Architektur-Referenz (Prior Phases)
- `.planning/phases/01-datenkorrektheit/01-CONTEXT.md` — D-07: sourceId-Feld am Trade, D-15: Cache-Invalidierung (`_botsCache = null`, `_statsCache = null`)
- `.planning/phases/02-bridge-bereinigung/02-CONTEXT.md` — D-01/D-02: HEARTBEAT_TIMEOUT_MS = 30s Auto-Discovery Pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Stat` component in `BotsClient.tsx` (Zeile ~201) — wiederverwendbare Stats-Kachel (label + value); Trade-Anzahl und P&L können als neue `<Stat>` Instanzen hinzugefügt werden
- `useBotStatus()` in `src/context/BotStatusContext.tsx` — pollt alle 5s; stellt aktuelle Bot-Liste inkl. Heartbeat-Timestamp bereit
- `filterBots()` in `BotsClient.tsx` — `type === 'bot' && connectionState !== 'offline'` — gleiche Logik für Settings anwenden
- `addBridgeLogEntry()` in `src/lib/bot-data.ts` — Logging-Pattern für alle Bot-Aktionen
- `currencySymbol()` in `src/lib/currency.ts` — Währungssymbol für P&L-Anzeige

### Established Patterns
- **Cache-Invalidierung:** `_botsCache = null` nach `saveBots()`, `_statsCache = null` nach `saveTrades()` — zwingend bei allen Mutations (Phase 1 D-15)
- **Atomic Writes:** Alle Datei-Schreiboperationen via `atomicWrite()` in `src/lib/fs-utils.ts`
- **API-Endpunkt Pattern:** `src/app/api/bots/[id]/log/route.ts` zeigt wie ein per-Bot-Endpunkt aussieht — für `/stats` übernehmen
- **Heartbeat-Timeout-Filter:** `BotStatusContext.tsx:38-41` — `Date.now() - new Date(lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS`
- **P&L-Farbanzeige:** Trading-Journal (`src/app/journal/`) zeigt P&L mit grün/rot — gleiche CSS-Variablen (`var(--green)`, `#ef4444`) verwenden

### Integration Points
- `BotStatus` → neues optionales Feld `parameters?: Record<string, string|number|boolean>` (abwärtskompatibel: `?`)
- `BotCommandType` → `'set_parameters'` hinzufügen (Union Type in `src/types/bot.ts`)
- `BotsClient.tsx` → Stats-Grid um P&L und Trade-Anzahl erweitern, Stats-Endpoint alle 8s pollen (analog zum bestehenden Refresh)
- `BotsSettingsClient.tsx` → `editing`-State, `saveEdit()`, `deleteBot()`-Funktion und ihre UI entfernen; Parameter-Editor-Sektion hinzufügen
- Heartbeat-Endpunkt (`src/app/api/bridge/heartbeat/`) → `parameters`-Feld aus Payload in `BotStatus` speichern
- `/api/bridge/command` → `'set_parameters'` als validen Command-Typ akzeptieren und an Bot weiterleiten

</code_context>

<specifics>
## Specific Ideas

- Der `/api/bots/:id/stats`-Endpunkt gibt zurück: `{ openCount: number, tradeCount: number, realizedPnl: number, currency: string }` — currency aus Profil, damit P&L korrekt formatiert werden kann.
- `BotCommandType` ist ein Union-Type-String — `'set_parameters'` einfach zur Union hinzufügen; `TradeOrderPayload` als Muster für `SetParametersPayload` verwenden.
- Bot-Settings: Das `editing`-State-Objekt hat aktuell `id`, `name`, `url` — nach Entfernen von Pencil komplett obsolet. Gesamte Edit-State-Logik löschen.
- Typ-Inferenz in der Parameter-UI: `typeof value === 'number'` / `typeof value === 'boolean'` reicht für die drei Fälle.

</specifics>

<deferred>
## Deferred Ideas

None — Diskussion blieb innerhalb des Phase-3-Scopes.

</deferred>

---

*Phase: 3-Bot-Verbesserungen*
*Context gathered: 2026-06-11*

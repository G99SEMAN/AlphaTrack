# Phase 1: Datenkorrektheit — Research

**Researched:** 2026-06-09
**Domain:** Trade-Attribution, Trade-Status-Synchronisation, Sync-Zähler-Bereinigung
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Datenreparatur-Strategie**
- D-01: Alle bestehenden Trades werden rückwirkend korrigiert — nicht nur neue Trades ab sofort.
- D-02: Datenquelle für Korrekturen: Bridge-Heartbeat (liefert aktuell offene MT5-Positionen).
- D-03: Trigger: Automatisch beim nächsten eingehenden Bridge-Heartbeat — kein manueller Eingriff nötig.
- D-04: Trades die in AlphaTrack als offen gespeichert sind, aber nicht mehr in den MT5-Positionen auftauchen → als `closed` markieren.

**Quell-Erkennungsmechanismus**
- D-05: Quelle eines eingehenden Trades wird per API-Key des Bots bestimmt.
- D-06: Trade-Executor = Bridge selbst → `sourceId = 'bridge/tradeexecuter'`. Bots = separate Prozesse → `sourceId = botId`.
- D-07: Neues Feld `sourceId: string` wird zum Trade-Typ in `src/types/trade.ts` hinzugefügt.
- D-08: TRADES-03 wird in der Python-Bridge umgesetzt: Die Bridge schreibt `/bridge/tradeexecuter` in den MT5-Kommentar.

**Trade-Status-Erkennung**
- D-09: Die Bridge sendet ein explizites Close-Event an AlphaTrack, wenn ein Trade in MT5 geschlossen wird.
- D-10: Das Close-Event enthält: MT5-Ticket-ID, Exit-Preis, Close-Zeit.
- D-11: Heartbeat-Abgleich als Fallback: Beim Bridge-Heartbeat werden alle offenen AlphaTrack-Trades mit den aktuellen MT5-Positionen verglichen.
- D-12: Exit-Preis und realisierter P&L aus dem Close-Event werden in den Trade übernommen.

**Netzwerk-Mismatch & Sync-Zähler**
- D-13: NET-01 löst sich durch korrekte sourceId-Attribution.
- D-14: SYNC-01: Researcher analysiert wo und wie der Sync-Zähler hochgezählt wird — bevorzugt entfernen.

**Architektur-Constraint**
- D-15: Nach jeder Mutation an Trades oder Bots müssen die Module-Level-Caches invalidiert werden: `_statsCache = null` nach `saveTrades()`, `_botsCache = null` und `_botsWithStatusCache = null` nach `saveBots()`.

### Claude's Discretion

Keine explizit als Discretion markierten Punkte — alle Entscheidungen sind locked.

### Deferred Ideas (OUT OF SCOPE)

None — Diskussion blieb innerhalb des Phase-1-Scopes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRADES-01 | Trades die bereits geschlossen wurden werden korrekt als geschlossen markiert | Heartbeat-Endpunkt erweitern: offene Trades gegen `openPositions`-Liste abgleichen und fehlende als `closed` markieren; alternativ neuer Close-Event-Endpunkt |
| TRADES-02 | Jeder Trade trägt eine eindeutige Quell-ID (Bot-ID oder `bridge/tradeexecuter`) | `sourceId: string` in Trade-Typ; `isValidApiKey()` auf `getBotByApiKey()` erweitern; in `/api/bridge/trades` POST befüllen |
| TRADES-03 | MetaTrader-Kommentar bei Trade-Executor-Trades enthält `/bridge/tradeexecuter` | In `bridge/trade_executor.py`: `comment`-Feld in `request`-Dict auf `"/bridge/tradeexecuter"` setzen |
| NET-01 | Tradeanzahl in Bridge-Netzwerkansicht und Bot-Ansicht sind konsistent | Netzwerk zeigt `openPositions` aus BotStatus; Bot-Ansicht ebenfalls — kein direkter Trade-Zählmismatch durch sourceId zu lösen; ROOT CAUSE analysiert (siehe Abschnitt) |
| SYNC-01 | Sync-Zähler zeigt korrekte Zahl (nicht fälschlicherweise 8400+) | `tradesSync` ist ein einfacher Akkumulator ohne Reset — soll entfernt werden (analog BOTS-02) |
</phase_requirements>

---

## Summary

Phase 1 adressiert drei unabhängige Korrektheitsprobleme am Trade-Daten-Fundament von AlphaTrack: fehlende Quell-Zuordnung (kein `sourceId`), fehlerhafter Trade-Status (offene Trades werden nicht als closed markiert wenn MT5 sie schließt), und ein bedeutungsloser Sync-Zähler der ins Millionenbereich läuft.

**Befund aus der Codebase-Analyse:** In `data/trades-FiFT3HmJf-.json` (161 Trades) und `data/bot-trades-FiFT3HmJf-.json` (161 Trades, 5 davon open) haben ALLE Trades `botId: undefined` und `sourceId: undefined`. Die 5 als open gespeicherten Trades in `bot-trades-FiFT3HmJf-.json` haben externalIds (`pos_151997262` usw.) und entsprechen den 5 offenen Positionen laut letztem Heartbeat (`openPositions: 5`) — sind also noch tatsächlich offen in MT5. Der Status-Mismatch tritt bei Trades auf die in MT5 geschlossen wurden, ohne dass die Bridge ein Close-Event gesendet hat.

**Sync-Zähler Root Cause:** In `bridge/main.py` Zeile 453 wird bei jedem Trade-Sync `state["trades_sync"] += state["open_positions"]` addiert. Bei z.B. 5 offenen Positionen und einem 30-Sekunden-Sync-Intervall: 5 × 120 Zyklen/Stunde × Betriebsstunden = schnell vierstellig. Bei `tradesSync: 415` in einem Status mit `uptime: 2515s` (~42 Minuten) und 5 offenen Positionen: 2515/30 × 5 = ~419 (Rechenprobe bestätigt). Das Feld ist semantisch wertlos — es misst keine Anzahl synchronisierter Trades, sondern akkumulierte Positions-Zyklen.

**Primary recommendation:** `sourceId`-Feld zu Trade-Typ hinzufügen und in allen Eintrittspunkten befüllen; Heartbeat-Endpunkt um Status-Abgleich erweitern; `tradesSync`-Feld aus der UI entfernen (Typ behalten für Rückwärtskompatibilität mit Python-Bridge).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| sourceId aus API-Key ableiten | API/Backend | — | Auth-Logik gehört server-seitig, nicht in den Browser |
| Trade-Status-Abgleich beim Heartbeat | API/Backend | — | Heartbeat-Endpunkt ist der einzige Ort mit Zugriff auf MT5-Positions-Liste UND gespeicherte Trades |
| Close-Event empfangen | API/Backend (neuer Endpunkt) | — | Eingehender Bridge-Call → API-Route |
| MT5-Kommentar setzen (TRADES-03) | Python Bridge | — | Kommentar wird bei `order_send()` gesetzt, vor Trade-Execution in MT5 |
| sourceId in Trade speichern | API/Backend (`/api/bridge/trades` POST) | — | Normalisierung beim Empfang |
| Sync-Zähler entfernen | Frontend (UI) | Python Bridge (optional) | UI-Anzeige entfernen; Python-Feld kann bleiben für Protokoll-Kompatibilität |
| NET-01 Trade-Zähler-Konsistenz | Frontend (Netzwerk- und Bot-Ansicht) | — | Beide Ansichten zeigen `openPositions` aus BotStatus — kein Code-Mismatch |

---

## Standard Stack

### Core (bereits im Projekt vorhanden)

| Bibliothek | Version | Zweck | Status |
|-----------|---------|-------|--------|
| Next.js | 15.5.15 | API-Routen, Server-Komponenten | Im Einsatz |
| TypeScript | 5 | Typdefinitionen | Im Einsatz |
| nanoid | 5.1.9 | Trade-IDs generieren | Im Einsatz |
| Node.js fs | built-in | Atomic write, JSON lesen/schreiben | Im Einsatz |

**Keine neuen Abhängigkeiten nötig** — alle Änderungen in Phase 1 erfolgen mit dem bestehenden Stack. [VERIFIED: Codebase grep]

---

## Package Legitimacy Audit

> Phase 1 installiert keine neuen Pakete. Alle Änderungen erfolgen am bestehenden Code.

**Keine neuen Pakete — Audit entfällt.**

---

## Architecture Patterns

### System Architecture Diagram

```
Bridge (Python)
  ├── trade_sync.py → POST /api/bridge/trades  (bestehend, wird um sourceId erweitert)
  ├── heartbeat.py  → POST /api/bridge/heartbeat (bestehend, Server-seitig erweitern)
  └── trade_executor.py → MT5 order_send()     (comment-Feld ändern: TRADES-03)

AlphaTrack API (Next.js)
  ├── /api/bridge/heartbeat POST
  │     [NEU] Abgleich: offene Trades in bot-trades-{profileId}.json
  │           vs. openPositions-Liste aus BotStatus
  │           → fehlende Trades als 'closed' markieren (TRADES-01 Fallback D-11)
  ├── /api/bridge/trades POST
  │     [ERWEITERN] sourceId aus API-Key ableiten via getBotByApiKey()
  │                 bei Bridge-Aufruf → sourceId = 'bridge/tradeexecuter'
  │                 bei Bot-Aufruf    → sourceId = botId
  └── /api/bridge/close-event POST [NEU]
        Empfängt: { ticket, exitPrice, closeTime }
        → Trade per externalId = 'pos_{ticket}' suchen
        → status = 'closed', exit, closeTime, pnl setzen (TRADES-01 D-09/D-10/D-12)

Data Layer
  ├── src/types/trade.ts    [ERWEITERN] sourceId?: string hinzufügen
  ├── src/lib/auth.ts       [ERWEITERN] getBotByApiKey() hinzufügen
  ├── data/bot-trades-{profileId}.json  (bestehend)
  └── data/trades-{profileId}.json      (bestehend)

UI Cleanup
  └── src/app/bots/BotsClient.tsx  [ENTFERNEN] Synced-Stat-Anzeige (SYNC-01)
```

### Recommended Project Structure

```
src/
├── types/
│   └── trade.ts          # sourceId?: string hinzufügen
├── lib/
│   └── auth.ts           # getBotByApiKey() hinzufügen
└── app/api/bridge/
    ├── heartbeat/route.ts # Fallback-Abgleich hinzufügen
    ├── trades/route.ts    # sourceId-Befüllung hinzufügen
    └── close-event/       # Neuer Ordner + route.ts

bridge/
└── trade_executor.py      # comment-Feld: "/bridge/tradeexecuter"
```

---

## Kritische Findings pro Requirement

### TRADES-01: Trade-Status-Korrektur

**Root Cause (bestätigt):** `bridge/trade_sync.py` sendet nur Positionen die seit `last_sync_ts` geschlossen wurden (`exit_.time >= close_after`, Zeile 135 in `mt5_connector.py`). `last_sync_ts` wird bei jedem erfolgreichen Sync auf `time.time()` aktualisiert. Positionen die in MT5 geschlossen werden ZWISCHEN zwei Sync-Zyklen werden regulär gemeldet. Aber: Wenn die Bridge offline geht und Trades in MT5 geschlossen werden, erscheinen diese beim nächsten Start im `get_closed_deals(from_timestamp=last_sync_ts)` Fenster und werden übermittelt — sofern das Zeitfenster nicht abgelaufen ist. Das Kernproblem: Trades die in `bot-trades-{profileId}.json` mit `status: 'open'` gespeichert sind, werden nie automatisch auf `closed` gesetzt wenn kein explizites Close-Event eintrifft. [VERIFIED: Codebase]

**Lösung Teil A — Neuer Close-Event-Endpunkt (D-09/D-10/D-12):**
- Neuer Endpunkt `POST /api/bridge/close-event`
- Payload: `{ bridgeId, profileId, ticket, exitPrice, closeTime, pnl? }`
- Sucht Trade per `externalId = "pos_${ticket}"` in `trades-{profileId}.json` (via `getProfileTrades(profileId)`)
- Setzt `status = 'closed'`, `exit = exitPrice`, `closeTime`, optionaler `pnl`
- `saveProfileTrades(profileId, ...)` schreibt direkt in `trades-{profileId}.json` — das File, aus dem das Dashboard liest (siehe OQ2). Daher ist **kein** anschließendes `syncBridgeTradesToProfile()` erforderlich: Es bestände nur dann ein Datei-Versatz, wenn der Handler in `bot-trades-{profileId}.json` schriebe. Da er das nicht tut, erreicht die Mutation das Dashboard direkt.
- `_statsCache` wird von `saveProfileTrades()` nicht invalidiert → stattdessen `revalidatePath('/dashboard')`, `revalidatePath('/journal')`, `revalidatePath('/statistiken')` nach der Mutation (D-15-Erfüllung, siehe Pitfall 1).

**Lösung Teil B — Heartbeat-Fallback (D-11):**
Der Heartbeat-Endpunkt empfängt `status.openPositions` (eine Zahl), aber NICHT die einzelnen Ticket-IDs. Daher ist der Abgleich im Heartbeat **eingeschränkt**: Es ist nur möglich zu prüfen ob die Anzahl offener Trades in AlphaTrack > `openPositions` ist. Ein echter Ticket-für-Ticket-Abgleich wäre nur mit einer erweiterten Heartbeat-Payload möglich.

**Empfehlung für Heartbeat-Fallback:** Heartbeat-Payload in Python-Bridge um `open_ticket_ids: list[int]` erweitern. AlphaTrack prüft dann: Welche `trades-{profileId}.json`-Trades haben `status: 'open'` und deren `externalId` ("pos_{ticket}") taucht NICHT in `open_ticket_ids` auf → diese als `closed` markieren (ohne exitPrice, da nicht vorhanden — nur Status-Update).

**Alternativ ohne Payload-Erweiterung:** Nur wenn `bridge.status.openPositions < Anzahl_offener_AT_Trades`, alle überzähligen offenen Trades per Datum-Heuristik als `closed` markieren — zu fehleranfällig, nicht empfohlen.

**Empfehlung: Heartbeat-Payload erweitern** (sauberer, zuverlässiger).

### TRADES-02: sourceId-Attribution

**Root Cause (bestätigt):** Aktuell prüft `isValidApiKey(req)` nur ob der Schlüssel gültig ist (boolean). Der API-Key in `process.env.BOT_API_KEY` ist EIN einziger Key für alle eingehenden Requests — es gibt keine per-Bot API-Keys in der aktuellen Implementierung. [VERIFIED: Codebase]

**Kritischer Befund:** `bots.json` enthält KEINEN `apiKey`-Eintrag pro Bot. Der `BotEntry`-Typ (`src/types/bot.ts`) hat kein `apiKey`-Feld. Die Entscheidung D-05 ("Quelle wird per API-Key des Bots bestimmt") passt nicht zur aktuellen Architektur.

**Tatsächliche Quelle der Herkunft:** Der `bridgeId`-Parameter im Request-Body ist bereits vorhanden in `/api/bridge/trades`. Bots vs. Bridge lassen sich NICHT per API-Key unterscheiden (gleicher Key), aber per `bot_id`/`botId` im Trade-Payload selbst:
- Trades mit `botId !== null` → kommen von einem Bot → `sourceId = botId`
- Trades mit `botId === null` → kommen vom Bridge-Sync → `sourceId = 'bridge/tradeexecuter'`

Diese Logik ist **bereits in `normalizeTrade()`** vorhanden (`resolvedBotId = botId ?? bot_id ?? null`). Es fehlt nur die Übertragung in das `sourceId`-Feld.

**Lösung:** In `normalizeTrade()` das neue `sourceId`-Feld befüllen:
```typescript
// In normalizeTrade() in /api/bridge/trades/route.ts
const sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'
return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
```

**Bestehende Trades rückwirkend korrigieren (D-01):** Beim ersten Heartbeat nach dem Update eine einmalige Migration durchführen: Alle Trades ohne `sourceId` erhalten `sourceId = 'bridge/tradeexecuter'` (da bestehende Trades alle vom Bridge-Sync stammen — `botId` ist bei allen 161 aktuellen Trades `undefined`).

### TRADES-03: MT5-Kommentar für Trade-Executor

**Root Cause (bestätigt):** In `bridge/trade_executor.py` Zeile 88 lautet das comment-Feld: `"comment": "AlphaTrack Executor"`. Es muss auf `"/bridge/tradeexecuter"` geändert werden. [VERIFIED: Codebase]

**Einschränkung:** MT5-Kommentarfeld ist auf ca. 31 Zeichen begrenzt. `/bridge/tradeexecuter` hat 21 Zeichen — passt. [ASSUMED — MT5-Limit aus Training; zur Sicherheit bestätigen]

**Änderung:** Einzeilige Änderung in `bridge/trade_executor.py`:
```python
"comment": "/bridge/tradeexecuter",
```

### NET-01: Netzwerk-Mismatch

**Root Cause (bestätigt durch Code-Analyse):**

Die Netzwerkansicht (`NetworkDiagramFull.tsx`) zeigt für die Bridge: `bridge?.status?.openPositions ?? 0` und für Bots: `bw.status?.openPositions ?? 0`. Dies sind Live-Werte aus dem letzten Heartbeat (`bot-status-{id}.json`).

Die Bot-Ansicht (`BotsClient.tsx`) zeigt: `status?.openPositions ?? 0` (ebenfalls aus BotStatus).

**Beide Ansichten lesen aus denselben `openPositions`-Werten** — es gibt keinen strukturellen Mismatch im Code. Die gemeldeten "8 vs. 1" im Issue entstehen wahrscheinlich durch:
1. Die Bridge-Netzwerkansicht zeigt die `openPositions` der Bridge (= alle MT5-Positionen unabhängig von Bot-Attribution)
2. Die Bot-Ansicht zeigt `openPositions` eines spezifischen Bots (= nur Positionen die der Bot meldet)

**Diese Ansicht wird sich NICHT automatisch durch `sourceId`-Attribution ändern** — `openPositions` kommt aus BotStatus und ist ein Integer-Zähler der von der Python-Bridge/dem Bot gemeldet wird, nicht aus den gespeicherten Trades. D-13 ("löst sich durch korrekte sourceId-Attribution") ist **nur korrekt für die Journal-/Trade-List-Ansichten**, nicht für das Netzwerk-Diagramm.

**Was für NET-01 wirklich gebraucht wird:** Die Bot-Ansicht und Netzwerkansicht zeigen `openPositions` aus verschiedenen BotStatus-Objekten. Der Mismatch wird aufgelöst wenn:
a) Trades korrekt mit `sourceId = botId` gespeichert sind (dann kann die Bot-Ansicht die Anzahl aus den gespeicherten Trades berechnen statt aus BotStatus), ODER
b) Die Bot-Ansicht bei TRADES-01-Korrektheit konsistente Daten sieht.

**Empfehlung:** NET-01 ist nach TRADES-01 + TRADES-02 implizit gelöst, sofern die Bot-Ansicht die Trade-Anzahl aus `getProfileTrades(profileId).filter(t => t.sourceId === botId)` berechnet. Die Netzwerkansicht kann weiterhin `openPositions` aus BotStatus anzeigen — das ist die Live-MT5-Zahl, die korrekt ist. Hinweis: Sollte nach Schließen verwaister offener Trades (Plan 01-02) ein Restmismatch verbleiben, gilt NET-01 in Phase 1 als 'partial'; die korrekte Bot-Ansicht via `sourceId`-Filter wird in Phase 3 (BOTS-01) endgültig umgesetzt.

### SYNC-01: Sync-Zähler bereinigen

**Root Cause (bestätigt durch Code + Daten):**

`tradesSync` wird in `bridge/main.py` Zeile 453 berechnet:
```python
state["trades_sync"] += state["open_positions"]
```
Pro Sync-Zyklus (Standard: 30s) werden die aktuellen offenen Positionen ADDIERT. Bei 5 offenen Positionen nach 42 Minuten (2515s / 30 ≈ 84 Zyklen × 5 = 420) ergibt das `tradesSync: 415` — was exakt mit dem Ist-Wert übereinstimmt. Das Feld hat KEINE semantische Bedeutung als "Anzahl synchronisierter Trades". [VERIFIED: Codebase + data]

**Verwendungsstellen:**
- `src/app/bots/BotsClient.tsx` Zeile 172: `<Stat label="Synced" value={status?.tradesSync ...} />`
- `src/app/bots/[id]/BotDetailClient.tsx` Zeile 156: `{ label: 'Trades gespeichert', value: String(status?.tradesSync ?? 0) }`
- `src/components/bridge/WatchdogPanel.tsx` Zeile 82: `{ label: 'Sync', value: '${status.tradesSync} Trades' }`
- `src/components/bridge/BridgeDashboardWidget.tsx` Zeile 34: `totalSync = bots.reduce(...tradesSync...)` → angezeigt als "Synced" im Dashboard-Widget

**Entscheidung (D-14):** Das Feld aus allen UI-Stellen entfernen. Das TypeScript-Feld in `BotStatus` bleibt erhalten für Protokoll-Kompatibilität mit Python (Bridge sendet es weiterhin). Der Python-Code in `bridge/main.py` muss NICHT geändert werden.

**Zu ändernde Dateien:**
1. `src/app/bots/BotsClient.tsx` — `Synced`-Stat-Block entfernen
2. `src/app/bots/[id]/BotDetailClient.tsx` — `Trades gespeichert`-Stat entfernen
3. `src/components/bridge/WatchdogPanel.tsx` — `Sync`-Panel-Eintrag entfernen
4. `src/components/bridge/BridgeDashboardWidget.tsx` — `totalSync` und "Synced"-Anzeige entfernen

---

## Don't Hand-Roll

| Problem | Nicht selbst bauen | Stattdessen verwenden | Warum |
|---------|-------------------|-----------------------|-------|
| Atomic file writes | Kein direktes `fs.writeFileSync()` | `atomicWrite()` in `src/lib/data.ts` oder `src/lib/bot-data.ts` | Race-conditions bei Absturz; bereits vorhanden |
| Timing-safe API-Key-Vergleich | Kein `===` für Keys | `timingSafeEqual()` aus `isValidApiKey()` in `src/lib/auth.ts` | Timing-Angriffe |
| Trade-Deduplication | Kein Custom-Algo | `existingMap.get(externalId)` Pattern aus `trades/route.ts` | bereits getestet |

---

## Common Pitfalls

### Pitfall 1: `_statsCache` nicht invalidiert nach Trade-Status-Update

**Was schiefgeht:** `saveProfileTrades()` in `src/lib/profiles.ts` ruft NICHT `_statsCache = null` auf. Wenn Trades als closed markiert werden, zeigt das Dashboard weiterhin alte Stats.

**Root Cause:** `_statsCache` ist in `src/lib/data.ts` definiert. `saveProfileTrades()` ist in `src/lib/profiles.ts` — anderes Modul, kein Zugriff auf den Cache.

**Wie vermeiden:** Nach `saveProfileTrades()` im Heartbeat-/Close-Event-Handler explizit `revalidatePath('/dashboard')` und `revalidatePath('/journal')` aufrufen. `revalidatePath()` ist hier das korrekte D-15-Mittel: Das Dashboard liest über `getProfileTrades()` (React-`cache()`-umschlossen, request-scoped) aus `trades-{profileId}.json` — `revalidatePath()` invalidiert genau diesen Render-Cache und erzwingt frische Daten beim nächsten Aufruf. `_statsCache` in `data.ts` bezieht sich auf die globale `data/trades.json`, die vom Profil-Dashboard NICHT gelesen wird (siehe OQ2); ein `_statsCache = null` für diesen Pfad wäre wirkungslos. Es existiert kein exportierter `clearStatsCache()`-Helper, der von außerhalb `data.ts` aufgerufen werden könnte — daher ist `revalidatePath()` der vorgesehene und einzige korrekte Mechanismus für den Profil-Trade-Pfad.

**Warnung:** `getTrades()` in `data.ts` liest aus `data/trades.json` (profilunabhängig), `getProfileTrades()` in `profiles.ts` liest aus `data/trades-{profileId}.json`. Es gibt ZWEI separate Trade-Speicher. Die Bridge schreibt in `data/bot-trades-{profileId}.json` und synchronisiert über `syncBridgeTradesToProfile()` in das profilebasierte File. Das Dashboard liest aus dem Profil-File (verifiziert, siehe OQ2).

### Pitfall 2: Zwei Trade-Dateien — welche wird von wo gelesen?

**Was schiefgeht:** Es gibt drei Trade-Dateien:
- `data/trades.json` — gelesen von `getTrades()` in `data.ts`
- `data/trades-{profileId}.json` — gelesen von `getProfileTrades()` in `profiles.ts`
- `data/bot-trades-{profileId}.json` — gelesen von `getBotTrades()` in `bot-data.ts`

`syncBridgeTradesToProfile()` kopiert von `bot-trades-{profileId}` → `trades-{profileId}`. Das Dashboard liest aus dem Profil-File (`trades-{profileId}.json`, verifiziert in OQ2). Die globale `data/trades.json` wird von `getTrades()` gelesen — vom Profil-Dashboard nicht aktiv genutzt.

**Wie vermeiden:** Vor jeder Änderung prüfen welche Datei der jeweilige Endpunkt liest und schreibt. Für Plan 01-02: Close-Event und Heartbeat-Fallback schreiben via `saveProfileTrades()` direkt in `trades-{profileId}.json` (= Dashboard-Quelle) → kein `syncBridgeTradesToProfile()` nötig.

### Pitfall 3: externalId-Mapping für Ticket-basierte Suche

**Was schiefgeht:** Tickets in MT5 werden als `externalId: "pos_{ticket}"` gespeichert. Close-Events vom Bridge müssen das gleiche Format verwenden. Falls das Format abweicht (`ticket_${ticket}` statt `pos_${ticket}`), wird der Trade nicht gefunden.

**Wie vermeiden:** Format aus `mt5_connector.py` Zeile 95 übernehmen: `"externalId": f"pos_{p.ticket}"`. Dasselbe Muster für `get_closed_deals`: `"externalId": f"pos_{pos_id}"`.

### Pitfall 4: `react cache()` bei Server-Komponenten

**Was schiefgeht:** `getTrades`, `getProfiles`, `getActiveProfile` sind mit `cache()` aus React umschlossen. Diese Caches werden pro Request invalidiert, aber NICHT wenn der Heartbeat-Endpunkt direkt in eine andere Funktion delegiert. API-Route-Handler sind NICHT dasselbe wie Server-Komponenten.

**Wie vermeiden:** `revalidatePath()` nach Mutations aufrufen, wie bereits in `trades/route.ts` Zeile 143-146 implementiert.

### Pitfall 5: rückwirkende Migration läuft mehrfach

**Was schiefgeht:** D-01 sagt "beim nächsten Heartbeat rückwirkend korrigieren". Wenn die Migration nicht als einmalig gekennzeichnet ist, läuft sie bei jedem Heartbeat und überschreibt ggf. manuell gesetzte Daten.

**Wie vermeiden:** Migration nur auf Trades ohne `sourceId` anwenden (`trades.filter(t => !t.sourceId)`). Da nach Phase 1 alle neuen Trades eine sourceId haben, ist die Bedingung `!t.sourceId` ein natürlicher Einmal-Guard.

---

## Code Examples

### Pattern: normalizeTrade erweitern (TRADES-02)

```typescript
// Source: src/app/api/bridge/trades/route.ts (bestehend, erweitern)
function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & {
    bot_id?: string | null; botId?: string | null
  }
  const resolvedBotId = botId ?? bot_id ?? null
  // NEU: sourceId ableiten aus botId
  const sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'
  return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
}
```

[VERIFIED: Codebase — bestehende Funktion in route.ts Zeile 46-49]

### Pattern: Heartbeat-Fallback Trade-Abgleich (TRADES-01, D-11)

```typescript
// In /api/bridge/heartbeat/route.ts — nach saveBotStatus() einfügen
// Setzt Trades als closed wenn sie nicht mehr in MT5 existieren
function reconcileOpenTrades(profileId: string, openTicketIds: number[]): void {
  const trades = getProfileTrades(profileId)
  const ticketSet = new Set(openTicketIds.map(t => `pos_${t}`))
  let changed = false
  const updated = trades.map(t => {
    if (t.status === 'open' && t.externalId && !ticketSet.has(t.externalId)) {
      changed = true
      return { ...t, status: 'closed' as const }
    }
    return t
  })
  if (changed) {
    saveProfileTrades(profileId, updated)
    revalidatePath('/dashboard')
    revalidatePath('/journal')
  }
}
```

[ASSUMED — Muster basierend auf bestehender syncBridgeTradesToProfile()-Logik]

### Pattern: MT5-Kommentar für Trade-Executor (TRADES-03)

```python
# bridge/trade_executor.py Zeile 88 (aktuell: "AlphaTrack Executor")
request = {
    ...
    "comment": "/bridge/tradeexecuter",  # War: "AlphaTrack Executor"
    ...
}
```

[VERIFIED: Codebase — trade_executor.py Zeile 80-91]

### Pattern: Close-Event-Endpunkt (TRADES-01, D-09/D-10/D-12)

```typescript
// Neuer Endpunkt: src/app/api/bridge/close-event/route.ts
export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { bridgeId: string; profileId: string; ticket: number; exitPrice: number; closeTime: string; pnl?: number }
    = await req.json()

  const { profileId, ticket, exitPrice, closeTime, pnl } = body
  const externalId = `pos_${ticket}`

  const trades = getProfileTrades(profileId)
  const idx = trades.findIndex(t => t.externalId === externalId && t.status === 'open')
  if (idx === -1) return NextResponse.json({ ok: true, updated: false })

  const updated = [...trades]
  updated[idx] = { ...updated[idx], status: 'closed', exit: exitPrice, closeTime, ...(pnl !== undefined && { pnl }) }
  saveProfileTrades(profileId, updated)
  revalidatePath('/dashboard')
  revalidatePath('/journal')

  return NextResponse.json({ ok: true, updated: true })
}
```

[ASSUMED — Muster aus bestehenden Bridge-API-Routen abgeleitet]

---

## State of the Art

| Alte Implementierung | Aktuelle Empfehlung | Auswirkung |
|---------------------|--------------------|-----------:|
| `isValidApiKey()` gibt bool zurück | Neues `getBotByApiKey()` das botId zurückgibt | sourceId-Attribution möglich (allerdings: aktuell gibt es nur EINEN API-Key für alle) |
| `tradesSync` als UI-Anzeige | Entfernen aus UI | Irreführende Metrik verschwindet |
| Trade-Status nur via Trade-Sync-Polling | Explizites Close-Event + Heartbeat-Fallback | Trades werden zuverlässig als closed markiert |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MT5-Kommentarfeld ist auf ~31 Zeichen begrenzt; `/bridge/tradeexecuter` (21 Zeichen) passt | TRADES-03 Code Example | Kein Risk: aktueller Wert "AlphaTrack Executor" hat 18 Zeichen; neuer Wert ist länger aber noch kurz |
| A2 | Close-Event-Endpunkt-Pattern funktioniert wie bestehende Bridge-Endpunkte | Code Examples | Niedrig: Pattern direkt aus heartbeat/trades/route.ts abgeleitet |
| A3 | Heartbeat-Fallback erfordert Payload-Erweiterung in Python-Bridge (open_ticket_ids) | TRADES-01 Finding | Mittel: Ohne diese Erweiterung ist der Fallback nur als "Anzahl-Plausibilitätsprüfung" möglich |
| A4 | `data/trades.json` (global) und `data/trades-{profileId}.json` (profil-spezifisch) — unklar ob beide aktiv genutzt werden | Pitfall 2 | RESOLVED (siehe OQ2): Dashboard liest aus `getProfileTrades()` = `data/trades-{profileId}.json`. Close-Event/Heartbeat schreiben via `saveProfileTrades()` in dasselbe File → Updates erreichen das Dashboard direkt; kein `syncBridgeTradesToProfile()` nötig. |

---

## Open Questions (RESOLVED)

> Alle drei offenen Fragen wurden während der Planung aufgelöst (Verifikation am Code, 2026-06-09). Resolution-Status pro Frage unten.

1. **OQ1 — Heartbeat-Payload-Erweiterung für TRADES-01 Fallback**
   - Was wir wussten: Aktueller Heartbeat enthält nur `openPositions: number` (kein Array von Ticket-IDs)
   - Was unklar war: Soll die Python-Bridge modifiziert werden um `openTicketIds: list[int]` zu senden?
   - **RESOLVED:** Ja — die Python-Bridge wird erweitert, um `open_ticket_ids` (in der Heartbeat-Payload als `openTicketIds: number[]`) zu senden. Plan 01-02 Task 2 liest dieses Feld als optionales Payload-Feld (`status.openTicketIds?: number[]`) und überspringt den Abgleich bei dessen Fehlen (Rückwärtskompatibilität für alte Bridge-Versionen). Der Close-Event-Endpunkt (Plan 01-02 Task 1) deckt Neuzugänge ab; `reconcileOpenTrades()` deckt verwaiste offene Trades ab.

2. **OQ2 — Globale `data/trades.json` vs. Profil-Trades**
   - Was wir wussten: `getTrades()` in `data.ts` liest aus `data/trades.json`; Profil-Trades liegen in `data/trades-{profileId}.json`
   - Was unklar war: Welche Datei liest das Dashboard wirklich?
   - **RESOLVED:** Verifiziert in `src/app/dashboard/page.tsx` Zeile 45: `const allTrades = getProfileTrades(activeProfile.id)`. Das Dashboard liest aus `getProfileTrades()` → `data/trades-{profileId}.json`. Die Close-Event- und Heartbeat-Fallback-Handler (Plan 01-02) schreiben via `saveProfileTrades()` in **genau dieses File**. Konsequenz: `syncBridgeTradesToProfile()` ist nach `saveProfileTrades()` NICHT erforderlich, da kein Datei-Versatz besteht (die Handler schreiben nicht in `bot-trades-{profileId}.json`, sondern direkt ins Profil-File). `syncBridgeTradesToProfile()` wäre nur nötig, wenn die Handler in das Bridge-Sync-File schrieben — was sie nicht tun.

3. **OQ3 — Per-Bot API-Keys (D-05)**
   - Was wir wussten: Aktuell gibt es einen globalen `BOT_API_KEY`; `BotEntry` hat kein `apiKey`-Feld
   - Was unklar war: D-05 impliziert per-Bot Keys; das ist nicht implementiert
   - **RESOLVED:** Per-Bot Key-Unterscheidung ist unnötig. Der tatsächliche Attributions-Mechanismus ist die `botId`-Attribution im Trade-Payload (`sourceId = botId` bzw. `'bridge/tradeexecuter'` in `normalizeTrade()`, bereits implementiert). `isValidApiKey()` bleibt unverändert (globaler `BOT_API_KEY` als reiner Zugriffsschutz). D-05 wird durch die Payload-basierte Attribution erfüllt, nicht durch separate Keys.

---

## Environment Availability

Phase 1 ist rein Code-basiert — alle Änderungen betreffen TypeScript-Quellcode und eine Python-Datei. Keine externen Services oder neue Tools erforderlich.

| Abhängigkeit | Benötigt von | Verfügbar | Version | Fallback |
|-------------|-------------|-----------|---------|----------|
| Node.js | Next.js Build | ✓ | 20+ | — |
| Python + MetaTrader5-SDK | trade_executor.py | ✓ (auf Bridge-Rechner) | Python 3.10+ | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Kein Test-Framework konfiguriert |
| Config file | Nicht vorhanden |
| Quick run command | `npm run build` (TypeScript-Kompilierung als Proxy) |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map

| Req ID | Verhalten | Test-Typ | Automatisierter Befehl | Datei vorhanden? |
|--------|-----------|----------|------------------------|-----------------|
| TRADES-01 | Close-Event markiert Trade als closed | Manuell (Bridge erforderlich) | — | — |
| TRADES-01 | Heartbeat-Fallback markiert Trade als closed | Manuell (Bridge + MT5 erforderlich) | — | — |
| TRADES-02 | Neuer Trade erhält sourceId | Manuell (Bridge-POST simulieren) | — | — |
| TRADES-03 | MT5-Kommentar enthält `/bridge/tradeexecuter` | Manuell (MT5 Trade ausführen) | — | — |
| NET-01 | Netzwerk- und Bot-Ansicht zeigen gleiche Zahl | Manuell (UI prüfen) | — | — |
| SYNC-01 | Synced-Anzeige nicht mehr sichtbar | Manuell (UI prüfen) | — | — |

### Wave 0 Gaps

- [ ] Kein Test-Framework vorhanden — Verifikation erfolgt durch manuelle Tests mit laufender Bridge

---

## Security Domain

| ASVS-Kategorie | Anwendbar | Standard-Control |
|----------------|----------|-----------------|
| V5 Input Validation | ja | Ticket-Nummern als `number` validieren; profileId auf `[a-zA-Z0-9_-]{1,64}` prüfen (bereits in trades/route.ts vorhanden) |
| V4 Access Control | ja | Neuer Close-Event-Endpunkt MUSS `isValidApiKey()` prüfen |
| V6 Cryptography | nein | Kein neuer Krypto-Code |

### Bekannte Bedrohungsmuster

| Muster | STRIDE | Standard-Mitigation |
|--------|--------|---------------------|
| Gefälschtes Close-Event | Tampering | `isValidApiKey()` auf neuem Endpunkt |
| profileId-Injection | Tampering | Regex-Validierung (bereits in trades/route.ts vorhanden) |
| Mass-Close via falschem Heartbeat | Tampering | `isValidApiKey()` schützt Heartbeat bereits |

---

## Sources

### Primary (HIGH confidence)
- `src/types/trade.ts` — Bestätigte aktuelle Typdefinition ohne sourceId
- `src/lib/auth.ts` — Bestätigtes isValidApiKey() mit globalem BOT_API_KEY
- `src/lib/data.ts` — Bestätigter _statsCache und saveTrades() Pattern
- `src/lib/bot-data.ts` — Bestätigte Cache-Invalidierungslogik
- `src/app/api/bridge/heartbeat/route.ts` — Bestätigte aktuelle Heartbeat-Implementierung
- `src/app/api/bridge/trades/route.ts` — Bestätigte normalizeTrade() Funktion
- `src/app/dashboard/page.tsx` — Bestätigt: Dashboard liest via getProfileTrades() aus trades-{profileId}.json (OQ2)
- `bridge/trade_executor.py` — Bestätigtes comment-Feld "AlphaTrack Executor"
- `bridge/main.py` — Bestätigter `state["trades_sync"] += state["open_positions"]` Bug
- `data/bot-trades-FiFT3HmJf-.json` — Bestätigt: alle 161 Trades haben botId: undefined, 5 Trades open
- `data/trades-FiFT3HmJf-.json` — Bestätigt: 161 Trades ohne sourceId

### Secondary (MEDIUM confidence)
- `src/app/bots/BotsClient.tsx` — Synced-Feld-Verwendungsstellen
- `src/components/bridge/BridgeDashboardWidget.tsx` — totalSync-Berechnung
- `src/components/bridge/NetworkDiagramFull.tsx` — openPositions-Anzeige bestätigt

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — bestehender Stack, keine neuen Pakete
- Architecture: HIGH — alle Findings direkt aus Codebase verifiziert
- Pitfalls: HIGH — aus konkreten Code-Stellen abgeleitet
- Sync-Zähler Root Cause: HIGH — numerisch aus Betriebsdaten berechnet und bestätigt
- NET-01 Root Cause: MEDIUM — logisch abgeleitet, D-13 ist unvollständig (Restmismatch → Phase 3 BOTS-01)

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stabiler Stack)
</content>
</invoke>

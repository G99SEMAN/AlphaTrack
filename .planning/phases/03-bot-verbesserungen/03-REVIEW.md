---
phase: 03-bot-verbesserungen
reviewed: 2026-06-11T20:31:00+02:00
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/types/bot.ts
  - src/app/api/bots/[id]/stats/route.ts
  - src/app/api/bridge/command/route.ts
  - src/app/bots/BotsClient.tsx
  - src/app/bots/settings/BotsSettingsClient.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-11T20:31:00+02:00
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Review umfasst die Typdefinitionen für das Bot-System (`bot.ts`), den Stats-API-Endpunkt, die Bridge-Command-Route, sowie die beiden Client-Komponenten `BotsClient.tsx` und `BotsSettingsClient.tsx`. Die kritischsten Befunde liegen in der Command-Route: ein fehlender Auth-Guard öffnet Endpunkt-Zugriff über den Command-Server, ein leerer `BOT_API_KEY` wird still akzeptiert, und nicht-trade-Befehle bei erreichbarer Bridge erzeugen kein Feedback über Fehlschläge. Im Frontend führt eine fehlende Abhängigkeit im `useEffect` zu Race-Conditions bei Bot-Listen-Wechseln.

---

## Critical Issues

### CR-01: `isSameOriginRequest` blockiert legitime mobile/PWA-Anfragen und ist kein ausreichender Auth-Guard für Commands

**File:** `src/app/api/bridge/command/route.ts:9`

**Issue:** `isSameOriginRequest()` prüft ausschließlich ob `origin === host`. Requests ohne `Origin`-Header (z.B. von Server-zu-Server-Calls, curl, Postman) werden mit `403` abgelehnt — korrekt für CSRF. **Jedoch:** Browser-Requests von einer anderen Port-Konfiguration (z.B. Docker `3002:3000`) haben `origin: http://localhost:3002` und `host: localhost:3000`, was die Prüfung dauerhaft abbricht. Das ist ein Deploymentproblem, das in Produktion die gesamte Command-Funktionalität lahmlegen kann. Außerdem ersetzt Same-Origin-Check keine echte Autorisierung: jeder Browser-Tab auf derselben Origin kann beliebige Bot-Commands (inkl. `execute_trade`) auslösen.

```ts
// auth.ts:15-25 — scheitert bei Port-Mapping (Docker)
return new URL(origin).host === host
// origin = "http://localhost:3002" → host "localhost:3002"
// host header   = "localhost:3000"
// → false → 403 für alle Commands in Docker-Deployment
```

**Fix:** Den `host`-Vergleich gegen eine konfigurierbare `NEXT_PUBLIC_APP_URL` env-Variable absichern. Für echte Authorization zusätzlich `isValidApiKey()` prüfen oder eine Session-basierte Prüfung einführen:

```ts
// command/route.ts — kombinierter Guard
if (!isSameOriginRequest(req) && !isValidApiKey(req)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

### CR-02: Leerer `BOT_API_KEY` wird bei Flask-Aufruf still akzeptiert

**File:** `src/app/api/bridge/command/route.ts:73`

**Issue:** `process.env.BOT_API_KEY ?? ''` sendet einen leeren String als `X-Bot-Api-Key`-Header wenn die Umgebungsvariable nicht gesetzt ist. Der Flask-Command-Server empfängt dann `X-Bot-Api-Key: ` (leer) und könnte — je nach Implementierung — den Request trotzdem akzeptieren oder zumindest nicht mit dem erwarteten Fehler ablehnen. Der API-Key-Schutz auf der Flask-Seite ist damit wirkungslos wenn der Key nicht konfiguriert ist, ohne dass AlphaTrack einen Fehler wirft.

```ts
// Zeile 73 — kein Guard auf leeren Key
'X-Bot-Api-Key': process.env.BOT_API_KEY ?? '',
```

**Fix:** Fehlenden Key frühzeitig erkennen und den Request abbrechen:

```ts
const botApiKey = process.env.BOT_API_KEY
if (!botApiKey) {
  console.error('[command] BOT_API_KEY nicht konfiguriert')
  return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
}
// ...
'X-Bot-Api-Key': botApiKey,
```

---

### CR-03: Nicht-trade Commands bei erreichbarer Bridge liefern immer `delivered: true` — auch bei HTTP-Fehler

**File:** `src/app/api/bridge/command/route.ts:79-93`

**Issue:** Der `try`-Block schickt den Fetch-Request zur Flask-Bridge. Für `execute_trade` und `close_position` wird der Response-Status ausgewertet (Zeilen 80-87). Für alle anderen Commands (`start`, `stop`, `pause`, `resume`, `restart`, `set_parameters`) fällt die Funktion nach dem Try-Block auf Zeile 93 durch: `return NextResponse.json({ ok: true, delivered: true, commandId: entry.id })` — **ohne den Flask-Response-Status zu prüfen**. Wenn die Bridge HTTP 500 oder 400 zurückgibt, meldet die API trotzdem `ok: true, delivered: true`. Fehler werden nicht geloggt.

```ts
// Zeilen 79-93
if (command === 'execute_trade' || command === 'close_position') {
  if (flaskRes.ok) { ... }
  // Fehlerbehandlung nur für diese zwei Commands
}
// catch: queued = true (Bridge nicht erreichbar)
// ↓ kein else/check für andere Commands:
return NextResponse.json({ ok: true, delivered: true, commandId: entry.id }) // falsch positiv
```

**Fix:** Flask-Response-Status für alle Commands prüfen:

```ts
if (!flaskRes.ok) {
  const errBody = await flaskRes.json().catch(() => ({})) as { error?: string }
  addBridgeLogEntry(bridgeId, 'error', `Command fehlgeschlagen: ${command}`, errBody.error ?? `HTTP ${flaskRes.status}`)
  return NextResponse.json({ ok: false, error: errBody.error ?? 'Bridge returned error' }, { status: 502 })
}
if (command === 'execute_trade' || command === 'close_position') {
  const result = await flaskRes.json()
  return NextResponse.json({ ok: true, delivered: true, commandId: entry.id, result })
}
return NextResponse.json({ ok: true, delivered: true, commandId: entry.id })
```

---

## Warnings

### WR-01: Stats-Polling an `bots`-State als Dependency verursacht Race-Condition / Endlos-Loop

**File:** `src/app/bots/BotsClient.tsx:96-116`

**Issue:** Das zweite `useEffect` (Stats-Polling) listet `bots` als Dependency. `bots` wird durch `refresh()` nach jedem Polling-Intervall (8s) neu gesetzt via `setBots()`. Das `useEffect` mit `[bots]` läuft bei jedem Bot-Listen-Wechsel neu an — es wird sofort gefetcht, und ein neues `setInterval` wird registriert. Das vorherige Interval wird zwar via `clearInterval` im Cleanup bereinigt, aber zwischen dem `fetchStats()`-Call und dem `setInterval`-Start gibt es keinen Schutz gegen überlappende Requests wenn `refresh()` und `fetchStats()` gleichzeitig feuern. Bei vielen Bots und langsamem Netz können so parallel laufende `fetchStats`-Calls das `stats`-State inkonsistent überschreiben.

```ts
useEffect(() => {
  // ...
  const id = setInterval(fetchStats, 8000)
  return () => clearInterval(id)
}, [bots]) // ← bots ändert sich alle 8s → Effect läuft neu
```

**Fix:** Stats-Polling vom `bots`-State entkoppeln. Bot-IDs als stabilen Key verwenden:

```ts
const botIds = bots.map(b => b.bot.id).join(',')
useEffect(() => {
  if (!botIds) return
  fetchStats()
  const id = setInterval(fetchStats, 8000)
  return () => clearInterval(id)
}, [botIds]) // stabile String-Dependency statt Array-Referenz
```

---

### WR-02: `filterBots` in `BotsSettingsClient` verwendet keine Refresh-Logik — Liste veraltet nach Verbindungsverlust

**File:** `src/app/bots/settings/BotsSettingsClient.tsx:15-17`

**Issue:** `BotsSettingsClient` filtert die Bot-Liste einmalig beim Mount (`useState(filterBots(initialBots))`) und hat kein Polling. Wenn ein Bot während der Nutzung die Verbindung verliert (`connectionState` wechselt zu `'offline'`), bleibt er in der Liste sichtbar und der User kann weiterhin Parameter senden — der Command wird aber von `pruneOldCommands` verarbeitet und die Bridge ist ggf. nicht erreichbar. Kein visuelles Feedback.

```ts
const [bots] = useState<BotWithStatus[]>(filterBots(initialBots))
// einmalig beim Mount, kein Refresh
```

**Fix:** Analog zu `BotsClient.tsx` ein Polling auf `/api/bridge/status` einführen und `setBots` beim Intervall aufrufen, oder als Minimum den `setBots`-Setter freigeben und bei Fehler eine Warnung rendern.

---

### WR-03: `parseFloat(e.target.value) || 0` ersetzt leere Eingabe durch `0` und lässt NaN nicht erkennen

**File:** `src/app/bots/settings/BotsSettingsClient.tsx:80`

**Issue:** `parseFloat(e.target.value) || 0` — wenn der User das Feld leert (typischer UX-Flow beim Überschreiben einer Zahl), wird sofort `0` in den Draft-State geschrieben. Das ist falsch-positives Verhalten: der User hat noch nicht fertig getippt. Außerdem ist `parseFloat('') || 0 === 0` und `parseFloat('abc') || 0 === 0` — beide Fehlerzustände werden identisch behandelt ohne visuelle Unterscheidung.

```ts
onChange={e => setDrafts(prev => ({
  ...prev,
  [botId]: { ...(prev[botId] ?? parameters), [key]: parseFloat(e.target.value) || 0 },
}))}
```

**Fix:** Draft-State als `string` für number-Inputs halten, Konvertierung erst beim Senden:

```ts
// Im Draft: string speichern
[key]: e.target.value,

// In sendParameters: konvertieren und validieren
const numVal = parseFloat(val as string)
if (isNaN(numVal)) {
  console.error(`[BotsSettings] Ungültiger Wert für ${k}`)
  return
}
```

---

### WR-04: `ticket: 0` wird von `close_position`-Validierung fälschlicherweise als fehlendes Ticket behandelt

**File:** `src/app/api/bridge/command/route.ts:37-39`

**Issue:** `if (!p?.ticket)` — Ticket-IDs sind MT5-Integer-Werte. Ticket `0` ist zwar kein valides MT5-Ticket, aber die Prüfung `!p.ticket` ist semantisch falsch: sie lehnt auch `ticket: 0` ab (falsy), statt explizit auf `undefined`/`null`/nicht-vorhanden zu prüfen. Zudem fehlt eine Prüfung ob `ticket` eine positive ganze Zahl ist — ein negativer oder nicht-ganzzahliger Wert wird akzeptiert und an Flask weitergereicht.

```ts
if (!p?.ticket) { // lehnt ticket=0 ab, akzeptiert ticket=-1
```

**Fix:**

```ts
if (p?.ticket === undefined || p.ticket === null || !Number.isInteger(p.ticket) || p.ticket <= 0) {
  return NextResponse.json({ error: 'close_position requires a positive integer ticket' }, { status: 400 })
}
```

---

## Info

### IN-01: `BotCommandType` in `BridgeCommandPayload` ist unvollständig genutzt

**File:** `src/types/bot.ts:113-116`

**Issue:** `BridgeCommandPayload` enthält nur `bridgeId` und `command`, aber kein `payload`-Feld, obwohl die Command-Route in `route.ts:13` einen optionalen `payload` erwartet. Der Payload-Typ existiert (`TradeOrderPayload`, `ClosePositionPayload`, `SetParametersPayload`), wird aber nicht in `BridgeCommandPayload` modelliert. Das Interface ist damit nutzlos als API-Kontrakt für Clients, die den Typ importieren.

**Fix:**

```ts
export interface BridgeCommandPayload {
  bridgeId: string
  command: BotCommandType
  payload?: TradeOrderPayload | ClosePositionPayload | SetParametersPayload
}
```

---

### IN-02: `filterBots`-Funktion in `BotsClient.tsx` ist closure ohne Stabilisierung — bei jedem Render neu erstellt

**File:** `src/app/bots/BotsClient.tsx:75-76`

**Issue:** `filterBots` wird als reguläre Funktion im Komponentenkörper definiert (nicht als `useCallback`). Das ist in diesem Fall harmlos da sie nicht als Dependency in Effects verwendet wird, aber es erzeugt bei jedem Render eine neue Funktionsreferenz und könnte beim Erwei­tern des Codes zu subtilen Bugs führen, wenn sie als Dependency hinzugefügt wird.

**Fix:** Als Modul-Level-Funktion auslagern (kein Closure-State benötigt):

```ts
// Außerhalb der Komponente
function filterBots(list: BotWithStatus[]): BotWithStatus[] {
  return list.filter(b => b.bot.type === 'bot' && b.status != null && b.status.connectionState !== 'offline')
}
```

---

_Reviewed: 2026-06-11T20:31:00+02:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

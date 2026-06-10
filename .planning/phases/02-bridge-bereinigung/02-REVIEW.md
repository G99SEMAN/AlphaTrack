---
phase: 02-bridge-bereinigung
reviewed: 2026-06-10T20:42:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/context/BotStatusContext.tsx
  - src/app/bridge/BridgeClient.tsx
  - src/app/bridge/log/BridgeLogClient.tsx
  - src/app/bridge/log/page.tsx
  - src/components/layout/Sidebar.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-10T20:42:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Fünf Dateien wurden im Rahmen der Bridge-Bereinigung (Phase 02) geprüft. Die Implementierung hat die UI-Bereinigung (Delete-Button-Entfernung, Bot-Filter-Entfernung) korrekt durchgeführt. Es wurden jedoch zwei kritische Fehler gefunden: ein destruktiver "Alle löschen"-Vorgang der alle Bots sequenziell und ohne atomare Fehlerbehandlung löscht, sowie eine Race-Condition beim Visibility-Change-Handler. Vier Warnungen betreffen fehlende Response-Validierung, einen Stale-Closure-Kandidaten, eine nicht abgesicherte Typenübernahme aus dem LocalStorage und einen fehlenden API-Fehlerfall beim Speichern des Bridge-Namens.

---

## Structural Findings (fallow)

Keine strukturellen Vorbefunde (kein `<structural_findings>`-Block übergeben).

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: "Alle löschen" löscht Bots sequenziell ohne atomare Fehlerbehandlung — Teillöschung möglich

**File:** `src/app/bridge/log/BridgeLogClient.tsx:453-456`

**Issue:** Der Confirm-Handler für `confirmClear === '__all__'` iteriert mit `for...of` + `await` sequenziell über alle Bots und ruft `handleClear` pro Bot auf. `handleClear` selbst setzt `setClearing(true)` und nach Abschluss `setClearing(false)` sowie `setConfirmClear(null)` im `finally`-Block. Beim ersten `handleClear`-Aufruf wird `setConfirmClear(null)` bereits gesetzt, obwohl noch weitere Bots zu löschen sind. Wenn ein mittlerer `fetch`-Aufruf fehlschlägt (netzwerkfehler, HTTP-Fehler ≠ ok), gibt es kein `if (!res.ok)` in `handleClear` — der lokale State `setLogs(prev => ({ ...prev, [botId]: [] }))` wird trotzdem ausgeführt (lokaler State divergiert von tatsächlichem Server-State). Zusätzlich: da `handleClear` `setConfirmClear(null)` und `setClearing(false)` im `finally` nach dem ersten Aufruf setzt, wird der Ladeindikator für alle Folgeoperationen nicht mehr angezeigt.

**Fix:**
```typescript
// handleClear: HTTP-Fehler explizit prüfen
async function handleClear(botId: string) {
  setClearing(true)
  try {
    const res = await fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(botId)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setLogs(prev => ({ ...prev, [botId]: [] }))
  } finally {
    setClearing(false)
    setConfirmClear(null)
  }
}

// "Alle löschen"-Handler: alle parallel, einmalig abschliessen
onClick={async () => {
  if (confirmClear === '__all__') {
    setClearing(true)
    try {
      await Promise.all(bots.map(bot =>
        fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(bot.id)}`, { method: 'DELETE' })
          .then(res => { if (res.ok) setLogs(prev => ({ ...prev, [bot.id]: [] })) })
      ))
    } finally {
      setClearing(false)
      setConfirmClear(null)
    }
  } else {
    await handleClear(confirmClear)
  }
}}
```

---

### CR-02: Race-Condition im Visibility-Change-Handler — doppelte Intervalle möglich

**File:** `src/context/BotStatusContext.tsx:53-59`

**Issue:** Im `visibilitychange`-Handler wird bei Sichtbarwerden des Tabs ein neues Intervall gestartet (`setInterval(poll, 5000)`), ohne sicherzustellen, dass kein Intervall mehr läuft. Wenn der Handler zwischen dem `clearInterval`-Aufruf und dem neuen `setInterval` mehrfach feuert (z. B. durch schnelles Tab-Wechseln oder durch Browser-interne Debounce-Fehler), kann `intervalRef.current` überschrieben werden, ohne das alte Intervall zu löschen. Das führt zu mehrfach laufenden Polling-Schleifen und damit zu erhöhter API-Last sowie potenziellen State-Update-Stürmen auf den Kontext-Subscribers.

**Fix:**
```typescript
const handleVisibilityChange = () => {
  if (document.hidden) {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  } else {
    // Sicherstellen, dass kein altes Intervall läuft
    if (intervalRef.current) clearInterval(intervalRef.current)
    void poll()
    intervalRef.current = setInterval(poll, 5000)
  }
}
```

---

## Warnings

### WR-01: `saveBridgeName` ignoriert HTTP-Fehlerstatus beider API-Aufrufe

**File:** `src/app/bridge/BridgeClient.tsx:43-64`

**Issue:** Die Funktion ruft nacheinander `PATCH /api/bots/${id}` und `POST /api/bridge/config` auf, prüft aber in keinem Fall `res.ok`. Bei einem HTTP-Fehler (z. B. 500, 404, 403) wird `setEditingName(false)` und `refresh()` trotzdem ausgeführt — der Nutzer sieht keine Fehlermeldung und glaubt, die Umbenennung sei erfolgreich gewesen.

**Fix:**
```typescript
async function saveBridgeName(id: string) {
  if (!nameInput.trim()) return
  setSavingName(true)
  try {
    const r1 = await fetch(`/api/bots/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    if (!r1.ok) throw new Error(`Bots-API Fehler: ${r1.status}`)

    const r2 = await fetch('/api/bridge/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bridge_name: nameInput.trim() }),
    })
    if (!r2.ok) throw new Error(`Bridge-Config Fehler: ${r2.status}`)

    setEditingName(false)
    refresh()
  } catch (e) {
    console.error('[BridgeClient] saveBridgeName fehlgeschlagen:', e)
    // Fehlermeldung im UI anzeigen (z. B. lokaler Fehlerstate)
  } finally {
    setSavingName(false)
  }
}
```

---

### WR-02: LocalStorage-Daten werden ohne Schema-Validierung direkt als Typ gecastet

**File:** `src/components/layout/Sidebar.tsx:117-120`

**Issue:** `loadSections()` liest den LocalStorage-Wert und castet ihn direkt mit `as { bridge: boolean; bots: boolean; weiteres: boolean }`. Wenn ein externer Akteur (anderer Tab, manueller DevTools-Eingriff, ältere App-Version mit anderem Schema) einen ungültigen Wert schreibt, kann das Objekt falsche Typen enthalten. Die Nutzung ohne Validierung propagiert möglicherweise `undefined`-Werte in das `sections`-State, was in den `||`-Ausdrücken in Zeile 129-133 durch falsy-Koaleszenz zufällig "funktioniert", aber semantisch unkorrekt ist (z. B. `undefined || false` statt einem erwarteten `boolean`).

**Fix:**
```typescript
function loadSections(): { bridge: boolean; bots: boolean; weiteres: boolean } | null {
  try {
    const s = localStorage.getItem(SECTIONS_KEY)
    if (!s) return null
    const parsed = JSON.parse(s)
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof parsed.bridge !== 'boolean' ||
      typeof parsed.bots !== 'boolean' ||
      typeof parsed.weiteres !== 'boolean'
    ) return null
    return parsed as { bridge: boolean; bots: boolean; weiteres: boolean }
  } catch { return null }
}
```

---

### WR-03: `fetchAll` in BridgeLogClient aktualisiert State nur wenn mindestens ein Bot antwortet — bei vollständigem Netzwerkausfall bleibt der alte State eingefroren

**File:** `src/app/bridge/log/BridgeLogClient.tsx:72-83`

**Issue:** `if (Object.keys(updated).length > 0) setLogs(prev => ({ ...prev, ...updated }))` — wenn alle Bots fehlschlagen (Netzwerk weg, alle `catch`-Blöcke greifen), wird `updated` leer bleiben und `setLogs` nie aufgerufen. Das ist korrekt für den "kein Update"-Fall, aber das Polling läuft trotzdem alle 10 Sekunden weiter ohne dem Nutzer irgendeinen Hinweis zu geben, dass die Daten veraltet sein könnten. Kombiniert mit dem fehlenden `res.ok`-Check: ein HTTP-500 lässt den Bot ebenfalls aus `updated` raus, ohne den Nutzer zu informieren.

**Fix:** Mindestens den `res.ok`-Zweig explizit behandeln und bei Fehlern einen optionalen Fehlerstate setzen, oder die letzte erfolgreiche Aktualisierungszeit im UI anzeigen (Datenpunkt für den Nutzer).

```typescript
const res = await fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(bot.id)}`)
if (res.ok) {
  updated[bot.id] = (await res.json()).log ?? []
} else {
  console.warn(`[BridgeLog] Fehler beim Laden für ${bot.id}: HTTP ${res.status}`)
}
```

---

### WR-04: `BotStatusContext` filtert Bots mit abgelaufenem Heartbeat aus dem State heraus — `BridgeClient` fällt auf SSR-Daten zurück, die nie aktualisiert werden

**File:** `src/context/BotStatusContext.tsx:38-41` / `src/app/bridge/BridgeClient.tsx:27-28`

**Issue:** In `BotStatusContext.poll()` werden Bots mit `lastHeartbeat` älter als `HEARTBEAT_TIMEOUT_MS` (30 Sekunden) aus `next` herausgefiltert. In `BridgeClient` gilt:

```typescript
const bots = contextBots.length > 0 ? contextBots : filterBridge(initial)
```

Wenn alle Bridge-Bots ihren Heartbeat überschreiten (z. B. Bridge kurz ausgefallen), wird `contextBots` leer und `bots` fällt dauerhaft auf `initial` (SSR-Snapshot) zurück. Diese SSR-Daten enthalten veralteten Status, werden aber für den gesamten Zeitraum des Ausfalls als "aktuell" dargestellt — `selected.status?.connectionState` zeigt dann nicht "offline", sondern den letzten bekannten Status. Der Nutzer sieht keine korrekte Verbindungsanzeige.

Die `HEARTBEAT_TIMEOUT_MS`-Filterung in `BotStatusContext` ist konzeptionell falsch platziert: der Client sollte nicht Bots aus dem State löschen, sondern ihre `connectionState` auf `'offline'` setzen (was `bot-data.ts:getConnectionState()` serverseitig bereits korrekt tut). Die clientseitige Duplizierung dieser Logik mit einem anderen Schwellenwert (30 s client vs. 45 s/120 s server) erzeugt inkonsistente Zustände.

**Fix:** Die Heartbeat-Filterung in `BotStatusContext` entfernen. Der `connectionState` kommt bereits korrekt vom Server-API:

```typescript
// poll(): keine Filterung, alle Bots beibehalten
const next = raw  // connectionState ist bereits 'offline' wenn Heartbeat zu alt
setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
```

---

## Info

### IN-01: Importiertes Icon `AlertTriangle` aus `lucide-react` — in aktueller Version umbenannt

**File:** `src/app/bridge/log/BridgeLogClient.tsx:7`

**Issue:** `lucide-react 1.11.0` (laut `package.json`) exportiert `TriangleAlert` als bevorzugten Namen; `AlertTriangle` ist als Alias noch vorhanden, kann aber in zukünftigen Versionen entfernt werden. Betrifft auch `Sidebar.tsx` indirekt über Icon-Import-Muster.

**Fix:** `AlertTriangle` durch `TriangleAlert` ersetzen, sobald ein lucide-react-Major-Update geplant ist. Kein sofortiger Handlungsbedarf.

---

### IN-02: `isActive`-Funktion in Sidebar verwendet `pathname.startsWith(href + '/')` — führt zu False-Positive bei `/bridge` vs. `/bridge/log`

**File:** `src/components/layout/Sidebar.tsx:54-59`

**Issue:** `/bridge` ist in `EXACT_MATCH` eingetragen, daher kein Problem für den Bridge-Hauptlink. Aber `/bridge/log` ist nicht in `EXACT_MATCH` — wenn der Nutzer auf `/bridge/log/detail` (hypothetischer künftiger Unterroute) navigiert, würde sowohl `/bridge/log` als auch `/bridge` (falls es nicht in EXACT_MATCH wäre) aktiv markiert. Aktuell korrekt durch `EXACT_MATCH`, aber die Logik ist fragil: neue Links müssen manuell in `EXACT_MATCH` eingetragen werden, sonst entstehen doppelt-aktive Highlights.

**Fix:** Die Abhängigkeit von `EXACT_MATCH` dokumentieren oder durch eine explizitere Matching-Strategie ersetzen (z. B. Tiefe der Route bestimmen).

---

_Reviewed: 2026-06-10T20:42:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

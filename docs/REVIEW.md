# AlphaTrack - Code Review

**Datum:** 2026-05-28
**Reviewer:** Claude (adversarial review)
**Tiefe:** deep (vollständige Cross-File-Analyse)
**Dateien geprüft:** 22

---

## Zusammenfassung

AlphaTrack ist insgesamt solide gebaut. Die Logik in `data.ts` und `statsExtended.ts` ist durchdacht und korrekt. Die kritischen Probleme betreffen vor allem Sicherheit (Path Traversal im Import-Endpoint, API-Key-Handling) und einen Logikfehler im Kalender-Wochenfilter. Die mittleren Probleme sind unkontrollierte FormData-Typen und ein falsch angezeigter Quellenname.

---

## HIGH - Kritische Fehler

### HIGH-01: Path Traversal möglich im Screenshot-Dateinamen (deleteScreenshotFile)

**Datei:** `src/lib/actions.ts` - Zeile 142-149

**Problem:** Die Funktion `deleteScreenshotFile` extrahiert den Dateinamen aus dem gespeicherten `screenshotPath`-String mit einem einfachen `replace('/api/screenshots/', '')`. Falls ein Trade-Eintrag in der JSON-Datenbank einen manipulierten `screenshot`-Pfad enthält (z.B. `../profiles.json` - erreichbar durch direktes Editieren der JSON-Datei oder einen kompromittierten Import), könnte `fs.unlinkSync` außerhalb des Screenshots-Verzeichnisses zuschlagen.

```ts
// Aktuell (unsicher):
const filename = screenshotPath.replace('/api/screenshots/', '')
const filepath = path.join(process.cwd(), 'data', 'screenshots', filename)

// Fix - Dateinamen nach dem Pfad-Bau gegen Basis-Verzeichnis prüfen:
const SCREENSHOTS_BASE = path.join(process.cwd(), 'data', 'screenshots')
const filename = path.basename(screenshotPath) // basename verhindert Directory Traversal
const filepath = path.join(SCREENSHOTS_BASE, filename)
if (!filepath.startsWith(SCREENSHOTS_BASE + path.sep)) return // paranoid check
```

---

### HIGH-02: `importSettingsAction` schreibt API-Keys ohne Validierung in .env.local

**Datei:** `src/lib/einstellungen-actions.ts` - Zeilen 42-51

**Problem:** Wenn der `bundle.apiKeys`-Payload einen ANTHROPIC_API_KEY enthält, wird dieser direkt in `.env.local` geschrieben - ohne Prüfung des Formats oder ob der Key tatsächlich valide ist. Da diese Server Action aus dem Browser aufrufbar ist (kein Auth-Guard vorhanden), kann ein Angreifer im Heimnetz beliebige Werte in `.env.local` schreiben. Die Werte werden als einfache `KEY=VALUE`-Zeilen eingefügt - ohne Escaping. Ein Key mit einem Newline-Zeichen würde beliebige weitere Umgebungsvariablen einschleusen.

```ts
// Fix - Key-Format validieren bevor Schreiben:
const ANTHROPIC_KEY_RE = /^sk-ant-[a-zA-Z0-9_-]{20,}$/
const TWELVE_KEY_RE = /^[a-zA-Z0-9]{20,}$/

if (bundle.apiKeys.ANTHROPIC_API_KEY) {
  if (!ANTHROPIC_KEY_RE.test(bundle.apiKeys.ANTHROPIC_API_KEY)) {
    return { success: false, ..., error: 'Ungültiges API-Key-Format' }
  }
  lines.push(`ANTHROPIC_API_KEY=${bundle.apiKeys.ANTHROPIC_API_KEY}`)
}
```

---

### HIGH-03: Wochenfilter in KalenderClient verwendet lokale Zeit, API liefert UTC-Datum

**Datei:** `src/components/wirtschaftskalender\KalenderClient.tsx` - Zeilen 10-19, 91-94

**Problem:** Die Funktion `getWeekBounds()` benutzt `now.getDay()` (lokale Zeitzone). In `wirtschaftskalender.ts` (Server) wird das Event-Datum mit `d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })` in Europe/Berlin-Zeit umgerechnet. Der Client-seitige Filter benutzt jedoch `new Date(e.date + 'T12:00:00')` ohne Zeitzone - das löst in JavaScript-Engines zu lokaler Zeit auf. Auf einem Windows-System in UTC+2 ist das unproblematisch, aber der `getWeekBounds`-Mittwoch wird durch `setDate(now.getDate() - day + offset * 7)` berechnet, wobei `setDate` in lokaler Zeit rechnet, während `getDate()` in lokaler Zeit ist. Das ist konsistent. Das eigentliche Problem: `sunday.setUTCDate(monday.getUTCDate() + 6)` - die Variable heißt `friday` (Zeile 18), ist aber `sunday` mit 6 Tagen Offset. Da Sonnabend und Sonntag herausgefiltert werden sollen, wäre `+4` für Freitag korrekt - Events am Samstag/Sonntag erscheinen trotzdem im "Diese Woche"-Filter.

```ts
// Variablenname ist irreführend - tatsächlich wird Sonntag berechnet, nicht Freitag:
const friday = new Date(monday)
friday.setDate(monday.getDate() + 6)  // Das ist Sonntag, nicht Freitag!
```

Lösungsvorschlag: Variable umbenennen zu `sunday` und sicherstellen, dass das gewollt ist (Wochenwirtschaftskalender endet Sonntag).

---

### HIGH-04: Unkontrollierte `as string`-Casts bei FormData ohne Nullcheck

**Datei:** `src/lib/actions.ts` - Zeilen 28-35, 59-66, 153-165, 179-185

**Problem:** `formData.get('name') as string` gibt `null` zurück, wenn das Feld fehlt - der TypeScript-Cast verschweigt das. Bei fehlenden Pflichtfeldern wird `null` als `"null"` in die JSON-Datei gespeichert (wegen JSON.stringify). Bei `parseFloat(null as unknown as string)` ergibt das `NaN`, was dann als `NaN` in JSON landet (wird zu `null` bei JSON.stringify).

Konkret betroffen: `startCapital: parseFloat(null as string)` ergibt `NaN` - JSON.stringify wandelt das zu `null` um. Das führt zu einer Profil-Datei mit `"startCapital": null`, was die gesamte ROI- und Drawdown-Berechnung zerstört (`startCapital = 0` im Fallback statt des echten Werts).

```ts
// Fix - explizite Validierung vor Datenbankschreiben:
const name = formData.get('name')
if (!name || typeof name !== 'string' || !name.trim()) {
  throw new Error('Profilname ist erforderlich')
}
const startCapitalRaw = formData.get('startCapital')
const startCapital = parseFloat(startCapitalRaw as string)
if (isNaN(startCapital) || startCapital < 0) {
  throw new Error('Startkapital ungültig')
}
```

---

## MEDIUM - Mittlere Probleme

### MEDIUM-01: Falsche Quellenangabe im UI - Daten kommen von tradays.com, nicht ForexFactory

**Datei:** `src/components/wirtschaftskalender/KalenderClient.tsx` - Zeile 244

**Problem:** Die Footer-Zeile zeigt `Quelle: ForexFactory`, aber die Daten werden tatsächlich von `tradays.com` bezogen (siehe `wirtschaftskalender.ts` Zeile 51). Das ist eine falsche Information für den Nutzer.

```tsx
// Aktuell (falsch):
{totalFiltered} Termine angezeigt - Quelle: ForexFactory

// Fix:
{totalFiltered} Termine angezeigt - Quelle: tradays.com
```

---

### MEDIUM-02: `ExplanationPanel` - `fetched`-Flag zurücksetzen bei Prop-Änderung fehlt

**Datei:** `src/components/wirtschaftskalender/ExplanationPanel.tsx` - Zeilen 54-74

**Problem:** Das `fetched`-Flag verhindert mehrfache API-Aufrufe korrekt. Wenn jedoch `eventTitle` sich ändert (z.B. weil eine Row reused wird - was React unter bestimmten Umständen tun kann), wird kein neuer Fetch ausgelöst, weil `fetched` immer noch `true` ist. Der `useEffect` hat `eventTitle` und `country` als Dependency, aber die Bedingung `if (!isExpanded || fetched) return` verhindert trotzdem den Re-Fetch.

```ts
// Fix - fetched zurücksetzen wenn sich der eventTitle ändert:
useEffect(() => {
  setFetched(false)
  setData(null)
  setError(false)
}, [eventTitle, country])
```

---

### MEDIUM-03: `computeStats` - `filterTradesByPeriod` gibt offene Trades immer zurück (potentieller Logikfehler)

**Datei:** `src/lib/data.ts` - Zeilen 131-132

**Problem:** Bei `filterTradesByPeriod` werden offene Trades (`t.status === 'open'`) immer zurückgegeben, unabhängig vom Period-Filter. Das bedeutet: Bei Filterung auf "heute" oder "diese Woche" erscheinen im Dashboard auch offene Trades, die vor Monaten eröffnet wurden. Das kann die angezeigte "Anzahl offener Trades" in bestimmten Contexts verzerren.

```ts
// Aktuell - offene Trades ignorieren den Filter:
return trades.filter(t => {
  if (t.status === 'open') return true  // immer true, ignoriert Zeitraum
  ...
})

// Ob dieses Verhalten gewollt ist, sollte überprüft werden.
// Falls nicht: Die 'open'-Bedingung entfernen oder separat behandeln.
```

---

### MEDIUM-04: `weekdayStats` - `new Date(t.date).getDay()` ist Timezone-sensitiv

**Datei:** `src/lib/statsExtended.ts` - Zeile 229

**Problem:** `new Date('2024-01-15').getDay()` gibt je nach lokaler Timezone unterschiedliche Werte zurück. Das ISO-Datum `'2024-01-15'` wird ohne Zeit-Anteil geparst, was in ECMAScript als UTC Mitternacht interpretiert wird. In Timezones west of UTC (z.B. UTC-5) würde `new Date('2024-01-15').getDay()` = Sonntag (0) zurückgeben statt Montag (1).

Das Tool läuft im Heimnetz (Deutschland = UTC+1/UTC+2), daher tritt der Fehler nicht auf - aber es ist technisch fragil.

```ts
// Fix - UTC-Methode verwenden:
const d = new Date(t.date + 'T12:00:00') // Mittag UTC verhindert Timezone-Drift
const weekday = d.getUTCDay()
```

---

### MEDIUM-05: `importSettingsAction` überschreibt `.env.local` vollständig statt zu mergen

**Datei:** `src/lib/einstellungen-actions.ts` - Zeilen 43-51

**Problem:** Beim Import-Restore wird `.env.local` komplett neu geschrieben mit nur den Keys aus dem Bundle. Wenn der Nutzer andere Umgebungsvariablen in `.env.local` hat (z.B. `NEXT_PUBLIC_*`), werden diese gelöscht.

```ts
// Fix - bestehende .env.local lesen und mergen:
import { existsSync, readFileSync } from 'fs'

const existingEnv: Record<string, string> = {}
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key?.trim()) existingEnv[key.trim()] = rest.join('=')
  }
}
if (bundle.apiKeys.ANTHROPIC_API_KEY) {
  existingEnv['ANTHROPIC_API_KEY'] = bundle.apiKeys.ANTHROPIC_API_KEY
}
// ...dann existingEnv zurückschreiben
```

---

### MEDIUM-06: `fetchFromClaude` - kein Timeout für Anthropic API-Aufruf

**Datei:** `src/app/api/wirtschaftskalender/erklaerung/route.ts` - Zeilen 34-58

**Problem:** Der Aufruf `client.messages.create(...)` hat kein Timeout. Hängt die Anthropic API, wartet der Next.js Route Handler unbegrenzt. Das kann bei hohem Traffic zu "exhausted connections" führen.

```ts
// Fix - AbortController mit Timeout:
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 15000)
try {
  const message = await client.messages.create({ ... }, { signal: controller.signal })
} finally {
  clearTimeout(timer)
}
```

---

### MEDIUM-07: Doppelter Code in `createProfileAction` und `addProfileFromModalAction`

**Datei:** `src/lib/actions.ts` - Zeilen 26-42 und 56-72

**Problem:** `createProfileAction` und `addProfileFromModalAction` sind identisch bis auf den abschließenden `redirect('/dashboard')`. Der Profile-Konstruktions-Code (ca. 12 Zeilen) ist 1:1 dupliziert. Bei zukünftigen Änderungen am Profil-Schema (z.B. neues Pflichtfeld) muss an zwei Stellen editiert werden.

```ts
// Fix - gemeinsame Hilfsfunktion extrahieren:
function buildProfileFromFormData(formData: FormData, id: string): Profile {
  return {
    id,
    name: formData.get('name') as string,
    type: formData.get('type') as 'live' | 'demo',
    ...
  }
}
```

---

## LOW - Schönheitsfehler

### LOW-01: Fehlende Umlaute in UI-Strings - BEREITS GEFIXT

**Datei:** `src/components/wirtschaftskalender/ExplanationPanel.tsx` - Zeile 103, 142
**Datei:** `src/components/statistiken/DirectionCards.tsx` - Zeile 77

**Problem:** Drei Strings enthielten fehlende Umlaute:
- "Keine Erklarung verfugbar" - fehlte ä und ü
- "Warum wichtig fur Trader?" - fehlte ü
- "Wahrung" - fehlte ä

**Status:** Direkt korrigiert zu "Keine Erklärung verfügbar", "Warum wichtig für Trader?" und "Währung".

---

### LOW-02: `InfluenceLines` - lookbehind-Regex (`(?<=\.)`) - Browser-Kompatibilität

**Datei:** `src/components/wirtschaftskalender/ExplanationPanel.tsx` - Zeile 22

**Problem:** `(?<=\.)` ist ein Lookbehind-Assertion. Diese wird von allen modernen Browsern unterstützt (Chrome 62+, Firefox 78+, Safari 16.4+). Für ein Heimnetz-Tool ist das unkritisch, aber Ältere Browser könnten Probleme haben.

**Vorschlag:** Optional durch eine einfachere Methode ersetzen:
```ts
const parts = einfluss.split(/\.\s+/).map((p, i, arr) => i < arr.length - 1 ? p + '.' : p)
```

---

### LOW-03: `WeekdayChart` - Y-Achsen-Formatter hardcoded auf `€`

**Datei:** `src/components/statistiken/WeekdayChart.tsx` - Zeile 27

**Problem:** `const formatTick = useCallback((v: number) => `${v >= 0 ? '+' : ''}${v}€`, [])` - das `€`-Zeichen ist hardcoded, obwohl das Diagramm `currency` als Prop erhält. `MonthlyPnlChart.tsx` hat denselben Fehler (Zeile 25).

```ts
// Fix - currency Prop nutzen:
const formatTick = useCallback((v: number) => `${v >= 0 ? '+' : ''}${v} ${currency}`, [currency])
```

---

### LOW-04: `data.ts` - Code-Kommentar enthält Tippfehler

**Datei:** `src/lib/data.ts` - Zeile 65

```ts
// Aktuell:
// Alle Ereignisse (Trades + Einzahlungen) chronologisch zusammenfuhren

// Fix:
// Alle Ereignisse (Trades + Einzahlungen) chronologisch zusammenführen
```

---

### LOW-05: `TradingViewWidget` - symbol hardcoded auf 'FX:EURUSD'

**Datei:** `src/components/analyse/TradingViewWidget.tsx` - Zeile 31

**Problem:** Das Symbol `'FX:EURUSD'` ist hardcoded und nicht als Prop übergeben. Der Nutzer kann es nicht wechseln. Da die Komponente `duration` und `theme` als Props hat, wäre `symbol` die logische nächste Erweiterung.

**Vorschlag:** `symbol` als optionale Prop hinzufügen (Default: `'FX:EURUSD'`).

---

### LOW-06: `KalenderClient` - Variablenname `friday` ist irreführend (zeigt auf Sonntag)

**Datei:** `src/components/wirtschaftskalender/KalenderClient.tsx` - Zeile 16-19

**Problem:** Die Variable heißt `friday`, wird aber mit `monday.getDate() + 6` berechnet - das ist Sonntag. Der Filter-Code funktioniert korrekt (Wochenkalender Mo-So), aber der Name ist irreführend.

```ts
// Aktuell:
const friday = new Date(monday)
friday.setDate(monday.getDate() + 6)

// Fix - korrekt benennen:
const sunday = new Date(monday)
sunday.setDate(monday.getDate() + 6)
return { start: monday, end: sunday }
```

---

### LOW-07: `profiles.ts` - `deleteProfile` löscht keine Screenshots

**Datei:** `src/lib/profiles.ts` - Zeilen 51-64

**Problem:** Beim Löschen eines Profils werden `trades-{id}.json` und `strategies-{id}.json` gelöscht, aber die zugehörigen Screenshot-Dateien im `data/screenshots/`-Verzeichnis bleiben erhalten. Das führt zu Datenmüll auf der Festplatte.

**Vorschlag:** Beim Profil-Löschen die Trade-Datei lesen, alle `screenshot`-Pfade sammeln und die Dateien löschen bevor `unlinkSync` auf die Trade-Datei aufgerufen wird.

---

## Bereits korrekt implementiert (keine Findings)

- **Atomic Writes** in `profiles.ts` (tmp-Datei + rename) - korrekt
- **R-Multiple-Berechnung** in `statsExtended.ts` - mathematisch korrekt
- **Drawdown-Berechnung** in `data.ts` - korrekt (peak-basiert)
- **Streak-Berechnung** in `data.ts` - korrekt (positiv/negativ)
- **Screenshot-Whitelist** `ALLOWED_IMAGE_EXTS` in `actions.ts` - korrekt
- **Filename-Validierung** in `screenshots/[filename]/route.ts` - Regex `/^[a-zA-Z0-9_-]+\.[a-zA-Z]{2,5}$/` ist korrekt
- **Dedup-Logik** im Wirtschaftskalender (Set-basiert) - korrekt
- **Promise.allSettled** statt Promise.all - korrekt (Fehlertoleranz)
- **Expectancy-Formel** `winRate * avgWin + (1-winRate) * avgLoss` - korrekt
- **ProfitFactor-Sentinel** (99 wenn keine Verluste) - korrekt

---

_Review erstellt: 2026-05-28_
_Reviewer: Claude (code-reviewer)_

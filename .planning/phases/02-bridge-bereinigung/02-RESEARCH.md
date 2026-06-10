# Phase 02: Bridge-Bereinigung — Research

**Researched:** 2026-06-10
**Domain:** Next.js 15 React Client Components — UI-Bereinigung, Timeout-basierte Auto-Discovery, State-Entfernung
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auto-Discovery (BRIDGE-01)**
- D-01: Timeout-basiert: Wenn `lastHeartbeat` älter als 30 Sekunden → Bridge gilt als getrennt und wird aus UI ausgeblendet
- D-02: Logik sitzt im BotStatusContext (Frontend) — kein Backend-Eingriff nötig. Check: `Date.now() - new Date(lastHeartbeat).getTime() > 30000`
- D-03: Bridge verschwindet komplett aus der Liste — kein Offline-Marker, keine Anzeige im getrennten Zustand
- D-04: Trash-Icon entfernen — Löschen-Button und `deleteBot()`-Funktion aus `BridgeClient.tsx` raus

**Log-Filter Bereinigung (BRIDGE-03)**
- D-05: Gesamten Bot-Filter-Bereich entfernen — "Alle Bots"-Button und alle per-Bot-Filter-Buttons
- D-06: `botFilter`-State, `setBotFilter`-Logik und Filterzeile in `BridgeLogClient.tsx` komplett entfernen
- D-07: Level-Filter (Info/Warn/Error) und Suchfeld bleiben unverändert erhalten
- D-08: Bridge-Log lädt nur noch Logs von Bridge-Bots (type === 'bridge' oder kein type)

**Settings-Seite Entfernen (BRIDGE-04)**
- D-09: `src/app/bridge/settings/` vollständig löschen (page.tsx + BridgeSettingsClient.tsx)
- D-10: Sidebar-Link `{ href: '/bridge/settings', ... }` in `src/components/layout/Sidebar.tsx` entfernen

### Claude's Discretion

Keine Discretion-Bereiche — alle Entscheidungen sind in D-01 bis D-10 verriegelt.

### Deferred Ideas (OUT OF SCOPE)

Keine — Diskussion blieb innerhalb des Phase-2-Scopes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRIDGE-01 | Bridge erscheint/verschwindet automatisch ohne manuelles Löschen | Timeout-Filter in BotStatusContext.tsx — `lastHeartbeat`-Feld im BotStatus-Typ vorhanden; Poll-Interval 5s bereits aktiv |
| BRIDGE-02 | Trash-Icon zum manuellen Löschen der Bridge ist entfernt | `deleteBot()`-Funktion (Zeile 43–47) und `<Trash2>`-Button (Zeilen 144–149) in BridgeClient.tsx identifiziert |
| BRIDGE-03 | Bridge-Log zeigt keinen "Alle Bots"-Filter | Bot-Filter-Block (Zeilen 241–269 in BridgeLogClient.tsx) und `botFilter`-State (Zeile 66) identifiziert; `initialLogs` in log/page.tsx lädt noch alle Bots |
| BRIDGE-04 | Bridge Settings Seite ist entfernt | Zwei Dateien zum Löschen: `settings/page.tsx` + `settings/BridgeSettingsClient.tsx`; Sidebar-Eintrag in BRIDGE_NAV-Array (Zeile 34) identifiziert |
</phase_requirements>

---

## Summary

Phase 2 ist eine reine Bereinigungsphase — kein neues Backend, keine neuen APIs, keine neuen Datenstrukturen. Alle vier Requirements sind ausschließlich Frontend-Eingriffe in vier bestehenden Dateien plus zwei zu löschende Dateien.

Die Auto-Discovery (BRIDGE-01/02) erfordert einen Timeout-Filter im `BotStatusContext`. Der Kontext pollt bereits alle 5 Sekunden `/api/bridge/status` und hat Zugriff auf `lastHeartbeat` im `BotStatus`-Typ. Die Entscheidung, offline-Bridges komplett zu verstecken (D-03), bedeutet: kein Offline-State, keine UI-Änderung — die Bridge verschwindet einfach aus `bots`. Der `selectedBotId`-Auto-Select (bestehende `useEffect` in BridgeClient Zeile 37–41) behandelt den Fall bereits korrekt, wenn der ausgewählte Bot nicht mehr in der Liste ist.

Die Log-Filter-Bereinigung (BRIDGE-03) ist eine State-Entfernung: `botFilter`-State, `setBotFilter`, der Filter-Block in der JSX und die Filterzeile in `filtered` (Zeile 107 `if (botFilter !== 'all') return false`) werden entfernt. Gleichzeitig muss `log/page.tsx` die `initialLogs`-Befüllung auf Bridge-Bots einschränken — Zeile 25 filtert `bots` bereits korrekt, aber `initialLogs` auf Zeile 22–24 iteriert über `allBots` (ungefiltert). Dies muss auf die gefilterte Liste umgestellt werden.

**Primäre Empfehlung:** Alle vier Eingriffe in separaten, atomaren Tasks ausführen — jeder Task berührt genau eine Datei bzw. löscht eine Datei. Kein Task hat Side-Effects auf andere Tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auto-Discovery / Timeout-Filter | Frontend (Client Context) | — | BotStatusContext ist der einzige Ort, der Poll-Daten hält; Backend liefert bereits `lastHeartbeat` |
| Trash-Icon Entfernung | Frontend (Client Component) | — | Rein visuelle + funktionale Bereinigung in BridgeClient.tsx |
| Bot-Filter-Entfernung (Log) | Frontend (Client Component) | Server Component (log/page.tsx) | State in BridgeLogClient.tsx; initialLogs-Befüllung in page.tsx |
| Settings-Seite löschen | Dateisystem + Frontend (Sidebar) | — | Next.js App Router: Route existiert nicht mehr wenn Verzeichnis fehlt |

---

## Standard Stack

Keine neuen Pakete erforderlich. Phase 2 verwendet ausschließlich den bestehenden Stack.

### Core (bereits installiert)
| Library | Version | Zweck | Verwendung in Phase 2 |
|---------|---------|-------|----------------------|
| React | 19.1.0 | Component-Framework | useState, useEffect, useCallback in bestehenden Komponenten |
| Next.js | 15.5.15 | App Router | Route-Löschung durch Dateisystem-Entfernung |
| TypeScript | 5 | Typsicherheit | Typ-Anpassung wenn `botFilter`-State entfernt wird |

**Keine npm install erforderlich.**

---

## Package Legitimacy Audit

Nicht anwendbar — Phase 2 installiert keine neuen Pakete.

---

## Architecture Patterns

### System Architecture Diagram

```
Poll (5s) → /api/bridge/status → BotStatusContext.poll()
                                        │
                                        ▼
                              setBots(next) ← fingerprint-Check
                                        │
                    ┌───────────────────┘
                    │  [NEU: Timeout-Filter hier]
                    │  filter: lastHeartbeat < 30s ago
                    ▼
              BridgeClient.tsx
              filterBridge(allBots) → bots (nur type='bridge')
                    │
                    ▼
              Tab-Leiste → [ohne Trash-Icon] (BRIDGE-02)
              Details-Panel → ...
```

```
log/page.tsx (Server)
  allBots = getBots()
  bots = allBots.filter(type='bridge')   ← bereits korrekt
  initialLogs: allBots.forEach(...)      ← [FIX: auf bots umstellen]
        │
        ▼
  BridgeLogClient.tsx
  [botFilter-State entfernt] (BRIDGE-03)
  Level-Filter + Suchfeld bleiben
```

### Recommended Project Structure

Keine strukturelle Änderung. Zwei Dateien werden gelöscht:
```
src/app/bridge/
├── settings/           ← WIRD GELÖSCHT (BRIDGE-04)
│   ├── page.tsx        ← löschen
│   └── BridgeSettingsClient.tsx  ← löschen
├── log/
│   ├── page.tsx        ← initialLogs-Fix (Bridge-only)
│   └── BridgeLogClient.tsx  ← botFilter entfernen
├── BridgeClient.tsx    ← deleteBot + Trash-Icon entfernen
└── ...
src/context/
└── BotStatusContext.tsx ← Timeout-Filter einbauen
src/components/layout/
└── Sidebar.tsx         ← BRIDGE_NAV[2] entfernen
```

### Pattern 1: Timeout-Filter im BotStatusContext

**Was:** Nach jedem Poll wird das `bots`-Array gefiltert: Bots deren `lastHeartbeat` älter als 30 Sekunden ist, werden aus dem State entfernt.

**Wann verwenden:** Bei jedem `setBots`-Aufruf in `poll()`.

**Beispiel:**
```typescript
// Source: Codebase — BotStatusContext.tsx (angepasst)
const HEARTBEAT_TIMEOUT_MS = 30_000

const poll = useCallback(async () => {
  try {
    const res = await fetch('/api/bridge/status')
    if (!res.ok) return
    const data = await res.json()
    const raw: BotWithStatus[] = data.bots ?? []
    // Timeout-Filter: Bridge verschwindet wenn lastHeartbeat > 30s
    const now = Date.now()
    const next = raw.filter(b => {
      if (!b.status?.lastHeartbeat) return false
      return now - new Date(b.status.lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS
    })
    setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
    setLastUpdated(new Date())
  } catch { /* silent */ }
}, [])
```

**Wichtig:** `BotWithStatus.status` ist `BotStatusWithConnection | null` — der `?.`-Operator ist zwingend. Ein Bot ohne `status` (null) gilt als offline und wird herausgefiltert.

### Pattern 2: Trash-Icon und deleteBot() entfernen (BridgeClient.tsx)

**Was:** Drei zusammenhängende Code-Stellen entfernen:
1. Import `Trash2` aus lucide-react (Zeile 5)
2. `deleteBot()`-Funktion (Zeilen 43–47)
3. Button im JSX innerhalb der Bot-Tab-Leiste (Zeilen 144–149)

**Hinweis:** Die Import-Zeile enthält weitere Icons (`Bot, TrendingUp, Search, Edit2, Check, X`) — nur `Trash2` entfernen.

### Pattern 3: botFilter-State entfernen (BridgeLogClient.tsx)

**Was:** Vier zusammenhängende Entfernungen:
1. `botFilter`-State + `setBotFilter` (Zeile 66)
2. Filter-Logik in `filtered` (Zeile 107: `if (botFilter !== 'all' && e.botId !== botFilter) return false`)
3. Trennlinie `<div className="h-4 w-px" .../>` (Zeile 238)
4. Bot-Filter-Block (Zeilen 241–269, `<div className="flex items-center gap-1.5 flex-wrap">`)
5. Bedingte "gefiltert"-Anzeige aktualisieren (Zeile 348): `botFilter !== 'all'` entfernen da Variable nicht mehr existiert

**Wichtig:** Die Props-Schnittstelle `Props { bots: BotEntry[]; initialLogs: ... }` bleibt unverändert — `bots` wird weiterhin für `fetchAll` (Zeile 76) und den Bot-Namen in Log-Einträgen (Zeile 377) verwendet.

### Pattern 4: initialLogs-Fix in log/page.tsx

**Was:** `initialLogs` iteriert aktuell über `allBots` (Zeile 22), lädt also Logs aller Bot-Typen. Da `bots` (Zeile 25) bereits auf Bridge-Bots gefiltert ist, muss `initialLogs` dieselbe gefilterte Liste verwenden.

```typescript
// Vorher (Zeilen 21–24):
const allBots = getBots()
const initialLogs: Record<string, ReturnType<typeof getBridgeLog>> = {}
for (const bot of allBots) {
  initialLogs[bot.id] = getBridgeLog(bot.id)
}
const bots = allBots.filter(bot => bot.type === 'bridge' || !bot.type)

// Nachher:
const allBots = getBots()
const bots = allBots.filter(bot => bot.type === 'bridge' || !bot.type)
const initialLogs: Record<string, ReturnType<typeof getBridgeLog>> = {}
for (const bot of bots) {
  initialLogs[bot.id] = getBridgeLog(bot.id)
}
```

### Pattern 5: Sidebar-Link entfernen (Sidebar.tsx)

**Was:** In `BRIDGE_NAV` (Zeilen 31–35) den dritten Eintrag entfernen:
```typescript
// Entfernen:
{ href: '/bridge/settings', label: 'Bridge Settings', icon: SlidersHorizontal },
```

**Nachher:** `SlidersHorizontal`-Import prüfen — wird es noch in `BOTS_NAV` (Zeile 42) verwendet. Ja: `{ href: '/bots/settings', label: 'Bot Settings', icon: SlidersHorizontal }` — Import bleibt.

### Anti-Patterns to Avoid

- **Offline-State einführen:** D-03 verbietet einen "getrennt"-Marker. Nicht versuchen, die Bridge im Offline-Zustand zu rendern.
- **Backend für Timeout ändern:** D-02 ist explizit Frontend-only. Die API `/api/bridge/status` bleibt unverändert.
- **`deleteBot()`-API-Route löschen:** Der API-Endpunkt `/api/bots/[id]` DELETE bleibt erhalten — er wird von Phase 3 (Bots) noch benötigt.
- **`bots`-Prop aus BridgeLogClient entfernen:** `bots` wird für `fetchAll` und Bot-Namen in Log-Einträgen weiterhin gebraucht.

---

## Don't Hand-Roll

| Problem | Nicht bauen | Verwenden statt | Warum |
|---------|-------------|-----------------|-------|
| Timeout-Berechnung | Eigene Klasse/Hook | `Date.now() - new Date(iso).getTime()` | Natives JS reicht vollständig aus |
| Route-404 für gelöschte Seite | Eigene redirect-Logik | Datei löschen — Next.js App Router zeigt automatisch 404 | Next.js-Konvention |

---

## Common Pitfalls

### Pitfall 1: `botFilter`-Referenz in der "gefiltert"-Anzeige vergessen

**Was schief läuft:** Nach Entfernen von `botFilter`-State kompiliert TypeScript nicht mehr, weil `botFilter !== 'all'` in Zeile 348 noch referenziert wird.

**Warum:** Die Filterstatus-Anzeige `(gefiltert)` prüft drei Bedingungen: `levelFilter !== 'all' || botFilter !== 'all' || search`. Der mittlere Term muss entfernt werden.

**Wie vermeiden:** Nach State-Entfernung TypeScript-Check laufen lassen (`npm run build` oder tsc) — kompilierungsfehler zeigt alle Stellen.

**Warnsignale:** TypeScript-Fehler "Cannot find name 'botFilter'" nach Edit.

### Pitfall 2: initialLogs enthält Bot-Logs, BridgeLogClient erwartet nur Bridge-Logs

**Was schief läuft:** Wenn `initialLogs` weiter über `allBots` iteriert (inklusive type='bot'), werden Bot-Log-Einträge beim ersten Render angezeigt. Nach dem ersten `fetchAll` (10s) verschwinden sie wieder.

**Warum:** `bots`-Prop enthält nur Bridge-Bots, aber `fetchAll` iteriert über `bots`, was bedeutet Bot-Logs würden nicht aktualisiert. Der initiale Render zeigt sie aber trotzdem kurz.

**Wie vermeiden:** `initialLogs` muss vor `BridgeLogClient bots`-Prop aus der bereits gefilterten `bots`-Liste befüllt werden (Pattern 4).

### Pitfall 3: Timeout-Filter entfernt Bridge die nie einen Heartbeat gesendet hat

**Was schief läuft:** Eine neu registrierte Bridge, die noch keinen Heartbeat gesendet hat (`status === null`), wird sofort vom Timeout-Filter entfernt.

**Warum:** `b.status?.lastHeartbeat` ist `undefined` → `new Date(undefined)` → NaN → `now - NaN > 30000` → `true` → herausgefiltert.

**Wie vermeiden:** Filter explizit: Wenn `status` null ist, Bridge ebenfalls entfernen (passt zu D-03: Bridge verschwindet komplett). Oder: Bridge mit null-Status behalten und erst nach erstem Heartbeat dem Timeout unterwerfen. D-01 sagt "lastHeartbeat älter als 30s" — bei null-Status gibt es kein Heartbeat, also: herausfiltern. Das ist korrekt per Spec.

### Pitfall 4: `SlidersHorizontal`-Import unnötig entfernen

**Was schief läuft:** `SlidersHorizontal` wird nach BRIDGE_NAV-Entfernung noch in `BOTS_NAV` (Zeile 42: Bot Settings) verwendet — würde zu einem Compile-Fehler führen.

**Wie vermeiden:** Import stehen lassen — nur den BRIDGE_NAV-Eintrag entfernen.

---

## Code Examples

### Timeout-Filter — vollständige poll()-Funktion
```typescript
// Source: Codebase BotStatusContext.tsx — anzupassen
const HEARTBEAT_TIMEOUT_MS = 30_000

const poll = useCallback(async () => {
  try {
    const res = await fetch('/api/bridge/status')
    if (!res.ok) return
    const data = await res.json()
    const raw: BotWithStatus[] = data.bots ?? []
    const now = Date.now()
    const next = raw.filter(b => {
      if (!b.status?.lastHeartbeat) return false
      return now - new Date(b.status.lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS
    })
    setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
    setLastUpdated(new Date())
  } catch { /* silent */ }
}, [])
```

### botFilter-Entfernung in filtered-Logik (BridgeLogClient.tsx)
```typescript
// Vorher (Zeilen 105–117):
const filtered = allEntries.filter(e => {
  if (levelFilter !== 'all' && e.level !== levelFilter) return false
  if (botFilter !== 'all' && e.botId !== botFilter) return false  // ← ENTFERNEN
  if (search.trim()) { ... }
  return true
})

// Nachher:
const filtered = allEntries.filter(e => {
  if (levelFilter !== 'all' && e.level !== levelFilter) return false
  if (search.trim()) { ... }
  return true
})
```

### "gefiltert"-Anzeige anpassen (BridgeLogClient.tsx Zeile 348)
```typescript
// Vorher:
{(levelFilter !== 'all' || botFilter !== 'all' || search) && (

// Nachher:
{(levelFilter !== 'all' || !!search) && (
```

---

## State of the Art

| Alter Ansatz | Aktueller Ansatz | Geändert | Impact |
|--------------|-----------------|----------|--------|
| Manuelles Löschen via Trash-Icon | Automatisches Verschwinden per Timeout | Phase 2 | Kein manueller Eingriff nötig |
| Bot-Filter im Bridge-Log | Bridge-Log zeigt nur Bridge-Einträge | Phase 2 | Klare Trennung Bridge vs. Bots |
| Bridge-Settings-Seite als eigenständige Route | Keine Settings-Seite (entfernt) | Phase 2 | Weniger UI-Komplexität |

---

## Assumptions Log

| # | Claim | Abschnitt | Risiko bei Falschnahme |
|---|-------|-----------|------------------------|
| A1 | `/api/bots/[id]` DELETE-Route wird in Phase 3 noch benötigt | Don't Hand-Roll | Wenn falsch: Route könnte ebenfalls gelöscht werden — aber sicherer: stehen lassen |
| A2 | Bridge mit `status === null` soll vom Timeout-Filter entfernt werden | Pattern 1 / Pitfall 3 | Wenn falsch: Bridge ohne Heartbeat bleibt in Liste — niedriges Risiko, da beim nächsten Poll geklärt |

---

## Open Questions

1. **Löschen-Button im Log (Trash2 in BridgeLogClient.tsx)**
   - Was wir wissen: `BridgeLogClient.tsx` hat einen "Log löschen"-Button (Zeile 325, `<Trash2 size={13} />`). BRIDGE-02 betrifft nur den Löschen-Button in der Bridge-Tab-Leiste (BridgeClient.tsx).
   - Was unklar ist: Ob der Log-Lösch-Button in BRIDGE-03-Scope fällt oder bestehen bleibt.
   - Empfehlung: D-04 und D-05/06 betreffen explizit `BridgeClient.tsx` (Trash-Icon) und `botFilter` (BridgeLogClient). Der Log-Lösch-Button gehört zur Log-Verwaltung, nicht zum Bot-Filter — **stehen lassen**. Er ist kein "Bot-Filter"-Element.

---

## Environment Availability

Nicht anwendbar — Phase 2 ist ausschließlich Code-Änderungen, keine externen Abhängigkeiten.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Kein Test-Framework konfiguriert (`npm test` nicht in package.json) |
| Config file | Nicht vorhanden |
| Quick run command | `npm run build` (TypeScript-Kompilierung als Proxy) |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map
| Req ID | Verhalten | Test-Typ | Automatisierter Befehl | Datei vorhanden? |
|--------|-----------|----------|----------------------|-----------------|
| BRIDGE-01 | Timeout-Filter entfernt Bridges mit altem Heartbeat | Manuell (visuell) | `npm run build` (Compile-Check) | ❌ Wave 0 nicht anwendbar |
| BRIDGE-02 | Kein Trash-Icon sichtbar in Bridge-UI | Manuell (visuell) | `npm run build` | ❌ |
| BRIDGE-03 | Kein "Alle Bots"-Filter in Bridge-Log | Manuell (visuell) | `npm run build` | ❌ |
| BRIDGE-04 | /bridge/settings → 404 | Manuell (Navigation) | `npm run build` | ❌ |

### Sampling Rate
- **Per Task Commit:** `npm run build` — TypeScript-Fehler sofort sichtbar
- **Per Wave Merge:** `npm run build` — vollständiger Compile-Check
- **Phase Gate:** `npm run build` grün + manuelle visuelle Verifikation aller 4 Requirements

### Wave 0 Gaps
Da kein Test-Framework konfiguriert ist, sind alle Tests manuell/visuell. Der Compile-Check via `npm run build` dient als automatisierte Minimalvalidierung.

*(Kein bestehendes Test-Framework — `npm run build` ist die primäre automatisierte Verifikation)*

---

## Security Domain

`security_enforcement: true`, ASVS Level 1.

### Applicable ASVS Categories

| ASVS Kategorie | Anwendbar | Standard-Control |
|----------------|-----------|-----------------|
| V2 Authentication | Nein | — |
| V3 Session Management | Nein | — |
| V4 Access Control | Nein | — |
| V5 Input Validation | Nein | Keine neuen Inputs |
| V6 Cryptography | Nein | — |

**Sicherheitsrelevanz dieser Phase:** Keine. Phase 2 entfernt ausschließlich UI-Elemente und einen Timeout-Filter. Es werden keine neuen Inputs, APIs oder Authentifizierungsmechanismen eingeführt. Die einzige sicherheitsrelevante Überlegung: Das Löschen der Bridge-Settings-Seite entfernt eine Oberfläche, über die MT5-Zugangsdaten bearbeitet werden konnten — dies verkleinert die Angriffsfläche leicht.

### Known Threat Patterns

Nicht anwendbar für diese Phase.

---

## Project Constraints (from CLAUDE.md)

| Direktive | Enforcement in Phase 2 |
|-----------|------------------------|
| Tech Stack Next.js 15 + TypeScript — kein Wechsel | Eingehalten — keine neuen Frameworks |
| Storage JSON-Dateien in data/ — kein Datenbankwechsel | Eingehalten — keine Storage-Änderungen |
| Scope: Ausschließlich TODO.md-Punkte | Eingehalten — nur BRIDGE-01 bis BRIDGE-04 |
| NEVER create files unless absolutely necessary | Eingehalten — nur bestehende Dateien editieren + 2 löschen |
| ALWAYS read a file before editing it | Alle Zieldateien wurden gelesen |
| Keep files under 500 lines | BridgeLogClient.tsx: 509 Zeilen → nach botFilter-Entfernung (~480 Zeilen) ✓ |
| _botsCache = null nach Mutations | Nicht anwendbar — Phase 2 enthält keine Mutations |

---

## Sources

### Primary (HIGH confidence)
- Codebase direkt gelesen: `src/context/BotStatusContext.tsx` — vollständige poll()-Logik, fingerprint(), 5s Interval
- Codebase direkt gelesen: `src/app/bridge/BridgeClient.tsx` — deleteBot(), Trash2-Button, filterBridge()
- Codebase direkt gelesen: `src/app/bridge/log/BridgeLogClient.tsx` — botFilter-State, Bot-Filter-UI, filtered-Logik
- Codebase direkt gelesen: `src/app/bridge/log/page.tsx` — allBots vs. bots Diskrepanz bei initialLogs
- Codebase direkt gelesen: `src/components/layout/Sidebar.tsx` — BRIDGE_NAV mit settings-Eintrag (Zeile 34)
- Codebase direkt gelesen: `src/app/bridge/settings/page.tsx` + `BridgeSettingsClient.tsx` — vollständiger Inhalt
- Codebase direkt gelesen: `src/types/bot.ts` — BotWithStatus, BotStatus.lastHeartbeat, BotEntry.type

### Secondary (MEDIUM confidence)
- `.planning/phases/02-bridge-bereinigung/02-CONTEXT.md` — verriegelte Entscheidungen D-01 bis D-10

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Codebase direkt gelesen, keine Annahmen
- Architecture: HIGH — alle Zieldateien vollständig analysiert, exakte Zeilennummern dokumentiert
- Pitfalls: HIGH — aus direkter Code-Analyse abgeleitet, nicht aus Training-Wissen

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stabiler Stack — Next.js 15, React 19 — keine Breaking Changes erwartet)

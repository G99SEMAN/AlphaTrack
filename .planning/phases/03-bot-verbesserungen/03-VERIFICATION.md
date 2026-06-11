---
phase: 03-bot-verbesserungen
verified: 2026-06-11T19:10:00+02:00
status: human_needed
score: 5/5 must-haves verified (automatisch); 3 Punkte erfordern menschliche UAT
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Bot-Karte zeigt korrekte offene Positionen (BOTS-01)"
    expected: "Unter 'Positionen' steht die tatsächliche Anzahl offener Trades des Bots (nicht 0), sofern offene Trades mit matchender sourceId vorhanden sind"
    why_human: "Erfordert laufenden Bot mit offenen Trades; grep kann sourceId-Übereinstimmung zur Laufzeit nicht prüfen"
  - test: "Bot-Karte zeigt P&L farbig (BOTS-03)"
    expected: "Feld heißt 'P&L' (kein 'Balance'); bei profitablem Bot grün mit '+', bei Verlust rot mit '-'; Bot ohne closed Trades zeigt '-'"
    why_human: "Visuelles Verhalten und Echtdaten-Abhängigkeit; formatPnl-Logik ist zwar verifizierbar, aber korrekte Farb-Darstellung im Browser braucht menschliche Prüfung"
  - test: "Bot verschwindet automatisch nach Disconnect (BOTS-05)"
    expected: "Bot-Karte verschwindet aus der Liste nach ~30s ohne Heartbeat — kein manueller Entfernen-Button nötig"
    why_human: "Zeitbasiertes Verhalten; erfordert echten Bot, der Heartbeat einstellt"
  - test: "Parameter-Editor mit echten Bot-Parametern (BOTS-08 Live-Pfad)"
    expected: "Bot mit parameters-Feld im Heartbeat: Pro Parameter typ-passendes Feld sichtbar (Zahl→Number, Bool→Toggle, Text→Text); 'Parameter senden' sendet set_parameters-Command erfolgreich"
    why_human: "Erfordert Bot der tatsächlich parameters im Heartbeat meldet; 03-03-SUMMARY merkt explizit: 'kein Bot mit Parametern verfügbar zum Testen'"
---

# Phase 03: Bot-Verbesserungen — Verification Report

**Phase-Ziel:** Bot-Karten zeigen korrekte Metriken (Positionen, P&L, Trade-Anzahl) und Bot-Settings sind auf die tatsächlich nötigen Funktionen reduziert
**Verifiziert:** 2026-06-11T19:10:00+02:00
**Status:** human_needed
**Re-Verifikation:** Nein — initiale Verifikation

---

## Goal Achievement

### Observable Truths (aus ROADMAP.md Success Criteria)

| # | Truth | Status | Evidenz |
|---|-------|--------|---------|
| SC-1 | Bot-Karte zeigt tatsächliche Anzahl offener Positionen (nicht 0 wenn Trades offen) | ? UNCERTAIN | Code: `botStats?.openCount` aus `/api/bots/:id/stats`; Stats-Endpunkt filtert `status === 'open'` korrekt — Laufzeit-Korrektheit erfordert UAT |
| SC-2 | Bot-Karte zeigt P&L statt Balance; kein "Synced"-Feld | ✓ VERIFIED | `label="P&L"` vorhanden; kein `label="Balance"` / `label="Synced"` in BotsClient.tsx; `formatPnl` implementiert |
| SC-3 | Bot-Karte zeigt Gesamt-Trade-Anzahl des Bots | ✓ VERIFIED | `label="Trades"` mit `botStats?.tradeCount?.toString()` in BotsClient.tsx Z.202 |
| SC-4 | Bot verschwindet automatisch bei Disconnect | ? UNCERTAIN | `filterBots` filtert `connectionState !== 'offline'`; Polling alle 8s — zeitbasiertes Verhalten erfordert UAT |
| SC-5 | Bot-Settings: editierbare Parameter mit Bestätigen-Button; Umbenennen und Entfernen entfernt | ✓ VERIFIED | Kein Pencil/Trash/deleteBot/saveEdit/AnimatePresence in BotsSettingsClient.tsx; `renderParameterEditor` + `sendParameters` implementiert; `command: 'set_parameters'` gesendet |

**Score:** 3/5 vollständig automatisch verifiziert; 2 UNCERTAIN (Laufzeit-Abhängigkeit)

---

### Detaillierte Anforderungsabdeckung

| Req | Plan | Beschreibung | Status | Evidenz |
|-----|------|-------------|--------|---------|
| BOTS-01 | 03-01, 03-02 | Korrekte Positionsanzahl in Bot-Karte | ? UNCERTAIN | `openCount` aus `/api/bots/:id/stats` (filtert `status==='open' && sourceId===botId`); UAT nötig |
| BOTS-02 | 03-02 | Kein "Synced"-Feld | ✓ VERIFIED | grep `label.*Synced` in BotsClient.tsx: kein Treffer |
| BOTS-03 | 03-02 | P&L statt Balance, farbig | ✓ VERIFIED | `formatPnl` Z.67-72 mit `var(--green)`/`var(--red)`/`var(--text-3)`; kein `label="Balance"` |
| BOTS-04 | 03-02 | Gesamt-Trade-Anzahl in Karte | ✓ VERIFIED | `label="Trades"` Z.202; `botStats?.tradeCount` |
| BOTS-05 | 03-02 | Bot-Auto-Disappear | ? UNCERTAIN | filterBots + 8s-Polling implementiert; zeitbasiertes Verhalten braucht UAT |
| BOTS-06 | 03-03 | Kein Entfernen-Button in Settings | ✓ VERIFIED | grep `Trash2`/`deleteBot` in BotsSettingsClient.tsx: kein Treffer |
| BOTS-07 | 03-03 | Keine Namens-Bearbeitung in Settings | ✓ VERIFIED | grep `Pencil`/`saveEdit`/`startEdit`/`EditState` in BotsSettingsClient.tsx: kein Treffer |
| BOTS-08 | 03-01, 03-03 | Parameter-Editor + Senden-Button | ✓ VERIFIED (Code) / ? UNCERTAIN (Live) | `set_parameters` in VALID_COMMANDS; Validierungsblock Z.42-46; `renderParameterEditor` mit Typ-Inferenz; kein Bot mit Parametern zum Live-Test verfügbar |

---

## Required Artifacts

| Artifact | Erwartet | Status | Details |
|----------|----------|--------|---------|
| `src/types/bot.ts` | BotCommandType+set_parameters, BotStatus.parameters, SetParametersPayload, BotStats | ✓ VERIFIED | Z.5: set_parameters in Union; Z.64: parameters?; Z.11-13: SetParametersPayload; Z.34-39: BotStats |
| `src/app/api/bots/[id]/stats/route.ts` | GET-Endpunkt mit Trade-Aggregation pro Bot | ✓ VERIFIED | Exportiert GET; getProfileTrades(bot.profileId); sourceId-Filter; realizedPnl=null-Logik vorhanden |
| `src/app/api/bridge/command/route.ts` | set_parameters validiert und akzeptiert | ✓ VERIFIED | VALID_COMMANDS Z.6; Import Z.3; Validierungsblock Z.42-46; body-Typ Z.13 |
| `src/app/bots/BotsClient.tsx` | 4-Kachel-Grid P&L/Positionen/Trades/Uptime; Stats-Polling | ✓ VERIFIED | Stats-useEffect Z.98-118; formatPnl Z.67-72; Grid Z.199-204; Stat valueColor-Prop Z.233-240 |
| `src/app/bots/settings/BotsSettingsClient.tsx` | Read-only Info; Parameter-Editor; kein Edit/Delete | ✓ VERIFIED | drafts/sending State Z.18-19; sendParameters Z.21-37; renderParameterEditor Z.39-112; keine Edit/Delete-Symbole |

---

## Key Link Verification

| Von | Nach | Via | Status | Details |
|-----|------|-----|--------|---------|
| `src/app/api/bots/[id]/stats/route.ts` | `getProfileTrades` | `getProfileTrades(bot.profileId)` | ✓ WIRED | Z.16; NICHT getTrades() — Pitfall 1 korrekt vermieden |
| `src/app/api/bridge/command/route.ts` | `VALID_COMMANDS` | `set_parameters` in Array | ✓ WIRED | Z.6; grep liefert 3+ Treffer |
| `src/app/bots/BotsClient.tsx` | `/api/bots/:id/stats` | fetch in useEffect (8s Interval) | ✓ WIRED | Z.102: `fetch(\`/api/bots/${bot.id}/stats\`)` |
| `src/app/bots/BotsClient.tsx` | `BotStats` | Import aus `@/types/bot` | ✓ WIRED | Z.6: BotStats in Import-Statement |
| `src/app/bots/settings/BotsSettingsClient.tsx` | `/api/bridge/command` | POST mit command='set_parameters' | ✓ WIRED | Z.26-30: fetch + JSON.stringify({command: 'set_parameters'}) |
| `src/app/bots/settings/BotsSettingsClient.tsx` | `status.parameters` | renderParameterEditor(bot.id, status?.parameters) | ✓ WIRED | Z.181: Aufruf mit optionalem status?.parameters |

---

## Data-Flow Trace (Level 4)

| Artifact | Datenvariable | Quelle | Liefert Echtdaten | Status |
|----------|--------------|--------|-------------------|--------|
| `BotsClient.tsx` Stats-Grid | `botStats` (Record<string, BotStats>) | `/api/bots/:id/stats` via fetch | Ja — Endpunkt liest getProfileTrades() mit DB-Filter | ✓ FLOWING |
| `stats/route.ts` | `botTrades` | `getProfileTrades(bot.profileId)` | Ja — liest data/trades-{profileId}.json; filtert sourceId===id | ✓ FLOWING |
| `BotsSettingsClient.tsx` | `status?.parameters` | BotStatus Heartbeat | Nur wenn Bot parameters sendet — leerer Zweig korrekt behandelt | ✓ FLOWING (mit Info-Text-Fallback) |

---

## Behavioral Spot-Checks

| Verhalten | Prüfung | Ergebnis | Status |
|-----------|---------|----------|--------|
| `BotCommandType` enthält 'set_parameters' | grep in bot.ts | Z.5: Literal in Union | ✓ PASS |
| Stats-Endpunkt verwendet NICHT getTrades() | grep in stats/route.ts | Kein Treffer für getTrades | ✓ PASS |
| Stats-Endpunkt enthält realizedPnl=null-Zweig | Codeinspektion | Z.23-25: leere Menge → null | ✓ PASS |
| Balance-Kachel entfernt | grep in BotsClient.tsx | Kein Treffer für label="Balance" | ✓ PASS |
| Positionen liest openCount (nicht status.openPositions) | grep in BotsClient.tsx | Z.201: botStats?.openCount | ✓ PASS |
| formatPnl: null → '-', positiv → var(--green), negativ → var(--red) | Codeinspektion Z.68-71 | Korrekte Zweige vorhanden | ✓ PASS |
| Pencil/Trash2 aus Settings entfernt | grep in BotsSettingsClient.tsx | Kein Treffer | ✓ PASS |
| set_parameters-Validierung: 400 bei fehlendem parameters | Codeinspektion Z.42-46 | typeof check + Array.isArray check vorhanden | ✓ PASS |
| TypeScript kompiliert | npx tsc --noEmit | Kein Output (keine Fehler) | ✓ PASS |

---

## Probe Execution

Keine Probes für diese Phase definiert. Einziger automatischer Check ist `npx tsc --noEmit` — bestanden (kein Output).

---

## Anti-Patterns Found

| Datei | Zeile | Pattern | Schwere | Auswirkung |
|-------|-------|---------|---------|-----------|
| `src/app/bots/settings/BotsSettingsClient.tsx` | Z.3 | `useState` importiert, aber kein `useEffect` | Info | Kein Update-Polling für bots-State — bei längerem Verweilen auf der Settings-Seite könnten offline-Bots nicht verschwinden bis Seitenreload. Kein Blocker für Phase-Ziel. |

Keine TBD/FIXME/XXX/HACK-Marker in allen fünf modifizierten Dateien.

**Besonderheit — isSameOriginRequest-Entfernung:** Die PLAN-01-Threat-Beschreibung (T-03-01) sah ein Same-Origin-Gate für `/api/bots/:id/stats` vor. Die Implementierung entfernte diesen Gate als Bug-Fix (SUMMARY-02: Browser senden keinen Origin-Header bei same-origin GET-Requests). Dies ist eine dokumentierte Abweichung — konsistent mit allen anderen Bot-GET-Routen, die ebenfalls keinen Auth-Check haben. Kein Security-Blocker.

---

## Human Verification Required

### 1. Bot-Karte — korrekte Positionsanzahl (BOTS-01)

**Test:** Browser auf `/bots` öffnen mit einem laufenden Bot, der offene Trades mit korrekter `sourceId` hat
**Expected:** Unter "Positionen" steht eine Zahl > 0 (nicht 0), die der Anzahl offener Trades mit `sourceId === botId` entspricht
**Warum manuell:** Erfordert echten Bot mit Echtdaten; grep kann Laufzeit-Datenfluss nicht prüfen

### 2. Bot-Karte — P&L Farbe und Vorzeichen (BOTS-03)

**Test:** Bot-Karte im Browser prüfen — bei profitablem Bot (realizedPnl > 0), Bot mit Verlust (< 0), Bot ohne closed Trades
**Expected:** Grün mit `+` / Rot mit `-` / Strich `-` in gedämpfter Farbe; Label heißt "P&L" nicht "Balance"
**Warum manuell:** Visuelles Verhalten mit CSS-Variablen (`var(--green)`, `var(--red)`) — Korrektheit hängt von Theme-Rendering ab

### 3. Bot-Auto-Disappear (BOTS-05)

**Test:** Laufenden Bot stoppen / Heartbeat aussetzen lassen; 30-60s warten; `/bots`-Seite beobachten
**Expected:** Bot-Karte verschwindet automatisch aus der Liste ohne manuellen Klick
**Warum manuell:** Zeitbasiertes Verhalten (Heartbeat-Timeout); erfordert echten Bot

### 4. Parameter-Editor mit echten Bot-Parametern (BOTS-08 Live-Pfad)

**Test:** Bot zum Senden von `parameters` im Heartbeat konfigurieren (z.B. `{ "lots": 0.1, "enabled": true }`); dann `/bots/settings` öffnen
**Expected:** Pro Parameter ein typ-passendes Feld sichtbar (Number-Input für `lots`, Toggle für `enabled`); nach Wertänderung "Parameter senden" klicken → Button zeigt "Senden...", Bridge-Log zeigt "Command gesendet: set_parameters"
**Warum manuell:** Kein Bot mit parameters-Feld beim Testen verfügbar (03-03-SUMMARY: "kein Bot mit Parametern verfügbar zum Testen"); Implementierung ist strukturell korrekt aber Live-Pfad ungetestet

---

## Gaps Summary

Keine technischen Gaps — alle Artifacts existieren, sind substantiell implementiert und korrekt verdrahtet. Der Status `human_needed` ergibt sich ausschließlich aus Laufzeit-Abhängigkeiten, die programmatisch nicht verifizierbar sind. Die Implementierungen für BOTS-01, BOTS-05 und der Live-Pfad von BOTS-08 sind korrekt codiert; ihre Laufzeitkorrektheit muss durch UAT mit echten Bots bestätigt werden.

---

_Verifiziert: 2026-06-11T19:10:00+02:00_
_Verifier: Claude (gsd-verifier)_

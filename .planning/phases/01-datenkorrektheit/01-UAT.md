---
status: testing
phase: 01-datenkorrektheit
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md]
started: 2026-06-10T11:53:00Z
updated: 2026-06-10T11:53:00Z
---

## Current Test

number: 4
name: "Synced"-Feld nicht sichtbar in der Bot-Detailansicht
expected: |
  Öffne /bots/[eine-beliebige-Bot-ID]. In der Stat-Übersicht des
  Bot-Details darf kein "Trades gespeichert" oder "Synced"-Eintrag
  mehr erscheinen.
awaiting: user response

## Tests

### 1. "Synced"-Feld nicht sichtbar in der Bridge-Übersicht
expected: Öffne /bridge. Im Bridge-Dashboard-Widget (oben) darf kein "Synced"-Stat mehr erscheinen. Alle anderen Statistiken (Positions, Heartbeat, Status usw.) bleiben vorhanden.
result: pass

### 2. "Synced"-Feld nicht sichtbar in der WatchdogPanel-Ansicht
expected: In der Bridge-Seite (/bridge) ist im WatchdogPanel (oder einer gleichnamigen Komponente) kein "Sync"-Eintrag / "Synced"-Wert mehr sichtbar. Andere Einträge wie Heartbeat-Timestamp, offene Positionen usw. sind weiterhin da.
result: pass

### 3. "Synced"-Feld nicht sichtbar in der Bots-Liste
expected: Öffne /bots. In der Statistik-Zeile jedes Bot-Eintrags (Bots-Übersicht) erscheint kein "Synced"-Wert mehr.
result: pass

### 4. "Synced"-Feld nicht sichtbar in der Bot-Detailansicht
expected: Öffne /bots/[eine-beliebige-Bot-ID]. In der Stat-Übersicht des Bot-Details darf kein "Trades gespeichert" oder "Synced"-Eintrag mehr erscheinen.
result: [pending]

### 5. Close-Event API — Authentifizierung
expected: |
  Sende im Terminal (curl oder Postman) einen POST-Request an
  http://localhost:3000/api/bridge/close-event ohne oder mit falschem API-Key.
  Erwartet: HTTP 401 Unauthorized.

  Beispiel:
    curl -s -o /dev/null -w "%{http_code}" \
      -X POST http://localhost:3000/api/bridge/close-event \
      -H "Content-Type: application/json" \
      -d '{"bridgeId":"test","profileId":"x","ticket":1,"exitPrice":1.0,"closeTime":"now"}'
result: [pending]

### 6. Close-Event API — Trade wird korrekt geschlossen
expected: |
  Wenn ein offener Trade in AlphaTrack vorhanden ist (z.B. externalId = "pos_12345"),
  sende einen gültigen close-event Request mit diesem ticket und einem exitPrice.
  Danach erscheint der Trade im Journal/Dashboard als "geschlossen" mit dem richtigen exit-Preis.
  (Wenn kein offener Trade vorhanden ist, darf dieser Test übersprungen werden.)
result: [pending]

### 7. sourceId bei neuen Trades gesetzt
expected: |
  Sende via Bridge einen neuen Trade-Payload an POST /api/bridge/trades
  (mit gültigem API-Key). Prüfe anschließend in data/trades-{profileId}.json:
  Der neue Trade-Eintrag hat ein "sourceId"-Feld (z.B. "bridge/tradeexecuter" oder die botId).
  Vorhandene Trades ohne sourceId erhalten beim nächsten POST ebenfalls eine sourceId.
  (Diesen Test überspringen, wenn kein Test-Trade möglich ist.)
result: [pending]

## Summary

total: 7
passed: 3
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]

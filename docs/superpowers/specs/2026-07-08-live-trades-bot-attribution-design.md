# Live Trades: Offene Positionen dem auslösenden Bot zuordnen

**Datum:** 2026-07-08
**Status:** Genehmigt

## Problem

In der Live-Trades-Ansicht (`/bridge/trades`) ist bei einer offenen Position nicht ersichtlich, welcher Strategie-Bot sie ausgelöst hat. Der bisherige `botId`/`botName` in `BridgeTradesClient.tsx` bezieht sich fälschlich auf die **Bridge** (Mini-PC-Verbindung), nicht auf den einzelnen Bot — bei nur einer Bridge zeigt er für jede Position denselben Wert.

## Root Cause

`bridge/mt5_connector.py::get_open_positions()` liefert MT5-Positionen ohne Bot-Zuordnung. Alle Orders werden zudem mit derselben hartcodierten Magic-Number (`20250101`) platziert (`bridge/trade_executor.py`) — auf MT5-Ebene selbst ist die Bot-Identität also nicht rekonstruierbar.

**Aber:** `bridge/gateway.py` führt bereits eine Ticket→Bot-Registry (`_ticket_to_at_bot_id`, befüllt bei jedem `execute_trade`-Command über den anfragenden Bot, persistiert in `bridge/ticket_registry.json`). Diese wird schon heute genutzt für:
- Positions-Zählung pro Bot im Bridge-Terminal-Display (`main.py`, `get_connected_bots_info()`)
- Bot-Zuordnung bei geschlossenen Trades im Trade-Sync (`trade_sync.py`, via `get_at_bot_id_for_ticket()`)

Nur beim Reporting **offener** Positionen (Heartbeat → AlphaTrack) wird diese bereits vorhandene Zuordnung nicht mitgeschickt.

## Lösung

### 1. Bridge (`bridge/main.py`)

Vor `update_positions_cache(mt5.get_open_positions())` (Zeile ~441) jede Position mit `botId = get_at_bot_id_for_ticket(ticket)` anreichern (bereits importierte Funktion). Dieser eine Ort speist sowohl den Heartbeat (`heartbeat.py` liest `get_positions_cache()`) als auch den `/positions`-HTTP-Endpunkt — eine Änderung genügt.

Keine Änderung an `trade_executor.py`, keiner MT5-Order-Struktur, keinem AGPv2-Envelope.

### 2. AlphaTrack (`src/app/bridge/trades/page.tsx`)

Zusätzlich zur bestehenden `bots`-Liste (nur Bridges, für den Verbindungs-Filter) eine zweite Liste der einzelnen Strategie-Bots (`type === 'bot'`) an `BridgeTradesClient` durchreichen, um `botId` einer offenen Position auf Name/Farbe abzubilden.

### 3. AlphaTrack (`src/app/bridge/trades/BridgeTradesClient.tsx`)

- `fetchPositions()`: `botId`/`botName` einer Position nicht mehr mit der Bridge-ID überschreiben, sondern den von der Bridge gelieferten `pos.botId` (jetzt die tatsächliche Strategie-Bot-ID) gegen die neue Strategie-Bot-Liste auflösen.
- Badge (bereits umgesetzt): sichtbar, sobald ein Bot aufgelöst werden konnte — unabhängig von der Bridge-Anzahl.

## Einschränkung

Positionen, die **vor** diesem Fix bereits offen waren, haben keinen Registry-Eintrag (Attribution wird erst ab `execute_trade`-Zeitpunkt gespeichert) und zeigen kein Badge — kein Backfill möglich, kein Datenverlust, nur fehlende historische Zuordnung für diese Übergangs-Positionen.

## Risiko/Testing

- Keine Änderung an Order-Platzierung, SL/TP-Logik oder MT5-`order_send`-Aufrufen — die Trade-Execution-Pipeline bleibt unangetastet.
- Betroffene Python-Datei läuft auf dem Mini-PC — Deploy über `deploy-bot.bat`/Bridge-Redeploy, nicht über den Next.js-Hot-Reload-Dev-Container. Muss vor Produktiv-Deploy manuell gegen die laufende Bridge verifiziert werden (z.B. Testtrade auslösen, `/positions` prüfen).
- TypeScript-Seite kann vollständig im Hot-Reload-Dev-Container getestet werden (siehe `docs/DEPLOYMENT.md`).

## Out of Scope

- Kein Backfill für bereits offene Positionen.
- Keine Änderung an der geschlossene-Trades-Zuordnung (funktioniert schon über denselben Mechanismus).
- Keine MT5-Magic-Number- oder Comment-Änderung.

# Live Trades: Bot-Badge sichtbar machen

**Datum:** 2026-07-08
**Status:** Genehmigt

## Problem

In der Live-Trades-Ansicht (`/bridge/trades`, `src/app/bridge/trades/BridgeTradesClient.tsx`) ist bei einer offenen Position nicht auf den ersten Blick ersichtlich, welcher Bot sie ausgelöst hat. Es gibt zwar bereits einen kleinen farbigen Punkt neben dem Instrument-Symbol (Zeile ~298–304), der den Bot per `title`-Tooltip anzeigt — aber das ist nur per Hover erkennbar, nicht auf einen Blick.

## Lösung

Der bestehende Hover-only-Punkt wird durch ein sichtbares Badge ersetzt: farbiger Punkt + Bot-Name als Pill, direkt neben dem Instrument-Symbol. Stil analog zu den bereits vorhandenen Filter-Buttons oben auf der Seite (`background: ${dotColor}18`, `border: 1px solid ${dotColor}66`, Text in `dotColor`).

Das Badge wird nur angezeigt, wenn mehr als ein Bot registriert ist (`bots.length > 1`) — analog zur bestehenden Filter-Sektion, die aus demselben Grund bei nur einem Bot ausgeblendet wird (kein Mehrwert, nur visuelles Rauschen).

## Betroffene Datei

- `src/app/bridge/trades/BridgeTradesClient.tsx` — reine Darstellungsänderung im Karten-Rendering der offenen Positionen.

## Keine Änderung nötig an

- Datenmodell/Typen (`LivePosition`, `Trade`) — `botName`, `botId` sind bereits vorhanden und korrekt befüllt.
- Farbzuordnung — `getBotColor()` existiert bereits und wird weiterverwendet.
- Der Schließen-Bestätigungsdialog zeigt den Bot-Namen bereits als Text an, keine Änderung nötig.

## Out of Scope

- Keine Änderung an der Trade-Journal-Ansicht (`/trades`) oder anderen Listen — nur `/bridge/trades`.
- Keine Backend-/API-Änderung.

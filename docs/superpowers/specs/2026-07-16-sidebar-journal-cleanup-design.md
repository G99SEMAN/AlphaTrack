# Sidebar-Umbau + Journal-Aufräumung

**Datum:** 2026-07-16
**Status:** Approved
**Quelle:** `TODO.md`, Abschnitte "Journal (Trades)" und "Generelle Seitenleiste (Aufteilung)"

## Kontext

Die ersten beiden TODO-Hauptpunkte (Daily Checklist, TradingView-Chart bei Trade-Klick im Kalender) sind bereits umgesetzt. Dieses Spec deckt die beiden verbleibenden Punkte ab, die unabhängig voneinander sind, aber zusammen geplant werden, da beide klein genug für einen gemeinsamen Implementierungsplan sind.

## 1. Sidebar-Umbau (`src/components/layout/Sidebar.tsx`)

Reine Neusortierung der beiden Nav-Konstanten `UEBERSICHT_NAV` und `BRIDGE_BOTS_NAV`. Kein neues Verhalten, keine neuen Icons.

**Neue Reihenfolge `UEBERSICHT_NAV`:**
1. Dashboard
2. Trades (`/journal`)
3. Live Trades (`/bridge/trades`)
4. Strategien (`/strategien`)
5. Trade Analyzer (`/bridge/analyse`)
6. Statistiken
7. Kalender
8. Netzwerk

**Neue Reihenfolge `BRIDGE_BOTS_NAV`:**
1. Bridge
2. Bridge Log
3. Bots
4. Bot Settings
5. Performance

Alle Icons, Hrefs und Labels bleiben unverändert — es werden lediglich Einträge zwischen den beiden Arrays verschoben.

## 2. Journal-Filter (`src/components/journal/JournalClient.tsx`)

### Status-Filter
Die Buttons `Offen` und `Geschlossen` werden aus der Status-Filterzeile entfernt. Übrig bleiben `Alle` und `Abgebrochen` (`FilterStatus` Union bleibt technisch `'all' | 'open' | 'closed' | 'cancelled'` für Kompatibilität mit bestehenden Daten/Sortierlogik, aber im UI werden nur noch die zwei Buttons gerendert).

### Neuer Bot-Filter
Ein Dropdown mit Checkboxen (Mehrfachauswahl), platziert in der bestehenden Filter-Zeile neben Status/Richtung. Einträge:
- Ein Eintrag pro registriertem Bot (`bots` Prop, Eintrag-Wert = `bot.id`)
- Ein zusätzlicher Eintrag "Manuell" (Wert: spezieller Marker `'manual'`) für alle Nicht-Bot-Trades. Laut `resolveBotLabel()` (`src/lib/bot-source.ts`) sind das drei Fälle, die hier bewusst zusammengefasst werden: `sourceId === TRADE_EXECUTOR_SOURCE_ID` ("Trade Executor"), `sourceId === null || sourceId === MANUAL_MT5_SOURCE_ID` ("Manuell/MT5"), und `sourceId === undefined` (Alt-Trades ohne Zuordnung, aktuell taglos). Alle drei zählen fürs Filtern als "Manuell".

Standardzustand: alle Einträge ausgewählt (= kein Filtereffekt). Die Filterlogik (`filtered` useMemo) bekommt ein zusätzliches Prädikat: ein Trade wird nur angezeigt, wenn — für `sourceId`, das einer registrierten Bot-`id` entspricht — diese Bot-ID in der Auswahl ist, oder — für alle anderen Fälle (Trade Executor, Manuell/MT5, `undefined`) — `'manual'` in der Auswahl ist.

Neuer State: `selectedBotFilter: Set<string>` (Bot-IDs + spezieller Marker `'manual'`), initialisiert mit allen Bot-IDs + `'manual'`.

## 3. Bot-Tag-Farben (Konsistenz)

Aktuell nutzt `TradeRow.tsx` keine Farbe für den Bot-Tag (nur Text). Dashboard, Kalender und Bridge-Trades verwenden bereits `getBotColor()` aus `src/lib/bot-colors.ts`, index-basiert über eine feste 10-Farben-Palette (`BOT_COLORS`).

**Entscheidung:** Die bestehende index-basierte Methode wird beibehalten (kein persistentes Farb-Feld pro Bot). Um Konsistenz herzustellen:
- `TradeRow.tsx` erhält einen `botColor`-Prop (analog zu `sourceLabel`) und rendert den Bot-Tag mit derselben Badge-Optik wie in `DayModal.tsx`/`RecentTradesCard.tsx` (`background: ${color}18`, `border: 1px solid ${color}66`, `color: color`, kleiner Farbpunkt).
- `JournalClient.tsx` muss dieselbe Bot-Liste/Reihenfolge verwenden wie die anderen Ansichten, damit der Index (und damit die Farbe) übereinstimmt: `getAllBotsWithStatus()` gefiltert auf `type === 'bot'`, statt der aktuell durchgereichten `bots`-Prop ungefiltert. Die Journal-Seite (`src/app/journal/page.tsx` o.ä.) muss diese gefilterte Liste zusätzlich an `JournalClient` übergeben (oder die bestehende `bots`-Prop entsprechend gefiltert befüllen — wird bei Implementierung anhand des bestehenden Page-Codes entschieden).

Bekannte Einschränkung (akzeptiert, da bewusst gewählte einfache Lösung): Farben verschieben sich, wenn ein Bot gelöscht wird, und wiederholen sich ab dem 11. Bot. Das ist der Status quo und wird durch dieses Spec nicht verändert, nur konsistent gemacht.

## 4. Bot-Import entfernen

- `src/components/journal/BotImportModal.tsx` wird komplett gelöscht.
- In `JournalClient.tsx`: der "Via Bot"-Button, der `showBotImport`-State und die zugehörige `<AnimatePresence>`/Modal-Einbindung werden entfernt. Der reguläre "Import"-Button (`ImportModal.tsx`, CSV/manueller Import) bleibt unverändert bestehen.
- `importBotTradesAction` in `src/lib/actions.ts` wird entfernt, sofern eine Prüfung zur Implementierungszeit bestätigt, dass sie nirgends sonst referenziert wird (aktuell einziger bekannter Aufrufer ist `BotImportModal.tsx`).
- Der Endpunkt `/api/bridge/history` (von `BotImportModal.tsx` per `fetch` genutzt) bleibt unangetastet, da er vermutlich auch von der Bridge selbst verwendet wird — wird bei Implementierung verifiziert, bevor irgendetwas an diesem Endpunkt geändert wird.

## Nicht im Scope

- Keine Änderung an der Datenhaltung (`trades-{profileId}.json`, `bot-trades-{profileId}.json`)
- Keine Änderung an der Sync-Logik zwischen Bridge und Journal
- Kein persistentes Farb-Feld pro Bot (bewusst abgelehnt zugunsten der einfacheren index-basierten Lösung)
- Keine Änderung an Statistiken/Kalender/Bridge-Trades-Farblogik selbst, nur Journal wird nachgezogen

## Testing / Verifikation

- TypeScript-Check (automatischer Hook) muss grün sein
- Browser-Verifikation via `run-alphatrack`-Skill:
  - Sidebar zeigt neue Reihenfolge in beiden Sektionen
  - Journal: Status-Filter zeigt nur noch Alle/Abgebrochen, Bot-Filter-Dropdown funktioniert (Mehrfachauswahl inkl. "Manuell"), gefilterte Liste stimmt
  - Bot-Tags in Journal zeigen dieselbe Farbe wie im Dashboard/Kalender für denselben Bot
  - "Via Bot"-Button ist verschwunden, regulärer Import-Button funktioniert weiterhin

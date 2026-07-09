# Dashboard-Kalender: Modernisierung (Politur + Streaks + Bot-Punkte)

**Datum:** 2026-07-09
**Status:** Genehmigt

## Problem

Der Trading-Kalender im Dashboard (`src/components/dashboard/TradingCalendar.tsx`) wirkt leer/flach, besonders an handelsfreien Tagen. Er zeigt zwar Tages-P&L, Trade-Anzahl und Winrate pro Tag sowie Wochen-Summaries — aber keine der Zusatzinformationen, die moderne Trading-Journale (TradeZella, Tradervue, TradesViz) als Mehrwert bieten: Verlust-/Gewinnserien (Streaks) und welcher Bot an einem Tag gehandelt hat.

Recherche-Quellen: [TradesViz PnL Calendar](https://www.tradesviz.com/pnl-calendar/), [TradeZella PnL Calendar](https://www.tradezella.com/blog/pnl-calendar), [Tradervue Calendar P&L](https://www.tradervue.com/pnl-calendar), [GASPNTRADER Calendar Trading Journal](https://gaspntrader.com/blog/calendar-trading-journal).

## Lösung — Übersicht

Drei Teile, alle in `TradingCalendar.tsx` (plus eine neue geteilte Utility):

1. Visuelle Politur der Zellen (bestehender dunkler Look bleibt, nur luftiger/tiefer)
2. Streak-Badges für 3+ aufeinanderfolgende Gewinn-/Verlust-Handelstage
3. Bot-Punkte pro Tageszelle (welche Strategie-Bots haben an dem Tag gehandelt)

## 1. Geteilte Bot-Farb-Utility

`BOT_COLORS`/`getBotColor()` sind aktuell dupliziert in `BridgeTradesClient.tsx` und `RecentTradesCard.tsx`. Für die Bot-Punkte im Kalender braucht `TradingCalendar.tsx` dieselbe Logik — dritte Duplikation vermeiden:

- Neu: `src/lib/bot-colors.ts` exportiert `BOT_COLORS` und `getBotColor(botId, bots)`
- `BridgeTradesClient.tsx`, `RecentTradesCard.tsx`, `TradingCalendar.tsx` importieren von dort statt eigener lokaler Kopie
- Effekt: ein Bot hat in der gesamten App (Bridge-Trades, Letzte Trades, Kalender) konsequent dieselbe Farbe

## 2. Neue Prop: `strategyBots`

`TradingCalendar` bekommt `strategyBots: BotEntry[]` (analog zu `RecentTradesCard`). In `src/app/dashboard/page.tsx` ist `strategyBots` bereits berechnet — wird zusätzlich an `<TradingCalendar>` durchgereicht.

## 3. Visuelle Politur

Innerhalb des bestehenden Looks (keine Farbpalette-/Layout-Revolution):

- Zellen-Gap 3px → 5px, etwas mehr Innenpadding, minimal größerer Radius
- Gefüllte (Handels-)Tage: dezenter `box-shadow`-Glow in der jeweiligen PnL-Farbe (grün/rot) statt reiner Flat-Fill — mehr Tiefe
- Leere/handelsfreie Tage: schwächerer Rahmen/Kontrast als bisher, damit sie optisch zurücktreten statt gleich "laut" wie gefüllte Tage zu wirken
- Hover: zusätzlich zum bestehenden `scale`-Effekt ein sanfter Shadow-Lift
- Wochen-Stats-Pills im Header (z.B. `+26€ · 6 Tage`) bekommen ein sanftes Gradient statt Flat-Fill

## 4. Streak-Badges

**Berechnung:** Nur Handelstage zählen (Tage mit `pnlByDay`-Eintrag), chronologisch innerhalb des aktuell angezeigten Monats. Ein Tag ist "Gewinntag", wenn Tages-P&L ≥ 0, sonst "Verlusttag". Eine Serie läuft, solange aufeinanderfolgende Handelstage denselben Typ haben — handelsfreie Tage (Wochenende etc.) unterbrechen die Serie **nicht**, sie werden bei der Zählung einfach übersprungen.

**Scope-Grenze:** Serien werden nicht über Monatsgrenzen hinweg fortgeführt — der erste Handelstag eines neuen Monats startet die Zählung neu bei 1. Das ist eine bewusste MVP-Vereinfachung (keine zusätzliche Datenabfrage über den sichtbaren Monat hinaus nötig); spätere Erweiterung auf monatsübergreifende Serien wäre ein eigenes, kleines Folge-Thema.

**Darstellung:** Ab einer Serienlänge von 3 erscheint ein kleines Badge oben rechts in der Zelle des *letzten* Tages der laufenden Serie (nicht auf jedem Tag der Serie, um Rauschen zu vermeiden):
- Gewinnserie: 🔥-Icon (Flame, lucide-react) + Zahl, grün getönt
- Verlustserie: ⚠️-Icon (TriangleAlert, lucide-react) + Zahl, rot getönt

## 5. Bot-Punkte

Unten in der Zelle, unterhalb von Trade-Anzahl/Winrate: eine Reihe kleiner farbiger Punkte, ein Punkt pro eindeutigem Bot (`botId`), der an diesem Tag mindestens einen Trade hatte. Farbe kommt aus `getBotColor()`. Maximal 4-5 Punkte sichtbar, weitere werden als `+N`-Text zusammengefasst. Trades ohne `botId` (manuell erfasst) erzeugen keinen Punkt.

## Betroffene Dateien

- `src/lib/bot-colors.ts` (neu)
- `src/components/dashboard/TradingCalendar.tsx` (Hauptänderung: Props, Streak-Berechnung, Bot-Punkte-Rendering, visuelle Politur)
- `src/app/bridge/trades/BridgeTradesClient.tsx` (Import statt lokaler Kopie)
- `src/components/dashboard/RecentTradesCard.tsx` (Import statt lokaler Kopie)
- `src/app/dashboard/page.tsx` (neue Prop `strategyBots` an `TradingCalendar` durchreichen)

## Keine Änderung nötig an

- `DayModal.tsx` / `TradeDetailModal.tsx` — Klick-Interaktion bleibt unverändert, keine neuen Felder im Detail-Modal in dieser Runde
- Datenmodell/API — alle nötigen Felder (`botId`, `pnl`, `date`) sind bereits vorhanden
- Wochen-Spalte (KW-Logik) — bereits in vorheriger Runde auf echte ISO-Kalenderwochen umgestellt, hier unverändert

## Out of Scope (bewusst zurückgestellt, siehe Recherche)

- R-Multiple-Umschalter (€ ↔ R) im Kalender
- Jahres-Heatmap (GitHub-Stil)
- Wirtschaftskalender-/News-Overlay
- Bester/schlechtester Tag im Monat als Badge
- Monatsübergreifende Streak-Fortführung

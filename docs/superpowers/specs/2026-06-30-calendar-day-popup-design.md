# Design: Kalender-Tag-Popup & Trade-Detail-Fenster

**Datum:** 2026-06-30  
**Status:** Approved

## Überblick

Wenn ein Benutzer im Dashboard-Kalender auf einen Tag mit Trades klickt, öffnet sich ein Modal mit einer Tageszusammenfassung und einer Tradeliste. Ein Klick auf einen Trade öffnet ein zweites, größeres Modal mit allen Trade-Details und einem eingebetteten TradingView-Chart.

## Architektur

### Neue Komponenten

| Datei | Verantwortung |
|---|---|
| `src/components/dashboard/DayModal.tsx` | Tag-Popup: Header, Mini-P&L-Kurve, Stats-Raster, Tradeliste |
| `src/components/dashboard/TradeDetailModal.tsx` | Trade-Detail: Felder links, TradingView Widget rechts |

### Geänderte Komponenten

| Datei | Änderung |
|---|---|
| `src/components/dashboard/TradingCalendar.tsx` | State für `selectedDay`/`selectedTrade`, `onClick` auf Tage mit Trades, beide Modals einbinden |

### State-Flow

```
TradingCalendar
  ├── selectedDay: string | null      → DayModal öffnen
  └── selectedTrade: Trade | null     → TradeDetailModal öffnen (überlagert DayModal)
```

Trades werden **nicht neu abgerufen** — sie kommen als `trades`-Prop und werden clientseitig nach `dateStr` gefiltert.

## DayModal

### Trigger
Klick auf einen Kalender-Tag mit `data !== null` (d.h. mindestens ein abgeschlossener Trade an diesem Tag).

### Aufbau

**Header**
- Wochentag + langes Datum (z.B. „Mo, 10. März 2025")
- Net P&L farbig (grün/rot)
- X-Button zum Schließen

**Mini-P&L-Kurve**
- SVG-Flächendiagramm (keine externe Bibliothek nötig)
- Daten: kumulative P&L der Trades des Tages, sortiert nach `date` (Open-Zeit)
- Startet bei 0, endet beim Tages-Net-P&L
- Farbe: grün wenn Endwert ≥ 0, rot wenn < 0

**Stats-Raster (2×4)**
- Total trades · Winners · Losers · Winrate
- Gross P&L · Gesamtvolumen (Summe `size`) · Commissions · Profit Factor

**Tradeliste**
- Spalten: Open time · Instrument · Side · P&L (farbig) · R:R
- Jede Zeile ist klickbar → `setSelectedTrade(trade)`
- Side als Badge (Long = blau/grün, Short = rot/orange)

**Footer**
- „Cancel"-Button: schließt Modal (`setSelectedDay(null)`)

### Größe & Position
- Breite: 600px max, zentriert
- Backdrop: `rgba(0,0,0,0.6)` mit `backdrop-filter: blur(4px)`
- `border-radius: 16px`, `background: var(--surface)`, `border: 1px solid var(--border)`

## TradeDetailModal

### Trigger
Klick auf eine Trade-Zeile im DayModal.

### Aufbau

**Header**
- Instrument-Name (z.B. „GBPJPY") · Datum
- „← Zurück"-Button: `setSelectedTrade(null)` (DayModal bleibt offen)
- X-Button: schließt beide Modals (`setSelectedTrade(null); setSelectedDay(null)`)

**Linke Spalte (~35% Breite)**

Alle verfügbaren Trade-Felder:

| Label | Feld |
|---|---|
| Net P&L | `trade.pnl` (farbig, groß) |
| Side | `trade.type` als Badge |
| Entry | `trade.entry` |
| Exit | `trade.exit` |
| Stop Loss | `trade.sl` |
| Take Profit | `trade.tp` |
| Size | `trade.size` |
| Commission | `trade.commission` |
| Swap | `trade.swap` |
| R:R | `trade.rr` |
| Laufzeit | Differenz `closeTime - date` (formatiert als „Xh Ym") |
| Notes | `trade.notes` (wenn vorhanden, als Textblock) |
| Tags | `trade.tags` (wenn vorhanden, als Badges) |

**Rechte Spalte (~65% Breite)**

TradingView Advanced Chart Widget als `<iframe>`:
```
https://s.tradingview.com/widgetembed/?symbol={SYMBOL}&interval=15&theme=dark&hide_side_toolbar=0&allow_symbol_change=0&save_image=0
```

Symbol-Mapping (Funktion `toTvSymbol`):
- `GBPJPY` → `FX:GBPJPY`
- `GBPUSD` → `FX:GBPUSD`
- Allgemeine Regel: Forex-Paare (6 Zeichen, nur Buchstaben) → `FX:XXXYYY`
- Andere → unverändert übergeben

Timeframe: 15 (M15, Standard — nicht änderbar im Widget).

### Größe & Position
- Breite: 90vw, max 1200px; Höhe: 85vh
- Z-Index höher als DayModal
- Gleiche Backdrop/Border-Styles wie DayModal

## Kein API-Call

Sämtliche Daten (Trades, Stats) liegen als Props vor. Es sind keine neuen Server-Routen oder fetch-Calls notwendig.

## Nicht im Scope

- Entry/Exit-Marker im Chart (TradingView Widget unterstützt dies nicht)
- Timeframe-Umschalter im Widget
- „Add Note"-Funktion aus dem Referenzbild
- Editieren von Trade-Daten aus dem Modal

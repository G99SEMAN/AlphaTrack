# Design: Entry-/Exit-Marker im Trade-Detail-Chart

**Datum:** 2026-07-11
**Status:** Approved

## Überblick

Im Kalender-Tagespopup öffnet ein Klick auf einen Trade das `TradeDetailModal` mit einem eingebetteten TradingView-Chart (rechtes Panel). Aktuell ist das ein reines `<iframe>` vom kostenlosen TradingView-Embed (`s.tradingview.com/widgetembed`), das keine JavaScript-API für nachträgliches Einzeichnen bietet. Programmatisches Markieren von Einstieg/Ausstieg erfordert entweder die lizenzierte TradingView Charting Library (Zulassung + Self-Hosting nötig) oder eine selbst kontrollierte Chart-Bibliothek.

Entscheidung: Wechsel auf **`lightweight-charts`** (Open-Source-Bibliothek von TradingView selbst), gespeist mit echten Kursdaten von **Twelve Data** (Kursdatenquelle bereits als optionaler API-Key im Projekt vorgesehen, `TWELVE_DATA_API_KEY` ist im aktuellen `.env.local` bereits gesetzt). Der Chart zeichnet Candlesticks im Zeitfenster um den Trade sowie Marker für Entry/Exit und horizontale Linien für SL/TP.

Der TradingView-Embed auf der Analyse-Seite (`TradingViewWidget.tsx`, `AnalyseClient.tsx`) ist **nicht** betroffen — dort geht es um allgemeine Marktanalyse ohne Trade-Bezug, dieser bleibt unverändert.

## Geltungsbereich (Scope)

- Betrifft ausschließlich `TradeDetailModal.tsx`, das nur für **abgeschlossene** Trades aus der Kalender-Tagesansicht geöffnet wird (offene Trades kommen dort laut Bestätigung nicht vor — keine Sonderbehandlung für offene Trades nötig).
- Nur **Forex-Instrumente** (z.B. `EUR/USD`, `GBP/JPY`) bekommen einen echten Chart mit Kursdaten. Alle anderen Instrumentklassen (Indizes wie DAX/ES/NQ, Rohstoffe wie WTI, Krypto wie BTC/USDT, …) zeigen direkt die "nicht unterstützt"-Meldung, ohne Twelve-Data-Anfrage zu versuchen.

## Architektur

### Neue Komponenten/Dateien

| Datei | Verantwortung |
|---|---|
| `src/app/api/quotes/history/route.ts` | Server-Route: nimmt `symbol`, `start`, `end`, `interval` entgegen, ruft Twelve Data `time_series` auf (API-Key serverseitig aus `process.env.TWELVE_DATA_API_KEY`), gibt normalisierte OHLC-Kerzen zurück |
| `src/lib/quotes.ts` | Symbol-Mapping (Instrument → Twelve-Data-Symbol, nur Forex), Intervall-/Zeitfenster-Berechnung aus Trade-Dauer |
| `src/components/dashboard/TradeChart.tsx` | Neue Client-Komponente: rendert `lightweight-charts`-Candlestick-Chart, Entry-/Exit-Marker, SL/TP-Linien, Lade-/Fehlerzustände |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/dashboard/TradeDetailModal.tsx` | Rechtes Panel: `<iframe>` durch `<TradeChart trade={trade} theme={...} />` ersetzen. `toTvSymbol`/`tvSrc` entfallen. |
| `package.json` | Neue Dependency `lightweight-charts` |

### Datenfluss

```
TradeDetailModal
  └── TradeChart(trade, theme)
        ├── isForexInstrument(trade.instrument)?
        │     nein → Fehleranzeige "Chart für dieses Instrument nicht unterstützt"
        │     ja ↓
        ├── berechne Zeitfenster + Intervall aus (trade.date, trade.closeTime)
        ├── GET /api/quotes/history?symbol=...&start=...&end=...&interval=...
        │     ├── Twelve-Data-Fehler / keine Daten → Fehleranzeige "Keine Kursdaten verfügbar"
        │     └── Erfolg → OHLC-Kerzen
        └── lightweight-charts: Candlesticks rendern
              + Marker: Entry (Pfeil, Richtung long=grün-nach-oben/short=orange-nach-unten), Exit (Kreuz/Punkt)
              + Preislinien: SL (rot, gestrichelt, falls gesetzt), TP (grün, gestrichelt, falls gesetzt)
```

## Symbol-Mapping (`src/lib/quotes.ts`)

- Erkennung "ist Forex": Instrument-String matcht (nach Normalisierung, z.B. Trennzeichen `/`, `_`, `.` entfernen, Suffixe wie `m`/`.a` von Broker-Symbolen abstreifen) das Muster von genau 6 Buchstaben, die sich in zwei bekannte 3-Buchstaben-Währungscodes aufteilen lassen (z.B. `EURUSD`, `GBPJPY`).
- Twelve-Data-Symbolformat für Forex: `"XXX/YYY"` (z.B. `EUR/USD`). Mapping-Funktion normalisiert das Instrument in dieses Format.
- Alles, was nicht in dieses Muster passt (Indizes, Futures-Kürzel wie `ES`/`NQ`, Rohstoffe wie `WTI`, Krypto-Paare wie `BTC/USDT`), gilt als nicht unterstützt.

## Zeitfenster- und Intervall-Berechnung

- Trade-Dauer = `closeTime - date`.
- Puffer vor Entry und nach Exit: ca. 25 % der Trade-Dauer auf jeder Seite, mit Mindestpuffer (z.B. 15 Minuten), damit auch sehr kurze Scalp-Trades einen sinnvollen Chart-Ausschnitt bekommen.
- Candle-Intervall gestaffelt nach Trade-Dauer (grobe Richtwerte, im Detail bei der Implementierung feinjustierbar):
  - Dauer ≤ 30 Min → `1min`
  - Dauer ≤ 4 Std → `5min`
  - Dauer ≤ 24 Std → `15min`
  - Dauer > 24 Std → `1h`

## `TradeChart`-Komponente

- Client-Komponente (`'use client'`), analog zu `TradingViewWidget.tsx` mit `useEffect` + `useRef` für den Chart-Container, erzeugt und zerstört den `lightweight-charts`-Chart bei Prop-Änderungen.
- Zustände: `loading` (Skeleton/Spinner), `error` (Meldungstext je nach Fall), `ready` (Chart gerendert).
- Theme (dark/light) wird wie in `TradingViewWidget.tsx` über `useTheme()` (`next-themes`) bestimmt und auf die `lightweight-charts`-Optionen (Hintergrund, Gitterfarbe, Textfarbe) gemappt, passend zu den bestehenden `--surface`/`--border`/`--text-*` CSS-Variablen der App.
- Marker über die `lightweight-charts`-Marker-API auf der Candlestick-Serie (Entry/Exit), Preislinien über `series.createPriceLine()` für SL/TP.

## Fehlerbehandlung

Alle drei Fälle zeigen dieselbe kompakte, zentrierte Meldung anstelle des Charts (Trade-Felder im linken Panel bleiben davon unberührt):

1. Instrument nicht Forex → "Chart für dieses Instrument wird aktuell nicht unterstützt."
2. Twelve Data liefert leere/keine Daten für den Zeitraum (z.B. Trade zu weit in der Vergangenheit für den Twelve-Data-Tarif) → "Für diesen Zeitraum sind keine Kursdaten verfügbar."
3. Netzwerk-/API-Fehler (inkl. Rate-Limit, fehlender `TWELVE_DATA_API_KEY`) → "Kursdaten konnten nicht geladen werden."

Die Server-Route gibt in allen Fehlerfällen einen strukturierten JSON-Fehler mit passendem HTTP-Status zurück; `TradeChart` unterscheidet danach nicht weiter, sondern zeigt jeweils die passende Meldung.

## Nicht betroffen / bewusst außerhalb des Scopes

- `TradingViewWidget.tsx` / `AnalyseClient.tsx` (Analyse-Seite) — unverändert.
- Offene Trades — kommen im Kalender-Tagespopup nicht vor, daher keine Sonderbehandlung.
- Nicht-Forex-Instrumente bekommen in dieser Iteration keine Kursdaten-Anbindung (kein Mapping-Versuch, direkt "nicht unterstützt").

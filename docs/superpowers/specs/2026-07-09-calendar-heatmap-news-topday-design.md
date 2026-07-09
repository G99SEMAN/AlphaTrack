# Dashboard-Kalender: Jahres-Heatmap, News-Overlay, Bester/Schlechtester Tag

**Datum:** 2026-07-09
**Status:** Genehmigt

## Problem

Im Rahmen der Kalender-Modernisierung (`docs/superpowers/specs/2026-07-09-dashboard-calendar-modernization-design.md`) wurden drei Trader-Mehrwert-Features bewusst zurückgestellt, um den ersten Batch (Streaks, Bot-Punkte, visuelle Politur) klein zu halten:

1. Jahres-Heatmap (GitHub-Contribution-Stil) für saisonale Muster
2. Wirtschaftskalender-/News-Overlay — Korrelation zwischen Trading-Tagen und Marktereignissen
3. Bester/schlechtester Tag im Monat als Hervorhebung

Dieser Spec setzt alle drei um.

## Wichtige Einschränkung: News-Datenverfügbarkeit

`fetchWirtschaftskalender()` (Tradays-Fallback) und `fetchWirtschaftskalenderFromBridge()` liefern **nur Events für die aktuelle + nächste Woche** (Bridge: `days_back=2&days_ahead=9`) — es gibt keine Historie. Das News-Overlay kann daher **nicht rückwirkend** zeigen, welche News an einem vergangenen Trading-Tag liefen. Entscheidung: Overlay zeigt Marker nur für Tage, für die Daten existieren (aktuelle/nächste Woche); bei Navigation in andere Monate erscheinen einfach keine Marker — kein Fehlerzustand.

## Lösung — Übersicht

Drei weitgehend unabhängige Ergänzungen an/um `src/components/dashboard/TradingCalendar.tsx`:

1. **Jahres-Heatmap** — neue Komponente `YearHeatmap.tsx`, per Header-Toggle in derselben Kalender-Karte
2. **News-Overlay** — kleiner Marker in der Tageszelle, Daten kommen serverseitig ins Dashboard
3. **Bester/Schlechtester Tag** — Zellrahmen-Hervorhebung, rein clientseitige Berechnung

## 1. Jahres-Heatmap

**Neue Datei:** `src/components/dashboard/YearHeatmap.tsx`

- Props: `trades: Trade[]`, `year: number`, `onSelectMonth: (year: number, month: number, day: string) => void`
- Raster: 53 Wochenspalten × 7 Tagesreihen (GitHub-Contribution-Layout) für das übergebene Jahr, kleine quadratische Zellen (~10-12px)
- Farbintensität: Grün/Rot nach Tages-P&L, gleiche Berechnung wie in der Monatsansicht (`Math.min(Math.abs(pnl)/500, 1)` als Intensitäts-Faktor) — Tage ohne Trades bleiben neutral/leer
- Interaktion: Hover zeigt Tooltip mit Datum + P&L. Klick auf einen Tag mit Daten ruft `onSelectMonth(year, month, dateKey)` auf — `TradingCalendar` wechselt zurück in die Monatsansicht des jeweiligen Monats und öffnet direkt `DayModal` für den Tag (nutzt bestehenden `selectedDay`-State, keine neue Modal-Komponente nötig)
- Eigene Datei statt Erweiterung von `TradingCalendar.tsx`, da dieses schon ~430 Zeilen hat und die Heatmap eine eigenständige, unabhängig testbare Darstellungslogik ist

**In `TradingCalendar.tsx`:**
- Neuer State `viewMode: 'month' | 'year'` (Default `'month'`)
- Header bekommt einen zusätzlichen Toggle-Button „Jahr" neben „Dieser Monat" (nur sichtbar, wenn `viewMode === 'month'`; im Jahres-Modus zeigt der Button „Monat" um zurückzuwechseln)
- Bei `viewMode === 'year'` wird das gesamte Grid (Tage + Wochen-Spalte) durch `<YearHeatmap trades={trades} year={year} onSelectMonth={...} />` ersetzt; Header (Monatsname/Jahr-Navigation, Monats-Stats-Pills) bleibt für den Jahres-Modus ausgeblendet bzw. zeigt nur die Jahreszahl mit Prev/Next-Jahr-Navigation

## 2. News-Overlay

**Geteilte Fetch-Funktion** (Refactor, kein Verhaltenswechsel für bestehende Nutzer):
- Neue Funktion `getWirtschaftskalenderData()` in `src/lib/wirtschaftskalender.ts`, die die bestehende Bridge-zuerst-dann-Tradays-Fallback-Kette kapselt (aktuell dupliziert zwischen `route.ts` und dem, was das Dashboard jetzt braucht)
- `src/app/api/wirtschaftskalender/route.ts` wird auf die neue Funktion umgestellt (Verhalten unverändert, nur Code-Konsolidierung)

**In `src/app/dashboard/page.tsx`:**
- Ruft `getWirtschaftskalenderData()` serverseitig auf, in `try/catch` (Fehler → leeres Array, Dashboard bricht nicht ab)
- Filtert auf `impact === 'High'`, reicht `highImpactEvents: WirtschaftsEvent[]` als neue Prop an `TradingCalendar` durch

**In `TradingCalendar.tsx`:**
- Neue Prop `highImpactEvents: WirtschaftsEvent[]`
- Pro Tageszelle: kleiner roter Punkt oben links neben der Tageszahl, wenn `highImpactEvents` mindestens ein Event mit passendem `date`-Feld enthält (Farbe wie `ImpactBadge`'s High-Konfiguration: `#ff4560`)
- Tooltip (`title`-Attribut) listet Event-Name(n) + Uhrzeit(en) bei mehreren Events am selben Tag
- Kein Marker für Tage außerhalb des Datenfensters (ergibt sich automatisch, da `highImpactEvents` nur diese Tage enthält)

## 3. Bester/Schlechtester Tag im Monat

Rein clientseitige `useMemo`-Berechnung in `TradingCalendar.tsx`, analog zu `streakByDate`:
- Bester Tag = Tag mit dem höchsten Tages-P&L im sichtbaren Monat, **nur wenn P&L > 0** (in einem komplett negativen Monat gibt es keine Hervorhebung)
- Schlechtester Tag = Tag mit dem niedrigsten Tages-P&L im sichtbaren Monat, **nur wenn P&L < 0**
- Bei Gleichstand (mehrere Tage mit identischem Extremwert): alle betroffenen Tage werden markiert
- Darstellung: Zellrahmen + Glow — golden (`#fbbf24`-Ton) für den besten Tag, gedämpft silbrig-grau (`#94a3b8`-Ton) für den schlechtesten — ersetzt den normalen Grün/Rot-Rahmen dieser Zelle
- Priorität: „Heute" (`isToday`, Accent-Blau) hat weiterhin Vorrang vor dieser Hervorhebung, wie schon beim bestehenden Grün/Rot-Rahmen
- Kein Konflikt mit dem Streak-Badge (oben rechts) oder den Bot-Punkten (unten) möglich, da unterschiedliche visuelle Ebenen (Rahmen vs. Badge vs. Punkte) — ein Tag kann theoretisch gleichzeitig „bester Tag des Monats" UND „Ende einer Gewinnserie" sein, beide Hervorhebungen sind dann gleichzeitig sichtbar

## Betroffene Dateien

- `src/components/dashboard/YearHeatmap.tsx` (neu)
- `src/components/dashboard/TradingCalendar.tsx` (View-Toggle, News-Marker, Top/Flop-Tag-Rahmen, neue Props)
- `src/lib/wirtschaftskalender.ts` (neue geteilte `getWirtschaftskalenderData()`-Funktion)
- `src/app/api/wirtschaftskalender/route.ts` (auf geteilte Funktion umgestellt)
- `src/app/dashboard/page.tsx` (News-Daten serverseitig laden, an `TradingCalendar` durchreichen)

## Keine Änderung nötig an

- `DayModal.tsx` / `TradeDetailModal.tsx` — werden von der Jahres-Heatmap wiederverwendet, keine Anpassung nötig
- `ImpactBadge.tsx` / bestehende `/kalender`-Seite — News-Overlay im Dashboard ist eine separate, kleinere Darstellung (nur High-Impact, nur Punkt+Tooltip), keine gemeinsame Komponente nötig
- Streak- und Bot-Punkte-Logik aus der vorherigen Runde — unverändert

## Out of Scope

- Historische News-Daten (nicht verfügbar, siehe oben)
- Medium/Low-Impact-Events im Dashboard-Overlay (nur High, um die Zelle nicht zu überladen — die volle Ansicht bleibt der `/kalender`-Seite vorbehalten)
- Eigene Detailansicht für News-Events im Dashboard (nur Tooltip, kein Klick-Modal)
- Jahres-Heatmap für andere Jahre als das aktuell gewählte über eine eigene Navigation hinaus (Jahr-Wechsel via Prev/Next, kein Jahres-Picker)

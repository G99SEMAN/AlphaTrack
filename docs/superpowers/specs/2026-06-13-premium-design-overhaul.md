# AlphaTrack Premium Design Overhaul

**Datum:** 2026-06-13  
**Ansatz:** Vollständiger Premium-Overhaul (Ansatz C)  
**Status:** Approved — bereit für Implementierung

---

## Ziel

AlphaTrack bekommt ein vollständig überarbeitetes visuelles System im Stil eines professionellen Finance-Terminals (Bloomberg-Ästhetik). Betroffen: Farbsystem, Typografie, Spacing, Karten-Komponenten, Sidebar-Struktur und Dashboard-Grid. Alle Bereiche werden angefasst.

---

## 1. Farbsystem

### Dark Mode (Standard)

| Token | Alt | Neu | Beschreibung |
|---|---|---|---|
| `--bg` | `#080b12` | `#03060e` | Tiefer, blau-schwarzer Hintergrund |
| `--surface` | `#0f1623` | `#080d18` | Karten- und Sidebar-Fläche |
| `--surface-2` | `#162032` | `#0c1525` | Sekundäre Flächen, Inputs |
| `--surface-3` | `#1e2d45` | `#132035` | Tertäre Flächen, Hover |
| `--border` | `#1e2d45` | `#0f1e35` | Hauptborder — feiner, blauer |
| `--border-subtle` | `#162032` | `#0a1628` | Tabellen-Trennlinien |
| `--text-1` | `#e8edf5` | `#f0f5ff` | Primärtext — leicht kühler |
| `--text-2` | `#7a8fa6` | `#4a6888` | Sekundärtext |
| `--text-3` | `#4a6080` | `#1e3a5f` | Beschriftungen, Labels |
| `--accent` | `#3b82f6` | `#3b82f6` | Blau — unverändert |
| `--accent-bg` | `rgba(59,130,246,0.12)` | `rgba(59,130,246,0.10)` | Akzent-Hintergrund |
| `--amber` | *(nicht vorhanden)* | `#f59e0b` | Neu: für Warn-Highlights (offene Trades) |

### Karten-Schatten (neu)

```css
--card-shadow: 0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03);
--card-shadow-hover: 0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04);
```

### Karten Top-Glow (neu)

Jede Karte bekommt einen absolut positionierten 1px-Streifen oben:

```css
/* Pseudo-Element oder <div> am Kartenanfang */
background: linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent);
height: 1px;
position: absolute; top: 0; left: 0; right: 0;
```

### Badges — Dark-native (neu)

Keine hellen Pastellfarben mehr im Dark Mode. Alle Badges nutzen transparente Hintergründe mit Border:

```css
/* Grün */  background: rgba(0,217,126,0.10); border: 1px solid rgba(0,217,126,0.20); color: #00d97e;
/* Rot */   background: rgba(255,69,96,0.10);  border: 1px solid rgba(255,69,96,0.20);  color: #ff4560;
/* Blau */  background: rgba(59,130,246,0.10); border: 1px solid rgba(59,130,246,0.20); color: #60a5fa;
/* Amber */ background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.18); color: #f59e0b;
```

### Buttons — Gradient + Schatten (neu)

```css
/* Primary Button */
background: linear-gradient(135deg, #1d4ed8, #3b82f6);
border-radius: 10px;
box-shadow: 0 4px 14px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
font-weight: 700;
```

### Light Mode & Farbthemen

Light Mode und die drei Farbthemen (Blau/Rot/Violett) bleiben erhalten. Nur das Dark-Mode-Fundament wird überarbeitet. Die Light-Mode-Tokens bleiben unverändert.

---

## 2. Typografie

Fonts bleiben: **Outfit** (UI) + **DM Mono** (Zahlen/Code).

### Neue Skala

| Verwendung | Größe | Gewicht | Letter-Spacing |
|---|---|---|---|
| Hero-Zahlen (PnL-Karte) | `28px` | `800` | `-0.04em` |
| Karten-Hauptwerte | `20–24px` | `800` | `-0.02em` bis `-0.03em` |
| Seitentitel | `20px` | `800` | `-0.02em` |
| Card-Labels | `8px` | `700` | `0.16em` (uppercase) |
| Sektions-Labels | `9px` | `700` | `0.14em` (uppercase) |
| Fließtext | `11–12px` | `400–500` | normal |
| Tabellenwerte | DM Mono, `10–11px` | `600–700` | normal |

### Regeln

- Alle Zahlen in Karten: `font-variant-numeric: tabular-nums`
- Alle Zahlen in Karten: DM Mono (`font-family: var(--font-dm-mono)`)
- Negative Werte: `color: var(--red)` + DM Mono
- Positive Werte: `color: var(--green)` + DM Mono

---

## 3. Spacing

| Element | Alt | Neu |
|---|---|---|
| Card padding | `14px` | `16px` |
| Card border-radius | `10px` | `14px` |
| Grid gap | `16px` | `16px` (unverändert) |
| Sidebar item border-radius | `8px` | `8px` (unverändert) |
| Button border-radius | `8px` | `10px` |
| Badge border-radius | `5px` | `6px` |

---

## 4. Sidebar

### Struktur-Änderungen

**Kollaps-Modus (neu):**
- Toggle-Taste im Logo-Bereich (Pfeil-Icon, 22×22px)
- Ausgeklappt: `224px` (w-56) — unverändert
- Eingeklappt: `52px` — nur Icons, kein Text
- Zustand wird in `localStorage` unter `alphatrack-sidebar-collapsed` gespeichert
- Framer Motion Transition beim Ein-/Ausklappen (`width`, `opacity`)
- Im eingeklappten Modus: Profil-Pill, MT5-Balance-Text und Sektions-Labels ausgeblendet

**Profil-Bereich (neu):**
- Ersetzt den bisherigen Profil-Bereich durch ein kompaktes **Profil-Pill**
- Zeigt: Profil-Avatar (Initiale mit Gradient), Name, Typ + Startkapital
- Chevron-Icon zum Öffnen des ProfileSwitcher
- Im Kollaps-Modus: nur Avatar-Icon sichtbar

**Navigations-Hierarchie (neu):**
- Sektions-Labels werden zu **Linie + Label** statt nur Text:
  ```
  — — Übersicht — — — — — — — — —
  ```
- Zwei Sektionen: **Übersicht** (Dashboard, Trades, Statistiken, Kalender, TPC, Netzwerk) und **Bridge & Bots** (Bridge, Bridge Log, Bots, Bot Settings, Strategien, Performance, Live Trades, Trade Analyzer)
- Sektions-Gruppen können nicht mehr kollabiert werden — alle Items beider Sektionen sind permanent sichtbar. Die Navigation wird dadurch länger, bleibt aber scrollbar. Bridge und Bots werden zu einer gemeinsamen Sektion zusammengeführt (statt drei getrennte collapsible Gruppen).
- Aktiver Nav-Link: `background: rgba(59,130,246,0.12)` + `border: 1px solid rgba(59,130,246,0.18)` + blauer Dot links

**MT5-Balance (neu):**
- Wird zur eigenständigen Karte mit `background: var(--surface-2)`
- Zeigt: Status-Dot (grün/amber) + Label + Kontostand (DM Mono, 16px/800) + Währung

**Logo-Mark (neu):**
- Im Kollaps-Modus: nur der blaue Gradient-Quadrat mit „A"
- Im ausgeklappten Modus: Quadrat + „AlphaTrack" + „Trading Journal"
- Logo-Mark: `background: linear-gradient(135deg, #1d4ed8, #3b82f6)`, border-radius 9px, box-shadow blau

### Betroffene Dateien

- `src/components/layout/Sidebar.tsx` — Haupt-Umbau
- `src/app/globals.css` — keine Änderungen (Sidebar nutzt Inline-Styles)

---

## 5. Dashboard Grid

### Neues Layout (Desktop, lg: 12 Spalten)

```
[ PnL Hero (8 col)          ] [ Win Rate (4 col) ]
[                            ] [ Risiko    (4 col) ]
[ Equity Chart (12 col, volle Breite)              ]
[ Letzte Trades (6 col)      ] [ Offene Trades (6 col) ]
```

**PnL Hero-Karte (neu, 8 col):**
- Größte Karte — dominiert visuell
- Enthält: Label, Hauptzahl (28px/800), Badge-Zeile (Gesamtrendite + Tageswert), eingebetteter Sparkline-Chart (mini Equity-Kurve, ~40px Höhe)
- Kein separater EquityChart in dieser Zeile mehr

**Win Rate + Risiko (je 4 col, gestapelt rechts):**
- Zwei kompaktere Karten übereinander
- Win Rate: Prozent (20px/800) + Trade-Anzahl + aktuelle Streak
- Risiko: Avg R:R (20px/800) + Max Drawdown

**Equity Chart (12 col, volle Breite):**
- Rückt in eigene Zeile, volle Breite
- Höhe: `min-height: 200px` statt bisher `280px` (mehr Platz für untere Karten)
- Kein Sparkline-Doppel — der vollständige Chart bleibt hier

**Letzte Trades + Offene Trades (je 6 col):**
- Nebeneinander statt übereinander
- Offene kritische Positionen: amber `border-left: 3px solid var(--amber)` Markierung

### Betroffene Dateien

- `src/app/dashboard/page.tsx` — Grid-Layout
- `src/components/dashboard/PnLCard.tsx` — Hero-Umbau mit Sparkline
- `src/components/dashboard/DashboardWinRate.tsx` — kompaktere Version
- `src/components/dashboard/RiskCard.tsx` — kompaktere Version
- `src/components/dashboard/EquityChart.tsx` — volle Breite, neue Höhe
- `src/components/dashboard/RecentTradesCard.tsx` — 6-col Layout
- `src/components/dashboard/CriticalOpenTradesCard.tsx` — 6-col, amber Highlight

---

## 6. Globale Komponenten-Änderungen

### `globals.css`

- Neue CSS-Variablen (Tabelle oben) für Dark Mode
- Neue `--card-shadow` und `--card-shadow-hover` Werte
- Kein Änderungsbedarf an Light-Mode-Tokens oder Farbthemen

### Karten-Basis-Muster (gilt überall)

```tsx
<div
  style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    boxShadow: 'var(--card-shadow)',
    position: 'relative',
    overflow: 'hidden',
  }}
>
  {/* Top-Glow */}
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
  }} />
  {/* Inhalt */}
</div>
```

### Inputs

```css
background: var(--surface-2);
border: 1px solid var(--border);
border-radius: 10px;
padding: 9px 13px;
box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
```

---

## Nicht im Scope

- Mobile Bottom Navigation — keine strukturellen Änderungen (nur visuelle Anpassung der Farben via CSS-Variablen)
- Bridge, Journal, Statistiken, Kalender, Bots-Seiten — erben die neuen Farben und Komponenten automatisch; keine seitenspezifischen Layout-Änderungen
- Light-Mode-Farbpalette — bleibt unverändert
- Farbthemen (Rot/Violett) — Fundament-Tokens werden angepasst, Akzentfarben bleiben

---

## Implementierungs-Reihenfolge (Empfehlung)

1. `globals.css` — neue CSS-Variablen und Schatten
2. Wiederverwendbare Karten-Muster (Card-Basis, Badges, Buttons)
3. Sidebar-Redesign inkl. Kollaps-Logik
4. Dashboard-Grid-Umbau
5. PnL Hero-Karte mit Sparkline
6. Restliche Dashboard-Karten (WinRate, Risk, RecentTrades, CriticalOpenTrades)

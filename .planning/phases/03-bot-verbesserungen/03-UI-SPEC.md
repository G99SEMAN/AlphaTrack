---
phase: 3
slug: bot-verbesserungen
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-11
---

# Phase 3 — UI Design Contract: Bot-Verbesserungen

> Visual and interaction contract für Phase 3. Generiert von gsd-ui-researcher, verifiziert von gsd-ui-checker.
> Scope: Bot-Karte (BotsClient.tsx) + Bot-Settings (BotsSettingsClient.tsx)

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — custom Tailwind components |
| Preset | not applicable |
| Component library | none (custom components via CSS variables) |
| Icon library | lucide-react 1.11.0 |
| Font | System-UI (kein expliziter Font-Import; Next.js Default) |
| Animation | Framer Motion 12 (bereits in BotsClient.tsx + BotsSettingsClient.tsx verwendet) |
| Theme | Dark/Light via next-themes; CSS-Variablen in globals.css |

> Quelle: globals.css, BotsClient.tsx, BotsSettingsClient.tsx

---

## Spacing Scale

Deklarierte Werte (Vielfache von 4) — Tailwind-Klassen entsprechend:

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| xs | 4px | `gap-1`, `p-1` | Icon-Lücken, Inline-Padding |
| sm | 8px | `gap-2`, `p-2` | Kompakte Element-Abstände |
| md | 16px | `gap-4`, `p-4` | Standard Element-Spacing, Card-Padding |
| lg | 24px | `gap-6`, `p-6` | Section-Padding (Desktop: `md:p-6`) |
| xl | 32px | `gap-8` | Layout-Abstände |
| 2xl | 48px | `p-12` | Leer-Zustand Cards (bereits vorhanden) |
| 3xl | 64px | — | Page-Level (nicht in diesem Scope) |

Ausnahmen:
- Stats-Grid-Gap: 8px (`gap-2`) — bestehend in BotsClient.tsx, beibehalten
- Stat-Kachel-Padding: 12px horizontal / 8px vertikal (`px-3 py-2`) — bestehend, beibehalten
- Status-Dot: 8×8px fixed (`width: 8, height: 8`) — bestehend, beibehalten
- Input-Felder (Parameter-Editor): 12px horizontal / 8px vertikal (`px-3 py-2`) — konsistent mit bestehendem Edit-Formular

> Quelle: BotsClient.tsx Z.164–173, BotsSettingsClient.tsx Z.135–149 (existing patterns)

---

## Typography

| Role | Size | Weight | Line Height | Tailwind |
|------|------|--------|-------------|----------|
| Body / Label | 14px | 400 (regular) | 1.5 | `text-sm` |
| Stat-Value | 14px | 700 (bold) | 1 | `text-sm font-bold` |
| Card-Name / Heading | 14px | 700 (bold) | 1.25 | `text-sm font-bold` |
| Section-Heading | 20px | 700 (bold) | 1.2 | `text-xl font-bold` |
| Badge / Meta | 10–11px | 600 (semibold) | 1 | `text-[10px] font-semibold` / `text-[11px]` |
| Stat-Label | 10px | 400 (regular) | 1 | `text-[10px] uppercase tracking-wide` |
| Mono (IDs, URL) | 11px | 400 (regular) | 1 | `text-[11px] font-mono` |

Gewichte im Einsatz: 400 (regular) + 700 (bold) — ausnahmsweise 600 (semibold) für Badges/Labels.

> Quelle: Bestehendes Muster in BotsClient.tsx (Z.95–175); keine Abweichung für neue Elemente.

---

## Color

Alle Werte stammen aus globals.css CSS-Variablen. Beide Themes (Light + Dark) sind automatisch abgedeckt.

| Role | CSS Variable | Light | Dark | Usage |
|------|-------------|-------|------|-------|
| Dominant (60%) | `var(--bg)` | #f0f4f8 | #080b12 | Page-Hintergrund, Stat-Kachel-Hintergrund |
| Secondary (30%) | `var(--surface)` | #ffffff | #0f1623 | Cards, Leer-Zustand, Settings-Zeilen |
| Secondary alt | `var(--surface-2)` | #f8fafc | #162032 | Sekundäre Buttons, Hover-States |
| Accent (10%) | `var(--accent)` | #2563eb | #3b82f6 | Parameter-senden-Button, Links, Icon in Leer-Zustand |
| Accent bg | `var(--accent-bg)` | #dbeafe | rgba(59,130,246,0.12) | Icon-Container im Leer-Zustand |
| Positiv P&L | `var(--green)` | #00b368 | #00d97e | P&L-Wert wenn ≥ 0 |
| Positiv bg | `var(--green-bg)` | #dcfce7 | rgba(0,217,126,0.12) | (Optional) Badge-Hintergrund für positive P&L |
| Negativ P&L | `var(--red)` | #e53e3e | #ff4560 | P&L-Wert wenn < 0 |
| Negativ bg | `var(--red-bg)` | #fee2e2 | rgba(255,69,96,0.12) | (Optional) Badge-Hintergrund für negative P&L |
| Text primär | `var(--text-1)` | #0d1a2d | #e8edf5 | Bot-Name, Stat-Werte, Headings |
| Text sekundär | `var(--text-2)` | #4a6080 | #7a8fa6 | Sekundäre Buttons-Text |
| Text tertiär | `var(--text-3)` | #94a3b8 | #4a6080 | Labels, Meta-Infos, IDs |
| Border | `var(--border)` | #e2e8f0 | #1e2d45 | Card-Rahmen, Trennlinien |
| Destructive | `#ef4444` (inline) | — | — | Nicht in Phase 3 vorhanden (Buttons entfernt) |

**Accent reserviert für:**
- „Parameter senden"-Button (primary action, pro Bot)
- Detail-Link (`/bots/:id`) in Bot-Karte
- Icon im Leer-Zustand (accent-bg Container + accent Icon)

**P&L-Farbregel (D-05, Quelle: CONTEXT.md):**
- `realizedPnl > 0` → Wert in `var(--green)`, prefix `+`
- `realizedPnl < 0` → Wert in `var(--red)`, prefix `-` (Vorzeichen aus Number)
- `realizedPnl === 0` → Wert in `var(--text-1)`, prefix `+` (echte Null ≠ kein Wert)
- Keine geschlossenen Trades → Dash-Zeichen `-` in `var(--text-3)` (D-06)

> Quelle: globals.css Z.1–42, CONTEXT.md D-05/D-06, BotsClient.tsx Z.35–38 (bestehende green-Nutzung)

---

## Component Inventory

### Komponenten die GEÄNDERT werden (Scope dieser Phase)

#### 1. `BotsClient.tsx` — Bot-Karte Stats-Grid

**Aktueller Zustand:** 2-Spalten-Grid mit `Balance`, `Positionen`, `Uptime`

**Neuer Zustand:** 2-Spalten-Grid mit `P&L`, `Positionen`, `Trades`, `Uptime`

Stat-Kacheln im Grid (Reihenfolge):
1. **P&L** (realisiert) — Wert farbig per P&L-Farbregel; `currencySymbol()` anhängen; kein Wert → `-`
2. **Positionen** (offen) — Wert aus `/api/bots/:id/stats`; kein Wert → `-`
3. **Trades** (gesamt) — Wert aus `/api/bots/:id/stats`; kein Wert → `-`
4. **Uptime** — bestehend, unverändert

Grid-Layout: `grid grid-cols-2 gap-2` — bestehend, unverändert.

Bestehende `<Stat>` Komponente wird wiederverwendet. P&L-Wert benötigt eine Erweiterung: optionaler `valueColor`-Prop (`string | undefined`). Wenn übergeben, überschreibt er `var(--text-1)` für den Wert.

```tsx
// Erweiterte Stat-Signatur
function Stat({ label, value, valueColor }: {
  label: string
  value: string
  valueColor?: string
})
```

API-Polling: `/api/bots/:id/stats` alle 8s (gleicher Interval wie bestehender `/api/bridge/status`-Refresh).

#### 2. `BotsSettingsClient.tsx` — Bot-Settings Umbau

**Entfernte Elemente (BOTS-06, BOTS-07):**
- `Pencil`-Button + `startEdit()`-Funktion komplett entfernen
- `Trash2`-Button + `deleteBot()`-Funktion komplett entfernen
- `EditState`-Interface + `editing`-State entfernen
- `saving`-State entfernen
- `AnimatePresence`/`isEditing`-Branch entfernen
- `error`-State und Fehleranzeige entfernen

**Filterlogik (D-14):** Nur verbundene Bots anzeigen:
```tsx
const filterBots = (list: BotWithStatus[]) =>
  list.filter(b => b.bot.type === 'bot' && b.status?.connectionState !== 'offline')
```
(Gleiche Logik wie `BotsClient.tsx` — `connectionState !== 'offline'` statt nur `type === 'bot'`)

**Read-only Bot-Info (D-13):** Name + URL bleiben sichtbar, aber nicht editierbar. Layout: horizontale Zeile (bestehend), ohne Aktions-Buttons.

**Parameter-Editor (BOTS-08, D-10/D-11):**

Pro Bot: Sektion unter den Bot-Infos, getrennt durch `border-t var(--border)`.

Zustände:
1. **Keine Parameter** (`parameters` undefined oder leeres Object): Info-Text anzeigen — „Dieser Bot unterstützt keine konfigurierbaren Parameter." (D-11)
2. **Parameter vorhanden**: Pro Parameter eine Zeile mit Label + passendem Input-Typ

Input-Typ-Inferenz (D-10):
- `typeof value === 'number'` → `<input type="number">` — 96px breit, rechtsbündig ausgerichtet
- `typeof value === 'boolean'` → `<button role="switch">` Toggle — 44×24px, grün wenn true / surface-3 wenn false
- `typeof value === 'string'` → `<input type="text">` — flex-1 breit

Parameter-Zeilen-Layout: `flex items-center justify-between gap-3` mit Label links (`text-xs font-semibold var(--text-2)`) und Input rechts.

**„Parameter senden"-Button (D-15):** Pro Bot, unterhalb der Parameter-Liste.
- Label: „Parameter senden"
- Icon: `Check` (lucide-react, size=12), links vom Label
- Style: `background: var(--accent), color: #fff, px-3 py-2 rounded-xl text-xs font-bold`
- Lade-State: Button disabled + Label „Senden..." während `fetch` läuft
- Erfolgs-Feedback: Button-Label wechselt für 2s zu „Gesendet ✓", dann zurück
- Nur sichtbar wenn `parameters` vorhanden (nicht beim Info-Text-Zustand)

### Keine Änderung (nur als Referenz)

- `BotDetailClient.tsx` — Namens-Bearbeitung prüfen (BOTS-07), aber kein UI-Contract nötig wenn nur Entfernen
- `ConnectionBadge`, `StateBadge` in BotsClient.tsx — unverändert
- Leer-Zustand (kein Bot aktiv) in beiden Dateien — unverändert

---

## States & Interactions

### Bot-Karte: Stats-Loading

| Zustand | Darstellung |
|---------|-------------|
| Initial (kein Stats-Fetch abgeschlossen) | Alle 4 Stat-Werte zeigen `-` |
| Stats geladen, P&L positiv | P&L-Wert in `var(--green)` mit `+`-Prefix |
| Stats geladen, P&L negativ | P&L-Wert in `var(--red)` mit `-`-Prefix |
| Stats geladen, P&L null | P&L-Wert `+0.00 EUR` in `var(--text-1)` |
| Bot ohne geschlossene Trades | P&L zeigt `-` in `var(--text-3)` |
| Stats-Fetch schlägt fehl | Stat-Werte bleiben bei `-`, kein Error-Toast |

### Bot-Settings: Parameter-Editor

| Zustand | Darstellung |
|---------|-------------|
| Bot verbunden, keine Parameter | Info-Text in `var(--text-3)`, kein Button |
| Bot verbunden, Parameter vorhanden | Parameter-Liste + „Parameter senden"-Button |
| Button geklickt, Fetch läuft | Button disabled, Label „Senden..." |
| Fetch erfolgreich | Button-Label „Gesendet ✓" für 2s, dann zurück |
| Fetch fehlgeschlagen | Inline-Fehlertext unter Parameter-Liste: `text-xs var(--red)` |
| Kein Bot verbunden (leere Liste) | Leer-Zustand Card (bestehend, unverändert) |

### Toggle (boolean Parameter)

| Zustand | Darstellung |
|---------|-------------|
| `true` | Track `background: var(--green)`, Thumb rechts |
| `false` | Track `background: var(--surface-3)`, Thumb links |
| Hover | Cursor pointer, leichte Opacity-Änderung |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| **Primary CTA** | „Parameter senden" |
| **Leer-Zustand Heading (Bots-Seite)** | „Kein Bot aktiv" |
| **Leer-Zustand Body (Bots-Seite)** | „Starte einen Bot auf dem Mini PC — er erscheint automatisch hier sobald er sich mit der Bridge verbindet." |
| **Leer-Zustand Heading (Settings)** | „Kein Bot verbunden" |
| **Leer-Zustand Body (Settings)** | „Verbinde einen Bot über die Bridge — verbundene Bots erscheinen hier zur Konfiguration." |
| **Keine Parameter Info-Text** | „Dieser Bot unterstützt keine konfigurierbaren Parameter." |
| **Lade-State Button** | „Senden..." |
| **Erfolgs-Feedback Button** | „Gesendet ✓" |
| **Fehler: Netzwerkfehler** | „Verbindung zum Bot fehlgeschlagen. Prüfe ob der Bot noch erreichbar ist." |
| **Fehler: Server-Fehler** | „Parameter konnten nicht gesendet werden." |
| **Stats-Label: P&L** | „P&L" |
| **Stats-Label: Trades** | „Trades" |
| **Stats-Label: Positionen** | „Positionen" |
| **Stats-Label: Uptime** | „Uptime" |
| **Settings Subheading** | „Bot Einstellungen" |
| **Settings Subheading Body** | „Konfiguriere Parameter der verbundenen Bots" |

Keine destruktiven Aktionen in Phase 3 (Buttons werden entfernt, nicht ersetzt).

> Quelle: CONTEXT.md D-11; bestehende Copy aus BotsClient.tsx Z.110–113 (Leer-Zustand), angepasst für Settings-Seite

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine | nicht erforderlich — kein shadcn |
| Drittanbieter | keine | nicht erforderlich |

Kein shadcn initialisiert. Alle Komponenten sind custom Tailwind + CSS-Variablen. Kein Registry-Vetting nötig.

---

## Accessibility

| Element | Anforderung |
|---------|------------|
| Toggle (boolean Parameter) | `role="switch"`, `aria-checked={value}`, `aria-label={paramKey}` |
| number-Input | `type="number"`, `aria-label={paramKey}` |
| text-Input | `type="text"`, `aria-label={paramKey}` |
| „Parameter senden"-Button | `disabled` während Fetch; `aria-busy="true"` während Senden |
| P&L-Wert | Rein visuell; Farbe allein nicht einzige Unterscheidung (Vorzeichen im Text) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

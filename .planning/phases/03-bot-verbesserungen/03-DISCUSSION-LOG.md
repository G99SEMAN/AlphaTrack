# Phase 3: Bot-Verbesserungen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 3-Bot-Verbesserungen
**Areas discussed:** Metriken-Datenquelle, P&L-Definition, Bot-Parameter (BOTS-08), Settings-Seite Umbau

---

## Metriken-Datenquelle

### Datenquelle

| Option | Description | Selected |
|--------|-------------|----------|
| Aus Trade-Daten berechnen | Server-seitig aus data/trades-*.json, sourceId = botId | ✓ |
| Aus Heartbeat übernehmen | Bot meldet direkt im Heartbeat-Payload | |
| Gemischt | Positionen aus Heartbeat, P&L aus Trades | |

**User's choice:** Aus Trade-Daten berechnen
**Notes:** Heartbeat meldet openPositions aktuell als 0 (BOTS-01 Root Cause); sourceId ist nach Phase 1 verlässlich.

### Berechnungsort

| Option | Description | Selected |
|--------|-------------|----------|
| Neuer API-Endpunkt /api/bots/:id/stats | Server-seitig, analog /api/bots/:id/log | ✓ |
| In /api/bridge/status einbauen | Metriken in bestehende Status-Antwort | |

**User's choice:** Neuer API-Endpunkt /api/bots/:id/stats

### Profil-Filterung

| Option | Description | Selected |
|--------|-------------|----------|
| bot.profileId | Liest trades-{bot.profileId}.json | ✓ |
| Aktives Profil | Immer aktives Profil | |
| Alle Profile | Alle Profile durchsuchen | |

**User's choice:** bot.profileId

---

## P&L-Definition

### P&L-Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nur realisierter P&L | Summe pnl geschlossener Trades | ✓ |
| Realisiert + unrealisiert | Inkl. offene Positionen (keine Live-Kurse verfügbar) | |
| Nur unrealisiert | Nur offene Positionen | |

**User's choice:** Nur realisierter P&L

### Darstellung

| Option | Description | Selected |
|--------|-------------|----------|
| Betrag mit Vorzeichen + Farbe | +142.50 EUR grün / -23.10 EUR rot | ✓ |
| Nur Betrag ohne Farbe | Neutral | |
| Prozentual | Relativ zu Startkapital | |

**User's choice:** Betrag mit Vorzeichen + Farbe

### Leer-Zustand

| Option | Description | Selected |
|--------|-------------|----------|
| "-" anzeigen | Klar unterscheidbar von echtem Null-P&L | ✓ |
| "0.00 EUR" anzeigen | Technisch korrekt | |
| Feld ausblenden | Inkonsistentes Layout | |

**User's choice:** "-" anzeigen

---

## Bot-Parameter (BOTS-08)

### Parameter-Modell

| Option | Description | Selected |
|--------|-------------|----------|
| Nur Lotgröße | Ein festes numerisches Feld | |
| Lotgröße + weitere feste Parameter | Mehrere feste Felder | |
| Flexibler Key-Value-Store | Bot meldet welche Parameter er hat | ✓ |

**User's choice:** Flexibler Key-Value-Store (Record<string, string|number|boolean>)

### Parameter-Quelle

| Option | Description | Selected |
|--------|-------------|----------|
| Bot meldet im Heartbeat | Neues parameters-Feld in BotStatus | ✓ |
| In bots.json gespeichert | Keine bidirektionale Synchronisation | |

**User's choice:** Bot meldet Parameter im Heartbeat-Payload

### Parameter-Übertragung

| Option | Description | Selected |
|--------|-------------|----------|
| Command-Typ 'set_parameters' | Über /api/bridge/command | ✓ |
| PATCH /api/bots/:id/parameters | Neuer REST-Endpunkt | |

**User's choice:** Neuer Command-Typ 'set_parameters' über bestehenden /api/bridge/command

### Fallback (keine Parameter)

| Option | Description | Selected |
|--------|-------------|----------|
| Parameterbereich ausblenden | Nur anzeigen wenn Parameter vorhanden | |
| Info-Text | "Dieser Bot unterstützt keine konfigurierbaren Parameter" | ✓ |
| Fehler anzeigen | Nicht empfohlen | |

**User's choice:** Platzhalter/Info-Text anzeigen

### UI-Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Typ-Inferenz | number→Input, boolean→Toggle, string→Text | ✓ |
| Alles als Textfelder | Kein Typ-Handling | |
| Schema vom Bot | Bot definiert Feld-Typen | |

**User's choice:** Typ-Inferenz

---

## Settings-Seite Umbau

### Inhalt nach Bereinigung

| Option | Description | Selected |
|--------|-------------|----------|
| Bot-Info read-only + Parameter-Editor | Name/URL sichtbar, darunter Parameter | ✓ |
| Nur Parameter-Editor | Keine Bot-Info | |
| Settings-Seite komplett entfernen | Für Phase 4 | |

**User's choice:** Bot-Info read-only + Parameter-Editor

### Sichtbare Bots

| Option | Description | Selected |
|--------|-------------|----------|
| Nur verbundene Bots (Heartbeat-Filter) | Wie BotStatusContext | ✓ |
| Alle registrierten Bots (auch offline) | Bots aus bots.json | |

**User's choice:** Nur verbundene Bots (Heartbeat-Timeout-Filter)

### Bestätigen-Button

| Option | Description | Selected |
|--------|-------------|----------|
| Pro Bot ein Bestätigen-Button | Klar welchem Bot Parameter gesendet werden | ✓ |
| Globaler Speichern-Button | Alle Bots gleichzeitig | |

**User's choice:** Pro Bot ein eigener "Parameter senden"-Button

---

## Claude's Discretion

- Keine Bereiche an Claude delegiert — alle Entscheidungen wurden vom User getroffen.

## Deferred Ideas

Keine — Diskussion blieb innerhalb des Phase-3-Scopes.

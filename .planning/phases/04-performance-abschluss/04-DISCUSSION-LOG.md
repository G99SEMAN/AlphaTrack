# Phase 4: Performance & Abschluss - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 04-performance-abschluss
**Areas discussed:** Performance-Datenquelle, Journal-Trennlinie, Bot-Log-Entfernung

---

## Performance-Datenquelle (PERF-01 / PERF-02)

### Frage 1: Attribution-Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Bridge-Registry persistieren | gateway.py speichert ticket→bot-ID-Mapping in eine JSON-Datei, lädt es beim Start. Python-Änderung, klein, sauber. | ✓ |
| Retroaktiv neu zuordnen | Alle Trades in bot-trades-*.json und profile-trades-*.json via Migration neu mit botId/sourceId belegen | |

**User's choice:** Bridge-Registry persistieren  
**Notes:** Root cause: `_ticket_to_at_bot_id` in `gateway.py` ist in-memory. Alle Trades in `bot-trades-FiFT3HmJf-.json` haben `"botId": null`. Die Registry-Persistenz behebt das für alle zukünftigen Sessions.

### Frage 2: Bestehende Trades migrieren?

| Option | Description | Selected |
|--------|-------------|----------|
| Ja — einmalige Migration | Alle bestehenden Trades retroaktiv mit botId/sourceId belegen | |
| Nein — nur vorwärts fixen | Alte Trades bleiben ohne Bot-Zuordnung. Performance-Graph zeigt erst ab neuen Trades Daten. | ✓ |

**User's choice:** Nein — nur vorwärts fixen  
**Notes:** Simpler; bestehende Trades haben unbekannte Herkunft.

---

## Journal-Trennlinie (UI-01)

### Frage 1: Art der Trennlinie

| Option | Description | Selected |
|--------|-------------|----------|
| Gleicher Stil wie TradeRow-Border | 1px Divider mit var(--border) | |
| Label-Divider | Zeile mit Text "— Vergangene Trades —" | |
| Frei-Text-Antwort | User korrigierte die Frage | ✓ |

**User's choice (Klärung):** "die linien zwischen den offenen trades unter /trades diese sollen nicht weiß sein, sondern wie bei den abgeschlossenen trades aussehen"  
**Notes:** Kein Section-Separator gewünscht. Die `borderBottom` der offenen TradeRows hat eine andere (weiße/falsche) Farbe als die der geschlossenen. Fix: Farbkonsistenz herstellen.

---

## Bot-Log-Entfernung (BOTLOG-01)

### Frage 1: URL-Handling nach Löschung

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect → /bots | Next.js redirect() in page.tsx | |
| Dateien einfach löschen (404) | Route verschwindet, Standard-404 | ✓ |

**User's choice:** Dateien einfach löschen (404)

### Frage 2: Sidebar-Link

| Option | Description | Selected |
|--------|-------------|----------|
| Ja — Link aus Sidebar entfernen | Kein toter Link in der Navigation | ✓ |
| Nein — nur Route entfernen | Link bleibt, führt zur 404 | |

**User's choice:** Ja — Link aus Sidebar entfernen  
**Notes:** `src/components/layout/Sidebar.tsx` Zeile 38: `{ href: '/bots/logs', label: 'Bot Log', icon: ScrollText }` entfernen.

---

## Claude's Discretion

- Genaue Implementierung der Datei-Persistenz in `gateway.py` (Dateiname, Format, Pfad)
- Ob `trade_sync.py` beim Bridge-Start die Registry-Datei lädt oder `gateway.py` das intern erledigt
- Genaue Ursachendiagnose der TradeRow-Farbinkonsistenz vor dem Fix

## Deferred Ideas

None — discussion blieb innerhalb des Phase-4-Scope.

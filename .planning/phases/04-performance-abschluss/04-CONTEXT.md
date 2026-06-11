# Phase 4: Performance & Abschluss - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 liefert vier abgeschlossene TODO-Punkte:

1. **PERF-01** — Bot-Performance-Graph zeigt P&L über Zeit korrekt an, nachdem `bot_id`-Attribution in der Bridge persistiert wird
2. **PERF-02** — Trade-Anzahl je Bot ist in der Performance-Ansicht sichtbar (bereits im `BotPerfCard` vorhanden, wird durch PERF-01-Fix datenseitig korrekt)
3. **BOTLOG-01** — Bot-Log-Seite (`/bots/logs`) wird entfernt; Sidebar-Link entfernt
4. **UI-01** — `borderBottom`-Farbinkonsistenz in TradeRow zwischen offenen und geschlossenen Trades wird behoben

Kein neuer Feature-Scope — ausschließlich die vier offenen REQUIREMENTS.md-Punkte.

</domain>

<decisions>
## Implementation Decisions

### Performance-Graph (PERF-01 / PERF-02)

- **D-01:** Die Ursache für `botId: null` aller Trades ist die In-Memory-Ticket-Registry in `bridge/gateway.py` (`_ticket_to_at_bot_id`). Diese geht bei jedem Bridge-Neustart verloren. Fix: Registry in eine JSON-Datei im Bridge-Verzeichnis persistieren und beim Start laden.
- **D-02:** Keine retroaktive Migration bestehender Trades. Alte Trades bleiben mit `botId: null`. Der Performance-Graph zeigt erst Daten für neue Trades (die mit korrekt gesetztem `botId` ankommen).
- **D-03:** `BotPerformanceClient.tsx` filtert weiterhin mit `t.botId === bw.bot.id` — keine Änderung an der Frontend-Filterlogik nötig; der Fix liegt vollständig auf der Bridge-Seite.

### Journal-Trennlinie (UI-01)

- **D-04:** Die Trennlinien zwischen offenen Trades unter `/trades` (JournalClient) sehen anders aus als die zwischen geschlossenen Trades. Ursache ist im Code zu untersuchen (vermutlich CSS-Variable oder Background-Rendering-Unterschied). Fix: Konsistentes `borderBottom`-Styling in `TradeRow.tsx` für beide Trade-Status.

### Bot-Log-Entfernung (BOTLOG-01)

- **D-05:** Route-Dateien `src/app/bots/logs/page.tsx` und `src/app/bots/logs/BotsLogsClient.tsx` werden gelöscht. Eine 404 bei direktem URL-Aufruf ist akzeptabel — kein Redirect erforderlich.
- **D-06:** Sidebar-Eintrag `{ href: '/bots/logs', label: 'Bot Log', icon: ScrollText }` in `src/components/layout/Sidebar.tsx` (Zeile 38) wird entfernt.

### Claude's Discretion

- Genaue Implementierung der Datei-Persistenz in `gateway.py` (Dateiname, Format, Pfad relativ zum Bridge-Verzeichnis)
- Ob `trade_sync.py` beim Bridge-Start die Registry-Datei lädt oder `gateway.py` das intern erledigt
- Genaue Ursachendiagnose der TradeRow-Farbinkonsistenz (vor dem Fix)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Phase Scope
- `.planning/ROADMAP.md` — Phase 4 Goal, Requirements, Success Criteria
- `.planning/REQUIREMENTS.md` — PERF-01, PERF-02, BOTLOG-01, UI-01 (vollständige Anforderungen)

### Bridge — Attribution Fix (PERF-01)
- `bridge/gateway.py` — Enthält `_ticket_to_at_bot_id` Registry, `get_at_bot_id_for_ticket()`, Trade-Ausführungslogik (Zeile 562–565 für Registry-Befüllung)
- `bridge/trade_sync.py` — Nutzt `get_at_bot_id_for_ticket()` zum Befüllen von `bot_id` in Trade-Payloads (Zeile 25–31)

### Performance-Ansicht (PERF-01 / PERF-02)
- `src/app/bots/performance/BotPerformanceClient.tsx` — Fetcht Bridge-Trades, filtert nach `t.botId === bw.bot.id`
- `src/components/bots/BotPerfCard.tsx` — Rendert P&L-Chart + KPIs (Win Rate, P&L, Trades, Avg RR)
- `src/app/api/bots/[id]/stats/route.ts` — Stats-Endpunkt (filtert auf `sourceId`, nicht `botId`)
- `src/app/api/bridge/trades/route.ts` — Bridge-Trades POST-Handler mit `normalizeTrade` (setzt `botId` + `sourceId`)

### Journal-Trennlinie (UI-01)
- `src/components/journal/TradeRow.tsx` — `borderBottom: '1px solid var(--border)'` an Zeile 66; Hover-Logik Zeile 68–69
- `src/components/journal/JournalClient.tsx` — Sortierung (offene Trades zuerst, Zeile 77–97); Render `paginated.map` Zeile 334

### Bot-Log-Entfernung (BOTLOG-01)
- `src/app/bots/logs/page.tsx` — Zu löschende Seite
- `src/app/bots/logs/BotsLogsClient.tsx` — Zu löschender Client
- `src/components/layout/Sidebar.tsx` — Sidebar-Eintrag Zeile 38 entfernen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BotPerfCard.tsx`: P&L-Chart mit Recharts `AreaChart` + KPI-Grid — vollständig implementiert, benötigt nur korrekte Trade-Daten
- `bridge/gateway.py`: `_alphatrack_bot_ids` Dict (bot_id → AT nanoid) ist bereits persistent-relevant; ähnliche Struktur wie `_ticket_to_at_bot_id`

### Established Patterns
- Bridge-Datei-I/O: Kein etabliertes Muster für JSON-Persistenz im Bridge-Verzeichnis — kann `json.dump/load` direkt nutzen
- Sidebar-Navigation: Array von `{ href, label, icon }` Objekten — einfaches Entfernen eines Eintrags
- TradeRow-Rendering: Alle Trades rendern identisch — Ursache des Unterschieds ist wahrscheinlich subtil (CSS-Variable, Theme, oder inherited background)

### Integration Points
- `gateway.py` → `_ticket_to_at_bot_id` → `get_at_bot_id_for_ticket()` → `trade_sync.py` → POST `/api/bridge/trades` → `normalizeTrade` → `botId` auf Trades gesetzt
- Die Kette ist komplett implementiert; nur der Persistenz-Schritt in `gateway.py` fehlt

</code_context>

<specifics>
## Specific Ideas

- Der `testbot1` hat `bot_id: "qwzDxCfKpp"` in `config.json` — dieser Wert stimmt mit `bots.json[id]` überein, kein ID-Mismatch. Das zeigt: sobald die Registry-Persistenz funktioniert, wird `BotPerfCard` korrekte Daten für TestBot 1 anzeigen.
- Die "weiße Linie" in `/trades` ist nicht ein Section-Separator, sondern die `borderBottom` der offenen Trade-Rows selbst — diese soll denselben sichtbaren Stil haben wie bei den geschlossenen Trade-Rows.

</specifics>

<deferred>
## Deferred Ideas

None — discussion blieb innerhalb des Phase-4-Scope.

</deferred>

---

*Phase: 04-performance-abschluss*
*Context gathered: 2026-06-11*

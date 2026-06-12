# Milestones

## v1.0 TODO Abarbeitung (Shipped: 2026-06-12)

**Phases completed:** 4 phases, 12 plans, 10 tasks

**Key accomplishments:**

- `tradesSync`-Anzeige aus allen vier UI-Stellen entfernt (D-14):
- Python-Bridge setzt '/bridge/tradeexecuter' als MT5-Kommentar bei Eroeffnungsorders — Trade-Executor-Trades in MetaTrader 5 eindeutig identifizierbar (TRADES-03 / D-08)
- 30s-Heartbeat-Timeout-Filter im BotStatusContext via HEARTBEAT_TIMEOUT_MS-Modulkonstante + deleteBot()/Trash2-Entfernung aus BridgeClient.
- Bridge-Log auf reinen Level+Such-Filter reduziert und Bridge-Settings-Route vollstaendig entfernt (BRIDGE-03, BRIDGE-04).
- Typ-Verträge für Bot-Parameter und Stats erweitert; neuer GET /api/bots/:id/stats Endpunkt aggregiert profil-spezifische Trade-Metriken; Command-Route validiert set_parameters.
- `isSameOriginRequest` in stats GET route returned `false` for browser requests (browsers omit `Origin` header on same-origin GET). Removed gate — consistent with all other bot GET routes which have no auth check.
- Persistierte Ticket-Bot-ID-Registry via `ticket_registry.json` mit Load-on-startup und Save-on-write in `bridge/gateway.py`.
- onMouseLeave background-Reset von 'transparent' auf 'var(--surface)' korrigiert visuelle Inkonsistenz der Trennlinien zwischen offenen und geschlossenen Trade-Rows im Journal.

---

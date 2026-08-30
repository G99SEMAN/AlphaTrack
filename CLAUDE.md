# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pflichtverhalten: Rückfragen vor jeder Umsetzung

**Vor dem Schreiben von Code oder dem Ändern von Dateien MUSS Claude immer zuerst Rückfragen stellen**, bis der Auftrag vollständig verstanden ist. Kein Schritt darf ohne vollständige Klarheit begonnen werden.

- Rückfragen werden **immer mit dem `AskUserQuestion`-Tool** gestellt — niemals als Fließtext.
- So lange fragen, bis alle Unklarheiten zu Umfang, Verhalten und Randfällen beseitigt sind.
- Erst wenn der Benutzer alle Fragen beantwortet hat, mit der Umsetzung beginnen.

## Commands

```bash
npm run dev      # Entwicklungsserver starten (http://localhost:3000)
npm run build    # Produktions-Build
npm run start    # Produktions-Build starten
```

Deployment auf NAS + Mini-PC:
```
scripts\windows\deploy.bat       # AlphaTrack auf NAS deployen + Bridge auf Mini-PC
scripts\windows\deploy-bot.bat   # Einzelnen Bot auf Mini-PC deployen
```

**Vollständiger Deploy- und Test-Workflow (inkl. schnellem Hot-Reload-Testen ohne vollen Deploy, Live-Datenzugriff auf NAS/Bridge für Debugging, SSH-Key-Setup, Troubleshooting): siehe [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).**

## Testen

**Es gibt keine automatisierten Tests** (kein Jest/Vitest/Playwright-Testsuite, kein `npm test`). Verifikation läuft über folgende Wege:

- **TypeScript-Check läuft automatisch** — ein Hook (`.claude/hooks/ts-check.py`) führt nach jedem Edit/Write an einer `.ts`/`.tsx`-Datei `npx tsc --noEmit` aus und blockiert bei Fehlern.
- **UI im Browser prüfen** — Skill `run-alphatrack` (`.claude/skills/run-alphatrack/`, Playwright-Treiber `driver.mjs`): Screenshots aufnehmen, Seiten-Status/Titel prüfen, API-Routen abfragen. Läuft gegen den bereits laufenden `localhost:3000`-Dev-Server. Details/Gotchas in dessen `SKILL.md`.
- **Änderungen live gegen echte Daten testen, ohne die Produktion zu berühren** — Hot-Reload-Dev-Container auf dem NAS (`http://192.168.178.3:3003`), siehe [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) Abschnitt 3.
- **Vor einem echten Deploy** — Skill `deploy-status` prüft Git-Status, TypeScript-Build, Konfiguration und Netzwerk-Erreichbarkeit.
- **Live-Daten direkt abfragen** (z.B. um ein Bot-/Trade-Verhalten zu debuggen, ohne SSH) — siehe [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) Abschnitt 4.

Für Python-seitigen Code (`bridge/`, `bots/`) existiert ebenfalls keine Testsuite — Verifikation erfolgt durch Beobachtung im laufenden Bridge-Terminal bzw. über die Bot-Logs in AlphaTrack (`/bots`-Seite).

## Architektur-Überblick

AlphaTrack ist ein persönliches Trading-Journal mit Bot-Management. Zwei physische Systeme:

- **NAS** — Läuft die Next.js-App in Docker auf Port 3002. Speichert alle Daten als JSON-Dateien im `data/`-Verzeichnis (keine Datenbank).
- **Mini-PC** — Läuft MetaTrader 5, die Python-Bridge (`bridge/`, Port 8765) und Trading-Bots (`bots/`).

```
NAS (Next.js :3002)          Mini-PC
┌─────────────────────┐      ┌──────────────────────────┐
│  UI + API Routes    │      │  Bridge (FastAPI :8765)  │
│  data/*.json        │◄────►│    ↕ WebSocket           │
└─────────────────────┘      │  Bots (Python)           │
                              │  MetaTrader 5            │
                              └──────────────────────────┘
```

### Datenhaltung (data/)

Alle Daten liegen als JSON in `data/`. Schreibzugriffe immer atomar: `.tmp`-Datei schreiben, dann umbenennen.

| Datei | Inhalt |
|-------|--------|
| `profiles.json` | Alle Profile |
| `active.json` | Aktive Profil-ID |
| `trades-{profileId}.json` | Manuell eingetragene Journal-Trades |
| `bot-trades-{profileId}.json` | Bridge-synchronisierte Trades |
| `bots.json` | Registrierte Bots und Bridges |
| `bot-status-{botId}.json` | Letzter Heartbeat-Status |
| `bot-commands-{botId}.json` | Ausstehende Befehls-Queue (pull-basiert) |
| `bot-log-{botId}.json` | Bridge-Log-Einträge |
| `bot-events-{botId}.json` | Bot-spezifische Ereignisse |
| `bot-positions-{botId}.json` | Gecachte offene Positionen aus Heartbeat |
| `reset-cutoff-{profileId}.json` | Trade-Reset-Cutoff-Timestamp |

### Schichtenmodell

```
src/app/(pages)/          — Next.js App Router Seiten (Server Components)
src/app/api/              — API-Routen (Next.js Route Handlers)
src/lib/actions.ts        — Server Actions (mutations, revalidatePath)
src/lib/profiles.ts       — Profile CRUD
src/lib/bot-data.ts       — Bot/Bridge-Registry, Status, Commands, Logs
src/lib/data.ts           — Trade-Statistiken, filterTradesByPeriod
src/components/           — Client-Komponenten
src/types/                — TypeScript-Typen
```

### Bridge-Kommunikation (pull-basiertes Command-Delivery)

Die NAS-Docker-Umgebung kann keine HTTP-Anfragen an den Mini-PC initiieren. Deshalb:

1. AlphaTrack queued Befehle via `addBotCommand()` → `bot-commands-{botId}.json`
2. Bridge pollt `/api/bridge/commands` alle paar Sekunden
3. Bridge liefert Befehl per WebSocket an den Bot
4. Bot bestätigt → Bridge POSTs ACK an `/api/bridge/commands`

Bridge-Heartbeat kommt alle 5 s auf `POST /api/bridge/heartbeat` an und enthält: aktueller Status, offene Ticket-IDs (`openTicketIds`) und Live-Positionen.

Trade-Sync: Bridge postet alle ~30 s offene und geschlossene Trades an `POST /api/bridge/trades`.

### Trade-Synchronisierung (zwei Stores)

Trades existieren in zwei getrennten Stores, die synchron gehalten werden:

- **`bot-trades-{profileId}.json`** — Bridge-Rohdaten (bridge-seitige Wahrheit)
- **`trades-{profileId}.json`** — Journal-Trades (benutzerseitige Wahrheit, mit Notizen/Tags/Screenshots)

`syncBridgeTradesToProfile()` in `src/app/api/bridge/trades/route.ts` hält beide in Sync. Beim Merge werden `id`, `botId`, `sourceId` und Benutzer-Annotationen aus dem Journal bewahrt; MT5-Felder (`pnl`, `commission`, `swap`, `exit`, `closeTime`) kommen von der Bridge.

Update-Pfade beim Trade-Sync-POST:
- `open → closed`: Journal-Trade mit MT5-Schlussdaten befüllen
- `open → open`: P&L, Swap, currentPrice aktualisieren (Live-Positionen)
- `closed → closed`: korrigiert Trades, die Heartbeat-Reconciliation vorzeitig geschlossen hat

`externalId`-Format: `pos_{ticket}` für offene Positionen aus MT5.

### Verbindungszustände (bot-data.ts)

- `connected`: letzter Heartbeat < 45 s
- `warning`: 45–120 s
- `offline`: > 120 s

### Cache-Gotcha

`React.cache()` (in `profiles.ts`, `data.ts`) ist **per-Request**, nicht persistent. Nach jeder Mutation `revalidatePath()` aufrufen, sonst zeigt die nächste Server-Komponente veraltete Daten.

## Env-Vars (.env.local, liegt auf dem NAS)

```env
BOT_API_KEY=...                              # wird von deploy.ps1 automatisch generiert, falls die Datei fehlt (siehe SETUP.md)
ANTHROPIC_API_KEY=sk-ant-...                 # KI-Analyse (optional, manuell auf dem NAS ergänzen)
TWELVE_DATA_API_KEY=...                      # Kursdaten (optional, manuell auf dem NAS ergänzen)
```

## Bot-Entwicklung

Bots liegen unter `bots/`. Vollständige Protokoll-Spezifikation: `docs/BRIDGE_PROTOCOL.md`. Entwicklungsguide: `bots/CLAUDE.md`.

Kurzfassung:
- Bots erben von `bots/scaffold/base_bot.py` (AGPv2-Protokoll automatisch)
- WebSocket-Verbindung zur Bridge auf Port 8765
- Neue Bots bekommen eindeutigen Port ab 8771+
- In `on_tick()` immer `self._now()` statt `datetime.now()` (Backtesting-Kompatibilität)

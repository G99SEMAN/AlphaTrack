# Machbarkeitsstudie: MT5 Trading Bot + AlphaTrack TradingBotAnalyser

**Erstellt:** 2026-05-28  
**Status:** Bereit zur Umsetzung  
**Projekt:** AlphaTrack (`c:\Users\G99SEMAN\Desktop\AlphaTrack`)

---

## Zusammenfassung

**Ergebnis: Technisch vollständig machbar.**

Der Mini PC mit Windows 11 (24/7 an) ist die einzig richtige Wahl. Das NAS scheidet aus - die MetaTrader5 Python Bibliothek läuft ausschliesslich auf Windows. AlphaTrack hat bereits fast alle notwendigen Bausteine für die Integration.

---

## Architektur-Entscheidungen

| Aspekt | Entscheidung |
|---|---|
| Modus-Wechsel | Global App-weit, ein Schalter - alle Seiten wechseln gleichzeitig |
| Datentrennung | Komplett getrennte Dateien (`data/bot-*`) - keine Vermischung mit manuellen Trades |
| Watchdog | Bidirektional: AlphaTrack steuert Bot (Start/Stop/Pause) + empfängt Status |
| Heartbeat-Intervall | 5 Sekunden |
| Trade-Sync-Intervall | 30 Sekunden |

---

## Warum Mini PC, nicht NAS?

| | Mini PC (Windows 11) | NAS (Linux/QTS) |
|---|---|---|
| MT5 Terminal | Nativ unterstützt | Nicht unterstützt |
| MetaTrader5 Python Lib | Voll kompatibel | Nicht verfügbar |
| Python Bot | Ja | Nur ohne MT5 möglich |
| 24/7 Betrieb | Perfekt geeignet | Unnötig komplex |

Das MT5-Terminal und die offizielle Python-Bibliothek sind Windows-only. Wine/Emulation wäre extrem fehleranfällig und nicht wartbar.

---

## Kommunikationsprotokoll (Bidirektional)

```
AlphaTrack (Next.js)               Python Bot
        |                                |
        |  <-- POST /api/bot/heartbeat   |  alle 5s
        |  <-- POST /api/bot/trades      |  alle 30s
        |                                |
        |  POST http://localhost:8765/   |
        |       command (start/stop/     |
        |       pause)               --> |
        |                                |
        |  GET /api/bot/status      <--> | (AlphaTrack liest gespeicherten Status)
```

Der Bot läuft einen kleinen **Flask Mini-Server auf Port 8765** - nur im Heimnetz erreichbar. AlphaTrack sendet Steuerbefehle dorthin. Der Bot sendet Heartbeats und Trades zu AlphaTrack.

### Watchdog-Statuslogik

| Letzter Heartbeat | Status | Farbe |
|---|---|---|
| < 10 Sekunden | connected | Grün |
| 10 - 30 Sekunden | warning | Gelb |
| > 30 Sekunden | offline | Rot blinkend |

---

## Was bereits in AlphaTrack vorhanden ist

Sehr gute Ausgangslage - weniger Aufwand als erwartet:

- **`externalId` im Trade-Typ** (`src/types/trade.ts:25`) - direkt für MT5 Ticket-Nummer nutzbar
- **`importTradesAction`** (`src/lib/actions.ts:315`) - importiert Trades mit automatischer Duplikat-Erkennung anhand `externalId`
- **Trade-Datenmodell** deckt alle MT5-Felder ab: entry, exit, size, tp, sl, pnl, commission, swap, status
- **Datei-Layer** (`src/lib/profiles.ts`) - atomicWrite Pattern, kann 1:1 für Bot-Daten übernommen werden

---

## MT5-Felder zu AlphaTrack Mapping

| MT5 Feld | AlphaTrack Feld | Hinweis |
|---|---|---|
| `ticket` | `externalId` | Duplikat-Schutz |
| `symbol` | `instrument` | z.B. "EURUSD" |
| `type` (0=BUY, 1=SELL) | `type` long/short | Umrechnung nötig |
| `price_open` | `entry` | |
| `price_close` | `exit` | |
| `volume` | `size` | Lotgrösse |
| `profit` | `pnl` | |
| `commission` | `commission` | |
| `swap` | `swap` | |
| `sl` | `sl` | Stop Loss |
| `tp` | `tp` | Take Profit |
| `time` | `date` | ISO String |
| `time_msc` | `closeTime` | Schliesszeit |

---

## Ablaufplan: 6 Phasen

---

### Phase 1 - App-Modus Fundament (1-2h)

**Neue Dateien:**
- `src/context/AppModeContext.tsx` - globaler Modus-State (`manual` | `bot`), Persistenz in `localStorage`

**Geänderte Dateien:**
- `src/app/layout.tsx` - AppModeContext Provider einbinden
- `src/components/layout/Sidebar.tsx` - Modus-Toggle Button hinzufügen (unten in der Sidebar)

**Theme-System:**

```css
/* Manuell-Modus: bestehende Farben unverändert */

/* Bot-Modus: rotes Farbthema via CSS-Klasse auf <html> */
html.bot-mode {
  --accent: #DC2626;           /* red-600 */
  --accent-hover: #B91C1C;     /* red-700 */
  --accent-glow: rgba(220, 38, 38, 0.2);
  --accent-subtle: rgba(220, 38, 38, 0.1);
}
```

**Modus-Toggle:**
- Toggle-Switch in der Sidebar (unten, vor Einstellungen)
- Bestätigung-Dialog beim Wechsel: "Zu Bot-Analyser wechseln?"
- Sidebar bekommt im Bot-Modus einen roten linken Rand
- "BOT MODUS" Badge oben in der Sidebar sichtbar

---

### Phase 2 - Bot Daten-Layer (1-2h)

**Neue Dateien:**
- `src/types/bot.ts` - alle Bot-spezifischen Typen
- `src/lib/bot-data.ts` - Lese-/Schreib-Funktionen für Bot-Daten

**Dateistruktur im `data/` Ordner (neu):**

```
data/
├── bot-trades-{profileId}.json     # Bot-Trades (komplett getrennt von manuellen Trades)
├── bot-status.json                  # Letzter Heartbeat, Bot-State, MT5-Verbindung
├── bot-config.json                  # Bot-Konfiguration (URL, Intervalle, etc.)
├── bot-commands.json                # Command-Queue (AlphaTrack -> Bot, FIFO)
└── bot-log.json                     # Letzte 100 Log-Einträge
```

**Typen (`src/types/bot.ts`):**

```typescript
type BotState = 'running' | 'paused' | 'stopped' | 'error' | 'disconnected'

interface BotStatus {
  state: BotState
  lastHeartbeat: string       // ISO timestamp
  botVersion: string
  mt5Connected: boolean
  activeSymbols: string[]
  openPositions: number
  tradesSync: number          // Trades seit Bot-Start
  uptime: number              // Sekunden
}

interface BotCommand {
  id: string
  command: 'start' | 'stop' | 'pause' | 'resume'
  timestamp: string
  acknowledged: boolean
}

interface BotHeartbeat {
  apiKey: string
  status: BotStatus
  timestamp: string
}

interface BotTradePayload {
  apiKey: string
  profileId: string
  trades: Omit<Trade, 'id'>[]  // Trade aus src/types/trade.ts
}
```

---

### Phase 3 - API Routen (2-3h)

**Neue Dateien:**

| Route | Datei | Methode | Aufrufer |
|---|---|---|---|
| `/api/bot/heartbeat` | `src/app/api/bot/heartbeat/route.ts` | POST | Python Bot (alle 5s) |
| `/api/bot/trades` | `src/app/api/bot/trades/route.ts` | POST | Python Bot (alle 30s) |
| `/api/bot/status` | `src/app/api/bot/status/route.ts` | GET | AlphaTrack UI (alle 5s) |
| `/api/bot/command` | `src/app/api/bot/command/route.ts` | POST | AlphaTrack UI (bei Klick) |
| `/api/bot/log` | `src/app/api/bot/log/route.ts` | GET | AlphaTrack UI |

**Authentifizierung** via `.env.local`:

```
BOT_API_KEY=REDACTED-API-KEY
BOT_URL=http://localhost:8765
```

**Watchdog-Logik in `/api/bot/status`:**
- Liest `data/bot-status.json`
- Berechnet `connectionState` anhand von `lastHeartbeat` Timestamp
- Gibt `{ ...status, connectionState: 'connected' | 'warning' | 'offline' }` zurück

---

### Phase 4 - Bot-Analyser UI (3-4h)

**Neue Seite:** `src/app/bot-analyser/page.tsx`

**Neue Komponenten:**

| Datei | Beschreibung |
|---|---|
| `src/components/bot/WatchdogPanel.tsx` | Live-Status + Verbindungsanzeige, pollt alle 5s |
| `src/components/bot/BotControls.tsx` | Start/Stop/Pause Buttons |
| `src/components/bot/LiveTradeFeed.tsx` | Letzte Bot-Trades in Echtzeit |
| `src/components/bot/BotKpiRow.tsx` | Bot-Performance KPIs (Winrate, PnL, Trades) |
| `src/components/bot/BotLogPanel.tsx` | Log-Einträge mit Zeitstempel |

**Sidebar im Bot-Modus (andere Navigation als manueller Modus):**

```
Bot-Modus Sidebar:
> Bot Dashboard      (Übersicht + WatchdogPanel)
> Live Trades        (Bot-Trades Journal)
> Performance        (Statistiken nur Bot-Daten)
> Bot Log            (Aktivitätslog)
> Bot Settings       (Konfiguration, API-Key, Intervalle)
─────────────────
> Rechner            (bleibt verfügbar)
> Einstellungen
```

**WatchdogPanel UI-Skizze:**

```
┌─────────────────────────────────────────────┐
│ BOT STATUS                  [●] CONNECTED   │
│ MetaTrader 5: ✓ verbunden   Letzte: vor 3s  │
│ Offene Positionen: 2        Synced: 47       │
│ Uptime: 4h 23min            Version: 1.0.0  │
│                                              │
│ [■ STOP]    [⏸ PAUSE]    [▶ RESUME]         │
└─────────────────────────────────────────────┘
```

**Auto-Refresh:** Client pollt `/api/bot/status` alle 5 Sekunden via `useInterval` Hook

---

### Phase 5 - Python Bot Grundgerüst (3-4h)

**Projektstruktur** (Ordner `bot/` im AlphaTrack-Verzeichnis oder separat auf Mini PC):

```
bot/
├── main.py              # Entry Point + Scheduler
├── config.py            # config.json laden + validieren
├── mt5_connector.py     # MT5 Verbindung, Trade-Daten lesen
├── trade_sync.py        # Trades an AlphaTrack senden (30s)
├── heartbeat.py         # Heartbeat an AlphaTrack senden (5s)
├── command_server.py    # Flask Server Port 8765
├── logger.py            # Strukturiertes Logging
├── requirements.txt
├── config.json          # Konfigurationsdatei
└── install_service.bat  # Windows Task Scheduler Setup
```

**`requirements.txt`:**

```
MetaTrader5>=5.0.45
requests>=2.31
flask>=3.0
schedule>=1.2
python-dotenv>=1.0
```

**`config.json` Struktur:**

```json
{
  "alphatrack_url": "http://localhost:3000",
  "alphatrack_api_key": "REDACTED-API-KEY",
  "alphatrack_profile_id": "DEIN-PROFIL-ID-HIER",
  "heartbeat_interval_sec": 5,
  "trade_sync_interval_sec": 30,
  "command_server_port": 8765,
  "mt5_account": 12345678,
  "mt5_password": "PASSWORT",
  "mt5_server": "BrokerName-Server",
  "symbols_to_watch": ["EURUSD", "GBPUSD", "XAUUSD"],
  "bot_version": "1.0.0"
}
```

**Scheduler-Logik in `main.py`:**

```python
import schedule
import threading
from heartbeat import send_heartbeat
from trade_sync import sync_trades
from command_server import start_command_server

# Command-Server in separatem Thread
thread = threading.Thread(target=start_command_server, daemon=True)
thread.start()

# Scheduler
schedule.every(5).seconds.do(send_heartbeat)
schedule.every(30).seconds.do(sync_trades)

while True:
    schedule.run_pending()
    time.sleep(1)
```

**`command_server.py` (Flask, Port 8765):**

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/command', methods=['POST'])
def receive_command():
    data = request.json
    command = data.get('command')  # start | stop | pause | resume
    # Zustand setzen, MT5-Aktionen ausführen
    return jsonify({'acknowledged': True, 'command': command})

def start_command_server():
    app.run(host='0.0.0.0', port=8765)
```

**Windows Auto-Start via Task Scheduler (`install_service.bat`):**

```bat
schtasks /create /tn "AlphaTrack Bot" /tr "pythonw.exe C:\Pfad\bot\main.py" /sc ONSTART /ru SYSTEM /f
```

---

### Phase 6 - Integration & Test (1-2h)

1. AlphaTrack starten (`npm run dev` oder `npm start`)
2. Bot starten (`python main.py`)
3. Heartbeat in AlphaTrack-UI prüfen (grüner Status)
4. Demo-Trade in MT5 öffnen
5. Nach max. 30s: Trade erscheint in AlphaTrack Bot-Journal
6. Stop-Befehl aus AlphaTrack senden -> Bot bestätigt -> Status wechselt
7. Windows Task Scheduler Aufgabe einrichten für Auto-Start

---

## Gesamtaufwand

| Phase | Aufwand | Inhalt |
|---|---|---|
| 1 - Modus-Fundament | 1-2h | AppModeContext, rotes Theme, Toggle-Switch |
| 2 - Daten-Layer | 1-2h | bot.ts Typen, bot-data.ts, Dateistruktur |
| 3 - API Routen | 2-3h | 5 neue Endpunkte, Watchdog-Logik, Auth |
| 4 - Bot Analyser UI | 3-4h | Dashboard, WatchdogPanel, LiveFeed |
| 5 - Python Bot | 3-4h | MT5, Heartbeat, Trade Sync, Flask Command Server |
| 6 - Integration & Test | 1-2h | End-to-End Test, Windows Dienst |
| **Gesamt** | **11-17h** | **ca. 2-3 Tage fokussiert** |

---

## Empfohlene Startreihenfolge

Von innen nach aussen - jede Phase ist unabhängig testbar:

1. **Phase 2** - Typen und Datenlayer (kein UI nötig)
2. **Phase 1** - Modus-Kontext und Theme (sichtbares Ergebnis sofort)
3. **Phase 3** - API Routen (testbar mit curl/Postman ohne echten Bot)
4. **Phase 4** - UI mit gemockten Statusdaten
5. **Phase 5** - Python Bot mit echtem MT5
6. **Phase 6** - End-to-End Integration

---

## Sicherheitshinweise (Heimnetz)

- API-Key in `.env.local` reicht für Heimnetz-Betrieb
- `.env.local` niemals in Git committen (bereits in `.gitignore`)
- Flask Command Server auf `localhost` beschränken wenn Bot und AlphaTrack auf demselben PC laufen
- MT5 Passwort in `config.json` - diese Datei aus Git ausschliessen

---

## Erweiterungen nach Basis-Setup (optional)

- Live-Equity-Kurve die sich alle 30s aktualisiert
- Telegram-Benachrichtigung wenn Bot offline geht
- Vergleichs-Ansicht: Manuelle Trades vs. Bot-Trades
- Bot-Konfiguration über AlphaTrack UI (Risk%, Symbole, Pause-Zeiten)
- Backtesting-Ergebnisse aus MT5 nach AlphaTrack importieren

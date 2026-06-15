# AlphaTrack Bot-Scaffold

Erstellt oder reviewt einen AlphaTrack Trading Bot auf Basis der `BaseBot`-Basisklasse aus `bots/scaffold/base_bot.py`.

## Verwendung

Wenn der User `/trading-bot` aufruft:

1. **Ohne Argument** — frage, was er tun moechte:
   - `new <botname>` — neuen Bot erstellen
   - `review` — bestehenden Bot reviewen
   - `debug` — Bot-Fehler analysieren

2. **`new <botname>`** — ZUERST Rueckfragen stellen (siehe "Rueckfragen vor der Erstellung"), DANN alle Dateien unter `bots/<botname>/` erstellen (Templates unten). Niemals Dateien erzeugen, bevor alle Pflichtfragen beantwortet sind.

3. **`review`** — lies alle Bot-Dateien und pruefe:
   - Erbt Bot-Klasse von `BaseBot`?
   - `on_tick()` implementiert und gibt dict zurueck?
   - `config.json` hat alle Pflichtfelder (inkl. `bot_id`, `bot_type`, `bot_port`)?
   - Kein direkter Import von `LocalLog` oder anderen Bridge-internen Klassen?
   - Keine Bridge-Logs im Bot-Terminal?
   - Bot-Ordner enthaelt KEINE eigenen Kopien von `ws_client.py`, `bridge_client.py`, `bot_display.py`?
   - `get_parameters()` implementiert, wenn Parameter einstellbar sein sollen?

4. **`debug`** — lies `bots/<botname>/bot_log.json` und dann die Strategy-Datei

---

## Rueckfragen vor der Erstellung (Pflicht bei `new`)

Bevor auch nur eine Datei erzeugt wird, MUESSEN folgende Punkte per Rueckfragen
(AskUserQuestion oder Klartext) geklaert sein. Was der User bereits in seiner
Anfrage beantwortet hat, wird nicht erneut gefragt — nur die Luecken.

1. **Strategie-Logik** — Wann wird geoeffnet, wann geschlossen? (Einstiegs-Signal,
   Ausstiegs-Signal/Haltedauer; konkret genug, um `on_tick()` zu implementieren)
2. **Symbol + Timeframe** — z.B. EURUSDp auf M15 (Achtung: Broker-Suffix `p`),
   und wie viele Kerzen die Strategie braucht (`candles_count`)
3. **Risiko** — Lot-Groesse, SL/TP (fest, in Pips, oder keiner?), `max_positions`
4. **Einstellbare Parameter** — Welche Werte sollen spaeter im AlphaTrack
   Settings-Editor aenderbar sein (via `get_parameters()`)? Auch "keine" ist ok.
5. **Name/Port nur falls unklar** — Botname aus dem Argument, Port automatisch
   der naechste freie (ab 8771); nur nachfragen, wenn es Konflikte gibt.

Erst wenn alle Punkte beantwortet sind: kurze Zusammenfassung der Entscheidungen
zeigen, dann die Dateien erzeugen.

---

## Architektur

```
bots/scaffold/          ← gemeinsame Infrastruktur (NICHT kopieren)
  __init__.py
  base_bot.py           ← Pflicht-Basisklasse (BaseBot)
  ws_client.py          ← AGPv2 WebSocket Client
  bridge_client.py      ← HTTP Client (Candles, Positions, Trades)
  bot_display.py        ← Live-Terminal-UI (rich)

bots/<name>/            ← bot-spezifisch (nur diese 5 Dateien)
  config.json
  main.py
  strategy.py
  start.bat
  requirements.txt
```

- Bots kommunizieren **ausschliesslich ueber die Bridge** (kein direkter MT5-Zugriff)
- Registrierung laeuft **automatisch** beim Start via `BaseBot._connect_and_register()` (C7)
- Jeder Trade traegt `bot_id` als Metadatum (C4) — `BaseBot.send_trade()` setzt das automatisch
- MT5-Fehler kommen zurueck an den Bot via `on_mt5_error()` (C3)
- `ws_client.py`, `bridge_client.py`, `bot_display.py` liegen **ausschliesslich** in `bots/scaffold/` — nie in einzelnen Bot-Ordnern

---

## Terminal-UI

Das Live-Terminal kommt **automatisch aus BaseBot** — Bots brauchen dafuer nichts zu tun:

- Wenn `rich>=13.0.0` installiert ist: gruener Header, Bridge-Verbindungsstatus, Strategie-Parameter, offene Positionen (identisches Layout wie Bridge-Terminal, aber gruene Farbe)
- Ohne `rich`: statischer print-Header als Fallback

`display_header()`, `log()`, `on_mt5_error()` und `run()` **nie in der Strategie ueberschreiben** — die Infrastruktur liegt in BaseBot.

---

## Parameter-Editor

Der AlphaTrack Settings-Editor (Bots → Bot → Settings) zeigt und aendert Bot-Parameter live.

**Implementierung in strategy.py:**

```python
def get_parameters(self) -> dict:
    strat = self._config.get("strategy", {})
    return {
        "hold_minutes": float(strat.get("hold_minutes", 10)),
        "interval_minutes": float(strat.get("interval_minutes", 30)),
    }
```

- BaseBot empfaengt `set_parameters`-Commands von der Bridge automatisch
- Parameter werden via `apply_parameters()` in `self._config["strategy"]` gemergt
- Aenderungen werden in `config.json` persistiert (restart-safe)
- Heartbeat meldet aktuelle Parameter an AlphaTrack

**Beispiel: testbot2** — `get_parameters()` liefert `hold_minutes` und `interval_minutes`.

---

## Templates

### `config.json`
```json
{
  "alphatrack_url": "http://192.168.178.30:3002",
  "api_key": "REDACTED-API-KEY",
  "bot_id": "mybot-001",
  "bot_name": "Mein Bot",
  "bot_version": "1.0.0",
  "bot_type": "bot",
  "bot_ip": "",
  "bot_port": 8771,
  "profile_id": "HIER_PROFIL_ID",
  "bridge_url": "http://192.168.178.30:8765",
  "heartbeat_interval_sec": 10,
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M15",
    "candles_count": 50,
    "lots": 0.01,
    "max_positions": 1,
    "comment": "Mein Bot",
    "tick_interval_sec": 60
  }
}
```

`tick_interval_sec` steuert, wie oft `on_tick()` aufgerufen wird (Standard: 60s,
Minimum: 1s). Wird pro Loop-Iteration aus der Config gelesen — via
`get_parameters()` exponiert ist es im Settings-Editor live aenderbar.

**Pflichtfelder:**
- `bot_id`: Einzigartiger statischer Identifier (z.B. `"mybot-001"`)
- `bot_type`: Immer `"bot"` (nie `"bridge"`)
- `bot_port`: Einzigartiger Port — Bridge: 8765, TestBot 2: 8770, neue Bots ab 8771+
- `bridge_url`: URL zur Bridge (Standard-IP: 192.168.178.30, Port: 8765)

**Hinweis:** `config.json` darf committet werden — dieses Repo ist privat und der API-Key gilt nur im LAN.

---

### `main.py`
```python
"""
<Bot-Name> — AlphaTrack Trading Bot
Basiert auf BaseBot (bots/scaffold/base_bot.py).
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot
from strategy import MyStrategy


CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

_restart_requested = False


def main():
    global _restart_requested
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    bot = MyStrategy(
        bot_id=config["bot_id"],
        name=config["bot_name"],
        port=config["bot_port"],
    )
    bot.run()
    if bot._restart_requested:
        _restart_requested = True


if __name__ == "__main__":
    main()
    sys.exit(75 if _restart_requested else 0)
```

---

### `strategy.py`
```python
"""
Strategie: <Name>
Beschreibung: <kurze Beschreibung>
Parameter (in config.json unter 'strategy'):
  - symbol: Handelssymbol (z.B. EURUSDp)
  - timeframe: Kerzen-Intervall (M1/M5/M15/H1/H4/D1)
  - candles_count: Anzahl Kerzen
  - lots: Lot-Groesse
  - max_positions: Max. gleichzeitige Positionen
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class MyStrategy(BaseBot):
    """Trading-Strategie: <Name>"""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        # eigene Felder hier

    # Optional: Parameter-Editor (AlphaTrack Bots → Settings)
    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            # "mein_param": float(strat.get("mein_param", 10)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        Handelsstrategie. Wird bei jedem Tick aufgerufen.

        Returns:
            {"action": "hold"}
            {"action": "buy",  "lots": 0.01, "sl": 1.0800, "tp": 1.0900}
            {"action": "sell", "lots": 0.01, "sl": 1.0900, "tp": 1.0800}
            {"action": "close", "ticket": 12345}
        """
        if len(candles) < 2:
            return {"action": "hold"}

        cfg = self._config.get("strategy", {})
        # --- Deine Logik hier ---

        return {"action": "hold"}
```

---

### `start.bat`
```batch
@echo off
title %~n0
set PYTHONPATH=%~dp0..
python -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo [FEHLER] pip install fehlgeschlagen
    pause
    exit /b 1
)
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```

**Wichtig:**
- `%~dp0..` = Parent-Verzeichnis des Bot-Ordners (damit `scaffold`-Package importierbar ist)
- pip-install-Schritt stellt sicher, dass `rich>=13.0.0` und andere Deps installiert sind
- Exit-Code 75 loest automatischen Neustart aus (z.B. nach Parameter-Aenderung)

### `requirements.txt`
```
requests>=2.31.0
websocket-client>=1.6.0
rich>=13.0.0
```

`rich` wird vom Scaffold-Terminal-Display benoetigt.

---

## Wichtige Hinweise

- **`BaseBot` ist Pflicht** (C6) — alle neuen Bots erben von `bots/scaffold/base_bot.py`
- **Keine Direkt-Imports** von `LocalLog`, `trade_executor`, `heartbeat` aus Bridge — das macht `BaseBot` intern
- **Keine eigenen Kopien** von `ws_client.py`, `bridge_client.py`, `bot_display.py` im Bot-Ordner — diese liegen in `bots/scaffold/`
- **`bot_id` ist statisch** und wird in `config.json` gespeichert — nicht dynamisch generieren
- **`bot_port` muss einzigartig** sein — Bridge: 8765, TestBot 2: 8770, neue Bots ab 8771+
- **Log-Trennung** — `self.log()` schreibt nur bot-relevante Logs (C2)
- **Trade senden** — immer `self.send_trade()` nutzen, nie direkt `bridge_client.execute_trade()` (C4)

## Backtesting

Jeder Bot kann mit dem generischen Backtest-Runner getestet werden:

```
python bots/backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14
python bots/backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14 --bridge http://192.168.178.37:8765
```

- Daten kommen **ausschliesslich aus MetaTrader** ueber die Bridge (`/historical_candles`)
- Die Bridge muss laufen; der Runner kann von jedem PC im LAN ausgefuehrt werden
- Output: Trade-Liste, Win-Rate, Gesamt-P&L, Profit-Faktor, Max. Drawdown (im Terminal)

### Pflicht fuer backtest-faehige Bots

Zeit-Checks in `on_tick()` **immer** `self._now()` statt `datetime.now()` verwenden:

```python
# Richtig — funktioniert im Backtest (Zeit wird simuliert):
now_utc = self._now()

# Falsch — im Backtest immer Echtzeit, Session-Filter bricht:
now_utc = datetime.now(timezone.utc)
```

`self._now()` ist in `BaseBot` definiert und gibt live `datetime.now(timezone.utc)` zurueck.
Im Backtest-Runner wird die Methode pro Kerze ueberschrieben.

---

## Review-Checkliste

- [ ] `class MyBot(BaseBot)` — erbt von BaseBot?
- [ ] `on_tick()` implementiert und gibt dict zurueck?
- [ ] `config.json`: `bot_id`, `bot_type="bot"`, `bot_port` vorhanden?
- [ ] Kein `LocalLog` direkt importiert?
- [ ] Alle Logs via `self.log()`, nicht via `print()` fuer wichtige Events?
- [ ] `send_trade()` statt direktem Bridge-Aufruf?
- [ ] Bot-Ordner enthaelt KEINE eigenen Kopien von `ws_client.py`, `bridge_client.py`, `bot_display.py`?
- [ ] `get_parameters()` implementiert, wenn Parameter einstellbar sein sollen?
- [ ] Zeit-Checks nutzen `self._now()` statt `datetime.now()` (Backtest-Pflicht)?

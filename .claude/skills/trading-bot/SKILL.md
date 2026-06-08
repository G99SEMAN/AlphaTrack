# AlphaTrack Bot-Scaffold

Erstellt oder reviewt einen AlphaTrack Trading Bot auf Basis der `BaseBot`-Basisklasse aus `bots/scaffold/base_bot.py`.

## Verwendung

Wenn der User `/trading-bot` aufruft:

1. **Ohne Argument** — frage, was er tun möchte:
   - `new <botname>` — neuen Bot erstellen
   - `review` — bestehenden Bot reviewen
   - `debug` — Bot-Fehler analysieren

2. **`new <botname>`** — erstelle alle Dateien unter `bots/<botname>/` (Templates unten)

3. **`review`** — lies alle Bot-Dateien und prüfe:
   - Erbt Bot-Klasse von `BaseBot`?
   - `on_tick()` implementiert und gibt dict zurück?
   - `config.json` hat alle Pflichtfelder (inkl. `bot_id`, `bot_type`, `bot_port`)?
   - Kein direkter Import von `LocalLog` oder anderen Bridge-internen Klassen?
   - Keine Bridge-Logs im Bot-Terminal?

4. **`debug`** — lies `bots/<botname>/bot_log.json` und dann die Strategy-Datei

---

## Architektur (aktuell)

```
Bot (bots/<name>/) → WebSocket → Bridge (gateway.py :8765) → MT5
                   ← Commands  ←
```

- Bots kommunizieren **ausschließlich über die Bridge** (kein direkter MT5-Zugriff)
- Registrierung läuft **automatisch** beim Start via `BaseBot._connect_and_register()` (C7)
- Jeder Trade trägt `bot_id` als Metadatum (C4) — `BaseBot.send_trade()` setzt das automatisch
- MT5-Fehler kommen zurück an den Bot via `on_mt5_error()` (C3)

---

## Templates

### `config.json`
```json
{
  "alphatrack_url": "http://192.168.1.28:3000",
  "api_key": "REDACTED-API-KEY",
  "bot_id": "mybot-001",
  "bot_name": "Mein Bot",
  "bot_version": "1.0.0",
  "bot_type": "bot",
  "bot_ip": "",
  "bot_port": 8767,
  "profile_id": "HIER_PROFIL_ID",
  "bridge_url": "http://localhost:8765",
  "heartbeat_interval_sec": 10,
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M15",
    "candles_count": 50,
    "lots": 0.01,
    "max_positions": 1,
    "comment": "Mein Bot"
  }
}
```

**Pflichtfelder:**
- `bot_id`: Einzigartiger statischer Identifier (z.B. `"mybot-001"`)
- `bot_type`: Immer `"bot"` (nie `"bridge"`)
- `bot_port`: Einzigartiger Port (Bridge nutzt 8765, ai-trading 8766, nächster ab 8767+)
- `bridge_url`: URL zur Bridge (Standard: `http://localhost:8765`)

**Nicht committen** — enthält API-Key!

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
  - lots: Lot-Größe
  - max_positions: Max. gleichzeitige Positionen
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class MyStrategy(BaseBot):
    """Trading-Strategie: <Name>"""

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
set PYTHONPATH=%~dp0..\bridge
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```

### `requirements.txt`
```
websocket-client>=1.6.0
requests>=2.31.0
```

---

## Wichtige Hinweise

- **`BaseBot` ist Pflicht** (C6) — alle neuen Bots erben von `bots/scaffold/base_bot.py`
- **Keine Direkt-Imports** von `LocalLog`, `trade_executor`, `heartbeat` aus Bridge — das macht `BaseBot` intern
- **`bot_id` ist statisch** und wird in `config.json` gespeichert — nicht dynamisch generieren
- **`bot_port` muss einzigartig** sein — Bridge: 8765, ai-trading: 8766, breakoutv1: 8767, neue Bots ab 8768+
- **`config.json` niemals committen** — enthält API-Key
- **Log-Trennung** — `self.log()` schreibt nur bot-relevante Logs (C2)
- **Trade senden** — immer `self.send_trade()` nutzen, nie direkt `bridge_client.execute_trade()` (C4)

## Review-Checkliste

- [ ] `class MyBot(BaseBot)` — erbt von BaseBot?
- [ ] `on_tick()` implementiert und gibt dict zurück?
- [ ] `config.json`: `bot_id`, `bot_type="bot"`, `bot_port` vorhanden?
- [ ] Kein `LocalLog` direkt importiert?
- [ ] Alle Logs via `self.log()`, nicht via `print()` für wichtige Events?
- [ ] `send_trade()` statt direktem Bridge-Aufruf?
- [ ] `on_mt5_error()` falls Custom-Error-Handling nötig überschrieben?

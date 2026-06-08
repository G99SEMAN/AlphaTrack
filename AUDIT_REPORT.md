# AlphaTrack Codebase Audit Report

**Datum:** 2026-06-08  
**Analysierte Dateien:** 42 Python-Dateien in bridge/, bots/ai-trading/, bots/scalping/, bots/breakoutv1/, bots/scaffold/

---

## Zusammenfassung

| Kategorie | Anzahl |
|-----------|--------|
| Kritische Bugs | 7 |
| Mittlere Bugs | 9 |
| Performance-Probleme | 6 |
| Toter Code / Duplikate | 8 |

---

## KRITISCHE BUGS (sofort beheben)

### BUG-01 [KRITISCH] — Backtest-Sharpe-Formel mathematisch falsch
**Datei:** `bots/ai-trading/backtest.py:107`

```python
return (mean / std) * math.sqrt(78 * 252)
```

Der Faktor `78` ist falsch. M5-Kerzen haben 288 Perioden pro Tag (24h * 60min / 5min), nicht 78. Der korrekte Wert wäre `math.sqrt(288 * 252)` für kontinuierlichen Handel oder `math.sqrt(78 * 252)` nur wenn exakt 6.5 Handelsstunden/Tag angenommen werden — ohne dass das konfigurierbar oder dokumentiert ist. In `bots/scalping/backtest.py:19` wird hingegen korrekt `540 * 252` für M1-Kerzen verwendet (9h Session). Diese Inkonsistenz führt dazu, dass der autoresearch-Loop für den AI-Trading-Bot einen überhöhten Sharpe-Wert berechnet und schlechtere Strategien als Verbesserungen akzeptiert oder gute Strategien verwirft.

**Fix:** Faktor klar dokumentieren und konfigurierbar machen, oder auf `288 * 252` für 24h bzw. auf Basis der tatsächlichen Handelszeit aus der Strategie ableiten.

---

### BUG-02 [KRITISCH] — _consecutive_bars_direction greift auf candles[-1-1] = candles[-count-1] zu
**Datei:** `bots/ai-trading/strategy.py:67-73`

```python
for i in range(-count, 0):
    if float(candles[i]['close']) <= float(candles[i-1]['close']):
```

Bei `i = -count` wird `candles[-count - 1]` zugegriffen — das ist ein Candle **ausserhalb** des beabsichtigten Fensters (eine Kerze weiter in der Vergangenheit). Das ist kein Crash (Python erlaubt negative Indizes), aber logisch falsch: Die Richtungsprüfung vergleicht eine Kerze ausserhalb des definierten Fensters. Bei `count=3` wird also Kerze `[-4]` mit `[-3]` verglichen statt `[-3]` mit `[-4]` im Rahmen des 3-Kerzen-Fensters.

**Fix:**
```python
for i in range(-count + 1, 0):
    if float(candles[i]['close']) <= float(candles[i-1]['close']):
```
Oder die Schleife auf `range(len(candles)-count, len(candles))` umstellen.

---

### BUG-03 [KRITISCH] — analyze_strategy.py hat hartcodierten absoluten Pfad
**Datei:** `bots/ai-trading/analyze_strategy.py:26-28`

```python
ALPHATRACK_DATA_DIR = r"C:\Users\Kevin\Desktop\AlphaTrack\data"
STRATEGIES_FILENAME = "strategies-FiFT3HmJf-.json"
```

Zwei Probleme:
1. Der absolute Pfad `C:\Users\Kevin\Desktop\AlphaTrack\data` funktioniert nur auf einem einzigen Rechner. Auf jedem anderen Rechner schlägt das Skript still fehl (es erstellt das Verzeichnis einfach neu via `os.makedirs`).
2. Der Dateiname `strategies-FiFT3HmJf-.json` ist eine spezifische Nanoid-ID, die sich bei Neuinstallation der AlphaTrack-App ändern kann. Wenn die Datei nicht existiert, wird eine neue angelegt, die nie von der App gelesen wird.

**Fix:** Pfad relativ zu `__file__` berechnen, oder aus config.json lesen. Den Dateinamen per Glob suchen statt hartzucodieren.

---

### BUG-04 [KRITISCH] — Scalping-Backtest: Position wird nach 'close'-Signal nicht korrekt geschlossen
**Datei:** `bots/scalping/backtest.py:134-153`

```python
if action == 'close':
    pnl = (close - pos['entry']) if pos_direction == 'long' else (pos['entry'] - close)
    trades.append(pnl)
    closed = True
```

Nach dem `close`-Signal über `_manage_positions` wird der P&L korrekt berechnet. Aber direkt danach folgt `continue` — was bedeutet, in dieser Iteration wird kein neuer Entry mehr geprüft. Das ist korrekt. **Das echte Problem:** `_manage_positions` setzt den internen Bot-State (`_reset_state()`) zurück, aber der `bot`-Instanz-State und der Backtest-State laufen auseinander. Insbesondere setzt `_manage_positions` `self._tp1_hit = False` via `_reset_state()`, aber der Backtest prüft nie `self._tp1_hit` — er verwendet nur `positions`. Nach einem `close`-Signal überprüft der Backtest beim nächsten Tick erneut `positions` (jetzt leer), aber die Strategie-Instanz hat intern bereits `_bias = None` gesetzt, was dazu führt, dass die Strategie in der nächsten Iteration möglicherweise kein neues Signal gibt, obwohl der Markt es erlauben würde. Das verzerrt Backtest-Ergebnisse.

---

### BUG-05 [KRITISCH] — autoresearch.py: Fehler im Syntax-Check hinterlässt temporäre Datei
**Datei:** `bots/ai-trading/autoresearch.py:94-106` und `bots/scalping/autoresearch.py:86-105`

```python
finally:
    try:
        os.unlink(fname)
    except Exception:
        pass
```

`fname` ist nur definiert wenn das `NamedTemporaryFile` erfolgreich erstellt wurde. Wenn `tempfile.NamedTemporaryFile` selbst eine Exception wirft (z.B. kein Schreibrecht auf TEMP), ist `fname` undefiniert und der `finally`-Block würde einen `NameError` werfen. Dieser wird von `except Exception: pass` verschluckt — aber die ursprüngliche Exception geht verloren. In der Praxis ist das ein unwahrscheinlicher Rand-Fall, der aber beim Debugging verwirrend ist.

**Fix:**
```python
fname = None
try:
    with tempfile.NamedTemporaryFile(...) as f:
        fname = f.name
    ...
finally:
    if fname:
        try: os.unlink(fname)
        except Exception: pass
```

---

### BUG-06 [KRITISCH] — command_server.py (Flask) hat eine Candles-Limit-Bug: max 200 statt 5000
**Datei:** `bridge/command_server.py:173`

```python
count = min(int(request.args.get("count", "50")), 200)
```

Der Flask-Command-Server begrenzt `count` auf **200 Kerzen**. Der FastAPI-Gateway (`bridge/gateway.py:404`) begrenzt korrekt auf **5000 Kerzen**. Das AI-Trading-Bot konfiguriert `candles_count: 200` in seiner config.json — aber der Scalping-Bot benötigt für `fetch_history.py` bis zu 8000 M1-Kerzen, und der Backtest lädt `BRIDGE_CANDLE_COUNT = 2000`. Das Flask-Backend (`command_server.py`) wird von älteren Bots verwendet und liefert dann still nur 200 Kerzen ohne Fehler, was zu falschen Backtests und unvollständigen Live-Analysen führt.

**Fix:** Limit in `command_server.py` auf 5000 anheben, konsistent mit `gateway.py`.

---

### BUG-07 [KRITISCH] — Race Condition: _positions_cache in gateway.py ohne Lock geschrieben
**Datei:** `bridge/gateway.py:71-73`

```python
def update_positions_cache(positions: list):
    global _positions_cache
    _positions_cache = positions
```

`update_positions_cache` wird aus dem synchronen Main-Loop aufgerufen, während `get_positions()` (FastAPI-Endpunkt) asynchron in einem anderen Thread läuft. In CPython ist die Zuweisung einer Liste zu einer Variablen atomar dank des GIL — aber das ist ein Implementierungsdetail, keine Garantie. In PyPy oder zukünftigen GIL-freien Python-Versionen ist das eine echte Race Condition. Ein `threading.Lock()` sollte hier verwendet werden.

---

## MITTLERE BUGS

### BUG-08 [MITTEL] — EMA-Berechnung: For-Loop über gesamte Liste statt nur letzter Wert
**Datei:** `bots/ai-trading/strategy.py:8-18`, `bots/ai-trading/strategy_v6_backup.py:16-26`, `bots/ai-trading/strategy_v_final.py:16-26`

```python
def _ema(values: list, period: int) -> list:
    k = 2.0 / (period + 1)
    out = [None] * len(values)
    for i, v in enumerate(values):
        ...
    return out
```

Die EMA-Funktion berechnet den vollständigen EMA über alle 200 Kerzen, auch wenn nur der letzte Wert (`ema_f[-1]`, `ema_f[-2]`) benötigt wird. Bei 200 Kerzen und drei EMA-Berechnungen (fast=5, slow=13, trend=34) werden ~600 Iterationen pro Tick ausgeführt. Das ist ineffizient, aber nicht falsch. Der eigentliche Bug ist subtiler: Bei jedem Tick wird die vollständige History neu berechnet, obwohl der EMA inkrementell aktualisiert werden könnte. Im Backtest (`bots/ai-trading/backtest.py`) wird `on_tick` für jeden der ~2000 Candles aufgerufen, was ~1.2M Iterationen ergibt, die alle redundant sind.

---

### BUG-09 [MITTEL] — Backtest öffnet config.json mit `open()` statt `with`
**Datei:** `bots/ai-trading/backtest.py:177`

```python
config = json.load(open(CONFIG_FILE))
```

Der `if __name__ == '__main__'`-Block öffnet die Datei ohne `with`-Statement. Der File-Handle wird nicht explizit geschlossen. In normalen Python-Umgebungen wird er durch den GC geschlossen, aber es ist schlechte Praxis und kann auf Systemen mit wenigen File-Handles zu Problemen führen. Gleiches Problem in `bots/scalping/backtest.py:252`.

---

### BUG-10 [MITTEL] — FVGScalper: _manage_positions gibt 'close' zurück wenn KEIN Ticket vorhanden
**Datei:** `bots/scalping/strategy.py:196-227`

```python
def _manage_positions(self, positions: list, price: float) -> dict:
    if not positions:
        return {"action": "hold"}
    ticket = positions[0].get("ticket")
    if not ticket:
        return {"action": "hold"}
```

Wenn `ticket` `0` (int) ist, gibt `not ticket` `True` zurück und die Position wird nicht verwaltet. Im Backtest werden Tickets als Indizes (`ticket: i`) gesetzt — `i` kann 0 sein wenn der erste Frame verarbeitet wird.

**Fix:** `if ticket is None:` statt `if not ticket:`

---

### BUG-11 [MITTEL] — breakoutv1/main.py: open_count zählt ALLE Positionen, nicht nur eigene
**Datei:** `bots/breakoutv1/main.py:172`

```python
open_count = len([p for p in positions if p.get('instrument') == symbol])
```

Der Breakout-Bot filtert Positionen nur nach Symbol, nicht nach Bot-ID. Wenn ein anderer Bot die gleiche Position auf demselben Symbol hat, wird der Breakout-Bot fälschlicherweise blockiert. Im AI-Trading-Bot (`bots/ai-trading/main.py:221`) wird korrekt nach `my_tickets` gefiltert.

---

### BUG-12 [MITTEL] — strategy.py: Volatility-Ratio-Berechnung verwendet candles[-1] zweimal
**Datei:** `bots/ai-trading/strategy.py:38-47`

```python
volatilities = []
for i in range(max(1, len(candles) - period), len(candles)):
    ...
    volatilities.append(hi - lo)

avg_vol = sum(volatilities) / len(volatilities) if volatilities else 1.0
current_vol = float(candles[-1]['high']) - float(candles[-1]['low'])

return current_vol / avg_vol if avg_vol > 0 else 1.0
```

`candles[-1]` ist Teil von `volatilities` (die letzte Kerze ist im Loop enthalten), aber `current_vol` wird separat von `candles[-1]` berechnet. Das bedeutet die aktuelle Kerze fliesst in den Durchschnitt **und** als Zähler ein. Das ist keine saubere Volatility-Ratio-Berechnung. Die aktuelle Kerze sollte aus dem Durchschnitt ausgeschlossen werden.

---

### BUG-13 [MITTEL] — gateway.py: `@app.on_event("startup")` ist deprecated
**Datei:** `bridge/gateway.py:210`

```python
@app.on_event("startup")
async def _startup():
```

`on_event("startup")` ist in FastAPI seit Version 0.93.0 als deprecated markiert. Die korrekte Alternative ist `@app.lifespan`. Das ist kein funktionaler Bug, aber bei zukünftigen FastAPI-Updates wird eine DeprecationWarning ausgegeben.

---

### BUG-14 [MITTEL] — autoresearch.py: Experiment-Zähler startet falsch bei Wiederaufnahme
**Datei:** `bots/ai-trading/autoresearch.py:231`

```python
exp_num = len(list(EXPERIMENTS_DIR.glob('exp_*.json')))
```

`exp_num` wird als Anzahl vorhandener Experiment-Dateien initialisiert. Wenn aber Experiment #5 und #10 vorhanden sind (3 Dateien wegen Gaps durch gelöschte Experimente), startet der Zähler bei 3, nicht bei 10. Spätere Experimente würden als `exp_0003.json`, `exp_0004.json` gespeichert und existierende Dateien überschreiben.

**Fix:** `exp_num = max((int(f.stem.split('_')[1]) for f in EXPERIMENTS_DIR.glob('exp_*.json')), default=0)`

---

### BUG-15 [MITTEL] — bot_log.py: Log-Datei wird bei jedem `add()`-Aufruf vollständig gelesen und neu geschrieben
**Datei:** `bots/ai-trading/bot_log.py:59-63` (identisch in breakoutv1 und bridge/local_log.py)

```python
def add(self, level: str, message: str, details: str = None) -> None:
    with self._lock:
        entries = self._read()      # liest gesamte JSON-Datei
        entries.insert(0, entry)
        entries = entries[:MAX_ENTRIES]
        self._write(entries)        # schreibt gesamte JSON-Datei
```

Bei 2000 Max-Einträgen und häufigen Log-Aufrufen (z.B. jede Sekunde im Main-Loop) wird die gesamte JSON-Datei mit potentiell 2000 Einträgen bei jedem Log-Aufruf gelesen und neu geschrieben. Das ist ineffizient und bei I/O-Engpässen (z.B. langsame Festplatte) kann der Log-Lock den Main-Loop blockieren.

---

### BUG-16 [MITTEL] — Falsch-positive "Bridge nicht verbunden" in breakoutv1/main.py
**Datei:** `bots/breakoutv1/main.py:96-97`

```python
if not ws_client.is_connected():
    ws_client.send_log('warn', 'WS-Verbindung verloren, warte auf Reconnect...')
```

`send_log` wird aufgerufen wenn `is_connected()` `False` zurückgibt — aber `send_log` verwendet ebenfalls `is_connected()` intern (via `_send`). Bei WS-Disconnect wird also jede Sekunde versucht, eine Log-Nachricht über eine nicht-verbundene WS zu senden, was zu einem stillen Fehlschlag führt. Das ist kein Crash, aber unnötiger I/O und Log-Spam wenn der WS-Thread wieder verbindet.

---

## PERFORMANCE-PROBLEME

### PERF-01 — EMA wird als vollständige Liste berechnet, nur letzten 2 Werte genutzt
**Datei:** `bots/ai-trading/strategy.py:8-18`, `bots/ai-trading/strategy_v6_backup.py:16-26`

Die `_ema()`-Funktion berechnet eine Liste der Länge `len(values)` (~200 Werte), obwohl `on_tick` nur `ef[-1]` und `ef[-2]` benötigt. Drei EMA-Berechnungen = 600 Iterationen + 3 Listen mit je 200 Elementen pro Tick.

**Empfehlung:** Nur die letzten 2 EMA-Werte berechnen (braucht den vollen warmup-Pass einmalig, dann inkrementell).

---

### PERF-02 — ATR-Berechnung iteriert bis zu `period * 2` Kerzen
**Datei:** `bots/ai-trading/strategy.py:21-30`

```python
for i in range(max(1, len(candles) - period * 2), len(candles)):
```

Bei `period=14` und 200 Kerzen werden bis zu 28 True-Range-Berechnungen durchgeführt, aber nur die letzten 14 (`trs[-period:]`) werden verwendet. Die ersten 14 Berechnungen sind verschwendet.

**Fix:** `range(max(1, len(candles) - period), len(candles))` — genau `period` Iterationen.

---

### PERF-03 — BotLog: Datei-I/O im Main-Thread mit Lock blockiert Event-Loop
**Datei:** `bots/ai-trading/bot_log.py:59-63` (und Kopien in anderen bots)

Jeder `bot_log.add()`-Aufruf liest und schreibt synchron eine JSON-Datei im Haupt-Thread (unter Lock). Im Main-Loop von `main.py` werden `local_log.add()` bei jedem Tick, jedem Command und jedem Heartbeat aufgerufen. Bei langsamen Festplatten blockiert das den Loop.

**Empfehlung:** Log-Schreibvorgänge vollständig in den Push-Worker-Thread auslagern; nur den In-Memory-Buffer synchron halten.

---

### PERF-04 — is_connected() wird im Main-Loop mehrfach pro Sekunde aufgerufen
**Datei:** `bots/ai-trading/main.py:133-134` und `bridge/main.py:303`

```python
bridge_ok = bridge.is_connected()      # HTTP GET /health jede Sekunde
bridge_ok_ws = ws_client.is_connected()  # Flag-Check
```

`bridge.is_connected()` sendet einen echten HTTP GET-Request an `/health` **jede Sekunde** im Main-Loop. Bei 1Hz Tick-Rate = 3600 HTTP-Requests/Stunde nur für Health-Checks. Der `MT5Connector.is_connected()` hat bereits ein 5-Sekunden-Cache-TTL — die gleiche Optimierung fehlt im `BridgeClient`.

**Empfehlung:** Cache für `BridgeClient.is_connected()` mit ~5s TTL hinzufügen.

---

### PERF-05 — Scalping-Backtest: _aggregate baut vollständige TF-Sets aus allen M1-Kerzen vorab
**Datei:** `bots/scalping/backtest.py:58-65`

```python
def _build_tf_sets(m1: list) -> dict:
    return {
        'M1':  m1,
        'M5':  _aggregate(m1, 5),
        'M15': _aggregate(m1, 15),
        'H1':  _aggregate(m1, 60),
        'H4':  _aggregate(m1, 240),
    }
```

Alle 5 TF-Aggregationen werden für alle M1-Kerzen einmalig am Anfang berechnet. Bei 8000 M1-Kerzen: 1600 M5, 533 M15, 133 H1, 33 H4-Kerzen werden alle vorberechnet. Das ist vertretbar für den Backtest, könnte aber memory-intensiv sein wenn sehr viele Kerzen geladen werden.

---

### PERF-06 — on_tick des FVGScalpers macht einen HTTP-Request pro Tick an die Bridge
**Datei:** `bots/scalping/strategy.py:277`

```python
htf_candles = self._bridge.get_candles(symbol, htf, htf_count)
```

In der Live-Umgebung wird `on_tick` einmal pro Minute aufgerufen (60s Tick-Interval). Bei jedem Aufruf werden **zwei** HTTP-Requests zur Bridge gemacht:
1. Einmal für M1-Kerzen (von `BaseBot.run()`)  
2. Einmal für HTF-Kerzen (von `FVGScalper.on_tick()`)

Das ist designbedingt und mit 1/min vertretbar. Im Backtest wird die MockBridge verwendet, kein echter HTTP — dort kein Problem.

---

## TOTER CODE / AUFRÄUMEN

### DEAD-01 — strategy_v6_backup.py und strategy_v_final.py sind identische Kopien
**Datei:** `bots/ai-trading/strategy_v6_backup.py` und `bots/ai-trading/strategy_v_final.py`

Beide Dateien sind **byte-für-byte identisch** (selber Inhalt, selbe Docstring-Header, selbe Implementierung). Keines der beiden wird in irgendeiner Datei importiert. Es handelt sich um Backup-Snapshots eines früheren Strategie-Standes (v6 mit EMA-Crossover + RSI + ADX), der durch den aktuellen `strategy.py` (v41, EMA + ATR + Volatility-Filter) abgelöst wurde.

**Handlungsempfehlung:** Beide Dateien löschen. Der Git-Verlauf bewahrt die History. Falls ein v6-Snapshot gewünscht ist, sollte er im `experiments/`-Verzeichnis oder per Git-Tag archiviert werden, nicht als freie .py-Datei.

---

### DEAD-02 — `math` und `statistics` importiert aber nie verwendet in strategy_v6_backup.py / strategy_v_final.py
**Datei:** `bots/ai-trading/strategy_v6_backup.py:12`, `bots/ai-trading/strategy_v_final.py:12`

```python
import math
import statistics
```

Beide Module werden importiert aber nie verwendet. Das ist ein weiteres Indiz dafür, dass diese Dateien Überreste eines früheren Entwicklungsstands sind.

---

### DEAD-03 — bot_log.py ist in drei Bots nahezu identisch dupliziert
**Dateien:**
- `bots/ai-trading/bot_log.py` (123 Zeilen)
- `bots/breakoutv1/bot_log.py` (122 Zeilen)
- `bots/scalping/bot_log.py` (Existiert vermutlich via BaseBot)

Die `bot_log.py`-Implementierungen in `ai-trading` und `breakoutv1` sind inhaltlich identisch (gleiche Klasse `BotLog`, gleiche Methoden, gleicher Push-Worker). Einziger Unterschied: Das `_LOG_FILE`-Pfad-Preset. Dieser Code sollte in `bots/scaffold/` als gemeinsame Bibliothek gelagert werden und von beiden Bots importiert werden.

**Handlungsempfehlung:** `bots/scaffold/bot_log.py` erstellen mit parametrischem Log-Pfad, und beide Kopien durch einen Import ersetzen.

---

### DEAD-04 — bridge/command_server.py (Flask) wird nicht mehr von bridge/main.py verwendet
**Datei:** `bridge/command_server.py`

`bridge/main.py` importiert ausschliesslich aus `bridge/gateway.py` (FastAPI). `command_server.py` (Flask) wird nirgendwo mehr importiert. Es handelt sich um den alten Flask-basierten HTTP-Server, der durch den FastAPI-Gateway (`gateway.py`) abgelöst wurde.

**Beweis:** `bridge/main.py:18` importiert nur `from gateway import ...`, nicht `from command_server import ...`.

**Handlungsempfehlung:** `bridge/command_server.py` löschen oder in ein `archive/`-Verzeichnis verschieben. Vorsicht: Prüfen ob externe Skripte oder Start-Skripte die Flask-Komponente noch referenzieren.

---

### DEAD-05 — bridge/command_server.py: `/history`-Endpunkt existiert in gateway.py nicht
**Datei:** `bridge/command_server.py:192-199`

```python
@app.route("/history", methods=["GET"])
def get_history():
    ...
    deals = _history_fetcher(from_timestamp=0.0)
```

Der Flask-Server hat einen `/history`-Endpunkt der alle Deals seit Timestamp 0 abruft. In `bridge/gateway.py` gibt es keinen entsprechenden Endpunkt. Falls bots jemals `/history` nutzen, funktioniert das nur mit dem alten Flask-Server.

---

### DEAD-06 — `_get_local_ip()` ist dreifach dupliziert
**Dateien:**
- `bots/ai-trading/main.py:30-38`
- `bots/ai-trading/ws_client.py:16-24`
- `bots/breakoutv1/ws_client.py:17-25`
- `bots/scaffold/base_bot.py:67-75`

Exakt dieselbe Funktion `_get_local_ip()` (verbindet UDP zu 8.8.8.8, liest eigene IP) ist viermal kopiert. Sie sollte in `bots/scaffold/` oder einer gemeinsamen Utility-Datei centralisiert werden.

---

### DEAD-07 — autoresearch.py: `_best_sharpe()` wird definiert aber nie aufgerufen
**Datei:** `bots/ai-trading/autoresearch.py:66-69`, `bots/scalping/autoresearch.py:68-71`

```python
def _best_sharpe() -> float:
    history = _load_history(200)
    kept = [e.get('sharpe', -999.0) for e in history if e.get('kept')]
    return max(kept, default=-999.0)
```

Die Funktion `_best_sharpe()` wird in beiden `autoresearch.py`-Dateien definiert, aber nirgends aufgerufen. Der Basis-Sharpe wird stattdessen direkt über `_reload_and_backtest(config)` bestimmt.

---

### DEAD-08 — analyze_strategy.py: `bot_display.py` existiert nur im ai-trading Bot
**Datei:** `bots/ai-trading/bot_display.py`

`bot_display.py` wird nur von `bots/ai-trading/main.py` importiert. Die anderen Bots (breakoutv1, scalping) verwenden es nicht. Die Scalping-Bot-Variante nutzt stattdessen `BaseBot.display_header()`. Das ist kein toter Code per se, aber eine Architektur-Inkonsistenz: Der AI-Trading-Bot implementiert seine eigene Display-Logik ausserhalb des BaseBot-Frameworks.

---

## EMPFOHLENE REIHENFOLGE DER FIXES

### Priorität 1 — Sofort (Trading-Korrektheit)

1. **BUG-02 beheben** (`strategy.py:_consecutive_bars_direction`): Off-by-one in Index-Schleife führt zu falschen Handelssignalen im laufenden Bot.

2. **BUG-01 beheben** (`backtest.py:_sharpe`): Falsche Sharpe-Annualisierung führt dazu, dass der autoresearch-Loop suboptimale Strategien beibehält. Faktor dokumentieren und korrekt setzen.

3. **BUG-06 beheben** (`command_server.py`): Candles-Limit von 200 auf 5000 anheben — kritisch wenn alter Flask-Server noch aktiv.

4. **BUG-10 beheben** (`scalping/strategy.py:_manage_positions`): `not ticket` zu `ticket is None` — Backtest-Ergebnisse werden durch Ticket-0-Edge-Case verfälscht.

5. **BUG-14 beheben** (`autoresearch.py:exp_num`): Experiment-Nummerierung kann bestehende Dateien überschreiben.

### Priorität 2 — Kurzfristig (Code-Qualität)

6. **DEAD-01/02 entfernen**: `strategy_v6_backup.py` und `strategy_v_final.py` löschen — sie verwirren zukünftige Entwicklung und könnten versehentlich importiert werden.

7. **DEAD-04 klären**: `command_server.py` (Flask) entweder archivieren oder entfernen. Prüfen ob es noch verwendet wird.

8. **BUG-03 beheben** (`analyze_strategy.py`): Hartcodierten Pfad durch relativen Pfad ersetzen.

9. **BUG-11 beheben** (`breakoutv1/main.py`): Position-Filterung nach Bot-ID ergänzen.

### Priorität 3 — Mittelfristig (Architektur)

10. **DEAD-03 konsolidieren**: `bot_log.py` in `bots/scaffold/` centralisieren.

11. **DEAD-06 konsolidieren**: `_get_local_ip()` in eine gemeinsame Utility-Datei.

12. **PERF-01/02 optimieren**: EMA- und ATR-Berechnungen auf minimale Iterationen reduzieren.

13. **PERF-04 optimieren**: `BridgeClient.is_connected()` mit Cache-TTL versehen.

14. **BUG-07 absichern**: `_positions_cache` in `gateway.py` mit Lock schützen.

15. **BUG-13 aktualisieren**: `@app.on_event("startup")` auf FastAPI-Lifespan umstellen.

---

## TECHNISCHE SCHULDEN — ÜBERSICHT

| Datei | Zeile | Typ | Beschreibung |
|-------|-------|-----|--------------|
| `bots/ai-trading/backtest.py` | 107 | Bug-kritisch | Falsche Sharpe-Annualisierung (78 statt 288) |
| `bots/ai-trading/strategy.py` | 67-73 | Bug-kritisch | Off-by-one in _consecutive_bars_direction |
| `bots/ai-trading/analyze_strategy.py` | 26-28 | Bug-kritisch | Hartcodierter absoluter Pfad |
| `bots/scalping/strategy.py` | 196 | Bug-mittel | `not ticket` schlägt bei ticket=0 fehl |
| `bots/ai-trading/autoresearch.py` | 94-106 | Bug-mittel | fname undefined in finally |
| `bots/ai-trading/autoresearch.py` | 231 | Bug-mittel | exp_num-Zähler überschreibt Dateien |
| `bots/breakoutv1/main.py` | 172 | Bug-mittel | Kein Bot-ID-Filter bei Position-Zählung |
| `bridge/command_server.py` | 173 | Bug-kritisch | Candles-Limit 200 statt 5000 |
| `bridge/gateway.py` | 71-73 | Bug-kritisch | Race Condition positions_cache |
| `bridge/gateway.py` | 210 | Bug-niedrig | Deprecated on_event("startup") |
| `bots/ai-trading/strategy_v6_backup.py` | - | Toter Code | Nicht importiert, identisch zu v_final |
| `bots/ai-trading/strategy_v_final.py` | - | Toter Code | Nicht importiert, identisch zu v6_backup |
| `bridge/command_server.py` | - | Toter Code | Flask-Server nicht mehr verwendet |
| `bots/*/bot_log.py` | - | Duplikat | Dreifach kopierte Implementierung |
| `bots/*/main.py` | - | Duplikat | `_get_local_ip()` viermal kopiert |
| `bots/ai-trading/autoresearch.py` | 66-69 | Toter Code | `_best_sharpe()` nie aufgerufen |

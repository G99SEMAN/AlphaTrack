---
phase: quick-260612-ryx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bots/testbot2/bot_display.py
  - bots/testbot2/strategy.py
  - bots/testbot2/requirements.txt
autonomous: true
requirements: [BOT-TERMINAL-UI]

must_haves:
  truths:
    - "TestBot2 zeigt beim Start ein rich-Live-Terminal mit grünem Header statt der print-Zeilen der Basisklasse"
    - "Der Header zeigt ID | Name | IP:Port | Latenz und eine Subtitle mit Uptime + Status (bot._state)"
    - "Eine 3-Spalten-Statuszeile zeigt Bridge-Verbindung (grün/rot + Latenz), Strategie-Parameter und offene Positionen (Ticket-Nummern)"
    - "Strategie-Parameter im Display werden live aus bot._config['strategy'] gelesen (reagieren auf set_parameters)"
    - "Das Log-Panel scrollt wie beim Bridge-Terminal; bot.log()-Aufrufe landen im Display statt auf der Konsole"
    - "is_connected() wird höchstens alle 5 Sekunden aufgerufen (gecacht) und blockiert den Render-Loop nicht dauerhaft"
    - "bots/scaffold/ bleibt unverändert"
  artifacts:
    - path: "bots/testbot2/bot_display.py"
      provides: "BotDisplay-Klasse mit Live-Layout, Render-Thread, attach(), log()"
      contains: "class BotDisplay"
      min_lines: 150
    - path: "bots/testbot2/strategy.py"
      provides: "TestBot2 mit display_header/log/on_mt5_error/run-Overrides"
      contains: "def display_header"
    - path: "bots/testbot2/requirements.txt"
      provides: "rich-Abhängigkeit"
      contains: "rich"
  key_links:
    - from: "bots/testbot2/strategy.py"
      to: "bots/testbot2/bot_display.py"
      via: "BotDisplay(self.name).attach(self).start() in display_header()"
      pattern: "BotDisplay\\("
    - from: "bots/testbot2/bot_display.py"
      to: "bot._bridge.is_connected()"
      via: "gecachter Aufruf im Render-Thread (5s-Drossel)"
      pattern: "is_connected"
---

<objective>
TestBot2 bekommt ein rich-basiertes Live-Terminal im Stil der Bridge (bridge/display.py), jedoch mit GRÜNEM Header zur optischen Abgrenzung. Das Terminal zeigt Bridge-Verbindung, Strategie-Parameter und offene Positionen plus ein scrollendes Log-Panel. Die Umsetzung erfolgt AUSSCHLIESSLICH in bots/testbot2/ — das Scaffold (bots/scaffold/) bleibt unangetastet.

Purpose: Live-Übersicht über den laufenden Bot direkt im Terminal, konsistent mit dem Bridge-Terminal-Look.
Output: Neues Modul bot_display.py, erweiterte strategy.py (4 Overrides), rich in requirements.txt.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@bridge/display.py
@bots/scaffold/base_bot.py
@bots/testbot2/strategy.py
@bots/testbot2/main.py
@bots/testbot2/bridge_client.py
@bots/testbot2/config.json
@bots/testbot2/requirements.txt
</context>

<tasks>

<task type="auto">
  <name>Task 1: Modul bots/testbot2/bot_display.py (BotDisplay-Klasse)</name>
  <files>bots/testbot2/bot_display.py</files>
  <action>
Erstelle die Klasse BotDisplay eng am Vorbild bridge/display.py (gleiche Imports aus rich, gleiche Struktur: Live + Layout + Render-Thread mit _REFRESH_RATE=2 Hz, deque-Log mit MAX_LOG_LINES, threading.Lock). Deutsche Kommentare, ASCII-Umlaute ("fuer") wie im Vorbild.

Konstruktor BotDisplay(bot_name: str): setzt _bot_name, _start_time, _lock, _log_lines (deque maxlen=MAX_LOG_LINES), _console = Console(), _live = None, _bot = None (Referenz auf die Bot-Instanz), sowie Cache-Felder für die Bridge-Erreichbarkeit: _bridge_ok = False, _bridge_check_ts = 0.0.

attach(bot) -> None: speichert self._bot = bot. Der Render-Thread liest danach direkt die Bot-Attribute: bot.bot_id, bot.name, bot.ip, bot.port, bot.latency_ms, bot._state, bot._my_tickets (set[int]), bot._config (dict), bot._bridge (BridgeClient | None). Alle Zugriffe mit getattr/None-Guard absichern, falls ein Attribut noch nicht existiert.

log(level, tag, message) -> None: wie BridgeDisplay.log (bridge/display.py Z.93-100): ts = HH:MM:SS, unter Lock self._log_lines.append((ts, f"[{tag}]", message)); wenn self._live is None: direktes self._console.print mit Farb-Mapping {info:cyan, warn:yellow, error:red, ok:green}.

Bridge-Erreichbarkeit GECACHT (Entscheidung: 5s-Drossel direkt im Render-Loop akzeptieren — einfachste Lösung, kurzes UI-Ruckeln bei is_connected-Timeout ist akzeptabel; KEIN separater Thread, um Komplexität zu vermeiden). Methode _bridge_connected() -> bool: wenn self._bot is None oder getattr(self._bot, "_bridge", None) is None → return False. Sonst: now = time.time(); wenn now - self._bridge_check_ts >= 5.0: self._bridge_ok = bot._bridge.is_connected(); self._bridge_check_ts = now. Immer self._bridge_ok zurückgeben (Cache-Wert zwischen den Checks).

Render-Methoden (Bot-Attribute über self._bot lesen, mit None-Guards):
- _render_identity_row() -> Table: analog bridge/display.py Z.104-131 — Spalten ID | Name | IP:Port | Latenz. ID aus bot.bot_id, Name aus self._bot_name, Adresse f"{bot.ip}:{bot.port}", Latenz f"{bot.latency_ms}ms" falls gesetzt sonst "—".
- _render_status_row() -> Table: 3 Spalten (box.SIMPLE_HEAD, show_header=False, expand=True).
  Spalte 1 "Bridge": ok = self._bridge_connected(); bei ok grünes "● Bridge\nVerbunden ({lat}ms)" (lat = bot.latency_ms falls vorhanden, sonst ohne ms-Suffix), sonst rotes "● Bridge\nGetrennt".
  Spalte 2 "Strategie": strat = (bot._config or {}).get("strategy", {}); Zeile 1 bold weiß f"{strat.get('symbol','?')} {strat.get('timeframe','?')} | {strat.get('lots','?')} Lot"; Zeile 2 dim f"Hold {strat.get('hold_minutes','?'):g}min | Intervall {strat.get('interval_minutes','?'):g}min" (g-Format nur wenn numerisch — sicher casten/try). Live aus bot._config (ändert sich via set_parameters).
  Spalte 3 "Offene Positionen": tickets = sorted(bot._my_tickets) falls vorhanden sonst []; Zeile 1 bold weiß str(len(tickets)); Zeile 2 dim mit Ticket-Nummern als "#1234 #5678 …" — bei mehr als 3 Tickets die ersten 3 zeigen + "…", bei 0 dim "—".
- _render_log_panel(height) -> Panel: 1:1 von bridge/display.py Z.176-202 übernehmen (gleiche Optik, gleiches Tag-Farb-Mapping, title "[dim]Bot-Log[/dim]").

_build_layout() -> Layout: split_column mit Layout(name="id_row", size=3), Layout(name="status_row", size=4), Layout(name="log").

start() -> None: analog bridge/display.py Z.260-306. Live(layout, console=self._console, refresh_per_second=_REFRESH_RATE, screen=False, transient=False); self._live.start(); Render-Loop in daemon-Thread (name "BotDisplayRenderer"): terminal_height = self._console.height or 40; log_height = max(5, terminal_height - 9); id_row-Panel mit title f"[bold green] {self._bot_name} [/bold green] [dim]Bot[/dim]", subtitle f"[dim]Uptime: {self._uptime_str()} | Status: {state}[/dim]" (state = getattr(self._bot, "_state", "—")), border_style="green", padding=(0,1); status_row-Panel border_style="dim"; log-Panel via _render_log_panel(log_height); self._live.refresh(); try/except pass um den Loop-Body; time.sleep(1.0/_REFRESH_RATE).

stop() -> None: wenn self._live: self._live.stop(); self._live = None.

_uptime_str() -> str: identisch zu bridge/display.py Z.313-317.

WICHTIG: ● und Umlaut-freie ASCII-Strings; keine direkten Konsolen-Prints von ● vor Live-Start außer über die rich-Console (die kodiert korrekt).
  </action>
  <verify>
    <automated>cd bots/testbot2 && python -m py_compile bot_display.py && PYTHONIOENCODING=utf-8 python -c "import io; from rich.console import Console; from bot_display import BotDisplay; d=BotDisplay('TestBot 2'); fake=type('B',(),{})(); fake.bot_id='testbot2-001'; fake.name='TestBot 2'; fake.ip='192.168.178.30'; fake.port=8770; fake.latency_ms=12; fake._state='running'; fake._my_tickets={111,222}; fake._config={'strategy':{'symbol':'EURUSDp','timeframe':'M1','lots':0.01,'hold_minutes':1,'interval_minutes':1}}; fake._bridge=None; d.attach(fake); buf=io.StringIO(); c=Console(file=buf, width=100); c.print(d._render_identity_row()); c.print(d._render_status_row()); d.log('info','BOT','Teststart'); c.print(d._render_log_panel(10)); out=buf.getvalue(); assert 'EURUSDp' in out and 'testbot2-001' in out and 'Teststart' in out, out; print('OK')"</automated>
  </verify>
  <done>bot_display.py kompiliert; BotDisplay rendert Identity-Row, Status-Row (mit Strategie-Parametern aus dem Fake-Config) und Log-Panel in eine StringIO-Console ohne Exception; ● erscheint nicht ungekodiert in der Windows-Konsole.</done>
</task>

<task type="auto">
  <name>Task 2: TestBot2-Overrides in strategy.py + rich in requirements.txt</name>
  <files>bots/testbot2/strategy.py, bots/testbot2/requirements.txt</files>
  <action>
In bots/testbot2/strategy.py die Klasse TestBot2 erweitern (bestehende __init__/get_parameters/on_tick NICHT verändern, nur ergänzen). Import oben ergänzen: from bot_display import BotDisplay. In __init__ self._display = None ergänzen (nach super().__init__-Block). Deutsche Kommentare, Stil wie im Bestand.

display_header()-Override (ersetzt den print-Header der Basisklasse, base run() ruft ihn Z.430 nach Registrierung auf — Latenz/Config sind dann gesetzt):
  self._display = BotDisplay(self.name); self._display.attach(self); self._display.start().
  Da der Render-Thread sofort liest, ist nichts weiter zu tun. KEIN super().display_header() aufrufen (sonst würden print-Zeilen das Live-Layout zerschießen).

log(level, message, details=None)-Override: NICHT super().log() aufrufen (der BotLog-Fallback der Basisklasse printet auf die Konsole, base_bot.py Z.62-64, und würde das Live-Layout zerstören). Stattdessen das ws_client-Verhalten der Basisklasse replizieren (base_bot.py Z.242-245): wenn self._ws_client: self._ws_client.send_log(level, message, details). Ins Display routen, wenn vorhanden: wenn self._display is not None: msg = message + (f" | {details}" if details else ""); self._display.log(level, "BOT", msg). Vor Display-Start (self._display is None): Verhalten der Basisklasse beibehalten — also self._log.add(...) falls vorhanden (wie base_bot.py Z.242-243), damit frühe Logs nicht verloren gehen.

on_mt5_error(error)-Override: statt des print der Basisklasse (base_bot.py Z.294) nur self.log("error", "MT5-Fehler", error) aufrufen (kein print, um das Layout zu schonen).

run()-Override: super().run() in try/finally kapseln; im finally: wenn getattr(self, "_display", None) is not None: self._display.stop(). So bleibt das Terminal nach Strg+C / Shutdown sauber.

In bots/testbot2/requirements.txt eine Zeile "rich>=13.0.0" ergänzen (bestehende Zeilen requests/websocket-client behalten).
  </action>
  <verify>
    <automated>cd bots/testbot2 && python -m py_compile strategy.py && PYTHONIOENCODING=utf-8 python -c "import sys,os; sys.path.insert(0, os.path.join('..')); from strategy import TestBot2; b=TestBot2('testbot2-001','TestBot 2',8770); assert hasattr(b,'display_header') and hasattr(b,'on_mt5_error'); b._display=None; b._ws_client=None; b._log=None; b.log('info','frueh-log'); print('OK')" && grep -q '^rich' requirements.txt && echo REQ_OK</automated>
  </verify>
  <done>strategy.py kompiliert; TestBot2 hat display_header/log/on_mt5_error/run-Overrides; log() vor Display-Start wirft keine Exception; requirements.txt enthält rich>=13.0.0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Bot → Bridge (HTTP) | bot._bridge.is_connected() ruft GET /health (3s Timeout) im Render-Thread; bestehende Verbindung, keine neue Angriffsfläche |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Denial of Service | Render-Loop blockiert durch is_connected-Timeout | mitigate | 5s-Drossel + Cache-Wert (_bridge_check_ts), höchstens ein Health-Call pro 5s; kurzes Ruckeln akzeptiert |
| T-quick-02 | Tampering | rich>=13.0.0 (pip install) | accept | Etabliertes, weit verbreitetes PyPI-Paket, bereits implizit Bridge-Standard (bridge/display.py nutzt rich); kein neues exotisches Paket |
</threat_model>

<verification>
- python -m py_compile bots/testbot2/bot_display.py bots/testbot2/strategy.py (beide kompilieren)
- Smoke-Test: BotDisplay mit Fake-Bot-Objekt attachen, _render_*-Methoden in Console(file=StringIO, width=100) rendern, Ausgabe enthält Strategie-Parameter, ID und Log-Text (PYTHONIOENCODING=utf-8, kein ● in die Windows-Konsole)
- git status: bots/scaffold/ unverändert; nur bots/testbot2/bot_display.py, strategy.py, requirements.txt geändert
</verification>

<success_criteria>
- BotDisplay rendert grünen Header + 3-Spalten-Status (Bridge/Strategie/Positionen) + scrollendes Log-Panel
- Strategie-Spalte liest live aus bot._config['strategy']
- Bridge-Check ist auf 5s gedrosselt und None-sicher solange bot._bridge fehlt
- TestBot2-Overrides: display_header startet Display, log routet ins Display (ohne Konsolen-Print bei aktivem Live), run() stoppt das Display im finally
- bots/scaffold/ ist unverändert
- requirements.txt enthält rich>=13.0.0
</success_criteria>

<output>
Create `.planning/quick/260612-ryx-bot-terminal-testbot2-im-bridge-design-r/260612-ryx-SUMMARY.md` when done.

Commit nur die eigenen Dateien explizit (Englisch, feat:), KEINE live-dirty Dateien (data/*, bridge/bridge_log.json, bridge/ticket_registry.json, bots/testbot2/data/*) stagen:
  git add bots/testbot2/bot_display.py bots/testbot2/strategy.py bots/testbot2/requirements.txt
  git commit -m "feat: add rich terminal UI (green Bridge-style) for testbot2"
</output>

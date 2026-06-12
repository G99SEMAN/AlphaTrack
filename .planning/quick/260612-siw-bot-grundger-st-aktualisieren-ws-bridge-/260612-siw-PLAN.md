---
phase: quick
plan: 260612-siw
type: execute
wave: 1
depends_on: []
files_modified:
  - bots/scaffold/ws_client.py
  - bots/scaffold/bridge_client.py
  - bots/scaffold/bot_display.py
  - bots/scaffold/base_bot.py
  - bots/testbot2/strategy.py
  - .claude/skills/trading-bot/SKILL.md
  - bots/CLAUDE.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "ws_client.py, bridge_client.py und bot_display.py liegen ausschliesslich im Scaffold (bots/scaffold/), nicht mehr in bots/testbot2/"
    - "Ein TestBot2 laesst sich ohne ImportError instanziieren und besitzt das Attribut _display"
    - "BaseBot startet bei verfuegbarem rich automatisch das Live-Display; ohne rich faellt es auf den print-Header zurueck"
    - "testbot2/strategy.py enthaelt nur noch __init__, get_parameters und on_tick (keine Display-/Log-/run-Overrides mehr)"
    - "SKILL.md und bots/CLAUDE.md beschreiben die neue Aufteilung: Bot-Ordner = 5 Dateien, gemeinsame Module im Scaffold"
  artifacts:
    - path: "bots/scaffold/base_bot.py"
      provides: "BaseBot mit integriertem BotDisplay (Guard-Import, display_header, log, on_mt5_error, run-finally)"
      contains: "from .bot_display import BotDisplay"
    - path: "bots/scaffold/bot_display.py"
      provides: "Live-Terminal-UI (verschoben aus testbot2)"
    - path: "bots/testbot2/strategy.py"
      provides: "Schlanke TestBot2-Strategie ohne Infrastruktur-Overrides"
    - path: ".claude/skills/trading-bot/SKILL.md"
      provides: "Aktualisierte Bot-Bauanleitung (Scaffold-Aufteilung, start.bat, Parameter-Editor, Terminal-UI)"
  key_links:
    - from: "bots/scaffold/base_bot.py"
      to: "bots/scaffold/ws_client.py"
      via: "paketrelativer Import"
      pattern: "from \\.ws_client import"
    - from: "bots/scaffold/base_bot.py"
      to: "bots/scaffold/bot_display.py"
      via: "Guard-Import + display_header"
      pattern: "from \\.bot_display import BotDisplay"
---

<objective>
Zentralisiert die gemeinsame Bot-Infrastruktur (ws_client, bridge_client, bot_display) im Scaffold, integriert das Live-Terminal-Display fest in BaseBot, migriert testbot2 auf die schlanke Form und aktualisiert Skill- und Bot-Doku auf die neue Aufteilung.

Purpose: Neue Bots sollen nur noch aus config.json, main.py, strategy.py, start.bat und requirements.txt bestehen; die Terminal-UI und das Bridge-Handling kommen automatisch aus dem Scaffold. Kein Copy-Paste von Infrastruktur mehr.
Output: Verschobene Scaffold-Module, erweiterte BaseBot, bereinigte testbot2/strategy.py, aktualisierte SKILL.md und bots/CLAUDE.md — in 3 atomaren Commits.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@bots/scaffold/base_bot.py
@bots/scaffold/__init__.py
@bots/testbot2/strategy.py
@bots/testbot2/main.py
@bots/testbot2/start.bat
@.claude/skills/trading-bot/SKILL.md
@bots/CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold zentralisieren + BotDisplay in BaseBot integrieren</name>
  <files>bots/scaffold/ws_client.py, bots/scaffold/bridge_client.py, bots/scaffold/bot_display.py, bots/scaffold/base_bot.py</files>
  <action>
Drei `git mv` ausfuehren (testbot2-Versionen sind die aktuellsten):
`git mv bots/testbot2/ws_client.py bots/scaffold/ws_client.py`,
`git mv bots/testbot2/bridge_client.py bots/scaffold/bridge_client.py`,
`git mv bots/testbot2/bot_display.py bots/scaffold/bot_display.py`.
bot_display.py importiert nur rich + Standardbibliothek, nichts Bot-Lokales — unveraendert lassen.

In bots/scaffold/base_bot.py:
1. Imports der WS-/Bridge-Clients (aktuell `from ws_client import BridgeWSClient` / `from bridge_client import BridgeClient`, im try/except-Block) auf paketrelativ umstellen: `from .ws_client import BridgeWSClient`, `from .bridge_client import BridgeClient`. ImportError-Fehlertext sinngemaess belassen. Den `bot_log`-Import (Inline-Fallback-BotLog) UNVERAENDERT lassen.
2. Direkt nach dem bot_log-Block einen Guard-Import ergaenzen: `try: from .bot_display import BotDisplay` / `except ImportError: BotDisplay = None` (rich evtl. nicht installiert).
3. In `__init__` `self._display = None` ergaenzen (Typ `BotDisplay | None` analog der uebrigen Felder).
4. `display_header()` erweitern: wenn `BotDisplay is not None` → `self._display = BotDisplay(self.name)`, `self._display.attach(self)`, `self._display.start()` und RETURN (kein print-Header). Sonst der bisherige print-Header-Code (komplett behalten).
5. `log()` umbauen: ws_client.send_log(...) immer aufrufen wenn `self._ws_client` (wie bisher). Danach: wenn `self._display is not None` → `self._display.log(level, "BOT", message + (f" | {details}" if details else ""))` und NICHT den printenden BotLog-Fallback aufrufen. Wenn kein Display aktiv → bisheriges Verhalten (`self._log.add(...)` falls vorhanden). Logik 1:1 wie der heutige testbot2-Override.
6. `on_mt5_error()`: die `print(f"[MT5-FEHLER] {error}")`-Zeile entfernen; nur noch `self.log("error", "MT5-Fehler", error)` (Display-sicher).
7. `run()`: den gesamten bestehenden Loop-Koerper in try/finally huellen; im `finally` `if self._display is not None: self._display.stop()`. Bestehende Logik nicht aendern, nur einwickeln.

Stale __pycache__ der verschobenen Module in testbot2 loeschen: `rm -rf bots/testbot2/__pycache__` (gitignored).

Stil wie Bestand: deutsche Kommentare, ASCII-Umlaute in display-/print-nahen Zeilen.
  </action>
  <verify>
    <automated>cd "c:/Users/G99SEMAN/Desktop/AlphaTrack" && PYTHONIOENCODING=utf-8 python -m py_compile bots/scaffold/base_bot.py bots/scaffold/ws_client.py bots/scaffold/bridge_client.py bots/scaffold/bot_display.py && PYTHONIOENCODING=utf-8 python -c "import sys; sys.path.insert(0,'bots'); from scaffold.base_bot import BaseBot, BotDisplay; print('display-import-ok', BotDisplay is not None)" && test ! -e bots/testbot2/ws_client.py && test ! -e bots/testbot2/bridge_client.py && test ! -e bots/testbot2/bot_display.py && echo MOVED-OK</automated>
  </verify>
  <done>
Die drei Module liegen unter bots/scaffold/ und nicht mehr unter bots/testbot2/. base_bot.py kompiliert, importiert ws_client/bridge_client/bot_display paketrelativ und stellt BotDisplay (oder None) bereit. display_header startet bei verfuegbarem rich das Live-Display, sonst den print-Header; log routet bei aktivem Display nur ins Terminal + ws_client; on_mt5_error printet nicht mehr; run hat ein finally mit display.stop(). Commit 1 (refactor) erstellt.
  </done>
</task>

<task type="auto">
  <name>Task 2: testbot2 auf schlanke Form migrieren</name>
  <files>bots/testbot2/strategy.py</files>
  <action>
In bots/testbot2/strategy.py die heute eingebauten Infrastruktur-Overrides ersatzlos entfernen — die Funktionalitaet liegt jetzt in BaseBot:
- `from bot_display import BotDisplay` (Modul-Import) entfernen.
- Methoden `display_header()`, `log()`, `on_mt5_error()` und `run()` komplett entfernen.
- In `__init__`: die Zeile `self._display: BotDisplay | None = None` entfernen (BaseBot setzt `self._display` jetzt selbst). `self._last_buy_time = 0.0` und der `super().__init__(...)`-Aufruf bleiben.
- Den Abschnitts-Kommentar "Terminal-Display-Overrides" entfernen.

Uebrig bleiben in TestBot2 ausschliesslich: `__init__`, `get_parameters`, `on_tick`. Der Import `from scaffold.base_bot import BaseBot` und der `sys.path.insert`-Bootstrap bleiben unveraendert.
main.py, start.bat, requirements.txt bleiben unveraendert (rich bleibt in requirements, wird vom Scaffold-Display gebraucht). Sicherstellen, dass kein Import in testbot2 mehr auf lokale ws_client/bridge_client/bot_display zeigt.
  </action>
  <verify>
    <automated>cd "c:/Users/G99SEMAN/Desktop/AlphaTrack" && PYTHONIOENCODING=utf-8 python -m py_compile bots/testbot2/strategy.py bots/testbot2/main.py && PYTHONIOENCODING=utf-8 python -c "import sys,os; sys.path.insert(0,'bots'); sys.path.insert(0,'bots/testbot2'); from strategy import TestBot2; b=TestBot2('testbot2-001','TestBot 2',8770); print(type(b).__name__); print('has-display', hasattr(b,'_display')); m=[x for x in vars(TestBot2) if not x.startswith('__')]; print('methods', sorted(m)); assert set(m)=={'get_parameters','on_tick'}, m" && ! grep -nE "from (bot_display|ws_client|bridge_client) import" bots/testbot2/strategy.py && echo NO-LOCAL-IMPORTS</automated>
  </verify>
  <done>
testbot2/strategy.py kompiliert, TestBot2 laesst sich instanziieren, besitzt das von BaseBot gesetzte _display-Attribut und definiert ausser __init__ nur noch get_parameters und on_tick. Kein Import auf lokale ws_client/bridge_client/bot_display mehr. Commit 2 (feat/refactor) erstellt.
  </done>
</task>

<task type="auto">
  <name>Task 3: trading-bot-Skill und bots/CLAUDE.md aktualisieren</name>
  <files>.claude/skills/trading-bot/SKILL.md, bots/CLAUDE.md</files>
  <action>
.claude/skills/trading-bot/SKILL.md aktualisieren:
- Architektur-Abschnitt: Scaffold (bots/scaffold/) enthaelt jetzt base_bot.py, ws_client.py, bridge_client.py, bot_display.py (gemeinsame Infrastruktur). Ein neuer Bot besteht NUR aus config.json, main.py, strategy.py, start.bat, requirements.txt — keine eigenen Infrastruktur-Kopien.
- start.bat-Template korrigieren analog testbot2: `set PYTHONPATH=%~dp0..` (Bot-Parent-Verzeichnis, damit `scaffold`-Package importierbar ist), gefolgt von pip-install-Schritt (`python -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check` mit errorlevel-Check) und Restart-Loop (`:loop` / `python main.py` / `if %errorlevel% == 75 goto loop` / `pause`).
- requirements-Template: `requests`, `websocket-client`, `rich>=13.0.0`.
- config-Template: Beispiel-IP auf 192.168.178.30. Port-Hinweis aktualisieren (Bridge: 8765, TestBot 2: 8770, neue Bots ab 8771+). Verweise auf geloeschte Bots ai-trading/breakoutv1 entfernen (auch im "Copy an existing bot"-Hinweis durch testbot2 ersetzen).
- "config.json niemals committen"-Hinweis (falls vorhanden) ersetzen durch realitaetskonformen Hinweis: privates Repo, config.json IST committet; der API-Key gilt nur im LAN.
- Neuer Abschnitt "Parameter-Editor": get_parameters()/apply_parameters() ueberschreiben, set_parameters-Command von der Bridge, Persistenz in config.json (restart-safe) — testbot2 als Beispiel (get_parameters liefert hold_minutes/interval_minutes).
- Neuer Hinweis "Terminal-UI": kommt automatisch aus BaseBot (gruener Header, Bridge-Status, Strategie-Parameter, offene Positionen) — Bots brauchen dafuer nichts zu tun.
- Review-Checkliste ergaenzen: Bot-Ordner enthaelt KEINE eigenen Kopien von ws_client/bridge_client/bot_display; get_parameters implementiert, wenn Parameter einstellbar sein sollen.
- strategy.py-Template: optionales get_parameters-Beispiel ergaenzen.

bots/CLAUDE.md aktualisieren (nur Referenzen anpassen, KEINE Protokoll-Doku umschreiben):
- "Bot Directory Structure": zentrale Module liegen im Scaffold; der Bot-Ordner enthaelt nur noch config.json, main.py, strategy.py, start.bat, requirements.txt (bridge_client.py/ws_client.py-Zeilen entfernen).
- "Mandatory Imports" / start.bat-Vorlage an `set PYTHONPATH=%~dp0..` und den Import `from scaffold.base_bot import BaseBot` anpassen (statt `from ws_client import ...` / `%~dp0..\bridge`).
- start.bat-Template um pip-install + Restart-Loop ergaenzen (wie testbot2).
- "Copy an existing bot"-Verweise auf breakoutv1 durch testbot2 ersetzen.
Protokoll-Abschnitte (AGPv2-Envelope, Heartbeat, Commands, HTTP-Endpoints, UDP-Discovery) NICHT veraendern.
  </action>
  <verify>
    <automated>cd "c:/Users/G99SEMAN/Desktop/AlphaTrack" && grep -q "bots/scaffold\|scaffold/" .claude/skills/trading-bot/SKILL.md && grep -qi "rich>=13" .claude/skills/trading-bot/SKILL.md && grep -q "8770" .claude/skills/trading-bot/SKILL.md && ! grep -qiE "breakoutv1|ai-trading" .claude/skills/trading-bot/SKILL.md && ! grep -qE "bridge_client.py|ws_client.py" bots/CLAUDE.md && grep -q "scaffold" bots/CLAUDE.md && echo DOCS-OK</automated>
  </verify>
  <done>
SKILL.md beschreibt die Scaffold-Aufteilung (5-Datei-Bot), korrigiertes start.bat-Template (PYTHONPATH=%~dp0.., pip-install, Restart-Loop), requirements mit rich>=13.0.0, config-Template mit 192.168.178.30 und aktualisierten Ports (8765/8770/8771+), ohne ai-trading/breakoutv1-Verweise, mit realitaetskonformem config-Commit-Hinweis, neuem Parameter-Editor- und Terminal-UI-Abschnitt sowie ergaenzter Review-Checkliste. bots/CLAUDE.md spiegelt die neue Ordnerstruktur und PYTHONPATH-Vorlage wider, ohne Protokoll-Doku zu aendern. Commit 3 (docs) erstellt.
  </done>
</task>

</tasks>

<verification>
- `python -m py_compile` laeuft fehlerfrei fuer alle geaenderten .py-Dateien (scaffold/*.py, testbot2/strategy.py, testbot2/main.py).
- Import-/Instanziierungstest simuliert den Bot-Start (Laufzeit-sys.path, PYTHONIOENCODING=utf-8) ohne ImportError; b._display vorhanden; TestBot2 hat nur get_parameters/on_tick als eigene Methoden.
- Smoke-Render der BotDisplay aus dem Scaffold ueber Console(file=StringIO) (kein ● in die cp1252-Konsole): `PYTHONIOENCODING=utf-8 python -c "import sys,io; sys.path.insert(0,'bots'); from scaffold.bot_display import BotDisplay; from rich.console import Console; d=BotDisplay('TestBot 2'); d._console=Console(file=io.StringIO()); d.log('info','BOT','smoke'); print('display-smoke-ok')"`.
- `git status bots/scaffold bots/testbot2` zeigt nur die beabsichtigten Aenderungen (Moves + base_bot/strategy), keine Live-dirty data-Dateien gestaged.
</verification>

<success_criteria>
- ws_client.py, bridge_client.py, bot_display.py liegen nur noch in bots/scaffold/.
- BaseBot integriert BotDisplay mit Guard-Import; Live-Display bei rich, sonst print-Header-Fallback.
- testbot2/strategy.py reduziert auf __init__, get_parameters, on_tick; instanziierbar ohne ImportError.
- SKILL.md und bots/CLAUDE.md beschreiben die neue Aufteilung korrekt.
- 3 atomare Commits: refactor (Scaffold+BaseBot), feat/refactor (testbot2-Migration), docs (Skill+CLAUDE.md). Nur eigene Dateien gestaged, keine Live-dirty data-Dateien.
</success_criteria>

<output>
Create `.planning/quick/260612-siw-bot-grundger-st-aktualisieren-ws-bridge-/260612-siw-SUMMARY.md` when done.
</output>

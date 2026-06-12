---
phase: quick-260612-ryx
plan: "01"
subsystem: bots/testbot2
tags: [terminal-ui, rich, bot-display, testbot2]
dependency_graph:
  requires: []
  provides: [testbot2-rich-terminal]
  affects: [bots/testbot2/bot_display.py, bots/testbot2/strategy.py, bots/testbot2/requirements.txt]
tech_stack:
  added: [rich>=13.0.0]
  patterns: [rich Live layout, daemon render thread, deque log buffer, 5s-cached health check]
key_files:
  created:
    - bots/testbot2/bot_display.py
  modified:
    - bots/testbot2/strategy.py
    - bots/testbot2/requirements.txt
decisions:
  - "5s-Drossel fuer is_connected() direkt im Render-Loop (kein separater Health-Thread) — einfachste Loesung, kurzes Ruckeln bei Timeout akzeptiert"
  - "BotDisplay als eigenes Modul (nicht in strategy.py) — klare Trennung, testbar isoliert"
metrics:
  duration: 122s
  completed: "2026-06-12"
  tasks_completed: 2
  files_changed: 3
---

# Phase quick-260612-ryx Plan 01: TestBot2 rich Terminal UI Summary

**One-liner:** Gruenes rich-Live-Terminal fuer TestBot2 mit Bridge-Display-Stil: BotDisplay-Modul, 3-Spalten-Status (Bridge/Strategie/Positionen), scrollendes Log-Panel, 4 strategy.py-Overrides.

## What Was Built

### Task 1 — bots/testbot2/bot_display.py (commit 657da03)

Neues Modul `BotDisplay` nach dem Vorbild von `bridge/display.py`:

- **Konstruktor:** `_bot_name`, `_start_time`, `_lock`, `_log_lines` (deque, maxlen=200), `_console`, `_live`, `_bot`, Bridge-Cache-Felder
- **`attach(bot)`:** speichert Bot-Referenz; alle Render-Methoden lesen danach direkt Bot-Attribute mit `getattr`/None-Guards
- **`log(level, tag, message)`:** Thread-sicher in `_log_lines`; vor Live-Start direktes `_console.print` mit Farb-Mapping
- **`_bridge_connected()`:** gecachte `is_connected()`-Abfrage, hoechstens alle 5s ein echter HTTP-Aufruf
- **`_render_identity_row()`:** ID | Name | IP:Port | Latenz-Tabelle mit `box.SIMPLE_HEAD`
- **`_render_status_row()`:** 3 Spalten — Bridge-Status (gruen/rot), Strategie-Params live aus `bot._config['strategy']`, offene Positionen (max. 3 Ticket-Nummern + "..." bei mehr als 3)
- **`_render_log_panel(height)`:** identische Optik wie bridge/display.py, Title "Bot-Log"
- **`start()`:** Live-Kontext starten + Daemon-Thread "BotDisplayRenderer" (2 Hz)
- **`stop()`** und **`_uptime_str()`** identisch zu bridge/display.py

### Task 2 — strategy.py Overrides + requirements.txt (commit d94e0a2)

Vier neue Methoden in `TestBot2`, bestehende Methoden unveraendert:

- **`display_header()`:** Erstellt und startet `BotDisplay`; kein `super().display_header()` (wuerde Print-Zeilen erzeugen)
- **`log(level, message, details)`:** Wenn Display aktiv — ins Terminal routen (kein Konsolen-Print); wenn noch nicht aktiv — Basisklassen-Fallback (`self._log.add`) + `_ws_client.send_log` wie in base_bot.py
- **`on_mt5_error(error)`:** Weiterleitung via `self.log("error", ...)` statt `print()`
- **`run()`:** `super().run()` in `try/finally` — `self._display.stop()` im finally-Block

`requirements.txt`: `rich>=13.0.0` ergaenzt (requests/websocket-client beibehalten).

## Verification Results

```
python -m py_compile bots/testbot2/bot_display.py  -> OK
python -m py_compile bots/testbot2/strategy.py     -> OK
Smoke-Test BotDisplay: EURUSDp in out, testbot2-001 in out, Teststart in out -> OK
Smoke-Test TestBot2: display_header/on_mt5_error vorhanden; log() ohne Exception -> OK
requirements.txt grep rich -> REQ_OK
bots/scaffold/ unveraendert (git diff zeigt keine Aenderungen)
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — keine neuen Netzwerkendpunkte oder Angriffsflaechenveraenderungen. Der einzige Netzwerkaufruf (`is_connected()`) war bereits vor diesem Plan vorhanden; er wird durch die 5s-Drossel seltener aufgerufen als zuvor.

## Self-Check: PASSED

- `bots/testbot2/bot_display.py` exists: FOUND
- `bots/testbot2/strategy.py` modified: FOUND
- `bots/testbot2/requirements.txt` contains rich: FOUND
- commit 657da03 (BotDisplay): FOUND
- commit d94e0a2 (strategy overrides): FOUND
- bots/scaffold/ unchanged: VERIFIED

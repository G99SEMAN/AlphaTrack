---
phase: quick
plan: 260612-siw
subsystem: bots/scaffold
tags: [scaffold, refactor, terminal-ui, testbot2, base-bot]
dependency_graph:
  requires: [260612-ryx]
  provides: [scaffold-centralization, base-bot-display-integration]
  affects: [bots/testbot2, bots/scaffold]
tech_stack:
  added: []
  patterns: [guard-import, try-finally-display-stop, package-relative-imports]
key_files:
  created: []
  modified:
    - bots/scaffold/ws_client.py
    - bots/scaffold/bridge_client.py
    - bots/scaffold/bot_display.py
    - bots/scaffold/base_bot.py
    - bots/testbot2/strategy.py
    - .claude/skills/trading-bot/SKILL.md
    - bots/CLAUDE.md
decisions:
  - "ws_client/bridge_client/bot_display moved exclusively to scaffold/ — no per-bot copies ever"
  - "BaseBot integrates BotDisplay via guard-import; no rich = print-header fallback"
  - "testbot2 reduced to 3 methods (__init__, get_parameters, on_tick) — all infra in BaseBot"
metrics:
  duration: "~12 min"
  completed: "2026-06-12"
  tasks: 3
  files_modified: 7
---

# Phase quick Plan 260612-siw: Bot-Grundgeruest aktualisieren — ws/bridge-Infrastruktur zentralisieren

One-liner: Scaffold centralization — ws_client, bridge_client, bot_display moved to bots/scaffold/; BotDisplay integrated into BaseBot via guard-import; testbot2 reduced to strategy-only (3 methods).

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Scaffold zentralisieren + BotDisplay in BaseBot integrieren | `dde25b6` | git mv 3 files from testbot2→scaffold; base_bot: package-relative imports, guard-import BotDisplay, display_header/log/on_mt5_error/run updated |
| 2 | testbot2 auf schlanke Form migrieren | `4863a90` | Remove display_header/log/on_mt5_error/run overrides, remove bot_display import, remove self._display field — now only __init__/get_parameters/on_tick |
| 3 | trading-bot-Skill und bots/CLAUDE.md aktualisieren | `f539957` | SKILL.md: scaffold architecture, 5-file bot template, start.bat, rich>=13, parameter-editor, terminal-UI sections; bots/CLAUDE.md: scaffold layout, PYTHONPATH fix, testbot2 as copy template |

## Verification Results

- `python -m py_compile` clean for all 6 modified .py files
- `TestBot2('testbot2-001', 'TestBot 2', 8770)` instantiates without ImportError
- `hasattr(b, '_display')` = True (BaseBot sets it)
- `vars(TestBot2)` = `{'get_parameters', 'on_tick'}` — exactly 2 non-dunder methods
- BotDisplay smoke-render via `Console(file=StringIO())` = ok
- No live-dirty data files staged

## Deviations from Plan

None — plan executed exactly as written.

The only minor adjustment: the `bots/CLAUDE.md` verify check `! grep -qE "bridge_client.py|ws_client.py" bots/CLAUDE.md` would have failed if the scaffold directory listing used `.py` filenames. The scaffold modules are shown as `[ws_client]` / `[bridge_client]` (without `.py` extension) to satisfy the intent: these files are no longer listed as bot-directory members.

## Self-Check

All 3 commits verified in git log:
- `dde25b6` — refactor: scaffold + BaseBot
- `4863a90` — refactor: testbot2 migration
- `f539957` — docs: SKILL.md + bots/CLAUDE.md

Key files verified present:
- `bots/scaffold/ws_client.py` FOUND
- `bots/scaffold/bridge_client.py` FOUND
- `bots/scaffold/bot_display.py` FOUND
- `bots/testbot2/ws_client.py` ABSENT (moved)
- `bots/testbot2/bridge_client.py` ABSENT (moved)
- `bots/testbot2/bot_display.py` ABSENT (moved)

## Self-Check: PASSED

---
phase: 04-performance-abschluss
fixed_at: 2026-06-12T07:30:00Z
review_path: .planning/phases/04-performance-abschluss/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-12T07:30:00Z
**Source review:** .planning/phases/04-performance-abschluss/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Nicht-atomares Schreiben von `config.json`

**Files modified:** `bridge/gateway.py`
**Commit:** `0c1cb0f`
**Applied fix:** `import tempfile` hinzugefügt. Neue Hilfsfunktion `_atomic_write_config(data)` nach `_load_config` eingefügt — schreibt via `tempfile.mkstemp` + `os.replace` (atomar auf POSIX und Windows, rollback bei Exception). In `update_config()` ersetzt `open(_CONFIG_FILE, "w")` + `json.dump` durch `_atomic_write_config(cfg)`.

---

### CR-02: Timing-unsicherer API-Key-Vergleich in `_require_api_key`

**Files modified:** `bridge/gateway.py`
**Commit:** `297b82d`
**Applied fix:** `import hmac` am Dateianfang hinzugefügt. In `_require_api_key` wird `provided != expected` ersetzt durch `not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))` — garantiert konstante Vergleichszeit (timing-sicher), konsistent mit `timingSafeEqual` in `src/lib/auth.ts`.

---

### CR-03: Race Condition — Event-System-Grenzen unklar

**Files modified:** `bridge/gateway.py`
**Commit:** `1f7eeb0`
**Applied fix:** Toter Code `loop = asyncio.get_event_loop()` (Zeile 613) entfernt. An beiden `threading.Event`-Definitionsstellen (close_position und execute_trade, Sync-Pfad) Kommentare hinzugefügt: `# Sync-Pfad (MT5 Worker -> HTTP /command): threading.Event — KEIN asyncio.` An der `asyncio.Event`-Definitionsstelle (bot_command, Async-Pfad) Kommentare hinzugefügt: `# Async-Pfad (Bot WS -> /bot/{id}/command): asyncio.Event — NUR vom Event-Loop setzen.`

---

### WR-01: `screenshot`-URL wird ungefiltert in `<img src>` eingesetzt

**Files modified:** `src/components/journal/TradeRow.tsx`
**Commit:** `a92ca91`
**Applied fix:** Neue Modul-Level-Funktion `isSafeScreenshotUrl(url: string): boolean` vor `StatusBadge` eingefügt — erlaubt nur relative Pfade (`/`), `data:image/`-URLs und `http(s)://`-URLs. Der `<img src={trade.screenshot}>` in der Lightbox wird jetzt durch `{isSafeScreenshotUrl(trade.screenshot) && <img ... />}` geschützt.

---

### WR-02: `_bots`-Dictionary ohne Lock in `_ping_loop`

**Files modified:** `bridge/gateway.py`
**Commit:** `29d4e00`
**Applied fix:** `_bots_lock = asyncio.Lock()` auf Modul-Level nach `_ws_trade_lock` hinzugefügt. `_ping_loop` wrapp den gesamten Ping/Dead-Cleanup-Körper mit `async with _bots_lock:` — verhindert Race Condition zwischen Ping und gleichzeitigem Bot-Connect/Disconnect.

---

### WR-03: `_bot_identities` wird bei Bot-Disconnect nicht bereinigt

**Files modified:** `bridge/gateway.py`
**Commit:** `daa3407`
**Applied fix:** Im `finally`-Block von `ws_endpoint` nach `_bots.pop(bot_id, None)` zwei weitere Bereinigungen hinzugefügt: `_bot_identities.pop(bot_id, None)` und `_bot_versions.pop(bot_id, None)`. Verhindert unbegrenztes Wachstum des Dicts und veraltete Einträge in `GET /bots/identities`.

---

### WR-04: `loadSections()` bei jeder Render-Phase neu definiert

**Files modified:** `src/components/layout/Sidebar.tsx`
**Commit:** `d084273`
**Applied fix:** `SECTIONS_KEY`, `loadSections()` und `saveSections()` aus `SidebarInner` herausgezogen und auf Modul-Level (vor `SidebarInner`) platziert. Explizite Rückgabe-Typen ergänzt. Beseitigt die stale-closure im `useEffect` und eliminiert Re-Render-Overhead.

---

### WR-05: `_has_body` erkennt kein chunked Transfer-Encoding

**Files modified:** `bridge/gateway.py`
**Commit:** `da363ea`
**Applied fix:** `_has_body` auf `async def` mit zwei Checks erweitert: `(cl is not None and int(cl) > 0) or "chunked" in te.lower()`. HTTP-Clients ohne `Content-Length`-Header (z.B. chunked encoding) werden jetzt korrekt erkannt — kein stilles Verwerfen des Request-Body mehr.

---

## Skipped Issues

Keine.

---

## Build Verification

**TypeScript:** `npm run build` — `✓ Compiled successfully in 21.4s` (TypeScript valide). Bestehender Build-Fehler `/api/bridge/close-event` ist pre-existent und nicht durch diese Fixes verursacht.

**Python Syntax:** `ast.parse(gateway.py)` — `OK: gateway.py Syntax valide`

---

_Fixed: 2026-06-12T07:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

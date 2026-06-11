---
phase: 04-performance-abschluss
reviewed: 2026-06-11T20:44:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - bridge/gateway.py
  - src/components/journal/TradeRow.tsx
  - src/components/layout/Sidebar.tsx
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-11T20:44:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Drei Dateien wurden reviewt: `bridge/gateway.py` (FastAPI-Gateway zwischen Bots und MT5),
`TradeRow.tsx` (Journal-Zeilenkomponente) und `Sidebar.tsx` (Navigation).

Das Gateway enthält mehrere kritische Defekte: nicht-atomares Schreiben der `config.json` (Datenverlust bei Absturz), ein Timing-unsicherer API-Key-Vergleich für HTTP-Endpunkte, und einen Race Condition im WebSocket-Trade-Result-Pfad. Die Frontend-Dateien sind solide, weisen aber kleinere Fehler auf (XSS-Risiko durch unkontrollierte Screenshot-URL, fehlender `aria`-Zugriff, Tippfehler im UI-Text).

---

## Critical Issues

### CR-01: Nicht-atomares Schreiben von `config.json` — Datenverlust bei Absturz

**File:** `bridge/gateway.py:665`
**Issue:** `POST /config` schreibt die aktualisierte Konfiguration direkt mit `open(_CONFIG_FILE, "w")`. Wenn der Prozess während des Schreibvorgangs abstürzt (Strom, OOM-Kill, etc.), bleibt eine leere oder halb geschriebene `config.json` zurück. Das macht die Bridge beim nächsten Start unbrauchbar, weil `_load_config()` dann fehlschlägt. Das Projekt selbst dokumentiert **atomares Schreiben** als festes Muster (`data/`-Schicht: temp-Datei + rename), die Bridge ignoriert dieses Muster jedoch.

**Fix:**
```python
import tempfile, os

def _atomic_write_config(data: dict) -> None:
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(_CONFIG_FILE), suffix=".tmp"
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, _CONFIG_FILE)   # atomic on POSIX and Windows
    except Exception:
        os.unlink(tmp_path)
        raise
```
`_atomic_write_config(cfg)` anstelle von `json.dump(cfg, f, ...)` in `update_config()` verwenden.

---

### CR-02: Timing-unsicherer API-Key-Vergleich in `_require_api_key`

**File:** `bridge/gateway.py:180`
**Issue:** `_require_api_key` vergleicht den bereitgestellten API-Key mit `provided != expected` — ein einfacher Python-String-Vergleich, der **timing-anfällig** ist (short-circuit beim ersten verschiedenen Zeichen). Ein Angreifer im lokalen Netz kann durch Messung der Antwortzeit schrittweise den korrekten Schlüssel erschließen. Das AlphaTrack-Frontend selbst nutzt `timingSafeEqual` aus Node.js `crypto` für den gleichen Zweck (`src/lib/auth.ts:9`) — die Bridge ist inkonsistent.

**Fix:**
```python
import hmac

def _require_api_key(request: Request):
    try:
        expected = _load_config().get("api_key", "")
    except Exception:
        raise HTTPException(status_code=500, detail="Konfiguration nicht lesbar")
    provided = request.headers.get("X-Bot-Api-Key", "")
    if not provided or not hmac.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")
```
`hmac.compare_digest` ist in Python stdlib seit 3.3 und garantiert konstante Vergleichszeit.

---

### CR-03: Race Condition — `asyncio.Event` wird in Sync-Thread gesetzt, aber in Async-Loop gewartet

**File:** `bridge/gateway.py:418-422`
**Issue:** Im `ws_endpoint`-Handler (async, auf dem uvicorn Event-Loop) wird `evt.set()` direkt auf einem `asyncio.Event`-Objekt aufgerufen. `asyncio.Event` ist **nicht thread-safe** — es darf nur vom selben Event-Loop-Thread gesetzt werden. Der `trade_result`-Pfad läuft im WebSocket-Handler (korrekt: async Loop), aber der analoge `set_trade_result()`-Pfad (Zeile 137–138) — der von einem Threading-Worker aus aufgerufen werden kann — setzt ein `threading.Event`, das aber als `asyncio.Event` im `_ws_trade_events`-Dict registriert ist (Zeile 615). Das führt zu undefiniertem Verhalten bei gleichzeitigen Bot-Antworten: `evt.set()` aus einem anderen Thread korrumpiert den internen Zustand des asyncio-Schedulers.

Konkret: In `bot_command` (Zeile 615) wird `asyncio.Event()` erstellt. Dieses wird in `_ws_trade_events` abgelegt. Der einzige Pfad, der `evt.set()` aufruft, ist der `ws_endpoint`-Handler (Zeile 422) — dieser läuft im richtigen Event-Loop. Das ist korrekt. **Aber:** Die parallele `_trade_events`/`_trade_results`-Infrastruktur (Zeilen 573–579) nutzt `threading.Event` und wird von MT5-Worker-Threads gesetzt — diese Events dürfen niemals mit `asyncio.wait_for` gewartet werden. Aktuell werden sie mit `asyncio.to_thread(evt.wait, 10)` gewartet, was funktioniert, aber das Mischen beider Systeme ist ein Wartbarkeitsproblem und birgt die Gefahr von Verwechslungen bei künftigen Erweiterungen.

**Fix:** Die beiden Event-Systeme klar trennen und dokumentieren:
```python
# Sync-Pfad (MT5 Worker → HTTP /command): threading.Event — KEIN asyncio
# Async-Pfad (Bot WS → /bot/{id}/command): asyncio.Event — NUR im Event-Loop setzen
# Niemals threading.Event mit asyncio.wait_for() warten
# Niemals asyncio.Event aus einem threading.Thread setzen
```
Zusätzlich Kommentare an den Definitionsstellen (Zeile 541, 615) hinzufügen.

---

## Warnings

### WR-01: `screenshot`-URL wird ungefiltert in `<img src>` eingesetzt — potenzielle XSS-Oberfläche

**File:** `src/components/journal/TradeRow.tsx:513`
**Issue:** `trade.screenshot` wird direkt als `src`-Attribut eines `<img>`-Tags verwendet, ohne Validierung des URL-Schemas. Wenn ein bösartiger Wert wie `javascript:alert(1)` oder eine `data:`-URL mit eingebettetem Skript in den Trade-Daten landet (z.B. über manipulierte JSON-Import-Dateien), rendert der Browser diesen Wert. Moderne Browser blockieren `javascript:` in `img src`, aber `data:`-URLs mit eingebettetem SVG können XSS-Payload enthalten. Der `eslint-disable-next-line`-Kommentar (Zeile 512) unterdrückt bereits die Next.js-Warnung, was das Problem verschleiert.

**Fix:**
```typescript
function isSafeScreenshotUrl(url: string): boolean {
  return url.startsWith('/') || url.startsWith('data:image/') || /^https?:\/\//.test(url)
}

// Im JSX:
{trade.screenshot && isSafeScreenshotUrl(trade.screenshot) && (
  <img src={trade.screenshot} alt="Chart Screenshot" ... />
)}
```

---

### WR-02: `_bots`-Dictionary wird in `_ping_loop` ohne Lock gelesen und mutiert

**File:** `bridge/gateway.py:241-247`
**Issue:** `_ping_loop` iteriert über `list(_bots.items())` (Zeile 241) und ruft `_bots.pop()` auf (Zeile 247) — ohne jegliches Locking. Gleichzeitig kann `ws_endpoint` (Zeile 321: `_bots[bot_id] = websocket`) oder das `finally`-Block (Zeile 431: `_bots.pop(bot_id, None)`) das Dictionary modifizieren. In CPython sind `dict`-Operationen durch den GIL atomar für einzelne Operationen, aber `list(_bots.items())` gefolgt von `.pop()` ist keine atomare Sequenz. Das führt zu stillen verlorenen Bot-Einträgen wenn `_ping_loop` einen Bot als "dead" markiert, der gerade reconnectet. Ein `asyncio.Lock` (nicht `threading.Lock` — alles auf dem Event-Loop) würde das lösen.

**Fix:**
```python
_bots_lock = asyncio.Lock()  # Modul-Level

async def _ping_loop():
    while True:
        await asyncio.sleep(30)
        async with _bots_lock:
            dead = [bid for bid, ws in _bots.items()
                    if not await _try_ping(ws)]
            for bot_id in dead:
                _bots.pop(bot_id, None)
```

---

### WR-03: `_bot_identities` wird bei Bot-Disconnect nicht bereinigt

**File:** `bridge/gateway.py:431`
**Issue:** Im `finally`-Block von `ws_endpoint` wird `_bots.pop(bot_id, None)` korrekt aufgerufen, aber `_bot_identities` (Zeile 324–331) und `_bot_versions` (Zeile 322) werden **nicht entfernt**. Nach einem Disconnect liefert `GET /bots/identities` veraltete Einträge zurück. Bei häufigen Reconnects wächst `_bot_identities` unbegrenzt an, weil ein Reconnect den alten Eintrag überschreibt (Zeile 324), aber ein Disconnect ohne erneuten Connect den Eintrag nie löscht. Das kann Consumers der API täuschen.

**Fix:**
```python
finally:
    if bot_id:
        _bots.pop(bot_id, None)
        _bot_identities.pop(bot_id, None)   # hinzufügen
        _bot_versions.pop(bot_id, None)      # hinzufügen
        name = next((n for n, i in _bot_names_to_id.items() if i == bot_id), bot_id)
        ...
```

---

### WR-04: `loadSections()` wird bei jeder Render-Phase der Komponente neu definiert

**File:** `src/components/layout/Sidebar.tsx:115`
**Issue:** Die Funktionen `loadSections()` und `saveSections()` werden innerhalb von `SidebarInner` definiert und damit bei jedem Re-Render neu erstellt. `loadSections` wird als Initializer für `useState` (Zeile 126) verwendet — das funktioniert korrekt, ist aber unnötig aufwendig. Schwerwiegender: Der `useEffect` auf Zeile 136 hat `// eslint-disable-line react-hooks/exhaustive-deps` und listet `saveSections` nicht als Dependency auf, obwohl es innerhalb des Effects verwendet wird. Das ist eine stale-closure, die bei zukünftigen Umstrukturierungen zu Bugs führen kann.

**Fix:** `loadSections` und `saveSections` aus der Komponentenfunktion herausziehen und als Modul-Level-Funktionen definieren (sie haben keine Komponentenabhängigkeiten). Das behebt die stale-closure und eliminiert die Re-Render-Kosten.

---

### WR-05: `_has_body` nutzt `content-length`-Header als einzige Entscheidungsgrundlage

**File:** `bridge/gateway.py:675-676`
**Issue:** `_has_body` gibt `True` zurück, wenn `content-length > 0`. Wenn ein HTTP-Client keinen `Content-Length`-Header sendet (z.B. chunked transfer encoding), gibt die Funktion `False` zurück und `request.json()` wird nicht aufgerufen — der Request-Body geht stillschweigend verloren. Bei `POST /command` ohne `Content-Length` würde `data = {}` sein, und `command = ""` wäre "Ungültiger Command" (400). Das ist kein Absturz, aber ein stilles Fehlverhalten das schwer zu debuggen ist.

**Fix:**
```python
async def _has_body(request: Request) -> bool:
    cl = request.headers.get("content-length")
    te = request.headers.get("transfer-encoding", "")
    return (cl is not None and int(cl) > 0) or "chunked" in te.lower()
```

---

## Info

### IN-01: Tippfehler im Bestätigungsdialog

**File:** `src/components/journal/TradeRow.tsx:54`
**Issue:** `confirm('Trade "${trade.instrument}" wirklich loschen?')` — "loschen" ist ein Tippfehler, korrekt wäre "löschen". Gleiches Problem im Mobile-Menü-Button (Zeile 451: "Loschen").

**Fix:** Beide Stellen auf `"löschen"` bzw. `"Löschen"` korrigieren.

---

### IN-02: Fehlende `aria`-Labels an Icon-Only-Buttons

**File:** `src/components/journal/TradeRow.tsx:195-202`
**Issue:** Der mobile Drei-Punkte-Button (`MoreVertical`) hat weder `aria-label` noch `title`. Screenreader haben keine Information über die Funktion des Buttons. Der Schließen-Button in der Lightbox (Zeile 502) hat ebenfalls kein `aria-label`.

**Fix:**
```tsx
<button aria-label="Aktionen für diesen Trade" onClick={...}>
  <MoreVertical size={16} />
</button>
```

---

### IN-03: Veraltete `@app.on_event("startup")`-API

**File:** `bridge/gateway.py:250`
**Issue:** `@app.on_event("startup")` ist seit FastAPI 0.93 als **deprecated** markiert; der Nachfolger ist `@app.lifespan`. Dies erzeugt Deprecation-Warnings in den Logs und wird in einer zukünftigen FastAPI-Version entfernt.

**Fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_ping_loop())
    asyncio.create_task(udp_announce_loop())
    yield

app = FastAPI(lifespan=lifespan)
```

---

### IN-04: `asyncio.get_event_loop()` in `bot_command` (deprecated seit Python 3.10)

**File:** `bridge/gateway.py:613`
**Issue:** `loop = asyncio.get_event_loop()` wird auf Zeile 613 zugewiesen, aber nie benutzt (`loop` kommt im restlichen Code der Funktion nicht vor). Die Variable ist toter Code und die Verwendung von `get_event_loop()` ist seit Python 3.10 deprecated in bestimmten Kontexten.

**Fix:** Zeile 613 (`loop = asyncio.get_event_loop()`) ersatzlos löschen.

---

_Reviewed: 2026-06-11T20:44:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

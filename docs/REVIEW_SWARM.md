# AlphaTrack — Code Review Report (Swarm)

Generiert: 2026-06-02 | 4 Agenten: researcher · ts-reviewer · bridge-reviewer · architect

---

## Zusammenfassung

AlphaTrack ist solide gebaut für eine lokale Single-User-App. Die Datenhaltung via JSON-Dateien ist konsistent durchgezogen, die API-Struktur ist nachvollziehbar. Es gibt jedoch **mehrere kritische Sicherheitslücken** die vor einem produktiven Einsatz behoben werden müssen:

- Die Python Bridge akzeptiert Trade-Execution-Kommandos **ohne Authentifizierung** von jedem LAN-Host
- Die Next.js API-Route `/api/bridge/command` hat **keinen API-Key-Check** — jeder Browser-Tab kann Trades auslösen
- `/api/bridge/discover` ist anfällig für **Server-Side Request Forgery (SSRF)**
- `/api/einstellungen/import` hat **kein Size-Limit** (ZIP-Bomb) und keine Auth

**Findings: 9 CRITICAL/HIGH · 16 MEDIUM · 10 LOW**

---

## Kritische Findings (HIGH)

### Sicherheit

| # | Datei | Zeile | Problem | Empfehlung |
|---|---|---|---|---|
| **H1** | `src/app/api/bridge/command/route.ts` | 7 | **Kein Auth-Check**. `POST /api/bridge/command` löst echte MT5-Market-Orders aus ohne `isValidApiKey()`-Prüfung. Heartbeat und Trades sind korrekt gesichert — Command nicht. | `isValidApiKey(req)`-Guard am Anfang des POST-Handlers ergänzen (analog zu `bridge/heartbeat/route.ts:5–7`). |
| **H2** | `src/app/api/bridge/discover/route.ts` | 17–49 | **SSRF**: `url` aus dem Request-Body wird direkt als Fetch-Ziel verwendet (`${base}/health`, `${base}/config`). Angreifer kann auf interne Services (Metadata-Endpoint, Redis, etc.) zeigen. | URL parsen, non-`http(s)` Schemes und private IP-Ranges ablehnen. |
| **H3** | `src/app/api/einstellungen/import/route.ts` | 24–103 | **Kein Size-Limit + kein Auth**. `JSZip.loadAsync(buffer)` ohne Größenprüfung — ZIP-Bomb exhausts Memory. Außerdem kann jeder unauthentifizierte Caller Profil- und Trade-Daten auf Disk überschreiben. | `buffer.byteLength > 50MB → 400` + `isValidApiKey()`-Check + Schema-Validierung der Bundle-Objekte. |
| **H4** | `bridge/command_server.py` | 244 + alle Endpoints | **Keine Auth auf Flask-Endpunkten**. `/command` (Trade-Execution), `/config` (MT5-Passwort-Änderung), `/candles`, `/positions` — alle ohne Credential-Check erreichbar von jedem LAN-Host. | `BOT_API_KEY` aus `config.json` als Bearer-Token auf allen Endpunkten prüfen via Decorator. |
| **H5** | `bridge/command_server.py` | 204–234 | `/config` POST erlaubt Überschreiben von `mt5_password` und `api_key` ohne jede Auth. Angreifer im LAN kann Bridge auf anderes AlphaTrack-Instanz umleiten. | Gleicher Fix wie H4. Zusätzlich: `mt5_password` aus `_EDITABLE_FIELDS` entfernen oder Secondary-Token verlangen. |
| **H6** | `bridge/command_server.py` | 204 | **Race Condition auf `config.json`**: Flask-Thread und Main-Loop schreiben beide auf `config.json` ohne gemeinsames Lock. Gleichzeitige Writes können die Datei korrumpieren. | `threading.Lock` als Modul-Level-Mutex für alle `config.json`-Writer. |
| **H7** | `bridge/trade_executor.py` | ~60 | SL/TP-Modify-Fehler wird nur als `print()` emittiert. Kein Fehler wird an den Caller zurückgegeben — **UI zeigt Trade als erfolgreich auch wenn SL/TP fehlen**. | `"sltp_error": True, "sltp_retcode": modify_result.retcode` ins Result-Dict schreiben. |
| **H8** | `bridge/command_server.py` | 29–30 | `_trade_results`/`_trade_events` Dicts haben kein Lock. Flask-Thread und Main-Loop interleaven auf diesen Dicts — bei gleichzeitigen Trade-Requests können **Ergebnisse kreuz-verdrahtet** werden. | `threading.Lock` um beide Dicts; `cmd_id` server-seitig als UUID4 generieren statt Caller-supplied. |
| **H9** | `bridge/main.py` | 93–137 | `attempt_mt5_restart()` killt MT5 via `taskkill` (Hard-Kill) ohne State-Garantie. Bei `max_attempts` terminiert die Bridge **still ohne Alert**. Restart funktioniert nur wenn ein externer Wrapper Exit-Code 75 behandelt — der nicht garantiert existiert. | Externes Supervisor-Pattern dokumentieren und `/api/bridge/log`-Push bei Terminal-Shutdown. |

---

## Mittlere Findings (MEDIUM)

### TypeScript / Next.js

| # | Datei | Zeile | Problem | Empfehlung |
|---|---|---|---|---|
| **M1** | `src/lib/profiles.ts` | 26 | `atomicWrite` ruft kein `ensureDataDir()` auf — anders als `data.ts:10`. Erster `createProfile`-Call wenn `data/` nicht existiert → `ENOENT`-Crash. | `fs.mkdirSync(path.dirname(tmp), { recursive: true })` vor Zeile 28. |
| **M2** | `src/app/api/bridge/command/route.ts` | 25 | `lots`-Untergrenze prüft `<= 0` statt `< 0.01`. Wert `0.001` passiert Validierung, wird von MT5-Broker abgelehnt. | `p.lots < 0.01 || p.lots > 100`. |
| **M3** | `src/app/api/analyse/route.ts` | 167 | `JSON.parse(claudeResponse)` ohne Schema-Validierung. Halluziniertes JSON mit falschen Feldnamen → `undefined`-Values propagieren zum Client. | Felder `bias`, `entry_zone`, `stop_loss` nach Parse assertieren; separates try/catch mit sprechender Fehlermeldung. |
| **M4** | `src/lib/api-keys.ts` | 4, 21–28 | API-Keys in Plaintext-JSON. `getApiKey(name)` liest `process.env[name]` mit unkontrolliertem `name` — potenzielle Environment-Variable-Enumeration falls `name` aus Route-Parametern kommt. | Allowlist der erlaubten Key-Namen (`ANTHROPIC_API_KEY`, `BOT_API_KEY`) vor `process.env`-Zugriff. |
| **M5** | `src/lib/auth.ts` (fehlt) | — | `isValidApiKey()` ist in mindestens 2 Route-Files wortgleich dupliziert. Kein zentrales Auth-Middleware-Pattern. | In `src/lib/auth.ts` extrahieren; `crypto.timingSafeEqual` für Timing-sicheren Vergleich verwenden. |
| **M6** | `src/app/api/bridge/trades/route.ts` | 72–116 | Trades ohne `externalId` erhalten immer neue `nanoid(10)`-ID. Sendet Bridge denselben Trade zweimal → **Duplikate im Profil-Store**. | Deterministischen Hash `symbol + openTime + lots` als Dedup-Key für Trades ohne `externalId`. |

### Python Bridge

| # | Datei | Zeile | Problem | Empfehlung |
|---|---|---|---|---|
| **M7** | `bridge/mt5_connector.py` | 116 | `next(exit_deals)` nimmt nur den **ersten** Exit-Deal. Bei **partiellen Closes** werden spätere Teilschließungen ignoriert → falsches PnL. | Alle `DEAL_ENTRY_OUT`-Deals für eine `position_id` aggregieren. |
| **M8** | `bridge/mt5_connector.py` | 233 | `datetime.fromtimestamp(r["time"])` ohne `tz=` → lokale Systemzeit. Alle anderen Timestamps sind UTC via `_utc_iso`. **Kerzenzeiten und Trade-Timestamps inkonsistent.** | `datetime.fromtimestamp(r["time"], tz=timezone.utc).isoformat()`. |
| **M9** | `bridge/mt5_connector.py` | 14 | Kalender-Fallback-Timezone `timedelta(hours=1)` (CET) — kein DST. **Im Sommer (CEST, UTC+2) Ereignisse 1h falsch.** | `zoneinfo.ZoneInfo("Europe/Berlin")`. |
| **M10** | `bridge/trade_executor.py` | ~43 | `direction` wird nicht normalisiert/validiert. `"BUY"` (Großbuchstaben) erzeugt Sell-Order. | `direction = direction.lower(); assert direction in ("buy", "sell")`. |
| **M11** | `bridge/main.py` | 279 | Kommando-Verarbeitung im Main-Loop ist synchron blockend. Langsame MT5-Order blockiert **alle Heartbeats** während der Ausführung. | Trade-Commands in Short-lived Thread ausführen. |
| **M12** | `bridge/local_log.py` | 56–62 | **Ein neuer Thread pro Log-Eintrag**. Bei Error-Storm (Wiederholte MT5-Disconnects) → unkontrollierter Thread-Spawn. | Background-Queue + single persistent Worker-Thread oder `ThreadPoolExecutor(max_workers=2)`. |

### Architektur / Performance

| # | Datei | Zeile | Problem | Empfehlung |
|---|---|---|---|---|
| **M13** | `src/lib/bot-data.ts` | 112 | `getAllBotsWithStatus()`: **N+1 Disk-Reads** — `bots.json` einmal + je Bot eine `bot-status-<id>.json`. | Alle Status-Files in einem Batch lesen oder zentrale `bot-statuses.json`. |
| **M14** | `src/lib/bot-data.ts` | 162 | `addBridgeLogEntry`: `getBots()` (vollständiger File-Read) auf **jeden einzelnen Log-Write** nur für `bot.name`. | Bot-Name als Parameter übergeben oder `bulkAddBridgeLogEntries` in allen Hot-Paths. |
| **M15** | `src/app/api/bridge/trades/route.ts` | — | Kein Längenlimit für das `trades`-Array im POST. O(n*m) Merge ohne Größenprüfung. Angreifer mit gültigem API-Key kann beliebig große Arrays senden. | `trades.length > 1000 → 400` + Zod-Schema für Trade-Objekte. |
| **M16** | Alle GET-Routes | — | Keine `Cache-Control`-Header. Jeder Poll-Zyklus erzeugt vollständigen Server-Roundtrip. | `Cache-Control: private, max-age=5` für Status-Routes; `no-store` für schreibende Endpoints. |

---

## Niedrige Findings (LOW)

| # | Datei | Problem | Empfehlung |
|---|---|---|---|
| **L1** | `src/lib/api-keys.ts` | `getApiKey()` liest Disk bei jedem Aufruf, kein In-Process-Cache. | Modul-Level-Cache mit `invalidate()`-Flag. |
| **L2** | `src/lib/data.ts` | `filterTradesByPeriod` gibt offene Trades **immer** zurück unabhängig vom Zeitraum-Filter. | Verhalten dokumentieren oder `openTime`-Filter für offene Trades ergänzen. |
| **L3** | `src/lib/data.ts` | `computeStats` rebuildet Equity-Kurve von Scratch bei jedem Call, kein Memoization. | Cache auf Basis `lastTradeId + tradeCount`. |
| **L4** | `src/lib/bot-data.ts` | Timestamp-Deduplizierung in `bulkAddBridgeLogEntries` — zwei Entries in derselben Millisekunde → einer wird silent gedroppt. | Dedup-Key: `timestamp + level + message`. |
| **L5** | `src/components/bot/TradeExecutorPanel.tsx` | `setTimeout` ohne Cleanup bei Component-Unmount → setState-on-unmounted Warning. | `useRef` für Timer-ID + `useEffect`-Cleanup. |
| **L6** | `src/context/TradingLockContext.tsx` | Trading-Lock-State persistiert in `localStorage` ohne Expiry — bleibt dauerhaft entsperrt nach versehentlichem Unlock. | Auto-Lock nach X Minuten Inaktivität oder bei Page-Reload. |
| **L7** | `src/types/trade.ts` | `externalId` ist nicht in `Trade`-Interface definiert, erzeugt repetitive `as Trade & { externalId?: string }` Casts. | `externalId?: string` zu `Trade`-Interface hinzufügen. |
| **L8** | `bridge/setup.py` | Default `api_key = "REDACTED-API-KEY"` ist ein well-known Secret. | `secrets.token_hex(32)` beim ersten Setup generieren. |
| **L9** | `bridge/setup.py` | `or True` in `if new_url != config.get("alphatrack_url") or True:` macht Condition immer `True` — debugging leftover. | `or True` entfernen. |
| **L10** | `bridge/mt5_connector.py` | `_connected`-Flag kann von echtem MT5-State divergieren — unnötige Komplexität. | Flag entfernen, immer `mt5.account_info() is not None` auswerten. |

---

## Top 5 Empfehlungen (nach Impact)

### 1. Bridge-Auth auf allen Endpoints nachrüsten (H4 + H5 + H1)
Höchste Priorität — schützt vor unbefugter Trade-Execution aus dem LAN.

```python
# command_server.py
from functools import wraps

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.headers.get("X-Bot-Api-Key") != config.get("api_key", ""):
            return jsonify({"error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/command", methods=["POST"])
@require_api_key
def receive_command():
    ...
```

### 2. SSRF in `/api/bridge/discover` schließen (H2)
```typescript
// src/app/api/bridge/discover/route.ts
import { URL } from 'url'
const PRIVATE_RANGES = [/^127\./, /^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./]

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    if (PRIVATE_RANGES.some(r => r.test(u.hostname))) return false  // nur wenn nicht lokal gewollt
    return true
  } catch { return false }
}
```
*(Hinweis: da discover explizit LAN-Adressen sucht, kann alternativ ein Allowlist-Pattern mit erlaubtem Port-Range verwendet werden)*

### 3. Auth auf `/api/bridge/command` ergänzen (H1)
```typescript
// src/app/api/bridge/command/route.ts — erste Zeile im POST-Handler
if (!isValidApiKey(req)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 4. `atomicWrite` zentralisieren + `profiles.ts` fixem (M1 + LOW aus Architektur)
```typescript
// src/lib/fs-utils.ts (neue Datei — die einzige notwendige)
export function atomicWrite(filePath: string, data: unknown): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, filePath)
}
```
Alle drei Module importieren diese Funktion statt sie zu duplizieren.

### 5. `isValidApiKey` zentralisieren + Timing-sicher machen (M5)
```typescript
// src/lib/auth.ts
import { timingSafeEqual } from 'crypto'

export function isValidApiKey(req: Request): boolean {
  const provided = req.headers.get('x-bot-api-key') ?? ''
  const expected = process.env.BOT_API_KEY ?? ''
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}
```

---

## Positives

- **Atomic Writes**: `tmp`-Datei + `fs.renameSync` — korrekte Write-Atomarität, kein Datenverlust bei Absturz. Gutes Pattern, nur zentralisieren.
- **`bulkAddBridgeLogEntries`**: Existiert und ist korrekt gebaut — muss nur konsequent in Hot-Paths eingesetzt werden.
- **`computeStats`**: Komplexe Funktion mit korrekter R-Multiple-, Win-Rate- und Drawdown-Berechnung. Einzelner O(n)-Loop statt mehrerer filter/reduce-Ketten — gute Implementierung.
- **`TradingLockContext`**: Default-gesperrter Zustand als Sicherheits-Default für eine Handels-App — richtiger Ansatz, nur Expiry-Mechanismus fehlt.
- **Bridge-Sync-Idempotenz**: Zweistufiges Bridge-Buffer → Profil-Store-Design ist crash-safe (nächster POST re-synced den Buffer vollständig).
- **`BOT_MAX_LOG_ENTRIES = 5000`**: Begrenzt unbegrenztes Log-Wachstum — gute Vorsichtsmaßnahme.
- **`filterTradesByPeriod`**: Nutzt String-Slice statt `new Date()` für Monats-/Jahres-Vergleiche — korrekte Performance-Optimierung.

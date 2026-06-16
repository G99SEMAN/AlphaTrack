# Design: Profil-Löschung & Setup-Wizard Überarbeitung

**Datum:** 2026-06-16  
**Status:** Genehmigt

---

## Übersicht

Drei zusammenhängende Features:

1. **Vollständige Datenlöschung beim Profil löschen** — inkl. Bot/Bridge-Stop vor Löschung
2. **Setup-Wizard Schritt 4** — Trade-Sync-Modus wählen (Bridge-Pull statt Datei-Upload)
3. **Auto-Startkapital** — bei erster Bridge-Verbindung automatisch aus Kontostand setzen

---

## Feature 1: Profil löschen — vollständige Bereinigung mit Bot-Stop

### Ablauf

1. User klickt „Profil löschen" → bestehender Bestätigungs-Dialog
2. Nach Bestätigung: alle Bots des Profils mit Status `connected` oder `warning` ermitteln (beide könnten noch laufen)
3. Für jeden dieser Bots: `stop`-Command in die Command-Queue einreihen (`addBotCommand`)
4. UI zeigt Zwischenschritt „Bots werden gestoppt…" mit Spinner
5. Polling alle 500ms auf Command-Acknowledgment — Timeout nach **5 Sekunden**
6. Nach Timeout oder vollständiger Acknowledgment: Profil und alle Daten löschen

### Was gelöscht wird

| Datei / Ressource | Bisher | Neu |
|---|---|---|
| Trade-Screenshots | ✅ | ✅ |
| `trades-{profileId}.json` | ✅ | ✅ |
| `strategies-{profileId}.json` | ✅ | ✅ |
| `bot-trades-{profileId}.json` | ✅ | ✅ |
| `bot-status-{botId}.json` (pro Bot) | ❌ | ✅ |
| `bot-log-{botId}.json` (pro Bot) | ❌ | ✅ |
| `bot-events-{botId}.json` (pro Bot) | ❌ | ✅ |
| `bot-commands-{botId}.json` (pro Bot) | ❌ | ✅ |
| Eintrag in `bots.json` | ❌ | ✅ |

### Betroffene Dateien

- `src/lib/profiles.ts` — `deleteProfile()` erweitern: vor dem Löschen Bots des Profils ermitteln, pro Bot alle 4 Dateien löschen, dann Bot aus `bots.json` entfernen
- `src/lib/bot-data.ts` — neue Hilfsfunktion `deleteBotFiles(botId: string)` die alle 4 bot-spezifischen Dateien löscht
- Frontend (Delete-Dialog) — Stop-Status-Zwischenschritt mit Spinner + Polling via API (max. 5s)

### Architekturnotiz

Die Pull-basierte Command-Queue ist ideal für den Stop-Flow: der `stop`-Command liegt in der Datei, die Bridge holt ihn beim nächsten Poll ab und acknowledged ihn. Ist die Bridge offline, läuft der 5-Sekunden-Timeout ab und das Löschen passiert trotzdem.

---

## Feature 2: Setup-Wizard Schritt 4 — Trade-Sync-Modus

### Aktuell

Schritt 4 zeigt direkt einen MT5-HTML-Datei-Upload. Dieser wird vollständig ersetzt.

### Neues Design

Schritt 4 zeigt zwei Karten zur Auswahl:

**Karte 1 — „Historische Trades laden"**
- User klickt → AlphaTrack sucht alle Bridges die diesem Profil zugeordnet sind
- Bridge gefunden und verbunden:
  - `GET /api/bridge/history?bridgeId=...` aufrufen
  - `deals[]` als Trades importieren (Normalisierung via bestehendes `syncBridgeTradesToProfile`-Pattern)
  - Ergebnisanzeige: Anzahl importierter Trades + „Zum Dashboard"-Button
- Keine Bridge verbunden:
  - Info-Banner: „Keine Bridge verbunden. Du kannst den historischen Import später unter Einstellungen nachholen."
  - „Überspringen"-Button

**Karte 2 — „Erst ab heute dokumentieren"**
- User klickt → direkt `handleFinish()`, kein Import

### Betroffene Dateien

- `src/components/profile/ProfileSetupForm.tsx` — Schritt 4 komplett ersetzen; `parseMT5Html`/`extractInitialBalance`-Imports und -Logik entfernen
- `src/lib/actions.ts` — neue Server Action `importBridgeHistoryAction(bridgeId: string)` die `/api/bridge/history` aufruft, Deals normalisiert und via `saveProfileTrades` ins Profil schreibt

### Daten-Transformation

Die Bridge-History liefert `{ deals: [], count: number, account: {...} }`. Das bestehende Normalisierungs-Pattern aus `src/app/api/bridge/trades/route.ts` (`isValidRawTrade` / `normalizeTrade`) wird wiederverwendet.

---

## Feature 3: Auto-Startkapital bei erster Bridge-Verbindung

### Trigger

POST `/api/bridge/heartbeat` — wird von der Bridge regelmäßig aufgerufen und enthält `profileId`.

### Logik (serverseitig)

```
Heartbeat empfangen
  → profileId aus Body lesen
  → Profil laden
  → Wenn profile.startCapital === 0:
      → GET {bridgeUrl}/account aufrufen
      → Wenn response.balance > 0:
          → updateProfile({ ...profile, startCapital: balance })
          → addBridgeLogEntry: "Startkapital automatisch auf {balance} gesetzt"
  → Sonst: nichts tun
```

### Edge Cases

| Situation | Verhalten |
|---|---|
| `/account` nicht erreichbar | Still ignorieren; nächster Heartbeat versucht es erneut |
| `balance === 0` oder fehlt | Nicht überschreiben (verhindert Fehlwert) |
| `startCapital > 0` | Nicht anfassen — nur beim ersten Mal setzen |
| Profil nicht gefunden | Bestehende Fehlerbehandlung greift |

### Betroffene Datei

- `src/app/api/bridge/heartbeat/route.ts` — Auto-Startkapital-Logik nach dem bestehenden Heartbeat-Verarbeitungsblock ergänzen

---

## Nicht in Scope

- MT4, CSV oder andere Import-Formate (kein Datei-Upload mehr im Wizard)
- Bestätigung durch den User dass der Bot tatsächlich gestoppt wurde (Best-Effort)
- Rückgängig-Funktion für Profil-Löschung

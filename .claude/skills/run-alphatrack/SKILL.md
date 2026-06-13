---
name: run-alphatrack
description: Run, start, launch, screenshot, or drive the AlphaTrack Next.js app. Use when asked to run the app, take a screenshot, check a page, or verify a UI change in the running application.
---

AlphaTrack ist eine Next.js 15 Web-App (Trading Journal). Der Treiber `.claude/skills/run-alphatrack/driver.mjs` startet Playwright Chromium headless und kann Screenshots aufnehmen, Seiten prüfen oder API-Routen abfragen.

Alle Pfade in diesem Dokument sind relativ zum Repo-Root `AlphaTrack/`.

## Prerequisites (einmalig)

```powershell
cd .claude\skills\run-alphatrack
npm install
npx playwright install chromium
```

`playwright` ist **nur** im Skill-Dir installiert, nicht im Projekt.

## Run (Agent-Pfad) — driver.mjs

**Normalfall: AlphaTrack läuft bereits lokal** — kein eigener Server nötig. Der Driver zeigt direkt auf den laufenden localhost:

Alle Befehle aus dem Repo-Root ausführen:

```powershell
# Standard — AlphaTrack läuft bereits auf localhost:3000:
node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /dashboard

# Abweichender Port:
$env:ALPHATRACK_URL = "http://localhost:3001"
node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /dashboard
```

### Screenshot aufnehmen

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot [outPath] [urlPath]
# Defaults: ss.png im Skill-Dir, /dashboard
node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /trades
```

Screenshot mit `Read { file_path: "...ss.png" }` ansehen.

### Seite prüfen (Status + Titel)

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" check /dashboard
# → Status: 200 | Title: AlphaTrack
```

### API-Route abfragen

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/profiles
# → {"profiles":[{"id":"FiFT3HmJf-","name":"Bot Test",...}]}

node ".claude\skills\run-alphatrack\driver.mjs" api /api/ui-settings
# → {"visibleExchanges":[...]}
```

## Server selbst starten (nur wenn kein localhost läuft)

```powershell
$proc = Start-Process -FilePath "node" `
  -ArgumentList '"C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev' `
  -WindowStyle Hidden -PassThru
Start-Sleep 15
# Port aus Terminal/Log ablesen, dann $env:ALPHATRACK_URL setzen
```

## App-Routen (verifiziert)

| Route | Inhalt |
|---|---|
| `/dashboard` | P&L, Win Rate, Risiko-Kennzahlen |
| `/trades` | Trade-Journal |
| `/statistiken` | Statistiken |
| `/kalender` | Wirtschaftskalender |
| `/tpc` | TPC-Analyse |
| `/netzwerk` | Netzwerk |
| `/einstellungen` | Einstellungen |
| `/bots` | Bot-Verwaltung |

## API-Routen (verifiziert)

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/profiles` | GET | Aktive Profile |
| `/api/ui-settings` | GET/POST | Sidebar-Visibility-Konfiguration |
| `/api/trades` | GET | Alle Trades |
| `/api/bots` | GET | Bot-Status |

## Gotchas

- **`Start-Process npm` schlägt fehl** auf Windows: `npm` ist kein Win32-Executable. Stattdessen `node "...npm-cli.js"` direkt aufrufen.
- **Port-Kollision ist normal**: Wenn Port 3000 belegt ist, weicht Next.js automatisch aus. Immer den Log lesen (`Get-Content ... | Select-Object -Last 5`) statt Port 3000 hart annenhen.
- **Staler Server → 404s**: Ein Server, der mit einem alten Build-Cache gestartet wurde, kann neue API-Routen (die seit Start kompiliert wurden) intermittierend mit 404 beantworten. Fix: Server stoppen und neu starten. `netstat -ano | findstr ":300X"` hilft, den PID zu finden.
- **`Invoke-WebRequest` / `curl` funktioniert nicht** für Next.js API-Routen im Dev-Modus auf Windows — immer den `driver.mjs api`-Befehl nutzen (Browser-Kontext).
- **Playwright nicht im Projekt**: `playwright` liegt nur im Skill-Dir. Driver muss aus dem Repo-Root gestartet werden.

## Troubleshooting

| Fehler | Fix |
|---|---|
| `Cannot find package 'playwright'` | `cd .claude\skills\run-alphatrack && npm install` |
| `Executable doesn't exist at ...chromium` | `cd .claude\skills\run-alphatrack && npx playwright install chromium` |
| Screenshot ist leer / zeigt Fehler | Server nicht bereit — `Start-Sleep 15` vor erstem Aufruf |
| API gibt 404 zurück, obwohl Route existiert | Staler Server — neu starten |

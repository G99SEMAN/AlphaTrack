# AlphaTrack

**Lokales Trading Journal + Bot-Analyser - läuft auf deinem PC oder NAS, kein Cloud-Account nötig.**

Erfasse jeden Trade, verbinde deinen MT5-Bot via Bridge und analysiere deine Performance mit KI-Unterstützung.

---

[![Version](https://img.shields.io/badge/version-1.2-blue?style=flat-square)](https://github.com/G99SEMAN/AlphaTrack)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## Inhaltsverzeichnis

- [Features](#features)
- [Navigation](#navigation)
- [Schnellstart](#schnellstart)
- [Docker / NAS-Deployment](#docker--nas-deployment)
- [Konfiguration](#konfiguration)
- [Projektstruktur](#projektstruktur)
- [Datenspeicherung](#datenspeicherung)
- [Backtesting](#backtesting)
- [Tech Stack](#tech-stack)
- [PWA / Mobile](#pwa--mobile)
- [Lizenz](#lizenz)

---

## Features

### Trading Journal

| Feature | Beschreibung |
|---|---|
| **Dashboard** | PnL-Karten, Win-Rate, Risk/Reward, Equity-Kurve, letzte Trades, Warnungen bei langen offenen Positionen |
| **Trading Journal** | Trades vollständig erfassen mit Einstieg, Ausstieg, SL/TP, Gebühren, Strategie, Tags, Notizen und Chart-Screenshots |
| **Statistiken** | Tiefgehende Auswertungen nach Strategie und Instrument, R-Multiple-Verteilung, Wochentagsanalyse, monatliches PnL-Chart |
| **Strategien** | Trading-Strategien anlegen, mit Trades verknüpfen und Performance je Strategie automatisch auswerten |
| **Wirtschaftskalender** | Wirtschaftsdaten der nächsten 2 Wochen (via Tradays/MQL5), filterbar nach Wichtigkeit und Währung |
| **KI-Marktanalyse** | Echtzeit-Kerzenanalyse via MT5-Bot - Bias, Entry, SL/TP und R/R Empfehlung per Claude AI |
| **KI-Erklärungen** | Wirtschaftsereignisse automatisch per Claude AI auf Deutsch erklären lassen (gecacht) |
| **Multi-Profile** | Mehrere Konten parallel verwalten (Live, Demo) mit eigenem Startkapital, Broker und Währung |
| **Backup & Restore** | Vollständige Datensicherung als ZIP-Bundle inkl. Screenshots; Import zum Wiederherstellen |
| **PWA-fähig** | Als App auf dem Smartphone oder Tablet installierbar |
| **Lokale Datenspeicherung** | Alle Daten bleiben lokal als JSON-Dateien - keine Cloud, keine Abhängigkeiten |

### Bot-Analyser (Bridge)

| Feature | Beschreibung |
|---|---|
| **Bridge Dashboard** | Live-Status aller verbundenen Bots mit Verbindungsanzeige (MT5, Bridge, AlphaTrack) |
| **Live Trades** | Offene Positionen des Bots in Echtzeit, inkl. Schliessen-Funktion |
| **Trade Analyzer** | KI-gestützte Marktanalyse auf Basis echter MT5-Kerzen (M5 Scalping / H1 Intraday) |
| **Bridge Log** | Bridge-Logs nach Level (INFO/WARN/ERR) filterbar, mit CSV/JSON-Export |
| **Bot Performance** | Bot-Statistiken, Equity-Kurve und Performance-Metriken je Bot |
| **Bot Einstellungen** | Bot konfigurieren, Parameter anpassen, Zustand steuern |
| **Trade-Executor** | Trades direkt in MT5 ausführen (Symbol, Richtung, Lots, SL/TP) |
| **Watchdog-Panel** | Bridge-Status, Neustart-Funktion und Bot-Steuerung (Start/Pause/Stop) |
| **Netzwerk (Auto-Discovery)** | Bridge und Bots automatisch im lokalen Netzwerk erkennen und registrieren |
| **TradingLockContext** | Sicherheits-Schutzschalter in der Sidebar - sperrt alle Trade-Buttons standardmäßig |

---

## Navigation

Eine einzige Navigation, immer sichtbar - kein Moduswechsel.

**Trading Journal:** Dashboard - Trades - Statistiken - Strategien - Kalender - Analyse - TPC

**Bot-Analyser:** Bridge (Analyse / Log / Trades) - Bots (Performance / Einstellungen) - Netzwerk

**Schutzschalter:** Neben dem Logo in der Sidebar - `ShieldCheck` (grün = gesperrt/sicher) / `ShieldOff` (rot = Trading aktiv). Standard: gesperrt.

**Farbthemen:** 3 wählbare Akzentfarben - Blau (Standard), Crimson (`#f43f5e`), Violett (`#a855f7`)

---

## Schnellstart

**Voraussetzungen:** [Node.js](https://nodejs.org/) >= 18

```bash
# 1. Repository klonen
git clone https://github.com/G99SEMAN/AlphaTrack.git
cd AlphaTrack

# 2. Abhängigkeiten installieren
npm install

# 3. Umgebungsvariablen einrichten
cp .env.example .env.local
# .env.local mit deinen Keys befüllen

# 4. Entwicklungsserver starten
npm run dev
```

App läuft unter: **http://localhost:3000**

---

## Docker / NAS-Deployment

AlphaTrack läuft als Docker-Container - getestet auf **Synology NAS**.

### Starten

```bash
docker compose up -d
```

App erreichbar unter: **http://\<NAS-IP\>:3002**

### docker-compose.yml

```yaml
version: '3.8'
services:
  alphatrack:
    build: .
    container_name: alphatrack
    restart: unless-stopped
    ports:
      - "3002:3000"
    env_file:
      - .env.local
    volumes:
      - ./data:/app/data
```

> Das `data/`-Volume sichert alle Trades, Profile, Bot-Daten und gecachte KI-Erklärungen persistent ausserhalb des Containers.

### Deploy (NAS + Mini-PC)

`scripts\windows\deploy.bat` startet das interaktive Deploy:

1. **Konfigurationsabfrage** — NAS-Zugang, Mini-PC-Zugang, MT5-Logindaten.
   Antworten werden in `scripts/windows/deploy.config.json` gespeichert (gitignored);
   Enter übernimmt beim nächsten Lauf den gespeicherten Wert.
2. **NAS** — git push, `.env.local` mit `BOT_API_KEY` sicherstellen, Container-Rebuild,
   Auswahl des Trading-Profils vom NAS.
3. **Mini-PC** — `bridge/` + `bots/` per SSH kopieren, Configs generieren,
   Firewall-Regel (TCP 8765) und geplante Aufgabe "AlphaTrack Bridge" (Start bei
   Anmeldung). Bots werden nur kopiert — Start manuell per `start.bat`.
4. **Check** — wartet, bis die Bridge sich beim NAS-AlphaTrack registriert hat.

**Einmalig auf dem Mini-PC:** OpenSSH-Server aktivieren (Einstellungen → Optionale
Features → "OpenSSH-Server", dann `Set-Service sshd -StartupType Automatic` +
`Start-Service sshd` als Admin). Der SSH-Benutzer braucht Admin-Rechte
(Firewall/Aufgabenplanung). MetaTrader 5 und Python müssen installiert sein.

#### SSH-Key einrichten (kein Passwort beim Deploy)

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\setup-ssh-key.ps1
```

Das Script erzeugt ein ed25519-Schlüsselpaar unter `%USERPROFILE%\.ssh\alphatrack_deploy`
und gibt den Public Key mit Kopierbefehlen für den Mini-PC aus.
Da Windows-OpenSSH keine leeren Passwörter erlaubt, muss der Public Key **einmalig manuell**
auf dem Mini-PC eingetragen werden (physisch oder per Remote Desktop):

```powershell
# Auf dem Mini-PC ausführen:
Add-Content "$env:USERPROFILE\.ssh\authorized_keys" "ssh-ed25519 AAAA... (Public Key einfügen)"
icacls "$env:USERPROFILE\.ssh\authorized_keys" /inheritance:r /grant:r "${env:USERNAME}:F"
```

Beim nächsten `deploy.bat`-Lauf den angezeigten Key-Pfad bei **"Mini-PC SSH-Key-Pfad"** eingeben —
danach läuft der Deploy passwortlos.

---

## Konfiguration

Erstelle eine `.env.local` im Projektroot:

```env
# Anthropic API - für KI-Marktanalyse und Wirtschaftskalender-Erklärungen
ANTHROPIC_API_KEY=sk-ant-...

# Twelve Data API - für Kursdaten in der Analyse
TWELVE_DATA_API_KEY=...

# Bot-Authentifizierung - muss mit der Python-Bridge übereinstimmen
BOT_API_KEY=REDACTED-API-KEY
```

| Variable | Pflicht | Zweck |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | KI-Marktanalyse, Wirtschaftskalender-Erklärungen |
| `TWELVE_DATA_API_KEY` | Optional | Kursdaten |
| `BOT_API_KEY` | Nur mit Bridge | Authentifizierung der Python-Bridge gegen AlphaTrack |

> Auf dem NAS importierte API-Keys werden in `data/api-keys.json` persistiert und überleben Container-Rebuilds.

---

## Projektstruktur

```
AlphaTrack/
+-- src/
|   +-- app/                      # Next.js App Router - Seiten
|   |   +-- dashboard/            # Dashboard mit PnL, Equity-Kurve
|   |   +-- journal/              # Trading Journal
|   |   +-- statistiken/          # Performance-Auswertung
|   |   +-- strategien/           # Strategien-Verwaltung
|   |   +-- kalender/             # Wirtschaftskalender
|   |   +-- analyse/              # KI-Marktanalyse
|   |   +-- tpc/                  # Trading Performance Calendar
|   |   +-- netzwerk/             # Auto-Discovery von Bridge und Bots
|   |   +-- einstellungen/        # App-Einstellungen & Backup
|   |   +-- bridge/               # Bot-Analyser (analyse/, log/, trades/)
|   |   +-- bots/                 # Bot-Management ([id]/, performance/, settings/)
|   |   +-- setup/                # Ersteinrichtung / Profil anlegen
|   |   +-- api/                  # API-Routen (bot/*, analyse/*, kalender/*)
|   +-- components/               # Wiederverwendbare UI-Komponenten
|   |   +-- layout/               # Sidebar, BottomNav, MarketSessions
|   |   +-- dashboard/            # Dashboard-Karten und Charts
|   |   +-- journal/              # Trade-Modal, Trade-Liste, Import
|   |   +-- statistiken/          # Statistik-Panels und Diagramme
|   |   +-- strategien/           # Strategie-Verwaltung
|   |   +-- bot/                  # Bot-Komponenten (Controls, Watchdog, LiveFeed)
|   |   +-- bridge/               # Bridge-Komponenten (Status, Discovery)
|   |   +-- analyse/              # Analyse-Komponenten
|   |   +-- profile/              # Profil-Switcher, Profil-Modal
|   +-- context/                  # React Contexts
|   |   +-- TradingLockContext.tsx # Schutzschalter (gesperrt/entsperrt)
|   |   +-- BotStatusContext.tsx  # Zentrales Bot-Status-Polling (5s)
|   +-- lib/                      # Datenlogik & Hilfsfunktionen
|   |   +-- data.ts               # Trade CRUD + Stats-Berechnung
|   |   +-- bot-data.ts           # Bot/Bridge Datenzugriff (atomicWrite)
|   |   +-- profiles.ts           # Profil CRUD
|   |   +-- strategies.ts         # Strategien CRUD
|   |   +-- api-keys.ts           # API-Key Verwaltung (env + data/ Fallback)
|   |   +-- analyse-data.ts       # Analyse-History
|   +-- types/                    # TypeScript-Typdefinitionen
+-- bots/                         # Python-Bots (testbot2 aktiv, scaffold als Vorlage)
|   +-- testbot2/                 # Aktiver Test-Bot
|   +-- scalpingv1/               # EMA-Crossover + RSI Scalping Bot (EURUSDp M5)
|   +-- scaffold/                 # Bot-Vorlage für neue Bots
|   +-- backtest/                 # Generischer Backtest-Runner (runner.py)
+-- bridge/                       # Python-Bridge (gateway.py, main.py, trade_executor.py)
+-- scripts/
|   +-- docker-entrypoint.sh      # Docker-Startskript (erstellt data/)
|   +-- nas-update.sh             # NAS-Update via SSH
+-- data/                         # Lokale JSON-Datenspeicherung (in Git getrackt)
+-- Dockerfile
+-- docker-compose.yml
+-- package.json
```

---

## Datenspeicherung

Alle Daten liegen lokal im `data/` Ordner als JSON-Dateien. Kein Server, keine Datenbank, kein Account.

```
data/
+-- profiles.json                     # Alle angelegten Profile
+-- active.json                       # ID des aktiven Profils
+-- trades-[PROFIL-ID].json           # Trades je Profil
+-- strategies-[PROFIL-ID].json       # Strategien je Profil
+-- bots.json                         # Bot-Konfigurationen
+-- bot-status-[BOT-ID].json          # Letzter Bot-Status (Heartbeat)
+-- bot-log-[BOT-ID].json             # Bridge-Log-Einträge (max 5000)
+-- bot-commands-[BOT-ID].json        # Ausstehende Bot-Commands
+-- bot-events-[BOT-ID].json          # Bot-Ereignisse (Trades, Signale)
+-- bot-trades-[PROFIL-ID].json       # Vom Bot synchronisierte Trades
+-- performance-bots.json             # Aggregierte Bot-Performance-Daten
+-- event-explanations.json           # KI-Erklärungen zu Wirtschaftsereignissen (Cache)
+-- api-keys.json                     # Via UI importierte API-Keys (NAS-persistent)
+-- analyse-history.json              # Letzte 10 KI-Marktanalysen
```

> Alle Schreibvorgänge nutzen atomares Schreiben (tmp-Datei + rename) - kein korruptes JSON bei gleichzeitigen Requests.

Trade-Screenshots werden unter `data/screenshots/` gespeichert.

> Der `data/`-Ordner ist bewusst in Git getrackt (Multi-Device-Sync ohne separate Datenbank). Die hier enthaltenen Daten sind ein Demo-Profil ohne echte Trades. **Wenn du AlphaTrack für deine eigenen, echten Trades nutzt, halte deinen Fork/deine Kopie privat** — sonst werden deine Handelsdaten bei jedem `git push` öffentlich sichtbar.

### Backup & Restore

Über die Einstellungen lässt sich ein vollständiges Backup als `.zip` exportieren (inkl. Screenshots) und auf einem anderen Gerät wieder importieren.

---

## Backtesting

Bots können gegen echte MetaTrader-Daten zurückgetestet werden — ohne Live-Trading-Risiko. Die Daten kommen ausschliesslich über die Bridge aus MT5, es wird kein externer Datenfeed benötigt.

### Voraussetzungen

- **Bridge läuft** auf dem Mini PC (MT5 verbunden, Port 8765 erreichbar)
- **Python** + `requests` auf dem ausführenden Computer installiert
- Bot hat eine gültige `config.json` mit `bridge_url` und `api_key`

### Backtest starten

```bash
# Vom AlphaTrack-Projektverzeichnis aus:
python bots/backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14

# Mit expliziter Bridge-URL (falls abweichend von config.json):
python bots/backtest/runner.py --bot scalpingv1 --from 2026-01-01 --to 2026-06-14 --bridge http://192.168.178.37:8765
```

**Parameter:**

| Parameter | Pflicht | Beschreibung |
|---|---|---|
| `--bot` | Ja | Name des Bot-Ordners unter `bots/` (z.B. `scalpingv1`) |
| `--from` | Ja | Start-Datum im Format `YYYY-MM-DD` |
| `--to` | Ja | End-Datum im Format `YYYY-MM-DD` (inklusive) |
| `--bridge` | Nein | Bridge-URL — Standard: Wert aus `config.json` des Bots |

### Ablauf

1. Runner liest `bots/<botname>/config.json` (Symbol, Timeframe, Parameter)
2. Lädt historische Kerzen vom Bridge-Endpoint `/historical_candles` (MT5 als Quelle)
3. Simuliert die `on_tick()`-Schleife des Bots über die Kerzen im Sliding-Window
4. SL/TP werden gegen High/Low der jeweils nächsten Kerze geprüft
5. Noch offene Positionen am Ende werden zum letzten Close-Preis geschlossen

### Beispiel-Output

```
[Bridge] Lade Kerzen: EURUSDp M5 | 2026-01-01 → 2026-06-14 ...
[Bridge] 18432 Kerzen geladen
[Backtest] Warmup: 50 Kerzen | Test ab: 2026-01-01 09:05:00

==============================================================
  BACKTEST: Scalping V1
  Symbol   : EURUSDp | TF: M5
  Zeitraum : 2026-01-01 → 2026-06-14
==============================================================
  Trades gesamt    : 47
  Gewinner / Verlierer : 29 / 18
  Win-Rate         : 61.7%
  Gesamt-P&L       : +$312.50
  Ø Win / Ø Loss   : +$32.50 / -$25.00
  Profit-Faktor    : 2.08
  Max. Drawdown    : $75.00

  #   Eröffnet           Dir   Entry     Exit       P&L   Typ
  -------------------------------------------------------
  1   2026-01-02 09:15   BUY   1.03452  1.03602  +$37.50  TP
  2   2026-01-03 10:30   SELL  1.03811  1.03961  -$25.00  SL
  ...
==============================================================
```

> **Hinweis:** P&L-Werte sind Rohschätzungen (kein Spread, keine Kommission). Der Spread deines Brokers reduziert die Realrendite — typisch 1–2 Pips bei EURUSD.

### Neuen Bot backtest-fähig machen

**Pflicht:** Zeit-Checks in `on_tick()` müssen `self._now()` statt `datetime.now()` nutzen:

```python
# Richtig — im Backtest wird self._now() auf die Kerzenzeit gesetzt:
now_utc = self._now()

# Falsch — gibt immer die echte Systemzeit zurück, Session-Filter bricht:
now_utc = datetime.now(timezone.utc)
```

`self._now()` ist in `BaseBot` definiert und gibt live `datetime.now(timezone.utc)` zurück. Der Backtest-Runner überschreibt sie automatisch. Bots ohne Zeit-Checks (kein Session-Filter) brauchen nichts zu ändern.

---

## Tech Stack

| Technologie | Version | Zweck |
|---|---|---|
| [Next.js](https://nextjs.org/) | 15 | React Framework mit App Router und Server Components |
| [React](https://react.dev/) | 19 | UI-Bibliothek |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Typsichere Entwicklung |
| [Tailwind CSS](https://tailwindcss.com/) | v4 | Utility-First Styling |
| [Framer Motion](https://www.framer.com/motion/) | 12 | Animationen und UI-Übergänge |
| [Recharts](https://recharts.org/) | 3 | Equity-Kurven und Statistik-Diagramme |
| [Lucide React](https://lucide.dev/) | 1 | Icon-Bibliothek |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | 0.92 | Claude KI-Integration |
| [JSZip](https://stuk.github.io/jszip/) | 3 | Backup-Bundle erstellen und importieren |
| [html2canvas](https://html2canvas.hertzen.com/) | 1 | Screenshot-Export |
| [nanoid](https://github.com/ai/nanoid) | 5 | ID-Generierung |
| [Docker](https://www.docker.com/) | - | Container-Deployment für NAS |

---

## PWA / Mobile

AlphaTrack ist als **Progressive Web App (PWA)** konfiguriert:

- Installierbar auf iOS (Safari: "Zum Home-Bildschirm") und Android (Chrome: "App installieren")
- Service Worker für Offline-Fähigkeit
- Native App-Feeling ohne App Store

**Mobile Navigation:**
- Smartphone/Tablet: fixe Bottom-Navigation
- Vollständige Navigation über die Sidebar
- Responsive Layout optimiert für alle Bildschirmgrößen

---

## Heimnetz-Infrastruktur (Empfehlung)

```
PC (Dev/Journal)  <-->  NAS (AlphaTrack Docker :3002)
                             ^
                             | Heartbeat / Commands
                             |
                        Mini PC (MT5 + Python-Bridge)
```

- **AlphaTrack** läuft auf dem NAS (Docker) oder lokal auf dem PC
- **Python-Bridge** läuft auf dem Bot-PC neben MT5 und sendet Heartbeats an AlphaTrack
- **Kommunikation** ausschliesslich im lokalen Netzwerk - kein Internet nötig

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE). Copyright (c) 2026 G99SEMAN.

# AlphaTrack — Ersteinrichtung

Infrastruktur: **NAS** (AlphaTrack Docker) · **Mini-PC** (MT5 + Python-Bridge + Bots)

---

## 1 · Voraussetzungen

| Gerät | Software |
|---|---|
| NAS | Docker, Git |
| Mini-PC | Python 3.10+, MetaTrader 5, OpenSSH-Server |
| Dev-PC | Node.js ≥ 18 (nur für lokalen Dev-Run) |

**OpenSSH auf dem Mini-PC einmalig aktivieren** (als Admin):
```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service sshd -StartupType Automatic
Start-Service sshd
```

---

## 2 · SSH-Key einrichten (einmalig, kein Passwort beim Deploy)

Auf dem Dev-PC ausführen:
```
scripts\windows\setup-ssh-key.ps1
```
Den ausgegebenen Public Key **einmalig manuell auf dem Mini-PC** eintragen:
```powershell
Add-Content "$env:USERPROFILE\.ssh\authorized_keys" "ssh-ed25519 AAAA... (Public Key)"
icacls "$env:USERPROFILE\.ssh\authorized_keys" /inheritance:r /grant:r "${env:USERNAME}:F"
```

---

## 3 · `.env.local` auf dem NAS

Datei im Projektroot anlegen (wird beim Deploy auf den NAS kopiert):
```env
ANTHROPIC_API_KEY=sk-ant-...         # KI-Analyse (optional)
TWELVE_DATA_API_KEY=...               # Kursdaten (optional)
BOT_API_KEY=<dein-api-key>   # muss mit bridge/config.json übereinstimmen
```

---

## 4 · AlphaTrack deployen

```
scripts\windows\deploy.bat
```

Das Script fragt einmalig nach NAS-IP, Mini-PC-IP, MT5-Zugangsdaten und SSH-Key-Pfad — Antworten werden in `deploy.config.json` gespeichert, danach reicht Enter.

**Was passiert:**
1. NAS → git push, Container-Rebuild, AlphaTrack läuft auf `:3002`
2. Mini-PC → `bridge/` + `bots/` per SSH kopieren, Firewall TCP 8765 öffnen, Aufgabenplanung für Auto-Start der Bridge

---

## 5 · Profil anlegen (Setup-Wizard)

`http://<NAS-IP>:3002` öffnen → Setup-Wizard startet automatisch beim ersten Aufruf.

1. **Profil-Typ** — Live oder Demo wählen
2. **Broker & Kapital** — Startkapital, Broker, Währung
3. **Details** — Profilname, Zeitzone
4. **Trade-Sync** — erst überspringen (`Erst ab heute dokumentieren`); nach der Bridge-Verbindung nachholen

> Die `profile_id` des neuen Profils muss in `bridge/config.json` eingetragen werden. Am einfachsten: Profil oeffnen → Profil-ID kopieren → in `bridge/config.json` unter `profile_id` eintragen → Deploy erneut ausfuehren.

---

## 6 · Bridge starten (Mini-PC)

Auf dem Mini-PC im `bridge/`-Ordner:
```
start_bridge.bat
```

Die Bridge verbindet sich zu MT5 und sendet alle 5 Sekunden einen Heartbeat an AlphaTrack. Im AlphaTrack unter **Netzwerk** erscheint sie automatisch (Auto-Discovery).

**Prüfen:** AlphaTrack → Bridge-Seite → Verbindungsstatus sollte `Verbunden` zeigen.

> Beim ersten Heartbeat wird das Startkapital automatisch aus dem MT5-Kontostand übernommen (sofern in Schritt 5 noch 0).

---

## 7 · Historische Trades importieren (optional)

Im Setup-Wizard Schritt 4 auf `Alle historischen Trades laden` klicken (Bridge muss verbunden sein).

> **Hinweis:** Nachtraeglich ist kein UI-Import vorhanden — historische Trades koennen nur waehrend der Ersteinrichtung (Schritt 4) geladen werden. Falls uebersprungen: Profil loeschen und neu anlegen, oder Trades ueber die Bridge-API synchronisieren.

---

## 8 · Bot deployen und starten

Bots liegen unter `bots/<botname>/`. Nach Anpassung von `config.json` (Symbol, Parameter):

```
scripts\windows\deploy-bot.bat
```

Auf dem Mini-PC im `bots/<botname>/`-Ordner:
```
start.bat
```

Der Bot registriert sich automatisch bei AlphaTrack und ist unter **Bots** sichtbar.

---

## Kurzübersicht: Reihenfolge

```
1. SSH-Key einrichten (einmalig)
2. .env.local erstellen
3. deploy.bat → NAS + Mini-PC
4. AlphaTrack öffnen → Profil anlegen
5. start_bridge.bat auf Mini-PC
6. Netzwerk-Tab: Bridge als verbunden prüfen
7. (optional) Historische Trades importieren
8. start.bat für jeden Bot
```

---

## Fehlersuche

| Problem | Ursache | Lösung |
|---|---|---|
| Bridge nicht sichtbar im Netzwerk-Tab | UDP-Broadcast blockiert | Bridge manuell unter Netzwerk → URL eintragen (`http://<Mini-PC-IP>:8765`) |
| Heartbeat schlägt fehl | `BOT_API_KEY` stimmt nicht überein | `.env.local` und `bridge/config.json` vergleichen |
| MT5 verbindet nicht | Falscher Login/Server | `bridge/config.json` → `mt5_login`, `mt5_password`, `mt5_server` prüfen |
| Bot taucht nicht auf | Falsche `alphatrack_url` in Bot-Config | `bots/<botname>/config.json` → `alphatrack_url` auf NAS-IP setzen |

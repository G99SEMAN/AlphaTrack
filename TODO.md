- ~~Uhrzeiten bei Kalender überprüfen~~ (erledigt: isoToday() nutzte UTC statt Europe/Berlin, gefixt)
- ~~Mobile Ansicht: Sessions müssen etwas schmaler werden~~ (erledigt: 2-Spalten-Grid im compact-Modus)
- ~~Neues Menu "Bots" in Navigationsleiste hinzufügen~~ (erledigt: /bots Route mit Stub-Seiten, getrennt von /bridge)
- Trades:
  - ~~Unter "Trades" werden gerade geschlossene Trades erst viel später angezeigt~~ (erledigt: 10s Polling via /api/trades)
  - ~~Trades nach schlussdatum sortieren~~ (erledigt: offene Trades oben, geschlossene nach closeTime desc)
  - ~~P&L mit Währungszeichen, Dropdown in Einstellungen~~ (erledigt: currencySymbol() überall, Profil-Dropdown EUR/USD/GBP/CHF)
- Bridge:
  - ~~Die Farbe der Uptime in Terminal der Bridge ist nur schwer leserlich~~ (erledigt: bright_white statt dim blue)
  - ~~Die Meldungen, welche in der Bridge-Log stehen sollen identisch mit den Logs in Alphatrack sein~~ (erledigt: BOT_API_KEY-Bug gefixt - Push war mit 401 geblockt, symbol-Feld in trade_sync.py korrigiert, CLOSED-Trades nun auch im Terminal-Display)
- Bridge Settings:
  - ~~Wenn Einstellungen gespeichert werden, sollen diese direkt zur Bridge übertragen werden~~ (erledigt: POST /api/bot/config -> Bridge, config.json wird aktualisiert, Änderungen werden geloggt, Passwort maskiert)
- Dashboard:
  - ~~Oben im Dashboard ist eine Anzeige der Bridge mit dem Verbindungsstatus~~ (erledigt: wurde entfernt)

Schritt 1 — Neue Dateien auf den Mini-PC kopieren

  Kopiere vom AlphaTrack-Hauptprojekt (C:\Users\Kevin\Desktop\AlphaTrack\) folgende Dateien auf den Mini-PC:

  Bridge-Ordner → nach C:\Users\PC\Desktop\bridge\:
  bridge\gateway.py          ← NEU (ersetzen/hinzufügen)
  bridge\requirements.txt    ← AKTUALISIERT (ersetzen)
  bridge\main.py             ← AKTUALISIERT (ersetzen)

  Bot-Ordner → nach C:\Users\PC\Desktop\breakoutv1\:
  bots\breakoutv1\ws_client.py    ← NEU
  bots\breakoutv1\main.py         ← AKTUALISIERT (ersetzen)
  bots\breakoutv1\config.json     ← AKTUALISIERT (ersetzen)
  bots\breakoutv1\requirements.txt ← AKTUALISIERT (ersetzen)

  ---
  Schritt 2 — Bridge: neue Pakete installieren

  Auf dem Mini-PC in einem Terminal im bridge-Ordner:
  pip install fastapi "uvicorn[standard]"
  pip uninstall flask -y

  ---
  Schritt 3 — Bot: neues Paket installieren

  Auf dem Mini-PC im breakoutv1-Ordner:
  pip install websocket-client
  pip uninstall flask -y

  ---
  Schritt 4 — Bridge starten

  cd C:\Users\PC\Desktop\bridge
  python main.py
  Du solltest sehen: [CMD] Gateway-Server gestartet auf Port 8765 (statt "Flask")

  ---
  Schritt 5 — Bot starten

  cd C:\Users\PC\Desktop\breakoutv1
  start.bat
  Du solltest sehen:
  [...] Verbinde mit Bridge via WebSocket: http://localhost:8765
  [OK] Bot registriert: abc123

  ---
  Verifizierung

  In AlphaTrack unter Bots sollte der Bot automatisch auftauchen — diesmal ohne eigene IP/Port, sondern über die Bridge registriert. Im Netzwerk-Menü siehst du alle Verbindungen live.

  Geht etwas schief? Häufigste Fehler:
  - ModuleNotFoundError: fastapi → Schritt 2 nochmal ausführen
  - ModuleNotFoundError: websocket → Schritt 3 nochmal ausführen
  - Bot erscheint nicht in AlphaTrack → prüfe ob AlphaTrack läuft und api_key in beiden Configs gleich ist (REDACTED-API-KEY)
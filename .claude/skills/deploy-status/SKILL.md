---
name: deploy-status
description: Pre-Deploy-Check für AlphaTrack — prüft Git-Status, TypeScript-Build, Konfiguration und Netzwerk-Erreichbarkeit vor dem Deploy auf NAS + Mini-PC
disable-model-invocation: false
---

# Deploy-Status Check

Führe folgende Checks der Reihe nach durch und zeige das Ergebnis als Checkliste.

## Checks

### 1. Git-Status
```
git status --short
git log origin/main..HEAD --oneline
```
- Gibt es uncommittete Änderungen?
- Gibt es Commits, die noch nicht gepusht wurden?

### 2. TypeScript-Build
```
npx tsc --noEmit --pretty false 2>&1
```
- Kein Fehler = grün. Fehler ausgeben, nicht nur zählen.

### 3. Konfigurationsdateien
- `scripts/windows/deploy.config.json` vorhanden und lesbar?
- `bridge/config.json` vorhanden? Pflichtfelder: `api_key`, `bridge_url`, `alphatrack_url`

### 4. Netzwerk (Ping, kann fehlschlagen wenn nicht im LAN)
```
ping -n 1 192.168.178.3   # NAS
ping -n 1 192.168.178.37  # Mini-PC (Bridge)
```

## Ausgabe-Format

Zeige eine kompakte Checkliste:

```
## AlphaTrack Deploy-Bereitschaft

Git
  ✅ Keine uncommitteten Änderungen
  ⚠️  3 Commits noch nicht gepusht (main)

Build
  ✅ TypeScript: Kein Fehler

Konfiguration
  ✅ deploy.config.json vorhanden
  ✅ bridge/config.json: Pflichtfelder ok

Netzwerk
  ✅ NAS (192.168.178.3): Erreichbar
  ❌ Mini-PC (192.168.178.37): Nicht erreichbar — Bridge läuft?

─────────────────────────────────────
Bereit: NEIN — 2 Probleme beheben
```

Wenn alles grün: Deploy-Befehl hinweisen:
```
scripts\windows\deploy.bat          # NAS + Mini-PC
scripts\windows\deploy-bot.bat      # Einzelner Bot
```

## Hinweise
- Netzwerk-Fehler sind kein Blocker wenn du im Büro/extern bist
- TypeScript-Fehler und fehlende Config sind immer Blocker
- Nicht-gepushte Commits sind eine Warnung, kein Blocker

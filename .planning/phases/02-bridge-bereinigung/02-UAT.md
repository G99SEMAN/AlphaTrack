---
status: complete
phase: 02-bridge-bereinigung
source: [02-VERIFICATION.md]
started: 2026-06-10T00:00:00Z
updated: 2026-06-10T23:11:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bridge Auto-Discovery Laufzeit (Heartbeat-Timeout)
expected: Python-Bridge verbinden, dann Verbindung trennen. Nach spätestens 35 Sekunden (30s Timeout + max. 5s Poll-Intervall) muss die Bridge aus der Liste verschwinden — ohne manuellen Eingriff.
result: pass
note: "Bug (SSR-Fallback lastUpdated-Check) wurde inline gefixt und re-verifiziert."

### 2. Bridge-Log initial nur Bridge-Bots
expected: Im laufenden Dev-Server die Seite /bridge/log öffnen. Wenn data/bots.json gemischte Bot-Typen enthält (type: 'bot' + type: 'bridge'), dürfen beim ersten Render nur Bridge-Logs angezeigt werden — keine Bot-Logs sichtbar.
result: pass

### 3. /bridge/settings ergibt 404
expected: Im laufenden Dev-Server die URL /bridge/settings aufrufen. Next.js muss eine 404-Seite zurückgeben (die Route existiert nicht mehr). Der Sidebar-Link "Bridge Settings" darf nicht sichtbar sein.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

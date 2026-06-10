---
status: testing
phase: 02-bridge-bereinigung
source: [02-VERIFICATION.md]
started: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Test

number: 1
name: Bridge Auto-Discovery Laufzeit (Heartbeat-Timeout)
expected: |
  Python-Bridge verbinden, danach trennen — Bridge verschwindet nach max. 35 Sekunden
  automatisch aus der Bridge-Liste (BRIDGE-01)
awaiting: user response

## Tests

### 1. Bridge Auto-Discovery Laufzeit (Heartbeat-Timeout)
expected: Python-Bridge verbinden, dann Verbindung trennen. Nach spätestens 35 Sekunden (30s Timeout + max. 5s Poll-Intervall) muss die Bridge aus der Liste verschwinden — ohne manuellen Eingriff.
result: issue
reported: "Bridge bleibt nach über 35 Sekunden noch in der Tab-Leiste sichtbar, obwohl 'Kein Heartbeat empfangen' und Status 'Offline' angezeigt wird."
severity: major

### 2. Bridge-Log initial nur Bridge-Bots
expected: Im laufenden Dev-Server die Seite /bridge/log öffnen. Wenn data/bots.json gemischte Bot-Typen enthält (type: 'bot' + type: 'bridge'), dürfen beim ersten Render nur Bridge-Logs angezeigt werden — keine Bot-Logs sichtbar.
result: [pending]

### 3. /bridge/settings ergibt 404
expected: Im laufenden Dev-Server die URL /bridge/settings aufrufen. Next.js muss eine 404-Seite zurückgeben (die Route existiert nicht mehr). Der Sidebar-Link "Bridge Settings" darf nicht sichtbar sein.
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Bridge verschwindet automatisch nach max. 35s aus der Liste wenn Heartbeat ausbleibt"
  status: failed
  reason: "User reported: Bridge bleibt nach über 35 Sekunden noch in der Tab-Leiste sichtbar"
  severity: major
  test: 1
  root_cause: "BridgeClient.tsx:28 — Fallback `contextBots.length > 0 ? contextBots : filterBridge(initial)` greift wenn der Context alle Bridges herausfiltert. Leerer Context (nach Timeout) wird wie uninitialiserter Context behandelt → SSR-Snapshot bleibt sichtbar. Fix: lastUpdated !== null als Initialisierungssignal nutzen."
  fix: "BridgeClient.tsx:28 — const bots = lastUpdated !== null ? contextBots : filterBridge(initial)"

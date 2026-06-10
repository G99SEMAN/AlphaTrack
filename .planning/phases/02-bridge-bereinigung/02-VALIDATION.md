---
phase: 02
slug: bridge-bereinigung
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-10
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Kein Test-Framework konfiguriert |
| **Config file** | Nicht vorhanden |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Build grün + manuelle visuelle Verifikation aller 4 Requirements
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BRIDGE-01 | — | N/A | Manuell (visuell) | `npm run build` | ❌ Wave 0 n/a | ⬜ pending |
| 02-01-02 | 01 | 1 | BRIDGE-02 | — | N/A | Manuell (visuell) | `npm run build` | ❌ | ⬜ pending |
| 02-02-01 | 02 | 1 | BRIDGE-03 | — | N/A | Manuell (visuell) | `npm run build` | ❌ | ⬜ pending |
| 02-02-03 | 02 | 1 | BRIDGE-04 | — | N/A | Manuell (Navigation) | `npm run build` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Da kein Test-Framework konfiguriert ist, sind alle Tests manuell/visuell. Der Compile-Check via `npm run build` dient als automatisierte Minimalvalidierung.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bridge verschwindet nach 30s ohne Heartbeat | BRIDGE-01 | Visueller UI-State, kein Test-Framework | Bridge trennen, 35s warten, prüfen ob sie aus der Liste verschwindet |
| Kein Trash-Icon sichtbar in Bridge-UI | BRIDGE-02 | Visuelles UI-Element | Bridge-Seite öffnen, prüfen ob Löschen-Icon vorhanden ist |
| Kein "Alle Bots"-Filter in Bridge-Log | BRIDGE-03 | Visuelles UI-Element | Bridge-Log öffnen, prüfen ob Bot-Filter-Buttons vorhanden sind |
| /bridge/settings → 404 | BRIDGE-04 | Navigation | Browser zu /bridge/settings navigieren, 404-Fehler bestätigen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

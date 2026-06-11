---
phase: 03
slug: bot-verbesserungen
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manuell (kein automatisches Test-Framework konfiguriert) |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` + manuelle UAT-Checkliste |
| **Estimated runtime** | ~30 Sekunden (Build) + manuelle UAT |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + manuelle UAT der abgedeckten Anforderungen
- **Before `/gsd-verify-work`:** Alle 8 BOTS-Success-Criteria manuell verifiziert
- **Max feedback latency:** ~30 Sekunden (Build-Smoke-Test)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | BOTS-01 | — | N/A | UAT (manuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | BOTS-03 | — | N/A | UAT (manuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | BOTS-04 | — | N/A | UAT (manuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | BOTS-06 | — | N/A | UAT (visuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | BOTS-07 | — | N/A | UAT (visuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | BOTS-08 | T-03-01 | set_parameters validiert Typ + isSameOriginRequest | UAT (manuell) | `npm run build` | ❌ W0 | ⬜ pending |
| 03-verify-01 | — | — | BOTS-02 | — | N/A | UAT (visuell) | — | ✅ bereits erfüllt | ⬜ pending |
| 03-verify-02 | — | — | BOTS-05 | — | N/A | UAT (manuell) | — | ✅ bereits erfüllt | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Kein automatisches Test-Framework konfiguriert — `npm run build` ist einziger automatischer Check
- [ ] UAT-Checkliste in `03-UAT.md` muss BOTS-01/03/04/06/07/08 abdecken
- [ ] TypeScript-Kompilierung als Smoke-Test nach jeder Änderung

*Existing infrastructure covers build-time type checking only — UAT ist manuell.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot-Karte zeigt korrekte offene Positionen | BOTS-01 | Kein Test-Framework; echte Trade-Daten nötig | Bot mit offenen Trades prüfen → Positionsanzahl ≠ 0 |
| P&L in Bot-Karte statt Balance | BOTS-03 | Visuell; braucht echte Bot-Daten | Bot-Karte öffnen → grüner/roter P&L-Wert mit Vorzeichen |
| Trade-Anzahl in Bot-Karte | BOTS-04 | Visuell | Bot-Karte öffnen → Trade-Anzahl sichtbar |
| Entfernen-Button nicht sichtbar | BOTS-06 | Visuell | Settings-Seite öffnen → kein Trash-Icon |
| Namens-Bearbeitung nicht sichtbar | BOTS-07 | Visuell | Settings-Seite öffnen → kein Pencil-Icon |
| Parameter-Editor + „Parameter senden" | BOTS-08 | Echte Bot-Verbindung nötig | Settings-Seite → Parameter editieren → Bestätigen klicken → Command gesendet |
| Synced-Feld nicht sichtbar | BOTS-02 | Bereits in Phase 1 entfernt — verifizieren | Bots-Seite öffnen → kein "Synced"-Feld |
| Bot verschwindet nach 30s Disconnect | BOTS-05 | Zeitbasiert; braucht echten Bot | Bot trennen → 30s warten → Bot aus Liste verschwunden |

---

## Validation Sign-Off

- [ ] Alle Tasks haben `<automated>` verify oder Wave 0 Dependencies
- [ ] Sampling-Kontinuität: kein Build-Skip nach Task-Commit
- [ ] Wave 0 deckt alle MISSING-Referenzen ab
- [ ] Keine Watch-Mode-Flags
- [ ] Feedback-Latenz < 30s (Build)
- [ ] `nyquist_compliant: true` in Frontmatter gesetzt

**Approval:** pending

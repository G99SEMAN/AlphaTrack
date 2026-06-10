---
phase: "01"
phase_name: "datenkorrektheit"
fix_scope: critical_warning
status: all_fixed
findings_in_scope: 7
fixed: 7
skipped: 0
iteration: 1
fixed_at: 2026-06-10
---

# Phase 01 Code Review Fix Report

**Fixed at:** 2026-06-10
**Source review:** `.planning/phases/01-datenkorrektheit/01-REVIEW.md`
**Iteration:** 1

## Summary

Alle 7 in-scope Findings (3 Critical, 4 Warning) wurden erfolgreich gepatcht. Die kritischsten Fixes betreffen Path-Traversal-Schutz im close-event-Endpoint, Format-Validierung der profileId im Heartbeat, und strikte Typprüfungen für numerische Felder. Build (`npm run build`) läuft fehlerfrei durch.

## Applied Fixes

### CR-01 — close-event: bridgeId not validated against known bots

**Status:** Fixed
**File modified:** `src/app/api/bridge/close-event/route.ts`
**Commit:** `5648560` *(combined with CR-03 — same file)*
**Change:** Import von `getBotById` und `getBots` aus `@/lib/bot-data` hinzugefügt. Nach dem Destructuring von `bridgeId` aus dem Body wird nun eine Validierung gegen bekannte Bots durchgeführt (direkter Lookup, dann URL-Fallback, dann 404). Danach wird `resolvedBridgeId` für `addBridgeLogEntry` verwendet statt des rohen `bridgeId`. Entspricht dem Muster in `/heartbeat` und `/trades`.

---

### CR-02 — heartbeat: profileId passed to file I/O without validation

**Status:** Fixed
**File modified:** `src/app/api/bridge/heartbeat/route.ts`
**Commit:** `22204be`
**Change:** Der `reconcileOpenTrades`-Aufruf ist jetzt von einem Regex-Format-Guard umschlossen (`/^[a-zA-Z0-9_-]{1,64}$/`). Bei ungültigem Format wird ein `warn`-Log-Eintrag geschrieben und `reconcileOpenTrades` nicht aufgerufen — der Heartbeat-Response bleibt aber trotzdem `{ ok: true }` (kein Hard-Fail für Kompatibilität).

---

### CR-03 — close-event: exitPrice and ticket not type-validated

**Status:** Fixed
**File modified:** `src/app/api/bridge/close-event/route.ts`
**Commit:** `5648560` *(combined with CR-01 — same file)*
**Change:** Das lose `ticket == null || exitPrice == null` Guard wurde ersetzt durch strikte Typprüfungen: `typeof ticket !== 'number' || !Number.isFinite(ticket)` und `typeof exitPrice !== 'number' || !Number.isFinite(exitPrice)`. Zusätzlich wird `pnl` separat validiert, falls angegeben: `typeof pnl !== 'number' || !Number.isFinite(pnl)` → 400.

---

### WR-01 — trades: normalizeTrade bypasses TypeScript type checking

**Status:** Fixed
**File modified:** `src/app/api/bridge/trades/route.ts`
**Commit:** `e23224e`
**Change:** Neue `isValidRawTrade(raw: Record<string, unknown>): boolean` Funktion vor `normalizeTrade` eingefügt. Prüft die sechs Pflichtfelder (`date`, `instrument`, `type`, `entry`, `size`, `status`) auf korrekte Typen und Enum-Werte. Im POST-Handler wird `rawTrades` zunächst gefiltert; ungültige Einträge werden gezählt und als `warn` geloggt, dann werden nur valide Trades durch `normalizeTrade` gemappt.

---

### WR-02 — heartbeat: reconcileOpenTrades closes trades without exit data

**Status:** Fixed
**File modified:** `src/app/api/bridge/heartbeat/route.ts`
**Commit:** `58f417c`
**Change:** In `reconcileOpenTrades` wird beim Auto-Schließen eines Trades jetzt `closeTime: new Date().toISOString()` gesetzt und eine `notes`-Markierung `[Auto-geschlossen via Heartbeat-Reconciliation]` angehängt. `exit` und `pnl` werden bewusst weggelassen (Backend-Backfill via nächsten Trade-Sync). Dashboard-P&L berechnet nun `NaN` nur noch, wenn `exit` explizit fehlt — das ist sichtbarer als ein falscher `0`-Wert.

---

### WR-03 — BotDetailClient: saveName does not check res.ok

**Status:** Fixed
**File modified:** `src/app/bots/[id]/BotDetailClient.tsx`
**Commit:** `9c8fe8d`
**Change:** `await fetch(...)` wird jetzt als `const res = await fetch(...)` gespeichert. Nach dem Fetch prüft `if (!res.ok)` den Status; bei Fehler wird `console.error('[BotDetail] Name speichern fehlgeschlagen:', res.status)` geloggt und die Funktion bricht früh ab (kein UI-State-Update). `setSavingName(false)` verbleibt im `finally`-Block — wird immer zurückgesetzt.

---

### WR-04 — trades: double saveBotTrades write on migration

**Status:** Fixed
**File modified:** `src/app/api/bridge/trades/route.ts`
**Commit:** `0ab4ed1`
**Change:** Der separate `if (needsMigration) { ... saveBotTrades(profileId, existing) }` Block wurde entfernt. Die Migration läuft jetzt inline beim Lesen: `const existing = getBotTrades(profileId).map(t => t.sourceId ? t : { ...t, sourceId: 'bridge/tradeexecuter' })`. Der einzige `saveBotTrades`-Aufruf bleibt der finale auf Zeile 152 — Migration und neue Trades werden gemeinsam in einem Write persistiert.

---

## Skipped Findings

Keine. Alle 7 in-scope Findings (Critical + Warning) wurden erfolgreich gepatcht.

---

*Fixed: 2026-06-10*
*Fixer: Claude (gsd-code-fixer)*
*Iteration: 1*

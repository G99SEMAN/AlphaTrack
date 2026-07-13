# Design: Daily Checklist

**Datum:** 2026-07-13
**Status:** Approved

## Überblick

Neue Seite `/checklist`, erreichbar über einen eigenständigen, goldenen Sidebar-Eintrag ganz oben (über allen bestehenden Menügruppen). Der Nutzer trägt dort täglich eine Selbstreflexions-Checkliste aus (Checkbox- und Skala-Punkten) — motivierend im Stil einer WoW-Questreihe (Streak, Freeze-Tage, Badges/Achievements). Die Wertung bezieht sich **nie** darauf, ob getradet wurde, sondern darauf, ob der Nutzer die Punkte ehrlich ausgefüllt und damit bewusste Entscheidungen reflektiert hat — auch "heute bewusst nicht getradet" ist ein vollwertiges, positives Ergebnis.

Die Checkliste muss beim ersten Aufruf pro Profil eingerichtet werden (Starter-Set-Vorschlag, anpassbar) und ist danach jederzeit über einen Editor änderbar.

## Geltungsbereich (Scope)

- Neue eigenständige Seite `/checklist` inkl. Sidebar-Einstiegspunkt.
- Streak-, Freeze- und Badge-Mechanik ausschließlich für die Daily Checklist — keine Verknüpfung mit dem bestehenden Alpha Score (Performance-Kennzahl) oder den Trade-Gewinn/Verlust-Streaks (`calcStreak` in `data.ts`); beide bleiben unverändert und unabhängig.
- Pro Profil eigene Konfiguration und eigener Log (folgt der bestehenden Pro-Profil-Datenhaltung).
- Kein Kalender-/Wochenrückblick über die Checklist-Historie in dieser Iteration (nur heutiger Eintrag + Streak/Lifetime-Zähler + Badge-Galerie).

## Architektur

### Neue Dateien

| Datei | Verantwortung |
|---|---|
| `src/types/checklist.ts` | Typen: `ChecklistItem`, `ChecklistConfig`, `ChecklistDayEntry`, `ChecklistLog`, `ChecklistBadge` |
| `src/lib/checklist.ts` | JSON-Persistenz (Config + Log), Streak-/Lifetime-Berechnung, Badge-Auswertung, statische Badge-Definitionsliste, Default-Starter-Set |
| `src/app/checklist/page.tsx` | Server Component: lädt Config/Log/Profil, redirect nach `/setup` falls kein aktives Profil, rendert `Sidebar` + `ChecklistClient` |
| `src/components/checklist/ChecklistClient.tsx` | Haupt-UI: Header (Streak-Chip, Lifetime, Buttons), heutige Checkliste, Badge-Galerie; Ersteinrichtungs-Modus falls keine Config existiert |
| `src/components/checklist/ChecklistModal.tsx` | Editor für Checklist-Punkte (Add/Remove/Reorder, Typ-Umschalter Checkbox/Skala) — Muster von `StrategyModal.tsx` |
| `src/components/checklist/FreezeDayModal.tsx` | Datumsauswahl, um einen Tag (Vergangenheit, heute oder Zukunft) als Freeze zu markieren |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/layout/Sidebar.tsx` | Neuer eigenständiger Eintrag "Daily Checklist" oberhalb aller Nav-Gruppen, goldener/amber Akzent (analog zum orangen Einstellungen-Button als Sonderfarben-Präzedenzfall), zeigt Streak-Chip (🔥 X) |
| `src/lib/actions.ts` | Neue Server Actions: `saveChecklistConfigAction`, `saveChecklistEntryAction`, `setChecklistFreezeAction` |
| `src/lib/profiles.ts` | `deleteProfile()`: `checklist-{profileId}.json` und `checklist-log-{profileId}.json` in die Cleanup-Liste aufnehmen |

## Datenmodell

```ts
// src/types/checklist.ts

interface ChecklistItem {
  id: string;
  label: string;
  type: 'boolean' | 'scale';   // scale = 1–5
  order: number;
  createdAt: string;
}

interface ChecklistConfig {
  profileId: string;
  items: ChecklistItem[];
  createdAt: string;
}

interface ChecklistDayEntry {
  date: string;                              // "YYYY-MM-DD"
  values: Record<string, boolean | number>;  // itemId -> Wert
  completed: boolean;                        // alle Punkte des Tages ausgefüllt?
  freeze?: boolean;                          // Freeze-Tag statt echtem Eintrag
}

interface ChecklistLog {
  profileId: string;
  entries: ChecklistDayEntry[];
  unlockedBadges: Record<string, string>;  // badgeId -> ISO-Datum der Freischaltung
}

interface ChecklistBadge {
  id: string;
  kind: 'streak' | 'lifetime';
  threshold: number;   // Tage
  name: string;
}
```

### Persistenz (`src/lib/checklist.ts`)

- Dateien: `data/checklist-{profileId}.json` (Config), `data/checklist-log-{profileId}.json` (Log) — gleiches Verzeichnis wie alle anderen Datendateien.
- Atomares Schreiben: `.tmp`-Datei + `fs.renameSync`, identisch zum bestehenden Muster in `profiles.ts`/`strategies.ts`.
- Fehlendes File = leerer Zustand (kein Fehler): `getChecklistConfig` gibt `null` zurück (→ Ersteinrichtungs-Modus in der UI), `getChecklistLog` gibt `{ profileId, entries: [] }` zurück.
- `saveDayEntry(profileId, date, values)`: berechnet `completed` (alle `items` aus der Config haben einen Wert in `values`), aktualisiert oder erstellt den Eintrag für `date` im Log.
- `setFreezeDay(profileId, date)`: erstellt/überschreibt den Eintrag für `date` mit `{ freeze: true }` (kein `values`-Objekt nötig). Funktioniert für Vergangenheit, heute und Zukunft gleichermaßen.

### Streak- und Lifetime-Berechnung

- `calcChecklistStreak(log)`: iteriert vom heutigen Datum rückwärts durch die Einträge. Ein Tag zählt als "gehalten", wenn `entry.completed === true` ODER `entry.freeze === true`. Der erste Tag ohne solchen Eintrag beendet die Iteration; der Streak ist die Anzahl der bis dahin gezählten Tage.
- `calcChecklistLifetime(log)`: Anzahl aller Einträge mit `completed === true` im gesamten Log (Freeze-Tage zählen hier nicht mit, nur echte ausgefüllte Tage) — bleibt auch nach einem Streak-Reset erhalten.

### Badge-Definitionen (statisch in `checklist.ts`)

| Typ | Schwelle | Name |
|---|---|---|
| Streak | 3 Tage | Guter Start |
| Streak | 7 Tage | Eine Woche Disziplin |
| Streak | 30 Tage | Eiserner Wille |
| Streak | 100 Tage | Trading-Mönch |
| Streak | 365 Tage | Meister der Routine |
| Lifetime | 50 Tage gesamt | Halbes Hundert |
| Lifetime | 200 Tage gesamt | Routinier |
| Lifetime | 500 Tage gesamt | Veteran |

Ein Achievement, das einmal erreicht wurde, bleibt dauerhaft freigeschaltet — auch wenn der Streak später reißt. Deshalb wird die Freischaltung **persistiert**, nicht nur live aus dem aktuellen Streak/Lifetime-Wert abgeleitet: Nach jedem `saveDayEntry`/`setFreezeDay`-Aufruf prüft `checkAndUnlockBadges(log)`, ob neue Schwellenwerte erreicht wurden (aktueller Streak bzw. Lifetime ≥ `threshold` und `badgeId` noch nicht in `unlockedBadges`), und trägt sie mit dem heutigen Datum in `log.unlockedBadges` ein. Die Badge-Galerie zeigt für **gesperrte** Badges den Fortschritt anhand des aktuellen Streak/Lifetime-Werts gegen den nächsten Schwellenwert; **freigeschaltete** Badges zeigen das in `unlockedBadges` gespeicherte Freischalt-Datum und bleiben unabhängig vom späteren Streak-Verlauf sichtbar.

### Default-Starter-Set

Beim ersten Aufruf ohne vorhandene Config wird dieses Set vorgeschlagen (vom Nutzer vor Aktivierung anpassbar):

1. Bin ich mental in der Verfassung, um heute zu handeln? *(scale)*
2. Habe ich meinen Trading-Plan / mein Setup vor dem ersten Trade überprüft? *(boolean)*
3. Habe ich heute eine bewusste Entscheidung getroffen — auch wenn sie war, nicht zu traden? *(boolean)*
4. Habe ich mein Risiko pro Trade innerhalb meiner Regeln gehalten? *(boolean)*
5. Habe ich Trades aus Emotion (FOMO, Rache, Langeweile) vermieden? *(boolean)*
6. Wie war meine Erholung/Schlafqualität vor dem Handelstag? *(scale)*

## Seiten-UI

### `src/app/checklist/page.tsx` (Server Component)

Lädt `getActiveProfile()`, `getChecklistConfig(profileId)`, `getChecklistLog(profileId)`. Redirect nach `/setup`, falls kein aktives Profil existiert (bestehendes Muster). Rendert `<Sidebar>` + `<main>` mit `<ChecklistClient config={config} log={log} badges={...} />`.

### `src/components/checklist/ChecklistClient.tsx` (Client Component)

- **Ersteinrichtungs-Modus** (falls `config === null`): zeigt das Starter-Set als Vorschau-Liste, Nutzer kann direkt Punkte entfernen/hinzufügen/Typ ändern (gleiche UI wie der spätere Editor) und mit "Checkliste aktivieren" bestätigen → `saveChecklistConfigAction`.
- **Normal-Modus**:
  - Header: Streak-Chip (🔥 X Tage), Lifetime-Zähler, Button "Freeze einlegen" (öffnet `FreezeDayModal`), Button "Punkte bearbeiten" (öffnet `ChecklistModal`)
  - Heutige Checkliste: eine Karte pro `ChecklistItem` — `boolean`-Punkte als Toggle/Checkbox, `scale`-Punkte als 1–5-Button-Reihe. Jede Änderung speichert sofort (`saveChecklistEntryAction` in `useTransition`, kein separater Absenden-Button). Wird der Tag dadurch komplett (`completed` wechselt zu `true`), erscheint eine kurze Erfolgsanimation (z.B. Konfetti/Glow), passend zum Quest-Charakter.
  - Badge-Galerie: Grid aller Badges aus der Definitionsliste — freigeschaltete hervorgehoben mit Freischalt-Datum, gesperrte ausgegraut mit Fortschrittsbalken zum nächsten Schwellenwert.

### `src/components/checklist/ChecklistModal.tsx`

Editor für die Punkte-Liste, 1:1 nach dem Muster von `StrategyModal.tsx`: dynamisches Array von Zeilen mit Text-Input, Trash-Icon zum Entfernen, "+ Punkt hinzufügen"-Button, zusätzlich pro Zeile ein Typ-Umschalter (Checkbox ⇄ Skala). Speichert über `saveChecklistConfigAction`.

### `src/components/checklist/FreezeDayModal.tsx`

Einfacher Datumspicker (Vergangenheit, heute, Zukunft alle erlaubt), bestätigt über `setChecklistFreezeAction`.

### Server Actions (`src/lib/actions.ts`)

Alle nach dem bestehenden Muster (FormData rein, `revalidatePath('/checklist')` raus):

- `saveChecklistConfigAction(formData)` — legt Config an oder aktualisiert sie
- `saveChecklistEntryAction(formData)` — speichert einen einzelnen Punkt-Wert für heute, berechnet `completed` neu
- `setChecklistFreezeAction(formData)` — markiert ein Datum als Freeze-Tag

## Sidebar-Integration

- Neuer, eigenständiger Eintrag "Daily Checklist" **oberhalb** aller bestehenden Nav-Gruppen (vor "Übersicht"), nicht Teil einer `SectionDivider`-Gruppe.
- Goldener/amber Akzent (eigene Hintergrund-/Textfarbe, analog zum bestehenden orangen Einstellungen-Button-Präzedenzfall in `Sidebar.tsx`), damit der Eintrag sich sichtbar von der übrigen Navigation abhebt.
- Zeigt einen kompakten Streak-Chip (🔥 X) direkt am Eintrag, sodass der Fortschritt von jeder Seite aus sichtbar bleibt.

## Nicht betroffen / bewusst außerhalb des Scopes

- Alpha Score (`AlphaScoreChart.tsx`) und Trade-Gewinn/Verlust-Streaks (`calcStreak` in `data.ts`) — beide unverändert, keine Verknüpfung mit der neuen Checklist-Streak.
- Kein Kalender-/Verlaufs-View über vergangene Checklist-Tage in dieser Iteration.
- Kein Freeze-Kontingent/Limit — Freezes sind uneingeschränkt manuell setzbar.
- Keine Verknüpfung mit Trading-Entscheidungen/Bot-Steuerung — die Checkliste ist rein reflektierend, kein Gate für's Traden.

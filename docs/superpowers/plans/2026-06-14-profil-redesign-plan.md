# Implementierungsplan: Profil-System Neugestaltung

**Spec:** `docs/superpowers/specs/2026-06-14-profil-redesign-design.md`  
**Datum:** 2026-06-14  

---

## Phase 0: Bestandsaufnahme (bereits erledigt)

Alle betroffenen Dateien wurden gelesen. Bekannte Fakten:

### Betroffene Dateien — isDemo-Checks

| Datei | Was zu tun |
|---|---|
| `src/types/profile.ts:28` | `isDemo?: boolean` entfernen |
| `src/app/dashboard/page.tsx:36` | `onlyDemo`-Variable + DemoBanner-Import entfernen |
| `src/app/journal/page.tsx:6,24` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/statistiken/page.tsx:6,24` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/kalender/page.tsx:4,36` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/tpc/page.tsx:4,21` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/strategien/page.tsx:5,21` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/bots/performance/page.tsx:4,24` | DemoBanner-Import + isDemo-Check entfernen |
| `src/app/bridge/page.tsx:11,15` | `filter(p => !p.isDemo)` + isDemo-Guard entfernen |
| `src/app/bridge/trades/page.tsx:11,15` | `filter(p => !p.isDemo)` + isDemo-Guard entfernen |
| `src/app/bridge/log/page.tsx:11,15` | `filter(p => !p.isDemo)` + isDemo-Guard entfernen |
| `src/app/bridge/analyse/page.tsx:11,15` | `filter(p => !p.isDemo)` + isDemo-Guard entfernen |
| `src/app/api/profiles/route.ts:10` | `.filter(p => !p.isDemo)` entfernen |
| `src/app/api/bridge/info/route.ts:12` | `.filter(p => !p.isDemo)` entfernen |
| `src/components/journal/JournalClient.tsx:430` | `profiles.filter(p => !p.isDemo)` entfernen |
| `src/components/journal/BotImportModal.tsx:225` | `profiles.filter(p => !p.isDemo)` entfernen |

### Zu löschende Dateien
- `src/components/layout/DemoBanner.tsx`
- `src/components/dashboard/DemoProfileCard.tsx`
- `src/components/profile/ProfileSwitcher.tsx` (nach Phase 3)

### Sidebar-Zustand
- `showProfileSwitcher` State: `Sidebar.tsx:113`
- Profil-Pill (klickbar): `Sidebar.tsx:204–248`
- ProfileSwitcher-Render: `Sidebar.tsx:243–247`
- Bleistift-Button (Edit): `Sidebar.tsx:232–239`

### Einstellungen-Abschnitte (aktuell)
- Statistik-Panels: `EinstellungenClient.tsx:125–158`
- Börsen-Sessions: `EinstellungenClient.tsx:160–206`
- Farbschema: `EinstellungenClient.tsx:208–254`
- Erscheinungsbild: `EinstellungenClient.tsx:256–290`
- Export: `EinstellungenClient.tsx:292–360`
- Import: `EinstellungenClient.tsx:362–Ende`

---

## Phase 1: Demo-Modus entfernen

**Ziel:** Alle Demo-Spuren aus dem Codebase löschen. Leerer Zustand im Dashboard.

### Aufgaben

**1a — Komponenten löschen**
```
src/components/layout/DemoBanner.tsx  →  löschen
src/components/dashboard/DemoProfileCard.tsx  →  löschen
```

**1b — isDemo aus Profile-Typ entfernen**
Datei: `src/types/profile.ts`
- Zeile 28: `isDemo?: boolean` löschen

**1c — isDemo-Checks aus allen Seiten entfernen**

Für jede Seite mit DemoBanner-Muster (journal, statistiken, kalender, tpc, strategien, bots/performance):
- `import DemoBanner from ...` löschen
- `{activeProfile.isDemo && <DemoBanner />}` löschen

Für Dashboard (`src/app/dashboard/page.tsx`):
- `import DemoBanner from ...` löschen
- `const onlyDemo = profiles.every(p => p.isDemo)` löschen
- `{onlyDemo && <DemoBanner />}` löschen

Für Bridge-Seiten (bridge/page.tsx, bridge/trades, bridge/log, bridge/analyse):
- `const profiles = allProfiles.filter(p => !p.isDemo)` → `const profiles = allProfiles`
- `if (!activeProfile || activeProfile.isDemo) {` → `if (!activeProfile) {`

Für API-Routen:
- `src/app/api/profiles/route.ts`: `.filter(p => !p.isDemo)` entfernen
- `src/app/api/bridge/info/route.ts`: `.filter(p => !p.isDemo)` entfernen

Für Journal-Komponenten:
- `src/components/journal/JournalClient.tsx:430`: `profiles.filter(p => !p.isDemo)` → `profiles`
- `src/components/journal/BotImportModal.tsx:225`: `profiles.filter(p => !p.isDemo)` → `profiles`

**1d — Empty State im Dashboard**
Datei: `src/app/dashboard/page.tsx`

Wenn `profiles.length === 0`: Statt Dashboard-Inhalt eine Karte anzeigen:
```tsx
if (profiles.length === 0) {
  return (
    <main ...>
      <EmptyProfileState />
    </main>
  )
}
```

Neue Datei: `src/components/dashboard/EmptyProfileState.tsx`
- Karte mit Titel "Noch kein Profil vorhanden"
- Text "Erstelle dein erstes Profil um deine Trades zu verfolgen."
- Button "Profil erstellen" → öffnet `ProfileSetupModal`
- Stil: analog zu bestehenden Dashboard-Karten (surface, border, rounded-2xl)

### Verifikation Phase 1
```bash
# Kein isDemo mehr im src/-Verzeichnis
grep -r "isDemo" src/
# → soll keine Treffer liefern

# Keine DemoBanner-Imports mehr
grep -r "DemoBanner" src/
# → soll keine Treffer liefern

# TypeScript-Check
npx tsc --noEmit
```

---

## Phase 2: Einstellungen mit Tabs

**Ziel:** `EinstellungenClient.tsx` bekommt Tab-Navigation. Profile-Tab enthält Profilverwaltung.

### Aufgaben

**2a — Tab-State und URL-Hash**
In `EinstellungenClient.tsx`:

```tsx
type Tab = 'darstellung' | 'dashboard' | 'profile' | 'daten'

const [activeTab, setActiveTab] = useState<Tab>(() => {
  if (typeof window === 'undefined') return 'darstellung'
  const hash = window.location.hash.replace('#', '') as Tab
  return ['darstellung', 'dashboard', 'profile', 'daten'].includes(hash) ? hash : 'darstellung'
})

function handleTabChange(tab: Tab) {
  setActiveTab(tab)
  window.history.replaceState(null, '', `/einstellungen#${tab}`)
}
```

**2b — Tab-Leiste (UI)**
Oben in der Render-Ausgabe, vor allen Sections:

```tsx
const TABS: { id: Tab; label: string }[] = [
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'profile',     label: 'Profile' },
  { id: 'daten',       label: 'Daten' },
]
```

Stil: Horizontale Pill-Buttons. Aktiver Tab: `background: var(--accent-bg)`, `color: var(--accent)`, `border: 1px solid var(--accent)`. Inaktiv: `background: var(--surface-2)`, `color: var(--text-2)`.

**2c — Inhalte hinter Tabs**

Bestehende Sections werden in Tab-Blöcke eingesetzt:

- **darstellung**: Farbschema-Section + Erscheinungsbild-Section (bereits vorhanden)
- **dashboard**: Statistik-Panels-Section + Börsen-Sessions-Section (bereits vorhanden)
- **daten**: Export-Section + Import-Section (bereits vorhanden)
- **profile**: Neue Profil-Listendarstellung (siehe 2d)

**2d — Profile-Tab Inhalt**

Neue Profilliste direkt in `EinstellungenClient` (kein ProfileSwitcher):

```
Für jedes Profil:
  - Farb-Dot (3x3, Profilfarbe, rounded-full)
  - Name (font-semibold, text-1)
  - Typ-Badge ("Live" grün / "Demo" akzent-farbig)
  - Broker (text-3, klein)
  - "Aktiv"-Checkmark (var(--accent)) wenn profile.id === activeProfile.id
  - Hover: Edit-Button (Pencil) → öffnet ProfileEditModal
  - Hover: Delete-Button (Trash2) → bestehenden Confirm-Dialog verwenden

Unten: "Neues Profil erstellen"-Button → öffnet ProfileSetupModal
```

Profil wechseln: Klick auf Profil-Zeile (nicht Edit/Delete) → `switchProfileAction(profile.id)` + `router.refresh()`

`EinstellungenClient` bekommt `activeProfile: Profile | null` als neue Prop.  
Die Seite `src/app/einstellungen/page.tsx` muss `activeProfile` übergeben (bereits über `getActiveProfile()` verfügbar).

**2e — Confirm-Dialog für Profil löschen**
Den bestehenden Confirm-Dialog-Code aus `ProfileSwitcher.tsx` (Zeilen 229–295) in `EinstellungenClient` übernehmen. Portal + AnimatePresence-Muster identisch lassen.

### Verifikation Phase 2
- App starten, Einstellungen öffnen → 4 Tabs sichtbar
- `/einstellungen#profile` im Browser → öffnet direkt den Profile-Tab
- Profil wechseln im Profile-Tab → aktives Profil ändert sich
- Profil löschen → Confirm-Dialog erscheint

---

## Phase 3: Sidebar-Pill vereinfachen

**Ziel:** Pill wird zum reinen Indikator + Navigations-Button zu Einstellungen.

### Aufgaben

**3a — State und ProfileSwitcher entfernen**
Datei: `src/components/layout/Sidebar.tsx`

- `import ProfileSwitcher from ...` entfernen
- `const [showProfileSwitcher, setShowProfileSwitcher] = useState(false)` entfernen
- Den `{showProfileSwitcher && ...}` Block (Zeilen 243–247) entfernen

**3b — Pill zu Navigations-Button umbauen**
- `import { useRouter } from 'next/navigation'` hinzufügen (falls nicht vorhanden)
- Die klickbare `div` (Zeile 213) wird zu `<button type="button">` 
- `onClick`: `router.push('/einstellungen#profile')`
- `ChevronDown`-Icon (Zeile 240) durch `Settings`-Icon aus `lucide-react` ersetzen
- Bleistift-Button (Zeilen 232–239) entfernen

**3c — Kollabierter Modus**
Der Avatar-Button im kollabierten Zustand (Zeile 262):
- `onClick`: `router.push('/einstellungen#profile')`

### Verifikation Phase 3
- Sidebar-Pill anklicken → navigiert zu `/einstellungen#profile`
- Kein Dropdown öffnet sich mehr
- Settings-Icon sichtbar in der Pill
- Collapsed-Avatar-Klick → navigiert ebenfalls

---

## Phase 4: Aufräumen

**Ziel:** Nicht mehr verwendete Komponente löschen, TypeScript verifizieren.

### Aufgaben

**4a — ProfileSwitcher löschen**
```
src/components/profile/ProfileSwitcher.tsx  →  löschen
```

Vor dem Löschen: `grep -r "ProfileSwitcher" src/` muss 0 Treffer liefern.

**4b — data/profiles.json bereinigen (optional)**
Wenn `demo001` noch in `data/profiles.json` liegt: manuell entfernen oder via App löschen.

**4c — Finaler TypeScript-Check**
```bash
npx tsc --noEmit
```

---

## Phase 5: Verifikation (End-to-End)

### Checkliste

- [ ] `grep -r "isDemo" src/` → 0 Treffer
- [ ] `grep -r "DemoBanner" src/` → 0 Treffer  
- [ ] `grep -r "DemoProfileCard" src/` → 0 Treffer
- [ ] `grep -r "ProfileSwitcher" src/` → 0 Treffer
- [ ] `npx tsc --noEmit` → 0 Fehler
- [ ] App starten (`npm run dev`)
- [ ] Dashboard leer (kein Profil) → Empty State sichtbar
- [ ] Profil erstellen über Empty State → Dashboard zeigt Daten
- [ ] Sidebar-Pill → navigiert zu Einstellungen Profile-Tab
- [ ] Profile-Tab: aktives Profil markiert, Wechseln funktioniert
- [ ] Profile-Tab: Profil löschen → Confirm-Dialog, dann weg
- [ ] Einstellungen Tabs: alle 4 Tabs funktionieren
- [ ] `/einstellungen#profile` als direkter Link → öffnet Profile-Tab
- [ ] Bridge-Seiten laden ohne Fehler (kein isDemo-Filter mehr)

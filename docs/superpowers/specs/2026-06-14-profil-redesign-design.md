# Design: Profil-System Neugestaltung

**Datum:** 2026-06-14  
**Status:** Genehmigt  

---

## Kontext

AlphaTrack hatte ein "Demo-Modus"-Konzept (isDemo-Flag, DemoBanner, DemoProfileCard), das Erstnutzern Beispieldaten zeigen sollte. Dieses Konzept wird ersetzt: Profile entsprechen echten MetaTrader-Konten (1 Echtgeld + bis zu 5 Spielgeld-Konten beim selben Broker). Außerdem hatte die Sidebar einen doppelten Toggle-Bug beim Profil-Switcher.

---

## Ziele

1. Demo-Modus vollständig entfernen
2. Profil-Verwaltung in die Einstellungen verschieben (Wechseln ist eine seltene Aktion)
3. Einstellungen mit Tabs strukturieren (statt alles untereinander)
4. Sidebar-Pill als reinen Indikator behalten, ohne Dropdown
5. Leerer Zustand beim ersten Start ohne Demo-Daten

---

## Abschnitt 1: Demo-Modus entfernen

### Was wird gelöscht

- `src/components/layout/DemoBanner.tsx` — komplett löschen
- `src/components/dashboard/DemoProfileCard.tsx` — komplett löschen
- `isDemo?: boolean` — aus `Profile`-Typ in `src/types/profile.ts` entfernen

### Was wird bereinigt

Alle `isDemo`-Checks in folgenden Dateien entfernen:
- `src/app/dashboard/page.tsx` — `onlyDemo`-Variable + `DemoBanner`-Import
- `src/app/journal/page.tsx`
- `src/app/statistiken/page.tsx`
- `src/app/kalender/page.tsx`
- `src/app/tpc/page.tsx`
- `src/app/strategien/page.tsx`
- `src/app/bots/performance/page.tsx`
- `src/app/bridge/page.tsx` — `filter(p => !p.isDemo)` + isDemo-Guard
- `src/app/bridge/trades/page.tsx`
- `src/app/bridge/log/page.tsx`
- `src/app/bridge/analyse/page.tsx`
- `src/app/api/profiles/route.ts`
- `src/app/api/bridge/info/route.ts`
- `src/components/journal/JournalClient.tsx`
- `src/components/journal/BotImportModal.tsx`

### Leerer Zustand (Empty State)

Wenn `profiles.length === 0`, zeigt das Dashboard eine schlichte Karte:
- Titel: "Noch kein Profil vorhanden"
- Text: "Erstelle dein erstes Profil um deine Trades zu verfolgen."
- Button: "Profil erstellen" → öffnet `ProfileSetupModal`

Die bestehende `ProfileSetupModal`-Komponente wird wiederverwendet.

---

## Abschnitt 2: Sidebar-Pill

### Vorher

Die Pill in `src/components/layout/Sidebar.tsx` hat einen `showProfileSwitcher`-State, der bei Klick den `ProfileSwitcher` als Dropdown einblendet. Der `ProfileSwitcher` hat intern nochmals einen eigenen Toggle → doppelter Aufklapp-Bug.

### Nachher

- `showProfileSwitcher`-State entfernen
- `ProfileSwitcher`-Import aus der Sidebar entfernen
- Bleistift-Button (Edit) entfernen
- Die Pill-`div` wird zu einem `<button>` der via `useRouter().push('/einstellungen#profile')` navigiert
- `ChevronDown`-Icon wird durch ein `Settings`-Icon (`lucide-react: Settings`) ersetzt, um den Navigationscharakter zu verdeutlichen
- Darstellung bleibt: Profilfarbe-Avatar, Name, Typ + Broker

### Kollabierter Modus

Der Avatar-Button im kollabierten Zustand navigiert ebenfalls zu `/einstellungen#profile`.

---

## Abschnitt 3: Einstellungen mit Tabs

### Tab-Struktur

| Tab-ID | Label | Inhalt |
|---|---|---|
| `darstellung` | Darstellung | Hell/Dunkel-Toggle + Farbschema (Accent Themes) |
| `dashboard` | Dashboard | Statistik-Panels (Checkboxen) + Börsen-Sessions (Checkboxen) |
| `profile` | Profile | Profilliste mit aktivem Profil, Wechseln, Erstellen, Löschen |
| `daten` | Daten | ZIP-Export + ZIP-Import |

**Standard-Tab:** `darstellung`  
**Deep-Link:** Aktiver Tab wird per URL-Hash gespeichert (`/einstellungen#profile`). Beim Laden der Seite wird der Hash ausgelesen und der entsprechende Tab aktiviert.

### Tab-Navigation (UI)

- Horizontale Tab-Leiste oben in `EinstellungenClient`
- Stil: Pill-Buttons, aktiver Tab mit `var(--accent)` Farbe
- Auf Mobile: scrollbar horizontal

### Profile-Tab

Zeigt alle Profile als Liste. Jeder Eintrag:
- Profilfarbe-Dot + Name + Typ-Badge (Live/Demo) + Broker
- "Aktiv"-Checkmark beim aktiven Profil
- Klick auf Profil → wechselt aktives Profil (via `switchProfileAction`)
- Hover-Buttons: Bearbeiten (öffnet `ProfileEditModal`) + Löschen (bestehender Confirm-Dialog)
- "Neues Profil erstellen"-Button unten → öffnet `ProfileSetupModal`

Der bestehende `ProfileSwitcher` wird **nicht** im Profil-Tab wiederverwendet — stattdessen eine neue, einfachere Listenansicht direkt in `EinstellungenClient`.

---

## Technische Randnotizen

- `ProfileSwitcher`-Komponente kann nach der Migration gelöscht werden (wird nirgends mehr verwendet)
- `src/app/api/profiles/route.ts` — `filter(p => !p.isDemo)` entfernen; alle Profile werden zurückgegeben
- `src/lib/profiles.ts` — keine Änderung nötig (isDemo war nur ein optionales Feld)
- `data/active.json` bleibt unverändert; beim Laden: wenn `activeProfileId` nicht in `profiles.json` existiert, wird das erste Profil als aktiv gesetzt (Fallback bereits in `deleteProfile` vorhanden)

---

## Was nicht geändert wird

- `ProfileSetupModal` — bleibt unverändert
- `ProfileEditModal` — bleibt unverändert  
- `src/lib/profiles.ts` — CRUD-Logik bleibt unverändert
- Alle anderen Seiten (Bridge, Bots, Journal etc.) — nur isDemo-Checks entfernen, sonst nichts

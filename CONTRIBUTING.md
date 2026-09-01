# Beitragen zu AlphaTrack

Danke für dein Interesse an AlphaTrack. Fehler, Ideen, direkte Fixes: hier steht,
wie das am einfachsten läuft.

## Fehler melden

Fehler gefunden? Öffne ein [Issue](https://github.com/G99SEMAN/AlphaTrack/issues/new)
und beschreib kurz:

- Was ist passiert, was hättest du erwartet?
- Schritte zum Reproduzieren
- Falls hilfreich: Screenshot, Browser/OS, relevante Logs

## Feature-Wünsche

Fehlt dir etwas? Auch dafür reicht ein Issue: kurz beschreiben, was du dir
wünschst und warum.

## Code beitragen (Pull Request)

1. Repository forken
2. Branch anlegen: `git checkout -b feature/mein-feature` bzw. `fix/mein-fix`
3. Lokal einrichten und entwickeln:
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev
   ```
4. Änderung committen und pushen
5. Pull Request gegen `main` öffnen und kurz beschreiben, was und warum geändert wurde

### Ein paar Hinweise zum Projekt

- **Sprache:** Code-Kommentare/Doku sind auf Deutsch gehalten, bitte dabei bleiben
- **TypeScript:** `npx tsc --noEmit` sollte fehlerfrei durchlaufen
- **Keine automatisierte Testsuite.** Änderungen werden manuell im Browser
  (`npm run dev`) verifiziert. Beschreib in deinem PR kurz, wie du getestet hast
- **Datenhaltung:** Alle Daten liegen als JSON in `data/` (siehe README).
  Schreibzugriffe bitte immer atomar (tmp-Datei + rename)

AlphaTrack ist in erster Linie mein persönliches Projekt, deshalb kann die
Review-Zeit für Pull Requests schwanken. Ich schau mir aber jeden Beitrag an.

## Fragen?

Bei Unklarheiten einfach ein Issue mit deiner Frage aufmachen.

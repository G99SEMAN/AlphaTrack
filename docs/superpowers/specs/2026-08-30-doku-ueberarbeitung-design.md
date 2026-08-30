# Doku-Überarbeitung für Public-Release (Vorbereitung Public-Release, Teil 2/4)

**Datum:** 2026-08-30
**Status:** Approved
**Quelle:** Nutzeranfrage "Projekt öffentlich machen" — Teilprojekt 2 von 4 (siehe Kontext)

## Kontext

Teilprojekt 1 (Secrets-Bereinigung + MT5-Credential-Handling) ist vollständig abgeschlossen: Git-Historie bereinigt, Credentials rotiert, Force-Push + NAS-Reparatur durchgeführt und verifiziert (siehe `docs/superpowers/specs/2026-08-29-secrets-cleanup-mt5-credentials-design.md`).

Dieses Spec deckt Teilprojekt 2 ab: sicherstellen, dass alle `.md`-Dateien aktuell sind, und entscheiden, was von der Doku überhaupt öffentlich sichtbar sein soll.

**Hinweis zur Selbstbezüglichkeit:** Dieses Spec-Dokument liegt in `docs/superpowers/specs/`, einem Verzeichnis, das laut diesem Spec selbst aus dem Git-Tracking entfernt wird (siehe Abschnitt 1). Das ist beabsichtigt, nicht widersprüchlich — die Datei dient während der Entwicklung als Planungsartefakt und wird beim Ausführen von Task 1 dieses Plans zusammen mit allen anderen `docs/superpowers/plans`- und `specs`-Dateien (inkl. der von Teilprojekt 1) untracked, bleibt aber lokal erhalten.

Bestandsaufnahme der `.md`-Dateien im Repo, grob in drei Kategorien:

1. **Öffentlich relevant:** `README.md`, `SETUP.md`, `TODO.md`, `docs/BRIDGE_PROTOCOL.md`, `docs/DEPLOYMENT.md`, `bots/CLAUDE.md`, `bots/*/strategy.md`, `CLAUDE.md`
2. **Interne KI-Arbeitsartefakte:** `.planning/**` (82 getrackte Dateien — Architektur-/Phasen-Dokumentation aus früheren Sessions), `docs/superpowers/plans/**` + `docs/superpowers/specs/**` (27 getrackte Dateien)
3. **Claude-Code-Infrastruktur:** `.claude/skills/*/SKILL.md`, `.claude/agents/*.md` — bleiben unangetastet, nicht Teil dieses Specs

Zusätzlich gefunden: `.claude/worktrees/wave-manifest.json` ist getrackt — eine verwaiste Reststandsdatei eines längst abgeschlossenen Feature-Worktrees (Branch bereits gemergt).

`README.md` ist bereits recht ausgereift (Badges, Feature-Tabellen, Inhaltsverzeichnis, 428 Zeilen) und hat **bereits einen funktionierenden generischen "Schnellstart"-Abschnitt** (Zeilen 81–101: `git clone` → `npm install` → `.env.local` → `npm run dev`, keine NAS-Voraussetzung) — ein neuer Quick-Start-Abschnitt ist also NICHT nötig, anders als ursprünglich angenommen. "Vollständige Überarbeitung" bedeutet nach genauerem Lesen: echte Screenshots (aktuell keine vorhanden), eine Lizenz (aktuell keine `LICENSE`-Datei, der bestehende "Lizenz"-Abschnitt sagt sogar noch "Privates Projekt, nicht für öffentliche Verbreitung vorgesehen" — das wird nach der Veröffentlichung falsch), und eine Korrektur der "Datenspeicherung"-Sektion (siehe unten). `SETUP.md`/`docs/DEPLOYMENT.md` sind inhaltlich bereits gut, brauchen nur einen Korrektheits-Check.

**Zusätzlicher Fund beim vollständigen Lesen von `README.md`:** Zeile 285 sagt *"Der `data/`-Ordner ist bewusst in Git getrackt (privates Repo, Multi-Device-Sync). Handelsdaten bleiben ausschliesslich im privaten Repository."* — diese Design-Aussage wird nach der Veröffentlichung irreführend: `data/` ist weiterhin getrackt (aktuell nur Demo-Profil-Daten, siehe Teilprojekt-1-Spec, "Nicht im Scope"), aber die Behauptung "bleiben ausschliesslich im privaten Repository" stimmt nicht mehr, sobald das Repo öffentlich ist. Mit dem Nutzer abgestimmt: siehe Entscheidungen unten.

## Entscheidungen (mit Nutzer abgestimmt)

- Zweck der Veröffentlichung: **Andere sollen das Projekt tatsächlich nutzen/installieren können** (nicht nur Portfolio-Showcase) — die README braucht daher einen vollständigen, generischen Installationspfad, nicht nur den auf die eigene NAS+Mini-PC-Infrastruktur zugeschnittenen.
- Interne KI-Arbeitsartefakte (`.planning/`, `docs/superpowers/plans+specs/`) werden aus dem öffentlichen Repo entfernt (Git-Tracking beenden, lokal bleibt alles erhalten) — kein Doku-Wert für Dritte, viel Pflegeaufwand.
- `CLAUDE.md` und `bots/CLAUDE.md` bleiben öffentlich sichtbar — üblich bei vielen Open-Source-Repos, hilft anderen (und dem Nutzer) beim Einstieg mit Claude Code, enthält nach Teilprojekt 1 keine Geheimnisse mehr.
- Lizenz: MIT, Copyright-Inhaber „G99SEMAN".
- `TODO.md` bleibt bestehen, obwohl aktuell leer (0 Zeilen) — für spätere Nutzung aufgehoben, kein Cleanup-Ziel dieses Specs.
- `SETUP.md`/`docs/DEPLOYMENT.md` bekommen nur einen Korrektheits-Check, kein Neuschreiben — sind inhaltlich bereits solide.
- **`data/`-Handhabung nach Veröffentlichung:** Der Nutzer wird für seine eigenen echten Trades künftig eine private Kopie/einen privaten Fork verwenden — in dieses öffentliche Repo werden keine echten Handelsdaten mehr gepusht. Das öffentliche Repo bleibt mit den vorhandenen Demo-Profil-Daten eine Vorlage/Demo. Die README-Aussage in der "Datenspeicherung"-Sektion wird entsprechend präzisiert (siehe Abschnitt 3), `data/` selbst bleibt technisch unverändert getrackt (kein neuer Task nötig, nur eine Doku-Korrektur).

## 1. Repo-Zusammensetzung bereinigen

Analog zum Vorgehen aus Teilprojekt 1 (`git rm --cached` + `.gitignore`-Eintrag, Dateien bleiben lokal erhalten):

- `.planning/**` (82 Dateien) — komplettes Verzeichnis aus dem Tracking nehmen
- `docs/superpowers/plans/**` + `docs/superpowers/specs/**` (27 Dateien, inkl. dieses Specs und Teilprojekt 1s Spec/Plan) — komplettes Verzeichnis aus dem Tracking nehmen
- `.claude/worktrees/wave-manifest.json` — einzelne verwaiste Datei aus dem Tracking nehmen

`.gitignore`-Ergänzung (Root):

```gitignore
# interne KI-Arbeitsartefakte - nicht fuer oeffentliches Repo (siehe docs/superpowers/specs/2026-08-30-doku-ueberarbeitung-design.md)
/.planning/
/docs/superpowers/
/.claude/worktrees/
```

## 2. LICENSE

Neue Datei `LICENSE` im Root, MIT-Lizenztext, Copyright-Zeile: `Copyright (c) 2026 G99SEMAN`.

## 3. README.md — Überarbeitung

Bestehende Struktur (Badges, Feature-Tabellen, Inhaltsverzeichnis, „Schnellstart"-Abschnitt) bleibt erhalten — der Schnellstart (Zeilen 81–101) funktioniert bereits generisch ohne NAS-Voraussetzung, hier ist **keine** Änderung nötig. Tatsächliche Änderungen:

- **Lizenz-Badge** in der bestehenden Badge-Zeile (nach dem Docker-Badge) ergänzen: `MIT License`, verlinkt auf `LICENSE`.
- **„Lizenz"-Abschnitt am Ende (Zeile 426–428) ersetzen:** Der aktuelle Text „Copyright (c) G99SEMAN - Privates Projekt, nicht für öffentliche Verbreitung vorgesehen." ist nach der Veröffentlichung falsch. Ersetzen durch einen kurzen Verweis auf die MIT-Lizenz und die `LICENSE`-Datei (z.B. „Dieses Projekt steht unter der MIT-Lizenz — siehe [LICENSE](LICENSE).").
- **„Datenspeicherung"-Abschnitt (Zeile 285) korrigieren:** Der Satz „Handelsdaten bleiben ausschliesslich im privaten Repository." wird ersetzt durch eine Klarstellung, dass die im Repo enthaltenen `data/*.json`-Dateien Demo-Profil-Daten sind (kein echtes Trading), und dass eigene, echte Handelsdaten in einer privaten Kopie/einem privaten Fork gehalten werden sollten, wenn `data/` weiterhin per Git synchronisiert werden soll.
- **Screenshots ergänzen:** Dashboard, Journal, Bridge/Bots-Übersicht — aufgenommen über den `run-alphatrack`-Skill gegen den laufenden Dev-Server, als PNG-Dateien unter `public/screenshots/readme/` abgelegt (neues Verzeichnis, getrennt von `data/screenshots/`, das echte Nutzer-Trade-Screenshots enthält) und im README per relativem Pfad eingebunden — sinnvollerweise direkt unter der Feature-Tabelle oder im „Schnellstart"-Abschnitt, damit Besucher sofort sehen, wie die App aussieht.

## 4. SETUP.md / docs/DEPLOYMENT.md — Korrektheits-Check

Kein Neuschreiben. Bei der Umsetzung prüfen:
- Sind alle referenzierten Skripte/Pfade noch aktuell (z.B. nach Teilprojekt 1s Änderungen an `.gitignore`, `bridge/config.example.json`)?
- Sind Beispiel-IPs (`192.168.178.x`) klar als Platzhalter/Beispiel erkennbar und nicht verwirrend für Fremde, die ihr eigenes Netzwerk haben?
- Verweist `SETUP.md` korrekt auf `bridge/config.example.json` als Startpunkt statt auf ein nicht mehr existierendes Vorgehen?

## 5. CLAUDE.md / bots/CLAUDE.md — Korrektheits-Check

Kurzer Check, ob nach Teilprojekt 1 noch alles stimmt (z.B. der `Env-Vars`-Abschnitt in `CLAUDE.md`, der vorher den echten API-Key als Beispielwert enthielt — jetzt durch `REDACTED-API-KEY` ersetzt, sollte durch einen sprechenderen Platzhalter wie `<dein-api-key>` ersetzt werden, da `REDACTED-API-KEY` wie ein technisches Redaction-Artefakt aussieht, nicht wie eine bewusste Doku-Konvention).

## Nicht im Scope

- `TODO.md` bleibt unverändert (leer)
- `.claude/skills/*/SKILL.md`, `.claude/agents/*.md` — keine Änderung, nicht Teil dieses Specs
- Keine inhaltliche Neupositionierung als Community-/Open-Source-Projekt (kein `CONTRIBUTING.md`, keine Issue-Templates) — reines Nutzbarmachen für Selbsthoster, keine Erwartung externer Beiträge
- `bots/*/strategy.md` — keine inhaltliche Überarbeitung, nur falls beim Check offensichtliche Fehler auffallen

## Testing / Verifikation

- `git ls-files | grep -E "^\.planning/|^docs/superpowers/|^\.claude/worktrees/"` liefert nach dem Fix keine Treffer mehr
- `LICENSE` existiert und enthält validen MIT-Text mit korrektem Copyright-Jahr/Namen
- README rendert fehlerfrei auf GitHub (Markdown-Vorschau lokal prüfen), alle Screenshots werden angezeigt, alle internen Anker-Links (Inhaltsverzeichnis) funktionieren
- Ein Nutzer ohne Vorwissen über die eigene Infrastruktur kann dem „Quick Start"-Abschnitt folgen und die App lokal zum Laufen bringen (manuell durchgespielt, kein NAS/Mini-PC nötig)
- `SETUP.md`/`docs/DEPLOYMENT.md`: keine toten Links/Verweise auf entfernte Dateien

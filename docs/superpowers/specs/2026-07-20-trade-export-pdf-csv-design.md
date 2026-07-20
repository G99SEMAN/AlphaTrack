# Design: Trade-Export (PDF-Steuerreport + CSV-Rohdaten)

**Datum:** 2026-07-20
**Status:** Approved

## Überblick

Neuer Export-Button auf der Trades-Seite (`/journal`), direkt neben dem bestehenden "Trade"-Button. Öffnet ein Modal, über das der Nutzer alle Trades eines Profils als **PDF-Steuerreport** oder als **CSV-Rohdatenexport** herunterladen kann — z.B. für die Steuererklärung (Anlage KAP) oder zur allgemeinen Dokumentation.

Hintergrund Steuerrelevanz: CFD/Forex-Gewinne bei Auslandsbrokern werden nicht automatisch ans Finanzamt gemeldet: der Trader muss Gewinne/Verluste selbst pro Kalenderjahr dokumentieren (§20 Abs. 6 EStG, Termingeschäfte). Der PDF-Report liefert dafür eine druckfähige Jahresübersicht mit Summen; das CSV liefert die vollständigen Rohdaten für eigene Auswertungen.

## Geltungsbereich (Scope)

- Export ausschließlich für das aktuell aktive Profil (kein profilübergreifender Export).
- Keine automatische Fremdwährungsumrechnung — P&L wird in der Profil-Kontowährung ausgegeben, mit Hinweistext im PDF, dass bei Nicht-EUR-Konten eine manuelle Umrechnung zum Tageskurs für die Steuererklärung nötig sein kann.
- Kein Ersatz für Steuerberatung — PDF enthält einen entsprechenden Disclaimer.
- Keine neue serverseitige Filterlogik: Die Trade-Auswahl wird komplett clientseitig bestimmt (Wiederverwendung der bestehenden Journal-Filterlogik) und als Liste von Trade-IDs an die Export-Route übergeben.

## Architektur

### Neue Dateien

| Datei | Verantwortung |
|---|---|
| `src/components/journal/ExportModal.tsx` | Modal-UI: Format-Auswahl (PDF/CSV), Jahr-Dropdown, Checkbox "aktuelle Journal-Filter übernehmen", Hinweistext, Download-Trigger |
| `src/lib/trade-export-csv.ts` | Reine Funktion `buildTradeCsv(trades, bots, strategies): string` — erzeugt CSV-String (inkl. BOM) |
| `src/lib/trade-export-pdf.tsx` | React-PDF-Dokument-Komponente + `buildTradePdf(trades, profile, year, bots, strategies): Buffer` — erzeugt PDF via `@react-pdf/renderer` |
| `src/app/api/journal/export/route.ts` | `POST` Route: liest Profil-Trades, filtert auf übergebene `tradeIds`, ruft CSV- oder PDF-Builder auf, liefert Datei als Attachment zurück |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/journal/JournalClient.tsx` | Neuer "Exportieren"-Button neben "Trade"-Button in der Toolbar; öffnet `ExportModal` mit `trades` (ungefiltert) und `filtered` (aktueller Journal-Filterstand) als Props |
| `package.json` | Neue Abhängigkeit `@react-pdf/renderer` |

## Datenfluss

1. Nutzer klickt "Exportieren" → `ExportModal` öffnet sich mit `trades` (alle Profil-Trades) und `filtered` (aktuell im Journal sichtbare Trades inkl. Such-/Status-/Richtungs-/Bot-Filter) als Props.
2. Modal berechnet verfügbare Jahre aus `trades` (`closeTime` falls vorhanden, sonst `date`), Default = aktuellstes Jahr mit Trades, sonst "Alle Jahre".
3. Nutzer wählt Format, Jahr, optional Checkbox "aktuelle Journal-Filter übernehmen".
4. Client berechnet finale Auswahl:
   - `basis = checkbox ? filtered : trades`
   - `jahrGefiltert = jahr === 'alle' ? basis : basis.filter(t => jahrVon(t) === jahr)`
   - **PDF:** `final = jahrGefiltert.filter(t => t.status === 'closed')`
   - **CSV:** `final = jahrGefiltert` (kann offene Trades inkl. Status-Spalte enthalten)
5. Client POSTet `{ format, tradeIds: final.map(t => t.id), year }` an `/api/journal/export`.
6. Route lädt `getProfileTrades(activeProfile.id)`, filtert auf die übergebenen IDs (Sicherheit: nur IDs des eigenen Profils werden berücksichtigt), erzeugt Datei, liefert sie mit passendem `Content-Type` und `Content-Disposition: attachment` zurück.
7. Client löst Download über die Response aus (Blob + `<a download>`, analog zum bestehenden ZIP-Export-Flow in den Einstellungen).

Falls `final.length === 0`: Modal zeigt Inline-Hinweis ("Keine Trades für diese Auswahl") statt den Export auszulösen.

## CSV-Format

Standard-CSV: Komma als Trennzeichen, Punkt als Dezimaltrennzeichen, ISO-Datum (`YYYY-MM-DD`), UTF-8 mit BOM (für korrekte Umlaut-Darstellung in Excel).

Spalten:

```
Datum, Schlussdatum, Instrument, Typ, Status, Entry, Exit, Size, TP, SL,
P&L, Kommission, Swap, Netto-Ergebnis, RR, Strategie, Quelle, Tags, Notizen
```

- `Typ`: "Long" / "Short"
- `Status`: "Offen" / "Geschlossen" / "Storniert"
- `Netto-Ergebnis` = `pnl - commission - swap` (nur berechnet wenn `pnl` vorhanden, sonst leer)
- `Strategie`: aufgelöster Name aus `strategies` (via `strategyId`), leer falls keine
- `Quelle`: aufgelöstes Label aus `resolveBotLabel(sourceId, bots)` (bestehende Funktion aus `bot-source.ts`)
- `Tags`: mit `;` verbundene Liste (innerhalb einer CSV-Zelle, da `,` bereits Feldtrenner ist)
- Notizen: Anführungszeichen escapen nach RFC 4180 (`"` → `""`, Feld in `"..."` wenn Komma/Zeilenumbruch/Anführungszeichen enthalten)

## PDF-Inhalt (Steuerreport)

Erzeugt mit `@react-pdf/renderer` (kein Headless-Browser, läuft ohne zusätzliche System-Dependencies im NAS-Docker-Container).

**Kopfbereich:**
- Profilname, Broker (falls vorhanden), Kontowährung
- Zeitraum (gewähltes Jahr oder "Alle Jahre")
- Exportdatum

**Zusammenfassungsbox:**
- Anzahl Trades
- Bruttogewinn (Summe positiver `pnl`)
- Bruttoverlust (Summe negativer `pnl`)
- Summe Kommission + Swap
- Netto-Ergebnis (Bruttogewinn + Bruttoverlust − Kommission − Swap)

**Tabelle** (eine Zeile pro Trade, sortiert nach Schlussdatum aufsteigend):
Datum, Instrument, Typ, Entry, Exit, Size, P&L, Kosten (Kommission+Swap), Netto

**Fußzeile:**
- Disclaimer: "Dies ist kein amtliches Steuerdokument. Bitte in Zusammenarbeit mit einem Steuerberater prüfen. Bei Fremdwährungskonten ist ggf. eine manuelle Umrechnung zum Tageskurs erforderlich."
- Seitenzahl

Mehrseitig, wenn die Tabelle nicht auf eine Seite passt (native Pagination von `@react-pdf/renderer`).

## Modal-UI (`ExportModal.tsx`)

Folgt dem bestehenden Modal-Muster (siehe `TradeModal.tsx` / `ImportModal.tsx`: `motion.div`-Overlay, `var(--surface)`-Karte, Header mit Titel + Close-Button).

Felder:
1. Format: zwei Buttons/Radio "PDF (Steuerreport)" / "CSV (Rohdaten)"
2. Jahr: `<select>` mit erkannten Jahren + "Alle Jahre"
3. Checkbox: "Aktuelle Journal-Filter übernehmen (Status, Richtung, Bot, Suche)" — immer sichtbar, Default aus
4. Hinweistext (klein, `var(--text-3)`): "Für den Steuerreport werden nur geschlossene Trades berücksichtigt."
5. Primär-Button "Exportieren" (disabled falls finale Auswahl leer → zeigt stattdessen Inline-Hinweis)

## Fehlerbehandlung

- Keine Trades in der finalen Auswahl → kein Request, Inline-Hinweis im Modal.
- Route liefert 404/leere Antwort falls keine der übergebenen `tradeIds` zum aktiven Profil gehören.
- PDF-/CSV-Generierung schlägt fehl → Route antwortet mit 500 + JSON-Fehler, Modal zeigt Fehlermeldung (Toast oder Inline), Modal bleibt offen.

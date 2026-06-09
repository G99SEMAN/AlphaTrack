# Phase 1: Datenkorrektheit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 1-Datenkorrektheit
**Areas discussed:** Datenreparatur-Strategie, Quell-Erkennungsmechanismus, Trade-Status-Erkennung, Netzwerk-Mismatch & Sync-Zähler

---

## Datenreparatur-Strategie

### Sollen bestehende Trades rückwirkend korrigiert werden?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Ja — alle korrigieren | Einmalige Migration korrigiert alle bestehenden Trades. P&L und Stats stimmen sofort. | ✓ |
| Nein — nur neue Trades | Bestehende Trades bleiben wie sie sind. Nur neue Trades werden korrekt attributiert. | |
| Teilweise — Status ja, Attribution nein | Geschlossene Trades werden korrekt markiert, aber historische Quell-Attribution bleibt unkorriert. | |

### Wo kommen die korrekten Daten her?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Bridge-Heartbeat / Live-Daten der Bridge | Bridge kennt aktuell offene MT5-Positionen. | ✓ |
| MT5-Kommentarfeld der bestehenden Trades | Aus bestehendem Kommentarfeld parsen. | |
| Manueller Reset der data/ Dateien | Testdaten löschen und neu befüllen. | |

### Wann soll die Korrektur ausgeführt werden?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Automatisch beim nächsten Bridge-Heartbeat | Beim Heartbeat werden offene Trades mit MT5-Positionen abgeglichen. | ✓ |
| Beim App-Start / Server-Start | Einmaliger Abgleich bei Neustart. | |
| Manuell per API-Endpunkt | POST /api/bridge/sync löst Korrektur aus. | |

### Was passiert mit Trades, die in MT5 nicht mehr existieren?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Als 'geschlossen' markieren | Nicht mehr in MT5-Positionen → closed. | ✓ |
| Unverändert lassen | Nur explizite Close-Events ändern Status. | |
| Gesondert markieren (z.B. 'unbekannt') | Neuer Status 'unbekannt'. | |

---

## Quell-Erkennungsmechanismus

### Wie identifiziert sich ein Bot beim Senden eines Trades?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| API-Key pro Bot | Jeder Bot hat eigenen API-Key in bots.json. isValidApiKey() bereits implementiert. | ✓ |
| Explizites botId-Feld im Payload | Bridge schickt botId im JSON-Payload. | |
| MT5-Kommentar-Parsing | Quelle steht im MT5-Kommentarfeld. | |

### Unterschied Bridge-Trade vs. Bot-Trade?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Trade-Executor = Bridge selbst, Bots = separate Instanzen | Trade-Executor ist Teil der Bridge (sourceId='bridge/tradeexecuter'). Bots sind separate Prozesse mit eigenem Key. | ✓ |
| Alle Trades kommen von Bots, kein Unterschied | Quellenunterschied nur im Kommentarfeld. | |
| Bridge-Trades haben keine botId, Bot-Trades schon | Manuelle Trades haben source=null. | |

### Wie wird die Quell-ID im Trade gespeichert?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Neues Feld 'sourceId' im Trade-Typ | sourceId: string in src/types/trade.ts. Klar und typ-sicher. | ✓ |
| Bestehendes 'comment'-Feld nutzen | Quelle in MT5-Kommentar schreiben, bei Auswertung parsen. | |
| Separate botId + isManual Felder | Zwei Felder statt einem. | |

### TRADES-03: Bridge oder AlphaTrack?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| In der Bridge (Python) — beim Ausführen des Trades | Bridge schreibt '/bridge/tradeexecuter' in MT5-Kommentar. | ✓ |
| In AlphaTrack — beim Empfangen des Trades | AlphaTrack fügt Kommentar beim Empfang hinzu. | |
| Bereits implementiert — nur prüfen | Kommentar wird möglicherweise schon gesetzt. | |

---

## Trade-Status-Erkennung

### Wie sendet die Bridge Close-Informationen?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Bridge sendet explizites Close-Event | Wenn Trade in MT5 geschlossen wird, sendet Bridge sofort POST an AlphaTrack. | ✓ |
| Bridge sendet beim Heartbeat offene Positionen | Heartbeat-Payload enthält aktuelle MT5-Positionen. | |
| AlphaTrack pollt aktiv bei der Bridge | AlphaTrack fragt regelmäßig offene Positionen ab. | |

### Welche Daten enthält das Close-Event?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| MT5-Ticket-ID + Close-Preis + Close-Zeit | Vollständige Close-Information für P&L-Berechnung. | ✓ |
| Nur MT5-Ticket-ID | Trade als geschlossen markieren ohne Exit-Preis. | |
| Weiß ich nicht genau — Bridge-Code analysieren | Researcher soll Payload analysieren. | |

### Was passiert mit alten Trades ohne Close-Event?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Heartbeat-Abgleich als Fallback | Beim Heartbeat werden offene AlphaTrack-Trades mit MT5-Positionen verglichen. | ✓ |
| Nur Close-Event zählt | Alte Trades ohne Close-Event bleiben offen. | |
| Einmalige manuelle Bereinigung | Script korrigiert alle alten Trades einmalig. | |

### Was passiert mit P&L bei Schließung?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Exit-Preis und realisierter P&L aus Close-Event übernehmen | MT5-realisierter P&L überschreibt kalkulierten Wert. | ✓ |
| P&L selbst berechnen aus Entry- und Exit-Preis | AlphaTrack berechnet aus Entry + Exit selbst. | |
| P&L unverändert lassen | Nur Status ändern, P&L bleibt. | |

---

## Netzwerk-Mismatch & Sync-Zähler

### Was zeigt die Netzwerk-Ansicht an (8 Trades)?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Netzwerk-Ansicht zeigt alle Bridge-Trades | 8 total, davon 1 Bot-Trade, 7 Trade-Executor-Trades. | |
| Unterschiedliche Aggregationslogik (Bug) | Zwei Ansichten zählen unterschiedlich. | |
| Weiß ich nicht genau — Code analysieren | Researcher soll netzwerk/page.tsx analysieren. | ✓ |

### Was soll NET-01 bewirken?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Bot-Ansicht zeigt nur Bot-spezifische Trades | Korrekte sourceId-Attribution behebt Mismatch automatisch. | ✓ |
| Gleiche Trade-Gesamtzahl in Bridge und Bot | Beide Ansichten gleiche Gesamtzahl. | |
| Bridge-Ansicht aufgeschlüsselt nach Quelle | Bridge zeigt Trade-Executor + Bot-A + Bot-B. | |

### Was ist der Sync-Zähler?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Heartbeat-Zähler in Bridge-UI | Läuft bei jedem Heartbeat hoch. | |
| Synced-Feld in Bot-Karte | Hochzählender Trades-Zähler. | |
| Weiß ich nicht genau — im Code suchen | Researcher soll nach 'sync'/'synced' suchen. | ✓ |

### Wie SYNC-01 beheben?
| Option | Beschreibung | Ausgewählt |
|--------|-------------|------------|
| Researcher analysiert zuerst, dann entscheiden | Erst verstehen, dann entscheiden. | |
| Zähler komplett entfernen falls kein Mehrwert | Analog BOTS-02 (leeres Synced-Feld). | ✓ |
| Zähler auf 0 zurücksetzen + Logik fixen | Reset + korrigierte Zähllogik. | |

---

## Claude's Discretion

Keine — alle Entscheidungen wurden explizit vom User getroffen.

## Deferred Ideas

Keine — Diskussion blieb innerhalb des Phase-1-Scopes.

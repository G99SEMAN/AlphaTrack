# AlphaTrack Project Redesign — Agent Specification

## Meta
- **Projekt:** AlphaTrack
- **Dokument-Typ:** Redesign-Spezifikation (maschinenlesbar)
- **Gültigkeitsbereich:** Gesamtes Projekt
- **Priorität:** Alle Punkte sind verbindlich umzusetzen

---

## 1. Architektur & Schnittstellen

### 1.1 Komponenten-Übersicht

| Komponente   | Rolle                                    | Startreihenfolge |
|--------------|------------------------------------------|------------------|
| AlphaTrack   | Haupt-UI & Steuerungsebene               | 1 (läuft immer zuerst) |
| Bridge       | Vermittler zwischen AlphaTrack/Bots und MetaTrader5 | 2 |
| Bot(s)       | Beliebig viele, starten nach der Bridge  | 3+ (n Instanzen) |
| MetaTrader5  | Trade-Ausführung                         | extern           |

> ⚠️ **Wichtig:** Bot ≠ Bridge. Diese Unterscheidung muss im gesamten Codebase, in allen Variablen, Klassen, Logs, UI-Labels und Kommentaren konsequent eingehalten werden.

### 1.2 Verbindungsaufbau (Auto-Connect)

- Verbindungen bauen sich **automatisch** auf, sobald die jeweiligen Terminals gestartet werden.
- Startreihenfolge ist zwingend: AlphaTrack → Bridge → Bot(s)
- Kein manueller Verbindungsaufbau durch den Benutzer erforderlich.

---

## 2. Identifikation & Registrierung

### 2.1 Bridge

- Die Bridge besitzt eine **einzigartige, statische ID** (z. B. UUID oder konfigurierbar).
- AlphaTrack identifiziert die Bridge ausschließlich über diese ID.
- Ohne gültige Bridge-ID ist keine Bridge-Verbindung zulässig.

### 2.2 Bots

- Jeder Bot muss sich bei der Bridge mit einem **einzigartigen Identifier** registrieren.
- Erst nach erfolgreicher Registrierung lässt die Bridge Kommunikation vom/zum Bot zu.
- AlphaTrack zeigt jeden Bot über **ID + Name** an, sodass der Benutzer sofort erkennt, welcher Bot in AlphaTrack welchem laufenden Bot entspricht.

### 2.3 ID-Anforderungen (gilt für Bridge und alle Bots)

```
Pflichtfelder pro Teilnehmer:
- id:      string   # einzigartig, unveränderlich zur Laufzeit
- name:    string   # menschenlesbar, konfigurierbar (nur in AlphaTrack)
- type:    enum     # "bridge" | "bot"
- ip:      string   # aktuelle IP-Adresse
- port:    integer  # verwendeter Port
- latency: number   # aktuelle Latenz in ms (live)
```

---

## 3. Terminal-Layouts

### 3.1 Statisches Layout (Pflicht für alle Terminals)

Jedes Terminal (Bridge-Terminal und Bot-Terminals) **muss** eine feste Maske (Header-Bereich) anzeigen, die folgende Informationen enthält:

| Feld              | Bridge-Terminal | Bot-Terminal |
|-------------------|-----------------|--------------|
| Eigene ID         | ✅               | ✅            |
| Name              | ✅               | ✅            |
| IP & Port         | ✅               | ✅            |
| Latenz            | ✅               | ✅            |
| Verbindungsstatus zu AlphaTrack | ✅ | ✅          |
| Verbindungsstatus zur Bridge    | ❌ | ✅          |
| Verbindungsstatus zu Bots (Liste) | ✅ | ❌        |
| Verbindungsstatus zu MetaTrader5 | ✅ | ❌        |
| MetaTrader5 Balance | ✅             | ❌           |
| Offene Trades dieses Bots | ❌      | ✅           |

### 3.2 Log-Trennung (strikt einzuhalten)

- **Bridge-Terminal:** Zeigt **ausschließlich** Bridge-relevante Logs.
  - Erlaubt: Verbindungsaufbau/-abbruch, Verbindungsstatus (AlphaTrack, Bots, MT5), weitergeleitete Trades (ohne Bot-interne Daten), MT5-Fehler (mit Bot-Referenz)
  - Verboten: Bot-interne Logs, Bot-Strategie-Ausgaben
- **Bot-Terminal:** Zeigt **ausschließlich** Bot-relevante Logs.
  - Erlaubt: eigene Verbindungsmeldungen, eigene Trade-Ereignisse, eigene Fehler, Fehlermeldungen von MT5 **die diesen Bot betreffen**
  - Verboten: Logs anderer Bots, Bridge-interne Logs
- **Keine doppelten Log-Einträge** über Komponentengrenzen hinweg.

---

## 4. Trade-Routing & Fehlerbehandlung

### 4.1 Trade-Weiterleitung (Bridge → MetaTrader5)

- Die Bridge leitet alle Trades der Bots **so schnell wie möglich (minimale Latenz)** an MetaTrader5 weiter.
- Jeder weitergeleitete Trade muss **eindeutig dem sendenden Bot zugeordnet** bleiben (Bot-ID als Metadatum).
- Die Zuordnung muss auch nach Ausführung im MT5 nachvollziehbar sein.

### 4.2 Fehlerbehandlung bei MT5-Fehlern

```
Wenn MetaTrader5 einen Trade ablehnt oder nicht ausführen kann:
  1. Bridge empfängt Fehlermeldung von MT5
  2. Bridge identifiziert den zugehörigen Bot (via Trade-Metadatum)
  3. Bridge leitet Fehlermeldung SOFORT an den entsprechenden Bot weiter
  4. Bot zeigt Fehlermeldung in seinem Terminal an
  5. AlphaTrack spiegelt die Fehlermeldung in der Bot-Log des entsprechenden Bots
```

---

## 5. Bot-Grundgerüst (Skill-Anforderung)

### 5.1 Anforderung

- Jeder Bot, der neu erstellt wird, **muss** auf einem gemeinsamen Grundgerüst basieren.
- Das Grundgerüst stellt sicher:
  - sofortige Erkennbarkeit im Netzwerk (ID-System, Auto-Registration)
  - reibungslose Kommunikation über die Bridge
  - korrektes Terminal-Layout (siehe Abschnitt 3)
  - korrekte Log-Trennung (siehe Abschnitt 3.2)

### 5.2 Skill-Erstellung (Aufgabe für den Agent)

```
AUFGABE: Erstelle mit dem SkillCreator-Skill einen neuen Skill "bot-scaffold",
der bei der Erstellung eines neuen Bots angewendet wird.

Der Skill muss folgendes abdecken:
- Grundstruktur eines Bots (ID, Name, Type="bot")
- Auto-Registration bei der Bridge beim Start
- Statisches Terminal-Layout (Header-Maske)
- Log-Filter (nur bot-relevante Logs)
- Trade-Sending mit Bot-ID als Metadatum
- Empfang und Anzeige von MT5-Fehlermeldungen
```

---

## 6. AlphaTrack UI — Funktionsregeln

### 6.1 Steuerungsebene

- AlphaTrack ist die **einzige Stelle**, über die Benutzerinteraktionen stattfinden.
- Funktionen wie z. B. Namensänderungen von Bots oder der Bridge dürfen **nur in AlphaTrack** implementiert werden.

### 6.2 Grundsatz: Funktion vor Feature

- Eine Funktion darf in AlphaTrack **nur dann existieren**, wenn sie einen echten Zweck erfüllt.
- Keine UI-Elemente ohne konkrete Funktion (kein "nice to have" ohne Nutzen).

### 6.3 Pflicht-Ansichten in AlphaTrack

| Ansicht             | Inhalt                                                  |
|---------------------|---------------------------------------------------------|
| Bridge-Übersicht    | Bridge-ID, Name, Verbindungsstatus, MT5-Balance, Log-Spiegel des Bridge-Terminals |
| Bot-Liste           | Alle registrierten Bots mit ID + Name                  |
| Bot-Detailansicht   | Bot-ID, Name, Status, offene Trades, Bot-Log (gespiegelt vom Bot-Terminal) |

---

## 7. Checkliste für den Agent (Abarbeitungsreihenfolge)

```
[ ] 1. Komponenten-Differenzierung prüfen: Bot ≠ Bridge in allen bestehenden Dateien
[ ] 2. ID-System implementieren (Bridge + Bots)
[ ] 3. Auto-Registration der Bots bei der Bridge implementieren
[ ] 4. Statisches Terminal-Layout für Bridge-Terminal erstellen
[ ] 5. Statisches Terminal-Layout für Bot-Terminal erstellen
[ ] 6. Log-Trennung implementieren (Bridge-Logs vs. Bot-Logs, keine Duplikate)
[ ] 7. Trade-Routing mit Bot-ID-Metadatum implementieren
[ ] 8. MT5-Fehlerweiterleitung (Bridge → Bot → AlphaTrack) implementieren
[ ] 9. SkillCreator-Skill aufrufen → Skill "bot-scaffold" erstellen
[ ] 10. AlphaTrack UI: Bridge-Übersicht, Bot-Liste, Bot-Detailansicht implementieren
[ ] 11. AlphaTrack UI: Namensänderung für Bridge und Bots implementieren
[ ] 12. Verbindungsaufbau-Automatismus testen (Startreihenfolge: AlphaTrack → Bridge → Bot)
```

---

## 8. Constraints & Nicht-Verhandelbare Regeln

```yaml
constraints:
  - id: C1
    regel: "Bot ist nicht Bridge. Diese Trennung gilt überall: Code, Logs, UI, Kommentare."
  - id: C2
    regel: "Logs dürfen nicht über Komponentengrenzen hinweg doppelt erscheinen."
  - id: C3
    regel: "MT5-Fehler müssen sofort (synchron/near-realtime) zum verursachenden Bot durchgereicht werden."
  - id: C4
    regel: "Jeder Trade muss mit der Bot-ID als Metadatum annotiert sein, bevor er die Bridge passiert."
  - id: C5
    regel: "Funktionen in AlphaTrack nur wenn sie einen echten Zweck erfüllen."
  - id: C6
    regel: "Jeder neue Bot muss den 'bot-scaffold' Skill verwenden."
  - id: C7
    regel: "Verbindungsaufbau ist vollständig automatisch — kein manueller Eingriff des Benutzers."
```

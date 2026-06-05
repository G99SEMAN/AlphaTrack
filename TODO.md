- Redesign:
  - Schnittstelle
    - Die Bridge ist die Verbindung von MetaTrader5 und AlphaTrack zu den Bots
    - Die Verbindung baut sich automatisch auf sobald die entsprechenden Terminals sich öffen (AlphaTrack läuft immer als erstes -> dann wird die Bridge gestartet -> dann werden je nach bedarf belibig viele Bots gestartet)
    - Der Terminal der Bridge muss einen Einzigartigen Namen haben, sodass Alphatrack diesen eindeutig zuordnen kann (für zb. die Bridge log, eine 1:1 spiegelung des Bridge Terminal)
    - Die Bots müssen sich ebenfalls über einen einzigartigen identifier bei der Bridge regestrieren sodass diese die Kommunikation zu alphatrack zulässt
    - alle Terminals müssen ein statisches layout besitzen, welches unter anderen die eindeutige ID, den Namen und ggf. andere wichtige Informationen (IP, Port, Latenz ...) anzeigen
    - In AlphaTrack müssen die Bridge, sowie die Bots ebenfalls über ID und Namen identifizierbar sein, sodass der Benutzer sofort sieht welcher Bot in AlphaTrack diesen wiederspiegelt.
    - Die Bridge leitet alle Trades der verschiedenen Bots möglichst unverzögert zum Metatrader weiter.
    - Wenn der Metatrader einen Trade aus verschiedenen Gründen nicht ausführen kann muss die Fehlermeldung sofort im Terminal des entsprechenden Bots angezeigt werden und somit auch in der Bot Log von AlphaTrack
    - 
  - Bots
    - Jeder Bot welcher erstellt wird muss nach dem gleichen Grundgerüst aufgebaut sein, sodass eine sofortige erkennung im Netzwerk möglich ist und die Kommunikation über die Bridge reibungslos möglich ist
    
    

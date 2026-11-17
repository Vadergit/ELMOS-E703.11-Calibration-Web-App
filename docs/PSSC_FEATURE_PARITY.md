# Original-PSSC-Funktionsvergleich – Stand v0.7.115

Datum: 17.11.2026. Basis: **Elmos E703.11** Datenblatt 25DS0170E.04, Elmos-Kalibrieranleitung und ursprüngliche PSSC-GUI. Diese Liste beschreibt **Implementierung und verbleibende Einschränkungen**; sie ist keine Freigabe des fertigen Produkts.

| Nr. | Herstellerfunktion | Stand v0.7.115 | Nächster Schritt |
|---|---|---|---|
| 01 | Alarmgrenzen/Hysterese | **Editor, RAM-Rücklesung und geschützter NVM-Schreibpfad umgesetzt** | Elektrische Prüfung am Testchip erforderlich |
| 02 | EOC-/Alarm-Verknüpfungen (ODER) | **Auswahleditor, ODER-Maske und NVM-Plan umgesetzt** | Elektrische Prüfung; physische Pin-Umschaltung bewusst nicht automatisiert |
| 03 | Fehlerreaktionen | **Sechs Aktionseditoren und Ersatzwerte mit RAM-/NVM-Schutz umgesetzt** | Reale Fehlerreaktion und High-Z am Testchip prüfen |
| 04 | EEPROM-Klartextübersicht | **Umgesetzt** für bekannte Filter, Temperaturquelle, EOC, Alarm, Post-Scaling, Limiting und Fehleraktionen | Zusätzliche Register schrittweise dekodieren; unbekannte Kombinationen nicht raten |
| 05 | Filter dauerhaft ins NVM | Nur RAM-Profil und NVM-Vergleich | Selektive, CRC-gesicherte NVM-Persistenz für dokumentierte Filter; Hardwaretest |
| 06 | Druckeinheit nach Neustart | **Umgesetzt**: lokales Profil, an Chip-UID und CRC des NVM gebunden | Anzeige bei mehreren Rechnern nur über manuell übertragenes Profil |
| 07 | Automatische DSP-Polynomordnung | Teilweise | Gegen PSSC-AUTO mit identischen Messwerten vergleichen |
| 08 | Proprietäre Original-DLL 1:1 nachbilden | **Nicht vollständig** | DLL-Golden-Vectors, Festkomma-/Rundungstests und unabhängige Referenzmessungen |
| 09 | Overall-Analogabgleich mit Istspannung | Fehlt | Externe DMM-Erfassung und Elmos-kompatibler Korrekturfit |
| 10 | Alle Temperaturquellen | Interne Diode verfügbar; andere noch gesperrt | ADC_TC, Brücke und EOC-Temperatursensor einzeln verifizieren |
| 11 | Vollständige AFE-/ADC-Spezialeinstellungen | Teilweise | Chip-Datenblatt-Parameter und sichere Ram-/NVM-Schnittstellen |
| 12 | DSP-Post-Scaling | Klartext-Dekodierung | Bearbeitung nur mit Alarm-Kollisionsschutz |
| 13 | Temperaturstabilität / Window | Teilweise Messdaten vorhanden | Dokumentierten Originalalgorithmus prüfen und implementieren |
| 14 | Class Compensation | Fehlt | Klassenmatrix, statistische Parameter und Serienvalidierung |
| 15 | Elmos-PSSC XML/HEX | Eigene JSON- und Backup-Formate | Herstellerformat-Importer mit validierter Registerzuordnung |
| 16 | I²C/Pin/Wake-up Spezialoptionen | Nur Grundfunktionen | Kein NVM-Wechsel ohne nachgewiesenen Wiederverbindungsweg |
| 17 | Parallele Konfigurationen | Profile und Archivvergleich vorhanden | Mehrfachkonfigurationsmatrix wie PSSC |
| 18 | Serien-/Massenkalibrierung | Fehlt | Fertigungsprofil, Prüfmittel, Serienlauf und Rückverfolgbarkeit |

## Wichtig: Gesichert und eingeschränkt

- Alarmgrenzen und DSP-Nachskalierung teilen sich CM-Wörter 55/56. Der aktive Modus wird anhand `CFG_EN.scale_out_en` unterschieden.
- Die EOC-ODER-Maske liegt in `CFG_PADS0`, das zugleich das One-Wire-Startfenster enthält. **Keine ungetesteten NVM-Bitänderungen.**
- Die effektiven Filterprofile stammen aus den dokumentierten Kombinationen von `CFG_ADC`, `CFG_LP0` und `CFG_LP1`. Ein nicht passendes Tripel wird als individuell, nicht als erfundene Grenzfrequenz angezeigt.
- Physikalische Druckeinheiten sind **keine** im E703.11 gespeicherte Sensorinformation. Die lokale Anzeigeprofileintragung benötigt UID und NVM-CRC und ersetzt keine Sensoridentifikation.
- Der Alarmstatus wird über `STATUS_SYNC` nur lesend abgefragt; der Wert ist ein Zeitpunktssnapshot, kein dauerhaftes kontinuierliches Live-Logging.
- Die originalen Hersteller-DLLs werden nicht öffentlich veröffentlicht. Dokumentierte Formeln und unabhängige Berechnungen dürfen nicht als bitidentische Portierung ausgegeben werden.
- Hardwaretest mit Original-PSSC/SSP3 und realem Sensor ist vor dauerhafter Freigabe der neuen Schreibfunktionen zwingend.

## Sicherheitskriterien für weitere Schritte

1. EEPROM vor Änderungen als 64-Wort-Abbild mit CRC8/CRC16 sichern und Chip-UID prüfen.
2. Jede neu freigegebene Konfigurationsart zunächst nur im RAM anwenden, gezielt zurücklesen und nachweislich wiederherstellen.
3. Vor NVM-Programmierung die zulässigen Bits whitelisten, Bootregister vergleichen und unabhängige Sensorfunktion prüfen.
4. Nach vollständigem Power-Cycle Chip-Wiederverbindung, RAM-/NVM-Lesung und reale Ausgangswerte messen.
5. Tests gegen die originale PSSC-GUI mit identischen Rohdaten durchführen; Abweichungen dokumentieren.

**v0.7.118 ergänzt die optionale Alarm-Konfiguration direkt nach Ausgang (auch geführt), den kombinierten NVM-Plan und selektive Config-Alarmprofile. Elektrische Sensorhardware-Tests sind weiterhin offen.**

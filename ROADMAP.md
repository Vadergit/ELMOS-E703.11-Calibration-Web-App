# Roadmap für den E703.11-Kalibrierassistenten

Stand v0.7.4 · Web-App mit SSP3 im Vergleich zur Elmos-PSSC-Software. Die Reihenfolge zeigt die geplante Priorität. Veröffentlichungstermine sind offen.

## DUT und Metadaten (v0.7.4)

- [x] Produkt-/DUT-Bezeichnung bei jeder Test-Log-Aufzeichnung und im Archiv.
- [x] Kompakte Übersichts- und Geräteinformationen im Logviewer.
- [x] SSP3/USB-Adapter-Firmware eindeutig von der E703.11-Chip-Version unterscheiden.
- [ ] Weitere Messgeräteanbindungen zur automatischen Erfassung externer Istspannungen.

## Logviewer und Direktwahl (v0.7.3)

- [x] Aufgabenkacheln direkt anklickbar ohne weiteren «Weiter»-Schritt.
- [x] Archivübersicht mit Schnellstatus und zusammengefassten Messdaten.
- [x] Detailansicht mit verfügbaren Rohmesswert-Kennzahlen, Trend und Fehlereignissen.
- [x] Direktvergleich von zwei Prüfprotokollen, inkl. UID- und NVM-Abweichungen.
- [ ] Performance unter sehr grossen mehrtägigen Logdateien an echten Prüfaufbauten validieren.

## Bedienung und zeitgesteuerte Tests (v0.7.2)

- [x] Archiv und Nachmessung als getrennte obere Navigationsbereiche.
- [x] Test / Logging auch in der klassischen Ansicht direkt unter EEPROM Viewer.
- [x] Eine gemeinsame Logger-Instanz zwischen geführter und klassischer Ansicht.
- [x] Einstellbare Testdauer mit Auto-Stopp, Countdown und Pause-/Fortsetzen-Funktion.
- [ ] Reale Hardwarevalidierung des Auto-Stopps bei langen USB-Lesezyklen und unterbrochenen Sensoren.

## Test-Logging (v0.7.1)

- [x] Vierte Kachel «Test / Logging» im geführten Einstieg.
- [x] Freie Abtastintervalle in Millisekunden, Einzelmessungen pro Messpunkt und deren Abstand.
- [x] Optionaler Mittelwert oder Median zusätzlich zu den vollständigen Rohsamples.
- [x] Marker, Bemerkungen, Zeitstempel, echte Messdauer und übersprungene Sollintervalle.
- [x] Lokale JSONL-Rohdaten im bestehenden Archiv mit JSON-/CSV-Gesamtexport.
- [x] Optionale tatsächliche VDD mit Quellenangabe, externe Temperatur-/Druckreferenzen.
- [ ] Echt-Hardware-Test der Abtastrate und Langzeitstabilität am SSP3 und den konkreten ESP32-Boards.
- [ ] Automatischer Anschluss externer Temperatur-/Spannungsmessgeräte.

## Bereits als Softwarefunktion umgesetzt (v0.7.0)

- [x] Lokaler Archivordner mit gemischten Dateien, Einlesen, Suche, Filter und Vergleich gültiger Kalibrierprotokolle.
- [x] Automatische Erfassung der Ausgangs-RAM-/NVM-Konfiguration bei einem protokollierten Abgleich.
- [x] Chip-/USER-ID, Web-App-/SSP3-/ESP32-Firmware, verfügbare Messwerte, Verstärkung, Versorgungsvorgaben, alle Samples, Wiederholungen und Fehler erfassen.
- [x] NVM vor/nach Programmierung inklusive CRC-Verifikation im Vorgangsprotokoll aufzeichnen.
- [x] Flexible Prüfpläne für Druck- und Temperaturhysterese, mehrfaches Hoch-/Runterfahren und frei definierbare Zyklen.
- [x] Separater Nachmessungs-Protokolltyp mit Einzelversuchen und Hystereseauswertung.
- [ ] Hardware-End-to-End-Test mit SSP3, realem Druck, Temperaturrampen und NVM-Schreibzyklus.
- [ ] Automatische Istwertübernahme der externen VDD-Spannung und Referenztemperatur (derzeit manuelle Eingabe).
- [ ] Verifizierte Umrechnung des DSP_T auf °C und freigegebene Temperatur-Toleranzprüfung.

## Als Nächstes geplant

- [ ] Elmos-PSSC-XML und Intel-HEX importieren, den Inhalt mit dem ausgelesenen Chip-NVM vergleichen und ausgewählte Konfigurationsgruppen ins Sensor-RAM übernehmen.
- [ ] CSV-Messpunkte wieder in den Kalibrierablauf einlesen.
- [ ] Nach dem NVM-Schreiben und Neustart einen geführten Prüfdurchlauf mit neuen Druck- und Temperaturmessungen anbieten. Die bestehende Registerprüfung ist bereits verfügbar.

## Weitere geplante Funktionen

- [ ] **AFE und ADC** – Temperaturquelle und Temperaturverstärkung, Brückenstromverstärkung, Signalinvertierung, ADC-Filter und Abtastmodus einstellen.
- [ ] **Temperaturkalibrierung** – ADC_TC für die Brückenwiderstandskompensation verwenden, Polynomordnung automatisch wählen, einzelne Koeffizienten vorgeben und den Assistenten über zehn Messpunkte und drei Temperaturstufen hinaus erweitern.
- [ ] **Ausgang und Alarm** – Limiting, Hysterese und Fehlersignalisierung bearbeiten, Alarmgrenzen setzen und die EOC-/Alarm-Pinbelegung konfigurieren.
- [ ] **Chip-Schnittstellen** – I²C-Adresse, Pinbelegung, Aufwachbedingungen und One-Wire-Startparameter gezielt konfigurieren. Vor der Freigabe ist zu prüfen, dass der Chip nach einem Neustart erreichbar bleibt.
- [ ] **SSP3-Prüfplatz** – Versorgungsspannung, Versorgungsstrom und Ausgangsfrequenz messen und anzeigen.
- [ ] **Serienkalibrierung** – Mehrkanal-, Chargen- und Klassenkalibrierung mit vorgegebenen Koeffizienten unterstützen.

## Am Prüfstand noch zu bestätigen

- [ ] Dauerhaft gespeicherte Brückenspannung nach einem Kaltstart bestätigen.
- [ ] Vollständiges NVM-Schreiben, Rücklesen und Wiederherstellen eines Backups am Testchip prüfen.
- [ ] Koeffizienten und DSP-Werte bei gleichen Referenzpunkten mit Elmos PSSC vergleichen.
- [ ] Ratiometrische Analogspannung, PWM und FM elektrisch prüfen.

Den aktuellen Stand der Software und der Hardwaretests dokumentiert der [Testbericht](TESTBERICHT.md).

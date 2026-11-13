# Roadmap für den E703.11-Kalibrierassistenten

Stand v0.7.0 · Web-App mit SSP3 im Vergleich zur Elmos-PSSC-Software. Die Reihenfolge zeigt die geplante Priorität. Veröffentlichungstermine sind offen.

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

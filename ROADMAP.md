# Roadmap für den E703.11-Kalibrierassistenten

Stand v0.6.49 · Web-App mit SSP3 im Vergleich zur Elmos-PSSC-Software. Die Reihenfolge zeigt die geplante Priorität. Veröffentlichungstermine sind offen.

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

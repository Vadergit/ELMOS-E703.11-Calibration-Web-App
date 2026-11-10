# ELMOS Chrome v8 – Prüfbericht (10.11.2026)

## Erreicht / geprüft

- Referenzdokumente AN 0203 und AN 0204 aus dem Entwicklerpaket sowie E703.11-Datenblatt verwendet.
- JavaScript-Syntaxprüfung bestanden, Koeffizienten-Berechnung und NVM-Konfigurationsänderungen mit automatisierten Tests geprüft.
- Chrome-Browserdemo (Playwright) bestanden.
- SSP3/1-Wire-USB-Ablauf in einem simulierten SSP3-Gerät durchlaufen: Firmwareabfrage, AFE- und ADC-Lesen, Druckpunkte, Koeffizientenfit, vollständiges NVM-Backup inkl. CRC8/CRC16, Schreiben und Rücklesen der DSP-Koeffizienten ins RAM, zwei unabhängige DSP_S-Verifikationspunkte und vollständige User-NVM-Programmierung mit abschliessendem 64-Wort-Rücklesen/CRC16 erfolgreich simuliert.
- Beim simulierten NVM-Test wurden ausschliesslich Nutzerdaten und CRC16 geschrieben, die Boot-/Werksbereiche blieben gleich.

## Ausdrücklich nicht verifiziert

1. **Kein physisches SSP3/E703.11-Board angeschlossen**: Kein End-to-End-Test der 1-Wire-, I²C-, SPI-Verbindung, der NVM-Schreib-Timings und des Chip-Verhaltens.
2. **Koeffizientenberechnung**: unabhängiger numerischer JS-Fit nach Datenblatt und AN 0203, nicht bytegenau gegen die Elmos `pssc_cal_lib.dll` verglichen.
3. **CRC8 der empfangenen 1-Wire-Nutzdaten**: die Bytes werden gelesen, aber nicht separat anhand eines herstellerbestätigten Verfahrens verifiziert. Bei externem Störsignal können plausible Antworten daher falsch interpretiert werden. Sicherer NVM-Laborbetrieb erfordert echte Validierung dieser Prüfung.
4. **Power-cycle-Nachprüfung**: Funktion im Code vorgesehen, im Simulator nicht vollständig erfolgreich verifiziert. Lokal gespeicherte Erfolgsprotokolle benötigen `localStorage` unter `localhost`/HTTPS; bei temporären Testseiten sind sie nicht verfügbar.
5. **Höhere DSP-/Temperatur-Polynomordnungen**: Mathematische Fits per Unit-Test geprüft, nicht physisch am Chip verifiziert. Es kann Überanpassung geben.
6. **I²C/SPI mit aktivierter CRC-Pflicht im Chip**: geschützter Schreiben-Zugriff wird sicherheitshalber gesperrt.

## Freigabestatus

**LABORPROTOTYP. NVM-Schreiben ist im Browser implementiert, aber noch nicht für Produktion oder unersetzbare Chips freigegeben.** Die App muss zuerst mit einem entbehrlichen Chip getestet und das vollständige Backupschema kontrolliert werden. Ein unterbrochener NVM-Schreibvorgang kann den Chip trotz unveränderter Bootregister unbrauchbar machen.

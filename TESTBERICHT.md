## RAM-Übernahme – Bedienungsfehler korrigiert (11.11.2026)

- Fehlende RAM-Schreibfreigabe wird nun direkt in Schritt 4 angezeigt statt nur in der AFE-Ansicht
- Original-NVM-Lesebefehl prüft die Voraussetzungen innerhalb der Fehlerbehandlung; Fehler erscheinen direkt unter der Sicherung
- Vollständiges NVM-Backup mit CRC-Prüfung, Fortschritt über alle 64 Wörter und separater JSON-Download vor der RAM-Übertragung
- RAM-Schreibknopf bleibt bis zu vorhandenen Koeffizienten, echter Chipverbindung, aktivierter RAM-Freigabe und geprüftem Original-NVM deaktiviert; der jeweils fehlende Schritt wird sichtbar genannt
- RAM-Übertragungsfehler oder erfolgreiche Rückleseprüfung werden direkt auf Schritt 4 angezeigt, nicht in der zunächst versteckten DSP-Prüfansicht
- Der Zustand der RAM-Freigabe ist zwischen der AFE-Seite und Schritt 4 synchronisiert
- Simulierte UI-Initialisierung, fehlende und erfüllte Freigabebedingungen, sichtbare Fehlermeldungen und Schalter-Synchronisierung getestet
- **Noch nicht real getestet:** NVM-Backup, Schreiben und Rücklesen der DSP-Koeffizienten am physischen SSP3/E703.11

## Konfigurierbare DSP-Prüfung – Änderungsprüfung 11.11.2026

- Anzahl unabhängiger Prüfdrucke im UI auf 1–10 einstellbar; Standard 1
- Bei gültiger DSP_S-Messung innerhalb der Toleranz wird die NVM-Navigation bei Anzahl 1 nach dem ersten Prüfpunkt freigeschaltet (sofern übrige Voraussetzungen wie NVM-Backup und gegebenenfalls Temperaturverifikation vorliegen)
- Erhöhung der Prüfpunktanzahl verwirft bisherige Prüfergebnisse und sperrt NVM erneut
- Ungültige Auswahl (0 oder mehr als 10) sperrt die Freigabe
- Bei nur einem Prüfpunkt wird ausdrücklich vor der fehlenden Vollbereichsprüfung gewarnt
- Die bestehenden Boot-/Werksregisterschutz-, Backup-, CRC-, Chip-ID- und manuellen NVM-Bestätigungen bleiben erhalten
- Simulierter UI-Initialisierungstest und Freigabe-/Sperrlogik geprüft; echte DSP_S- und NVM-Hardwaretests stehen aus

## Geführter Kalibrierablauf – Änderungsprüfung 11.11.2026

Der bisherige Pflichtschritt «Rohwert-Zwischenprüfung» vor der DSP-Berechnung wurde entfernt. Der optionale Rohwertvergleich ist nun unter Messpunkte eingeklappt und ist **nicht** als erfolgreiche Chip-Kalibrierung gekennzeichnet.

Neue Reihenfolge: **Messpunkte → Koeffizienten berechnen → NVM-Backup → DSP in RAM schreiben und rücklesen → unabhängige DSP_S-Verifikation → bewusstes NVM-Programmieren**.

**Prüfungen ohne Hardware:**

- JavaScript-Syntax und UI-Initialisierung geprüft; alle im Skript referenzierten HTML-IDs vorhanden
- Handler für USB-Portauswahl, zwei Referenzpunkte, Berechnung, RAM, DSP-Verifikation und Einheitsauswahl vorhanden
- Umstellung der Einheit auf Prozent setzt bei leerem Standardbereich den Bereich auf 0–100 und bezeichnet die Punkte mit 0 % / 100 %
- Demo-Aufnahme von zwei Referenzpunkten speichert jeweils ADC_S, ADC_T und ADC_TC mit derselben AFE-Einstellung
- Lineare Browser-Koeffizientenberechnung mit zwei simulierten Endpunkten und geeignetem Hub erfolgreich
- Schritt «DSP prüfen» wird ohne RAM-Übernahme gesperrt; «NVM» wird ohne erfolgreiche DSP-Verifikation gesperrt
- Nach simulierten Statusänderungen in RAM und Verifikation werden die nächsten Schritte freigegeben

**Nicht getestet:** Tatsächliche SSP3-Kommunikation, korrekte Koeffizientenübernahme in echten E703.11-RAM-Speicher, reale DSP_S-Messung, NVM-Programmierung und physischer Neustart. Die Bedienlogik-Tests ersetzen keine Hardwarefreigabe.

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

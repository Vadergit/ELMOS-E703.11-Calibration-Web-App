## Samples und Messwertdarstellung – UI-Regression 11.11.2026

- Gemeinsamer Messpfad für untere/obere Endpunkte und Zwischenpunkte; bisherige feste **8** bzw. **12** Samples durch den wählbaren Wert **1–100** ersetzt
- Speicherung des Medians aller ADC_S/ADC_T/ADC_TC-Samples; bei gerader Anzahl Mittelwert der beiden mittleren Messwerte
- Bei mehr als einem Sample wird die ADC_S-Spreizung (Max − Min) kontrolliert; Grenze wie bisher 350 Digits. Bei einem Sample wird darauf hingewiesen, dass eine Streuungsprüfung nicht möglich ist
- Für jede Aufnahme Live-Fortschritt; während der Aufnahme pausiert das parallele Live-Polling, danach Wiederaufnahme, falls zuvor aktiv
- Hoher Kontrast: grün umrahmte Ergebnisflächen mit ADC_S, ADC_T, Spreizung, Sample-Anzahl, Referenz und Temperatur, statt kleiner transparenter Textanzeigen
- Simulierter UI-Test: 3 Samples am unteren Endpunkt, 6 am oberen Endpunkt, 1 am Zwischenpunkt; alle drei Ergebnisflächen korrekt sichtbar; Punktanzahl vollständig und Fit-Freigabe korrekt
- Beim Löschen aller Punkte verschwinden alle Ergebniskarten und Statusanzeigen wechseln zurück auf «Noch nicht aufgenommen»
- Ungültige Anzahl (101) wird zurückgewiesen; gültige Einstellung im Browser gespeichert

**Hardwaretest ausstehend:** Das Zeitverhalten und die tatsächliche ADC-Streuung über 1–100 Samples am SSP3/E703.11 wurden noch nicht physisch überprüft.

## Separate Ausgangsänderung eines bereits kalibrierten Sensors (11.11.2026)

- Simulierter E703.11 mit vollständigem CRC8/CRC16-geprüftem NVM und erkannter UID `002056781234`
- Ohne erneute Aufnahme oder DSP-Kalibrierung Modus ratiometrisch → PWM umgestellt, Periode 16’384 Takte und passende AODO-Skalierung vorgemerkt
- Nur die dokumentierten Anwenderfelder an CM-Wortindizes 16, 22, 57 und 58 sowie CRC16 an 63 verändert
- Verifikation des NVM-Inhalts im Simulator nach Rücklesen bestanden; Factory-Bereich 0–15 und übrige Boot-/Kommunikationsregister 17–21 unverändert
- 48-Bit-Chip-UID und `AUSGANG SPEICHERN` als erforderliche Bestätigung
- Ausgangsskalierung ohne positive PWM-Werte wird vor dem Schreiben zurückgewiesen
- Der Restore-Simulatortest verwendet zusätzlich `WIEDERHERSTELLEN` und kann ohne neuen Druckabgleich die sichere User-Konfiguration eines passenden Backups wiederherstellen
- **Keine Hardwareabnahme:** AODO-Spannung, PWM/FM-Signalqualität und tatsächlicher NVM-Schreibpfad müssen an einem entbehrlichen E703.11 überprüft werden

## Expertenmodus & UID-Backups – UI-/Logikprüfung 11.11.2026

- Vollständige 48-Bit-Chipkennung VERSION + SER1 + SER0 aus simulierten Chipregistern gelesen; Wiedererkennung `002056781234` erfolgreich
- Beim vollständigen 64-Wort-NVM-Scan Backup mit CRC8/CRC16 automatisch lokal und nach UID gruppiert gespeichert
- Erneute Abfrage nach einer simulierten Benutzerwort-Änderung erzeugte zweite historische Version; automatische Restore-Auswahl findet den letzten **abweichenden** Stand
- Restore-Plan nur für dieselbe UID; Factory-/Bootbereich bleibt identisch. Im Simulator wurden ein Benutzerwort (Index 35) und CRC16 (Index 63) geschrieben/rückgelesen, mit anschliessend gültiger CRC
- NVM-Restore ohne neue Druckkalibrierung erst nach gelesenem aktuellen Chipbackup und manuellem Vergleich; finale Eingabe verlangt 48-Bit-UID und `WIEDERHERSTELLEN`
- Ausgangsmodi ratiometrisch analog, PWM, FM, Alarm, High-Z in Expertenmaske; CFG_EN.aodo_en und CFG_AODO/AODO_F/AODO_O nur durch dokumentierte, validierte Vorschläge im normalen finalen NVM-Plan beschreibbar
- Algorithmische Tests: ratiometrische und PWM-Vorschläge verändern tatsächlich Koeffizienten/CFG_AODO und erhalten korrekte CRC16; unsichere PWM-Ausgangsskalierung wird verworfen
- Factory-/Bootschreibzugriffe bleiben blockiert; vollständige EEPROM- und Registeransicht ist lesend
- CSS für aktive/hovernde blaue Schaltflächen behält kontrastreiche weisse Schrift; RAM-Freigabe-Checkboxen entfernt
- Sequenz: Berechnen → RAM-Schreiben → DSP-Prüfung → erst dann NVM-Backup/Finalprogrammierung, mit verkürzten sicheren Lese-Pollintervallen

**Kein echter Hardware-Freigabetest:** Serielles SSP3-Timing, ratiometrischer/PWM/FM-Ausgang am Pin, NVM-Programmierung und Restore am physischen Chip sind noch zu testen. Die Tests sind simulierte JavaScript-/NVM-Tests, keine Produktionsfreigabe.

## Messpunktplanung und einstellbarer DSP-Endwert – Änderungen 11.11.2026

- 2–10 Kalibrier-Messpunkte vor der Aufnahme auswählbar (Standard 2), für alle aktivierten Punkte individuelle Referenz-/Temperaturfelder und Aufnahmeknöpfe
- Automatische Vorschläge für Zwischenwerte, frei änderbar; beim Ändern der Punktanzahl werden alte Messwerte ungültig, damit keine fremden Punkte in die Koeffizientenberechnung gelangen
- JavaScript-UI mit vier simulierten Punkten und linearem Fit getestet: vollständiger Datensatz schaltet Berechnung frei
- DSP-Endwert ist nun ±1’000 bis ±32’000 Digits; bei ±30’000 sind die Koeffizienten gegenüber ±32’000 tatsächlich anders, nicht nur die Anzeige
- Algorithmus-Regression: bei Referenzbereich 0–10 und ±30’000 Digits bleibt der Fitfehler im simulierten Test unter 3 Digits; unzulässige Grenzen werden abgewiesen
- Live-Skalierung der neuen RAM-Kalibrierung: ±30’000 Digits entsprechen korrekt dem gesamten gewählten Referenzbereich
- Nach Änderung des DSP-Endwerts blockiert die NVM-Freigabe, bis die neu berechneten Koeffizienten erneut ins RAM übertragen und geprüft sind
- Bestehende NVM-Backup-, CRC-, Bootregister- und explizite Programmierfreigaben unverändert

**Noch nicht getestet:** Messpunktaufnahme, RAM-Übertragung und NVM-Programmierung mit den neuen Einstellungen am physischen E703.11.

## DSP_S-Live-Anzeige – UI- und Logiktests (11.11.2026)

- Bei bereits kalibriertem Sensor ohne neuen Fit: gelesener DSP_S=0 ergibt auf beiden Seiten 50.00 % (voreingestellter Bereich 0–100 %)
- Manueller Anzeigebereich 1–5 bar: DSP_S=0 ergibt 3.00 bar; die Anzeigeeinstellung wird lokal gespeichert, ohne Registerzugriff
- Nach RAM-Kalibrierung mit Referenzbereich −20 bis 80 kPa: DSP_S=−16’000 ergibt 5.00 kPa und überschreibt nur vorübergehend den manuellen Anzeigebereich
- Die DSP-Anzeige lässt sich ohne erneuten Fit nach dem Neustart als bestehender Sensor-DSP-Ausgang darstellen; der Kalibrierstatus bleibt dabei ausdrücklich unbestätigt
- Ohne DSP-Lesedaten wird «—» statt eines alten Livewerts angezeigt
- JavaScript-Initialisierung, DOM-ID-Vollständigkeit und die oben genannten Skalierungen simuliert und geprüft

**Nicht geprüft:** Reales Polling von DSP_S am physischen E703.11 / SSP3, tatsächliche Regler- und RAM-Schreibinteraktion, Antwort-Timing unter Dauerbetrieb. Die automatische Verifikation / NVM-Freigabe bleibt auf den separaten Prüfknopf beschränkt.

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

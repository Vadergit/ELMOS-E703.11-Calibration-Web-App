# ELMOS E703.11 – Chrome-Kalibrierassistent v8

## Zweck und Sicherheitsstatus

Reine lokale Web-App zur Laborerprobung am SSP3-Eval-Board. Default ist **1-Wire (AODO)**. Alternativ werden I²C und SPI unterstützt, sofern die jeweilige Chipkonfiguration und Verdrahtung dies erlauben. Das originale Windows-PSSC-Programm muss geschlossen sein. Die App ist **nicht** an echter Hardware validiert und **nicht** für Produktionsprogrammierung freigegeben.

Der NVM-Schreibweg ist tatsächlich implementiert, aber nicht am physischen Chip getestet. Es besteht Risiko, bei einer fehlerhaften oder unterbrochenen NVM-Programmierung die Konfiguration inklusive CRC zu beschädigen. Dass Boot-/Kommunikationsregister unverändert bleiben, schützt nicht vor einem Stromausfall während des NVM-Schreibens.

## Start

1. ZIP komplett entpacken.
2. `STARTEN_Windows.bat` unter Windows oder `STARTEN_macOS.command` unter macOS starten (Python 3 vorausgesetzt). Ein lokaler Webserver läuft auf `http://localhost:8765`. Alternativ auf HTTPS hosten. `index.html` direkt via `file://` garantiert keinen Web-Serial-Zugriff.
3. Eval-Board per USB anschliessen. In Chrome **USB-Port auswählen** und einmalig den USB-Serial-Zugriff freigeben. Bereits freigegebene FTDI-Ports kann Chrome später automatisch erneut öffnen. Bei mehreren Ports muss der passende manuell gewählt werden.
4. Standard **1-Wire** beibehalten. SSP3 wird für `IF_CFG 7 0 0` konfiguriert. Erst ADC_S und Chip-AFE lesen, bevor RAM-Schreibzugriff freigegeben wird. Bei 1-Wire braucht es VDD, GND und AODO, bei I²C die dafür dokumentierten Anschlüsse.

## Kalibrierablauf (Reihenfolge in der Web-App)

1. **USB und Chip:** SSP3 anschliessen. Firmware, ADC_S und AFE zunächst nur lesen. Bei Problemen USB-Diagnose exportieren.
2. **AFE optimieren:** PGA1, PGA2 und Offset mit Live-ADC optimieren. AFE-Änderungen ins RAM erfordern bewusste Schreibfreigabe. Kein permanentes NVM-Schreiben in diesem Schritt.
3. **Zwei Messpunkte:** Einheit frei wählen (z. B. %, bar, mbar, kPa, psi oder eigene Einheit). Referenzpunktnamen beliebig vergeben, z. B. «0 %» und «100 %». Unteren und oberen Druck-/Referenzwert einstellen und messen. Die Messung speichert **ADC_S, ADC_T und ADC_TC zum selben Referenzpunkt**. Ein höherer Polynomgrad oder eine Temperaturkompensation erfordert zusätzliche unabhängige Messpunkte. Eine lineare Rohwert-Vorprüfung ist optional und ersetzt nicht die Chip-DSP-Prüfung.
4. **Berechnen und RAM:** DSP-Koeffizienten berechnen. Auf derselben Seite **RAM-Schreibzugriff für die Kalibrierung freigeben**. Danach «1. Original-NVM lesen und prüfen» drücken, vollständige Sicherung mit CRC abwarten, «Backup herunterladen» wählen und die Datei sicher aufbewahren. Erst dann wird «2. Berechnete Koeffizienten ins RAM schreiben» freigeschaltet. Erfolg bzw. Fehler der Übertragung wird unter dem Knopf angezeigt. Die geschriebenen DSP-Wörter werden einzeln rückgelesen. Ohne erfolgreiche RAM-Übertragung bleibt die DSP-Prüfung gesperrt.
5. **DSP_S verifizieren:** Die Anzahl unabhängiger Prüfreferenzwerte auf **1–10** einstellen (Standard **1**). Die tatsächliche DSP_S-Ausgabe des Chips gegen Soll und Toleranz vergleichen. Für mehrere Punkte unterschiedliche Prüfdrucke im Kalibrierbereich einstellen. Bei Abweichung, Sättigung oder unvollständigen Prüfpunkten ist NVM gesperrt. Für Temperaturkompensation werden zusätzlich mindestens zwei Temperaturen benötigt. **Mit nur einem Prüfpunkt wird die Kennlinie nicht über den ganzen Druckbereich verifiziert.**
6. **Im Sensor speichern (NVM):** Erst nach positiver DSP-RAM-Verifikation NVM-Änderungsliste kontrollieren, Chip-ID und das Bestätigungswort `PROGRAMMIEREN` eingeben. Nach vollständiger Programmierung und Rücklesung einen echten Neustart durchführen und erneut prüfen. Dabei besteht trotz Schutz ein Risiko bei Stromunterbruch und Protokollfehlern.

**Wichtig:** Die frei gewählte Einheit bezeichnet das Referenzwertsystem des Kalibrierbereichs; die physisch am Prüfstand eingestellten Werte müssen dazu passen. Der Browser ersetzt keinen Druckregler oder externes Drucknormal.

## Sicherheit

- Die NVM-Schreibbefehle werden ausschliesslich nach Backup, CRC8-/CRC16-Kontrolle, RAM-Verifikation mit der gewählten Anzahl (Standard 1) unabhängiger Druckprüfpunkte, unveränderten Bootregistern und manueller Freigabe erlaubt.
- `0x04`, `0x06`, `0x08`, `0x0A`, `0x0C` und `0x10` (Boot/Kommunikation) dürfen nicht vom UI beschrieben werden. Der NVM-Plan bewahrt auch den gesamten originalen Werksbereich 0–15, sowie alle NVM-Wörter 16–27 unverändert.
- Durch eine erfolgreiche Code-Simulation kann **keine Garantie** für sicheres Booten oder erfolgreiche 1-Wire-Kommunikation an realer Hardware gegeben werden.
- Nicht mit Seriengeräten testen. Zunächst nur lesen, dann RAM-Änderungen, dann NVM-Schreiben an einem entbehrlichen Testchip durchführen.
- Bei einem NVM-Fehler die Diagnose und das Backup sichern, bevor die Versorgung unterbrochen wird.

## Technische Grundlage

- Datenblatt: `703.11-Datasheet-25ds0170e.04(1).pdf`, 16.11.2023.
- Evaluation Kit: `70311_eval_20160824.pdf`.
- Hersteller-Entwicklerpaket `pssc_mc_dev_2024_07_12.zip`, insbesondere AN 0203 (Kalibrierung und CRC), AN 0204 (SSP3-Zelos-USB-Protokoll) und API-Header.

Die Implementierung nutzt einen **unabhängigen JS-Least-Squares-Fit**, nicht `pssc_cal_lib.dll`. Die mathematischen Ergebnisse müssen gegen die Elmos-Referenzsoftware und die echte DSP-Ausgabe validiert werden.

## Dateien

- `index.html`: Oberfläche
- `app.js`: Web Serial, SSP3, AFE, Chipmessung und NVM-Transaktionen
- `calibration.js`: Koeffizientenfit, Quantisierung, CRC8, CRC16, geschützte NVM-Änderungsliste
- Startskripte für Windows/macOS
- `TESTBERICHT.md`: Tests und Einschränkungen

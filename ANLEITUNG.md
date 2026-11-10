# ELMOS E703.11 – Chrome-Kalibrierassistent v8

## Zweck und Sicherheitsstatus

Reine lokale Web-App zur Laborerprobung am SSP3-Eval-Board. Default ist **1-Wire (AODO)**. Alternativ werden I²C und SPI unterstützt, sofern die jeweilige Chipkonfiguration und Verdrahtung dies erlauben. Das originale Windows-PSSC-Programm muss geschlossen sein. Die App ist **nicht** an echter Hardware validiert und **nicht** für Produktionsprogrammierung freigegeben.

Der NVM-Schreibweg ist tatsächlich implementiert, aber nicht am physischen Chip getestet. Es besteht Risiko, bei einer fehlerhaften oder unterbrochenen NVM-Programmierung die Konfiguration inklusive CRC zu beschädigen. Dass Boot-/Kommunikationsregister unverändert bleiben, schützt nicht vor einem Stromausfall während des NVM-Schreibens.

## Start

1. ZIP komplett entpacken.
2. `STARTEN_Windows.bat` unter Windows oder `STARTEN_macOS.command` unter macOS starten (Python 3 vorausgesetzt). Ein lokaler Webserver läuft auf `http://localhost:8765`. Alternativ auf HTTPS hosten. `index.html` direkt via `file://` garantiert keinen Web-Serial-Zugriff.
3. Eval-Board per USB anschliessen. In Chrome **USB-Port auswählen** und einmalig den USB-Serial-Zugriff freigeben. Bereits freigegebene FTDI-Ports kann Chrome später automatisch erneut öffnen. Bei mehreren Ports muss der passende manuell gewählt werden.
4. Standard **1-Wire** beibehalten. SSP3 wird für `IF_CFG 7 0 0` konfiguriert. Erst ADC_S und Chip-AFE lesen, bevor RAM-Schreibzugriff freigegeben wird. Bei 1-Wire braucht es VDD, GND und AODO, bei I²C die dafür dokumentierten Anschlüsse.

## Kalibrierablauf

1. **USB/ADC:** AFE kontrollieren. Bei Problemen hier abbrechen und ein Diagnose-JSON exportieren.
2. **AFE:** PGA1, PGA2, Offset so einstellen, dass Enddrücke ohne Sättigung erfasst werden; Gain-Änderungen benötigen explizite RAM-Schreibfreigabe und werden direkt gesendet/rückgelesen.
3. **Messpunkte:** Druck- und Temperaturreferenzwerte erfassen. Zwei Punkte genügen nur für linearen Druckabgleich ohne Temperaturkompensation. Höhere Ordnungen erfordern eine unabhängige Matrix mehrerer Druck-/Temperaturkombinationen.
4. **Rohwertverifikation:** Einen Zwischenpunkt messen.
5. **DSP:** Polynomordnung auswählen, Koeffizienten berechnen, dann **NVM-Backup zuerst lesen und als JSON herunterladen**. Koeffizienten nur ins RAM übertragen, DSP_S bei mindestens zwei unabhängigen Druckwerten kontrollieren. Ggf. reale Temperaturverifikation bei mehreren Temperaturen vornehmen.
6. **NVM:** Erst nach bestandener RAM-Verifikation Änderungsliste kontrollieren. Die App übernimmt den vollständigen vorhandenen 64-Wort-Block und ändert nur erlaubte AFE-/DSP-Nutzerdaten plus CRC16, **keine** werksseitigen Werte und **keine** Boot-/Schnittstellenregister. Chip-ID und `PROGRAMMIEREN` explizit eintippen. Danach vollständiges NVM-Rücklesen abwarten; Strom nicht trennen! Nach einem kontrollierten tatsächlichen Neustart den Button **Nach Neustart verifizieren** verwenden.

## Sicherheit

- Die NVM-Schreibbefehle werden ausschliesslich nach Backup, CRC8-/CRC16-Kontrolle, RAM-Verifikation, zwei unabhängigen Druckprüfpunkten, unveränderten Bootregistern und manueller Freigabe erlaubt.
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

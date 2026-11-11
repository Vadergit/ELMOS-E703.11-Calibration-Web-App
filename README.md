# ELMOS E703.11 – Chrome-Kalibrierassistent

Browserbasierter Kalibrierassistent für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Die App läuft lokal im Chrome-Browser über **Web Serial**; als Standard ist **1-Wire (AODO)** eingestellt. I²C und SPI können je nach Hardwarekonfiguration gewählt werden.

> **Status: experimenteller Laborprototyp (v8).** Die Kommunikation, der Koeffizientenabgleich und die NVM-Programmierung wurden mit einem simulierten SSP3-Gerät getestet, **nicht** an echter Hardware vollständig verifiziert. **Nicht für Serienproduktion oder unersetzliche Chips einsetzen.** Ein fehlerhafter NVM-Schreibvorgang kann den Chip unbrauchbar machen.

## DSP_S-Live-Anzeige

Die Web-App zeigt in **AFE optimieren** und **DSP prüfen** den tatsächlichen DSP-Ausgang aus **Chip-Register 0x30 (DSP_S)**. Die Live-Messung liest zusätzlich zu ADC_S/ADC_T/ADC_TC regelmässig DSP_S (nur lesend). Der aktuelle DSP-Wert wird auf beiden Seiten zeitgleich angezeigt.

- **Neu im RAM kalibriert:** Anzeige mit dem Referenzbereich und der Einheit der aktuellen Kalibrierung (z. B. 0–100 %).
- **Bereits früher kalibrierter Sensor:** Der Chip-DSP-Ausgang wird ohne erneuten Abgleich angezeigt. Die Zuordnung von DSP_S −32’000 bis +32’000 Digits zu 0–100 % ist voreingestellt. Den physikalischen Anzeigebereich (z. B. 0–10 bar) kann man in «AFE optimieren» ausschliesslich für die Anzeige anpassen und lokal im Browser speichern.
- **Sicherheitsgrenze:** Aus der DSP-Ausgabe allein kann die Software nicht feststellen, ob die vorhandene Kalibrierung gültig ist oder welcher physikalische Messbereich im Chip verwendet wurde. Die manuelle Anzeigeskalierung muss zum Sensor passen und ist nicht automatisch chipbezogen. Nur die explizite Prüfpunkterfassung zählt für die NVM-Freigabe, nie die laufende Live-Anzeige.
- **Lesefehler:** Ein nicht lesbares DSP_S wird gesondert angezeigt; die ADC-Messung kann trotzdem fortgesetzt werden.
- **Nach RAM-Schreibvorgängen:** Die Live-Anzeige wird beim Öffnen der DSP-Prüfseite wieder aktiviert. Während Schreib- und Wartungstransaktionen pausiert sie.

## Funktionen

- USB-/FTDI-Portwahl in Chrome und erneuter Verbindungsaufbau für bereits freigegebene Geräte
- ADC-Signalmonitor (ADC_S, ADC_T, ADC_TC)
- AFE-Konfiguration mit PGA1, PGA2, Offset und Gain-Empfehlungen
- Geführter Druck-/Temperaturabgleich und Messpunkt-Verifikation
- Berechnung von DSP-Koeffizienten im Browser
- Übertragung der Koeffizienten ins RAM und Rücklesekontrolle
- NVM-Backup, Schreibplanung, manuelle Freigabe, Schreiben und Rücklesen
- Schutz der Boot- und Kommunikationsregister vor Änderungen durch die App
- Optionale Hover-Hilfen und Diagnoseexport

## Geführter Ablauf

1. **USB & AFE:** SSP3 verbinden, ADC_S kontrollieren und PGA1/PGA2/Offset optimieren. RAM-Schreibzugriff erfolgt nur nach bewusster Freigabe.
2. **Zwei Referenzpunkte:** Bezeichnungen frei wählen (z. B. **0 %** und **100 %**) und die Anzeigeeinheit zwischen bar, %, mbar, kPa, psi oder einer eigenen Einheit umstellen. Beide Endpunkte erfassen; ADC_S, ADC_T und ADC_TC werden gemeinsam aufgenommen. Zusätzliche Punkte sind für höhere Polynomordnungen möglich.
3. **Berechnen & RAM:** DSP-Koeffizienten berechnen. Direkt im selben Schritt **RAM-Schreibfreigabe aktivieren**, das Original-NVM vollständig lesen und mit CRC prüfen, das Backup als JSON herunterladen und erst danach die berechneten Koeffizienten ins RAM schreiben und rücklesen. Alle Fehlermeldungen erscheinen direkt neben den zugehörigen Schritten. NVM wird hierbei nicht programmiert.
4. **DSP prüfen:** Anzahl Prüfpunkte **1–10** einstellbar, **Standard ist 1**. Die tatsächliche Chip-Ausgabe DSP_S wird gegen die Referenz und die gewählte Toleranz verglichen. Mehrere Punkte prüfen unterschiedliche Stellen innerhalb des Druckbereichs. Bei Temperaturkompensation können zusätzliche Temperaturprüfungen erforderlich sein. Eine optionale lineare Rohwertprüfung ist **kein** Ersatz. **Ein einzelner Prüfpunkt ist keine Überprüfung der gesamten Kennlinie.**
5. **NVM:** Erst nach erfolgreicher RAM-Verifikation Änderungsliste prüfen und mit separater ausdrücklicher Bestätigung dauerhaft programmieren. Anschliessend Rücklesen und Verifikation nach physischem Neustart.

Die Navigation sperrt Schritte, deren Voraussetzungen noch nicht erfüllt sind. Änderungen an Einheit, Bereich, Gains oder Polynomordnung machen abhängige Berechnungs- und Prüfzustände ungültig.

## Start

**Windows:** `STARTEN_Windows.bat` starten.  
**macOS:** `STARTEN_macOS.command` starten.  

Python 3 wird für den lokalen Webserver benötigt. Danach `http://localhost:8765` in Chrome öffnen. USB-Port bei der ersten Verwendung über den Browserdialog freigeben. Alternativ kann die App über **HTTPS** bereitgestellt werden. Der Web-Serial-Zugriff ist über `file://` nicht zuverlässig verfügbar.

## Windows: USB-Port lässt sich nicht öffnen

Falls Chrome nach der Portauswahl **„Failed to execute 'open' on 'SerialPort': Failed to open serial port“** meldet, war die Portauswahl erfolgreich, aber Windows konnte den Port nicht öffnen. Das ist **noch kein 1-Wire- oder E703.11-Protokollfehler**.

1. **PSSC-GUI vollständig beenden.** Auch Terminals, serielle Monitore und andere Chrome-Tabs schliessen, die denselben COM-Port verwenden könnten.
2. Windows **Gerätemanager → Anschlüsse (COM & LPT)** öffnen. Das SSP3 sollte als **USB Serial Port (COMx)** ohne Warnsymbol erscheinen. Falls nur „USB Serial Converter“ ohne COM-Port angezeigt wird, die FTDI-VCP-Einrichtung prüfen.
3. USB-Kabel kurz trennen, wieder anschliessen und zunächst **Bekannten Port verbinden** testen. Bei mehreren oder veralteten freigegebenen Ports den korrekten Anschluss über **USB-Port auswählen** neu wählen.
4. Falls der COM-Port fehlt oder fehlerhaft angezeigt wird, den offiziellen [FTDI-VCP-Treiber](https://ftdichip.com/drivers/vcp-drivers/) prüfen. Treiberinstallation benötigt möglicherweise Administratorrechte.
5. Erst wenn der COM-Port geöffnet werden kann, die SSP3-Firmwareabfrage und danach 1-Wire/I²C prüfen. Die angezeigte Baudrate ist normalerweise **nicht** die Ursache für ein fehlgeschlagenes `open()`.

Bei diesem Fehler **keine RAM- oder NVM-Schreibversuche starten**. Falls er bleibt, zusammen mit der genauen COM-Port-Anzeige den Inhalt des technischen Logs teilen.

## Sicherheitsregeln

- Beim ersten Hardwaretest nur **lesen**.
- Keine EEPROM-/NVM-Programmierung vor eigenständiger Prüfung an einem entbehrlichen Testchip.
- Die App ändert keine Boot-/Schnittstellenregister; sie kann nicht ausschliessen, dass ein Stromausfall, ein Protokollfehler oder eine bereits fehlerhafte NVM-Konfiguration den Kommunikationszugang beschädigt.
- Hersteller-DLLs, Manuals und proprietäre Entwicklungsdateien sind **nicht** Bestandteil dieses Repositorys.

Weitere Details stehen in [ANLEITUNG.md](ANLEITUNG.md) und [TESTBERICHT.md](TESTBERICHT.md).

## Tests

```bash
node --check app.js
node --check calibration.js
node test_math.js
```

Die numerische Koeffizientenberechnung ist eine unabhängige JavaScript-Implementierung und wurde noch nicht auf vollständige Gleichwertigkeit mit der originalen Elmos-Kalibrierbibliothek geprüft.

## Lizenz

Es wurde noch keine Lizenz festgelegt. Ein öffentlich sichtbares Repository bedeutet nicht automatisch, dass der Code unter einer Open-Source-Lizenz steht.

**Hinweis:** ELMOS und genannte Produktnamen sind Marken ihrer jeweiligen Inhaber. Dieses Projekt ist keine offizielle Elmos-Anwendung.
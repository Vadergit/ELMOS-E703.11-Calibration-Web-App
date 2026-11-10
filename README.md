# ELMOS E703.11 – Chrome-Kalibrierassistent

Browserbasierter Kalibrierassistent für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Die App läuft lokal im Chrome-Browser über **Web Serial**; als Standard ist **1-Wire (AODO)** eingestellt. I²C und SPI können je nach Hardwarekonfiguration gewählt werden.

> **Status: experimenteller Laborprototyp (v8).** Die Kommunikation, der Koeffizientenabgleich und die NVM-Programmierung wurden mit einem simulierten SSP3-Gerät getestet, **nicht** an echter Hardware vollständig verifiziert. **Nicht für Serienproduktion oder unersetzliche Chips einsetzen.** Ein fehlerhafter NVM-Schreibvorgang kann den Chip unbrauchbar machen.

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

## Start

**Windows:** `STARTEN_Windows.bat` starten.  
**macOS:** `STARTEN_macOS.command` starten.  

Python 3 wird für den lokalen Webserver benötigt. Danach `http://localhost:8765` in Chrome öffnen. USB-Port bei der ersten Verwendung über den Browserdialog freigeben. Alternativ kann die App über **HTTPS** bereitgestellt werden. Der Web-Serial-Zugriff ist über `file://` nicht zuverlässig verfügbar.

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
# USB-Bridge statt SSP3 – experimenteller Testaufbau

**Stand v0.6.0-beta.2 · nur im Branch `feature/guided-calibration-and-usb-bridges`**

Der Kalibrierassistent nutzt standardmässig weiterhin das **ELMOS SSP3**. In dieser Testversion kann unter **USB & Chip → Programmieradapter** auch **ESP32 / Arduino USB-Bridge · experimentell** gewählt werden.

## 1. Was funktioniert bereits?

- Ein Mikrocontroller mit USB-CDC erscheint am PC als serieller Port.
- Die neue Adapterauswahl und die Web-Serial-Verbindung können ihn öffnen.
- Die Firmware meldet sich mit `BRIDGE_INFO` und einer klaren Capability-Liste.
- Die beigelegte Beispiel-Firmware antwortet bewusst mit **`CAPS=CDC_ONLY`**.
- Die Web-App erkennt dadurch korrekt: **USB funktioniert, aber noch kein E703.11-Chipzugriff.** AFE, NVM und Programmierung bleiben gesperrt.
- Der bisherige SSP3-Kommunikationspfad bleibt unverändert.

**Wichtig:** Das Beispiel ist keine fertige E703.11-Programmer-Firmware. Es implementiert **weder den Elmos-1-Wire/PLC-Bus noch die EEPROM-Programmierung**. Ein serieller USB-Port alleine ersetzt die zeitkritische Hardware-Kommunikation nicht.

Die ausführliche, auf ESP-Baugruppen fokussierte [Board-Liste mit ESP32-C3 SuperMini](ESP_BOARD_OPTIONS.md) enthält auch die native USB-Pinbelegung und die speziellen Flash-Schritte.

**Für den bereits vorhandenen ESP32-C3 SuperMini:** Statt des allgemeinen Arduino-Beispiels die neue [C3-SuperMini-Firmware](../firmware/esp32c3_supermini/esp32c3_supermini.ino) verwenden. Arduino IDE → Board **ESP32C3 Dev Module**, **USB CDC On Boot: Enabled**. Nach dem Flashen `BRIDGE_INFO` senden. Erwartet wird `# E70311-BRIDGE V1 CAPS=CDC_ONLY`.

## 2. Geeignete Boards

Für den ersten USB-Test eignen sich beispielsweise:

| Board | USB | Hinweis |
| --- | --- | --- |
| ESP32-S3 DevKit | Natives USB-CDC möglich | In Arduino IDE **USB CDC On Boot: Enabled** und den tatsächlich mit dem Chip verbundenen USB-Port wählen |
| Arduino Nano ESP32 (ESP32-S3) | USB-CDC | Pin-/USB-Einstellungen der jeweiligen Boarddefinition prüfen |
| Raspberry Pi Pico / Pico 2 mit passendem Arduino-Core | Native USB-CDC | USB-CDC-Konfiguration hängt vom verwendeten Core ab |
| Arduino Nano RP2040 Connect | Native USB-CDC | Arduino IDE Board-Paket installieren |

Ein einfacher ESP32-WROOM mit CP210x/CH340/FTDI kann zwar serielle Kommunikation liefern, hat aber nicht zwingend **native USB**. Für die spätere 1-Wire-Implementierung zählt insbesondere die **GPIO-Timing-Eignung**, nicht allein die USB-Buchse.

Herstellerreferenzen:
- [Espressif: USB CDC and DFU Flashing](https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/cdc_dfu_flash.html)
- [Espressif: ESP32-S3 USB Device Stack](https://docs.espressif.com/projects/esp-usb/en/latest/esp32s3/usb_device.html)
- [ELMOS E703.11 Produktübersicht](https://www.elmos.com/english/application/non-automotive/industrial-automation/measurement/e70311.html)

## 3. Arduino IDE – Test-Firmware flashen

1. Arduino IDE installieren; für ESP32-S3 das passende ESP32-Boardpaket auswählen.
2. Die Datei [`firmware/usb_bridge_cdc/usb_bridge_cdc.ino`](../firmware/usb_bridge_cdc/usb_bridge_cdc.ino) öffnen.
3. Das **tatsächliche Board** auswählen. Beim ESP32-S3 mit nativer USB-Buchse **USB CDC On Boot → Enabled** aktivieren.
4. Programm hochladen und bei Bedarf das Board einmal neu starten.
5. Prüfen, ob ein serieller USB-Port im Betriebssystem erscheint. Für den Test mit der Web-App **Arduino Serial Monitor und andere COM-Programme schliessen**.
6. Im **Testbranch**, nicht auf der produktiven Main-Seite, die Adapterwahl auf **ESP32 / Arduino USB-Bridge** stellen.
7. «USB-Port auswählen» drücken und den neuen Port bestätigen.
8. Erwartete Diagnose: **USB-CDC-Bridge erkannt, aber nur CDC_ONLY verfügbar**. Das ist der erfolgreiche Test der USB-Strecke, kein Fehler des Sensors.

Die verwendete USB-Verbindung ist bei ESP32-S3 und vielen RP2040-Boards auch bei einer im Sketch angegebenen Baudrate von 115200 eine logische CDC-Verbindung; für das tatsächliche SSP3 ist die Baudrate dagegen relevant.

## 4. Was ist für einen wirklichen E703.11-Adapter noch notwendig?

Die folgende Arbeit muss vor einer Freigabe am Prüfstand erledigt werden:

1. **Elektrische Schnittstelle verifizieren.** Der E703.11 benötigt die im Datenblatt spezifizierte Versorgung von 2.7–5.5 V. AODO/PLC ist kein beliebig ansteuerbarer UART-Pin. Die Pegel, Pull-ups, Open-Drain-/Tri-State-Anforderungen, Schutzbeschaltung und Rückwirkung auf die analoge Ausgangsstufe müssen anhand des vollständigen Datenblatts geprüft werden.
2. **Timing der Elmos-PLC-Übertragung implementieren.** Telegramme, Flanken, Startfenster (4/10/200 ms gemäss konfiguriertem NVM), CRC, Lese- und Schreibzyklen müssen am Oszilloskop und mit dem SSP3 als Referenz bestätigt werden.
3. **Programmierkommandos kapseln.** Entweder die bestehenden SSP3-Textbefehle samt Antwortformat emulieren oder eine versionierte separate Web-Bridge-API einführen. Die Beta verwendet aus Kompatibilitätsgründen zunächst die erste Variante.
4. **Firmware-Fähigkeiten ehrlich melden.** `BRIDGE_INFO` muss das Format `# E70311-BRIDGE V1 CAPS=...` gefolgt von der Antwort-Endmarke `:` liefern. `CDC_ONLY` ist der sichere Standard. Die Fähigkeiten `PLC_READ,PLC_WRITE,NVM` dürfen **erst nach vollständiger Hardwarevalidierung** gemeldet werden.
5. **Sicherheitskontrollen nachweisen.** Register-Readback, Chip-UID, Factory-/Bootschutz, CRC8/CRC16, RAM-Abgleich, NVM-Programmierung und echter Power-Cycle müssen mit einem entbehrlichen Testchip geprüft werden. Auch dann muss die Web-App die NVM-Freigabe für Bridge-Adapter erst in einer gesonderten, überprüften Änderung erhalten.

**Niemals** einen E703.11-AODO-Pin direkt an einen beliebigen 3.3-V-GPIO anschliessen, solange Pegel, Ausgangstreiber, Schutzwiderstände und die Betriebsart nicht verifiziert sind. Auch ein direktes 5-V-Signal an einen 3.3-V-Eingang kann den Mikrocontroller beschädigen.

## 5. Warum ist NVM bei einer Bridge noch gesperrt?

Weil eine fehlerhafte oder unterbrochene Programmierung dauerhafte Konsequenzen haben kann. In der aktuellen Beta gilt:

- **SSP3:** unveränderte bestehende Lese-/RAM-/NVM-Pfade mit ihren bisherigen Prüfungen.
- **USB-Bridge:** CDC-Handshaketest funktioniert; ohne vollständige PLC-Implementierung wird kein Sensorzugriff bestätigt.
- **Selbst bei zukünftigem `CAPS=PLC_READ,PLC_WRITE,NVM`** bleibt NVM in der Web-App vorerst ausdrücklich gesperrt, bis die Bridge am echten E703.11 validiert wurde.

Damit kann die USB-Basis bereits getestet und weiterentwickelt werden, ohne funktionierende Sensoren zu gefährden.

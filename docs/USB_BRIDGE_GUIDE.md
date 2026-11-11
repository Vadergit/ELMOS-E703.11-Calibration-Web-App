# USB-Bridge statt SSP3 – experimenteller Testaufbau

**Stand v0.6.0 · in der Hauptversion enthalten**

Der Kalibrierassistent nutzt standardmässig weiterhin das **ELMOS SSP3**. In der Web-App kann unter **USB & Chip → Programmieradapter** auch **ESP32 / Arduino USB-Bridge · experimentell** gewählt werden.

## 1. Was funktioniert bereits?

- Ein Mikrocontroller mit USB-CDC erscheint am PC als serieller Port.
- Die neue Adapterauswahl und die Web-Serial-Verbindung können ihn öffnen.
- Die Firmware meldet sich mit `BRIDGE_INFO` und einer klaren Capability-Liste.
- Die beigelegte Beispiel-Firmware antwortet bewusst mit **`CAPS=CDC_ONLY`**.
- Die Web-App erkennt dadurch korrekt: **USB funktioniert, aber noch kein E703.11-Chipzugriff.** AFE, NVM und Programmierung bleiben gesperrt.
- Der bisherige SSP3-Kommunikationspfad bleibt unverändert.

**Wichtig:** Das Beispiel ist keine fertige E703.11-Programmer-Firmware. Es implementiert **weder den Elmos-1-Wire/PLC-Bus noch die EEPROM-Programmierung**. Ein serieller USB-Port alleine ersetzt die zeitkritische Hardware-Kommunikation nicht.

Die [vollständige ESP32-/Arduino-Boardliste](ESP_BOARD_OPTIONS.md) enthält die GPIO-Vorschläge, optionalen Empfangspins, I/O-Spannungen und Hersteller-Pinouts.

**Für den bereits vorhandenen ESP32-C3 SuperMini:** Statt des allgemeinen Arduino-Beispiels die neue [C3-SuperMini-Firmware](../firmware/esp32c3_supermini/esp32c3_supermini.ino) verwenden. Arduino IDE → Board **ESP32C3 Dev Module**, **USB CDC On Boot: Enabled**. Nach dem Flashen `BRIDGE_INFO` senden. Erwartet wird `# E70311-BRIDGE V1 CAPS=CDC_ONLY`.

## 2. Geeignete Mikrocontroller und GPIO-Pins

Die folgende Tabelle zeigt die häufigsten Boards und **konkrete Pinvorschläge** für eine spätere externe E703.11-PLC-Treiberschaltung. **Diese Pins werden von der aktuellen Firmware noch nicht angesteuert.** Sie sind **keine Freigabe zum direkten Anschluss an AODO**.

**Komplette Liste mit zusätzlichen Arduino-, ESP32-, RP2040- und STM32-Boards, Pinwarnungen und Herstellerquellen:** [**ESP32- und Arduino-kompatible Boards – USB und GPIO-Pinbelegung**](ESP_BOARD_OPTIONS.md).

### ESP32 / ESP8266

| Board | Geplanter PLC-Pin | RX optional | USB zum PC |
| --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | **GPIO4** | GPIO5 | Natives USB Serial/JTAG |
| **XIAO ESP32C3** | **D2 / GPIO4** | D3 / GPIO5 | Nativ |
| ESP32-C3 DevKit / DevKitM | **GPIO4** | GPIO5 | Nativ oder USB-UART je nach Modell |
| ESP32-S3 DevKitC-1 | **GPIO4** | GPIO5 | Nativ / USB-UART |
| XIAO ESP32S3 | **D3 / GPIO4** | D4 / GPIO5 | Nativ |
| Arduino Nano ESP32 | **D2 / GPIO5** | D3 / GPIO6 | Nativ |
| ESP32-S2 Saola-1 | **GPIO4** | GPIO5 | Nativ |
| ESP32-C6 DevKitC-1 | **GPIO10** | GPIO11 | Nativ / USB-UART |
| XIAO ESP32C6 | **D3 / GPIO21** | D4 / GPIO22 | Nativ |
| ESP32 DevKit / WROOM-32 | **GPIO25** | GPIO26 | USB-UART |
| ESP8266 NodeMCU / Wemos D1 mini | **D2 / GPIO4** | D1 / GPIO5 | USB-UART |

### Arduino und weitere Arduino-kompatible Boards

| Board | Geplanter PLC-Pin | RX optional | I/O-Pegel |
| --- | --- | --- | --- |
| UNO R3, Nano Classic, Nano Every, Mega 2560 | **D2** | D3 | 5 V |
| UNO R4 Minima / UNO R4 WiFi (RA4M1-Header) | **D2** | D3 | 5 V |
| Leonardo, Micro, Pro Micro | **D4** | D5 | Meist 5 V; Pro Micro je nach Version 3,3 V |
| Nano 33 IoT / Nano 33 BLE | **D2** | D3 | 3,3 V |
| Nano RP2040 Connect | **D2 / GPIO25** | D3 / GPIO15 | 3,3 V |
| Raspberry Pi Pico / Pico W / Pico 2 | **GP2 / GPIO2** | GP3 / GPIO3 | 3,3 V |
| XIAO RP2040 | **D2 / GPIO28** | D1 / GPIO27 | 3,3 V |
| Teensy 4.0 | **D2** | D3 | 3,3 V |
| STM32 Blue Pill | **PA1** | PA2 | 3,3 V |

**Besonders wichtig:**

- Der **ESP32-C3 SuperMini** nutzt für native USB **GPIO18 (D−) und GPIO19 (D+)**. Diese Pins **nicht** als PLC-GPIO verwenden.
- Der **Arduino Nano ESP32** verwendet **D2 = GPIO5**, nicht GPIO2. Beim Programmieren die Board-Bezeichnungen **D2/D3** benutzen.
- Ein **UNO R4 WiFi** hat 5-V-Digitalpins auf dem **RA4M1**. Der zusätzliche ESP32-S3 arbeitet mit **3,3 V** und ist nicht mit D2 am UNO-Header gleichzusetzen.
- Die zweite Leitung **RX** ist optional und hängt von der noch zu entwickelnden bidirektionalen Treiberarchitektur ab.
- Bei klassischem ESP32, ESP8266 und vielen klassischen Arduinos ist **USB-UART** statt nativer USB-CDC üblich. Das ist für Web Serial grundsätzlich möglich, aber kein vorhandenes PLC-Protokoll.

**Die sichere Verbindung lautet:** PC/USB → MCU → **noch zu entwickelnde geschützte Pegel-/PLC-Schnittstelle** → E703.11. Vor einem direkten AODO-Anschluss ist zu warnen: Der Sensorausgang kann aktiv getrieben sein und bei 3,3-V-GPIOs zu unzulässigen Spannungen führen. Die alternative Bridge bleibt für reale Sensorzugriffe in der Web-App gesperrt.

## 3. Arduino IDE – Test-Firmware flashen

1. Arduino IDE installieren; für ESP32-S3 das passende ESP32-Boardpaket auswählen.
2. Die Datei [`firmware/usb_bridge_cdc/usb_bridge_cdc.ino`](../firmware/usb_bridge_cdc/usb_bridge_cdc.ino) öffnen.
3. Das **tatsächliche Board** auswählen. Beim ESP32-S3 mit nativer USB-Buchse **USB CDC On Boot → Enabled** aktivieren.
4. Programm hochladen und bei Bedarf das Board einmal neu starten.
5. Prüfen, ob ein serieller USB-Port im Betriebssystem erscheint. Für den Test mit der Web-App **Arduino Serial Monitor und andere COM-Programme schliessen**.
6. In der **regulären Web-App** die Adapterwahl auf **ESP32 / Arduino USB-Bridge** stellen.
7. «USB-Port auswählen» drücken und den neuen Port bestätigen.
8. Erwartete Diagnose: **USB-CDC-Bridge erkannt, aber nur CDC_ONLY verfügbar**. Das ist der erfolgreiche Test der USB-Strecke, kein Fehler des Sensors.

Die verwendete USB-Verbindung ist bei ESP32-S3 und vielen RP2040-Boards auch bei einer im Sketch angegebenen Baudrate von 115200 eine logische CDC-Verbindung; für das tatsächliche SSP3 ist die Baudrate dagegen relevant.

## 4. Was ist für einen wirklichen E703.11-Adapter noch notwendig?

Die folgende Arbeit muss vor einer Freigabe am Prüfstand erledigt werden:

1. **Elektrische Schnittstelle verifizieren.** Der E703.11 benötigt die im Datenblatt spezifizierte Versorgung von 2.7–5.5 V. AODO/PLC ist kein beliebig ansteuerbarer UART-Pin. Die Pegel, Pull-ups, Open-Drain-/Tri-State-Anforderungen, Schutzbeschaltung und Rückwirkung auf die analoge Ausgangsstufe müssen anhand des vollständigen Datenblatts geprüft werden.
2. **Timing der Elmos-PLC-Übertragung implementieren.** Telegramme, Flanken, Startfenster (4/10/200 ms gemäss konfiguriertem NVM), CRC, Lese- und Schreibzyklen müssen am Oszilloskop und mit dem SSP3 als Referenz bestätigt werden.
3. **Programmierkommandos kapseln.** Entweder die bestehenden SSP3-Textbefehle samt Antwortformat emulieren oder eine versionierte separate Web-Bridge-API einführen. Die aktuelle experimentelle Adapterstruktur orientiert sich aus Kompatibilitätsgründen an der ersten Variante.
4. **Firmware-Fähigkeiten ehrlich melden.** `BRIDGE_INFO` muss das Format `# E70311-BRIDGE V1 CAPS=...` gefolgt von der Antwort-Endmarke `:` liefern. `CDC_ONLY` ist der sichere Standard. Die Fähigkeiten `PLC_READ,PLC_WRITE,NVM` dürfen **erst nach vollständiger Hardwarevalidierung** gemeldet werden.
5. **Sicherheitskontrollen nachweisen.** Register-Readback, Chip-UID, Factory-/Bootschutz, CRC8/CRC16, RAM-Abgleich, NVM-Programmierung und echter Power-Cycle müssen mit einem entbehrlichen Testchip geprüft werden. Auch dann muss die Web-App die NVM-Freigabe für Bridge-Adapter erst in einer gesonderten, überprüften Änderung erhalten.

**Niemals** einen E703.11-AODO-Pin direkt an einen beliebigen 3.3-V-GPIO anschliessen, solange Pegel, Ausgangstreiber, Schutzwiderstände und die Betriebsart nicht verifiziert sind. Auch ein direktes 5-V-Signal an einen 3.3-V-Eingang kann den Mikrocontroller beschädigen.

## 5. Warum ist NVM bei einer Bridge noch gesperrt?

Weil eine fehlerhafte oder unterbrochene Programmierung dauerhafte Konsequenzen haben kann. In der aktuellen Version gilt:

- **SSP3:** unveränderte bestehende Lese-/RAM-/NVM-Pfade mit ihren bisherigen Prüfungen.
- **USB-Bridge:** CDC-Handshaketest funktioniert; ohne vollständige PLC-Implementierung wird kein Sensorzugriff bestätigt.
- **Selbst bei zukünftigem `CAPS=PLC_READ,PLC_WRITE,NVM`** bleibt NVM in der Web-App vorerst ausdrücklich gesperrt, bis die Bridge am echten E703.11 validiert wurde.

Damit kann die USB-Basis bereits getestet und weiterentwickelt werden, ohne funktionierende Sensoren zu gefährden.

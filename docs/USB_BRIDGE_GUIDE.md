# USB-Bridge statt SSP3 – experimenteller Testaufbau

Für die ESP32-C3-Firmware v0.3 gilt die [PLC-Testanleitung](ESP32_C3_PLC_TEST.md). Die folgenden Hinweise zum reinen USB-Test beziehen sich auf die CDC-Beispielfirmware.

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

Die [vollständige ESP32-/Arduino-Boardliste](ESP_BOARD_OPTIONS.md) enthält die Belegung für AODO / 1-Wire **und** I²C, I/O-Spannungen und Hersteller-Pinouts.

**Für den bereits vorhandenen ESP32-C3 SuperMini:** Statt des allgemeinen Arduino-Beispiels die neue [C3-SuperMini-Firmware](../firmware/esp32c3_supermini/esp32c3_supermini.ino) verwenden. Arduino IDE → Board **ESP32C3 Dev Module**, **USB CDC On Boot: Enabled**. Nach dem Flashen `BRIDGE_INFO` senden. Die SuperMini-PLC-Firmware meldet `CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM,POWER_GPIO_10,PSSC_RAM`.

## 2. AODO / 1-Wire und I²C – passende MCU-Pins

Der Anschluss am **E703.11 für 1-Wire heisst AODO** (nicht A0D0). Für **I²C** besitzt der Sensor die Anschlüsse **MISO/SDA (Daten)** und **SCK/SCL (Takt)**; ausserdem ist **NCS/SA0** für den Modus beziehungsweise die Adressbeschaltung zu berücksichtigen.

Die Tabellen zeigen die MCU-Pins für eine externe PLC-Treiberstufe und mögliche alternative I²C-Anschlüsse. Beim ESP32-C3 SuperMini ist die PLC-Belegung durch die Firmware festgelegt. Die übrigen Boardzeilen sind Verdrahtungsvorschläge. Vor einem I²C-Aufbau Pull-ups, Busspannungen und Chip-Konfiguration prüfen.

Die **vollständige Liste aller 27 Boards** mit AODO-/1-Wire-GPIO, USB-Pins, Boardbesonderheiten, Hersteller-Pinouts und Verdrahtungsbeispiel steht in [**ESP32-/Arduino-Boards: AODO / 1-Wire und I²C**](ESP_BOARD_OPTIONS.md).

### ESP32 / ESP8266

| Board | AODO / 1-Wire (MCU) | I²C SDA (MCU) | I²C SCL (MCU) | USB zum PC | Sensorversorgung / Neustart |
| --- | --- | --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | **GPIO4** (TX) | GPIO6 (alternativ) | GPIO7 (alternativ) | Native USB Serial/JTAG | **GPIO10** (ab Firmware v0.4) |
| **XIAO ESP32C3** | **D2 / GPIO4** | D4 / GPIO6 | D5 / GPIO7 | Nativ | D1 / GPIO3 |
| ESP32-C3 DevKit / DevKitM | **GPIO4** | GPIO6 | GPIO7 | Nativ oder USB-UART | GPIO10 |
| ESP32-S3 DevKitC-1 | **GPIO4** | GPIO8 | GPIO9 | Nativ oder USB-UART | GPIO10 |
| XIAO ESP32S3 | **D3 / GPIO4** | D4 / GPIO5 | D5 / GPIO6 | Nativ | D0 / GPIO1 |
| Arduino Nano ESP32 | **D2 / GPIO5** | A4 / GPIO11 | A5 / GPIO12 | Nativ | D4 / GPIO7 |
| ESP32-S2 Saola-1 | **GPIO4** | GPIO8 | GPIO9 | Nativ | GPIO10 |
| ESP32-C6 DevKitC-1 | **GPIO10** | GPIO6 | GPIO7 | Nativ oder USB-UART | GPIO3 |
| XIAO ESP32C6 | **D3 / GPIO21** | D4 / GPIO22 | D5 / GPIO23 | Nativ | D1 / GPIO1 |
| ESP32 DevKit / WROOM-32 | **GPIO25** | GPIO21 | GPIO22 | USB-UART | GPIO26 |
| ESP8266 NodeMCU / Wemos D1 mini | **D5 / GPIO14** | D2 / GPIO4 | D1 / GPIO5 | USB-UART | D6 / GPIO12 |

**ESP32-C3 SuperMini mit PLC-Firmware**

| Pin | Funktion |
| --- | --- |
| GPIO4 | TX zur externen AODO-Treiberstufe |
| GPIO5 | Aktives High-OE der Treiberstufe |
| GPIO6 | RX von der Treiberstufe zum ESP32 |
| GPIO10 | Aktives High-Enable für den externen Lastschalter der Sensorversorgung. Dient zum Einschalten und zum Neustart nach dem NVM-Schreiben |
| GND | Gemeinsame Masse von ESP32, Treiberstufe und Sensor |

**Firmware ab v0.4 verwendet GPIO10.** Bei v0.3 lag der Lastschalter an GPIO7. Nach dem Update die EN-Leitung auf GPIO10 umstecken. GPIO7 bleibt für I²C-SCL frei. GPIO6 ist im PLC-Aufbau RX und im alternativen I²C-Aufbau SDA.

Die Neustart-Pins der übrigen Boards sind Vorschläge für eine eigene Firmware. Sie sind jeweils zusätzlich zu den angegebenen I²C-Pins gewählt. Die Web-App verwendet den Neustartbefehl mit der SuperMini-Firmware und angeschlossenem Lastschalter. [Anschluss und Testablauf](ESP32_C3_PLC_TEST.md)

### Arduino und weitere kompatible Mikrocontroller

| Board | AODO / 1-Wire (MCU) | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Sensorversorgung / Neustart |
| --- | --- | --- | --- | --- | --- |
| UNO R3, Nano Classic, Nano Every | **D2** | A4 | A5 | 5 V | D5 |
| Mega 2560 | **D2** | D20 | D21 | 5 V | D5 |
| UNO R4 Minima / UNO R4 WiFi (RA4M1-Header) | **D2** | A4 | A5 | 5 V | D5 |
| Leonardo, Micro, Pro Micro | **D4** | D2 | D3 | 5 V oder 3,3 V (Variante beachten) | D5 |
| Nano 33 IoT / Nano 33 BLE | **D2** | A4 | A5 | 3,3 V | D5 |
| Nano RP2040 Connect | **D2 / GPIO25** | A4 / GPIO12 | A5 / GPIO13 | 3,3 V | D5 |
| Raspberry Pi Pico / Pico W / Pico 2 | **GP2** | GP4 | GP5 | 3,3 V | GP3 |
| XIAO RP2040 | **D2 / GPIO28** | D4 / GPIO6 | D5 / GPIO7 | 3,3 V | D1 |
| Teensy 4.0 | **D2** | D18 | D19 | 3,3 V | D5 |
| STM32 Blue Pill | **PA1** | PB7 | PB6 | 3,3 V | PB0 |

**Pin-Hinweise:** Die ESP32-I²C-Pins sind teils **bewusst anders als die jeweiligen Arduino-Defaults** gewählt und müssen in der zukünftigen Firmware konfiguriert werden. Beim ESP32-C3 SuperMini bleiben **GPIO18/19 für USB** reserviert. Die früheren Überschneidungen beim XIAO ESP32S3, XIAO ESP32C6 und ESP8266 wurden vermieden. Auf dem **Arduino Nano ESP32 ist D2 = GPIO5, aber SDA = A4/GPIO11**.

**Momentaner Funktionsumfang:** Die USB-Test-Firmware meldet ausschliesslich **CAPS=CDC_ONLY**. Die separate SuperMini-PLC-Firmware unterstützt AODO über die externe Treiberstufe. Für einen echten Anschluss sind geeignete Pegel, Schutzschaltung, I²C-Pull-ups, Adresse/NCS/SA0, Telegramm-/CRC-Verhalten und die Pinbelegung der realen Leiterplatte abzuklären.

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

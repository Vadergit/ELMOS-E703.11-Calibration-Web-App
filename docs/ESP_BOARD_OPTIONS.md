# ESP32- und Arduino-kompatible Boards: USB und GPIO-Pinbelegung

**Stand: v0.6.0 · Referenz für die zukünftige E703.11-PLC-Bridge**

Dieser Guide umfasst die gängigen **ESP32-, Arduino-, RP2040- und anderen Arduino-kompatiblen Mikrocontrollerboards**. Die Tabelle nennt je Board einen vorgeschlagenen Digitalpin für die **zukünftige PLC-Steuerleitung** und, falls der Treiber getrennte Leitungen verwendet, einen **optionalen Empfangspin**.

> **Sicherheitsgrenze:** Die hier genannten GPIOs sind **Planungsvorschläge, keine heute funktionierende E703.11-Anschlussbelegung**. Die vorhandenen Arduino-Sketches implementieren ausschliesslich **USB-/Seriell-Kommunikation (CAPS=CDC_ONLY)**. Sie steuern keinerlei Sensorpins an. **E703.11 AODO niemals direkt mit einem GPIO verbinden.** Eine elektrische, bidirektionale und pegelgerechte PLC-Treiberschaltung sowie das Sensorprotokoll sind noch zu entwickeln und zu prüfen.

## Pinbezeichnungen verstehen

- **D2, D3 usw.** sind die **aufgedruckten Board-Pinnamen beziehungsweise Arduino-Digitalpinbezeichnungen**. Auf manchen Boards, besonders dem **Nano ESP32**, stimmt D2 ausdrücklich **nicht** mit Chip-GPIO2 überein.
- **GPIO4, GP2, PA1 usw.** sind die **tatsächlichen Mikrocontroller-Anschlüsse**. Bei XIAO-Boards sind beide Namen angegeben, damit der Anschluss am Header eindeutig ist.
- **PLC-Pin (Vorschlag)**: I/O zur späteren externen, abgesicherten PLC-Schnittstelle. **RX optional**: nur bei einem Hardwaredesign mit getrenntem Lesen/Ansteuern erforderlich. Ein geeigneter bidirektionaler Ein-Pin-Treiber kann stattdessen ausreichen; die endgültige Architektur steht noch nicht fest.
- **USB nativ**: der Mikrocontroller hat selbst einen USB-Controller. **USB-UART**: ein Chip wie CH340/CP210x/FTDI vermittelt. Beide können im Browser als serieller Port funktionieren; keine Variante erzeugt dadurch automatisch E703.11-PLC-Signale.
- **3,3 V / 5 V** ist die **MCU-GPIO-Logikspannung**, nicht eine geprüfte Versorgung für den Sensor. Jede Boardrevision und jede Spezialbeschaltung muss vor einem realen Aufbau geprüft werden.

## 1. ESP32-Familie

| Board | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | RX optional | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Nicht verwenden / Hinweise |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | Natives USB Serial/JTAG via USB-C (sofern direkt verdrahtet) | **GPIO4** | GPIO5 | GPIO6 | GPIO7 | 3,3 V | **GPIO18 = USB D−, GPIO19 = USB D+**; GPIO2/8/9 sind Strapping-Pins. SuperMini-Nachbauten unterscheiden sich |
| **Seeed XIAO ESP32C3** | Native USB | **D2 / GPIO4** | D3 / GPIO5 | D4 / GPIO6 | D5 / GPIO7 | 3,3 V | D0/GPIO2 und GPIO8/9 sind Strapping-Pins; D9/GPIO9 = BOOT |
| ESP32-C3 DevKit / DevKitM-1 | Native USB oder USB-UART, je nach Board | **GPIO4** | GPIO5 | GPIO6 | GPIO7 | 3,3 V | GPIO18/19 für native USB, GPIO2/8/9 für Boot. Pinheader kontrollieren |
| **ESP32-S3 DevKitC-1** | Native USB oder separater USB-UART | **GPIO4** | GPIO5 | GPIO8 | GPIO9 | 3,3 V | GPIO19/20 = native USB D−/D+; GPIO0/3/45/46 beeinflussen Boot; Flash/PSRAM-Varianten beachten |
| **Seeed XIAO ESP32S3** | Native USB | **D3 / GPIO4** | D1 / GPIO2 | D4 / GPIO5 | D5 / GPIO6 | 3,3 V | D4/D5 für I²C reserviert. Bei Sense/Plus Kamera, SD und Sonderpins prüfen; GPIO0 = BOOT |
| **Arduino Nano ESP32** (ESP32-S3) | Native USB | **D2 / GPIO5** | D3 / GPIO6 | A4 / GPIO11 | A5 / GPIO12 | 3,3 V | **D2 ist GPIO5, nicht GPIO2**. In Arduino IDE vorzugsweise die Pin-Symbole D2/D3 verwenden |
| **ESP32-S2 Saola-1** | Native USB, abhängig von Board-/Portausführung | **GPIO4** | GPIO5 | GPIO8 | GPIO9 | 3,3 V | GPIO19/20 = native USB, GPIO0 = BOOT |
| **ESP32-C6 DevKitC-1** | Native USB Serial/JTAG oder USB-UART | **GPIO10** | GPIO11 | GPIO6 | GPIO7 | 3,3 V | GPIO12/13 = USB D−/D+; GPIO4/5/8/9/15 sind Strapping-Pins |
| **Seeed XIAO ESP32C6** | Native USB Serial/JTAG | **D3 / GPIO21** | D2 / GPIO2 | D4 / GPIO22 | D5 / GPIO23 | 3,3 V | D4/D5 für I²C reserviert; GPIO9 = BOOT, GPIO3/14 dienen der Antennensteuerung |
| **ESP32 DevKit V1 / DevKitC / WROOM-32** | USB-UART, kein natives USB im klassischen ESP32 | **GPIO25** | GPIO26 | GPIO21 | GPIO22 | 3,3 V | GPIO6–11 für Flash, GPIO34–39 nur Eingang; GPIO0/2/5/12/15 für Boot |
| **ESP8266 NodeMCU / Wemos D1 mini** | USB-UART | **D5 / GPIO14** | D6 / GPIO12 | D2 / GPIO4 | D1 / GPIO5 | 3,3 V | D3/GPIO0, D4/GPIO2, D8/GPIO15 beeinflussen Boot; D1/D2 für I²C reserviert |

**Für deinen ESP32-C3 SuperMini:** **GPIO4 für die künftige PLC-Treiberstufe reservieren, gegebenenfalls GPIO5 für das Empfangssignal.** Die native USB-Verbindung verwendet weiterhin **GPIO18/19**. Im vorhandenen Sketch sind GPIO4/5 **nicht aktiv** und brauchen für den reinen USB-Handshake nicht angeschlossen zu werden.

## 2. Gängige originale Arduino-Boards

| Board / MCU | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | RX optional | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Wichtiger Hinweis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **UNO R3** / ATmega328P | USB-UART/USB-Bridge | **D2** | D3 | A4 | A5 | 5 V | USB gehört nicht zum ATmega328P; sehr kleiner RAM |
| **Nano Classic / Nano V3** / ATmega328P | USB-UART/USB-Bridge | **D2** | D3 | A4 | A5 | 5 V | Gleiche MCU-Grundlage wie UNO R3 |
| **Nano Every** / ATmega4809 | USB-Bridge | **D2** | D3 | A4 | A5 | 5 V | Nano-Every-Arduino-Core verwenden |
| **Mega 2560** / ATmega2560 | USB-Bridge | **D2** | D3 | D20 | D21 | 5 V | Viele I/Os, aber 8-Bit-MCU |
| **UNO R4 Minima** / Renesas RA4M1 | Natives USB | **D2** | D3 | A4 | A5 | 5 V | 32 Bit, USB-C |
| **UNO R4 WiFi** / RA4M1 + ESP32-S3 | USB über Boardelektronik | **D2 am UNO-Header (RA4M1)** | D3 | A4 | A5 | 5 V am UNO-Header | **ESP32-S3-Header ist separat und 3,3 V!** Nicht verwechseln |
| **Leonardo / Micro** / ATmega32U4 | Natives USB-CDC | **D4** | D5 | D2 | D3 | 5 V | D2/D3 sind häufig I²C SDA/SCL; deshalb D4/D5 vorgeschlagen |
| **Pro Micro** / ATmega32U4 | Natives USB-CDC | **D4** | D5 | D2 | D3 | 5 V oder 3,3 V | Beim Kauf die tatsächlich vorliegende 5-V-/3,3-V-Variante prüfen |
| **Nano 33 IoT** / SAMD21 | Natives USB | **D2** | D3 | A4 | A5 | 3,3 V | Keine 5 V an GPIO anlegen |
| **Nano 33 BLE / BLE Sense** / nRF52840 | Natives USB | **D2** | D3 | A4 | A5 | 3,3 V | Ältere Ausführungen teils abgekündigt |
| **Nano RP2040 Connect** / RP2040 | Natives USB | **D2 / GPIO25** | D3 / GPIO15 | A4 / GPIO12 | A5 / GPIO13 | 3,3 V | GPIO-Headerzuordnung **anders als beim Raspberry Pi Pico** |

**Hinweis:** Arduino UNO R3, Classic Nano, Mega und Nano Every sind für einen Seriell-/USB-Test verwendbar. Für zeitkritische E703.11-PLC-Telegramme müssen Timing, freie GPIOs und Ressourcen gesondert geprüft werden. Ein Board mit 5-V-I/O ersetzt keine abgesicherte Analog-/PLC-Treiberschaltung.

## 3. Weitere Arduino-kompatible Mikrocontrollerboards

| Board / MCU | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | RX optional | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Besonderheit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Raspberry Pi Pico / Pico W** / RP2040 | Natives USB | **GP2 / GPIO2** | GP3 / GPIO3 | GP4 / GPIO4 | GP5 / GPIO5 | 3,3 V | **PIO** ist für zeitkritische Signalfolgen interessant |
| **Raspberry Pi Pico 2 / Pico 2 W** / RP2350 | Natives USB | **GP2 / GPIO2** | GP3 / GPIO3 | GP4 / GPIO4 | GP5 / GPIO5 | 3,3 V | RP2350-Datenblatt und GPIO-Eigenschaften prüfen |
| **Seeed XIAO RP2040** | Natives USB | **D2 / GPIO28** | D1 / GPIO27 | D4 / GPIO6 | D5 / GPIO7 | 3,3 V | XIAO-D2 ist nicht Pico-GP2 |
| **Teensy 4.0** / i.MX RT1062 | Natives USB | **D2** | D3 | D18 | D19 | 3,3 V | Sehr schnelle MCU; eigene Firmware nötig |
| **STM32 Blue Pill** / STM32F103 | USB-FS im Chip, CDC je nach Core/Board | **PA1** | PA2 | PB7 | PB6 | 3,3 V | USB-CDC und USB-Pull-up-Beschaltung der Variante prüfen |

## 4. Physischer Anschluss: noch nicht direkt am E703.11!

**Ein vorgeschlagener GPIO bedeutet ausdrücklich nicht, dass du AODO daran direkt anschliessen darfst.** Die künftig zu entwickelnde Verbindung sieht prinzipiell so aus:

~~~text
PC / Chrome / Web Serial
          │ USB (native USB oder USB-UART)
          ▼
ESP32 / Arduino / RP2040
          │ vorgeschlagener PLC-GPIO, z. B. C3 GPIO4
          │ optional separater RX-GPIO, z. B. C3 GPIO5
          ▼
[ Geprüfte bidirektionale PLC-Schnittstelle:
  Pegelanpassung, sichere Richtung, Schutz und Timing ]
          │
          ▼
E703.11 AODO/PLC
(separate, zum Datenblatt passende Sensorversorgung)
~~~

Für die Freigabe dieser Schnittstelle sind insbesondere die **AODO-Signalrichtung**, der **Ruhepegel**, der **zulässige Pin-Strom**, **Schutz-/Pegelwandler**, **Startfenster**, **Telegramm-Timing**, **CRC**, **Readback** und ein **Kaltstarttest** zu klären. 3,3-V-ESP-/RP2040-GPIOs sind nicht 5-V-tolerant. Auch 5-V-Arduinos dürfen nicht gegen einen aktiv getriebenen Ausgang des Sensors arbeiten.

## 5. Was du bereits mit dem ESP32-C3 SuperMini testen kannst

Die aktuelle Test-Firmware ist [**esp32c3_supermini.ino**](../firmware/esp32c3_supermini/esp32c3_supermini.ino).

1. Arduino IDE und **ESP32 by Espressif Systems** installieren.
2. Board **ESP32C3 Dev Module** auswählen, **USB CDC On Boot: Enabled** aktivieren.
3. SuperMini via **USB-Datenkabel** verbinden und Sketch hochladen. Falls nötig BOOT beim Reset gedrückt halten.
4. Serial Monitor: **115200 Baud, Newline**, Befehl **BRIDGE_INFO**.

~~~text
# E70311-BRIDGE V1 CAPS=CDC_ONLY
:
~~~

5. Serial Monitor schliessen. In der [Web-App](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/) unter **USB & Chip → Programmieradapter** die experimentelle USB-Bridge auswählen.
6. Die Diagnose **CDC_ONLY** bedeutet: **USB-Verbindung zum SuperMini funktioniert, aber noch keine Kommunikation mit dem E703.11**.

**Keinen E703.11 an GPIO4/5 anschliessen, solange die externe Treiberschaltung und das Protokoll nicht vorliegen.** Die Firmware konfiguriert bewusst **keinen** dieser Pins.

## 6. Herstellerquellen für die Pinbelegung

Die Original-Pinouts haben stets Vorrang vor Angaben für ähnlich aussehende Boards. Besonders bei **SuperMini-Nachbauten** die tatsächlichen Aufdrucke und Platinenrevision prüfen.

- [Espressif – ESP32-C3 USB und Boot](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/get-started/establish-serial-connection.html)
- [Espressif – ESP32 DevKitC](https://documentation.espressif.com/api/resource/path/docs/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [Espressif – ESP32-S3 DevKitC-1](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.0.html)
- [Espressif – ESP32-S2 Saola-1](https://docs.espressif.com/projects/arduino-esp32/en/latest/boards/ESP32-S2-Saola-1.html)
- [Espressif – ESP32-C6 DevKitC-1](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html)
- [Seeed – XIAO ESP32C3](https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/)
- [Seeed – XIAO ESP32S3](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
- [Seeed – XIAO ESP32C6](https://wiki.seeedstudio.com/xiao_esp32c6_getting_started/)
- [Arduino – Nano ESP32 D-/GPIO-Pinzuordnung](https://support.arduino.cc/hc/en-us/articles/10483225565980-Select-pin-numbering-for-Nano-ESP32-in-Arduino-IDE)
- [Arduino – UNO R4 Minima](https://docs.arduino.cc/hardware/uno-r4-minima/)
- [Arduino – UNO R4 WiFi](https://docs.arduino.cc/hardware/uno-r4-wifi/)
- [Arduino – Nano-Familie: Logikpegel](https://docs.arduino.cc/learn/hardware/nano-pcb-guide/)
- [Arduino – Nano RP2040 Connect](https://docs.arduino.cc/hardware/nano-rp2040-connect/)
- [Arduino – Leonardo / native USB](https://docs.arduino.cc/hardware/leonardo/)
- [Seeed – XIAO RP2040](https://wiki.seeedstudio.com/XIAO-RP2040/)
- [Raspberry Pi – Pico-Familie](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html)

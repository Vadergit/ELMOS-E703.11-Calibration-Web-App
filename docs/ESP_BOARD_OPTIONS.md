# ESP32- und Arduino-kompatible Boards: AODO / 1-Wire und I²C-Pinbelegung

Für die ESP32-C3-Firmware v0.3 gilt die [PLC-Testanleitung](ESP32_C3_PLC_TEST.md). Die folgenden Hinweise zum reinen USB-Test beziehen sich auf die CDC-Beispielfirmware.

**Stand: v0.6.0 · Referenz für die zukünftige E703.11-PLC-Bridge**

Dieser Guide umfasst die gängigen ESP32-, Arduino-, RP2040- und weiteren Arduino-kompatiblen Boards. Er dokumentiert **beide E703.11-Kommunikationswege**: einen vorgeschlagenen MCU-GPIO für **AODO / 1-Wire** sowie separate MCU-Pins für **I²C SDA und SCL**.

> **Sicherheitsgrenze:** Die hier genannten GPIOs sind **Planungsvorschläge, keine heute funktionierende E703.11-Anschlussbelegung**. Die vorhandenen Arduino-Sketches implementieren ausschliesslich **USB-/Seriell-Kommunikation (CAPS=CDC_ONLY)**. Sie steuern weder AODO noch die I²C-Anschlüsse des Sensors an. **E703.11 AODO niemals direkt an einen MCU-GPIO anschliessen!** Für 1-Wire und I²C müssen elektrische Schnittstelle, Buspegel, Schutzbeschaltung, I²C-Adresse, CRC und Firmware geprüft beziehungsweise implementiert werden.

## E703.11: korrekte Signalnamen



| Signal am E703.11 | Funktion | MCU-Seite |
| --- | --- | --- |
| **AODO** | **1-Wire / PLC über die Ausgangsleitung** | AODO-/1-Wire-GPIO aus der Boardtabelle, **nur über geprüften bidirektionalen Treiber** |
| **MISO/SDA** | **I²C SDA** (Datenleitung) | SDA-Spalte der Boardtabelle |
| **SCK/SCL** | **I²C SCL** (Taktleitung) | SCL-Spalte der Boardtabelle |
| **NCS/SA0** | Chip-/Adressfunktion (abhängig vom Modus) | Konkrete Beschaltung gemäss vollständigem E703.11-Datenblatt |

**1-Wire und I²C sind unterschiedliche Schnittstellen.** Die Pinvorschläge sind absichtlich **kollisionsfrei**, damit ein späteres Interface beide Wege vorsehen kann. Das bedeutet weder, dass beide gleichzeitig aktiv sein dürfen, noch dass die aktuelle Firmware sie bereits unterstützt.

## Pinbezeichnungen verstehen

- **D2, D3 usw.** sind die aufgedruckten Board- beziehungsweise Arduino-Pinnamen. Auf dem Nano ESP32 ist beispielsweise D2 **nicht** GPIO2.
- **GPIO4, GP2, PA1 usw.** sind die tatsächlichen Controller-GPIOs. Bei XIAO-Boards werden die Board- und GPIO-Namen gemeinsam aufgeführt.
- **AODO / 1-Wire (MCU-GPIO)** bezeichnet die MCU-Seite für die spätere **externe bidirektionale 1-Wire-Treiberstufe**. Senden und Empfangen erfolgen über denselben 1-Wire-GPIO.
- **I²C SDA (MCU)** wäre über eine elektrisch geeignete Schnittstelle mit **E703.11 MISO/SDA** verbunden. **I²C SCL (MCU)** entsprechend mit **E703.11 SCK/SCL**. Pull-ups und Pegel müssen zur vollständigen Schaltung passen.
- **ESP32-SDA/SCL sind oft flexibel wählbar.** Die Tabelle enthält dann **ausgewählte konfliktarme Pins, nicht zwingend die Arduino-Board-Defaults**. Diese sind in der späteren Firmware explizit zu konfigurieren. Klassische Arduino-Boards verwenden ihre üblichen SDA-/SCL-Pins.
- **USB nativ / USB-UART** beschreibt nur den PC-Anschluss, nicht das Sensorprotokoll. Der vorhandene Test-Sketch meldet weiterhin ausschliesslich **CAPS=CDC_ONLY**.
- **3,3 V / 5 V** bezeichnet die MCU-I/O-Logikspannung, **nicht** eine sichere Spannung am Sensoranschluss. Insbesondere I²C-Pull-ups müssen zu den zugelassenen GPIO-Spannungen passen.

## 1. ESP32-Familie

| Board | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Nicht verwenden / Hinweise |
| --- | --- | --- | --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | Natives USB Serial/JTAG via USB-C (sofern direkt verdrahtet) | **GPIO4** | GPIO6 | GPIO7 | 3,3 V | **GPIO18 = USB D−, GPIO19 = USB D+**; GPIO2/8/9 sind Strapping-Pins. SuperMini-Nachbauten unterscheiden sich |
| **Seeed XIAO ESP32C3** | Native USB | **D2 / GPIO4** | D4 / GPIO6 | D5 / GPIO7 | 3,3 V | D0/GPIO2 und GPIO8/9 sind Strapping-Pins; D9/GPIO9 = BOOT |
| ESP32-C3 DevKit / DevKitM-1 | Native USB oder USB-UART, je nach Board | **GPIO4** | GPIO6 | GPIO7 | 3,3 V | GPIO18/19 für native USB, GPIO2/8/9 für Boot. Pinheader kontrollieren |
| **ESP32-S3 DevKitC-1** | Native USB oder separater USB-UART | **GPIO4** | GPIO8 | GPIO9 | 3,3 V | GPIO19/20 = native USB D−/D+; GPIO0/3/45/46 beeinflussen Boot; Flash/PSRAM-Varianten beachten |
| **Seeed XIAO ESP32S3** | Native USB | **D3 / GPIO4** | D4 / GPIO5 | D5 / GPIO6 | 3,3 V | D4/D5 für I²C reserviert. Bei Sense/Plus Kamera, SD und Sonderpins prüfen; GPIO0 = BOOT |
| **Arduino Nano ESP32** (ESP32-S3) | Native USB | **D2 / GPIO5** | A4 / GPIO11 | A5 / GPIO12 | 3,3 V | **D2 ist GPIO5, nicht GPIO2**. In Arduino IDE vorzugsweise die Pin-Symbole D2/D3 verwenden |
| **ESP32-S2 Saola-1** | Native USB, abhängig von Board-/Portausführung | **GPIO4** | GPIO8 | GPIO9 | 3,3 V | GPIO19/20 = native USB, GPIO0 = BOOT |
| **ESP32-C6 DevKitC-1** | Native USB Serial/JTAG oder USB-UART | **GPIO10** | GPIO6 | GPIO7 | 3,3 V | GPIO12/13 = USB D−/D+; GPIO4/5/8/9/15 sind Strapping-Pins |
| **Seeed XIAO ESP32C6** | Native USB Serial/JTAG | **D3 / GPIO21** | D4 / GPIO22 | D5 / GPIO23 | 3,3 V | D4/D5 für I²C reserviert; GPIO9 = BOOT, GPIO3/14 dienen der Antennensteuerung |
| **ESP32 DevKit V1 / DevKitC / WROOM-32** | USB-UART, kein natives USB im klassischen ESP32 | **GPIO25** | GPIO21 | GPIO22 | 3,3 V | GPIO6–11 für Flash, GPIO34–39 nur Eingang; GPIO0/2/5/12/15 für Boot |
| **ESP8266 NodeMCU / Wemos D1 mini** | USB-UART | **D5 / GPIO14** | D2 / GPIO4 | D1 / GPIO5 | 3,3 V | D3/GPIO0, D4/GPIO2, D8/GPIO15 beeinflussen Boot; D1/D2 für I²C reserviert |

**Für deinen ESP32-C3 SuperMini:** **GPIO4 für AODO / 1-Wire** sowie **GPIO6 für I²C SDA** und **GPIO7 für I²C SCL** reservieren. **GPIO18 und GPIO19 bleiben für USB.** Im aktuellen USB-Test-Sketch werden GPIO4/6/7 **nicht** angesteuert oder initialisiert.

## 2. Gängige originale Arduino-Boards

| Board / MCU | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Wichtiger Hinweis |
| --- | --- | --- | --- | --- | --- | --- |
| **UNO R3** / ATmega328P | USB-UART/USB-Bridge | **D2** | A4 | A5 | 5 V | USB gehört nicht zum ATmega328P; sehr kleiner RAM |
| **Nano Classic / Nano V3** / ATmega328P | USB-UART/USB-Bridge | **D2** | A4 | A5 | 5 V | Gleiche MCU-Grundlage wie UNO R3 |
| **Nano Every** / ATmega4809 | USB-Bridge | **D2** | A4 | A5 | 5 V | Nano-Every-Arduino-Core verwenden |
| **Mega 2560** / ATmega2560 | USB-Bridge | **D2** | D20 | D21 | 5 V | Viele I/Os, aber 8-Bit-MCU |
| **UNO R4 Minima** / Renesas RA4M1 | Natives USB | **D2** | A4 | A5 | 5 V | 32 Bit, USB-C |
| **UNO R4 WiFi** / RA4M1 + ESP32-S3 | USB über Boardelektronik | **D2 am UNO-Header (RA4M1)** | A4 | A5 | 5 V am UNO-Header | **ESP32-S3-Header ist separat und 3,3 V!** Nicht verwechseln |
| **Leonardo / Micro** / ATmega32U4 | Natives USB-CDC | **D4** | D2 | D3 | 5 V | D2/D3 sind häufig I²C SDA/SCL; deshalb D4/D5 vorgeschlagen |
| **Pro Micro** / ATmega32U4 | Natives USB-CDC | **D4** | D2 | D3 | 5 V oder 3,3 V | Beim Kauf die tatsächlich vorliegende 5-V-/3,3-V-Variante prüfen |
| **Nano 33 IoT** / SAMD21 | Natives USB | **D2** | A4 | A5 | 3,3 V | Keine 5 V an GPIO anlegen |
| **Nano 33 BLE / BLE Sense** / nRF52840 | Natives USB | **D2** | A4 | A5 | 3,3 V | Ältere Ausführungen teils abgekündigt |
| **Nano RP2040 Connect** / RP2040 | Natives USB | **D2 / GPIO25** | A4 / GPIO12 | A5 / GPIO13 | 3,3 V | GPIO-Headerzuordnung **anders als beim Raspberry Pi Pico** |

**Hinweis:** Arduino UNO R3, Classic Nano, Mega und Nano Every sind für einen Seriell-/USB-Test verwendbar. Für zeitkritische E703.11-PLC-Telegramme müssen Timing, freie GPIOs und Ressourcen gesondert geprüft werden. Ein Board mit 5-V-I/O ersetzt keine abgesicherte Analog-/PLC-Treiberschaltung.

## 3. Weitere Arduino-kompatible Mikrocontrollerboards

| Board / MCU | PC-Verbindung | AODO / 1-Wire (MCU-GPIO) | I²C SDA (MCU) | I²C SCL (MCU) | I/O | Besonderheit |
| --- | --- | --- | --- | --- | --- | --- |
| **Raspberry Pi Pico / Pico W** / RP2040 | Natives USB | **GP2 / GPIO2** | GP4 / GPIO4 | GP5 / GPIO5 | 3,3 V | **PIO** ist für zeitkritische Signalfolgen interessant |
| **Raspberry Pi Pico 2 / Pico 2 W** / RP2350 | Natives USB | **GP2 / GPIO2** | GP4 / GPIO4 | GP5 / GPIO5 | 3,3 V | RP2350-Datenblatt und GPIO-Eigenschaften prüfen |
| **Seeed XIAO RP2040** | Natives USB | **D2 / GPIO28** | D4 / GPIO6 | D5 / GPIO7 | 3,3 V | XIAO-D2 ist nicht Pico-GP2 |
| **Teensy 4.0** / i.MX RT1062 | Natives USB | **D2** | D18 | D19 | 3,3 V | Sehr schnelle MCU; eigene Firmware nötig |
| **STM32 Blue Pill** / STM32F103 | USB-FS im Chip, CDC je nach Core/Board | **PA1** | PB7 | PB6 | 3,3 V | USB-CDC und USB-Pull-up-Beschaltung der Variante prüfen |

## 4. Physischer Anschluss: noch nicht direkt am E703.11!

**AODO / 1-Wire und I²C verwenden unterschiedliche Sensoranschlüsse.** Das folgende Beispiel zeigt die mögliche spätere Anordnung, **keine bereits freigegebene Verdrahtung**:

~~~text
PC / Chrome / Web Serial
          │ USB
          ▼
ESP32-C3 SuperMini (Beispiel)
          ├── GPIO4: AODO / 1-Wire (MCU-Steuersignal)
          │          ▼ geprüfte bidirektionale Pegel-/Schutzstufe
          │          E703.11 AODO
          │
          ├── GPIO6: I²C SDA
          │          ▼ geprüfte I²C-Pegel und Pull-ups
          │          E703.11 MISO/SDA
          │
          └── GPIO7: I²C SCL
                     ▼ geprüfte I²C-Pegel und Pull-ups
                     E703.11 SCK/SCL

E703.11 NCS/SA0: Adress-/Modusbeschaltung prüfen
E703.11 VDD/VSS: geeignete Versorgung / Bezugspotenzial
~~~

Für die Freigabe sind insbesondere die **AODO-Signalrichtung**, der **Ruhepegel**, der **zulässige Pin-Strom**, die **Schutz-/Pegelwandler**, **Startfenster**, **Telegramm-Timing**, **I²C-Adresse/NCS/SA0**, **I²C-Pull-ups**, **CRC**, **Readback** und ein **Kaltstarttest** zu klären. 3,3-V-ESP-/RP2040-GPIOs sind nicht 5-V-tolerant. Auch 5-V-Arduinos dürfen nicht gegen einen aktiv getriebenen Ausgang des Sensors arbeiten.

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

**Keinen E703.11 an GPIO4/6/7 anschliessen, solange die externen Schnittstellen und Protokolle nicht verifiziert sind.** Der USB-Test-Sketch konfiguriert bewusst **keinen** dieser Pins.

## 6. Herstellerquellen für die Pinbelegung

Die Original-Pinouts haben stets Vorrang vor Angaben für ähnlich aussehende Boards. Besonders bei **SuperMini-Nachbauten** die tatsächlichen Aufdrucke und Platinenrevision prüfen.

- [Elmos – E703.11 mit AODO, MISO/SDA und SCK/SCL (Produktkatalog, Seite 12)](https://www.elmos.com/fileadmin/elmos-website/about-us/company/mediathek/produktpublicationen/elmos-product-catalog_2021_2022_web_v1.pdf)
- [Espressif – Arduino-ESP32 I²C und frei wählbare Pins](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html)
- [Arduino – I²C-Standardbelegungen verschiedener Boards](https://github.com/arduino/reference-en/blob/master/Language/Functions/Communication/Wire.adoc)
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
- [Arduino – Nano ESP32 Pinout (I²C A4/GPIO11 und A5/GPIO12)](https://docs.arduino.cc/resources/pinouts/ABX00083-full-pinout.pdf)
- [Arduino – Nano RP2040 Connect Pinout (I²C A4/GPIO12 und A5/GPIO13)](https://docs.arduino.cc/resources/pinouts/ABX00053-full-pinout.pdf)
- [Seeed – XIAO RP2040](https://wiki.seeedstudio.com/XIAO-RP2040/)
- [Raspberry Pi – Pico-Familie](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html)

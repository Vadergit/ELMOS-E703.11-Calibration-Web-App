# ESP32-C3 SuperMini mit E703.11 testen

Firmware v0.10 unterstützt den PLC-Zugriff über AODO und stellt der lokalen Web-App die bestehenden Abläufe für Registerlesen, AFE/DSP im RAM und User-NVM bereit. Das PLC-Timing und die elektrische Schaltung müssen am Sensor geprüft werden. Den ersten Test auf Chip-Erkennung, Live-Werte und das Lesen des Original-NVM beschränken. RAM-Schreiben anschliessend an einem Testchip prüfen. Vor permanentem Schreiben das Original-NVM exportieren.


## Ausgang separat im NVM speichern (experimenteller Quellcode v0.11-dev)

Der Web-Kalibrierassistent ab v0.7.109 besitzt einen **separaten Ausgangs-NVM-Modus** für den ESP32-C3 SuperMini. Die bisherige Firmware v0.10 aus dem Web-Installer hat diesen Modus **nicht**. Ein reines Update der Webseite reicht daher nicht aus.

Die aktuelle Quellcode-Firmware unter [esp32c3_supermini.ino](../firmware/esp32c3_supermini/esp32c3_supermini.ino) enthält einen **noch nicht auf realer Hardware validierten** Befehl `NVM ARM OUTPUT`. Er wird vom ESP32-C3 nur nach bestätigtem Sensor-Kaltstart angenommen. Über `BRIDGE_INFO` meldet diese Firmware die gesonderte Testfähigkeit `BRIDGE_AODO_OUTPUT_NVM_TEST`. Die Webseite prüft diese Kennung; ohne sie bleibt der Button gesperrt.

Nur bei analogem, bereits im NVM vorhandenen AODO-Modus 1–3 und bestätigter Chip-UID darf ein Ausgangsplan die folgenden Wörter ändern: **16 (CFG_EN ausschliesslich Bits 6 und 7), 57 (AODO_O), 58 (AODO_F), 59/60 (Clipping-Limits), 63 (CRC16)**. Eine Änderung von Ausgangsmodus, CFG_AODO, One-Wire-Startfenster, Werks-, AFE- oder DSP-Kalibrierregistern bleibt gesperrt. Die Ausgangsvorschau, vollständige NVM-Sicherung und Readback-Kontrolle sind vor dem Programmieren weiterhin erforderlich.

### Testfirmware von Hand erstellen

1. Bestehende Kalibrierung und **alle 64 NVM-Wörter sichern**. Noch ungesicherte RAM-Kalibrierwerte gehen beim ESP32-Firmwareupdate beziehungsweise beim Neustart des Sensors möglicherweise verloren.
2. Arduino IDE mit dem Boardpaket **ESP32 by Espressif Systems** verwenden, Board **ESP32C3 Dev Module**, **USB CDC On Boot = Enabled**. Den Sketch `firmware/esp32c3_supermini/esp32c3_supermini.ino` mitsamt `plc_read.h` öffnen und die mitgelieferte Bibliothek `firmware/libraries/ElmosI2c` installieren.
3. Quellcode kompilieren und auf den **ESP32-C3** flashen, **nicht** auf den E703.11. Die bestehende GPIO4-/GPIO5-/GPIO6-/GPIO10-Verdrahtung und 3.3-V-Pegel beachten.
4. Sensor mit echter Stromunterbrechung neu starten, in Chrome erneut verbinden und überprüfen, dass `BRIDGE_INFO` die Fähigkeit `BRIDGE_AODO_OUTPUT_NVM_TEST` meldet. Danach **«Nur Ausgang ändern»**, NVM sichern, Scaling/Clipping vormerken und die Änderungsliste vor dem Schreiben prüfen.
5. Ausschliesslich an einem **entbehrlichen Testchip** programmieren. NVM vollständig zurücklesen, CRC und One-Wire-Kaltstart prüfen und die tatsächliche Ausgangsspannung separat messen.

**Nicht bestätigt:** Firmware-Build, Hardware-End-to-End-Test und der tatsächliche NVM-Schreibvorgang über temporäre One-Wire-RAM-Recovery. Die `v0.10`-Dateien im Web-Installer sind unverändert und besitzen diese neue Funktion ausdrücklich nicht. Diese Funktion ist **kein freigegebener Produktionsprozess**.

## I²C mit USB-Bridge v0.10

| ESP32-C3 | Elmos E703.11 |
|---|---|
| GPIO6 | SDA (Pin 11, MISO/SDA) |
| GPIO7 | SCL (Pin 10, SCK/SCL) |
| GND | Gemeinsame Masse |
| GPIO4 | AODO (Pin 14), für One-Wire und bei Bedarf die I²C-Aktivierung im RAM |
| GPIO10 | Vorhandener Schaltausgang für die Sensorversorgung |

Die Firmware schaltet interne Pull-ups ein. Für kurze Leitungen kann das für den ersten Test genügen. Bei Bedarf externe Pull-ups zur 3,3-V-Versorgung des Sensors ergänzen, beispielsweise je 4,7 kΩ. Bei schaltbarer Versorgung liegen die Pull-ups auf der geschalteten Seite. Für gemeinsame Verdrahtung den One-Wire-Modus «Dieselbe Leitung für Senden und Empfangen» verwenden. Im getrennten One-Wire-Aufbau dient GPIO6 als RX und darf nicht zugleich mit SDA verbunden sein.

In der Web-App «DIY: ESP32-C3 SuperMini / Arduino Pro Micro» und «I²C · SCL / SDA» wählen und den USB-Port verbinden. Die Bridge prüft die Chip-Kennung und nutzt CRC-geschützte Übertragung. Ist I²C im Sensor deaktiviert, versucht die Bridge bei aktivierter Steuerung der Sensorversorgung, I²C über AODO für die laufende Sitzung einzuschalten. Dafür muss AODO ebenfalls angeschlossen sein. Nach einem Stromunterbruch gilt wieder die ursprüngliche Chip-Konfiguration. Live-Messung, NVM-Lesen und der Abgleich im RAM stehen über I²C zur Verfügung. Dauerhaftes NVM-Schreiben nutzt die bestehende Freigabe über One-Wire.

## Anschluss über eine externe Treiberstufe

| ESP32-C3 | Anschluss an der Treiberstufe |
| --- | --- |
| GPIO4 | Nichtinvertierender TX-Eingang des Tri-State-Treibers |
| GPIO5 | Aktiver High-OE des Treibers mit externem Pull-down, damit der Treiber beim Reset hochohmig bleibt |
| GPIO6 | Nichtinvertierender RX-Ausgang mit 3,3-V-Pegel |
| GPIO10 | Optionaler aktiver High-Enable eines externen Lastschalters für Sensor-VDD. Pull-down am Enable und ausreichend schnelle Entladung und Einschaltflanke vorsehen |
| GND | Gemeinsame Masse von Treiber, Sensor und ESP32 |

Bei Firmware v0.3 liegt der Lastschalter an GPIO7. Nach dem Flashen von v0.4 die EN-Leitung auf GPIO10 umstecken.

AODO an der Sensorseite mit dem Tri-State-Ausgang über einen Schutzwiderstand und mit dem RX-Eingang verbinden. AODO kann bis zur Sensorversorgung aussteuern. GPIOs des ESP32 nur mit 3,3-V-Logik betreiben.

Für einen bestätigten 3,3-V-Sensoraufbau eignet sich als Ausgangspunkt ein [SN74LVC1G126](https://www.ti.com/product/SN74LVC1G126) an 3,3 V für TX und ein [SN74LVC1G17](https://www.ti.com/product/SN74LVC1G17) an 3,3 V für RX. Bei einem bestätigten 5-V-Aufbau kann TX über einen [SN74AHCT1G126](https://www.ti.com/product/SN74AHCT1G126) an 5 V erfolgen, während der SN74LVC1G17 auf 3,3 V bleibt. Sein Eingang toleriert bis 5,5 V. Dimensioniere den Serienwiderstand nach zulässigem AODO-Strom bei Treiberkonflikt und tatsächlicher Leitungskapazität. Prüfe am Oszilloskop, dass die Signale die Schwellen erreichen und der ESP den Treiber vor der Sensorantwort freigibt. Bei aktiv geschalteter Sensorversorgung müssen Treiber und Schutzbeschaltung Rückspeisung bei ausgeschaltetem Sensor verhindern.

## Alternativ: Senden und Empfangen auf GPIO4

Bei Firmware ab v0.6 in der Web-App **GPIO4 für Senden und Empfangen** wählen, wenn die bidirektionale AODO-Schnittstelle auf GPIO4 liegt. GPIO5 bleibt dabei deaktiviert, und GPIO6 wird nicht als Empfänger verwendet. GPIO4 schaltet nach dem Senden auf Eingang. Die Schaltung muss den GPIO4-Pegel auf 3,3-V-Logik begrenzen und den Strom bei einem Treiberkonflikt begrenzen. Bei unbekanntem Pegel oder 5 V auf AODO GPIO4 nicht direkt verbinden.

## Ablauf

1. Die [Web-App auf GitHub Pages](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/) in Chrome öffnen. Für einen lokalen Test im Projektordner `python3 -m http.server 8765 --bind 127.0.0.1` starten und [die lokale App](http://127.0.0.1:8765/) öffnen.
2. **DIY: ESP32-C3 SuperMini / Arduino Pro Micro** wählen. **100 kBd** ist der Startwert für automatische Erkennung oder fest eingestellte 100 kBd. **25 kBd** für entsprechend konfigurierte Sensoren wählen.
3. Bei dauerhaft verfügbarem PLC den Sensor einschalten und **USB-Port auswählen**. Für Sensoren mit kurzem Startfenster die GPIO10-Option nur bei angeschlossenem Lastschalter aktivieren. Der Aufbau muss PLC-Empfang und Sensorantwort zulassen.
4. Die App prüft zuerst 0x6C und 0x7C. Nur wenn beide ohne gültige Antwort bleiben, versucht sie die PSSC-Freigabe, die CFG_SPI_I2C temporär im Sensor-RAM setzt. Danach ist NVM-Schreiben gesperrt. Chip-ID und Live-Werte kontrollieren. Falls ein Sensor antwortet, aber CRC- oder Framefehler auftreten, AODO und OE mit dem Oszilloskop prüfen.
5. Original-NVM lesen und exportieren. Danach AFE und DSP im RAM testen und die rückgelesenen Werte kontrollieren. Permanentes Speichern verwendet den vorhandenen Ablauf mit Chip-ID, Änderungsprüfung, CRC und Rücklesekontrolle.

Wenn GPIO10 den externen Lastschalter steuert, aktiviere vor dem Verbinden **Sensorversorgung steuern**. Nach erfolgreichem NVM-Schreiben startet **Sensor neu starten und NVM prüfen** den E703.11 bei bestehender USB-Verbindung neu. Die Web-App prüft die Chip-ID, liest alle 64 NVM-Wörter mit CRC-Prüfung zurück und vergleicht die Bootregister. Bei separater Sensorversorgung steht die manuelle Neustartprüfung zur Verfügung.

Ohne Web-App kann im seriellen Monitor mit 115200 Baud und Zeilenende `Newline` die Firmware per `BRIDGE_INFO` geprüft werden. Ein Sensor mit bereits aktivem PLC-Registerzugriff lässt sich mit `PLC_UID 100000` oder `PLC_UID 25000` identifizieren.

Mit `PLC RX DIAG` prüft die Bridge bei der aktuell gewählten Baudrate beide Adressen lesend. `ECHO=BOTH` bedeutet, dass GPIO6 beim eigenen Senden beide Pegel gesehen hat. `EDGES` zählt die Signalwechsel nach Freigabe der Leitung. Erst `CRC_OK` bestätigt ein gültiges Antworttelegramm.

Beim Kompilieren mit Arduino CLI die gemeinsame Bibliothek mit `--libraries firmware/libraries` einbinden. In der Arduino IDE kann `firmware/libraries/ElmosI2c` in den Arduino-Bibliotheksordner kopiert werden.

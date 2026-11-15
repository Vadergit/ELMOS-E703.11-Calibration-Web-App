# Pro Micro mit ATmega32U4 als E703.11-Testbridge

Firmware v0.27 unterstützt Chip-Erkennung, Live-Messung und RAM-Kalibrierung über One-Wire (AODO) und I²C. Bei Bedarf aktiviert sie den Zugriff vorübergehend im Sensor-RAM. Dauerhaftes Schreiben von Kalibrierdaten setzt die Freigabe im Kalibrierassistenten voraus. Die [Firmware-Downloads](../firmware-update.html) enthalten Builds für 16 MHz und 8 MHz.

Ab Firmware v0.4 ist D4 standardmässig die bidirektionale AODO-Leitung. D4 schaltet nach jedem Telegramm auf Eingang ohne internen Pull-up. Für diesen Modus eine geeignete bidirektionale Anbindung mit Strombegrenzung verwenden. D5 und D6 bleiben frei. Für I²C D2 mit SDA (Elmos-Pin 11) und D3 mit SCL (Elmos-Pin 10) verbinden. Bei einem 5-V-Pro-Micro und 3,3-V-Sensor einen bidirektionalen I²C-Pegelwandler verwenden.

Für eine externe Treiberstufe mit getrenntem Sender und Empfänger im seriellen Monitor `PLC IO SPLIT` senden. `PLC IO D4` stellt den Standardmodus wieder her. Die folgende Tabelle beschreibt die getrennte Treiberstufe.

| Aufdruck am Pro Micro | Anschluss |
| --- | --- |
| 4 | TX zum nichtinvertierenden Eingang des Tri-State-Treibers |
| 5 | Aktives High-OE des Treibers. Externer Pull-down hält den Treiber beim Reset hochohmig |
| 6 | RX vom nichtinvertierenden AODO-Empfänger, mit Logikpegel passend zum Pro Micro |
| 7 | Optionales aktives High-Enable eines externen Lastschalters für Sensor-VDD |
| GND | Gemeinsame Masse von Pro Micro, Sensor und Treiberstufe |

AODO liegt auf der Sensorseite der Treiberstufe. Den Tri-State-Ausgang über einen geeigneten Schutzwiderstand anschliessen. Die Pegel auf beiden Seiten an die jeweilige Versorgung anpassen. Sensor-VDD über eine geeignete Versorgung oder den externen Lastschalter speisen. D7 liefert nur das Enable-Signal.

In Chrome die Web-App ab v0.7.29 öffnen, **ESP32 / Arduino USB-Bridge** und **1-Wire** oder **I²C** wählen und den seriellen USB-Port des Pro Micro verbinden. Mit 100 kBd beginnen. **Sensorversorgung steuern** nur mit angeschlossenem Lastschalter an D7 aktivieren. Bei einem auf 25 kBd eingestellten Sensor diese Rate wählen.

Firmware-Quellcode: [Pro Micro](../firmware/pro_micro/pro_micro.ino). Der Build muss zum Takt der Platine passen (16 MHz oder 8 MHz). Das AVR-Plattformpaket 1.8.6 benötigt für diesen Sketch die Build-Option `compiler.cpp.extra_flags=-std=gnu++17`.

Beim Kompilieren mit Arduino CLI die gemeinsame Bibliothek mit `--libraries firmware/libraries` einbinden. In der Arduino IDE kann `firmware/libraries/ElmosI2c` in den Arduino-Bibliotheksordner kopiert werden.

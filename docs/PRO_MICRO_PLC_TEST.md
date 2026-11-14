# Pro Micro mit ATmega32U4 als E703.11-Testbridge

Die Firmware unterstützt USB, Chip-Erkennung und Live-Messwerte über AODO. Sie verwendet bei Bedarf die temporäre PLC-Freigabe im Sensor-RAM. EEPROM-Programmierung und Kalibrier-Schreibbefehle sind gesperrt.

| Aufdruck am Pro Micro | Anschluss |
| --- | --- |
| 4 | TX zum nichtinvertierenden Eingang des Tri-State-Treibers |
| 5 | Aktives High-OE des Treibers. Externer Pull-down hält den Treiber beim Reset hochohmig |
| 6 | RX vom nichtinvertierenden AODO-Empfänger, mit Logikpegel passend zum Pro Micro |
| 7 | Optionales aktives High-Enable eines externen Lastschalters für Sensor-VDD |
| GND | Gemeinsame Masse von Pro Micro, Sensor und Treiberstufe |

AODO liegt auf der Sensorseite der Treiberstufe. Den Tri-State-Ausgang über einen geeigneten Schutzwiderstand anschliessen. Die Pegel auf beiden Seiten an die jeweilige Versorgung anpassen. Sensor-VDD über eine geeignete Versorgung oder den externen Lastschalter speisen. D7 liefert nur das Enable-Signal.

In Chrome die Web-App ab v0.7.29 öffnen, **ESP32 / Arduino USB-Bridge** und **1-Wire** wählen und den seriellen USB-Port des Pro Micro verbinden. Mit 100 kBd beginnen. **Sensorversorgung steuern** nur mit angeschlossenem Lastschalter an D7 aktivieren. Bei einem auf 25 kBd eingestellten Sensor diese Rate wählen.

Firmware-Quellcode: [Pro Micro](../firmware/pro_micro/pro_micro.ino). Der Build muss zum Takt der Platine passen (16 MHz oder 8 MHz). Das AVR-Plattformpaket 1.8.6 benötigt für diesen Sketch die Build-Option `compiler.cpp.extra_flags=-std=gnu++17`.

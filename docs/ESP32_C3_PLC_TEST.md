# ESP32-C3 SuperMini mit E703.11 testen

Firmware v0.3 unterstützt den PLC-Zugriff über AODO und stellt der lokalen Web-App die bestehenden Abläufe für Registerlesen, AFE/DSP im RAM und User-NVM bereit. Das PLC-Timing und die elektrische Schaltung müssen am Sensor geprüft werden. Den ersten Test auf Chip-Erkennung, Live-Werte und das Lesen des Original-NVM beschränken. RAM-Schreiben anschliessend an einem Testchip prüfen. Vor permanentem Schreiben das Original-NVM exportieren.

## Anschluss über eine externe Treiberstufe

| ESP32-C3 | Anschluss an der Treiberstufe |
| --- | --- |
| GPIO4 | Nichtinvertierender TX-Eingang des Tri-State-Treibers |
| GPIO5 | Aktiver High-OE des Treibers mit externem Pull-down, damit der Treiber beim Reset hochohmig bleibt |
| GPIO6 | Nichtinvertierender RX-Ausgang mit 3,3-V-Pegel |
| GPIO7 | Optionaler aktiver High-Enable eines externen Lastschalters für Sensor-VDD. Pull-down am Enable und ausreichend schnelle Entladung und Einschaltflanke vorsehen |
| GND | Gemeinsame Masse von Treiber, Sensor und ESP32 |

AODO an der Sensorseite mit dem Tri-State-Ausgang über einen Schutzwiderstand und mit dem RX-Eingang verbinden. AODO kann bis zur Sensorversorgung aussteuern. GPIOs des ESP32 nur mit 3,3-V-Logik betreiben.

Für einen bestätigten 3,3-V-Sensoraufbau eignet sich als Ausgangspunkt ein [SN74LVC1G126](https://www.ti.com/product/SN74LVC1G126) an 3,3 V für TX und ein [SN74LVC1G17](https://www.ti.com/product/SN74LVC1G17) an 3,3 V für RX. Bei einem bestätigten 5-V-Aufbau kann TX über einen [SN74AHCT1G126](https://www.ti.com/product/SN74AHCT1G126) an 5 V erfolgen, während der SN74LVC1G17 auf 3,3 V bleibt. Sein Eingang toleriert bis 5,5 V. Dimensioniere den Serienwiderstand nach zulässigem AODO-Strom bei Treiberkonflikt und tatsächlicher Leitungskapazität. Prüfe am Oszilloskop, dass die Signale die Schwellen erreichen und der ESP den Treiber vor der Sensorantwort freigibt. Bei aktiv geschalteter Sensorversorgung müssen Treiber und Schutzbeschaltung Rückspeisung bei ausgeschaltetem Sensor verhindern.

## Ablauf

1. Die [Web-App auf GitHub Pages](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/) in Chrome öffnen. Für einen lokalen Test im Projektordner `python3 -m http.server 8765 --bind 127.0.0.1` starten und [die lokale App](http://127.0.0.1:8765/) öffnen.
2. **ESP32 / Arduino USB-Bridge** wählen. **100 kBd** ist der Startwert für automatische Erkennung oder fest eingestellte 100 kBd. **25 kBd** für entsprechend konfigurierte Sensoren wählen.
3. Bei dauerhaft verfügbarem PLC den Sensor einschalten und **USB-Port auswählen**. Für Sensoren mit kurzem Startfenster die GPIO7-Option nur bei angeschlossenem Lastschalter aktivieren. Bei 25 kBd benötigen die beiden Freigabetelegramme ein längeres Startfenster als 4 ms. Der Aufbau muss PLC-Empfang und Sensorantwort zulassen.
4. Chip-ID und Live-Werte kontrollieren. Falls ein Sensor antwortet, aber CRC- oder Framefehler auftreten, AODO und OE mit dem Oszilloskop prüfen.
5. Original-NVM lesen und exportieren. Danach AFE und DSP im RAM testen und die rückgelesenen Werte kontrollieren. Permanentes Speichern verwendet den vorhandenen Ablauf mit Chip-ID, Änderungsprüfung, CRC und Rücklesekontrolle.

Wenn GPIO7 den externen Lastschalter steuert, aktiviere vor dem Verbinden **Sensorversorgung über GPIO7 steuern**. Nach erfolgreichem NVM-Schreiben startet **Sensor neu starten und NVM prüfen** den E703.11 bei bestehender USB-Verbindung neu. Die Web-App prüft die Chip-ID, liest alle 64 NVM-Wörter mit CRC-Prüfung zurück und vergleicht die Bootregister. Bei separater Sensorversorgung steht die manuelle Neustartprüfung zur Verfügung.

Ohne Web-App kann im seriellen Monitor mit 115200 Baud und Zeilenende `Newline` die Firmware per `BRIDGE_INFO` geprüft werden. Ein Sensor mit bereits aktivem PLC-Registerzugriff lässt sich mit `PLC_UID 100000` oder `PLC_UID 25000` identifizieren.

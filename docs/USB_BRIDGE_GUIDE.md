# E703.11 DIY-Programmer – ESP32-C3 SuperMini und Arduino Pro Micro

**Stand v0.7.119 · einheitliche Universal-Bridge-Funktionen (Labor-Quellcode)**

Der originale **ELMOS SSP3** bleibt der Standard-Programmieradapter. Alternativ bietet die Web-App die DIY-Programmer-USB-Bridge. Diese unterstützt in diesem Projekt **ausschliesslich**:

| DIY-Programmer | Aktuelle Firmware | Anschlussanleitung | Firmware aktualisieren |
| --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | v0.12 (Labor) | [ESP32-C3 / E703.11](ESP32_C3_PLC_TEST.md) | [ESP32-C3 Web-Installer](../firmware-update.html#esp32) |
| **Arduino Pro Micro (ATmega32U4)** | v0.28 (Labor) | [Pro Micro / E703.11](PRO_MICRO_PLC_TEST.md) | [Pro Micro Installer / HEX](../firmware-update.html#pro-micro) |

Die frühere allgemeine Liste mit weiteren ESP-, Arduino- und Mikrocontrollerboards wurde aus der unterstützten DIY-Auswahl entfernt. Eine [kompakte Übersicht der zwei Boards](ESP_BOARD_OPTIONS.md) enthält die Pinbelegung.

## 1. Verbindung herstellen

1. Den E703.11 über eine **elektrisch geeignete Anschluss- und Schutzbeschaltung** an den ESP32-C3 SuperMini oder Pro Micro anschliessen. Sensor-VDD, Masse, AODO und/oder I²C korrekt verdrahten.
2. Die **aktuelle Firmware** für das tatsächlich verwendete Board installieren. Bei einem Pro Micro die 3,3-V-/8-MHz- beziehungsweise 5-V-/16-MHz-Ausführung unterscheiden.
3. In der [Web-App](../index.html) unter **USB & Chip → Programmieradapter** die Option **«DIY: ESP32-C3 SuperMini / Pro Micro»** wählen. Danach **One-Wire (AODO)** oder **I²C** als Chip-Schnittstelle auswählen.
4. Das Board über Web Serial verbinden. Die Bridge meldet sich mit **`BRIDGE_INFO`**, die Web-App kontrolliert die unterstützten Befehle und erwartet eine gültige Chipantwort mit UID.
5. Erst nach erfolgreicher lesender Chiperkennung die Kalibrierung im RAM testen. Für Schreibvorgänge die vorhandenen NVM-Schutzprüfungen, Backup und Readback beachten.

**Die USB-Verbindung allein ist noch keine bestätigte Sensorverbindung.** Ein Board, dessen Firmware nur `CAPS=CDC_ONLY` oder keine passende Hardwarekennung meldet, wird nicht als unterstützter E703.11-DIY-Programmer freigegeben.

## 2. Anschlussübersicht

| Board | One-Wire AODO | I²C SDA / SCL | Sensor-VDD schalten | Logikspannung |
| --- | --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | GPIO4 bidirektional oder TX GPIO4 / OE GPIO5 / RX GPIO6 mit geeigneter Schutzstufe | GPIO6 / GPIO7 | GPIO10 (externes Lastschalter-Enable) | 3,3 V |
| **Arduino Pro Micro** | D4 bidirektional oder TX D4 / OE D5 / RX D6 mit geeigneter Schutzstufe | D2 / D3 | D7 (externes Lastschalter-Enable) | 3,3 V oder 5 V, boardabhängig |

Beim **ESP32-C3** gilt: GPIO4 ist kein 5-V-toleranter Sensoreingang. Auch beim **Pro Micro** müssen die I/O-Pegel zur jeweiligen Boardvariante und Sensorversorgung passen. AODO nicht ungeschützt direkt verbinden. Die GPIO-Pins für den optionalen Lastschalter **liefern selbst keine geregelte Sensorversorgung**. Bei kurzer One-Wire-Startzeit müssen Einschaltflanke und Kommunikation am Oszilloskop geprüft werden.

**Wichtig:** GPIO6 beim ESP32-C3 ist je nach Betriebsart One-Wire-RX oder I²C-SDA. Nicht unbesehen beide Verdrahtungen gleichzeitig verbinden. Bei I²C Pull-ups und NCS/SA0 entsprechend der Sensorbeschaltung kontrollieren.

## 3. Funktions- und Sicherheitsgrenzen

Die aktuellen DIY-Firmwares implementieren One-Wire-/I²C-Kommandos und geben ihre Fähigkeiten über `BRIDGE_INFO` bekannt. Die App akzeptiert nur die zwei dokumentierten DIY-Boards, wenn die Firmware ihre entsprechende Boardkennung meldet. Dabei gelten weiterhin:

- Seriellen Port korrekt öffnen und schliessen; keine zwei parallelen Chipzugriffe.
- E703.11-UID, CRC und Registerlesewerte bei jedem Verbindungsaufbau verifizieren.
- RAM-/NVM-Zugriff abhängig von Hardwarezustand und vorhandenen Schutzbedingungen erlauben oder sperren.
- Nicht validierte Sensorversorgung, Timing und NVM-Schreibabläufe **nicht** als freigegeben darstellen.

**Noch offen:** Vollständige Hardware-End-to-End-Validierung beider DIY-Programmer mit realem E703.11, insbesondere bei kurzem PLC-Startfenster, Signalpegeln, Wiederanlauf und permanenten NVM-Änderungen.

## 4. Weiterführende Informationen

- [ESP32-C3 SuperMini – Anschluss und PLC-Test](ESP32_C3_PLC_TEST.md)
- [Arduino Pro Micro – Anschluss und PLC-Test](PRO_MICRO_PLC_TEST.md)
- [DIY-Firmware-Installer](../firmware-update.html)
- [E703.11-Kalibrierassistent](../index.html)
- [Testbericht und Hardwarefreigaben](../TESTBERICHT.md)

**Hinweis:** Die alte generische USB-CDC-Beispielfirmware kann weiterhin im GitHub-Verlauf zu Forschungszwecken eingesehen werden. Sie wird hier nicht mehr als auswählbarer DIY-Programmer angeboten.

## Ab v0.7.119: allgemeiner Registerzugriff für beide Boards

Die neue Firmware-Quellcodeversion ermöglicht generisches PLC-/I²C-Registerlesen/-schreiben und User-NVM ohne funktionsspezifische Adresslisten. Die Web-App kontrolliert dieselbe NVM-Vorschau und Alarm-/Kalibrier-Sicherheit wie beim SSP3. `BRIDGE_INFO` muss die beiden Kennungen `BRIDGE_GENERIC_RAM_V1` und `BRIDGE_USER_NVM_V1` melden, sonst bleiben neue Schreibvorgänge gesperrt. Die Images werden erst bei erfolgreichem Hauptbranch-Build erzeugt und im Installer veröffentlicht.

**Sicherheit:** Ein Kaltstart, Chip-UID-Prüfung, Original-NVM-Backup und `NVM ARM HOST` sind für User-NVM nötig. Die USB-Bridge verweigert Werks-NVM-Wörter 0–15 und beendet die Sitzung nach Timeout. Für einen neuen Kalibrieralgorithmus sind keine Firmware-Adressen mehr nachzupflegen. Details: [Universelles Protokoll und Testmatrix](UNIVERSAL_BRIDGE.md).

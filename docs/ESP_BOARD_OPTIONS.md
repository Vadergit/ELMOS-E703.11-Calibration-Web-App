# DIY-Programmer für den ELMOS E703.11 – unterstützte Boards

**Aktueller Stand: v0.7.76 · 15. November 2026**

Für die DIY-Programmieradapter werden in diesem Projekt **ausschliesslich zwei Boards** geführt und dokumentiert:

| DIY-Programmer | Mikrocontroller | Firmware | USB zum PC | One-Wire (AODO) | I²C SDA / SCL | Sensorversorgung schalten |
| --- | --- | --- | --- | --- | --- | --- |
| **ESP32-C3 SuperMini** | ESP32-C3 | **v0.10** | Natives USB | GPIO4 (bidirektional, bei passender Schutzschaltung); alternativ GPIO4 TX, GPIO5 OE, GPIO6 RX | GPIO6 / GPIO7 | GPIO10, nur Enable eines externen Lastschalters |
| **Arduino Pro Micro** | ATmega32U4 | **v0.27** | Natives USB (Caterina) | D4 (bidirektional, bei passender Schutzschaltung); alternativ D4 TX, D5 OE, D6 RX | D2 / D3 | D7, nur Enable eines externen Lastschalters |

Die beiden Boards werden unter [DIY-Programmer Firmware aktualisieren](../firmware-update.html) mit passenden Firmwaredateien und Verdrahtungshinweisen angeboten. Die Web-App wählt bei der Verbindung die **DIY-Programmer USB-Bridge**; die Firmwarekennung unterscheidet ESP32-C3 SuperMini und Pro Micro. Der originale **ELMOS SSP3** bleibt als gesonderter Herstelleradapter verfügbar und ist keine DIY-Option.

## Anschluss und Firmware

### ESP32-C3 SuperMini

- [Anschlussplan, One-Wire und I²C](ESP32_C3_PLC_TEST.md)
- [Firmware-Quellcode](../firmware/esp32c3_supermini/esp32c3_supermini.ino)
- [Web-Installer](../firmware-update.html#esp32) (v0.10)
- **One-Wire:** Sensor-AODO auf geeignete bidirektionale, strombegrenzte Schutzstufe an GPIO4; für getrennte Treiber GPIO4/GPIO5/GPIO6 gemäss Anschlussplan
- **I²C:** GPIO6 = SDA (E703.11 MISO/SDA), GPIO7 = SCL (E703.11 SCK/SCL). Pull-ups und Spannungspegel zur Sensorversorgung auslegen
- **3,3-V-GPIOs sind nicht 5-V-tolerant**. AODO nicht ungeschützt anschliessen

### Arduino Pro Micro

- [Anschlussplan, One-Wire und I²C](PRO_MICRO_PLC_TEST.md)
- [Firmware-Quellcode](../firmware/pro_micro/pro_micro.ino)
- [Web-Installer und HEX-Downloads](../firmware-update.html#pro-micro) (v0.27)
- Bei der Firmwareauswahl **5 V / 16 MHz** oder **3,3 V / 8 MHz** passend zur tatsächlich vorhandenen Platine wählen
- **One-Wire:** D4 mit passender bidirektionaler Schutz-/Pegelbeschaltung; für getrennte Treiber D4/D5/D6 gemäss Anschlussplan
- **I²C:** D2 = SDA (E703.11 MISO/SDA), D3 = SCL (E703.11 SCK/SCL)
- Den Pegel des Pro Micro sowie die Sensorversorgung beachten; bei abweichenden Spannungen geeignete Pegelwandler einsetzen

## Sicherheit und Teststand

Die jeweiligen Firmwareversionen implementieren die USB-Bridge-Befehle für One-Wire und I²C. Ob der jeweilige Aufbau die Anforderungen des E703.11 erfüllt, hängt zusätzlich von Pegeln, Startfenster, Leitungen, Pull-ups, Schutzstufe und der gespeicherten Chip-Konfiguration ab. Die Firmware allein ist **keine Freigabe** für NVM-Programmierung.

Zuerst mit einem entbehrlichen Testchip **Chiperkennung, UID, CRC, Live-Werte und Original-NVM-Lesen** kontrollieren. Danach AFE/DSP im RAM testen, erst anschliessend dauerhafte Schreibvorgänge mit Backup und Readback prüfen.

Die frühere allgemeine Liste anderer Boards wurde entfernt. Für diese Alternativen werden in diesem Projekt keine Anschlusspläne oder empfohlenen DIY-Firmwarekonfigurationen mehr angeboten.

Zurück zum [USB-Bridge-Anschluss](USB_BRIDGE_GUIDE.md), zur [Web-App](../index.html) oder zur [Projektübersicht](../README.md).

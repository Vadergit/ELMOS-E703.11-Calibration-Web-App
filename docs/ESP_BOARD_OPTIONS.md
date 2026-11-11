# Geeignete ESP-Boards für eine zukünftige E703.11 USB-Bridge

**Status: Testbranch v0.6.0-beta.2 – USB-Test möglich, E703.11-PLC noch nicht implementiert.**

Für diesen Anwendungsfall braucht es zwei **unabhängige** Fähigkeiten:

1. **USB-Verbindung zum PC (Web Serial):** Natives USB CDC, USB Serial/JTAG oder alternativ ein serieller USB-UART-Adapter.
2. **Physikalische Kommunikation zum E703.11:** korrekte 1-Wire-/PLC-Pegel, Timing, bidirektionaler AODO-Zugriff, CRC und später geschützte NVM-Prozeduren. Das erfüllt **noch keines der Beispielprogramme automatisch**.

## Kandidaten

| Entwicklungsboard | Mikrocontroller / USB | Eignung für das Projekt | Besonderheit |
|---|---|---|---|
| **ESP32-C3 SuperMini** | ESP32-C3, USB Serial/JTAG direkt über USB-C | **Meine erste Wahl zum Experimentieren** | Sehr klein und preiswert; GPIO18 = USB D−, GPIO19 = USB D+, nicht für PLC verwenden |
| Seeed XIAO ESP32C3 | ESP32-C3 mit USB-C | **Sehr gut** | Kleine Bauform, direktes USB-Serial für Test und Debug |
| ESP32-C3 DevKit mit **native USB**-Port | ESP32-C3, USB Serial/JTAG | Gut | Auf dem konkreten Board prüfen, ob die Buchse direkt mit GPIO18/19 oder nur mit einem CP210x verbunden ist |
| Seeed XIAO ESP32S3 | ESP32-S3 mit USB | Sehr gut | Mehr Speicher-/Rechenreserven, zusätzliche USB-Funktionalität |
| Espressif ESP32-S3-DevKitC-1 | ESP32-S3, native USB + je nach Variante zusätzliche UART-Bridge | Sehr gut | Grosszügiges Entwicklungslayout; richtige USB-Buchse auswählen |
| Arduino Nano ESP32 | ESP32-S3 (NORA-W106), USB-C | Gut | Komfortable Arduino-Entwicklungsumgebung, grösser und tendenziell teurer |
| ESP32-S2 Saola-1 (native USB) | ESP32-S2, USB OTG / CDC | Möglich | Native USB vorhanden; kein integrierter USB Serial/JTAG-Controller |
| ESP32-C6-DevKit mit **native USB**-Port | ESP32-C6, USB Serial/JTAG | Gut | GPIO12 = USB D−, GPIO13 = USB D+; Portbelegung am tatsächlichen Board prüfen |

**Nicht die erste Wahl:** ESP8266, ESP32-WROOM-32 und ESP32-C2 ohne native USB-Funktion. Sie sind zwar mit USB-UART-Wandlern betreibbar, bieten aber nicht die gewünschte direkte USB-Anbindung. Auch bei ihnen könnte man ein externes USB-UART-Modul verwenden, was jedoch zusätzliche Hardware bedeutet.

**Empfehlung:** Mit dem bereits vorhandenen **ESP32-C3 SuperMini** zuerst das CDC-Verhalten testen und danach eine **separate, elektrisch abgesicherte PLC-Schnittstelle** entwickeln. Für umfangreichere spätere Firmware ist ein ESP32-S3 eine gute Alternative.

## Wichtige technische Grenzen

- Bei C3/C6 ist USB-Serial/JTAG hardwareseitig fest vorgegeben; es ist **nicht** dasselbe wie der frei konfigurierbare USB-OTG-Controller eines S2/S3.
- Die native USB-Buchse muss tatsächlich an den internen USB-Pins liegen. Ein USB-C-Stecker allein beweist das nicht.
- **C3:** USB D− = GPIO18, USB D+ = GPIO19. Diese Pins beim Test nicht anderweitig ansteuern.
- **C6:** USB D− = GPIO12, USB D+ = GPIO13.
- Der E703.11 kann mit höherer Spannung als 3.3 V betrieben werden. Vor der Verbindung mit einem ESP-GPIO **Level-Shifting, Schutzbeschaltung und Pin-Richtung** anhand des Datenblatts festlegen.
- GPIO-basierte PLC-Signalzeiten zuerst mit Logikanalysator/Oszilloskop mit dem SSP3 vergleichen. Native USB löst das Timing-Problem nicht automatisch.
- Keine reale EEPROM-Programmierung über diese USB-Bridge, bis Readback, CRC, UID, Boot-Schutz und echte Kaltstarttests erfolgreich waren.

## ESP32-C3 SuperMini direkt testen

**Firmware:** [esp32c3_supermini.ino](../firmware/esp32c3_supermini/esp32c3_supermini.ino)

1. Arduino IDE 2 installieren, **ESP32 by Espressif Systems** im Boardverwalter installieren.
2. **Board: ESP32C3 Dev Module** auswählen; **USB CDC On Boot: Enabled** setzen.
3. ESP32-C3 SuperMini mit **USB-Datenkabel** anschliessen, passenden Port auswählen.
4. Sketch öffnen und über **Upload** flashen. Falls der Upload nicht startet: **BOOT gedrückt halten, RESET kurz betätigen, BOOT loslassen**; bei Varianten ohne RESET-Taster nach Herstelleranleitung Bootloader-Modus starten.
5. Zum ersten Test den seriellen Monitor bei 115200 Baud öffnen. Mit Zeilenende **Newline** den Befehl `BRIDGE_INFO` senden. Erwartete Antwort:

```text
# E70311-BRIDGE V1 CAPS=CDC_ONLY
:
```

6. Arduino Serial Monitor **schliessen**, sonst ist der Port belegt.
7. Im **Beta-Wizard** den Adapter **ESP32 / Arduino USB-Bridge** wählen, USB-Port auswählen und den SuperMini verbinden.
8. Erwartete Meldung: **USB-CDC-Bridge erkannt, aber nur CDC_ONLY verfügbar**. Das bestätigt den USB-Test. Der E703.11-Chipzugriff bleibt absichtlich deaktiviert.

Weitere Antworten für die Fehlersuche:
- `BRIDGE_PING` → `# PONG ESP32-C3 SUPERMini CDC_ONLY`
- `BRIDGE_STATS` → Anzahl Befehle und freier Heap (keine Sensordaten)

**Wichtig:** Für diesen USB-Test **keinen E703.11 anschliessen**. USB-C zum PC genügt.

## Datenquellen

- Espressif: [USB-Unterstützung der ESP32-Familien](https://docs.espressif.com/projects/esp-iot-solution/en/latest/usb/usb_overview/usb_overview.html)
- Espressif: [USB CDC mit Arduino und Flashen](https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/cdc_dfu_flash.html)
- Espressif: [USB CDC On Boot](https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html)
- Espressif: [C3 USB-Verbindung und Bootloader-Modus](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/get-started/establish-serial-connection.html)
- Seeed: [XIAO ESP32C3 – USB Serial](https://wiki.seeedstudio.com/XIAO_ESP32C3_Pin_Multiplexing/)
- Arduino: [Nano ESP32](https://docs.arduino.cc/hardware/nano-esp32)

# Universelle E703.11-USB-Bridge: SSP3, ESP32-C3 und Pro Micro

Stand: Web-App v0.7.119 (Quellcode); ESP32-C3 v0.12 und Pro Micro v0.28 als **Laborfirmware**.
Der erste vollständige Test an echten Sensoren steht noch aus. Die Firmware-Binaries werden erst nach erfolgreichen PR-Builds und dem Main-Release-Build veröffentlicht.

## Architektur

| Aufgabe | Web-App (Host) | SSP3 / ESP32 / Pro Micro |
| --- | --- | --- |
| AFE, Filter, DSP-Kalibrierung und Temperaturkompensation | Parameter, Mathe, Registerwerte, RAM-Prüfungen | CRC-gesicherte Register lesen/schreiben |
| Alarmgrenzen, Hysterese, EOC, Fehleraktionen, Clipping | Einstellungslogik, Konflikte, Vorschau, erlaubte Bits | Allgemeine RAM-Registerzugriffe ohne Funktions-Whitelist |
| Backup, Chip-UID, CRC8/16, Startfenster und Wiederverbindung | Alle 64 Wörter vergleichen, Bootregister prüfen, UI-Freigabe | Sensorkommunikation, CRC-geprüfte Frames und GPIO-VDD-Steuerung |
| User-NVM programmieren | Whitelist, Alarm/DSP/Output-Zusammenführung, UID, Backups, Readback, explizite Bestätigung | Zeitlich begrenzte User-NVM-Schreibsitzung |
| Factory-NVM | **Kein automatischer Schreibpfad** | Werksbereich 0–15 bleibt physisch gesperrt |

Ein neuer Kalibrieralgorithmus oder ein zusätzliches RAM-/NVM-Feld soll **keine Firmware-Änderung** erfordern, sofern er durch die vorhandenen 16-Bit-Registeroperationen erreichbar ist. Nur neue elektrische Transportarten, Timing-/GPIO-Funktionen oder andere Chipfamilien brauchen neue Firmware-Fähigkeiten.

## Gemeinsame Bridge-Schnittstelle v1

Die beiden DIY-Boards melden bei `BRIDGE_INFO` die Capabilities `BRIDGE_GENERIC_RAM_V1` und `BRIDGE_USER_NVM_V1`.

- `PLC <frame>`: CRC-geprüftes 16-Bit-Register lesen oder schreiben. Beliebige **gerade** RAM-Adresse 0x00–0xFE, abgesehen von den permanenten NVM-Steuerregistern. Keine eingebauten Alarm-, Filter- oder DSP-Whitelists.
- `I2C READ<addr>` / `I2C WRITE<addr><data>`: generische I²C-Registertransaktion (unter unterstützter I²C-Konfiguration). Schreibzugriffe auf NVM-Steuerregister sind weiterhin gesichert.
- `PLC START` / `PLC ACCESS`: Kommunikation nach einem Kaltstart beziehungsweise bei bereits zugänglichem Chip herstellen; nicht mit dauerhaftem NVM-Schreiben verwechseln.
- `NVM ARM HOST`: nur über PLC nach **bestätigtem VDD-Kaltstart und Chip-Probe**. Antwort `# NVM HOST ARMED`. Ohne Antwort kein Schreiben.
- In einer Host-NVM-Sitzung sind **nur User-NVM-Wörter 16–63**, jeweils nach dem Datenregister `CM_WDATA`, programmierbar. Die App darf nur die nach ihren Sicherheitsregeln verifizierten Wörter freigeben.
- Die Sitzung läuft bei mehr als 20 Sekunden Leerlauf oder nach spätestens 180 Sekunden ab. `NVM DISARM`, Interfacewechsel und Neuinitialisierung sperren sie wieder.
- Ältere Firmware ohne beide Caps wird **nicht** stillschweigend auf volle Funktionsfähigkeit umgestellt.

Die Firmware erteilt damit **keine automatische Genehmigung** für beliebige Config-Änderungen. Sie ist ein technischer Busadapter; der Host muss jedes NVM-Abbild prüfen. Ein anderes Programm mit USB-Portzugriff könnte die Host-Freigabe ebenfalls anfordern. Deshalb ist der Universalmodus für kontrollierte Laborumgebungen gedacht.

## Zusammenwirken mit der Web-App

1. Port öffnen, `BRIDGE_INFO`, reale Chip-UID und kalibrierten/geschützten Startzustand lesen.
2. Bei Bedarf 64-Wort-EEPROM einlesen, CRC16 und UID verifizieren.
3. Kalibrierung, Alarm, Ausgang usw. im Browser berechnen und Konflikte prüfen.
4. Nur RAM schreiben, zurücklesen und elektrisch verifizieren.
5. Finalen User-NVM-Diff erstellen: geschützte Startregister unverändert, CRC16 aktualisiert; alle 64 Wörter neu prüfen, Original als JSON sichern.
6. NVM-Schreibauftrag ausdrücklich bestätigen. Die App wählt für neue DIY-Firmware `NVM ARM HOST`, für SSP3 die dokumentierten Herstellerbefehle.
7. User-Wörter einzeln programmieren, sofort lesen, alle 64 Wörter inklusive CRC prüfen, disarmen.
8. Sensor tatsächlich spannungslos schalten und unabhängig am präzisen VDD die Ausgangsfunktion, Alarme und Kommunikation prüfen.

## Wo die technische Gleichheit aufhört

- **SPI:** Die beiden aktuellen DIY-Firmwares bieten One-Wire und I²C. Die SSP3-SPI-Funktionen sind nicht nachgebildet.
- **Pegel und Timing:** ESP32-C3-GPIOs sind nicht 5-V-tolerant; Pro-Micro-Pegel hängen von der 3,3-V-/8-MHz- bzw. 5-V-/16-MHz-Version ab. Es sind externe Treiber/Pegelwandler und ggf. ein VDD-Lastschalter erforderlich.
- **Externe Messmittel:** Die beiden Bridges messen die Ausgangsspannung nicht als präzises DMM. Für einen Overall-Analogabgleich ist ein separates Referenzmessgerät nötig.
- **Laborstatus:** Gleichheit der Befehle und Softwaretests ist **keine** Garantie für One-Wire-Startfenster, reale Ausgangswerte, NVM-Endurance oder jeden Fehler-/Alarmfall. Einen entbehrlichen Sensor verwenden und gegen die Original-PSSC-GUI prüfen.

## Testmatrix (vor Hardwarefreigabe)

| Test | SSP3 | ESP32-C3 | Pro Micro 16/8 MHz |
| --- | --- | --- | --- |
| Firmware-Build / CLI | Hersteller | CI | CI |
| Chip-UID / CRC-Lesen | Praxis | Offen | Offen |
| AFE/Filter/DSP-RAM-Schreiben & Rücklesen | Praxis | Offen | Offen |
| Alarm/EOC/ERR-RAM-Bitmasken | Noch zu prüfen | Offen | Offen |
| User-NVM 16–63 + Backup/CRC | Noch zu prüfen | Offen | Offen |
| Neustart bei 4/10/200 ms | Praxisabhängig | Offen | Offen |
| Analoger Ausgang an präziser Versorgung | Noch zu prüfen | Offen | Offen |

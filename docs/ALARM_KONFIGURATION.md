## v0.7.118 – Optionaler Schritt nach dem Ausgang

Im klassischen und geführten Kalibrierablauf erscheinen Alarme zwischen **Ausgang konfigurieren** und **NVM programmieren**. Der Schritt ist optional. Der Button **«Ohne Alarmänderung zum NVM»** erhält bestehende Alarmwerte im Chip. Er bedeutet **nicht**, dass alle alten Alarme deaktiviert werden.

Für einen neuen Alarmabgleich: EEPROM lesen, DSP-Bereich und Pinbelegung kontrollieren, Einstellungen wählen, Vorschau, RAM schreiben und rücklesen. Im normalen Abgleich werden die bestätigten Alarmregister dann **in dasselbe finale Kalibrier-NVM-Abbild** aufgenommen. Keine zweite NVM-Programmierung nötig.

**Nachträglich ändern:** Sensor mit SSP3 oder einer DIY-Bridge mit beiden neuen Capabilities verbinden, aktuelles NVM sichern, «Alarme & Fehler» öffnen, Einstellungen ändern und separat über RAM-Rücklesung und NVM mit Backup übernehmen. Kein Druckabgleich notwendig.

**Config-Dateien:** Eigene Gruppe «Alarme & Fehler» bei Export/Import/Preset. Standard `mode: skip`; ein importiertes Alarmprofil muss am neuen Chip erneut geprüft und im RAM bestätigt werden. Für Serienprojekte ist so eine gezielte Wiederverwendung möglich.

# Alarm- und Fehlerkonfigurator – v0.7.116 (Labor)

Quellen: Elmos E703.11 Datenblatt 25DS0170E.04, Kapitel 6.3.2.4, 6.3.2.5, 6.3.2.9, 6.4.2 und 6.5.7.2.

## Neuer Tab seit v0.7.117

Der Alarmeditor befindet sich jetzt als **eigener Reiter «Alarme & Fehler» in der klassischen Seitenleiste**, nicht mehr im EEPROM Viewer. Dort stehen die Schaltlogik, Statusanzeigen und Konfigurationsfelder zusammen.

Die dynamische **Logikprüfung** unterscheidet:
- **Nicht zulässig:** DSP-Post-Scaling belegt Alarmregister; Hysterese überlappt den Grenzabstand; EOC auf AODO kollidiert mit permanentem One-Wire; EOC wird gleichzeitig als Temperaturmess- oder SDA-Pin verwendet; Eingabewerte liegen ausserhalb des dokumentierten Bereichs. Die Vorschau und NVM-Planung sind gesperrt.
- **Hinweis:** Alarmbits ausgewählt, aber ALARM_EN aus; Fehlerreaktionen gesetzt, aber ERR_EN aus; LIMIT-Status ohne LIMIT_EN; ACD-Fehler ohne aktivierte Diagnose; High-Z kann den Ausgang abschalten. Dies sind Warnungen, nicht automatisch Registerkorrekturen.
- **Aktueller Sensor:** Ausgangsmodus, permanente One-Wire-Freigabe, EOC-Pinzuordnung sowie gerundete DSP-Schwellen und Hysteresespanne.

Vom Tab aus kann der komplette EEPROM-Satz gelesen werden. Nach bestätigtem RAM-Test führt ein eigener Button zum NVM-Speicherschritt. Die 64-Wort-CRC-/UID- und Bootschutzregeln bleiben aktiv.

## Bedienung
Im eigenen Reiter **«Alarme & Fehler» → «EEPROM für Alarmkonfiguration lesen» → Einstellungen prüfen**.

1. Echten Sensor per Original-SSP3 oder generischer ESP32-/Pro-Micro-Bridge über One-Wire verbinden, vollständiges EEPROM mit CRC lesen und als JSON sichern. Bei älteren DIY-Bridge-Versionen ohne BRIDGE_GENERIC_RAM_V1/BRIDGE_USER_NVM_V1 bleibt die Alarm-Programmierung gesperrt.
2. Den *tatsächlich gültigen DSP-Endwert* (z. B. ±32'000 Digits) eingeben und ausdrücklich bestätigen. Untere und obere Alarmgrenze in Prozent des kalibrierten Druckbereichs einstellen.
3. Hysterese auswählen (0: deaktiviert; weitere 15 Schritte von 1 bis 16'384 Digits).
4. Gewünschte Statussignale 1–9, 12–13 für den EOC-Ausgang als ODER-Verknüpfung auswählen. Die physische Pinbelegung bleibt **unverändert**.
5. Optional Fehlerreaktionen aktivieren: Limit unten/oben, DSP-Sättigung, Brückenprüfung, Sensorerfassung, Brückenspannung; pro Fall keine Änderung, unterer/oberer Ersatzwert oder High-Z. Ersatzwerte in Prozent von DSP_AODO; diese Werte sind keine real gemessenen Volt.
6. Auf **Änderungen prüfen** klicken, die exakten NVM-Registeränderungen kontrollieren.
7. **Im RAM übernehmen & rücklesen**. Der Code schreibt die freigegebenen Register, liest sie einzeln zurück und versucht bei einem Fehler die RAM-Werte zurückzusetzen. Wenn die Rücksetzung nicht bestätigt wird, Versorgung ausschalten und nach einem Kaltstart erneut prüfen.
8. Im Schritt **NVM programmieren** zuerst **Original-EEPROM automatisch sichern** aktivieren, Chip-UID und Änderungsliste prüfen und den endgültigen Speicherauftrag ausdrücklich bestätigen. Erst jetzt darf das NVM geschrieben werden.
9. Vollständige 64-Wort-Rücklesung und CRC abwarten, echten VDD-Neustart durchführen, Alarm- und Fehlerfunktion elektrisch testen.

## Sicherheitsbedingungen
- Für die neue RAM-/NVM-Schreibfunktion sind SSP3 und DIY-Programmer mit beiden generischen Capability-Kennungen vorgesehen. Alte DIY-Firmware ohne diese Kennungen bleibt gesperrt.
- Aktives DSP-Post-Scaling benutzt dieselben ALARM_LO-/ALARM_HI-Wörter und **blockiert** daher Alarmänderungen.
- Erlaubte EEPROM-Indizes: 16 (nur alarm_en und err_en), 18 (nur die unteren 12 Statusmasken-Bits), 55, 56, 61, 62 und 63 (CRC16). Factory-Wörter, Startup-PLC und Pinrouting bleiben erhalten.
- RAM-Test, aktuelles EEPROM-Backup, aktive Chip-UID, CRC16 und ein expliziter NVM-Schreibauftrag sind zwingende Voraussetzungen.
- High-Z-Fehleraktionen können den Analogausgang absichtlich abschalten. Das ist in einer produktiven Steuerung sorgfältig abzusichern.
- Die Registernachprüfung ersetzt **keinen** Test am realen Sensor. Ein vollständiger elektrischer Alarm- und EOC-Test sowie ein Vergleich mit der originalen PSSC-GUI stehen noch aus.

## Was nicht umgesetzt wird
Keine automatische Umschaltung der physischen EOC-Pinbelegung (CFG_PADS2.sel_eoc), kein Bitänderungszugriff auf One-Wire-Startup-Register, keine unbestätigte Anpassung des DSP-Post-Scaling-Algorithmus.

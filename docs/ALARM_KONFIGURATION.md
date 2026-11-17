# Alarm- und Fehlerkonfigurator – v0.7.116 (Labor)

Quellen: Elmos E703.11 Datenblatt 25DS0170E.04, Kapitel 6.3.2.4, 6.3.2.5, 6.3.2.9, 6.4.2 und 6.5.7.2.

## Bedienung
Im **EEPROM Viewer → EEPROM lesen (64 Wörter) → Alarme und Fehler einstellen**.

1. Echten Sensor per Original-SSP3 und One-Wire verbinden, vollständiges EEPROM mit CRC lesen und als JSON sichern. Bei DIY-Bridge ist diese Funktion derzeit nur lesend verfügbar.
2. Den *tatsächlich gültigen DSP-Endwert* (z. B. ±32'000 Digits) eingeben und ausdrücklich bestätigen. Untere und obere Alarmgrenze in Prozent des kalibrierten Druckbereichs einstellen.
3. Hysterese auswählen (0: deaktiviert; weitere 15 Schritte von 1 bis 16'384 Digits).
4. Gewünschte Statussignale 1–9, 12–13 für den EOC-Ausgang als ODER-Verknüpfung auswählen. Die physische Pinbelegung bleibt **unverändert**.
5. Optional Fehlerreaktionen aktivieren: Limit unten/oben, DSP-Sättigung, Brückenprüfung, Sensorerfassung, Brückenspannung; pro Fall keine Änderung, unterer/oberer Ersatzwert oder High-Z. Ersatzwerte in Prozent von DSP_AODO; diese Werte sind keine real gemessenen Volt.
6. Auf **Änderungen prüfen** klicken, die exakten NVM-Registeränderungen kontrollieren.
7. **Im RAM übernehmen & rücklesen**. Der Code schreibt die freigegebenen Register, liest sie einzeln zurück und versucht bei einem Fehler die RAM-Werte zurückzusetzen. Wenn die Rücksetzung nicht bestätigt wird, Versorgung ausschalten und nach einem Kaltstart erneut prüfen.
8. Im Schritt **NVM programmieren** zuerst **Original-EEPROM automatisch sichern** aktivieren, Chip-UID und Änderungsliste prüfen und den endgültigen Speicherauftrag ausdrücklich bestätigen. Erst jetzt darf das NVM geschrieben werden.
9. Vollständige 64-Wort-Rücklesung und CRC abwarten, echten VDD-Neustart durchführen, Alarm- und Fehlerfunktion elektrisch testen.

## Sicherheitsbedingungen
- Nur Original-SSP3 für die neue RAM-/NVM-Schreibfunktion vorgesehen. DIY-Programmer bleiben an dieser Stelle gesperrt.
- Aktives DSP-Post-Scaling benutzt dieselben ALARM_LO-/ALARM_HI-Wörter und **blockiert** daher Alarmänderungen.
- Erlaubte EEPROM-Indizes: 16 (nur alarm_en und err_en), 18 (nur die unteren 12 Statusmasken-Bits), 55, 56, 61, 62 und 63 (CRC16). Factory-Wörter, Startup-PLC und Pinrouting bleiben erhalten.
- RAM-Test, aktuelles EEPROM-Backup, aktive Chip-UID, CRC16 und ein expliziter NVM-Schreibauftrag sind zwingende Voraussetzungen.
- High-Z-Fehleraktionen können den Analogausgang absichtlich abschalten. Das ist in einer produktiven Steuerung sorgfältig abzusichern.
- Die Registernachprüfung ersetzt **keinen** Test am realen Sensor. Ein vollständiger elektrischer Alarm- und EOC-Test sowie ein Vergleich mit der originalen PSSC-GUI stehen noch aus.

## Was nicht umgesetzt wird
Keine automatische Umschaltung der physischen EOC-Pinbelegung (CFG_PADS2.sel_eoc), kein Bitänderungszugriff auf One-Wire-Startup-Register, keine unbestätigte Anpassung des DSP-Post-Scaling-Algorithmus.

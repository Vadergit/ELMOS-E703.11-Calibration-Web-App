# Änderungsverlauf

Versionierung nach `MAJOR.MINOR.PATCH`: Kleine Anpassungen erhöhen PATCH, neue Funktionen MINOR, inkompatible Änderungen MAJOR. Jede Änderung erhält eine neue Nummer und einen Eintrag.

## v0.3.2 – 11.11.2026

- Standardwerte für **S0 = 0.5 V** und **S1 = 4.5 V** bei VDD = 5 V bleiben nach dem Chip-Readback erhalten. Aktuelle RAM-Ausgangswerte erscheinen separat.
- Knopf **«Standard 10–90 % VDD einsetzen»** für ratiometrische Zielspannungen.
- Datenblatt-Abgleich E703.11 25DS0170E.04: Q3.12-Scaling (§6.3.2.6), 10–90 % VDD (§6.4.1.1), 1-Wire-Voraussetzungen (§6.4.5.7–8).
- **1-Wire-Schutz:** High-Z und Alarm nicht mehr für dauerhaftes NVM erlaubt. Prüfung von CFG_EN.aodo_en, CFG_SPI_I2C.plc_en, CFG_PADS0.startup_plc, CFG_PADS1.plc_downsel, plc_us_en und plc_rw_en.
- Ist die Startkommunikation im ursprünglichen NVM nicht passend konfiguriert, wird NVM-Schreiben gesperrt. Keine automatische Bootregister-Reparatur.
- Regressionstests ergänzt. Hardware- und Kaltstartprüfung weiterhin erforderlich.

## v0.3.1 – 11.11.2026

- **DSP-Skalierung synchronisiert:** Bei einer neuen Kalibrierung übernimmt der Scaling-Schritt den gewählten DSP_S-Endwert (z. B. ±25’000) automatisch statt unbemerkt ±32’000 als Standard zu verwenden.
- Ein Hinweis unterscheidet die DSP_S-Ausgangsspanne vom unabhängigen ADC_S-Arbeitsfenster.
- Bestehende Sensoren verwenden ohne neue Kalibrierung weiterhin den ausdrücklich gesetzten DSP-Anzeigebereich; bestehende Schutzprüfungen bleiben erhalten.

## v0.3.0 – 11.11.2026

- PSSC-orientierte Struktur und Benennung für **Digital Interface**, **AODO pin**, **Scaling (S0/S1)**, **Limiting**, **Error Signaling** und **Error Values** im eigenen Ausgangsschritt.
- Analog-Ratiometric-Ausgänge: gewünschte Ausgangsspannungen bei S0/S1 und VDD eingeben; AODO-Faktor und Offset automatisch in Q3.12 berechnen und die resultierende Spannung als Vorschau anzeigen.
- Nicht verifizierte Limiting-, Fehlerreaktions- und Boot-/I²C-Parameter nur als Diagnose, ohne Schreibfreigabe.
- Nicht unterstützte absolute 0..10-V- und 4..20-mA-Ausgänge für den E703.11 ausdrücklich deaktiviert.
- Änderungen an Ausgangswerten verwerfen vorbereitete ältere NVM-Schreibpläne.
- Regressionstests für Skalierung, erlaubte Modi und geschützte Register.

## v0.2.1 – 11.11.2026

- Automatisierte Regressionstests für die Unveränderlichkeit der Kommunikations-/Bootregister und die sieben Schritte hinzugefügt (`node --test tests/safety.test.cjs`).
- Versionsanzeige und Dokumentation synchronisiert; Kapitelnummern korrigiert.

## v0.2.0 – 11.11.2026

- Ausgangskonfiguration in einen eigenen Schritt **nach DSP prüfen** und vor NVM verschoben (sieben Schritte).
- AODO_F (Gain) und AODO_O (Offset) in erweiterte Einstellungen verschoben; Skalierung kann vorgeschlagen werden.
- NVM-Programmierung nur mit echter 1-Wire-Chipverbindung; I²C/SPI-Sitzungen dürfen nicht dauerhaft programmieren.
- Zentrale Schutzprüfung: Kommunikations-, Boot- und Factory-Wörter müssen unverändert bleiben; in CFG_EN sind ausschliesslich freigegebene AODO-Bits erlaubt.
- Im Ausgangsschritt kann das vollständige Original-NVM zum sicheren Ändern bereits kalibrierter Sensoren gelesen werden.
- Dokumentation, Bedienung und Versionsnummer aktualisiert.

**Hardwaregrenze:** Dauerhafte 1-Wire-Erreichbarkeit nach Kaltstart erst nach echtem Power-Cycle-Test und Bestätigung der Herstellervorgaben garantiert; Software-Schutz reduziert Risiken, aber macht einen NVM-Stromunterbruch nicht sicher.

## v0.1.0 – 11.11.2026

- Versionsnummer im Kopfbereich und Footer; gemeinsame Cache-Version für Skripte.
- Ausgangskonfiguration in Schritt 2 für alle Benutzer sichtbar.
- E703.11 AODO-Modi High-Z, ratiometrisch (3 Varianten), PWM, FM und Alarm mit modusspezifischem Hinweis.
- 1-Wire, I²C und SPI als Kommunikationsschnittstellen von AODO-Modi getrennt.
- Bestehende NVM-/UID-Schutzprüfungen beibehalten.
- README aktualisiert.

### Offene Punkte
- AODO-Ausgänge und NVM-Schreiben nicht vollständig an realer Hardware validiert.
- Boot-/Kommunikationsregister werden nicht durch die Ausgangskonfiguration geändert.
- Noch keine automatische Berechnung von analogen Spannungsendpunkten wie 0.5–4.5 V.

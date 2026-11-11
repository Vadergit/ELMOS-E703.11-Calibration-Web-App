# Änderungsverlauf

Versionierung nach `MAJOR.MINOR.PATCH`: Kleine Anpassungen erhöhen PATCH, neue Funktionen MINOR, inkompatible Änderungen MAJOR. Jede Änderung erhält eine neue Nummer und einen Eintrag.

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

# Änderungsverlauf

Versionierung nach `MAJOR.MINOR.PATCH`: Kleine Anpassungen erhöhen PATCH, neue Funktionen MINOR, inkompatible Änderungen MAJOR. Jede Änderung erhält eine neue Nummer und einen Eintrag.

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

# Config-Dateien und EEPROM Viewer

**Version v0.5.0 · 11. November 2026 · ELMOS E703.11 Kalibrierassistent**

Die Web-App unterstützt die Wiederverwendung von **chipunabhängigen Konfigurationen**, ohne dass sensorspezifische Kalibrierwerte, Werksdaten oder Kommunikationsregister von einem Sensor auf einen anderen übertragen werden.

## Anwendungsfall: mehrere gleiche Sensoren kalibrieren

Wenn mehrere Sensoren dieselben Grundeinstellungen benötigen, kannst du beim ersten Sensor beispielsweise PGA1, PGA2, den AFE-Offset, Referenzbereich, DSP-Sollspanne und Ausgangsskalierung einstellen. Die Werte exportierst du als `.json`-Config. Anschliessend lädst du diese Vorlage bei weiteren Sensoren, übernimmst die Eingaben und führst **pro Sensor eine neue Messpunktaufnahme, Koeffizientenberechnung und DSP-Prüfung** durch.

**Beispiel-Config:** [Beispiel_0-10bar.json](examples/Beispiel_0-10bar.json). Die Datei enthält nur Beispielwerte und ist **keine Kalibrierung**.

## Config speichern

In **USB & Chip → Config-Vorlagen**:

1. Einen sprechenden Namen eingeben, z. B. «Drucksensor 0–10 bar».
2. Die passenden Einstellungen in AFE, Messpunkten, DSP und Ausgang auswählen.
3. **Aktuelle Config speichern (.json)** drücken.
4. Die heruntergeladene Datei nach Bedarf lokal archivieren oder auf einem anderen Rechner verwenden.

Der Export ist auch **ohne verbundenen Sensor** möglich. Falls eine Vorlage geladen ist und die AFE-Vorgaben noch nicht ins RAM übertragen wurden, enthält der Export diese vorgemerkten AFE-Stufen.

## Config laden

1. Unter **USB & Chip → Config-Vorlagen** eine `.json`-Datei auswählen.
2. Die App prüft das Format, erlaubte Felder, Zahlenbereiche, Ausgangsmodi und die Spannungs-/DSP-Skalierung. Eine EEPROM-Backup-Datei wird ausdrücklich abgelehnt.
3. Die Anzeige zeigt die Einstellungen als Vorschau. Bis hier wurde **weder der Assistent geändert noch der Chip beschrieben**.
4. **Geladene Config übernehmen** drücken. Jetzt werden die UI-Einstellungen gesetzt, aber **keine** Chipregister geschrieben.
5. Zu **AFE optimieren** wechseln. Die vorgemerkten Verstärkungen/Offsetwerte sind separat vom tatsächlich aktiven Chipzustand sichtbar.
6. Erst mit **AFE-Vorgabe jetzt ins RAM übertragen und rücklesen** wird die AFE im Chip geändert. Die App kontrolliert den Wert per Rücklesung. Diese Aktion programmiert kein EEPROM.
7. Anschliessend pro Sensor Messpunkte aufnehmen, DSP-Koeffizienten berechnen, ins RAM übertragen, unabhängig prüfen und NVM erst nach UID-/CRC-/1-Wire-Schutzprüfung programmieren.

Bei Fehlern bleibt die geladene AFE-Vorgabe vorgemerkt, statt ohne bestätigten Rücklesewert als erfolgreich zu gelten.

## Was darf in eine Config?

| Bereich | Gespeicherte Parameter |
| --- | --- |
| AFE | PGA1-Stufencode, PGA2-Stufencode, AFE-Offsetstufe |
| Kalibriermethode | Druck-Polynomordnung, Temperatur-Polynomordnung, DSP-Zielbereich ± Digits |
| Messablauf | Anzahl Messpunkte, Samples, Einheit, unterer/oberer Referenzdruck |
| Ausgang | Ausgangsmodus, `scale_en`, VDD für Vorschau, S0-/S1-Zielspannungen, AODO-F/O-Skalierungsvorgabe, PWM-Periode |

**Nicht Bestandteil einer Config** sind: UID, Seriennummer, Werkskalibrierung, komplette EEPROM-/NVM-Wörter, CRC, PCB-/Chip-Bootregister, 1-Wire-/I²C-/SPI-Startparameter, aufgezeichnete Messpunkte, DSP-Polynomkoeffizienten oder RAM-/EEPROM-Backups.

Besonders wichtig: **AODO_F und AODO_O in der Config sind nur Ausgangs-Zielparameter**, nicht die DSP-Kalibrierkoeffizienten eines individuellen Sensors. Beim analogen ratiometrischen Ausgang werden diese Werte beim Einlesen aus S0, S1, VDD und der DSP-Sollspanne neu berechnet. Eine sichere NVM-Programmierung verlangt weiterhin die bestehenden Schutzprüfungen.

## Dateiformat und Versionierung

- JSON-Formatkennung `ELMOS-E70311-CONFIG`, Formatversion `1`.
- Software-Version bei Einführung: **v0.4.0**.
- Oberste Felder: `format`, `version`, `label`, `createdAt`, `afe`, `calibration`, `output`.
- Unbekannte Felder, nicht unterstützte Modi, unzulässige AFE-Stufen, unrealistische DSP-Endwerte und ungültige Analog-Spannungsendpunkte werden abgelehnt.
- Ein Import prüft die Daten vollständig, bevor **Geladene Config übernehmen** freigegeben wird.
- Eine vom Hersteller-PSSC exportierte vollständige Hex-/EEPROM-Datei ist **keine** kompatible Config-Vorlage. Wir importieren bewusst keine unbekannten Herstellerregister ohne vollständige Sicherheitsprüfung.

**Im optionalen Kompaktmodus** sind die Config-Vorlagen direkt neben SSP3 und AFE erreichbar. Speichern, Dateiauswahl, Vorschau und bewusste Übernahme verwenden die identischen Bedienelemente wie in der Normalansicht. Ein Import programmiert weder RAM noch EEPROM automatisch.

## EEPROM Viewer

In der Navigation gibt es zusätzlich zu den **sieben Kalibrierschritten** den eigenständigen Reiter **EEPROM Viewer**. Er ist von jedem Schritt aus erreichbar.

Mit **EEPROM lesen (64 Wörter)** wird der bestehende Leseweg der App genutzt: Ein echter E703.11 muss verbunden sein, die 64 Wörter werden ausgelesen und mit CRC8/CRC16 geprüft. Die Tabelle zeigt:

- **Adresse:** Wortindex `00` bis `3F` (PSSC-ähnlich). Die EEPROM-Byteadresse ist der doppelte Index.
- **Bitfield:** dokumentierter Name wie `CFG_EN`, `CFG_AFE1`, `AODO_F` oder `CRC16`; unbekannte Felder erhalten eine neutrale Bezeichnung.
- **Data Hex:** 16-Bit-Wert mit vier Hex-Ziffern.
- **Data:** derselbe Wert als vorzeichenbehaftete 16-Bit-Dezimalzahl.
- **Schutz:** Factory, Boot/Konfiguration oder User-NVM. Hier sind **alle Einträge nur lesbar**.
- **Funktion:** kurze, auf alle 64 Wörter bezogene Beschreibung (unbekannte Bereiche werden ausdrücklich nicht geraten).
- **Details je Wort:** ein Klick auf den Wortindex öffnet die Beschreibung, EEPROM-Byteadresse, das zugehörige RAM-Register (sofern dokumentiert), Hex-/Unsigned-/Signed-Wert sowie Q3.12/Q0.15-Interpretation bei passenden Koeffizienten.
- **Expertenansicht:** bekannte Bitfelder mit tatsächlichen Codes und Bedeutungen; bei anderen Registern nur Binärrohwert und klarer Hinweis auf fehlende Bitdefinition. Angezeigte Formeln sind Referenzinformationen, keine Live-Spannungsmessung.

Über das Suchfeld können Wörter nach Wort-/Byteadresse, RAM-Adresse, Bezeichnung, Wert oder Bedeutung (z. B. «Gain», «Offset», «Temperatur», «1-Wire») gefiltert werden. Der Export **EEPROM-Backup exportieren** enthält dagegen bewusst das komplette NVM samt Chip-UID für Diagnose bzw. chipbezogene Wiederherstellung. Dieser Export ist ein **anderes Dateiformat** als die Config-Vorlage.

Die Detailansicht arbeitet ausschliesslich auf dem zuvor CRC-geprüften EEPROM-Abbild und öffnet beim Aufklappen keine neue Hardwarekommunikation. Die Leseaktion benötigt intern die herstellerseitigen Wartungskommandos zum Auslesen. Sie startet **keine dauerhafte EEPROM-Programmierung**.

## Kontextbezogener Expertenmodus

Der Expertenmodus wird in **⚙ Einstellungen** ein- und ausgeschaltet. Es gibt **kein separates Expertenfenster** mehr. Er schaltet selten benötigte Parameter im fachlich passenden Reiter frei:

- **AFE optimieren:** erweiterte DSP-Anzeige für bereits kalibrierte Sensoren;
- **Ausgang konfigurieren:** Digital-Interface-Diagnose, AODO_F/O-Registerwerte, Limiting und Error Signaling (noch nicht freigegebene Funktionen nur lesbar);
- **EEPROM Viewer:** erweiterte Registerdiagnose, NVM-Details und chipbezogene Backup-/Restore-Vorbereitung.

Der normale EEPROM Viewer und Config-Laden/-Speichern sind **ohne Expertenmodus verfügbar**.

## Sicherheit und verbleibende Prüfungen

- Eine Config kann die Chip-Startkommunikation nicht ändern, da sie keine Bootregister enthält.
- Import und Übernahme schreiben nichts in das Sensor-RAM/NVM. AFE-RAM-Schreiben benötigt eine eigene Benutzeraktion und einen bestätigten Chip.
- NVM-Programmierung verlangt weiterhin Chip-UID, gültiges Original-NVM und die Software-Prüfungen für den 1-Wire-Zugriff.
- Der tatsächliche Betrieb nach **Kaltstart** und die genaue elektrische Ausgabe müssen am entbehrlichen Testchip mit der originalen PSSC und Messmitteln geprüft werden.
- Eine Config spart **Setup-Zeit**, ersetzt aber **keine sensorspezifische Kalibrierung**.

Weitere Details: [Bedienungsanleitung](ANLEITUNG.md), [1-Wire und Ausgang](AUSGANG_1WIRE.md), [Testbericht](TESTBERICHT.md) und [Änderungsverlauf](CHANGELOG.md).

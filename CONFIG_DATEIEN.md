# Config-Dateien und EEPROM Viewer

**Version v0.6.8 · 12. November 2026 · ELMOS E703.11 Kalibrierassistent**

Die Web-App unterstützt die Wiederverwendung von **chipunabhängigen Konfigurationen**, ohne dass sensorspezifische Kalibrierwerte, Werksdaten oder Kommunikationsregister von einem Sensor auf einen anderen übertragen werden.

## Anwendungsfall: mehrere gleiche Sensoren kalibrieren

Wenn mehrere Sensoren dieselben Grundeinstellungen benötigen, kannst du beim ersten Sensor beispielsweise PGA1, PGA2, den AFE-Offset, Referenzbereich, DSP-Sollspanne und Ausgangsskalierung einstellen. Die Werte exportierst du als `.json`-Config. Anschliessend lädst du diese Vorlage bei weiteren Sensoren, übernimmst die Eingaben und führst **pro Sensor eine neue Messpunktaufnahme, Koeffizientenberechnung und DSP-Prüfung** durch.

**Beispiel-Config:** [Beispiel_0-10bar.json](examples/Beispiel_0-10bar.json). Die Datei enthält nur Beispielwerte und ist **keine Kalibrierung**.

## Config speichern

Unter **USB & Chip → Config-Vorlagen** (auch im geführten und kompakten Modus):

1. Die gewünschten Einstellungen an den jeweiligen Stellen vornehmen.
2. Einen Vorlagennamen vergeben.
3. Im Bereich «Was soll in der Config-Datei gespeichert werden?» die gewünschten Gruppen auswählen: **AFE** (PGA1, Offset, PGA2), **Referenz** (Min., Max., Einheit), **Messung** (Punkte, Samples), **DSP** (Polynomordnung, Endwert) und **Ausgang** (Modus, VDD, S0/S1, Scaling).
4. «Ausgewählte Config speichern (.json)» drücken.

Mindestens eine Gruppe muss ausgewählt sein. **Nur die angehakten Gruppen stehen im JSON.** AFE wird mit den aktuell bestätigten Verstärkungs- und Offsetwerten gespeichert, nicht mit einem vorgemerkten Fehlversuch. Messpunkte, sensorspezifische Polynomkoeffizienten und EEPROM-/Factory-Wörter werden nie exportiert.

## Config laden und anwenden

1. Eine JSON-Datei auswählen und die Vorschau der enthaltenen Gruppen prüfen.
2. Die App prüft Format, Gruppen, Zahlenbereiche und zulässige Einstellungen. Die alten vollständigen Config-Dateien **v1** bleiben lesbar.
3. Enthält die Datei **keine AFE-Werte**, werden beim Klick auf «Ausgewählte Vorgaben übernehmen» nur die enthaltenen Einstellungen übernommen; kein RAM- oder EEPROM-Schreiben.
4. Enthält die Datei **AFE-Werte**, heisst der Button **«Config übernehmen + AFE direkt ins RAM»**. Mit diesem ausdrücklichen Klick werden PGA1, Offset und PGA2 **sofort ins RAM des verbundenen Sensors geschrieben** und durch Rücklesung kontrolliert. Ein zusätzlicher AFE-Button ist nicht nötig.
5. Ohne echte Chipverbindung oder wenn die RAM-Rücklesung scheitert, meldet die App einen Fehler. Die übrigen Config-Gruppen werden dann **nicht** angewendet.
6. Falls AFE, Referenz, Messablauf oder DSP-Vorgaben übernommen wurden, sind die bisherigen Messpunkte und DSP-Koeffizienten für diesen Sensor neu zu erfassen. Für eine dauerhafte Programmierung bleibt weiterhin der separate, geschützte NVM-Schritt notwendig.

**Wichtig:** Automatisches AFE-RAM-Schreiben erfolgt **erst nach dem bewussten Klick auf den Import-Button**, nicht bereits durch die Dateiauswahl. Eine Config programmiert niemals direkt das EEPROM.

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

- Neues JSON-Format **v2**: Kennung ELMOS-E70311-CONFIG, Version 2, Liste «include» und nur die tatsächlich ausgewählten Gruppen «afe», «reference», «measurement», «dsp» und «output».
- Bestehendes vollständiges JSON-Format **v1** bleibt weiterhin gültig und wird als vollständige Config übernommen.
- Die Validierung weist unerlaubte Felder, doppelte Gruppen, ungültige Codes, unzulässige Zahlen oder unbekannte Ausgangsmodi zurück.
- Komplette EEPROM-Backups, UID, Bootregister oder Werkseinstellungen werden nicht importiert.
- Auch im One-Pager und im geführten Assistenten werden dieselben Auswahlfelder verwendet; bei enthaltenen AFE-Werten schreibt der Import nach ausdrücklicher Bestätigung ins RAM, nicht ins EEPROM.

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

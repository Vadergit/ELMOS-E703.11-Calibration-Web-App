# Config-Dateien und EEPROM Viewer

**Version v0.6.9 · 12. November 2026 · ELMOS E703.11 Kalibrierassistent**

Die Web-App unterstützt die Wiederverwendung von **chipunabhängigen Konfigurationen**, ohne dass sensorspezifische Kalibrierwerte, Werksdaten oder Kommunikationsregister von einem Sensor auf einen anderen übertragen werden.

## Anwendungsfall: mehrere gleiche Sensoren kalibrieren

Wenn mehrere Sensoren dieselben Grundeinstellungen benötigen, kannst du beim ersten Sensor beispielsweise PGA1, PGA2, den AFE-Offset, Referenzbereich, DSP-Sollspanne und Ausgangsskalierung einstellen. Die Werte exportierst du als `.json`-Config. Anschliessend lädst du diese Vorlage bei weiteren Sensoren, übernimmst die Eingaben und führst **pro Sensor eine neue Messpunktaufnahme, Koeffizientenberechnung und DSP-Prüfung** durch.

**Beispiel-Config:** [Beispiel_0-10bar.json](examples/Beispiel_0-10bar.json). Die Datei enthält nur Beispielwerte und ist **keine Kalibrierung**.

## Config speichern – immer vollständig

Unter **USB & Chip → Config-Vorlagen** (auch im geführten und kompakten Modus):

1. Die gewünschten Grundeinstellungen für den Sensortyp setzen: **AFE**, **Druck-/Einheitenreferenz**, **Messpunkte und Samples**, **DSP-Parameter** und **Ausgang**.
2. Einen eigenen Profilnamen eingeben, z. B. «Standardprofil».
3. **«Gesamte Config speichern (.json)»** klicken. Die Datei enthält automatisch **alle fünf Gruppen**. Es gibt bewusst keine Auswahl mehr beim Export.

Die heruntergeladene Datei erhält einen **aussagekräftigen Präfix** aus den bekannten Merkmalen. Beispielsweise:

`2P_Druck_3T_Temp_0-10bar_0p5-4p5V_ELMOS_E70311_Standardprofil.json`

Der Präfix bedeutet 2 Druckpunkte × 3 Temperaturstufen, Referenzbereich 0–10 bar und gewünschte Ausgangsspannung 0,5–4,5 V. Der eigene Profilname bleibt am Ende bestehen. Die genauen Druck-/Temperaturstufen werden **nur** genannt, wenn der angewendete Messplan zweifelsfrei bekannt ist. Ansonsten verwendet die App eine neutrale Angabe wie `6Messpunkte` statt einer geratenen Anzahl Druckpunkte.

Die exportierten AFE-Werte stammen aus den aktuell bestätigten Einstellungen. Chip-ID, Werks-/EEPROM-Daten, sensorspezifische Kalibriermesswerte und fertige DSP-Koeffizienten gehören weiterhin **nicht** in eine wiederverwendbare Config.

## Config laden – erst jetzt auswählen

1. Eine Config-Datei auswählen. Die Anwendung validiert Struktur, Zahlenwerte und die enthaltenen Gruppen. **Noch wird kein Register verändert.**
2. **Nach erfolgreichem Laden** erscheinen die fünf Auswahlfelder: **AFE**, **Referenz**, **Messung**, **DSP** und **Ausgang**. Bei vollständigen Configs sind zunächst alle aktiviert; unerwünschte Gruppen einfach abhaken.
3. Alte partielle v2-Dateien bleiben gültig: **Nur vorhandene Gruppen** sind aktivierbar, nicht vorhandene Gruppen sind deaktiviert.
4. **Mindestens eine Gruppe** für den Import aktiv lassen. Der Import-Button zeigt die Wirkung der aktuellen Auswahl an.
5. **Wenn AFE nicht ausgewählt wurde:** «Ausgewählte Vorgaben übernehmen» aktualisiert nur die gewählten UI-Einstellungen. **Kein AFE-RAM- oder EEPROM-Schreibvorgang.**
6. **Wenn AFE ausgewählt wurde:** «Config übernehmen + AFE direkt ins RAM» schreibt PGA1, Offset und PGA2 nach dem ausdrücklichen Klick ins RAM eines verbundenen Sensors und liest zur Bestätigung zurück. Bei fehlender Verbindung oder gescheiterter Rücklesung wird der Import abgebrochen und die anderen Gruppen werden nicht übernommen.
7. Bei übernommenen AFE-, Referenz-, Mess- oder DSP-Einstellungen müssen sensorspezifische Messpunkte und Kalibrierkoeffizienten neu erfasst werden. Die dauerhafte NVM-/EEPROM-Programmierung bleibt ein separater, geschützter Vorgang.

**Das Abhaken von AFE beim Import verhindert einen AFE-Schreibvorgang.** Die Dateiauswahl selbst löst grundsätzlich kein RAM- oder EEPROM-Schreiben aus.

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

- JSON-Format **v2**: Kennung ELMOS-E70311-CONFIG, Version 2, Liste «include» und die fünf Gruppen «afe», «reference», «measurement», «dsp» und «output». Neue Exporte enthalten **alle fünf**; ältere partielle v2-Dateien bleiben weiterhin importierbar.
- Bestehendes vollständiges JSON-Format **v1** bleibt weiterhin gültig und wird als vollständige Config übernommen.
- Die Validierung weist unerlaubte Felder, doppelte Gruppen, ungültige Codes, unzulässige Zahlen oder unbekannte Ausgangsmodi zurück.
- Komplette EEPROM-Backups, UID, Bootregister oder Werkseinstellungen werden nicht importiert.
- Die Importauswahl funktioniert auch im One-Pager und im geführten Assistenten. **Nur wenn AFE beim Import angehakt ist**, wird nach ausdrücklicher Bestätigung ins Sensor-RAM geschrieben; niemals automatisch ins EEPROM.

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

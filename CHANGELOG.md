# Änderungsverlauf

Versionierung nach `MAJOR.MINOR.PATCH`: Kleine Anpassungen erhöhen PATCH, neue Funktionen MINOR, inkompatible Änderungen MAJOR. Jede Änderung erhält eine neue Nummer und einen Eintrag.

## v0.6.5 – 11.11.2026

- Überarbeitete Oberfläche und geführter Assistent veröffentlicht.
- Demo-Modus in die Einstellungen verschoben.

## v0.6.4 · Vorschau

- Ausgangseinstellungen in Schritt 8 gebündelt und die Formularfelder sowie Karten im Assistenten ausgerichtet.

## v0.6.3 · Vorschau

- Demo-Modus mit simulierten Messwerten und NVM für den vollständigen Kalibrierablauf.

## v0.6.2 · Vorschau

- Klarere Farben und Kontraste in der klassischen, geführten und kompakten Ansicht.
- Adaptereinstellungen, Verbindungsstatus und Diagnose sind in «USB & Chip» nach Aufgabe gruppiert.
- Die Messwertleiste hebt den Sensorwert hervor und gruppiert die Rohwerte.

## v0.6.1 – 11.11.2026

- ESP32-C3 PLC-Bridge für den Test am E703.11 integriert.
- «Trennen» gibt den USB-Port frei und meldet den Abschluss.
- Die App zeigt fehlende Sensorantworten und Timeouts der ESP32-Bridge getrennt an.

## v0.6.0 – 11.11.2026 · ZUSAMMENGEFÜHRT NACH MAIN

- Geführter Kalibrierassistent mit Aufgabe, Druck-/Temperaturplan, Sensor-Vorgaben, AFE, echter Referenzmessung, DSP-Berechnung, unabhängiger Verifikation, Ausgang und NVM; die klassischen und kompakten Ansichten bleiben erhalten.
- **Demo-Modus vollständig entfernt**: kein simuliertes ADC/DSP/NVM in der Web-App; geführter Abgleich setzt eine bestätigte Chipverbindung voraus.
- **AFE optimiert:** Original-Live-Graph in der geführten Ansicht, Grenzlinien ±25’000 Digits, Minimum/Maximum/Hub ab gewähltem Messfenster. Keine neue Hardware-Befehlsschicht.
- **Fertig-Seite:** grosser aktueller DSP-Sensorwert, ADC_S / ADC_T, Zeit, Verlauf und ausdrückliche Kennzeichnung der Ausgangs-Sollspannungen (nicht gemessene Spannungen).
- Übersichtlichere Gruppierung von Druck, Temperatur, VDD, S0/S1 und optionaler Config-Vorlage.
- ESP32-C3 SuperMini USB-CDC-Beispiel und ESP-Boardliste integriert. USB-Bridge bleibt **ohne reale PLC-/NVM-Freigabe**.
- **49 bestandene Software-Regressionstests**. Hardware-End-to-End-Prüfung mit echtem E703.11 bleibt offen.

---

## v0.6.0-beta.2 – 11.11.2026 · TESTBRANCH, NICHT MAIN

- **Ohne Hardware testbar:** «◈ Demo-Wizard» in der Kopfzeile sowie «Wizard ohne Hardware testen» auf der Verbindungsseite. Simulierte ADC_S-/ADC_T-Werte für verschiedene Druck-/Temperaturbedingungen.
- **Geführte Demo bis zum Ende:** Originale Messpunkterfassung und Fitberechnung auf synthetischen Rohwerten; virtuelle, von echten Hardwarezuständen strikt getrennte RAM-/DSP-/NVM-Bestätigungen. Die echten Hardware-Schreibaktionen bleiben gesperrt.
- **Demo-Config:** Geladene AFE-Profile können im Demo-Modus ausschliesslich virtuell übernommen werden, ohne Sensor-RAM anzusprechen.
- **ESP32-C3 SuperMini:** Eigener Arduino-Sketch mit nativer USB-CDC-Kommunikation, `BRIDGE_INFO`, `BRIDGE_PING`, `BRIDGE_STATS` und `CAPS=CDC_ONLY`. Kein unvalidierter PLC-GPIO-Zugriff.
- **ESP-Auswahlliste:** `docs/ESP_BOARD_OPTIONS.md` mit C3, S2, S3, C6, Nano ESP32 und XIAO-Boards, USB-Pins und Flash-Anleitung.
- **47 Regressionstests**, darunter Berechnungen mit synthetischen 2×1-, 2×3-, 3×2-, 3×3- und 5×2-Messmatrizen.
- `main` bleibt unverändert, die produktive GitHub-Pages-Seite unveröffentlicht für diese Beta. Kein Merge.

## v0.6.0-beta.1 – 11.11.2026 · TESTBRANCH, NICHT MAIN

- **Separater Branch** `feature/guided-calibration-and-usb-bridges`; keine produktive Main-Veröffentlichung, kein automatischer Merge.
- **Geführter Kalibrierassistent:** Nach bestätigter Verbindung Auswahl zwischen vollständigem Sensorabgleich, reiner Ausgangskonfiguration und EEPROM/Diagnose.
- **Vorheriger Messplan:** Druckpunkte (2–5), Temperaturstufen (1–3), automatische oder manuelle Polynomordnung, individuelle Solltemperaturen, Samples, DSP-Ziel und Ausgangsspannung.
- **Druck×Temperatur-Matrix:** Bis zu 10 echte Referenzmessungen werden den originalen Messpunkterfassungen zugeordnet; der Assistent zeigt Sollwert, Reihenfolge, Fortschritt und folgt der bestehenden RAM-/DSP-/NVM-Logik.
- **Config-Import:** Originale chipunabhängige Config-Vorlagen im Assistenten, ohne Übernahme individueller EEPROM-/Factory-Daten.
- **Klassisch bleibt:** Original-Steuerung wird nur temporär in den Guide verschoben und beim Schliessen zurückgestellt; Kompaktansicht und EEPROM-Viewer bleiben erhalten.
- **Adapterwahl:** SSP3 (unverändert) oder experimentelle USB-CDC-Bridge. `BRIDGE_INFO` mit expliziten Capabilities, ohne unvalidierte Sensor-Freigabe. NVM-Programmierung über Bridge explizit auch im NVM-Schreibpfad gesperrt.
- **Native USB-Beispiel-Firmware:** ESP32-S3 / RP2040 über Arduino IDE; nur CDC-Handshake, noch kein PLC-Sensorprotokoll.
- 41 JavaScript-Regressionstests inklusive Branch-Sicherheit, Bridge-NVM-Sperre, 3×3/4×2-Messmatrix und Wechsel zwischen Kompakt-/Guided-Modus. Ein lokaler Python-Vorschauserver (`scripts/preview.py`) vereinfacht Tests ohne Veröffentlichung.
- Dokumentation: `docs/GEFUEHRTER_ASSISTENT.md`, `docs/USB_BRIDGE_GUIDE.md`. Regressionstests für die Matrix und den Bridge-Sicherheitspfad ergänzt.

## v0.5.0 – 11.11.2026

- **Optionaler One-Pager:** «Kompaktmodus · One-Pager» in den App-Einstellungen. Die normale Ansicht bleibt standardmässig unverändert; die Auswahl wird lokal gespeichert.
- Alle Kernschritte für Kalibrierung und Programmierung gleichzeitig in einem kompakten Grid: Verbindung, direkte AFE-RAM-Einstellung, Config-Vorlagen, Messpunkte, Koeffizienten/RAM, DSP-Verifikation, Ausgang/Scaling und NVM.
- **Identische Originalsteuerelemente:** Beim Umschalten werden die bestehenden DOM-Elemente vorübergehend neu angeordnet und beim Verlassen an die ursprüngliche Stelle zurückgestellt. Keine duplizierten Eingabewerte oder alternativen Hardware-/NVM-Schreibpfade.
- Punkteditor mit Auswahl für 2–10 Kalibrierpunkte, ausklappbare Ergebnis-/Änderungsdetails, kompakte Warnungen sowie Expertenfelder bei aktiviertem Expertenmodus.
- Responsive Desktop-Layout ohne Seitenwechsel; bei kleinen Auflösungen werden einzelne Karten bei Bedarf intern scrollbar. Neue Datei `compact.js`, Cache-Version v0.5.0 und **31 Software-Regressionstests**.
- NVM-UID-/CRC-/Startschutz, DSP-Verifikation und Hardware-Freigabegrenzen unverändert; die Kompaktansicht ersetzt keine Hardwaretests.

## v0.4.2 – 11.11.2026

- **EEPROM Viewer als Registerreferenz:** Neue Spalte «Funktion» für alle 64 Wörter, anklickbare Zeilen mit ausführlicher Beschreibung, Roh-/Signed-/Unsigned-Wert und berechnetem Q3.12/Q0.15-Wert bei dokumentierten Koeffizienten.
- **Adressen eindeutig:** EEPROM-Wortindex, EEPROM-Byteadresse und – wo geprüft zuordenbar – RAM-Registeradresse getrennt ausgewiesen.
- **Kontextbezogene Experteninfos:** Binäransicht, verifizierte Einzelbits für CFG_EN, CFG_SPI_I2C, CFG_PADS0, CFG_PADS1 und CFG_AFE1 sowie relevante Formeln.
- **Beschreibungen durchsuchbar:** z. B. «Temperatur», «Gain», «Offset», «1-Wire». Unbekannte Bitfelder werden nicht erraten.
- **Unveränderte Sicherheit:** Der Viewer verwendet weiterhin nur das CRC-geprüfte, zur Chip-UID passende 64-Wort-Abbild. Aufklappen, Suche und Erläuterungen verändern weder RAM noch EEPROM.
- Neues rein lesendes Modul `eeprom-help.js`; JavaScript-Cache-Version v0.4.2 und **28 Regressionstests**.

## v0.4.1 – 11.11.2026

- **Einmaliger automatischer USB-Neuaufbau:** Antwortet das SSP3 nach dem USB-Handshake, aber die E703.11-Chiperkennung scheitert, wird der COM-Port einmal geschlossen, nach 200 ms wieder geöffnet und Firmware/Interface/Chip erneut geprüft.
- Bei einem zweiten Chipfehler bleibt der USB-Port geöffnet und eine eindeutige Warnung erscheint. **Keine Endlosschleife**, keine wiederholten automatischen Reconnects und keine Änderungen an Chip-Registern oder NVM.
- Der SSP3-Firmware-Handshake selbst löst keinen automatischen Retry aus. Das Diagnoseprotokoll kennzeichnet den ersten Chipfehler und den Neuaufbau.
- Cache-Version aller Browser-Skripte auf v0.4.1 angehoben; Regressionstest für die einmalige Wiederholung hinzugefügt. Hardwaretest am SSP3/E703.11 weiterhin notwendig.

## v0.4.0 – 11.11.2026

- **EEPROM Viewer:** Eigener, jederzeit erreichbarer Navigationstab zusätzlich zu den sieben Kalibrierschritten. 64 NVM-Wörter tabellarisch mit PSSC-ähnlichen Spalten Adresse, Bitfield, Data Hex, Data und Schutzstatus; Suche und chipbezogener JSON-Backup-Export. Er nutzt denselben CRC-geprüften Leseweg und bietet keine direkte EEPROM-Editierfunktion.
- **Config-Vorlagen:** Speichern/Laden chipunabhängiger Einstellungen (AFE-Gains/Offset, DSP-Endwert und Polynomordnung, Messpunkte/Samples/Referenzbereich, Ausgangsmodus und S0/S1) als strikt geprüfte JSON-Datei. Kein Kopieren von UID, Factory-/Bootregister, NVM-Daten oder DSP-Kalibrierkoeffizienten.
- **Sichere Übernahme:** Dateiauswahl erzeugt zuerst eine geprüfte Vorschau. Übernehmen belegt nur UI-Felder, verwirft veraltete Messpunkte und NVM-Schreibpläne. AFE-Zielwerte werden separat angezeigt und erst nach einem ausdrücklichen Klick ins RAM geschrieben und rückgelesen; kein EEPROM-Schreiben durch Config-Import.
- **Expertenmodus korrigiert:** Das separate Expertenfenster entfernt. Zusatzeinstellungen erscheinen nur bei aktiviertem Expertenmodus und direkt in den passenden Reitern AFE, Ausgang und EEPROM Viewer.
- Neue Dateien: `config.js`, [CONFIG_DATEIEN.md](CONFIG_DATEIEN.md), [Beispiel-Config](examples/Beispiel_0-10bar.json).
- Schutz gegen veraltete EEPROM-Daten: Viewer zeigt eine vorhandene NVM-Lesung nur bei verbundener, zur gelesenen SER0/SER1 passender Chip-UID.
- Regressionstests auf **24 Fälle** erweitert und bisherigen Code-/Datenblatt-Schutz beibehalten. Skriptversionen synchronisiert.

## v0.3.4 – 11.11.2026

- **Expertenmodus sichtbar und erreichbar:** Das Aktivieren über «⚙ Einstellungen» öffnet direkt ein eigenes Expertenfenster mit Register-Leser, kompletter EEPROM-/NVM-Diagnose, Chip-UID und Backups.
- Keine Verknüpfung mehr mit dem gesperrten Schritt 7 «NVM programmieren» und kein zusätzlich zu öffnender Unterpunkt.
- Expertenfenster schliessen und über «Expertenwerkzeuge öffnen» erneut aufrufen; «EXPERT»-Anzeige am Einstellungs-Knopf.
- Kein Schreiben durch die Aktivierung; Factory-/Bootschutz, UID-/CRC-Prüfungen und Freigabe für NVM-Schreiben unverändert.
- Browser-Skriptversionen auf v0.3.4 vereinheitlicht (Cache-Vermeidung).
- README, Anleitung und Testbericht auf die neue Ansicht angepasst.

## v0.3.3 – 11.11.2026

- «One Wire only» als bedingt auswählbarer Betriebszustand ergänzt, sofern der permanente PLC-Zugriff bereits im Original-NVM aktiviert ist.
- Ohne bereits bestehendes plc_en=1 wird die Umstellung aus Sicherheitsgründen nicht programmiert.
- Eigenes Datenblatt-Dokument [AUSGANG_1WIRE.md](AUSGANG_1WIRE.md) erstellt.
- Regressionstests für permanente 1-Wire-Kommunikation und Startfenster ergänzt; JavaScript-Cache-Version korrigiert.

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

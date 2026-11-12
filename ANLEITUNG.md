# Bedienungsanleitung – ELMOS E703.11

**Dokumentationsstand v0.6.11** Kalibrierassistent

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Projektübersicht](README.md)** · **[Config-Dateien & EEPROM Viewer](CONFIG_DATEIEN.md)** · **[Testbericht](TESTBERICHT.md)**

Diese Anleitung beschreibt die derzeitige Benutzeroberfläche der browserbasierten App für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Ziel ist ein geführter Abgleich mit möglichst wenig Vorwissen und optionalen Expertenfunktionen.

> **Laborprototyp, keine Produktionsfreigabe.** Der vollständige Kalibrier- und NVM-Schreibablauf wurde noch nicht am realen E703.11 als Gesamtsystem validiert. Permanente Änderungen zunächst nur an einem entbehrlichen Testchip erproben.

## Neue geführte Ansicht

Nach der bisherigen USB-/SSP3-Verbindung startet auf Wunsch ein neuer Assistent mit einer übersichtlichen Schrittnavigation. Du definierst erst die Abgleichart (z. B. 2 Druckpunkte ohne Temperaturkorrektur oder 3 Druckpunkte bei 2 Temperaturstufen). Danach folgen Referenzbereich, Temperatur-Sollwerte, Ausgangsspannung, optionale Config-Datei, AFE, tatsächliche Messung, Berechnung/RAM, DSP-Prüfung, Ausgang und die sichere NVM-Programmierung.

Unter **Einstellungen → Arbeitsansicht nach dem Verbinden** zwischen «Geführter Assistent» und «Klassische Ansicht» wählen. Im geführten Modus bleibt «Klassische Ansicht» jederzeit erreichbar. Alle Hardware-/NVM-Schreibvorgänge verwenden weiterhin die bestehenden, geschützten Buttons und die Original-Kalibrierlogik.

**Für den geführten Abgleich ist ein über SSP3 erkannter E703.11 erforderlich.** Die Oberfläche verwendet dieselben abgesicherten RAM-/NVM-Funktionen wie die klassische Ansicht.

Vollständige Beschreibung: [Geführter Assistent](docs/GEFUEHRTER_ASSISTENT.md). Die experimentelle alternative USB-Bridge ist separat beschrieben: [ESP32/Arduino-Guide](docs/USB_BRIDGE_GUIDE.md).

## Kompaktmodus – One-Pager (optional)

Über **⚙ Einstellungen → «Kompaktmodus · One-Pager»** werden die **originalen Bedienelemente** in einem platzsparenden Arbeitsbereich angezeigt. Standardmässig bleibt die bisherige siebenstufige Normalansicht aktiv. Die Option wird lokal im Browser gespeichert und kann mit «Normalansicht» jederzeit wieder ausgeschaltet werden.

In der Kompaktansicht stehen die Hauptfunktionen gleichzeitig bereit: USB/SSP3 verbinden, PGA1/Offset/PGA2 (mit sofortiger RAM-Übernahme), Config-Vorlagen laden/speichern, Kalibrierpunkte aufnehmen, DSP-Koeffizienten berechnen und ins RAM übertragen, unabhängige DSP-Prüfpunkte messen, AODO-Ausgang wählen und die sichere NVM-Programmierung vorbereiten/ausführen. Die NVM-Freigabe verlangt **unverändert** einen echten Chip, verifizierte Werte, gültige CRC/UID, den geprüften Änderungsplan und die bestehenden Startup-Schutzbedingungen.

Bei **2–10 Kalibrierpunkten** wählt man im Feld «Messpunkt bearbeiten» den gewünschten Punkt; dadurch bleiben die Eingaben auf der Seite kompakt. Zusatzdetails wie Koeffizienten und NVM-Änderungsliste können aufgeklappt werden. Der Expertenmodus erweitert den Ausgangsbereich um die zugehörigen Parameter. Diagnosefunktionen und die vollständigen Erläuterungen sind in der Normalansicht weiterhin zugänglich.

**Bildschirmgrenze:** Der One-Pager ist für Desktop-Monitore ausgelegt. Bei sehr kleinen Auflösungen, vielen geöffneten Detailfeldern oder längeren Rückmeldungen können einzelne Karten intern scrollen; Sicherheitsmeldungen dürfen nicht abgeschnitten oder umgangen werden. Der Kompaktmodus garantiert keine vollständig scrollfreie Darstellung auf jeder Bildschirmgrösse.

## 1. Start und Verbindung

Die App wird **ausschliesslich über die [GitHub-Pages-Webseite](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** mit Chrome aufgerufen. Sie verwendet **Web Serial** und benötigt einen vom Betriebssystem erkannten USB-/FTDI-COM-Port.

**Es sind keine Installation, keine Windows-/macOS-Startskripte, kein Python und kein lokaler Webserver erforderlich.** Die separate [webbasierte SSP3-USB-Diagnose](usb-diagnose.html) kann bei Verbindungsproblemen direkt im Browser geöffnet werden.

In **Schritt 1 – Verbindung**:

1. SSP3 und Sensor verbinden und den FTDI-COM-Port im Gerätemanager beziehungsweise Betriebssystem prüfen.
2. **USB-Port auswählen** und den richtigen Anschluss bestätigen; bereits freigegebene Geräte können erneut verbunden werden.
3. Standardmässig die **1-Wire-/AODO-Kommunikation** verwenden, sofern sie zur Hardware passt. Die Oberfläche bietet auch I²C-/SPI-Optionen.
4. Firmware-/Chip-Erkennung und erste ADC-Werte kontrollieren. Bei Fehlern zunächst **nur lesen**, nicht programmieren.

**Wenn SSP3 antwortet, der E703.11 aber nicht:** SSP3-USB bleibt geöffnet, es erfolgt kein automatischer USB-Neuaufbau oder unbekannter Hardware-Reset. Die Originalsoftware Elmos PSSC kann denselben Sensor ohne manuelles Trennen erreichen. Darum ist in diesem Fall die fehlende SSP3-Start- beziehungsweise PLC-Freigabesequenz zu klären, nicht wiederholt die Versorgung manuell zu trennen. Unter **USB & Chip → SSP3-Verbindungsdiagnose → Web-App-SSP3-Protokoll exportieren** kann der protokollierte Verlauf (TX/RX, IF_CFG, PLC, Firmware, Fehler) als JSON exportiert und mit einem separat aufgezeichneten originalen PSSC-Trace verglichen werden. Die **PLC-Lesediagnose (12 s)** ist optional und startet das Sensoreinschaltfenster nicht von selbst. Keine Schreibrechte ohne gültige Chiperkennung.

**Wenn der Chip zwar antwortet, aber CFG_AFE1/Bit 11 nicht plausibel ist:** Im Chipdiagnose-Bereich kann das Register mehrfach nur lesend geprüft werden. Ein Bit 11 = 0 wird nicht automatisch korrigiert. Die CRC8-Prüfung der SSP3-Antwort ist unabhängig noch nicht validiert; die Rohdaten sind dennoch im Log verfügbar.

**Wenn sich COM öffnen nicht lässt:** Die Auswahl eines FTDI-Adapters bedeutet noch nicht, dass Chrome den Port öffnen kann. Zum Beispiel andere serielle Programme schliessen, COM-Zuordnung und VCP-Treiber prüfen; eine Fehlermeldung bei `SerialPort.open()` entsteht vor einer eigentlichen E703.11-Protokollprüfung. Der technische Diagnosemodus kann helfen.

**EEPROM Viewer:** Im separaten Navigationstab können alle 64 Wörter mit der zusätzlichen Spalte **Funktion** gelesen werden. Ein Klick auf den blauen Wortindex öffnet die Registerbeschreibung mit EEPROM-Wortindex (0x00–0x3F), EEPROM-Byteadresse (Wortindex × 2), zugeordnetem RAM-Register (falls dokumentiert), Rohwert, Signed-Wert und interpretierter Q3.12-/Q0.15-Zahl. Das Suchfeld durchsucht auch Funktionsbeschreibungen wie «Offset», «Temperatur» oder «1-Wire». Bei aktiviertem Expertenmodus erscheinen zusätzlich die bekannten Bitpositionen und zugehörigen Formeln; unbestätigte Bitfelder werden bewusst nicht dekodiert. Dieser Viewer löst durch Öffnen einer Zeile **keinen Chipzugriff und keinen Schreibvorgang** aus.

### Config-Vorlagen in «USB & Chip»

Config-Dateien sind **wiederverwendbare Einrichtungsvorlagen**, keine EEPROM-Backups.

**Speichern:** Alle wiederverwendbaren Einstellungen werden immer vollständig gespeichert: AFE, Referenz, Messung, DSP und Ausgang. «Gesamte Config speichern (.json)» klicken. Der Dateiname erhält automatisch einen aussagekräftigen Präfix, zum Beispiel `2P_Druck_3T_Temp_0-10bar_0p5-4p5V_ELMOS_E70311_Standardprofil.json`. Der eigene Profilname bleibt erhalten; bei unbekanntem Druck-/Temperaturplan verwendet die App eine neutrale Messpunktangabe.

**Laden:** Datei auswählen, danach bestimmen, welche der enthaltenen Gruppen **tatsächlich übernommen** werden sollen. Alle vorhandenen Gruppen sind standardmässig angehakt. Nicht gewünschte Gruppen abwählen; mindestens eine auswählen. Ältere partielle Configs (v2) sowie vollständige Dateien (v1) sind weiterhin lesbar.

**AFE-RAM:** Nur wenn beim **Import AFE ausgewählt ist**, heisst der Button «Config übernehmen + AFE direkt ins RAM». Nach dem Klick werden PGA1, Offset und PGA2 im verbundenen Sensor ins RAM geschrieben und rückgelesen. Wird AFE abgewählt, erfolgt keine AFE-RAM-Übernahme. **Ein EEPROM-Schreibvorgang wird dabei nie ausgelöst.**

[Beispiel-Datei](examples/Beispiel_0-10bar.json) · [Technische Details](CONFIG_DATEIEN.md).


### «One Wire only» prüfen und auswählen

1. In **Schritt 6** das vollständige **Original-NVM (64 Wörter)** lesen. Die Chip-UID muss dazu passen.
2. Unter **AODO pin → Type** die Option **«One Wire only»** wählen.
3. Die Meldung unter der Auswahl ansehen: Nur bei bereits dauerhaft aktiver 1-Wire-Konfiguration (plc_en=1, AODO-Grundmodus 1–5, Downstream/Upstream und persistenter Registerzugriff) wird der Zustand bestätigt.
4. Bei einem solchen Chip ist **keine NVM-Änderung erforderlich**, um «One Wire only» zu bestätigen. Eine Auswahl ohne neue Kalibrierung programmiert daher nichts.
5. Ist nur ein 1-Wire-Startzeitfenster vorhanden, gibt es eine verständliche Fehlermeldung. Die App **aktiviert nicht automatisch dauerhaftes PLC**, da dazu geschützte Bootregister verändert werden müssten.

Wichtig: Bei dauerhaftem 1-Wire-Betrieb wird die reguläre analoge/PWM/FM-Ausgabe am AODO-Pin überlagert. **«One Wire only» und gleichzeitig dauerhaft 0.5–4.5 V analog an AODO sind keine kompatiblen Betriebsarten.** Zum Wechsel von einem Startzeitfenster auf permanentes PLC braucht es einen eigens abgesicherten und am Testchip validierten Prozess, der hier bewusst nicht enthalten ist.

**1-Wire-Startschutz:** Dauerhafte NVM-Programmierung nur bei echter 1-Wire-Verbindung **und** mit einer zum Datenblatt passenden NVM-Startkonfiguration. AODO-Modus 1–5 ist Pflicht (Analog, PWM, FM); High-Z und Alarm bleiben gesperrt. Die PLC-Startzeit beziehungsweise permanente PLC-Freigabe sowie Downstream-, Upstream- und persistenter Lese-/Schreibzugriff werden im NVM geprüft. Wenn das ursprüngliche NVM diese Bedingung nicht erfüllt, wird kein NVM-Schreiben gestartet. Kommunikations-/Bootwerte des NVM dürfen sich durch den geplanten Schreibvorgang nicht ändern. Nach dem Schreiben den Sensor aus- und wieder einschalten und den 1-Wire-Zugriff erneut prüfen. Ohne Hardwaretest ist eine absolute Startgarantie nicht nachgewiesen.

## 8. NVM dauerhaft programmieren

In **Schritt 7** gibt es zwei Hauptaktionen:

**A. NVM lesen & Änderungen prüfen:** Die App liest **64 NVM-Wörter**, kontrolliert CRC8/CRC16 und die schreibgeschützten Bereiche und erstellt die Änderungsliste. Diese Vorschau programmiert **noch nichts**.

**B. Kalibrierung dauerhaft ins NVM schreiben:** Die **48-Bit-Chip-UID (VERSION + SER1 + SER0)** wird automatisch aus dem verbundenen Sensor übernommen und in das Eingabefeld eingetragen. Du darfst den Wert bearbeiten; ein Schreibvorgang bleibt jedoch gesperrt, wenn er nicht mit dem angeschlossenen Chip übereinstimmt. Ein zusätzliches **Bestätigungswort wird nicht mehr benötigt**.

Die Option **«Altes NVM automatisch sichern»** ist standardmässig **aktiviert**. Bei aktivierter Option wird vor der eigentlichen Programmierung die alte Konfiguration chipbezogen archiviert und ein **JSON-Download** ausgelöst. Du kannst die Option bewusst deaktivieren; eine vollständige **Sicherheitslesung mit CRC-Prüfung** bleibt dennoch Pflicht. Ohne gespeichertes Original kann eine spätere Wiederherstellung unmöglich sein.

Die Änderungsliste, das separate Leseprotokoll und die Kontrolle nach einem physischen Neustart sind einklappbar. Nach dem Schreiben erfolgt eine Rücklese-/CRC-Kontrolle; für die tatsächliche Bootkontrolle muss der Chip physisch aus- und wieder eingeschaltet werden.

**Achtung:** Ein Stromunterbruch oder Protokollfehler beim NVM-Schreiben kann den Sensor beschädigen. Die Hardwareverträglichkeit der aktuellen Implementierung ist nicht vollständig validiert.

## 9. EEPROM Viewer (eigener Reiter, unabhängig vom Kalibrierablauf)

Der zusätzliche Reiter **EEPROM Viewer** ist jederzeit erreichbar und gehört nicht zu den sieben Kalibrierschritten. Er zeigt eine **nur lesbare 64-Wort-Tabelle** mit den PSSC-ähnlichen Spalten **Adresse, Bitfield, Data Hex, Data, Schutz**.

- **EEPROM lesen (64 Wörter):** Benötigt einen verbundenen Sensor; die App verwendet den vorhandenen Wartungs-Leseweg und prüft CRC8/CRC16.
- **In EEPROM-Wörtern suchen:** Nach Wortadresse, Bitfield-Name, Wert oder Schutzstatus filtern.
- **EEPROM-Backup exportieren:** Exportiert das komplette, chipgebundene NVM samt UID als JSON – ausdrücklich **nicht** dasselbe Format wie eine chipunabhängige Config.
- **Expertenmodus:** Schaltet zusätzliche Registerlese-/Diagnosefunktionen und Backup-Wiederherstellungsplanung in diesem Reiter frei.

Der Viewer erlaubt **kein direktes Bearbeiten oder Programmieren von EEPROM-Wörtern**. Eine permanente Änderung erfolgt nur im normalen geschützten NVM-Ablauf.

## 10. ⚙ Einstellungen und Expertenmodus

Das **Zahnrad oben rechts** öffnet die Einstellungen. Dort lassen sich folgende Optionen bedienen:

- **Expertenparameter freischalten** (ändert beim Aktivieren selbst keine Chipregister).
- **Hover-Erklärungen** ein-/ausschalten.
- **Standard-Sample-Anzahl** für neue Messpunkte (1–100).
- **Live-Abfrageintervall** (400, 650, 1’000, 1’500 oder 2’000 ms).

Beim Einschalten des Expertenmodus erscheinen zusätzliche, selten benötigte Felder **direkt in den jeweiligen Reitern**. Es wird **kein separates Fenster** geöffnet. Du kannst jederzeit wieder zum normalen Modus wechseln, ohne Registerwerte zu verändern.

**AFE optimieren:** Erweiterte DSP-Anzeigeeinstellungen für bereits kalibrierte Sensoren.

**Ausgang konfigurieren:** Grundlegende AODO-Modi und die S0/S1-Skalierung sind immer sichtbar. Mit Expertenmodus werden zusätzlich Digital Interface, AODO_F/AODO_O und die noch nicht freigegebenen Limiting- und Error-Signaling-Diagnosen eingeblendet. High-Z und Alarm bleiben wegen der 1-Wire-Startbedingung gesperrt.

**EEPROM Viewer:** Die 64-Wort-Tabelle ist für alle zugänglich. Der Expertenmodus blendet die Registerdiagnose und die chipgebundenen Backup-/Restore-Werkzeuge ein. Die sichere Restore-Vorbereitung ist nicht gleichbedeutend mit einem NVM-Schreiben.

**Factory-Schutz:** Der Werksbereich **CM-Byteadresse 0x00–0x1E** bleibt nur lesbar. Boot-/Kommunikationswerte bleiben geschützt. Gezielte, dokumentierte AODO-Konfigurationsfelder werden nur über geprüfte Schreibpläne geändert. Es gibt **keinen allgemeinen Editor für beliebige NVM-Wörter**. Die Wiederherstellung eines fremden Chips oder eines Backups mit abweichenden Factory-/Bootwerten wird abgelehnt; sie erfolgt niemals automatisch.

Die lokale Browser-Backup-Historie kann beim Löschen von Website-Daten verloren gehen. **JSON-Backups zusätzlich extern aufbewahren.**

## 11. Sicherheit, technische Grundlage und Grenzen

- **Vor echten Schreibtests:** Zuerst nur lesen; anschliessend RAM-Funktionen; permanente NVM-Schreibvorgänge erst an einem entbehrlichen Testchip.
- **Eigene Berechnung:** Die Software verwendet einen unabhängigen numerischen JavaScript-Fit, **nicht** `pssc_cal_lib.dll`. Der resultierende DSP-Abgleich muss an echten Sensoren und möglichst mit der Originalsoftware verglichen werden.
- **Vorhandene technische Grundlagen:** E703.11-Datenblatt `25DS0170E.04`, Evaluation-Kit-Dokumentation und SSP3-/Kalibrier-Unterlagen AN 0203/0204. Proprietäre Herstellerdateien sind nicht im Repository enthalten.
- **Keine Garantie:** Selbst korrekt bestandene Software-Simulationen können das Verhalten von SSP3, AODO-Ausgängen, NVM oder Bootsequenzen auf echter Hardware nicht garantieren.

**Web-Dateien:** `index.html` (UI), `app.js` (Web Serial und Ablauf), `calibration.js` (Koeffizienten/CRC/NVM), `expert.js` (kontextbezogene Expertenparameter/EEPROM), `config.js` (chipunabhängige Config-Prüfung) und `usb-diagnose.html` (USB-Diagnose). Für Entwickler existieren Node-Tests in `tests/safety.test.cjs`; es gibt keine lokale Desktop-Startanwendung. Dokumentierte Simulationen und offene Hardwareprüfungen: [TESTBERICHT.md](TESTBERICHT.md).

**Datenblatt-Referenz:** E703.11, 25DS0170E.04, Production Data 16.11.2023, §6.3.2.6 / §6.4.1.1 / §6.4.5.7–8 / §6.5.1.1–2 / §6.5.7.2. Eine reine Softwareprüfung kann eine tatsächliche Kaltstartprüfung nicht ersetzen.


## One-Wire beim Sensorstart (v0.6.13)

Wenn der E703.11 nach `IF_CFG` und direkter PLC-Leseabfrage nicht antwortet, **Web-App-SSP3-Protokoll exportieren**. Die Originalsoftware PSSC verbindet mit unveränderter Verkabelung und kurzem 4-ms-Startfenster; eine manuelle VDD-Unterbrechung ist deshalb keine notwendige Voraussetzung. Die verbleibende Differenz ist die unbekannte Original-SSP3-Initialisierung / Zugriffsfreigabe. Eine optionale 12-s-PLC-Lesediagnose kann zusätzliche Sensorantworten aufzeichnen, stellt das abgelaufene Startfenster aber nicht wieder her. Kein automatischer Hardware-Reset oder Magic-Cookie-Schreibversuch ohne bestätigten Herstellerablauf.


### Experimenteller Magic-Cookie-Test (v0.6.14)

Nach dem erfolglosen 1-Wire-Verbindungsversuch im Reiter **USB & Chip** das Untermenü **Experimentell · One-Wire-Magic-Cookie (RAM)** öffnen. Warnhinweis beachten, das Einverständnis für die temporäre AODO-Umschaltung aktivieren und **Magic Cookie testen (nur RAM)** drücken. Der Test sendet nur die zwei im Elmos-Datenblatt dokumentierten PLC-Writes und liest anschliessend Register. **Keine NVM-Programmierung.** Bei Erfolglosigkeit das Web-App-SSP3-Protokoll exportieren. Dieser Test ersetzt keine bekannte hardwareseitige Öffnung des 4-/200-ms-Startfensters.

## SSP3-Sensorstart nach Elmos AN 0204 (v0.6.15, 12.11.2026)

Der Anwender hat die Hersteller-Application-Note AN 0204 bereitgestellt, die erstmals die zuvor unbekannten SSP3-DUT-Power-Befehle dokumentiert. Nach einer expliziten Bestätigung am isolierten Prüfplatz kann die Web-App folgenden **einmaligen Test** über schaltbare SSP3-VSUPPLY durchführen:

`IF_CFG 7 0 0` → `Power_OFF 03E8` (1000 mV Abschaltschwelle) → 30 ms Ruhe → `PLC P` (Cookie vorbereiten) → `PWR_ON 0C80 00C8 0` (Herstellerbeispiel 3200 mV, 200 µs, Einzelsocket) → unmittelbar `PLC T` → bestehende Chipregister-/ADC-Erkennung.

**Achtung:** Der Abschaltbefehl heisst laut Seite 7 **`Power_OFF`**, während der Einschaltbefehl **`PWR_ON`** heisst. Bei Fehlschlag nach einem begonnenen Ausschalten versucht die App dokumentiertes `PWR_ON 0 0 0` zur Wiederherstellung. Im Log stehen die Antworten und Laufzeiten jeder Stufe.

Aufruf: **USB & Chip → SSP3-Verbindungsdiagnose → Neu · SSP3-Sensorstart (AN 0204, Prüfplatz)**. Alternativ gibt es eine einmalige Opt-in-Option beim nächsten Connect **vor dem ersten Registerlesen**. Die Originalsoftware-Sequenz ist mangels Mitschnitt weiterhin nicht 1:1 belegt; insbesondere ein 4-ms-Startfenster ist durch Browser-/USB-Latenzen nicht garantiert. Nur bei über SSP3-VSUPPLY versorgtem Prüfsensor verwenden; externes VDD wird eventuell nicht geschaltet. Keine NVM-Programmierung, aber temporäre Überlagerung des analogen AODO-Ausgangs ist möglich.


### v0.6.16: SSP3-Firmware-Befehlshilfe bei fehlerhaftem Power_OFF

Das reale SSP3 meldete beim ersten Power-Test `Unknown command (POWER_OFF)`, obwohl AN0204 genau diese Schreibweise nennt. `PWR_ON` war erreichbar. Im Reiter **USB & Chip → SSP3-Verbindungsdiagnose → SSP3-Sensorstart** bitte zunächst auf **«SSP3-Befehle anzeigen (?) · nur lesen»** klicken. Die Hilfe wird unterhalb des Buttons ausgegeben und beim Web-App-Protokollexport mitgespeichert. Der eigentliche Power-Test prüft die Hilfe automatisch und sendet **nur wenn `PWR_OFF` darin ausdrücklich vorkommt** die experimentelle Alternative `PWR_OFF 03E8`; ansonsten bricht er vor jeder Stromunterbrechung ab. Keine NVM-Änderungen. Bei einer erneuten Fehlermeldung Hilfe- und Startprotokoll hochladen.

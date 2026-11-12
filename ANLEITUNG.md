# Bedienungsanleitung – ELMOS E703.11

**Dokumentationsstand v0.6.40** Kalibrierassistent

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Projektübersicht](README.md)** · **[Config-Dateien & EEPROM Viewer](CONFIG_DATEIEN.md)** · **[Testbericht](TESTBERICHT.md)**

Diese Anleitung beschreibt die derzeitige Benutzeroberfläche der browserbasierten App für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Ziel ist ein geführter Abgleich mit möglichst wenig Vorwissen und optionalen Expertenfunktionen.

> **Laborprototyp, keine Produktionsfreigabe.** Der vollständige Kalibrier- und NVM-Schreibablauf wurde noch nicht am realen E703.11 als Gesamtsystem validiert. Permanente Änderungen zunächst nur an einem entbehrlichen Testchip erproben.

## Automatische 1-Wire-Adresse v0.6.40

Der E703.11 nutzt die 1-Wire-Slave-Adresse aus `CFG_SPI_I2C.i2c_address` zusammen mit `CFG_PADS1.plc_upper_addr`. Der Standard ist **0x6C**. Für die eingereichte Original-PSSC-XML (`0x7C05` / `0x099F`) wäre es **0x7C**. Die Web-App versucht bei jeder neuen SSP3-Verbindung und nach einem Sensorwechsel zunächst beide Adressen **ausschliesslich lesend**, prüft CRC8 und die Konfigurationsregister und übernimmt nur eine bestätigte Adresse. Erst falls beide Prüfungen scheitern, läuft der begrenzte bisherige Starttest. Er sendet bei fehlender Chipantwort nur die dokumentierten RAM-Magic-Cookie-Folgen für diese beiden Adressen und schreibt nie automatisch ins NVM.

In **Einstellungen → Expertenparameter freischalten** zeigt **USB & Chip** die bestätigte 1-Wire-Adresse. Der Diagnoseexport listet alle Adressversuche. Eine gespeicherte XML-Datei allein beweist nicht, dass sie zum aktuell angeschlossenen Chip gehört. Die neue Erkennung ist softwareseitig geprüft, aber noch nicht durch einen echten Chiptest bestätigt.

## Verfeinerter SSP3-Test in v0.6.38

Für die bekannte SSP3-Firmware 02.08.02.04 konfiguriert die Web-App beim ersten Start die PLC-Hostgeschwindigkeit mit `PLC_CFG 1 0007` (100 kHz, aus originaler PSSC-Bibliothek abgeleitet) und sendet PWR_ON/PLC T in einem USB-Paket. Falls nötig folgt einmalig ein geregelter Start mit `PLC_CFG 1 000E` (50 kHz) und zwei unmittelbaren USB-Paketen. Abgelehnte PLC_CFG-Befehle werden protokolliert, statt eine erfolgreiche Einstellung vorzutäuschen. Die Exportdatei enthält im Feld `startupTrials` beide Versuche und alle Rohantworten.

Die Werte ändern nur die SSP3-Pin-Signalgeschwindigkeit. Sie legen weder die DUT-VDD-Spannung noch die interne SVDD-Brückenspannung oder NVM-Inhalte fest. Bei unbekannter Firmware bleiben die Host-Geschwindigkeitsparameter unverändert. Das Ergebnis ist am echten Prüfstand noch nicht bestätigt.

## Einmaliger Wiederholungstest für Jürg (v0.6.37)

Am bekannten, isolierten SSP3-Prüfplatz zuerst im **Windows Geräte-Manager** unter **Anschlüsse (COM & LPT) → USB Serial Port → Eigenschaften → Anschlusseinstellungen → Erweitert** den FTDI-Latency-Timer prüfen (Elmos-Empfehlung: 1 ms; USB Transfer Sizes je 512). Nach der Anpassung den Port neu verbinden.

Dann die **Web-App v0.6.37** laden, in der klassischen Ansicht **USB & Chip** den Adapter **ELMOS SSP3 Evaluation Board · Standard** und die Schnittstelle **1-Wire · AODO (Standard)** verwenden und auf **Bekannten Port verbinden** klicken. Die Software versucht bei fehlender Chipantwort höchstens zweimal, die One-Wire-Initialisierung abzuschliessen: zuerst mit einem gemeinsamen USB-Paket für `PWR_ON + PLC T`, dann gegebenenfalls mit dem alten Zweipaketverfahren. Sind beide erfolglos, schliessen sich automatisch nur lesende Diagnoseabfragen an. Es ist kein weiteres manuelles Ein-/Ausstecken erforderlich.

Für den Export: oben auf **Einstellungen** gehen, **Expertenparameter freischalten** aktivieren, zur **Klassischen Ansicht** und zu **USB & Chip** wechseln, im Abschnitt **SSP3-Verbindungsdiagnose · 1-Wire** auf **Web-App-SSP3-Protokoll exportieren** klicken und die heruntergeladene JSON-Datei senden. Das Feld `startupTrials` enthält beide Varianten. Keine automatische EEPROM-Programmierung; physische Versorgung und AODO-Ausgang sind während eines kontrollierten Power-Cycles zu beachten.

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

## Experimenteller PLC-Syntaxvergleich für SSP3-Firmware v02.08.02.04 (v0.6.17, 12.11.2026)

Das reale SSP3-Log belegt einen bestätigten Host-Handshake für `PWR_OFF 03E8` (15 ms), `PLC P` (18 ms), `PWR_ON 0C80 00C8 0` (15 ms) und `PLC T` (16 ms). **Ein Chipregister konnte danach noch nicht gelesen werden.** Der Schluss, die Stromversorgung sei elektrisch tatsächlich ein- und ausgeschaltet worden, ist allein aus der Hostbestätigung nicht beweisbar. Die aktuelle Originalsoftware-PLC-Startsequenz ist weiterhin nicht mitgeschnitten.

Neu ist ein konkreter möglicher Syntaxunterschied: **Elmos AN 0204** dokumentiert `PLC 026D1C0C.` als zusammenhängendes Hostargument, die vom vorhandenen SSP3 selbst ausgegebene `?`-Hilfe nennt dagegen `PLC <slave_id> <data>`. Deshalb bietet **USB & Chip → SSP3-Sensorstart → PLC-Befehlsformat** die beiden Testvarianten:

- **AN0204 / Legacy (Standard):** `PLC 026D1C0C.`
- **SSP3-Firmwarehilfe / Slave-ID separat:** `PLC 02 6D1C0C.`

Die jeweils gewählte Hostformatierung wird nach dem ausdrücklich freigegebenen, einmaligen Versorgungstest auf die **erste reine Registerabfrage** angewendet. Erhält die App gültige Registerdaten, wird das Format für die restliche Sitzung beibehalten; auch spätere PLC-Schreibtelegramme werden dann entsprechend formatiert, aber erst nach unveränderten NVM-/RAM-Sicherheitsprüfungen. Die One-Wire-Chipdaten und CRC-Felder werden **nicht** geändert, nur das Leerzeichen im SSP3-ASCII-Kommando. Keine NVM-Programmierung beim Test. Der Vergleich klärt eine echte Firmwareabweichung, garantiert aber keine Freigabe bei 4-ms-Startfenster. Pro Durchlauf nur **eine** Variante versuchen und anschliessend das JSON-Log exportieren.

## Startfenster im NVM beibehalten · Diagnose verborgen (v0.6.18)

Ein E703.11 kann nach jedem Einschalten ein One-Wire-Zeitfenster von 4, 10 oder 200 ms auf AODO öffnen. Danach erscheint der konfigurierte Analogausgang. Die im NVM vorhandene `CFG_PADS0.startup_plc`-Einstellung (CM-Wort 18) wird bei jeder normalen Kalibrier-NVM-Programmierung **bitgenau beibehalten**, ebenso `CFG_SPI_I2C` (CM-Wort 17) und `CFG_PADS1` (CM-Wort 19). Die App programmiert diese geschützten Interface-/Bootregister nicht automatisch um.

Das Datenblatt 25DS0170E.04 §§6.4.5.7–8 erlaubt einen Magic-Cookie-basierten Start auch mit im NVM deaktivierten `plc_us_en` und `plc_rw_en`, sofern ein zeitlich begrenztes Fenster vorhanden ist. Der alte Startschutz verwechselte dies mit vollständig deaktiviertem One Wire. Die neue Prüfung akzeptiert diesen Zustand **nur dann für dauerhaftes Kalibrier-NVM-Schreiben**, wenn die schaltbare SSP3-Versorgung, die anschliessende One-Wire-Lesung und die **gleiche Chip-UID** in dieser Sitzung bestätigt sind. Ohne diesen Nachweis bleiben NVM-Programmierung und Boot-Änderungen gesperrt.

Die zusätzlichen SSP3-Fehlersuchwerkzeuge bleiben technisch vorhanden, sind aber im normalen Arbeitsablauf ausgeblendet. Sie lassen sich über **⚙ Einstellungen → Expertenparameter freischalten → USB & Chip** erneut öffnen. Der EEPROM-Viewer und die normalen Kalibrierfunktionen bleiben unverändert.

**Wichtig:** Das Update schreibt selbst nichts in den Sensor. Das Startfenster bleibt genau so lange aktiv, wie es im Original-NVM eingestellt ist, und wird nach jedem Kaltstart neu geöffnet. Eine erfolgreiche echte NVM-Programmierung mit dieser Änderung ist noch nicht hardwaregetestet.

### Normaler SSP3-Verbindungsaufbau wiederhergestellt (v0.6.20, 12.11.2026)

**Ursache der wiederkehrenden PLC-Fehlermeldung:** Die App stellte beim Öffnen eines USB-Ports das PLC-Hostformat stets erneut auf den früheren Wert `legacy`. Die reale SSP3-Firmware `@02 08 02 04` veröffentlicht jedoch `PLC <slave_id> <data>`, also getrennte Hostparameter; der zuvor erfolgreiche Test nutzte `PLC 02 6D1C0C.`. Die Web-App liest jetzt die echte Versionsantwort aus und stellt **ausschliesslich für diese bestätigte Firmware** das `separate`-Format automatisch ein. Die alte Variante bleibt für andere Firmwareversionen verfügbar.

In der **normalen Verbindungskarte** steht nun eine kompakte Opt-in-Einstellung **«Sensor beim Verbinden automatisch über SSP3 starten (One Wire)»**. Diese darf nur aktiviert werden, wenn das Prüfmuster tatsächlich von der schaltbaren SSP3-VSUPPLY versorgt wird. Die explizite Zustimmung wird in diesem Browser gespeichert und kann durch Abwählen widerrufen werden. Nach dem nächsten Verbinden führt die App denselben abgesicherten Ablauf wie der zuvor manuell gestartete AN0204-Prüfplatztest aus (`?`, `PWR_OFF`, `PLC P`, `PWR_ON`, `PLC T`, Chiperkennung). Sie prüft den tatsächlichen Registerzugriff und die Chip-UID. Die Versorgung wird **nicht** ohne Opt-in automatisch geschaltet. Bei unbekannter Power-Firmware oder unbestätigtem `PWR_OFF` wird vor der Abschaltung abgebrochen.

Die zuletzt hinterlegte 4/10/200-ms-Startup-Einstellung bleibt im Sensor-NVM unverändert und öffnet sich nach jedem Kaltstart wieder. Eine erfolgreiche Versorgungsschaltung und NVM-Sicherheit müssen vor der NVM-Programmierung weiterhin geprüft werden; ein echter Test der neuen Startautomatik steht noch aus. Zusatzdiagnosen bleiben hinter «Expertenparameter freischalten» verborgen.

### Standard: automatischer One-Wire-Start (v0.6.20)

Für den bestehenden, über SSP3-VSUPPLY versorgten Prüfsensor unter **USB & Chip** nur **SSP3** und **1-Wire (AODO)** auswählen und verbinden. Die App startet die SSP3-DUT-Versorgung automatisch neu, aktiviert die gepufferte PLC-Freigabe und liest danach die Sensorregister. Die separate Start-Checkbox wurde entfernt. Bei **I²C**, **SPI** oder **ESP32-Bridge** führt die App keine SSP3-VSUPPLY-Sequenz aus.

Die SSP3-Firmware `02.08.02.04` erwartet das kompakte Host-Telegramm `PLC 026D1C0C.`; das zwischen `02` und `6D...` getrennte Format wird laut Hardwaretest mit `frame contains invalid data ( )` zurückgewiesen. Die ursprüngliche NVM-One-Wire-Startzeit und die Bootregister bleiben unverändert.

**Vorsicht:** Diese Betriebsart setzt eine tatsächlich über schaltbare SSP3-VSUPPLY gespeiste Testschaltung voraus. Bei unabhängiger Versorgung oder kritischen Anwendungen ist der automatische Stromunterbruch ungeeignet.

### v0.6.21 – schneller SSP3-PLC-Start bei 4-ms-Fenster (12.11.2026)

Das bisherige Hostprotokoll wartete zwischen `PWR_ON 0C80 00C8 0` und `PLC T` auf eine komplette USB-Antwort. Frühere reale Logs zeigten dabei rund **15 ms**, was das beim E703.11 auf **4 ms** programmierte Startfenster bereits überschreitet. Die Elmos AN 0204 §2.3.4 dokumentiert, dass `PLC P` den Cookie-Frame vorbereitet und `PLC T` den Puffer überträgt. Das Datenblatt 25DS0170E.04 §6.4.5.8 verlangt, dass die Cookie-Sequenz vollständig während des Startfensters übertragen wird.

Für den **normalen SSP3 + 1-Wire**-Verbindungsaufbau bleibt daher die dokumentierte Reihenfolge `IF_CFG 7 0 0`, `PWR_OFF 03E8`, `PLC P` erhalten. Neu werden `PWR_ON 0C80 00C8 0\rPLC T\r` **ohne USB-Antwort-Wartezeit in einer einzigen seriellen Schreiboperation** an die SSP3-Firmware übermittelt. Die Software erwartet anschliessend **zwei getrennte Firmware-Prompts**, prüft die Quittung beider Kommandos und liest erst danach die E703.11-Register. Bei Fehlern wird die bisherige Strom-Wiederherstellungsroutine angewendet. Es werden **keine NVM-Werte verändert** und keine undokumentierten Sensorbefehle gesendet.

**Hardwarevorbehalt:** Die SSP3-Firmware muss mehrere CR-getrennte Befehle in einer USB-Schreiboperation korrekt puffern und verarbeiten; dies ist aus AN 0204 nicht ausdrücklich garantiert. Ein erfolgreicher Hardwaretest steht noch aus. Auch mit schnellerem Hostversand kann insbesondere bei 4 ms das zeitliche Verhalten der SSP3-Firmware oder die PLC-Bitrate weiterhin einen Zugriff verhindern. Dann sind die tatsächlichen SSP3-Antworten auszuwerten und nötigenfalls die PLC_CFG-Einstellungen beziehungsweise ein Original-PSSC-Trace zu vergleichen.

### v0.6.22 – SSP3-Power-Start: einzelne serielle Befehle ohne Wartepause (12.11.2026)

Der reale SSP3 mit Firmware `02.08.02.04` hat den v0.6.21-Versuch `PWR_ON 0C80 00C8 0\rPLC T\r` in einem einzelnen Web-Serial-Write nicht mit beiden Prompts beantwortet. Ein kombinierter USB-Write ist damit **nicht als unterstützt bestätigt**. In v0.6.22 werden die beiden CR-terminierten SSP3-Kommandos als **zwei separate `writer.write()`-Aufrufe** in derselben seriellen Writer-Sitzung übertragen, aber ohne zwischenzeitliches Warten auf die `PWR_ON`-Antwort. Erst danach werden zwei SSP3-Prompts sowie die Echozeilen `#PWR_ON` und `#PLC T` überprüft. Die Übertragungsdauer der beiden Writes wird gemessen.

Bei einem Timeout wird die **tatsächlich bis dahin empfangene Teilantwort**, die Zahl der Prompts und gegebenenfalls ein Schreibfehler im Feld `powerCycle` des exportierten JSON-Logs gesichert. Aus einem einzigen Prompt darf die App nicht auf eine erfolgreiche PLC-Freigabe schliessen. Die bestehende VSUPPLY-Wiederherstellung nach Fehlschlag bleibt bestehen. Kein NVM-Schreiben, keine Änderung von `CFG_PADS0.startup_plc` oder der geschützten Interface-Konfiguration.

**Einschränkung:** Auch zwei unmittelbar aufeinanderfolgende Web-Serial-Schreibaufrufe können für ein 4-ms-Startfenster zu langsam sein, je nach Betriebssystem und SSP3-Firmware. Ein tatsächlicher Zeitnachweis ist erst mit dem SSP3-Hardwaretest möglich. Bleibt die Übertragung unzuverlässig, ist eine adapterseitige Sequenzierung oder ein Original-PSSC-Protokollvergleich erforderlich, statt weitere blinde Timing-Versuche zu senden.

### v0.6.23 – SSP3-Antwortparser akzeptiert verkettete Prompt-/Echo-Fragmente (12.11.2026)

**Echter SSP3-Hardwarebefund mit v0.6.22:** Zwei getrennte Web-Serial-Schreibaufrufe für `PWR_ON 0C80 00C8 0` und `PLC T` wurden beide vom SSP3 quittiert. Der empfangene Text enthält jedoch `#PWR_ON 0c80 00c8 0000 :#PLC T :` – die Firmware schreibt den Doppelpunkt-Prompt direkt vor das nächste Kommandoecho, ohne zwingend einen zusätzlichen Zeilenumbruch. Der bisherige `ssp3PromptCount()` zählte nur einen Doppelpunkt auf einer eigenen Zeile und lieferte deshalb falsch **1/2**; auch die Echo-Prüfung für `#PLC T` war zu streng.

In v0.6.23 erkennt der Parser `:` vor dem folgenden `#`-Kommandoecho oder am Antwortende auch ohne CR/LF. `PWR_ON` und `PLC T` werden getrennt als Echo nach Start/Prompt-Grenze verifiziert, ohne auf einen Zeilenbeginn beschränkt zu sein. Der Sender bleibt identisch: zwei serielle Writes direkt nacheinander, dann zwei SSP3-Quittungen auswerten und erst danach echte E703.11-Register lesen. Keine Änderung an Versorgungskommandos, PLC-Telegramm, Konfigurationsmemory/NVM oder Bootstartfenster.

**Noch nicht bewiesen:** Dass der E703.11 den PLC-Cookie innerhalb seines konfigurierten Fensters empfangen hat. Die neue Prüfung beseitigt ausschliesslich einen Hostparser-Fehler und lässt den Chipzugriff erstmals nach diesem Burst wieder testen. Hardwareergebnis des nachfolgenden Registerlesens muss separat geprüft werden.

### v0.6.24 – Automatischer Magic-Cookie-Fallback nach SSP3-Start (12.11.2026)

Der echte E703.11 liess sich nach Angaben aus dem Prüfversuch über den separaten Magic-Cookie-Test erreichen, während der normale SSP3-Power-Start mit `PLC P`/`PLC T` und anschliessender Lesung nur `!PLC nothing received` lieferte. Daher wird **bei SSP3 + One Wire automatisch genau einmal** folgender, bereits manuell erprobter Fallback verwendet, **nur wenn der erste PLC-Register-Lesezugriff keine Chipantwort erhält**:

1. Bestehender dokumentierter Power-Start: `PWR_OFF 03E8` → `PLC P` → `PWR_ON 0C80 00C8 0` und `PLC T` schnell hintereinander.
2. Erste reine Register-Lesung. Wenn gültig, ist keine zusätzliche Magic Cookie nötig.
3. Ausschliesslich bei `!PLC nothing received` zwei spezielle CRC-geschützte PLC-Writes: `PLC 026CAC0F2B4299` (0xAC→0x2B42) und direkt danach `PLC 026C0E095CFDCA` (0x0E→0x5CFD).
4. Erneut echten E703.11-Registerzugriff lesen und erst dann die Verbindung/Chip-UID als erfolgreich markieren.

Die zwei Schreibtelegramme sind nach E703.11-Datenblatt §6.4.5.7 eine **flüchtige RAM-/One-Wire-Freigabe**, keine NVM- oder Factory-Programmierung. Jeder Schritt und die tatsächliche Leseantwort werden im SSP3-JSON-Protokoll erfasst. Bei Zeitüberschreitung, anderer Chip-Fehlermeldung oder ungültigen AFE-Daten erfolgt **kein** stillschweigender Wiederholungsversuch und kein NVM-Schreiben. Der normale Kalibrierweg und die geschützten Startregister in NVM 17, 18 und 19 bleiben unverändert. Bei einem erfolgreichen Fallback wird die SSP3-Power-Startverifikation auf die aktuelle UID bezogen, damit der vorhandene NVM-Schutz weiter funktioniert.

**Hardwarevorbehalt:** Ob dieser Fallback automatisch funktioniert, ist noch nicht bestätigt. Bei sehr kurzen NVM-Startfenstern kann das zusätzliche Senden nach einem ersten fehlgeschlagenen Lesen bereits zu spät sein. Der Befund des manuellen Tests macht diesen Versuch aber gegenüber weiteren undokumentierten SSP3-Kommandos sinnvoll.

### v0.6.25 – Live-ADC nach Magic-Cookie-Erkennung stabilisiert (12.11.2026)

Der Nutzer bestätigt, dass sich der Chip mit dem automatischen SSP3-Magic-Cookie-Verbindungsablauf von v0.6.24 erkennen lässt, aber anschliessend die Live-Werte fehlen. **Codeanalyse:** Der alte `readADC()`-Pfad fragte zuerst `ADC_TC (0x26)`, dann `ADC_T (0x28)` und erst zuletzt `ADC_S (0x2A)` ab. Wenn ein Temperaturregister keinen PLC-Frame liefert, blieb **auch ADC_S leer**, selbst bei funktionierender Druckkommunikation; nach nur drei Fehlern stoppte die Endlosschleife.

**Änderungen:** Die Chiperkennung liest AFE und ADC_S, übernimmt den bereits bestätigten Druck-Rohwert sofort in die Anzeige und versucht weitere Live-Register unabhängig. Der **Live-Pfad** liest ADC_S als Erstes und behandelt fehlende ADC_T-/ADC_TC-/DSP_S-Antworten einzeln; nicht gelesene Werte werden als nicht verfügbar markiert, nie erfunden. Der **strenge Kalibrierpfad** behält die vollständige Messpunktaufnahme von ADC_S, ADC_T und ADC_TC und die bestehenden Schreiben-/NVM-Sicherheitsprüfungen. Die kontinuierliche Live-Schleife beginnt beim automatischen SSP3-Start erst, nachdem die Magic-Cookie-/Power-Start-Verifikation beendet ist. Vorübergehende ADC_S-Ausfälle werden mit begrenzter Wiederholung (bis 10 aufeinanderfolgende Fehler, danach Stop mit klarer Fehlermeldung) behandelt, ohne zusätzliche Power-Cycles oder RAM-/NVM-Schreibbefehle.

Die Änderung behebt die UI- und Abbruchabhängigkeit vom Temperaturregister. **Ob tatsächlich alle ADC-/DSP-Register über die Hardware erreichbar sind, ist noch nicht bestätigt**; wenn gerade ADC_S selbst nicht antwortet, liefert die App nun eine gezielte Diagnosemeldung statt stillschweigend leerer Werte.

### v0.6.26 – Kontinuierliche Live-Messung ohne Blockierung durch weitere Sensorregister (12.11.2026)

Nach dem automatischen Magic-Cookie-Start liefert der Sensor beim Seitenaufbau einen initialen Wert, aber gemäss Hardwarefeedback bisher keine laufenden Live-Aktualisierungen. Die bis v0.6.25 verwendete Live-Abfrage versuchte bei jedem Zyklus **ADC_S, ADC_T, ADC_TC und DSP_S nacheinander**; jeder fehlende Registerzugriff konnte einen Timeout auslösen und die nächsten Druckwerte deutlich verzögern. Nach zehn fehlgeschlagenen ADC_S-Lesungen wurde die Live-Schleife vollständig gestoppt.

Die neue `readLiveSample()` liest in **jedem Zyklus zuerst ADC_S (Register 0x2A)** und ruft sofort `updateADC` auf, damit Anzeige, Verlauf und geführter Abgleich regelmässig neue Druckwerte erhalten. Die sekundären Register werden rotierend abgefragt: Zyklus 1 ADC_T (0x28), Zyklus 2 ADC_TC (0x26), Zyklus 3 DSP_S (0x30), Zyklus 4 nur ADC_S. Misslingt ein Sekundärregister, wird **ausschliesslich dieser Wert** als nicht verfügbar protokolliert; ADC_S bleibt unabhängig. Sekundärabfragen sind zeitlich auf 1100 ms begrenzt, ADC_S auf 1600 ms. Zwischen erfolgreichen Zyklen liegen nominell 650 ms plus die tatsächliche SSP3-Kommunikationszeit.

Bei nicht beantworteten ADC_S-Abfragen bleibt die Live-Schleife trotz mehrerer Aussetzer aktiv (erneute Abfrage alle 2 s), **zeigt aber keine erfundenen oder künstlich aktualisierten Messwerte**. Der Status weist auf die fehlenden aktuellen ADC-Daten hin und protokolliert die Anzahl aufeinanderfolgender Leseprobleme. Strenge Kalibrier-Messpunktaufnahmen bleiben wie zuvor auf vollständige Druck-/Temperaturantworten angewiesen; NVM, Startfenster und der bestätigte Magic-Cookie-Verbindungsablauf werden nicht verändert.

**Hardwarevorbehalt:** Bei anhaltendem `!PLC nothing received` auf ADC_S nach dem Startup handelt es sich möglicherweise um eine nicht dauerhaft aktivierte 1-Wire-RAM-Freigabe. Dies kann die Software nicht durch häufigeres Lesen beheben; das neue Verhalten und das USB-Log machen diesen Sachverhalt überprüfbar. Echte Live-Aktualisierung ist erst nach einem erneuten SSP3-Test bestätigt.

### v0.6.27 – RAM-Status der dauerhaften One-Wire-Freigabe prüfen (12.11.2026)

Die Live-Abfrage bleibt wie in v0.6.26 auf einen aktuellen **ADC_S-Wert in jedem Zyklus** fokussiert; Temperatur und DSP werden zeitlich verteilt gelesen. Zusätzlich prüft die App nach dem erfolgreich erkannten E703.11 **einmalig und nur lesend** Register `CFG_SPI_I2C (0x06)`, Bit `plc_en` (Bit 2). Gemäss E703.11-Datenblatt 25DS0170E.04, §6.4.5.8 aktiviert eine vollständig empfangene Magic Cookie dieses flüchtige Bit und öffnet das PLC-Fenster **bis zum nächsten Reset dauerhaft**. Wird nur während des zeitlich begrenzten NVM-Startfensters ein ADC-Wert gelesen, aber `plc_en` bleibt 0, lässt sich der Sensor später nicht zuverlässig weiter abfragen.

Die App speichert im exportierten SSP3-Protokoll `powerCycle.plcConfigRam`, `powerCycle.plcEnabledInRam` und im Fehlerfall `powerCycle.plcConfigReadError`. Sie zeigt bei **explizit gelesenem `plc_en=0`** eine Warnung statt einen uneingeschränkten Erfolg. Falls das Statusregister gar nicht lesbar ist, wird dies gesondert protokolliert und nicht als 0 interpretiert. Diese Prüfung schreibt **keinerlei NVM- oder RAM-Register** und verändert weder den bestätigten Verbindungsablauf noch die Schutzlogik der Kalibrierung.

**Hardwaretest ausstehend:** Nur die reale SSP3-Antwort kann bestätigen, ob eine dauerhaft aktive One-Wire-Schnittstelle vorliegt. Wenn die Verbindung zwar einen Wert, aber kein `plc_en=1` liefert, muss die Cookie-Sequenz **während des Startupfensters vor dem ersten Lesezugriff** zuverlässig im SSP3/Chip ankommen. Wiederholtes Registerlesen oder bloss schnelleres Browser-Polling behebt das nicht.

### v0.6.29 – Statische ADC-Werte trotz erfolgreichem SSP3-One-Wire-Lesen

Echter UI-Befund: `ADC 101/101`, aber unveränderte ADC/DSP-Werte bis zum nächsten F5-Neustart. Erneute erfolgreiche Registerreads bedeuten nicht, dass der Chip neue Messungen erzeugt. Das Datenblatt nennt `CFG_PERIOD 0x0E`: 0 = keine Messung, 1 = kontinuierlich, 2 = eine Messung nach CMD.start, Werte ab 3 = periodisch. Beim Einschalten erfolgt laut §6.7.1 ein CMD.start; bei Einzelmessungsmodus folgt deshalb exakt ein frischer Wert.

Die App liest `CFG_PERIOD` und `STATUS (0x36)` nach dem erfolgreichen SSP3-Boot nur lesend. **Nur bei nachgewiesenem `CFG_PERIOD=0x0002`** wird im normalen SSP3-One-Wire-Live-Zyklus der dokumentierte `CMD.start` an Register `0x22` mit Wert `0x8B93` gesendet, dann auf `STATUS.adc_s_up` (Bit 1) gewartet und erst nach bestätigter neuer Konversion ADC_S gelesen. Dies ist ein flüchtiger Laufzeitbefehl, verändert weder die PLC-Freigabe noch das NVM oder `CFG_PERIOD`. Ein fehlender neuer ADC-Status wird als Fehler angezeigt.

Bei unbekanntem oder abweichendem `CFG_PERIOD` erfolgen **keine** zusätzlichen Schreibbefehle; bei CFG_PERIOD=0 meldet die Anzeige die deaktivierte Messung. Im SSP3-JSON-Export stehen nun Periodenmodus, STATUS, tatsächliche CMD-Starts und Zählung unterschiedlicher ADC-Werte. Der Ablauf muss noch am echten SSP3 validiert werden.

### v0.6.30 – Magic Cookie verändert CFG_PERIOD und kann die Live-Messung stoppen

Screenshot: `Manuell pausiert`, `ADC 51/51`, `CFG_PERIOD=0x5CFD`, `STATUS=idle`. Das Register CFG_PERIOD liegt bei 0x0E, der zweite dokumentierte Magic-Cookie-Schreibbefehl enthält exakt `(0x0E, 1, 0x5CFD)`; die aktuelle Web-App findet diesen Wert tatsächlich im Sensor-RAM vor. Damit ist der Registerzugriff möglich, während das Messprogramm möglicherweise im idle-Zustand bleibt. Ein Browser-F5 startet die Stromversorgung neu und liefert zunächst einen neuen Messwert.

**Gezielte Korrektur:** Wenn der SSP3-Autostart ausdrücklich die dokumentierte Magic Cookie verwendet hat, der Chip erfolgreich identifiziert wurde und das RAM-Register CFG_PERIOD exakt 0x5CFD enthält, setzt die Web-App **nur im RAM** CFG_PERIOD=0x0001 (kontinuierlich), prüft das Rücklesen von 0x0001 und sendet CMD.start=0x8B93 an Register 0x22. STATUS wird nach dem Start nochmals gelesen. Erfolg und Fehler werden im SSP3-Diagnoseexport sichtbar. Keine NVM-/CM-Programmierung, kein Eingriff in die PLC-Startup-NVM-Wörter; nach Hardware-Neustart kehrt die originale Konfiguration zurück. Die temporäre Live-Betriebsart kann eine höhere Stromaufnahme als periodischer Betrieb verursachen und ist für den aktiven Kalibrierprüfplatz gedacht.

**Bedienhinweis:** Der Screenshot zeigt ausserdem «Manuell pausiert». Die Aufnahme kann über den Button **«Live-Messung starten»** wieder aktiviert werden; eine vom Benutzer gesetzte Pause wird nicht automatisch aufgehoben. Echt-Hardwareprüfung der Korrektur steht noch aus.

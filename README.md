# ELMOS E703.11 – Web-Kalibrierassistent

**Ein geführter Kalibrierassistent für den ELMOS E703.11 und das SSP3-Eval-Board.** Ziel ist ein verständlicher Abgleich, der auch ohne tiefere Vorkenntnisse Schritt für Schritt funktioniert. Wer mehr benötigt, kann zusätzliche Messpunkte, DSP-Parameter und einen geschützten Expertenmodus verwenden.

**Version: v0.6.0 · geführter Abgleich und klassische Ansicht** · [Änderungsverlauf](CHANGELOG.md)

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Bedienungsanleitung](ANLEITUNG.md)** · **[Config-Dateien & EEPROM Viewer](CONFIG_DATEIEN.md)** · **[Ausgang & 1-Wire erklärt](AUSGANG_1WIRE.md)** · **[Testbericht und Grenzen](TESTBERICHT.md)**

> **Entwicklungsstand: Laborprototyp.** Die vollständige Kalibrierung einschliesslich dauerhafter NVM-Programmierung ist **noch nicht mit einem echten E703.11 als Gesamtablauf freigegeben**. Hardwareverhalten, AODO-Ausgangsmodi und NVM-Wiederherstellung müssen am Testchip geprüft werden. Nicht für die Serienproduktion oder unersetzliche Sensoren einsetzen.

> **Geführter Assistent:** Nach der bestätigten SSP3-Verbindung stehen die neue Schritt-für-Schritt-Führung, die klassische Ansicht und der optionale Kompaktmodus zur Verfügung. Ein E703.11-Chip muss für den Abgleich verbunden sein. Die USB-CDC-Bridge bleibt als experimenteller Verbindungstest ohne Sensorprogrammierung gesperrt.
>
> [Geführter Abgleich](docs/GEFUEHRTER_ASSISTENT.md) · [USB-Bridge](docs/USB_BRIDGE_GUIDE.md) · [ESP-Boards](docs/ESP_BOARD_OPTIONS.md) · [ESP32-C3 SuperMini Sketch](firmware/esp32c3_supermini/esp32c3_supermini.ino)

## Projektziel

- **Einfacher Einstieg:** Die App führt durch den gesamten Ablauf und sperrt Schritte, deren Voraussetzungen fehlen.
- **Direktes Feedback:** Wichtige Sensorwerte sind oben in allen Schritten sichtbar; AFE-Änderungen zeigen ihre Wirkung unmittelbar.
- **Erweiterbar:** Zusätzliche Kalibrier- und Prüfpunkte, DSP-Ausgangsspanne und Expertenparameter für anspruchsvollere Abgleiche.
- **Schutz der Werksdaten:** Factory-Kalibrierung bleibt lesbar, aber nicht frei editierbar. Permanente Änderungen werden vor dem Schreiben kontrolliert.

## Funktionen

| Bereich | Aktueller Stand |
| --- | --- |
| Kompaktmodus / One-Pager | **Opt-in unter Einstellungen:** Verbindung, AFE-RAM-Stufen, Config-Vorlagen, Messpunkte, Berechnung, DSP-Prüfung, Ausgang und geschützte NVM-Programmierung auf einer Bildschirmfläche. Originale UI-Steuerelemente und dieselben Sicherheitsprüfungen; Zusatz-Messpunkte per Punktauswahl, Detailinformationen eingeklappt. Die normale siebenstufige Ansicht bleibt bei deaktiviertem Modus unverändert | 
| **Geführter Assistent** | Neue Oberfläche nach SSP3-Verbindung: Aufgabe, Druck-/Temperaturmatrix, Config-Vorlage, AFE, Messpunkte, DSP-Fit/RAM, unabhängige Verifikation, Ausgang und geschützte NVM-Programmierung. Originalfunktionen und klassische Ansicht bleiben erhalten |
| **USB-Bridge (experimentell)** | Adapterwahl für ESP32-S3/Arduino-USB-CDC vorbereitet; Beispiel-Firmware meldet sich nur als CDC und besitzt noch **keine** geprüfte PLC-Kommunikation. NVM-Schreiben für Bridge gesperrt |
| Verbindung | Browserbasiert über **Chrome / Web Serial**, FTDI / SSP3, standardmässig **1-Wire (AODO)**; I²C/SPI-Optionen |
| Live-Werte | Obere Statusleiste mit **ADC_S**, **ADC_T**, **DSP_S** und umgerechnetem Sensorwert; Live-Status und letzter Messzeitpunkt in allen sieben Schritten |
| AFE-Abgleich | Diskrete **− / +** Tasten in der Reihenfolge **PGA1 → Offset → PGA2**. Jeder Klick schreibt die neue Einstellung direkt ins **RAM** und liest sie zurück. Kein NVM-Schreiben |
| Messpunkte | **2–10 Kalibrierpunkte** (Standard 2), eigene Namen, Referenzen und Temperaturen; **1–100 Samples** pro Punkt (Standard 12), Median und Streuungsprüfung |
| Koeffizienten | Berechnung im Browser, einstellbare Polynomordnungen und symmetrischer DSP-Zielbereich **±1’000 bis ±32’000 Digits** |
| RAM & DSP | Berechnete Koeffizienten ins RAM schreiben, rücklesen und DSP_S gegen Referenz/Toleranz prüfen; **1–10 Prüfpunkte** (Standard 1) |
| NVM | Vor dem permanenten Schreiben vollständige **64-Wort-Lesung**, CRC-/Schutzprüfung und Änderungsliste; optionales Backup; 48-Bit-Chip-UID wird automatisch eingetragen und beim Schreiben geprüft |
| Ausgangskonfiguration | Eigener **Schritt 6**, PSSC-orientiert mit Digital Interface, AODO pin, Scaling, Limiting, Error Signaling und Error Values. **«One Wire only»** als bedingt wählbarer Betriebszustand mit Prüfung des Original-NVM. Nicht validierte Registeroptionen bleiben nur lesbar |
| 1-Wire-Startschutz | Vor NVM-Schreiben Prüfung von AODO-Modus 1–5, PLC-Startup, Downstream/Upstream und persistentem Registerzugriff. **One Wire only benötigt bereits plc_en=1 im Original-NVM**; der Assistent ändert keine Bootregister. Kaltstarttest weiter nötig |
| Expertenmodus | Über **⚙ Einstellungen → Expertenparameter freischalten** aktivieren. Zusätzliche, selten genutzte Einstellungen werden **direkt im passenden Reiter** eingeblendet (AFE, Ausgang, EEPROM Viewer); kein separates Fenster |
| EEPROM Viewer | **Eigenständiger Navigationstab** mit 64 NVM-/EEPROM-Wörtern, Funktionsspalte, Freitextsuche nach Registerinhalt und Bedeutung sowie aufklappbarer Registerreferenz (EEPROM-Wort-/Byteadresse, RAM-Register, Rohwert und Q3.12/Q0.15-Wert). Im Expertenmodus: bekannte Bitfelder und Formeln. Nur lesend; Backup-Export chipbezogen |
| Config-Vorlagen | **JSON speichern/laden:** AFE-Gains und Offset, DSP- und Messvorgaben, Ausgang und S0/S1. Keine Seriennummern, Werksregister, EEPROM-Abbilder oder sensorspezifischen Koeffizienten. AFE-Übernahme erst nach separatem RAM-Klick |\n| Diagnose | Register-/Chipanzeige, technisches Log und Dokumentation |

Antwortet das SSP3, aber die Chipprüfung schlägt beim ersten Versuch fehl, führt die App automatisch **genau einen** USB-Trenn-/Neuaufbau durch. Nach einem weiteren Misserfolg stoppt sie mit Warnung und lässt den SSP3-Port für die Diagnose geöffnet. Das ersetzt keinen Sensor-Power-Cycle bei einem begrenzten 1-Wire-Startfenster.

**Kompaktmodus:** Über ⚙ Einstellungen → «Kompaktmodus · One-Pager» einschalten. Rechts oben «Normalansicht» schaltet zurück; die Auswahl wird im Browser gespeichert. Auf ausreichend grossen Desktop-Bildschirmen werden alle Hauptschritte ohne Seitenwechsel nebeneinander gezeigt. Bei kleineren Auflösungen oder vielen Details können einzelne Karten intern scrollen. Sämtliche Eingaben, Kalibrier- und NVM-Schutzabläufe bleiben unverändert; nicht benötigte Langtexte sind gekürzt oder aufklappbar. Für selten verwendete Experten- und Diagnosefunktionen steht weiterhin die vollständige Normalansicht zur Verfügung.

Für Entwickler gibt es **49 Software-Regressionstests** (Stand v0.6.0) mit Node.js: `node --test tests/safety.test.cjs`. Geprüft werden Boot-/Kommunikationsschutz, One Wire only, S0/S1-Skalierung, die sieben Kalibrierschritte, der separate EEPROM-Reiter, das Einblenden der Expertenparameter und der sichere Config-Import/-Export. Die Tests ersetzen keine Browser- und Hardwareprüfung.

Die Browser-App verwendet eine **eigene JavaScript-Koeffizientenberechnung**, nicht die originale Elmos-Kalibrier-DLL. Eine Übereinstimmung mit der Herstellersoftware muss auf der Zielhardware verifiziert werden.

## Geführter Kalibrierablauf

1. **Verbinden:** SSP3 auswählen, Chip erkennen und Live-Werte kontrollieren.
2. **AFE optimieren:** PGA1, Offset, PGA2 mit **− / +** einstellen. Jede Änderung wird sofort im Chip-RAM übernommen und mit ADC_S kontrolliert.
3. **Messpunkte aufnehmen:** Anzahl (2–10), Samples (1–100), Referenzbereich, Einheit und Namen festlegen; alle gewählten Punkte erfassen.
4. **Berechnen & RAM:** Koeffizienten sowie DSP-Endwert wählen, berechnen und ins RAM übertragen.
5. **DSP prüfen:** Kalibrierten Ausgang live ansehen und gewählte Prüfpunkte mit Toleranz kontrollieren. **Ein einzelner Prüfpunkt bestätigt nicht die gesamte Kennlinie.**
6. **Ausgang konfigurieren:** AODO-Ausgang wählen (inklusive **«One Wire only»**, wenn permanentes 1-Wire bereits im Chip-NVM vorliegt). Bei Analog Ratiometric PSSC-ähnliche S0/S1-Zielspannungen einstellen; für eine neue Kalibrierung wird der tatsächliche **DSP-Endwert (z. B. ±25’000)** automatisch aus «Berechnen & RAM» übernommen und Gain/Offset passend berechnet. Der separate ADC_S-Arbeitsbereich ±25’000 beeinflusst das Ausgangs-Scaling nicht. Erweiterten Gain/Offset nur bei Bedarf manuell bearbeiten. Für bestehende Sensoren ist das separate Auslesen des Original-NVM direkt hier möglich. Das NVM-Schreiben bleibt bis zur 1-Wire-Verbindung gesperrt.
7. **NVM speichern:** **«NVM lesen & Änderungen prüfen»** erstellt den Änderungsplan. Die **12-stellige Chip-UID wird automatisch ausgefüllt**, ist editierbar und muss vor dem Schreiben mit dem Chip übereinstimmen. Der finale Knopf startet nach den Schutzprüfungen die dauerhafte Programmierung. Das alte NVM wird auf Wunsch unmittelbar davor automatisch gesichert und als JSON exportiert.

**Reihenfolge:** Messwerte → Berechnung → RAM → DSP-Prüfung → **erst dann NVM**. Für die reine AFE-Optimierung sind keine permanenten Schreibvorgänge erforderlich.

## Config-Vorlagen und EEPROM Viewer

**Config laden und speichern** ist direkt unter **USB & Chip → Config-Vorlagen** verfügbar. Eine Config enthält die wiederverwendbaren AFE-/DSP-/Mess- und Ausgangsvorgaben, aber **keine** Chip-ID, Factory-Daten, NVM-Wörter oder spezifischen Polynomkoeffizienten. Nach dem Import wird zuerst nur eine Vorschau angezeigt. Mit «Geladene Config übernehmen» gelangen die Werte in die Eingabefelder; **erst der separate Knopf im AFE-Reiter** schreibt die vorgemerkten AFE-Gains und den Offset ins RAM und prüft den Rücklesewert. Die Druckkalibrierung muss pro Sensor erneut ausgeführt werden.

**[Beispiel-Config für 0–10 bar](examples/Beispiel_0-10bar.json)** · **[Details zu Format, Import und Sicherheit](CONFIG_DATEIEN.md)**

Der **EEPROM Viewer** ist ein eigener, jederzeit erreichbarer Navigationstab **zusätzlich zu den sieben Kalibrierschritten**. Die 64 NVM-Wörter werden über den bestehenden CRC-geprüften Leseweg angezeigt; eine Tabelle enthält die PSSC-ähnlichen Spalten Adresse (Wortindex), Bitfield, Data Hex, Data und Schutzstatus. Suche und vollständiger chipgebundener EEPROM-Backup-Export sind möglich. Die Tabelle enthält **keinen Editor und keinen direkten EEPROM-Schreibbefehl**.

## Einstellungen und Expertenfunktionen

Das **Zahnrad oben rechts** öffnet die App-Einstellungen. Mit «Expertenparameter freischalten» werden selten gebrauchte Felder **direkt dort eingeblendet, wo sie hingehören**. Es gibt **kein Experten-Popup**:

- **AFE optimieren:** zusätzliche Anzeigeeinstellungen für bereits kalibrierte Sensoren.
- **Ausgang konfigurieren:** Digital Interface, AODO_F/O (Gain/Offset), Limiting und Error Signaling (soweit nicht validiert nur lesend).
- **EEPROM Viewer:** erweiterte Chip-/Registerdiagnose, chipbezogene Backup-Historie und geprüfte Restore-Vorbereitung.

Die normale AODO-Moduswahl, S0/S1-Skalierung, Config-Vorlagen und der EEPROM Viewer bleiben **auch ohne Expertenmodus** zugänglich. Ein- und Ausschalten ändert keine Sensorregister. Factory- und Boot-/Kommunikationswerte bleiben geschützt. Für «One Wire only» gilt weiterhin: permanenter PLC-Betrieb muss im Original-NVM bereits aktiviert sein; der Assistent programmiert keine geschützten Startup-Register. [Details zur 1-Wire-Kommunikation](AUSGANG_1WIRE.md).

**Backups:** «Altes NVM automatisch sichern» ist vor dem finalen NVM-Schreiben standardmässig aktiv, kann aber bewusst abgewählt werden. Auch ohne dauerhafte Sicherung erfolgt das vollständige Lesen/Prüfen des Original-NVM. Die EEPROM-Backups enthalten Chip-ID und NVM-Wörter und dürfen **nicht** mit den chipunabhängigen Config-Vorlagen verwechselt werden.

## Starten – ausschliesslich im Browser

Die App wird direkt über **GitHub Pages** gestartet:

**[ELMOS E703.11 – Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)**

Erforderlich sind ein geeigneter Chromium-Browser (getestet mit Chrome), ein USB-/FTDI-Anschluss und die Browserfreigabe für den seriellen Port. **Keine Installation, kein Python, kein lokaler Webserver und keine Startskripte.**

Für USB-Probleme steht die ebenfalls browserbasierte [SSP3-USB-Diagnose](usb-diagnose.html) zur Verfügung. Wenn Chrome den FTDI-Port zwar auswählen, aber nicht öffnen kann, ist dies zunächst ein **COM-/Web-Serial-Problem**, kein Nachweis für einen Fehler in der E703.11-Kommunikation. Weitere Hinweise stehen in der [Anleitung](ANLEITUNG.md).

## Test- und Sicherheitsstatus

- **Im Softwaretest geprüft:** Grundlegende UI-Funktionen, Sample- und Koeffizientenlogik, RAM-/NVM-Freigaben und simulierte SSP3-Transaktionen. Einzelheiten im [Testbericht](TESTBERICHT.md).
- **Noch offen:** Vollständiger SSP3-Hardwaretest, Vergleich der DSP-Koeffizienten mit der Originalsoftware, reale AODO-Ausgänge und ein sicherer vollständiger NVM-Schreib-/Restore-Test.
- **Niemals blind programmieren:** Ein fehlerhafter NVM-Vorgang oder Stromunterbruch kann den Sensor unbrauchbar machen. Zuerst an einem entbehrlichen Testchip prüfen.

Der aktuelle Code wird als **statische Web-App ohne Buildprozess** ausgeliefert. Frühere Syntax-, UI- und Rechentests sowie die weiterhin offenen Hardwareprüfungen sind im [Testbericht](TESTBERICHT.md) beschrieben. Die Node-Regressionstests liegen im Repository und sind manuell startbar; es gibt derzeit keine dokumentierte CI- oder Hardware-Produktionsfreigabe.

## Feedback willkommen

Die Oberfläche und der Ablauf sind noch in Entwicklung. Besonders hilfreich ist Feedback dazu, **welche Funktionen fehlen**, ob der **Abgleich auch ohne Vorkenntnisse verständlich** ist, wo die **Bedienung noch unübersichtlich** wirkt und ob die **Reihenfolge der Schritte** in der Praxis sinnvoll ist. Für komplexere Kalibrierungen und weitere Expertenparameter ist der Ausbau erst nach einer stabilen Grundstruktur vorgesehen.

## Lizenz und Hinweise

Aktuell ist **keine Open-Source-Lizenz** festgelegt. Öffentlich einsehbarer Code ist deshalb nicht automatisch zur freien Weiterverwendung lizenziert. Dieses Projekt ist **keine offizielle ELMOS-Anwendung**; Produkt- und Markennamen gehören ihren jeweiligen Inhabern. Hersteller-DLLs und proprietäre Entwicklungsdateien sind nicht Bestandteil des Repositorys.

**1-Wire-Sicherheitsgrenze:** Der Assistent verändert keine bisherigen Kommunikations-/Bootwörter im NVM. Vor permanentem Schreiben verlangt er eine tatsächlich lesbare 1-Wire-Verbindung und prüft den geplanten NVM-Inhalt. Eine hundertprozentige Hardwaregarantie gibt es ohne validierten Kaltstarttest und Hersteller-Dokumentation der relevanten Bits nicht. Vor dem Einsatz am Produktionssensor am Testchip prüfen.

## Datenblatt-Abgleich für den Ausgang (v0.3.2)

Verwendet wurde **E703.11 25DS0170E.04, Production Data vom 16.11.2023**: §6.3.2.6 (Q3.12-Ausgangsskalierung), §6.4.1.1 (nominaler DAC-Ausgang und 10–90 % VDD), §6.4.5.7–8 (1-Wire-Voraussetzungen und Startup), §6.5.1.1–2 (Konfigurationsregister), §6.5.7.2 (AODO-F/O-Register). Das Datenblatt ist ein externes Herstellerdokument und nicht im Repository enthalten.

Der Assistent erfordert für NVM-Schreibvorgänge die im Original-NVM nachweisbare PLC-Startaktivierung, Downstream- und Upstream-Kommunikation und einen persistenten Register-Lese-/Schreibzugang. Sensoren, die nur über eine kurzzeitige Magic-Cookie-Freigabe kommunizieren, werden vorsorglich nicht dauerhaft programmiert. Die App ändert keine geschützten Startup-Register, um diese Situation zu umgehen. Ein Hardware-Kaltstarttest bleibt Pflicht.

**Versions- und Cache-Hinweis:** Die Skript-Dateien (inklusive `config.js`) werden in v0.6.0 mit derselben Versionskennung wie die Web-App geladen. Für die Überprüfung im Browser gegebenenfalls mit `Ctrl + F5` neu laden.

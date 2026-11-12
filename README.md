# ELMOS E703.11 – Web-Kalibrierassistent

**Ein geführter Kalibrierassistent für den ELMOS E703.11 und das SSP3-Eval-Board.** Ziel ist ein verständlicher Abgleich, der auch ohne tiefere Vorkenntnisse Schritt für Schritt funktioniert. Wer mehr benötigt, kann zusätzliche Messpunkte, DSP-Parameter und einen geschützten Expertenmodus verwenden.

**Version: v0.6.23 · geführter Abgleich und klassische Ansicht** · [Änderungsverlauf](CHANGELOG.md)

Über **Einstellungen → Demo-Modus** lässt sich der gesamte Kalibrierablauf mit simulierten Messwerten und NVM ausprobieren.

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
| Config-Vorlagen | **JSON speichern/laden:** AFE-Gains und Offset, DSP- und Messvorgaben, Ausgang und S0/S1. Keine Seriennummern, Werksregister, EEPROM-Abbilder oder sensorspezifischen Koeffizienten. Bei enthaltenem AFE nach dem ausdrücklichen Importklick direkt ins RAM mit Rücklesung; kein EEPROM-Schreiben |\n| Diagnose | Register-/Chipanzeige, technisches Log und Dokumentation |

Antwortet das SSP3, aber der E703.11 nach der 1-Wire-Initialisierung nicht, bleibt der USB-Port jetzt **offen**. In **USB & Chip → One-Wire-Startfenster testen** startet eine maximal 12 Sekunden dauernde, abbrechbare Folge von ausschliesslich lesenden PLC-Abfragen (CFG_AFE1). Währenddessen muss nur die **Sensorversorgung VDD** physisch neu eingeschaltet werden. Ein USB-Neuaufbau des SSP3 ist kein Sensor-Power-Cycle. Bei einem 4-ms-Startfenster kann die Browserlösung ohne bestätigte hardwareseitige, synchronisierte VDD-Schaltung keinen garantierten Zugriff erreichen. Der Leseversuch ändert weder RAM noch NVM.
 
**Nur lesende CFG_AFE1-Verbindungsdiagnose:** Bei einer gezielt gestarteten Diagnose nach fehlgeschlagenem Chiptest zeigt die App automatisch **3× CFG_AFE1**, zusätzlich **CFG_AFE0/CFG_AFE2/ADC_S**, den tatsächlichen 16-Bit-Wert, **Bit 11**, PGA-/Offset-Rohcodes und die **empfangenen drei 1-Wire-Bytes inklusive CRC8-Byte**. Die Antwortdaten können unter «USB & Chip → Chipdiagnose» erneut gelesen und als **JSON** gespeichert werden. Alle Registerzugriffe dieser Diagnose sind **nur lesend**; eine fehlende Pflichtbit-1 wird **nicht** automatisch korrigiert und erteilt **keine** RAM-/NVM-Schreibfreigabe. Der CRC8-Inhalt wird vorerst nur protokolliert: Die exakte SSP3-Antwortbasis muss anhand eines bekannten Elmos-Traces bestätigt werden, bevor die Web-App «CRC gültig» melden darf.

**Kompaktmodus:** Über ⚙ Einstellungen → «Kompaktmodus · One-Pager» einschalten. Rechts oben «Normalansicht» schaltet zurück; die Auswahl wird im Browser gespeichert. Auf ausreichend grossen Desktop-Bildschirmen werden alle Hauptschritte ohne Seitenwechsel nebeneinander gezeigt. Bei kleineren Auflösungen oder vielen Details können einzelne Karten intern scrollen. Sämtliche Eingaben, Kalibrier- und NVM-Schutzabläufe bleiben unverändert; nicht benötigte Langtexte sind gekürzt oder aufklappbar. Für selten verwendete Experten- und Diagnosefunktionen steht weiterhin die vollständige Normalansicht zur Verfügung.

Für Entwickler gibt es **64 Software-Regressionstests** (Stand v0.6.23) mit Node.js: `node --test tests/safety.test.cjs`. Geprüft werden Boot-/Kommunikationsschutz, One Wire only, S0/S1-Skalierung, die sieben Kalibrierschritte, der separate EEPROM-Reiter, das Einblenden der Expertenparameter und der sichere Config-Import/-Export. Die Tests ersetzen keine Browser- und Hardwareprüfung.

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

**Config laden und speichern** unter **USB & Chip → Config-Vorlagen**: Beim **Speichern werden immer alle fünf Gruppen** (AFE, Referenz, Messung, DSP und Ausgang) in der JSON-Datei gesichert. Der Downloadname enthält automatisch erkennbare Merkmale wie **`2P_Druck_3T_Temp_0-10bar_0p5-4p5V`** und den selbst gewählten Profilnamen. **Erst beim Import** wählt man aus, welche der enthaltenen Gruppen übernommen werden. Wird AFE angehakt, werden PGA1, Offset und PGA2 nach dem ausdrücklich bestätigten Import direkt ins Sensor-RAM geschrieben und rückgelesen. Ohne AFE erfolgt kein AFE-RAM-Schreiben. **Keine** Chip-ID, Factory-Daten, NVM-Wörter oder sensorspezifische Polynomkoeffizienten werden kopiert; eine Config programmiert nie automatisch das EEPROM.

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

**Versions- und Cache-Hinweis:** Die Skript-Dateien (inklusive `config.js`) werden in v0.6.23 mit derselben Versionskennung wie die Web-App geladen. Für die Überprüfung im Browser gegebenenfalls mit `Ctrl + F5` neu laden.


### Aktueller SSP3-Verbindungsbefund (12.11.2026, v0.6.23)

In der originalen Elmos-PSSC-Software lässt sich ein Sensor mit analogem 0–5-V-Ausgang und 4-ms- oder 200-ms-PLC-Startfenster **ohne manuelle Unterbrechung der Versorgung** weiterhin programmieren. Die Web-App verwendet momentan `IF_CFG 7 0 0` und sendet dann `PLC 026D1C0C.`; SSP3 antwortet dabei mit `!PLC nothing received`. Das bedeutet: Der SSP3 verarbeitet das Hostkommando, aber es wurde **keine Sensorantwort** empfangen; es liegt weder ein verifiziertes Chip- noch ein CRC-Problem vor.

**Noch nicht gelöst:** Die unbekannte Original-SSP3-Start-/Freigabesequenz kann nicht aus dem E703.11-Datenblatt allein abgeleitet werden. PSSC könnte die DUT-Versorgung über das SSP3 neu starten, eine PLC-Magic-Cookie-Freigabe verwenden oder I²C/SPI nutzen. Eine entsprechende Funktion wird erst integriert, wenn ihre Befehle und Nebenwirkungen anhand eines echten PSSC-Protokoll-Traces geprüft wurden.

Unter **USB & Chip → SSP3-Verbindungsdiagnose** gibt es jetzt den **Export des Web-App-SSP3-Protokolls** für den Vergleich. Die ergänzende 12-s-PLC-Lesediagnose ist optional und ersetzt keinen Boot-Handshake. **Kein Sensor muss manuell abgesteckt werden, bloss weil die Web-App keine Antwort erhält.**


### Experimenteller Magic-Cookie-Test v0.6.23 (12.11.2026)

Unter **USB & Chip → SSP3-Verbindungsdiagnose → Experimentell · One-Wire-Magic-Cookie (RAM)** kann eine einzige exakt definierte E703.11-Magic-Cookie-Sequenz manuell getestet werden. Sie ist nicht Teil des automatischen Verbindungsaufbaus. Nach ausdrücklicher Warnbestätigung sendet die Web-App über den bereits geöffneten SSP3 direkt nacheinander `PLC 026CAC0F2B4299` (0xAC → 0x2B42) und `PLC 026C0E095CFDCA` (0x0E → 0x5CFD), dann versucht sie die bestehenden Register-/ADC-Abfragen. Keine NVM-Programmierung. Das PLC-Write-Format wurde gegen das Elmos-Datenblatt 25DS0170E.04 §6.4.5.6.2 geprüft (`PLC 026C6A0A67895F`). Ein SSP3-Prompt belegt die erfolgreiche Übernahme durch den Sensor **nicht**; nur echtes erfolgreiches Registerlesen bestätigt den Zugriff. Die Antwort und beide Befehle werden im USB-Protokoll exportiert.

**Sicherheitsgrenze:** Bei erkannter Cookie-Sequenz wird `CFG_PADS1.plc_rw_en` und `CFG_SPI_I2C.plc_en` flüchtig aktiviert. Damit kann der normale 0–5-V-AODO-Ausgang bis zum Sensor-Reset entfallen. Nur am nicht sicherheitskritischen Prüfplatz ausführen. Ist das Startfenster bereits abgelaufen, genügt die Sequenz nicht; ohne belegten SSP3-Sensorstart kann der Test weiterhin fehlschlagen.


**Zusätzliche einmalige Startvariante:** Vor dem USB-Verbinden im experimentellen Bereich zuerst den Warnhinweis bestätigen, dann «Einmalig beim nächsten SSP3-Verbinden vor dem ersten Registerlesen testen» anhaken. Die App sendet nach dem SSP3-Handshake und `IF_CFG` die beiden Magic-Cookie-Frames *vor* jedem Chip-Leseversuch. Die Auswahl wird sofort gelöscht und bei der nächsten Verbindung nicht ohne erneute Freigabe ausgeführt. Auch diese Variante kann ein zuvor abgelaufenes NVM-PLC-Startfenster nicht eigenständig wieder öffnen.

## SSP3-Sensorstart nach Elmos AN 0204 (v0.6.23, 12.11.2026)

Der Anwender hat die Hersteller-Application-Note AN 0204 bereitgestellt, die erstmals die zuvor unbekannten SSP3-DUT-Power-Befehle dokumentiert. Nach einer expliziten Bestätigung am isolierten Prüfplatz kann die Web-App folgenden **einmaligen Test** über schaltbare SSP3-VSUPPLY durchführen:

`IF_CFG 7 0 0` → `Power_OFF 03E8` (1000 mV Abschaltschwelle) → 30 ms Ruhe → `PLC P` (Cookie vorbereiten) → `PWR_ON 0C80 00C8 0` (Herstellerbeispiel 3200 mV, 200 µs, Einzelsocket) → unmittelbar `PLC T` → bestehende Chipregister-/ADC-Erkennung.

**Achtung:** Der Abschaltbefehl heisst laut Seite 7 **`Power_OFF`**, während der Einschaltbefehl **`PWR_ON`** heisst. Bei Fehlschlag nach einem begonnenen Ausschalten versucht die App dokumentiertes `PWR_ON 0 0 0` zur Wiederherstellung. Im Log stehen die Antworten und Laufzeiten jeder Stufe.

Aufruf: **USB & Chip → SSP3-Verbindungsdiagnose → Neu · SSP3-Sensorstart (AN 0204, Prüfplatz)**. Alternativ gibt es eine einmalige Opt-in-Option beim nächsten Connect **vor dem ersten Registerlesen**. Die Originalsoftware-Sequenz ist mangels Mitschnitt weiterhin nicht 1:1 belegt; insbesondere ein 4-ms-Startfenster ist durch Browser-/USB-Latenzen nicht garantiert. Nur bei über SSP3-VSUPPLY versorgtem Prüfsensor verwenden; externes VDD wird eventuell nicht geschaltet. Keine NVM-Programmierung, aber temporäre Überlagerung des analogen AODO-Ausgangs ist möglich.


### Firmwareabweichung SSP3 / AN0204 (v0.6.23, 12.11.2026)

**Echter SSP3-Test:** Das dokumentierte `Power_OFF 03E8` wurde von der vorhandenen SSP3-Firmware ausdrücklich als `Unknown command (POWER_OFF)` abgewiesen. Der Notfallbefehl `PWR_ON 0 0 0` wurde dagegen bestätigt. Die PLC-Pufferbefehle `PLC P` und `PLC T` wurden deshalb im letzten Test noch überhaupt nicht ausgeführt; es gab keinen nachgewiesenen Sensor-Power-Cycle.

Die v0.6.23 erlaubt die **rein lesende Firmware-Befehlsauskunft mit `?`** im SSP3-Diagnosebereich. Die vollständige Antwort wird angezeigt und exportiert. Der experimentelle Power-Starttest liest die Hilfe vor dem ersten Ausschaltversuch selbständig und läuft nur weiter, wenn diese konkrete Firmware ausdrücklich `PWR_OFF` aufführt. Nur dann wird mit bestätigter Prüfplatzfreigabe das alternative `PWR_OFF 03E8` gesendet und anschliessend `PLC P`, `PWR_ON 0C80 00C8 0`, `PLC T` und der echte Chip-Lesetest. Fehlt der Befehl, stoppt der Test **ohne** Ausschaltbefehl; bei begonnener Abschaltung wird nach Fehler ein `PWR_ON 0 0 0` zur Wiederherstellung versucht. Diese PWR_OFF-Schreibweise ist eine **bedingte, noch nicht an Hardware bestätigte Abweichung von AN0204**, nicht als dokumentiert ausgegeben.

Die originale PSSC-Firmwaresequenz bleibt bis zum Vergleich eines PSSC-Traces unbewiesen. Die Bereitstellung von `?` allein ist noch keine Bestätigung, dass die betreffende Firmware eine unterbrechbare SSP3-VSUPPLY unterstützt.

## Experimenteller PLC-Syntaxvergleich für SSP3-Firmware v02.08.02.04 (v0.6.23, 12.11.2026)

Das reale SSP3-Log belegt einen bestätigten Host-Handshake für `PWR_OFF 03E8` (15 ms), `PLC P` (18 ms), `PWR_ON 0C80 00C8 0` (15 ms) und `PLC T` (16 ms). **Ein Chipregister konnte danach noch nicht gelesen werden.** Der Schluss, die Stromversorgung sei elektrisch tatsächlich ein- und ausgeschaltet worden, ist allein aus der Hostbestätigung nicht beweisbar. Die aktuelle Originalsoftware-PLC-Startsequenz ist weiterhin nicht mitgeschnitten.

Neu ist ein konkreter möglicher Syntaxunterschied: **Elmos AN 0204** dokumentiert `PLC 026D1C0C.` als zusammenhängendes Hostargument, die vom vorhandenen SSP3 selbst ausgegebene `?`-Hilfe nennt dagegen `PLC <slave_id> <data>`. Deshalb bietet **USB & Chip → SSP3-Sensorstart → PLC-Befehlsformat** die beiden Testvarianten:

- **AN0204 / Legacy (Standard):** `PLC 026D1C0C.`
- **SSP3-Firmwarehilfe / Slave-ID separat:** `PLC 02 6D1C0C.`

Die jeweils gewählte Hostformatierung wird nach dem ausdrücklich freigegebenen, einmaligen Versorgungstest auf die **erste reine Registerabfrage** angewendet. Erhält die App gültige Registerdaten, wird das Format für die restliche Sitzung beibehalten; auch spätere PLC-Schreibtelegramme werden dann entsprechend formatiert, aber erst nach unveränderten NVM-/RAM-Sicherheitsprüfungen. Die One-Wire-Chipdaten und CRC-Felder werden **nicht** geändert, nur das Leerzeichen im SSP3-ASCII-Kommando. Keine NVM-Programmierung beim Test. Der Vergleich klärt eine echte Firmwareabweichung, garantiert aber keine Freigabe bei 4-ms-Startfenster. Pro Durchlauf nur **eine** Variante versuchen und anschliessend das JSON-Log exportieren.

## Startfenster im NVM beibehalten · Diagnose verborgen (v0.6.23)

Ein E703.11 kann nach jedem Einschalten ein One-Wire-Zeitfenster von 4, 10 oder 200 ms auf AODO öffnen. Danach erscheint der konfigurierte Analogausgang. Die im NVM vorhandene `CFG_PADS0.startup_plc`-Einstellung (CM-Wort 18) wird bei jeder normalen Kalibrier-NVM-Programmierung **bitgenau beibehalten**, ebenso `CFG_SPI_I2C` (CM-Wort 17) und `CFG_PADS1` (CM-Wort 19). Die App programmiert diese geschützten Interface-/Bootregister nicht automatisch um.

Das Datenblatt 25DS0170E.04 §§6.4.5.7–8 erlaubt einen Magic-Cookie-basierten Start auch mit im NVM deaktivierten `plc_us_en` und `plc_rw_en`, sofern ein zeitlich begrenztes Fenster vorhanden ist. Der alte Startschutz verwechselte dies mit vollständig deaktiviertem One Wire. Die neue Prüfung akzeptiert diesen Zustand **nur dann für dauerhaftes Kalibrier-NVM-Schreiben**, wenn die schaltbare SSP3-Versorgung, die anschliessende One-Wire-Lesung und die **gleiche Chip-UID** in dieser Sitzung bestätigt sind. Ohne diesen Nachweis bleiben NVM-Programmierung und Boot-Änderungen gesperrt.

Die zusätzlichen SSP3-Fehlersuchwerkzeuge bleiben technisch vorhanden, sind aber im normalen Arbeitsablauf ausgeblendet. Sie lassen sich über **⚙ Einstellungen → Expertenparameter freischalten → USB & Chip** erneut öffnen. Der EEPROM-Viewer und die normalen Kalibrierfunktionen bleiben unverändert.

**Wichtig:** Das Update schreibt selbst nichts in den Sensor. Das Startfenster bleibt genau so lange aktiv, wie es im Original-NVM eingestellt ist, und wird nach jedem Kaltstart neu geöffnet. Eine erfolgreiche echte NVM-Programmierung mit dieser Änderung ist noch nicht hardwaregetestet.

### Normaler SSP3-Verbindungsaufbau wiederhergestellt (v0.6.23, 12.11.2026)

**Korrigierter Hardwarebefund:** Trotz der Anzeige `PLC <slave_id> <data>` in der SSP3-Firmwarehilfe wird `PLC 02 6D1C0C.` ausdrücklich mit `!PLC frame contains invalid data ( )` abgewiesen. Die tatsächliche USB-Kommunikation erfordert das kompakte Telegramm `PLC 026D1C0C.` ohne zusätzliches Leerzeichen. Die Web-App stellt für die bekannte SSP3-Firmware `@02 08 02 04` nun das Legacy-Format ein.

**Neue Standardverbindung am bestätigten SSP3-Prüfplatz:** Bei Adapter **SSP3** und Chip-Schnittstelle **One Wire/AODO** wird ohne zusätzliche Checkbox immer der dokumentierte Neustart der schaltbaren SSP3-VSUPPLY durchgeführt: `IF_CFG 7 0 0` → `?` → `PWR_OFF 03E8` → `PLC P` → `PWR_ON 0C80 00C8 0` → `PLC T` → `PLC 026D1C0C.`. Andere Schnittstellen (I²C, SPI) und die ESP32-Bridge nutzen diesen SSP3-Power-Pfad nicht. Die bestehenden Schutzbedingungen und der Versuch einer Wiederherstellung der VSUPPLY nach Fehlern bleiben erhalten. **Voraussetzung für einen sicheren Einsatz ist weiterhin, dass der Prüfsensor tatsächlich über die schaltbare SSP3-VSUPPLY versorgt wird und eine kurze Stromunterbrechung verträgt.**

Die zuletzt hinterlegte 4/10/200-ms-Startup-Einstellung bleibt im Sensor-NVM unverändert und öffnet sich nach jedem Kaltstart wieder. Eine erfolgreiche Versorgungsschaltung und NVM-Sicherheit müssen vor der NVM-Programmierung weiterhin geprüft werden; ein echter Test der neuen Startautomatik steht noch aus. Zusatzdiagnosen bleiben hinter «Expertenparameter freischalten» verborgen.

### v0.6.23 – verbindlicher SSP3-Hardwarebefund und automatischer Start (12.11.2026)

Der kombinierte Test mit dem getrennten ASCII-PLC-Frame `PLC 02 6D1C0C.` scheiterte am SSP3 mit `!PLC frame contains invalid data ( )` noch **bevor** eine Sensorantwort verarbeitet werden konnte. Die Firmwarehilfe gibt das interne Parameterformat missverständlich wieder. Deshalb wird der getrennte Modus in der Expertenansicht deaktiviert und für SSP3-Firmware `02.08.02.04` die originale kompakte Form erzwungen. Beim Verbinden mit SSP3+OneWire ist der bereits mehrfach geprüfte Stromstart jetzt **immer aktiv**, ohne UI-Checkbox und unabhängig von einem früheren Browserwert. `PLC P` und `PLC T` werden durch die Firmware ausgelöst; andere Schnittstellen bleiben davon unberührt. Der Schritt schreibt niemals NVM. Die ursprünglichen geschützten Interface-NVM-Wörter 17/18/19 und das beim Sensorstart verfügbare One-Wire-Fenster werden durch eine spätere Kalibrier-NVM-Aktualisierung unverändert beibehalten. Die neuen Diagnosebereiche bleiben standardmässig verborgen. Ein erfolgreicher Hardware-Retest der v0.6.23 steht noch aus.

### v0.6.23 – schneller SSP3-PLC-Start bei 4-ms-Fenster (12.11.2026)

Das bisherige Hostprotokoll wartete zwischen `PWR_ON 0C80 00C8 0` und `PLC T` auf eine komplette USB-Antwort. Frühere reale Logs zeigten dabei rund **15 ms**, was das beim E703.11 auf **4 ms** programmierte Startfenster bereits überschreitet. Die Elmos AN 0204 §2.3.4 dokumentiert, dass `PLC P` den Cookie-Frame vorbereitet und `PLC T` den Puffer überträgt. Das Datenblatt 25DS0170E.04 §6.4.5.8 verlangt, dass die Cookie-Sequenz vollständig während des Startfensters übertragen wird.

Für den **normalen SSP3 + 1-Wire**-Verbindungsaufbau bleibt daher die dokumentierte Reihenfolge `IF_CFG 7 0 0`, `PWR_OFF 03E8`, `PLC P` erhalten. Neu werden `PWR_ON 0C80 00C8 0\rPLC T\r` **ohne USB-Antwort-Wartezeit in einer einzigen seriellen Schreiboperation** an die SSP3-Firmware übermittelt. Die Software erwartet anschliessend **zwei getrennte Firmware-Prompts**, prüft die Quittung beider Kommandos und liest erst danach die E703.11-Register. Bei Fehlern wird die bisherige Strom-Wiederherstellungsroutine angewendet. Es werden **keine NVM-Werte verändert** und keine undokumentierten Sensorbefehle gesendet.

**Hardwarevorbehalt:** Die SSP3-Firmware muss mehrere CR-getrennte Befehle in einer USB-Schreiboperation korrekt puffern und verarbeiten; dies ist aus AN 0204 nicht ausdrücklich garantiert. Ein erfolgreicher Hardwaretest steht noch aus. Auch mit schnellerem Hostversand kann insbesondere bei 4 ms das zeitliche Verhalten der SSP3-Firmware oder die PLC-Bitrate weiterhin einen Zugriff verhindern. Dann sind die tatsächlichen SSP3-Antworten auszuwerten und nötigenfalls die PLC_CFG-Einstellungen beziehungsweise ein Original-PSSC-Trace zu vergleichen.

### v0.6.23 – SSP3-Power-Start: einzelne serielle Befehle ohne Wartepause (12.11.2026)

Der reale SSP3 mit Firmware `02.08.02.04` hat den v0.6.21-Versuch `PWR_ON 0C80 00C8 0\rPLC T\r` in einem einzelnen Web-Serial-Write nicht mit beiden Prompts beantwortet. Ein kombinierter USB-Write ist damit **nicht als unterstützt bestätigt**. In v0.6.23 werden die beiden CR-terminierten SSP3-Kommandos als **zwei separate `writer.write()`-Aufrufe** in derselben seriellen Writer-Sitzung übertragen, aber ohne zwischenzeitliches Warten auf die `PWR_ON`-Antwort. Erst danach werden zwei SSP3-Prompts sowie die Echozeilen `#PWR_ON` und `#PLC T` überprüft. Die Übertragungsdauer der beiden Writes wird gemessen.

Bei einem Timeout wird die **tatsächlich bis dahin empfangene Teilantwort**, die Zahl der Prompts und gegebenenfalls ein Schreibfehler im Feld `powerCycle` des exportierten JSON-Logs gesichert. Aus einem einzigen Prompt darf die App nicht auf eine erfolgreiche PLC-Freigabe schliessen. Die bestehende VSUPPLY-Wiederherstellung nach Fehlschlag bleibt bestehen. Kein NVM-Schreiben, keine Änderung von `CFG_PADS0.startup_plc` oder der geschützten Interface-Konfiguration.

**Einschränkung:** Auch zwei unmittelbar aufeinanderfolgende Web-Serial-Schreibaufrufe können für ein 4-ms-Startfenster zu langsam sein, je nach Betriebssystem und SSP3-Firmware. Ein tatsächlicher Zeitnachweis ist erst mit dem SSP3-Hardwaretest möglich. Bleibt die Übertragung unzuverlässig, ist eine adapterseitige Sequenzierung oder ein Original-PSSC-Protokollvergleich erforderlich, statt weitere blinde Timing-Versuche zu senden.

### v0.6.23 – SSP3-Antwortparser akzeptiert verkettete Prompt-/Echo-Fragmente (12.11.2026)

**Echter SSP3-Hardwarebefund mit v0.6.22:** Zwei getrennte Web-Serial-Schreibaufrufe für `PWR_ON 0C80 00C8 0` und `PLC T` wurden beide vom SSP3 quittiert. Der empfangene Text enthält jedoch `#PWR_ON 0c80 00c8 0000 :#PLC T :` – die Firmware schreibt den Doppelpunkt-Prompt direkt vor das nächste Kommandoecho, ohne zwingend einen zusätzlichen Zeilenumbruch. Der bisherige `ssp3PromptCount()` zählte nur einen Doppelpunkt auf einer eigenen Zeile und lieferte deshalb falsch **1/2**; auch die Echo-Prüfung für `#PLC T` war zu streng.

In v0.6.23 erkennt der Parser `:` vor dem folgenden `#`-Kommandoecho oder am Antwortende auch ohne CR/LF. `PWR_ON` und `PLC T` werden getrennt als Echo nach Start/Prompt-Grenze verifiziert, ohne auf einen Zeilenbeginn beschränkt zu sein. Der Sender bleibt identisch: zwei serielle Writes direkt nacheinander, dann zwei SSP3-Quittungen auswerten und erst danach echte E703.11-Register lesen. Keine Änderung an Versorgungskommandos, PLC-Telegramm, Konfigurationsmemory/NVM oder Bootstartfenster.

**Noch nicht bewiesen:** Dass der E703.11 den PLC-Cookie innerhalb seines konfigurierten Fensters empfangen hat. Die neue Prüfung beseitigt ausschliesslich einen Hostparser-Fehler und lässt den Chipzugriff erstmals nach diesem Burst wieder testen. Hardwareergebnis des nachfolgenden Registerlesens muss separat geprüft werden.

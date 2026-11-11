# ELMOS E703.11 – Web-Kalibrierassistent

**Ein geführter Kalibrierassistent für den ELMOS E703.11 und das SSP3-Eval-Board.** Ziel ist ein verständlicher Abgleich, der auch ohne tiefere Vorkenntnisse Schritt für Schritt funktioniert. Wer mehr benötigt, kann zusätzliche Messpunkte, DSP-Parameter und einen geschützten Expertenmodus verwenden.

**Version: v0.3.4** · [Änderungsverlauf](CHANGELOG.md)

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Bedienungsanleitung](ANLEITUNG.md)** · **[Ausgang & 1-Wire erklärt](AUSGANG_1WIRE.md)** · **[Testbericht und Grenzen](TESTBERICHT.md)**

> **Entwicklungsstand: Laborprototyp.** Die vollständige Kalibrierung einschliesslich dauerhafter NVM-Programmierung ist **noch nicht mit einem echten E703.11 als Gesamtablauf freigegeben**. Hardwareverhalten, AODO-Ausgangsmodi und NVM-Wiederherstellung müssen am Testchip geprüft werden. Nicht für die Serienproduktion oder unersetzliche Sensoren einsetzen.

## Projektziel

- **Einfacher Einstieg:** Die App führt durch den gesamten Ablauf und sperrt Schritte, deren Voraussetzungen fehlen.
- **Direktes Feedback:** Wichtige Sensorwerte sind oben in allen Schritten sichtbar; AFE-Änderungen zeigen ihre Wirkung unmittelbar.
- **Erweiterbar:** Zusätzliche Kalibrier- und Prüfpunkte, DSP-Ausgangsspanne und Expertenparameter für anspruchsvollere Abgleiche.
- **Schutz der Werksdaten:** Factory-Kalibrierung bleibt lesbar, aber nicht frei editierbar. Permanente Änderungen werden vor dem Schreiben kontrolliert.

## Funktionen

| Bereich | Aktueller Stand |
| --- | --- |
| Verbindung | Browserbasiert über **Chrome / Web Serial**, FTDI / SSP3, standardmässig **1-Wire (AODO)**; I²C/SPI-Optionen |
| Live-Werte | Obere Statusleiste mit **ADC_S**, **ADC_T**, **DSP_S** und umgerechnetem Sensorwert; Live-Status und letzter Messzeitpunkt in allen sieben Schritten |
| AFE-Abgleich | Diskrete **− / +** Tasten in der Reihenfolge **PGA1 → Offset → PGA2**. Jeder Klick schreibt die neue Einstellung direkt ins **RAM** und liest sie zurück. Kein NVM-Schreiben |
| Messpunkte | **2–10 Kalibrierpunkte** (Standard 2), eigene Namen, Referenzen und Temperaturen; **1–100 Samples** pro Punkt (Standard 12), Median und Streuungsprüfung |
| Koeffizienten | Berechnung im Browser, einstellbare Polynomordnungen und symmetrischer DSP-Zielbereich **±1’000 bis ±32’000 Digits** |
| RAM & DSP | Berechnete Koeffizienten ins RAM schreiben, rücklesen und DSP_S gegen Referenz/Toleranz prüfen; **1–10 Prüfpunkte** (Standard 1) |
| NVM | Vor dem permanenten Schreiben vollständige **64-Wort-Lesung**, CRC-/Schutzprüfung und Änderungsliste; optionales Backup; 48-Bit-Chip-UID wird automatisch eingetragen und beim Schreiben geprüft |
| Ausgangskonfiguration | Eigener **Schritt 6**, PSSC-orientiert mit Digital Interface, AODO pin, Scaling, Limiting, Error Signaling und Error Values. **«One Wire only»** als bedingt wählbarer Betriebszustand mit Prüfung des Original-NVM. Nicht validierte Registeroptionen bleiben nur lesbar |
| 1-Wire-Startschutz | Vor NVM-Schreiben Prüfung von AODO-Modus 1–5, PLC-Startup, Downstream/Upstream und persistentem Registerzugriff. **One Wire only benötigt bereits plc_en=1 im Original-NVM**; der Assistent ändert keine Bootregister. Kaltstarttest weiter nötig |
| Expertenmodus | Über **⚙ Einstellungen → Expertenparameter freischalten** aktivieren. Öffnet sofort ein eigenes Diagnosefenster mit Registerleser, NVM-/EEPROM-Übersicht, Chip-UID und Backups; unabhängig von den Kalibrierschritten |
| Diagnose | Register-/Chipanzeige, technisches Log, Demo-Modus und Dokumentation |

Für Entwickler gibt es **18 Software-Regressionstests** (Stand v0.3.3) mit Node.js: `node --test tests/safety.test.cjs`. Die Prüfungen umfassen unveränderte Boot-/Kommunikationswörter, One-Wire-only-Bedingungen, S0/S1-Skalierung und die sieben Schritte. Die Tests ersetzen keine echte Hardwareprüfung.

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

## Einstellungen und Expertenfunktionen

Das **Zahnrad oben rechts** öffnet die App-Einstellungen. Hier lassen sich Expertenwerkzeuge, Hover-Hilfen, die Standard-Sample-Anzahl und das Live-Abfrageintervall einstellen. **Der Expertenmodus öffnet sofort das separate Diagnosefenster**, ohne dass die DSP-Prüfung abgeschlossen sein muss. Das Fenster kann geschlossen und über «Expertenwerkzeuge öffnen» erneut angezeigt werden. Das Zahnrad zeigt im aktivierten Zustand «EXPERT» an.

Die **Ausgangskonfiguration** besitzt Schritt 6 nach «DSP prüfen» und vor «NVM programmieren». «One Wire only» ist **kein eigener CFG_EN.aodo_en-Wert**, sondern die Anzeige einer bereits permanent aktiven 1-Wire-Schnittstelle, bei der AODO für Kommunikation belegt ist. Die Wahl ändert **keine** Bootregister und ist gesperrt, wenn das Original-NVM keine dauerhafte 1-Wire-Aktivierung aufweist. [Details und Register](AUSGANG_1WIRE.md). **S0/S1 sind Zielspannungen**, bei 5 V standardmässig 0.5 / 4.5 V. Die aktuelle Chipkonfiguration erscheint separat und kann diese Vorgabe nicht mehr überschreiben. Der Knopf «Standard 10–90 % VDD einsetzen» stellt plausible Ausgangswerte wieder her. AODO-Ausgangsmodi sind nicht dasselbe wie 1-Wire-/I²C-/SPI-Kommunikationsschnittstellen. Ein Wechsel am SSP3 programmiert nicht die Boot-/Kommunikationsregister des Sensors.

Mit aktivem **Expertenmodus** sind in einem separaten, jederzeit erreichbaren Fenster folgende Funktionen verfügbar (kein NVM-Schreiben durch Aktivieren):

- **Ausgang konfigurieren (für alle sichtbar):** PSSC-Bezeichnungen für Analog Ratiometric 0..5 V, PWM, FM und bedingt **One Wire only** (permanenter PLC-Betrieb muss im Original-NVM bereits bestehen); High-Z und Alarm werden wegen des geforderten 1-Wire-Starts nur als gesperrte Optionen angezeigt; automatische S0/S1-Spannungs-zu-AODO_F/AODO_O-Berechnung mit Q3.12-Quantisierung und Vorschau. Absolute 0..10 V und 4..20 mA sind für den E703.11 nicht freigeschaltet. Limiting, Error Signaling und digitale Boot-Einstellungen werden nur als geschützte Diagnosefelder gezeigt. Änderungen werden zuerst als Vorschlag geprüft; auch eine reine Ausgangsänderung bei bereits kalibriertem Sensor ist vorgesehen.
- **Expertenfenster:** Dokumentierte Hauptregister und vollständige EEPROM-/NVM-Ansicht, 48-Bit-UID (**VERSION + SER1 + SER0**), lokale Backup-Historie und Import/Vergleich eines passenden Backups.
- **Schutz:** Factory-Wörter werden nicht frei beschrieben. Kommunikations-/Bootwerte bleiben gesperrt; nur gezielt freigegebene AODO-Felder sind über den validierten Schreibplan veränderbar. Keine allgemeinen Rohregister-Schreibbefehle.

**Backups:** Die Option **«Altes NVM automatisch sichern»** ist standardmässig aktiv, aber abwählbar. Auch ohne dauerhafte Sicherung wird das Original-NVM zum Schutzvergleich vollständig gelesen. Lokale Browserdaten sind kein verlässliches Langzeitarchiv; wichtige JSON-Backups zusätzlich auf dem PC aufbewahren. Eine Wiederherstellung erfolgt nie automatisch.

## Starten – ausschliesslich im Browser

Die App wird direkt über **GitHub Pages** gestartet:

**[ELMOS E703.11 – Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)**

Erforderlich sind ein geeigneter Chromium-Browser (getestet mit Chrome), ein USB-/FTDI-Anschluss und die Browserfreigabe für den seriellen Port. **Keine Installation, kein Python, kein lokaler Webserver und keine Startskripte.**

Für USB-Probleme steht die ebenfalls browserbasierte [SSP3-USB-Diagnose](usb-diagnose.html) zur Verfügung. Wenn Chrome den FTDI-Port zwar auswählen, aber nicht öffnen kann, ist dies zunächst ein **COM-/Web-Serial-Problem**, kein Nachweis für einen Fehler in der E703.11-Kommunikation. Weitere Hinweise stehen in der [Anleitung](ANLEITUNG.md).

## Test- und Sicherheitsstatus

- **Im Softwaretest geprüft:** Grundlegende UI-Funktionen, Sample- und Koeffizientenlogik, RAM-/NVM-Freigaben und simulierte SSP3-Transaktionen. Einzelheiten im [Testbericht](TESTBERICHT.md).
- **Noch offen:** Vollständiger SSP3-Hardwaretest, Vergleich der DSP-Koeffizienten mit der Originalsoftware, reale AODO-Ausgänge und ein sicherer vollständiger NVM-Schreib-/Restore-Test.
- **Niemals blind programmieren:** Ein fehlerhafter NVM-Vorgang oder Stromunterbruch kann den Sensor unbrauchbar machen. Zuerst an einem entbehrlichen Testchip prüfen.

Der aktuelle Code wird als **statische Web-App ohne Buildprozess** ausgeliefert. Frühere Syntax-, UI- und Rechentests sowie die weiterhin offenen Hardwareprüfungen sind im [Testbericht](TESTBERICHT.md) beschrieben. Der alte Node-Teststarter wurde im Zuge der Bereinigung entfernt; die Prüfungen sind deshalb keine automatisierte CI-Abnahme.

## Feedback willkommen

Die Oberfläche und der Ablauf sind noch in Entwicklung. Besonders hilfreich ist Feedback dazu, **welche Funktionen fehlen**, ob der **Abgleich auch ohne Vorkenntnisse verständlich** ist, wo die **Bedienung noch unübersichtlich** wirkt und ob die **Reihenfolge der Schritte** in der Praxis sinnvoll ist. Für komplexere Kalibrierungen und weitere Expertenparameter ist der Ausbau erst nach einer stabilen Grundstruktur vorgesehen.

## Lizenz und Hinweise

Aktuell ist **keine Open-Source-Lizenz** festgelegt. Öffentlich einsehbarer Code ist deshalb nicht automatisch zur freien Weiterverwendung lizenziert. Dieses Projekt ist **keine offizielle ELMOS-Anwendung**; Produkt- und Markennamen gehören ihren jeweiligen Inhabern. Hersteller-DLLs und proprietäre Entwicklungsdateien sind nicht Bestandteil des Repositorys.

**1-Wire-Sicherheitsgrenze:** Der Assistent verändert keine bisherigen Kommunikations-/Bootwörter im NVM. Vor permanentem Schreiben verlangt er eine tatsächlich lesbare 1-Wire-Verbindung und prüft den geplanten NVM-Inhalt. Eine hundertprozentige Hardwaregarantie gibt es ohne validierten Kaltstarttest und Hersteller-Dokumentation der relevanten Bits nicht. Vor dem Einsatz am Produktionssensor am Testchip prüfen.

## Datenblatt-Abgleich für den Ausgang (v0.3.2)

Verwendet wurde **E703.11 25DS0170E.04, Production Data vom 16.11.2023**: §6.3.2.6 (Q3.12-Ausgangsskalierung), §6.4.1.1 (nominaler DAC-Ausgang und 10–90 % VDD), §6.4.5.7–8 (1-Wire-Voraussetzungen und Startup), §6.5.1.1–2 (Konfigurationsregister), §6.5.7.2 (AODO-F/O-Register). Das Datenblatt ist ein externes Herstellerdokument und nicht im Repository enthalten.

Der Assistent erfordert für NVM-Schreibvorgänge die im Original-NVM nachweisbare PLC-Startaktivierung, Downstream- und Upstream-Kommunikation und einen persistenten Register-Lese-/Schreibzugang. Sensoren, die nur über eine kurzzeitige Magic-Cookie-Freigabe kommunizieren, werden vorsorglich nicht dauerhaft programmiert. Die App ändert keine geschützten Startup-Register, um diese Situation zu umgehen. Ein Hardware-Kaltstarttest bleibt Pflicht.

**Versions- und Cache-Hinweis:** Die Skript-Dateien werden in v0.3.4 mit derselben Versionskennung wie die Web-App geladen. Für die Überprüfung im Browser gegebenenfalls mit `Ctrl + F5` neu laden.

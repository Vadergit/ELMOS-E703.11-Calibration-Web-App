# Bedienungsanleitung – ELMOS E703.11 Kalibrierassistent

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Projektübersicht](README.md)** · **[Testbericht](TESTBERICHT.md)**

Diese Anleitung beschreibt die derzeitige Benutzeroberfläche der browserbasierten App für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Ziel ist ein geführter Abgleich mit möglichst wenig Vorwissen und optionalen Expertenfunktionen.

> **Laborprototyp, keine Produktionsfreigabe.** Der vollständige Kalibrier- und NVM-Schreibablauf wurde noch nicht am realen E703.11 als Gesamtsystem validiert. Permanente Änderungen zunächst nur an einem entbehrlichen Testchip erproben.

## 1. Start und Verbindung

Die App wird **ausschliesslich über die [GitHub-Pages-Webseite](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** mit Chrome aufgerufen. Sie verwendet **Web Serial** und benötigt einen vom Betriebssystem erkannten USB-/FTDI-COM-Port.

**Es sind keine Installation, keine Windows-/macOS-Startskripte, kein Python und kein lokaler Webserver erforderlich.** Die separate [webbasierte SSP3-USB-Diagnose](usb-diagnose.html) kann bei Verbindungsproblemen direkt im Browser geöffnet werden.

In **Schritt 1 – Verbindung**:

1. SSP3 und Sensor verbinden und den FTDI-COM-Port im Gerätemanager beziehungsweise Betriebssystem prüfen.
2. **USB-Port auswählen** und den richtigen Anschluss bestätigen; bereits freigegebene Geräte können erneut verbunden werden.
3. Standardmässig die **1-Wire-/AODO-Kommunikation** verwenden, sofern sie zur Hardware passt. Die Oberfläche bietet auch I²C-/SPI-Optionen.
4. Firmware-/Chip-Erkennung und erste ADC-Werte kontrollieren. Bei Fehlern zunächst **nur lesen**, nicht programmieren.

**Wenn sich COM öffnen nicht lässt:** Die Auswahl eines FTDI-Adapters bedeutet noch nicht, dass Chrome den Port öffnen kann. Zum Beispiel andere serielle Programme schliessen, COM-Zuordnung und VCP-Treiber prüfen; eine Fehlermeldung bei `SerialPort.open()` entsteht vor einer eigentlichen E703.11-Protokollprüfung. Der technische Diagnosemodus kann helfen.

## 2. Live-Werte – in allen sieben Schritten sichtbar

Oben in der App befindet sich eine dauerhaft sichtbare Statusleiste:

| Anzeige | Bedeutung |
| --- | --- |
| **ADC_S** | Unkompensierter Druck-ADC, in Digits. Die App warnt oberhalb von rund **±25’000 Digits** als vorsichtigem Optimierungsziel, nicht als absoluter Hardwaregrenze |
| **ADC_T** | Temperatur-ADC-Rohwert, Digits (nicht direkt °C) |
| **DSP_S** | Digitaler, durch die Chip-Koeffizienten skalierter DSP-Ausgang, Digits |
| **Sensorwert** | Aus DSP_S mit dem aktuell gewählten Anzeigebereich in bar, %, mbar usw. umgerechneter Wert |
| **Status / Zeit** | Chipverbindung, Live-/Pausenstatus und Zeitpunkt der letzten Messung |

Die Live-Abfrage läuft **über die Tabwechsel hinweg weiter**, sofern der Sensor verbunden und die Messung nicht bewusst pausiert ist. Während einer RAM-/NVM-Transaktion wird sie unterbrochen. Die Anzeige allein beweist **keine** korrekte Kalibrierung: Für die NVM-Freigabe zählen ausschliesslich die ausdrücklich aufgenommenen DSP-Prüfpunkte.

Für einen bereits kalibrierten Sensor kann der Anzeigebereich unter **AFE optimieren** angepasst werden. Die Umrechnung ändert nur die Darstellung, nicht die Register. Falls der DSP-Endwert der früheren Kalibrierung nicht ±32’000 Digits betrug, muss die passende Zahl manuell angegeben werden.

## 3. AFE optimieren – direkte RAM-Übernahme

Die Reihenfolge entspricht der Originalsoftware:

**PGA1 → Offset → PGA2**

Alle drei Einstellungen werden über kompakte **− / +** Tasten verändert. Die App zeigt die tatsächlichen Verstärkungen beziehungsweise den Offset in **mV/V**, nicht den Stufencode.

- PGA1: **4 diskrete Stufen** (interne Codes 0–3).
- Offset: **−8 bis +8**, in **50 mV/V** je Schritt.
- PGA2: **9 diskrete Stufen** (interne Codes 0–8).

**Jeder Pfeilklick schreibt die neue Einstellung unmittelbar ins Sensor-RAM** und liest das AFE-Register zur Kontrolle zurück. Währenddessen sind weitere Klicks gesperrt. Anschliessend aktualisiert die App den ADC_S-Wert, damit du die Auswirkung sofort siehst.

Achte auf einen möglichst guten nutzbaren ADC_S-Hub ohne Übersteuerung. Wenn die AFE-Einstellung geändert wird, müssen bereits aufgenommene Kalibrierpunkte erneut gemessen werden, da sie nicht mehr zur aktuellen Verstärkung passen.

**Wichtig:** Die Pfeiltasten schreiben **nicht** dauerhaft ins NVM und verändern keine frei gesperrten Factory-/Bootregister. Der frühere zusätzliche Knopf «AFE-Einstellungen ins RAM übernehmen» entfällt.

## 4. Kalibrier-Messpunkte aufnehmen

In **Schritt 3** wird die Planung **vor** der Messung festgelegt:

1. **Anzahl Kalibrierpunkte:** 2–10 (Standard **2**). Zwei Punkte eignen sich für einen einfachen linearen Abgleich.
2. **Samples pro Messpunkt:** 1–100 (Standard **12**), für End- und Zwischenpunkte gleichermassen.
3. **Einheit und Bereich:** Beispielsweise 0–10 bar oder 0–100 %. Die Werte müssen zur tatsächlichen Druckreferenz am Prüfstand passen.
4. **Pro Messpunkt:** Freien Namen, Referenzdruck und Temperatur prüfen. Dann mit dem jeweiligen Aufnahmeknopf erfassen.

Für jeden Punkt werden **ADC_S, ADC_T und ADC_TC** ausgelesen. Der gespeicherte ADC-Wert ist jeweils der **Median** aus den Samples. Die Streuung bezeichnet `Maximum(ADC_S) − Minimum(ADC_S)`; bei mehr als einem Sample führt eine Streuung über **350 Digits** zur Ablehnung der Aufnahme. Mit genau einem Sample ist keine Streuungsprüfung möglich.

Nach der Aufnahme erscheinen die Messwerte deutlich hervorgehoben im grünen Ergebnisfeld: **ADC_S, ADC_T, Streuung, Sample-Anzahl, Referenzwert und Temperatur**. Die Anzeige zeigt zudem den Aufnahmefortschritt.

Die Berechnung wird erst nach dem Erfassen **aller gewählten Punkte** freigegeben. Höhere Polynomordnungen und Temperaturabgleiche können mehr **unabhängige Druck-/Temperaturpunkte** verlangen.

## 5. Koeffizienten berechnen und ins RAM schreiben

In **Schritt 4**:

1. Gewünschte **Druck- und Temperaturpolynomordnung** auswählen. Die App prüft, ob dafür genügend unabhängige Punkte vorhanden sind.
2. Den **symmetrischen DSP-Endwert** festlegen, zulässig **±1’000 bis ±32’000 Digits**. Beispiel: **±30’000** lässt Reserve gegenüber ±32’000.
3. **Koeffizienten berechnen**. Die App zeigt Koeffizienten und numerische Fit-Fehler.
4. **Berechnete Koeffizienten ins RAM schreiben** und die Rücklesekontrolle abwarten.

Dafür muss nicht bereits das vollständige 64-Wort-NVM als Datei gesichert sein; die permanente Programmierung folgt erst nach der DSP-Prüfung.

Bei Änderungen der Messpunkte, AFE-Gains, Polynomordnungen oder DSP-Zielspanne sind die betroffenen Berechnungen und Prüfungen erneut durchzuführen. Die neue Zielspanne beeinflusst die Koeffizienten **und** die Sollwerte der DSP-Prüfung; sie ist nicht bloss eine Anzeigeoption.

## 6. DSP-Ausgang prüfen

In **Schritt 5** werden die im RAM wirksamen DSP-Koeffizienten anhand der **echten DSP_S-Chipausgabe** geprüft.

- **Anzahl Prüfpunkte:** 1–10, Standard **1**.
- **Prüfreferenz und Toleranz:** Den real eingestellten Druck erfassen, den gemessenen DSP_S mit dem Soll vergleichen und die Abweichung beurteilen.
- **Live-Anzeige:** Kalibrierter Wert und Roh-DSP-Ausgang sind während der Prüfung sichtbar.
- **Mehrere Prüfpunkte:** Für bessere Abdeckung verschiedene Druckstellen im Bereich verwenden.

**Nur ein Prüfpunkt bestätigt die Kennlinie nicht über den gesamten Bereich.** Für komplexere, insbesondere temperaturkompensierte Kalibrierungen, sind zusätzliche, unabhängige Messungen und Prüfungen sinnvoll beziehungsweise notwendig.

Erst nach der bestandenen Prüfung aller gewählten Prüfpunkte wird der normale permanente NVM-Ablauf freigeschaltet.

## 7. Ausgang konfigurieren

Im neuen **Schritt 6** folgen die Ausgangseinstellungen nach der DSP-Prüfung. Sie sind nach den PSSC-Bereichen **Digital Interface**, **AODO pin**, **Scaling**, **Limiting**, **Error Signaling** und **Error Values** gegliedert. Nicht bestätigte Hardwareoptionen sind nur lesbar oder deaktiviert. Der AODO-Modus bestimmt die analoge, PWM-, FM- oder Alarm-Ausgabe; **1-Wire und I²C sind dagegen Kommunikationsschnittstellen**. AODO_F skaliert DSP_S, AODO_O verschiebt dessen Ausgangsbereich. Die beiden Werte sind unter «Erweiterte Ausgangsparameter» verborgen und können über «Passende Ausgangsskalierung berechnen» vorgeschlagen werden.

**DSP-Zielbereich:** Wenn «Berechnen & RAM» für die neue Kalibrierung ±25’000 Digits verwendet, müssen auch die Scaling-Punkte S0/S1 −25’000/+25’000 verwenden. Der Assistent übernimmt das automatisch. Eine reine AFE-Empfehlung «ADC_S innerhalb ±25’000» ist dagegen keine DSP-Skalierung und darf nicht damit gleichgesetzt werden.

**Analog Ratiometric:** Bei VDD = 5 V kannst du beispielsweise S0 = 0.5 V und S1 = 4.5 V wählen. AODO_F und AODO_O werden in Q3.12 berechnet und als Vorschau angezeigt. Vor permanenter Programmierung an einem Testchip prüfen.

Für einen bereits kalibrierten Sensor das Original-NVM (64 Wörter) im Ausgangsschritt lesen und überprüfen. Eine neue Kalibrierung ist nicht erforderlich, wenn nur der Ausgang geändert werden soll.

**1-Wire-Startschutz:** Dauerhafte NVM-Programmierung nur bei realer Verbindung über 1-Wire. Kommunikations-/Bootwerte des NVM dürfen sich durch den geplanten Schreibvorgang nicht ändern. Nach dem Schreiben den Sensor aus- und wieder einschalten und den 1-Wire-Zugriff erneut prüfen. Ohne Hardwaretest ist eine absolute Startgarantie nicht nachgewiesen.

## 8. NVM dauerhaft programmieren

In **Schritt 7** gibt es zwei Hauptaktionen:

**A. NVM lesen & Änderungen prüfen:** Die App liest **64 NVM-Wörter**, kontrolliert CRC8/CRC16 und die schreibgeschützten Bereiche und erstellt die Änderungsliste. Diese Vorschau programmiert **noch nichts**.

**B. Kalibrierung dauerhaft ins NVM schreiben:** Die **48-Bit-Chip-UID (VERSION + SER1 + SER0)** wird automatisch aus dem verbundenen Sensor übernommen und in das Eingabefeld eingetragen. Du darfst den Wert bearbeiten; ein Schreibvorgang bleibt jedoch gesperrt, wenn er nicht mit dem angeschlossenen Chip übereinstimmt. Ein zusätzliches **Bestätigungswort wird nicht mehr benötigt**.

Die Option **«Altes NVM automatisch sichern»** ist standardmässig **aktiviert**. Bei aktivierter Option wird vor der eigentlichen Programmierung die alte Konfiguration chipbezogen archiviert und ein **JSON-Download** ausgelöst. Du kannst die Option bewusst deaktivieren; eine vollständige **Sicherheitslesung mit CRC-Prüfung** bleibt dennoch Pflicht. Ohne gespeichertes Original kann eine spätere Wiederherstellung unmöglich sein.

Die Änderungsliste, das separate Leseprotokoll und die Kontrolle nach einem physischen Neustart sind einklappbar. Nach dem Schreiben erfolgt eine Rücklese-/CRC-Kontrolle; für die tatsächliche Bootkontrolle muss der Chip physisch aus- und wieder eingeschaltet werden.

**Achtung:** Ein Stromunterbruch oder Protokollfehler beim NVM-Schreiben kann den Sensor beschädigen. Die Hardwareverträglichkeit der aktuellen Implementierung ist nicht vollständig validiert.

## 9. ⚙ Einstellungen und Expertenmodus

Das **Zahnrad oben rechts** öffnet die Einstellungen. Dort lassen sich folgende Optionen bedienen:

- **Expertenparameter freischalten** (ändert beim Aktivieren selbst keine Chipregister).
- **Hover-Erklärungen** ein-/ausschalten.
- **Standard-Sample-Anzahl** für neue Messpunkte (1–100).
- **Live-Abfrageintervall** (400, 650, 1’000, 1’500 oder 2’000 ms).

Nach Aktivierung erscheinen die erweiterten Eingabefelder **im zugehörigen Arbeitsschritt**:

**Unter Ausgang konfigurieren:** AODO-Ausgangsmodus (High-Z, ratiometrisch analog mit drei DAC-Korrekturstufen, PWM, FM, Alarm), PWM-Periode und unterstützte AODO-Skalierung. Die App prüft die Vorschläge; die eigentliche dauerhafte Änderung erfolgt über den geschützten NVM-Schreibablauf. Eine reine Ausgangsänderung an einem schon kalibrierten Sensor ist vorgesehen und benötigt zunächst ein vollständiges geprüftes NVM-Abbild.

**Unter NVM speichern:** Hauptregister lesen, komplettes EEPROM-/NVM-Abbild anzeigen, nach UID gespeicherte Backups auswählen, importieren, exportieren und einen Restore-Plan erstellen. Die Backup-Dateinamen enthalten die **12-stellige UID**.

**Factory-Schutz:** Der Werksbereich **CM-Byteadresse 0x00–0x1E** bleibt nur lesbar. Boot-/Kommunikationswerte bleiben geschützt. Gezielte, dokumentierte AODO-Konfigurationsfelder werden nur über geprüfte Schreibpläne geändert. Es gibt **keinen allgemeinen Editor für beliebige NVM-Wörter**. Die Wiederherstellung eines fremden Chips oder eines Backups mit abweichenden Factory-/Bootwerten wird abgelehnt; sie erfolgt niemals automatisch.

Die lokale Browser-Backup-Historie kann beim Löschen von Website-Daten verloren gehen. **JSON-Backups zusätzlich extern aufbewahren.**

## 10. Sicherheit, technische Grundlage und Grenzen

- **Vor echten Schreibtests:** Zuerst nur lesen; anschliessend RAM-Funktionen; permanente NVM-Schreibvorgänge erst an einem entbehrlichen Testchip.
- **Eigene Berechnung:** Die Software verwendet einen unabhängigen numerischen JavaScript-Fit, **nicht** `pssc_cal_lib.dll`. Der resultierende DSP-Abgleich muss an echten Sensoren und möglichst mit der Originalsoftware verglichen werden.
- **Vorhandene technische Grundlagen:** E703.11-Datenblatt `25DS0170E.04`, Evaluation-Kit-Dokumentation und SSP3-/Kalibrier-Unterlagen AN 0203/0204. Proprietäre Herstellerdateien sind nicht im Repository enthalten.
- **Keine Garantie:** Selbst korrekt bestandene Software-Simulationen können das Verhalten von SSP3, AODO-Ausgängen, NVM oder Bootsequenzen auf echter Hardware nicht garantieren.

**Web-Dateien:** `index.html` (UI), `app.js` (Web Serial und Ablauf), `calibration.js` (Koeffizienten/CRC/NVM-Plan), `expert.js` (Expertenparameter und Backups) und `usb-diagnose.html` (isolierte USB-Diagnose im Browser). Es gibt keine lokale Startanwendung und keinen Node-Teststarter. Dokumentierte Simulationen und offene Hardwareprüfungen: [TESTBERICHT.md](TESTBERICHT.md).

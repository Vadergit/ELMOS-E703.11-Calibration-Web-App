# ELMOS E703.11 – Web-Kalibrierassistent

**Ein geführter Kalibrierassistent für den ELMOS E703.11 und das SSP3-Eval-Board.** Ziel ist ein verständlicher Abgleich, der auch ohne tiefere Vorkenntnisse Schritt für Schritt funktioniert. Wer mehr benötigt, kann zusätzliche Messpunkte, DSP-Parameter und einen geschützten Expertenmodus verwenden.

**Version: v0.7.7 · Höherer Kontrast und umschaltbarer Darkmode** · [Änderungsverlauf](CHANGELOG.md) · **[Geplante Funktionen](ROADMAP.md)**

Über **Einstellungen → Demo-Modus** lässt sich der gesamte Kalibrierablauf mit simulierten Messwerten und NVM ausprobieren.

**[Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[Archiv & Nachmessung](ARCHIV_NACHMESSUNG.md)** · **[Test / Logging](TEST_LOGGING.md)** · **[Bedienungsanleitung](ANLEITUNG.md)** · **[Config-Dateien & EEPROM Viewer](CONFIG_DATEIEN.md)** · **[Ausgang & 1-Wire erklärt](AUSGANG_1WIRE.md)** · **[Testbericht und Grenzen](TESTBERICHT.md)**

> **Entwicklungsstand: Laborprototyp.** Die vollständige Kalibrierung einschliesslich dauerhafter NVM-Programmierung ist **noch nicht mit einem echten E703.11 als Gesamtablauf freigegeben**. Hardwareverhalten, AODO-Ausgangsmodi und NVM-Wiederherstellung müssen am Testchip geprüft werden. Nicht für die Serienproduktion oder unersetzliche Sensoren einsetzen.

> **Geführter Assistent:** Nach der bestätigten SSP3-Verbindung stehen die neue Schritt-für-Schritt-Führung, die klassische Ansicht und der optionale Kompaktmodus zur Verfügung. Ein E703.11-Chip muss für den Abgleich verbunden sein. Die USB-CDC-Bridge bleibt als experimenteller Verbindungstest ohne Sensorprogrammierung gesperrt.
>
> [Geführter Abgleich](docs/GEFUEHRTER_ASSISTENT.md) · [USB-Bridge](docs/USB_BRIDGE_GUIDE.md) · [ESP-Boards](docs/ESP_BOARD_OPTIONS.md) · [ESP32-C3 SuperMini Sketch](firmware/esp32c3_supermini/esp32c3_supermini.ino)

## Neu in v0.7.7 – Kontrastreiches helles und dunkles Design

Unter **⚙ Einstellungen → Darstellung / Farbmodus** kannst du zwischen **«Hell · hoher Kontrast»** und **«Dunkel · Darkmode»** wechseln. Die Auswahl gilt sofort für alle Teile der Web-App: geführter Assistent, klassische Ansicht, Kompaktmodus, Test/Logging, EEPROM Viewer, Archiv und Nachmessung. Die Einstellung bleibt lokal im Browser gespeichert und wird vor dem Anzeigen der Webseite geladen, damit beim Start im Darkmode kein heller Bildschirm aufblitzt.

Im hellen Design sind feine Linien und Nebenbeschriftungen dunkler und deutlicher sichtbar. Im Darkmode werden dunkle Panels, gut lesbare Eingabefelder, farblich unterscheidbare Meldungen sowie ein an die Darstellung angepasster ADC-Verlauf verwendet. Es gibt **keine Änderungen an der Sensor- oder NVM-Programmierung**. [Bedienungsanleitung](ANLEITUNG.md).

## Neu in v0.7.6 – Sechs Aufgabenkacheln und Hilfeseiten in neuen Tabs

Im geführten Einstieg stehen jetzt **sechs direkt anklickbare Kacheln** bereit: Sensor neu abgleichen, Nur Ausgang ändern, EEPROM/Diagnose, Test/Logging, **Nachmessung** und **Archiv**. Die sechs Aufgaben werden platzsparend in zwei Reihen angezeigt; auf schmalen Bildschirmen ordnen sie sich automatisch um.

**Archiv** öffnet direkt die lokale Archivsuche und benötigt zum Anzeigen vorhandener Dateien keinen angeschlossenen Sensor. **Nachmessung** öffnet direkt den Druck-/Temperaturprüfplan. Auch wenn der zusätzliche Button in der oberen Navigation über die Einstellungen standardmässig ausgeblendet ist, **bleibt die Kachel im geführten Einstieg sichtbar**. Bestehende Sicherheitsprüfungen für tatsächliche Sensormessungen und NVM-Schreibvorgänge bleiben erhalten. Nach Schliessen des Archivs kommst du zur geführten Auswahl zurück.

**Dokumentations- und Diagnose-Webseiten** werden aus der App heraus in einem **neuen Tab** geöffnet (je nach Browser auch in einem separaten Fenster). Dadurch bleibt die Haupt-Web-App mit ihrer USB-/Sensorverbindung offen. Der ZIP-Download bleibt ein Download und startet keinen unnötigen Tab.

## Neu in v0.7.5 – Offline-Anleitung und Nachmessung in den Einstellungen

Der bisherige Offline-Hinweis unter der oberen Navigation ist entfernt. Die **«Anleitung für Einsteiger»** zum lokalen Speichern der Webseite findest du unter **⚙ Einstellungen → Web-App offline verwenden**.

**Nachmessung einblenden** ist ein neuer Schalter in den App-Einstellungen. Er ist beim ersten Aufruf **ausgeschaltet**. Nur nach Aktivierung erscheint der obere Navigationsbutton «Nachmessung» für Druck- und Temperatur-Prüframpen. Die Auswahl bleibt lokal im Browser gespeichert und kann jederzeit geändert werden. Eine noch laufende Nachmessung muss vor dem Ausblenden zuerst beendet oder abgebrochen werden. Gespeicherte Nachmessungsprotokolle sind unabhängig davon weiterhin im Archiv sichtbar.

## Neu in v0.7.4 – DUT und Firmware richtig zuordnen

- **Test / Logging** besitzt jetzt das eigene, optionale Feld **«Produkt / DUT-Bezeichnung»**, unabhängig vom Testnamen. Es wird beim Teststart im JSON erfasst und im Archiv, in der Suche, beim Direktvergleich und in jeder exportierten CSV-Zeile angezeigt.
- **Archivplatz gespart:** kompakte obere Werkzeugleiste, zusammengezogene Statistik-Kacheln sowie Geräte- und Aufzeichnungsdaten in mehreren Spalten; VDD-Istspannungsfelder sind aufklappbar.
- **Firmware korrigiert:** Die bisherige Zahl `02.08.02.04` ist die über den SSP3-Befehl `.VERSION` gelesene **Adapter-Firmware**, keine E703.11-Sensorfirmware. Alte und neue JSON-Protokolle werden daher ausdrücklich als **«Adapter-Firmware»** angezeigt. Ein separater Eintrag **«E703.11 Chip-Version (Reg. 0x38)»** zeigt den echten ausgelesenen Sensorregisterwert, sofern vorhanden; das ist keine Sensor-Firmwareversion.
- Bestehende Logdateien bleiben unverändert und kompatibel.

## Neu in v0.7.3 – Logviewer und direkte Aufgabenwahl

- **Sofortstart:** Im geführten Einstieg öffnet ein Klick auf die gewünschte Kachel direkt die entsprechende Aufgabe. Ein zusätzlicher Klick auf «Weiter» ist nicht mehr nötig. Bestehende Sensor- und Archiv-Schutzprüfungen werden weiterhin durchgeführt.
- **Neuer Logviewer:** Im Archiv erscheinen eine kompakte Gesamtübersicht, nach Datum sortierte Messdateien mit UID, Board, Softwarestand, Dauer, Fehlern und Toleranzabweichungen.
- **Schnellkontrolle:** Ein Klick auf «Ergebnisse prüfen» zeigt Messpunkte, Rohsamples, Status, Gerätedaten, Mittelwert, Minimum, Maximum, Streuung, einen DSP_S-Signalverlauf und wichtige Fehlermeldungen/Notizen, sofern die entsprechenden Daten vorhanden sind.
- **Direktvergleich:** Zwei Dateien auswählen und parallel betrachten; Messwert-Unterschiede werden auf Basis der tatsächlich gespeicherten Rohwerte angezeigt, ebenso Änderungen der 64 NVM-Wörter. Abweichende Chip-UIDs werden ausdrücklich gekennzeichnet.
- Die bisherige Archiv-JSON-Struktur bleibt kompatibel; fremde Dateien werden weiterhin ignoriert, und die Speicherung erfolgt unverändert lokal. [Archiv-Anleitung](ARCHIV_NACHMESSUNG.md).

## Neu in v0.7.2 – Archiv, Nachmessung und Test / Logging klar getrennt

Die obere Navigation hat nun **«Archiv»** und **«Nachmessung»** als separate Buttons. Im Archiv werden Kalibrier-, Test- und Nachmessungsprotokolle durchsucht; der Prüfplan-Editor ist nur unter **«Nachmessung»** sichtbar.

In der **klassischen Ansicht** gibt es direkt **unter «EEPROM Viewer»** den eigenen Reiter **«Test / Logging»**. Dieselbe Messmaske funktioniert weiterhin im geführten Einstieg, ohne dass beim Wechsel doppelte Logger entstehen oder laufende Aufzeichnungen verloren gehen.

**Testdauer:** Zusätzlich zu frei wählbaren Abfrageintervallen kann die gewünschte Gesamtdauer in Sekunden, Minuten oder Stunden eingegeben werden. **0 = unbegrenzt** (manuelles Beenden). Nach Ablauf stoppt und speichert die Aufzeichnung automatisch; **Pausen halten die Restzeit an**. Die laufende Einzelmessung wird noch gespeichert, und Testdauer sowie Abschlussgrund erscheinen im Protokoll. [Logger-Anleitung](TEST_LOGGING.md).

## Neu in v0.7.1 – Freies Sensor-Test-Logging

Auf der ersten Seite des geführten Assistenten gibt es die vierte Auswahl **«Test / Logging»**. Hier lassen sich beliebige Versuche durchführen und archivieren, ohne eine neue Kalibrierung oder NVM-Programmierung.

- Freie **Messintervalle von 1 bis 3’600’000 ms**, **1–100 Einzelmessungen pro Messpunkt** sowie ein frei bestimmbarer Abstand dazwischen (0–60’000 ms).
- Pro Messpunkt frei wählbar: **keine Mittelung**, **arithmetischer Mittelwert** oder **Median**. Alle Einzelrohwerte bleiben vollständig erhalten.
- Pro Einzelmessung alle verfügbaren ADC-/DSP-Rohwerte, Statusregister, Zeitstempel und Lesefehler; ausserdem Versorgungsvorgaben, AFE, Hardware/Firmware, UID und Web-App-Version.
- Testname, Beschreibung, Kategorie und Operator. Während der Aufzeichnung: **Pause**, **Einzelaufnahme**, **Marker/Bemerkungen** und optionale manuelle Referenzwerte für Druck, Temperatur und VDD.
- Automatische lokale Speicherung als Archiv-`JSON` plus fortlaufende `JSONL`-Rohdaten in Teilen à maximal 100 Messpunkte; Export eines vollständigen `JSON` oder einer `CSV` mit einzelnen Rohsamples und Mittelwerten. Fremde Dateien im selben Archivordner bleiben unverändert.
- Der tatsächlich erreichte Zeitabstand und ausgelassene Sollintervalle werden protokolliert, weil Web Serial und der Sensor nicht zeitdeterministisch arbeiten.

**Wichtig:** Browser-/USB-Latenzen setzen die tatsächliche Höchstgeschwindigkeit. Die Software misst die reale VDD nicht ohne zusätzliche Hardware; der Istwert kann manuell mit Quelle erfasst werden. Das Feature ist softwaregetestet, aber noch nicht am echten SSP3-/ESP32-Prüfplatz als Gesamtablauf freigegeben. [Schritt-für-Schritt-Anleitung](TEST_LOGGING.md).

## Neu in v0.7.0 – Lokales Kalibrierarchiv und Nachmessung

Der neue Bereich **«Archiv & Nachmessung»** (oben in der Web-App) liest und speichert `elmos-e70311-record`-JSON-Dateien direkt in einem vom Benutzer freigegebenen Ordner. Fremde Dateien werden ignoriert. Es gibt keine Cloudspeicherung. Chrome kann eine erneute Berechtigung verlangen; empfohlen ist HTTPS oder `localhost`.

- Vor dem geführten Abgleich wird ein Prüfprotokoll angelegt und die Ausgangskonfiguration von RAM und den 64 NVM-Wörtern ausgelesen. Auch die klassische Ansicht kann einen Abgleich explizit protokollieren.
- Aufgezeichnet werden Chip-UID und USER-ID, **Web-App-Version und Board/Firmware (SSP3 oder ESP32-Bridge)**, alle aufgenommenen Rohsamples, Referenzen, PGA/Offset, Brückenspannung, DSP-Koeffizienten, Wiederholungen, Verifikationsfehler sowie ursprüngliches und programmiertes NVM.
- VDD-Istwerte werden nur als gemessen gekennzeichnet, wenn sie ausdrücklich als manuelle Messung samt Quelle eingetragen wurden. VDD-Sollwert, aus Registern abgeleitete SVDD und S0/S1-Ausgangssollwerte bleiben davon getrennt.
- Ein neuer Prüfplan-Editor unterstützt frei definierbare Druck- und Temperaturrampen, Umkehrpunkte, mehrere Zyklen und Hysteresepaare. Die Messung wird manuell bei stabilisiertem Prüfpunkt ausgelöst. Vorherige Fehlversuche werden nicht überschrieben.
- Suche und Filter über alle Datensätze im gewählten Ordner, chronologischer Messverlauf, JSON-Export und NVM-Vergleich zweier Protokolle.
- Temperatur-Abweichungen in °C werden nur bei ausdrücklich bestätigter DSP_T-Skalierung als bewertbar behandelt. Eine tatsächliche DUT-VDD- oder externe Temperaturmessung über zusätzliche Geräte ist derzeit **nicht** automatisch implementiert.

**Sicherheitsstatus:** Die neue Archivierung ersetzt keine vollständige Hardwareprüfung. Die bisherige geschützte NVM-Programmierlogik bleibt bestehen; ohne beschreibbares Archiv wird ein neuer NVM-Schreibvorgang gesperrt. Die Software-Regressionstests sind unter `tests/archive.test.cjs` ergänzt. Siehe [Schritt-für-Schritt-Anleitung](ARCHIV_NACHMESSUNG.md).

## PLC-Adresse 0x6C / 0x7C automatisch erkennen (ab v0.6.40; Diagnose v0.6.41)

Beim Verbinden und unter **Sensor neu initialisieren** prüft die Web-App beim echten SSP3/1-Wire zuerst ohne Power-Cycle, ob der Sensor auf **0x6C** oder **0x7C** antwortet. Für die eingereichte Original-PSSC-XML ergibt sich aus `CFG_SPI_I2C=0x7C05` und `CFG_PADS1=0x099F` die Adresse **0x7C**, jedoch nur dann, wenn diese Konfiguration im betreffenden Chip wirklich aktiv ist. CRC8, AFE1, ADC_S und die konfigurierten Adressbits werden verifiziert. Anschliessend wird dieselbe Adresse für Live-Reads, RAM-Änderungen und protokollierte Freigabesequenzen verwendet. Schlägt der direkte Zugriff fehl, greift weiterhin der begrenzte SSP3-Startablauf. **Keine automatische NVM-Programmierung.**

Falls beide Adressen weiterhin keine gültige Antwort liefern, ist ab v0.6.41 oben im Sensor-Warnbanner **«Diagnose exportieren»** direkt verfügbar. Die JSON-Datei erlaubt den Vergleich der gesendeten Befehle und Rückmeldungen. Der frühere Web-Log gehört zu einer anderen Chip-ID als die eingereichte PSSC-XML, deshalb bleibt die tatsächliche Hardware-Adresse unbestätigt. 

Die erkannte Adresse steht bei aktivierten Experteneinstellungen unter **USB & Chip** sowie im SSP3-JSON-Diagnoseexport. Bestehende Tests am echten SSP3 sind weiterhin erforderlich.

## USB-Port-Fehler und Protokoll-Sitzungen trennen (v0.6.39)

Im Testprotokoll des Anwenders vom 12.11.2026 ist ein früherer, erfolgreicher Chipstart um 15:54 UTC enthalten, während nach dem fehlgeschlagenen SSP3-Handshake um 16:03 UTC `chipDetected=false` und `firmware=""` gemeldet werden. Grund: Bei der neuen USB-Verbindung wurde der gespeicherte `startupTrials`-Verlauf bisher nicht zurückgesetzt. Ab v0.6.39 beginnen `startupTrials`, Chiplayout-/Lese-Diagnosen und Sitzungszeit bei jedem neuen Öffnen des USB-Ports neu. Im JSON stehen `sessionStartedAt`, `sessionIndex`, `adapterNoReply` und `readerAlive`.

Wenn der **SSP3 selbst auf `.VERSION` nicht antwortet**, zeigt die App nun **«SSP3 antwortet nicht»** statt nur **«Sensor nicht verbunden»**. Die Aktion **«SSP3-Port neu öffnen»** schliesst auf ausdrücklichen Klick den bereits berechtigten WebSerial-Port und öffnet ihn neu, ohne F5 oder neue Browser-Permission. Dabei wird der reguläre kontrollierte SSP3-/Sensorstart durchgeführt. Ein spontanes Ende des USB-Reader-Loops wird ebenfalls als Adapterunterbruch angezeigt. Die Unterscheidung ist für die Fehlersuche wichtig: Ein USB-Handshake-Timeout beweist nicht, dass der Sensor falsch konfiguriert ist.

Die hochgeladene Datei `ConfigFile_Save.xml` ist ein **originales PSSC-Sensor-Konfigurationsarchiv** und enthält Kalibrier-/NVM-Daten für die Chip-ID `0x200109F7DB`. Im Web-Log wurde zuvor `0020011DBBE7` erkannt. Die IDs sind verschieden. **Die Datei ist nicht mit einer chipunabhängigen Web-Config-Datei gleichzusetzen und darf nicht ungeprüft als NVM-Abbild eines anderen Sensors programmiert werden.** Ob und welche EEPROM-Daten tatsächlich auf den getesteten Chip geschrieben wurden, geht aus dem Web-Log nicht hervor.

## SSP3 PSSC-Bibliothek: PLC-Geschwindigkeiten für bekannten Adapter (v0.6.38)

Beim Prüfen der vom Anwender bereitgestellten Original-Bibliothek `ssp3_lib.dll` zeigte sich, dass die PSSC über `ssp3_plc_set_bit_rate` die dokumentierte `PLC_CFG 1 %04X`-Schnittstelle verwendet. Die darin implementierte neuere Delay-Umrechnung ergibt für die bekannte Firmware `02.08.02.04` die Presets **100 kHz → Delay 0x0007** und **50 kHz → Delay 0x000E**. Diese Werte entsprechen PSSC-Optionen aus der Evaluation-Kit-Einführung (100/50/7/6 kHz).

Die Web-App verwendet ab v0.6.38 beim **ersten** geregelten Startversuch `PLC_CFG 1 0007` und ein gemeinsames USB-Paket `PWR_ON …\rPLC T\r`. Scheitert die Chiperkennung, testet sie bei quittierter VSUPPLY genau **einmal** mit `PLC_CFG 1 000E` und dem bisherigen Zweipaketverfahren. Ein Fehler oder fehlende Quittung bei PLC_CFG wird protokolliert; der bisherige SSP3-Takt bleibt dann unangetastet. Auf anderen oder unbekannten Firmwareversionen wird `PLC_CFG` **nicht** verändert.

Die langsameren PSSC-Modi 7/6 kHz werden bewusst nicht automatisch ausprobiert, weil die Freigabesequenz bei einem möglichen **4-ms-Startfenster** zu lang sein kann. Auch die in der Bibliothek sichtbaren historischen, speziellen Cookie-Telegramme werden ohne experimentell bestätigten Protokollvergleich **nicht** automatisch übertragen; die dokumentierte AN0204-Methode `PLC P/T` bleibt erhalten. `PLC_CFG` verändert **nur den Host-Signaltakt**, keine Chipregister oder NVM-Daten.

Die beiden Versuche sind unter `startupTrials` im JSON enthalten, jeweils mit `plcTestSpeedKhz`, `plcTestDelay`, `plcSpeedApplied`, `plcSpeedError`, `usbWriteMode` sowie den vollständigen bisherigen Antworten. `PWR_ON 0C80 00C8 0` ist weiterhin ein Spannungsschwellwert von 3,2 V mit 200-µs-Wartezeit und **keine VDD-Programmierung**. Für den Hardwareversuch auch die FTDI-Latenz (1 ms) und USB-Transfergrössen (512) prüfen. Änderungen an den Windows-Treibereinstellungen erfordern ausreichende Berechtigungen und erneutes Verbinden.

**Noch nicht mit Jürgs SSP3 verifiziert.** Kein NVM-Schreiben, aber geregelte Labor-Versorgungsschaltvorgänge und temporäre RAM-/AODO-Einflüsse sind möglich. Test nur am vorgesehenen isolierten Prüfaufbau.

## Testbereit für Jürg – Startfenster und FTDI-Latenz (v0.6.37)

Der erste automatische SSP3-Start sendet `PWR_ON 0C80 00C8 0\rPLC T\r` in **einem USB-Schreibvorgang**. Damit entfällt die potenzielle Latenz zwischen zwei USB-Paketen, die bei einem 4-ms-One-Wire-Startfenster problematisch ist. Falls die Chipantwort dennoch ungültig bleibt und die SSP3-Versorgung als eingeschaltet quittiert wurde, führt die App **maximal einen zweiten geregelten Power-Cycle** mit dem bisherigen, getrennten USB-Verfahren durch. Danach erfolgt die vorhandene CRC8- und Mehrregisterdiagnose. Beide Versuche sind im JSON-Export unter `startupTrials` enthalten.

VDD (Sensorversorgung), SVDD (interne Brückenspannung) und der 3,2-V-Schwellwert des SSP3-Befehls `PWR_ON 0C80 00C8 0` sind drei verschiedene Grössen. Der SSP3-Befehl stellt nicht VDD auf 3,2 V ein. `PLC_CFG` bleibt absichtlich unverändert: Die Elmos-Anleitung dokumentiert Clock-Zyklen, aber für die verwendete Firmware ist kein belastbarer Taktwert vorhanden, der eine sichere automatische Umrechnung in 100/50/7/6 kHz erlaubt.

Für den **einzigen nächsten Test** am PC von Jürg: gegebenenfalls im Windows-Geräte-Manager bei den Eigenschaften des FTDI-USB-Serial-Ports den Latency Timer auf **1 ms** und die USB-Transfergrössen auf **512** einstellen (nach Elmos Eval-Kit-Anleitung; das Dokument enthält eine vermutlich falsche Zeiteinheit). Dann die Web-App v0.6.37 neu öffnen und den SSP3 verbinden. Die App führt die beiden Varianten automatisch aus. Anschliessend genau einen JSON-Export über **Web-App-SSP3-Protokoll exportieren** erstellen und übermitteln. FTDI-Einstellungen nur mit ausreichenden Berechtigungen/IT-Freigabe ändern; Port danach erneut öffnen.

Keine automatische NVM-Programmierung. Beide Versuche schalten die SSP3-Versorgung eines isolierten Laborprüflings; ein angeschlossener Analogausgang kann während der One-Wire-Freigabe überlagert werden. Der neue Ablauf wurde noch nicht mit Jürgs Hardware verifiziert.

## Brückenspannung SVDD im AFE einstellen (v0.6.36)

Im AFE-Reiter steht nun **Brückenspannung SVDD** als Auswahl mit 2,4 V (Code 0, Standard), 1,6 V (Code 1) und 2,0 V (Code 2). Die Auswahl liest den Istwert aus **CFG_AFE0 (0x1A), Bits 1:0**; Code 3 bleibt gesperrt. Die Versorgung **VDD** des Chips ist davon verschieden: Für SVDD 2,4 V benötigt VDD mindestens 3,0 V, für 1,6/2,0 V mindestens 2,7 V (siehe E703.11 25DS0170E.04, Kapitel 6.2.1.2, Tabelle 4.4-1 und CFG_AFE0).

Erst **«Brückenspannung ins RAM übernehmen»** schreibt den gewünschten Code. Vorher erfolgt eine frische CFG_AFE0-Lesung, die Schreiboperation verändert ausschliesslich Bits 1:0 und bewahrt **br_gain und sämtliche übrigen Bits**. Die Rücklesung wird mit dem Sollregister verglichen, Boot-/Kommunikationsregister bleiben überwacht; Messpunkte werden nach Änderung verworfen. Keine automatische NVM-Programmierung. Der Wert wird im Demo-Modus simuliert und optional in neuen Config-v2-Dateien gespeichert. Alte Config-Dateien ohne `bridgeSupply` lassen den Istwert unverändert.

Wichtig: **Die Änderung hilft nicht beim Initialisieren eines Chips, der überhaupt nicht erkannt wird**, denn zum Schreiben von CFG_AFE0 ist bereits ein bestätigter Registerzugriff nötig. Ein unpassendes SVDD kann Messsignal und Brückendiagnose beeinflussen, aber die bisherigen Jürg-Logs beweisen keine solche Ursache. Die bestehende SSP3-Initialisierung und die dortigen PWR_ON-Schwellen bleiben unverändert. Die Kombination aus Brückenspannung und br_gain muss zum zulässigen Brückenstrom passen. Hardwaretest ausstehend.

## Weitere Diagnose nach Jürgs zweitem SSP3-Protokoll (v0.6.35)

Im zweiten Protokoll wird die Magic Cookie jetzt korrekt ausgelöst und beide Telegramme werden vom SSP3 quittiert. Trotzdem liefert CFG_AFE1 vor **und** nach dem Fallback die Daten `00 00 35` (Registerwert `0x0000`). Die CRC8 `0x35` stimmt für das Antwortformat [Registeradresse 0x1C, CRC4-Header 0x0C, Slave-Präambel 0x02, Daten 00 00] überein. Der Web-App-CRC8-Algorithmus wurde mit dem E703.11-Datenblattbeispiel (Adresse 0x6A, Daten 0x1234, CRC8 0x65) verifiziert.

Die Web-App prüft CRC8 ab v0.6.35 selbst. **Eine gültige CRC bestätigt nur das Datenformat und die Integrität des Frames, nicht die Plausibilität des Sensors oder den Erfolg der Magic Cookie.**

Wenn die Initialisierung nach dem vorhandenen PLC P/T-Start und dem RAM-Fallback weiterhin scheitert, werden **erst danach** fünf verschiedene Register `CFG_EN`, `CFG_PADS0`, `CFG_PADS1`, `CFG_AFE1` und `ADC_S` nur lesend geprüft. Proben, Rohantworten und CRC-Ergebnisse werden im SSP3-JSON-Protokoll unter `powerCycle.failureProbes` sowie `chipDiag.probes` gespeichert. Es werden keine zusätzlichen Start-/RAM-/NVM-Schreibbefehle ausgeführt und das kurze One-Wire-Startfenster wird nicht durch die Diagnose verzögert.

Offene Punkte: Unterschied der PLC_CFG-/Startsequenz der Original-PSSC-Software, tatsächliches One-Wire-Startfenster (4/10/200 ms), reales VSUPPLY-Verhalten am AODO-Prüfplatz. In AN 0204 ist `PWR_ON 0C80 00C8 0` ein **3.2-V-Spannungsschwellwert plus 200-µs-Verzögerung**, keine Einstellung einer Ausgangsspannung auf 3.2 V.

## SSP3-Protokoll von Jürg: 0x0000-Fallback (v0.6.34)

Das am 12.11.2026 exportierte Web-App-Protokoll zeigt, dass die SSP3-Kommandos PWR_OFF, PLC P, PWR_ON und PLC T quittiert wurden. Die erste Registerabfrage von CFG_AFE1 (0x1C) lieferte jedoch die formal parsebare Antwort `00 00 35` und damit `0x0000`. Der bisherige automatische Magic-Cookie-Fallback behandelte ausschliesslich `PLC nothing received`; er wurde in diesem Fall **nicht aufgerufen**.

v0.6.34 behandelt **ausschliesslich** einen tatsächlich gelesenen AFE-Nullwert (`AFE_ZERO_READBACK` mit passendem PLC-Antwortdatensatz) zusätzlich zum expliziten `PLC nothing received` als einmaligen Auslöser für den bereits vorhandenen, dokumentierten Magic-Cookie-RAM-Fallback. Alle anderen unplausiblen AFE-Werte, Parsing- und Kommunikationsfehler bleiben gesperrt. Nach dem Fallback muss die Chiperkennung den AFE-Wert und ADC_S erneut erfolgreich lesen. Eine blosse SSP3-Befehlsquittung genügt nicht.

**Noch nicht auf Jürgs Prüfplatz verifiziert.** Im E703.11-Datenblatt ist für die PLC-Freigabe ein konfigurierbares 4/10/200-ms-Startfenster dokumentiert. Falls die Cookie-Sequenz nach der ersten fehlgeschlagenen Leseabfrage zu spät eintrifft, kann der Fehler trotz Anpassung bestehen bleiben. Keine automatische NVM-Programmierung; RAM-/Ausgangsänderungen während der One-Wire-Freigabe sind möglich. Die Startspannung ist derzeit `PWR_ON 0C80` (3.2 V); bei weiteren Fehlern mit der originalen PSSC-Einstellung abgleichen. Für die weitere Diagnose nach einem erneuten Versuch das SSP3-Web-Log aus dem Expertenmodus exportieren.

## Rücknahme der Temperaturanzeige (v0.6.33)

Die zusätzliche Temperaturanzeige in °C aus v0.6.32 wurde auf Wunsch zurückgenommen. Oben werden wieder nur **ADC_S, ADC_T, DSP_S und Sensorwert** angezeigt. DSP_T wird nicht mehr im Live-Zyklus abgefragt. Die Sensor-Neuinitialisierung ohne Seitenneuladen aus v0.6.31 bleibt erhalten.

Wenn SSP3 zwar über USB erreichbar ist, aber vom E703.11 nur eine nicht plausible Antwort wie CFG_AFE1=0x0000 zurückkommt, zeigt die App einen verständlichen Hinweis zur Prüfung von Sensor, Versorgung und 1-Wire-Verbindung. Die vollständige technische Fehlermeldung bleibt im TX/RX-Protokoll. Dies ersetzt keinen Hardwaretest und bestätigt nicht die eigentliche Ursache.

## Sensor getrennt / erneut anschliessen (v0.6.31)

Wenn während der Live-Messung zweimal hintereinander keine gültige ADC_S-Antwort vom E703.11 ankommt, stoppt die App die Live-Abfrage. Im Kopf erscheint «Sensor nicht verbunden» und darunter der Knopf **«Sensor neu initialisieren»**. Der USB-Port des SSP3 bleibt offen; ein F5-Neuladen ist nicht nötig. Einzelne kurzzeitige Lesefehler lösen noch keinen Sensorwechsel aus.

Nach dem Wiederanschliessen den Knopf verwenden. Für SSP3 + 1-Wire wird der bereits vorhandene, kontrollierte VSUPPLY/PLC-Start einschliesslich des geprüften RAM-Magic-Cookie-Fallbacks wiederholt. Das kann den analogen Ausgang während des Tests beeinflussen, programmiert aber **kein NVM/EEPROM**. Für andere Adapter/Schnittstellen wird die jeweilige Schnittstelle neu konfiguriert und der Chip erneut erkannt.

**Sicherheitsregel:** Bei Kommunikationsverlust werden aktuelle Messwerte, RAM-/NVM-Schreibfreigaben und erfasste Kalibrierpunkte in der aktuellen Sitzung zurückgesetzt. Vor erneuter Programmierung ist eine neue Prüfung erforderlich. Technische Details bleiben im USB-Protokoll. Die Wiederinitialisierung ist noch nicht mit einem realen Sensorwechsel als vollständiger Hardwaretest bestätigt.

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

Für Entwickler gibt es **64 Software-Regressionstests** (Stand v0.6.30) mit Node.js: `node --test tests/safety.test.cjs`. Geprüft werden Boot-/Kommunikationsschutz, One Wire only, S0/S1-Skalierung, die sieben Kalibrierschritte, der separate EEPROM-Reiter, das Einblenden der Expertenparameter und der sichere Config-Import/-Export. Die Tests ersetzen keine Browser- und Hardwareprüfung.

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

**Versions- und Cache-Hinweis:** Die Skript-Dateien (inklusive `config.js`) werden in v0.6.30 mit derselben Versionskennung wie die Web-App geladen. Für die Überprüfung im Browser gegebenenfalls mit `Ctrl + F5` neu laden.


### Aktueller SSP3-Verbindungsbefund (12.11.2026, v0.6.30)

In der originalen Elmos-PSSC-Software lässt sich ein Sensor mit analogem 0–5-V-Ausgang und 4-ms- oder 200-ms-PLC-Startfenster **ohne manuelle Unterbrechung der Versorgung** weiterhin programmieren. Die Web-App verwendet momentan `IF_CFG 7 0 0` und sendet dann `PLC 026D1C0C.`; SSP3 antwortet dabei mit `!PLC nothing received`. Das bedeutet: Der SSP3 verarbeitet das Hostkommando, aber es wurde **keine Sensorantwort** empfangen; es liegt weder ein verifiziertes Chip- noch ein CRC-Problem vor.

**Noch nicht gelöst:** Die unbekannte Original-SSP3-Start-/Freigabesequenz kann nicht aus dem E703.11-Datenblatt allein abgeleitet werden. PSSC könnte die DUT-Versorgung über das SSP3 neu starten, eine PLC-Magic-Cookie-Freigabe verwenden oder I²C/SPI nutzen. Eine entsprechende Funktion wird erst integriert, wenn ihre Befehle und Nebenwirkungen anhand eines echten PSSC-Protokoll-Traces geprüft wurden.

Unter **USB & Chip → SSP3-Verbindungsdiagnose** gibt es jetzt den **Export des Web-App-SSP3-Protokolls** für den Vergleich. Die ergänzende 12-s-PLC-Lesediagnose ist optional und ersetzt keinen Boot-Handshake. **Kein Sensor muss manuell abgesteckt werden, bloss weil die Web-App keine Antwort erhält.**


### Experimenteller Magic-Cookie-Test v0.6.30 (12.11.2026)

Unter **USB & Chip → SSP3-Verbindungsdiagnose → Experimentell · One-Wire-Magic-Cookie (RAM)** kann eine einzige exakt definierte E703.11-Magic-Cookie-Sequenz manuell getestet werden. Sie ist nicht Teil des automatischen Verbindungsaufbaus. Nach ausdrücklicher Warnbestätigung sendet die Web-App über den bereits geöffneten SSP3 direkt nacheinander `PLC 026CAC0F2B4299` (0xAC → 0x2B42) und `PLC 026C0E095CFDCA` (0x0E → 0x5CFD), dann versucht sie die bestehenden Register-/ADC-Abfragen. Keine NVM-Programmierung. Das PLC-Write-Format wurde gegen das Elmos-Datenblatt 25DS0170E.04 §6.4.5.6.2 geprüft (`PLC 026C6A0A67895F`). Ein SSP3-Prompt belegt die erfolgreiche Übernahme durch den Sensor **nicht**; nur echtes erfolgreiches Registerlesen bestätigt den Zugriff. Die Antwort und beide Befehle werden im USB-Protokoll exportiert.

**Sicherheitsgrenze:** Bei erkannter Cookie-Sequenz wird `CFG_PADS1.plc_rw_en` und `CFG_SPI_I2C.plc_en` flüchtig aktiviert. Damit kann der normale 0–5-V-AODO-Ausgang bis zum Sensor-Reset entfallen. Nur am nicht sicherheitskritischen Prüfplatz ausführen. Ist das Startfenster bereits abgelaufen, genügt die Sequenz nicht; ohne belegten SSP3-Sensorstart kann der Test weiterhin fehlschlagen.


**Zusätzliche einmalige Startvariante:** Vor dem USB-Verbinden im experimentellen Bereich zuerst den Warnhinweis bestätigen, dann «Einmalig beim nächsten SSP3-Verbinden vor dem ersten Registerlesen testen» anhaken. Die App sendet nach dem SSP3-Handshake und `IF_CFG` die beiden Magic-Cookie-Frames *vor* jedem Chip-Leseversuch. Die Auswahl wird sofort gelöscht und bei der nächsten Verbindung nicht ohne erneute Freigabe ausgeführt. Auch diese Variante kann ein zuvor abgelaufenes NVM-PLC-Startfenster nicht eigenständig wieder öffnen.

## SSP3-Sensorstart nach Elmos AN 0204 (v0.6.30, 12.11.2026)

Der Anwender hat die Hersteller-Application-Note AN 0204 bereitgestellt, die erstmals die zuvor unbekannten SSP3-DUT-Power-Befehle dokumentiert. Nach einer expliziten Bestätigung am isolierten Prüfplatz kann die Web-App folgenden **einmaligen Test** über schaltbare SSP3-VSUPPLY durchführen:

`IF_CFG 7 0 0` → `Power_OFF 03E8` (1000 mV Abschaltschwelle) → 30 ms Ruhe → `PLC P` (Cookie vorbereiten) → `PWR_ON 0C80 00C8 0` (Herstellerbeispiel 3200 mV, 200 µs, Einzelsocket) → unmittelbar `PLC T` → bestehende Chipregister-/ADC-Erkennung.

**Achtung:** Der Abschaltbefehl heisst laut Seite 7 **`Power_OFF`**, während der Einschaltbefehl **`PWR_ON`** heisst. Bei Fehlschlag nach einem begonnenen Ausschalten versucht die App dokumentiertes `PWR_ON 0 0 0` zur Wiederherstellung. Im Log stehen die Antworten und Laufzeiten jeder Stufe.

Aufruf: **USB & Chip → SSP3-Verbindungsdiagnose → Neu · SSP3-Sensorstart (AN 0204, Prüfplatz)**. Alternativ gibt es eine einmalige Opt-in-Option beim nächsten Connect **vor dem ersten Registerlesen**. Die Originalsoftware-Sequenz ist mangels Mitschnitt weiterhin nicht 1:1 belegt; insbesondere ein 4-ms-Startfenster ist durch Browser-/USB-Latenzen nicht garantiert. Nur bei über SSP3-VSUPPLY versorgtem Prüfsensor verwenden; externes VDD wird eventuell nicht geschaltet. Keine NVM-Programmierung, aber temporäre Überlagerung des analogen AODO-Ausgangs ist möglich.


### Firmwareabweichung SSP3 / AN0204 (v0.6.30, 12.11.2026)

**Echter SSP3-Test:** Das dokumentierte `Power_OFF 03E8` wurde von der vorhandenen SSP3-Firmware ausdrücklich als `Unknown command (POWER_OFF)` abgewiesen. Der Notfallbefehl `PWR_ON 0 0 0` wurde dagegen bestätigt. Die PLC-Pufferbefehle `PLC P` und `PLC T` wurden deshalb im letzten Test noch überhaupt nicht ausgeführt; es gab keinen nachgewiesenen Sensor-Power-Cycle.

Die v0.6.30 erlaubt die **rein lesende Firmware-Befehlsauskunft mit `?`** im SSP3-Diagnosebereich. Die vollständige Antwort wird angezeigt und exportiert. Der experimentelle Power-Starttest liest die Hilfe vor dem ersten Ausschaltversuch selbständig und läuft nur weiter, wenn diese konkrete Firmware ausdrücklich `PWR_OFF` aufführt. Nur dann wird mit bestätigter Prüfplatzfreigabe das alternative `PWR_OFF 03E8` gesendet und anschliessend `PLC P`, `PWR_ON 0C80 00C8 0`, `PLC T` und der echte Chip-Lesetest. Fehlt der Befehl, stoppt der Test **ohne** Ausschaltbefehl; bei begonnener Abschaltung wird nach Fehler ein `PWR_ON 0 0 0` zur Wiederherstellung versucht. Diese PWR_OFF-Schreibweise ist eine **bedingte, noch nicht an Hardware bestätigte Abweichung von AN0204**, nicht als dokumentiert ausgegeben.

Die originale PSSC-Firmwaresequenz bleibt bis zum Vergleich eines PSSC-Traces unbewiesen. Die Bereitstellung von `?` allein ist noch keine Bestätigung, dass die betreffende Firmware eine unterbrechbare SSP3-VSUPPLY unterstützt.

## Experimenteller PLC-Syntaxvergleich für SSP3-Firmware v02.08.02.04 (v0.6.30, 12.11.2026)

Das reale SSP3-Log belegt einen bestätigten Host-Handshake für `PWR_OFF 03E8` (15 ms), `PLC P` (18 ms), `PWR_ON 0C80 00C8 0` (15 ms) und `PLC T` (16 ms). **Ein Chipregister konnte danach noch nicht gelesen werden.** Der Schluss, die Stromversorgung sei elektrisch tatsächlich ein- und ausgeschaltet worden, ist allein aus der Hostbestätigung nicht beweisbar. Die aktuelle Originalsoftware-PLC-Startsequenz ist weiterhin nicht mitgeschnitten.

Neu ist ein konkreter möglicher Syntaxunterschied: **Elmos AN 0204** dokumentiert `PLC 026D1C0C.` als zusammenhängendes Hostargument, die vom vorhandenen SSP3 selbst ausgegebene `?`-Hilfe nennt dagegen `PLC <slave_id> <data>`. Deshalb bietet **USB & Chip → SSP3-Sensorstart → PLC-Befehlsformat** die beiden Testvarianten:

- **AN0204 / Legacy (Standard):** `PLC 026D1C0C.`
- **SSP3-Firmwarehilfe / Slave-ID separat:** `PLC 02 6D1C0C.`

Die jeweils gewählte Hostformatierung wird nach dem ausdrücklich freigegebenen, einmaligen Versorgungstest auf die **erste reine Registerabfrage** angewendet. Erhält die App gültige Registerdaten, wird das Format für die restliche Sitzung beibehalten; auch spätere PLC-Schreibtelegramme werden dann entsprechend formatiert, aber erst nach unveränderten NVM-/RAM-Sicherheitsprüfungen. Die One-Wire-Chipdaten und CRC-Felder werden **nicht** geändert, nur das Leerzeichen im SSP3-ASCII-Kommando. Keine NVM-Programmierung beim Test. Der Vergleich klärt eine echte Firmwareabweichung, garantiert aber keine Freigabe bei 4-ms-Startfenster. Pro Durchlauf nur **eine** Variante versuchen und anschliessend das JSON-Log exportieren.

## Startfenster im NVM beibehalten · Diagnose verborgen (v0.6.30)

Ein E703.11 kann nach jedem Einschalten ein One-Wire-Zeitfenster von 4, 10 oder 200 ms auf AODO öffnen. Danach erscheint der konfigurierte Analogausgang. Die im NVM vorhandene `CFG_PADS0.startup_plc`-Einstellung (CM-Wort 18) wird bei jeder normalen Kalibrier-NVM-Programmierung **bitgenau beibehalten**, ebenso `CFG_SPI_I2C` (CM-Wort 17) und `CFG_PADS1` (CM-Wort 19). Die App programmiert diese geschützten Interface-/Bootregister nicht automatisch um.

Das Datenblatt 25DS0170E.04 §§6.4.5.7–8 erlaubt einen Magic-Cookie-basierten Start auch mit im NVM deaktivierten `plc_us_en` und `plc_rw_en`, sofern ein zeitlich begrenztes Fenster vorhanden ist. Der alte Startschutz verwechselte dies mit vollständig deaktiviertem One Wire. Die neue Prüfung akzeptiert diesen Zustand **nur dann für dauerhaftes Kalibrier-NVM-Schreiben**, wenn die schaltbare SSP3-Versorgung, die anschliessende One-Wire-Lesung und die **gleiche Chip-UID** in dieser Sitzung bestätigt sind. Ohne diesen Nachweis bleiben NVM-Programmierung und Boot-Änderungen gesperrt.

Die zusätzlichen SSP3-Fehlersuchwerkzeuge bleiben technisch vorhanden, sind aber im normalen Arbeitsablauf ausgeblendet. Sie lassen sich über **⚙ Einstellungen → Expertenparameter freischalten → USB & Chip** erneut öffnen. Der EEPROM-Viewer und die normalen Kalibrierfunktionen bleiben unverändert.

**Wichtig:** Das Update schreibt selbst nichts in den Sensor. Das Startfenster bleibt genau so lange aktiv, wie es im Original-NVM eingestellt ist, und wird nach jedem Kaltstart neu geöffnet. Eine erfolgreiche echte NVM-Programmierung mit dieser Änderung ist noch nicht hardwaregetestet.

### Normaler SSP3-Verbindungsaufbau wiederhergestellt (v0.6.30, 12.11.2026)

**Korrigierter Hardwarebefund:** Trotz der Anzeige `PLC <slave_id> <data>` in der SSP3-Firmwarehilfe wird `PLC 02 6D1C0C.` ausdrücklich mit `!PLC frame contains invalid data ( )` abgewiesen. Die tatsächliche USB-Kommunikation erfordert das kompakte Telegramm `PLC 026D1C0C.` ohne zusätzliches Leerzeichen. Die Web-App stellt für die bekannte SSP3-Firmware `@02 08 02 04` nun das Legacy-Format ein.

**Neue Standardverbindung am bestätigten SSP3-Prüfplatz:** Bei Adapter **SSP3** und Chip-Schnittstelle **One Wire/AODO** wird ohne zusätzliche Checkbox immer der dokumentierte Neustart der schaltbaren SSP3-VSUPPLY durchgeführt: `IF_CFG 7 0 0` → `?` → `PWR_OFF 03E8` → `PLC P` → `PWR_ON 0C80 00C8 0` → `PLC T` → `PLC 026D1C0C.`. Andere Schnittstellen (I²C, SPI) und die ESP32-Bridge nutzen diesen SSP3-Power-Pfad nicht. Die bestehenden Schutzbedingungen und der Versuch einer Wiederherstellung der VSUPPLY nach Fehlern bleiben erhalten. **Voraussetzung für einen sicheren Einsatz ist weiterhin, dass der Prüfsensor tatsächlich über die schaltbare SSP3-VSUPPLY versorgt wird und eine kurze Stromunterbrechung verträgt.**

Die zuletzt hinterlegte 4/10/200-ms-Startup-Einstellung bleibt im Sensor-NVM unverändert und öffnet sich nach jedem Kaltstart wieder. Eine erfolgreiche Versorgungsschaltung und NVM-Sicherheit müssen vor der NVM-Programmierung weiterhin geprüft werden; ein echter Test der neuen Startautomatik steht noch aus. Zusatzdiagnosen bleiben hinter «Expertenparameter freischalten» verborgen.

### v0.6.30 – verbindlicher SSP3-Hardwarebefund und automatischer Start (12.11.2026)

Der kombinierte Test mit dem getrennten ASCII-PLC-Frame `PLC 02 6D1C0C.` scheiterte am SSP3 mit `!PLC frame contains invalid data ( )` noch **bevor** eine Sensorantwort verarbeitet werden konnte. Die Firmwarehilfe gibt das interne Parameterformat missverständlich wieder. Deshalb wird der getrennte Modus in der Expertenansicht deaktiviert und für SSP3-Firmware `02.08.02.04` die originale kompakte Form erzwungen. Beim Verbinden mit SSP3+OneWire ist der bereits mehrfach geprüfte Stromstart jetzt **immer aktiv**, ohne UI-Checkbox und unabhängig von einem früheren Browserwert. `PLC P` und `PLC T` werden durch die Firmware ausgelöst; andere Schnittstellen bleiben davon unberührt. Der Schritt schreibt niemals NVM. Die ursprünglichen geschützten Interface-NVM-Wörter 17/18/19 und das beim Sensorstart verfügbare One-Wire-Fenster werden durch eine spätere Kalibrier-NVM-Aktualisierung unverändert beibehalten. Die neuen Diagnosebereiche bleiben standardmässig verborgen. Ein erfolgreicher Hardware-Retest der v0.6.30 steht noch aus.

### v0.6.30 – schneller SSP3-PLC-Start bei 4-ms-Fenster (12.11.2026)

Das bisherige Hostprotokoll wartete zwischen `PWR_ON 0C80 00C8 0` und `PLC T` auf eine komplette USB-Antwort. Frühere reale Logs zeigten dabei rund **15 ms**, was das beim E703.11 auf **4 ms** programmierte Startfenster bereits überschreitet. Die Elmos AN 0204 §2.3.4 dokumentiert, dass `PLC P` den Cookie-Frame vorbereitet und `PLC T` den Puffer überträgt. Das Datenblatt 25DS0170E.04 §6.4.5.8 verlangt, dass die Cookie-Sequenz vollständig während des Startfensters übertragen wird.

Für den **normalen SSP3 + 1-Wire**-Verbindungsaufbau bleibt daher die dokumentierte Reihenfolge `IF_CFG 7 0 0`, `PWR_OFF 03E8`, `PLC P` erhalten. Neu werden `PWR_ON 0C80 00C8 0\rPLC T\r` **ohne USB-Antwort-Wartezeit in einer einzigen seriellen Schreiboperation** an die SSP3-Firmware übermittelt. Die Software erwartet anschliessend **zwei getrennte Firmware-Prompts**, prüft die Quittung beider Kommandos und liest erst danach die E703.11-Register. Bei Fehlern wird die bisherige Strom-Wiederherstellungsroutine angewendet. Es werden **keine NVM-Werte verändert** und keine undokumentierten Sensorbefehle gesendet.

**Hardwarevorbehalt:** Die SSP3-Firmware muss mehrere CR-getrennte Befehle in einer USB-Schreiboperation korrekt puffern und verarbeiten; dies ist aus AN 0204 nicht ausdrücklich garantiert. Ein erfolgreicher Hardwaretest steht noch aus. Auch mit schnellerem Hostversand kann insbesondere bei 4 ms das zeitliche Verhalten der SSP3-Firmware oder die PLC-Bitrate weiterhin einen Zugriff verhindern. Dann sind die tatsächlichen SSP3-Antworten auszuwerten und nötigenfalls die PLC_CFG-Einstellungen beziehungsweise ein Original-PSSC-Trace zu vergleichen.

### v0.6.30 – SSP3-Power-Start: einzelne serielle Befehle ohne Wartepause (12.11.2026)

Der reale SSP3 mit Firmware `02.08.02.04` hat den v0.6.21-Versuch `PWR_ON 0C80 00C8 0\rPLC T\r` in einem einzelnen Web-Serial-Write nicht mit beiden Prompts beantwortet. Ein kombinierter USB-Write ist damit **nicht als unterstützt bestätigt**. In v0.6.30 werden die beiden CR-terminierten SSP3-Kommandos als **zwei separate `writer.write()`-Aufrufe** in derselben seriellen Writer-Sitzung übertragen, aber ohne zwischenzeitliches Warten auf die `PWR_ON`-Antwort. Erst danach werden zwei SSP3-Prompts sowie die Echozeilen `#PWR_ON` und `#PLC T` überprüft. Die Übertragungsdauer der beiden Writes wird gemessen.

Bei einem Timeout wird die **tatsächlich bis dahin empfangene Teilantwort**, die Zahl der Prompts und gegebenenfalls ein Schreibfehler im Feld `powerCycle` des exportierten JSON-Logs gesichert. Aus einem einzigen Prompt darf die App nicht auf eine erfolgreiche PLC-Freigabe schliessen. Die bestehende VSUPPLY-Wiederherstellung nach Fehlschlag bleibt bestehen. Kein NVM-Schreiben, keine Änderung von `CFG_PADS0.startup_plc` oder der geschützten Interface-Konfiguration.

**Einschränkung:** Auch zwei unmittelbar aufeinanderfolgende Web-Serial-Schreibaufrufe können für ein 4-ms-Startfenster zu langsam sein, je nach Betriebssystem und SSP3-Firmware. Ein tatsächlicher Zeitnachweis ist erst mit dem SSP3-Hardwaretest möglich. Bleibt die Übertragung unzuverlässig, ist eine adapterseitige Sequenzierung oder ein Original-PSSC-Protokollvergleich erforderlich, statt weitere blinde Timing-Versuche zu senden.

### v0.6.30 – SSP3-Antwortparser akzeptiert verkettete Prompt-/Echo-Fragmente (12.11.2026)

**Echter SSP3-Hardwarebefund mit v0.6.22:** Zwei getrennte Web-Serial-Schreibaufrufe für `PWR_ON 0C80 00C8 0` und `PLC T` wurden beide vom SSP3 quittiert. Der empfangene Text enthält jedoch `#PWR_ON 0c80 00c8 0000 :#PLC T :` – die Firmware schreibt den Doppelpunkt-Prompt direkt vor das nächste Kommandoecho, ohne zwingend einen zusätzlichen Zeilenumbruch. Der bisherige `ssp3PromptCount()` zählte nur einen Doppelpunkt auf einer eigenen Zeile und lieferte deshalb falsch **1/2**; auch die Echo-Prüfung für `#PLC T` war zu streng.

In v0.6.30 erkennt der Parser `:` vor dem folgenden `#`-Kommandoecho oder am Antwortende auch ohne CR/LF. `PWR_ON` und `PLC T` werden getrennt als Echo nach Start/Prompt-Grenze verifiziert, ohne auf einen Zeilenbeginn beschränkt zu sein. Der Sender bleibt identisch: zwei serielle Writes direkt nacheinander, dann zwei SSP3-Quittungen auswerten und erst danach echte E703.11-Register lesen. Keine Änderung an Versorgungskommandos, PLC-Telegramm, Konfigurationsmemory/NVM oder Bootstartfenster.

**Noch nicht bewiesen:** Dass der E703.11 den PLC-Cookie innerhalb seines konfigurierten Fensters empfangen hat. Die neue Prüfung beseitigt ausschliesslich einen Hostparser-Fehler und lässt den Chipzugriff erstmals nach diesem Burst wieder testen. Hardwareergebnis des nachfolgenden Registerlesens muss separat geprüft werden.

### v0.6.30 – Automatischer Magic-Cookie-Fallback nach SSP3-Start (12.11.2026)

Der echte E703.11 liess sich nach Angaben aus dem Prüfversuch über den separaten Magic-Cookie-Test erreichen, während der normale SSP3-Power-Start mit `PLC P`/`PLC T` und anschliessender Lesung nur `!PLC nothing received` lieferte. Daher wird **bei SSP3 + One Wire automatisch genau einmal** folgender, bereits manuell erprobter Fallback verwendet, **nur wenn der erste PLC-Register-Lesezugriff keine Chipantwort erhält**:

1. Bestehender dokumentierter Power-Start: `PWR_OFF 03E8` → `PLC P` → `PWR_ON 0C80 00C8 0` und `PLC T` schnell hintereinander.
2. Erste reine Register-Lesung. Wenn gültig, ist keine zusätzliche Magic Cookie nötig.
3. Ausschliesslich bei `!PLC nothing received` zwei spezielle CRC-geschützte PLC-Writes: `PLC 026CAC0F2B4299` (0xAC→0x2B42) und direkt danach `PLC 026C0E095CFDCA` (0x0E→0x5CFD).
4. Erneut echten E703.11-Registerzugriff lesen und erst dann die Verbindung/Chip-UID als erfolgreich markieren.

Die zwei Schreibtelegramme sind nach E703.11-Datenblatt §6.4.5.7 eine **flüchtige RAM-/One-Wire-Freigabe**, keine NVM- oder Factory-Programmierung. Jeder Schritt und die tatsächliche Leseantwort werden im SSP3-JSON-Protokoll erfasst. Bei Zeitüberschreitung, anderer Chip-Fehlermeldung oder ungültigen AFE-Daten erfolgt **kein** stillschweigender Wiederholungsversuch und kein NVM-Schreiben. Der normale Kalibrierweg und die geschützten Startregister in NVM 17, 18 und 19 bleiben unverändert. Bei einem erfolgreichen Fallback wird die SSP3-Power-Startverifikation auf die aktuelle UID bezogen, damit der vorhandene NVM-Schutz weiter funktioniert.

**Hardwarevorbehalt:** Ob dieser Fallback automatisch funktioniert, ist noch nicht bestätigt. Bei sehr kurzen NVM-Startfenstern kann das zusätzliche Senden nach einem ersten fehlgeschlagenen Lesen bereits zu spät sein. Der Befund des manuellen Tests macht diesen Versuch aber gegenüber weiteren undokumentierten SSP3-Kommandos sinnvoll.

### v0.6.30 – Live-ADC nach Magic-Cookie-Erkennung stabilisiert (12.11.2026)

Der Nutzer bestätigt, dass sich der Chip mit dem automatischen SSP3-Magic-Cookie-Verbindungsablauf von v0.6.24 erkennen lässt, aber anschliessend die Live-Werte fehlen. **Codeanalyse:** Der alte `readADC()`-Pfad fragte zuerst `ADC_TC (0x26)`, dann `ADC_T (0x28)` und erst zuletzt `ADC_S (0x2A)` ab. Wenn ein Temperaturregister keinen PLC-Frame liefert, blieb **auch ADC_S leer**, selbst bei funktionierender Druckkommunikation; nach nur drei Fehlern stoppte die Endlosschleife.

**Änderungen:** Die Chiperkennung liest AFE und ADC_S, übernimmt den bereits bestätigten Druck-Rohwert sofort in die Anzeige und versucht weitere Live-Register unabhängig. Der **Live-Pfad** liest ADC_S als Erstes und behandelt fehlende ADC_T-/ADC_TC-/DSP_S-Antworten einzeln; nicht gelesene Werte werden als nicht verfügbar markiert, nie erfunden. Der **strenge Kalibrierpfad** behält die vollständige Messpunktaufnahme von ADC_S, ADC_T und ADC_TC und die bestehenden Schreiben-/NVM-Sicherheitsprüfungen. Die kontinuierliche Live-Schleife beginnt beim automatischen SSP3-Start erst, nachdem die Magic-Cookie-/Power-Start-Verifikation beendet ist. Vorübergehende ADC_S-Ausfälle werden mit begrenzter Wiederholung (bis 10 aufeinanderfolgende Fehler, danach Stop mit klarer Fehlermeldung) behandelt, ohne zusätzliche Power-Cycles oder RAM-/NVM-Schreibbefehle.

Die Änderung behebt die UI- und Abbruchabhängigkeit vom Temperaturregister. **Ob tatsächlich alle ADC-/DSP-Register über die Hardware erreichbar sind, ist noch nicht bestätigt**; wenn gerade ADC_S selbst nicht antwortet, liefert die App nun eine gezielte Diagnosemeldung statt stillschweigend leerer Werte.

### v0.6.30 – Kontinuierliche Live-Messung ohne Blockierung durch weitere Sensorregister (12.11.2026)

Nach dem automatischen Magic-Cookie-Start liefert der Sensor beim Seitenaufbau einen initialen Wert, aber gemäss Hardwarefeedback bisher keine laufenden Live-Aktualisierungen. Die bis v0.6.25 verwendete Live-Abfrage versuchte bei jedem Zyklus **ADC_S, ADC_T, ADC_TC und DSP_S nacheinander**; jeder fehlende Registerzugriff konnte einen Timeout auslösen und die nächsten Druckwerte deutlich verzögern. Nach zehn fehlgeschlagenen ADC_S-Lesungen wurde die Live-Schleife vollständig gestoppt.

Die neue `readLiveSample()` liest in **jedem Zyklus zuerst ADC_S (Register 0x2A)** und ruft sofort `updateADC` auf, damit Anzeige, Verlauf und geführter Abgleich regelmässig neue Druckwerte erhalten. Die sekundären Register werden rotierend abgefragt: Zyklus 1 ADC_T (0x28), Zyklus 2 ADC_TC (0x26), Zyklus 3 DSP_S (0x30), Zyklus 4 nur ADC_S. Misslingt ein Sekundärregister, wird **ausschliesslich dieser Wert** als nicht verfügbar protokolliert; ADC_S bleibt unabhängig. Sekundärabfragen sind zeitlich auf 1100 ms begrenzt, ADC_S auf 1600 ms. Zwischen erfolgreichen Zyklen liegen nominell 650 ms plus die tatsächliche SSP3-Kommunikationszeit.

Bei nicht beantworteten ADC_S-Abfragen bleibt die Live-Schleife trotz mehrerer Aussetzer aktiv (erneute Abfrage alle 2 s), **zeigt aber keine erfundenen oder künstlich aktualisierten Messwerte**. Der Status weist auf die fehlenden aktuellen ADC-Daten hin und protokolliert die Anzahl aufeinanderfolgender Leseprobleme. Strenge Kalibrier-Messpunktaufnahmen bleiben wie zuvor auf vollständige Druck-/Temperaturantworten angewiesen; NVM, Startfenster und der bestätigte Magic-Cookie-Verbindungsablauf werden nicht verändert.

**Hardwarevorbehalt:** Bei anhaltendem `!PLC nothing received` auf ADC_S nach dem Startup handelt es sich möglicherweise um eine nicht dauerhaft aktivierte 1-Wire-RAM-Freigabe. Dies kann die Software nicht durch häufigeres Lesen beheben; das neue Verhalten und das USB-Log machen diesen Sachverhalt überprüfbar. Echte Live-Aktualisierung ist erst nach einem erneuten SSP3-Test bestätigt.

### v0.6.30 – RAM-Status der dauerhaften One-Wire-Freigabe prüfen (12.11.2026)

Die Live-Abfrage bleibt wie in v0.6.26 auf einen aktuellen **ADC_S-Wert in jedem Zyklus** fokussiert; Temperatur und DSP werden zeitlich verteilt gelesen. Zusätzlich prüft die App nach dem erfolgreich erkannten E703.11 **einmalig und nur lesend** Register `CFG_SPI_I2C (0x06)`, Bit `plc_en` (Bit 2). Gemäss E703.11-Datenblatt 25DS0170E.04, §6.4.5.8 aktiviert eine vollständig empfangene Magic Cookie dieses flüchtige Bit und öffnet das PLC-Fenster **bis zum nächsten Reset dauerhaft**. Wird nur während des zeitlich begrenzten NVM-Startfensters ein ADC-Wert gelesen, aber `plc_en` bleibt 0, lässt sich der Sensor später nicht zuverlässig weiter abfragen.

Die App speichert im exportierten SSP3-Protokoll `powerCycle.plcConfigRam`, `powerCycle.plcEnabledInRam` und im Fehlerfall `powerCycle.plcConfigReadError`. Sie zeigt bei **explizit gelesenem `plc_en=0`** eine Warnung statt einen uneingeschränkten Erfolg. Falls das Statusregister gar nicht lesbar ist, wird dies gesondert protokolliert und nicht als 0 interpretiert. Diese Prüfung schreibt **keinerlei NVM- oder RAM-Register** und verändert weder den bestätigten Verbindungsablauf noch die Schutzlogik der Kalibrierung.

**Hardwaretest ausstehend:** Nur die reale SSP3-Antwort kann bestätigen, ob eine dauerhaft aktive One-Wire-Schnittstelle vorliegt. Wenn die Verbindung zwar einen Wert, aber kein `plc_en=1` liefert, muss die Cookie-Sequenz **während des Startupfensters vor dem ersten Lesezugriff** zuverlässig im SSP3/Chip ankommen. Wiederholtes Registerlesen oder bloss schnelleres Browser-Polling behebt das nicht.
## v0.6.30 – 12.11.2026: Live-Start unabhängig von NVM-Schreibfreigabe

- Bei bestätigtem ADC_S darf die **nur lesende** Live-Abfrage nach Ende der SSP3-Initialisierung beginnen, auch wenn die gesonderte NVM-relevante Startfreigabe noch offen ist. Kein Aufweichen der NVM-Schutzprüfungen.
- Die normale Kopfzeile zeigt fortlaufend erfolgreiche/gestartete Live-ADC-Abfragen und letzte Fehler. Bei nachgewiesenem `CFG_SPI_I2C.plc_en=0` wird das fehlende dauerhafte One Wire ausdrücklich angezeigt.
- Der SSP3-Protokollexport enthält zusätzlich `liveDiagnostic` mit Zählern, letzter Antwort, Fehler und `plcEnabledInRam`. Damit lässt sich ein blockierter Browser-Poll von auslaufendem Chip-Startfenster unterscheiden.
- Keine neuen RAM-/NVM-Schreibbefehle, kein zusätzlicher Power-Cycle. Ein echter Hardwaretest ist weiterhin erforderlich.


### v0.6.30 – Statische ADC-Werte trotz erfolgreichem SSP3-One-Wire-Lesen

Echter UI-Befund: `ADC 101/101`, aber unveränderte ADC/DSP-Werte bis zum nächsten F5-Neustart. Erneute erfolgreiche Registerreads bedeuten nicht, dass der Chip neue Messungen erzeugt. Das Datenblatt nennt `CFG_PERIOD 0x0E`: 0 = keine Messung, 1 = kontinuierlich, 2 = eine Messung nach CMD.start, Werte ab 3 = periodisch. Beim Einschalten erfolgt laut §6.7.1 ein CMD.start; bei Einzelmessungsmodus folgt deshalb exakt ein frischer Wert.

Die App liest `CFG_PERIOD` und `STATUS (0x36)` nach dem erfolgreichen SSP3-Boot nur lesend. **Nur bei nachgewiesenem `CFG_PERIOD=0x0002`** wird im normalen SSP3-One-Wire-Live-Zyklus der dokumentierte `CMD.start` an Register `0x22` mit Wert `0x8B93` gesendet, dann auf `STATUS.adc_s_up` (Bit 1) gewartet und erst nach bestätigter neuer Konversion ADC_S gelesen. Dies ist ein flüchtiger Laufzeitbefehl, verändert weder die PLC-Freigabe noch das NVM oder `CFG_PERIOD`. Ein fehlender neuer ADC-Status wird als Fehler angezeigt.

Bei unbekanntem oder abweichendem `CFG_PERIOD` erfolgen **keine** zusätzlichen Schreibbefehle; bei CFG_PERIOD=0 meldet die Anzeige die deaktivierte Messung. Im SSP3-JSON-Export stehen nun Periodenmodus, STATUS, tatsächliche CMD-Starts und Zählung unterschiedlicher ADC-Werte. Der Ablauf muss noch am echten SSP3 validiert werden.

### v0.6.30 – Magic Cookie verändert CFG_PERIOD und kann die Live-Messung stoppen

Screenshot: `Manuell pausiert`, `ADC 51/51`, `CFG_PERIOD=0x5CFD`, `STATUS=idle`. Das Register CFG_PERIOD liegt bei 0x0E, der zweite dokumentierte Magic-Cookie-Schreibbefehl enthält exakt `(0x0E, 1, 0x5CFD)`; die aktuelle Web-App findet diesen Wert tatsächlich im Sensor-RAM vor. Damit ist der Registerzugriff möglich, während das Messprogramm möglicherweise im idle-Zustand bleibt. Ein Browser-F5 startet die Stromversorgung neu und liefert zunächst einen neuen Messwert.

**Gezielte Korrektur:** Wenn der SSP3-Autostart ausdrücklich die dokumentierte Magic Cookie verwendet hat, der Chip erfolgreich identifiziert wurde und das RAM-Register CFG_PERIOD exakt 0x5CFD enthält, setzt die Web-App **nur im RAM** CFG_PERIOD=0x0001 (kontinuierlich), prüft das Rücklesen von 0x0001 und sendet CMD.start=0x8B93 an Register 0x22. STATUS wird nach dem Start nochmals gelesen. Erfolg und Fehler werden im SSP3-Diagnoseexport sichtbar. Keine NVM-/CM-Programmierung, kein Eingriff in die PLC-Startup-NVM-Wörter; nach Hardware-Neustart kehrt die originale Konfiguration zurück. Die temporäre Live-Betriebsart kann eine höhere Stromaufnahme als periodischer Betrieb verursachen und ist für den aktiven Kalibrierprüfplatz gedacht.

**Bedienhinweis:** Der Screenshot zeigt ausserdem «Manuell pausiert». Die Aufnahme kann über den Button **«Live-Messung starten»** wieder aktiviert werden; eine vom Benutzer gesetzte Pause wird nicht automatisch aufgehoben. Echt-Hardwareprüfung der Korrektur steht noch aus.

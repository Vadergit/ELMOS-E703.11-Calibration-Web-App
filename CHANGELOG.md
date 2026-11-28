## v0.7.226 – Einheitlich ausgerichtete Live-Leiste

- Gemeinsame Zeilen für Titel, Messwerte und Einheiten in allen Live-Kacheln. Mehrzeilige Hinweise verschieben keine einzelnen Zahlen mehr; einheitliche Zahlengrösse, Hilfe-Icon neben statt unter der Einheit.
- Responsive Darstellung mit fünf bzw. sechs Kacheln; keine leere Spalte ohne Sensor-ID. Keine Änderung an Messung, Sensorzugriff oder NVM.

## v0.7.225 – Sensor-ID in der Live-Leiste

- Zusätzliches Live-Kästchen mit dezimaler Sensor-ID und Hex-Wert, nur bei bestätigter ID ungleich 0. Wert 0 gilt als nicht vergeben (Anwendungskonvention; USER hat laut Datenblatt keinen separaten Leerstatus).
- USER-Register 0x6A nach Chip-Erkennung lesen (DS 25DS0170E.04, §6.5.5.2), geprüftes aktuelles NVM hat Vorrang. Nach bestätigter NVM-Programmierung aktualisieren; an Port, Sitzung und Chip-UID gebunden. Keine zusätzlichen NVM-Schreibbefehle.
- Softwaretests ergänzt, Hardwareprüfung ausstehend.

## v0.7.224 – Einzelne Messpunkte korrigieren

- Aufgenommenen Referenzmesspunkt auswählen und einzeln löschen. Der ursprüngliche Aufnahmebutton erscheint wieder; alle anderen Druck- und Temperaturmesspunkte bleiben erhalten.
- Korrektur verwirft abgeleitete Koeffizienten, DSP-Prüfung und NVM-Plan; während laufender Chipvorgänge oder nach NVM-Abschluss nicht zulässig. Lokaler Entwurf wird aktualisiert.
- Fehlerhafte vollständige Messreihen werden nicht grün als bereit dargestellt; Weiter bleibt bis zur gültigen Messreihe gesperrt. Archiv behält Löschvermerk und Rohhistorie, verworfene Punkte werden aus den zusammengefassten Messwerten entfernt. Hardwareprüfung ausstehend.

## v0.7.223 – Vereinfachte Sensor-ID-Beschriftung

- Feldtitel «Sensor-ID – Dezimal» bzw. «Sensor-ID – Hex» ohne Zusatz «optional». Der Hinweis unter dem Feld erklärt weiterhin, dass eine leere Eingabe die bisherige Sensor-ID beibehält.
- Formatumschaltung, Eingabegrenzen und NVM-Schreibprüfungen unverändert.

## v0.7.222 – Eindeutige Sensor-ID-Eingabe mit Eingabeschutz

- Aktives Format direkt im Feldtitel, separater Bereich für die Formatumschaltung, Wertebereich und umgerechneter Wert unter dem Feld; responsive Darstellung.
- Unzulässige Zeichen und Werte werden bei der Eingabe oder beim Einfügen abgewiesen. Ein Fallback stellt bei nicht abbrechbaren Eingabeereignissen die letzte gültige Eingabe wieder her. Kein Abschneiden, keine automatische Begrenzung auf einen anderen Wert.
- Nur echte numerische Änderungen verwerfen die vorhandene Änderungsliste. Leeres Feld, NVM-Wort 30, Chip-UID und Schreibprüfungen unverändert. Hardwareprüfung ausstehend.

## v0.7.221 – Sensor-ID in Dezimal oder Hex

- Dezimal als Standard (0–65535), Live-Hex-Vorschau und Umschaltung auf Hex mit Dezimalvorschau. Formatwechsel erhält den numerischen Wert und eine bereits geprüfte Änderungsliste; echte Eingabeänderungen verwerfen den Plan wie bisher.
- Leere Eingabe behält die bisherige USER-ID, beim Sensorwechsel wird die Eingabe auf Dezimal zurückgesetzt. Chip-UID, NVM-Wort 30, Schreibprüfung und Archivformat bleiben unverändert.
- Softwaretests für die Konvertierung und Formatwechsel; reale Hardwareprüfung ausstehend.

## v0.7.220 – Automatische Koeffizientenberechnung im Serienabgleich

- Messpunktabschluss und Archivierung vor dem automatischen Fit abwarten; bekannte Lesevorgänge begrenzt abwarten. Keine fremden Sperren aufheben.
- Konkrete Meldungen zu Verbindung, Polynommodell, DSP-Ziel und Messpunktgültigkeit statt einer Sammelmeldung. Ungültige Messpunkte vor dem Koeffizientenschritt korrigieren.
- DSP-Warnungen und Vorschlagskontext bei jedem neu vorbereiteten Abgleich zurücksetzen. Grenzwertdialoge und RAM-/NVM-Prüfungen bleiben erhalten.
- Hardwareprüfung ausstehend.

## v0.7.219 – Sensorwechsel in zwei Spalten

- Links die Schritt-für-Schritt-Anleitung und Verbindungsaktionen, rechts die vollständige kompakte Liste der Übernahmeoptionen. Auf schmalen Bildschirmen untereinander.
- Alle bestehenden Checkboxen, gespeicherten Präferenzen, Übernahmeregeln und Hardwareprüfungen unverändert.

## v0.7.218 – USER-ID direkt auf der NVM-Seite

- Optionales USER-ID-Feld im geführten Kalibrierablauf direkt vor der NVM-Prüfung sichtbar; leer lassen erhält die vorhandene ID. Änderungen an der Eingabe verwerfen weiterhin den alten Änderungsplan und erfordern die erneute Prüfung.
- Kompakte NVM-Darstellung, aufklappbare Diagnose und bestehende Schreib-/Kaltstartprüfungen bleiben erhalten. Bei Ausgangs- oder Alarmänderung ohne Kalibrierung bleibt die USER-ID unverändert.

## v0.7.217 – Serienoptionen und kompakte NVM-Prüfung

- Beim Sensorwechsel einzeln auswählen, welche Vorgaben übernommen werden. Auswahl im Browser gespeichert, keine automatische Wiederaufnahme eines Hardwarevorgangs. Offset und DSP-Ziel standardmässig zurücksetzen; alternativ bisherige Werte übernehmen. Ohne Messplan-Häkchen Planung erneut öffnen.
- NVM-Seite zeigt die jeweils sinnvolle Hauptaktion, Status und relevante Fehler; Backup, UID, vollständige Meldungen und Diagnose bleiben aufklappbar. Bestehende Schreibfreigabe, Bestätigungen, CRC und Neustartprüfungen unverändert.
- Hardware- und vollständige Browserprüfung ausstehend.

## v0.7.216 – Serienabgleich direkt zum Frontend

- Nach bestätigtem Sensorwechsel Messplan, Druck-/Temperatur-Sollwerte und Ausgangsvorgaben übernehmen und bei unveränderter Messmatrix direkt zu Schritt 4 «Frontend einstellen» wechseln. Zurücknavigation zu Planung und Vorbereitung bleibt möglich.
- PGA1/PGA2, Brückenpolarität und bestätigte Brückenspannung übernehmen; Offset auf 0 und DSP-Zielbereich auf HTML-Standard ±32’000 Digits zurücksetzen. Individuelle Messpunktfelder bleiben trotz geändertem DSP-Ziel erhalten.
- ADC-Tiefpass am vorherigen Sensor rücklesen; dokumentierte Filter über bestehenden RAM-Schreibpfad am neuen Sensor übernehmen und rücklesen. Individuelle unbekannte Filter nur bei identischen Registerwerten akzeptieren, sonst deutlichen Hinweis zur manuellen Prüfung geben.
- Temperatur-AFE, neue Messwerte, DSP-Verifikation und NVM-Freigabe bleiben sensorbezogen. Keine automatische EEPROM-Programmierung. Hardwareprüfung ausstehend.

## v0.7.215 – Serienabgleich und Startwiederholung

- Analoge Ausgangsvorgaben bei Kalibriervorlagen übernehmen, ohne einen bestätigten DSP-Endwert des neuen Sensors vorauszusetzen; Skalierung erst beim Ausgangsschritt berechnen und bestätigen.
- Auf laufende Verbindungs-/NVM-Lesevorgänge begrenzt warten. Bei blockierenden Tätigkeiten konkrete Ursache, Wiederholen, Abbrechen des wartenden Starts und Diagnose anbieten. Keine aktiven Schreibvorgänge abbrechen oder Sicherheitsflags zurücksetzen.
- Wiederholung eines fehlgeschlagenen Serienimports ohne unnötige Abfrage für das leere, zugehörige Wiederholungsprotokoll. UID-, CRC-, DSP- und NVM-Prüfungen bleiben erhalten.
- Hardwareprüfung ausstehend.

## v0.7.214 – DSP-Verifikation weiter vereinfacht

- Hinweise zur Prüfabdeckung, Fortschritt und ausführliche DSP-Meldungen im standardmässig geschlossenen Bereich «Prüfprotokoll und Hinweise». Das Diagramm und die kurzen Prüfpunktbestätigungen bleiben sichtbar.
- Fehler werden weiterhin direkt angezeigt. Alle Originaltexte bleiben verfügbar; klassische Ansicht, Kommunikation, Berechnung und NVM-Freigabe unverändert.

## v0.7.213 – DSP-Prüfgraph und Abschlussseite

- Ein gemeinsamer Graph: Prüfpunkte von links nach rechts, vertikale Abweichung, horizontales Toleranzband, farbige Messpunkte und kompakte Zusammenfassung. Bestehendes Prüfprotokoll bleibt erhalten.
- Abschlussseite: redundante Neustart-/NVM-Kontrollen nur ausblenden, wenn der aktuelle Sensor einen bestätigten Kaltstartnachweis besitzt. Bei ausstehender/fehlgeschlagener Prüfung bleiben sie verfügbar. Elektrische Ausgangsmessung weiterhin ausdrücklich erforderlich.
- Nur geführte Darstellung; keine Änderungen an Kommunikation, Kalibrierlogik oder NVM-Prüfung.

## v0.7.212 – Grafische DSP-Verifikation und Ausgangsnavigation

- Toleranzdiagramm pro Prüfpunkt mit tatsächlicher signierter Abweichung, Sollwert, Toleranzgrenzen und grün/rot markiertem Messpunkt. Fehlgeschlagene Messungen bleiben sichtbar; bei ungültigen früheren Prüfpunkten wird erneutes Prüfen angezeigt. Anzeige getrennt von DSP- und NVM-Freigabe.
- Alarm-Übersprung rechts in der Fussnavigation. Beide Weiter-Aktionen erst nach erfolgreicher Ausgangsvormerkung und DSP-Prüfung aktiv. Keine Änderung an Kommunikation, Fit oder NVM-Prüfungen.
- Hardware- und vollständige CI-Prüfung ausstehend.

## v0.7.211 – DSP-Vorschlag direkt übernehmen

- Geführter Abgleich: bestätigten kleineren DSP-Endwert übernehmen, vorhandene Messpunkte erhalten, Koeffizienten erneut berechnen, bei erfolgreicher Prüfung ins RAM schreiben und direkt zur unabhängigen DSP-Verifikation wechseln. Auch bei manuell gewählter Polynomordnung bleibt die aktuelle Wahl erhalten.
- Veraltete Vorschläge, Sensorwechsel, aktive Vorgänge, Berechnungswarnungen und RAM-Fehler stoppen den automatischen Ablauf. Klassische Bedienung bleibt manuell; kein automatisches NVM-Schreiben.
- Hardware- und vollständige CI-Prüfung ausstehend.

## v0.7.210 – Ausgangskonfiguration vereinfacht

- Normaler geführter Analogabgleich: ein Button berechnet S0/S1-Skalierung und prüft/merkt die Ausgangskonfiguration vor. PWM/FM, Expertenmodus und klassische Ansicht behalten den separaten Skalierungsvorschlag.
- Direkter Weg zum NVM ohne Alarm-/Fehleränderung; bestehende Alarmwerte bleiben unverändert. Beide Weiter-Wege prüfen DSP und bestätigten Ausgang; keine automatische NVM-Programmierung.
- Keine Änderung an Kommunikation, Registern oder Kalibrieralgorithmen; Hardware- und vollständige CI-Prüfung ausstehend.

## v0.7.209 – Automatischer eindeutiger Fit im geführten Ablauf

- Nach «Weiter» von den Messpunkten: eindeutiger 2-Punkt-Druckfit sowie festgelegte TK0-/lineare TK0+TKE-Modelle automatisch berechnen und mit vorhandener RAM-Rückleseprüfung übernehmen. Bei Warnungen, Fehlern oder mehreren sinnvollen Polynomordnungen bleibt die manuelle Bedienung erhalten.
- Automatik endet bei unabhängiger DSP-Prüfung; kein automatisches NVM-Schreiben, keine Änderung an Adapter-/Kommunikationsroutinen oder Fit-Mathematik. Archivierung, Messprofil und Sensorverbindung werden geprüft.
- Hardware- und vollständige CI-Prüfung ausstehend.

## v0.7.208 – Schnellabgleich ohne erzwungenes internes Temperaturprofil

- Reiner Druckabgleich mit unverändertem gültigem internem, Brücken- oder EOC-Temperaturprofil. RAM/NVM-Übereinstimmung, UID/CRC, DSP-Prüfung und NVM-Schutz bleiben Pflicht. Keine automatische Umstellung der Temperaturquelle; bestehende Temperaturkoeffizienten bleiben erhalten. Druck-TK-Koeffizienten werden beim reinen Druckfit wie bisher ersetzt (Bestätigung bei vorhandener TK).
- Messpunktaufnahme, Fit-Auswahl, RAM-Übernahme und NVM-Diff verwenden konsistente Druck-only-Prüfung. Temperatur-AFE im geführten Schnellabgleich ausgeblendet. Bestehende Temperaturabgleichpfade und USB-/Adapterprotokolle bleiben unverändert.
- Hardwareprüfung und vollständige CI ausstehend.

## v0.7.207 – Geführte Oberfläche (UI-only)

- Selektive Darstellung aus ui-ux-redesign auf Main v0.7.203: kompakte Hilfen, Messpunkt-Hubübersicht, responsives Layout und kontextbezogene Anzeige.
- Bestehende Verbindungs-, Kalibrier-, RAM-/NVM- und Temperaturquellenlogik unverändert; keine Übernahme des Redesign-Branches oder der Fit-Automation. Erforderliche manuelle Aktionen bleiben verfügbar.
- PTC/EOC-Hilfedialog mit Formeln und Rechenbeispielen. Hardware- und Browserprüfung stehen aus.

## v0.7.203 – PTC/EOC-Integration und automatisierte Abschlussprüfung

- Übernahme des Integrationsbranches (Integration 13) in main, inklusive interner, Brücken-/PTC- und externer Temperaturquelle sowie DLL-Referenzdaten. PTC/EOC bleiben Beta-Funktionen; Hardwarevalidierung steht aus.
- Geführter Abgleich: Sensorneustart und frische NVM-Prüfung beim Start, Schnellverbindung, integrierter Sensorbrücken-Rechner, temperaturabhängige Anzeige der Koeffizienten und flexible ADC-/DSP-Bereichsanzeige.
- Nach bestätigtem NVM-Schreiben automatische Neustartprüfung mit ESP32-C3 bzw. Pro Micro (integrierter Lastschalter), danach Wechsel zur Abschlussprüfung. SSP3: manueller Kaltstart weiterhin möglich. Elektrische Ausgangsmessung bleibt erforderlich.
- Versionsanzeige, interne Versionskennung und Cache-Parameter auf v0.7.203 vereinheitlicht. Vollständige Testsuite, reale Hardwaretests und Pages-Veröffentlichung noch nicht bestätigt.

## v0.7.202 – SSP3: Startmodus 0x6C05 bei NVM-Freigabe

- Feldprotokoll v0.7.201: geprüfter SSP3-Abgleich mit Original-NVM 0x6C06, CFG_PADS0 0x4000 und RAM 0x6C05 scheitert an der alten 4-ms-Freigabe. SSP3 nutzt jetzt dieselbe eng begrenzte Registerprüfung wie ESP32. Debug zeigt den Registervergleich auch für SSP3.
- NVM-Ziel bleibt 0x6C02 aus dem Original, nicht aus dem RAM. UID, CRC, Backup, AFE-/DSP-Prüfung, Adressschutz, explizite Bestätigung und abschliessender Readback unverändert. Regressionstest für SSP3 und unzulässige Abweichungen ergänzt; Hardware-Schreibtest und Wiederanlauf weiterhin offen.

## v0.7.201 – ESP32-Worst-Case Versionsprüfung

- Korrigiert die Vorprüfung des ESP32-v0.14-Schreibtests: tatsächliche .VERSION-Antwort statt Anzeige-/Capability-Beschreibung. Das Protokoll vom Sensor 0020018B39FA zeigte erfolgreiche Recovery und vollständige Bridge-Capabilities, aber einen Abbruch vor der NVM-Sicherung.
- Einzelne Voraussetzungen werden mit konkreten Ergebnissen im Labortest protokolliert. Firmware-ARM, UID, Kaltstart, RAM-/NVM-Prüfungen und Schreibschutz bleiben erhalten. Neun simulierte Regressionstests bestanden. Hardware-Schreibtest noch offen.

## v0.7.200 – Clipping-Grenzen bei Sensorwechsel und Profilen

- Einstellungsprofile und Sensorwechsel verwenden dieselbe Clipping-Prüfung wie die NVM-Ausgangskonfiguration. 5–95 % VDD und andere gültige LIMIT_LO/HI-Grenzen ausserhalb 10–90 % sind erlaubt. S0/S1 bleiben auf den linearen Messbereich beschränkt.
- Gemeinsame Q0.13-Quantisierung, unveränderte Registergrenzen und NVM-Schutzlogik. 14 simulierte Regressionstests bestanden; Hardware-Sensorwechsel noch zu bestätigen.

## v0.7.199 – ESP32 als eigenständiger Worst-Case-Programmer

- Worst Case: Programmer frei wählbar (ESP32-C3 v0.14 oder SSP3). Der ausgewählte Programmer übernimmt NVM-Programmierung, drei Neustartprüfungen und standardmässig auch die exakte Wiederherstellung. Der Vergleich mit dem zweiten Programmer ist optional; bei bestätigtem NVM-Abbild kann der Wiederherstellungsadapter explizit gewählt werden.
- ESP32-Labor-Schreibfreigabe erfordert unveränderte UID/Sitzung, bestätigte PLC-Adresse, VDD-Steuerung, Kaltstart, generisches User-NVM und explizite Firmware-Antwort NVM HOST ARMED. Keine Lockerung des produktiven Schreibschutzes, kein Firmwareupdate. Bei Ablehnung kein NVM-Schreibbefehl; bei unklarem Schreibzustand kein automatischer Neustart.
- Sechs simulierte Ablaufprüfungen bestanden; tatsächlicher NVM-Schreibvorgang und Recovery/Wiederherstellung mit ESP32 v0.14 weiterhin hardwareseitig zu bestätigen.

## v0.7.198 – USB-Neuinitialisierung und echter One-Wire-Worst-Case

- Begrenzte automatische Wiederöffnung desselben autorisierten USB-Ports bei Adapter-Handshakefehlern (max. drei Versuche); alte USB-/Fehlerprotokolle mit Sitzungskennung erhalten. Sensorfehler allein lösen keine USB-Wiederöffnung aus. Manuelle Neuinitialisierung nutzt den gleichen Wiederholungsweg.
- Neue lesende Labormodi mit 5/100 Standardstarts, UID-/CRC-/64-Wort-Vergleich und Dauerstatistik. PSSC-Fehler ohne Antwort nach RAM-Freigabe genauer klassifizieren; begrenzte Wiederholung flüchtiger Registerlesefehler.
- Separater Worst-Case-Modus nur am originalen SSP3 und entbehrlichem Sensor: Original sichern; 4 ms, permanentes PLC aus, Upstream/Registerfreigabe aus, Downstream unverändert; nur maskierte Wörter 17/18/19 und CRC16 schreiben. Bei bereits identischem Ziel zunächst 10 ms schreiben und prüfen. Jede tatsächliche Programmierung mit vollständiger Rücklesung/CRC und anschliessend drei kontrollierten Wiederverbindungen. Danach Adapterwechsel auf ESP32 v0.14, drei weitere Wiederverbindungen, Original am SSP3 wiederherstellen und nach Neustart verifizieren. Externe Analogprüfung als manuelle Evidenz. Kein deaktiviertes Startfenster, kein absichtlicher Stromausfall während eines Schreibvorgangs, keine automatische Wiederholung unklarer Schreibvorgänge.
- Produktions-NVM-Schreibschutz und ESP32-Firmware unverändert. Hardwarevalidierung und Jürgs tatsächliches USB-Protokoll ausstehend; simulierte Tests sind kein Hardware-Freigabenachweis.

## v0.7.197 – One-Wire Wiederverbindung und gezielter Cookie-Test

- ESP32: Bei expliziter Verbindung nach einem regulären PLC-Start ohne Antwortflanken an beiden Adressen die PSSC-RAM-Freigabe vor der zweiten normalen Baudrate versuchen. Bisherige Fallbacks und Hintergrund-Recovery-Sperre bleiben erhalten; keine Änderung der NVM-Schreiblogik oder Firmware.
- SSP3: PSSC-Delay 0x10 zuerst versuchen, bei Misserfolg bisherige Folge 0/8/0x10. Delay-Ergebnisse und erfolgreiches Profil protokollieren. Das direkte Profil muss separat an Hardware bestätigt werden.
- Labormatrix SSP3: 33 Versuche inklusive isolierter Delay-Profile 0/8/0x10 und frühem Magic-Cookie-Burst mit 100/50 kHz. Beide Cookie-Frames werden zusammen mit PWR_ON und PLC T vor der ersten Leseabfrage an den SSP3 übergeben. Registerzugriff und NVM-Vergleich bleiben Pflicht; Host-Burst ist kein physikalischer Timing-Nachweis. Normaler Kalibrierungsbetrieb nutzt den experimentellen Cookie-Burst nicht.

## v0.7.196 – One-Wire Labor: vollständige Startvariantenmatrix

- Je drei unabhängige Verbindungsversuche pro Profil: ESP32 PLC START 100/25 kBd, PLC RECOVER START 100/25 kBd und Standardautomatik (15); SSP3 PSSC-RAM, kombinierte/getrennte USB-Ausgabe bei 100/50 kHz sowie Standardautomatik (18). Kein vorzeitiger Abbruch beim ersten Erfolg. Separate Bewertung von Startpfad, tatsächlichem Takt soweit gemeldet, Magic-Cookie-Nachweis, Kaltstart und 64-Wort-NVM-Vergleich. Firmware v0.14, v0.15 und v0.16 separat vergleichbar; kein automatisches Flashen.
- Bei permanentem PLC zuerst Originalprofil prüfen, danach unverändertes Original erneut bestätigen und die bereits freigegebene 4-ms-Umstellung einmalig durchführen. Anschliessend erneute Matrix. Optional reiner Lesetest für vorhandene Profile; 10/200 ms nur auf entsprechend vorkonfiguriertem Sensor, kein automatisches Abschalten des letzten PLC-Zugangs. Nicht getestete Profile bleiben offen. UID- und NVM-Abweichung stoppt die Matrix. Normale Kalibrierung und NVM-Schutz unverändert. Hardwareprüfung ausstehend.

## v0.7.195 – One-Wire Labortest: gezielte PLC-Lesewiederholung und Schreibfortschritt

- ESP32: einzelne fehlgeschlagene PLC-Registerlesung bis zu zweimal mit kurzem Abstand wiederholen, ausschliesslich im Labortest und bei unveränderter USB-Sitzung, Chip-UID und PLC-Adresse. Keine automatische Wiederholung persistenter Schreibbefehle. Die vollständige CRC-/Boot-/UID-Prüfung und der SSP3-Fallback bleiben erhalten.
- Schreibvorprüfung, tatsächlicher NVM-Schreibbefehl und Rücklesekontrolle sichtbar unterscheiden; 64-Wort-Fortschritt und laufenden Exportstatus erfassen. Geplanten Folgeadapter vor der Programmierung sichern. Kein Neustart ohne verifiziertes NVM und bestätigte Schreibsperre.
- Wiederverbindungsprüfung: Transportfehler als nicht abschliessend bewerten und getrennt von Magic-Cookie-/Kaltstartnachweis dokumentieren. Die unveränderte ESP32-Firmware v0.14 bleibt Referenz; Hardwaretest und direkter Nachweis der Cookie-Flanken stehen aus.

## v0.7.194 – One-Wire Labortest: vollständige NVM-Lesung wiederholen

- Feldtest UID 002001004044: Lesen von NVM 0x22 abgebrochen, PLC_NO_VALID_FRAME bei nachfolgender Statusabfrage. Labortest wiederholt bei einem PLC-Transportfehler die gesamte 64-Wort-Sicherung einmal in derselben UID/USB-Sitzung, ohne Kaltstart oder NVM-Programmierung. CRC-/Identitäts-/Bootfehler bleiben Abbruchkriterien. Beide Fehlversuche werden mit Teilbefund gespeichert. Bei erneutem PLC-Lesefehler am ESP32 geführte SSP3-Übergabe vor dem ersten NVM-Schreiben. Normale USB-, Firmware- und NVM-Routinen unverändert.

## v0.7.193 – Labortest mit bereits deaktiviertem One-Wire

- Original-NVM und tatsächliche Startup-Bits vor Planprüfung dauerhaft sichern. Ist plc_en bereits aus, getrennten Wiederverbindungstest ohne NVM-Änderung durchführen; bei deaktiviertem Startfenster ausdrücklich bestätigen. Kein automatisches Überschreiben geschützter Bootregister. Regulärer Zugriff und RAM-Recovery im Ergebnis unterscheiden. Programmierter Test bleibt unverändert für permanente PLC-Ausgangskonfiguration. Hardwaretest ausstehend.

## v0.7.192 – Startfehler nach gespeichertetem Labortest behoben

- Der neue localStorage-Index enthält keine events-Liste; der Labortest hatte diese bereits vor dem Laden aus IndexedDB mit `.map()` verarbeitet. Bei gespeichertetem Test konnte dies die gesamte App-Initialisierung vor `uiReady=true` abbrechen. Anzeige toleriert Index/alte Testdaten, vollständiges Journal bleibt erhalten und wird erst beim Öffnen geladen. Fehler bei optionaler Labortest-UI-Initialisierung werden protokolliert und blockieren den normalen USB-Start nicht. Keine Änderung an USB-Handshake, Firmware oder NVM-Logik. Hardwareprüfung ausstehend.

## v0.7.191 – Regulären USB-Verbindungsaufbau wiederherstellen

- Allgemeine USB-Reader-, Exchange-, Firmware-Handshake- und Connect-Logik exakt auf v0.7.189 zurückgesetzt, nachdem ein Anwender in v0.7.190 keine Verbindung mehr herstellen konnte. Keine Firmware- oder NVM-Änderung. Labortest behält das Abwarten der laufenden Live-Abfragen, die begrenzte Wiederholung und die Vermeidung unnötiger Neuverbindungen. Laborspezifische Wartezeit und Diagnose-Reset nur im Labortest. Hardwarebestätigung ausstehend.

## v0.7.190 – USB-Handshaking im automatischen One-Wire-Labortest

- Feldprotokoll: alte Live-Antwort endet erst nach USB-Neuverbindung; leerer `:`-Prompt wurde fälschlich als BRIDGE_INFO-Antwort gewertet. Bridge-Handshake wartet jetzt auf die passende vollständige Nutzlast und protokolliert verworfene Frames. Vor dem Handshake RX-Kanal kurz beruhigen.
- Vor jeder Labortest-USB-Trennung Live-Abfrage und Befehlswarteschlange abwarten. Sitzungsbezogene PLC-Diagnose und Kaltstartnachweis beim Öffnen zurücksetzen. Bereits CRC-/UID-bestätigte RAM-Verbindungen ohne Kaltstart für Original-NVM-Lesen nutzen; v0.14-Schreibschutz bleibt unverändert. Bei Adapter-Handshaking-Fehler maximal ein erneuter Verbindungsaufbau. Hardwareprüfung ausstehend.

## v0.7.189 – Automatischer One-Wire Wiederverbindungstest

- Ein Start für Verbindungsvorbereitung, Original-NVM/CRC, begrenzte NVM-Programmierung, USB-Neuverbindung und bis zu drei Kaltstart-/Magic-Cookie-Versuche. Bei v0.14 ohne Firmware-Kaltstartfreigabe geführte SSP3-Übergabe, danach unveränderte v0.14 testen. Keine Wiederholung der NVM-Programmierung bei Adapter-/Firmwarevergleich. Manuelle Stromunterbrechung und Firmwarewechsel nur nach Aufforderung.
- Durchgängiges USB-/Register-/Ereignisjournal über alle Sitzungen, Original-/Soll-/Ist-NVM, Adapterstatus und persistente IndexedDB-Checkpoints. Keine Kürzung des Labortestjournals. Unkalibrierter Sensor bleibt unkalibriert; reine Kommunikationsprüfung. Physische VDD und interne v0.14-Frame-Zeiten nicht messbar. Hardwareprüfung ausstehend.

## v0.7.188 – One-Wire Labortest: SSP3 und Adaptervergleich

- Original SSP3 als NVM-Testadapter mit bestätigtem VSUPPLY-Kaltstart, UID, CRC und begrenztem NVM-Plan. ESP32-Firmware-Kaltstartschutz bleibt erhalten; RAM-Messstart wird gesondert angezeigt. Vorbereitung und Adaptervergleich ohne NVM-Programmierung, Diagnoseexport auch vor erstem Schreibvorgang. Vergleich mit v0.14 vor neuer ESP32-Firmware. Hardwareprüfung ausstehend.

## v0.7.187 – One-Wire Labortest: Verbindungsdiagnose

- Voraussetzungen einzeln mit tatsächlicher Firmware, Chip-UID, GPIO10, Kaltstartnachweis und User-NVM-Fähigkeit anzeigen. Keine pauschale Fehlermeldung. Separater Vorbereitungsschritt: USB-Neuverbindung über GPIO10 mit UID-Prüfung, ohne NVM-Schreibvorgang. Bestehende NVM-Freigaben bleiben aktiv.

## v0.7.186 – One-Wire Wiederverbindungstest (Experten-Labor)

- Separater Hardwaretest mit ESP32 v0.14: Original-NVM/UID/CRC sichern, ausschliesslich plc_en deaktivieren, startup_plc auf 4 ms setzen und CRC16 aktualisieren. Nach vollständiger Verifikation USB trennen und über GPIO10 neu verbinden.
- Nur bei bestätigter fehlender Sensorantwort Firmwarewechsel anbieten (v0.15 falls separat vorhanden, veröffentlichte v0.16). Wiederverbindung mit demselben NVM; kein weiterer NVM-Schreibvorgang. Testprotokoll bleibt lokal erhalten und exportierbar. Keine Änderung des normalen Abgleichablaufs. Hardwaretest ausstehend.

## v0.7.185 – ESP32-Testfirmware v0.16: Wiederverbindung im kurzen One-Wire-Startfenster

- Normaler PLC START bleibt zuerst erhalten. Bei fehlender Antwort folgen maximal sechs Kaltstartvarianten mit 500 ms Ausschaltzeit, GPIO4/Treiber hochohmig während der Entladung, 250/1000 µs Einschaltwartezeit bei 100000 sowie 500 µs bei 187500 Host-Timing, je 0x6C/0x7C. Keine zusätzlichen Recovery-Broadcasts oder NVM-Befehle.
- PLC_START_TIMING_V1 protokolliert beide Magic-Cookie-Telegramme relativ zum GPIO10-Einschaltbefehl. VDD bleibt ungemessen. App wartet bei neuer Firmware bis zu 12 s. Bestehende NVM-Freigaben unverändert.
- Firmware v0.16 wird nach erfolgreichem CI-Build separat im Installer angeboten; v0.14 bleibt verfügbar. Hardwareprüfung ausstehend.

## v0.7.184 – Prüfpunkt-Vorgabe im geführten Abgleich

- Bei einer neu übernommenen Messmatrix wird der erste unabhängige DSP-Prüfpunkt explizit auf den Mittelpunkt des tatsächlichen Druckbereichs gesetzt, auch wenn der Bereich bereits vorbelegt war. Manuell angepasste Prüfpunkte bleiben beim erneuten Öffnen derselben Matrix erhalten.
- Keine Änderung der One-Wire- oder NVM-Schreiblogik.

## v0.7.183 – CFG_SPI_I2C RAM 0x6C05 nach bestätigtem ESP32-Start

- Debug-Fall mit Firmware v0.14: Original-NVM 0x6C06, CFG_PADS0 0x4000 (startup_com=1), RAM 0x6C05 bei stabiler PLC-Kommunikation, alle übrigen Freigaben bestätigt. Gemeinsamer Vergleich erlaubt genau diese Startmodus-Abweichung; andere Adressen und Bits bleiben geschützt.
- Geplantes NVM wird unverändert aus dem Original erzeugt (0x6C02, 4 ms); RAM wird nicht kopiert. Firmware-ARM, Kaltstart, Backup, UID, CRC und Rückleseprüfungen bleiben erforderlich.
- Neustartprüfung berücksichtigt denselben Startmodus bei wieder geöffnetem PLC; Debug-Anzeige und Ausgangshinweis nutzen dieselbe Freigabeprüfung. Hardwaretest ausstehend.

## v0.7.182 – ESP32: gezielte 4-ms-NVM-Freigabe und erneute Diagnose

- Beim bestätigten normalen ESP32-PLC-Start akzeptiert der 4-ms-Pfad zusätzlich genau die dokumentierte Original-NVM/RAM-Kombination 0x6C06/0x6C04. Keine Freigabe für andere RAM-Abweichungen, explizites PLC RECOVER oder AFE-Wiederanlauf. Kaltstartnachweis, generische Firmware-Capabilities, UID, Backup, CRC und abschliessende Rücklesung bleiben Pflicht.
- Der kombinierte generische ESP32-NVM-Diff kann die ausdrücklich vorgemerkte und geprüfte 4-ms-Umstellung übernehmen; weitere Startregister bleiben geschützt. Die Firmware muss weiterhin NVM ARM HOST bestätigen.
- «Verbindung & NVM-Freigabe erneut prüfen» liest die Bridge-Capabilities und Schnittstellenregister erneut, ohne Neustart oder Verlust der Messpunkte. Konkrete Sperrgründe statt Sammelmeldung; Bridge-Firmwarekennung bleibt beim .VERSION-Abruf erhalten. Hardwarevalidierung ausstehend.

## v0.7.181 – Debug-Verlauf vervollständigt

- Gesendete und empfangene USB-Daten in einem chronologischen Rohprotokoll; separate UI-Warnungen, Fehler und Statuswechsel. Export ohne Verbindung und auch bei fehlender Freigabe möglich.
- Fehlende bekannte RAM-Register und fehlende NVM-Wörter werden separat aufgeführt. Keine Änderung der Sensor-Schreiblogik.

## v0.7.180 – Vollständiges Debug-Paket

- Einstellungen → Diagnose & Support: ein JSON-Export mit Firmware-Rohantwort, Capabilities, RAM-/NVM-Lesecache, Original-NVM, geplantem Image, Kalibrierung, UI-Zustand und einzelnen NVM-Freigaben.
- Separater USB-, Ereignis- und Fehlerverlauf mit Zeitstempeln, Sitzungsnummer und transparenten Kapazitätsgrenzen. Kein zusätzlicher Sensorbefehl, kein Neustart und keine Änderung der Schreibfreigaben.
- Fehlende Registerwerte bleiben ausdrücklich als fehlend markiert; Hardwaretest ausstehend.

## v0.7.179 – 4-ms-Umstellung auch im bestätigten SSP3-Kalibrierpfad

- Bei Original-NVM 0x6C06 darf die bekannte temporäre PSSC-RAM-Konfiguration 0x6C04 bestehen bleiben. Der NVM-Plan wird aus dem Original-NVM erstellt (0x6C02), nicht aus RAM. Nur das dokumentierte PLC-Bit und gegebenenfalls das Startfenster dürfen wechseln.
- Der kombinierte Recovery-Diff akzeptiert die exakt geprüfte 4-ms-Umstellung bei verifizierter SSP3-Kalibrierung; alle übrigen Recovery-Beschränkungen bleiben bestehen. RAM-Schnittstelle wird unmittelbar vor dem Schreiben nochmals gelesen.
- Bei Analogauswahl wird die erforderliche Umstellung für SSP3 vorausgewählt. Keine automatische NVM-Programmierung. Hardwareprüfung ausstehend.

## v0.7.178 – SSP3-Direktzugriff ohne zusätzlichen Kaltstart

- Bei bestätigtem permanentem One-Wire im RAM und Original-NVM verlangt die 4-ms-NVM-Umstellung keinen separaten SSP3-Kaltstartnachweis mehr. Der Live-Zugriff, die bestätigte PLC-Adresse, UID, NVM-Backup, CRC, Registervergleich und explizite Änderungsliste bleiben Voraussetzung.
- Ein direkt lesbarer Sensor wird nicht allein wegen RAM-Wert 0x6C04 neu gestartet; Abweichungen zum Original-NVM bleiben durch die Recovery-Schutzpfade gesperrt bzw. eingeschränkt. DIY-Programmer behalten ihre Firmware-/Kaltstartfreigaben.
- Nach Umstellung muss der echte Wiederzugriff im neuen 4-ms-Fenster am Testchip geprüft werden; ein Neustart im alten permanenten Modus ist dafür kein Nachweis. Noch keine Hardwarefreigabe.

## v0.7.177 – Analogausgang ohne blockierten Abgleichschritt

- Dauerhaft erreichbare SSP3-One-Wire-Sensoren erhalten vor dem Abgleich bevorzugt den normalen AN0204-Kaltstart, statt die Startprüfung zu überspringen oder unnötig die PSSC-RAM-Freigabe zu verwenden.
- Bei gültigem Original-NVM kann die 4-ms-Umstellung unabhängig vom Kaltstartnachweis im Ausgangsschritt vorgemerkt werden. Es wird dabei nichts am Chip geändert; sämtliche NVM-Schreib-, UID-, CRC- und Bootschutzprüfungen bleiben bestehen.
- Physische Prüfung am SSP3 und Sensor noch ausstehend.

## v0.7.176 – Brückenspannung beim ESP32-Neuabgleich

- Nach verifiziertem ESP32-C3-Kaltstart darf eine bestätigte Änderung der Brückenspannung (SVDD) aus dem RAM in den Abgleich übernommen werden. Die Vorabprüfung zeigt die Änderung an. Andere Abweichungen in CFG_AFE0 und reservierte SVDD-Stufen bleiben gesperrt.
- Bei einer unerwarteten Abweichung zeigt die Vorabprüfung die tatsächlich gelesenen RAM- und NVM-Werte an.

## v0.7.175 – 4-ms-Startfenster für One-Wire

- Die Umstellung auf Analogbetrieb verwendet das 4-ms-One-Wire-Startfenster. Ist es im NVM bereits eingestellt, wird für das Interface nur das dauerhafte One-Wire-Bit gelöscht.
- Die NVM-Neustartprüfung berücksichtigt die flüchtigen Schnittstellenbits, die der Programmer beim One-Wire-Wiederanlauf setzt.

## v0.7.174 – Analogausgang bei dauerhaftem One-Wire

- Bei dauerhaftem One-Wire meldet der Assistent den belegten AODO-Pin und blockiert die Freigabe eines scheinbar gültigen Analogabgleichs.
- Nach bestätigtem One-Wire-Kaltstart mit geschalteter Sensorversorgung kann im Schritt «Ausgang» ein 200-ms-One-Wire-Startfenster für den Analogbetrieb ausdrücklich vorgemerkt werden. Die Änderung erscheint im regulären NVM-Plan mit Original-Backup, UID- und CRC-Prüfung. Unterstützt werden der originale SSP3 mit AN0204-Stromstart und eine ESP32-C3-Bridge mit generischer NVM-Firmware und Lastschalter.
- Prüfstandstest: Nach dem Speichern den Sensor ohne Programmieradapter neu einschalten und bei 5 V die Ausgangsspannung an beiden Druck-Endpunkten messen. Anschliessend erneut über den One-Wire-Stromstart des Programmers verbinden und das NVM rücklesen.

## v0.7.173 – ESP32-RAM-Start für unkalibrierte Sensoren

- Der ESP32-C3 kann einen E703.11 mit leerem Druckprofil an der One-Wire-Adresse 0x6C nach bestätigter Chip-UID und gültigen EEPROM-Prüfsummen im RAM initialisieren.
- Am angeschlossenen Print mit ESP32-Firmware v0.14 bei 25 und 100 kBd geprüft. Alle 64 EEPROM-Wörter blieben beim Test identisch.

## v0.7.172 – NVM-Anzeigeprofil und Live-Start robuster

- DIY-Bridge: automatische NVM-Anzeigeprüfung vor dem zyklischen Live-Start; bestehende SSP3-Kompatibilitätsausnahme bleibt erhalten.
- Lokale Archivsuche auf 3 Sekunden begrenzt; bei Timeout werden lokale Referenzen weiter geprüft. NVM-Wortnummer, Lesezeit und Sperrenfreigabe im USB-Protokoll.
- Keine Änderung an NVM-Programmierfreigaben, CRC-Prüfungen oder Firmware. Hardwaretest ausstehend.

## v0.7.171 – USB-Protokoll auch bei blockierter Kommunikation exportieren

- Der USB-Protokoll-Download im geführten Assistenten bleibt unabhängig vom USB- und Sensorstatus sowie laufenden Kommunikationsoperationen verfügbar.
- Der Export nutzt bereits lokal aufgezeichnete Diagnosedaten und startet keine weiteren Sensorabfragen. Bestehende Sperren für Hardwareaktionen bleiben unverändert.
- Hardwaretest auf betroffenen Notebooks ausstehend.

## v0.7.170 – Digitaler Sensorwert in % nur mit Expertenparametern

- Der gesamte Abschnitt «Digitaler Sensorwert in %» im EEPROM-Viewer ist standardmässig ausgeblendet und erscheint ausschliesslich bei aktivierten Expertenparametern.
- Die automatische Referenzerkennung, gespeicherten Einstellungen und Live-Anzeige bleiben unverändert. Keine Änderung an Sensorregister- oder Kalibrierlogik.

## v0.7.169 – EEPROM-Viewer: Ausgangsbegrenzung korrekt vergleichen

- Ausgangsbegrenzung vergleicht nur CFG_EN.limit_en und, bei aktiver Begrenzung, LIMIT_LO/HI einschliesslich Hysterese. Andere CFG_EN-Bits (insbesondere Druck-ADC-Aktivierung beim Erstabgleich) lösen keine gelbe Markierung mehr aus.
- Gleiche Regel für RAM und vorgemerkte Werte. Inaktive Grenzwerte bleiben in den Rohdaten sichtbar; tatsächliche Änderungen der aktiven Begrenzung werden weiterhin markiert.
- Rein lesende Anzeigeänderung; keine Änderung der Sensorregister oder Kalibrier-/Programmierlogik.

## v0.7.168 – Erstabgleich ohne doppelte EEPROM-Lesung und Routine-Popup

- Bereits vollständig gelesene, CRC8-/CRC16-geprüfte und wiederholt bestätigte Original-NVM-Daten aus dem erfolgreichen SSP3-RAM-Wiederanlauf werden an den Kalibrierablauf übergeben. Das unveränderliche Abbild ist an USB-Port, Sitzung und physische Chip-UID gebunden.
- Archivstart und NVM-Vorabprüfung nutzen dieses Abbild statt eines zweiten 64-Wort-Lesezyklus. Bei neuer Sitzung, abweichender UID oder Verbindungsverlust bleibt die bisherige Neulesung erforderlich.
- Die Standardinitialisierung eines nachweislich druckunkalibrierten SSC (Druck-ADC, Messzyklus, AFE-Pflichtbit/Gain) benötigt kein separates Bestätigungsfenster. Dezenter Hinweis in der Vorabprüfung; nicht standardmässige Filter-/Temperaturänderungen und Ersatz bestehender TK bleiben bestätigungspflichtig.
- Unabhängige vollständige NVM-Rücklesung vor der tatsächlichen Programmierung, Originalbackup, DSP-Verifikation, endgültige Schreibbestätigung, Boot-/Factory-Schutz und Nachprüfung unverändert.
- Regressionen für die Wiederverwendung, Sitzungs-/UID-Sperren, fehlgeschlagene Initialisierung, ausbleibendes Routine-Popup und erhaltene Warnungen. Hardwaretest der Zeitersparnis ausstehend.

## v0.7.167 – Erstabgleich: Druck-ADC vor der Kalibrierung aktivieren

- USB-Protokoll vom 24.11.2026: STATUS 0x8014 (nur Temperaturmessung). Gemäss DS 25DS0170E.04 §6.5.1.1 deaktiviert CFG_EN.s_cor_en=00 auch den Druck-ADC.
- Nur bei CRC-/UID-geprüftem druckunkalibriertem EEPROM-Profil wird der Druckpfad im RAM gezielt 00 → 10 aktiviert. CMD idle, AFE-Pflichtbit, CFG_EN, CFG_PERIOD, Rücklesung, CMD start und frisches ADC_S-Statusbit. Bei Fehler Rücksetzung der geänderten RAM-Wörter; keine NVM-Programmierung.
- Vorabprüfung zeigt die geplante Druckaktivierung ausdrücklich an. Erstabgleich-NVM benötigt bestätigte Messpunkte, DSP-Verifikation, Originalbackup, geprüfte AODO-Skalierung, unveränderte Boot-/Factory-Wörter und CRC-/Rückleseprüfungen.
- Regressionen modellieren den beobachteten Temperatur-only-Status statt einen bedingungslos frischen ADC. Hardwaretest mit neuen Prints steht aus.

## v0.7.166 – Sensorbrücken-Rückrechnung: ADC-Faktor korrigiert

- Grundlegender Rechenfehler behoben: 700 mV wurde bisher fälschlich als ADC-Vollbereich ±32768 Digits verwendet. Laut Elmos E703.11 25DS0170E.04 §6.2.1.10 gilt V_ADC[V] = ADC_S[Digits] / (32768 × AADC).
- Im Sensorbrücken-Rechner werden automatisch alle 45 dokumentierten ADC-/LP-Filterkombinationen aus Datenblatt-Tabelle 7.5-1 (CFG_ADC, CFG_LP0, CFG_LP1; NVM-Wörter 24, 25, 26) erkannt.
- Neue inverse AFE-Formel berücksichtigt AADC, PGA1, Offset-DAC nach PGA1, PGA2, interne SVDD sowie alle drei Signal-Invertierungsbits. Die Druck-Polynomumkehr und die ursprünglichen ADC-Digits bleiben unverändert.
- Für ein nicht dokumentiertes Filterprofil erscheinen bewusst keine nominellen mV/V-Werte. Ein unabhängig bestimmter AADC-Faktor kann optional nur für diese Rückrechnung manuell eingegeben werden. Automatisch/manuell/fehlend wird klar angezeigt.
- Numerische Formeldetails im Info-Dialog und nvm-formeln.html verwenden jetzt dieselbe korrekte ADC-Formel.
- Reproduzierbares Beispiel aus dem Test: vor Korrektur ca. -14,99 mV/V Nullpunkt und -2,56 mV/V Spanne; mit AADC=0,953854 ca. -13,67 / -3,83 mV/V gegenüber extern -13,6 / -3,81 mV/V. Die aktuelle NVM-Filterkonfiguration des externen Vergleichschips muss noch separat bestätigt werden.
- Sieben Regressionstests inklusive aller 45 ADC-Presets, Polynom- und AFE-Rückrechnung, fehlendem AADC, manueller Eingabe und Gegenprobe der alten Fehlformel erfolgreich simuliert. Kein Hardwaretest der neuen Version.
- Keine Änderungen am SSP3-/ESP32-Verbindungsablauf, Live-Messung, Sensor-RAM/NVM oder Kalibrier-Schreibschutz.

## v0.7.165 – SSP3-Prozentanzeige ohne NVM-Wartezugriffe wiederhergestellt

- Nach der Chip- und UID-Erkennung wird die Standardanzeige in % wieder aus den ohnehin bereits gelesenen aktiven AODO-RAM-Registern (CFG_EN, CFG_AODO, AODO_O und AODO_F) abgeleitet, sofern eine plausible analoge symmetrische 10–90-%-VDD-Skalierung vorliegt.
- Der DSP-Endwert wird aus AODO_F errechnet und gemäss der bisherigen 100-Digit-Konvention gerundet (Beispiel AODO_F=3579 → ±30'000 Digits, DSP_S=−29'930 → 0,12 %).
- Die Anzeige ist ausdrücklich als «% · AODO-Näherung» gekennzeichnet. 10–90 % VDD ist eine Annahme, keine unabhängige Kalibrierungsprüfung. Fehlende/ungültige AODO-Werte bleiben Digits. Bestätigte chipgebundene Kalibrierprofile haben Vorrang.
- Der SSP3 führt beim Verbinden weiterhin keine automatische NVM-Profilprüfung durch; keine neuen USB-Lesevorgänge, keine Änderungen an Firmware, RAM, NVM, Verbindungsaufbau oder Schreibschutz.
- JavaScript-Syntax und fünf isolierte Referenztests (gültiges AODO, fehlende Verstärkung, Offset, ungeeigneter Modus, getrennter Chip) erfolgreich. Ein realer Hardwaretest steht noch aus.

## v0.7.164 – SSP3-Notebook: Live-Verbindung unabhängig vom optionalen NVM-Profil (Test)

- Beim originalen SSP3 wird die zusätzliche automatische NVM-/DSP-Anzeigeprofilprüfung unmittelbar nach dem Verbinden nicht mehr gestartet. Diese Prüfung stoppte die Live-Abfrage und konnte auf langsamen FTDI-/USB-Hosts in einer seriellen Transaktion hängen bleiben.
- Verbindungsprüfung, Chip-UID, RAM-/Startfensterprotokoll, ADC-/DSP-Live-Abfragen und sämtliche Schreibschutzregeln bleiben unverändert.
- Es werden zunächst rohe DSP-Digits statt möglicherweise nur angenommener Prozentwerte angezeigt; das NVM kann weiterhin manuell im EEPROM Viewer ausgelesen werden, um ein bestätigtes Anzeigeprofil zu übernehmen.
- Kein NVM-Schreibzugriff, keine ESP32-Firmwareänderung. JavaScript-Syntax geprüft; Tests simulieren SSP3 ohne automatische Profilabfrage und USB-Bridge mit bisherigem Verhalten. Hardwaretest an den Sony-/Lenovo-Notebooks ausstehend.

## v0.7.163 – SSP3-Verbindungsdialog auf langsamen Rechnern entkoppelt (Testversion)

- Der Verbindungsdialog wartet nicht länger auf die optionale automatische NVM-/DSP-Anzeigeprofilrekonstruktion. Die initiale AFE-/ADC-Prüfung und die echte UID-Erkennung bleiben unverändert.
- Erst nach Abschluss der SSP3-/ESP32-Initialisierung und Schliessen des Verbindungsdialogs folgt ein begrenzter, nachgelagerter Versuch zur Anzeigeprofilprüfung (maximal 30 s, ohne NVM-Programmierung). Bei einer bereits laufenden Kalibrierung, Diagnose oder NVM-Aktion entfällt diese Zusatzprüfung. Ohne bestätigtes Anzeigeprofil bleiben die digitalen Digits sichtbar.
- Die Verbindung zeigt nun die Phasen USB-Port, Adapter-Firmware, Chip-Schnittstelle und Sensorerkennung sowie bei SSP3 die Startfenster-/RAM-Prüfung.
- Live-Abfragen werden für die optionale Profilprüfung vorübergehend unterbrochen und anschliessend nur für dieselbe bestätigte Chip-UID fortgesetzt.
- Keine Änderung am SSP3-Protokoll, der Magic-Cookie-/Power-Startsequenz, dem Sensor-NVM oder den Kalibrier- und NVM-Schreibsperren.
- JS-Syntaxprüfung und vier isolierte Simulationen (normale Verbindung, Live-Fortsetzung, fehlende UID, laufender Schreibvorgang) erfolgreich. Kein Hardware-/Notebooktest; das löst mögliche echte USB-Write-Hänger nicht nachweislich.

## v0.7.162 – Lastschalter auch im geführten Expertenmodus

- Im geführten Modus unter «Verbindung & Diagnose» erscheint bei aktivierten Expertenparametern und DIY-Adapter (ESP32-C3/Pro Micro) die Option «Sensorversorgung über Adapter steuern» inklusive Hinweis zu GPIO10/D7 und angeschlossenem Lastschalter.
- Der Haken übernimmt den bereits bestehenden, standardmässig eingeschalteten Wert aus dem klassischen Verbindungsdialog. Änderungen werden bidirektional synchronisiert und über denselben vorhandenen Browser-Speichermechanismus übernommen.
- Die Einstellung gilt beim nächsten Verbindungsaufbau; keine zusätzlichen GPIO-Befehle, Firmware- oder NVM-Änderungen.
- JavaScript-Syntax und statische Sichtbarkeits-/Synchronisationsprüfung durchgeführt; realer USB-Hardwaretest steht noch aus.

## v0.7.161 – Sensorversorgung im Standard-Verbindungsdialog

- Die DIY-Programmer-Option «Sensorversorgung über Adapter steuern» ist bereits in Schritt 1 ohne Expertenmodus sichtbar. Automatische Power-Cycle-Funktion bleibt technisch an den angeschlossenen Lastschalter auf GPIO10 (ESP32-C3) bzw. D7 (Pro Micro) gebunden.
- Einmalige Migration vormals versteckter, gespeicherter Aus-Einstellungen: Standard beim DIY-Programmer ist aktiv. Danach bleibt eine bewusst gewählte Deaktivierung gespeichert, damit Adapter ohne Lastschalter weiterhin unterstützt werden.
- Baudrate und GPIO4/Split bleiben Expertenparameter; die Versorgungsoption kann während einer bestehenden USB-Verbindung nicht umgestellt werden. Für eine Änderung neu verbinden.
- Keine Änderungen an Sensor-NVM, Kalibrierablauf oder ESP32-Firmware. Browser-/Hardwareprüfung steht aus.

## v0.7.160 – Erstabgleich bei fehlendem AFE-Pflichtbit

- Erkennung des protokollierten druckunkalibrierten Zustands anhand von gültiger CRC8/CRC16, deaktivierter Druckkorrektur, leeren Druckkoeffizienten, inaktivem Messzyklus, fehlender Ausgangsskalierung und unverändertem Elmos-Temperaturbeispielprofil.
- Nur für dieses Profil CFG_AFE1 Bit 11 zunächst im RAM setzen. Erst nach bestätigtem Messprofil, Vorabprüfung, Kalibrierung und DSP-Verifikation im NVM-Zielabbild übernehmen. Kein automatisches NVM-Schreiben und keine Änderung der Factory-/One-Wire-Register.
- PSSC-Start beendet bei Diagnose-UID nicht ohne RAM-Wiederanlauf. Weitere Startprofile nur bei transientem Transportfehler vor Schreibzugriff; nach nicht bestätigten Schreibvorgängen keine automatische Wiederholung.
- Regressionen mit rekonstruierten Registerwerten aus den beiden USB-Fehlerbildern; physische Hardwarevalidierung ausstehend.

## v0.7.159 – Automatischer SSP3-RAM-Wiederanlauf

- Bei bestätigter UID und CFG_AFE1=0 wird der Wiederanlauf beim Verbinden und Neuinitialisieren automatisch versucht, ohne zuvor gespeicherte UID oder Wechsel in die klassische Ansicht.
- Individuelle AFE-Konfiguration nur aus CRC8-/CRC16-geprüftem EEPROM übernehmen. Bestehende DSP-Koeffizienten und Temperaturkonfiguration prüfen und unverändert lassen. Bei inaktivem Messzyklus kontrolliert RAM-Messung starten. Keine NVM-Programmierung und keine pauschalen Standardwerte.
- Freigabe erst nach RAM-Rücklesung, ADC-Status und UID-Prüfung. Bei ungültigem EEPROM oder fehlender Bestätigung Diagnosezustand beibehalten. Hardwaretest ausstehend.

## v0.7.158 – Testkandidat: NVM-Vorabprüfung und Messpunktentwurf

- Original-NVM, UID, CRC, Programmer, Startmodi und Messprofil vor der ersten Messung prüfen. SSP3-Filter-/Messzyklusänderungen nur nach ausdrücklicher Bestätigung übernehmen.
- Bestehende temperaturabhängige Druckkoeffizienten nur nach ausdrücklicher Bestätigung durch einen Abgleich ohne TK ersetzen.
- UID-gebundener lokaler Messpunktentwurf mit Export und Wiederherstellung bei identischem NVM, Messprofil, AFE und Referenzplan. Keine alten Schreibfreigaben übernehmen.
- Pflichtbackup, vollständige NVM-Rücklesung und Vergleich des Messprofils und DSP vor Schreiben und nach Neustart. Hardwareabnahme noch ausstehend.

## v0.7.157 – DSP-Druckkorrektur beim SSP3-Abgleich dauerhaft übernehmen

- SSP3-Druckabgleich: CFG_EN.s_cor_en gezielt von 00 auf 10 aktivieren; alle anderen Bits bleiben unverändert. Reservierte Werte bleiben gesperrt.
- NVM übernimmt die Aktivierung nur nach bestandener DSP-Verifikation und bestätigtem RAM. Vorschau und Schreibprüfung behandeln Kalibrierbits getrennt von AODO. Backup, UID, CRC, Bootschutz und Rücklesung bleiben erforderlich.
- Messprofilprüfung beim AFE-Wiederanlauf bleibt bestehen. CFG_PERIOD und ADC-/Filterkonfiguration werden nicht stillschweigend dauerhaft verändert. Hardwaretest steht aus.
- Regressionstest für ursprünglich deaktivierte Druckkorrektur ergänzt.

## v0.7.156 – NVM-Freigabe nach SSP3-AFE-Wiederanlauf

- Ein geprüfter SSP3-Abgleich mit vorgemerkter Analogskalierung kann nach einem AFE-Wiederanlauf gespeichert werden, wenn die aktiven Messregister mit dem geplanten NVM-Abbild übereinstimmen.
- Die App prüft das Messprofil bei der Vorschau und erneut vor der Schreibfreigabe. Bei einer Abweichung nennt sie das betroffene Register.
- Der Ablauf mit passendem und abweichendem Messprofil wurde simuliert. Der Test am echten SSP3 steht aus.

## v0.7.155 – SSP3-Kalibrierung ohne erneuten Kaltstart speichern

- Beim originalen SSP3 lässt sich ein geprüfter DSP-Abgleich mit vorgemerkter Analogskalierung in der laufenden Sitzung speichern, wenn Startkonfiguration, Ausgangsart und Brückenspannung unverändert bleiben.
- Vor dem Schreiben werden Chip-UID, alle 64 bisherigen NVM-Wörter und die aktiven DSP-Koeffizienten geprüft. Original-Backup und Schreibbestätigung sind erforderlich.
- Der Ablauf ist durch Softwaretests geprüft. Der Test mit einem angeschlossenen SSP3 steht aus.

## v0.7.154 – ADC-Tiefpass kompakter anzeigen

- Kleinere Schrift und weniger Innenabstand im ADC-Filter-Dropdown; geführte Ansicht räumt der Filterbezeichnung mehr Breite ein. Vollständige Bezeichnung zusätzlich als Tooltip. Filterprofile und RAM-Schreiblogik bleiben unverändert.

## v0.7.153 – Brückenpolarität sauber ins AFE-Layout integriert

- Eigener zweispaltiger Umschalter Normal / Invertiert statt dreispaltigem Gain-Stepper. Kompakter, bündiger Aufbau in geführter, klassischer und kompakter Ansicht, inklusive Darkmode.
- Aktive Auswahl folgt ausschliesslich dem bestätigten CFG_AFE1-RAM-Wert; ohne Verbindung keine markierte Auswahl. Während Schreib-/Abgleichvorgängen gesperrt; Klick auf den aktiven Zustand verändert nichts. Bestätigung und Kalibrier-Schutz unverändert.
- Regressionstest für Layoutstruktur und bestätigte/gesperrte Auswahl ergänzt. Hardwaretest ausstehend.

## v0.7.152 – ESP32-C3 One-Wire-Verbindung und Startdiagnose

- ESP32-C3: bevorzugte 100/25 kBd zuerst, bei PLC-Fehler alternative Rate automatisch; erfolgreiche Verbindung wird nicht durch unnötige weitere Zugriffe unterbrochen. Manuelle RAM-Recovery erst nach den normalen Versuchen. Automatische Hintergrundabfrage bleibt ohne neue RAM-Recovery.
- Bei Fehlern lesende Diagnose beider Adressen 0x6C und 0x7C je getesteter Rate; CRC, Flanken, AFE-Pflichtbit 11, Fehlerursache und aktive USB-/PLC-Einstellungen im JSON. Die Exportversion entspricht der App.
- GPIO10-Schaltbefehl/Startversuch werden protokolliert; physische VDD-Unterbrechung und Startfenster bleiben ohne Messung unverifiziert. UID-Prüfung und AFE-/NVM-Sperren bleiben bestehen.
- Mit vorhandener ESP32-Firmware v0.14 nutzbar. Firmware-Quellcode v0.15 ergänzt beide Adressen bei unterschiedlichen Probe-Fehlern, tatsächliche Baudrate sowie lesende Register-/UID-Diagnose; bereitgestelltes Installer-Image bleibt bis zum bestätigten Build v0.14.
- Sechs simulierte Verbindungsszenarien und JavaScript-Syntaxprüfung bestanden. Realer Hardwaretest und Firmware-Build ausstehend.

## v0.7.151 – Brückenpolarität im AFE

- CFG_AFE1 Bit 12 (s_pga1_inv) vertauscht SIP und SIN vor PGA1. Klassische und geführte Ansicht verwenden dieselbe Einstellung. RAM-Änderung nach Bestätigung und Rücklesen, alte Messpunkte werden verworfen. NVM erst nach vollständigem Abgleich.
- Presets, Config-Import/-Export, Serienabgleich, ADC-CSV und Archivdaten übernehmen die Polarität. Alte Profile ohne Polaritätsfeld belassen die aktuelle Chip-Einstellung.
- EEPROM-Viewer und Sensorbrückenrechner zeigen die Polarität an; bestehende Rückrechnungsformel berücksichtigt bereits die drei Invertierungsstufen. Neuer Regressionstest für Bit-Schutz und Konfigurationskompatibilität. Hardwarevalidierung ausstehend.

## v0.7.150 – DSP-Warnung mit direkter Neuberechnung

- Der Button übernimmt den vorgeschlagenen DSP-Endwert und berechnet die Koeffizienten unmittelbar anhand der bereits erfassten Messpunkte neu. Geführter und klassischer Modus werden unterstützt.
- RAM-Übertragung, unabhängige DSP-Prüfung und NVM-Programmierung bleiben separate Schritte. Fünf simulierte Prüfungen des Button-Ablaufs bestanden; Browser-/Hardwaretest ausstehend.

## v0.7.149 – DSP-Referenz im Sensorbrücken-Rechner korrigiert

- Live-Anzeige und Sensorbrücken-Rechner verwenden dieselbe DSP-Endwert-Erkennung und dieselbe 100-Digit-Plausibilitätsgrenze. Bei bekannter 10–90-%-VDD-Kennlinie erfolgt die Rückrechnung aus AODO_F auf das 100-Digit-Raster.
- Passende Komplettabgleich-Dateien und gespeicherte Profile werden anhand der ausgewählten NVM-Daten geprüft. Das gilt auch für offline importierte Dateien. Keine Übernahme der DSP-, Druck- oder Temperaturreferenzen eines anderen Sensors.
- Unbekannter DSP-Endwert: kein stillschweigender Standard ±32’000. Eine Rückrechnung erfordert eine passende Referenz oder einen ausdrücklich manuell angegebenen Endwert. Bei widersprüchlichem Profil wird der angenommene physikalische Druckbereich nicht automatisch übernommen. Bei ungültiger CRC wird die automatische DSP-Zuordnung gesperrt.
- Ohne bekannten physikalischen Druckbereich sind die Referenzbedingungen in Prozent voreingestellt. TK0/TKR bleiben modellbasierte Rückrechnungen; echte Temperatur-ADC-Messdaten sind separat zu bestätigen. Keine Änderungen an Sensorregistern oder EEPROM.
- 47 Software-Regressionsprüfungen für DSP-Anzeige, Logging und NVM-Rückrechnung bestanden; Hardware- und visueller Browsertest ausstehend.

## v0.7.148 – Einheitliche digitale Prozentwerte

- Live-Anzeige, DSP-Messwertkarten, geführter Modus, Test/Logging und Nachmessung nutzen dieselbe DSP-Endwertreferenz und die ungerundete Prozentumrechnung. Kein zusätzlicher manueller DSP-Endwert für Messungen.
- Einzelmessungen und aggregierte Messwerte enthalten Prozentwerte und die referenzierte DSP-Skalierung; vollständige JSON/JSONL-Protokolle speichern Quelle, Chip-UID, gegebenenfalls EEPROM-CRC und AODO-Parameter. CSV- und druckbare Prüfprotokolle zeigen die Prozentwerte an.
- Fehlende DSP-Werte werden nicht als null Prozent interpretiert. Eine geänderte Sensorreferenz während einer Messgruppe verhindert die Annahme der Messung. Ein widersprüchlicher physikalischer Prüfbereich sperrt die Toleranzbewertung. Bei AODO bleibt die Annahme einer 10–90-%-VDD-Kennlinie bestehen; physikalische Druckwerte und Toleranzfreigabe erfordern einen bekannten bzw. bestätigten Druckbereich.
- Softwareprüfungen mit simuliertem Sensor und Exporten bestanden; reale Hardwareprüfung steht aus. Sensorprogrammierung bleibt unverändert.

## v0.7.147 – Sensorwert-Infobox ohne Flackern

- Native Browser-Tooltips am Sensorwert durch eine dauerhaft vorhandene, per Hover oder Tastaturfokus sichtbare Infobox ersetzt. Live-Abfragen aktualisieren nur den Text bei tatsächlichen Änderungen, ohne die Box neu zu öffnen.
- Das Fragezeichen bleibt bei vorübergehenden DSP-Lesefehlern sichtbar, solange der Sensor verbunden ist. Berechnung und Profilauswahl bleiben unverändert.
- Simulierte Live-Aktualisierungen geprüft; visueller Browser- und Hardwaretest ausstehend.

## v0.7.146 – Digitaler Effektivwert mit Profilvergleich

- Beim Verbinden wird im bereits freigegebenen lokalen Archiv nach einem passenden Komplettabgleich gesucht (Chip-UID, aktuelle EEPROM-CRC und gültige 64 Wort). Andernfalls wird das vorhandene Browserprofil geprüft.
- Auch bei einem passenden Abgleichprofil wird AODO mit den aktuellen EEPROM- und RAM-Registern verglichen. Bei aktiver Automatik und einer Abweichung über 100 Digits wird der aus AODO rekonstruierte, auf 100 Digits gerundete DSP-Endwert verwendet. Ohne gültige AODO-Referenz bleibt das verifizierte Profil erhalten. Die AODO-Umrechnung setzt eine 10–90-%-VDD-Kennlinie voraus.
- Kompakte Anzeige «% · Effektivwert» mit Fragezeichen: Quelle, DSP_S, Profil-Endwert, AODO_F, berechneter/gerundeter Endwert, Abweichung und Annahmen beim Überfahren sichtbar. Keine Änderung an EEPROM oder USER-ID.
- Softwaretests für Rundung, Profilauswahl, Archivdatei und CRC-Prüfung; realer Hardware- und Browser-Hovertest ausstehend.

## v0.7.145 – Digitalen DSP-Endwert rekonstruieren

- Für die AODO-Näherung wird der berechnete DSP-Endwert auf die nächsten 100 Digits gerundet (z. B. 30’001.2 → 30’000) und erst danach der digitale Prozentwert aus DSP_S berechnet.
- Die Annahme einer 10–90-%-VDD-Kennlinie und eines 100-Digit-Rasters bleibt als Näherung gekennzeichnet. Bestätigte Abgleichprofile behalten unverändert Vorrang. Keine Änderung an EEPROM, USER-ID oder Kalibrieralgorithmus.
- Rohwert und gerundeter Endwert werden in der Diagnose angezeigt. Softwaretests mit der tatsächlichen AODO-Gain-Quantisierung für 288 darstellbare Zielwerte bestanden; Hardwaretest ausstehend.

## v0.7.144 – Startfehler nach Update beheben

- Alle JavaScript-Dateien der Hauptseite verwenden einen gemeinsamen Release-Cacheparameter. Ältere Expert-/Alarm-Skripte benötigen das in v0.7.143 entfernte DSP-Eingabefeld; gemischte Versionen konnten den UI-Start abbrechen.
- USB-Zugriffe und Auto-Connect werden erst nach vollständiger Modulinitialisierung aktiviert. Ein Initialisierungsfehler wird direkt gemeldet, ohne den Port zu öffnen.
- Die automatische 10–90-%-Erkennung und die USER-ID bleiben unverändert. Softwaretests für Cache-Konsistenz und Startfreigabe, Hardwaretest ausstehend.

## v0.7.143 – Digitale Prozentanzeige und getesteter Preview-Stand

- DSP-Sensorwert in Prozent aus der verifizierten chipbezogenen Kalibrierreferenz, unabhängig von späteren Eingabefeldern.
- Automatische Legacy-Erkennung mit standardmässiger Annahme 10–90 % VDD; AODO-Näherung bleibt sichtbar gekennzeichnet, im EEPROM Viewer abschaltbar. Kein Schreiben in USER-ID oder EEPROM.
- Bei fehlendem Abgleich, nicht passender Ausgangsskalierung oder abweichenden relevanten RAM-/NVM-Werten weiterhin Digits statt falscher Prozentzahl.
- Übernahme des Preview-Stands 522d94d einschliesslich der darin enthaltenen Alarm-, I²C-/Bridge- und Kalibrieränderungen.
- Softwaretests der Rückrechnung und simulierten Erkennung; reale Hardwareprüfung der neuen Automatik noch ausstehend.

## v0.7.142 – Sensorbrücken-Rechner: Komplettabgleich und NVM-Backup zuverlässig laden

- Der lokale Import im Sensorbrücken-Rechner nimmt weiterhin reine **64-Wort-NVM-Backups** (`E70311-CM64-v2`) und bestätigt deren erfolgreiche Übernahme nun deutlich mit Datei, Chip-UID und Kalibrierzustand. Die vom Benutzer geprüfte Beispieldatei `ELMOS_NVM_20261118_171706468_0020018A487B_2916.json` wird erkannt; S_F und S0–S15 sind darin 0, also kein gespeicherter Druckabgleich.
- Ein vollständiger bestätigter **Komplettabgleich** (`E70311-CALIBRATION-COMPLETE-v1`) lädt auch dann die 64 NVM-Wörter, wenn seine optionalen Referenz- oder Messpunktmetadaten fehlen beziehungsweise ungültig sind. Dies wird separat als Profilwarnung statt als gescheiterter NVM-Import angezeigt.
- Der Dateidialog wird jetzt über einen echten Upload-Button geöffnet; nach jeder Auswahl wird das File-Input geleert, sodass dieselbe Datei erneut gewählt werden kann.
- Erfolg und Fehler erscheinen direkt neben der Dateiauswahl. Bei einem ungültigen Folgeimport bleiben bereits erfolgreich geladene NVM-Daten erhalten.
- Vorhandene UID/SER-Prüfung ist für Dateien lokal; die Oberfläche behauptet keine erneute hardwareseitige NVM-CRC-Prüfung. Kein RAM-, EEPROM- oder anderer Sensor-Schreibvorgang.
- Regressionstests für das konkrete 64-Wort-Beispiel, bestätigte Komplettdatei, fehlende Zusatzmetadaten, falsche UID und ungültige Wortzahl ergänzt.

## v0.7.141 – Deutliches DSP-Warnfenster bei Übersteuerung und zu hohem Zielwert

- Der bislang nur in einer kleinen Callout-Zeile sichtbare DSP-Grenzbereich (Zielwert ab ±31'000 Digits) öffnet nach der Koeffizientenberechnung ein auffälliges, zugängliches Dialogfenster mit konkreter Reserve zur 16-Bit-Grenze und einer Empfehlung für einen kleineren DSP-Endwert. Ein hoher Zielwert ist dabei eine **Vorsichtswarnung**, noch kein Nachweis für tatsächliche Sättigung.
- Das Warnfenster erscheint auch bei einem **nicht darstellbaren DSP-Koeffizienten**, bei `STATUS_SYNC.dsp_sat` nach dem RAM-Readback sowie bei einer echten fehlgeschlagenen unabhängigen DSP-Prüfung. Die bisherigen Detailmeldungen bleiben zusätzlich sichtbar.
- Im Dialog kann der Anwender direkt einen vorgeschlagenen kleineren DSP-Endwert einsetzen. Dadurch werden die bestehenden Berechnungs-, RAM- und NVM-Freigaben automatisch ungültig; die aufgenommenen Referenzmesspunkte bleiben erhalten. In der geführten Ansicht wird zur Koeffizienten-Seite zurückgekehrt.
- Das Fenster wird ausschliesslich nach einer ausdrücklichen Berechnung, RAM-Übernahme oder DSP-Prüfung ausgelöst, **niemals bei jeder Live-Abfrage**. Identische Ereignisse werden bis zur nächsten Änderung am DSP-Endwert nur einmal angezeigt.
- Das Fenster ist per Tastatur/ESC schliessbar und nutzt Text statt HTML für alle Werte. Keine automatische NVM- oder RAM-Programmierung.
- Software- und UI-Regressionsprüfung ergänzt; Sensor-Hardwaretest bleibt ausstehend. Vor dem Laden neuer Versionen eine ungesicherte RAM-Kalibrierung archivieren.

## v0.7.140 – Kombinierte DSP-/AODO-NVM-Kalibrierung auf ESP32-C3 mit Bridge-User-NVM

- Ursache: Der Magic-Cookie-/PLC-RAM-Recovery-Zweig von `prepareNvmOperation()` erlaubte eine **gemeinsame Druckkalibrierung und analoge Ausgangsskalierung** nur mit originalem SSP3, obwohl die aktuelle ESP32-C3-Laborfirmware eine generische User-NVM-Capability `BRIDGE_USER_NVM_V1` mit `NVM ARM HOST` bereitstellt.
- Neue Freigabe ausschliesslich für den **ESP32-C3 SuperMini mit erkanntem `BRIDGE_GENERIC_RAM_V1` und `BRIDGE_USER_NVM_V1`** sowie bestätigtem 1-Wire-Zugriff, aktivem Lastschalter-Kaltstart der aktuellen USB-Sitzung und derselben Chip-UID. Fehlende Capabilities oder eine reine `PLC RECOVER`-Verbindung reichen nicht. Der Hardwarestart wird im Bridge-Firmwarebefehl `NVM ARM HOST` nochmals unabhängig geprüft.
- Analogmodus bleibt unverändert, S0/S1 müssen ausdrücklich vorgemerkt sein. Der kombinierte NVM-Diff wird gegen die bestehende `CAL.validateRecoveryCalibrationDiff(...,{allowAnalogScaling:true})`-Whitelist geprüft. Factory-/Bootregister sind weiterhin unveränderbar; unabhängige DSP-Prüfung, AODO-Zielspannungen, UID, CRC16 und automatisches Original-NVM-Backup bleiben Pflicht.
- Die NVM-Änderungsliste zeigt die tatsächliche erkannte Programmiermethode anstatt pauschal «SSP3». Kein automatisches Neustarten und kein Schreiben ohne explizite Bestätigung.
- **Bisherige ESP32-C3-Firmware ohne die genannten Fähigkeiten bleibt gesperrt.** Für eine echte Sensor-VDD-Trennung ist ein Lastschalter an GPIO10 nötig; Firmwarebestätigung allein beweist keine elektrische Unterbrechung am realen Aufbau. Hardware-NVM-Programmierung nur mit einem entbehrlichen Testchip validieren.
- Positive und negative Sicherheitsprüfungen hinzugefügt. Ein Browser-Reload kann den laufenden RAM-Abgleich verlieren, deshalb vorher archivieren.

## v0.7.139 – SSP3-Kaltstartfreigabe nachträglich nur lesend bestätigen

- Fehlerfolge: Auch in v0.7.138 konnte ein korrekt berechneter und im RAM verifizierter kombinierter DSP-/AODO-NVM-Plan am Kaltstartnachweis scheitern. Beim ursprünglichen AN0204-SSP3-Power-Cycle wurde die flüchtige PLC-Freigabe (`CFG_SPI_I2C.plc_en`) nur einmal abgefragt. War diese Abfrage vorübergehend nicht verfügbar, blieb der ansonsten gültige physische Kaltstartnachweis auf `unbestätigt`.
- Vor dem NVM-Plan wird dieser **einzelne noch fehlende Hardwarebeleg** erneut gelesen: `CFG_SPI_I2C` (RAM 0x06) und `CFG_PADS1` (RAM 0x0A). Voraussetzung sind ein in derselben USB-Sitzung bereits vollständig quittierter SSP3-Stromzyklus, passende Chip-UID, bestätigte Adresse `0x6C`, positiver Chip-Rücklesetest und korrekte Befehlsfolge OFF → ON/PLC T.
- Für diese Prüfung wird Live-Polling kurz angehalten, die letzten Abfragen werden abgewartet und anschliessend der vorherige Livezustand wiederhergestellt. **Keine Sensor-Stromunterbrechung, keine RAM-Konfigurationsänderung, kein NVM-Schreibbefehl.**
- Wenn der physische Kaltstartnachweis tatsächlich fehlt, bleibt die NVM-Freigabe gesperrt. Die Meldung erklärt nun die konkret fehlenden Bedingungen (USB-Sitzung, UID, PLC-Adresse, quittierte PWR_OFF/PWR_ON, PLC-Freigabe). Ein manueller Magic Cookie oder eine normale Chip-Registerlesung erzeugt keinen falschen Kaltstartbeleg.
- DSP-RAM-Verifikation, AODO-Spannungsprüfung, 64-Wort-EEPROM-Backup und sämtliche bestehenden Boot-/UID-/CRC-Sicherheitsprüfungen bleiben unverändert. Regressionsprüfungen für gültigen und ungültigen Kaltstart sowie fehlendes PLC-RAM-Enable ergänzt.
- Noch keine Hardware-NVM-Programmierung validiert. Wichtig: Ein Browser-Reload lädt neue Software, setzt aber laufende Kalibrierzustände zurück; aktive RAM-Kalibrierung vorher sichern.

## v0.7.138 – DSP-Sättigung früh melden und AODO-Ausgang vor NVM abklären

- In «Koeffizienten berechnen» zeigt die App bei sehr engem DSP-Zielbereich (ab ±31'000 Digits) eine präventive Reservewarnung. Das ist eine Warnung, keine automatische Veränderung des Abgleichs.
- Unmittelbar nach dem bestätigten RAM-Koeffizienten-Readback wird `STATUS_SYNC.dsp_sat` optional gelesen. Bei gesetztem Bit erscheint eine deutliche Warnung bereits in der Koeffizientenseite; die unabhängige DSP-Prüfung bleibt zwingend, da der Status auch von einer vorherigen Konversion stammen kann.
- Beim Verifizieren enthält der Sättigungsfehler nun den tatsächlichen `STATUS_SYNC`-Hexwert, DSP_S, Sollwert, Prüfdruck und eine konkrete Rückkehr-Anleitung zum DSP-Zielbereich. NVM bleibt gesperrt, wenn `dsp_sat` gesetzt ist; keine automatische Umgehung.
- Eine neue DSP-Berechnung verwirft veraltete vorgemerkte AODO-Koeffizienten, da diese an den alten DSP-Endwert gebunden waren.
- Mit bereits gelesenem Original-NVM wird frühzeitig überprüft, ob die alte AODO-Skalierung die gewünschten S0/S1-Spannungen mit dem **aktuellen** DSP-Zielbereich liefert. Bei Bedarf erscheint eine Warnung auf der Ausgangs- und NVM-Seite; im geführten Ablauf wird vor dem Alarmschritt die ausdrücklich geprüfte Vormerkung verlangt. Die alten Messpunkte und RAM-Kalibrierung bleiben erhalten.
- Die eigentliche UID-, CRC-, AODO-, DSP- und Kommunikations-Sicherheitslogik vor dem NVM-Write bleibt unverändert. Neue negative/positive Regressionstests hinzugefügt; Realhardware-Validierung weiterhin offen.
- **Laufende Browser-Sitzungen:** Ein Reload zum Laden der Version kann die noch nicht dauerhaft gespeicherten RAM-Kalibrierwerte verlieren. In diesem Fall ohne Reload in der aktuellen Version zuerst in «Ausgang» die Skalierung berechnen und vormerken.

## v0.7.137 – SSP3-Kaltstart-Nachweis für kombinierte NVM-Kalibrierung vereinheitlicht

- Fehler in v0.7.136: Nach bestätigtem SSP3-Power-Cycle mit Magic-Cookie-Fallback und korrekt vorgemerkter AODO-Skalierung zeigte Schritt «Ausgang» eine grüne Startfreigabe, während Schritt «NVM» ausschliesslich den alternativen PSSC-RAM-Startnachweis akzeptierte und deshalb blockierte.
- Die NVM-Sicherheitsprüfung `psscRecoveryProven()` akzeptiert jetzt **beide** vollständig bestätigten SSP3-Kaltstartpfade: PSSC-RAM-Start und AN0204 (PWR_OFF → PWR_ON/PLC T, erfolgreicher Chip-Readback).
- Beide Prüfpfade benötigen die **laufende USB-Port-/Sitzungsbindung**, dieselbe Chip-UID, bestätigte PLC-Adresse `0x6C`, wiederhergestellte Stromversorgung und gültige Register-Rücklesung. AN0204 verlangt zusätzlich erfolgreiche OFF/ON-Befehlsquittungen, den abgeschlossenen Startstatus und eine bestätigte PLC-RAM-Freigabe.
- Eine blosse Magic Cookie, ein ADC-Lesewert, eine alte Sitzung, eine unbestätigte Registeradresse oder eine DIY-Bridge reichen ausdrücklich **nicht** für die SSP3-NVM-Freigabe. CRC16, 64-Wort-Backup, AODO-Zielspannungen, RAM-DSP-Verifikation und unveränderte Kommunikations-Bootregister bleiben Pflicht.
- Regressionsprüfung für gültigen PSSC-/AN0204-Kaltstart und für unzulässige Freigaben ergänzt. Softwareseitig geprüft; die dauerhafte NVM-Programmierung muss weiterhin an einem entbehrlichen E703.11 mit SSP3 validiert werden.
- Hinweis: Beim Laden der neuen Version wird eine bisherige Kalibrierung im Browser nicht wiederhergestellt. Die laufende Sitzung nicht ohne Sicherung neu laden.

## v0.7.136 – Verbindung und NVM-Freigabe erneut prüfen, ohne Sensorneustart

- Neuer Button **«Verbindung & NVM-Freigabe erneut prüfen (ohne Neustart)»** nach der DSP-Verifikation in klassischer, geführter und kompakter Ansicht.
- Keine sensorseitige Stromunterbrechung: DSP-Kalibrierregister werden vor und nach einem vollständigen, CRC-geprüften 64-Wort-NVM-Readback verglichen. Der bestehende NVM-Lesepfad wiederholt bei One-Wire die dokumentierten `PLC P` / `PLC T`-Befehle. Es werden keine NVM-Programmierbefehle ausgelöst und keine Druck-/Temperaturmesspunkte gelöscht.
- Die Chip-UID, dieselbe USB-Sitzung, der Kalibrier-Fit und die unabhängige DSP-Verifikation müssen unverändert sein. Danach wird der normale NVM-Plan erneut erstellt; die bestehenden One-Wire-/Magic-Cookie-/UID-/CRC-/Register-Sperren werden nicht umgangen.
- Bei geänderten RAM-Koeffizienten bleibt der Datensatz erhalten, aber die DSP-Verifikation wird aus Sicherheitsgründen ungültig. Bei jedem anderen Fehler wird ein älterer NVM-Schreibplan verworfen; eine fehlende Kaltstartfreigabe kann ohne echten Kaltstart nicht ersetzt werden.
- Die neue Funktion ist keine Wiederherstellung früherer Browser-Sitzungen. Der Button wird erst nach Laden von v0.7.136 sichtbar; bisher nicht persistierte Kalibriersitzungen lassen sich nach einem Reload weiterhin nicht automatisch wiederherstellen.
- JavaScript-/Offline-Regressionsprüfung ergänzt. Die Funktion muss noch am echten E703.11 mit SSP3 geprüft werden.

## v0.7.135 – Magic-Cookie: DSP- und AODO-Skalierung im selben NVM-Plan

- Bei bestätigter **PSSC-RAM-Freigabe am originalen SSP3** kann eine ausdrücklich in «Ausgang konfigurieren» vorgemerkte **analoge AODO-Skalierung (S0/S1)** im selben NVM-Abbild wie die DSP-/TK0-Kalibrierung vorbereitet werden. Zuvor wurden diese Register stillschweigend verworfen und die finale Spannungsprüfung blockierte die Kalibrierung.
- **Keine automatische AODO-Freigabe:** Der Bediener muss «Ausgangskonfiguration prüfen und vormerken» ausdrücklich ausführen; ohne Vormerkung erklärt die NVM-Vorbereitung den Konflikt und verweist auf Schritt 6. Es ist kein Neuverbinden nötig.
- **Kombinierter Recovery-Plan nur mit nachgewiesenem SSP3-Kaltstart derselben UID, aktiviertem Original-NVM-Backup und unverändertem AODO-Modus/CFG_AODO.** Die neue pure Differenzprüfung lässt ausschliesslich Kalibrierwörter, AODO-Skalierungs-/Clippingwörter und CRC zu. Factory-, Boot-, One-Wire- und Kommunikationsregister bleiben geschützt.
- Die bestehenden DSP-Prüfpunkte, CRC-/UID-Vergleiche, Zielspannungsprüfung gegen das vollständige Endbild, NVM-Readback und Kaltstartkontrolle bleiben obligatorisch. DIY-Recovery und nicht bestätigte SSP3-Starts erhalten **keine** kombinierte AODO-NVM-Freigabe.
- Klassische NVM-Hinweise nennen jetzt «Änderungen prüfen» statt der unklaren «Änderungsliste vorbereiten»-Anweisung; Cache- und Versionsanzeigen aktualisiert.
- Offline-Regressionsfälle für 3-Punkte-TK0 + 0.5–4.5-V-AODO, Schreibschutz und fehlerhafte AODO-Kennlinie ergänzt.
- **Laborgrenze:** Die kombinierte NVM-Programmierung nach Magic-Cookie-RAM-Freigabe ist noch nicht am echten Sensor verifiziert. Vor Einsatz bei Jürg zuerst mit einem entbehrlichen Testchip prüfen.

## v0.7.134 – Klassische Ansicht ohne Hauptseite

- Die klassische Oberfläche nutzt nur die bestehende linke Seitenleiste. Ein zusätzlicher Home-Button oben, der klickbare «Kalibrierassistent»-Titel und die Rücksprungschaltflächen zur geführten Startseite in den klassischen Werkzeugseiten wurden entfernt.
- «Geführt» im Kopfbereich bleibt der eindeutige Einstieg in die geführte Aufgabenauswahl. Beide Ansichtswechsel «Geführt» / «Klassisch» verwenden die bestehende sichere Abbruch-/Bestätigungslogik für offene Aufträge.
- Innerhalb eines gestarteten geführten Ablaufs erscheint «↩ Aufgabenauswahl»; auf der Aufgabenauswahl selbst und in der klassischen Ansicht wird dieser Button ausgeblendet.
- Kein automatischer Ansichtswechsel nach Sensor-Reconnect. Sensor-Protokolle und NVM-Schreibschutz unverändert.
- Regressionstests für die Trennung von klassischer Seitenleiste und geführter Aufgabenauswahl, Browser-Cache aktualisiert.

## v0.7.133 – Geführte Startseite und Seitenposition getrennt behandeln

- Eine erfolgreiche Sensorerkennung verändert **keine** geöffnete Seite mehr. Insbesondere erfolgt kein automatischer Sprung von «USB & Chip» zu «AFE optimieren».
- Ein EEPROM Viewer oder Sensorbrücken-Rechner, der aus dem geführten Modus geöffnet wurde, bleibt auch nach einem erneuten Sensoranschluss sichtbar. Die gespeicherte Präferenz «Geführt» bleibt unabhängig davon bestehen.
- Die globale Schaltfläche heisst jetzt «Geführte Startseite» und führt ausdrücklich zur Aufgabenauswahl; die klassische Seite «USB & Chip» ist davon getrennt.
- Für einen unterbrochenen, aktiv geöffneten geführten Abgleich bleibt die bestehende sicherheitsbedingte Ungültigmachung der Messpunkte bestehen.
- Erweiterte Regressionstests für Verbindungs- und Ansichtswechsel. USB-/NVM-Protokoll und Kalibrierberechnung unverändert.

## v0.7.132 – Geführte Ansicht beim Sensorwechsel beibehalten

- Nach erfolgreicher E703.11-Erkennung erfolgt kein pauschaler Sprung mehr zur klassischen AFE-Seite. Nur wenn die klassische Ansicht ausdrücklich gewählt ist und der USB-Start angezeigt wird, erfolgt die bisherige Weiterleitung zur AFE-Einstellung.
- EEPROM Viewer und Sensorbrücken-Rechner sind vorübergehende Werkzeugansichten: Der Wechsel dorthin speichert nicht automatisch «Klassisch» als Benutzerpräferenz.
- Nach Trennen und erneutem Verbinden wird aus einer vorübergehend geöffneten Expertenwerkzeug-Ansicht die zuvor gewählte geführte Startseite wiederhergestellt, sobald die Chip-UID bestätigt ist. Ein ausdrücklich gewählter klassischer Modus bleibt klassisch.
- UI-Regressionstests für Verbindungswechsel und bevorzugte Ansicht, neuer Browser-Cachestand. Sensor-Kommunikation, RAM- und NVM-Programmierung sind unverändert.

## v0.7.131 – Automatische Wiederverbindung übernimmt manuellen Bridge-Pfad

- Auto-Connect verwendet für ESP32-C3 und Pro Micro künftig die vollständige bewährte Sequenz `firmware → selectChipInterface → bridgeHello → connectBridgeChip()` statt `connectBridgeChip({autoProbe:true})`.
- `PLC RECOVER` kann bei `PLC_NO_VALID_FRAME` im Rahmen der bereits vorhandenen Routine temporär die 1-Wire-Kommunikation im Sensor-RAM aktivieren. Diese Änderung kann den Analogausgang beeinflussen; die automatische Funktion bleibt optional und explizit gekennzeichnet.
- Sensorstatus und UID werden vor Wiedererkennung zurückgesetzt. Ohne bestätigte UID werden Live-Werte gestoppt und die Prüfung wiederholt. Keine automatische NVM-Programmierung.
- Automatisierte Tests für erfolgreichen Wiederzugriff, fehlgeschlagenen Wiederzugriff und Gleichheit der manuellen Initialisierungssequenz; Version und Cache aktualisiert.
- Hardwaretest am ESP32-C3 SuperMini noch offen.

## v0.7.130 – Rückbau der Verbindungsregression aus v0.7.129

- Verbindungslogik und Benutzeroberfläche auf die v0.7.128 zurückgesetzt, bei der die manuelle ESP32-C3-Sensorinitialisierung funktionierte.
- Der in v0.7.129 neu eingeführte VDD-Schalter in den Einstellungen und die Änderung des Standardverhaltens wurden rückgängig gemacht.
- Die bereits vorhandene, manuell ausgelöste Bridge-Neuinitialisierung mit optionaler PSSC-RAM-Wiederherstellung bleibt erhalten. Auto-Connect bleibt optional; seine Zuverlässigkeit bei `PLC_NO_VALID_FRAME` ist noch nicht bestätigt.
- Eine bei vorherigen Versionen aktivierte automatische Wiederverbindung wird bei diesem Upgrade einmalig aus Sicherheitsgründen deaktiviert (anschliessend weiterhin manuell aktivierbar).
- «Sensor neu initialisieren» bleibt auch während automatischer Leseprüfungen anklickbar, beendet die Wiederholungsplanung und übernimmt nach dem laufenden USB-Zugriff.
- Neue Regressionstests sichern den unveränderten manuellen Recovery-Pfad und die manuelle Priorität. Version und Cache erneuert. Vollständiger Hardwaretest ausstehend.

## v0.7.129 – VDD-Steuerung im laufenden Auto-Connect und PLC RX DIAG

- Sensor-VDD-Steuerung in Einstellungen sichtbar und mit der klassischen Verbindungsoption synchronisiert. Änderungen werden ohne COM-Port-Neustart aktiv; neue Profile starten ohne GPIO10/D7-VDD-Schaltannahme.
- Gelber Unterbruchbalken zeigt PLC START (mit VDD-Schaltung) oder PLC ACCESS (ohne VDD-Neustart).
- Bei jedem dritten fehlgeschlagenen PLC-Auto-Connect lesende Empfangsdiagnose (RX ECHO / EDGES / CRC), sofern die Bridge-Firmware sie unterstützt. Keine automatische RAM-Recovery oder NVM-Programmierung.
- Regressionstests, Versionsnummer und Browser-Cache aktualisiert. Reale Chipantwort muss weiterhin am Prüfplatz bestätigt werden.

## v0.7.128 – Auto-Connect mit PLC START und Statusanzeige

- Auto-Connect nutzt bei aktiviertem PLC-VDD-Schalter jetzt PLC START für ein neues 1-Wire-Startfenster. Externe Sensorversorgungs-Schaltung am GPIO10 (ESP32-C3) bzw. D7 (Pro Micro) erforderlich.
- Ohne VDD-Schalter bleibt PLC ACCESS; automatische RAM-Recovery wird nicht ausgeführt.
- Gelber Banner zeigt, ob Auto-Connect aktiviert ist, aktuelle Prüfung, Wiederholungszahl, Uhrzeit und letzten Fehler.
- Regressionstests, Versionsnummer und Browser-Cache aktualisiert. Hardwaretest ausstehend.

## v0.7.127 – Sensor am ESP32-C3 automatisch wiedererkennen

- Aktiver Auto-Connect führt bei weiterhin angeschlossener ESP32-C3- beziehungsweise Pro-Micro-Bridge zuerst den Bridge-Handshake und PLC ACCESS / I²C ACCESS aus; erst danach werden Chipregister und UID geprüft.
- Beim initialen USB-Verbinden ohne Sensor werden auch nach fehlgeschlagenem Chip-Handschlag automatische Wiederholungen geplant.
- Auto-Probe führt keine Sensor-Stromversorgungsschaltung, keine Magic-Cookie-Freigabe und keine RAM-/NVM-Recovery aus. Kurze One-Wire-Startfenster benötigen unter Umständen weiterhin die manuelle Neuinitialisierung.
- Eine fehlende UID gilt nicht als erfolgreich verbundener Sensor. Weitere Tests für Bridge-Erkennung und fehlgeschlagene Versuche.
- Version v0.7.127, Cache-Parameter aktualisiert. Hardware-Praxistest steht noch aus.

## v0.7.126 – Unterbruchbehandlung und Auto-Connect

- Sensor abgezogen, USB-Adapter weiter verbunden: kein automatischer Wechsel in «Verbindung & Diagnose». Aktuelle Ansicht bleibt stehen, gelber Balken bietet manuelle Neuinitialisierung.
- Physischer USB-/COM-Port-Verlust: im geführten Modus automatische Verbindungsansicht. Chipdaten, alte Messpunkte und NVM-Schreibfreigaben ungültig.
- Neue, standardmässig ausgeschaltete Einstellung für Auto-Connect. Periodische rein lesende Sensorerkennung am bereits offenen Port bzw. Wiederöffnung eines eindeutig erkannten, bereits freigegebenen USB-Ports. Bewusstes manuelles Trennen unterdrückt den Auto-Connect.
- Neue Chip-UID muss erneut gelesen werden; keine Übernahme früherer Kalibrierpunkte oder automatisches NVM-Schreiben. 1-Wire-Startfenster erfordern gegebenenfalls weiterhin manuelle Initialisierung.
- Version und Browser-Cache auf v0.7.126 aktualisiert. Hardwaretest offen.

## v0.7.125 – Clipping ausserhalb des 10–90-%-Ausgangsbereichs

- E703.11-Datenblatt §§6.3.2.7–8: LIMIT_LO/HI begrenzen den digitalen DSP_AODO und sind unabhängig von der Ausgangsskalierung S0/S1; die harte 10–90-%-Grenze wird für Clipping entfernt.
- Untere/obere Grenze werden auf aufsteigende Werte in 0–VDD sowie vorzeichenbehaftete 14-Bit-Q0.13-Codierbarkeit geprüft. Beispiel 0,3 / 4,8 V bei VDD = 5 V ist gültig; exakt 100 % VDD ist nicht exakt codierbar.
- Eingabewarnung bei Clipping ausserhalb des garantierten linearen Analogbereichs von 10–90 % VDD. S0/S1 und die unabhängige NVM-Prüfung bleiben unverändert.
- Regressionstests für gültige Überbereichs- und ungültige Grenzwerte; Versionsnummer und JavaScript-Cache aktualisiert. Reale Ausgangsspannungen bleiben am Prüfplatz zu bestätigen.

## v0.7.124 – Zurück-Navigation und Expertenzugriff im geführten Modus

- Zusätzlicher Zurück-Button oben auf der Diagnoseansicht; der obere Navigationsbutton wechselt zu «Zurück zum Assistenten». Beide sowie der untere Zurück-Button bleiben bei laufenden Hardwarevorgängen bedienbar. Navigieren unterbricht keinen Sensorzugriff.
- Registerdiagnose, 12-s-1-Wire-Lesetest und experimentelle Magic-Cookie nur bei aktivierten Expertenparametern sichtbar; die Startfunktionen prüfen den Expertenstatus zusätzlich.
- SPI-Testmodus nur bei eingeschalteten Expertenparametern auswählbar. Standardfunktionen für Protokollwechsel, Neuinitialisierung und USB-Protokollexport bleiben verfügbar.
- Version und Cache-Parameter aktualisiert, zusätzliche Regressionstests ergänzt. Realen Sensorwechsel separat prüfen.

## v0.7.123 – Geführte Verbindung und Protokollwechsel

- «Verbindung & Diagnose» ist im geführten Modus unabhängig vom aktuellen Kalibrierschritt erreichbar und öffnet sich nach einem Sensor-Kommunikationsabbruch.
- Adapterwahl (Original-SSP3 oder DIY-Bridge), Chipprotokoll (1-Wire, I²C, SPI beim SSP3), Neuverbinden am bekannten Port sowie neue USB-Portauswahl.
- Vor dem Sensorwechsel wird ein aktiver Abgleich sicher abgeschlossen oder unvollständig archiviert. Alte Messpunkte, Chipzuordnung und NVM-Freigaben werden nicht wiederverwendet. Der Browser führt keine automatische NVM-Programmierung aus.
- Bei Verbindungsfehlern sind die vorhandene lesende Registerdiagnose, der 12-s-1-Wire-Lesetest und der USB-Protokollexport direkt aus der geführten Ansicht erreichbar. Die experimentelle Magic-Cookie-Freigabe (nur RAM, möglicherweise AODO-Überlagerung) ist ausschliesslich nach expliziter Bestätigung am SSP3-Prüfplatz verfügbar.
- Version und Cache-Parameter aktualisiert; neue automatisierte Tests für Schnittstellenwechsel, aktive Archivdatensätze und gesperrte Chipvorgänge. Hardware-Gesamttest offen.

## v0.7.122 – Alarm- und Begrenzungsregister im RAM-Vergleich korrigiert

- Die im RAM bereits gelesenen Alarm-/DSP-Nachskalierungsregister CM55 und CM56 werden im EEPROM Viewer korrekt angezeigt, statt fälschlicherweise «Nicht gelesen» zu melden.
- Die gleiche Korrektur gilt für die Ausgangsbegrenzung über CM59 und CM60.
- RAM-Snapshots mit einzelnen Registerwerten werden nur mit den erforderlichen vollständigen 16-Bit-Wörtern ausgewertet; 64-Wort-EEPROM-Arrays behalten ihre strenge Validierung.
- Fehlende Werte bleiben unmarkiert, tatsächliche Abweichungen weiterhin gelb hinterlegt. Keine Sensor-Schreiboperationen.
- Zusätzliche Regressionstests und Version v0.7.122 samt aktualisierten Browser-Cache-Parametern.

## v0.7.121 – Gelbe Markierung abweichender RAM-Werte im EEPROM Viewer

- «Sensoreinstellungen im Überblick»: Unterschiede zwischen EEPROM und einmalig gelesenem RAM werden mit gelbem Hintergrund direkt hinter dem betroffenen RAM-Wert markiert.
- Nicht gelesene und identische Werte bleiben unverändert. Bei einzeln dekodierten Einstellungen werden nur tatsächlich unterschiedliche Anzeigewerte markiert; mehrteilige Registerwerte werden anhand der zugehörigen Rohwörter verglichen.
- Auch die aufklappbaren S0–S15- und T0–T3-Koeffizienten zeigen abweichende RAM-Werte gelb an.
- Rein lesende Darstellung. App-Version, Cache-Parameter und Regressionstests aktualisiert.

## v0.7.120 – Automatischer kompletter Sensorabgleich-Export

- Nach erfolgreicher NVM-Programmierung und vollständiger 64-Wort-Rücklesung wird für echte Sensorabgleiche automatisch eine separate JSON-Komplettdatei mit Original-NVM, programmiertem NVM, ADC-Messpunkten, AFE, DSP, Prüfresultaten, Chip-UID und vollständigem Archivprotokoll abgelegt.
- Die Komplettdatei wird nach der Neustartprüfung sowie beim endgültigen Abschluss aktualisiert und kann im Archiv manuell heruntergeladen werden.
- Der NVM-Rechner kann die Komplettdatei laden und übernimmt das zugehörige NVM-Abbild und die dokumentierten Kalibrierreferenzen.
- Sichtbare Web-App-Version, Kalibrierberichtsversion und README auf v0.7.120 angehoben. Cache-Parameter der betroffenen JavaScript-Module erneuert.
- Die GitHub-Regressionsprüfungen decken den Datenexport und Import ab; der vollständige Praxistest mit einem realen Sensor bleibt offen.

## Firmware ESP32-C3 v0.14 – USB-Antworten zuverlässig abschliessen

- Der ESP32-C3 schliesst die USB-Antwort samt Prompt mit Serial.flush() ab. Beim wiederholten I²C-Adresswechsel konnten Antworten zuvor bis zum nächsten USB-Befehl zurückgehalten werden.
- Beide Adresspaare 0x6C/0x6D und 0x7C/0x7D am realen Sensor durch vorübergehende Adresswechsel im RAM geprüft. Kaltstart stellt die Originaladresse aus dem NVM wieder her.
- Pro Micro v0.29 enthält weiterhin dieselbe I²C-Adresskorrektur. Sein USB-Treiber ist separat und bleibt von dieser ESP32-spezifischen Korrektur unberührt.

## Firmware ESP32-C3 v0.13 / Pro Micro v0.29 – vollständige I²C-Adresssuche

- Gemeinsame I²C-Bibliothek prüft CRC-Adressen bis einschliesslich 0x7F. Bisher endete die Suche vor 0x78 und übersah dadurch einen angeschlossenen Sensor auf 0x7D.
- CRC-Prüfung, Chipkennung und Konfigurationsprüfung bleiben für die Erkennung erforderlich.
- ESP32-C3 mit SDA GPIO6, SCL GPIO7, Versorgung GPIO10 und NCS/SA0 an GND am realen E703.11 geprüft. Keine Verbindung über AODO nötig, wenn I²C im Sensor aktiv ist.
- Pro-Micro-Builds für 8 und 16 MHz übernehmen dieselbe Korrektur. Ein realer Pro-Micro-Hardwaretest steht aus.

## v0.7.119 – Funktionsoffene USB-Bridge für beide DIY-Programmer

- ESP32-C3 SuperMini und Arduino Pro Micro: Generische 16-Bit-RAM-Registerzugriffe über One-Wire/PLC und I²C statt Funktionstabellen im Mikrocontroller.
- Beide melden `BRIDGE_GENERIC_RAM_V1` und `BRIDGE_USER_NVM_V1`, bieten `NVM ARM HOST` und dürfen alle User-NVM-Wörter 16–63 nach bestätigtem Kaltstart programmieren.
- 20-s-Leerlauf- und 180-s-Maximalzeit der NVM-Freigabe; Factory-Region und NVM-Controller-Kommandos bleiben gesichert.
- Browser führt dieselben Alarm-, AFE-, DSP-, Ausgangs- und NVM-Prüfregeln wie beim SSP3 durch. Legacy-Firmware bleibt weiterhin auf bisher bekannte Funktionen eingeschränkt.
- Compilerworkflow erstellt ESP32-C3 v0.12 und Pro Micro v0.28 (8/16 MHz), veröffentlicht installierbare Images nur bei grünem `main`-Build.
- Software- und Bridge-Protokolltests; tatsächliche elektrische Validierung, I²C-User-NVM, SPI und DMM-Verifikation stehen noch aus.
- [Architektur und Sicherheitsgrenzen](docs/UNIVERSAL_BRIDGE.md).

## v0.7.118 – Alarme in Kalibrierablauf und Config einbinden

- Klassische Navigation und geführter Ablauf: «Alarme & Fehler» optional nach Ausgang und vor NVM.
- «Ohne Alarmänderung zur NVM-Programmierung» in beiden Ansichten; vorhandene Alarmwerte werden dabei unverändert erhalten.
- Explizite Möglichkeit zum Deaktivieren von Alarm/ERR/EOC-Aktionen (nicht identisch mit Überspringen).
- Ein gemeinsames NVM-Abbild aus DSP-/AFE-/AODO- und bestätigten Alarmwerten, inklusive CRC16, Bootschutz, Register-Whitelist, Backup und 64-Wort-Rücklesen.
- Nachträglicher Alarm-Edit bleibt separat möglich, ohne erneuten Druckabgleich.
- Selective Config v2 und Presets um Alarmgruppe erweitert; Standard «skip», Validierung vor Import, kein automatischer Hardware-Schreibvorgang.
- Neue Regressionstests für Config-Roundtrip, kombinierte Kalibrierung und Navigation.
- **Laborstatus:** Reale NVM-/Alarmsignaltests stehen weiterhin aus; nur Original-SSP3 für neue Alarm-Schreibfunktionen freigegeben.

## v0.7.117 – Eigener Alarmtab und verifizierbare Einstellabhängigkeiten

- Neue eigenständige Navigation **«Alarme & Fehler»**, getrennt von den 64 EEPROM-Rohdaten.
- Alarm- und EOC-Diagnose, Alarmgrenzen, Hysterese, EOC-ODER-Verknüpfungen und Fehlerreaktionen in einem Arbeitsbereich.
- Umfangreiche Erklärungen zum Zusammenspiel von Alarm, EOC, ERR_EN, DSP-Nachskalierung und sicherer RAM-/NVM-Übernahme.
- Live-Regelprüfung aus dem bestätigten NVM-Abbild: harte Sperren bei aktiver Nachskalierung, überlappenden Hystereseschwellen, EOC-/One-Wire-/Temperatur-/SDA-Pinkonflikten oder ungültigen Zahlen; Hinweise bei unwirksamen Konfigurationen.
- Die gleichen harten Regeln gelten bei der Registerberechnung, nicht nur im Browser.
- Direktes EEPROM-Einlesen und Wechsel zu NVM aus dem Alarmtab; der bisherige Workflow-Sperrfehler für geprüfte Alarmänderungen ist behoben.
- Zusätzliche Regressionstests; geschützte Boot-/Factory-Wörter bleiben unangetastet.
- **Laborprototyp:** Die elektrische Alarmfunktion und die dauerhafte NVM-Übernahme müssen weiterhin mit echter Hardware geprüft werden.

## v0.7.116 – Alarm- und Fehlereditor mit sicherem RAM-/NVM-Ablauf

- In der EEPROM-Ansicht lassen sich jetzt Alarmgrenzen (0–100 %), Hysterese, EOC-ODER-Maske und sechs Fehlerreaktionen inklusive Ersatzwerten einstellen.
- Ein 64-Wort-NVM-Diff mit CRC entsteht zunächst nur als Vorschau. RAM-Übernahme ausschliesslich über Original-SSP3 mit Readback und Rücksetzversuch im Fehlerfall.
- Die dauerhafte Speicherung verwendet den bestehenden UID-/Backup-/CRC-/Power-Cycle-geschützten NVM-Ablauf und ist erst nach erfolgreichem RAM-Test freigegeben.
- Keine Änderung von physischer EOC-Pinbelegung, One-Wire-Startfenster, Factory- oder sonstigen Bootregistern. Bei aktivem DSP-Post-Scaling bleibt der Alarmeditor gesperrt.
- Eigene Regressionstests für Kodierung, Hysterese, STATUS-Maske, CRC, Sperren und Workflow. [Prüfanleitung](docs/ALARM_KONFIGURATION.md).
- **Laborprototyp:** Kein vollständiger elektrischer Alarmtest mit echtem E703.11 durchgeführt.

## v0.7.115 – Verständliche Original-PSSC-Konfiguration und Alarmdiagnose

- Klartext statt Hex für alle bekannten Original-Elmos-Filterkombinationen mit Frequenz, Abtastrate und Auflösung.
- EOC-ODER-Maske und Pinzuordnung, Alarm-/DSP-Post-Skalierung, Fehlerreaktionen, Ersatzwerte und Temperaturquelle in der EEPROM-Konfigurationsübersicht dekodiert.
- Zusätzliche **nur lesende** Alarm-/EOC-Diagnose mit optionalem `STATUS_SYNC`-Snapshot, an aktuelle UID, Sitzung und CRC gebunden.
- Physikalischer Druckbereich und Einheit lokal pro Sensor-UID und NVM-CRC nach erfolgreichem Abgleich gespeichert und bei späterer geprüfter EEPROM-Lesung wiederhergestellt.
- Gemeinsamer Filterkatalog, Softwaretests und [vollständiger Funktionsvergleich](docs/PSSC_FEATURE_PARITY.md).
- **Grenze:** NVM-Schreiben für noch ungeprüfte Alarm-, Filter-, Schnittstellen- und Class-Funktionen bleibt gesperrt. Keine vollständig portierte Original-DLL.

## v0.7.114 – Elmos AN0203: DSP/AODO vor NVM zusammen prüfen

- Druck- und Temperatur-Sollwertformeln nach Elmos AN0203 zentralisiert; optional kleinere DSP-Spanne bleibt erlaubt.
- Im finalen Analog-Kalibrierplan wird die auf der Oberfläche sichtbare AODO-Skalierung nun automatisch mit vorgemerkt, wenn keine explizite Ausgangsvormerkung besteht. Der NVM-Diff bleibt vor jedem Schreiben kontrollierbar.
- **NVM-Schreibsperre bei S0/S1-Widerspruch:** `CFG_EN.scale_en`, `AODO_O/F`, Limiting, DSP-Spanne und VDD müssen im 64-Wort-Endbild zusammenpassen. Clipping kann einen falschen Roh-Gain nicht verstecken.
- Tempöräre One-Wire-Recovery umgeht keine geschützten Bootregister; in diesem Fall wird ein nicht speicherbares analoges Spannungsziel blockiert.
- Neuer Ausgangsvergleich unmittelbar vor NVM-Schreiben und nach echtem Power-Cycle.
- Neun eigenständige Offline-Tests sowie [Testanleitung](docs/ELMOS_KALTSTART_TEST.md).
- **Grenze:** Proprietäre `pssc_cal_calibration`-/`pssc_cal_overall`-Interna sind noch nicht bitgenau portiert oder mit der Original-DLL verglichen; reale AODO-Spannung benötigt externes DMM. Laborprototyp, nicht hardwarefreigegeben.

## v0.7.113 – Echter Browser-Zurück-Schutz bei ungespeicherter Kalibrierung

- Bei bereits aufgenommenen Messpunkten, berechneten/ins RAM geschriebenen, aber noch nicht dauerhaft im NVM gespeicherten Kalibrierdaten oder einem vorbereiteten NVM-Plan fordert die Web-App vor Browser-Zurück, Neuladen oder Schliessen den **nativen Browser-Bestätigungsdialog** an.
- Die Auswahl «Auf dieser Seite bleiben» bricht das Verlassen wirklich ab und erhält die laufende Sitzung mitsamt Messpunkten. Keine nachträgliche Toast-/Popup-Warnung.
- Ohne offene Daten oder nach erfolgreichem NVM-Schreiben erscheint keine Warnung. Während einer laufenden Mess-/Schreibaktion bleibt der Dialogschutz aktiv.
- Umsetzung über `beforeunload` mit `preventDefault()` und `returnValue`; der Wortlaut des Dialogs wird von Microsoft Edge/Chrome bestimmt. Normale Benutzerinteraktion vor der Warnung ist im Browser erforderlich. Gegen Browserabsturz, Betriebssystemabbruch und Stromausfall hilft dieser Schutz nicht; hierfür sind Backups notwendig.
- Automatisierte Prüfung im Chromium-Browser: «Bleiben» nach einer Messpunktaufnahme behält die Daten, nach erfolgreicher NVM-Speicherung kann ohne Warnung navigiert werden. Zusätzlich neun Fälle der Zustandsprüfung getestet.

## v0.7.112 – EEPROM-Rohdaten direkt unter der Übersicht anzeigen

- Die 64-Wort-EEPROM-Tabelle ist direkt unter der neuen Konfigurationsübersicht sichtbar, ohne zusätzliches Aufklappen.
- Suche, Registerdetails, CRC-geprüfte Lesedaten und Schutzstatus bleiben unverändert. Die Darstellung enthält weiterhin keine Schreibfunktion.

## v0.7.111 – EEPROM-Konfigurationsübersicht und RAM-Vergleich

- Der EEPROM Viewer zeigt nach einer 64-Wort-Lesung und CRC8/CRC16-Prüfung die gespeicherten Sensoreinstellungen kompakt in vier Gruppen: Kommunikation, AFE, DSP/Kalibrierung und Ausgang.
- Dokumentierte Felder wie PGA1, Offset, PGA2, SVDD, 1-Wire-Startfenster und AODO-Skalierung sind verständlich dekodiert; unbestätigte Register bleiben als Rohwert sichtbar. S0–S15 und T0–T3 sind zusätzlich einzeln aufklappbar.
- Ein optionaler Knopf liest die aktuellen RAM-Register auf Wunsch, zeigt Unterschiede zum EEPROM und hält den Zeitpunkt des Snapshots fest. Vorgemerkte, noch nicht programmierte Einstellungen werden nur mit zum EEPROM passender Ausgangsbasis separat angezeigt.
- Die bisherige 64-Wort-Registertabelle bleibt vollständig vorhanden, ist für eine schlanke Ansicht jedoch standardmässig eingeklappt. Die neue Übersicht enthält keinerlei Schreibpfad.
- JavaScript-Syntax und reine Vergleichs-/Dekodierungsfunktionen softwareseitig geprüft. Der zusätzliche RAM-Leseablauf muss am echten E703.11 getestet werden.

## v0.7.110 – Clipping-Vorgabewerte und NVM-Schreibstatus

- Bei «Clipping aktivieren» werden leere Unter- und Obergrenzen automatisch mit tatsächlich gespeicherten Eingabewerten von 10 % bzw. 90 % VDD (5 V → 0.5 V / 4.5 V) befüllt. Manuell geänderte Grenzen bleiben beim Umschalten erhalten.
- Der NVM-Schreibknopf zeigt ab dem Klick direkt einen dauerhaften Status und Phasen wie Archiv/Vorprüfung, Schreibfreigabe, geschriebene Wörter und vollständige 64-Wort-Rücklesung. Fehler und Erfolg bleiben sichtbar, auch im geführten und kompakten Layout.
- Ein fehlendes Ausgangs- oder Kalibrierprotokoll wird nun vor dem Schreiben über das Archivmodul gestartet, statt mit einer generischen Fehlermeldung abzubrechen. Fehlender Archivordner oder fehlende Schreibberechtigung werden konkret gemeldet; ohne erfolgreiches Archivprotokoll wird kein NVM-Schreiben begonnen.
- Wenn das Original-NVM bereits für die aktuelle Chip-UID verifiziert ist, übernimmt der Archiv-Snapshot dessen vorhandene 64 Wörter, ohne die vorbereitete Ausgangsänderung zu verwerfen. Der eigentliche Schreibpfad liest und prüft das NVM vor dem Programmieren weiterhin erneut.
- JavaScript-Syntax und 12 UI-/Sicherheitsprüfungen bestanden. Hardwareprogrammierung noch nicht am echten E703.11 validiert.

## ESP32-C3 Firmware v0.11 (Test) – Binärdateien und Web-Installer aktualisiert

- GitHub Actions hat den ESP32-C3-Sketch mit Arduino-ESP32-Core 3.3.7 und USB CDC aktiviert erfolgreich kompiliert.
- Der Web-Installer bietet jetzt **ESP32-C3 SuperMini v0.11 (Test)** an und nutzt das neue Manifest `firmware/releases/esp32-c3/v0.11/manifest.json` mit vier vorhandenen Binärdateien.
- Diese Version enthält die experimentelle, gesonderte Freigabe für reine AODO-Skalierung und Clipping im NVM. Der normale Kalibrierpfad und die alten v0.10-Dateien bleiben bestehen.
- **Nicht hardwarevalidiert:** NVM-Schreiben unter temporärer RAM-Recovery. Nur mit einem entbehrlichen Testchip und vollständiger Sicherung verwenden.

## v0.7.109 – ESP32-C3: separate Ausgangs-NVM-Testfreigabe vorbereitet

- Der Quellcode der ESP32-C3-SuperMini-Firmware wurde auf **v0.11-dev (noch nicht gebaut / hardwarevalidiert)** erweitert. Neu gibt es einen gesonderten Befehl `NVM ARM OUTPUT` und die explizite Firmwarefähigkeit `BRIDGE_AODO_OUTPUT_NVM_TEST`.
- Die Firmware erlaubt in diesem gesonderten Modus ausschliesslich die AODO-Wörter **16 (CFG_EN nur Bits 6/7), 57–60 und 63 (CRC16)**; bei Wort 16 werden die unveränderlichen Bits mit dem Original-NVM verglichen. Der Kaltstart muss nachweislich erfolgreich gewesen sein. Kommunikations-, Boot-, AFE- und Kalibrierregister bleiben gesperrt.
- Die Web-App schaltet die bisherige Ausgangs-NVM-Sperre für den ESP32-C3 nur frei, wenn diese neue Fähigkeit nach einem echten Verbindungsaufbau gemeldet wird, das Original-NVM gültig ist, ein Backup aktiviert ist und alle bestehenden UID-, CRC-, Recovery- und Änderungsschutzprüfungen erfolgreich sind.
- Der original NVM-Schreibablauf mit Rücklesung, CRC16 und Neustartprüfung bleibt erhalten. Die bisherige ESP32-Firmware **v0.10 im Web-Installer ist weiterhin ohne Ausgangs-NVM-Freigabe**. Für den neuen Teststand ist ein separates Kompilieren und Flashen des ESP32-C3-Sketches nötig.
- **Validierung:** JavaScript-Syntax und acht sicherheitsrelevante Funktionsfälle geprüft. Der ESP32-Build und die tatsächliche NVM-Programmierung am Sensor sind noch nicht geprüft. Keinen produktiven Sensor dafür verwenden.

## v0.7.108 – Beim Vormerken von Ausgangsänderungen die tatsächliche Schreibfreigabe beachten

- Der Ausgangsplan zeigt bei DIY-Bridge und temporärer One-Wire-RAM-Recovery nicht mehr die irreführende Aufforderung, einfach im NVM-Schritt zu speichern. Stattdessen zeigt er ausdrücklich, dass der Plan lediglich vorbereitet ist, aber die Firmware die Ausgangs-NVM-Register noch nicht programmieren kann.
- Der bestehende Druck-/Temperaturabgleich und die gespeicherten Sensordaten werden dabei nicht verändert. Sicherheitslogik, Adapterprüfung und NVM-Schreibfreigaben sind unverändert.

## v0.7.107 – Tatsächlichen Adapter und Blockiergrund im Ausgangs-NVM anzeigen

- Der NVM-Schritt nennt bei reinem Ausgangsplan nun korrekt «Ausgangseinstellungen dauerhaft speichern» statt «Kalibrierung dauerhaft speichern».
- Der aktive Programmieradapter (originaler SSP3 bzw. erkanntes DIY-Board inklusive Firmware) wird direkt neben der Chip-UID angegeben. Der statische PSSC-Schriftzug im App-Kopf ist keine Hardwarekennung.
- Bei PSSC-RAM-Recovery mit DIY-Bridge erklärt die Sperre, dass die freigegebene Firmware bisher nur Kalibrier-NVM, nicht die AODO-Ausgangsregister unterstützt. NVM-, UID- und One-Wire-Sicherheitsprüfungen bleiben unverändert. Keine neue Ausgangs-Schreibfreigabe, kein Hardwaretest.

## v0.7.106 – Ausgang separat speichern, auch nach bestätigter SSP3-RAM-Recovery

- Die bereits vorhandene Aufgabe «Nur Ausgang ändern» kann nach vollständigem 64-Wort-NVM-Lesen mit bestätigter Chip-UID den analogen Ausgang ohne neue Druck-/Temperaturkalibrierung konfigurieren.
- Nach temporärer One-Wire-RAM-Freigabe wird ausschliesslich bei originalem SSP3, nach dokumentiert bestätigtem Kaltstart und gültigem NVM-Backup eine eng begrenzte Änderung an AODO-Skalierung oder Clipping zugelassen. Ausgangsmodus, CFG_AODO, One-Wire-Start, AFE, Koeffizienten und sämtliche weiteren NVM-Register bleiben unverändert.
- Ein Original-NVM-Backup ist dabei obligatorisch. UID, NVM-CRC, bevorstehende Änderungen, Startup-Register und Rücklesung bleiben vor und nach der Programmierung geschützt und werden erneut kontrolliert.
- Die NVM-Seite benennt bei vorbereitetem Ausgangsplan ausdrücklich «Nur Ausgangseinstellungen speichern» und blendet die USER-ID aus, weil diese in einer reinen Ausgangsänderung nicht modifiziert werden darf. Die eigene DSP-Kalibrierung bleibt erhalten.
- **Laborprototyp:** Diese eng begrenzte neue Hardwarefunktion wurde nur statisch und mit sieben simulierten Sicherheitsszenarien getestet. Die reale NVM-Programmierung unter PSSC-RAM-Recovery wurde nicht validiert. Ausschliesslich mit entbehrlichem Testchip prüfen.

## v0.7.105 – Clipping-Einstellungen wieder direkt sichtbar

- In Schritt «Ausgang konfigurieren» sind Clipping-Modus und Spannungsgrenzen bei analogem AODO-Ausgang wieder direkt unter der Ausgangsart sichtbar, ohne aufklappbaren Bereich und ohne Expertenmodus.
- Drei Eingabefelder liegen auf breiten Bildschirmen in einer Zeile. Der bestehende Code für Ein-/Ausblenden und das Vormerken der Werte bleibt unverändert.
- Keine Änderung der DSP-Kalibrierung, Registerlogik oder NVM-Schreibsicherheit. UI-Korrektur, Hardwaretest noch ausstehend.

## v0.7.104 – Verständliche Ausgangsdiagnose und kompakte Darstellung

- Analoge Ausgangsvorschau berechnet die tatsächliche Spannung aus den quantisierten Q3.12-Gain-/Offset-Werten. Bei deaktivierter Ausgangsskalierung erklärt die Meldung nun, weshalb die Zielspannungen S0/S1 nicht angewendet werden, und nennt einen konkreten Lösungsweg. Beispielsweise ergeben ±32’000 DSP-Digits ohne Scaling bei 5 V rechnerisch 0.059–4.941 V und überschreiten den linearen Bereich von 0.5–4.5 V.
- Meldungen unterscheiden zwischen ungültiger VDD, falschem DSP-Zielbereich, S0/S1-Ausserbereich, Gain-/Offset-Fehler, fehlender Skalierung und Abweichungen von den Zielwerten. Kein neuer Druckabgleich erforderlich, nur um 0.5–4.5 V aus ±32’000 Digits zu erreichen.
- Klassischer Ausgang aufgeräumt: Clipping und ausgelesene Chipregister standardmässig eingeklappt; Error-Signaling-Platzhalter durch ausdrücklich nicht decodierte, nur für Experten sichtbare NVM-Rohdaten ersetzt.
- Die NVM-Schreib- und Kalibrierlogik wurde nicht geändert. Hardwaretest sowie Überprüfung der tatsächlichen Ausgangsspannung am Sensor bleiben notwendig.

## v0.7.103 – NVM-Vorbereitung nach One-Wire-RAM-Recovery ohne Clipping-Sperre

- Bei einer bestätigten One-Wire-RAM-Recovery blockieren vorgemerkte Ausgangs-/Clipping-Änderungen die NVM-Kalibrierung nicht mehr: Der bestehende Ausgangsplan wird für diese Kalibrierung ignoriert, ohne die Messpunkte oder RAM-Koeffizienten zurückzusetzen.
- Die NVM-Vorschau zeigt ausdrücklich, dass nur Kalibrierdaten geschrieben werden und die Ausgangs- und One-Wire-Einstellungen unverändert bleiben. Ausgangsänderungen können nach einer erfolgreichen Kalibrierung bei geeigneter Verbindung separat vorgenommen werden.
- Unverändert: UID-/NVM-Backup-Prüfung, One-Wire-Neustartnachweis, erlaubte NVM-Wörter, CRC16, Registerschutz, Rücklesung und Schreibfreigabe. Kein vollständiger Hardwaretest durchgeführt.

## v0.7.102 – Referenztemperaturänderung nur für betroffenen Messpunkt

- Das Ändern von `calLoTemp` oder `calHiTemp` löscht nicht mehr pauschal alle aufgenommenen Kalibrierpunkte. Ist der geänderte Endpunkt noch nicht gemessen, bleiben alle Messungen bestehen.
- Ist der betreffende Endpunkt bereits aufgenommen und ändert sich sein Temperatur-Sollwert tatsächlich, wird ausschliesslich dieser Punkt zur erneuten Aufnahme freigegeben. Die anderen Messwerte bleiben erhalten. Unveränderte Eingaben führen zu keiner Löschung.
- Die bisherige AFE-Hub-Anzeige wird nicht mit veralteten Werten weiter angezeigt, wenn ein Endpunkt fehlt.
- Die DSP-Kalibrierung wird nur freigegeben, wenn die gespeicherten Referenzen sämtlicher Messpunkte mit den aktuellen Druck-, Temperatur- und Einheiteneingaben übereinstimmen.
- Bei Änderungen am globalen Druckbereich, an der Einheit oder AFE bleiben die bestehenden Sicherheitsregeln bestehen.

## v0.7.101 – Live-Werte logisch nach Temperatur und Druck sortiert

- Die permanente Live-Anzeige zeigt neu zuerst **ADC_T** und **SSC-Temperatur**, rechts davon **ADC_S**, **DSP_S** und **Sensorwert**.
- Eine dezente Trennlinie zwischen Temperatur- und Druckwerten macht die Zuordnung sichtbar. Die fünf Kacheln bleiben in der Desktop-Ansicht kompakt auf einer Zeile; auf schmalen Mobilgeräten bleiben die bisherigen responsiven Umbrüche erhalten.
- IDs, Live-Polling, Berechnungen, NVM-Programmierung und Anzeigeeinheiten bleiben unverändert. Keine Änderung an Sensorzugriff oder Kalibrierlogik.

## v0.7.100 – TK0 zwingend mit aktiver Temperaturkompensation

- TK0 erfordert Druckordnung 1 und Temperaturordnung 1. Im klassischen Modus stellt die Auswahl «TK0» beide Ordnungen automatisch auf «Linear»; andere Polynomordnungen werden dort für TK0 deaktiviert.
- Der Rechenkern blockiert TK0 mit Temperaturordnung 0, statt den dritten Messpunkt stillschweigend zu ignorieren. Er verwendet alle aufgenommenen Druck-/Temperaturpunkte und berechnet dabei auch den temperaturabhängigen Druckkoeffizienten S1.
- Zusätzliche Sicherheit beim Erstellen des NVM-Änderungsplans: ein unvollständiger oder älterer TK0-Fit ohne Temperaturkoeffizienten kann nicht programmiert werden. Importierte TK0-Profile richten sich ebenfalls auf lineare Ordnungen aus.
- Die temperaturabhängige **Nachmessung bleibt freiwillig**; der bisherige DSP-Prüfablauf wurde nicht erweitert.
- Regression mit drei Messpunkten (25 °C/0 %, 25 °C/100 %, 75 °C/0 %): TK0/Temperaturordnung 0 wird abgewiesen; TK0/Temperaturordnung 1 verwendet alle drei Punkte und berechnet S1.

## v0.7.99 – NVM-Änderungsliste nur im Expertenmodus

- Die aufklappbare «Änderungsliste (inkl. CRC16) anzeigen» im klassischen NVM-Schritt wird wie die übrigen technischen Details nur bei aktivierten Expertenparametern angezeigt.
- Die bisherige CSS-Ausnahme für `#nvmDiffDetails` wurde entfernt. Die reguläre Archivpfad-Einstellung bleibt zugänglich.
- NVM-Lesen, UID- und CRC-Prüfungen, Programmierfreigaben und der vorhandene technische Inhalt der Änderungsliste bleiben unverändert.
- Regressionstest zur Experten-Sichtbarkeit und Versionsprüfungen aktualisiert.

## v0.7.98 – Hilfetext der Temperaturmessquelle korrigiert

- Ursache der überlappenden schwarzen Felder behoben: Das neue Hilfezeichen verwendete gleichzeitig einen nativen Browser-Hilfetext und die interne Tooltip-Komponente ohne zugeordneten Inhalt.
- Temperaturmessquelle nutzt jetzt denselben internen Hilfetext wie die übrigen Fragezeichen; leere Tooltips werden grundsätzlich nicht mehr geöffnet.
- Tooltip wird oberhalb der Eingabe positioniert, damit er die Dropdown-Auswahl nicht überdeckt (bei zu wenig Platz darunter).
- Beschriftungen der Kalibrierpunkte und Samples gekürzt; vollständige Feldnamen bleiben für Hilfstechnologien erhalten.
- Reine Darstellungsänderung; Messpunktaufnahme, Kalibrierberechnung, DSP und NVM bleiben unverändert.

## v0.7.97 – Einheitliche Versionsanzeige, AFE-DSP-Anzeige entfernen, Exporte nur für Experten

- Der sichtbare Versionshinweis im Kopf wurde mit der Version im Seitenfuss und der internen App-Version synchronisiert (v0.7.97).
- Der noch nicht als kalibriert bestätigte DSP_S-Livewert wird im AFE-Schritt nicht mehr angezeigt. Seine bestehenden Anzeigeelemente bleiben verborgen im DOM, damit laufende Auswertungen unverändert funktionieren; die DSP-Prüfung in Schritt 5 bleibt erhalten.
- Unter „Messpunkte“ erscheinen die Exportfunktionen „Protokoll JSON“ und „Messwerte CSV“ nur mit aktivierten Expertenparametern. „Alle Messpunkte löschen“ bleibt im Standardmodus verfügbar.
- Versionsabhängige Regressionstests und die Prüfung der Experten-Sichtbarkeit wurden aktualisiert.

## v0.7.96 – Klassische Oberfläche kompakter und Expertenbereiche klar getrennt

- AFE: Die drei redundanten ADC-Kacheln werden nicht mehr dargestellt. Die zugehörigen DOM-Werte bleiben für das laufende Sensor-Monitoring erhalten; die globale Live-Anzeige zeigt ADC_S, ADC_T und ADC_TC bereits an.
- AFE: Weniger vertikale Abstände in der normalen Oberfläche. Geschützte Register, Diagnose und USB-Rohprotokoll erscheinen ausschliesslich mit aktivierten Expertenparametern.
- Messpunkte: Sechs Einstellfelder inklusive Temperaturmessquelle sind in einem responsiven, gleichmässigen Raster angeordnet. Der lange Hinweis zur Temperaturmessquelle ist über ein Hilfezeichen abrufbar und belegt keinen eigenen Absatz mehr.
- Alle aufklappbaren technischen Detailbereiche der klassischen Arbeitsschritte und Einstellungen werden in der Standardansicht ausgeblendet. Im Expertenmodus erscheinen sie mit den ursprünglichen Funktionen und Werten.
- Ausnahme: Die sicherheitsrelevante NVM-Änderungsliste bleibt vor dem dauerhaften Schreiben erreichbar, ebenso die reguläre Archivverzeichnis-Einstellung.
- Die Umschaltung der bestehenden Expertenbereiche ist an dieselbe Checkbox gekoppelt und setzt keine Mess- oder Konfigurationswerte zurück. Ein Layout-Regressionstest ist in die CI-Prüfung integriert.

## v0.7.95 – Interne Chiptemperatur nach NVM-Programmierung und Neustart anzeigen

- Behebt das Verschwinden der SSC-Temperatur nach einem abgeschlossenen Kalibriervorgang, Browser-Neustart oder erneuten Verbinden. Die Anzeige hängt nicht mehr ausschliesslich von flüchtigen RAM-Kalibriermarkern ab.
- Ein bereits von der Web-App erfolgreich programmiertes NVM-Abbild wird unter der originalen Chip-UID lokal gefunden. Anhand CRC16, UID, aktivem internem Temperatursensor und vollständigem Vergleich der sechs Temperaturparameter im Chip-RAM wird die AN0203-Temperaturskalierung wiedererkannt, ohne Register zu verändern.
- Ältere lokal gespeicherte elmos8-last-program-Abbilder werden übernommen, sofern sie denselben strengen Vergleich erfüllen und kein Restore darstellen. Neue erfolgreiche AN0203-Kalibrierungen erhalten zusätzlich eine explizite Profilkennung; reine Ausgangsänderungen übernehmen das Profil nur bei passenden Temperaturkoeffizienten.
- Die obere Anzeige unterscheidet «NVM-Abgleich», «RAM-Abgleich», das werkseitige Beispielprofil und unbekannte Kennlinien. Der reale Temperaturwert ist weiterhin unabhängig zu prüfen. Ohne passendes NVM-Abbild, ohne aktive Temperaturfunktion oder bei fremder Chip-UID bleibt die Anzeige bewusst leer.
- Alle Schritte sind ausschliesslich lesend; keine zusätzliche Sensorprogrammierung, kein Lock-Bypass.
- Regressionstest enthält das konkrete 64-Wort-EEPROM-Abbild mit CRC16 0x5CE8 und den Test bei ADC_T 2653 Digits.

## v0.7.94 – Kalibrier-Messpunkte in beiden Ansichten in derselben Reihenfolge

- In der klassischen Ansicht werden die Messkarten nach Temperaturstufe und innerhalb einer Temperatur nach Druck aufsteigend angeordnet: zuerst die Druckpunkte bei der ersten Temperatur, danach die nächsten Temperaturstufen.
- 3-Punkte-TK0: 0 % / 25 °C → 100 % / 25 °C → 0 % / 75 °C. 4-Punkte-TK0+TKE analog mit beiden Druckpunkten pro Temperatur.
- Nummerierung, Titel, Aufnahmebuttons, automatische Messpunktnamen und Detailhistorie folgen der sichtbaren Reihenfolge. Eigene manuell vergebene Namen bleiben unverändert.
- Die Messpunktkarten behalten ihre originalen Identifikatoren und Referenzwerte; es werden keine Rohdaten ausgetauscht und keine Koeffizienten- oder NVM-Routinen verändert. Beim Wechsel vom geführten zum klassischen Modus wird die Liste synchronisiert.
- Für neue Temperatur- und Druckwerte wird die Darstellung unmittelbar aktualisiert. Responsive, kompakte Messkarten bleiben erhalten.

## v0.7.93 – Ein erfolgreicher DSP-Prüfpunkt genügt auch bei TK0/TKE

- Die unabhängige DSP-Nachprüfung akzeptiert einen einzigen erfolgreich geprüften Betriebspunkt auch bei aktiver Temperaturkompensation. Kein verpflichtender zweiter Temperaturprüfpunkt und keine pauschale 10-°C-Freigabesperre.
- Anzahl Prüfstellen bleibt frei wählbar (1–10); wurden mehrere ausgewählt, müssen alle ausgewählten Stellen innerhalb der Toleranz liegen. Die 10-°C-Regel gilt weiterhin nur als Abstand zwischen mehreren Prüfpunkten bei gleichem Druck.
- Stetige Statusanzeige: Ein erfolgreicher Prüfpunkt erlaubt den nächsten NVM-Arbeitsschritt, **belegt aber weder den vollständigen Druckbereich noch die gesamte TK0-/TKE-Kennlinie**.
- Optionale DSP_T-Diagnose darf einen bereits erfolgreichen DSP_S-Druckprüfpunkt nicht blockieren. DSP_S-Toleranz, DSP-Sättigung, RAM-Rücklesen, NVM-Backup und One-Wire-/Bootregister-Schutz bleiben erhalten.
- Geführter und klassischer Verifikationsschritt zeigen die gleichen Regeln und Hinweise. Regressionstests ergänzt.

## v0.7.92 – Kompakter Kopfbereich und korrekte Temperaturprofil-Erkennung

- Alle fünf Live-Werte (ADC_S, ADC_T, SSC-Temperatur, DSP_S und Sensorwert) stehen auf Desktop wieder kompakt nebeneinander. Die zuvor durch ein CSS-Override falsch auf vier Spalten begrenzte Anzeige wurde korrigiert; responsives Layout optimiert.
- Der geführte Kalibrierassistent benötigt weniger Höhe und reduziert Abstände/Kartengrössen ohne das Verbergen von Messdaten oder Prüfungen.
- Die °C-Anzeige verwendet nicht mehr unbesehen die AN0203-Skalierung für beliebige DSP_T-Daten. Die Software prüft CFG_EN.t_abs_en und liest das dokumentierte Elmos-Temperatur-Koeffizientenprofil als read-only Register.
- Bei exakt erkanntem Elmos-Werksbeispielprofil wird eine **ungeprüfte Näherung** aus dem internen ADC_T unter Verwendung der dokumentierten Werksbeispiel-Kennlinie angezeigt, die auf Temperaturänderungen reagiert. Nach einem im aktuellen RAM durchgeführten Temperaturabgleich wird DSP_T nach der AN0203-Konvention interpretiert, sofern die absolute Temperaturkorrektur aktiviert ist.
- Bei unbekannter Temperaturkennlinie wird statt einer möglicherweise falschen Temperatur «—» angezeigt; Tooltip zeigt Rohwert DSP_T, ADC_T und den Status der Temperaturfunktion. Keine Hardware- oder NVM-Konfiguration wird verändert.
- Regressionstests für Werksbeispiel-Kennlinie, dynamische Änderung, unbekanntes Profil und kompaktes Layout.

## v0.7.91 – Verständliche Messpunkthistorie und interne SSC-Temperaturanzeige

- Der geführte Abgleich benennt Messpunkte konsistent nach der sichtbaren Reihenfolge (inkl. richtigem Titel und Aufnahmebutton für den dritten TK0-Punkt).
- Die linke Messpunkthistorie zeigt Zeitpunkt, ADC_S, ADC_T, Streuung, Samples und passende Unterschiede: Druckhub nur bei gleicher Temperatur, Temperaturänderung nur bei gleichem Druck.
- Die frühere pauschale Meldung «Noch fehlende Punkte» unterscheidet nun auch einen zu kleinen Druckhub von fehlenden Kalibrierpunkten oder abweichenden AFE-Gains.
- Oben wird die interne SSC-Temperatur als Näherungswert aus dem korrigierten DSP_T-Register 0x2E angezeigt, sofern CFG_AFE2 die interne Temperaturquelle bestätigt. Der ADC_T-Rohwert wird nicht direkt in °C umgerechnet.
- Die °C-Anzeige hängt von der vorhandenen Temperaturkalibrierung des Chips ab und ist ausdrücklich **ungeprüft**. Sie ersetzt keine tatsächliche Referenztemperatur.
- Live-ADC_S bleibt prioritär; die zusätzlichen Temperaturregister werden zeitlich verteilt gelesen. Die RAM-/NVM-Sicherheitslogik wurde nicht geöffnet.

## v0.7.90 – Temperaturquelle und flexible TK-Kalibrierung

- Feste 500-Digit-Mindestspanne von ADC_T entfernt; die Berechnung prüft numerische Stabilität und die darstellbaren Q3.12-/Q0.15-Koeffizienten.
- Bei nicht darstellbarer TK-Kompensation kann ausdrücklich ein Druckabgleich ohne TK gewählt werden. Dafür werden nur Druckpunkte derselben Referenztemperatur verwendet; bestehende T-Register bleiben unverändert. TK0/TKE werden dabei nicht als kompensiert ausgegeben.
- Neue Temperaturquellen-Auswahl: interner Chip-Temperatursensor als Standard, Brückenwiderstand und externer EOC-Sensor als noch gesperrte Optionen. Vor der Messpunktaufnahme und der RAM-Übertragung wird CFG_AFE2.t_adc_src kontrolliert.
- Messpunkte speichern die Temperaturquelle; bestehende Messdaten, RAM-/DSP-Verifikation, NVM- und One-Wire-Schutz bleiben erhalten.
- Browser-Dateien mit Version 0.7.90 gegen zwischengespeicherte Altversionen abgesichert; Regressionstests entsprechend angepasst.
- **Labor-Testversion:** Temperaturkompensation ist weiterhin eine eigenständige JavaScript-Berechnung und nicht mit der Hersteller-DLL numerisch verifiziert. Brücken-/EOC-Temperaturabgleich noch nicht freigegeben. Vor NVM-Programmierung Sensor im RAM unabhängig prüfen.

## v0.7.89 – DSP-Prüfpunkte für TK0/TKE bei gleichem Druck zulassen

- DSP-RAM-Verifikation prüft den Mindestabstand nun in beiden Referenzdimensionen: mehr als 10 % der Druckmessspanne **oder** mindestens 10 °C Temperaturdifferenz zu jedem bereits bestätigten Prüfpunkt.
- Die TK0-Referenzen 0 bar / 25 °C, 6 bar / 25 °C und 0 bar / 75 °C werden nicht mehr fälschlich als doppelte Prüfpunkte abgelehnt.
- Toleranzprüfung, Temperaturprüfung, vollständige DSP-Freigabe und geschützter NVM-Ablauf bleiben unverändert zwingend.
- Software-Regressionstests für gleiche Druckwerte mit verschiedener Temperatur; reale Sensorprüfung steht noch aus.
- Hinweis: Ein Browser-Neuladen stellt die vorigen RAM-Messpunkte und Berechnungsdaten noch nicht automatisch als aktive Kalibrierungssitzung wieder her. Der Sensor darf keinesfalls allein aufgrund des NVM-Auslesens als neu programmiert gelten.

## v0.7.88 – TK0-Abgleich mit 3 Punkten und TK0 + TKE mit 4 Punkten

- Neuer geführter Modus «TK0 · 3 Punkte»: 0/6 bar bei 25 °C, 0 bar bei 75 °C (Referenzen individuell einstellbar). Drei unabhängige Koeffizienten ohne Druck-Temperatur-Kreuzterm.
- «TK0 + TKE · 4 Punkte» verwendet zusätzlich 6 bar bei 75 °C und bestimmt den gemischten Druck-/Temperaturkoeffizienten.
- Neue Auswahl des Temperaturmodells in klassischer und geführter Ansicht; korrekte Punktzuordnung zu originalen Endpunkt- und Zwischenpunkt-Controls.
- Anzahl und Eignung der Messpunkte werden vor der Berechnung geprüft. Bestehende RAM-Rücklesung, DSP-Verifikation und geschützte NVM-Programmierung bleiben verpflichtend.
- Config-v2-Profile und Kalibrier-PDF dokumentieren den gewählten Temperaturmodus; ältere Profile bleiben kompatibel.
- Neue Software-Regressionstests für Messmatrix, Berechnung, unvollständige TKE-Matrix und Config-Profile. Reale Hardware-Verifikation steht aus.

## v0.7.87 – Kompakter Archivordner-Bereich in App-Einstellungen

- Der Speicherort wird jetzt **in einer kompakten Zeile** mit Ordnername, Berechtigungsstatus und **«Ändern»** angezeigt.
- Die zusätzliche Pfadeingabe ist standardmässig unter **«Pfad hinterlegen»** eingeklappt. Sie belegt keinen Platz, solange sie nicht gebraucht wird.
- Wurde bereits ein vollständiger Pfad manuell hinterlegt, erscheint er **direkt unter dem ausgewählten Ordnernamen**, auch wenn die Eingabe zugeklappt ist. Beim Speichern klappt sich der Editor automatisch zu.
- Da die File System Access API weiterhin nur den Ordnernamen freigibt, ist der **vollständige Betriebssystempfad nicht automatisch abrufbar**; eine Pfadangabe wird nur als manuelle, lokal gespeicherte Beschriftung angezeigt und beeinflusst die tatsächliche Archivablage nicht.
- Der bestehende Schreibzugriff, die IndexedDB-Vormerkung, die Sperre während laufenden Messungen und der Archivordner selbst bleiben unverändert.
- Zusätzliche Regressionstests für die zusammengeklappte Ansicht, die sichtbare gespeicherte Pfadbeschriftung, Ordnerwechsel und weiterhin sichere Ordnerfreigaben.

## v0.7.86 – Dekorativen Esc-Hinweis entfernen und Archivpfad optional anzeigen

- Der kleine Hinweis **«Esc»** rechts oben im Einstellungsfenster war ein nicht interaktives Text-Element, das wie ein Button aussah. Er wurde entfernt. Die echte **Escape-Taste** kann das Fenster weiterhin schliessen; ebenso bleibt das automatische Schliessen beim Klick ausserhalb erhalten.
- Unter **Einstellungen → Speicherort für Messungen & Kalibrierungen** wird weiterhin der echte, vom Browser freigegebene Ordnername angezeigt. Zusätzlich gibt es **«Vollständiger Pfad (optional, nur zur Anzeige)»** mit einem Eingabefeld und **«Pfad merken»**.
- Aus Sicherheitsgründen liefert Chrome/Edge über die File System Access API **keinen absoluten Windows-/macOS-Dateipfad** zurück. Ein vollständiger Pfad kann deshalb nur **manuell als unverifizierte Beschriftung** hinterlegt werden. Das UI kennzeichnet ihn ausdrücklich entsprechend.
- Die Zusatzbeschriftung wird lokal in derselben IndexedDB wie die Verzeichnisfreigabe gespeichert und nach einem Reload wieder angezeigt. Sie wird nur für den passenden Ordnernamen wiederhergestellt und bei jeder neuen Ordnerauswahl zurückgesetzt, damit kein veralteter Pfad für einen anderen Ordner angezeigt wird.
- **Kein Einfluss auf die Datenablage:** Messungen, Kalibrierungen, Nachmessungen, JSONL-Rohdaten und PDFs nutzen unverändert den berechtigten DirectoryHandle, niemals die manuelle Beschriftung.
- Zusätzliche Regressionstests decken manuelle Pfade, Wiederherstellung, Zurücksetzen beim Ordnerwechsel, Abbruch und Schutz ohne ausgewählten Ordner ab.

## v0.7.85 – Archivordner für Kalibrierungen, Nachmessungen und Logging in den Einstellungen

- Unter **App-Einstellungen → Speicherort für Messungen & Kalibrierungen** wird der aktuelle lokale Archivordner mit dem Berechtigungsstatus angezeigt. Mit **«Ordner auswählen / ändern»** lässt sich der Ordner direkt über den sicheren Browser-Dateidialog festlegen.
- Für alle Archivarten wird derselbe Ordner verwendet: **Kalibrierungen, Nachmessungen und Test/Logging (inkl. zugehörigen JSONL-Rohdaten)**. Es entsteht keine zweite Speicherverwaltung neben dem bestehenden Kalibrierarchiv.
- Der Ordner wird wie bisher im lokalen IndexedDB des Browsers vorgemerkt und beim nächsten Öffnen angezeigt. Wenn die Browserberechtigung nach einem Neustart nicht mehr gültig ist, erscheint **«Zugriff freigeben»**. Die App fordert ohne expliziten Klick keine versteckte Schreibfreigabe an.
- Während einer **laufenden Kalibrierung, Nachmessung oder Logger-Aufzeichnung** wird der Ordnerwechsel gesperrt, damit ein Messprotokoll und seine Rohdaten nicht auf mehrere Verzeichnisse verteilt werden. Ein abgebrochener Dateidialog lässt den bisherigen Ordner unverändert.
- Nach erfolgreichem Wechsel wird die Archivliste aus dem neuen Ordner eingelesen. Bestehende Dateien im vorherigen Ordner werden weder automatisch verschoben noch gelöscht. Kein Upload in die Cloud, kein direkter Zugriff auf einen frei eingetippten absoluten Dateipfad.
- Regressionstests für Auswahl, IndexedDB-Vormerkung, Zugriffsfreigabe, aktive Aufzeichnungen, Abbruch und fehlende Browserunterstützung ergänzt.

## v0.7.84 – Kalibrierprotokoll inklusive Diagrammen als PDF speichern

- **Kalibrierung → Ergebnisse prüfen** bietet jetzt wie Nachmessung/Test-Logging den PDF-Export. Der **PDF-Button** ist ebenfalls direkt bei jedem Kalibrierarchiv in der Dateiliste vorhanden.
- Das druckfertige A4-Kalibrierprotokoll enthält Sensor-UID, Adapter und Firmware, Softwareversion, Start/Ende, archivierte Kalibrierpunkte inklusive Referenzwerten, Temperaturen, ADC_S/ADC_T und Sample-Zahlen, verfügbare DSP-Fit-Informationen, NVM-Status sowie **alle unabhängigen DSP-Prüfversuche** mit Referenzdruck, berechnetem Ist-Druck, Druckabweichung, Abweichung in % FS, Toleranz und gespeichertem Bestanden-/Fehlerstatus.
- Die **Diagramme werden unverändert aus dem neuen Archivdiagramm-Modul erzeugt** und als druckbare Inline-SVGs eingebettet: Abweichung mit Toleranzintervallen sowie Soll-/Ist-Druck mit Toleranz. Bei älteren Kalibrierungen ohne DSP-Verifikation erscheint der ADC_S-Rohpunktgraph ohne erfundenes Toleranzband.
- Der Export läuft vollständig lokal. Im vom Browser geöffneten Druckfenster **«Als PDF speichern / Drucken»** wählen und im Systemdruckdialog **«Als PDF speichern»** verwenden. Es werden keine Kalibrierwerte, NVM-Inhalte oder Archivdateien verändert.
- Fehlermeldungen werden im Protokoll dokumentiert. Ein abgeschlossener Archivstatus allein wird nicht als Nachweis einer erfolgreichen unabhängigen DSP- oder NVM-Verifikation dargestellt.
- Zusätzliche automatisierte Tests prüfen PDF-Aufbau, beide SVG-Diagramme, Archiv-Datentreue, alte Datensätze, Eingabesicherheit und die Integration der Download-Buttons.

## v0.7.83 – Kalibrierungen jetzt mit Soll-/Ist- und Abweichungsdiagrammen im Archiv

- Im lokalen Kalibrierarchiv erscheinen beim Öffnen von **«Ergebnisse prüfen»** für Kalibrierungen zwei neue, an die bestehende Nachmessung angelehnte Diagramme: **Druckabweichung in % FS** mit der jeweils gespeicherten Toleranz und **Soll-/Ist-Druck** mit den aufgezeichneten Toleranzgrenzen.
- Prüfpunkte werden mit **grün** (laut gespeichertem Ergebnis innerhalb Toleranz), **rot** (ausserhalb Toleranz) oder **orange** (ohne Bewertung) markiert. Es werden alle real gespeicherten Verifikationsversuche angezeigt, auch fehlgeschlagene und wiederholte Versuche.
- Messquelle sind ausschliesslich die archivierten `verification_attempt`-Ereignisse (`pressure`, `pressureDeviation`, `tolerance`, `pass` usw.). Die vollständige Messspanne wird aus den archivierten Kalibrierpunkten abgeleitet. Fehlt sie, bleibt die Darstellung in der gespeicherten Kalibriereinheit statt eine %FS-Angabe zu erfinden.
- Für alte Kalibrierarchive **ohne unabhängige DSP-Verifikation**, aber mit aufgenommenen Kalibrierpunkten, wird als Fallback der **ADC_S-Verlauf über die Referenz** gezeigt – mit klarem Hinweis, dass dafür **kein Toleranzband** vorliegt.
- Die neuen Graphen sind reine Anzeigen: Es werden weder Archivdateien verändert noch Sensoren angesprochen, und es erfolgt keine zusätzliche Messung oder NVM-Aktion.
- Node-Regressionstests decken die Auswertung von ±Abweichungen, wechselnden Einheiten, wiederholten Versuchen, fehlenden Referenzen, Toleranzgrenzen und die unveränderte Wiedergabe alter Archivdaten ab.

## v0.7.82 – Standarddruck 0–100 % und robuster Start der geführten Ansicht

- **Kalibrierung:** In der klassischen und der geführten Oberfläche ist die Druckeinheit neu standardmässig **%**, mit unterem Referenzwert **0** und oberem Referenzwert **100**. Damit starten neue Kalibrierungen auf **0–100 %**. Sämtliche drei geführten Vorlagen (Schnell, Mit Temperatur, Individuell) verwenden ebenfalls 0–100 % als Druck-Preset und zeigen die Werte an.
- **Frei editierbar:** Physikalische Einheiten wie bar, mbar, kPa und psi bleiben jederzeit manuell wählbar. Ein bereits erfasster Messpunkt wird beim Wechsel auf ein neues Preset nicht stillschweigend verworfen: Vor einer Änderung des Druckbereichs mit vorhandenen Messpunkten erfolgt eine Rückfrage. Vorhandene Archivprotokolle und gespeicherte Sensor-Konfigurationen werden nicht umgerechnet oder überschrieben.
- **Prüfreferenz in der Kalibrierung:** Die voreingestellten Prüfpunkte liegen in der Mitte (50 %) und die dazugehörigen Beispiel-Toleranzen bei 0,2 % der Messspanne; bei einer bewusst anderen Kalibrierungseinheit bleiben die Werte anpassbar.
- **Nachmessung:** Das Eingabeformat **% der Messspanne** bleibt voreingestellt, der reale kalibrierte Druckbereich wird aber weiterhin in der tatsächlichen physikalischen Einheit (z. B. bar) geführt. Es findet keine fiktive Gleichsetzung von 100 % mit 100 bar statt.
- **Ansicht beim Neuladen:** Ein Video vom Fehler zeigte noch Version v0.7.80. Neu startet die Web-App bei fehlender gespeicherter Auswahl direkt in **Geführt**; ein bewusst gewähltes **Klassisch** wird dauerhaft berücksichtigt. Ein zusätzlicher Wiederherstellungsversuch nach dem vollständigen Seitenladen kann die geführte Oberfläche nach einem zeitweiligen Startproblem erneut aufbauen. Nie werden dadurch Kalibrierpunkte, RAM-/NVM-Aktionen oder USB-Kommunikationsbefehle automatisch ausgeführt.
- Regressionstests für Moduswahl, Reload, Startwiederholung, das 0–100-%-Preset und bewusst eingestellte physikalische Einheiten ergänzt.

## v0.7.81 – Geführte oder klassische Ansicht bleibt nach dem Neuladen erhalten

- Der Schalter **«Geführt» / «Klassisch»** speichert die erfolgreich gewählte Ansicht im Browser. **F5**, **Ctrl + R** und das erneute Öffnen der Webseite stellen die zuletzt ausgewählte Oberfläche wieder her.
- Die geführte Oberfläche kann weiterhin **ohne bereits angeschlossenen Sensor** geöffnet werden. Nur die Ansicht wird restauriert, niemals automatisch ein Kalibrier-, Mess-, RAM- oder NVM-Vorgang wiederaufgenommen.
- Die vorher nicht gespeicherte Auswahl fiel nach dem Reload stets auf «Klassisch» zurück. Eine frühe Lade-Markierung verhindert zusätzlich das kurze Aufblitzen der klassischen Arbeitsfläche, wenn «Geführt» gespeichert ist.
- Schlägt die Speicherung z. B. wegen blockiertem Browser-Speicher fehl, bleibt der manuelle Moduswechsel funktionsfähig; eine Lade-Schutzmarkierung wird in jedem Fall entfernt.
- Automatisierte Regressionstests für gespeicherte Ansichten, beide Reload-Zweige, blockierte Speicherung und erfolgreiche bzw. gesperrte Moduswechsel ergänzt.

## v0.7.80 – Archiv ohne leere Kalibrierungen und ohne «Offen»

- **Keine leeren Kalibrier- oder Nachmessungsdateien mehr beim Start:** Solange nur ein Start-Ereignis, automatische RAM-/NVM-Snapshots, Verbindungsprotokolle oder Fehlermeldungen ohne reale Samples vorhanden sind, bleiben die Vorgänge im Arbeitsspeicher. Eine Datei wird erst beim ersten Kalibrier-/Prüfmesspunkt oder einer sicherheitsrelevanten Hardwareänderung geschrieben.
- **Teilweise Messungen bleiben erhalten.** Erfasste Kalibrierpunkte, DSP-Prüfungen, AFE-/RAM-Änderungen, NVM-Vorgänge und echte Teilsamples bei fehlgeschlagenen Messungen lösen die Archivierung aus. Leere Vorgänge werden beim Abschluss/Abbrechen ohne Datei verworfen.
- **Altprotokolle:** Schon vorhandene vollständig leere Archivdateien werden ausgeblendet, aber bewusst nicht automatisch gelöscht. Der Archivhinweis nennt deren Anzahl. Messhaltige Einträge mit altem Status `running`/«Offen» werden als **«Unvollständig»** angezeigt. Alle Dateien mit relevanten Daten bleiben erhalten.
- Die Statusauswahl enthält kein «Offen» mehr. Wirklich unterbrochene oder abgebrochene Vorgänge behalten ihre ausdrücklichen Statusangaben; die bestehende Nachmessungs-Toleranzlogik bleibt unverändert.
- Tests für leere Starts, teilweise Kalibrierungen, relevanten RAM-Änderungen, alte offene Protokolle sowie mögliche Telemetrie-Recoverydaten ergänzt.
- **Hinweis:** Das Archiv entfernt keine vorhandenen Dateien automatisch. Sensorkommunikation und NVM-Schreibschutz bleiben unverändert.

## v0.7.79 – Abschlussstatus von Nachmessungen korrigiert

- **«Abgeschlossen» ist ein Ablaufstatus, kein Toleranzurteil.** Eine Nachmessung gilt nach erfolgreichem Speichern als abgeschlossen, sobald alle vorgesehenen Prüfpunkte tatsächlich aufgenommen wurden. Bei deaktivierter optionaler Toleranzbewertung ist dazu kein «Bestanden» notwendig.
- Bei eingeschalteter Toleranzbewertung bleibt eine nicht bewertbare Prüfung «Unvollständig»; bestätigte Toleranzüberschreitungen werden weiterhin als «Fehlerhaft» gekennzeichnet. Fehlende Messpunkte bleiben unvollständig.
- Alte, bereits beendete Archivdatensätze, die einzig wegen deaktivierter Toleranzbewertung fälschlich «Unvollständig» waren, werden in der Archivliste und in **neu exportierten PDFs** als «Abgeschlossen» dargestellt. Das gespeicherte JSON wird nicht automatisch verändert; das PDF enthält bei einem korrigierten Altstatus einen transparenten Hinweis.
- Wirklich noch laufende Protokolle mit «Offen» und abgebrochene oder unvollständige Kalibrierungen bleiben unverändert.
- Regressionstests für Erfassung ohne Toleranz, aktive Toleranz ohne Bewertung, fehlende Messpunkte, Toleranzfehler und offene Altprotokolle ergänzt.

## v0.7.78 – Nachmessung: klare Eingabefehler und korrekter Referenzdruck

- Beim Start der Nachmessung werden ungültige Druck- und Temperaturreihen sowie Bereichs-, Zyklus- und Toleranzeingaben am jeweiligen Feld rot hervorgehoben. Die Ansicht springt zum ersten fehlerhaften Feld; Eingabekorrekturen entfernen die Markierung.
- Der tatsächlich beim Messpunkt eingegebene Kalibrator-Referenzdruck bleibt änderbar und ist entscheidend für die gespeicherte Druckabweichung. Die Abschlussübersicht, die Diagramm-Details und das PDF zeigen diesen Referenzdruck statt stillschweigend den ursprünglichen Prüfdruck. Abweichende Sollwerte bleiben explizit dokumentiert.
- Bei unterschiedlichen Relativ-/Absolutdruckbezügen zeigt das PDF zusätzlich den für die Sensorabweichung umgerechneten Druck. CSV-Protokolle unterscheiden bei Bedarf ebenfalls zwischen eingegebenem Kalibratorreferenzdruck und korrigiertem Sensorbezug.
- Prüfablauf, Sensorkommunikation und NVM-Programmierung unverändert. Software-Regressionstests für ungültige Listen sowie abweichende Referenzen in Graph und PDF ergänzt. Die Bedienung am realen Prüfstand muss weiterhin verifiziert werden.

## v0.7.77 – App-Einstellungen kompakter und übersichtlicher

- Einstellungsfenster neu in **Darstellung**, **Messung**, **Erweiterte Optionen** und **Hilfen & Tools** gegliedert. Kompaktere Abstände, zusammengehörige Felder in zwei Spalten und klare Beschriftungen.
- **Arbeitsansicht nach dem Verbinden** als Einstellungsoption entfernt. Die **geführte Ansicht** ist weiterhin über die direkte Navigation «Geführt» erreichbar; ein Sensoranschluss startet sie nicht mehr automatisch aufgrund einer alten Preference.
- **Demo-Modus** erscheint in den Einstellungen ausschliesslich, wenn **Expertenparameter** aktiviert sind. Ein bereits aktiver Demo-Modus bleibt aus Sicherheitsgründen im Hauptbereich eindeutig als Simulation gekennzeichnet und kann dort beendet werden.
- Links zu **DIY-Programmer-Firmware**, **Feedback** und **Offline-Anleitung** deutlich sichtbarer als kompakte, kontrastreiche Aktionsflächen dargestellt; auch mit Darkmode und Tastatur-Fokus.
- **Kein Schliessen-Button:** Das Einstellungsfenster verschwindet beim Klick auf eine andere Stelle der Web-App, insbesondere bei einer Hauptnavigation, und mit **Escape**. Der ursprüngliche Klick auf der Hauptseite wird weiter ausgeführt.
- Alle vorhandenen IDs und Speicherregeln für Farbe, Sprache, Kompaktmodus, Hover-Erklärungen, Samples und Live-Intervall bleiben erhalten. Das Layout ändert weder die Sensor-Kommunikation noch den Abgleich oder NVM-Schutz.

## v0.7.76 – Adaptive Live-Abfrage mit 250 ms als Standard

- **250 ms · Standard (adaptiv)** ist neu für Erstbenutzung und ohne gespeicherte persönliche Einstellung vorausgewählt. Der bisherige Standard von 650 ms wird dadurch ersetzt.
- Bestehende, ausdrücklich gespeicherte Einstellungen (250, 400, 650, 1000, 1500 oder 2000 ms) bleiben erhalten und werden beim Aktualisieren nicht überschrieben.
- Die adaptive Rückregelung auf 400/650 ms bei langsamen Sensorantworten, die 2-Sekunden-Pause bei Kommunikationsfehlern sowie der sequenzielle Ablauf der Sensorabfragen bleiben unverändert.
- Die Zeit gibt weiterhin die **Pause nach der abgeschlossenen Messrunde** an, nicht den tatsächlichen Abstand zwischen Sensorwerten. Die reale Stabilität muss mit SSP3/One-Wire beziehungsweise I²C am Hardware-Prüfplatz geprüft werden.
- Einstellungen, Beschriftungen, Hilfetext und aktuelle Anleitungen auf die neue Standardauswahl abgeglichen.

## v0.7.75 – DIY-Programmer auf zwei unterstützte Boards begrenzt

- Die auswählbare **DIY-Programmer-USB-Bridge** bezieht sich nur noch auf **ESP32-C3 SuperMini (Firmware v0.10)** und **Arduino Pro Micro (Firmware v0.27)**. Der originale **ELMOS SSP3** bleibt als separate Herstellerlösung verfügbar.
- Die Firmwaremeldung `BRIDGE_INFO` wird nun auf die eindeutigen Eigenschaften der beiden aktuellen DIY-Firmwares geprüft. Ein unbekanntes Board oder eine reine USB-CDC-Beispielfirmware erhält **keine bestätigte Chip-Zugriffsfreigabe**. Die Web-App erkennt und protokolliert den tatsächlich verwendeten DIY-Programmer statt jeden Bridge-Adapter als ESP32 zu bezeichnen.
- Die überholten breiten Tabellen mit vielen anderen ESP-, Arduino-, RP2040- und sonstigen Mikrocontrollerboards wurden aus [DIY-Boardübersicht](docs/ESP_BOARD_OPTIONS.md) und [USB-Bridge-Anleitung](docs/USB_BRIDGE_GUIDE.md) entfernt.
- Verbindungsauswahl, Firmware-Installer, Einzelanleitungen für ESP32-C3/Pro Micro, README, Bedienungsanleitung, Roadmap und Testbericht auf **v0.7.75** abgeglichen.
- Bestehende One-Wire-, I²C-, RAM-/NVM-Schutzmechanismen und die vorherige adaptive Live-Abfrage bleiben unverändert. Für beide DIY-Adapter bleibt die **Hardware-End-to-End-Validierung** am realen E703.11 offen.

## v0.7.74 – Optionale adaptive Live-Abfrage ab 250 ms

- Die bisherigen Abfragepausen (400, 650, 1000, 1500 und 2000 ms) bleiben unverändert. Neu unter **Einstellungen → Live-Abfrageintervall**: **«250 ms · Adaptiv (schneller)»**. Der neue Modus ist bewusst optional; die gespeicherte persönliche Einstellung bleibt erhalten.
- 250 ms bezeichnet die **Pause nach einer bereits abgeschlossenen** Sensorabfrage. Der tatsächliche Abstand zwischen zwei ADC_S-Werten umfasst zusätzlich die Zeit für One-Wire-/I²C-Befehle, USB und Chipkonversion.
- Die Web-App wartet weiterhin jede vollständige Live-Abfrage ab und sendet keine parallelen ADC-/DSP-Abfragen. Sekundärkanäle bleiben rotierend verteilt. Es erfolgen **keine Änderungen an CFG_PERIOD, DSP- oder NVM-Registern und keine neuen USB-Befehle**.
- Im adaptiven Modus führen zwei nacheinander langsame Lesezyklen (je mindestens 600 ms) zu einer Erhöhung auf 400 bzw. 650 ms. Ein Lesezyklus ab 1200 ms oder ein Lesefehler erzwingt die 650-ms-Stufe; die bisherige 2-Sekunden-Fehlerpause und Sensor-Verlust-Erkennung bleiben bestehen. Nach jeweils zehn normalen Lesezyklen wird die Pause stufenweise zurückgenommen.
- Der technische Live-Status und der SSP3-Diagnoseexport zeigen die aktuell effektive Abfragepause. Die Funktion wurde mit automatisierten Simulationen geprüft, **nicht** am realen SSP3/E703.11 freigegeben.

## v0.7.73 – Bis zu zwei optionale Fotos im Prüfprotokoll

- Nachmessung und Test/Logging unterstützen bis zu **zwei Fotos mit optionaler Bildbeschreibung**, vor, während und nach der Messung sowie in der Archiv-Detailansicht.
- JPG, PNG und WebP werden vollständig lokal im Browser als JPEG neu gespeichert, auf maximal **1400 Pixel** und **300 KB pro Foto** begrenzt; Quellen über 12 MB werden abgelehnt. Durch das Neucodieren fallen ursprüngliche Bildmetadaten weg.
- Fotos liegen eingebettet im jeweiligen **lokalen JSON-Archivprotokoll**, nicht als zusätzliche lose Dateien.
- Die bestehenden PDF-Berichte für Nachmessung und Test/Logging zeigen vorhandene Bilder mit ihrer Beschriftung in einem eigenen, druckoptimierten Abschnitt; ohne Bilder bleibt das Layout unverändert.

## v0.7.72 – Ein lesbarer CSV-Export pro Protokoll

- Je Archiveintrag nur noch **ein CSV-Button**, auch beim Logging-Abschluss und in der Nachmessungs-Zusammenfassung. Die verwirrenden zusätzlichen CSV-Varianten «Rohdaten», «Übersicht», «alle Infos» und «Messwerte» wurden aus der Bedienoberfläche entfernt.
- CSV enthält zuerst eine direkt lesbare Messwerttabelle, darunter wenige Protokoll- und Sensorangaben. Bei Nachmessungen werden redundante Soll-/Referenzspalten, konstante Samples- und Zyklusangaben sowie nicht benötigte Bewertungsfelder automatisch weggelassen.
- Der CSV-Export für Test/Logging, Kalibrierung und Ausgang verwendet ebenfalls kurze, fachlich passende Tabellen statt tausender technischer Rohdatenzeilen. Technische Detailinformationen bleiben im unveränderten JSON/JSONL-Archiv verfügbar.
- Excel-freundlicher UTF-8-Export mit Semikolon und Schutz vor Formelinterpretation.

## v0.7.71 – Übersichtlicher CSV-Export für Nachmessungen

- **«CSV · Übersicht»** ist der neue Standardexport für Nachmessungen: kompakte Protokollangaben und eine klare Tabelle mit genau einer Zeile je aufgenommenem Messversuch. Unaufgenommene geplante Prüfpunkte bleiben als leere Zeilen erkennbar.
- Die Tabelle enthält je nach Prüfart Soll- und Referenzdruck, digitalen Sensordruck, absolute und prozentuale Druckabweichung (% FS), Druck-/Temperaturrichtung, Prüf- und Sensortemperatur, Aufnahmezeitpunkt, Versuch, Anzahl Rohsamples und nur bei aktiver Toleranzbewertung einen Ergebnisstatus.
- Es werden **keine** TX/RX-Meldungen, einzelnen ADC-/DSP-Rohsamples, NVM-Register oder verschachtelten JSON-Feldpfade in der Übersicht angezeigt. Für eine vollständige technische Nachprüfung bleiben **«CSV · Rohdaten»** und JSON verfügbar.
- Beide CSV-Varianten können in der Archivliste und Detailansicht exportiert werden. Die kompakte CSV ist auch direkt in der Abschlussübersicht einer Nachmessung verfügbar. Sie nutzt UTF-8, Semikolon als Trennzeichen und erhält negative Messwerte als Excel-kompatible Zahlen.
- Bei nicht aktivierter Toleranz erfolgt keine Bestanden-/Fehlerbewertung. Die rein rechnerische Druckabweichung wird trotzdem angezeigt, wenn Referenzdruck und physikalisch dargestellter Sensorwert vorhanden sind.

## v0.7.70 – PDF-Export für Test/Logging und vollständiger CSV-Export im Archiv

- Nach Abschluss von Test/Logging kann ein druckfertiger PDF-Bericht erzeugt werden. Er enthält Testbezeichnung, Chip-/Geräteangaben, Aufnahmeeinstellungen, Statistik, ADC_S-/DSP_S-Verlauf, alle Messpunktgruppen sowie sämtliche Ereignisse und Marker. Die Darstellung verwendet den Browserdruckdialog «Als PDF speichern». Bei mehr als 400 Gruppen wird lediglich der Kurvenverlauf für die Grafik reduziert; die Tabelle enthält weiterhin alle Gruppen.
- In **jeder Archivkarte** und Detailansicht gibt es **«CSV · alle Infos»**, unabhängig vom Protokolltyp. Der universelle CSV-Export umfasst alle ursprünglichen JSON-Felder und verschachtelten Werte, einschliesslich RAM/NVM, Einstellungen, Referenzen, Zeitstempel, Fehler, Ereignisse und bei Logging zusätzlich alle JSONL-Messpunktgruppen, Einzel-Rohsamples und gegebenenfalls TX/RX-Logs. UTF-8 mit BOM und Excel-Formelschutz.
- Der frühere tabellarische Logger-CSV bleibt separat als **«CSV · Messwerte»** verfügbar.
- Im Logger-Abschlussbereich werden JSON, beide CSV-Varianten und PDF direkt angeboten. Die Berichte werden lokal erzeugt; der CSV-Download verändert weder die JSON-Dateien noch den Archivordner.

## Öffentliches Feedback

- Unter «Einstellungen → Feedback melden» lassen sich Fehler und Funktionswünsche mit optionalen Screenshots melden. Das Formular gibt den Link zum öffentlichen GitHub-Issue zurück.

## v0.7.69 – Reduzierte Hinweise bei der Nachmessung

- Den langen, wiederholten Warntext zur provisorischen Sensor-Skalierung aus der Detailansicht entfernt; gespeicherte Messwerte und Bewertungen unverändert belassen.

## v0.7.68 – Einheitliche Abweichungsbezeichnung

- In Webansicht, Archivübersicht und PDF ist die Messgrösse einheitlich als «Abweichung» beschriftet, unabhängig davon, ob eine Toleranzprüfung aktiviert oder die Skalierung bereits bestätigt ist.
- Hinweise zur Skalierungsunsicherheit werden getrennt vom Zahlenwert angezeigt; dadurch entfällt die verwirrende Mischung aus «Geprüft», «Vorläufig» und «Ungeprüft» als Zahlenpräfix.

## v0.7.67 – Bewertung optional und klarer Protokollname

- Toleranzbewertung der Nachmessung ist **standardmässig deaktiviert**; ohne ausdrückliche Aktivierung werden Messwerte und Abweichungen erfasst, aber nicht als bestanden oder ausser Toleranz klassiert.
- Die vier Bestanden-/Fehler-/Offen-Statuszähler in der Nachmessung, Grafik und im PDF wurden durch eine einfache Anzahl aufgenommener Messpunkte ersetzt. Toleranzbalken werden nur bei aktivierter Bewertung angezeigt.
- Schnittstelle wird im Archiv und PDF passend als **One-Wire (AODO)** oder **I²C** benannt. Interne SSP3-Protokollkennungen bleiben unverändert.
- Die frühere optionale VDD-Istspannungs-Eingabe in der Anschlussansicht wurde entfernt. Die manuelle VDD-Dokumentation innerhalb des separaten Testloggers blieb bestehen.

## v0.7.66 – Aufgenommene, aber unbewertete Punkte im Diagramm

- Bereits aufgezeichnete digitale Sensorwerte werden im Druckabweichungsdiagramm auch dann sichtbar, wenn eine bestätigte Toleranzbewertung noch nicht möglich ist. Solche Punkte dürfen nicht als «Bestanden» erscheinen.
- Tests für Messpunkte mit unbekannter Skalierung, vorliegender physikalischer Einheit, vorhandenen Altarchiven und fehlenden Messpunkten hinzugefügt.

## v0.7.65 – Nachmessung vereinfacht

- Eingabefelder für den DSP-Endwert, die freie Beschreibung des ursprünglichen Abgleichs und doppelte Prüfmittelangaben aus der Nachmessung entfernt.
- Optionale Protokollinformationen bleiben dauerhaft aufgeklappt. Referenzdruck zeigt die gewählte physikalische Einheit direkt am Eingabefeld.
- Die Nachmessung orientiert sich am **digital angezeigten Sensorwert** und benötigt keinen separat zu erratenden DSP-Endwert. Diagramm, Archiv und PDF zeigen diesen Wert.
- Überflüssige PDF-Felder wie «Adapter-Firmware: Antwort erhalten» entfernt. Ältere Protokolle mit DSP-Samples bleiben lesbar.

## v0.7.64 – Physikalischer Prüfdruck oder Prozent der Messspanne

- Kalibrierte Druckunter- und -obergrenze mit Einheit (bar, mbar, kPa, MPa, psi) einstellbar.
- Nachmessungspunkte entweder direkt in Druckeinheiten oder in Prozent der gesamten Messspanne vorgeben; Umrechnung konsistent im Prüfplan, Archiv, Diagramm, Hysterese und PDF dokumentiert.
- Die prozentuale Abweichung wird auf die **gesamte kalibrierte Druckspanne** bezogen, nicht auf einen möglicherweise kleineren Prüfplanbereich.

## v0.7.63 – PDF-Prüfprotokoll, optionale Dokumentation und automatische Werkzeugerkennung

- Nach dem Speichern einer Nachmessung steht «Prüfprotokoll als PDF speichern» in der Abschlussübersicht zur Verfügung. Dieselbe Funktion ist auch für ältere Nachmessungen in der Archiv-Detailansicht verfügbar.
- Der PDF-Bericht wird vollständig lokal als druckoptimierte Vorschau erzeugt (im Browser «Drucken» → «Als PDF speichern»), ohne externe Bibliothek, Cloud-Upload oder Sensorzugriff. Er enthält Chip-UID, Prüfstatus, Zeitangaben, Prüfeinstellungen, Soll-/Ist-Werte, Abweichungen, Diagramme und alle Prüfpunkte.
- Optionale Angaben: Prüfer, Auftrag/Projekt, Prüfstand, externe Messmittel, Zertifikatsreferenz und zusätzliche Bemerkungen. Diese Felder sind nicht für den Start einer Prüfung erforderlich und werden im lokalen JSON-Archiv gespeichert.
- Das eingesetzte Kalibrierwerkzeug (ELMOS E703.11 Calibration Assistant mit Version) und der verbundene Kommunikations-/Programmieradapter (ELMOS SSP3 oder ESP32-USB-Bridge), Schnittstelle und verfügbare Firmware-Informationen werden bei Prüfstart automatisch aus den Verbindungsmetadaten übernommen.
- Externe Druckkalibratoren und Temperaturreferenzen werden nicht automatisch erkannt, solange keine unterstützte digitale Schnittstelle existiert; sie können optional dokumentiert werden.
- Archiv-Detailansicht und Abschlussübersicht zeigen die gespeicherten Informationen und einen PDF-Export.
- Versionsanzeige, App-Metadaten und Cacheversionen auf v0.7.63 gesetzt.

## v0.7.62 – Messwert direkt am Prüfpunkt und geführter Prüfabschluss

- Nach jeder Nachmessung wird der zuletzt gespeicherte Sensorwert direkt neben der Messaktion angezeigt, inklusive Einheit, DSP_S-Rohwert, Bewertung und Aufnahmezeit.
- Am letzten Prüfpunkt heisst die Navigation «Prüfung abschliessen und speichern». Unaufgenommene letzte Punkte können nur nach ausdrücklicher Bestätigung übersprungen werden.
- Nach erfolgreichem Speichern erscheint eine schreibgeschützte Abschlussübersicht mit Diagramm, allen Prüfpunkten, Soll-/Ist-Werten, Abweichungen und Bewertungen.
- «Zur Hauptseite» beendet die Ansicht erst nach dem gespeicherten Ergebnis; fehlgeschlagene und nicht bewertete Messungen werden korrekt als solche ausgewiesen.
- Fehlende oder nicht bewertete Messungen führen zu «Unvollständig», tatsächlich fehlgeschlagene Prüfpunkte zu «Fehlerhaft». Keine automatische Freigabe durch den Abschluss.
- Versionsanzeige, Cache-Kennungen der geänderten Dateien und App-Versionsmetadaten auf v0.7.62 aktualisiert.

## v0.7.61 – Messdiagramm in archivierten Nachmessungen

- Archivierte Nachmessungen zeigen neu direkt im Detailbereich das Ergebnisdiagramm mit Prüfpunkten, Abweichungen, Toleranzgrenzen und Bewertungsstatus sowie den DSP_S-Rohwertverlauf.
- Einzelne Prüfpunkte lassen sich im Archivdiagramm anklicken, um das aufgezeichnete Resultat zu prüfen, ohne Mess- oder NVM-Funktionen auszuführen.
- Ältere Protokolle ohne vollständigen Prüfplan zeigen vorhandene DSP_S-Rohwerte ohne erfundene Sollwerte oder automatische Freigabe.
- Versionsanzeige, JavaScript-/CSS-Cacheversion und die in neue Archivdateien geschriebene App-Version sind auf v0.7.61 synchronisiert.

## v0.7.57 – DSP-Prüfung an den Kalibriergrenzen

- Beide Endpunkte des Kalibrierbereichs sind als DSP-Prüfpunkte zulässig, beispielsweise 0 und 6 bar bei einem Bereich von 0 bis 6 bar.

## v0.7.38 – Messverlauf im Testprotokoll

## v0.7.45

- ESP32-C3 SuperMini USB-Bridge v0.10 ergänzt CRC-geschütztes I²C für Registerzugriff, Live-Messung und RAM-Kalibrierung. Die Schnittstelle lässt sich direkt bei der USB-Verbindung wählen.
- Bei einem Sensor mit deaktiviertem I²C kann die Bridge den Bus für die aktuelle Sitzung über AODO im RAM aktivieren. Für das dauerhafte Speichern im NVM ist weiterhin der One-Wire-Kaltstartnachweis erforderlich.


- Test / Logging zeigt den Verlauf von ADC_S und DSP_S für bis zu 20 gespeicherte Messpunkte.
- Pro Micro v0.27 ergänzt CRC-geschütztes I²C für die Varianten mit 8 und 16 MHz. Unter Einstellungen führt «USB-Bridge aktualisieren» zum ESP32-Browser-Flasher, den Pro-Micro-Downloads und den Pinbelegungen beider Boards.

## v0.7.37 – Manuelle Messpunkte und USB-Bridges

- Test / Logging kann Messpunkte auf Knopfdruck aufnehmen. Einzelmessungen und Mittelwertbildung gelten auch im manuellen Modus.
- ESP32-C3 und Pro Micro unterstützen den Kaltstartnachweis für die NVM-Prüfung. Die ESP32-Firmware startet nach der One-Wire-Freigabe die kontinuierliche Messung.
- Bridge-Optionen und Baudraten stehen im Expertenmodus. Beim Boardwechsel trennt die App den USB-Port automatisch.

## v0.7.29 – Pro Micro als PLC-Testbridge

- Unterstützt ATmega32U4 als experimentelle Bridge zur Sensorerkennung und Live-Messung.

## v0.7.28 – Quelle der Preset-Werte anzeigen

- Erklärt beim Erstellen einer Vorlage, welche Werte vom Sensor und welche aus den aktuellen Vorgaben der App stammen.

## v0.7.27 – Preset direkt beim Titel laden

- Öffnet die Preset-Auswahl in Schritt 2 über einen Button neben dem Titel.

## v0.7.26 – Aufgabenübersicht und Prozentanzeige

- Zeigt den Live-Ausgang zum Abschluss in Prozent und bietet einen direkten Rückweg zur Aufgabenübersicht. Beim Abbrechen des Sensorwechsels bleibt der USB-Port offen.

## v0.7.25 – Serie im Assistenten beenden

- Hält den USB-Port beim Sensorwechsel offen. «Serie abbrechen» führt zurück zur Aufgabenübersicht.

## v0.7.24 – Messhub und Sensorwechsel

- Zeigt den ADC-Hub zwischen P1 und P2, verwendet die vorhandene NVM-Rücklesung und fragt beim erneuten Abgleich desselben Sensors nach.

## v0.7.23 – Geführter Sensorwechsel

- Führt durch den Sensorwechsel und übernimmt Messplan, Ausgangsvorgaben und Frontend aus dem letzten Abgleich. «Serie abbrechen» beendet die Übernahme.

## v0.7.22 – Nächsten Sensor abgleichen

- Startet den Sensorwechsel am Ende des geführten Abgleichs. Nach dem Verbinden beginnt der nächste Abgleich mit der Abfrage der zuletzt übernommenen Vorlage.

## v0.7.21 – Preset beim Start des Sensorabgleichs

- Fragt beim Start des geführten Abgleichs nach der zuletzt übernommenen Vorlage. Die Abfrage erscheint einmal pro Sensorverbindung, auch nach erneutem Anschliessen desselben Sensors.

## v0.7.20 – Elmos-Vorlagen importieren

- Liest AFE und SVDD aus CRC-geprüften Elmos-PSSC-XML- und HEX-Dateien als wiederverwendbare Vorlage.

## v0.7.19 – Vorlage für den nächsten Sensor

- Zeigt Einstellungsgruppen und Namen erst beim Bearbeiten. Bietet die zuletzt übernommene Vorlage beim Anschliessen eines anderen Sensors erneut an.

## v0.7.18 – Einstellungsgruppen im Preset auswählen

- Presets speichern nur die gewählten Gruppen. Beim Laden zeigt die App nur enthaltene Gruppen.

## v0.7.17 – Sensor-Presets im Messplan

- Lädt Presets direkt in «Abgleich planen» und speichert die genaue Druck-/Temperaturmatrix samt Temperatur-Sollwerten.

## v0.7.16 – Presets für baugleiche Sensoren

- Speichert benannte Config-Vorlagen lokal im Browser und lädt sie über eine Auswahlliste. Ausgangsprofile enthalten optional die Clipping-Grenzen.

## v0.7.15 – Clipping für den Analogausgang

- Schritt 8 bietet optionale obere und untere Spannungsgrenzen für den ratiometrischen AODO-Ausgang. Die Änderung wird zur NVM-Prüfung vorgemerkt.

## v0.7.14 – Messpunkte nach Ansichtswechsel

- Baut die Messpunktliste beim erneuten Öffnen der geführten Ansicht auch bei unveränderter Messmatrix wieder auf.

## v0.7.13 – VDD-Eingabe beim Abgleich

- Die optionale gemessene Versorgungsspannung wird beim Abgleich erfasst. Der Archiv-Viewer zeigt gespeicherte Werte an.

## v0.7.12 – NVM-Vorschau mit vorhandenem Abbild

- Verwendet ein bereits geprüftes NVM-Abbild aus derselben Verbindung und vom selben Chip. Die Chip-UID wird vor dem Schreiben automatisch geprüft.

## v0.7.11 – Fortschritt und kompakte Messpunkte

- Blockierende Vorgänge zeigen ihren Fortschritt mittig. Kurze Lesevorgänge behalten die Anzeige unten rechts.
- Aufgenommene Messpunkte blenden die Eingabezeile aus und zeigen das Ergebnis.

## v0.7.10 – Fortschritt bei Chipvorgängen

- Zeigt aktive Lesevorgänge, Messungen, Importe und Schreibvorgänge an. Bei NVM und Messpunktaufnahme werden die bearbeiteten Wörter oder Samples gezählt.
- Blendet die Aufnahmebuttons bestätigter Kalibrierpunkte aus.

## v0.7.9 – Messpunkte ohne doppelte Ergebnisübersicht

- Die überladene grüne Übersicht «Bereits aufgenommen» aus Schritt 5 entfernt.
- Nur eine kleine Bestätigung «✓ Messpunkt X aufgenommen» beim Wechsel.
- Nächster Referenzpunkt bleibt klar hervorgehoben; links weiterhin Haken und Status je Punkt.
- Nach dem letzten Punkt nur noch eine eindeutige Abschlussanzeige.
- Keine Änderungen an Messungen, gespeicherten Rohwerten, Archivdaten oder Hardwarekommunikation.

## v0.7.8 – Referenzmesspunkte eindeutig als aufgenommen kennzeichnen

- Erfolgreich gemessene Punkte bleiben sichtbar in einer grünen Übersicht statt optisch zu verschwinden.
- Erfolgsbestätigung erst nach tatsächlicher Übernahme durch den bestehenden Mess- und Speicherpfad.
- Klare nächste Aktion: «Als Nächstes: Messpunkt X messen» mit Referenzdruck und Temperatur.
- Messpunktnavigation unterscheidet sichtbar zwischen «Aufgenommen», «Jetzt messen» und «Noch offen».
- Verfügbare ADC_S-, ADC_T- und Sample-Anzahlen als reine Anzeigewerte aus den vorhandenen Messdatensätzen.
- Ohne unnötige DOM-Neuerstellung bei unveränderten Live-Updates; auch im Darkmode gut erkennbar.
- Keine Änderungen am Sensor-, Mess-, RAM- oder NVM-Schreibpfad.

## v0.7.7 – Mehr Kontrast und Darkmode

- Neuer Farbmodus in den Einstellungen: «Hell · hoher Kontrast» und «Dunkel · Darkmode».
- Browserlokale Einstellung, synchron vor dem ersten Rendern aktiv, auch nach Neuladen.
- Einheitliche Darkmode-Farbpalette für geführten Assistenten, klassische Ansicht, One-Pager, Kalibrierkarten, EEPROM-Tabellen, Archiv, Nachmessung und Test-Logging.
- Erhöhter Kontrast für wichtige Texte, Nebeninformationen, Input-Rahmen und Navigationskarten im hellen Modus.
- Warnungen, Fehler und erfolgreiche Prüfungen auch im dunklen Modus farblich eindeutig und lesbar.
- ADC-Livegrafik wechselt Linien-, Achsen- und Hintergrundfarben passend zum Modus.
- Mess-, Kommunikations- und NVM-Sicherheitslogik unverändert.

## v0.7.6 – Archiv und Nachmessung im geführten Einstieg / Links in neuem Tab

- Sechs Aufgabenkacheln im geführten Einstieg, darunter «Archiv» und «Nachmessung».
- Beide Kacheln öffnen ihre Ansicht mit einem Klick; Archivsuche auch ohne angeschlossenen Sensor, sofern der Assistent bereits geöffnet ist.
- Der optionale Button «Nachmessung» in der oberen Leiste bleibt standardmässig ausgeblendet; der geführte Einstieg bietet die Funktion immer an.
- Anleitungen, USB-Diagnose und weitere verlinkte Hilfeseiten öffnen in einem neuen Browser-Tab und lassen die laufende Web-App geöffnet.
- Responsive Kachelaufteilung für Desktop, Tablet und Smartphone; ZIP-Download unverändert.

## v0.7.5 – Offline-Anleitung in Einstellungen, Nachmessung optional

- Den breiten Offline-Hinweis aus der Hauptansicht entfernt; der Einsteiger-Link steht in «Einstellungen → Web-App offline verwenden».
- Neue Option «Nachmessung einblenden» in den App-Einstellungen, standardmässig ausgeschaltet.
- Der Navigationsbutton erscheint nur bei aktiver Option; die Auswahl wird lokal im Browser gespeichert.
- Die Option lässt sich während einer aktiven Nachmessung nicht abschalten, um einen laufenden Prüfablauf nicht versehentlich zu verbergen.
- Nachmessungsprotokolle bleiben im Archiv jederzeit sichtbar und durchsuchbar, unabhängig von der Einstellung.

## v0.7.4 – DUT, kompakter Logviewer und Adapter-Firmware richtig benannt

- Im Test-Logging separate, optionale Produkt-/DUT-Bezeichnung; im JSON, Archiv, Suche, Vergleich und CSV-Export enthalten.
- Kompaktere Archivwerkzeuge, Kennzahlen und Geräteinfos. Optionale VDD-Istspannung aufklappbar.
- Die bisher als «Firmware» bezeichnete Version `02.08.02.04` wird korrekt als SSP3-Adapter-Firmware ausgewiesen; Chip-Versionsregister `0x38` separat und nur bei auslesbarem Wert.
- Frühere Archivdateien bleiben kompatibel.

## v0.7.3 – Aufgabenkacheln direkt öffnen und Archiv-Logviewer neu gestalten

- Ein Klick auf die Aufgabenkachel im geführten Einstieg führt direkt in den gewählten Ablauf, weiterhin mit Sensor- und Archivprüfung.
- Archiv als modernes Dashboard: Gesamtkennzahlen, Messdateien mit Schnellstatus, Suche, Filter, UID, Board und Softwareversion.
- Schnelle Detailansicht mit Mittelwert, Min/Max, Standardabweichung und DSP_S-Signalverlauf für vorhandene Test-Rohsamples.
- Gegenüberstellung zweier Protokolle mit Rohwertdifferenzen, Fehlern, UID-Hinweis und NVM-Wortvergleich.
- Fehlerhafte und ausserhalb der Toleranz liegende Messungen sind ausdrücklich erkennbar.
- Bestehende JSON-/JSONL-Protokolle bleiben lesbar. Sensorregister und NVM-Schreibschutz bleiben unverändert.

## v0.7.2 – Separates Archiv/Nachmessung, klassisches Test-Logging und Zeitlimit

- Oben separate Bereiche **«Archiv»** (Suche, Protokolle und Vergleiche) und **«Nachmessung»** (Prüfpläne, Druck-/Temperaturrampen, Hysterese).
- **«Test / Logging»** als eigener Reiter in der klassischen Navigation direkt unter dem EEPROM Viewer; weiterhin auch im geführten Einstieg verfügbar.
- Nur eine Logger-Instanz: Beim Wechsel bleiben Eingaben bestehen, laufende Aufzeichnungen werden nicht verdeckt.
- **Testdauer frei wählbar** in Sekunden, Minuten und Stunden; 0 = unbegrenzt. Automatisches Stoppen und Archivieren mit Live-Restzeitanzeige.
- Pause unterbricht die aktive Testdauer, bis die Aufzeichnung fortgesetzt wird.
- Weiterhin alle Einzelmessungen und optionalen Mittelwerte, Testbeschreibung, Telemetrie, Marker und Fehler im lokalen Archiv.

## v0.7.1 – Test / Logging im geführten Einstieg

- Vierte Kachel **Test / Logging** mit Name, Beschreibung, Kategorie, Operator und optionaler VDD-Messung.
- Frei definierbares Messintervall (1–3’600’000 ms), Anzahl Einzelmessungen (1–100), Einzelmessabstand (0–60’000 ms) und Mittelwert/Median/keine Mittelung.
- Jeder Rohsample mit Zeitstempel, ADC_S, ADC_T, ADC_TC, DSP_S, DSP_T und Status; Fehler und tatsächliche Messdauer protokolliert.
- Live-Aufzeichnung mit Pause/Fortsetzen, Einzelaufnahme, Marker, Notizen und optionalen Referenzen.
- Lokale Rohdaten in fortlaufenden JSONL-Teilen, Archivsuche und vollständiger JSON-/CSV-Export.
- Test-Logging benutzt ausschliesslich den reservierten Leseweg und verändert die NVM-Schutzlogik nicht; reale Hardwarevalidierung weiterhin offen.

## v0.7.0 – Lokales Kalibrierarchiv und Nachmessung

- Pro Kalibrierung initiale und finale RAM-/NVM-Konfiguration, UID, Web-App-Version, Adapter, Einzelmessungen, Verstärkungen, Koeffizienten, Fehler und Wiederholungen in lokalem JSON.
- Frei definierbare Druck- und Temperaturprüframpen mit Hystereseauswertung, Filter und Vergleich im Archiv.

## v0.6.58 – Eigene USER-ID

- Im NVM-Schritt kann optional ein 16-Bit-Hexwert für das USER-Wort vorgemerkt und mit der Kalibrierung gespeichert werden. Die Änderungsliste zeigt den alten und neuen Wert.

## v0.6.57 – Hubwarnung und einzelne Prüfpunkte

- Der AFE-Schritt warnt sichtbar bei einem beobachteten Hub unter 4’000 Digits.
- Für jeden DSP-Prüfpunkt gibt es einen eigenen Referenzdruck, eine Prüftemperatur und eine Bestätigung.

## v0.6.56 – Automatischer Wiederanlauf für SSP3

- Nach einem erfolgreichen manuellen RAM-Messstart merkt sich Chrome den Sensor anhand seiner Chip-ID. Beim erneuten Verbinden oder nach einem erkannten Sensorneustart prüft die App das RAM-Profil und startet die Messung erneut.

## v0.6.55 – SSP3-Wiederverbindung

- Merkt sich die zuletzt bestätigte SSP3-Baudrate im Browser. Verwirft der Adapter den ersten Versionsbefehl als unbekannten Befehl, wird er einmal wiederholt.

## v0.6.54 – Live-Messung bei deaktiviertem Analog-Frontend

- Bei erkanntem SSP3-Sensor mit passendem inaktivem RAM-Profil kann die Live-Messung über das Elmos-Standardprofil gestartet werden. Die App prüft die Chipkennung, liest die RAM-Änderungen zurück und wartet auf eine neue ADC-Messung.

## v0.6.53 – SSP3-Diagnose bei leerem AFE-Register

- Bei CFG_AFE1 = 0x0000 bestätigt die App One Wire anhand der PLC-Adresse und der Chipkennung. Die Registerdiagnose bleibt verfügbar, während der Kalibrierablauf auf eine gültige AFE-Konfiguration wartet.

## v0.6.52 – SSP3-Startprofile bei ungültigem AFE-Wert weiterprüfen

- Wenn ein Startprofil antwortet, aber weder RAM noch das geprüfte EEPROM einen gültigen AFE-Wert liefern, prüft der SSP3 das nächste Startprofil.

## v0.6.51 – SSP3-Kaltstart nach Elmos-Protokoll

- Der SSP3 versucht die im Elmos-Mitschnitt verwendeten Startverzögerungen und prüft die Sensorantwort nach der flüchtigen One-Wire-Freigabe.

## v0.6.50 – SSP3-Wiederanlauf bei leerem AFE-RAM

- Nach PSSC-RAM-Freigabe kann die App ein leeres CFG_AFE1 aus dem EEPROM desselben Chips wiederherstellen. Sie prüft UID, CRC8, CRC16 und die RAM-Rücklesung. NVM-Schreiben bleibt in dieser Sitzung gesperrt.

## v0.6.49 – Brückenspannung mit der Kalibrierung speichern

- Beim SSP3-Abgleich übernimmt der NVM-Plan die rückgelesene SVDD-Einstellung. Die Änderungsliste zeigt beide Spannungen. Nach dem Neustart wird die Einstellung erneut aus dem Sensor-RAM gelesen.

## v0.6.48 – AODO senden und empfangen über GPIO4

- ESP32-Firmware v0.6 kann für AODO alternativ GPIO4 als gemeinsamen Sende- und Empfangspin nutzen. GPIO4 wird nach jedem Senden hochohmig. Für die bestehende externe Treiberstufe bleibt der Modus mit GPIO6 als RX der Standard.

## v0.6.47 – ESP32-Empfangsdiagnose

- Firmware v0.5.1 synchronisiert sich auf die tatsächliche Sensorantwort und prüft den CRC. Bei fehlender Chipantwort zeigt die Web-App, ob GPIO6 das eigene Sendesignal und anschliessende Flanken erkannt hat.

## v0.6.46 – ESP32-Start für E703.11 mit abweichender One-Wire-Konfiguration

- ESP32-C3-Firmware v0.5 prüft die PLC-Adressen 0x6C und 0x7C. Erst gültige CRCs und übereinstimmende Sensorregister bestätigen die Verbindung.
- Bei ausbleibender Antwort kann die Web-App die aus PSSC bekannte, temporäre One-Wire-Freigabe auslösen. Nach diesem Versuch sind NVM-Programmierbefehle in der Bridge gesperrt; RAM-Kalibrierung und NVM-Lesen bleiben verfügbar.
- Brückenspannung wird wie PGA1, Offset und PGA2 direkt ins Sensor-RAM übernommen und rückgelesen.

## v0.6.43 – Brückenspannung und Kalibrierdaten nach SSP3-RAM-Start

- Brückenspannung mit vollständiger Auswahlliste und kompakten Aktionen im AFE-Schritt.
- Nach bestätigtem SSP3-Neustart derselben Chip-UID können geprüfte Kalibrierdaten ins NVM geschrieben werden. Ausgang und One-Wire-Start bleiben im Originalzustand. Das vollständige NVM wird unmittelbar vor dem Schreiben nochmals verglichen.

## v0.6.42 – SSP3-Start wie im Elmos-GUI

- Bei der erkannten SSP3-Einzelsockel-Erweiterung für den E703.11 kann die Web-App bei fehlender One-Wire-Antwort den Startablauf von PSSC 3.2.1 verwenden. Die Freigabe setzt die temporäre One-Wire-Adresse 0x6C im Sensor-RAM. Der Zugriff gilt erst nach gültigen Registerantworten als bestätigt.
- EEPROM-Schreiben ist nach dieser RAM-Freigabe gesperrt. Die USB-Baudrate kann direkt im Verbindungsdialog gewählt werden. PSSC kann den SSP3 auf 921600 Baud hinterlassen.
- Der Ablauf wurde am SSP3 über COM4 mit gültigen CFG-, AFE- und ADC-Antworten geprüft.

## v0.6.41 – 12.11.2026: Diagnose nach weiterhin fehlgeschlagener Verbindung vereinfachen

- Bei fehlender Sensorverbindung steht **«Diagnose exportieren» direkt im oberen Warnbanner** neben «Sensor neu initialisieren» zur Verfügung – auch ohne Expertenmodus.
- Fehlermeldung weist darauf hin, dass die beiden PLC-Adressen getestet wurden und die Chipantwort weiterhin unbestätigt ist.
- Der Export trägt die Versionsnummer v0.6.41 und enthält die gesendeten Befehle, Rohantworten sowie alle Adressversuche.
- **Hardwareverbindung ist noch nicht als gelöst bestätigt.** Die originale XML enthält Chip-ID `0x200109F7DB`, die ältere Web-Log-Erkennung nennt eine andere Chip-ID `0020011DBBE7`; die im XML gespeicherte Adresse kann deshalb nicht ohne Chip-Rücklesung als aktiv vorausgesetzt werden.
- Software-Regressionen für CRC und PLC-Adresssuche erfolgreich; weiterer Hardware-Log erforderlich. Keine weiteren NVM-Schreibvorgänge eingeführt.

## v0.6.40 – 12.11.2026: 1-Wire-Adresse aus PSSC-Konfiguration erkennen

- Erkennt beim SSP3/1-Wire-Verbinden und beim erneuten Initialisieren zunächst **rein lesend** die beiden bekannten PLC-Adressen **0x6C** (Elmos-Standard) und **0x7C** (aus dem eingereichten PSSC-XML: CFG_SPI_I2C=0x7C05, CFG_PADS1=0x099F). Kein unnötiger Power-Cycle, wenn der Chip bereits antwortet.
- Bestätigt eine Adresse erst bei korrekter **PLC-CRC8**, plausibler **AFE1-/ADC_S-Antwort** und Übereinstimmung mit der aus **CFG_SPI_I2C/CFG_PADS1** berechneten Chipadresse. Bei Konflikt: keine Schreibfreigabe.
- Alle PLC-Lese-, RAM-/Magic-Cookie-Schreibbefehle und die CRC-Prüfung benutzen in dieser Sitzung die bestätigte Adresse. Die automatische SSP3-Startprozedur prüft beide Kandidaten und nutzt bei fehlender Chipantwort pro Adresse höchstens eine dokumentierte Magic-Cookie-Sequenz (zwei aufeinanderfolgende RAM-Frames); insgesamt weiterhin höchstens zwei geregelte Versorgungszyklen.
- Zeigt im Expertenmodus die tatsächlich aus Sensorregistern bestätigte Adresse. Der JSON-Export enthält `plcAddress`, `plcAddressVerified`, `plcAddressSource` und `plcAddressProbes` mit den getesteten Adressen und deren Ergebnissen.
- Eine originale PSSC-XML ist **kein Nachweis für die aktuell aktive Chipkonfiguration**; ausserdem waren im früheren Log und in dieser XML unterschiedliche Chip-IDs vorhanden. Der Verbindungstest entscheidet deshalb anhand aktueller Registerantworten und übernimmt keine XML-Kalibrierwerte oder EEPROM-Inhalte.
- Kein automatisches EEPROM-/NVM-Schreiben. Browser-Logik und CRC-Vektoren geprüft; ein echter SSP3-Hardwaretest bleibt notwendig.

## v0.6.39 – 12.11.2026: SSP3-USB-Verlust von Sensorfehler unterscheiden und alte Log-Versuche zurücksetzen

- Bei neuem USB-Port-Öffnen veraltete `startupTrials`, `chipDiag` und `lastPlcReply` zurücksetzen. Export enthält Sitzungs-ID/-Zeit und Reader-/Adapterstatus.
- Fehlende SSP3-Antwort auf `.VERSION` wird als Adapter-/USB-Kommunikationsproblem gemeldet, nicht als Beweis für fehlenden Sensor.
- Knopf **«SSP3-Port neu öffnen»** bei Adapter-Timeout: schliesst denselben freigegebenen WebSerial-Port und öffnet ihn auf ausdrücklichen Klick wieder – ohne F5.
- Wenn WebSerial-Leser unerwartet endet, meldet die App den USB-Lesekanal als unterbrochen und stoppt unzuverlässige Messwerte.
- Keine Änderung an den Sensorregistern, der NVM-Programmierung oder den vorhandenen SSP3-Startvarianten v0.6.38.
- Eingereichte PSSC-XML enthält chipgebundene Kalibrierdaten einer anderen Chip-ID als der frühere Web-Log; Ursache und tatsächliche NVM-Übernahme bleiben zu prüfen.

## v0.6.38 – 12.11.2026: PSSC-basierte PLC_CFG-Initialisierung ergänzen

- Original `ssp3_lib.dll` und Elmos AN0204 abgeglichen: Auf der bekannten SSP3-Firmware 02.08.02.04 zuerst `PLC_CFG 1 0007` (100 kHz), danach bei Bedarf `PLC_CFG 1 000E` (50 kHz).
- Erster Versuch nutzt einen gemeinsamen USB-Write für PWR_ON/PLC T; zweiter Versuch die bisherige Methode mit zwei USB-Writes. Maximal zwei Power-Cycles pro Verbinden/Neuinitialisieren.
- `PLC_CFG`-Fehler werden separat protokolliert. Für unbekannte Firmware wird keine ungeprüfte Geschwindigkeit gesetzt. Kein 7/6-kHz-Autoversuch bei möglichem 4-ms-Startfenster.
- Alle Versuche inkl. Host-Takt, Leseprüfung, Cookie und gegebenenfalls fehlender PLC_CFG-Quittung im JSON unter `startupTrials`.
- Weder direkte historische Cookie-Frames aus der PSSC-Bibliothek noch NVM-Änderungen werden ohne dokumentierte Freigabe verwendet. Reale Hardwareprüfung offen.

## v0.6.37 – 12.11.2026: SSP3-Start in einem USB-Paket + begrenzter Retry

- `PWR_ON 0C80 00C8 0` und `PLC T` werden im ersten Versuch gemeinsam in einem CR-terminierten USB-Paket versendet, statt durch zwei separate USB-Write-Aufrufe.
- Bei fehlender gültiger Chipantwort und bestätigter SSP3-Einschaltquittung wird nur einmal mit der bisherigen Zweipaket-Variante neu gestartet, ohne ungesicherte PLC_CFG-Parameter oder NVM-Operationen.
- Beide Startversuche mit Startmodus, SSP3-Antworten, Magic Cookie und Lese-Diagnose werden im Exportfeld `startupTrials` dokumentiert.
- Die SSP3-Diagnose zeigt eine kompakte Vorabprüfung von FTDI-Latenz (1 ms), USB-Transfergrössen (512) sowie korrekter Unterscheidung zwischen VDD, SVDD und dem PWR_ON-Schwellwert.
- Hardwaretest des neuen Einpaketmodus steht aus.

## v0.6.36 – 12.11.2026: Brückenspannung SVDD im AFE auswählbar

- CFG_AFE0 (0x1A), Bits 1:0, im normalen AFE-Bereich als 2,4 V / 1,6 V / 2,0 V verfügbar. Code 3 ist gesperrt, aktueller Wert wird erst vom Chip gelesen.
- **Bewusste RAM-Übernahme** mit Soll-/Ist-Rücklesung; alle anderen CFG_AFE0-Bits, insbesondere `br_gain`, bleiben unverändert. Keine EEPROM-Programmierung.
- Bestehende Kalibrierpunkte werden nach einer tatsächlichen Änderung ungültig. Schrittansicht und Kompaktmodus nutzen die gemeinsame AFE-Komponente.
- CFG_AFE0 mit Datenblatt-default `0x0C40` in der Demo hinterlegt; neue Config-v2-Dateien können optional `afe.bridgeSupply` enthalten, alte Dateien bleiben kompatibel.
- Separater Hinweis auf Mindest-VDD: 3,0 V für 2,4-V-SVDD; 2,7 V für 1,6/2,0 V. Die SSP3-Startsequenz wurde nicht geändert; der Jürg-Kommunikationsfehler ist weiterhin nicht als behoben bestätigt.

## v0.6.35 – 12.11.2026: CRC8 unabhängig verifizieren und mehrere Register nach Fehlstart lesen

- Jürgs zweites Protokoll belegt: beide Magic-Cookie-Frames werden vom SSP3 quittiert, der danach gelesene CFG_AFE1-Wert bleibt aber 0x0000.
- Die Antwort `00 00 35` hat eine nach Datenblatt korrekt berechnete CRC8. Das wird jetzt bei jedem PLC-Registerlesen unabhängig geprüft; ungültige CRC8 führt zu einem Lesefehler statt zur Übernahme der Registerdaten.
- Nach vollständigem **fehlgeschlagenem** automatischem SSP3-Start werden ausschliesslich lesend CFG_EN, CFG_PADS0, CFG_PADS1, CFG_AFE1 und ADC_S geprüft und im JSON-Export gespeichert. Dies geschieht **nach** der Startfenster- und Magic-Cookie-Sequenz und verändert keine RAM-/NVM-Konfiguration.
- Die eigentliche Start-/Power-/PLC-Sequenz bleibt unverändert; erst weitere Hardwarelogs können klären, ob das Problem am Startfenster, den PLC_CFG-Parametern oder am tatsächlichen Chipzugriff liegt.
- Klarstellung: PWR_ON 0C80 ist die Schwelle bei 3.2 V, kein fester VSUPPLY-Sollwert. Hardwaretest ausstehend.

## v0.6.34 – 12.11.2026: Nullantwort beim E703.11 erkennen und Magic-Cookie-Fallback gezielt versuchen

- Jürgs SSP3-Log ergab: Power-/PLC-Start quittiert, danach `CFG_AFE1=0x0000` aus der Antwort `00 00 35`. Weil das Format parsbar war, griff die bestehende Prüfung auf `PLC nothing received` nicht.
- Nur bei exakt bestätigtem AFE-Nullwert oder expliziter No-Reply-Meldung einmaligen vorhandenen RAM-Magic-Cookie-Fallback ausführen. Andere ungültige AFE- und Parsingfehler bleiben gesperrt.
- Nach Fallback weiterhin echte Register-/ADC-Rücklesung verlangen; kein NVM-Schreiben.
- Protokollexport meldet jetzt die tatsächliche Web-App-Version v0.6.34 statt des alten statischen Werts v0.6.30; der Auslösegrund wird im Power-Cycle-Ergebnis protokolliert.
- Hardwaretest mit Jürgs Sensor und Prüfung von 1-Wire-Startfenster und tatsächlicher Versorgung stehen aus.

## v0.6.33 – 12.11.2026: Temperaturanzeige zurückgenommen und Verbindungsfehler verständlicher

- Die in v0.6.32 eingeführte Celsius-Anzeige wurde vollständig entfernt. Der Kopf zeigt wieder **ADC_S, ADC_T, DSP_S und Sensorwert**.
- Keine zyklische DSP_T-Zusatzabfrage und keine Temperaturkoeffizienten-Leseprüfung mehr. Live-Abfrage und Sensor-Neuinitialisierung aus v0.6.31 bleiben erhalten.
- Bei einer nicht plausiblen Chip-Leseantwort CFG_AFE1=0x0000 erfolgt eine verständliche Fehlerbeschreibung. In der normalen Verbindungsanzeige stehen bei gescheitertem Start die Prüfung von Sensor/Versorgung/1-Wire und der Button «Sensor neu initialisieren» im Vordergrund. Technische Details bleiben im TX/RX-Protokoll.
- Ein realer Hardwaretest am betroffenen Prüfplatz ist weiterhin erforderlich.

## v0.6.32 – 12.11.2026: Geschützte Live-Temperaturanzeige in °C

- Zusätzliches, responsives KPI **Temperatur (°C)** oben neben ADC_S, ADC_T, DSP_S und Sensorwert.
- Liest DSP_T (0x2E) als separaten Sekundärwert. ADC_S bleibt der primäre Live-Wert und darf durch Fehler der Temperaturabfrage nicht verloren gehen.
- Prüft CFG_EN.t_abs_en und Temperaturkoeffizienten. Umrechnung nur bei der Elmos-Standardbeispielkonfiguration mit interner Quelle (100 Digits/°C) oder nach bestätigter RAM-Temperaturkalibrierung mit der speziellen Skalierung des Assistenten.
- Unbekannte oder deaktivierte Skalierung sowie veraltete/ungültige Messwerte werden nicht fälschlich als °C dargestellt; ≈ kennzeichnet die Näherung. Demo bildet die bekannte Assistenten-Skalierung nach.
- Bei Sensorwechsel werden Temperaturwert und Skalierung zurückgesetzt. Keine NVM-Schreibvorgänge.

## v0.6.31 – 12.11.2026: Sensorverlust erkennen und ohne F5 neu initialisieren

- Nach zwei aufeinanderfolgenden fehlgeschlagenen ADC_S-Live-Abfragen wird der Chipzustand auf «nicht verbunden» gesetzt, die Live-Abfrage gestoppt und der letzte Messwert ausgeblendet. Ein einzelner Lesefehler wird lediglich erneut geprüft.
- Der Kopfbereich zeigt einen verständlichen Sensorstatus anstelle einer dauerhaften technischen PLC-Fehlerzeile. Ausführliche Fehler bleiben im USB-/TX-RX-Protokoll.
- Ein jederzeit sichtbarer Knopf **«Sensor neu initialisieren»** bei fehlender Sensorantwort startet die vorhandene geprüfte SSP3-/1-Wire-Initialisierung über denselben offenen USB-Port (ohne Seitenneuladen). Andere Schnittstellen führen ihren bestehenden Erkennungspfad erneut aus.
- Frühere Messpunkte, RAM-Koeffizientenfreigaben und NVM-Freigaben werden bei Sensorverlust oder Wiederinitialisierung ungültig. Keine automatische NVM-Programmierung.
- Statische JavaScript-Syntax und die Verknüpfung zwischen Reconnect-Banner und Handler geprüft; Hardwaretest mit abgezogenem/neu angestecktem E703.11 steht noch aus.

## v0.6.30 – 12.11.2026: Kontinuierliche RAM-Konversion nach Magic-Cookie-Zugriff wieder starten

- Das zweite Magic-Cookie-Telegramm schreibt 0x5CFD auf die CFG_PERIOD-Adresse 0x0E; der Screenshot zeigt den exakt übereinstimmenden RAM-Wert.
- Nur im nachgewiesenen Cookie-Pfad und bei diesem Rücklesewert wird CFG_PERIOD=0x0001 im RAM geschrieben, rückgelesen und CMD.start für die kontinuierliche Kalibrierung gesendet.
- Keine NVM-Änderung, keine Änderung von One-Wire-Startkonfiguration, keine Rücksetzung der manuell gewählten Live-Pause.
- Zusätzlicher Rücklese-/Fehlerstatus und Regressionstests. Hardwaretest folgt.

## v0.6.29 – 12.11.2026: Live-Messung bei CFG_PERIOD-Einzelmodus

- Prüft CFG_PERIOD 0x0E und STATUS 0x36 nach der Chiperkennung lesend und zeigt den Modus im Live-Kopf an.
- Bei bestätigtem CFG_PERIOD=2 erzeugt pro Live-Abfrage CMD.start (0x22=0x8B93) einen neuen Messzyklus; anschliessend wird STATUS.adc_s_up=1 verlangt.
- Bei anderen Werten keine automatischen neuen Schreibbefehle. Verbindungsaufbau, Magic Cookie und NVM unverändert.
- Diagnoseexport ergänzt um Periodenmodus, Status, Anzahl CMD-Starts und tatsächlicher ADC-Wertänderungen. Hardwaretest ausstehend.

## v0.6.28 – 12.11.2026: Live-Start unabhängig von NVM-Schreibfreigabe

- Bei bestätigtem ADC_S darf die **nur lesende** Live-Abfrage nach Ende der SSP3-Initialisierung beginnen, auch wenn die gesonderte NVM-relevante Startfreigabe noch offen ist. Kein Aufweichen der NVM-Schutzprüfungen.
- Die normale Kopfzeile zeigt fortlaufend erfolgreiche/gestartete Live-ADC-Abfragen und letzte Fehler. Bei nachgewiesenem `CFG_SPI_I2C.plc_en=0` wird das fehlende dauerhafte One Wire ausdrücklich angezeigt.
- Der SSP3-Protokollexport enthält zusätzlich `liveDiagnostic` mit Zählern, letzter Antwort, Fehler und `plcEnabledInRam`. Damit lässt sich ein blockierter Browser-Poll von auslaufendem Chip-Startfenster unterscheiden.
- Keine neuen RAM-/NVM-Schreibbefehle, kein zusätzlicher Power-Cycle. Ein echter Hardwaretest ist weiterhin erforderlich.

## v0.6.27 – 12.11.2026: Dauerhafte PLC-RAM-Freigabe nach Magic Cookie lesen

- Nach bestätigter Chiperkennung `CFG_SPI_I2C (0x06)` rein lesend prüfen. `plc_en` muss nach erkannter Magic Cookie im RAM 1 sein, damit One Wire gemäss Datenblatt über das Startfenster hinaus aktiv bleibt.
- Bei `plc_en=0` Verbindung nicht als dauerhaft erfolgreich darstellen; klare Warnung zur fehlenden Live-Kommunikation. Bei nicht lesbarem Register Zustand als unbekannt melden.
- Diagnosefelder `powerCycle.plcConfigRam`, `plcEnabledInRam`, `plcConfigReadError` im JSON-Export; kein zusätzliches Schreiben, keine NVM-Änderung.
- Die entkoppelte, kontinuierliche Live-ADC_S-Abfrage aus v0.6.26 bleibt bestehen.

## v0.6.26 – 12.11.2026: Live-ADC_S unabhängig von Temperatur/DSP abfragen

- Eigene zyklische Live-Abfrage: ADC_S zuerst lesen und sofort anzeigen, danach höchstens ein zusätzliches Register pro Durchlauf (ADC_T, ADC_TC, DSP_S, Pause).
- Temperature-/DSP-Lesefehler blockieren den Druckwert nicht mehr; mehrere Timeout-Ketten werden vermieden.
- Bei ADC_S-Kommunikationsfehlern läuft die Live-Wiederholungsprüfung im bestehenden USB-Port alle 2 s weiter; sichtbare Warnmeldung statt stillschweigendem Stop nach zehn Fehlschlägen.
- Strenge Kalibrier-Messpunktproben, SSP3-Magic-Cookie-Start, NVM-Konfiguration und Power-Schutz unverändert.
- Neue Regressionstests für Registerreihenfolge, Verfügbarkeit und Live-Retry-Verhalten.

## v0.6.25 – 12.11.2026: ADC-Live-Werte nach SSP3-Magic-Cookie-Verbindung

- Live-Abfrage priorisiert ADC_S (0x2A) und behandelt ADC_T/ADC_TC/DSP_S als separat fehlertolerante Werte. So können fehlende Temperaturantworten die Druckanzeige nicht mehr vollständig blockieren.
- Erste bestätigte ADC_S-Messung wird sofort angezeigt. Strenge Kalibrierproben bleiben unverändert und verlangen weiterhin alle ADC-Werte.
- Kontinuierliche Live-Messung startet erst nach Abschluss des SSP3-Power-/Magic-Cookie-Startvorgangs, um überlappende Registerabfragen zu vermeiden.
- Kurze PLC-Lesefehler werden mit begrenzten, verlangsamten Wiederholungen behandelt (maximal zehn aufeinanderfolgende Fehler); deutlichere Statusmeldungen.
- Keine neuen Sensor-Schreibtelegramme, kein Neustart während Live, keine NVM-Änderungen.

## v0.6.24 – 12.11.2026: Magic-Cookie-Freigabe im normalen SSP3-One-Wire-Verbindungsweg

- Der Nutzer meldet erfolgreiche One-Wire-Chiperkennung nach manuell aktivierter Magic Cookie.
- Nach dem automatischen SSP3-Start führt die App bei `!PLC nothing received` einmalig die zwei dokumentierten Magic-Cookie-PLC-Frames aus und prüft danach erneut die Sensorregister.
- Fallback strikt auf fehlenden PLC-Empfang begrenzt; andere Fehler, Schreibschutz/NVM und geschützte PLC-Bootregister bleiben unangetastet.
- Dokumentiert, ob die UID nach der Freigabe wirklich gelesen werden konnte. Normaler Verbindungsdialog benötigt keine Diagnoseaktionen.

## v0.6.23 – 12.11.2026: SSP3-Power-/PLC-Antworten ohne Zeilenumbrüche korrekt auswerten

- Reales SSP3-Feedback `#PWR_ON ... :#PLC T :` zeigt, dass beide Startkommandos bestätigt wurden. Die bisherige strenge Zeilenprüfung lieferte fälschlich 1/2 Prompts.
- SSP3-Prompt-Zähler erkennt direkt verkettete Doppelpunkt-Prompts vor dem nächsten Echo; separate Quittungsprüfung erkennt beide Kommandos auch ohne CR/LF dazwischen.
- Regressionstest mit tatsächlicher SSP3-Teilantwort ergänzt; kein Wechsel von ASCII-Befehlen, Power-Ablauf, PLC-Encoder oder NVM-Konfiguration.
- Echtes E703.11-Registerlesen nach dem Burst bleibt bis Hardwaretest offen.

## v0.6.22 – 12.11.2026: SSP3 nimmt kombinierten Startbefehl nicht zuverlässig an

- Nach Hardwarefehler «Bei PWR_ON + PLC T wurden nicht beide Antworten empfangen» das kombinierte ASCII-Paket in zwei einzelne CR-terminierte serielle Schreibaufrufe aufgeteilt, **ohne** auf die erste SSP3-Antwort zu warten.
- Beide Firmwareprompts und die Kommandobestätigungen werden anschliessend geprüft; Teilantwort und Laufzeit werden bei Timeout in der exportierten Diagnose gespeichert.
- Keine NVM- oder Bootregisteränderung. Power-Wiederherstellung bei Abbruch bleibt aktiv.
- 4-ms-Timing bleibt bis Hardwaretest unbestätigt.

## v0.6.21 – 12.11.2026: One-Wire-Cookie zeitnah nach Power-On senden

- Bisherige 15-ms-USB-Roundtrip-Pause zwischen `PWR_ON` und `PLC T` entfernt.
- `PWR_ON 0C80 00C8 0` und `PLC T` werden in **einem** USB-Write als zwei CR-getrennte SSP3-Befehle gesendet. Ein gemeinsamer Response-Waiter sammelt ausdrücklich zwei Firmware-Prompts und prüft beide Quittungen.
- Normale SSP3-/One-Wire-Startsequenz, CRC-Telegrammformat, I²C/SPI-Trennung, NVM-Schutz und Wiederherstellung der Versorgung bei Fehlern bleiben erhalten.
- 4-ms-Startfenster erfordert hardwareseitige Timingprüfung; mehrere CR-Kommandos in einem USB-Write noch nicht am echten SSP3 bestätigt.

## v0.6.20 – 12.11.2026: SSP3-One-Wire-Autostart ohne Checkbox und PLC-Rückkorrektur

- Reales SSP3-Feedback `frame contains invalid data ( )` bestätigt, dass die separierte Form `PLC 02 6D1C0C.` ungültig ist. Wiederherstellung der korrekten ursprünglichen Form `PLC 026D1C0C.` für Firmware 02.08.02.04.
- Für SSP3+OneWire wird der vollständige Power-/PLC-Pufferstart bei jedem Verbinden automatisch durchgeführt. Keine Browser-Checkbox, kein gespeicherter Schaltzustand, kein versehentliches Zurückfallen auf direktes Registerlesen.
- I²C/SPI und Bridge bleiben ausserhalb des SSP3-Power-Startpfads. Bestehender Power-Off-Hilfetest, Fehlerbehandlung und Wiederherstellung des Stroms bleiben erhalten.
- Redundante experimentelle Einmal-Start-Optionen entfernt; Experten-Diagnosebereiche weiterhin standardmässig verborgen.
- Geprüfte NVM-Schutzmechanismen und das gespeicherte PLC-Startfenster bleiben unberührt. Softwaretests aktualisiert.

## v0.6.19 – 12.11.2026: Normalen One-Wire-Verbindungsaufbau repariert

- SSP3-Version `02.08.02.04` wird aus `.VERSION` korrekt erkannt; passendes `PLC 02 6D1C0C.`-Hostformat wird beim Verbinden automatisch aktiviert. Keine ungesicherte Auto-Umstellung bei anderen Firmwareversionen.
- Einzelne explizite, widerrufbare Opt-in-Option «Sensor beim Verbinden automatisch über SSP3 starten (One Wire)» in der normalen Verbindungsansicht. Nutzt ausschliesslich den vorhandenen geprüften Power-Start-Ablauf, nie NVM-Programmierung.
- JS-/CSS-Cache-Parameter auf die aktuelle Version gesetzt, damit kein veraltetes Skript weiter ausgeführt wird.
- E703.11-Startup-NVM-Konfiguration bleibt unverändert; Diagnosewerkzeuge weiter verborgen.

## v0.6.18 – 12.11.2026: PLC-Startfenster bleibt erhalten; Diagnose ausgeblendet

- Zeitlich begrenzte PLC-Starts mit Magic-Cookie-Verfahren korrekt als möglich erkannt, auch wenn plc_us_en/plc_rw_en im Original-NVM 0 sind.
- NVM-Kalibrierschreiben bleibt nur mit bestätigtem SSP3-Hardwarestart und identischer UID möglich. Alle Interface- und Startup-NVM-Bits erhalten.
- Temporäre Diagnosefunktionen im Standardmodus verborgen und im Expertenmodus weiterhin zugänglich.
- Neue Schutz- und Regressionstests.

## v0.6.17 – 12.11.2026: Experimentelles SSP3-PLC-Hostformat

- Reales Hardwarelog bestätigt Hostannahme von `PWR_OFF`, `PLC P`, `PWR_ON` und `PLC T`; E703.11 antwortet noch nicht.
- Die aktuelle SSP3-Firmware zeigt `PLC <slave_id> <data>`, AN0204 dagegen die Form `PLC 026D1C0C.`. Neuer, expliziter Select zwischen `PLC 026D1C0C.` und `PLC 02 6D1C0C.` für das nächste Lese-/Startfenster-Experiment.
- Neue Formatierungsfunktion ändert ausschliesslich die Trennung der ASCII-Hostparameter, nicht Chipbytes/CRC. Legacy bleibt Standard; Format nach Chiperkennung gesperrt.
- Neue Regressionstests. Kein NVM-Schreiben im Starttest, keine automatische zweite Stromunterbrechung.

## v0.6.16 – 12.11.2026: SSP3-Firmwarehilfe und gesicherte Power-Off-Prüfung

- Hardwarelog zeigt `Unknown command (POWER_OFF)` beim vorhandenen SSP3. `PWR_ON 0 0 0` wurde akzeptiert; noch keine PLC-P-/T-Freigabe ausgeführt.
- Neue nur lesende Schaltfläche **«SSP3-Befehle anzeigen (?)»**. Das komplette Firmware-Hilfeergebnis wird angezeigt und in den JSON-Diagnoseexport übernommen.
- Vor jeder experimentellen Power-Sequenz fragt die App `?` ab und lässt das **nur bei ausdrücklich aufgeführtem `PWR_OFF`** erfolgende alternative `PWR_OFF 03E8` zu. Fehlt es, Abbruch vor jeder Abschaltung.
- Nach möglicher Abschaltung weiterhin dokumentierter Wiederherstellungsversuch `PWR_ON 0 0 0`; keine NVM-Änderung, keine weiteren unbekannten Power-Kommandos.

## v0.6.15 – 12.11.2026: SSP3-Sensorstart nach AN 0204

- Dokumentiertes, manuell freizugebendes Power-Off/-On und PLC-Pufferfreigabe mit separatem Starttest und One-shot-Option beim nächsten Verbindungsaufbau.
- Exakte Befehle `Power_OFF 03E8`, `PLC P`, `PWR_ON 0C80 00C8 0`, `PLC T` – kein NVM-Schreiben. Bei Fehler automatische Wiederherstellung mit `PWR_ON 0 0 0`.
- SSP3-Rohantworten und Laufzeiten im Export, neue Prüfplatzwarnungen und Regressionstests.

## v0.6.14 – 12.11.2026: Experimenteller One-Wire-Magic-Cookie-Test

- Option für einen einmaligen, ausdrücklich bestätigten Magic-Cookie-Test beim nächsten SSP3-Verbindungsaufbau: nach IF_CFG und vor dem ersten Registerlesen. Auswahl wird danach zurückgesetzt.

- Separater Opt-in-Test im SSP3-Diagnosebereich mit Warnung zum vorübergehend unterdrückten Analogausgang.
- Zwei dokumentierte PLC-Random-Writes `0xAC = 0x2B42` und `0x0E = 0x5CFD` direkt nacheinander. Anschliessende Registerprüfung statt falscher SSP3-Prompt-Erfolgsmeldung.
- CRC-Schreibtelegramm gegen Herstellerbeispiel validiert. Keine NVM-Schreibbefehle, keine unbestätigten SSP3-Power-Befehle.
- Ergebnisse und TX/RX-Befehle in bestehendem Diagnoseexport. Ein abgelaufenes PLC-Startfenster kann der Test nicht automatisch öffnen.

## v0.6.13 – 12.11.2026: SSP3-Handshake genauer eingrenzen

- Hardware-Rückmeldung berücksichtigt: Die Originalsoftware verbindet Sensoren mit kurzem PLC-Startfenster ohne manuelles Neuanschliessen.
- Fehlermeldungen und Startdiagnose stellen nicht mehr den manuellen VDD-Power-Cycle als normalen Lösungsweg dar. Die 12-s-Lesediagnose bleibt optional und wird korrekt als rein lesender Versuch ohne automatischen Sensor-Neustart bezeichnet.
- Unter USB & Chip kann jetzt das komplette Web-App-SSP3-TX/RX-Protokoll mit Firmware, Chipstatus, letzten PLC-Rohdaten und Diagnose als JSON exportiert werden. Für die Umsetzung eines automatischen PSSC-kompatiblen Startablaufs fehlt weiterhin ein **originaler SSP3-Trace**.
- Keine neuen Register- oder NVM-Schreibbefehle; keine unbestätigten SSP3-Power-Befehle.
- Software-Regressionstests entsprechend erweitert.

## v0.6.12 – 12.11.2026: One-Wire-Startfenster am SSP3

- Der bisherige automatische USB-Trenn-/Neuverbindungsversuch nach fehlgeschlagener Chiperkennung wurde entfernt; er startet den Sensor nicht neu.
- Nach erfolgreichem SSP3/IF_CFG-Handshake bleibt die USB-Verbindung offen. Ein neuer Button «Startfenster testen (12 s)» führt bis zu 75 kontrollierte PLC-Leseversuche auf CFG_AFE1 aus (240-ms-Antworttimeout; maximal 12 s).
- Während dieses Tests kann die Sensorversorgung VDD von Hand neu eingeschaltet werden. Der laufende Test ist abbrechbar, protokolliert Fehlschläge und übernimmt die bestehende sichere Chiperkennung.
- **Nur lesend; keine Boot-, RAM-, EEPROM- oder NVM-Änderung.** SSP3-VDD-Steuerung bewusst nicht implementiert, solange ein dokumentierter Befehl und ein Hardwaretest fehlen. 4-ms-Zugriff bleibt ohne hardwareseitig synchronisierten Power-Cycle nicht garantiert.
- Bedienhinweise und Tests entsprechend angepasst.

# Änderungsverlauf

Versionierung nach `MAJOR.MINOR.PATCH`: Kleine Anpassungen erhöhen PATCH, neue Funktionen MINOR, inkompatible Änderungen MAJOR. Jede Änderung erhält eine neue Nummer und einen Eintrag.

## v0.6.11 – 12.11.2026

- **Verbindungsdiagnose bei CFG_AFE1/Bit 11:** Nach dem bereits bestehenden, einmaligen SSP3-USB-Neuaufbau führt die App bei erneutem Chiptestfehler **ausschliesslich lesende** Registerabfragen aus (3× CFG_AFE1, je 1× CFG_AFE0/CFG_AFE2/ADC_S).
- Sichtbares Diagnosefenster unter «USB & Chip» zeigt Wortwert, 16 Bits, Bit 11, PGA-/Offset-Codes, drei 1-Wire-Antwortbytes und das empfangene CRC8-Byte; manuelle Wiederholung und strukturierter JSON-Export.
- **Sicherheitsgrenze:** Die CRC8-Prüfgrundlage der SSP3-Rückgabe ist noch nicht hardwarevalidiert. Deshalb wird nur das empfangene CRC8-Byte angezeigt und **kein ungeprüftes CRC OK** behauptet. Weder reservierte Bits noch Chip-RAM/EEPROM werden durch die Diagnose verändert. Alle bisherigen Schreibsperren bleiben erhalten.
- **64 Softwaretests**, einschliesslich fehlgeschlagenen Chiptests und ausschliesslich lesender Diagnoseschritte.

## v0.6.10 – 12.11.2026

- Im geführten Abgleich mit **einer Temperaturstufe** werden Druckpunkte nur als **P1, P2 usw.** bezeichnet. **T1 / P1** bleibt für mehrere Temperaturstufen erhalten.
- **Unabhängige DSP-Nachprüfung:** Standardmässig wird **1 Prüfpunkt** gewählt, unabhängig vom Temperaturplan. Weitere Prüfpunkte können weiterhin manuell eingestellt werden.
- **NVM-Live-Messung:** Nach dem geschützten NVM-Schreib-/Rückleseablauf startet die ADC-/DSP-Live-Messung automatisch wieder, sobald alle Wartungs-/Schreibsperrflags freigegeben sind. Absichtlich manuell pausierte Messungen bleiben pausiert. Vor Beginn des NVM-Vorgangs wird eine noch laufende Live-Abfrage abgewartet.
- **58 Software-Regressionstests**, inklusive Punktbezeichnungen, Prüfpunkt-Voreinstellung und gesichertem Live-Neustart nach NVM.

## v0.6.9 – 12.11.2026

- **Immer vollständige Config-Dateien:** Der Export enthält die fünf wiederverwendbaren Gruppen AFE, Referenz, Messung, DSP und Ausgang.
- **Gruppenauswahl beim Import:** Nach dem Laden erscheinen alle in der Datei verfügbaren Gruppen als einzeln wählbare Checkboxen. Fehlende Gruppen in älteren partiellen v2-Dateien sind nicht anwählbar. Vollständige alte v1-Dateien bleiben kompatibel.
- **AFE nur bei Auswahl ins RAM:** Wenn AFE beim Import angehakt ist, schreibt der bestätigte Importklick mit der bestehenden Boot-/Rückleseprüfung direkt ins Sensor-RAM. Ohne AFE kein AFE-RAM-Schreiben, niemals automatische EEPROM-Programmierung.
- **Automatisch erkennbarer Config-Dateiname:** Druckpunktanzahl, Temperaturstufen (nur bei bekanntem angewendetem Messplan), Druckbereich, analoge Ausgangsspannungen und selbst gewählter Profilname als Präfix-/Namenskombination, zum Beispiel `2P_Druck_3T_Temp_0-10bar_0p5-4p5V_ELMOS_E70311_Standardprofil.json`.
- **55 Software-Regressionstests**, einschliesslich Vollprofil-Export, importseitiger Gruppenauswahl, überprüfbarer Dateinamensmerkmale und bestehender Hardware-Sicherheitsfunktionen.

## v0.6.8 – 12.11.2026

- **Config-Export mit Gruppenauswahl:** AFE, Referenz, Messung, DSP und Ausgang sind einzeln wählbar. Neue selektive JSON-Configs im Format v2; vollständige ältere v1-Dateien bleiben lesbar.
- **AFE beim Import direkt ins RAM:** Der ausdrücklich beschriftete Importknopf löst die bestehende geschützte AFE-RAM-Übernahme mit Bootprüfung und Rücklesung aus. Ohne Chipverbindung oder bei fehlgeschlagener Prüfung werden die anderen Gruppen nicht angewendet.
- Keine automatische EEPROM-/NVM-Programmierung. Nicht enthaltene Config-Gruppen bleiben unverändert.
- Gruppenauswahl auch im geführten und kompakten Arbeitsplatz; kein zusätzlicher AFE-RAM-Importknopf.
- **51 JavaScript-Regressionstests**, einschliesslich selektiven Importen, Validierung, Altformat und AFE-Sicherheitsprüfung.

## v0.6.7 – 11.11.2026

- Die SuperMini-Firmware v0.4 verwendet GPIO10 für den Lastschalter. Die Web-App zeigt nach dem Verbinden den von der Firmware verwendeten Pin an.

## v0.6.6 – 11.11.2026

- Nach erfolgreichem NVM-Schreiben kann die ESP32-Bridge den Sensor über GPIO7 neu starten und Chip-ID, NVM und Bootregister prüfen.

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

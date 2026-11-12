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

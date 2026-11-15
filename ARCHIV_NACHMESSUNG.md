# ELMOS E703.11 – Lokales Kalibrierarchiv und Nachmessungen

**Softwarestand v0.7.75 · Funktions- und Benutzeranleitung · Laborprototyp**

**Archivexport ab v0.7.72:** Für jeden Archivdatensatz gibt es genau **einen übersichtlichen CSV-Export** sowie einen JSON-Export für die vollständigen technischen Originaldaten. Nachmessung und Test/Logging bieten zusätzlich einen PDF-Bericht; bis zu zwei optionale Fotos werden darin angezeigt. Die frühere separate VDD-Istspannungs-Eingabe der Anschlussansicht ist entfernt.

**Firmware korrekt benannt:** `02.08.02.04` ist die SSP3-**Adapter-Firmware**, aus dem Befehl `.VERSION`, und keine E703.11-Sensorfirmware. Der rohe Chip-Versionsregisterwert `0x38` wird separat dargestellt, sofern beim Start ausgelesen. Für alte Archivdateien erfolgt diese Zuordnung automatisch, ohne ihre Daten zu verändern.

**Neuer Logviewer v0.7.3:** Im Archiv findest du zuerst Gesamtkennzahlen und eine Liste aller passenden Protokolle. Du kannst per UID, Beschreibung, Board, Softwareversion und Datum suchen und nach Typ/Status filtern. Ein Klick auf **«Ergebnisse prüfen»** zeigt pro Datei eine detaillierte Statistik (Mittelwert, Min/Max, Standardabweichung), den DSP_S-Signalverlauf und relevante Ereignisse, soweit sie gespeichert wurden. Zwei Messdateien per Checkbox auswählen und **«2 Dateien vergleichen»** drücken: Beide erscheinen nebeneinander, mit Kennzahlen, Messwertdifferenzen und NVM-Unterschieden. Fehlende Rohdaten oder Referenzwerte werden als nicht verfügbar gekennzeichnet und niemals als bestandene Prüfung interpretiert.

**Navigation ab v0.7.2:** «Archiv» und «Nachmessung» sind zwei getrennte Buttons oben in der Webseite. Im **Archiv** finden sich die gespeicherten Einträge, Filter, Vergleiche und Downloads. Der komplette Prüfplan mit Druck-/Temperaturrampen und Hysterese ist unter **«Nachmessung»** erreichbar. Die Messresultate erscheinen nach Abschluss automatisch wieder im gemeinsamen Archiv.

Neu: Der Protokolltyp **Test / Logging** kann direkt über die vierte Kachel des geführten Assistenten gestartet werden. Er unterstützt frei einstellbare Messintervalle, beliebige Einzelmessgruppen, Mittelwert/Median, Kommentare und separate Rohdatenteile. [Ausführliche Anleitung](TEST_LOGGING.md).

Das Archiv arbeitet ausschliesslich lokal. Die Webseite lädt weder Kalibrierdateien noch Messwerte auf einen Server hoch. Die Anwendung nutzt die File System Access API in einem dafür freigegebenen Chromium-Browser (empfohlen: aktuelle Desktop-Version von Google Chrome über HTTPS oder `http://localhost`). Eine Browserberechtigung kann bei einem späteren Besuch erneut erforderlich sein.

## 1. Archivordner einrichten

1. [ELMOS-Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/).
2. In der Start-/Aufgabenübersicht **Archiv** oder **Nachmessung** wählen (alternativ die entsprechende Navigation der klassischen Ansicht).
3. **Archivordner auswählen** und einen eigenen oder bereits vorhandenen Ordner wählen, zum Beispiel `D:\Messdaten`. Der Ordner darf auch andere PDFs, Bilder, JSON-Dateien und Unterordner enthalten.
4. Chrome die Lese- und Schreibberechtigung für diesen Ordner erteilen.
5. Über **Ordner einlesen** wird die Archivliste aktualisiert. Für einen neuen Prüfbericht zuerst die Nachmessung öffnen und bei Bedarf den Archivordner freigeben.

Der Browser merkt sich den Ordner über IndexedDB, sofern die Berechtigungsspeicherung unterstützt wird. Eine erneute Freigabe kann nötig sein. Ein Netzwerkordner funktioniert dann, wenn Windows/macOS und Chrome den Zugriff zulassen. Die Anwendung selbst verwaltet keine Cloud und keine Benutzernamen.

Dateien nach dem Muster `ELMOS_YYYYMMDD_HHMMSS_UID_ID.json` enthalten je einen vollständigen Vorgang. Fremde Dateien und ungültige JSON-Formate werden nicht als Kalibrierungen angezeigt. Erkannte, aber defekte Archivdateien werden nur dann als Warnung gezählt, wenn sie eindeutig wie ein vom Archiv erzeugter Dateiname aussehen. **Die App verändert keine fremden Dateien.**

## 2. Kalibrieren und automatisch dokumentieren

**Geführter Abgleich:** Sensor verbinden, den geführten Assistenten öffnen, **Sensor neu abgleichen** auswählen und weitergehen. Vor der ersten AFE-Einstellung startet die App einen Archivdatensatz und sichert den Ausgangszustand.

**Klassische Ansicht:** Zuerst über **Archiv & Nachmessung → Abgleich protokollieren** starten, damit auch die anfänglichen AFE-Änderungen erfasst werden. Falls kein Vorgang gestartet wurde, versucht die App spätestens beim ersten Kalibriermesspunkt, das Archiv anzulegen.

Beim Start wird das verfügbare RAM aus dokumentierten Registern sowie das vollständige NVM mit 64 Wörtern über den bestehenden, abgesicherten NVM-Leseweg erfasst und CRC-geprüft. Lesefehler und nicht verfügbare Daten werden explizit als solche aufgezeichnet, nicht durch angenommene Werte ersetzt.

Jeder aufgenommene Punkt enthält Referenzdruck und Temperatur, Einheit, Zeitpunkt, alle einzelnen ADC_S-, ADC_T- und ADC_TC-Samples, daraus berechnete Mediane und Streuung sowie die gültige AFE-Konfiguration. Auch **partiell gelesene Samples** werden bei einem Fehler archiviert. Änderungen an AFE, Verstärkung, Brückenspannung und DSP-Koeffizienten werden mit dem bestätigten RAM-Wert erfasst.

**Verifikation:** Alle Versuche werden einzeln dokumentiert, auch wenn ein Versuch knapp ausserhalb der Toleranz liegt oder später wiederholt wird. Die Anzeige im Kalibrierassistenten darf frühere Prüfpunkte für eine neue Freigabe verwerfen; das Archiv verwirft sie nicht.

**NVM-Programmierung:** Vor dem Schreiben muss ein aktiver Archivdatensatz existieren. Vor dem ersten tatsächlichen Programmierschritt werden das vollständige Original-NVM und der Änderungsplan gespeichert. Nach erfolgreichem Schreiben und vollständigem Rücklesen wird auch das neue NVM archiviert. Die bestehende zusätzliche Download-/Backup-Funktion bleibt separat verfügbar. Ein NVM-Schreibfehler wird ebenfalls gespeichert, einschliesslich des Hinweises, ob ein Schreibversuch bereits begonnen hatte.

Die bestehenden Schutzbedingungen für Factory-, Boot- und Kommunikationsregister, CRC, Chip-UID und NVM-Schreibfreigaben bleiben unverändert. Ein Archiv ersetzt keinen Hardwaretest.

## 3. Nachmessung mit digitalem Sensorwert (ab v0.7.65)

- Kalibrierten Druckbereich (von/bis) und physikalische Einheit (bar, mbar, kPa, MPa, psi) angeben.
- Prüfpunkte entweder in **% der Messspanne** oder direkt als Druck eingeben. Der Prüfplan speichert die umgerechneten physikalischen Druckwerte. Beispiel für 0–10 bar: `0,25,50,75,100,75,50,25,0` % entspricht `0,2.5,5,7.5,10,7.5,5,2.5,0` bar.
- Bei der Nachmessung zeigt das Feld **Referenzdruck (bar / mbar / …)** die gewählte Einheit unmittelbar beim Zahlenwert an.
- Druck und ggf. Temperatur am Prüfstand manuell einstellen; Messpunkt aufnehmen und das Ergebnis prüfen. Die letzte Messung wird direkt beim Aufnahmebutton angezeigt.
- Weitere Protokollangaben (Prüfer, Projekt, Prüfstand, Prüfmittel/Zertifikatsreferenz, Bemerkungen) bleiben **immer sichtbar**. Ein separates Feld für externe Messmittel und die freie Beschreibung des ursprünglichen Sensorabgleichs wurden entfernt.
- Am letzten Prüfpunkt **Prüfung abschliessen und speichern** wählen. Archiv, Diagramm, übersichtliche CSV und PDF enthalten Referenzwerte, Sensormesswerte und Abweichungen. **Eine Toleranzbewertung erfolgt nur nach ausdrücklicher Aktivierung**; sonst werden die Werte ohne Bestanden-/Fehlerentscheid dokumentiert.

**Messwertquelle:** Die Nachmessung verwendet den Sensorwert, den die Web-App bereits digital als Druck oder Prozent darstellt. Sie berechnet ihn nicht nochmals mit einem separaten DSP-Endwert. Im E703.11 basiert diese Anzeige intern auf dem digitalen korrigierten Druckwert des Chips (DSP_S). Ein physikalischer Druckwert ist nur dann verlässlich, wenn seine Zuordnung zum Druckbereich stimmt. Bei bekannter, passender aktueller RAM-Kalibrierung wird sie automatisch bestätigt, andernfalls ist eine unabhängige Bestätigung des angezeigten Sensorwerts nötig. Ist diese Zuordnung unbekannt, werden Messungen aufgezeichnet und im Diagramm angezeigt, aber **nicht als bestanden** bewertet.

**Abweichungsberechnung:** `Abweichung % Span = (Ist-Druck - Referenzdruck) / (kalibrierte Obergrenze - kalibrierte Untergrenze) × 100`. Die Anzeige dieser Abweichung ist auch ohne aktivierte Toleranzbewertung möglich. Wenn beide Druckwerte verschiedene physikalische Einheiten verwenden, wird zuerst die Einheit umgerechnet. Ist die Sensoranzeige in Prozent definiert, wird sie anhand des kalibrierten Druckbereichs auf Druck abgebildet. Beide Fälle setzen eine bestätigte Zuordnung voraus.

**Hysterese:** Gemessene Sensorwerte bei gleicher Referenz und entgegengesetzter Druckrichtung werden gegenübergestellt; die prozentuale Druckhysterese wird aus der gesamten kalibrierten Messspanne berechnet. Alte Archive mit DSP-Rohwerten bleiben weiterhin lesbar.

## 4. Temperatureinheit, Versorgung und Grenzen

**Temperatur:** `ADC_T`, `ADC_TC` und `DSP_T` werden als Rohwerte gespeichert. Die Umrechnung von `DSP_T` in Grad Celsius ist in dieser Web-App noch nicht unabhängig hardwarevalidiert. Optional lassen sich Skalierung (Digits/°C) und Offset eingeben und **nach unabhängiger Überprüfung** für diesen Sensor bestätigen. Die Vorauswahl (387.88 Digits/°C, −16485 Digits) ist ausdrücklich **keine Freigabe**. Ohne Bestätigung wird Temperaturhysterese in Roh-Digits gezeigt und die Temperaturtoleranz nicht als bestanden bewertet.

**Druck:** Der digital angezeigte Sensorwert ist die Grundlage der Nachmessung. Seine physikalische Skalierung muss zum Sensor und zum eingestellten Druckbereich passen. Ohne bestätigte Zuordnung bleibt eine Toleranzbewertung aus; bei deaktivierter Toleranz werden Messpunkte grundsätzlich nur erfasst. Der DSP-Endwert muss für die Nachmessung nicht separat eingestellt werden.

**Versorgung:** `VDD` (Sensorversorgung), `SVDD` (interne Brückenversorgung) und `S0/S1` (Ausgangssollwerte) sind verschieden. Die externe tatsächliche VDD-Spannung wird über den Programmieradapter nicht automatisch gemessen; deshalb wird ohne explizite externe Messung kein Istwert erfunden. Die gesonderte VDD-Istspannungs-Eingabe der Anschlussansicht ist entfernt. Der Testlogger kann einen optional manuell erfassten VDD-Wert als Bestandteil seiner Testkonfiguration dokumentieren.

## 5. Archivübersicht und Datenformat

Im Archiv lässt sich nach UID, Custom-/USER-ID, Datum, Board, Firmware, Softwareversion, Art und Status suchen oder filtern. Zwei ausgewählte Einträge können miteinander verglichen werden. Der Vergleich zeigt NVM-Änderungen wortweise. Jede Detailansicht zeigt chronologische Versuche, Fehler, Warnungen sowie das gesamte exportierbare JSON.

Jeder Datensatz enthält mindestens:

- **Identität:** Chip-UID, Custom-/USER-ID, eindeutige Vorgangs-ID, optional Vorgängerabgleich bei Nachmessungen.
- **Software:** Web-App-Version, Quelladresse, Demo-/lokaler Modus, Browserkennung.
- **Hardware:** SSP3 oder ESP32-Bridge, tatsächlich gelesener Firmwarestand, Schnittstelle und Adresse.
- **Konfiguration:** RAM-Register und NVM vor/nach dem Abgleich, AFE, Koeffizienten und gespeicherte Sollwerte.
- **Messungen:** Referenzen und Quellen, alle einzelnen Rohsamples, Median, DSP-Werte, Kennlinienzuordnung, Abweichungen und Grenzwerte.
- **Verlauf:** Wiederholungen, Teilmessungen, Fehler, einzelne NVM-Schritte und soweit verfügbar die betreffenden TX/RX-Antworten.
- **Test-Logging:** Name, Beschreibung, Prüfer, Intervall, Mittelungsverfahren, alle Einzelmessungen und zugehörige `.samples.jsonl`-Dateiteile. Der **JSON-Export** enthält die vollständigen Rohdaten; der **CSV-Export** fasst sie bewusst zu einer lesbaren Messpunkttabelle zusammen.
- **Endstatus:** abgeschlossen, fehlgeschlagen, unvollständig, unterbrochen oder abgebrochen.

### Optionale Fotos zum Prüfprotokoll (ab v0.7.73)

Bei **Nachmessung** und **Test/Logging** lassen sich **maximal zwei Bilder** hinzufügen – beispielsweise vom Sensor, Prüfaufbau oder angeschlossenen Messgerät. Fotos können vor, während oder nach der Aufnahme sowie später in der Archiv-Detailansicht ergänzt oder entfernt werden. Jedes Bild kann eine kurze optionale Beschriftung erhalten.

Akzeptiert werden JPG, PNG und WebP bis **12 MB als Eingangsdatei**. Die Web-App verkleinert die Fotos im Browser auf maximal **1400 Pixel Kantenlänge** und speichert jedes als JPEG mit **höchstens 300 KB**. Durch die Neuerzeugung werden ursprüngliche Bildmetadaten wie EXIF nicht übernommen. Es wird **keine Online-Bildverarbeitung** verwendet.

Die verkleinerten Bilder werden als eingebettete Bilddaten **direkt im lokalen JSON-Archivprotokoll** gespeichert. Damit bleiben sie bei der Datensicherung und beim erneuten Öffnen erhalten, ohne dass separate Bilddateien verwaltet werden müssen. Im PDF-Bericht werden beide Fotos mitsamt Bildbeschreibung in einem eigenen Abschnitt angezeigt. Bei Protokollen ohne Fotos entfällt dieser Abschnitt.

### Live-Abfrageintervall (ab v0.7.74)

Unter **Einstellungen → Live-Abfrageintervall** ist zusätzlich zu den bisherigen 400, 650, 1000, 1500 und 2000 ms die Option **«250 ms · Adaptiv (schneller)»** verfügbar. Die gewählte Zeit ist die Pause **nach** einem vollständig abgeschlossenen Sensorlesezyklus. Der neue Modus erhöht bei langsamen Sensorantworten die Pause auf 400 oder 650 ms und hält bei Kommunikationsfehlern die bestehende 2-Sekunden-Retry-Pause ein. Andere Abfrageintervalle sind unverändert; die App startet keine parallelen One-Wire-/I²C-Befehle und führt durch diese Änderung keine Register- oder NVM-Schreibvorgänge aus. **Die tatsächliche Live-Rate muss am Prüfstand geprüft werden.**

### PDF und CSV exportieren (ab v0.7.72)

**Pro Archivprotokoll gibt es genau einen CSV-Export.** Im Archiv heisst der Button einfach **«CSV»**, in der Detailansicht und nach Abschluss einer Nachmessung **«CSV herunterladen»**. Die Datei ist bewusst übersichtlich: Die **Messwerte stehen am Anfang** als Tabelle, darunter folgen die wenigen wichtigsten Prüf- und Sensorangaben. Für technische Rohdaten stehen weiterhin das ursprüngliche JSON-Archiv und gegebenenfalls die zugehörigen JSONL-Dateien zur Verfügung.

- **Nachmessung:** Referenzdruck, digitaler Sensordruck, Abweichung in der Druckeinheit und in % FS, relevante Temperaturangaben, Prüfrichtung und Aufnahmezeit. Versuch, Zyklus, Samples und Bewertung erscheinen nur dann als Tabellenspalte, wenn sie einen zusätzlichen Nutzen haben. Wiederholungen und nicht aufgenommene geplante Prüfpunkte bleiben erhalten. Die Toleranzbewertung bleibt optional und wird nicht erfunden.
- **Test / Logging:** Übersicht der Messpunktgruppen mit aufgenommenen ADC-/DSP-Kanälen, Referenz- und Sensordruck (soweit vorhanden), Zeit und Anzahl Samples. Wichtige Fehlermeldungen und Marker sind am Ende in einem separaten kurzen Bereich aufgeführt. Sämtliche Einzel-Rohsamples bleiben im JSON/JSONL.
- **Kalibrierung:** Aufgenommene Abgleichpunkte, zugehöriger Referenzdruck, Temperatur, ADC-Werte und Messzeitpunkt.
- **Ausgang:** Wichtige Programmier- und Prüfereignisse ohne unübersichtliche Rohregisterlisten.

Die CSV enthält **keine** verschachtelten JSON-Feldpfade, TX/RX-Massenlogs oder NVM-Registerdumps. Sie wird als UTF-8-Datei mit Semikolon-Trennzeichen exportiert, damit die Spalten in Excel gut lesbar sind.

**PDF:** Für Nachmessung und Logging bleibt der PDF-Bericht separat verfügbar; er wird über den Browserdruckdialog als PDF gespeichert. **CSV:** Der Browser lädt die Datei herunter; die Originalarchive werden nicht verändert.

Das JSON-Format verwendet `format: "elmos-e70311-record"` und `schemaVersion: 1`. Bei einem anderen Format oder einer falschen Version wird die Datei nicht als gültiger Archiveintrag angezeigt.

## 6. Datenschutz und Sicherung

Alle Daten bleiben auf dem vom Benutzer gewählten Laufwerk. **Regelmässige Sicherungen dieses Ordners sind dringend zu empfehlen**, beispielsweise auf ein gesichertes Firmenlaufwerk. Bei einem Browserabsturz bleibt die zuletzt vollständig geschriebene Datei bestehen; ein noch offener Vorgang wird nicht fälschlicherweise als bestanden markiert.

Die Datei ist ein technisches Audit-Protokoll, kein manipulationssicherer, signierter Datensatz. Manuelle Änderungen an JSON-Dateien werden nicht kryptografisch erkannt. Mehrere PCs können verschiedene Dateien in denselben Ordner schreiben, dürfen aber nicht dieselbe Datei gleichzeitig bearbeiten. Gemeinsame Live-Synchronisierung findet nicht statt; mit **Ordner einlesen** wird neu geladen.

## 7. Hardwareprüfung vor Produktion

Die neuen Funktionen wurden mit Softwareprüfungen vorbereitet. Die vollständige Messung an echten Druck-/Temperaturprüfständen, Hysterese und NVM-Programmierung sind weiterhin am Testchip zu validieren. Bei der Nachmessung werden weder Temperaturkammer noch Druckkalibrator automatisch geregelt. Extern gemessene Referenzwerte und Temperaturangaben werden nur dann übernommen, wenn sie ausdrücklich eingegeben beziehungsweise technisch bestätigt sind.

# ELMOS E703.11 – Lokales Kalibrierarchiv und Nachmessungen

**Softwarestand v0.7.3 · Funktions- und Benutzeranleitung · Laborprototyp**

**Neuer Logviewer v0.7.3:** Im Archiv findest du zuerst Gesamtkennzahlen und eine Liste aller passenden Protokolle. Du kannst per UID, Beschreibung, Board, Softwareversion und Datum suchen und nach Typ/Status filtern. Ein Klick auf **«Ergebnisse prüfen»** zeigt pro Datei eine detaillierte Statistik (Mittelwert, Min/Max, Standardabweichung), den DSP_S-Signalverlauf und relevante Ereignisse, soweit sie gespeichert wurden. Zwei Messdateien per Checkbox auswählen und **«2 Dateien vergleichen»** drücken: Beide erscheinen nebeneinander, mit Kennzahlen, Messwertdifferenzen und NVM-Unterschieden. Fehlende Rohdaten oder Referenzwerte werden als nicht verfügbar gekennzeichnet und niemals als bestandene Prüfung interpretiert.

**Navigation ab v0.7.2:** «Archiv» und «Nachmessung» sind zwei getrennte Buttons oben in der Webseite. Im **Archiv** finden sich die gespeicherten Einträge, Filter, Vergleiche und Downloads. Der komplette Prüfplan mit Druck-/Temperaturrampen und Hysterese ist unter **«Nachmessung»** erreichbar. Die Messresultate erscheinen nach Abschluss automatisch wieder im gemeinsamen Archiv.

Neu: Der Protokolltyp **Test / Logging** kann direkt über die vierte Kachel des geführten Assistenten gestartet werden. Er unterstützt frei einstellbare Messintervalle, beliebige Einzelmessgruppen, Mittelwert/Median, Kommentare und separate Rohdatenteile. [Ausführliche Anleitung](TEST_LOGGING.md).

Das Archiv arbeitet ausschliesslich lokal. Die Webseite lädt weder Kalibrierdateien noch Messwerte auf einen Server hoch. Die Anwendung nutzt die File System Access API in einem dafür freigegebenen Chromium-Browser (empfohlen: aktuelle Desktop-Version von Google Chrome über HTTPS oder `http://localhost`). Eine Browserberechtigung kann bei einem späteren Besuch erneut erforderlich sein.

## 1. Archivordner einrichten

1. [ELMOS-Web-App öffnen](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/).
2. Oben auf **Archiv & Nachmessung** klicken.
3. **Archivordner auswählen** und einen eigenen oder bereits vorhandenen Ordner wählen, zum Beispiel `D:\Messdaten`. Der Ordner darf auch andere PDFs, Bilder, JSON-Dateien und Unterordner enthalten.
4. Chrome die Lese- und Schreibberechtigung für diesen Ordner erteilen.
5. Über **Ordner einlesen** wird die Archivliste aktualisiert.

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

## 3. Nachmessung, Druck- und Temperaturhysterese

1. Den kalibrierten Sensor verbinden und **Archiv & Nachmessung** öffnen.
2. Prüfart wählen: **Druckrampe**, **Temperaturrampe** oder **Druck × Temperatur**.
3. Druck- und Temperaturwerte in der gewünschten Reihenfolge eingeben, getrennt durch Komma, Leerzeichen oder Semikolon. Dezimaltrennzeichen ist **Punkt**.
4. Zyklen (1–30) einstellen und **Prüfplan berechnen**.
5. **Nachmessung starten**. Die App legt einen neuen Archivdatensatz mit der aktuellen Chip-UID und den Anfangszuständen an.
6. Klimakammer und Druckkalibrator von Hand auf den angezeigten Prüfpunkt einstellen, Werte stabilisieren, tatsächliche Referenzen und Quelle erfassen, Häkchen zur Stabilisierung setzen.
7. **Messung aufnehmen / wiederholen** drücken. Alle einzelnen Samples bleiben erhalten.
8. Bei Bedarf denselben Punkt beliebig oft nachmessen oder zum nächsten bzw. vorherigen Punkt wechseln.
9. Nach allen Punkten **Nachmessung abschliessen** wählen.

Beispiel Druckrampe: `0, 2.5, 5, 7.5, 10, 7.5, 5, 2.5, 0`.

Beispiel Temperaturrampe: `10, 40, 90, 40, 10`.

Bei **Druck × Temperatur** wird jede Druckrampe bei jeder Temperaturstufe durchlaufen. Beide Rampen können unabhängig mehrere Umkehrpunkte enthalten. Mehrere komplette Zyklen sind erlaubt. Es werden keine festen zwei, drei oder sechs Punkte vorausgesetzt; zur Begrenzung von Fehlbedienung gilt ein technisches Maximum von 100 Werten je Rampe und 3000 gesamten Schritten je Vorgang.

Für die Hysterese werden nur Punkte mit demselben Referenzdruck und derselben Referenztemperatur, aber **entgegengesetzter Anfahrrichtung**, verglichen. Druck- und Temperaturhysterese werden getrennt berechnet. Fehlt ein Gegenpunkt, wird keine Hysterese erfunden. Am Umkehrpunkt kann nur ein Messwert vorhanden sein; dafür wird ohne zweiten Vergleich kein Hysteresewert angegeben.

## 4. Temperatureinheit, Versorgung und Grenzen

**Temperatur:** `ADC_T`, `ADC_TC` und `DSP_T` werden als Rohwerte gespeichert. Die Umrechnung von `DSP_T` in Grad Celsius ist in dieser Web-App noch nicht unabhängig hardwarevalidiert. Optional lassen sich Skalierung (Digits/°C) und Offset eingeben und **nach unabhängiger Überprüfung** für diesen Sensor bestätigen. Die Vorauswahl (387.88 Digits/°C, −16485 Digits) ist ausdrücklich **keine Freigabe**. Ohne Bestätigung wird Temperaturhysterese in Roh-Digits gezeigt und die Temperaturtoleranz nicht als bestanden bewertet.

**Druck:** Bei vorhandenem DSP-Anzeigebereich wird die physikalische Umrechnung angeboten. Sie wird für eine Toleranzbewertung nur verwendet, wenn die aktuelle RAM-Kennlinie aus dem Abgleich stammt oder du den Anzeigebereich ausdrücklich für den Sensor bestätigst. Ohne verifizierbare Zuordnung bleibt der DSP_S-Rohwert erhalten und die Drucktoleranz unbewertet. Ein unbewerteter Prüfpunkt erhält niemals automatisch den Status «bestanden».

**Versorgung:** `VDD` (Sensorversorgung), `SVDD` (interne Brückenversorgung), `S0/S1` (Ausgangssollwerte) und der Schwellenwert der SSP3-Versorgungssequenz sind verschieden. Die aktuelle Hardware-Schnittstelle liefert **keine bestätigte Messung der realen VDD-Spannung**. Unter **VDD-Istspannung** kannst du deshalb einen mit Multimeter oder Prüfgerät gemessenen Wert samt Quelle erfassen. Ohne diese Eingabe wird im JSON `measuredV: null` gespeichert. Die aus `CFG_AFE0` abgeleitete nominale SVDD sowie eingestellte VDD- und S0/S1-Werte werden separat gespeichert, niemals als Istmessung ausgegeben.

## 5. Archivübersicht und Datenformat

Im Archiv lässt sich nach UID, Custom-/USER-ID, Datum, Board, Firmware, Softwareversion, Art und Status suchen oder filtern. Zwei ausgewählte Einträge können miteinander verglichen werden. Der Vergleich zeigt NVM-Änderungen wortweise. Jede Detailansicht zeigt chronologische Versuche, Fehler, Warnungen sowie das gesamte exportierbare JSON.

Jeder Datensatz enthält mindestens:

- **Identität:** Chip-UID, Custom-/USER-ID, eindeutige Vorgangs-ID, optional Vorgängerabgleich bei Nachmessungen.
- **Software:** Web-App-Version, Quelladresse, Demo-/lokaler Modus, Browserkennung.
- **Hardware:** SSP3 oder ESP32-Bridge, tatsächlich gelesener Firmwarestand, Schnittstelle und Adresse.
- **Konfiguration:** RAM-Register und NVM vor/nach dem Abgleich, AFE, Koeffizienten und gespeicherte Sollwerte.
- **Messungen:** Referenzen und Quellen, alle einzelnen Rohsamples, Median, DSP-Werte, Kennlinienzuordnung, Abweichungen und Grenzwerte.
- **Verlauf:** Wiederholungen, Teilmessungen, Fehler, einzelne NVM-Schritte und soweit verfügbar die betreffenden TX/RX-Antworten.
- **Test-Logging:** Name, Beschreibung, Operator, Intervall, Mittelungsverfahren, alle Einzelmessungen und zugehörige `.samples.jsonl`-Dateiteile. JSON-/CSV-Export kombiniert die Rohdaten wieder.
- **Endstatus:** abgeschlossen, fehlgeschlagen, unvollständig, unterbrochen oder abgebrochen.

Das JSON-Format verwendet `format: "elmos-e70311-record"` und `schemaVersion: 1`. Bei einem anderen Format oder einer falschen Version wird die Datei nicht als gültiger Archiveintrag angezeigt.

## 6. Datenschutz und Sicherung

Alle Daten bleiben auf dem vom Benutzer gewählten Laufwerk. **Regelmässige Sicherungen dieses Ordners sind dringend zu empfehlen**, beispielsweise auf ein gesichertes Firmenlaufwerk. Bei einem Browserabsturz bleibt die zuletzt vollständig geschriebene Datei bestehen; ein noch offener Vorgang wird nicht fälschlicherweise als bestanden markiert.

Die Datei ist ein technisches Audit-Protokoll, kein manipulationssicherer, signierter Datensatz. Manuelle Änderungen an JSON-Dateien werden nicht kryptografisch erkannt. Mehrere PCs können verschiedene Dateien in denselben Ordner schreiben, dürfen aber nicht dieselbe Datei gleichzeitig bearbeiten. Gemeinsame Live-Synchronisierung findet nicht statt; mit **Ordner einlesen** wird neu geladen.

## 7. Hardwareprüfung vor Produktion

Die neuen Funktionen wurden mit Softwareprüfungen vorbereitet. Die vollständige Messung an echten Druck-/Temperaturprüfständen, Hysterese und NVM-Programmierung sind weiterhin am Testchip zu validieren. Bei der Nachmessung werden weder Temperaturkammer noch Druckkalibrator automatisch geregelt. Für einen echten externen VDD- oder Temperatur-Istwert ist bis zu einer späteren Geräteanbindung eine manuelle Eingabe erforderlich.

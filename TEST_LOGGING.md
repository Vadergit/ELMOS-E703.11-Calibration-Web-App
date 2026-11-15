# ELMOS E703.11 – Test / Logging

**Aktueller Softwarestand v0.7.75 · Benutzeranleitung (Laborprototyp)**

Das **Test / Logging** findest du auf zwei Wegen: in der **klassischen Ansicht als eigenen Reiter direkt unter «EEPROM Viewer»** und im geführten Assistenten auf der ersten Seite als **vierte Kachel**. Beide Wege öffnen denselben Logger, dessen Eingaben beim Wechsel erhalten bleiben. Damit können beliebige sensorbezogene Versuche protokolliert werden, ohne einen neuen Abgleich oder einen NVM-Schreibvorgang auszulösen.

## 1. Einen Test starten

1. Sensor über das SSP3-Board bzw. einen tatsächlich unterstützten Adapter verbinden.
2. Auf **Geführt** und bei «Was möchtest du machen?» direkt auf die Kachel **Test / Logging** klicken. Alternativ den gleichnamigen Reiter in der klassischen Ansicht öffnen.
3. **Testname** eingeben; optional die neue **Produkt / DUT-Bezeichnung**, **Kategorie**, **Operator**, **Beschreibung des Testaufbaus**, gemessene **VDD-Istspannung** mit Messquelle.
4. Das Intervall, die Aufnahmeart und optional die **Testdauer** einstellen (siehe unten).
5. **Aufzeichnung starten** drücken und einen lokalen Archivordner auswählen bzw. freigeben. Der Start erfasst zunächst die verfügbaren RAM- und NVM-Daten. Nicht lesbare Informationen werden als Fehler/fehlend gekennzeichnet.
6. Die Aufzeichnung beginnt. Bei Bedarf **Pause**, **Einzelaufnahme**, **Marker mit Zeitstempel** oder **Referenzdruck/-temperatur übernehmen** verwenden.
7. Mit **Aufzeichnung beenden & speichern** abschliessen. Danach stehen ein **übersichtlicher CSV-Export**, der vollständige JSON-Export und ein PDF-Prüfprotokoll zur Verfügung. Alle Tests erscheinen im Archiv.

Während einer Aufzeichnung ist der serielle Messpfad reserviert. **RAM-/NVM-Änderungen und der parallele Kalibrierablauf sind nicht erlaubt.** Der Logger selbst programmiert keine Sensorregister.

**Live-Abfrage (Einstellungen) gegenüber Logging:** Die Option **«250 ms · Adaptiv»** betrifft nur die reguläre Live-Anzeige. Für Test/Logging gelten weiterhin das hier eingestellte Messintervall, die Sample-Anzahl und die tatsächlichen Sensorantwortzeiten. Die Web-App startet keine parallelen Sensorabfragen, um ein zu kurzes Intervall künstlich einzuhalten.

## 2. Frei definierbare Messintervalle

| Einstellung | Bedeutung | Bereich | Beispiel |
| --- | --- | --- | --- |
| Messintervall zwischen Messpunkten | Geplanter Abstand zwischen dem Start zweier Messpunkt-Gruppen | 1–3’600’000 ms, ganze Millisekunden | 250 ms |
| Einzelmessungen pro Messpunkt | Wie oft die Sensorregister innerhalb einer Gruppe nacheinander gelesen werden | 1–100 | 5 |
| Abstand zwischen Einzelmessungen | Zusätzliche Wartezeit zwischen den einzelnen Register-Sets derselben Gruppe | 0–60’000 ms | 20 ms |
| Werte zusammenfassen | Keine, arithmetischer Mittelwert oder Median über die Einzelmessungen | freie Auswahl | Mittelwert |
| Testdauer | Zeit bis zum automatischen Stopp, in Sekunden, Minuten oder Stunden | 0 = unbegrenzt, ansonsten 0.1 s bis 30 Tage | 10 Minuten |

Beispiel: Messintervall **1000 ms**, **5** Einzelmessungen je Punkt, **20 ms** zusätzliche Pause und **Mittelwert**. Die App misst nacheinander fünf vollständige Register-Sets und berechnet einen Mittelwert für ADC_S, ADC_T, ADC_TC, DSP_S und DSP_T. Zugleich werden **alle fünf ungemittelten Einzelmessungen** mit Zeitstempel gespeichert.

**Testdauer und Pause:** Wenn du zum Beispiel **10 Minuten** einstellst, beendet der Logger die Messung nach zehn Minuten **aktiver** Aufzeichnungszeit automatisch und speichert die Daten. Beim Pausieren wird die Restzeit angehalten; nach dem Fortsetzen läuft sie weiter. Das Display zeigt die verbleibende Testdauer an. Bei `0` läuft die Aufzeichnung weiter, bis du manuell stoppst. Eine bereits begonnene Messpunktaufnahme wird beim Erreichen des Limits fertig abgespeichert. Das tatsächliche Ende kann dadurch etwas später liegen.

**Wichtig:** Das Messintervall ist ein Planwert und **kein garantierter SPS-/ADC-Takt**. Jedes Sensorregister erfordert USB-/1-Wire-Kommunikation. Sind die fünf Messungen langsamer als das gewählte Gruppenintervall, werden keine Messungen parallel oder nachträglich erfunden. Die Software protokolliert die tatsächliche Zeit jedes Messpunkts, die Dauer, die Verspätung und die Anzahl übersprungener Sollintervalle. Die reale effektive Abtastrate lässt sich aus den Zeitstempeln bestimmen.

Status-Bitfelder sind keine analogen Messgrössen und werden **nicht gemittelt**.

## 3. Welche Daten protokolliert werden

### Pro Test

- Chip-UID und USER-/Custom-ID, Zeitstempel, Prüf-ID
- Web-App-Version, Browser, Adaptertyp (SSP3/ESP32-Bridge, soweit tatsächlich verbunden), Firmware und Kommunikationsart
- Sensor-RAM und -NVM zu Beginn/Ende, soweit über den bestehenden sicheren Leseweg verfügbar
- Testname, separate Produkt-/DUT-Bezeichnung, Beschreibung, Kategorie und Operator
- Intervall, Gruppengrösse, Einzelmessabstand, Aggregationsart und Debug-Modus
- Manuell erfasste VDD-Istspannung und Messgerät/Quelle getrennt von der eingestellten VDD, nominalen SVDD und den Ausgangs-Sollwerten

### Pro Messpunkt

- Geplante und tatsächliche Zeit, Dauer, Verspätung und übersprungene Zeitfenster
- **Alle Einzelwerte:** ADC_S, ADC_T, ADC_TC, DSP_S, DSP_T, SYNC/Status und Chip-Status, soweit lesbar
- Optional Mittelwert/Median der fünf analogen Kanäle; Rohwerte bleiben immer enthalten
- Fehler beim Lesen einzelner Kanäle (mit Zeitstempel) und nicht verfügbare Werte als `null`
- Zeitpunkt und Werte externer Referenzdruck-/Temperaturangaben, Messquelle
- Aktueller AFE-Zustand, Sollspannungen bzw. manuell erfasste Istspannungen
- Operator-Marker, Kommentare, manuelle Snapshots sowie Pause-/Fortsetzen-Ereignisse

Ist **«Zusätzlich TX/RX-Kommunikation aufzeichnen»** aktiv, werden auch die vom bestehenden USB-Logger bereitgestellten Befehle und Antworten gespeichert. Das erzeugt deutlich grössere Dateien.

Die App misst die wirkliche externe Spannung **nicht selbst**, wenn der Adapter keinen bestätigten VDD-Messwert liefert. In diesem Fall bleibt `measuredV: null`, ausser du trägst die Messung mit Quellenangabe manuell ein.

## Optionale Bilder des Prüfaufbaus

Vor dem Start, während der Aufzeichnung und nach dem Speichern kannst du **ein oder zwei Fotos** hinzufügen. Der optionale Fotobereich zeigt Vorschaubilder und erlaubt eine kurze Beschriftung und das Entfernen einzelner Bilder. Zulässig sind JPG, PNG oder WebP bis 12 MB; im Browser werden die Bilder auf max. 1400 Pixel und 300 KB pro Bild komprimiert. Die Fotos werden lokal direkt in der Archiv-JSON-Datei gespeichert und später im PDF-Protokoll angezeigt. Im Archiv kann ein Foto auch nach Abschluss ergänzt werden. Die Rohmessdaten bleiben unverändert.

## 4. Dateien, Archiv und Export (aktuell ab v0.7.72)

Die Aufzeichnung speichert ihre Metadaten in einer `.json`-Datei und die fortlaufend aufgenommenen Sensorwerte in `.samples.jsonl`-Teildateien. Alle Teildateien gehören zum selben Vorgang.

Nach Abschluss gibt es drei Exportmöglichkeiten:

- **CSV herunterladen:** Ein einziger, gut lesbarer CSV-Bericht. Zuerst erscheinen die Messpunkte mit Zeit, ADC-/DSP-Werten, Referenz- und Sensordruck (soweit vorhanden) sowie der Anzahl Samples. Danach folgen Angaben zu Test, DUT, Prüfer, Messintervall und Gerät. Marker und Fehler werden in einem eigenen Abschnitt aufgeführt. Keine TX/RX-Massenlogs und keine verschachtelten JSON-Pfade.
- **JSON inkl. Rohwerte:** Vollständige technische Dokumentation mit allen Einzelmessungen, Rohdaten, Einstellungen und Ereignissen. Für eine umfassende Nachprüfung oder weitere Analyse ist dieser Export gedacht.
- **Prüfprotokoll als PDF speichern:** Druckfertiger Bericht mit Testdaten, Statistik, Signalverlauf, Messpunktgruppen und Ereignissen. Im Browserdruckdialog «Als PDF speichern» wählen.

Pro archiviertem Logging-Protokoll gibt es **nur einen CSV-Button**. Das gilt auch für die übrigen Protokolltypen. Der CSV-Download speichert in den Browser-Downloadordner und verändert die Originaldaten nicht.

**Für die vollständige Datensicherung immer den gesamten Archivordner mit sämtlichen `.jsonl`-Dateien aufbewahren.**


## 5. Grenzen und Sicherheit

- Der Logger ist eine browserbasierte Laborfunktion, keine zeitgenaue industrielle Datenerfassung.
- Der Messrhythmus hängt von USB-Adapter, Firmware, Schnittstelle, Betriebssystem, Latenz und Antwortzeiten des E703.11 ab.
- Vollständige Hardwaretests an echten SSP3-/ESP32-Prüfaufbauten stehen noch aus.
- Ein Sensorverlust unterbricht die Aufzeichnung. Bereits vollständig geschriebene Rohdaten-Dateien bleiben erhalten; der Datensatz wird als unterbrochen gekennzeichnet.
- Bei einem Browserabsturz können noch nicht geschriebene Einzelwerte verloren gehen. Der Test bleibt im Archiv erkennbar offen, und abgeschlossene Rohdatenteile sind weiterhin vorhanden.
- Die Rohdaten sind Nachweise für beobachtete Werte, aber ohne geeichte Referenzgeräte und validierte Kennlinie **keine automatische Kalibrierfreigabe**.

Zurück zu [Archiv & Nachmessung](ARCHIV_NACHMESSUNG.md) oder zur [Web-App](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/).

## Firmware-Angabe richtig verstehen (v0.7.4)

Die Zahl `02.08.02.04` stammt aus der SSP3-Adapterantwort auf `.VERSION` und beschreibt **die Firmware des SSP3-Boards** – nicht eine Sensorfirmware. Im Archiv heisst das Feld deshalb **Adapter-Firmware**. Falls das E703.11-Register `0x38` erfolgreich gelesen wurde, wird sein Wert als **Chip-Version (Reg. 0x38)** angezeigt; daraus wird keine Firmwareversion des Sensors erfunden. Ältere Protokolle werden ebenfalls korrekt beschriftet.

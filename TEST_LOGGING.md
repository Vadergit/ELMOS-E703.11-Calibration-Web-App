# ELMOS E703.11 – Test / Logging

**Ab v0.7.1 · Benutzeranleitung (Laborprototyp)**

Im geführten Assistenten gibt es auf der ersten Seite jetzt die **vierte Kachel «Test / Logging»**. Damit können beliebige sensorbezogene Versuche protokolliert werden, ohne einen neuen Abgleich oder einen NVM-Schreibvorgang auszulösen.

## 1. Einen Test starten

1. Sensor über das SSP3-Board bzw. einen tatsächlich unterstützten Adapter verbinden.
2. Auf **Geführt** und bei «Was möchtest du machen?» auf **Test / Logging** klicken, dann **Weiter**.
3. **Testname** eingeben; optional **Kategorie**, **Operator**, **Beschreibung des Testaufbaus**, gemessene **VDD-Istspannung** mit Messquelle.
4. Das Intervall und die gewünschte Aufnahmeart einstellen (siehe unten).
5. **Aufzeichnung starten** drücken und einen lokalen Archivordner auswählen bzw. freigeben. Der Start erfasst zunächst die verfügbaren RAM- und NVM-Daten. Nicht lesbare Informationen werden als Fehler/fehlend gekennzeichnet.
6. Die Aufzeichnung beginnt. Bei Bedarf **Pause**, **Einzelaufnahme**, **Marker mit Zeitstempel** oder **Referenzdruck/-temperatur übernehmen** verwenden.
7. Mit **Aufzeichnung beenden & speichern** abschliessen. Danach sind JSON (inklusive aller Rohwerte) und CSV verfügbar. Alle Tests erscheinen auch im normalen Archiv.

Während einer Aufzeichnung ist der serielle Messpfad reserviert. **RAM-/NVM-Änderungen und der parallele Kalibrierablauf sind nicht erlaubt.** Der Logger selbst programmiert keine Sensorregister.

## 2. Frei definierbare Messintervalle

| Einstellung | Bedeutung | Bereich | Beispiel |
| --- | --- | --- | --- |
| Messintervall zwischen Messpunkten | Geplanter Abstand zwischen dem Start zweier Messpunkt-Gruppen | 1–3’600’000 ms, ganze Millisekunden | 250 ms |
| Einzelmessungen pro Messpunkt | Wie oft die Sensorregister innerhalb einer Gruppe nacheinander gelesen werden | 1–100 | 5 |
| Abstand zwischen Einzelmessungen | Zusätzliche Wartezeit zwischen den einzelnen Register-Sets derselben Gruppe | 0–60’000 ms | 20 ms |
| Werte zusammenfassen | Keine, arithmetischer Mittelwert oder Median über die Einzelmessungen | freie Auswahl | Mittelwert |

Beispiel: Messintervall **1000 ms**, **5** Einzelmessungen je Punkt, **20 ms** zusätzliche Pause und **Mittelwert**. Die App misst nacheinander fünf vollständige Register-Sets und berechnet einen Mittelwert für ADC_S, ADC_T, ADC_TC, DSP_S und DSP_T. Zugleich werden **alle fünf ungemittelten Einzelmessungen** mit Zeitstempel gespeichert.

**Wichtig:** Das Messintervall ist ein Planwert und **kein garantierter SPS-/ADC-Takt**. Jedes Sensorregister erfordert USB-/1-Wire-Kommunikation. Sind die fünf Messungen langsamer als das gewählte Gruppenintervall, werden keine Messungen parallel oder nachträglich erfunden. Die Software protokolliert die tatsächliche Zeit jedes Messpunkts, die Dauer, die Verspätung und die Anzahl übersprungener Sollintervalle. Die reale effektive Abtastrate lässt sich aus den Zeitstempeln bestimmen.

Status-Bitfelder sind keine analogen Messgrössen und werden **nicht gemittelt**.

## 3. Welche Daten protokolliert werden

### Pro Test

- Chip-UID und USER-/Custom-ID, Zeitstempel, Prüf-ID
- Web-App-Version, Browser, Adaptertyp (SSP3/ESP32-Bridge, soweit tatsächlich verbunden), Firmware und Kommunikationsart
- Sensor-RAM und -NVM zu Beginn/Ende, soweit über den bestehenden sicheren Leseweg verfügbar
- Name, Beschreibung, Kategorie und Operator
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

## 4. Dateien, Archiv und Export

Für jede Aufzeichnung entsteht eine Metadatendatei mit der Endung `.json`, die über UID, Testname, Datum, Kategorie, Adapter und Softwareversion suchbar ist. Die fortlaufende Telemetrie wird im selben freigegebenen Ordner in `.samples.jsonl`-Teildateien mit maximal 100 Messpunkten pro Teil aufbewahrt. Alle Dateien dieses Tests haben dieselbe Vorgangs-ID.

Beim **JSON-Export** werden die Metadaten und alle Einzelmessungen zu einem vollständigen JSON zusammengefasst. Beim **CSV-Export** erhalten Rohsamples je eine eigene Zeile; bei aktivierter Mittelung gibt es zusätzlich eine Aggregate-Zeile pro Messpunkt. Dadurch bleiben Rohdaten auch im CSV überprüfbar. Für den CSV-Export eignet sich Excel oder eine andere Tabellenkalkulation.

Die Dateien werden **lokal** gespeichert. Die Webseite sendet sie nicht automatisch an GitHub oder einen anderen Online-Dienst. Der Archivordner darf andere Dateien enthalten – diese werden nicht als Tests eingelesen oder verändert.

**Unbedingt den gesamten Archivordner inklusive aller `.jsonl`-Teildateien sichern**, nicht nur die einzelne `.json`-Metadatendatei. Das gilt besonders bei Langzeittests.

## 5. Grenzen und Sicherheit

- Der Logger ist eine browserbasierte Laborfunktion, keine zeitgenaue industrielle Datenerfassung.
- Der Messrhythmus hängt von USB-Adapter, Firmware, Schnittstelle, Betriebssystem, Latenz und Antwortzeiten des E703.11 ab.
- Vollständige Hardwaretests an echten SSP3-/ESP32-Prüfaufbauten stehen noch aus.
- Ein Sensorverlust unterbricht die Aufzeichnung. Bereits vollständig geschriebene Rohdaten-Dateien bleiben erhalten; der Datensatz wird als unterbrochen gekennzeichnet.
- Bei einem Browserabsturz können noch nicht geschriebene Einzelwerte verloren gehen. Der Test bleibt im Archiv erkennbar offen, und abgeschlossene Rohdatenteile sind weiterhin vorhanden.
- Die Rohdaten sind Nachweise für beobachtete Werte, aber ohne geeichte Referenzgeräte und validierte Kennlinie **keine automatische Kalibrierfreigabe**.

Zurück zu [Archiv & Nachmessung](ARCHIV_NACHMESSUNG.md) oder zur [Web-App](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/).

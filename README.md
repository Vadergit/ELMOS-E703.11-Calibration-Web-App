# ELMOS E703.11 – Chrome-Kalibrierassistent

Browserbasierter Kalibrierassistent für den **ELMOS E703.11** mit **SSP3-Eval-Board**. Die App läuft lokal im Chrome-Browser über **Web Serial**; als Standard ist **1-Wire (AODO)** eingestellt. I²C und SPI können je nach Hardwarekonfiguration gewählt werden.

> **Status: experimenteller Laborprototyp (v8).** Die Kommunikation, der Koeffizientenabgleich und die NVM-Programmierung wurden mit einem simulierten SSP3-Gerät getestet, **nicht** an echter Hardware vollständig verifiziert. **Nicht für Serienproduktion oder unersetzliche Chips einsetzen.** Ein fehlerhafter NVM-Schreibvorgang kann den Chip unbrauchbar machen.

## Kalibrier-Messpunkte und DSP-Reserve

In **Schritt 3 (Messpunkte)** wird **vor** der Messung die Anzahl Kalibrier-Messpunkte gewählt: **2–10, Standard 2**. Die Oberfläche zeigt anschliessend genau die gewählten Messpunkt-Karten. Jeder Punkt hat eine eigene Bezeichnung, einen Referenzwert und eine Temperatur. Die beiden Endpunkte entsprechen dem unteren und oberen Kalibrierbereich; Zwischenpunkte werden vorgeschlagen, können aber angepasst werden. Die Berechnung wird erst nach der vollständigen Aufnahme aller gewählten Punkte freigeschaltet. Die Anzahl der späteren **DSP-Prüfpunkte** wird separat in Schritt 5 festgelegt.

In **Schritt 4 (Berechnen & RAM)** kann der symmetrische **DSP-Endwert** zwischen **±1’000 und ±32’000 Digits** eingestellt werden. Standard bleibt **±32’000 Digits**; **±30’000** ergibt beispielsweise eine zusätzliche Reserve von 2’000 Digits gegenüber der alten Zielspanne, beziehungsweise 2’767 Digits bis zur positiven Grenze eines vorzeichenbehafteten 16-Bit-Ausgangs (+32’767). Dieser Wert ist ein **Sollwert für die Koeffizientenberechnung**, keine hardwareseitige Sättigungsgrenze:

- Der untere Referenzpunkt wird auf −Endwert und der obere auf +Endwert abgebildet
- Die späteren **DSP-Prüf-Sollwerte**, die **Fehlerumrechnung** sowie die Live-Umrechnung der neuen RAM-Kalibrierung verwenden denselben Endwert
- Ändert sich die DSP-Zielspanne nach der Berechnung, sind Berechnung, RAM-Übernahme und Prüfung zu wiederholen; die NVM-Freigabe bleibt solange gesperrt
- Für bereits früher kalibrierte Sensoren lässt sich die **DSP-Ausgangsspanne der bestehenden Kalibrierung** separat und rein für die Anzeige unter «AFE optimieren» einstellen

## DSP_S-Live-Anzeige

Die Web-App zeigt in **AFE optimieren** und **DSP prüfen** den tatsächlichen DSP-Ausgang aus **Chip-Register 0x30 (DSP_S)**. Die Live-Messung liest zusätzlich zu ADC_S/ADC_T/ADC_TC regelmässig DSP_S (nur lesend). Der aktuelle DSP-Wert wird auf beiden Seiten zeitgleich angezeigt.

- **Neu im RAM kalibriert:** Anzeige mit dem Referenzbereich und der Einheit der aktuellen Kalibrierung (z. B. 0–100 %).
- **Bereits früher kalibrierter Sensor:** Der Chip-DSP-Ausgang wird ohne erneuten Abgleich angezeigt. Die Zuordnung von DSP_S −32’000 bis +32’000 Digits zu 0–100 % ist voreingestellt; auch der DSP-Endwert für bereits kalibrierte Sensoren ist in der reinen Anzeige einstellbar. Den physikalischen Anzeigebereich (z. B. 0–10 bar) kann man in «AFE optimieren» ausschliesslich für die Anzeige anpassen und lokal im Browser speichern.
- **Sicherheitsgrenze:** Aus der DSP-Ausgabe allein kann die Software nicht feststellen, ob die vorhandene Kalibrierung gültig ist oder welcher physikalische Messbereich im Chip verwendet wurde. Die manuelle Anzeigeskalierung muss zum Sensor passen und ist nicht automatisch chipbezogen. Nur die explizite Prüfpunkterfassung zählt für die NVM-Freigabe, nie die laufende Live-Anzeige.
- **Lesefehler:** Ein nicht lesbares DSP_S wird gesondert angezeigt; die ADC-Messung kann trotzdem fortgesetzt werden.
- **Nach RAM-Schreibvorgängen:** Die Live-Anzeige wird beim Öffnen der DSP-Prüfseite wieder aktiviert. Während Schreib- und Wartungstransaktionen pausiert sie.

## Funktionen

- USB-/FTDI-Portwahl in Chrome und erneuter Verbindungsaufbau für bereits freigegebene Geräte
- ADC-Signalmonitor (ADC_S, ADC_T, ADC_TC)
- AFE-Konfiguration mit PGA1, PGA2, Offset und Gain-Empfehlungen
- Geführter Druck-/Temperaturabgleich und Messpunkt-Verifikation
- Berechnung von DSP-Koeffizienten im Browser
- Übertragung der Koeffizienten ins RAM und Rücklesekontrolle
- NVM-Backup, Schreibplanung, manuelle Freigabe, Schreiben und Rücklesen
- Schutz der Boot- und Kommunikationsregister vor Änderungen durch die App
- Optionale Hover-Hilfen und Diagnoseexport

## Expertenmodus, Ausgangsarten und 48-Bit-Backups (11.11.2026)

In **App-Einstellungen → Expertenmodus** erscheinen erweiterte Werkzeuge für Register, EEPROM/NVM und den AODO-Ausgang.

**AODO-Ausgangsarten laut E703.11-Datenblatt (25DS0170E.04):** High-Z, ratiometrisch analog (drei DAC-Korrekturstufen), PWM, FM und Alarm. SDA bleibt aus Schutzgründen kein frei wählbarer Modus. Einstellbar sind für dokumentierte Ausgänge auch `CFG_AODO` (Analog-Festwert 0x0880, PWM-Periode oder FM-Festwert 0x4200) sowie `AODO_F/AODO_O` und `CFG_EN.scale_en` für die Ausgangsskalierung. Die Ausgangsparameter werden **zuerst nur als geprüfter Vorschlag** vorgemerkt. Sie können nach vollständigem Kalibrier- und DSP-RAM-Prüfablauf in den finalen NVM-Änderungsplan übernommen werden. Bei 1-Wire-Betrieb ist das AODO-Pin zeitweise durch die Programmierschnittstelle belegt. PWM/FM erfordern ausschliesslich positive skalierte Werte; die App kontrolliert die Grenzen und bietet sichere Skalierungsvorschläge an.

**Experten-Registerleser:** Dokumentierte Hauptregister werden nur gelesen; das gesamte 64-Wort-NVM-Abbild kann unabhängig von einer neuen Kalibrierung gelesen und mit Registeradressen und Schutzklasse angezeigt werden. Die Factory-Kalibrierung bei CM-Byteadresse **0x00–0x1E** ist immer **nur lesbar**. Weitere Boot-/Kommunikationsregister bleiben unveränderbar. Es existiert absichtlich **kein beliebiger Rohregister-Schreibmodus**: Nur bereits validierte Kalibrier-, AFE-, AODO- und NVM-Wiederherstellungsoperationen sind zugelassen.

**Chipidentifikation und Backups:** Die eindeutige Kennung lautet **VERSION (0x38) + SER1 (0x52) + SER0 (0x50)**, insgesamt **48 Bit**. Jede erfolgreiche NVM-Lesung wird, falls die UID bestätigt ist, als vollständige CRC-geprüfte Sicherung in einer **lokalen Backup-Historie dieses Browsers** gespeichert. Exportdateien heissen zum Beispiel `ELMOS_E70311_UID_002056781234_2026-11-11T08-00-00Z.json`. Alte Backups lassen sich per JSON importieren, dem gleichen Chip zuordnen und vergleichen. Beim Wiederherstellen wird standardmässig das jüngste **abweichende** Backup gewählt. Es werden die Chip-UID, CRC8, CRC16 sowie der komplette Factory-/Bootbereich verglichen. Eine Wiederherstellung kann nur bekannte **User-NVM-Wörter (0x38–0x7C) plus CRC16 (0x7E)** verändern. Wenn ein Factory-/Bootwort abweicht, wird sie abgelehnt. Die eigentliche Wiederherstellung erfordert im letzten Schritt die **48-Bit-Chip-UID und `WIEDERHERSTELLEN`**. Ein Backup wird niemals automatisch auf einen Chip geschrieben.

Die lokale Browser-Historie ist kein dauerhaft garantiertes Archiv: Website-Daten können gelöscht oder durch Browserwechsel unzugänglich werden. Deshalb JSON-Backups immer zusätzlich ausserhalb des Browsers aufbewahren.

**Wichtig:** Der Expertenmodus gibt nicht pauschal alle Register zum Schreiben frei. Die Erweiterungen wurden bisher in JavaScript und mit simulierten Chip-/NVM-Antworten geprüft, **nicht** am echten E703.11 für alle Modi und Wiederherstellungen hardwarevalidiert. Vor NVM-Schreibversuchen einen entbehrlichen Testchip verwenden.

## Geführter Ablauf

1. **USB & AFE:** SSP3 verbinden, ADC_S kontrollieren und PGA1/PGA2/Offset optimieren. Gains/Offset werden mit dem Knopf «AFE-Einstellungen ins RAM übernehmen» kontrolliert geschrieben; die Slider sind eine Vorschau.
2. **Zwei Referenzpunkte:** Bezeichnungen frei wählen (z. B. **0 %** und **100 %**) und die Anzeigeeinheit zwischen bar, %, mbar, kPa, psi oder einer eigenen Einheit umstellen. Beide Endpunkte erfassen; ADC_S, ADC_T und ADC_TC werden gemeinsam aufgenommen. Zusätzliche Punkte sind für höhere Polynomordnungen möglich.
3. **Berechnen & RAM:** DSP-Koeffizienten berechnen und ohne vorgeschaltetes vollständiges NVM-Backup oder Scharfschalt-Checkbox **direkt ins RAM** übertragen und rücklesen. Erst nach erfolgreicher DSP-Prüfung geht es weiter.
4. **DSP prüfen:** Anzahl Prüfpunkte **1–10** einstellbar, **Standard ist 1**. Die tatsächliche Chip-Ausgabe DSP_S wird gegen die Referenz und die gewählte Toleranz verglichen. Mehrere Punkte prüfen unterschiedliche Stellen innerhalb des Druckbereichs. Bei Temperaturkompensation können zusätzliche Temperaturprüfungen erforderlich sein. Eine optionale lineare Rohwertprüfung ist **kein** Ersatz. **Ein einzelner Prüfpunkt ist keine Überprüfung der gesamten Kennlinie.**
5. **NVM:** Nach bestandener DSP-Prüfung **jetzt** das Original-NVM lesen (CRC8/CRC16, 64 Wörter), Sicherung mit 48-Bit-UID exportieren, Änderungsliste prüfen und mit Chip-UID sowie «PROGRAMMIEREN» permanent schreiben. Danach neu starten und das NVM nochmals kontrollieren.

Die Navigation sperrt Schritte, deren Voraussetzungen noch nicht erfüllt sind. Änderungen an Einheit, Bereich, Gains oder Polynomordnung machen abhängige Berechnungs- und Prüfzustände ungültig.

## Start

**Windows:** `STARTEN_Windows.bat` starten.  
**macOS:** `STARTEN_macOS.command` starten.  

Python 3 wird für den lokalen Webserver benötigt. Danach `http://localhost:8765` in Chrome öffnen. USB-Port bei der ersten Verwendung über den Browserdialog freigeben. Alternativ kann die App über **HTTPS** bereitgestellt werden. Der Web-Serial-Zugriff ist über `file://` nicht zuverlässig verfügbar.

## Windows: USB-Port lässt sich nicht öffnen

Falls Chrome nach der Portauswahl **„Failed to execute 'open' on 'SerialPort': Failed to open serial port“** meldet, war die Portauswahl erfolgreich, aber Windows konnte den Port nicht öffnen. Das ist **noch kein 1-Wire- oder E703.11-Protokollfehler**.

1. **PSSC-GUI vollständig beenden.** Auch Terminals, serielle Monitore und andere Chrome-Tabs schliessen, die denselben COM-Port verwenden könnten.
2. Windows **Gerätemanager → Anschlüsse (COM & LPT)** öffnen. Das SSP3 sollte als **USB Serial Port (COMx)** ohne Warnsymbol erscheinen. Falls nur „USB Serial Converter“ ohne COM-Port angezeigt wird, die FTDI-VCP-Einrichtung prüfen.
3. USB-Kabel kurz trennen, wieder anschliessen und zunächst **Bekannten Port verbinden** testen. Bei mehreren oder veralteten freigegebenen Ports den korrekten Anschluss über **USB-Port auswählen** neu wählen.
4. Falls der COM-Port fehlt oder fehlerhaft angezeigt wird, den offiziellen [FTDI-VCP-Treiber](https://ftdichip.com/drivers/vcp-drivers/) prüfen. Treiberinstallation benötigt möglicherweise Administratorrechte.
5. Erst wenn der COM-Port geöffnet werden kann, die SSP3-Firmwareabfrage und danach 1-Wire/I²C prüfen. Die angezeigte Baudrate ist normalerweise **nicht** die Ursache für ein fehlgeschlagenes `open()`.

Bei diesem Fehler **keine RAM- oder NVM-Schreibversuche starten**. Falls er bleibt, zusammen mit der genauen COM-Port-Anzeige den Inhalt des technischen Logs teilen.

## Sicherheitsregeln

- Beim ersten Hardwaretest nur **lesen**.
- Keine EEPROM-/NVM-Programmierung vor eigenständiger Prüfung an einem entbehrlichen Testchip.
- Die App ändert keine Boot-/Schnittstellenregister; sie kann nicht ausschliessen, dass ein Stromausfall, ein Protokollfehler oder eine bereits fehlerhafte NVM-Konfiguration den Kommunikationszugang beschädigt.
- Hersteller-DLLs, Manuals und proprietäre Entwicklungsdateien sind **nicht** Bestandteil dieses Repositorys.

Weitere Details stehen in [ANLEITUNG.md](ANLEITUNG.md) und [TESTBERICHT.md](TESTBERICHT.md).

## Tests

```bash
node --check app.js
node --check calibration.js
node test_math.js
```

Die numerische Koeffizientenberechnung ist eine unabhängige JavaScript-Implementierung und wurde noch nicht auf vollständige Gleichwertigkeit mit der originalen Elmos-Kalibrierbibliothek geprüft.

## Lizenz

Es wurde noch keine Lizenz festgelegt. Ein öffentlich sichtbares Repository bedeutet nicht automatisch, dass der Code unter einer Open-Source-Lizenz steht.

**Hinweis:** ELMOS und genannte Produktnamen sind Marken ihrer jeweiligen Inhaber. Dieses Projekt ist keine offizielle Elmos-Anwendung.
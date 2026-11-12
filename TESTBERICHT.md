# Testbericht – ELMOS E703.11 Web-Kalibrierassistent

**Stand: Version v0.6.11 · 12. November 2026 · Laborprototyp, keine Hardware- oder Produktionsfreigabe**

Dieser Bericht trennt den **im Code beziehungsweise mit simulierten Chipantworten geprüften Stand** von noch offenen Hardwareprüfungen. Ältere, überholte UI-Varianten und frühere Bestätigungswörter werden hier bewusst nicht als aktuelle Funktion beschrieben.

**[Web-App](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[README](README.md)** · **[Bedienungsanleitung](ANLEITUNG.md)** · **[Ausgang und 1-Wire](AUSGANG_1WIRE.md)** · **[Config & EEPROM Viewer](CONFIG_DATEIEN.md)**

## Zusammenfassung

| Teilbereich | Software-/Simulationstest | Echte E703.11-Hardware |
| --- | --- | --- |
| JavaScript, initialisierte UI-Elemente, Buttons | Geprüft | Bedienung am realen SSP3 weiter prüfen |
| USB-Portöffnung / FTDI | Browsererkennung und isolierte Diagnoseseite vorhanden | Abhängig von Chrome, FTDI-Treiber und Gerät |
| Live-ADC / DSP / obere Statusleiste | UI und Simulation geprüft | Datenrate und Langzeitstabilität prüfen |
| AFE-PGA1, Offset, PGA2 mit **sofortiger RAM-Übernahme** | Simulierte Registerschreib- und Rücklesetests erfolgreich | Registerwerte und ADC-Hub praktisch bestätigen |
| 2–10 Kalibrierpunkte / 1–100 Samples | UI und Stichproben mit 1, 3 und 6 Samples geprüft | ADC-Streuung und Timing prüfen |
| Polynomfit / DSP-Zielspanne | Mathematische Regression und Grenzen simuliert | Mit Originalsoftware und Referenzdruck vergleichen |
| DSP-RAM-Schreiben und Prüfpunkte | Simulierte Register- und Freigabelogik geprüft | Vollständige Druck-/Temperaturprüfung fehlt |
| NVM-Sicherungs-/Programmierungsplan | CRC, Änderungslisten, UID und Schreibsequenzen simuliert | **Permanentes NVM-Schreiben nicht hardwarefreigegeben** |
| AODO analog / PWM / FM | Modus-/Grenzprüfungen und S0/S1-Q3.12-Skalierung simuliert | Physische Ausgangssignale messen |
| «One Wire only» | Nur bereits permanentes PLC im Original-NVM akzeptiert; keine Bootregisteränderungen | Kaltstart und One-Wire-Kommunikation am Testchip prüfen |
| Kontextbezogener Expertenmodus | Zusatzeinstellungen erscheinen direkt in AFE, Ausgang und EEPROM Viewer; kein Popup | Bedienung mit realem Sensor prüfen |
| EEPROM Viewer | Eigener Reiter, 64 Zeilen, Suchfeld, Hex/Dezimalwerte und Schutzanzeige; bestehender CRC-geprüfter Lesepfad | Vollständiges EEPROM am Testchip lesen und mit PSSC vergleichen; angezeigte Werte müssen zur aktuell verbundenen UID gehören |\n| Config-Vorlagen | Strikte JSON-Prüfung, Datei mit nur AFE/DSP/Mess-/Ausgangsparametern; staged AFE-RAM-Anwendung nach Benutzerklick | Import, AFE-Rücklesung und neue Sensor-Kalibrierung praktisch prüfen |
| Chip-UID / Backup / Wiederherstellung | UID-Zuordnung, CRC und Restore-Plan simuliert | Echter Restore auf Testchip fehlt |

## Aktuelle Oberfläche und Bedienung

- **Sieben Schritte:** Verbindung → AFE → Messpunkte → Koeffizienten/RAM → DSP-Verifikation → **Ausgang konfigurieren** → NVM.
- **Live-Leiste:** ADC_S, ADC_T, DSP_S, umgerechneter Sensorwert und Status über alle Schritte; keine zusätzlichen Schreibbefehle für diese Anzeige.
- **AFE:** diskrete Tasten in der Reihenfolge **PGA1 → Offset → PGA2**. Angezeigt werden ausschliesslich Verstärkungen beziehungsweise mV/V, keine Stufennummern. Jeder Klick löst unmittelbar eine **AFE-RAM-Änderung mit Rücklesung** aus; gleichzeitige Schreibaktionen werden blockiert.
- **Grenzen:** PGA1 0–3, Offset −8 bis +8, PGA2 0–8. Die ±-Tasten werden an den Grenzen und während Schreibvorgängen gesperrt.
- **Fehlerbehandlung:** Bei verweigertem RAM-Zugriff bleibt der bisher bestätigte AFE-Zustand erhalten. Bei unklarem tatsächlichem Schreibstatus werden vorhandene Kalibrierpunkte vorsorglich verworfen.
- **Einstellungen:** Zahnrad oben rechts; der Expertenmodus blendet Zusatzeinstellungen im jeweiligen Reiter ein. Die Hauptoberfläche bleibt ohne Expertenmodus kompakt.
- **EEPROM Viewer:** Als eigener Reiter neben den sieben Kalibrierschritten jederzeit erreichbar; Tabelle nur lesbar.\n- **Config-Vorlagen:** Datei in «USB & Chip» speichern/laden; selektiv gewählte Gruppen speichern und enthaltene AFE-Werte beim Import geschützt ins RAM übertragen und durch Rücklesung bestätigen, ohne einem weiteren Klick übertragen.
- **NVM:** Nach bestandener DSP-Prüfung kann **«NVM lesen & Änderungen prüfen»** ohne vorgängig erstelltes Backup ausgeführt werden. Nach gültiger automatisch eingetragener, weiterhin editierbarer **48-Bit-UID** wird der Schreibknopf freigegeben. **Kein zusätzliches Bestätigungswort**.
- **Optionale Sicherung:** Vor dem finalen Schreiben kann das alte NVM unter der Chip-UID archiviert und als JSON heruntergeladen werden. Ist diese Option deaktiviert, bleibt die vollständige CRC-Sicherheitslesung erforderlich.

## Bisherige Softwaretests

1. **Kalibrierplanung:** Anzahl 2–10; End- und Zwischenpunkte; eigene Messpunktnamen; Freigabe erst bei vollständiger Aufnahme mit konsistenten AFE-Gains.
2. **Sample-Aufnahme:** Ein, drei und sechs Samples an End-/Zwischenpunkten; Median und Streuung, Ergebnisfelder sowie das Zurücksetzen beim Löschen geprüft.
3. **Koeffizienten:** Numerische Fittertests, zulässige DSP-Zielspanne bis ±32’000, feste Punktanzahl, CRC16- und AODO-Mapping. Der Fit ist **kein Nachweis der Gleichwertigkeit mit der Elmos-DLL**.
4. **AFE-RAM:** Simulierte SSP3-Registerantworten mit drei Einzelklicks und drei Schreib-/Rücklesevorgängen. Fehlerpfad bei verweigertem RAM-Zugriff geprüft.
5. **DSP-Prüfung:** Status- und Sperrlogik für 1–10 wählbare Prüfpunkte; ohne bestandene Verifikation bleibt die normale NVM-Programmierung gesperrt.
6. **NVM-Plan:** Vollständiges 64-Wort-Abbild, Factory-CRC8, CRC16, Schutzvergleiche und veränderte Wortadressen geprüft. Simulierter Schreibvorgang nur für erlaubte Felder und CRC.
7. **Backups:** Bestätigte Chip-UID (`VERSION + SER1 + SER0`), Zuordnung zu lokal gespeicherten Versionen, Import-/Vergleichsprüfung und Factory-/Bootschutz beim Restore.
8. **NVM mit/ohne Backup:** Beide Varianten wurden in einer simulierten Umgebung durchlaufen; das alte NVM wird nur bei aktivierter Sicherung archiviert.
9. **AODO-Ausgang:** Ratiometrische/PWM-Mappings und Q3.12-Skalierung für S0/S1 geprüft; High-Z und Alarm dürfen wegen der 1-Wire-Startregel nicht ins NVM programmiert werden.
10. **One Wire only:** Permanenter PLC-Modus wird aus dem Original-NVM erkannt und ohne Änderung der Kommunikationsregister bestätigt; ein kurzes PLC-Startfenster genügt nicht.
11. **Datenblatt-Startschutz:** Prüfung von AODO-Modus 1–5, PLC-Dauerbetrieb oder Startfenster, Downstream, Upstream und persistentem Registerzugriff.
12. **Expertenmodus:** Ab v0.4.0 kontextbezogen im passenden Reiter, nicht als separates Fenster.
13. **EEPROM Viewer:** Zusätzlicher, unabhängig erreichbarer Reiter mit Lese-/Exportknopf, vollständiger NVM-Tabelle und Suchfeld.\n14. **Config-Vorlagen:** Import/Export ausschliesslich chipunabhängiger Zielparameter; keine UID, keine NVM-Wörter, keine Fit-Koeffizienten. Erst ein expliziter AFE-RAM-Knopf löst einen echten Chip-Schreibvorgang aus.

Die Tests waren **Simulationen oder lokale JavaScript-Prüfungen**. Das Repository enthält inzwischen automatisierte Node-Regressionstests unter `tests/safety.test.cjs`, startbar mit `node --test tests/safety.test.cjs`. Der Code selbst wird ohne Buildprozess direkt durch GitHub Pages ausgeliefert. Die Tests ersetzen keine echte Hardwareprüfung.

Die automatisierten Software-Regressionstests umfassen in **v0.6.0 insgesamt 49 Fälle**. Zusätzlich wurden vorhandene HTML-IDs, die Referenzen aus den JavaScript-Dateien und einheitliche Browser-Skriptversionen geprüft. Ein vollwertiger Browser-End-to-End-Test und reale Sensorhardware stehen weiterhin aus. Die neue Datei-API, das Speichern im Browser und echte SSP3-EEPROM-Lesungen wurden noch nicht mit angeschlossenem Sensor als vollständige End-to-End-Kette verifiziert.

Zusätzlicher Regressionstest ab v0.4.1: Wenn SSP3 bereits auf Befehle antwortet, die Chipprüfung aber scheitert, darf der automatische USB-Neuaufbau nur **einmal** stattfinden; danach muss die Diagnose stehen bleiben. Der reale Fehlerfall am SSP3 ist noch nicht hardwaregetestet.

Weitere Regressionstests ab v0.4.2 prüfen die Beschreibung aller 64 EEPROM-Wörter, getrennte Adressräume, Q3.12/Q0.15-Interpretation, dokumentierte Bitfelder und den nur lesenden Detailaufbau. Die technische Erklärung nicht aufgeschlüsselter Felder bleibt bewusst generisch; ihre genaue Funktion ist nicht hardwarevalidiert.

Ab v0.5.0 prüfen drei zusätzliche Regressionstests die opt-in-Konfiguration, die Rückkehr zur unveränderten normalen Navigation und die Verwendung der bestehenden Bedien- und NVM-Sicherheitslogik im One-Pager. Ein vollwertiger Browser-Test für Layout-Höhen, Bedienbarkeit und die DOM-Umschaltung am angeschlossenen SSP3 ist weiterhin erforderlich. Auf kleineren Viewports kann innerhalb einzelner Kompaktkarten Scrollen notwendig sein.

**Beta-Status:** 10 weitere Tests prüfen die Druck×Temperatur-Matrix (2×1, 2×3, 3×2, 5×2, ungültige Kombinationen), die Wiederverwendung der originalen Hardware- und NVM-Bedienelemente sowie die fail-closed USB-Bridge. Für echte Browser-/Hardwaretests stehen weiterhin SSP3 und ein entbehrlicher E703.11-Testchip aus. Die Microcontroller-Firmware ist zunächst nur USB-CDC-Prototyp ohne PLC.

**v0.6.0:** Nach dem Entfernen des Demo-Modus prüfen zusätzliche Tests die ausschliesslich echte Chipfreigabe für den Wizard, die AFE-Livedarstellung mit unverändertem ADC-Canvas, die Min-/Max-/Hub-Statistik und die grosse DSP-Signalansicht. Rein synthetische Fit-Daten dienen weiterhin nur der mathematischen Regression, nicht der Simulation einer Chipverbindung.

**Config v2:** 64 Softwaretests decken vollständige Config-Exporte, Auswahl der enthaltenen Gruppen beim Import, rückwärtskompatible partielle JSON-Dateien, verständliche Dateinamen mit nur bestätigten Druck-/Temperaturangaben sowie den geschützten AFE-RAM-Import ab. Ein vollständiger Hardwaretest mit E703.11 bleibt erforderlich.

**v0.6.11 Chipdiagnose:** 64 Softwaretests prüfen zusätzlich, dass bei wiederholt fehlgeschlagenem SSP3-Chipzugriff nur Register gelesen werden, die Antworten inklusive CRC8-Byte angezeigt/exportiert werden und die Bit-11-Schreibsperre unverändert bleibt. Die CRC8-Bytezuordnung der SSP3-Ausgabe ist **noch nicht anhand eines physischen Referenzfalls verifiziert**; dieser Test wird ausdrücklich nicht als CRC8-Verifikation bezeichnet.

## Offene Prüfungen vor produktivem Einsatz

- **Original PSSC-GUI vergleichen:** Gleiche Referenzdrücke, Temperaturpunkte, Koeffizienten und DSP-Ausgabe mit der Herstellerlösung vergleichen.
- **AFE am Sensor:** Alle PGA-/Offsetstufen durchgehen, echte ADC-Werte prüfen, Nebenwirkungen und Fehler bei Verbindungsabbrüchen testen.
- **Messqualität:** Sample-Zeiten, Streuungsgrenzen, verschiedene Druckbereiche und Temperaturkompensation am Prüfstand validieren.
- **NVM-Hardwaretest:** Backup vor dem Schreiben kontrollieren, nur an einem **entbehrlichen Testchip** programmieren, jedes Wort und CRC zurücklesen, Versorgung tatsächlich neu starten und erneut prüfen.
- **AODO-Ausgänge:** Spannung, PWM-Tastgrad/Frequenz sowie FM-/Alarmverhalten elektrisch messen.
- **Wiederherstellung:** Verhalten bei beschädigter Konfiguration, falscher UID, abweichenden Bootregistern und Stromunterbruch testen.
- **UI-Feedback:** Bedienbarkeit für neue Anwender, kompakte Anordnung, verständliche Fehlermeldungen und Schritte des Kalibrierablaufs von erfahrenen Anwendern beurteilen lassen.

## Sicherheitsstatus

**Keine Produktionsfreigabe.** Eine bestandene Simulation sagt nichts über einen unterbrochenen realen NVM-Schreibvorgang aus. Factory-Kalibrierung und Kommunikations-/Bootregister bleiben geschützt. Für dokumentierte AODO-Optionen bestehen gesonderte, begrenzte Änderungen. Eine Wiederherstellung wird nicht automatisch ausgelöst.

**Nur webbasiert:** Die Web-App und die USB-Diagnoseseite laufen im Browser. Die Node-Tests sind ausschliesslich für Entwickler und für die Auslieferung nicht erforderlich; es gibt keine lokale Desktop-Startanwendung.


### SSP3-Startfenster-Recovery (v0.6.12, 12.11.2026)

Der automatische USB-Neuaufbau wurde durch einen manuell ausgelösten, zeitlich und in der Anzahl begrenzten PLC-Lesetest ersetzt. Dieser hält die USB-Verbindung offen und erwartet einen **separaten** Sensor-VDD-Neustart, während die Abfragen laufen. Die Software enthält keine unbestätigten SSP3-Power-Control-Kommandos und keine Register-Schreibvorgänge in diesem Pfad. Browser- und Code-Regressionen sind prüfbar; der vollständige elektrische SSP3-Kaltstart mit 4/200 ms und die Hersteller-PLC-Referenzantwort wurden **nicht an Hardware validiert**. Ein Fehlschlag muss anhand eines seriellen SSP3-Traces bewertet werden.


### Hardwarebefund v0.6.13 (12.11.2026)

Bei 4-ms- und 200-ms-Startfenster und analogem Ausgang ist das Gerät weiterhin über die **Originalsoftware Elmos PSSC ohne manuellen Neuanschluss** erreichbar. Die Web-App bekommt nach einem formal plausiblen PLC-Lese-Telegramm vom SSP3 nur `!PLC nothing received`. Der neue Export liefert einen Web-App-TX/RX-Trace, **aber keinen Trace der Originalsoftware**. Die genaue originale SSP3-Power-/Freigabe-/Schnittstellensequenz bleibt offen. Keine ungesicherten Start- oder NVM-Befehle wurden ergänzt.


### v0.6.14: Magic-Cookie-Test

Software-Regression für PLC-Schreibtelegramme anhand des Elmos-E703.11-Datenblattbeispiels `02 6C 6A 0A 67 89 5F`. Die spezielle Cookie-Sequenz wird nach ausdrücklicher Bestätigung im Diagnoseteil als einzelne beabsichtigte Aktion ausgeführt. Das Ergebnis gilt nur bei anschliessendem erfolgreichen E703.11-Lesetest als bestätigt. **Noch keine reale Hardwarebestätigung.** Die Web-App kann den Sensor ohne dokumentiertes SSP3-Power-Kommando nicht synchronisiert neu starten.

## SSP3-Sensorstart nach Elmos AN 0204 (v0.6.15, 12.11.2026)

Der Anwender hat die Hersteller-Application-Note AN 0204 bereitgestellt, die erstmals die zuvor unbekannten SSP3-DUT-Power-Befehle dokumentiert. Nach einer expliziten Bestätigung am isolierten Prüfplatz kann die Web-App folgenden **einmaligen Test** über schaltbare SSP3-VSUPPLY durchführen:

`IF_CFG 7 0 0` → `Power_OFF 03E8` (1000 mV Abschaltschwelle) → 30 ms Ruhe → `PLC P` (Cookie vorbereiten) → `PWR_ON 0C80 00C8 0` (Herstellerbeispiel 3200 mV, 200 µs, Einzelsocket) → unmittelbar `PLC T` → bestehende Chipregister-/ADC-Erkennung.

**Achtung:** Der Abschaltbefehl heisst laut Seite 7 **`Power_OFF`**, während der Einschaltbefehl **`PWR_ON`** heisst. Bei Fehlschlag nach einem begonnenen Ausschalten versucht die App dokumentiertes `PWR_ON 0 0 0` zur Wiederherstellung. Im Log stehen die Antworten und Laufzeiten jeder Stufe.

Aufruf: **USB & Chip → SSP3-Verbindungsdiagnose → Neu · SSP3-Sensorstart (AN 0204, Prüfplatz)**. Alternativ gibt es eine einmalige Opt-in-Option beim nächsten Connect **vor dem ersten Registerlesen**. Die Originalsoftware-Sequenz ist mangels Mitschnitt weiterhin nicht 1:1 belegt; insbesondere ein 4-ms-Startfenster ist durch Browser-/USB-Latenzen nicht garantiert. Nur bei über SSP3-VSUPPLY versorgtem Prüfsensor verwenden; externes VDD wird eventuell nicht geschaltet. Keine NVM-Programmierung, aber temporäre Überlagerung des analogen AODO-Ausgangs ist möglich.

**Hardwarestatus:** Herstellerbefehle dokumentiert, aber 4-ms-Timing und tatsächliche SSP3-Hardwarefunktion noch nicht validiert.


### SSP3-Firmwareabweichung in v0.6.16

Im realen USB-Log vom 12.11.2026 12:17 Uhr wird `Power_OFF 03E8` nach 29 ms mit `!ERROR: Unknown command (POWER_OFF)` zurückgewiesen; `PWR_ON 0 0 0` wird danach in 16 ms akzeptiert. Ein Ausschalten des E703.11 ist **nicht belegt**. `PLC P` und `PLC T` wurden in diesem Versuch nicht erreicht. Gegenprobe: Die neu implementierte reine `?`-Firmwarehilfe und das Stoppen vor einem nicht beworbenen `PWR_OFF` sind softwareseitig prüfbar. Eine reale Bestätigung des alternativen `PWR_OFF` und des One-Wire-Starts steht aus.

## Experimenteller PLC-Syntaxvergleich für SSP3-Firmware v02.08.02.04 (v0.6.17, 12.11.2026)

Das reale SSP3-Log belegt einen bestätigten Host-Handshake für `PWR_OFF 03E8` (15 ms), `PLC P` (18 ms), `PWR_ON 0C80 00C8 0` (15 ms) und `PLC T` (16 ms). **Ein Chipregister konnte danach noch nicht gelesen werden.** Der Schluss, die Stromversorgung sei elektrisch tatsächlich ein- und ausgeschaltet worden, ist allein aus der Hostbestätigung nicht beweisbar. Die aktuelle Originalsoftware-PLC-Startsequenz ist weiterhin nicht mitgeschnitten.

Neu ist ein konkreter möglicher Syntaxunterschied: **Elmos AN 0204** dokumentiert `PLC 026D1C0C.` als zusammenhängendes Hostargument, die vom vorhandenen SSP3 selbst ausgegebene `?`-Hilfe nennt dagegen `PLC <slave_id> <data>`. Deshalb bietet **USB & Chip → SSP3-Sensorstart → PLC-Befehlsformat** die beiden Testvarianten:

- **AN0204 / Legacy (Standard):** `PLC 026D1C0C.`
- **SSP3-Firmwarehilfe / Slave-ID separat:** `PLC 02 6D1C0C.`

Die jeweils gewählte Hostformatierung wird nach dem ausdrücklich freigegebenen, einmaligen Versorgungstest auf die **erste reine Registerabfrage** angewendet. Erhält die App gültige Registerdaten, wird das Format für die restliche Sitzung beibehalten; auch spätere PLC-Schreibtelegramme werden dann entsprechend formatiert, aber erst nach unveränderten NVM-/RAM-Sicherheitsprüfungen. Die One-Wire-Chipdaten und CRC-Felder werden **nicht** geändert, nur das Leerzeichen im SSP3-ASCII-Kommando. Keine NVM-Programmierung beim Test. Der Vergleich klärt eine echte Firmwareabweichung, garantiert aber keine Freigabe bei 4-ms-Startfenster. Pro Durchlauf nur **eine** Variante versuchen und anschliessend das JSON-Log exportieren.

### v0.6.20 – SSP3-ASCII-Format korrigiert

Live-Hardwaremeldung beim v0.6.19-Verbindungsversuch: `#PLC 02 6D1C0C. !PLC frame contains invalid data ( ) !PLC nothing received`. Das zeigt einen vom SSP3 zurückgewiesenen ASCII-Telegrammaufbau. Im neuen Code ist für die bekannte Firmware nur noch das ursprüngliche `PLC 026D1C0C.` erlaubt. Der Power-Start wird automatisch auf SSP3/OneWire beschränkt, nicht auf I²C/SPI oder ESP32. **Ein erfolgreicher neuer SSP3-Hardwaretest wurde noch nicht durchgeführt; die Softwaretests ersetzen ihn nicht.**

### v0.6.21 – schneller SSP3-PLC-Start bei 4-ms-Fenster (12.11.2026)

Das bisherige Hostprotokoll wartete zwischen `PWR_ON 0C80 00C8 0` und `PLC T` auf eine komplette USB-Antwort. Frühere reale Logs zeigten dabei rund **15 ms**, was das beim E703.11 auf **4 ms** programmierte Startfenster bereits überschreitet. Die Elmos AN 0204 §2.3.4 dokumentiert, dass `PLC P` den Cookie-Frame vorbereitet und `PLC T` den Puffer überträgt. Das Datenblatt 25DS0170E.04 §6.4.5.8 verlangt, dass die Cookie-Sequenz vollständig während des Startfensters übertragen wird.

Für den **normalen SSP3 + 1-Wire**-Verbindungsaufbau bleibt daher die dokumentierte Reihenfolge `IF_CFG 7 0 0`, `PWR_OFF 03E8`, `PLC P` erhalten. Neu werden `PWR_ON 0C80 00C8 0\rPLC T\r` **ohne USB-Antwort-Wartezeit in einer einzigen seriellen Schreiboperation** an die SSP3-Firmware übermittelt. Die Software erwartet anschliessend **zwei getrennte Firmware-Prompts**, prüft die Quittung beider Kommandos und liest erst danach die E703.11-Register. Bei Fehlern wird die bisherige Strom-Wiederherstellungsroutine angewendet. Es werden **keine NVM-Werte verändert** und keine undokumentierten Sensorbefehle gesendet.

**Hardwarevorbehalt:** Die SSP3-Firmware muss mehrere CR-getrennte Befehle in einer USB-Schreiboperation korrekt puffern und verarbeiten; dies ist aus AN 0204 nicht ausdrücklich garantiert. Ein erfolgreicher Hardwaretest steht noch aus. Auch mit schnellerem Hostversand kann insbesondere bei 4 ms das zeitliche Verhalten der SSP3-Firmware oder die PLC-Bitrate weiterhin einen Zugriff verhindern. Dann sind die tatsächlichen SSP3-Antworten auszuwerten und nötigenfalls die PLC_CFG-Einstellungen beziehungsweise ein Original-PSSC-Trace zu vergleichen.

### v0.6.22 – SSP3-Power-Start: einzelne serielle Befehle ohne Wartepause (12.11.2026)

Der reale SSP3 mit Firmware `02.08.02.04` hat den v0.6.21-Versuch `PWR_ON 0C80 00C8 0\rPLC T\r` in einem einzelnen Web-Serial-Write nicht mit beiden Prompts beantwortet. Ein kombinierter USB-Write ist damit **nicht als unterstützt bestätigt**. In v0.6.22 werden die beiden CR-terminierten SSP3-Kommandos als **zwei separate `writer.write()`-Aufrufe** in derselben seriellen Writer-Sitzung übertragen, aber ohne zwischenzeitliches Warten auf die `PWR_ON`-Antwort. Erst danach werden zwei SSP3-Prompts sowie die Echozeilen `#PWR_ON` und `#PLC T` überprüft. Die Übertragungsdauer der beiden Writes wird gemessen.

Bei einem Timeout wird die **tatsächlich bis dahin empfangene Teilantwort**, die Zahl der Prompts und gegebenenfalls ein Schreibfehler im Feld `powerCycle` des exportierten JSON-Logs gesichert. Aus einem einzigen Prompt darf die App nicht auf eine erfolgreiche PLC-Freigabe schliessen. Die bestehende VSUPPLY-Wiederherstellung nach Fehlschlag bleibt bestehen. Kein NVM-Schreiben, keine Änderung von `CFG_PADS0.startup_plc` oder der geschützten Interface-Konfiguration.

**Einschränkung:** Auch zwei unmittelbar aufeinanderfolgende Web-Serial-Schreibaufrufe können für ein 4-ms-Startfenster zu langsam sein, je nach Betriebssystem und SSP3-Firmware. Ein tatsächlicher Zeitnachweis ist erst mit dem SSP3-Hardwaretest möglich. Bleibt die Übertragung unzuverlässig, ist eine adapterseitige Sequenzierung oder ein Original-PSSC-Protokollvergleich erforderlich, statt weitere blinde Timing-Versuche zu senden.

### v0.6.23 – SSP3-Antwortparser akzeptiert verkettete Prompt-/Echo-Fragmente (12.11.2026)

**Echter SSP3-Hardwarebefund mit v0.6.22:** Zwei getrennte Web-Serial-Schreibaufrufe für `PWR_ON 0C80 00C8 0` und `PLC T` wurden beide vom SSP3 quittiert. Der empfangene Text enthält jedoch `#PWR_ON 0c80 00c8 0000 :#PLC T :` – die Firmware schreibt den Doppelpunkt-Prompt direkt vor das nächste Kommandoecho, ohne zwingend einen zusätzlichen Zeilenumbruch. Der bisherige `ssp3PromptCount()` zählte nur einen Doppelpunkt auf einer eigenen Zeile und lieferte deshalb falsch **1/2**; auch die Echo-Prüfung für `#PLC T` war zu streng.

In v0.6.23 erkennt der Parser `:` vor dem folgenden `#`-Kommandoecho oder am Antwortende auch ohne CR/LF. `PWR_ON` und `PLC T` werden getrennt als Echo nach Start/Prompt-Grenze verifiziert, ohne auf einen Zeilenbeginn beschränkt zu sein. Der Sender bleibt identisch: zwei serielle Writes direkt nacheinander, dann zwei SSP3-Quittungen auswerten und erst danach echte E703.11-Register lesen. Keine Änderung an Versorgungskommandos, PLC-Telegramm, Konfigurationsmemory/NVM oder Bootstartfenster.

**Noch nicht bewiesen:** Dass der E703.11 den PLC-Cookie innerhalb seines konfigurierten Fensters empfangen hat. Die neue Prüfung beseitigt ausschliesslich einen Hostparser-Fehler und lässt den Chipzugriff erstmals nach diesem Burst wieder testen. Hardwareergebnis des nachfolgenden Registerlesens muss separat geprüft werden.

### v0.6.24 – Automatischer Magic-Cookie-Fallback nach SSP3-Start (12.11.2026)

Der echte E703.11 liess sich nach Angaben aus dem Prüfversuch über den separaten Magic-Cookie-Test erreichen, während der normale SSP3-Power-Start mit `PLC P`/`PLC T` und anschliessender Lesung nur `!PLC nothing received` lieferte. Daher wird **bei SSP3 + One Wire automatisch genau einmal** folgender, bereits manuell erprobter Fallback verwendet, **nur wenn der erste PLC-Register-Lesezugriff keine Chipantwort erhält**:

1. Bestehender dokumentierter Power-Start: `PWR_OFF 03E8` → `PLC P` → `PWR_ON 0C80 00C8 0` und `PLC T` schnell hintereinander.
2. Erste reine Register-Lesung. Wenn gültig, ist keine zusätzliche Magic Cookie nötig.
3. Ausschliesslich bei `!PLC nothing received` zwei spezielle CRC-geschützte PLC-Writes: `PLC 026CAC0F2B4299` (0xAC→0x2B42) und direkt danach `PLC 026C0E095CFDCA` (0x0E→0x5CFD).
4. Erneut echten E703.11-Registerzugriff lesen und erst dann die Verbindung/Chip-UID als erfolgreich markieren.

Die zwei Schreibtelegramme sind nach E703.11-Datenblatt §6.4.5.7 eine **flüchtige RAM-/One-Wire-Freigabe**, keine NVM- oder Factory-Programmierung. Jeder Schritt und die tatsächliche Leseantwort werden im SSP3-JSON-Protokoll erfasst. Bei Zeitüberschreitung, anderer Chip-Fehlermeldung oder ungültigen AFE-Daten erfolgt **kein** stillschweigender Wiederholungsversuch und kein NVM-Schreiben. Der normale Kalibrierweg und die geschützten Startregister in NVM 17, 18 und 19 bleiben unverändert. Bei einem erfolgreichen Fallback wird die SSP3-Power-Startverifikation auf die aktuelle UID bezogen, damit der vorhandene NVM-Schutz weiter funktioniert.

**Hardwarevorbehalt:** Ob dieser Fallback automatisch funktioniert, ist noch nicht bestätigt. Bei sehr kurzen NVM-Startfenstern kann das zusätzliche Senden nach einem ersten fehlgeschlagenen Lesen bereits zu spät sein. Der Befund des manuellen Tests macht diesen Versuch aber gegenüber weiteren undokumentierten SSP3-Kommandos sinnvoll.

### v0.6.25 – Live-ADC nach Magic-Cookie-Erkennung stabilisiert (12.11.2026)

Der Nutzer bestätigt, dass sich der Chip mit dem automatischen SSP3-Magic-Cookie-Verbindungsablauf von v0.6.24 erkennen lässt, aber anschliessend die Live-Werte fehlen. **Codeanalyse:** Der alte `readADC()`-Pfad fragte zuerst `ADC_TC (0x26)`, dann `ADC_T (0x28)` und erst zuletzt `ADC_S (0x2A)` ab. Wenn ein Temperaturregister keinen PLC-Frame liefert, blieb **auch ADC_S leer**, selbst bei funktionierender Druckkommunikation; nach nur drei Fehlern stoppte die Endlosschleife.

**Änderungen:** Die Chiperkennung liest AFE und ADC_S, übernimmt den bereits bestätigten Druck-Rohwert sofort in die Anzeige und versucht weitere Live-Register unabhängig. Der **Live-Pfad** liest ADC_S als Erstes und behandelt fehlende ADC_T-/ADC_TC-/DSP_S-Antworten einzeln; nicht gelesene Werte werden als nicht verfügbar markiert, nie erfunden. Der **strenge Kalibrierpfad** behält die vollständige Messpunktaufnahme von ADC_S, ADC_T und ADC_TC und die bestehenden Schreiben-/NVM-Sicherheitsprüfungen. Die kontinuierliche Live-Schleife beginnt beim automatischen SSP3-Start erst, nachdem die Magic-Cookie-/Power-Start-Verifikation beendet ist. Vorübergehende ADC_S-Ausfälle werden mit begrenzter Wiederholung (bis 10 aufeinanderfolgende Fehler, danach Stop mit klarer Fehlermeldung) behandelt, ohne zusätzliche Power-Cycles oder RAM-/NVM-Schreibbefehle.

Die Änderung behebt die UI- und Abbruchabhängigkeit vom Temperaturregister. **Ob tatsächlich alle ADC-/DSP-Register über die Hardware erreichbar sind, ist noch nicht bestätigt**; wenn gerade ADC_S selbst nicht antwortet, liefert die App nun eine gezielte Diagnosemeldung statt stillschweigend leerer Werte.

### v0.6.26 – Kontinuierliche Live-Messung ohne Blockierung durch weitere Sensorregister (12.11.2026)

Nach dem automatischen Magic-Cookie-Start liefert der Sensor beim Seitenaufbau einen initialen Wert, aber gemäss Hardwarefeedback bisher keine laufenden Live-Aktualisierungen. Die bis v0.6.25 verwendete Live-Abfrage versuchte bei jedem Zyklus **ADC_S, ADC_T, ADC_TC und DSP_S nacheinander**; jeder fehlende Registerzugriff konnte einen Timeout auslösen und die nächsten Druckwerte deutlich verzögern. Nach zehn fehlgeschlagenen ADC_S-Lesungen wurde die Live-Schleife vollständig gestoppt.

Die neue `readLiveSample()` liest in **jedem Zyklus zuerst ADC_S (Register 0x2A)** und ruft sofort `updateADC` auf, damit Anzeige, Verlauf und geführter Abgleich regelmässig neue Druckwerte erhalten. Die sekundären Register werden rotierend abgefragt: Zyklus 1 ADC_T (0x28), Zyklus 2 ADC_TC (0x26), Zyklus 3 DSP_S (0x30), Zyklus 4 nur ADC_S. Misslingt ein Sekundärregister, wird **ausschliesslich dieser Wert** als nicht verfügbar protokolliert; ADC_S bleibt unabhängig. Sekundärabfragen sind zeitlich auf 1100 ms begrenzt, ADC_S auf 1600 ms. Zwischen erfolgreichen Zyklen liegen nominell 650 ms plus die tatsächliche SSP3-Kommunikationszeit.

Bei nicht beantworteten ADC_S-Abfragen bleibt die Live-Schleife trotz mehrerer Aussetzer aktiv (erneute Abfrage alle 2 s), **zeigt aber keine erfundenen oder künstlich aktualisierten Messwerte**. Der Status weist auf die fehlenden aktuellen ADC-Daten hin und protokolliert die Anzahl aufeinanderfolgender Leseprobleme. Strenge Kalibrier-Messpunktaufnahmen bleiben wie zuvor auf vollständige Druck-/Temperaturantworten angewiesen; NVM, Startfenster und der bestätigte Magic-Cookie-Verbindungsablauf werden nicht verändert.

**Hardwarevorbehalt:** Bei anhaltendem `!PLC nothing received` auf ADC_S nach dem Startup handelt es sich möglicherweise um eine nicht dauerhaft aktivierte 1-Wire-RAM-Freigabe. Dies kann die Software nicht durch häufigeres Lesen beheben; das neue Verhalten und das USB-Log machen diesen Sachverhalt überprüfbar. Echte Live-Aktualisierung ist erst nach einem erneuten SSP3-Test bestätigt.

### v0.6.27 – RAM-Status der dauerhaften One-Wire-Freigabe prüfen (12.11.2026)

Die Live-Abfrage bleibt wie in v0.6.26 auf einen aktuellen **ADC_S-Wert in jedem Zyklus** fokussiert; Temperatur und DSP werden zeitlich verteilt gelesen. Zusätzlich prüft die App nach dem erfolgreich erkannten E703.11 **einmalig und nur lesend** Register `CFG_SPI_I2C (0x06)`, Bit `plc_en` (Bit 2). Gemäss E703.11-Datenblatt 25DS0170E.04, §6.4.5.8 aktiviert eine vollständig empfangene Magic Cookie dieses flüchtige Bit und öffnet das PLC-Fenster **bis zum nächsten Reset dauerhaft**. Wird nur während des zeitlich begrenzten NVM-Startfensters ein ADC-Wert gelesen, aber `plc_en` bleibt 0, lässt sich der Sensor später nicht zuverlässig weiter abfragen.

Die App speichert im exportierten SSP3-Protokoll `powerCycle.plcConfigRam`, `powerCycle.plcEnabledInRam` und im Fehlerfall `powerCycle.plcConfigReadError`. Sie zeigt bei **explizit gelesenem `plc_en=0`** eine Warnung statt einen uneingeschränkten Erfolg. Falls das Statusregister gar nicht lesbar ist, wird dies gesondert protokolliert und nicht als 0 interpretiert. Diese Prüfung schreibt **keinerlei NVM- oder RAM-Register** und verändert weder den bestätigten Verbindungsablauf noch die Schutzlogik der Kalibrierung.

**Hardwaretest ausstehend:** Nur die reale SSP3-Antwort kann bestätigen, ob eine dauerhaft aktive One-Wire-Schnittstelle vorliegt. Wenn die Verbindung zwar einen Wert, aber kein `plc_en=1` liefert, muss die Cookie-Sequenz **während des Startupfensters vor dem ersten Lesezugriff** zuverlässig im SSP3/Chip ankommen. Wiederholtes Registerlesen oder bloss schnelleres Browser-Polling behebt das nicht.

### v0.6.30 – Magic Cookie verändert CFG_PERIOD und kann die Live-Messung stoppen

Screenshot: `Manuell pausiert`, `ADC 51/51`, `CFG_PERIOD=0x5CFD`, `STATUS=idle`. Das Register CFG_PERIOD liegt bei 0x0E, der zweite dokumentierte Magic-Cookie-Schreibbefehl enthält exakt `(0x0E, 1, 0x5CFD)`; die aktuelle Web-App findet diesen Wert tatsächlich im Sensor-RAM vor. Damit ist der Registerzugriff möglich, während das Messprogramm möglicherweise im idle-Zustand bleibt. Ein Browser-F5 startet die Stromversorgung neu und liefert zunächst einen neuen Messwert.

**Gezielte Korrektur:** Wenn der SSP3-Autostart ausdrücklich die dokumentierte Magic Cookie verwendet hat, der Chip erfolgreich identifiziert wurde und das RAM-Register CFG_PERIOD exakt 0x5CFD enthält, setzt die Web-App **nur im RAM** CFG_PERIOD=0x0001 (kontinuierlich), prüft das Rücklesen von 0x0001 und sendet CMD.start=0x8B93 an Register 0x22. STATUS wird nach dem Start nochmals gelesen. Erfolg und Fehler werden im SSP3-Diagnoseexport sichtbar. Keine NVM-/CM-Programmierung, kein Eingriff in die PLC-Startup-NVM-Wörter; nach Hardware-Neustart kehrt die originale Konfiguration zurück. Die temporäre Live-Betriebsart kann eine höhere Stromaufnahme als periodischer Betrieb verursachen und ist für den aktiven Kalibrierprüfplatz gedacht.

**Bedienhinweis:** Der Screenshot zeigt ausserdem «Manuell pausiert». Die Aufnahme kann über den Button **«Live-Messung starten»** wieder aktiviert werden; eine vom Benutzer gesetzte Pause wird nicht automatisch aufgehoben. Echt-Hardwareprüfung der Korrektur steht noch aus.

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

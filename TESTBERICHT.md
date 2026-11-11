# Testbericht – ELMOS E703.11 Web-Kalibrierassistent

**Stand: 11. November 2026 · Laborprototyp, keine Hardware- oder Produktionsfreigabe**

Dieser Bericht trennt den **im Code beziehungsweise mit simulierten Chipantworten geprüften Stand** von noch offenen Hardwareprüfungen. Ältere, überholte UI-Varianten und frühere Bestätigungswörter werden hier bewusst nicht als aktuelle Funktion beschrieben.

**[Web-App](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/)** · **[README](README.md)** · **[Bedienungsanleitung](ANLEITUNG.md)**

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
| AODO analog / PWM / FM | Modi und Grenzprüfungen simuliert | Physische Ausgangssignale messen |
| Chip-UID / Backup / Wiederherstellung | UID-Zuordnung, CRC und Restore-Plan simuliert | Echter Restore auf Testchip fehlt |

## Aktuelle Oberfläche und Bedienung

- **Sechs Schritte:** Verbindung → AFE → Messpunkte → Koeffizienten/RAM → DSP-Verifikation → NVM.
- **Live-Leiste:** ADC_S, ADC_T, DSP_S, umgerechneter Sensorwert und Status über alle Schritte; keine zusätzlichen Schreibbefehle für diese Anzeige.
- **AFE:** diskrete Tasten in der Reihenfolge **PGA1 → Offset → PGA2**. Angezeigt werden ausschliesslich Verstärkungen beziehungsweise mV/V, keine Stufennummern. Jeder Klick löst unmittelbar eine **AFE-RAM-Änderung mit Rücklesung** aus; gleichzeitige Schreibaktionen werden blockiert.
- **Grenzen:** PGA1 0–3, Offset −8 bis +8, PGA2 0–8. Die ±-Tasten werden an den Grenzen und während Schreibvorgängen gesperrt.
- **Fehlerbehandlung:** Bei verweigertem RAM-Zugriff bleibt der bisher bestätigte AFE-Zustand erhalten. Bei unklarem tatsächlichem Schreibstatus werden vorhandene Kalibrierpunkte vorsorglich verworfen.
- **Einstellungen:** Zahnrad oben rechts; Expertenparameter erscheinen kontextbezogen unter AFE oder NVM.
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
9. **AODO-Ausgang:** Ratiometrische und PWM-NVM-Mappings sowie CRC geprüft; unsichere PWM-Skalierung wird verworfen. FM/Alarm sind noch nicht vollständig an realen Ausgängen bewertet.

Die Tests waren **Simulationen oder lokale JavaScript-Prüfungen**. Nach der Bereinigung ist im Repository **kein separater Node-Teststarter** mehr enthalten. Der Code wird ohne Buildprozess direkt durch GitHub Pages ausgeliefert.

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

**Nur webbasiert:** Das Repository enthält die eigentliche GitHub-Pages-Web-App und die separate browserbasierte USB-Diagnoseseite. Windows-/macOS-Startskripte und ein lokaler Node-Teststarter gehören nicht mehr zum veröffentlichten Stand.

# Geführter Kalibrierassistent – Beta

**Branch:** `feature/guided-calibration-and-usb-bridges`  
**Version:** v0.6.0-beta.2. **Kein Merge nach `main`** und keine Änderung der bestehenden GitHub-Pages-Veröffentlichung.

## Wozu der neue Modus?

Die bisherige Oberfläche ist funktional, aber für neue Benutzer komplex. Der neue Modus erklärt jeden Schritt in der richtigen Reihenfolge. **Alle Hardwareaktionen bleiben in `app.js`**: Die neue UI verschiebt die bereits vorhandenen, mit der Original-Logik verknüpften Eingaben und Schaltflächen in eine separate Assistentenansicht.

Der bisherige siebenstufige Ablauf, der Expertenmodus, der EEPROM-Viewer und der One-Pager bleiben im Code bestehen und sind weiterhin erreichbar.

## Ablauf

1. **SSP3 / Chip verbinden.** Unveränderte Portauswahl und Chipprüfung; die Adapterauswahl ist neu. Erst ein bestätigter E703.11-Chipzugriff führt automatisch in die neue Führung (wenn in Einstellungen gewählt).
2. **Aufgabe wählen.** Neuer Druckabgleich, nur AODO-Ausgang anpassen oder EEPROM/Diagnose in der bisherigen Ansicht.
3. **Messkonzept wählen.** Schnell 2 Druckpunkte ohne Temperaturkompensation, 2 Druckpunkte × 3 Temperaturen oder beliebige kompatible Kombination von 2–5 Druckpunkten und 1–3 Temperaturbedingungen.
4. **Sensor definieren.** Druckbereich, Einheit, echte Temperatur-Sollwerte, Mess-Samples, DSP-Endwert, Versorgungsspannung und gewünschte Ausgangsspannungen S0/S1. Optional bestehende chipunabhängige Config-Datei laden. Keine Sensor-ID/EEPROM-Daten kopieren.
5. **AFE optimieren.** PGA1 → Offset → PGA2, wie bisher direkt im RAM mit Rücklesung. Keine automatische Änderung am NVM.
6. **Messpunkte nacheinander aufnehmen.** Für jede Kombination Druck × Temperatur wird eine Referenzmessung erstellt. Der Assistent zeigt den tatsächlichen Sollwert an und schaltet nach einem erfolgreich aufgenommenen Punkt zum nächsten noch fehlenden Punkt.
7. **DSP berechnen und RAM prüfen.** Die vorhandene JavaScript-Koeffizientenberechnung und der bestehende sichere RAM-Schreibpfad werden weiterverwendet.
8. **Unabhängig verifizieren.** Vor der NVM-Freigabe müssen alle ausgewählten DSP-Prüfpunkte erfolgreich sein.
9. **Ausgang konfigurieren.** AODO-Modus, VDD, S0/S1, One-Wire-Startschutz wie bisher.
10. **NVM erst nach Freigabe schreiben.** Volles Original-NVM lesen, CRC8/CRC16, Boot-/Factory-Schutz und Chip-UID vergleichen, Änderungen prüfen, explizit bestätigen. Kein zusätzliches automatisches Schreiben.

## Beispiele für Messmatrix

| Druckpunkte | Temperaturstufen | Kalibriermessungen | Druckordnung | Temperaturordnung |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 1 | 2 | 1 | 0 |
| 2 | 2 | 4 | 1 | 1 |
| 2 | 3 | 6 | 1 | 2 |
| 3 | 1 | 3 | 2 | 0 |
| 3 | 2 | 6 | 2 | 1 |
| 3 | 3 | 9 | 2 | 2 |
| 4 | 2 | 8 | 3 | 1 |
| 5 | 2 | 10 | 3 | 1 |

Die vorhandene Kalibrier-Engine unterstützt maximal **10 Messpunkte**. Kombinationen mit mehr als 10 werden mit einer verständlichen Meldung abgelehnt. Die gewählte Polynomordnung muss mit Anzahl und Unabhängigkeit der tatsächlichen Messungen übereinstimmen.

**Temperaturbedingung bedeutet Referenztemperatur am realen Sensor.** Eine Einstellung von z. B. 60 °C in der UI verändert nicht die tatsächliche Sensortemperatur. Für eine reale Temperaturkompensation müssen sich auch die gemessenen Temperatur-ADC-Werte ausreichend unterscheiden.

Bei 1 Temperaturstufe wird die bereits vorhandene Temperaturkorrektur im Chip nicht automatisch neu berechnet (`calTOrder=0`). Bei 2 bzw. 3 Temperaturstufen wird standardmässig eine lineare bzw. quadratische Temperaturkorrektur vorbereitet. Im Expertenmodus können niedrigere Ordnungen gewählt werden.

## Config-Datei

Die Config-Vorlage ist **keine Kopie eines kalibrierten Sensors**. Sie enthält lediglich chipunabhängige Einstellungen wie AFE-Verstärkung, Ausgang, Messparameter und DSP-Zielwerte. Ein Import belegt die Originalfelder vor; die Referenzmatrix muss danach geprüft und für den neuen Sensor frisch aufgenommen werden. Das Übernehmen einer Config führt allein **keinen** Hardware-Schreibvorgang aus.

## Bestehende Oberfläche und Sicherheit

- Die neue UI wird allein auf dem Testbranch geladen. Ein Knopf «Klassische Ansicht» stellt alle originalen Elemente an ihren vorherigen Platz zurück.
- Hardware-/USB-Kommandos werden ausschliesslich über den bestehenden `app.js`-Pfad abgewickelt.
- Die neue UI erhält einen **nur lesenden** Status-Adapter `window.ELMOS_GUIDED_API`. Sie kann dadurch eine NVM-Freigabe nicht selber setzen.
- Sie verwendet die originalen Buttons `calApplyRam`, `calVerifyRam`, `expertOutputStage`, `nvmPrepare`, `nvmProgram` mit bestehenden Sperren und Sicherheitsabfragen.
- Nicht alle Kombinationen und Hardwarebedingungen wurden im Browser und am Sensor geprüft. Das Produkt bleibt **Laborprototyp**; keine Produktionsfreigabe.

## Demo ohne Hardware – voller Wizard

Du kannst den **gesamten geführten Ablauf ohne Evaluation Board, USB-Stick oder Sensor** testen. Der Demo-Modus ist ausschliesslich eine UI-/Rechensimulation, **kein Test des E703.11**.

1. Die Beta mit [`scripts/preview.py`](../scripts/preview.py) lokal in Chrome starten (siehe unten). Es muss **kein Board angeschlossen** sein.
2. Oben rechts auf **«◈ Demo-Wizard»** klicken – oder unter «USB & Chip» auf **«Wizard ohne Hardware testen»**. Die App startet einen vorhandenen Simulationsmodus und öffnet den Wizard direkt.
3. Wähle z. B. **2 Druckpunkte × 3 Temperaturstufen** oder **3 Druckpunkte × 2 Temperaturstufen**, lege den Druckbereich und die simulierten Temperaturen fest.
4. AFE mit PGA1, Offset, PGA2 ausprobieren. Kein Register wird beschrieben.
5. Bei jedem Messpunkt setzt der Wizard im Demo-Modus **automatisch** die simulierte Druck-/Temperaturbedingung. Mit dem ursprünglichen Button «Messpunkt aufnehmen» kannst du die Werte virtuell erfassen.
6. «Koeffizienten berechnen» verwendet die reale JavaScript-Rechenfunktion der App, jedoch nur **synthetische ADC-Werte**. Danach **«Demo: RAM-Übernahme simulieren»** drücken.
7. **«Demo: Prüfpunkt ... simulieren»** wiederholt drücken, bis alle virtuellen unabhängigen Prüfpunkte abgearbeitet sind. Der Fortschritt wird angezeigt.
8. Ausgangseinstellungen ansehen. Anschliessend **«Demo: NVM-Abschluss ohne Schreibvorgang simulieren»** drücken. So kannst du den letzten Assistentenschritt ebenfalls durchgehen.
9. Es erscheint ausdrücklich «Demonstration beendet – keine Hardware benötigt». Dabei werden **weder RAM noch NVM/EEPROM eines echten Sensors** beschrieben.

Die echten RAM-/DSP-/NVM-Schreibaktionen sind im Demo-Wizard nicht als solche verwendbar. Für den Test eines wirklichen Abgleichs weiterhin ein SSP3 und einen entbehrlichen Sensor einsetzen. Im Demo-Modus sollte der echte Hardware-NVM-Button gesperrt bleiben.

**Auch der reine Ausgangsworkflow** kann als virtuelle Demonstration ohne vorangegangene Druckkalibrierung durchgespielt werden. Rückkehr zur klassischen Ansicht ist jederzeit möglich.

## Beta lokal testen – sicherster Weg

1. Auf GitHub den Branch `feature/guided-calibration-and-usb-bridges` auswählen.
2. «Code → Download ZIP» benutzen, ZIP entpacken.
3. Im entpackten Ordner ein Terminal öffnen und **`python3 scripts/preview.py`** ausführen (auf Windows je nach Installation **`py scripts/preview.py`**). Dafür sind keine zusätzlichen Python-Pakete nötig.
4. Die angezeigte Adresse **http://localhost:8000/** (oder den im Terminal angegebenen anderen Port) in **Chrome** öffnen. `localhost` gilt für Web Serial als sicherer Kontext.
5. SSP3 anschliessen, Testversion prüfen. Im normalen Betrieb die bestehende GitHub-Pages-Webseite verwenden.
6. Zwischen der neuen Führung und «Klassische Ansicht» wechseln und die gleichen Werte kontrollieren. **NVM vor der Hardwarevalidierung nur am entbehrlichen Testchip.**

GitHub Pages veröffentlicht bei der bisherigen Repository-Konfiguration nicht automatisch einen zweiten Branch als eigene Test-Webseite. Eine sichere Test-URL braucht deshalb ein separates Preview-Deployment oder den lokalen Testserver.

## Noch zu prüfen vor dem Merge

- Der volle Browserablauf unter Chrome mit echter SSP3-USB-Verbindung.
- AFE-RAM-Änderungen und Messpunkt-Invalidierung nach einem Rücksprung.
- Die Druck-/Temperaturmatrix für 2×1, 2×3 und 3×2 mit realen ADC_T-Werten und stabilen Bedingungen.
- Verhalten beim Laden einer Config während eines laufenden Abgleichs.
- Die Ausgabe und alle NVM-Sicherheitsprüfungen mit realen Testchips und Power-Cycle.
- Nutzertests mit unerfahrenen Anwendern, insbesondere Meldungen, Rücksprünge und Fehlerfälle.
- Die eigene USB-Bridge: zunächst nur CDC-Handshaketest, **keine ungeprüfte PLC/NVM-Programmierung**. Siehe [USB-Bridge-Anleitung](USB_BRIDGE_GUIDE.md).

**Erst nach bestandenen Tests** ist ein Merge in `main` sinnvoll. Der Branch wird nicht automatisch gemergt.

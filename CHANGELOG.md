## v0.7.87 – Kompakter Archivordner-Bereich in App-Einstellungen

- Der Speicherort wird jetzt **in einer kompakten Zeile** mit Ordnername, Berechtigungsstatus und **«Ändern»** angezeigt.
- Die zusätzliche Pfadeingabe ist standardmässig unter **«Pfad hinterlegen»** eingeklappt. Sie belegt keinen Platz, solange sie nicht gebraucht wird.
- Wurde bereits ein vollständiger Pfad manuell hinterlegt, erscheint er **direkt unter dem ausgewählten Ordnernamen**, auch wenn die Eingabe zugeklappt ist. Beim Speichern klappt sich der Editor automatisch zu.
- Da die File System Access API weiterhin nur den Ordnernamen freigibt, ist der **vollständige Betriebssystempfad nicht automatisch abrufbar**; eine Pfadangabe wird nur als manuelle, lokal gespeicherte Beschriftung angezeigt und beeinflusst die tatsächliche Archivablage nicht.
- Der bestehende Schreibzugriff, die IndexedDB-Vormerkung, die Sperre während laufenden Messungen und der Archivordner selbst bleiben unverändert.
- Zusätzliche Regressionstests für die zusammengeklappte Ansicht, die sichtbare gespeicherte Pfadbeschriftung, Ordnerwechsel und weiterhin sichere Ordnerfreigaben.

## v0.7.86 – Dekorativen Esc-Hinweis entfernen und Archivpfad optional anzeigen

- Der kleine Hinweis **«Esc»** rechts oben im Einstellungsfenster war ein nicht interaktives Text-Element, das wie ein Button aussah. Er wurde entfernt. Die echte **Escape-Taste** kann das Fenster weiterhin schliessen; ebenso bleibt das automatische Schliessen beim Klick ausserhalb erhalten.
- Unter **Einstellungen → Speicherort für Messungen & Kalibrierungen** wird weiterhin der echte, vom Browser freigegebene Ordnername angezeigt. Zusätzlich gibt es **«Vollständiger Pfad (optional, nur zur Anzeige)»** mit einem Eingabefeld und **«Pfad merken»**.
- Aus Sicherheitsgründen liefert Chrome/Edge über die File System Access API **keinen absoluten Windows-/macOS-Dateipfad** zurück. Ein vollständiger Pfad kann deshalb nur **manuell als unverifizierte Beschriftung** hinterlegt werden. Das UI kennzeichnet ihn ausdrücklich entsprechend.
- Die Zusatzbeschriftung wird lokal in derselben IndexedDB wie die Verzeichnisfreigabe gespeichert und nach einem Reload wieder angezeigt. Sie wird nur für den passenden Ordnernamen wiederhergestellt und bei jeder neuen Ordnerauswahl zurückgesetzt, damit kein veralteter Pfad für einen anderen Ordner angezeigt wird.
- **Kein Einfluss auf die Datenablage:** Messungen, Kalibrierungen, Nachmessungen, JSONL-Rohdaten und PDFs nutzen unverändert den berechtigten DirectoryHandle, niemals die manuelle Beschriftung.
- Zusätzliche Regressionstests decken manuelle Pfade, Wiederherstellung, Zurücksetzen beim Ordnerwechsel, Abbruch und Schutz ohne ausgewählten Ordner ab.

## v0.7.85 – Archivordner für Kalibrierungen, Nachmessungen und Logging in den Einstellungen

- Unter **App-Einstellungen → Speicherort für Messungen & Kalibrierungen** wird der aktuelle lokale Archivordner mit dem Berechtigungsstatus angezeigt. Mit **«Ordner auswählen / ändern»** lässt sich der Ordner direkt über den sicheren Browser-Dateidialog festlegen.
- Für alle Archivarten wird derselbe Ordner verwendet: **Kalibrierungen, Nachmessungen und Test/Logging (inkl. zugehörigen JSONL-Rohdaten)**. Es entsteht keine zweite Speicherverwaltung neben dem bestehenden Kalibrierarchiv.
- Der Ordner wird wie bisher im lokalen IndexedDB des Browsers vorgemerkt und beim nächsten Öffnen angezeigt. Wenn die Browserberechtigung nach einem Neustart nicht mehr gültig ist, erscheint **«Zugriff freigeben»**. Die App fordert ohne expliziten Klick keine versteckte Schreibfreigabe an.
- Während einer **laufenden Kalibrierung, Nachmessung oder Logger-Aufzeichnung** wird der Ordnerwechsel gesperrt, damit ein Messprotokoll und seine Rohdaten nicht auf mehrere Verzeichnisse verteilt werden. Ein abgebrochener Dateidialog lässt den bisherigen Ordner unverändert.
- Nach erfolgreichem Wechsel wird die Archivliste aus dem neuen Ordner eingelesen. Bestehende Dateien im vorherigen Ordner werden weder automatisch verschoben noch gelöscht. Kein Upload in die Cloud, kein direkter Zugriff auf einen frei eingetippten absoluten Dateipfad.
- Regressionstests für Auswahl, IndexedDB-Vormerkung, Zugriffsfreigabe, aktive Aufzeichnungen, Abbruch und fehlende Browserunterstützung ergänzt.

## v0.7.84 – Kalibrierprotokoll inklusive Diagrammen als PDF speichern

- **Kalibrierung → Ergebnisse prüfen** bietet jetzt wie Nachmessung/Test-Logging den PDF-Export. Der **PDF-Button** ist ebenfalls direkt bei jedem Kalibrierarchiv in der Dateiliste vorhanden.
- Das druckfertige A4-Kalibrierprotokoll enthält Sensor-UID, Adapter und Firmware, Softwareversion, Start/Ende, archivierte Kalibrierpunkte inklusive Referenzwerten, Temperaturen, ADC_S/ADC_T und Sample-Zahlen, verfügbare DSP-Fit-Informationen, NVM-Status sowie **alle unabhängigen DSP-Prüfversuche** mit Referenzdruck, berechnetem Ist-Druck, Druckabweichung, Abweichung in % FS, Toleranz und gespeichertem Bestanden-/Fehlerstatus.
- Die **Diagramme werden unverändert aus dem neuen Archivdiagramm-Modul erzeugt** und als druckbare Inline-SVGs eingebettet: Abweichung mit Toleranzintervallen sowie Soll-/Ist-Druck mit Toleranz. Bei älteren Kalibrierungen ohne DSP-Verifikation erscheint der ADC_S-Rohpunktgraph ohne erfundenes Toleranzband.
- Der Export läuft vollständig lokal. Im vom Browser geöffneten Druckfenster **«Als PDF speichern / Drucken»** wählen und im Systemdruckdialog **«Als PDF speichern»** verwenden. Es werden keine Kalibrierwerte, NVM-Inhalte oder Archivdateien verändert.
- Fehlermeldungen werden im Protokoll dokumentiert. Ein abgeschlossener Archivstatus allein wird nicht als Nachweis einer erfolgreichen unabhängigen DSP- oder NVM-Verifikation dargestellt.
- Zusätzliche automatisierte Tests prüfen PDF-Aufbau, beide SVG-Diagramme, Archiv-Datentreue, alte Datensätze, Eingabesicherheit und die Integration der Download-Buttons.

## v0.7.83 – Kalibrierungen jetzt mit Soll-/Ist- und Abweichungsdiagrammen im Archiv

- Im lokalen Kalibrierarchiv erscheinen beim Öffnen von **«Ergebnisse prüfen»** für Kalibrierungen zwei neue, an die bestehende Nachmessung angelehnte Diagramme: **Druckabweichung in % FS** mit der jeweils gespeicherten Toleranz und **Soll-/Ist-Druck** mit den aufgezeichneten Toleranzgrenzen.
- Prüfpunkte werden mit **grün** (laut gespeichertem Ergebnis innerhalb Toleranz), **rot** (ausserhalb Toleranz) oder **orange** (ohne Bewertung) markiert. Es werden alle real gespeicherten Verifikationsversuche angezeigt, auch fehlgeschlagene und wiederholte Versuche.
- Messquelle sind ausschliesslich die archivierten `verification_attempt`-Ereignisse (`pressure`, `pressureDeviation`, `tolerance`, `pass` usw.). Die vollständige Messspanne wird aus den archivierten Kalibrierpunkten abgeleitet. Fehlt sie, bleibt die Darstellung in der gespeicherten Kalibriereinheit statt eine %FS-Angabe zu erfinden.
- Für alte Kalibrierarchive **ohne unabhängige DSP-Verifikation**, aber mit aufgenommenen Kalibrierpunkten, wird als Fallback der **ADC_S-Verlauf über die Referenz** gezeigt – mit klarem Hinweis, dass dafür **kein Toleranzband** vorliegt.
- Die neuen Graphen sind reine Anzeigen: Es werden weder Archivdateien verändert noch Sensoren angesprochen, und es erfolgt keine zusätzliche Messung oder NVM-Aktion.
- Node-Regressionstests decken die Auswertung von ±Abweichungen, wechselnden Einheiten, wiederholten Versuchen, fehlenden Referenzen, Toleranzgrenzen und die unveränderte Wiedergabe alter Archivdaten ab.

## v0.7.82 – Standarddruck 0–100 % und robuster Start der geführten Ansicht

- **Kalibrierung:** In der klassischen und der geführten Oberfläche ist die Druckeinheit neu standardmässig **%**, mit unterem Referenzwert **0** und oberem Referenzwert **100**. Damit starten neue Kalibrierungen auf **0–100 %**. Sämtliche drei geführten Vorlagen (Schnell, Mit Temperatur, Individuell) verwenden ebenfalls 0–100 % als Druck-Preset und zeigen die Werte an.
- **Frei editierbar:** Physikalische Einheiten wie bar, mbar, kPa und psi bleiben jederzeit manuell wählbar. Ein bereits erfasster Messpunkt wird beim Wechsel auf ein neues Preset nicht stillschweigend verworfen: Vor einer Änderung des Druckbereichs mit vorhandenen Messpunkten erfolgt eine Rückfrage. Vorhandene Archivprotokolle und gespeicherte Sensor-Konfigurationen werden nicht umgerechnet oder überschrieben.
- **Prüfreferenz in der Kalibrierung:** Die voreingestellten Prüfpunkte liegen in der Mitte (50 %) und die dazugehörigen Beispiel-Toleranzen bei 0,2 % der Messspanne; bei einer bewusst anderen Kalibrierungseinheit bleiben die Werte anpassbar.
- **Nachmessung:** Das Eingabeformat **% der Messspanne** bleibt voreingestellt, der reale kalibrierte Druckbereich wird aber weiterhin in der tatsächlichen physikalischen Einheit (z. B. bar) geführt. Es findet keine fiktive Gleichsetzung von 100 % mit 100 bar statt.
- **Ansicht beim Neuladen:** Ein Video vom Fehler zeigte noch Version v0.7.80. Neu startet die Web-App bei fehlender gespeicherter Auswahl direkt in **Geführt**; ein bewusst gewähltes **Klassisch** wird dauerhaft berücksichtigt. Ein zusätzlicher Wiederherstellungsversuch nach dem vollständigen Seitenladen kann die geführte Oberfläche nach einem zeitweiligen Startproblem erneut aufbauen. Nie werden dadurch Kalibrierpunkte, RAM-/NVM-Aktionen oder USB-Kommunikationsbefehle automatisch ausgeführt.
- Regressionstests für Moduswahl, Reload, Startwiederholung, das 0–100-%-Preset und bewusst eingestellte physikalische Einheiten ergänzt.

## v0.7.81 – Geführte oder klassische Ansicht bleibt nach dem Neuladen erhalten

- Der Schalter **«Geführt» / «Klassisch»** speichert die erfolgreich gewählte Ansicht im Browser. **F5**, **Ctrl + R** und das erneute Öffnen der Webseite stellen die zuletzt ausgewählte Oberfläche wieder her.
- Die geführte Oberfläche kann weiterhin **ohne bereits angeschlossenen Sensor** geöffnet werden. Nur die Ansicht wird restauriert, niemals automatisch ein Kalibrier-, Mess-, RAM- oder NVM-Vorgang wiederaufgenommen.
- Die vorher nicht gespeicherte Auswahl fiel nach dem Reload stets auf «Klassisch» zurück. Eine frühe Lade-Markierung verhindert zusätzlich das kurze Aufblitzen der klassischen Arbeitsfläche, wenn «Geführt» gespeichert ist.
- Schlägt die Speicherung z. B. wegen blockiertem Browser-Speicher fehl, bleibt der manuelle Moduswechsel funktionsfähig; eine Lade-Schutzmarkierung wird in jedem Fall entfernt.
- Automatisierte Regressionstests für gespeicherte Ansichten, beide Reload-Zweige, blockierte Speicherung und erfolgreiche bzw. gesperrte Moduswechsel ergänzt.

## v0.7.80 – Archiv ohne leere Kalibrierungen und ohne «Offen»

- **Keine leeren Kalibrier- oder Nachmessungsdateien mehr beim Start:** Solange nur ein Start-Ereignis, automatische RAM-/NVM-Snapshots, Verbindungsprotokolle oder Fehlermeldungen ohne reale Samples vorhanden sind, bleiben die Vorgänge im Arbeitsspeicher. Eine Datei wird erst beim ersten Kalibrier-/Prüfmesspunkt oder einer sicherheitsrelevanten Hardwareänderung geschrieben.
- **Teilweise Messungen bleiben erhalten.** Erfasste Kalibrierpunkte, DSP-Prüfungen, AFE-/RAM-Änderungen, NVM-Vorgänge und echte Teilsamples bei fehlgeschlagenen Messungen lösen die Archivierung aus. Leere Vorgänge werden beim Abschluss/Abbrechen ohne Datei verworfen.
- **Altprotokolle:** Schon vorhandene vollständig leere Archivdateien werden ausgeblendet, aber bewusst nicht automatisch gelöscht. Der Archivhinweis nennt deren Anzahl. Messhaltige Einträge mit altem Status `running`/«Offen» werden als **«Unvollständig»** angezeigt. Alle Dateien mit relevanten Daten bleiben erhalten.
- Die Statusauswahl enthält kein «Offen» mehr. Wirklich unterbrochene oder abgebrochene Vorgänge behalten ihre ausdrücklichen Statusangaben; die bestehende Nachmessungs-Toleranzlogik bleibt unverändert.
- Tests für leere Starts, teilweise Kalibrierungen, relevanten RAM-Änderungen, alte offene Protokolle sowie mögliche Telemetrie-Recoverydaten ergänzt.
- **Hinweis:** Das Archiv entfernt keine vorhandenen Dateien automatisch. Sensorkommunikation und NVM-Schreibschutz bleiben unverändert.

## v0.7.79 – Abschlussstatus von Nachmessungen korrigiert

- **«Abgeschlossen» ist ein Ablaufstatus, kein Toleranzurteil.** Eine Nachmessung gilt nach erfolgreichem Speichern als abgeschlossen, sobald alle vorgesehenen Prüfpunkte tatsächlich aufgenommen wurden. Bei deaktivierter optionaler Toleranzbewertung ist dazu kein «Bestanden» notwendig.
- Bei eingeschalteter Toleranzbewertung bleibt eine nicht bewertbare Prüfung «Unvollständig»; bestätigte Toleranzüberschreitungen werden weiterhin als «Fehlerhaft» gekennzeichnet. Fehlende Messpunkte bleiben unvollständig.
- Alte, bereits beendete Archivdatensätze, die einzig wegen deaktivierter Toleranzbewertung fälschlich «Unvollständig» waren, werden in der Archivliste und in **neu exportierten PDFs** als «Abgeschlossen» dargestellt. Das gespeicherte JSON wird nicht automatisch verändert; das PDF enthält bei einem korrigierten Altstatus einen transparenten Hinweis.
- Wirklich noch laufende Protokolle mit «Offen» und abgebrochene oder unvollständige Kalibrierungen bleiben unverändert.
- Regressionstests für Erfassung ohne Toleranz, aktive Toleranz ohne Bewertung, fehlende Messpunkte, Toleranzfehler und offene Altprotokolle ergänzt.

## v0.7.78 – Nachmessung: klare Eingabefehler und korrekter Referenzdruck

- Beim Start der Nachmessung werden ungültige Druck- und Temperaturreihen sowie Bereichs-, Zyklus- und Toleranzeingaben am jeweiligen Feld rot hervorgehoben. Die Ansicht springt zum ersten fehlerhaften Feld; Eingabekorrekturen entfernen die Markierung.
- Der tatsächlich beim Messpunkt eingegebene Kalibrator-Referenzdruck bleibt änderbar und ist entscheidend für die gespeicherte Druckabweichung. Die Abschlussübersicht, die Diagramm-Details und das PDF zeigen diesen Referenzdruck statt stillschweigend den ursprünglichen Prüfdruck. Abweichende Sollwerte bleiben explizit dokumentiert.
- Bei unterschiedlichen Relativ-/Absolutdruckbezügen zeigt das PDF zusätzlich den für die Sensorabweichung umgerechneten Druck. CSV-Protokolle unterscheiden bei Bedarf ebenfalls zwischen eingegebenem Kalibratorreferenzdruck und korrigiertem Sensorbezug.
- Prüfablauf, Sensorkommunikation und NVM-Programmierung unverändert. Software-Regressionstests für ungültige Listen sowie abweichende Referenzen in Graph und PDF ergänzt. Die Bedienung am realen Prüfstand muss weiterhin verifiziert werden.

## v0.7.77 – App-Einstellungen kompakter und übersichtlicher

- Einstellungsfenster neu in **Darstellung**, **Messung**, **Erweiterte Optionen** und **Hilfen & Tools** gegliedert. Kompaktere Abstände, zusammengehörige Felder in zwei Spalten und klare Beschriftungen.
- **Arbeitsansicht nach dem Verbinden** als Einstellungsoption entfernt. Die **geführte Ansicht** ist weiterhin über die direkte Navigation «Geführt» erreichbar; ein Sensoranschluss startet sie nicht mehr automatisch aufgrund einer alten Preference.
- **Demo-Modus** erscheint in den Einstellungen ausschliesslich, wenn **Expertenparameter** aktiviert sind. Ein bereits aktiver Demo-Modus bleibt aus Sicherheitsgründen im Hauptbereich eindeutig als Simulation gekennzeichnet und kann dort beendet werden.
- Links zu **DIY-Programmer-Firmware**, **Feedback** und **Offline-Anleitung** deutlich sichtbarer als kompakte, kontrastreiche Aktionsflächen dargestellt; auch mit Darkmode und Tastatur-Fokus.
- **Kein Schliessen-Button:** Das Einstellungsfenster verschwindet beim Klick auf eine andere Stelle der Web-App, insbesondere bei einer Hauptnavigation, und mit **Escape**. Der ursprüngliche Klick auf der Hauptseite wird weiter ausgeführt.
- Alle vorhandenen IDs und Speicherregeln für Farbe, Sprache, Kompaktmodus, Hover-Erklärungen, Samples und Live-Intervall bleiben erhalten. Das Layout ändert weder die Sensor-Kommunikation noch den Abgleich oder NVM-Schutz.

## v0.7.76 – Adaptive Live-Abfrage mit 250 ms als Standard

- **250 ms · Standard (adaptiv)** ist neu für Erstbenutzung und ohne gespeicherte persönliche Einstellung vorausgewählt. Der bisherige Standard von 650 ms wird dadurch ersetzt.
- Bestehende, ausdrücklich gespeicherte Einstellungen (250, 400, 650, 1000, 1500 oder 2000 ms) bleiben erhalten und werden beim Aktualisieren nicht überschrieben.
- Die adaptive Rückregelung auf 400/650 ms bei langsamen Sensorantworten, die 2-Sekunden-Pause bei Kommunikationsfehlern sowie der sequenzielle Ablauf der Sensorabfragen bleiben unverändert.
- Die Zeit gibt weiterhin die **Pause nach der abgeschlossenen Messrunde** an, nicht den tatsächlichen Abstand zwischen Sensorwerten. Die reale Stabilität muss mit SSP3/One-Wire beziehungsweise I²C am Hardware-Prüfplatz geprüft werden.
- Einstellungen, Beschriftungen, Hilfetext und aktuelle Anleitungen auf die neue Standardauswahl abgeglichen.

## v0.7.75 – DIY-Programmer auf zwei unterstützte Boards begrenzt

- Die auswählbare **DIY-Programmer-USB-Bridge** bezieht sich nur noch auf **ESP32-C3 SuperMini (Firmware v0.10)** und **Arduino Pro Micro (Firmware v0.27)**. Der originale **ELMOS SSP3** bleibt als separate Herstellerlösung verfügbar.
- Die Firmwaremeldung `BRIDGE_INFO` wird nun auf die eindeutigen Eigenschaften der beiden aktuellen DIY-Firmwares geprüft. Ein unbekanntes Board oder eine reine USB-CDC-Beispielfirmware erhält **keine bestätigte Chip-Zugriffsfreigabe**. Die Web-App erkennt und protokolliert den tatsächlich verwendeten DIY-Programmer statt jeden Bridge-Adapter als ESP32 zu bezeichnen.
- Die überholten breiten Tabellen mit vielen anderen ESP-, Arduino-, RP2040- und sonstigen Mikrocontrollerboards wurden aus [DIY-Boardübersicht](docs/ESP_BOARD_OPTIONS.md) und [USB-Bridge-Anleitung](docs/USB_BRIDGE_GUIDE.md) entfernt.
- Verbindungsauswahl, Firmware-Installer, Einzelanleitungen für ESP32-C3/Pro Micro, README, Bedienungsanleitung, Roadmap und Testbericht auf **v0.7.75** abgeglichen.
- Bestehende One-Wire-, I²C-, RAM-/NVM-Schutzmechanismen und die vorherige adaptive Live-Abfrage bleiben unverändert. Für beide DIY-Adapter bleibt die **Hardware-End-to-End-Validierung** am realen E703.11 offen.

## v0.7.74 – Optionale adaptive Live-Abfrage ab 250 ms

- Die bisherigen Abfragepausen (400, 650, 1000, 1500 und 2000 ms) bleiben unverändert. Neu unter **Einstellungen → Live-Abfrageintervall**: **«250 ms · Adaptiv (schneller)»**. Der neue Modus ist bewusst optional; die gespeicherte persönliche Einstellung bleibt erhalten.
- 250 ms bezeichnet die **Pause nach einer bereits abgeschlossenen** Sensorabfrage. Der tatsächliche Abstand zwischen zwei ADC_S-Werten umfasst zusätzlich die Zeit für One-Wire-/I²C-Befehle, USB und Chipkonversion.
- Die Web-App wartet weiterhin jede vollständige Live-Abfrage ab und sendet keine parallelen ADC-/DSP-Abfragen. Sekundärkanäle bleiben rotierend verteilt. Es erfolgen **keine Änderungen an CFG_PERIOD, DSP- oder NVM-Registern und keine neuen USB-Befehle**.
- Im adaptiven Modus führen zwei nacheinander langsame Lesezyklen (je mindestens 600 ms) zu einer Erhöhung auf 400 bzw. 650 ms. Ein Lesezyklus ab 1200 ms oder ein Lesefehler erzwingt die 650-ms-Stufe; die bisherige 2-Sekunden-Fehlerpause und Sensor-Verlust-Erkennung bleiben bestehen. Nach jeweils zehn normalen Lesezyklen wird die Pause stufenweise zurückgenommen.
- Der technische Live-Status und der SSP3-Diagnoseexport zeigen die aktuell effektive Abfragepause. Die Funktion wurde mit automatisierten Simulationen geprüft, **nicht** am realen SSP3/E703.11 freigegeben.

## v0.7.73 – Bis zu zwei optionale Fotos im Prüfprotokoll

- Nachmessung und Test/Logging unterstützen bis zu **zwei Fotos mit optionaler Bildbeschreibung**, vor, während und nach der Messung sowie in der Archiv-Detailansicht.
- JPG, PNG und WebP werden vollständig lokal im Browser als JPEG neu gespeichert, auf maximal **1400 Pixel** und **300 KB pro Foto** begrenzt; Quellen über 12 MB werden abgelehnt. Durch das Neucodieren fallen ursprüngliche Bildmetadaten weg.
- Fotos liegen eingebettet im jeweiligen **lokalen JSON-Archivprotokoll**, nicht als zusätzliche lose Dateien.
- Die bestehenden PDF-Berichte für Nachmessung und Test/Logging zeigen vorhandene Bilder mit ihrer Beschriftung in einem eigenen, druckoptimierten Abschnitt; ohne Bilder bleibt das Layout unverändert.

## v0.7.72 – Ein lesbarer CSV-Export pro Protokoll

- Je Archiveintrag nur noch **ein CSV-Button**, auch beim Logging-Abschluss und in der Nachmessungs-Zusammenfassung. Die verwirrenden zusätzlichen CSV-Varianten «Rohdaten», «Übersicht», «alle Infos» und «Messwerte» wurden aus der Bedienoberfläche entfernt.
- CSV enthält zuerst eine direkt lesbare Messwerttabelle, darunter wenige Protokoll- und Sensorangaben. Bei Nachmessungen werden redundante Soll-/Referenzspalten, konstante Samples- und Zyklusangaben sowie nicht benötigte Bewertungsfelder automatisch weggelassen.
- Der CSV-Export für Test/Logging, Kalibrierung und Ausgang verwendet ebenfalls kurze, fachlich passende Tabellen statt tausender technischer Rohdatenzeilen. Technische Detailinformationen bleiben im unveränderten JSON/JSONL-Archiv verfügbar.
- Excel-freundlicher UTF-8-Export mit Semikolon und Schutz vor Formelinterpretation.

## v0.7.71 – Übersichtlicher CSV-Export für Nachmessungen

- **«CSV · Übersicht»** ist der neue Standardexport für Nachmessungen: kompakte Protokollangaben und eine klare Tabelle mit genau einer Zeile je aufgenommenem Messversuch. Unaufgenommene geplante Prüfpunkte bleiben als leere Zeilen erkennbar.
- Die Tabelle enthält je nach Prüfart Soll- und Referenzdruck, digitalen Sensordruck, absolute und prozentuale Druckabweichung (% FS), Druck-/Temperaturrichtung, Prüf- und Sensortemperatur, Aufnahmezeitpunkt, Versuch, Anzahl Rohsamples und nur bei aktiver Toleranzbewertung einen Ergebnisstatus.
- Es werden **keine** TX/RX-Meldungen, einzelnen ADC-/DSP-Rohsamples, NVM-Register oder verschachtelten JSON-Feldpfade in der Übersicht angezeigt. Für eine vollständige technische Nachprüfung bleiben **«CSV · Rohdaten»** und JSON verfügbar.
- Beide CSV-Varianten können in der Archivliste und Detailansicht exportiert werden. Die kompakte CSV ist auch direkt in der Abschlussübersicht einer Nachmessung verfügbar. Sie nutzt UTF-8, Semikolon als Trennzeichen und erhält negative Messwerte als Excel-kompatible Zahlen.
- Bei nicht aktivierter Toleranz erfolgt keine Bestanden-/Fehlerbewertung. Die rein rechnerische Druckabweichung wird trotzdem angezeigt, wenn Referenzdruck und physikalisch dargestellter Sensorwert vorhanden sind.

## v0.7.70 – PDF-Export für Test/Logging und vollständiger CSV-Export im Archiv

- Nach Abschluss von Test/Logging kann ein druckfertiger PDF-Bericht erzeugt werden. Er enthält Testbezeichnung, Chip-/Geräteangaben, Aufnahmeeinstellungen, Statistik, ADC_S-/DSP_S-Verlauf, alle Messpunktgruppen sowie sämtliche Ereignisse und Marker. Die Darstellung verwendet den Browserdruckdialog «Als PDF speichern». Bei mehr als 400 Gruppen wird lediglich der Kurvenverlauf für die Grafik reduziert; die Tabelle enthält weiterhin alle Gruppen.
- In **jeder Archivkarte** und Detailansicht gibt es **«CSV · alle Infos»**, unabhängig vom Protokolltyp. Der universelle CSV-Export umfasst alle ursprünglichen JSON-Felder und verschachtelten Werte, einschliesslich RAM/NVM, Einstellungen, Referenzen, Zeitstempel, Fehler, Ereignisse und bei Logging zusätzlich alle JSONL-Messpunktgruppen, Einzel-Rohsamples und gegebenenfalls TX/RX-Logs. UTF-8 mit BOM und Excel-Formelschutz.
- Der frühere tabellarische Logger-CSV bleibt separat als **«CSV · Messwerte»** verfügbar.
- Im Logger-Abschlussbereich werden JSON, beide CSV-Varianten und PDF direkt angeboten. Die Berichte werden lokal erzeugt; der CSV-Download verändert weder die JSON-Dateien noch den Archivordner.

## Öffentliches Feedback

- Unter «Einstellungen → Feedback melden» lassen sich Fehler und Funktionswünsche mit optionalen Screenshots melden. Das Formular gibt den Link zum öffentlichen GitHub-Issue zurück.

## v0.7.69 – Reduzierte Hinweise bei der Nachmessung

- Den langen, wiederholten Warntext zur provisorischen Sensor-Skalierung aus der Detailansicht entfernt; gespeicherte Messwerte und Bewertungen unverändert belassen.

## v0.7.68 – Einheitliche Abweichungsbezeichnung

- In Webansicht, Archivübersicht und PDF ist die Messgrösse einheitlich als «Abweichung» beschriftet, unabhängig davon, ob eine Toleranzprüfung aktiviert oder die Skalierung bereits bestätigt ist.
- Hinweise zur Skalierungsunsicherheit werden getrennt vom Zahlenwert angezeigt; dadurch entfällt die verwirrende Mischung aus «Geprüft», «Vorläufig» und «Ungeprüft» als Zahlenpräfix.

## v0.7.67 – Bewertung optional und klarer Protokollname

- Toleranzbewertung der Nachmessung ist **standardmässig deaktiviert**; ohne ausdrückliche Aktivierung werden Messwerte und Abweichungen erfasst, aber nicht als bestanden oder ausser Toleranz klassiert.
- Die vier Bestanden-/Fehler-/Offen-Statuszähler in der Nachmessung, Grafik und im PDF wurden durch eine einfache Anzahl aufgenommener Messpunkte ersetzt. Toleranzbalken werden nur bei aktivierter Bewertung angezeigt.
- Schnittstelle wird im Archiv und PDF passend als **One-Wire (AODO)** oder **I²C** benannt. Interne SSP3-Protokollkennungen bleiben unverändert.
- Die frühere optionale VDD-Istspannungs-Eingabe in der Anschlussansicht wurde entfernt. Die manuelle VDD-Dokumentation innerhalb des separaten Testloggers blieb bestehen.

## v0.7.66 – Aufgenommene, aber unbewertete Punkte im Diagramm

- Bereits aufgezeichnete digitale Sensorwerte werden im Druckabweichungsdiagramm auch dann sichtbar, wenn eine bestätigte Toleranzbewertung noch nicht möglich ist. Solche Punkte dürfen nicht als «Bestanden» erscheinen.
- Tests für Messpunkte mit unbekannter Skalierung, vorliegender physikalischer Einheit, vorhandenen Altarchiven und fehlenden Messpunkten hinzugefügt.

## v0.7.65 – Nachmessung vereinfacht

- Eingabefelder für den DSP-Endwert, die freie Beschreibung des ursprünglichen Abgleichs und doppelte Prüfmittelangaben aus der Nachmessung entfernt.
- Optionale Protokollinformationen bleiben dauerhaft aufgeklappt. Referenzdruck zeigt die gewählte physikalische Einheit direkt am Eingabefeld.
- Die Nachmessung orientiert sich am **digital angezeigten Sensorwert** und benötigt keinen separat zu erratenden DSP-Endwert. Diagramm, Archiv und PDF zeigen diesen Wert.
- Überflüssige PDF-Felder wie «Adapter-Firmware: Antwort erhalten» entfernt. Ältere Protokolle mit DSP-Samples bleiben lesbar.

## v0.7.64 – Physikalischer Prüfdruck oder Prozent der Messspanne

- Kalibrierte Druckunter- und -obergrenze mit Einheit (bar, mbar, kPa, MPa, psi) einstellbar.
- Nachmessungspunkte entweder direkt in Druckeinheiten oder in Prozent der gesamten Messspanne vorgeben; Umrechnung konsistent im Prüfplan, Archiv, Diagramm, Hysterese und PDF dokumentiert.
- Die prozentuale Abweichung wird auf die **gesamte kalibrierte Druckspanne** bezogen, nicht auf einen möglicherweise kleineren Prüfplanbereich.

## v0.7.63 – PDF-Prüfprotokoll, optionale Dokumentation und automatische Werkzeugerkennung

- Nach dem Speichern einer Nachmessung steht «Prüfprotokoll als PDF speichern» in der Abschlussübersicht zur Verfügung. Dieselbe Funktion ist auch für ältere Nachmessungen in der Archiv-Detailansicht verfügbar.
- Der PDF-Bericht wird vollständig lokal als druckoptimierte Vorschau erzeugt (im Browser «Drucken» → «Als PDF speichern»), ohne externe Bibliothek, Cloud-Upload oder Sensorzugriff. Er enthält Chip-UID, Prüfstatus, Zeitangaben, Prüfeinstellungen, Soll-/Ist-Werte, Abweichungen, Diagramme und alle Prüfpunkte.
- Optionale Angaben: Prüfer, Auftrag/Projekt, Prüfstand, externe Messmittel, Zertifikatsreferenz und zusätzliche Bemerkungen. Diese Felder sind nicht für den Start einer Prüfung erforderlich und werden im lokalen JSON-Archiv gespeichert.
- Das eingesetzte Kalibrierwerkzeug (ELMOS E703.11 Calibration Assistant mit Version) und der verbundene Kommunikations-/Programmieradapter (ELMOS SSP3 oder ESP32-USB-Bridge), Schnittstelle und verfügbare Firmware-Informationen werden bei Prüfstart automatisch aus den Verbindungsmetadaten übernommen.
- Externe Druckkalibratoren und Temperaturreferenzen werden nicht automatisch erkannt, solange keine unterstützte digitale Schnittstelle existiert; sie können optional dokumentiert werden.
- Archiv-Detailansicht und Abschlussübersicht zeigen die gespeicherten Informationen und einen PDF-Export.
- Versionsanzeige, App-Metadaten und Cacheversionen auf v0.7.63 gesetzt.

## v0.7.62 – Messwert direkt am Prüfpunkt und geführter Prüfabschluss

- Nach jeder Nachmessung wird der zuletzt gespeicherte Sensorwert direkt neben der Messaktion angezeigt, inklusive Einheit, DSP_S-Rohwert, Bewertung und Aufnahmezeit.
- Am letzten Prüfpunkt heisst die Navigation «Prüfung abschliessen und speichern». Unaufgenommene letzte Punkte können nur nach ausdrücklicher Bestätigung übersprungen werden.
- Nach erfolgreichem Speichern erscheint eine schreibgeschützte Abschlussübersicht mit Diagramm, allen Prüfpunkten, Soll-/Ist-Werten, Abweichungen und Bewertungen.
- «Zur Hauptseite» beendet die Ansicht erst nach dem gespeicherten Ergebnis; fehlgeschlagene und nicht bewertete Messungen werden korrekt als solche ausgewiesen.
- Fehlende oder nicht bewertete Messungen führen zu «Unvollständig», tatsächlich fehlgeschlagene Prüfpunkte zu «Fehlerhaft». Keine automatische Freigabe durch den Abschluss.
- Versionsanzeige, Cache-Kennungen der geänderten Dateien und App-Versionsmetadaten auf v0.7.62 aktualisiert.

## v0.7.61 – Messdiagramm in archivierten Nachmessungen

- Archivierte Nachmessungen zeigen neu direkt im Detailbereich das Ergebnisdiagramm mit Prüfpunkten, Abweichungen, Toleranzgrenzen und Bewertungsstatus sowie den DSP_S-Rohwertverlauf.
- Einzelne Prüfpunkte lassen sich im Archivdiagramm anklicken, um das aufgezeichnete Resultat zu prüfen, ohne Mess- oder NVM-Funktionen auszuführen.
- Ältere Protokolle ohne vollständigen Prüfplan zeigen vorhandene DSP_S-Rohwerte ohne erfundene Sollwerte oder automatische Freigabe.
- Versionsanzeige, JavaScript-/CSS-Cacheversion und die in neue Archivdateien geschriebene App-Version sind auf v0.7.61 synchronisiert.

## v0.7.57 – DSP-Prüfung an den Kalibriergrenzen

- Beide Endpunkte des Kalibrierbereichs sind als DSP-Prüfpunkte zulässig, beispielsweise 0 und 6 bar bei einem Bereich von 0 bis 6 bar.

## v0.7.38 – Messverlauf im Testprotokoll

## v0.7.45

- ESP32-C3 SuperMini USB-Bridge v0.10 ergänzt CRC-geschütztes I²C für Registerzugriff, Live-Messung und RAM-Kalibrierung. Die Schnittstelle lässt sich direkt bei der USB-Verbindung wählen.
- Bei einem Sensor mit deaktiviertem I²C kann die Bridge den Bus für die aktuelle Sitzung über AODO im RAM aktivieren. Für das dauerhafte Speichern im NVM ist weiterhin der One-Wire-Kaltstartnachweis erforderlich.


- Test / Logging zeigt den Verlauf von ADC_S und DSP_S für bis zu 20 gespeicherte Messpunkte.
- Pro Micro v0.27 ergänzt CRC-geschütztes I²C für die Varianten mit 8 und 16 MHz. Unter Einstellungen führt «USB-Bridge aktualisieren» zum ESP32-Browser-Flasher, den Pro-Micro-Downloads und den Pinbelegungen beider Boards.

## v0.7.37 – Manuelle Messpunkte und USB-Bridges

- Test / Logging kann Messpunkte auf Knopfdruck aufnehmen. Einzelmessungen und Mittelwertbildung gelten auch im manuellen Modus.
- ESP32-C3 und Pro Micro unterstützen den Kaltstartnachweis für die NVM-Prüfung. Die ESP32-Firmware startet nach der One-Wire-Freigabe die kontinuierliche Messung.
- Bridge-Optionen und Baudraten stehen im Expertenmodus. Beim Boardwechsel trennt die App den USB-Port automatisch.

## v0.7.29 – Pro Micro als PLC-Testbridge

- Unterstützt ATmega32U4 als experimentelle Bridge zur Sensorerkennung und Live-Messung.

## v0.7.28 – Quelle der Preset-Werte anzeigen

- Erklärt beim Erstellen einer Vorlage, welche Werte vom Sensor und welche aus den aktuellen Vorgaben der App stammen.

## v0.7.27 – Preset direkt beim Titel laden

- Öffnet die Preset-Auswahl in Schritt 2 über einen Button neben dem Titel.

## v0.7.26 – Aufgabenübersicht und Prozentanzeige

- Zeigt den Live-Ausgang zum Abschluss in Prozent und bietet einen direkten Rückweg zur Aufgabenübersicht. Beim Abbrechen des Sensorwechsels bleibt der USB-Port offen.

## v0.7.25 – Serie im Assistenten beenden

- Hält den USB-Port beim Sensorwechsel offen. «Serie abbrechen» führt zurück zur Aufgabenübersicht.

## v0.7.24 – Messhub und Sensorwechsel

- Zeigt den ADC-Hub zwischen P1 und P2, verwendet die vorhandene NVM-Rücklesung und fragt beim erneuten Abgleich desselben Sensors nach.

## v0.7.23 – Geführter Sensorwechsel

- Führt durch den Sensorwechsel und übernimmt Messplan, Ausgangsvorgaben und Frontend aus dem letzten Abgleich. «Serie abbrechen» beendet die Übernahme.

## v0.7.22 – Nächsten Sensor abgleichen

- Startet den Sensorwechsel am Ende des geführten Abgleichs. Nach dem Verbinden beginnt der nächste Abgleich mit der Abfrage der zuletzt übernommenen Vorlage.

## v0.7.21 – Preset beim Start des Sensorabgleichs

- Fragt beim Start des geführten Abgleichs nach der zuletzt übernommenen Vorlage. Die Abfrage erscheint einmal pro Sensorverbindung, auch nach erneutem Anschliessen desselben Sensors.

## v0.7.20 – Elmos-Vorlagen importieren

- Liest AFE und SVDD aus CRC-geprüften Elmos-PSSC-XML- und HEX-Dateien als wiederverwendbare Vorlage.

## v0.7.19 – Vorlage für den nächsten Sensor

- Zeigt Einstellungsgruppen und Namen erst beim Bearbeiten. Bietet die zuletzt übernommene Vorlage beim Anschliessen eines anderen Sensors erneut an.

## v0.7.18 – Einstellungsgruppen im Preset auswählen

- Presets speichern nur die gewählten Gruppen. Beim Laden zeigt die App nur enthaltene Gruppen.

## v0.7.17 – Sensor-Presets im Messplan

- Lädt Presets direkt in «Abgleich planen» und speichert die genaue Druck-/Temperaturmatrix samt Temperatur-Sollwerten.

## v0.7.16 – Presets für baugleiche Sensoren

- Speichert benannte Config-Vorlagen lokal im Browser und lädt sie über eine Auswahlliste. Ausgangsprofile enthalten optional die Clipping-Grenzen.

## v0.7.15 – Clipping für den Analogausgang

- Schritt 8 bietet optionale obere und untere Spannungsgrenzen für den ratiometrischen AODO-Ausgang. Die Änderung wird zur NVM-Prüfung vorgemerkt.

## v0.7.14 – Messpunkte nach Ansichtswechsel

- Baut die Messpunktliste beim erneuten Öffnen der geführten Ansicht auch bei unveränderter Messmatrix wieder auf.

## v0.7.13 – VDD-Eingabe beim Abgleich

- Die optionale gemessene Versorgungsspannung wird beim Abgleich erfasst. Der Archiv-Viewer zeigt gespeicherte Werte an.

## v0.7.12 – NVM-Vorschau mit vorhandenem Abbild

- Verwendet ein bereits geprüftes NVM-Abbild aus derselben Verbindung und vom selben Chip. Die Chip-UID wird vor dem Schreiben automatisch geprüft.

## v0.7.11 – Fortschritt und kompakte Messpunkte

- Blockierende Vorgänge zeigen ihren Fortschritt mittig. Kurze Lesevorgänge behalten die Anzeige unten rechts.
- Aufgenommene Messpunkte blenden die Eingabezeile aus und zeigen das Ergebnis.

## v0.7.10 – Fortschritt bei Chipvorgängen

- Zeigt aktive Lesevorgänge, Messungen, Importe und Schreibvorgänge an. Bei NVM und Messpunktaufnahme werden die bearbeiteten Wörter oder Samples gezählt.
- Blendet die Aufnahmebuttons bestätigter Kalibrierpunkte aus.

## v0.7.9 – Messpunkte ohne doppelte Ergebnisübersicht

- Die überladene grüne Übersicht «Bereits aufgenommen» aus Schritt 5 entfernt.
- Nur eine kleine Bestätigung «✓ Messpunkt X aufgenommen» beim Wechsel.
- Nächster Referenzpunkt bleibt klar hervorgehoben; links weiterhin Haken und Status je Punkt.
- Nach dem letzten Punkt nur noch eine eindeutige Abschlussanzeige.
- Keine Änderungen an Messungen, gespeicherten Rohwerten, Archivdaten oder Hardwarekommunikation.

## v0.7.8 – Referenzmesspunkte eindeutig als aufgenommen kennzeichnen

- Erfolgreich gemessene Punkte bleiben sichtbar in einer grünen Übersicht statt optisch zu verschwinden.
- Erfolgsbestätigung erst nach tatsächlicher Übernahme durch den bestehenden Mess- und Speicherpfad.
- Klare nächste Aktion: «Als Nächstes: Messpunkt X messen» mit Referenzdruck und Temperatur.
- Messpunktnavigation unterscheidet sichtbar zwischen «Aufgenommen», «Jetzt messen» und «Noch offen».
- Verfügbare ADC_S-, ADC_T- und Sample-Anzahlen als reine Anzeigewerte aus den vorhandenen Messdatensätzen.
- Ohne unnötige DOM-Neuerstellung bei unveränderten Live-Updates; auch im Darkmode gut erkennbar.
- Keine Änderungen am Sensor-, Mess-, RAM- oder NVM-Schreibpfad.

## v0.7.7 – Mehr Kontrast und Darkmode

- Neuer Farbmodus in den Einstellungen: «Hell · hoher Kontrast» und «Dunkel · Darkmode».
- Browserlokale Einstellung, synchron vor dem ersten Rendern aktiv, auch nach Neuladen.
- Einheitliche Darkmode-Farbpalette für geführten Assistenten, klassische Ansicht, One-Pager, Kalibrierkarten, EEPROM-Tabellen, Archiv, Nachmessung und Test-Logging.
- Erhöhter Kontrast für wichtige Texte, Nebeninformationen, Input-Rahmen und Navigationskarten im hellen Modus.
- Warnungen, Fehler und erfolgreiche Prüfungen auch im dunklen Modus farblich eindeutig und lesbar.
- ADC-Livegrafik wechselt Linien-, Achsen- und Hintergrundfarben passend zum Modus.
- Mess-, Kommunikations- und NVM-Sicherheitslogik unverändert.

## v0.7.6 – Archiv und Nachmessung im geführten Einstieg / Links in neuem Tab

- Sechs Aufgabenkacheln im geführten Einstieg, darunter «Archiv» und «Nachmessung».
- Beide Kacheln öffnen ihre Ansicht mit einem Klick; Archivsuche auch ohne angeschlossenen Sensor, sofern der Assistent bereits geöffnet ist.
- Der optionale Button «Nachmessung» in der oberen Leiste bleibt standardmässig ausgeblendet; der geführte Einstieg bietet die Funktion immer an.
- Anleitungen, USB-Diagnose und weitere verlinkte Hilfeseiten öffnen in einem neuen Browser-Tab und lassen die laufende Web-App geöffnet.
- Responsive Kachelaufteilung für Desktop, Tablet und Smartphone; ZIP-Download unverändert.

## v0.7.5 – Offline-Anleitung in Einstellungen, Nachmessung optional

- Den breiten Offline-Hinweis aus der Hauptansicht entfernt; der Einsteiger-Link steht in «Einstellungen → Web-App offline verwenden».
- Neue Option «Nachmessung einblenden» in den App-Einstellungen, standardmässig ausgeschaltet.
- Der Navigationsbutton erscheint nur bei aktiver Option; die Auswahl wird lokal im Browser gespeichert.
- Die Option lässt sich während einer aktiven Nachmessung nicht abschalten, um einen laufenden Prüfablauf nicht versehentlich zu verbergen.
- Nachmessungsprotokolle bleiben im Archiv jederzeit sichtbar und durchsuchbar, unabhängig von der Einstellung.

## v0.7.4 – DUT, kompakter Logviewer und Adapter-Firmware richtig benannt

- Im Test-Logging separate, optionale Produkt-/DUT-Bezeichnung; im JSON, Archiv, Suche, Vergleich und CSV-Export enthalten.
- Kompaktere Archivwerkzeuge, Kennzahlen und Geräteinfos. Optionale VDD-Istspannung aufklappbar.
- Die bisher als «Firmware» bezeichnete Version `02.08.02.04` wird korrekt als SSP3-Adapter-Firmware ausgewiesen; Chip-Versionsregister `0x38` separat und nur bei auslesbarem Wert.
- Frühere Archivdateien bleiben kompatibel.

## v0.7.3 – Aufgabenkacheln direkt öffnen und Archiv-Logviewer neu gestalten

- Ein Klick auf die Aufgabenkachel im geführten Einstieg führt direkt in den gewählten Ablauf, weiterhin mit Sensor- und Archivprüfung.
- Archiv als modernes Dashboard: Gesamtkennzahlen, Messdateien mit Schnellstatus, Suche, Filter, UID, Board und Softwareversion.
- Schnelle Detailansicht mit Mittelwert, Min/Max, Standardabweichung und DSP_S-Signalverlauf für vorhandene Test-Rohsamples.
- Gegenüberstellung zweier Protokolle mit Rohwertdifferenzen, Fehlern, UID-Hinweis und NVM-Wortvergleich.
- Fehlerhafte und ausserhalb der Toleranz liegende Messungen sind ausdrücklich erkennbar.
- Bestehende JSON-/JSONL-Protokolle bleiben lesbar. Sensorregister und NVM-Schreibschutz bleiben unverändert.

## v0.7.2 – Separates Archiv/Nachmessung, klassisches Test-Logging und Zeitlimit

- Oben separate Bereiche **«Archiv»** (Suche, Protokolle und Vergleiche) und **«Nachmessung»** (Prüfpläne, Druck-/Temperaturrampen, Hysterese).
- **«Test / Logging»** als eigener Reiter in der klassischen Navigation direkt unter dem EEPROM Viewer; weiterhin auch im geführten Einstieg verfügbar.
- Nur eine Logger-Instanz: Beim Wechsel bleiben Eingaben bestehen, laufende Aufzeichnungen werden nicht verdeckt.
- **Testdauer frei wählbar** in Sekunden, Minuten und Stunden; 0 = unbegrenzt. Automatisches Stoppen und Archivieren mit Live-Restzeitanzeige.
- Pause unterbricht die aktive Testdauer, bis die Aufzeichnung fortgesetzt wird.
- Weiterhin alle Einzelmessungen und optionalen Mittelwerte, Testbeschreibung, Telemetrie, Marker und Fehler im lokalen Archiv.

## v0.7.1 – Test / Logging im geführten Einstieg

- Vierte Kachel **Test / Logging** mit Name, Beschreibung, Kategorie, Operator und optionaler VDD-Messung.
- Frei definierbares Messintervall (1–3’600’000 ms), Anzahl Einzelmessungen (1–100), Einzelmessabstand (0–60’000 ms) und Mittelwert/Median/keine Mittelung.
- Jeder Rohsample mit Zeitstempel, ADC_S, ADC_T, ADC_TC, DSP_S, DSP_T und Status; Fehler und tatsächliche Messdauer protokolliert.
- Live-Aufzeichnung mit Pause/Fortsetzen, Einzelaufnahme, Marker, Notizen und optionalen Referenzen.
- Lokale Rohdaten in fortlaufenden JSONL-Teilen, Archivsuche und vollständiger JSON-/CSV-Export.
- Test-Logging benutzt ausschliesslich den reservierten Leseweg und verändert die NVM-Schutzlogik nicht; reale Hardwarevalidierung weiterhin offen.

## v0.7.0 – Lokales Kalibrierarchiv und Nachmessung

- Pro Kalibrierung initiale und finale RAM-/NVM-Konfiguration, UID, Web-App-Version, Adapter, Einzelmessungen, Verstärkungen, Koeffizienten, Fehler und Wiederholungen in lokalem JSON.
- Frei definierbare Druck- und Temperaturprüframpen mit Hystereseauswertung, Filter und Vergleich im Archiv.

## v0.6.58 – Eigene USER-ID

- Im NVM-Schritt kann optional ein 16-Bit-Hexwert für das USER-Wort vorgemerkt und mit der Kalibrierung gespeichert werden. Die Änderungsliste zeigt den alten und neuen Wert.

## v0.6.57 – Hubwarnung und einzelne Prüfpunkte

- Der AFE-Schritt warnt sichtbar bei einem beobachteten Hub unter 4’000 Digits.
- Für jeden DSP-Prüfpunkt gibt es einen eigenen Referenzdruck, eine Prüftemperatur und eine Bestätigung.

## v0.6.56 – Automatischer Wiederanlauf für SSP3

- Nach einem erfolgreichen manuellen RAM-Messstart merkt sich Chrome den Sensor anhand seiner Chip-ID. Beim erneuten Verbinden oder nach einem erkannten Sensorneustart prüft die App das RAM-Profil und startet die Messung erneut.

## v0.6.55 – SSP3-Wiederverbindung

- Merkt sich die zuletzt bestätigte SSP3-Baudrate im Browser. Verwirft der Adapter den ersten Versionsbefehl als unbekannten Befehl, wird er einmal wiederholt.

## v0.6.54 – Live-Messung bei deaktiviertem Analog-Frontend

- Bei erkanntem SSP3-Sensor mit passendem inaktivem RAM-Profil kann die Live-Messung über das Elmos-Standardprofil gestartet werden. Die App prüft die Chipkennung, liest die RAM-Änderungen zurück und wartet auf eine neue ADC-Messung.

## v0.6.53 – SSP3-Diagnose bei leerem AFE-Register

- Bei CFG_AFE1 = 0x0000 bestätigt die App One Wire anhand der PLC-Adresse und der Chipkennung. Die Registerdiagnose bleibt verfügbar, während der Kalibrierablauf auf eine gültige AFE-Konfiguration wartet.

## v0.6.52 – SSP3-Startprofile bei ungültigem AFE-Wert weiterprüfen

- Wenn ein Startprofil antwortet, aber weder RAM noch das geprüfte EEPROM einen gültigen AFE-Wert liefern, prüft der SSP3 das nächste Startprofil.

## v0.6.51 – SSP3-Kaltstart nach Elmos-Protokoll

- Der SSP3 versucht die im Elmos-Mitschnitt verwendeten Startverzögerungen und prüft die Sensorantwort nach der flüchtigen One-Wire-Freigabe.

## v0.6.50 – SSP3-Wiederanlauf bei leerem AFE-RAM

- Nach PSSC-RAM-Freigabe kann die App ein leeres CFG_AFE1 aus dem EEPROM desselben Chips wiederherstellen. Sie prüft UID, CRC8, CRC16 und die RAM-Rücklesung. NVM-Schreiben bleibt in dieser Sitzung gesperrt.

## v0.6.49 – Brückenspannung mit der Kalibrierung speichern

- Beim SSP3-Abgleich übernimmt der NVM-Plan die rückgelesene SVDD-Einstellung. Die Änderungsliste zeigt beide Spannungen. Nach dem Neustart wird die Einstellung erneut aus dem Sensor-RAM gelesen.

## v0.6.48 – AODO senden und empfangen über GPIO4

- ESP32-Firmware v0.6 kann für AODO alternativ GPIO4 als gemeinsamen Sende- und Empfangspin nutzen. GPIO4 wird nach jedem Senden hochohmig. Für die bestehende externe Treiberstufe bleibt der Modus mit GPIO6 als RX der Standard.

## v0.6.47 – ESP32-Empfangsdiagnose

- Firmware v0.5.1 synchronisiert sich auf die tatsächliche Sensorantwort und prüft den CRC. Bei fehlender Chipantwort zeigt die Web-App, ob GPIO6 das eigene Sendesignal und anschliessende Flanken erkannt hat.

## v0.6.46 – ESP32-Start für E703.11 mit abweichender One-Wire-Konfiguration

- ESP32-C3-Firmware v0.5 prüft die PLC-Adressen 0x6C und 0x7C. Erst gültige CRCs und übereinstimmende Sensorregister bestätigen die Verbindung.
- Bei ausbleibender Antwort kann die Web-App die aus PSSC bekannte, temporäre One-Wire-Freigabe auslösen. Nach diesem Versuch sind NVM-Programmierbefehle in der Bridge gesperrt; RAM-Kalibrierung und NVM-Lesen bleiben verfügbar.
- Brückenspannung wird wie PGA1, Offset und PGA2 direkt ins Sensor-RAM übernommen und rückgelesen.

## v0.6.43 – Brückenspannung und Kalibrierdaten nach SSP3-RAM-Start

- Brückenspannung mit vollständiger Auswahlliste und kompakten Aktionen im AFE-Schritt.
- Nach bestätigtem SSP3-Neustart derselben Chip-UID können geprüfte Kalibrierdaten ins NVM geschrieben werden. Ausgang und One-Wire-Start bleiben im Originalzustand. Das vollständige NVM wird unmittelbar vor dem Schreiben nochmals verglichen.

## v0.6.42 – SSP3-Start wie im Elmos-GUI

- Bei der erkannten SSP3-Einzelsockel-Erweiterung für den E703.11 kann die Web-App bei fehlender One-Wire-Antwort den Startablauf von PSSC 3.2.1 verwenden. Die Freigabe setzt die temporäre One-Wire-Adresse 0x6C im Sensor-RAM. Der Zugriff gilt erst nach gültigen Registerantworten als bestätigt.
- EEPROM-Schreiben ist nach dieser RAM-Freigabe gesperrt. Die USB-Baudrate kann direkt im Verbindungsdialog gewählt werden. PSSC kann den SSP3 auf 921600 Baud hinterlassen.
- Der Ablauf wurde am SSP3 über COM4 mit gültigen CFG-, AFE- und ADC-Antworten geprüft.

## v0.6.41 – 12.11.2026: Diagnose nach weiterhin fehlgeschlagener Verbindung vereinfachen

- Bei fehlender Sensorverbindung steht **«Diagnose exportieren» direkt im oberen Warnbanner** neben «Sensor neu initialisieren» zur Verfügung – auch ohne Expertenmodus.
- Fehlermeldung weist darauf hin, dass die beiden PLC-Adressen getestet wurden und die Chipantwort weiterhin unbestätigt ist.
- Der Export trägt die Versionsnummer v0.6.41 und enthält die gesendeten Befehle, Rohantworten sowie alle Adressversuche.
- **Hardwareverbindung ist noch nicht als gelöst bestätigt.** Die originale XML enthält Chip-ID `0x200109F7DB`, die ältere Web-Log-Erkennung nennt eine andere Chip-ID `0020011DBBE7`; die im XML gespeicherte Adresse kann deshalb nicht ohne Chip-Rücklesung als aktiv vorausgesetzt werden.
- Software-Regressionen für CRC und PLC-Adresssuche erfolgreich; weiterer Hardware-Log erforderlich. Keine weiteren NVM-Schreibvorgänge eingeführt.

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

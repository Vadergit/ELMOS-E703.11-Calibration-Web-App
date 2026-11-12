# Ausgang und 1-Wire – E703.11

**Stand: v0.5.0 · 11.11.2026 · Laborprototyp (keine Hardwarefreigabe)**

Dieses Dokument erklärt die Auswahl **«One Wire only»**, die AODO-Ausgangsarten und die Sicherheitsregeln im [Kalibrierassistenten](https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/). Grundlage: **ELMOS E703.11, Production Data 25DS0170E.04 vom 16.11.2023**. Das vollständige Herstellerdatenblatt ist nicht im Repository enthalten.

## Weshalb «One Wire only» keine gewöhnliche AODO-Ausgangsart ist

Der E703.11 hat keinen eigenen Wert `CFG_EN.aodo_en = One Wire only`. Die Konfiguration kombiniert zwei Funktionen:

1. **AODO-Grundmodus** in `CFG_EN.aodo_en` (Bits 11:9): Für eine verfügbare 1-Wire-Schnittstelle muss der Wert laut Datenblatt im Bereich **1–5** liegen.
2. **1-Wire aktiv** in `CFG_SPI_I2C.plc_en` (Bit 2): Bei **1** bleibt die 1-Wire-Kommunikation dauerhaft aktiv. Solange 1-Wire aktiv ist, wird die gewöhnliche AODO-Ausgabe überlagert.

Der sichtbare PSSC-Eintrag «One Wire only» ist somit als **Betriebszustand**, nicht als frei programmierbarer zusätzlicher AODO-Modus zu behandeln. Die Software zeigt ihn als Auswahl an, wenn das vollständige Original-NVM gelesen und geprüft wurde.

**Wichtig:** Bei dauerhaftem 1-Wire-Betrieb ist der AODO-Pin für die Kommunikation belegt. Auch wenn ein ratiometrischer AODO-Grundmodus in den Registern steht, ist in diesem Zustand keine gleichzeitige reguläre analoge Ausgabe auf AODO zu erwarten.

## 1-Wire beim Start oder 1-Wire dauerhaft: Unterschied

| Einstellung | Verhalten nach Einschalten | Was die App erlaubt |
| --- | --- | --- |
| `plc_en = 1` | 1-Wire dauerhaft aktiv; Ausgangsfunktion auf AODO wird überlagert | «One Wire only» kann bei bestätigtem Original-NVM gewählt werden, **ohne etwas am Bootbereich zu ändern** |
| `plc_en = 0`, `startup_plc = 0` | 1-Wire-Startfenster von 4 ms | Normale AODO-Ausgabe kann danach übernehmen; «One Wire only» wird **nicht** vorgemerkt |
| `plc_en = 0`, `startup_plc = 1` | 1-Wire-Startfenster von 10 ms | Wie oben |
| `plc_en = 0`, `startup_plc = 2` | 1-Wire-Startfenster von 200 ms | Wie oben |
| `plc_en = 0`, `startup_plc = 3` | Kein passendes 1-Wire-Startfenster | NVM-Schreiben wird aus Sicherheitsgründen abgelehnt |

Die Startfenster beginnen laut Datenblatt nach der Anfangsphase des Einschaltens. Ob der SSP3 eine Verbindung innerhalb eines kurzen Zeitfensters zuverlässig aufbaut, muss auf dem Prüfstand verifiziert werden.

Für die erlaubte NVM-Programmierung prüft der Assistent konservativ ausserdem:

- `CFG_EN.aodo_en` **1–5** (Analog DAC-Korrektur 0/1/2, PWM oder FM);
- `CFG_PADS1.plc_downsel = 1` (Anfragen vom Master empfangen);
- `CFG_PADS1.plc_us_en = 1` (Antworten senden);
- `CFG_PADS1.plc_rw_en = 1` (dauerhafter Registerzugriff im NVM).

Der Hersteller beschreibt auch eine Magic-Cookie-Freigabe für den Registerzugriff. Darauf verlässt sich dieser Assistent für **permanentes NVM-Schreiben** ausdrücklich nicht. Diese zusätzliche Sicherheitsregel kann einen Chip von der Programmierung ausschliessen, auch wenn er aktuell kommuniziert.

## «One Wire only» im Assistenten auswählen

1. Sensor über **1-Wire** verbinden, vollständiges **64-Wort-Original-NVM** mit gültiger CRC/Chip-UID auslesen.
2. Unter **Schritt 6 → AODO pin → Type** «One Wire only» auswählen.
3. Die Statusmeldung lesen. Ist `plc_en = 1` mit den übrigen Startvoraussetzungen bereits im Original-NVM vorhanden, kann die Wahl geprüft und bestätigt werden.
4. **Es werden keine Boot- und Kommunikationsregister programmiert.** Ist «One Wire only» schon aktiv, sind allein durch diese Wahl keine NVM-Änderungen erforderlich. Eine separate Ausgangsprogrammierung entfällt.
5. Falls `plc_en` nicht dauerhaft gesetzt ist, bleibt die Umstellung gesperrt. Die bestehenden Register werden **nicht automatisch verändert**, um einen Ausschluss durch eine falsche Startkonfiguration zu vermeiden.

Bei einem regulären, vollständig verifizierten Druckabgleich können die Kalibrierkoeffizienten später wie üblich gespeichert werden. Die Wahl «One Wire only» lässt dabei den bisherigen AODO- und Kommunikationszustand im NVM unverändert.

**Der Assistent kann mit dem jetzigen Schutzkonzept keinen Sensor von einem reinen 1-Wire-Startfenster auf permanentes 1-Wire umprogrammieren.** Diese Möglichkeit würde eine gesonderte, am Zielchip validierte Änderung geschützter Bootregister erfordern. Das ist bewusst nicht freigegeben.

## AODO-Ausgangsarten

| Auswahl | `CFG_EN.aodo_en` | Verhalten | Schreibfreigabe |
| --- | --- | --- | --- |
| Analog Ratiometric 0..5 V | 1 | Ausgang proportional zu VDD, DAC-Korrektur 0 | Ja, mit gültigem 1-Wire-Startschutz |
| Analog Ratiometric 0..5 V · DAC Correction 1 | 2 | Wie oben, DAC-Korrektur 1 | Ja, nach Prüfung |
| Analog Ratiometric 0..5 V · DAC Correction 2 | 3 | Wie oben, DAC-Korrektur 2 | Ja, nach Prüfung |
| PWM | 4 | Pulsweitenmodulation | Ja, mit Skalierungs-/Periodenprüfung |
| FM | 5 | Frequenzmodulation | Ja, mit positiver DSP_AODO-Spanne |
| Disabled (HighZ) | 0 | AODO hochohmig | **Gesperrt:** 1-Wire-Startschutz verlangt Grundmodus 1–5 |
| ALARM | 6 | Alarmsignal | **Gesperrt:** 1-Wire-Startschutz verlangt Grundmodus 1–5 |
| One Wire only | *virtuelle Auswahl* | Bestätigt vorhandenes permanentes PLC; kein eigenständiger AODO-Wert | **Nur vorhandene Konfiguration bestätigen; keine Boot-Änderung** |
| Analog Absolute 0..10 V, 4..20 mA | – | Andere Chipvarianten | Nicht für E703.11 freigegeben |

Bei Analogmodus muss `CFG_AODO=0x0880` und bei FM `CFG_AODO=0x4200` sein. Für PWM ist der 16-Bit-Wert `CFG_AODO` die Periode in Systemtakten.

## Ratiometrische Ausgangsskalierung

Für den analogen Ausgang gilt im Datenblatt:

`DSP_AODO = AODO_F × DSP_S + AODO_O`.

Die 16-Bit-Koeffizienten AODO_F und AODO_O sind als **Q3.12** codiert. Der DAC ist nur für **10–90 % VDD** linear spezifiziert.

Bei **VDD = 5 V** sind sinnvolle Zielwerte:

| Punkt | DSP_S (bei gewähltem ±25’000-Zielbereich) | Spannung |
| --- | ---: | ---: |
| S0 / 0 % | −25’000 | 0.5 V |
| S1 / 100 % | +25’000 | 4.5 V |

Dafür berechnet die App gerundet **AODO_F ≈ 1.04834** und **AODO_O = 0**. Nach Q3.12-Quantisierung entspricht die nominale Vorschau etwa **0.50045 bis 4.49955 V**. Dies sind rechnerische Sollwerte, keine gemessenen Ausgangsspannungen.

Die **S0/S1-Eingaben sind Zielwerte** und dürfen beim Auslesen der aktuell programmierten Chipregister nicht überschrieben werden. Ein separater Infobereich zeigt den gelesenen Chipzustand. Der Knopf «Standard 10–90 % VDD einsetzen» setzt die Zielwerte passend zur eingetragenen VDD zurück.

Nicht verwechseln: Der AFE-Rohwert **ADC_S** soll im gewählten Arbeitsbereich bleiben; der hier übernommene DSP-Endwert ist dagegen die bewusst eingestellte **DSP_S**-Skalierung.

## Relevante Register und CM-Wörter

| Register | Adresse | CM-Wortindex | Zweck |
| --- | --- | ---: | --- |
| `CFG_EN` | 0x04 | 16 | AODO-Modus, scale_en und weitere Betriebsbits |
| `CFG_SPI_I2C` | 0x06 | 17 | PLC dauerhaft / Schnittstellen |
| `CFG_PADS0` | 0x08 | 18 | Startup-Zeitfenster für PLC |
| `CFG_PADS1` | 0x0A | 19 | PLC Downstream, Upstream, Registerzugriff |
| `CFG_AODO` | 0x10 | 22 | Analog/PWM/FM-Parameter |
| `AODO_O` | 0xA0 | 57 | Offset, Q3.12 |
| `AODO_F` | 0xA2 | 58 | Gain, Q3.12 |

**CM-Wortindex** ist der Index im 64-Wort-NVM-Abbild; die CM-Byteadresse ist `index × 2`. Das Original-NVM muss vollständig und korrekt gelesen werden, bevor irgendein Schreibplan akzeptiert wird.

## Sicherheit und Testgrenzen

- Der Assistent verändert keine vorhandenen Factory- oder Boot-/Kommunikationswörter. Nur ausdrücklich erlaubte AODO-Felder können innerhalb der geprüften Modi verändert werden.
- Eine erfolgreiche aktuelle 1-Wire-Verbindung beweist **nicht**, dass die Verbindung nach einem echten Kaltstart erreichbar bleibt.
- Ein Stromunterbruch während eines NVM-Programmiervorgangs kann die gesamte Konfiguration beschädigen, selbst wenn der geplante Inhalt die Softwareprüfungen bestanden hat.
- Erst einen **entbehrlichen Testchip** verwenden: Original-NVM sichern, das Programmieren/Rücklesen prüfen, Spannung abschalten und neu einschalten, die 1-Wire-Kommunikation nochmals nachweisen.
- Eine analoge Ausgangsspannung ist mit einem Messgerät an AODO bei den Endpunkten zu prüfen. Die JavaScript-Vorschau ist kein Ersatz für Messungen.
- Relevante Funktionen **Limiting / Error Signaling / Error Values** bleiben als geschützte Diagnoseansichten erhalten, bis deren komplette Bedienung und die Sicherheit validiert sind.

## Herstellerquellen

- **25DS0170E.04**, §6.3.2.6, S. 30: Ausgangs-Skalierung/Offset.
- **25DS0170E.04**, §6.4.1.1, S. 32–33: Ratiometrische Spannung, 10–90 % VDD.
- **25DS0170E.04**, §6.4.5.7–8, S. 51–52: 1-Wire-Konfiguration und Startup.
- **25DS0170E.04**, §6.5.1.1–2, S. 53–57: Registerbits für AODO, PLC und Wake-up.
- **25DS0170E.04**, §6.5.7.2 und §6.6.1, S. 79–82: AODO_F/O und NVM-Registerbelegung.

Siehe auch [README](README.md), [Bedienungsanleitung](ANLEITUNG.md), [Testbericht](TESTBERICHT.md) und [Versionshistorie](CHANGELOG.md).

## Expertenwerkzeuge (Version v0.3.4)

Der Expertenmodus wird über das Zahnrad oben rechts und «Expertenparameter freischalten» aktiviert. Er öffnet ein eigenes Diagnosefenster für Register, EEPROM/NVM und Chip-Backups. Das Fenster ist von allen Kalibrierschritten aus erreichbar, auch ohne abgeschlossene DSP-Prüfung. Die Ausgangsarten und das Scaling bleiben dagegen im normalen Schritt 6. Die Aktivierung des Expertenmodus ändert keine Chipregister.

## Einordnung ab v0.4.0

Die Experteneinstellungen werden jetzt **im jeweiligen Reiter** eingeblendet, nicht in einem separaten Expertenfenster. Ausgangsmodi und S0/S1 bleiben normal sichtbar; zusätzliche AODO_F/O-Rohparameter und Digital-Interface-Diagnosen erscheinen nur bei aktiviertem Expertenmodus. EEPROM-Viewer und chipunabhängige Config-Vorlagen sind ohne Expertenmodus erreichbar. **Eine Config-Datei kann keine 1-Wire-Startregister übernehmen oder programmieren.** [Config-/EEPROM-Dokumentation](CONFIG_DATEIEN.md).


## SSP3-Startfenster-Test (v0.6.12, 12.11.2026)

Die Web-App verwendet beim ELMOS SSP3 weiterhin das bekannte `IF_CFG 7 0 0` zum Umstellen des **Adapters**. Damit wird der E703.11 jedoch **nicht neu gestartet**. Das zuvor verwendete automatische Trennen und Wiederöffnen des SSP3-USB-Ports ist deshalb kein geeigneter Weg, um ein auf 4, 10 oder 200 ms begrenztes PLC-Startfenster erneut zu öffnen.

- Nach dem USB-Handshake bleibt der SSP3-Port auch bei fehlgeschlagener Chiperkennung offen.
- **«Startfenster testen (12 s)»** fragt `CFG_AFE1` begrenzt und ausschliesslich lesend ab (max. 12 Sekunden oder 75 Versuche; eine einzelne SSP3-Antwort wird bis 240 ms abgewartet).
- Nach dem Start des Tests **nur Sensor-VDD** physisch ausschalten und neu einschalten, SSP3-USB angeschlossen lassen. Der erste gültige PLC-Frame muss im Startfenster des Sensors eintreffen.
- Ein plausibles Wort führt über denselben bestehenden Sensor- und ADC-Leseweg zur Erkennung; es wird kein RAM-/NVM-Schreiben ausgeführt. Der Test ist abbrechbar und meldet den letzten Fehler.
- **Grenze:** Bei 4 ms kann ein Browser mit manuell eingeschalteter Sensorversorgung keine zeitlich garantierte Aktivierung bieten. Dafür muss die Versorgung durch einen nachweislich kompatiblen Adapter synchronisiert geschaltet und der erste PLC-Frame unmittelbar gesendet werden. Ein solcher SSP3-Stromsteuerbefehl wurde nicht verifiziert und wurde deshalb bewusst **nicht erfunden**. Für die ESP32-Bridge bleibt `PLC START` der gesonderte hardwarebezogene Weg, sofern die Bridge die entsprechende Funktion unterstützt.

Auch 200 ms sind kein Beweis, dass der SSP3-Befehl in der Herstellersequenz identisch ist. Bleibt die Erkennung aus, die RX-Rohantwort und den SSP3-Log mit der originalen PSSC-Software vergleichen. Erst dann einen unbekannten Hardware-Befehl oder ein anderes PLC-Frame ergänzen.

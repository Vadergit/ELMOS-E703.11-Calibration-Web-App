# E703.11 – Elmos-Anlehnung und Kaltstartprüfung (Labor)

Stand: 17.11.2026. Die Berechnung ist weiterhin eine unabhängige JavaScript-Implementierung, **nicht binär oder mathematisch 1:1 mit der proprietären Elmos-DLL verifiziert**. Keine Hersteller-DLL im öffentlichen Repository.

## Was gegenüber dem bisherigen Abgleich geändert wurde

- AN0203 §2.2: Druck-Sollwerte werden zentral als `DSP_S = 640 × Druck[%] − 32000` berechnet (bei der üblichen Spanne ±32'000 Digits). Ein bewusst kleiner gewählter DSP-Zielbereich bleibt möglich und wird über die analoge Verstärkung berücksichtigt.
- NVM-Abbild: Ein ratiometrischer Analogabgleich darf nur dann in die finale NVM-Schreibliste, wenn `CFG_EN.scale_en`, `AODO_O`, `AODO_F`, die optionale Begrenzung und S0/S1 rechnerisch zusammenpassen.
- Ohne separat vorgemerkte Ausgangseinstellungen übernimmt der NVM-Vorbereitungsschritt die **bereits im UI angezeigten** analogen Einstellungen automatisch. Änderungen werden im NVM-Diff angezeigt und erst nach expliziter Freigabe geschrieben.
- Mit temporärer One-Wire-RAM-Recovery werden **keine** AODO-/Bootregister zwangsweise freigegeben. Wenn das alte NVM nicht bereits zum Spannungsziel passt, wird die NVM-Programmierung blockiert.
- Unmittelbar vor dem NVM-Schreibbefehl wird die Analogzielprüfung wiederholt. Nach Power-Cycle wird das CRC-validierte NVM nochmals gegen das beim Schreiben gespeicherte Analogziel verglichen.
- Clipping wird **nicht** als Ersatz für korrekte AODO-Skalierung akzeptiert. Die Rohskalierung vor dem Limiter wird ebenfalls geprüft.
- Hersteller-Factory-Wörter und geschützte PLC-/I²C-/SPI-Bootregister bleiben unverändert.

## Morgen am Prüfstand testen

**Nur mit entbehrlichem Testchip; Sensorversorgung stabil halten.** Vorhandenes NVM als Datei sichern, Chip-UID notieren. Vor dem ersten neuen Programmieren mit dem bisherigen Sensor auslesen: `CFG_EN`, `AODO_O`, `AODO_F`, `LIMIT_LO`, `LIMIT_HI`, `DSP_S`, `DSP_AODO`, VDD und AODO-Spannung. So bleibt der Fehler reproduzierbar.

1. Versorgung des Sensors auf präzise **5,000 V** einstellen, VSS/Messgeräte-Masse verbinden. AODO mit einem hochohmigen Voltmeter messen.
2. Abgleich in der Web-App mit zwei Druckpunkten 0 % und 100 % bei gleicher Temperatur durchführen; weitere TK-Punkte nur bei entsprechender Temperaturmessung.
3. DSP-RAM-Werte prüfen. Erwartung bei ±32'000 Digits: 0 % → −32'000, 50 % → 0, 100 % → +32'000 (jeweils innerhalb der gewählten Prüftoleranz).
4. **Ausgang:** Analog ratiometrisch, S0 **0,500 V**, S1 **4,500 V**, VDD **5,000 V**. `scale_en` muss aktiv sein. Bei ±32'000 DSP-Digits wird nominal etwa `AODO_F=0x0D1B`, `AODO_O=0x0000` erwartet. Bei ±25'000 sind die Registerwerte anders.
5. Im Schritt **«Änderungen prüfen»** kontrollieren, dass die analogen Ausgangsregister im NVM-Plan korrekt berücksichtigt sind. Wenn bei One-Wire-Recovery ein Verbot angezeigt wird, **nicht umgehen**: Chip auf einen dafür verifizierten SSP3-Pfad bringen oder zuerst nur die bereits im NVM vorhandene Konfiguration prüfen.
6. NVM erst nach erfolgreicher unabhängiger DSP-Prüfung und Diff-Freigabe programmieren. Vollständige 64-Wort-Rücklesung und CRC abwarten.
7. **Echter Power-Cycle:** Versorgung entfernen, nicht nur USB/F5 trennen. Sensor ohne Programmer an die präzise 5-V-Versorgung anschliessen. Bei 0 %, 50 %, 100 % den Analogwert extern messen und dokumentieren.
8. Danach optional wieder mit der Web-App verbinden und **«NVM nach Neustart prüfen»** ausführen. **Die Software kann eine reale Ausgangsspannung nicht ohne externes Voltmeter bestätigen.**

| Referenzdruck | DSP_S nominal (±32k) | AODO bei VDD 5 V | Ist vor Neustart | Ist nach Neustart |
|---|---:|---:|---|---|
| 0 % | −32'000 | 0,500 V | ______ | ______ |
| 50 % | 0 | 2,500 V | ______ | ______ |
| 100 % | +32'000 | 4,500 V | ______ | ______ |

**Wenn nachher wieder 0,25–4,75 V gemessen wird:** NICHT gleich neu abgleichen. Die 64 NVM-Wörter, RAM-DSP_S, RAM-DSP_AODO, DMM-Ausgang und VDD unmittelbar nach dem echten Neustart sichern. So unterscheiden wir DSP-, Ausgangsregister- und Analogpufferfehler.

## Was noch NICHT Elmos-DLL-identisch ist

Die proprietäre Routine `pssc_cal_calibration()` (automatische Koeffizientenauswahl/Normalisierung, Fehlerkennzahlen, interne Rundungen) und besonders `pssc_cal_overall()` (Korrektur mit *gemessenen* Analog-Ausgangsfehlern) sind nicht bitgenau rückentwickelt oder gegen laufende DLL-Testvektoren validiert. Die Quellen AN0203 und Datenblatt geben die öffentlich dokumentierte Abfolge wieder, **nicht** alle herstellerinternen numerischen Algorithmen. Vor einer vollständigen Freigabe sind ein Vergleich gleicher Referenzmessungen mit der Original-PSSC-GUI und Hardwaremessungen über mehrere Temperatur-/Druckpunkte nötig.

Offline-Tests (ohne NVM-Schreiben): `node --test tests/elmos-calibration.test.cjs`. Die Tests prüfen die im Code umgesetzten Formeln und Sicherheitsregeln, nicht die Gleichheit zur Original-DLL.

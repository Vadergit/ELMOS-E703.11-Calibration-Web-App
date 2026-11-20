# NVM release gate

Testkandidat. Nicht mergen, bevor alle CI-Checks inklusive Safety und Hardwareabnahme erfolgreich sind. GitHub Pages veröffentlicht main. Required status checks und main-Branch-Schutz muss der Repository-Administrator aktivieren (Connector bietet keine Administration).

## Hardwarematrix

SSP3 und unterstützte DIY-Bridge: neuer, druckabgeglichener und temperaturabgeglichener Sensor; 2 Punkte, TK0, TK0+TKE; normal/invertiert; Direktstart und Recovery; ursprünglicher oder bewusst gewählter Filter. Original-NVM sichern, Vorabprüfung, DSP-Verifikation und NVM-Plan, 64-Wort-Rücklesung, Neustart; beide Druckendpunkte und bei TK zusätzliche Temperatur mit unabhängiger Druckreferenz und DMM prüfen. Zeitverhalten und Filterantwort separat validieren.

Verbindungsabbruch vor/nach Messpunkt und vor DSP/NVM-Freigabe (nicht absichtlich während NVM-Programmierung): Entwurf bleibt erhalten; Wiederherstellung nur für gleichen Chip, identisches NVM und Messprofil, unveränderten AFE und Referenzplan. Keine Wiederverwendung alter Schreibfreigaben. Kein automatisches NVM-Schreiben.

Browserlokaler Entwurf kann exportiert werden. Keine Funktionsgarantie aus CRC-/Registervergleich allein. Nicht validierte Registerkombinationen müssen bereits vor Messpunktaufnahme konkret gemeldet werden.

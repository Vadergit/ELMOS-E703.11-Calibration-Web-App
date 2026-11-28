# Standard-Entwicklungsablauf: Main und DEV

## Ziel
Die produktive Web-App bleibt stabil. Neue Ideen, Designänderungen und experimentelle Funktionen werden zuerst separat entwickelt, im Browser getestet und erst nach Freigabe übernommen.

- Produktiv: https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/
- Fester gewünschter DEV-Einstieg: https://vadergit.github.io/ELMOS-E703.11-Calibration-Web-App/dev/
- Aktueller Entwicklungsbranch: `ui-ux-redesign`.
- Die DEV-Adresse soll bei zukünftigen Entwicklungsprojekten unverändert bleiben.
- Status bei Erstellung dieser Richtlinie: DEV-Veröffentlichung und automatische Aktualisierung sind noch nicht verifiziert. Der gewünschte Link darf erst nach erfolgreicher Veröffentlichung als verfügbar bezeichnet werden.

## Verbindlicher Ablauf für jede neue Änderung
1. Von aktuellem, stabilem `main` einen separaten Arbeitsbranch erstellen. Bei einer neuen Idee nach einem Merge nicht auf veraltetem Entwicklungsstand weiterarbeiten.
2. Änderungen nur im Arbeitsbranch vornehmen. Produktive App und vorhandene PTC-DEV-Seite nicht überschreiben.
3. Den aktiven Entwicklungsbranch für die feste DEV-Adresse auswählen. Die DEV-Veröffentlichung soll bei jedem Push automatisch den aktuellen Commit aus diesem Branch bereitstellen, auch wenn Tests noch rot sind (Preview, keine Freigabe).
4. Die DEV-Seite klar mit DEV/Testversion, App-Version und Commit kennzeichnen. Browser-Speicher (localStorage, sessionStorage, IndexedDB), Archivzuordnung und Einstellungen von Main und älteren DEV-Seiten isolieren. Ein Ordnerpfad allein isoliert den Browser-Speicher nicht.
5. Priorität: geführter Modus, echte Klickpfade, kontextabhängige Buttons, klare Navigation, konsistente Erklärungen, automatische Routineprüfungen, responsive Darstellung und vollständige Sicherheitslogik.
6. Automatisierte Varianten-, Layout-, Sicherheits- und Regressionstests ausführen; Fehlerprotokolle und Screenshots prüfen. Nicht bestandene oder nicht ausgeführte Tests sind offen. Echte Hardwareprüfung separat dokumentieren, insbesondere vor NVM-Freigabe.
7. Erst nach erfolgreicher Abnahme und ausdrücklicher Zustimmung des Projektverantwortlichen in Main mergen. Versionsnummer, README und Changelog für die produktive Veröffentlichung aktualisieren.
8. Nach dem Merge den DEV-Einstieg beibehalten. Bis zur nächsten Entwicklung kann DEV den letzten Stand zeigen, klar gekennzeichnet; beim nächsten Projekt wieder von aktuellem Main starten und DEV auf den neuen aktiven Branch umstellen.

## Veröffentlichung
GitHub Pages unterstützt pro Repository nur eine Site. Das bestehende öffentliche Hosting-Repository `Vadergit/vadergit.github.io` enthält bereits `elmos-ptc-dev/` und kann einen separaten Redesign-Ordner aufnehmen. Für die exakt gewünschte URL unter der produktiven Projektseite wird ein kleiner, dauerhafter `dev/`-Einstieg (Weiterleitung) oder eine gemeinsame Pages-Build-Pipeline benötigt. Ein solcher Einstieg ist eine Infrastrukturänderung, kein Merge von Entwicklungscode. Keine bestehende Pages-Konfiguration ohne Prüfung ersetzen. Repository-übergreifende automatische Veröffentlichung braucht ausdrücklich eingerichtete Schreibberechtigung (z. B. beschränkter Deploy-Key oder GitHub App); keine Zugangsdaten in Quellcode, Logs oder öffentliches Repository schreiben.

Vor einer Veröffentlichung prüfen: Zielpfad, korrekter Branch und Commit, vollständige Assets, relative Links, DEV-Kennzeichnung, Speicherisolation und erfolgreiche Erreichbarkeit per HTTPS. Keine Veröffentlichung als erfolgreich melden, bevor die Webseite überprüft wurde.

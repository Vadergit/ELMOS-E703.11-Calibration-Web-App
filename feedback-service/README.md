# Feedback-Dienst einrichten

Das Formular auf GitHub Pages ruft einen Cloudflare Worker im Tarif **Workers
Free** auf. Der Worker leitet Text und Bilder an GitHub weiter. GitHub speichert
die Bilder als Anhänge und den Text als öffentliches Issue. Der Worker braucht
keinen Bildspeicher und installiert kein KV oder R2. Worker-Protokolle sind in
der Konfiguration deaktiviert. Besucher erhalten direkt die URL des Issues und
können Antworten ohne Anmeldung lesen.

1. Ein Cloudflare-Konto im Tarif **Workers Free** verwenden. Bei einem Tariflimit
   kann der Meldedienst vorübergehend keine Anfragen annehmen.
2. In Cloudflare Turnstile ein Widget für `vadergit.github.io` erstellen.
3. Einen Fine-grained Personal Access Token für dieses Repository verwenden.
   Das Konto muss im Repository Schreibzugriff haben. Für das Erstellen von
   Issues ist **Issues: Read and write** erforderlich. Anhänge verwenden den
   [Upload der GitHub CLI](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli).
   Die Annahme eines Bildes mit dem tatsächlich eingerichteten Token vor dem
   Livegang überprüfen. Ungeeignete Tokens werden vom Upload abgewiesen.
4. Im Verzeichnis `feedback-service` die drei Werte über
   `npx wrangler secret put GITHUB_ISSUES_TOKEN`,
   `npx wrangler secret put TURNSTILE_SECRET` und
   `npx wrangler secret put TURNSTILE_SITE_KEY` setzen. Keine Schlüssel einchecken.
5. Mit `npx wrangler deploy` veröffentlichen. In `feedback.js` die ausgegebene
   HTTPS-Adresse mit `/feedback` am Ende eintragen.
6. Vor der Veröffentlichung die erreichbare Datenschutzkontaktadresse und einen
   Hinweis zur Aufbewahrung ergänzen. GitHub und Cloudflare als beteiligte
   Dienste nennen. Bei Löschanfragen Issue-Inhalt und GitHub-Anhänge
   berücksichtigen.

Pro Meldung sind maximal drei PNG- oder JPEG-Dateien à 2 MiB erlaubt. Der
Dienst prüft Turnstile und begrenzt Einsendungen pro Client-IP.

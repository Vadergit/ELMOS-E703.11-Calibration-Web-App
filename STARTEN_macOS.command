#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null; then
  echo "Python 3 fehlt. Alternativ diese Dateien auf einem HTTPS-Webserver bereitstellen."
  echo "Enter zum Beenden ..."; read -r; exit 1
fi
(sleep 1; open -a "Google Chrome" "http://localhost:8765" 2>/dev/null || open "http://localhost:8765") &
echo "ELMOS-Web-App unter http://localhost:8765 – zum Beenden Ctrl+C"
python3 -m http.server 8765 --bind 127.0.0.1

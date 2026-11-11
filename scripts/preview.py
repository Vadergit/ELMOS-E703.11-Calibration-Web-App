#!/usr/bin/env python3
"""Run the beta from this checkout on localhost without changing GitHub Pages.

Usage (from any directory): python3 scripts/preview.py
Open the printed URL in Chrome. No Python packages are required.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
Handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
try:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
except OSError:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
url = f"http://localhost:{server.server_port}/"
print(f"\nELMOS E703.11 Guided Beta: {url}")
print("Im Chrome öffnen. GitHub Pages / main bleiben unverändert.")
print("Zum Beenden Ctrl + C drücken.\n")
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()

@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 goto usepy
where python >nul 2>&1
if %errorlevel%==0 goto usepython
echo Python 3 fehlt. Alternativ die Dateien auf einem HTTPS-Webserver bereitstellen.
pause
exit /b 1
:usepy
start "" "http://localhost:8765"
py -3 -m http.server 8765 --bind 127.0.0.1
goto end
:usepython
start "" "http://localhost:8765"
python -m http.server 8765 --bind 127.0.0.1
:end
pause

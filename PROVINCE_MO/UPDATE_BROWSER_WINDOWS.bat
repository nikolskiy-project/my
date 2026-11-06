@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1 && (set "PY=py -3") || (set "PY=python")
%PY% -m pip install playwright beautifulsoup4 requests
%PY% -m playwright install chromium
%PY% scripts\update_rules.py --browser --visible
pause

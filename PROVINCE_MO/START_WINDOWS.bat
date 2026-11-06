@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1 && (set "PY=py -3") || (set "PY=python")
echo Открываю локальный справочник...
%PY% scripts\start_site.py
if errorlevel 1 (
  echo Не удалось запустить локальный сервер. Можно открыть index.html двойным щелчком.
  pause
)

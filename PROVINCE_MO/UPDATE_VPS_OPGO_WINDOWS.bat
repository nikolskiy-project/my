@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1 && (set "PY=py -3") || (set "PY=python")
%PY% -m pip install -r requirements.txt
if errorlevel 1 goto err
%PY% scripts\update_rules.py --fetch
goto end
:err
echo Ошибка: проверьте Python и интернет.
:end
pause

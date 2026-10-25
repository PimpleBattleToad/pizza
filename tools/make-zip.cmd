@echo off
rem Сборка pizza-site.zip для хостинга. Двойной щелчок — и архив готов.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make-zip.ps1"
pause

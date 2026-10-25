@echo off
rem Раздача калькулятора по Wi-Fi. Двойной щелчок, затем откройте адрес на телефоне.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-lan.ps1" %1
pause

@echo off
set "NEXO_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "NEXO_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%NEXO_PS%" -NoProfile -STA -File "%~dp0Setup.ps1"
if errorlevel 1 pause

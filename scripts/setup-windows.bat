@echo off
REM ─────────────────────────────────────────────────────────────
REM Convenience launcher for setup-windows.ps1
REM ─────────────────────────────────────────────────────────────
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1" %*
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PYCMD="
where py >nul 2>&1
if %ERRORLEVEL%==0 (
    set "PYCMD=py"
) else (
    where python >nul 2>&1
    if %ERRORLEVEL%==0 (
        set "PYCMD=python"
    )
)

if "%PYCMD%"=="" (
    echo Python not found. Please install Python.
    pause
    exit /b 1
)

%PYCMD% creator_launcher.py

@echo off
echo Creating distribution package...
echo.

REM Create timestamp for filename
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set timestamp=%mydate%_%mytime%

REM Create zip filename
set zipname=ScreenshotCropper_%timestamp%.zip

echo Creating: %zipname%
echo.

REM Use PowerShell to create zip
powershell Compress-Archive -Path "qss\*" -DestinationPath "%zipname%" -Force

if exist "%zipname%" (
    echo.
    echo ============================================================
    echo Success! Package created:
    echo %zipname%
    echo ============================================================
    echo.
    echo This package contains everything users need.
    echo They just need to:
    echo   1. Extract the zip
    echo   2. Run SETUP_CHECK.bat
    echo   3. Use DRAG_FOLDER_HERE.bat
    echo.
) else (
    echo.
    echo Error: Failed to create zip file
    echo.
)

pause

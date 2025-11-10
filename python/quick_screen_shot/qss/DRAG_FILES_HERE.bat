@echo off
REM Drag and drop one or multiple image files onto this file to crop them

cls
echo ============================================================
echo Screenshot Cropper - Drag and Drop Files
echo ============================================================
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Check if any files were dragged
if "%~1"=="" (
    echo ERROR: No files provided!
    echo.
    echo Usage: Drag one or more PNG image files onto this .bat file
    echo.
    pause
    exit
)

REM Create timestamp for filenames
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/: " %%a in ('time /t') do (set mytime=%%a%%b)
set timestamp=%mydate%_%mytime%

REM Create folders in script directory
set WORK_FOLDER=%SCRIPT_DIR%cropped
set INPUT_FOLDER=%WORK_FOLDER%\input
set OUTPUT_FOLDER=%WORK_FOLDER%

REM Clean up old input folder if exists
if exist "%INPUT_FOLDER%" rmdir /s /q "%INPUT_FOLDER%"

echo Creating work folder: cropped
if not exist "%WORK_FOLDER%" mkdir "%WORK_FOLDER%"
mkdir "%INPUT_FOLDER%"
echo.

REM Copy all dragged files to input folder
set FILE_COUNT=0
:COPY_LOOP
if "%~1"=="" goto DONE_COPYING

if exist "%~1" (
    echo Copying: %~nx1
    copy "%~1" "%INPUT_FOLDER%\" >nul
    set /a FILE_COUNT+=1
)

shift
goto COPY_LOOP

:DONE_COPYING

if %FILE_COUNT% equ 0 (
    echo.
    echo ERROR: No valid files found!
    rmdir /s /q "%WORK_FOLDER%"
    pause
    exit
)

echo.
echo ============================================================
echo Processing %FILE_COUNT% file(s)...
echo ============================================================
echo.

REM Run the cropping script (output goes to temporary subfolder first)
set TEMP_OUTPUT=%WORK_FOLDER%\temp_output
mkdir "%TEMP_OUTPUT%"
python "%SCRIPT_DIR%crop_image_by_mask.py" "%INPUT_FOLDER%" "%TEMP_OUTPUT%"

echo.
echo ============================================================
echo Renaming files with timestamp...
echo ============================================================
echo.

REM Move and rename files from temp_output to main cropped folder
for %%F in ("%TEMP_OUTPUT%\*.png") do (
    set "filename=%%~nF"
    move "%%F" "%WORK_FOLDER%\%%~nF_%timestamp%%%~xF" >nul
    echo Saved: %%~nF_%timestamp%%%~xF
)

REM Clean up temporary folders
echo.
echo Cleaning up...
rmdir /s /q "%INPUT_FOLDER%"
rmdir /s /q "%TEMP_OUTPUT%"

echo.
echo ============================================================
echo Done!
echo ============================================================
echo.
echo Cropped files saved to:
echo %WORK_FOLDER%\
echo.
echo Opening folder...
explorer "%WORK_FOLDER%"
echo.
pause

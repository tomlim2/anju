@echo off
REM Drag and drop a folder onto this file to crop all screenshots inside

cls
echo ============================================================
echo Screenshot Cropper - Drag and Drop
echo ============================================================
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Check if a folder was dragged onto this file
if "%~1"=="" (
    echo ERROR: No folder provided!
    echo.
    echo Usage: Drag a folder onto this .bat file to process it
    echo.
    echo The folder should contain PNG screenshots to crop.
    echo Cropped images will be saved to a "cropped" subfolder.
    echo.
    pause
    exit
)

REM Check if the dragged item is a directory
if not exist "%~1\*" (
    echo ERROR: "%~1" is not a valid folder!
    echo.
    pause
    exit
)

echo Processing folder: %~1
echo.
echo Cropped screenshots will be saved to:
echo %~1\cropped\
echo.
echo ============================================================
echo.

REM Run the Python script
python "%SCRIPT_DIR%crop_image_by_mask.py" "%~1"

echo.
echo ============================================================
echo Done! Check the "cropped" subfolder for results.
echo.
pause

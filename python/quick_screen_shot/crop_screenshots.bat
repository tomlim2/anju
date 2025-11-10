@echo off
REM Batch file to run the screenshot cropper

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Check if an argument was provided (folder path)
if "%~1"=="" (
    REM No argument - run with default folders
    echo Running with default folders...
    python "%SCRIPT_DIR%crop_image_by_mask.py"
) else (
    REM Argument provided - use as input folder
    echo Processing folder: %~1
    python "%SCRIPT_DIR%crop_image_by_mask.py" "%~1"
)

REM Pause to see results
echo.
echo Press any key to close...
pause >nul

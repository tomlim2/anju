@echo off
chcp 65001 >nul
REM Advanced batch file with menu for screenshot cropper

set SCRIPT_DIR=%~dp0

:MENU
cls
echo ============================================================
echo Screenshot Cropper - Batch File Menu
echo ============================================================
echo.
echo 1. Crop screenshots from default folders
echo 2. Crop screenshots from custom folder
echo 3. Crop screenshots - specify input and output folders
echo 4. Edit default folders in crop_image_by_mask.py
echo 5. Exit
echo.
set /p choice="Select option (1-5): "

if "%choice%"=="1" goto DEFAULT
if "%choice%"=="2" goto CUSTOM_INPUT
if "%choice%"=="3" goto CUSTOM_BOTH
if "%choice%"=="4" goto EDIT
if "%choice%"=="5" goto END

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto MENU

:DEFAULT
cls
echo Running with default folders...
echo.
python "%SCRIPT_DIR%crop_image_by_mask.py"
goto PAUSE_END

:CUSTOM_INPUT
cls
echo Enter the input folder path (or drag and drop folder here):
set /p input_folder="> "
REM Remove quotes if they exist
set input_folder=%input_folder:"=%
echo.
echo Processing: %input_folder%
echo Cropped images will be saved to: %input_folder%\cropped\
echo.
python "%SCRIPT_DIR%crop_image_by_mask.py" "%input_folder%"
goto PAUSE_END

:CUSTOM_BOTH
cls
echo Enter the input folder path:
set /p input_folder="> "
set input_folder=%input_folder:"=%
echo.
echo Enter the output folder path:
set /p output_folder="> "
set output_folder=%output_folder:"=%
echo.
echo Processing...
echo Input:  %input_folder%
echo Output: %output_folder%
echo.
python "%SCRIPT_DIR%crop_image_by_mask.py" "%input_folder%" "%output_folder%"
goto PAUSE_END

:EDIT
notepad "%SCRIPT_DIR%crop_image_by_mask.py"
goto MENU

:PAUSE_END
echo.
echo ============================================================
echo.
set /p again="Process another batch? (y/n): "
if /i "%again%"=="y" goto MENU
if /i "%again%"=="yes" goto MENU
goto END

:END
echo.
echo Goodbye!
timeout /t 1 >nul
exit

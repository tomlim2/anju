@echo off
chcp 65001 >nul
cls
echo ============================================================
echo Screenshot Cropper - Requirements Check
echo ============================================================
echo.

REM Check if Python is installed
echo [1/2] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Python is NOT installed or not in PATH
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation!
    echo.
    goto ERROR
) else (
    python --version
    echo ✓ Python is installed
    echo.
)

REM Check if Pillow is installed
echo [2/2] Checking Pillow (PIL) library...
python -c "import PIL; print('Pillow version:', PIL.__version__)" >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Pillow is NOT installed
    echo.
    echo Installing Pillow now...
    python -m pip install Pillow
    echo.
    if %errorlevel% neq 0 (
        echo ✗ Failed to install Pillow
        echo Please run: pip install Pillow
        goto ERROR
    )
    echo ✓ Pillow installed successfully!
) else (
    python -c "import PIL; print('✓ Pillow version:', PIL.__version__)"
)

echo.
echo ============================================================
echo ✓ All requirements met!
echo ============================================================
echo.
echo You can now use:
echo   - DRAG_FOLDER_HERE.bat (drag a folder to crop images)
echo   - crop_screenshots_menu.bat (interactive menu)
echo   - crop_screenshots.bat (simple run)
echo.
goto END

:ERROR
echo ============================================================
echo ✗ Requirements not met
echo ============================================================
echo.
echo Please install the missing requirements above.
echo.

:END
pause

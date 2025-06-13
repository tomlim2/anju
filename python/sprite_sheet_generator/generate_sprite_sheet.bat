@echo off
REM filepath: .\generate_sprite_sheet.bat
setlocal enabledelayedexpansion

REM Check if ImageMagick is installed
where magick >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ImageMagick not found. Please install ImageMagick first.
    echo Download from: https://imagemagick.org/script/download.php
    exit /b 1
)

REM Set variables
set SCRIPT_DIR=%~dp0
set INPUT_DIR=%SCRIPT_DIR%input
set OUTPUT_DIR=%SCRIPT_DIR%output
set FRAME_SIZE=80
set SHEET_WIDTH=1024
set SHEET_HEIGHT=1024
set FRAME_COUNT=144

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo Processing sprite sheets...

REM Process each subfolder in the input directory
for /D %%F in ("%INPUT_DIR%\*") do (
    echo Processing %%~nxF...
    
    set INPUT_FOLDER=%%F
	set ACTUAL_FRAME_COUNT=0
	for %%I in ("%%F\*.png" "%%F\*.jpg") do (
		if exist "%%I" (
			set /a ACTUAL_FRAME_COUNT+=1
		)
	)
	if !ACTUAL_FRAME_COUNT! GTR %FRAME_COUNT% (
		set ACTUAL_FRAME_COUNT=%FRAME_COUNT%
	)
	set OUTPUT_FILE=%OUTPUT_DIR%\%%~nxF_!ACTUAL_FRAME_COUNT!.png
    
    REM Create a temporary directory for sorted files
    set TEMP_DIR=%TEMP%\sprite_sheet_temp_%%~nxF
    if exist "!TEMP_DIR!" rmdir /S /Q "!TEMP_DIR!"
    mkdir "!TEMP_DIR!"
    
    REM Copy and rename files for proper sorting
    set FILE_COUNT=0
    for %%I in ("%%F\*.png" "%%F\*.jpg") do (
        if exist "%%I" (
            set /a FILE_COUNT+=1
            if !FILE_COUNT! LEQ %FRAME_COUNT% (
                REM Add leading zeros to ensure proper sorting
                set NUM=000000!FILE_COUNT!
                set NUM=!NUM:~-6!
                copy "%%I" "!TEMP_DIR!\!NUM!%%~xI" >nul
            )
        )
    )
    
    REM Calculate columns and rows
    set /a COLS=%SHEET_WIDTH% / %FRAME_SIZE%
    set /a ROWS=%SHEET_HEIGHT% / %FRAME_SIZE%
    
    REM Create the sprite sheet using ImageMagick
    magick montage "!TEMP_DIR!\*" -background transparent -geometry %FRAME_SIZE%x%FRAME_SIZE% -tile %COLS%x%ROWS% "!OUTPUT_FILE!"
    
    echo Generated sprite sheet: !OUTPUT_FILE!
    
    REM Clean up temporary directory
    rmdir /S /Q "!TEMP_DIR!"
)

echo All sprite sheets generated successfully!
endlocal
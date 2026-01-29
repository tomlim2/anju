@echo off
cd /d "%~dp0" || (echo Error: failed to change directory to "%~dp0" & exit /b 1)

rem Load environment variables from .env if exists
if exist ".env" (
  echo Loading environment variables from .env
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
  )
)

if exist "venv\Scripts\activate.bat" (
  echo Activating virtual environment from "venv\Scripts\activate.bat"
  call "venv\Scripts\activate.bat"
)

set "PYCMD="
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  set "PYCMD=py -3"
) else (
  where python >nul 2>&1
  if %ERRORLEVEL%==0 (
    set "PYCMD=python"
  )
)

if "%PYCMD%"=="" (
  echo Error: Neither the "py" launcher nor "python" are available in PATH.
  echo Please install Python or add it to your PATH.
  exit /b 2
)

rem Launch the GUI script file explicitly (shipping_gui.py)
set "SCRIPT=%~dp0shipping_gui.py"
if not exist "%SCRIPT%" (
  echo Error: Python script not found: "%SCRIPT%"
  echo Ensure shipping_gui.py is in the same folder as this batch.
  exit /b 3
)

echo Starting GUI: %PYCMD% "%SCRIPT%"
start "" %PYCMD% "%SCRIPT%" || (
  echo Error: failed to start the GUI.
  exit /b 4
)

exit /b 0
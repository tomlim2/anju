@echo off
echo Downloading Python...
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.10.0/python-3.10.0-amd64.exe' -OutFile 'python-installer.exe'"
echo Installing Python...
start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
echo Python installed successfully.
python --version
echo Installing PIL...
python -m pip install pillow
echo PIL installed successfully.
pause
@echo off
setlocal enabledelayedexpansion

echo Unchecking read-only attribute for files and folders...

cd /d %~dp0

for /r %%i in (*) do (
    attrib -r "%%i"
    echo Unchecked read-only attribute for: %%i
)

echo Done.
pause

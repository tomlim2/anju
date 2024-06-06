@title Content Redirection

@echo off

echo Run Automation Redirection

cd /d C:\Program Files\Epic Games\UE_5.3\Engine\Binaries\Win64\

UnrealEditor.exe D:\CINEVStudio\CINEVStudio.uproject -run=ResavePackages -fixupredirects -autocheckout -projectonly -unattended

exit
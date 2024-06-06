@title Content Redirection

@echo off

echo Run Automation Redirection

cd /d D:\unreal\base\UE_5.3\Engine\Binaries\Win64

UnrealEditor.exe E:\CINEVStudio\CINEVStudio\CINEVStudio.uproject -run=ResavePackages -fixupredirects -autocheckout -projectonly -unattended

exit
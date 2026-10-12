@echo off
setlocal EnableExtensions
title SI Mothership Student - Desktop Setup

echo.
echo  SI MOTHERSHIP - STUDENT DESKTOP APP
echo  --------------------------------------
echo  This creates a desktop shortcut and opens the student controller.
echo  It uses Chrome or Edge already installed on this computer.
echo  No administrator access is needed.
echo.

set "SI_MOTHERSHIP_BROWSER="
if not defined SI_MOTHERSHIP_BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "SI_MOTHERSHIP_BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined SI_MOTHERSHIP_BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "SI_MOTHERSHIP_BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined SI_MOTHERSHIP_BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "SI_MOTHERSHIP_BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined SI_MOTHERSHIP_BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "SI_MOTHERSHIP_BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined SI_MOTHERSHIP_BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "SI_MOTHERSHIP_BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined SI_MOTHERSHIP_BROWSER if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "SI_MOTHERSHIP_BROWSER=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if not defined SI_MOTHERSHIP_BROWSER (
 echo  Chrome or Edge was not found. Install either browser and try again.
 pause
 exit /b 1
)

set "SI_MOTHERSHIP_PROFILE=%LOCALAPPDATA%\SI-Mothership-Student"
echo  Creating shortcut on your Windows Desktop...
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; try { $target=$env:SI_MOTHERSHIP_BROWSER; $profileDir=$env:SI_MOTHERSHIP_PROFILE; $arguments='--app=https://mothership-web-production.up.railway.app/?role=student --window-size=440,830 --window-position=45,45 --user-data-dir='+[char]34+$profileDir+[char]34+' --no-first-run'; $shell=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $link=$shell.CreateShortcut((Join-Path $desktop 'SI Mothership Student.lnk')); $link.TargetPath=$target; $link.Arguments=$arguments; $link.WorkingDirectory=Split-Path $target; $link.IconLocation=$target+',0'; $link.Description='SI Mothership Student - compact classroom controller for Zoom'; $link.Save(); Start-Process -FilePath $target -ArgumentList $arguments -ErrorAction Stop; Write-Host 'Desktop shortcut created successfully.' } catch { Write-Host ('Setup could not complete: '+$_.Exception.Message); exit 1 }"
if errorlevel 1 (
 echo  Setup could not create the shortcut. Ask your teacher or IT team for help.
 pause
 exit /b 1
)
echo.
echo  All set. Next time, double-click SI Mothership Student on your desktop.
echo  The app opens in its own compact window, ready to join class.
echo.
pause
exit /b 0

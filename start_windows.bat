@echo off
setlocal
cd /d "%~dp0"
title SI Mothership v43 Hosted Ready

echo.
echo ================================================
echo   SI MOTHERSHIP v43 - HOSTED READY
echo ================================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py -3"
) else (
  where python >nul 2>nul
  if %errorlevel% neq 0 (
    echo Python 3 was not found.
    echo Install Python 3 from python.org, then run this file again.
    pause
    exit /b 1
  )
  set "PY=python"
)

echo Checking required packages...
%PY% -c "import aiohttp,qrcode,PIL" >nul 2>nul
if %errorlevel% neq 0 (
  echo Installing aiohttp and qrcode...
  %PY% -m pip install --user aiohttp "qrcode[pil]"
  if %errorlevel% neq 0 (
    echo.
    echo Package installation failed. Check your internet connection and Python installation.
    pause
    exit /b 1
  )
)

echo Starting Mothership...
echo Keep this window open during class.
echo.
%PY% server.py

echo.
echo Mothership stopped.
pause

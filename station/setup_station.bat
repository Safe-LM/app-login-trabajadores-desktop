@echo off
setlocal
title Safe Link Monitoring - Instalador Automático
echo ============================================================
echo      SAFE LINK MONITORING - INSTALADOR PROFESIONAL
echo ============================================================
echo.

:: 1. Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado. Por favor instala Python 3.10+
    echo Descargalo en: https://www.python.org/downloads/
    pause
    exit /b
)

:: 2. Crear Entorno Virtual
if not exist venv (
    echo [SETUP] Creando entorno virtual (venv)...
    python -m venv venv
)

:: 3. Instalar Dependencias
echo [SETUP] Instalando dependencias (esto puede tardar unos minutos)...
call venv\Scripts\activate
pip install --upgrade pip >nul
pip install -r requirements.txt >nul

:: 4. Crear acceso directo en el Escritorio (via PowerShell)
echo [SETUP] Creando acceso directo en el Escritorio...
set SCRIPT_PATH=%~dp0src\main.py
set ICON_PATH=%~dp0src\assets\icon.ico
powershell -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\SafeLink_Station.lnk');$s.TargetPath='pythonw.exe';$s.Arguments='\"%SCRIPT_PATH%\"';$s.IconLocation='%ICON_PATH%';$s.WorkingDirectory='%~dp0';$s.Save()"

echo.
echo ============================================================
echo   INSTALACION COMPLETADA CON EXITO
echo ============================================================
echo   - Se creo un acceso directo en tu Escritorio.
echo   - El sistema esta listo para usarse.
echo.
echo [INFO] ¿Deseas arrancar la estacion ahora? (S/N)
set /p START_NOW=
if /I "%START_NOW%"=="S" (
    start pythonw.exe "%SCRIPT_PATH%"
)

pause

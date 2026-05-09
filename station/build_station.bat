@echo off
setlocal
echo ============================================================
echo   Safe Link Monitoring - Build Tool (Production .EXE)
echo ============================================================
echo.

:: 1. Verificar si PyInstaller esta instalado
python -m PyInstaller --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] PyInstaller no esta instalado. Instalando...
    python -m pip install pyinstaller
)

:: 2. Limpiar carpetas previas
if exist build rd /s /q build
if exist dist rd /s /q dist

:: 3. Comando de empaquetado PRO
echo [BUILD] Generando ejecutable (esto puede tardar unos minutos)...
python -m PyInstaller --noconfirm --onedir --windowed ^
    --name "SafeLink_Station" ^
    --icon "src/assets/icon.ico" ^
    --paths "src" ^
    --add-data "src/assets;assets" ^
    --add-data "src/config;config" ^
    --hidden-import "cv2" ^
    --hidden-import "PyQt5.QtWebEngineWidgets" ^
    src/main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al generar el ejecutable.
    pause
    exit /b
)

echo.
echo ============================================================
echo   BUILD COMPLETADO EXITOSAMENTE
echo   El ejecutable esta en: dist/SafeLink_Station/
echo ============================================================
echo.
echo   Para distribuir al cliente:
echo   1. Comprime la carpeta dist/SafeLink_Station/ en un ZIP
echo   2. El cliente descarga, descomprime y ejecuta SafeLink_Station.exe
echo   3. No necesita instalar Python ni configurar nada
echo.
pause

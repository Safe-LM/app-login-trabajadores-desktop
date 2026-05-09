@echo off
setlocal
echo ============================================================
echo   Safe Link Monitoring - DEBUG RESET TOOL
echo ============================================================
echo.
echo [INFO] Este script eliminara la STATION_API_KEY del archivo .env
echo [INFO] para que puedas volver a probar el flujo de activacion.
echo.

set ENV_FILE=../.env
if not exist %ENV_FILE% (
    set ENV_FILE=.env
)

if not exist %ENV_FILE% (
    echo [ERROR] No se encontro el archivo .env
    pause
    exit /b
)

echo [DEBUG] Limpiando STATION_API_KEY de %ENV_FILE%...

:: Crear un archivo temporal sin la linea de STATION_API_KEY
type %ENV_FILE% | findstr /v "STATION_API_KEY" > .env.tmp
move /y .env.tmp %ENV_FILE% > nul

echo.
echo [SUCCESS] Configuracion reseteada. 
echo [ACTION] Ejecuta 'python src/main.py' para probar el Onboarding.
echo.
pause

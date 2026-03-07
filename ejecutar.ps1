# Script rápido para ejecutar la aplicación (asume que venv ya está configurado)
# Uso: .\ejecutar.ps1

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Activar venv
$activateScript = Join-Path $scriptPath "venv\Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
} else {
    Write-Host "❌ Error: No se encontró el entorno virtual. Ejecuta '.\iniciar.ps1' primero." -ForegroundColor Red
    exit 1
}

# Ejecutar aplicación
$venvPython = Join-Path $scriptPath "venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython main.py
} else {
    Write-Host "❌ Error: Python del entorno virtual no encontrado." -ForegroundColor Red
    exit 1
}


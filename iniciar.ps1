# Script de inicio para la aplicación de escritorio
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Safe Link Monitoring - Control de Asistencia" -ForegroundColor Cyan
Write-Host "Aplicación de Escritorio v2.0.4" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Python
Write-Host "Verificando Python..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Python no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "Por favor, instala Python 3.8 o superior" -ForegroundColor Red
    exit 1
}
Write-Host "✅ $pythonVersion" -ForegroundColor Green
Write-Host ""

# Verificar si existe venv
if (-not (Test-Path "venv")) {
    Write-Host "Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error creando entorno virtual" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Entorno virtual creado" -ForegroundColor Green
}

# Activar venv usando el método correcto para PowerShell
Write-Host "Activando entorno virtual..." -ForegroundColor Yellow
$activateScript = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
    Write-Host "✅ Entorno virtual activado" -ForegroundColor Green
} else {
    Write-Host "❌ No se encontró el script de activación" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Verificar que pip está disponible en el venv
$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "❌ Python del entorno virtual no encontrado" -ForegroundColor Red
    exit 1
}

# Instalar dependencias usando el Python del venv
Write-Host "Verificando dependencias..." -ForegroundColor Yellow
& $venvPython -m pip install -q -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencias verificadas" -ForegroundColor Green
Write-Host ""

# Cargar Gemini API Key desde .env si existe (OPCIONAL - mejora precisión)
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*GEMINI_API_KEY\s*=\s*(.+)$') {
            $env:GEMINI_API_KEY = $matches[1].Trim()
        }
    }
}
if ($env:GEMINI_API_KEY) {
    Write-Host "Gemini Vision API configurada (boost de precisión)" -ForegroundColor Green
} else {
    Write-Host "Motor principal: OpenCV (Gemini opcional via .env)" -ForegroundColor Cyan
}
Write-Host ""

# Ejecutar aplicación usando el Python del venv
Write-Host "Iniciando aplicación..." -ForegroundColor Yellow
Write-Host ""
& $venvPython main.py


# Build local del .exe + instalador NSIS — replica lo que hace
# .github/workflows/station-installer.yml pero desde tu PC.
#
# Uso:
#   cd station
#   .\build_local.ps1
#
# O con version explicita:
#   .\build_local.ps1 -Version "5.4.0"
#
# Resultado:
#   station/dist/SafeLink_Station/SafeLink_Station.exe   (bundle)
#   station/installer/SafeLinkStation_Setup_X.Y.Z.exe    (instalador NSIS)

param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ─── Resolver version ───────────────────────────────────────────────────
if (-not $Version) {
    if (Test-Path "version.txt") {
        $Version = (Get-Content "version.txt" -Raw).Trim()
    } else {
        $Version = "0.0.0-local"
    }
}
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Safe Link Station — Build local v$Version" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Inyectar build_info.py ──────────────────────────────────────────
Write-Host "[1/4] Inyectando build info..." -ForegroundColor Yellow
$sha = "local"
$run = "local-$(Get-Date -Format 'yyyyMMddHHmmss')"
try {
    $sha = (git rev-parse --short HEAD 2>$null).Trim()
} catch {}
python inject_build_info.py --version $Version --sha $sha --run $run
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error inyectando build info." -ForegroundColor Red
    exit 1
}

# ─── 2. Verificar deps ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Verificando PyInstaller..." -ForegroundColor Yellow
python -m PyInstaller --version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  PyInstaller no esta instalado. Instalando..." -ForegroundColor DarkYellow
    python -m pip install pyinstaller --quiet
}
python -c "import cv2, PyQt5, supabase, dotenv" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Faltan dependencias. Instalando requirements.txt..." -ForegroundColor DarkYellow
    python -m pip install -r requirements.txt --quiet
}

# ─── 3. PyInstaller ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Compilando bundle con PyInstaller (~3-5 min)..." -ForegroundColor Yellow
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "dist")  { Remove-Item -Recurse -Force "dist" }

pyinstaller SafeLink_Station.spec --noconfirm --clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error en PyInstaller" -ForegroundColor Red
    exit 1
}

$bundleExe = "dist\SafeLink_Station\SafeLink_Station.exe"
if (-not (Test-Path $bundleExe)) {
    Write-Host "  Bundle NO generado en $bundleExe" -ForegroundColor Red
    exit 1
}
$bundleSize = [math]::Round(((Get-ChildItem "dist\SafeLink_Station" -Recurse | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "  Bundle generado: $bundleSize MB" -ForegroundColor Green

# ─── 4. NSIS ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Compilando instalador NSIS..." -ForegroundColor Yellow

# Buscar makensis.exe
$nsis = "C:\Program Files (x86)\NSIS\makensis.exe"
if (-not (Test-Path $nsis)) { $nsis = "C:\Program Files\NSIS\makensis.exe" }
if (-not (Test-Path $nsis)) {
    Write-Host "  NSIS no encontrado." -ForegroundColor Red
    Write-Host "  Instala NSIS desde: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
    Write-Host "  O via choco: choco install nsis -y" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  El bundle .exe sin instalador esta en:" -ForegroundColor Yellow
    Write-Host "    $bundleExe" -ForegroundColor Cyan
    Write-Host "  Puedes correrlo directo desde ahi para probar." -ForegroundColor Yellow
    exit 0
}

Push-Location installer
& $nsis "/DAPP_VERSION=$Version" installer.nsi
$nsisCode = $LASTEXITCODE
Pop-Location

if ($nsisCode -ne 0) {
    Write-Host "  Error compilando NSIS" -ForegroundColor Red
    exit 1
}

$installer = Get-ChildItem -Path "installer\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$installerSize = [math]::Round($installer.Length / 1MB, 1)

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BUILD COMPLETADO" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Bundle:     $bundleExe ($bundleSize MB)"
Write-Host "  Instalador: $($installer.FullName) ($installerSize MB)"
Write-Host ""
Write-Host "  Para probar:"
Write-Host "    1. Cierra cualquier instancia de Safe Link Station abierta"
Write-Host "    2. Ejecuta el instalador: $($installer.Name)"
Write-Host "    3. Sigue el wizard (sobre la version anterior)"
Write-Host ""

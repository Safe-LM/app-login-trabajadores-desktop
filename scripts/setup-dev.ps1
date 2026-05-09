# Setup automatizado para desarrollo Safe Link
# Uso: .\scripts\setup-dev.ps1

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "OK  $msg"   -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!  $msg"   -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "ERR $msg"   -ForegroundColor Red }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Verificar pre-requisitos
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Verificando pre-requisitos"

try {
  $node = (node --version) -replace 'v', ''
  $major = [int]($node.Split('.')[0])
  if ($major -lt 20) {
    Write-Err "Node.js 20+ requerido. Tienes $node. Instala desde nodejs.org"
    exit 1
  }
  Write-Ok "Node.js $node"
} catch {
  Write-Err "Node.js no encontrado. Instala desde https://nodejs.org"
  exit 1
}

try {
  $py = (python --version) -replace 'Python ', ''
  Write-Ok "Python $py"
} catch {
  Write-Warn "Python no encontrado. Solo necesario para desarrollar la estacion."
}

try {
  $g = git --version
  Write-Ok $g
} catch {
  Write-Err "Git no encontrado. Instala desde https://git-scm.com"
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. Setup del panel web
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Instalando dependencias del panel web"

Set-Location web-panel

if (-not (Test-Path "node_modules")) {
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "npm install fallo, reintentando con --legacy-peer-deps"
    npm install --legacy-peer-deps
  }
} else {
  Write-Ok "node_modules ya existe (saltando install)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Variables de entorno
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Configurando .env.local"

$envPath = ".env.local"

if (-not (Test-Path $envPath)) {
  Write-Host ""
  Write-Host "No existe .env.local. Vamos a crearlo." -ForegroundColor Yellow
  Write-Host "Necesitas tu URL y keys de Supabase (Settings > API en el dashboard)."
  Write-Host ""
  $url = Read-Host "SUPABASE_URL (https://xxxxx.supabase.co)"
  $anon = Read-Host "SUPABASE_ANON_KEY"
  $service = Read-Host "SUPABASE_SERVICE_ROLE_KEY (opcional, enter para saltar)"

  $content = @"
NEXT_PUBLIC_SUPABASE_URL=$url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
"@

  if ($service) {
    $content += "`nSUPABASE_SERVICE_ROLE_KEY=$service"
  }

  Set-Content -Path $envPath -Value $content -Encoding utf8
  Write-Ok ".env.local creado"
} else {
  Write-Ok ".env.local ya existe"
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Frontend de estacion (build inicial)
# ─────────────────────────────────────────────────────────────────────────────
Set-Location ..

if (Test-Path "station/frontend/package.json") {
  Write-Step "Instalando dependencias del frontend de estacion"
  Set-Location station/frontend

  if (-not (Test-Path "node_modules")) {
    npm install
  } else {
    Write-Ok "node_modules ya existe"
  }

  if (-not (Test-Path "dist/index.html")) {
    Write-Step "Compilando frontend de estacion"
    npm run build
  } else {
    Write-Ok "Build ya existe (dist/)"
  }

  Set-Location ../..
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. Python deps de estacion (opcional)
# ─────────────────────────────────────────────────────────────────────────────
if (Test-Path "station/requirements.txt") {
  $resp = Read-Host "`nInstalar dependencias de Python para estacion? (s/N)"
  if ($resp -eq "s" -or $resp -eq "S") {
    Write-Step "Instalando deps de Python"
    pip install -r station/requirements.txt
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. Supabase CLI (opcional)
# ─────────────────────────────────────────────────────────────────────────────
try {
  $sv = (supabase --version)
  Write-Ok "Supabase CLI: $sv"

  $resp = Read-Host "`nAplicar migraciones a Supabase? (s/N)"
  if ($resp -eq "s" -or $resp -eq "S") {
    $ref = Read-Host "Project ref (xxxxx en https://xxxxx.supabase.co)"
    Set-Location supabase
    supabase link --project-ref $ref
    supabase db push
    supabase functions deploy generate-embedding
    Set-Location ..
  }
} catch {
  Write-Warn "Supabase CLI no instalada. Para deployar:"
  Write-Warn "  npm install -g supabase"
  Write-Warn "  o:    scoop install supabase"
}

# ─────────────────────────────────────────────────────────────────────────────
# Listo
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Setup completo." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para correr el panel web:"
Write-Host "  cd web-panel"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Para correr la estacion:"
Write-Host "  cd station"
Write-Host "  python run_station.py"
Write-Host ""
Write-Host "Mas info: docs/runbook-panel.md y docs/runbook-estacion.md"

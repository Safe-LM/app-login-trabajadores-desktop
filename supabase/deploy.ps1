# Deploy de Supabase: migraciones + edge functions
# Uso: .\supabase\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "[1/2] Aplicando migraciones..." -ForegroundColor Cyan
supabase db push

Write-Host "[2/2] Desplegando edge function generate-embedding..." -ForegroundColor Cyan
supabase functions deploy generate-embedding

Write-Host ""
Write-Host "Deploy completo." -ForegroundColor Green
Write-Host ""
Write-Host "Tablas con Realtime activo (verifica en dashboard > Database > Replication):"
Write-Host "  - registros_asistencia"
Write-Host "  - dispositivos"
Write-Host "  - comandos_estacion"

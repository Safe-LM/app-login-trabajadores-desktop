#!/usr/bin/env bash
# Deploy de Supabase: migraciones + edge functions
# Uso: bash supabase/deploy.sh

set -e

echo "→ Aplicando migraciones..."
supabase db push

echo "→ Desplegando edge function generate-embedding..."
supabase functions deploy generate-embedding

echo "✓ Deploy completo."
echo ""
echo "Tablas con Realtime activo (verifica en dashboard → Database → Replication):"
echo "  - registros_asistencia"
echo "  - dispositivos"
echo "  - comandos_estacion"

# Migraciones Supabase — Safe Link Monitoring

Directorio de migraciones SQL versionadas para el proyecto Supabase
`asistencia-safelm` (ref: `ctmpsokjdguygjqmxyob`).

## Convención de nombres

```
YYYYMMDD_descripcion_corta.sql
```

Por ejemplo:
- `20260429_multitenant_saas_v1.sql` — schema base
- `20260518_logs_recognition_telemetry.sql` — tipos de log nuevos

El orden alfabético = orden cronológico de aplicación.

## Cómo aplicar migraciones nuevas

### Opción 1: SQL Editor del Dashboard (recomendado para fixes puntuales)

1. Abrir [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/ctmpsokjdguygjqmxyob/sql/new)
2. Pegar el contenido del archivo `.sql`
3. Click **Run**
4. Si todo OK: commitear el archivo a `supabase/migrations/`

### Opción 2: Supabase CLI (recomendado para múltiples migraciones)

```bash
cd supabase
supabase login
supabase link --project-ref ctmpsokjdguygjqmxyob
supabase db push
```

`db push` detecta las migraciones nuevas (no aplicadas) y las ejecuta en orden.

### Opción 3: `psql` directo

```bash
psql "postgresql://postgres:[PASSWORD]@db.ctmpsokjdguygjqmxyob.supabase.co:5432/postgres" \
  -f supabase/migrations/20260518_logs_recognition_telemetry.sql
```

## Reglas de oro

1. **Idempotencia obligatoria.** Toda migración debe poder re-ejecutarse sin
   romper nada. Usa `IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`,
   etc. CI re-aplica las migraciones en cada deploy.

2. **No editar migraciones ya aplicadas en producción.** Si necesitas
   cambiar algo, crea una migración nueva con la fecha del cambio.

3. **Validar primero en una branch.** Supabase Pro permite branches —
   usar `supabase branches create test` antes de aplicar a producción.

4. **Documentar el "por qué".** Comentario al inicio del `.sql` explicando
   el motivo del cambio (sirve para auditoría y para entender después).

5. **Atómico cuando se pueda.** Una migración = un cambio lógico. Si
   necesitas varias cosas relacionadas, agrúpalas en BEGIN/COMMIT.

## Categorías de migraciones existentes

| Prefijo / tema | Qué incluye |
|---|---|
| `multitenant_saas_*` | Schema base: empresas, sucursales, empleados, RLS |
| `station_monitoring` / `provisioning` / `heartbeat` | Stack de estaciones (dispositivos, heartbeat, comandos, HWID) |
| `embeddings_*` / `pgvector` | Reconocimiento facial: tablas vectoriales + RPCs de upload/download |
| `audit_log` / `webhooks` | Auditoría + integraciones |
| `registrar_asistencia_station_*` | Evolución del RPC principal de fichaje |
| `logs_estacion_*` | Extensiones del CHECK constraint de `logs_estacion.tipo` |
| `fase1*` / `fase2*` | Auditoría de seguridad 2026-05-18 (RLS hardening) |
| `v_*` | Views (dashboards y agregaciones) |

## Auditoría de seguridad 2026-05-18

Las siguientes migraciones aplicaron hardening de RLS y performance:

- `fase1_perf_security_quick_wins` — wrap de `auth.*()` en `(select ...)`,
  índices de FK, fijar `search_path` en 35 funciones SECURITY DEFINER.
- `fase1b_remaining_perf_cleanups` — limpieza final de policies duplicadas
  y unused indexes.
- `fase2a_views_security_invoker` — `v_asistencias_hoy`, `v_kpis_sucursal_30d`,
  `v_dispositivos_estado` ahora son `SECURITY INVOKER` (respetan RLS por
  empresa en lugar de bypasearla).
- `fase2b_rls_hardening_app_metadata` — `auth_empresa_id()` lee de
  `app_metadata` (inmutable desde el cliente) con fallback a
  `user_metadata`. Cierra escalada de privilegios cross-empresa.
- `20260518_logs_recognition_telemetry.sql` — agrega 10 tipos de log nuevos
  al CHECK constraint de `logs_estacion.tipo` para telemetría del thread
  de reconocimiento facial.

Detalle completo en [`web-panel/README.md` → "Decisiones de seguridad"](../../web-panel/README.md).

## Linaje y desincronía con el historial de Supabase

A partir de `20260509042832_embeddings_batch_rpc`, todas las migraciones
quedan registradas en `supabase_migrations.schema_migrations` (visible vía
`supabase migration list` o `mcp__claude_ai_Supabase__list_migrations`).

Las migraciones anteriores a esa fecha se aplicaron por fuera (SQL Editor
del dashboard) y **no aparecen en el historial registrado**. Si haces
`supabase db push` desde cero contra una base limpia, todas se ejecutarían
en orden alfabético; en una base ya migrada, las recientes se omiten por
estar en el historial.

**Archivos legacy retirados (nunca aplicados a prod):**

- `20260430_crear_dispositivo_fn.sql` — versión inicial sin HWID. Superseded.
- `20260501_hwid_lock.sql` — añade HWID + redefine `station_heartbeat`. Su
  `crear_dispositivo` fue reemplazado por `20260519193010_crear_dispositivo_fn_with_hwid.sql`
  (aplicado vía MCP). Su `station_heartbeat` quedó obsoleto: la versión en
  prod tiene 8 parámetros (empleados_count, camara_ok, encodings_ver) que
  el archivo legacy no contemplaba — no se debe rollback a la versión vieja.

Si necesitas reconstruir prod desde cero, este README + el archivo `20260519193010_*`
documentan la divergencia. Para una sincronización completa considera
`supabase db pull` para extraer el schema actual como una migración nueva.

## Cómo deshacer una migración

Supabase no tiene rollback automático. Si una migración rompió algo:

1. **Si no la commiteaste aún:** restaurar desde el PITR (Point-in-Time
   Recovery) — Settings → Database → Backups. Restaura al timestamp
   ANTES de la migración.

2. **Si ya está en producción:** crear una migración inversa
   (`YYYYMMDD_revert_<nombre>.sql`) con los `DROP`/`ALTER` que reviertan
   el cambio. Nunca borres la migración original del repo.

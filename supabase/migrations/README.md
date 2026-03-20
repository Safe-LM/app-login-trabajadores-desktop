# Migraciones Supabase - Safe Link Monitoring

## Cómo aplicar la migración `20260312_mejorar_asistencias.sql`

### Opción 1: SQL Editor en el Dashboard de Supabase

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Crea una nueva query
4. Copia y pega todo el contenido de `20260312_mejorar_asistencias.sql`
5. Haz clic en **Run** para ejecutar

### Opción 2: Supabase CLI (si lo tienes configurado)

```bash
supabase db push
```

O ejecutar el archivo manualmente:

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f supabase/migrations/20260312_mejorar_asistencias.sql
```

---

## Qué incluye esta migración

| Cambio | Descripción |
|--------|-------------|
| **Vista `v_asistencias_con_nombre`** | Muestra asistencias con nombre del empleado, hora de llegada, ubicación, sucursal y puesto |
| **Columnas de retardos** | `hora_entrada_esperada` y `minutos_retardo` para control de llegadas tarde |
| **Trigger automático** | Calcula `minutos_retardo` cuando insertas con `hora_entrada_esperada` |
| **Índices** | Acelera consultas por empleado, timestamp y ubicación |
| **RLS** | Row Level Security habilitado con políticas para la app |

---

## Uso de la vista

En lugar de consultar `asistencias` y hacer JOIN manual, usa:

```sql
SELECT * FROM v_asistencias_con_nombre
ORDER BY hora_llegada DESC
LIMIT 50;
```

O desde la app (Supabase client):

```python
data = sb.from_("v_asistencias_con_nombre").select("*").order("hora_llegada", desc=True).limit(50).execute()
```

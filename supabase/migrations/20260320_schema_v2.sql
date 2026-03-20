-- =============================================================================
-- Migración v2: Rediseño de empleados y asistencias — Safe Link Monitoring
-- Fecha: 2026-03-20
-- Aplica encima de: 20260312_mejorar_asistencias.sql
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1: MEJORAS A LA TABLA empleados
-- =============================================================================

-- 1.1 Campos de contacto y estado
ALTER TABLE public.empleados
    ADD COLUMN IF NOT EXISTS activo          BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS email           TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS telefono        TEXT,
    ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.empleados.activo    IS 'FALSE = empleado dado de baja (soft delete)';
COMMENT ON COLUMN public.empleados.email     IS 'Correo de contacto/notificaciones';
COMMENT ON COLUMN public.empleados.updated_at IS 'Se actualiza automáticamente con cada UPDATE';

-- 1.2 Datos de horario por empleado (default de entrada)
ALTER TABLE public.empleados
    ADD COLUMN IF NOT EXISTS turno                 TEXT
        CHECK (turno IN ('mañana', 'tarde', 'noche', 'flexible')),
    ADD COLUMN IF NOT EXISTS hora_entrada_default  TIME DEFAULT '09:00:00';

COMMENT ON COLUMN public.empleados.turno               IS 'Turno habitual del empleado';
COMMENT ON COLUMN public.empleados.hora_entrada_default IS 'Hora de entrada esperada por defecto para cálculo de retardos';

-- 1.3 Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_empleados_updated_at ON public.empleados;
CREATE TRIGGER trg_empleados_updated_at
    BEFORE UPDATE ON public.empleados
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_updated_at();

-- 1.4 Índices sobre empleados para consultas de dashboard
CREATE INDEX IF NOT EXISTS idx_empleados_activo
    ON public.empleados (activo) WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_empleados_zona
    ON public.empleados (zona);

CREATE INDEX IF NOT EXISTS idx_empleados_sucursal
    ON public.empleados (sucursal);

CREATE INDEX IF NOT EXISTS idx_empleados_puesto
    ON public.empleados (puesto);

-- Índice de texto completo para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_empleados_nombre_fts
    ON public.empleados
    USING GIN (to_tsvector('spanish', COALESCE(nombre, '') || ' ' || COALESCE(apellido, '')));


-- =============================================================================
-- SECCIÓN 2: MEJORAS A LA TABLA asistencias
-- =============================================================================

-- 2.1 Campos de auditoría y trazabilidad
ALTER TABLE public.asistencias
    ADD COLUMN IF NOT EXISTS reconocimiento_facial  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS metodo                 TEXT    DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS dispositivo            TEXT,
    ADD COLUMN IF NOT EXISTS notas                  TEXT,
    ADD COLUMN IF NOT EXISTS sincronizado_en        TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.asistencias.reconocimiento_facial IS 'TRUE si fue reconocido por cámara/IA, FALSE si fue manual';
COMMENT ON COLUMN public.asistencias.metodo                IS 'Método de reconocimiento: hybrid, opencv, photo_matcher, gemini, manual';
COMMENT ON COLUMN public.asistencias.dispositivo           IS 'Hostname o nombre del dispositivo que registró';
COMMENT ON COLUMN public.asistencias.notas                 IS 'Observaciones opcionales del registro';
COMMENT ON COLUMN public.asistencias.sincronizado_en       IS 'Timestamp de sincronización con la nube';

-- 2.2 Constraint: metodo debe ser uno de los valores conocidos
ALTER TABLE public.asistencias
    DROP CONSTRAINT IF EXISTS asistencias_metodo_check;

ALTER TABLE public.asistencias
    ADD CONSTRAINT asistencias_metodo_check
    CHECK (metodo IN ('hybrid', 'opencv', 'photo_matcher', 'gemini', 'manual'));

-- 2.3 Índice adicional para auditoría por método
CREATE INDEX IF NOT EXISTS idx_asistencias_metodo
    ON public.asistencias (metodo);

CREATE INDEX IF NOT EXISTS idx_asistencias_reconocimiento
    ON public.asistencias (reconocimiento_facial);


-- =============================================================================
-- SECCIÓN 3: VISTAS MEJORADAS
-- =============================================================================

-- Eliminar vista legado primero para evitar conflicto de tipos de columna
-- (v_asistencias_con_nombre v1 tenía confianza FLOAT; la v2 usa NUMERIC)
DROP VIEW IF EXISTS public.v_asistencias_con_nombre;

-- 3.1 Vista completa de asistencias (reemplaza la anterior)
CREATE OR REPLACE VIEW public.v_asistencias_detalle AS
SELECT
    a.id,
    a.empleado_id,
    e.employee_id                                                          AS employee_number,
    TRIM(COALESCE(e.nombre, '') || ' ' || COALESCE(e.apellido, ''))       AS nombre_empleado,
    e.puesto,
    e.zona,
    e.sucursal,
    a.tipo,
    a.timestamp                                                            AS registrado_en,
    TO_CHAR(a.timestamp AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS') AS hora_local,
    TO_CHAR(a.timestamp AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') AS fecha_local,
    ROUND((a.confianza * 100)::NUMERIC, 1)                                AS confianza_pct,
    a.reconocimiento_facial,
    a.metodo,
    a.ubicacion,
    a.dispositivo,
    a.hora_entrada_esperada,
    a.minutos_retardo,
    CASE
        WHEN a.minutos_retardo IS NULL   THEN 'N/A'
        WHEN a.minutos_retardo = 0       THEN 'A tiempo'
        WHEN a.minutos_retardo <= 10     THEN 'Retardo leve'
        WHEN a.minutos_retardo <= 30     THEN 'Retardo moderado'
        ELSE                                  'Retardo grave'
    END                                                                    AS clasificacion_retardo,
    a.notas,
    a.sincronizado_en
FROM public.asistencias a
LEFT JOIN public.empleados e ON e.id = a.empleado_id
ORDER BY a.timestamp DESC;

COMMENT ON VIEW public.v_asistencias_detalle IS 'Vista completa de asistencias con datos de empleado, retardos y clasificación';

-- Mantener la vista anterior como alias para no romper código existente
CREATE OR REPLACE VIEW public.v_asistencias_con_nombre AS
SELECT
    id,
    empleado_id,
    nombre_empleado,
    tipo,
    registrado_en        AS hora_llegada,
    confianza_pct / 100  AS confianza,
    ubicacion,
    hora_entrada_esperada,
    minutos_retardo,
    sucursal             AS sucursal_empleado,
    puesto
FROM public.v_asistencias_detalle;

COMMENT ON VIEW public.v_asistencias_con_nombre IS 'Vista de compatibilidad — usar v_asistencias_detalle para nuevas queries';

-- 3.2 Vista: estado actual de cada empleado (última acción del día)
CREATE OR REPLACE VIEW public.v_estado_empleados_hoy AS
WITH ultima_asistencia AS (
    SELECT DISTINCT ON (empleado_id)
        empleado_id,
        tipo            AS ultimo_tipo,
        timestamp       AS ultimo_registro,
        metodo,
        confianza
    FROM public.asistencias
    WHERE timestamp::DATE = CURRENT_DATE
    ORDER BY empleado_id, timestamp DESC
)
SELECT
    e.id,
    e.employee_id,
    TRIM(COALESCE(e.nombre, '') || ' ' || COALESCE(e.apellido, '')) AS nombre_completo,
    e.puesto,
    e.zona,
    e.sucursal,
    e.turno,
    e.hora_entrada_default,
    COALESCE(ua.ultimo_tipo, 'sin_registro')                        AS estado_hoy,
    ua.ultimo_registro,
    TO_CHAR(ua.ultimo_registro AT TIME ZONE 'America/Mexico_City', 'HH24:MI') AS hora_ultimo,
    ROUND((ua.confianza * 100)::NUMERIC, 1)                         AS confianza_pct,
    ua.metodo,
    e.activo
FROM public.empleados e
LEFT JOIN ultima_asistencia ua ON ua.empleado_id = e.id
WHERE e.activo = TRUE
ORDER BY e.sucursal, e.zona, COALESCE(e.nombre, '');

COMMENT ON VIEW public.v_estado_empleados_hoy IS 'Estado actual de cada empleado: si registró entrada, salida o no ha marcado hoy';

-- 3.3 Vista: resumen de asistencias por sucursal y día
CREATE OR REPLACE VIEW public.v_resumen_diario AS
SELECT
    DATE(a.timestamp AT TIME ZONE 'America/Mexico_City')            AS fecha,
    e.sucursal,
    e.zona,
    COUNT(*) FILTER (WHERE a.tipo = 'entrada')                      AS total_entradas,
    COUNT(*) FILTER (WHERE a.tipo = 'salida')                       AS total_salidas,
    COUNT(*) FILTER (WHERE a.minutos_retardo > 0)                   AS empleados_con_retardo,
    ROUND(AVG(a.minutos_retardo) FILTER (WHERE a.minutos_retardo > 0), 1) AS promedio_minutos_retardo,
    ROUND((AVG(a.confianza) * 100)::NUMERIC, 1)                     AS confianza_promedio_pct
FROM public.asistencias a
LEFT JOIN public.empleados e ON e.id = a.empleado_id
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;

COMMENT ON VIEW public.v_resumen_diario IS 'KPIs diarios por sucursal: entradas, salidas, retardos y confianza promedio';


-- =============================================================================
-- SECCIÓN 4: FUNCIÓN actualizar retardo usando hora_entrada_default del empleado
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_calcular_minutos_retardo()
RETURNS TRIGGER AS $$
DECLARE
    hora_esp TIME;
BEGIN
    -- Usar hora_entrada_esperada del registro si está definida,
    -- si no, usar el default del empleado
    IF NEW.hora_entrada_esperada IS NOT NULL THEN
        hora_esp := NEW.hora_entrada_esperada;
    ELSE
        SELECT hora_entrada_default
        INTO   hora_esp
        FROM   public.empleados
        WHERE  id = NEW.empleado_id;
    END IF;

    IF hora_esp IS NOT NULL AND NEW.tipo = 'entrada' AND NEW.timestamp IS NOT NULL THEN
        IF (NEW.timestamp::TIME) > hora_esp THEN
            NEW.minutos_retardo := EXTRACT(EPOCH FROM (
                (NEW.timestamp::TIME) - hora_esp
            ))::INTEGER / 60;
        ELSE
            NEW.minutos_retardo := 0;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe (20260312), solo se reemplaza la función.


-- =============================================================================
-- SECCIÓN 5: POLÍTICAS RLS — ajuste para service_role sin restricciones
-- =============================================================================

-- Asistencias: añadir UPDATE y DELETE para service_role (admin/script)
DROP POLICY IF EXISTS "Permitir actualizacion asistencias" ON public.asistencias;
CREATE POLICY "Permitir actualizacion asistencias"
    ON public.asistencias FOR UPDATE
    TO service_role
    USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion asistencias" ON public.asistencias;
CREATE POLICY "Permitir eliminacion asistencias"
    ON public.asistencias FOR DELETE
    TO service_role
    USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion empleados" ON public.empleados;
CREATE POLICY "Permitir eliminacion empleados"
    ON public.empleados FOR DELETE
    TO service_role
    USING (true);


-- =============================================================================
-- Finalizado — v2 aplicada
-- =============================================================================

-- =============================================================================
-- Migración: Mejoras al control de asistencias (Safe Link Monitoring)
-- Fecha: 2026-03-12
-- Descripción: Vista con nombre+hora, retardos, índices y RLS
--              (Sin lógica de salida, solo control de llegada)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AÑADIR COLUMNAS PARA RETARDOS (solo entradas)
-- -----------------------------------------------------------------------------
ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS hora_entrada_esperada TIME DEFAULT NULL;

ALTER TABLE public.asistencias
ADD COLUMN IF NOT EXISTS minutos_retardo INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.asistencias.hora_entrada_esperada IS 'Hora programada de entrada para calcular retardos';
COMMENT ON COLUMN public.asistencias.minutos_retardo IS 'Minutos de retardo respecto a hora_entrada_esperada (NULL si no aplica)';

-- -----------------------------------------------------------------------------
-- 2. CREAR VISTA: asistencias con nombre del empleado y hora de llegada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_asistencias_con_nombre AS
SELECT
    a.id,
    a.empleado_id,
    TRIM(COALESCE(e.nombre, '') || ' ' || COALESCE(e.apellido, '')) AS nombre_empleado,
    a.tipo,
    a.timestamp AS hora_llegada,
    a.confianza,
    a.ubicacion,
    a.hora_entrada_esperada,
    a.minutos_retardo,
    e.sucursal AS sucursal_empleado,
    e.puesto
FROM public.asistencias a
LEFT JOIN public.empleados e ON e.id = a.empleado_id
ORDER BY a.timestamp DESC;

COMMENT ON VIEW public.v_asistencias_con_nombre IS 'Vista unificada: asistencias con nombre del empleado, hora de llegada y ubicación';

-- -----------------------------------------------------------------------------
-- 3. ÍNDICES para acelerar consultas
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_asistencias_empleado_id
    ON public.asistencias (empleado_id);

CREATE INDEX IF NOT EXISTS idx_asistencias_timestamp
    ON public.asistencias (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_asistencias_ubicacion
    ON public.asistencias (ubicacion);

CREATE INDEX IF NOT EXISTS idx_asistencias_empleado_timestamp
    ON public.asistencias (empleado_id, timestamp DESC);

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todo a rol authenticated y service_role (para la app)
DROP POLICY IF EXISTS "Permitir lectura asistencias" ON public.asistencias;
CREATE POLICY "Permitir lectura asistencias"
    ON public.asistencias FOR SELECT
    TO authenticated, service_role, anon
    USING (true);

DROP POLICY IF EXISTS "Permitir insercion asistencias" ON public.asistencias;
CREATE POLICY "Permitir insercion asistencias"
    ON public.asistencias FOR INSERT
    TO authenticated, service_role, anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura empleados" ON public.empleados;
CREATE POLICY "Permitir lectura empleados"
    ON public.empleados FOR SELECT
    TO authenticated, service_role, anon
    USING (true);

-- La app necesita insertar empleados en migraciones/limpieza
DROP POLICY IF EXISTS "Permitir insercion empleados" ON public.empleados;
CREATE POLICY "Permitir insercion empleados"
    ON public.empleados FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion empleados" ON public.empleados;
CREATE POLICY "Permitir actualizacion empleados"
    ON public.empleados FOR UPDATE
    TO authenticated, service_role
    USING (true);

-- Política para la vista (las vistas heredan del underlying table, pero por si acaso)
-- Nota: Las vistas no tienen RLS propio, usan las tablas base.

-- -----------------------------------------------------------------------------
-- 5. FUNCIÓN Y TRIGGER: calcular minutos_retardo automáticamente (opcional)
--    Solo si hora_entrada_esperada está definida en el registro
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_calcular_minutos_retardo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hora_entrada_esperada IS NOT NULL AND NEW.timestamp IS NOT NULL THEN
        -- Extraer solo la hora del timestamp
        IF (NEW.timestamp::TIME) > NEW.hora_entrada_esperada THEN
            NEW.minutos_retardo := EXTRACT(EPOCH FROM (
                (NEW.timestamp::TIME) - NEW.hora_entrada_esperada
            ))::INTEGER / 60;
        ELSE
            NEW.minutos_retardo := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calcular_retardo ON public.asistencias;
CREATE TRIGGER trg_calcular_retardo
    BEFORE INSERT OR UPDATE ON public.asistencias
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_calcular_minutos_retardo();

-- -----------------------------------------------------------------------------
-- Finalizado
-- -----------------------------------------------------------------------------

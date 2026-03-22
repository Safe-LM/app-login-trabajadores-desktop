-- =============================================================================
-- Migración: Tabla de sucursales con horarios de apertura
-- Fecha: 2026-03-22
-- Nombres exactos según campo `sucursal` en tabla empleados
-- =============================================================================

-- 1. Crear tabla sucursales
CREATE TABLE IF NOT EXISTS public.sucursales (
    id               SERIAL PRIMARY KEY,
    nombre           TEXT    NOT NULL UNIQUE,
    hora_apertura    TIME    NOT NULL,
    hora_cierre      TIME    NOT NULL,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.sucursales                IS 'Catálogo de tiendas con horarios de operación';
COMMENT ON COLUMN public.sucursales.hora_apertura  IS 'Hora de apertura (usada como hora_entrada_default de empleados)';
COMMENT ON COLUMN public.sucursales.hora_cierre    IS 'Hora de cierre de la tienda';

-- 2. Trigger updated_at
DROP TRIGGER IF EXISTS trg_sucursales_updated_at ON public.sucursales;
CREATE TRIGGER trg_sucursales_updated_at
    BEFORE UPDATE ON public.sucursales
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_updated_at();

-- 3. Insertar/actualizar con nombres exactos que usa la tabla empleados
INSERT INTO public.sucursales (nombre, hora_apertura, hora_cierre) VALUES
    -- Apertura 09:00
    ('AMERICAS QRO',      '09:00', '20:00'),
    ('ESFERA QRO',        '09:00', '20:00'),
    ('MIGUEL LAURENT',    '09:00', '20:00'),
    ('MIRAMONTES',        '09:00', '20:00'),
    ('SAN JERONIMO',      '09:00', '20:00'),
    ('B QUINTANA',        '09:00', '20:00'),
    -- Apertura 10:00
    ('ACOXPA',            '10:00', '20:00'),
    ('PLAZA CUERNAVACA',  '10:00', '19:00'),
    ('PLAZA CUERNAVAC',   '10:00', '19:00'),  -- versión truncada en BD
    ('AGUILAS',           '10:00', '19:00'),
    ('PTAL CENTENARIO',   '10:00', '19:00'),
    ('CIMATARIO',         '10:00', '20:00'),
    ('AV TOLUCA',         '10:00', '19:00'),
    ('COPILCO',           '10:00', '19:00'),
    ('SAN MATEO',         '10:00', '19:00'),
    ('TOLTECAS',          '10:00', '19:00'),
    ('POLANCO',           '10:00', '19:00'),
    ('RIO MAYO',          '10:00', '19:00'),
    ('TECAMACHALCO',      '10:00', '19:00'),
    -- Apertura 11:00
    ('CUEMANCO',          '11:00', '20:00'),
    ('PLAZA ORIENTE',     '11:00', '20:00'),
    ('CIRCUNVALACION',    '11:00', '20:00'),
    ('METEPEC',           '11:00', '20:00')
ON CONFLICT (nombre) DO UPDATE
    SET hora_apertura = EXCLUDED.hora_apertura,
        hora_cierre   = EXCLUDED.hora_cierre,
        updated_at    = NOW();

-- 4. Actualizar hora_entrada_default en empleados según su sucursal
UPDATE public.empleados e
SET hora_entrada_default = s.hora_apertura
FROM public.sucursales s
WHERE e.sucursal = s.nombre;

-- 5. Vista empleados con horario de sucursal
CREATE OR REPLACE VIEW public.v_empleados_con_horario AS
SELECT
    e.*,
    s.hora_apertura AS sucursal_hora_apertura,
    s.hora_cierre   AS sucursal_hora_cierre
FROM public.empleados e
LEFT JOIN public.sucursales s ON s.nombre = e.sucursal;

COMMENT ON VIEW public.v_empleados_con_horario IS 'Empleados con horario de su sucursal adjunto';

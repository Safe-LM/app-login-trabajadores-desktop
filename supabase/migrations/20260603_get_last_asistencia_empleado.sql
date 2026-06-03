-- =============================================================================
-- Migración: get_last_asistencia_empleado RPC
-- Fecha: 2026-06-03
-- Devuelve la última asistencia del día del empleado para resolver el tipo (entrada/salida) en la estación
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_last_asistencia_empleado(
  p_api_key     text,
  p_empleado_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_device dispositivos%ROWTYPE;
  v_tipo   text;
  v_time   timestamptz;
BEGIN
  -- Validar la api_key de la estación
  SELECT * INTO v_device FROM dispositivos WHERE api_key = p_api_key AND activo = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key inválida');
  END IF;

  -- Buscar la última marcación del empleado del día de hoy en la zona horaria de México
  SELECT tipo, timestamp INTO v_tipo, v_time
    FROM registros_asistencia
   WHERE empleado_id = p_empleado_id
     AND (timestamp AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
   ORDER BY timestamp DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', TRUE, 'tipo', NULL);
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'tipo', v_tipo, 'timestamp', v_time::text);
END;
$$;

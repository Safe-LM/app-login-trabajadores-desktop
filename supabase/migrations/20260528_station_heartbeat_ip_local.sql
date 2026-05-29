-- Bug: station_heartbeat guardaba la IP en 'ultima_ip', pero la vista
-- v_dispositivos_estado y el panel leen 'ip_local'. Resultado: el panel
-- mostraba "—" en IP local aunque la estacion SI la enviaba y capturaba.
-- Mismo patron de columna duplicada que activa/activo.
--
-- Fix: el heartbeat ahora escribe AMBAS columnas (ip_local canonica para el
-- panel, ultima_ip por compat con lectores legacy) + backfill.

UPDATE public.dispositivos
   SET ip_local = ultima_ip
 WHERE ip_local IS NULL AND ultima_ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public.station_heartbeat(
  p_api_key text,
  p_ip_local text DEFAULT NULL::text,
  p_hostname text DEFAULT NULL::text,
  p_version text DEFAULT NULL::text,
  p_hwid text DEFAULT NULL::text,
  p_empleados_count integer DEFAULT NULL::integer,
  p_camara_ok boolean DEFAULT NULL::boolean,
  p_encodings_ver integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rec    dispositivos%ROWTYPE;
  v_health INTEGER;
BEGIN
  SELECT * INTO v_rec FROM dispositivos WHERE api_key = p_api_key LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key inválida', 'revocada', FALSE);
  END IF;

  IF NOT v_rec.activa THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Estación revocada', 'revocada', TRUE);
  END IF;

  v_health := 0;
  IF p_camara_ok = TRUE                THEN v_health := v_health + 30; END IF;
  IF COALESCE(p_empleados_count,0) > 0 THEN v_health := v_health + 40; END IF;
  IF p_encodings_ver IS NOT NULL AND p_encodings_ver > 0 THEN v_health := v_health + 30; END IF;

  UPDATE dispositivos SET
    heartbeat_at      = NOW(),
    ip_local          = COALESCE(p_ip_local, ip_local),
    ultima_ip         = COALESCE(p_ip_local, ultima_ip),
    hostname          = COALESCE(p_hostname, hostname),
    version_app       = COALESCE(p_version, version_app),
    hwid              = COALESCE(p_hwid, hwid),
    empleados_count   = COALESCE(p_empleados_count, empleados_count),
    camara_ok         = COALESCE(p_camara_ok, camara_ok),
    encodings_version = COALESCE(p_encodings_ver, encodings_version),
    health_score      = v_health
  WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'ok',             TRUE,
    'dispositivo_id', v_rec.id,
    'empresa_id',     v_rec.empresa_id,
    'sucursal_id',    v_rec.sucursal_id,
    'nombre',         v_rec.nombre,
    'config',         COALESCE(v_rec.config, '{}'::jsonb),
    'revocada',       FALSE
  );
END;
$function$;

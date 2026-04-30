-- Agregar columnas de monitoreo a dispositivos
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS ip_local TEXT;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS version_app TEXT;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Vista para monitoreo en tiempo real con estado calculado
CREATE OR REPLACE VIEW v_dispositivos_estado AS
SELECT
  d.id,
  d.empresa_id,
  d.sucursal_id,
  d.nombre,
  d.api_key,
  d.activo,
  d.ip_local,
  d.hostname,
  d.heartbeat_at,
  d.version_app,
  d.config,
  s.nombre AS sucursal_nombre,
  CASE
    WHEN d.heartbeat_at IS NULL THEN 'nunca'
    WHEN d.heartbeat_at > NOW() - INTERVAL '2 minutes' THEN 'online'
    WHEN d.heartbeat_at > NOW() - INTERVAL '10 minutes' THEN 'alerta'
    ELSE 'offline'
  END AS estado_conexion,
  EXTRACT(EPOCH FROM (NOW() - d.heartbeat_at))::INT AS segundos_desde_heartbeat
FROM dispositivos d
LEFT JOIN sucursales s ON s.id = d.sucursal_id;

-- RLS: solo empresa propia puede ver sus dispositivos
ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispositivos_empresa" ON dispositivos;
CREATE POLICY "dispositivos_empresa" ON dispositivos
  USING (empresa_id = auth_empresa_id());

-- Funcion para que la estacion haga heartbeat con su api_key
CREATE OR REPLACE FUNCTION station_heartbeat(
  p_api_key TEXT,
  p_ip_local TEXT DEFAULT NULL,
  p_hostname TEXT DEFAULT NULL,
  p_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_device dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_device FROM dispositivos WHERE api_key = p_api_key AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida o dispositivo inactivo');
  END IF;

  UPDATE dispositivos SET
    heartbeat_at  = NOW(),
    ip_local      = COALESCE(p_ip_local, ip_local),
    hostname      = COALESCE(p_hostname, hostname),
    version_app   = COALESCE(p_version, version_app),
    ultima_conexion = NOW()
  WHERE id = v_device.id;

  RETURN jsonb_build_object(
    'ok', true,
    'dispositivo_id', v_device.id,
    'empresa_id', v_device.empresa_id,
    'sucursal_id', v_device.sucursal_id,
    'nombre', v_device.nombre,
    'config', v_device.config
  );
END;
$$;

-- Funcion para registrar asistencia con api_key (sin auth de usuario)
CREATE OR REPLACE FUNCTION registrar_asistencia_station(
  p_api_key      TEXT,
  p_empleado_id  UUID,
  p_tipo         TEXT,
  p_confianza    FLOAT DEFAULT NULL,
  p_notas        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_device dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_device FROM dispositivos WHERE api_key = p_api_key AND activo = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  INSERT INTO registros_asistencia (
    empresa_id, empleado_id, dispositivo_id, sucursal_id,
    tipo, confianza, reconocimiento_facial, sincronizado
  ) VALUES (
    v_device.empresa_id, p_empleado_id, v_device.id, v_device.sucursal_id,
    p_tipo, p_confianza, TRUE, TRUE
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

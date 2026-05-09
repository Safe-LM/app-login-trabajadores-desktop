-- ═══════════════════════════════════════════════════════════════════════════
-- Safe Link Monitoring — Zero-Touch Provisioning + Health System
-- Migración: 20260503_provisioning.sql
-- Aplica en: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de provisioning en dispositivos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS hwid              TEXT,
  ADD COLUMN IF NOT EXISTS ultima_ip         TEXT,
  ADD COLUMN IF NOT EXISTS version_app       TEXT,
  ADD COLUMN IF NOT EXISTS activa            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS par_codigo        TEXT,
  ADD COLUMN IF NOT EXISTS par_expira_en     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS empleados_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_sync_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS encodings_version INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camara_ok         BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS health_score      INTEGER DEFAULT 0;

-- Índice único en hwid
CREATE UNIQUE INDEX IF NOT EXISTS dispositivos_hwid_idx
  ON dispositivos (hwid) WHERE hwid IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_api_key_by_hwid — estación llama esto cada 5s en provisioning
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_api_key_by_hwid(p_hwid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_rec
    FROM dispositivos
   WHERE hwid = p_hwid AND activa = TRUE
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'pendiente', TRUE);
  END IF;

  IF v_rec.heartbeat_at IS NULL THEN
    UPDATE dispositivos SET heartbeat_at = NOW() WHERE id = v_rec.id;
  END IF;

  RETURN jsonb_build_object(
    'ok',             TRUE,
    'api_key',        v_rec.api_key,
    'dispositivo_id', v_rec.id,
    'nombre',         v_rec.nombre,
    'empresa_id',     v_rec.empresa_id,
    'sucursal_id',    v_rec.sucursal_id
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. vincular_estacion_hwid — panel web llama esto al registrar estación
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vincular_estacion_hwid(
  p_user_id     UUID,
  p_hwid        TEXT,
  p_nombre      TEXT,
  p_sucursal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_api_key    TEXT;
  v_device_id  UUID;
  v_existing   dispositivos%ROWTYPE;
BEGIN
  -- Obtener empresa del usuario desde metadata
  SELECT (raw_user_meta_data->>'empresa_id')::UUID INTO v_empresa_id
    FROM auth.users WHERE id = p_user_id;

  -- Fallback: buscar en tabla empresas
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM empresas WHERE creado_por = p_user_id LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'No se encontró empresa para este usuario');
  END IF;

  SELECT * INTO v_existing FROM dispositivos WHERE hwid = p_hwid LIMIT 1;

  v_api_key := 'slm_' || encode(gen_random_bytes(24), 'hex');

  IF FOUND THEN
    UPDATE dispositivos SET
      nombre      = p_nombre,
      sucursal_id = COALESCE(p_sucursal_id, sucursal_id),
      empresa_id  = v_empresa_id,
      api_key     = v_api_key,
      activa      = TRUE,
      updated_at  = NOW()
    WHERE id = v_existing.id
    RETURNING id INTO v_device_id;
  ELSE
    INSERT INTO dispositivos (nombre, empresa_id, sucursal_id, api_key, hwid, activa, creado_por)
    VALUES (p_nombre, v_empresa_id, p_sucursal_id, v_api_key, p_hwid, TRUE, p_user_id)
    RETURNING id INTO v_device_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',             TRUE,
    'api_key',        v_api_key,
    'dispositivo_id', v_device_id,
    'empresa_id',     v_empresa_id
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. station_heartbeat — latido cada 60s + detección de revocación
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION station_heartbeat(
  p_api_key        TEXT,
  p_ip_local       TEXT    DEFAULT NULL,
  p_hostname       TEXT    DEFAULT NULL,
  p_version        TEXT    DEFAULT NULL,
  p_hwid           TEXT    DEFAULT NULL,
  p_empleados_count INTEGER DEFAULT NULL,
  p_camara_ok      BOOLEAN DEFAULT NULL,
  p_encodings_ver  INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec        dispositivos%ROWTYPE;
  v_health     INTEGER;
BEGIN
  SELECT * INTO v_rec FROM dispositivos WHERE api_key = p_api_key LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key inválida', 'revocada', FALSE);
  END IF;

  IF NOT v_rec.activa THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Estación revocada', 'revocada', TRUE);
  END IF;

  -- Calcular health score (0-100)
  v_health := 0;
  IF p_camara_ok = TRUE              THEN v_health := v_health + 30; END IF;
  IF COALESCE(p_empleados_count,0) > 0 THEN v_health := v_health + 40; END IF;
  IF p_encodings_ver IS NOT NULL AND p_encodings_ver > 0 THEN v_health := v_health + 30; END IF;

  UPDATE dispositivos SET
    heartbeat_at      = NOW(),
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
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. station_sync_done — estación reporta sync completado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION station_sync_done(
  p_api_key        TEXT,
  p_empleados_count INTEGER,
  p_encodings_ver  INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_rec FROM dispositivos WHERE api_key = p_api_key AND activa = TRUE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key inválida');
  END IF;

  UPDATE dispositivos SET
    empleados_count   = p_empleados_count,
    ultimo_sync_at    = NOW(),
    encodings_version = COALESCE(p_encodings_ver, encodings_version)
  WHERE id = v_rec.id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. notificar_sync_empleados — al crear/editar empleado, avisa a todas
--    las estaciones de esa empresa para sync inmediato
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notificar_sync_empleados(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_disp RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_disp IN
    SELECT id, api_key FROM dispositivos
     WHERE empresa_id = p_empresa_id AND activa = TRUE
  LOOP
    INSERT INTO comandos_estacion (dispositivo_id, empresa_id, tipo, payload, creado_en)
    VALUES (v_disp.id, p_empresa_id, 'sync_empleados', '{}'::jsonb, NOW())
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE, 'estaciones_notificadas', v_count);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Trigger: al insertar/actualizar empleado → notificar estaciones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _trigger_empleado_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo notificar si el empleado tiene foto (tiene sentido para reconocimiento)
  IF NEW.foto_url IS NOT NULL OR OLD.foto_url IS DISTINCT FROM NEW.foto_url THEN
    PERFORM notificar_sync_empleados(NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empleado_sync ON empleados;
CREATE TRIGGER trg_empleado_sync
  AFTER INSERT OR UPDATE OF foto_url, nombre, apellido, activo
  ON empleados
  FOR EACH ROW
  EXECUTE FUNCTION _trigger_empleado_sync();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. revocar_estacion — panel web revoca una estación
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION revocar_estacion(
  p_user_id        UUID,
  p_dispositivo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT (raw_user_meta_data->>'empresa_id')::UUID INTO v_empresa_id
    FROM auth.users WHERE id = p_user_id;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM empresas WHERE creado_por = p_user_id LIMIT 1;
  END IF;

  UPDATE dispositivos
     SET activa  = FALSE,
         api_key = 'revoked_' || gen_random_uuid()::TEXT
   WHERE id = p_dispositivo_id AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Dispositivo no encontrado');
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. get_dispositivos_empresa — vista enriquecida para el panel web
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dispositivos_empresa(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_result     JSONB;
BEGIN
  SELECT (raw_user_meta_data->>'empresa_id')::UUID INTO v_empresa_id
    FROM auth.users WHERE id = p_user_id;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM empresas WHERE creado_por = p_user_id LIMIT 1;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                d.id,
      'nombre',            d.nombre,
      'activa',            d.activa,
      'api_key',           d.api_key,
      'hwid',              d.hwid,
      'ip_local',          d.ultima_ip,
      'hostname',          d.hostname,
      'heartbeat_at',      d.heartbeat_at,
      'version_app',       d.version_app,
      'sucursal_id',       d.sucursal_id,
      'sucursal_nombre',   s.nombre,
      'empleados_count',   COALESCE(d.empleados_count, 0),
      'ultimo_sync_at',    d.ultimo_sync_at,
      'encodings_version', COALESCE(d.encodings_version, 0),
      'camara_ok',         d.camara_ok,
      'health_score',      COALESCE(d.health_score, 0),
      'segundos_desde_heartbeat',
        CASE WHEN d.heartbeat_at IS NULL THEN NULL
             ELSE EXTRACT(EPOCH FROM (NOW() - d.heartbeat_at))::INTEGER
        END,
      'estado_conexion',
        CASE
          WHEN d.heartbeat_at IS NULL                                          THEN 'nunca'
          WHEN EXTRACT(EPOCH FROM (NOW() - d.heartbeat_at)) < 90              THEN 'online'
          WHEN EXTRACT(EPOCH FROM (NOW() - d.heartbeat_at)) < 300             THEN 'alerta'
          ELSE 'offline'
        END
    )
  ) INTO v_result
  FROM dispositivos d
  LEFT JOIN sucursales s ON s.id = d.sucursal_id
  WHERE d.empresa_id = v_empresa_id
  ORDER BY d.created_at;

  RETURN jsonb_build_object('ok', TRUE, 'dispositivos', COALESCE(v_result, '[]'::jsonb));
END;
$$;

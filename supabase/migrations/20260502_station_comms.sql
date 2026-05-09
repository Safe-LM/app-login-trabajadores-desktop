-- ============================================================
-- Safe Link — Station Communications v1
-- Tablas: logs_estacion, comandos_estacion
-- RPCs:   get_empleados_empresa, insertar_log_estacion,
--         enviar_comando_estacion, marcar_comando_ejecutado
-- ============================================================

-- ============================================================
-- 1. LOGS DE ESTACIÓN
--    La estación reporta eventos: sync, reconocimiento, error, heartbeat
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_estacion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id  uuid NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN (
                    'sync_ok', 'sync_error',
                    'reconocimiento_ok', 'reconocimiento_fallo',
                    'asistencia_registrada', 'asistencia_offline',
                    'camara_error', 'camara_ok',
                    'error', 'info'
                  )),
  detalle         jsonb NOT NULL DEFAULT '{}',
  creado_en       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_dispositivo ON logs_estacion(dispositivo_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_logs_empresa     ON logs_estacion(empresa_id, creado_en DESC);

-- RLS
ALTER TABLE logs_estacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_empresa" ON logs_estacion;
CREATE POLICY "logs_empresa" ON logs_estacion
  USING (empresa_id = auth_empresa_id());

-- ============================================================
-- 2. COMANDOS DE ESTACIÓN
--    El panel web manda órdenes; la estación las ejecuta vía Realtime
-- ============================================================
CREATE TABLE IF NOT EXISTS comandos_estacion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id  uuid NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN (
                    'sync_empleados',
                    'reiniciar_app',
                    'limpiar_cache'
                  )),
  payload         jsonb NOT NULL DEFAULT '{}',
  creado_en       timestamptz NOT NULL DEFAULT NOW(),
  ejecutado_en    timestamptz,
  resultado       text
);

CREATE INDEX IF NOT EXISTS idx_comandos_dispositivo ON comandos_estacion(dispositivo_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_comandos_pendientes  ON comandos_estacion(dispositivo_id) WHERE ejecutado_en IS NULL;

ALTER TABLE comandos_estacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comandos_empresa" ON comandos_estacion;
CREATE POLICY "comandos_empresa" ON comandos_estacion
  USING (empresa_id = auth_empresa_id());

-- Habilitar Realtime para que la estación reciba comandos al instante
ALTER PUBLICATION supabase_realtime ADD TABLE comandos_estacion;

-- ============================================================
-- 3. RPC: get_empleados_empresa
--    La estación llama esto con su api_key y recibe todos sus empleados
--    con la URL pública de la foto en Storage
-- ============================================================
CREATE OR REPLACE FUNCTION get_empleados_empresa(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_result     jsonb;
BEGIN
  -- Validar api_key y obtener empresa_id
  SELECT empresa_id INTO v_empresa_id
  FROM dispositivos
  WHERE api_key = p_api_key AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  -- Retornar empleados activos con sus datos y foto
  SELECT jsonb_build_object(
    'ok', true,
    'empresa_id', v_empresa_id::text,
    'empleados', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          e.id::text,
        'nombre',      e.nombre,
        'apellido',    e.apellido,
        'puesto',      COALESCE(e.puesto, ''),
        'sucursal_id', COALESCE(e.sucursal_id::text, ''),
        'activo',      e.activo,
        'enrollado',   e.enrollado,
        'foto_url',    COALESCE(e.foto_url, ''),
        'updated_at',  COALESCE(e.updated_at::text, e.creado_en::text)
      )
      ORDER BY e.apellido, e.nombre
    ), '[]'::jsonb)
  ) INTO v_result
  FROM empleados e
  WHERE e.empresa_id = v_empresa_id AND e.activo = TRUE;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 4. RPC: insertar_log_estacion
--    La estación reporta eventos sin necesitar auth de usuario
-- ============================================================
CREATE OR REPLACE FUNCTION insertar_log_estacion(
  p_api_key      TEXT,
  p_tipo         TEXT,
  p_detalle      JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_device dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_device
  FROM dispositivos
  WHERE api_key = p_api_key AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  INSERT INTO logs_estacion (dispositivo_id, empresa_id, tipo, detalle)
  VALUES (v_device.id, v_device.empresa_id, p_tipo, p_detalle);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 5. RPC: enviar_comando_estacion
--    El panel web manda un comando a una estación específica
-- ============================================================
CREATE OR REPLACE FUNCTION enviar_comando_estacion(
  p_dispositivo_id  UUID,
  p_tipo            TEXT,
  p_payload         JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_cmd_id     uuid;
BEGIN
  -- Verificar que el dispositivo pertenece a la empresa del usuario
  SELECT empresa_id INTO v_empresa_id
  FROM dispositivos
  WHERE id = p_dispositivo_id AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dispositivo no encontrado');
  END IF;

  -- Verificar que el usuario pertenece a esa empresa
  IF v_empresa_id != auth_empresa_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'acceso denegado');
  END IF;

  INSERT INTO comandos_estacion (dispositivo_id, empresa_id, tipo, payload)
  VALUES (p_dispositivo_id, v_empresa_id, p_tipo, p_payload)
  RETURNING id INTO v_cmd_id;

  RETURN jsonb_build_object('ok', true, 'comando_id', v_cmd_id::text);
END;
$$;

-- ============================================================
-- 6. RPC: marcar_comando_ejecutado
--    La estación confirma que ejecutó el comando
-- ============================================================
CREATE OR REPLACE FUNCTION marcar_comando_ejecutado(
  p_api_key    TEXT,
  p_comando_id UUID,
  p_resultado  TEXT DEFAULT 'ok'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM dispositivos WHERE api_key = p_api_key AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  UPDATE comandos_estacion
  SET ejecutado_en = NOW(), resultado = p_resultado
  WHERE id = p_comando_id AND empresa_id = v_empresa_id AND ejecutado_en IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 7. RPC: get_logs_dispositivo
--    El panel web consulta los últimos logs de una estación
-- ============================================================
CREATE OR REPLACE FUNCTION get_logs_dispositivo(
  p_dispositivo_id UUID,
  p_limit          INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- RLS: verificar que el dispositivo es de la empresa del usuario
  IF NOT EXISTS (
    SELECT 1 FROM dispositivos
    WHERE id = p_dispositivo_id AND empresa_id = auth_empresa_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'acceso denegado');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'logs', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',        l.id::text,
        'tipo',      l.tipo,
        'detalle',   l.detalle,
        'creado_en', l.creado_en::text
      )
      ORDER BY l.creado_en DESC
    ), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT * FROM logs_estacion
    WHERE dispositivo_id = p_dispositivo_id
    ORDER BY creado_en DESC
    LIMIT p_limit
  ) l;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 8. Agregar campo updated_at a empleados si no existe
--    (necesario para sync delta en la estación)
-- ============================================================
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION touch_empleado_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_empleados_updated_at ON empleados;
CREATE TRIGGER trg_empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION touch_empleado_updated_at();

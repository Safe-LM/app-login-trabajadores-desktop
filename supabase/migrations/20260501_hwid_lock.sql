-- Agregar HWID para vinculación física única
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS hwid TEXT;

-- Actualizar función de creación para aceptar HWID
CREATE OR REPLACE FUNCTION crear_dispositivo(
  p_user_id     UUID,
  p_nombre      TEXT,
  p_sucursal_id UUID DEFAULT NULL,
  p_hwid        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_new_id     UUID;
  v_api_key    TEXT;
BEGIN
  -- Obtener empresa del usuario
  SELECT (raw_user_meta_data->>'empresa_id')::UUID INTO v_empresa_id
  FROM auth.users WHERE id = p_user_id;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario sin empresa');
  END IF;

  v_api_key := 'sk_' || encode(gen_random_bytes(24), 'hex');
  
  INSERT INTO dispositivos (empresa_id, sucursal_id, nombre, api_key, creado_por, hwid)
  VALUES (v_empresa_id, p_sucursal_id, p_nombre, v_api_key, p_user_id, p_hwid)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'api_key', v_api_key
  );
END;
$$;

-- Actualizar Heartbeat para validar HWID
CREATE OR REPLACE FUNCTION station_heartbeat(
  p_api_key  TEXT,
  p_ip_local TEXT DEFAULT NULL,
  p_hostname TEXT DEFAULT NULL,
  p_version  TEXT DEFAULT NULL,
  p_hwid     TEXT DEFAULT NULL
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

  -- Si el dispositivo ya tiene HWID, debe coincidir
  IF v_device.hwid IS NOT NULL AND p_hwid IS NOT NULL AND v_device.hwid <> p_hwid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hardware no coincide con el registro original (HWID mismatch)');
  END IF;

  -- Si no tiene HWID, vincularlo ahora (primera conexión)
  IF v_device.hwid IS NULL AND p_hwid IS NOT NULL THEN
    UPDATE dispositivos SET hwid = p_hwid WHERE id = v_device.id;
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

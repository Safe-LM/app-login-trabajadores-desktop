-- Funcion para crear dispositivo desde el panel web (bypasea RLS)
CREATE OR REPLACE FUNCTION crear_dispositivo(
  p_user_id    UUID,
  p_nombre     TEXT,
  p_sucursal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_device     dispositivos%ROWTYPE;
BEGIN
  -- Obtener empresa_id del usuario desde auth.users
  SELECT (raw_user_meta_data->>'empresa_id')::uuid
  INTO v_empresa_id
  FROM auth.users WHERE id = p_user_id;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario sin empresa asignada');
  END IF;

  INSERT INTO dispositivos (empresa_id, sucursal_id, nombre, activo)
  VALUES (v_empresa_id, p_sucursal_id, trim(p_nombre), true)
  RETURNING * INTO v_device;

  RETURN jsonb_build_object(
    'ok',       true,
    'id',       v_device.id,
    'nombre',   v_device.nombre,
    'api_key',  v_device.api_key
  );
END;
$$;

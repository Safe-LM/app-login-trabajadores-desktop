-- Funcion para crear empresa desde onboarding (bypasea RLS)
CREATE OR REPLACE FUNCTION crear_empresa_onboarding(
  p_user_id   UUID,
  p_nombre    TEXT,
  p_slug      TEXT,
  p_timezone  TEXT DEFAULT 'America/Mexico_City',
  p_sucursal  TEXT DEFAULT NULL,
  p_ciudad    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- corre como superuser, bypasea RLS
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_sucursal_id UUID;
BEGIN
  -- Verificar que el usuario existe en auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario no encontrado');
  END IF;

  -- Verificar que el usuario no tenga ya una empresa
  IF (
    SELECT raw_user_meta_data->>'empresa_id'
    FROM auth.users WHERE id = p_user_id
  ) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario ya tiene empresa asignada');
  END IF;

  -- Crear empresa
  INSERT INTO empresas (nombre, slug, plan, activa, max_empleados, max_estaciones, timezone)
  VALUES (p_nombre, p_slug, 'starter', true, 50, 1, p_timezone)
  RETURNING id INTO v_empresa_id;

  -- Crear sucursal si viene nombre
  IF p_sucursal IS NOT NULL AND trim(p_sucursal) != '' THEN
    INSERT INTO sucursales (empresa_id, nombre, ciudad, activa)
    VALUES (v_empresa_id, trim(p_sucursal), NULLIF(trim(p_ciudad), ''), true)
    RETURNING id INTO v_sucursal_id;
  END IF;

  -- Asignar empresa_id al usuario en metadata
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('empresa_id', v_empresa_id::text)
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'empresa_id',  v_empresa_id,
    'sucursal_id', v_sucursal_id
  );
END;
$$;

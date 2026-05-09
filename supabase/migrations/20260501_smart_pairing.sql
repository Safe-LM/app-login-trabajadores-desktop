-- Tabla para vinculación rápida por código (estilo Netflix)
CREATE TABLE IF NOT EXISTS vinculacion_codigos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    nombre_sugerido TEXT,
    hwid_temporal TEXT,
    activado BOOLEAN DEFAULT FALSE,
    api_key_generada TEXT,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función para generar un código de vinculación (desde el Web Panel)
CREATE OR REPLACE FUNCTION generar_codigo_vinculacion(
  p_empresa_id  UUID,
  p_sucursal_id UUID DEFAULT NULL,
  p_nombre      TEXT DEFAULT 'Nueva Estación'
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  -- Generar código de 6 caracteres (A-Z, 0-9)
  v_codigo := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  
  INSERT INTO vinculacion_codigos (codigo, empresa_id, sucursal_id, nombre_sugerido)
  VALUES (v_codigo, p_empresa_id, p_sucursal_id, p_nombre);
  
  RETURN v_codigo;
END;
$$;

-- Función para que la Estación consulte si ya fue activada (polling)
CREATE OR REPLACE FUNCTION verificar_vinculacion(p_codigo TEXT, p_hwid TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_new_api_key TEXT;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_reg FROM vinculacion_codigos 
  WHERE codigo = upper(p_codigo) AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código inválido o expirado');
  END IF;

  IF v_reg.activado THEN
    RETURN jsonb_build_object(
      'ok', true, 
      'activado', true, 
      'api_key', v_reg.api_key_generada
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'activado', false);
END;
$$;

-- Función para activar el código (desde el Web Panel al confirmar)
CREATE OR REPLACE FUNCTION activar_vinculacion(p_codigo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_res JSONB;
BEGIN
  SELECT * INTO v_reg FROM vinculacion_codigos WHERE codigo = upper(p_codigo) AND activado = false;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código no encontrado o ya activado');
  END IF;

  -- Crear el dispositivo real
  -- Nota: usamos una version simplificada que no requiere el user_id aqui directamente
  v_res := crear_dispositivo_directo(v_reg.empresa_id, v_reg.sucursal_id, v_reg.nombre_sugerido);
  
  UPDATE vinculacion_codigos SET 
    activado = true, 
    api_key_generada = v_res->>'api_key'
  WHERE id = v_reg.id;

  RETURN v_res;
END;
$$;

-- Helper para crear dispositivo sin depender de auth.user meta (para el RPC de activacion)
CREATE OR REPLACE FUNCTION crear_dispositivo_directo(
  p_empresa_id  UUID,
  p_sucursal_id UUID,
  p_nombre      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
  v_api_key TEXT;
BEGIN
  v_api_key := 'sk_' || encode(gen_random_bytes(24), 'hex');
  
  INSERT INTO dispositivos (empresa_id, sucursal_id, nombre, api_key, activo)
  VALUES (p_empresa_id, p_sucursal_id, p_nombre, v_api_key, true)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'api_key', v_api_key);
END;
$$;

-- ════════════════════════════════════════════════════════════════════
--  crear_dispositivo: RPC server-trusted para registrar estaciones
-- ════════════════════════════════════════════════════════════════════
--
-- La station (setup_window.py) llama a esta RPC tras autenticar al
-- admin, pasando user_id, nombre, sucursal y HWID de la maquina fisica.
-- La funcion:
--
--   1. Resuelve empresa_id desde auth.users.{raw_app_meta_data,raw_user_meta_data}
--      del admin autenticado -- jamas del cliente. Garantiza que un usuario
--      no pueda crear dispositivos en empresas que no le pertenecen.
--      COALESCE app_metadata -> user_metadata es la convencion de Fase 2b
--      (RLS hardening) -- app_metadata es la fuente de verdad inmutable,
--      user_metadata es fallback transicional.
--
--   2. Persiste el HWID retornado por get_hwid() en el cliente. Esto
--      habilita el anti-clonado: station_heartbeat luego valida que el
--      HWID del .exe coincida con el guardado, bloqueando intentos de
--      ejecutar el binario en una maquina distinta.
--
--   3. Genera la api_key con extensions.gen_random_bytes (schema-qualificado
--      para no depender de search_path).
--
-- Historico:
--   - Reemplaza los archivos legacy 20260430_crear_dispositivo_fn.sql y
--     20260501_hwid_lock.sql que nunca fueron aplicados a prod.
--   - Aplicada a prod via MCP (apply_migration) en 2026-05-19 con version
--     20260519193010. Sustituyo la primera version (20260519192859) que
--     fallaba por search_path sin schema 'extensions'.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.crear_dispositivo(
  p_user_id     UUID,
  p_nombre      TEXT,
  p_sucursal_id UUID DEFAULT NULL,
  p_hwid        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- 'extensions' incluido para que gen_random_bytes (pgcrypto) sea
-- resoluble. En Supabase prod pgcrypto vive en extensions; en el
-- Postgres efimero del CI esta en public. Tener ambos en el path
-- hace que la funcion sea portable.
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_empresa_id UUID;
  v_new_id     UUID;
  v_api_key    TEXT;
BEGIN
  SELECT COALESCE(
           (raw_app_meta_data->>'empresa_id')::UUID,
           (raw_user_meta_data->>'empresa_id')::UUID
         )
    INTO v_empresa_id
    FROM auth.users
   WHERE id = p_user_id;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario sin empresa');
  END IF;

  -- gen_random_bytes resuelve a public.* (CI) o extensions.* (Supabase prod)
  -- segun search_path. Sin schema qualification para portabilidad.
  v_api_key := 'sk_' || encode(gen_random_bytes(24), 'hex');

  INSERT INTO dispositivos (
    empresa_id, sucursal_id, nombre, api_key, activo, creado_por, hwid
  )
  VALUES (
    v_empresa_id, p_sucursal_id, p_nombre, v_api_key, TRUE, p_user_id::text, p_hwid
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'api_key', v_api_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_dispositivo(UUID, TEXT, UUID, TEXT) TO authenticated;

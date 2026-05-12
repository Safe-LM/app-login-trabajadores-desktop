-- RPC para que la station descargue embeddings sin JWT.
-- Autenticacion: api_key del dispositivo. La station ya usa el mismo
-- patron en get_empleados_empresa, insertar_log_estacion, etc.
--
-- Sin este RPC la station consultaba directo via .table() y RLS la
-- bloqueaba silenciosamente (devolvia 0 filas sin error). El sintoma
-- era encodings_version=0 cronico aunque pgvector tuviera embeddings.

CREATE OR REPLACE FUNCTION public.get_embeddings_empresa(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device dispositivos%ROWTYPE;
  v_rows   jsonb;
BEGIN
  SELECT * INTO v_device FROM dispositivos
   WHERE api_key = p_api_key AND activo = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'empleado_id', empleado_id::text,
           'embedding',   embedding::text
         )), '[]'::jsonb)
    INTO v_rows
    FROM embeddings_faciales
   WHERE empresa_id = v_device.empresa_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'empresa_id', v_device.empresa_id,
    'embeddings', v_rows,
    'count',      jsonb_array_length(v_rows)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embeddings_empresa(text)
  TO authenticated, anon, service_role;

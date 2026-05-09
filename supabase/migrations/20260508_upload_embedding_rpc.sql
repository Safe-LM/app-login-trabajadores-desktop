-- RPC para que las estaciones puedan subir embeddings sin saltarse RLS.
-- La estación se autentica con api_key (no con JWT), así que las policies
-- normales no la dejan escribir. Esta RPC valida la api_key y hace upsert.

CREATE OR REPLACE FUNCTION subir_embedding_estacion(
  p_api_key       TEXT,
  p_empleado_id   UUID,
  p_embedding     TEXT,    -- vector serializado como "[0.1,0.2,...]"
  p_modelo_version TEXT DEFAULT 'sface_v3',
  p_es_augmentado BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_disp     RECORD;
  v_emp      RECORD;
BEGIN
  -- Validar api_key y obtener empresa de la estación
  SELECT id, empresa_id, activo INTO v_disp
    FROM dispositivos
   WHERE api_key = p_api_key
   LIMIT 1;

  IF NOT FOUND OR NOT v_disp.activo THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key invalida');
  END IF;

  -- Validar que el empleado pertenezca a la misma empresa
  SELECT id, empresa_id INTO v_emp
    FROM empleados
   WHERE id = p_empleado_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'empleado no encontrado');
  END IF;

  IF v_emp.empresa_id != v_disp.empresa_id THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'empleado de otra empresa');
  END IF;

  -- Upsert del embedding
  INSERT INTO embeddings_faciales (
    empleado_id, empresa_id, embedding, modelo_version, es_augmentado
  ) VALUES (
    p_empleado_id, v_emp.empresa_id, p_embedding::vector(128),
    p_modelo_version, p_es_augmentado
  )
  ON CONFLICT (empleado_id) DO UPDATE
    SET embedding      = EXCLUDED.embedding,
        modelo_version = EXCLUDED.modelo_version,
        es_augmentado  = EXCLUDED.es_augmentado,
        creado_en      = NOW();

  -- Marcar empleado como enrollado
  UPDATE empleados SET enrollado = TRUE WHERE id = p_empleado_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION subir_embedding_estacion TO anon, authenticated;

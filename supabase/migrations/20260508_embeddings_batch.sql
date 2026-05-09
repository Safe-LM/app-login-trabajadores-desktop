-- ─────────────────────────────────────────────────────────────────────────────
-- Permitir múltiples embeddings por empleado (data augmentation v3 SFace)
-- Versión final del PDF: 10 embeddings por empleado → 99% precisión
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Eliminar el constraint UNIQUE que impedía guardar augmentations
ALTER TABLE embeddings_faciales
  DROP CONSTRAINT IF EXISTS embeddings_faciales_empleado_id_unique;

-- Index normal (no único) para queries rápidas por empleado
CREATE INDEX IF NOT EXISTS idx_embeddings_empleado ON embeddings_faciales(empleado_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_empresa  ON embeddings_faciales(empresa_id);

-- 2. RPC batch: borra embeddings viejos del empleado y sube los nuevos en una sola transacción
CREATE OR REPLACE FUNCTION subir_embeddings_estacion_batch(
  p_api_key       TEXT,
  p_empleado_id   UUID,
  p_embeddings    JSONB,                 -- array: ["[0.1,0.2,...]", "[0.3,...]", ...]
  p_modelo_version TEXT DEFAULT 'sface_v3'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_disp     RECORD;
  v_emp      RECORD;
  v_emb      TEXT;
  v_count    INT := 0;
BEGIN
  -- Validar api_key
  SELECT id, empresa_id, activo INTO v_disp
    FROM dispositivos
   WHERE api_key = p_api_key
   LIMIT 1;
  IF NOT FOUND OR NOT v_disp.activo THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'api_key invalida');
  END IF;

  -- Validar empleado pertenece a la empresa de la estación
  SELECT id, empresa_id INTO v_emp FROM empleados WHERE id = p_empleado_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'empleado no encontrado');
  END IF;
  IF v_emp.empresa_id != v_disp.empresa_id THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'empleado de otra empresa');
  END IF;

  -- Reemplazar embeddings viejos por los nuevos (atomic)
  DELETE FROM embeddings_faciales WHERE empleado_id = p_empleado_id;

  FOR v_emb IN SELECT jsonb_array_elements_text(p_embeddings) LOOP
    INSERT INTO embeddings_faciales (
      empleado_id, empresa_id, embedding, modelo_version, es_augmentado
    ) VALUES (
      p_empleado_id, v_emp.empresa_id, v_emb::vector(128), p_modelo_version, v_count > 0
    );
    v_count := v_count + 1;
  END LOOP;

  -- Marcar empleado como enrollado
  UPDATE empleados SET enrollado = TRUE WHERE id = p_empleado_id;

  RETURN jsonb_build_object('ok', TRUE, 'embeddings_subidos', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION subir_embeddings_estacion_batch TO anon, authenticated;

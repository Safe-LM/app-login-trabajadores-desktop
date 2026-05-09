-- ============================================================
-- Sistema de notificaciones persistentes por empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,
  severidad    TEXT NOT NULL CHECK (severidad IN ('info', 'warn', 'error', 'critical')),
  titulo       TEXT NOT NULL,
  mensaje      TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  leida_en     TIMESTAMPTZ,
  creada_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_empresa_creada
  ON notificaciones (empresa_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas
  ON notificaciones (empresa_id, creada_en DESC) WHERE leida_en IS NULL;

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_select ON notificaciones;
CREATE POLICY notif_select ON notificaciones
  FOR SELECT USING (empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS notif_update ON notificaciones;
CREATE POLICY notif_update ON notificaciones
  FOR UPDATE USING (empresa_id = auth_empresa_id());

DROP POLICY IF EXISTS notif_delete ON notificaciones;
CREATE POLICY notif_delete ON notificaciones
  FOR DELETE USING (empresa_id = auth_empresa_id());

ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- Crear notificación con dedupe (mismo dedupe_key dentro de N minutos no inserta nueva)
CREATE OR REPLACE FUNCTION crear_notificacion(
  p_empresa_id  UUID,
  p_tipo        TEXT,
  p_severidad   TEXT,
  p_titulo      TEXT,
  p_mensaje     TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key  TEXT DEFAULT NULL,
  p_dedupe_window_min INT DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_existing UUID;
  v_id UUID;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM notificaciones
     WHERE empresa_id = p_empresa_id
       AND metadata->>'dedupe_key' = p_dedupe_key
       AND creada_en > NOW() - (p_dedupe_window_min || ' minutes')::interval
     ORDER BY creada_en DESC
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO notificaciones (empresa_id, tipo, severidad, titulo, mensaje, metadata)
  VALUES (
    p_empresa_id, p_tipo, p_severidad, p_titulo, p_mensaje,
    CASE WHEN p_dedupe_key IS NULL
         THEN p_metadata
         ELSE p_metadata || jsonb_build_object('dedupe_key', p_dedupe_key)
    END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_notificacion TO anon, authenticated;

CREATE OR REPLACE FUNCTION marcar_notificaciones_leidas(p_empresa_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID := COALESCE(p_empresa_id, auth_empresa_id());
  v_count INT;
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE notificaciones
     SET leida_en = NOW()
   WHERE empresa_id = v_empresa_id
     AND leida_en IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION marcar_notificaciones_leidas TO authenticated;

-- RPC para la estación: crear notificación con api_key (sin auth Supabase)
CREATE OR REPLACE FUNCTION crear_notif_estacion(
  p_api_key   TEXT,
  p_tipo      TEXT,
  p_severidad TEXT,
  p_titulo    TEXT,
  p_mensaje   TEXT DEFAULT NULL,
  p_metadata  JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_disp RECORD;
BEGIN
  SELECT id, empresa_id, activo INTO v_disp
    FROM dispositivos
   WHERE api_key = p_api_key
   LIMIT 1;
  IF NOT FOUND OR NOT v_disp.activo THEN
    RETURN NULL;
  END IF;

  RETURN crear_notificacion(
    v_disp.empresa_id, p_tipo, p_severidad, p_titulo, p_mensaje,
    p_metadata || jsonb_build_object('dispositivo_id', v_disp.id),
    p_dedupe_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_notif_estacion TO anon, authenticated;

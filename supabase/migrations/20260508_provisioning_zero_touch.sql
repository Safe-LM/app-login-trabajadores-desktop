-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 1: Onboarding zero-touch via QR
--
-- Tabla provisioning_tokens + RPCs para:
--   1. Estación pide token al arrancar (sin config previa)
--   2. Admin escanea QR y activa el token desde el panel
--   3. Estación recibe la activación por Realtime
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provisioning_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT UNIQUE NOT NULL,            -- ej: "ABC-123-XYZ" (legible)
  hwid            TEXT NOT NULL,                   -- fingerprint hardware estación
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','activado','expirado','cancelado')),
  -- Datos asignados al activar
  empresa_id      UUID REFERENCES empresas(id) ON DELETE CASCADE,
  sucursal_id     UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  dispositivo_id  UUID REFERENCES dispositivos(id) ON DELETE CASCADE,
  nombre_estacion TEXT,
  -- Metadata (auth_id de Supabase Auth, no FK porque auth.users vive en otro schema)
  activado_por    UUID,
  ip_estacion     TEXT,
  ip_admin        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  activado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provisioning_token ON provisioning_tokens(token);
CREATE INDEX IF NOT EXISTS idx_provisioning_estado ON provisioning_tokens(estado, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE provisioning_tokens ENABLE ROW LEVEL SECURITY;

-- Solo admins logueados pueden leer tokens (para validarlos en /activar)
DROP POLICY IF EXISTS pt_read ON provisioning_tokens;
CREATE POLICY pt_read ON provisioning_tokens
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- Solo el RPC puede insertar/actualizar (con SECURITY DEFINER)
DROP POLICY IF EXISTS pt_no_direct ON provisioning_tokens;
CREATE POLICY pt_no_direct ON provisioning_tokens
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: generar código corto legible (3-3-3 sin caracteres confusos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _generar_codigo_corto()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  -- Sin O, 0, I, 1, L para evitar confusiones
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  resultado TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..9 LOOP
    IF i IN (4, 7) THEN
      resultado := resultado || '-';
    END IF;
    resultado := resultado || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN resultado;  -- ej: "K9P-AC4-XJ2"
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1: crear_token_provisioning
-- Llamado por la estación al arrancar sin config.
-- Recibe HWID y devuelve un token único.
-- Esta RPC se llama con la anon key de Supabase (no requiere auth).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_token_provisioning(
  p_hwid TEXT,
  p_ip   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token   TEXT;
  v_attempts INT := 0;
BEGIN
  IF p_hwid IS NULL OR length(p_hwid) < 8 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'hwid invalido');
  END IF;

  -- Cancelar tokens anteriores de este HWID que estén pendientes
  UPDATE provisioning_tokens
     SET estado = 'cancelado'
   WHERE hwid = p_hwid
     AND estado = 'pendiente';

  -- Generar token único (reintentar si choca)
  LOOP
    v_token := _generar_codigo_corto();
    v_attempts := v_attempts + 1;

    BEGIN
      INSERT INTO provisioning_tokens (token, hwid, ip_estacion)
      VALUES (v_token, p_hwid, p_ip);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 10 THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'no se pudo generar token unico');
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'token', v_token,
    'expires_at', (NOW() + INTERVAL '15 minutes')::TEXT,
    'activate_url', 'https://panel.safelink.app/activar?token=' || v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_token_provisioning TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2: validar_token_provisioning
-- Llamado por el panel cuando admin abre /activar?token=...
-- Devuelve si el token es válido y datos básicos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validar_token_provisioning(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT * INTO v_rec
    FROM provisioning_tokens
   WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token no encontrado');
  END IF;

  IF v_rec.estado = 'activado' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token ya fue usado');
  END IF;

  IF v_rec.expires_at < NOW() THEN
    UPDATE provisioning_tokens SET estado = 'expirado' WHERE id = v_rec.id;
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token expirado, genera uno nuevo en la estacion');
  END IF;

  IF v_rec.estado != 'pendiente' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token cancelado');
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'token', v_rec.token,
    'hwid_short', substr(v_rec.hwid, 1, 8) || '...',
    'expires_at', v_rec.expires_at::TEXT,
    'created_at', v_rec.created_at::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validar_token_provisioning TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3: activar_token_provisioning
-- Llamado por el panel cuando admin confirma "Activar".
-- Crea el dispositivo, asigna api_key, marca el token como activado.
-- La estación recibirá la notificación por Realtime sobre la fila actualizada.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION activar_token_provisioning(
  p_token         TEXT,
  p_empresa_id    UUID,
  p_sucursal_id   UUID,
  p_nombre        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_rec       RECORD;
  v_user_id         UUID := auth.uid();
  v_user_empresa_id UUID;
  v_disp_id         UUID;
  v_api_key         TEXT;
BEGIN
  -- Validar usuario logueado
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no autenticado');
  END IF;

  -- Empresa del usuario viene del JWT (mismo helper que usa el resto del sistema)
  v_user_empresa_id := auth_empresa_id();

  -- Si no es superadmin (sin empresa_id en metadata), debe pertenecer a la empresa
  IF v_user_empresa_id IS NOT NULL AND v_user_empresa_id != p_empresa_id THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'sin permisos sobre esta empresa');
  END IF;

  -- Validar token
  SELECT * INTO v_token_rec FROM provisioning_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token no encontrado');
  END IF;

  IF v_token_rec.estado != 'pendiente' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token ya usado o expirado');
  END IF;

  IF v_token_rec.expires_at < NOW() THEN
    UPDATE provisioning_tokens SET estado = 'expirado' WHERE id = v_token_rec.id;
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token expirado');
  END IF;

  -- Validar sucursal
  IF NOT EXISTS (
    SELECT 1 FROM sucursales WHERE id = p_sucursal_id AND empresa_id = p_empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'sucursal invalida');
  END IF;

  -- Generar api_key única
  v_api_key := encode(gen_random_bytes(32), 'hex');

  -- Crear dispositivo
  INSERT INTO dispositivos (
    nombre, api_key, hwid, empresa_id, sucursal_id, activo
  ) VALUES (
    COALESCE(p_nombre, 'Estacion'), v_api_key, v_token_rec.hwid,
    p_empresa_id, p_sucursal_id, TRUE
  )
  RETURNING id INTO v_disp_id;

  -- Marcar token como activado (esta UPDATE dispara Realtime → estación recibe)
  UPDATE provisioning_tokens
     SET estado          = 'activado',
         dispositivo_id  = v_disp_id,
         empresa_id      = p_empresa_id,
         sucursal_id     = p_sucursal_id,
         nombre_estacion = p_nombre,
         activado_por    = v_user_id,
         activado_en     = NOW()
   WHERE id = v_token_rec.id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'dispositivo_id', v_disp_id,
    'api_key', v_api_key,
    'empresa_id', p_empresa_id,
    'sucursal_id', p_sucursal_id,
    'nombre', p_nombre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activar_token_provisioning TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 4: obtener_activacion (la estación lo polea como fallback a Realtime)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION obtener_activacion_provisioning(p_token TEXT, p_hwid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec   RECORD;
  v_disp  RECORD;
BEGIN
  SELECT * INTO v_rec FROM provisioning_tokens WHERE token = p_token AND hwid = p_hwid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token o hwid no coincide');
  END IF;

  IF v_rec.estado != 'activado' THEN
    RETURN jsonb_build_object('ok', FALSE, 'estado', v_rec.estado);
  END IF;

  SELECT id, api_key, empresa_id, sucursal_id, nombre
    INTO v_disp
    FROM dispositivos
   WHERE id = v_rec.dispositivo_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'dispositivo_id', v_disp.id,
    'api_key', v_disp.api_key,
    'empresa_id', v_disp.empresa_id,
    'sucursal_id', v_disp.sucursal_id,
    'nombre', v_disp.nombre,
    'activado_en', v_rec.activado_en::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_activacion_provisioning TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: la estación se suscribe a esta tabla con filter por token
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'provisioning_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE provisioning_tokens;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Limpieza automática: expirar tokens viejos (cron via pg_cron si está activo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _expire_old_provisioning_tokens()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE provisioning_tokens
     SET estado = 'expirado'
   WHERE estado = 'pendiente' AND expires_at < NOW();

  DELETE FROM provisioning_tokens
   WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

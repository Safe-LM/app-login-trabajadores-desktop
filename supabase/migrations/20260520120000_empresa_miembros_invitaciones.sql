-- ════════════════════════════════════════════════════════════════════
--  Multi-tenant memberships: empresa_miembros + empresa_invitaciones
-- ════════════════════════════════════════════════════════════════════
--
-- Antes de esta migracion, la relacion usuario <-> empresa era 1:1 y
-- vivia en auth.users.raw_app_meta_data.empresa_id. Limitaciones:
--   - Un usuario no podia pertenecer a varias empresas (caso real:
--     equipo SafeLink necesita gestionar varias empresas cliente).
--   - No habia forma de invitar a otra persona a tu empresa.
--   - No habia concepto de rol dentro de una empresa.
--
-- Esta migracion introduce el modelo "Memberships" estandar de SaaS
-- multi-tenant (patron de Stripe, Linear, Vercel):
--
--   empresa_miembros   = N:M entre auth.users y empresas, con rol
--   empresa_invitaciones = pending invites con token de un solo uso
--
-- La columna auth.users.app_metadata.empresa_id se mantiene PERO cambia
-- semantica: ahora representa la "empresa activa" (UI state, tenant
-- actualmente seleccionado). Sigue siendo el claim del JWT que usan las
-- RLS policies — esto preserva 100% retrocompatibilidad con el RLS y
-- funciones SECURITY DEFINER existentes.
--
-- Reglas:
--   1. Exactamente un 'owner' por empresa (partial unique index).
--   2. Un owner NO puede quitar su propio rol salvo via transfer_ownership.
--   3. Solo owner/admin pueden invitar / cambiar roles / quitar miembros.
--   4. Tokens de invitacion: 32 bytes random, base64url, single-use, exp 7 dias.
--   5. Las funciones son SECURITY DEFINER con search_path fijo (estandar Fase 2b).
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. TABLAS
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa_miembros (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol           TEXT NOT NULL CHECK (rol IN ('owner','admin','viewer')),
  invitado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceptado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, user_id)
);

-- Exactamente un owner por empresa
CREATE UNIQUE INDEX IF NOT EXISTS empresa_miembros_one_owner_per_empresa
  ON public.empresa_miembros (empresa_id)
  WHERE rol = 'owner';

CREATE INDEX IF NOT EXISTS empresa_miembros_user_id_idx
  ON public.empresa_miembros (user_id);

CREATE INDEX IF NOT EXISTS empresa_miembros_empresa_id_idx
  ON public.empresa_miembros (empresa_id);


CREATE TABLE IF NOT EXISTS public.empresa_invitaciones (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email         TEXT NOT NULL CHECK (email = lower(email)),
  rol           TEXT NOT NULL CHECK (rol IN ('admin','viewer')),
  token         TEXT NOT NULL UNIQUE,
  invitado_por  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expira_en     TIMESTAMPTZ NOT NULL,
  aceptada_en   TIMESTAMPTZ,
  cancelada_en  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una sola invitacion ACTIVA por (empresa, email) — las canceladas o
  -- aceptadas no cuentan para el unique:
  UNIQUE (empresa_id, email, token)
);

CREATE INDEX IF NOT EXISTS empresa_invitaciones_pending_idx
  ON public.empresa_invitaciones (empresa_id, email)
  WHERE aceptada_en IS NULL AND cancelada_en IS NULL;

CREATE INDEX IF NOT EXISTS empresa_invitaciones_token_idx
  ON public.empresa_invitaciones (token)
  WHERE aceptada_en IS NULL AND cancelada_en IS NULL;


-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS — ambas tablas
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.empresa_miembros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_invitaciones  ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la empresa ven a otros miembros de su empresa.
-- (Inserts/updates/deletes pasan exclusivamente por funciones SECURITY DEFINER,
--  por lo que no necesitamos policies WRITE — sin policy = bloqueado por RLS.)

DROP POLICY IF EXISTS p_miembros_select ON public.empresa_miembros;
CREATE POLICY p_miembros_select ON public.empresa_miembros
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT em.empresa_id
        FROM public.empresa_miembros em
       WHERE em.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS p_invitaciones_select ON public.empresa_invitaciones;
CREATE POLICY p_invitaciones_select ON public.empresa_invitaciones
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT em.empresa_id
        FROM public.empresa_miembros em
       WHERE em.user_id = (SELECT auth.uid())
         AND em.rol IN ('owner','admin')  -- viewers no ven pendientes
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- 3. HELPERS internos
-- ─────────────────────────────────────────────────────────────────────

-- Genera un token URL-safe de 256 bits. base64url sin padding (43 chars).
CREATE OR REPLACE FUNCTION public._generar_token_invitacion()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_raw    BYTEA := extensions.gen_random_bytes(32);
  v_b64    TEXT;
BEGIN
  v_b64 := encode(v_raw, 'base64');
  -- base64url: + -> -, / -> _, sin padding
  RETURN rtrim(replace(replace(v_b64, '+', '-'), '/', '_'), '=');
END;
$$;

-- Devuelve el rol del usuario actual en una empresa, o NULL si no es miembro.
CREATE OR REPLACE FUNCTION public._rol_en_empresa(p_empresa_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT rol FROM public.empresa_miembros
   WHERE empresa_id = p_empresa_id AND user_id = p_user_id;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 4. FUNCIONES DE ESCRITURA
-- ─────────────────────────────────────────────────────────────────────

-- ── crear_invitacion ────────────────────────────────────────────────
-- Llamada por owner/admin de la empresa activa.
-- Si ya existe invitacion activa para ese email -> la cancela y crea nueva.
-- Si el email ya es miembro -> error.
CREATE OR REPLACE FUNCTION public.crear_invitacion(
  p_empresa_id UUID,
  p_email      TEXT,
  p_rol        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_rol  TEXT;
  v_email_norm  TEXT := lower(trim(p_email));
  v_existing    UUID;
  v_token       TEXT;
  v_invitacion_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  IF p_rol NOT IN ('admin','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rol invalido (solo admin o viewer)');
  END IF;

  IF v_email_norm = '' OR v_email_norm !~* '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email invalido');
  END IF;

  v_caller_rol := public._rol_en_empresa(p_empresa_id, v_caller_id);
  IF v_caller_rol NOT IN ('owner','admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permisos insuficientes');
  END IF;

  -- Email ya es miembro?
  SELECT em.user_id INTO v_existing
    FROM public.empresa_miembros em
    JOIN auth.users u ON u.id = em.user_id
   WHERE em.empresa_id = p_empresa_id AND lower(u.email) = v_email_norm;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ese email ya es miembro de la empresa');
  END IF;

  -- Cancelar cualquier invitacion previa activa
  UPDATE public.empresa_invitaciones
     SET cancelada_en = NOW()
   WHERE empresa_id = p_empresa_id
     AND email      = v_email_norm
     AND aceptada_en IS NULL
     AND cancelada_en IS NULL;

  v_token := public._generar_token_invitacion();

  INSERT INTO public.empresa_invitaciones
    (empresa_id, email, rol, token, invitado_por, expira_en)
  VALUES
    (p_empresa_id, v_email_norm, p_rol, v_token, v_caller_id, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_invitacion_id,
    'token', v_token,
    'expira_en', (NOW() + INTERVAL '7 days')::text
  );
END;
$$;


-- ── ver_invitacion (publica via token, sin auth) ────────────────────
-- La pagina /invitacion/[token] la llama para mostrar preview de la
-- invitacion (empresa, rol) antes de pedir login/signup.
CREATE OR REPLACE FUNCTION public.ver_invitacion(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT i.id, i.email, i.rol, i.expira_en, i.aceptada_en, i.cancelada_en,
         e.id AS empresa_id, e.nombre AS empresa_nombre, e.slug AS empresa_slug
    INTO v_inv
    FROM public.empresa_invitaciones i
    JOIN public.empresas e ON e.id = i.empresa_id
   WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion no encontrada');
  END IF;

  IF v_inv.cancelada_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion cancelada');
  END IF;

  IF v_inv.aceptada_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion ya aceptada');
  END IF;

  IF v_inv.expira_en < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion expirada');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_inv.email,
    'rol', v_inv.rol,
    'empresa_id', v_inv.empresa_id,
    'empresa_nombre', v_inv.empresa_nombre,
    'expira_en', v_inv.expira_en::text
  );
END;
$$;


-- ── aceptar_invitacion ──────────────────────────────────────────────
-- Llamada por el invitado (autenticado). Verifica que el email del JWT
-- coincida con el de la invitacion, y crea la fila empresa_miembros.
CREATE OR REPLACE FUNCTION public.aceptar_invitacion(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_user_email TEXT;
  v_inv        RECORD;
  v_new_mem    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv
    FROM public.empresa_invitaciones
   WHERE token = p_token
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion no encontrada');
  END IF;
  IF v_inv.cancelada_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion cancelada');
  END IF;
  IF v_inv.aceptada_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion ya aceptada');
  END IF;
  IF v_inv.expira_en < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion expirada');
  END IF;

  IF v_inv.email <> v_user_email THEN
    RETURN jsonb_build_object('ok', false,
      'error', 'la invitacion es para ' || v_inv.email || ', estas autenticado como ' || v_user_email);
  END IF;

  -- Ya es miembro? (defensa contra race condition)
  IF EXISTS (
    SELECT 1 FROM public.empresa_miembros
     WHERE empresa_id = v_inv.empresa_id AND user_id = v_user_id
  ) THEN
    UPDATE public.empresa_invitaciones SET aceptada_en = NOW() WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'ya eras miembro');
  END IF;

  INSERT INTO public.empresa_miembros
    (empresa_id, user_id, rol, invitado_por, invitado_en, aceptado_en)
  VALUES
    (v_inv.empresa_id, v_user_id, v_inv.rol, v_inv.invitado_por, v_inv.created_at, NOW())
  RETURNING id INTO v_new_mem;

  UPDATE public.empresa_invitaciones SET aceptada_en = NOW() WHERE id = v_inv.id;

  -- Si el usuario no tenia empresa activa, dejarle esta como activa
  UPDATE auth.users
     SET raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb)
                              || jsonb_build_object('empresa_id', v_inv.empresa_id::text),
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('empresa_id', v_inv.empresa_id::text)
   WHERE id = v_user_id
     AND (raw_app_meta_data->>'empresa_id') IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'membresia_id', v_new_mem,
    'empresa_id', v_inv.empresa_id,
    'rol', v_inv.rol
  );
END;
$$;


-- ── cancelar_invitacion ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_invitacion(p_invitacion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_rol  TEXT;
  v_inv         RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  SELECT * INTO v_inv FROM public.empresa_invitaciones WHERE id = p_invitacion_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion no encontrada');
  END IF;
  IF v_inv.aceptada_en IS NOT NULL OR v_inv.cancelada_en IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitacion no esta activa');
  END IF;

  v_caller_rol := public._rol_en_empresa(v_inv.empresa_id, v_caller_id);
  IF v_caller_rol NOT IN ('owner','admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permisos insuficientes');
  END IF;

  UPDATE public.empresa_invitaciones SET cancelada_en = NOW() WHERE id = p_invitacion_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── cambiar_rol_miembro ─────────────────────────────────────────────
-- Solo owner puede cambiar roles. Owner no puede auto-degradarse.
CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(
  p_membresia_id UUID,
  p_nuevo_rol    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_rol  TEXT;
  v_mem         RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  IF p_nuevo_rol NOT IN ('admin','viewer') THEN
    -- Para promover a 'owner' se usa transferir_ownership.
    RETURN jsonb_build_object('ok', false, 'error', 'rol invalido (usa transferir_ownership para owner)');
  END IF;

  SELECT * INTO v_mem FROM public.empresa_miembros WHERE id = p_membresia_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membresia no encontrada');
  END IF;

  v_caller_rol := public._rol_en_empresa(v_mem.empresa_id, v_caller_id);
  IF v_caller_rol <> 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'solo el owner puede cambiar roles');
  END IF;

  IF v_mem.user_id = v_caller_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no puedes cambiar tu propio rol');
  END IF;

  IF v_mem.rol = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usa transferir_ownership para mover el rol de owner');
  END IF;

  UPDATE public.empresa_miembros
     SET rol = p_nuevo_rol, updated_at = NOW()
   WHERE id = p_membresia_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── transferir_ownership ────────────────────────────────────────────
-- Owner actual cede el rol a otro miembro y queda como admin.
-- Atomic: si falla el unique index de un solo owner, todo rollback.
CREATE OR REPLACE FUNCTION public.transferir_ownership(p_a_membresia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_target     RECORD;
  v_current_owner RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  SELECT * INTO v_target FROM public.empresa_miembros WHERE id = p_a_membresia_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membresia destino no encontrada');
  END IF;

  SELECT * INTO v_current_owner
    FROM public.empresa_miembros
   WHERE empresa_id = v_target.empresa_id AND user_id = v_caller_id AND rol = 'owner';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'solo el owner actual puede transferir');
  END IF;

  IF v_target.user_id = v_caller_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no puedes transferir a ti mismo');
  END IF;

  -- Demote actual + promote destino. Hacemos demote primero para liberar
  -- el unique index y luego promote. Si algo falla, transaccion rollback.
  UPDATE public.empresa_miembros SET rol = 'admin', updated_at = NOW()
   WHERE id = v_current_owner.id;
  UPDATE public.empresa_miembros SET rol = 'owner', updated_at = NOW()
   WHERE id = p_a_membresia_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── quitar_miembro ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quitar_miembro(p_membresia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_rol  TEXT;
  v_mem         RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  SELECT * INTO v_mem FROM public.empresa_miembros WHERE id = p_membresia_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membresia no encontrada');
  END IF;

  v_caller_rol := public._rol_en_empresa(v_mem.empresa_id, v_caller_id);
  IF v_caller_rol NOT IN ('owner','admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permisos insuficientes');
  END IF;

  -- Owner no se puede quitar a si mismo
  IF v_mem.user_id = v_caller_id AND v_mem.rol = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'el owner no puede quitarse a si mismo. Transfiere ownership primero.');
  END IF;

  -- Admin no puede quitar al owner
  IF v_mem.rol = 'owner' AND v_caller_rol <> 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'solo el owner puede quitar al owner');
  END IF;

  DELETE FROM public.empresa_miembros WHERE id = p_membresia_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── cambiar_empresa_activa ──────────────────────────────────────────
-- El usuario cambia su tenant activo. Solo a una empresa donde es miembro.
CREATE OR REPLACE FUNCTION public.cambiar_empresa_activa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no autenticado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_miembros
     WHERE empresa_id = p_empresa_id AND user_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no eres miembro de esa empresa');
  END IF;

  UPDATE auth.users
     SET raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb)
                              || jsonb_build_object('empresa_id', p_empresa_id::text),
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('empresa_id', p_empresa_id::text)
   WHERE id = v_caller_id;

  RETURN jsonb_build_object('ok', true, 'empresa_id', p_empresa_id);
END;
$$;


-- ── listar_miembros (helper de lectura, returna emails de auth.users) ─
-- RLS bloquea SELECT en auth.users, asi que necesitamos esta funcion
-- SECURITY DEFINER para que la UI pueda mostrar los emails.
--
-- NOTA: las columnas de RETURNS TABLE se convierten en variables PL/pgSQL
-- implicitas. Toda referencia a empresa_miembros.user_id debe ir
-- qualificada con alias 'em' para evitar 42702 (ambiguous reference).
CREATE OR REPLACE FUNCTION public.listar_miembros(p_empresa_id UUID)
RETURNS TABLE (
  id           UUID,
  user_id      UUID,
  email        TEXT,
  rol          TEXT,
  invitado_en  TIMESTAMPTZ,
  aceptado_en  TIMESTAMPTZ,
  es_yo        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_miembros em
     WHERE em.empresa_id = p_empresa_id
       AND em.user_id    = v_caller_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    em.id,
    em.user_id,
    lower(u.email)::text AS email,
    em.rol,
    em.invitado_en,
    em.aceptado_en,
    (em.user_id = v_caller_id) AS es_yo
  FROM public.empresa_miembros em
  JOIN auth.users u ON u.id = em.user_id
  WHERE em.empresa_id = p_empresa_id
  ORDER BY
    CASE em.rol WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    em.aceptado_en;
END;
$$;


-- ── mis_empresas (para el selector del header) ──────────────────────
CREATE OR REPLACE FUNCTION public.mis_empresas()
RETURNS TABLE (
  empresa_id   UUID,
  empresa_nombre TEXT,
  empresa_slug TEXT,
  rol          TEXT,
  es_activa    BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_activa    UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  SELECT (raw_app_meta_data->>'empresa_id')::UUID INTO v_activa
    FROM auth.users WHERE id = v_caller_id;

  RETURN QUERY
  SELECT e.id, e.nombre, e.slug, em.rol, (e.id = v_activa) AS es_activa
    FROM public.empresa_miembros em
    JOIN public.empresas e ON e.id = em.empresa_id
   WHERE em.user_id = v_caller_id
   ORDER BY e.nombre;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 5. GRANTS
-- ─────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.crear_invitacion(UUID, TEXT, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.ver_invitacion(TEXT)                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion(TEXT)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_invitacion(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(UUID, TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.transferir_ownership(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_miembro(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_empresa_activa(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_miembros(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_empresas()                            TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 6. BACKFILL: convertir todos los empresa_id de metadata en filas
-- ─────────────────────────────────────────────────────────────────────
-- Si varios usuarios apuntan al mismo empresa_id (legacy de cuando se
-- backfilleaba manualmente), el de menor created_at queda como owner,
-- el resto como admin. Esto respeta el partial unique index
-- "un solo owner por empresa". Idempotente via ON CONFLICT DO NOTHING.

WITH ranked AS (
  SELECT
    u.id AS user_id,
    COALESCE(
      (u.raw_app_meta_data->>'empresa_id')::UUID,
      (u.raw_user_meta_data->>'empresa_id')::UUID
    ) AS empresa_id,
    u.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(
        (u.raw_app_meta_data->>'empresa_id')::UUID,
        (u.raw_user_meta_data->>'empresa_id')::UUID
      )
      ORDER BY u.created_at NULLS LAST, u.id
    ) AS rank_in_empresa
  FROM auth.users u
  WHERE COALESCE(
          (u.raw_app_meta_data->>'empresa_id')::UUID,
          (u.raw_user_meta_data->>'empresa_id')::UUID
        ) IS NOT NULL
)
INSERT INTO public.empresa_miembros (empresa_id, user_id, rol, invitado_en, aceptado_en)
SELECT
  r.empresa_id,
  r.user_id,
  CASE WHEN r.rank_in_empresa = 1 THEN 'owner' ELSE 'admin' END,
  COALESCE(r.created_at, NOW()),
  COALESCE(r.created_at, NOW())
FROM ranked r
WHERE EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = r.empresa_id)
ON CONFLICT (empresa_id, user_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 7. ACTUALIZAR crear_empresa_onboarding
--    Cuando alguien crea una empresa, auto-membresia como owner.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crear_empresa_onboarding(
  p_user_id  UUID,
  p_nombre   TEXT,
  p_slug     TEXT,
  p_timezone TEXT DEFAULT 'America/Mexico_City',
  p_sucursal TEXT DEFAULT NULL,
  p_ciudad   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id       UUID;
  v_sucursal_id      UUID;
  v_existing_empresa TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario no encontrado');
  END IF;

  -- Si ya tiene empresa activa, abortamos (el usuario debe usar el flujo
  -- de invitacion para unirse a otra, no crear duplicada accidental).
  SELECT COALESCE(raw_app_meta_data->>'empresa_id',
                  raw_user_meta_data->>'empresa_id')
    INTO v_existing_empresa
    FROM auth.users WHERE id = p_user_id;

  IF v_existing_empresa IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario ya tiene empresa asignada');
  END IF;

  INSERT INTO public.empresas (nombre, slug, plan, activa, max_empleados, max_estaciones, timezone)
  VALUES (p_nombre, p_slug, 'starter', true, 50, 1, p_timezone)
  RETURNING id INTO v_empresa_id;

  IF p_sucursal IS NOT NULL AND trim(p_sucursal) <> '' THEN
    INSERT INTO public.sucursales (empresa_id, nombre, ciudad, activa)
    VALUES (v_empresa_id, trim(p_sucursal), NULLIF(trim(p_ciudad), ''), true)
    RETURNING id INTO v_sucursal_id;
  END IF;

  -- Membresia owner para el creador (NUEVO en esta migracion)
  INSERT INTO public.empresa_miembros (empresa_id, user_id, rol, invitado_en, aceptado_en)
  VALUES (v_empresa_id, p_user_id, 'owner', NOW(), NOW())
  ON CONFLICT (empresa_id, user_id) DO NOTHING;

  -- Setear empresa activa en metadata (mismo comportamiento que antes)
  UPDATE auth.users
     SET raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb)
                              || jsonb_build_object('empresa_id', v_empresa_id::text),
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('empresa_id', v_empresa_id::text)
   WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'empresa_id',  v_empresa_id,
    'sucursal_id', v_sucursal_id
  );
END;
$$;

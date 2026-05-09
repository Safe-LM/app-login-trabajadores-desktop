-- =============================================================================
-- Migración: Horarios por sucursal (multitenant SaaS)
-- Fecha: 2026-05-08
-- Agrega hora_apertura, hora_cierre y tolerancia_min para detectar llegadas tarde
-- =============================================================================

ALTER TABLE public.sucursales
  ADD COLUMN IF NOT EXISTS hora_apertura  TIME,
  ADD COLUMN IF NOT EXISTS hora_cierre    TIME,
  ADD COLUMN IF NOT EXISTS tolerancia_min INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.sucursales.hora_apertura  IS 'Hora esperada de entrada de empleados';
COMMENT ON COLUMN public.sucursales.hora_cierre    IS 'Hora esperada de salida de empleados';
COMMENT ON COLUMN public.sucursales.tolerancia_min IS 'Minutos de tolerancia antes de marcar llegada tarde';

-- Bucket para logos de empresa (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos-empresa', 'logos-empresa', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Política: cada empresa puede subir/leer su propio logo
DROP POLICY IF EXISTS "logos_empresa_select" ON storage.objects;
CREATE POLICY "logos_empresa_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos-empresa');

DROP POLICY IF EXISTS "logos_empresa_write" ON storage.objects;
CREATE POLICY "logos_empresa_write" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos-empresa'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')
  );

DROP POLICY IF EXISTS "logos_empresa_update" ON storage.objects;
CREATE POLICY "logos_empresa_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos-empresa'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')
  );

DROP POLICY IF EXISTS "logos_empresa_delete" ON storage.objects;
CREATE POLICY "logos_empresa_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos-empresa'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')
  );

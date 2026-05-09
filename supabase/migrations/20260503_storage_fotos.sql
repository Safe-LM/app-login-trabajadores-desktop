-- ============================================================
-- Bucket de Storage para fotos de empleados
-- ============================================================

-- Crear bucket público fotos-empleados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-empleados',
  'fotos-empleados',
  true,
  5242880,  -- 5 MB máximo por foto
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política: admins de la empresa pueden subir/actualizar fotos de sus empleados
DROP POLICY IF EXISTS "empresa_upload_fotos" ON storage.objects;
CREATE POLICY "empresa_upload_fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-empleados'
    AND (storage.foldername(name))[1] = (auth_empresa_id())::text
  );

DROP POLICY IF EXISTS "empresa_update_fotos" ON storage.objects;
CREATE POLICY "empresa_update_fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos-empleados'
    AND (storage.foldername(name))[1] = (auth_empresa_id())::text
  );

DROP POLICY IF EXISTS "empresa_delete_fotos" ON storage.objects;
CREATE POLICY "empresa_delete_fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-empleados'
    AND (storage.foldername(name))[1] = (auth_empresa_id())::text
  );

-- Política: lectura pública (las fotos tienen URL pública para la estación)
DROP POLICY IF EXISTS "public_read_fotos" ON storage.objects;
CREATE POLICY "public_read_fotos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'fotos-empleados');

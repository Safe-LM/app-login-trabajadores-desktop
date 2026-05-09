-- Habilitar Realtime en empleados para que el panel actualice el badge
-- "Entrenando…" → "Entrenado" en vivo cuando una estación procesa la foto.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'empleados'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE empleados;
  END IF;
END $$;

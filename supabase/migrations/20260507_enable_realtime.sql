-- Habilitar Realtime en tablas que lo necesitan para sincronización en vivo:
--   * registros_asistencia → web panel ve registros en vivo
--   * dispositivos         → web panel ve cambios de health/online
--   * comandos_estacion    → ya estaba (lo dejamos por idempotencia)

DO $$
BEGIN
  -- registros_asistencia
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'registros_asistencia'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE registros_asistencia;
  END IF;

  -- dispositivos
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'dispositivos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dispositivos;
  END IF;

  -- comandos_estacion (idempotente)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comandos_estacion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comandos_estacion;
  END IF;
END $$;

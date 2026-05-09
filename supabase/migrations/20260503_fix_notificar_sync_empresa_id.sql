-- Fix: notificar_sync_empleados was not passing empresa_id to comandos_estacion
CREATE OR REPLACE FUNCTION notificar_sync_empleados(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_disp RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_disp IN
    SELECT id FROM dispositivos
     WHERE empresa_id = p_empresa_id AND activa = TRUE
  LOOP
    INSERT INTO comandos_estacion (dispositivo_id, empresa_id, tipo, payload, creado_en)
    VALUES (v_disp.id, p_empresa_id, 'sync_empleados', '{}'::jsonb, NOW())
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE, 'estaciones_notificadas', v_count);
END;
$$;

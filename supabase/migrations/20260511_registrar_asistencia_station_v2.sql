-- A7: Actualizar registrar_asistencia_station para aceptar score_raw,
-- metodo y embedding_count. Los nuevos parametros son opcionales
-- (DEFAULT NULL) para no romper stations en version anterior — las
-- viejas siguen funcionando sin enviarlos, solo no llenan esas
-- columnas. Stations nuevas envian los 3.

CREATE OR REPLACE FUNCTION public.registrar_asistencia_station(
  p_api_key         text,
  p_empleado_id     uuid,
  p_tipo            text,
  p_confianza       double precision DEFAULT NULL,
  p_notas           text DEFAULT NULL,
  p_score_raw       double precision DEFAULT NULL,
  p_metodo          text DEFAULT NULL,
  p_embedding_count int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_device dispositivos%ROWTYPE;
BEGIN
  SELECT * INTO v_device FROM dispositivos
   WHERE api_key = p_api_key AND activo = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key invalida');
  END IF;

  INSERT INTO registros_asistencia (
    empresa_id, empleado_id, dispositivo_id, sucursal_id,
    tipo, confianza, reconocimiento_facial, sincronizado,
    score_raw, metodo, embedding_count
  ) VALUES (
    v_device.empresa_id, p_empleado_id, v_device.id, v_device.sucursal_id,
    p_tipo, p_confianza, TRUE, TRUE,
    p_score_raw, p_metodo, p_embedding_count
  );

  RETURN jsonb_build_object('ok', true);
END;
$function$;

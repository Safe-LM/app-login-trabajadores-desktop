-- TECH DEBT GUARD: dispositivos tiene dos columnas booleanas redundantes que
-- significan lo mismo ("dispositivo habilitado"):
--   * activa  -> provisioning (crear/revocar) + notificar_sync_empleados
--   * activo  -> RPCs hot-path: registrar_asistencia_station, station_heartbeat,
--                get_empleados_empresa
-- Subsistemas distintos escriben columnas distintas. Hoy ambas estan en TRUE
-- asi que nada falla, pero si divergen el bug es silencioso (una estacion
-- "activa" no recibiria sync de empleados, o "activo" no podria fichar).
--
-- Decision: en vez de un refactor riesgoso del hot-path de asistencia,
-- mantenemos ambas en sync con un trigger BEFORE. Blast radius minimo,
-- reversible. La consolidacion real a UNA sola columna queda como tech-debt
-- para una ventana de mantenimiento (reescribir ~8 funciones de provisioning,
-- backfill, drop de la columna sobrante).

-- 1) Backfill: alinear divergencias historicas. Habilitado solo si AMBAS lo
--    estaban; si alguna estaba en FALSE asumimos intencion de deshabilitar.
UPDATE public.dispositivos
   SET activa = (COALESCE(activa, TRUE) AND COALESCE(activo, TRUE)),
       activo = (COALESCE(activa, TRUE) AND COALESCE(activo, TRUE))
 WHERE activa IS DISTINCT FROM activo;

-- 2) Trigger de sincronizacion bidireccional.
CREATE OR REPLACE FUNCTION public.sync_dispositivo_activa_activo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.activo := COALESCE(NEW.activo, NEW.activa, TRUE);
    NEW.activa := COALESCE(NEW.activa, NEW.activo, TRUE);
  ELSE -- UPDATE: la columna que cambio gana y se propaga a la otra.
    IF NEW.activa IS DISTINCT FROM OLD.activa THEN
      NEW.activo := NEW.activa;
    ELSIF NEW.activo IS DISTINCT FROM OLD.activo THEN
      NEW.activa := NEW.activo;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dispositivo_activa_activo ON public.dispositivos;
CREATE TRIGGER trg_sync_dispositivo_activa_activo
  BEFORE INSERT OR UPDATE OF activa, activo ON public.dispositivos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dispositivo_activa_activo();

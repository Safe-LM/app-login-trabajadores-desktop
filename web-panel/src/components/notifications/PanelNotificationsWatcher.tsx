"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "./NotificationProvider";

const STATION_OFFLINE_THRESHOLD_SEC = 5 * 60;
const STATION_POLL_INTERVAL_MS = 60_000;

type StationRow = {
  id: string;
  nombre: string;
  sucursal_nombre: string | null;
  segundos_desde_heartbeat: number | null;
  estado_conexion: "online" | "alerta" | "offline" | "nunca";
};

type DispositivoHealth = {
  id: string;
  nombre: string;
  config: { camara_ok?: boolean; health_score?: number; empleados_count?: number } | null;
};

type SucursalHorario = {
  id: string;
  hora_apertura: string | null;
  tolerancia_min: number | null;
};

type EmpleadoLite = { id: string; nombre: string; apellido: string };
type SucursalLite = { id: string; nombre: string };

/**
 * Vigila el estado del panel y crea notificaciones persistentes en Supabase.
 *
 * Eventos vigilados:
 *  - station_offline: heartbeat >5min
 *  - station_recovered: vuelve online tras estar offline
 *  - station_camera_error: camara_ok = false
 *  - station_health_low: health_score < 50
 *  - employee_late_arrival: entrada despues del horario + tolerancia
 *
 * Tambien dispara toast efimero (NotificationProvider) para feedback inmediato.
 */
export function PanelNotificationsWatcher({ empresaId }: { empresaId: string }) {
  const { notify } = useNotifications();
  const offlineSeen = useRef<Set<string>>(new Set());
  const cameraErrorSeen = useRef<Set<string>>(new Set());
  const healthLowSeen = useRef<Set<string>>(new Set());
  const horariosRef = useRef<Map<string, SucursalHorario>>(new Map());
  const empleadosRef = useRef<Map<string, EmpleadoLite>>(new Map());
  const sucursalesRef = useRef<Map<string, SucursalLite>>(new Map());

  // Cache horarios + empleados + sucursales para resolver nombres en realtime.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const [hRes, eRes, sRes] = await Promise.all([
        supabase.from("sucursales").select("id, hora_apertura, tolerancia_min").eq("empresa_id", empresaId),
        supabase.from("empleados").select("id, nombre, apellido").eq("empresa_id", empresaId),
        supabase.from("sucursales").select("id, nombre").eq("empresa_id", empresaId),
      ]);
      if (cancelled) return;
      horariosRef.current = new Map((hRes.data ?? []).map(s => [s.id, s as SucursalHorario]));
      empleadosRef.current = new Map((eRes.data ?? []).map(e => [e.id, e as EmpleadoLite]));
      sucursalesRef.current = new Map((sRes.data ?? []).map(s => [s.id, s as SucursalLite]));
    }
    load();
    return () => { cancelled = true; };
  }, [empresaId]);

  // Estado de estaciones: polling cada 60s — offline / recovered / camera / health
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function persistNotif(args: {
      tipo: string;
      severidad: "info" | "warn" | "error" | "critical";
      titulo: string;
      mensaje?: string;
      metadata?: Record<string, unknown>;
      dedupeKey: string;
    }) {
      try {
        await supabase.rpc("crear_notificacion", {
          p_empresa_id: empresaId,
          p_tipo: args.tipo,
          p_severidad: args.severidad,
          p_titulo: args.titulo,
          p_mensaje: args.mensaje,
          p_metadata: args.metadata ?? {},
          p_dedupe_key: args.dedupeKey,
          p_dedupe_window_min: 30,
        });
      } catch {
        /* fail open: el toast efimero ya avisa al usuario */
      }
    }

    async function check() {
      // Vista para estado de conexion
      const { data: states } = await supabase
        .from("v_dispositivos_estado")
        .select("id, nombre, sucursal_nombre, segundos_desde_heartbeat, estado_conexion")
        .eq("empresa_id", empresaId);

      // Tabla dispositivos para health (camara_ok, health_score viven en config jsonb)
      const { data: healths } = await supabase
        .from("dispositivos")
        .select("id, nombre, config")
        .eq("empresa_id", empresaId);

      if (cancelled) return;

      const stillOffline = new Set<string>();
      const stillCamErr = new Set<string>();
      const stillHealthLow = new Set<string>();

      for (const d of (states ?? []) as StationRow[]) {
        const secs = d.segundos_desde_heartbeat;
        const isOffline = secs != null && secs >= STATION_OFFLINE_THRESHOLD_SEC;

        if (isOffline) {
          stillOffline.add(d.id);
          if (!offlineSeen.current.has(d.id)) {
            const minutos = Math.floor(secs / 60);
            const titulo = `Estación sin conexión: ${d.nombre}`;
            const mensaje = d.sucursal_nombre
              ? `${d.sucursal_nombre} · sin heartbeat hace ${minutos} min`
              : `Sin heartbeat hace ${minutos} min`;
            notify({
              kind: "warning", title: titulo, message: mensaje,
              dedupeKey: `station-offline:${d.id}`,
              action: { label: "Ver estaciones", href: "/dispositivos" },
              duration: 8000,
            });
            persistNotif({
              tipo: "station_offline",
              severidad: minutos >= 30 ? "critical" : "warn",
              titulo, mensaje,
              metadata: { dispositivo_id: d.id, sucursal: d.sucursal_nombre, minutos },
              dedupeKey: `station-offline:${d.id}`,
            });
          }
        } else if (offlineSeen.current.has(d.id)) {
          // Recovery: estaba offline y ahora esta online
          const titulo = `Estación recuperada: ${d.nombre}`;
          const mensaje = d.sucursal_nombre ? `${d.sucursal_nombre} · conexión restablecida` : "Conexión restablecida";
          notify({ kind: "success", title: titulo, message: mensaje, duration: 5000 });
          persistNotif({
            tipo: "station_recovered", severidad: "info",
            titulo, mensaje,
            metadata: { dispositivo_id: d.id, sucursal: d.sucursal_nombre },
            // Dedupe estable por dia: si una estacion se recupera 3 veces
            // el mismo dia, solo notificamos UNA. Antes usabamos Date.now()
            // por milisegundo -> dedupe inutil, spam de notificaciones.
            dedupeKey: `station-recovered:${d.id}:${new Date().toISOString().slice(0, 10)}`,
          });
        }
      }

      for (const d of (healths ?? []) as DispositivoHealth[]) {
        const cfg = d.config ?? {};
        const camOk = cfg.camara_ok;
        const score = cfg.health_score;

        if (camOk === false) {
          stillCamErr.add(d.id);
          if (!cameraErrorSeen.current.has(d.id)) {
            const titulo = `Cámara con problemas: ${d.nombre}`;
            const mensaje = "La estación no puede acceder a la cámara. Verifica conexión USB y permisos.";
            notify({
              kind: "error", title: titulo, message: mensaje,
              dedupeKey: `camera:${d.id}`, duration: 9000,
              action: { label: "Ver estación", href: "/dispositivos" },
            });
            persistNotif({
              tipo: "station_camera_error", severidad: "error",
              titulo, mensaje,
              metadata: { dispositivo_id: d.id },
              dedupeKey: `camera:${d.id}`,
            });
          }
        }

        if (typeof score === "number" && score < 50) {
          stillHealthLow.add(d.id);
          if (!healthLowSeen.current.has(d.id)) {
            const titulo = `Salud baja: ${d.nombre} (${score}/100)`;
            const mensaje = "La estación reporta multiples errores. Revisa logs y considera reiniciar.";
            notify({
              kind: "warning", title: titulo, message: mensaje,
              dedupeKey: `health:${d.id}`, duration: 8000,
            });
            persistNotif({
              tipo: "station_health_low", severidad: "warn",
              titulo, mensaje,
              metadata: { dispositivo_id: d.id, score },
              dedupeKey: `health:${d.id}`,
            });
          }
        }
      }

      offlineSeen.current = stillOffline;
      cameraErrorSeen.current = stillCamErr;
      healthLowSeen.current = stillHealthLow;
    }

    check();
    timer = setInterval(check, STATION_POLL_INTERVAL_MS);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [empresaId, notify]);

  // Llegadas tarde: realtime sobre INSERT en registros_asistencia.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("panel-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "registros_asistencia",
        filter: `empresa_id=eq.${empresaId}`,
      }, async (payload) => {
        const r = payload.new as {
          tipo: "entrada" | "salida";
          empleado_id: string;
          sucursal_id: string | null;
          timestamp: string;
        };
        if (r.tipo !== "entrada" || !r.sucursal_id) return;

        const horario = horariosRef.current.get(r.sucursal_id);
        if (!horario?.hora_apertura) return;

        const tarde = computeMinutosTarde(r.timestamp, horario.hora_apertura, horario.tolerancia_min ?? 10);
        if (tarde === null) return;

        const emp = empleadosRef.current.get(r.empleado_id);
        const suc = sucursalesRef.current.get(r.sucursal_id);
        const nombre = emp ? `${emp.nombre} ${emp.apellido}` : "Empleado";
        const sucNombre = suc?.nombre ?? "su sucursal";

        const titulo = `Llegada tarde · ${nombre}`;
        const mensaje = `${sucNombre} · ${tarde} min después del horario (${horario.hora_apertura.slice(0, 5)})`;
        const dedupeKey = `late:${r.empleado_id}:${r.timestamp.slice(0, 10)}`;

        notify({
          kind: tarde >= 30 ? "error" : "warning",
          title: titulo, message: mensaje,
          dedupeKey, duration: 7000,
          action: { label: "Ver asistencia", href: "/asistencia" },
        });

        try {
          await supabase.rpc("crear_notificacion", {
            p_empresa_id: empresaId,
            p_tipo: "employee_late_arrival",
            p_severidad: tarde >= 30 ? "error" : "warn",
            p_titulo: titulo,
            p_mensaje: mensaje,
            p_metadata: { empleado_id: r.empleado_id, sucursal_id: r.sucursal_id, minutos_tarde: tarde },
            p_dedupe_key: dedupeKey,
            p_dedupe_window_min: 720, // 12h: una vez al día por empleado
          });
        } catch { /* no-op */ }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [empresaId, notify]);

  return null;
}

function computeMinutosTarde(timestampIso: string, horaApertura: string, toleranciaMin: number): number | null {
  const ts = new Date(timestampIso);
  if (Number.isNaN(ts.getTime())) return null;
  const [hh, mm] = horaApertura.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const expected = new Date(ts);
  expected.setHours(hh, mm, 0, 0);

  const diffMin = Math.round((ts.getTime() - expected.getTime()) / 60_000);
  if (diffMin <= toleranciaMin) return null;
  return diffMin;
}

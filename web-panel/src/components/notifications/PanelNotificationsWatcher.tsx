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
};

type SucursalHorario = {
  id: string;
  hora_apertura: string | null;
  tolerancia_min: number | null;
};

type EmpleadoLite = { id: string; nombre: string; apellido: string };
type SucursalLite = { id: string; nombre: string };

/**
 * Vigila el estado del panel y emite notificaciones:
 *  - Estación offline cuando no hay heartbeat en >5 min
 *  - Llegadas tarde según horario de la sucursal
 *
 * Se monta una sola vez en el layout del dashboard.
 */
export function PanelNotificationsWatcher({ empresaId }: { empresaId: string }) {
  const { notify } = useNotifications();
  const offlineSeen = useRef<Set<string>>(new Set());
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

  // Estaciones offline: polling cada 60s a la vista calculada por Postgres.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function check() {
      const { data, error } = await supabase
        .from("v_dispositivos_estado")
        .select("id, nombre, sucursal_nombre, segundos_desde_heartbeat")
        .eq("empresa_id", empresaId);
      if (error || cancelled) return;

      const seen = offlineSeen.current;
      const stillOffline = new Set<string>();

      for (const d of (data ?? []) as StationRow[]) {
        const secs = d.segundos_desde_heartbeat;
        if (secs != null && secs >= STATION_OFFLINE_THRESHOLD_SEC) {
          stillOffline.add(d.id);
          if (!seen.has(d.id)) {
            const minutos = Math.floor(secs / 60);
            notify({
              kind: "warning",
              title: `Estación sin conexión: ${d.nombre}`,
              message: d.sucursal_nombre
                ? `${d.sucursal_nombre} · sin heartbeat hace ${minutos} min`
                : `Sin heartbeat hace ${minutos} min`,
              dedupeKey: `station-offline:${d.id}`,
              action: { label: "Ver estaciones", href: "/dispositivos" },
              duration: 8000,
            });
          }
        }
      }
      offlineSeen.current = stillOffline;
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
      }, payload => {
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

        notify({
          kind: tarde >= 30 ? "error" : "warning",
          title: `Llegada tarde · ${nombre}`,
          message: `${sucNombre} · ${tarde} min después del horario (${horario.hora_apertura.slice(0, 5)})`,
          dedupeKey: `late:${r.empleado_id}:${r.timestamp.slice(0, 10)}`,
          action: { label: "Ver asistencia", href: "/asistencia" },
          duration: 7000,
        });
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

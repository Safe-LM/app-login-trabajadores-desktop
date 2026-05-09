"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, btnGhost, type Dispositivo } from "./_shared";

type LogRow = {
  id: string;
  tipo: string;
  detalle: Record<string, unknown>;
  creado_en: string;
};

const TIPO_COLOR: Record<string, string> = {
  sync_ok: "#22c55e", sync_error: "#ef4444",
  reconocimiento_ok: "#60a5fa", reconocimiento_fallo: "#f59e0b",
  asistencia_registrada: "#22c55e", asistencia_offline: "#f59e0b",
  camara_error: "#ef4444", camara_ok: "#22c55e",
  error: "#ef4444", info: "#94a3b8",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function LogsModal({ d, onClose }: { d: Dispositivo; onClose: () => void }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function fetchLogs() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("get_logs_dispositivo", {
        p_dispositivo_id: d.id,
        p_limit: 50,
      });
      if (cancelled) return;
      setLogs(data?.logs ?? []);
      setLoading(false);
    }
    fetchLogs();

    const channel = supabase
      .channel(`logs-${d.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs_estacion", filter: `dispositivo_id=eq.${d.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [d.id]);

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
            Logs — {d.nombre}
          </h2>
          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Últimos 50 eventos · en tiempo real</p>
        </div>
        <button onClick={onClose} style={btnGhost} aria-label="Cerrar logs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "32px 0" }}>Cargando logs...</p>
        ) : logs.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "32px 0" }}>Sin logs registrados aún</p>
        ) : logs.map((log) => (
          <div key={log.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: TIPO_COLOR[log.tipo] ?? "#94a3b8", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TIPO_COLOR[log.tipo] ?? "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {log.tipo.replace(/_/g, " ")}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtTime(log.creado_en)}
                </span>
              </div>
              {Object.keys(log.detalle).length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.5, wordBreak: "break-word" }}>
                  {Object.entries(log.detalle).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

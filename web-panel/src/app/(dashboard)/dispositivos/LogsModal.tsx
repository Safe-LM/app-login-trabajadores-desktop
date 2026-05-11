"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, btnGhost, type Dispositivo } from "./_shared";
import { TrainingProgress } from "@/components/TrainingProgress";

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
  // S2.3: tab para alternar entre logs y training en vivo
  const [tab, setTab] = useState<"logs" | "training">("logs");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function fetchLogs() {
      const { data } = await supabase.rpc("get_logs_dispositivo", {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
            {tab === "logs" ? "Logs" : "Entrenamiento"} — {d.nombre}
          </h2>
          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {tab === "logs" ? "Últimos 50 eventos · en tiempo real" : "Progreso del training facial en esta estación"}
          </p>
        </div>
        <button onClick={onClose} style={btnGhost} aria-label="Cerrar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Tabs: Logs / Training */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
        <TabBtn active={tab === "logs"}     onClick={() => setTab("logs")}>Logs</TabBtn>
        <TabBtn active={tab === "training"} onClick={() => setTab("training")}>Training facial</TabBtn>
      </div>

      {tab === "training" ? (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          <TrainingProgress dispositivoId={d.id} />
        </div>
      ) : (
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
      )}
    </Modal>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", background: "transparent", border: "none",
        cursor: "pointer", fontSize: 12, fontWeight: 500,
        color: active ? "var(--text-primary)" : "var(--text-faint)",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        marginBottom: -1,
        transition: "all 150ms",
      }}
    >
      {children}
    </button>
  );
}

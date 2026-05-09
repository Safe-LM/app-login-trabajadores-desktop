"use client";
import React from "react";

export type Dispositivo = {
  id: string; nombre: string; activo: boolean;
  ip_local: string | null; hostname: string | null;
  heartbeat_at: string | null; version_app: string | null;
  api_key: string; config: Record<string, unknown>;
  sucursal_id: string | null; sucursal_nombre: string | null;
  estado_conexion: "online" | "alerta" | "offline" | "nunca";
  segundos_desde_heartbeat: number | null;
  creado_por: string | null;
  hwid: string | null;
  empleados_count: number;
  health_score: number;
  ultimo_sync_at: string | null;
  encodings_version: number;
  camara_ok: boolean | null;
};

export type Sucursal = { id: string; nombre: string };

export const btnGhost: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-faint)", padding: "2px", display: "flex",
  alignItems: "center", justifyContent: "center", borderRadius: 4,
  transition: "color 150ms",
};

export const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 9, fontSize: 13,
  color: "var(--text-primary)", outline: "none",
  fontFamily: "inherit", transition: "border-color 150ms, box-shadow 150ms",
  boxSizing: "border-box",
};

export function Modal({ onClose, children, maxWidth = 460 }: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
        animation: "fadeIn 150ms ease both",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: "100%", maxWidth,
          position: "relative", overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "modalUp 200ms cubic-bezier(0.16,1,0.3,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 0%, #2563eb 35%, #60a5fa 65%, transparent 100%)",
        }} />
        {children}
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
      textTransform: "uppercase", letterSpacing: "0.08em",
      display: "block", marginBottom: 5,
    }}>
      {children}
    </label>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: value ? "rgba(34,197,94,0.4)" : "var(--bg-elevated)",
        border: `1px solid ${value ? "rgba(34,197,94,0.6)" : "var(--border)"}`,
        position: "relative", cursor: "pointer",
        transition: "all 200ms",
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        background: value ? "#22c55e" : "var(--text-faint)",
        position: "absolute", top: 2, left: value ? 19 : 2,
        transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
      }} />
    </button>
  );
}

"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type NotifKind = "info" | "success" | "warning" | "error";

export type Notification = {
  id: string;
  kind: NotifKind;
  title: string;
  message?: string;
  /** Si está presente, se considera "persistente" (banner) hasta que se descarte. */
  persistent?: boolean;
  /** ms — sólo aplica a notificaciones no persistentes. Default 5000. */
  duration?: number;
  /** Acción opcional (ej. "Ver detalles") */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Clave para deduplicar — si llega otra con la misma key, reemplaza la anterior. */
  dedupeKey?: string;
};

type Ctx = {
  notify: (n: Omit<Notification, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  notifications: Notification[];
};

const NotificationContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de <NotificationProvider>");
  return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback<Ctx["notify"]>((input) => {
    // Fallback: crypto.randomUUID requiere contexto seguro (https / localhost).
    // En Safari < 15.4 o iframes http puede no existir y rompe TODO el panel
    // (NotificationProvider envuelve la app). Defensivo:
    const id =
      (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID?.()) ||
      `n-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const next: Notification = { id, ...input };
    setNotifications(prev => {
      const filtered = next.dedupeKey
        ? prev.filter(p => p.dedupeKey !== next.dedupeKey)
        : prev;
      return [...filtered, next].slice(-6);
    });
    if (!next.persistent) {
      const t = setTimeout(() => dismiss(id), next.duration ?? 5000);
      timers.current.set(id, t);
    }
    return id;
  }, [dismiss]);

  const clear = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current.clear();
    setNotifications([]);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(t => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<Ctx>(() => ({ notify, dismiss, clear, notifications }), [notify, dismiss, clear, notifications]);

  const banners = notifications.filter(n => n.persistent);
  const toasts = notifications.filter(n => !n.persistent);

  return (
    <NotificationContext.Provider value={value}>
      {banners.length > 0 && (
        <div style={{
          position: "sticky", top: 0, zIndex: 60,
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          {banners.map(n => <Banner key={n.id} n={n} onDismiss={() => dismiss(n.id)} />)}
        </div>
      )}
      {children}
      <div style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 70,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(n => <Toast key={n.id} n={n} onDismiss={() => dismiss(n.id)} />)}
      </div>
    </NotificationContext.Provider>
  );
}

const KIND_STYLES: Record<NotifKind, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  info:    { bg: "rgba(37,99,235,0.10)",  border: "rgba(37,99,235,0.30)",  color: "#60a5fa", icon: <InfoIcon /> },
  success: { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.30)",  color: "#4ade80", icon: <CheckIcon /> },
  warning: { bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.30)",  color: "#facc15", icon: <WarnIcon /> },
  error:   { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.30)",  color: "#f87171", icon: <ErrorIcon /> },
};

function Toast({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const s = KIND_STYLES[n.kind];
  return (
    <div
      role="status"
      className="animate-fade-up"
      style={{
        pointerEvents: "auto",
        minWidth: 280, maxWidth: 380,
        background: "var(--bg-card)",
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: 8,
        background: s.bg, color: s.color,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {s.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
          {n.title}
        </p>
        {n.message && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>
            {n.message}
          </p>
        )}
        {n.action && (
          <ActionLink action={n.action} color={s.color} />
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={onDismiss}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--text-faint)", padding: 4, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function Banner({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const s = KIND_STYLES[n.kind];
  return (
    <div
      role="alert"
      style={{
        background: s.bg,
        borderBottom: `1px solid ${s.border}`,
        color: s.color,
        padding: "10px 24px",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", color: s.color }}>{s.icon}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{n.title}</span>
        {n.message && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{n.message}</span>
        )}
      </div>
      {n.action && <ActionLink action={n.action} color={s.color} />}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onDismiss}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: s.color, padding: 4, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function ActionLink({ action, color }: { action: NonNullable<Notification["action"]>; color: string }) {
  const style: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color, padding: "4px 10px",
    borderRadius: 6, border: `1px solid ${color}40`,
    background: "transparent", cursor: "pointer", textDecoration: "none",
    fontFamily: "inherit",
  };
  if (action.href) return <a href={action.href} style={style}>{action.label}</a>;
  return <button type="button" onClick={action.onClick} style={style}>{action.label}</button>;
}

function InfoIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>; }
function CheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function WarnIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9"  x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function ErrorIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9"  x2="9"  y2="15"/><line x1="9"  y1="9"  x2="15" y2="15"/></svg>; }
function CloseIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

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
  // Mostramos solo las 3 mas recientes. Resto se cuenta en "+N mas".
  const VISIBLE = 3;
  const visibleToasts = toasts.slice(-VISIBLE);
  const overflow = Math.max(0, toasts.length - VISIBLE);

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
      <div
        className="toast-stack"
        aria-live="polite"
        aria-atomic="false"
      >
        {visibleToasts.map(n => <Toast key={n.id} n={n} onDismiss={() => dismiss(n.id)} />)}
        {overflow > 0 && (
          <button
            type="button"
            className="toast-overflow"
            onClick={clear}
            title="Limpiar todas las notificaciones"
          >
            +{overflow} más · Limpiar
          </button>
        )}
      </div>
    </NotificationContext.Provider>
  );
}

const KIND_STYLES: Record<NotifKind, { color: string; icon: React.ReactNode }> = {
  info:    { color: "#60a5fa", icon: <InfoIcon /> },
  success: { color: "#4ade80", icon: <CheckIcon /> },
  warning: { color: "#facc15", icon: <WarnIcon /> },
  error:   { color: "#f87171", icon: <ErrorIcon /> },
};

function Toast({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const s = KIND_STYLES[n.kind];
  return (
    <div
      role="status"
      className="toast animate-fade-up"
      data-kind={n.kind}
      style={{ "--toast-accent": s.color } as React.CSSProperties}
    >
      <span className="toast__dot" />
      <div className="toast__icon" style={{ color: s.color }}>
        {s.icon}
      </div>
      <div className="toast__body">
        <p className="toast__title">{n.title}</p>
        {n.message && <p className="toast__msg">{n.message}</p>}
        {n.action && <ActionLink action={n.action} color={s.color} />}
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={onDismiss}
        className="toast__close"
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
      className="notif-banner"
      data-kind={n.kind}
      style={{ "--banner-accent": s.color } as React.CSSProperties}
    >
      <div className="notif-banner__icon" style={{ color: s.color }}>{s.icon}</div>
      <div className="notif-banner__body">
        <span className="notif-banner__title" style={{ color: s.color }}>{n.title}</span>
        {n.message && <span className="notif-banner__msg">{n.message}</span>}
      </div>
      {n.action && <ActionLink action={n.action} color={s.color} />}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onDismiss}
        className="notif-banner__close"
        style={{ color: s.color }}
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

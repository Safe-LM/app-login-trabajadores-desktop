"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { NotificacionRow, Severidad } from "@/types/database";

const RECENT_LIMIT = 10;

const SEVERIDAD_TOKENS: Record<Severidad, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  info:     { color: "#60a5fa", bg: "rgba(96, 165, 250, 0.10)",  label: "Info",     icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
  warn:     { color: "#facc15", bg: "rgba(250, 204, 21, 0.10)",  label: "Aviso",    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  error:    { color: "#f87171", bg: "rgba(248, 113, 113, 0.10)", label: "Error",    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
  critical: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.14)",   label: "Crítico",  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg> },
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function NotificationCenter({ empresaId }: { empresaId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [pulse, setPulse] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Carga inicial + Realtime
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("creada_en", { ascending: false })
        .limit(RECENT_LIMIT);
      if (cancelled) return;
      const rows = (data ?? []) as NotificacionRow[];
      setItems(rows);
      setUnread(rows.filter((n) => !n.leida_en).length);
    }
    load();

    const channel = supabase
      .channel(`notificaciones:${empresaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones", filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as NotificacionRow;
            setItems((prev) => [newRow, ...prev].slice(0, RECENT_LIMIT));
            setUnread((c) => c + 1);
            // Pulse del bell + sonido si critical
            setPulse(true);
            window.setTimeout(() => setPulse(false), 1200);
            if (newRow.severidad === "critical" && typeof Audio !== "undefined") {
              try {
                if (!audioRef.current) {
                  // Beep corto generado en runtime (sin assets)
                  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain); gain.connect(ctx.destination);
                  osc.frequency.value = 880;
                  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
                  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
                  osc.start(ctx.currentTime);
                  osc.stop(ctx.currentTime + 0.4);
                }
              } catch { /* sin audio: ignorar */ }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as NotificacionRow;
            setItems((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            setUnread((c) => Math.max(0, c - (updated.leida_en && !payload.old?.leida_en ? 1 : 0)));
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string; leida_en: string | null };
            setItems((prev) => prev.filter((n) => n.id !== removed.id));
            if (!removed.leida_en) setUnread((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [empresaId]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markOneRead(id: string) {
    const supabase = createClient();
    await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    const supabase = createClient();
    await supabase.rpc("marcar_notificaciones_leidas", {});
    setUnread(0);
    setItems((prev) => prev.map((n) => (n.leida_en ? n : { ...n, leida_en: new Date().toISOString() })));
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificaciones (${unread} sin leer)`}
        className={`notif-bell ${pulse ? "notif-bell--pulse" : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="notif-bell__badge" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Centro de notificaciones">
          <div className="notif-dropdown__header">
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Notificaciones</p>
              <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
                {unread > 0 ? `${unread} sin leer` : "Al día"}
              </p>
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
                Marcar leídas
              </button>
            )}
          </div>

          <div className="notif-dropdown__list">
            {items.length === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.02) 100%)",
                  border: "1px solid rgba(37,99,235,0.20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 10px", color: "var(--accent-hover)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Sin notificaciones</p>
                <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Te avisaremos cuando algo necesite tu atención.</p>
              </div>
            ) : (
              items.map((n) => <NotifItem key={n.id} n={n} onRead={() => markOneRead(n.id)} />)
            )}
          </div>

          <Link
            href="/notificaciones"
            className="notif-dropdown__footer"
            onClick={() => setOpen(false)}
          >
            Ver todas
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>
      )}
    </div>
  );
}

function NotifItem({ n, onRead }: { n: NotificacionRow; onRead: () => void }) {
  const t = SEVERIDAD_TOKENS[n.severidad];
  const isRead = !!n.leida_en;
  const meta = n.metadata ?? {};
  const href = (() => {
    if (meta.dispositivo_id) return "/dispositivos";
    if (meta.empleado_id) return "/empleados";
    if (meta.sucursal_id) return "/sucursales";
    return "/notificaciones";
  })();

  return (
    <Link
      href={href}
      onClick={() => !isRead && onRead()}
      className="notif-item"
      style={{
        opacity: isRead ? 0.62 : 1,
        background: isRead ? "transparent" : t.bg,
        borderLeftColor: isRead ? "transparent" : t.color,
      }}
    >
      <span className="notif-item__icon" style={{ color: t.color, background: t.bg, borderColor: t.color + "33" }}>
        {t.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {n.titulo}
        </p>
        {n.mensaje && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {n.mensaje}
          </p>
        )}
        <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          {relativeTime(n.creada_en)}
        </p>
      </div>
      {!isRead && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: t.color, flexShrink: 0,
          boxShadow: `0 0 6px ${t.color}`,
          alignSelf: "center",
        }} />
      )}
    </Link>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrowserPushToggle } from "@/components/notifications/BrowserPushBridge";
import type { NotificacionRow, Severidad } from "@/types/database";
import {
  Bell, Check, Trash2, AlertCircle, AlertTriangle, Info,
  ChevronDown, ChevronUp, RefreshCw, Search
} from "lucide-react";

type Filter = "all" | "unread" | "critical";

const SEVERIDAD_TOKENS: Record<Severidad, { color: string; bg: string; border: string; label: string }> = {
  info:     { color: "#60a5fa", bg: "rgba(96, 165, 250, 0.08)",  border: "rgba(96, 165, 250, 0.2)",  label: "Info" },
  warn:     { color: "#facc15", bg: "rgba(250, 204, 21, 0.08)",  border: "rgba(250, 204, 21, 0.2)",  label: "Aviso" },
  error:    { color: "#f87171", bg: "rgba(248, 113, 113, 0.08)", border: "rgba(248, 113, 113, 0.2)", label: "Error" },
  critical: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)",   border: "rgba(239, 68, 68, 0.25)",   label: "Crítico" },
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function NotificacionesClient({ initial }: { initial: NotificacionRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { notify } = useNotifications();
  const browserPush = useBrowserPushToggle();

  useEffect(() => { setItems(initial); }, [initial]);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notificaciones-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new as NotificacionRow, ...prev].slice(0, 200));
          } else if (payload.eventType === "UPDATE") {
            const u = payload.new as NotificacionRow;
            setItems((prev) => prev.map((n) => (n.id === u.id ? u : n)));
          } else if (payload.eventType === "DELETE") {
            const o = payload.old as { id: string };
            setItems((prev) => prev.filter((n) => n.id !== o.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    let arr = items;
    if (filter === "unread")   arr = arr.filter((n) => !n.leida_en);
    if (filter === "critical") arr = arr.filter((n) => n.severidad === "critical" || n.severidad === "error");
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((n) =>
        n.titulo.toLowerCase().includes(q) ||
        (n.mensaje?.toLowerCase().includes(q) ?? false) ||
        n.tipo.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [items, filter, search]);

  const unreadCount = items.filter((n) => !n.leida_en).length;
  const criticalCount = items.filter((n) => (n.severidad === "critical" || n.severidad === "error") && !n.leida_en).length;

  const countsBySeverity = useMemo(() => {
    const unread = items.filter((n) => !n.leida_en);
    return {
      total: unread.length,
      critical: unread.filter((n) => n.severidad === "critical").length,
      error: unread.filter((n) => n.severidad === "error").length,
      warn: unread.filter((n) => n.severidad === "warn").length,
      info: unread.filter((n) => n.severidad === "info").length,
    };
  }, [items]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err) {
      console.error("Error al actualizar las notificaciones:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  async function markRead(id: string) {
    const supabase = createClient();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida_en: new Date().toISOString() } : n)));
    await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id", id);
  }

  async function markUnread(id: string) {
    const supabase = createClient();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida_en: null } : n)));
    await supabase.from("notificaciones").update({ leida_en: null }).eq("id", id);
  }

  async function deleteOne(id: string) {
    const supabase = createClient();
    const removed = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notificaciones").delete().eq("id", id);
    if (error) {
      if (removed) setItems((prev) => [removed, ...prev]);
      notify({ kind: "error", title: "No se pudo eliminar", message: error.message });
    } else {
      notify({ kind: "success", title: "Notificación eliminada", duration: 2500 });
    }
  }

  async function markAllRead() {
    const supabase = createClient();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.leida_en ? n : { ...n, leida_en: now })));
    await supabase.rpc("marcar_notificaciones_leidas", {});
    notify({ kind: "success", title: "Todas marcadas como leídas", duration: 2500 });
  }

  async function clearAll() {
    if (!confirm("¿Eliminar TODAS las notificaciones leídas? Esta acción no se puede deshacer.")) return;
    const supabase = createClient();
    const ids = items.filter((n) => n.leida_en).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((n) => !n.leida_en));
    await supabase.from("notificaciones").delete().in("id", ids);
    notify({ kind: "success", title: `${ids.length} notificaciones eliminadas`, duration: 2500 });
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Centro de notificaciones"
        subtitle="Monitoreo de alertas, eventos y estado del sistema"
        icon={<Bell size={20} />}
        iconColor="#facc15"
        stats={[
          { label: "Sin leer", value: unreadCount },
          { label: "Críticas", value: criticalCount },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)",
                cursor: "pointer", opacity: isRefreshing ? 0.6 : 1, transition: "all 0.15s ease"
              }}
              className="btn btn-secondary"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin-custom" : ""} />
              <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
            </button>

            <button
              onClick={browserPush.toggle}
              className={`btn btn-sm ${browserPush.enabled ? "btn-success" : "btn-secondary"}`}
              title={browserPush.enabled ? "Notificaciones del navegador activadas" : "Activar notificaciones del navegador"}
              aria-pressed={browserPush.enabled}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Bell size={13} />
              <span>{browserPush.enabled ? "Push activo" : "Activar push"}</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Check size={13} />
                <span>Marcar todo leído</span>
              </button>
            )}

            {items.some((n) => n.leida_en) && (
              <button
                onClick={clearAll}
                className="btn btn-ghost btn-sm"
                style={{ color: "#f87171", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Trash2 size={13} />
                <span>Limpiar leídas</span>
              </button>
            )}
          </div>
        }
      />

      {/* Cards de Resumen KPI por Severidad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <SeverityScorecard
          label="Total Pendientes"
          value={countsBySeverity.total}
          color="#8b5cf6"
          glowColor="rgba(139,92,246,0.12)"
          icon={<Bell size={16} />}
        />
        <SeverityScorecard
          label="Críticas y Errores"
          value={countsBySeverity.critical + countsBySeverity.error}
          color="#ef4444"
          glowColor="rgba(239,68,68,0.12)"
          icon={<AlertCircle size={16} />}
        />
        <SeverityScorecard
          label="Avisos / Advertencias"
          value={countsBySeverity.warn}
          color="#fbbf24"
          glowColor="rgba(245,158,11,0.12)"
          icon={<AlertTriangle size={16} />}
        />
        <SeverityScorecard
          label="Informativas"
          value={countsBySeverity.info}
          color="#3b82f6"
          glowColor="rgba(59,130,246,0.12)"
          icon={<Info size={16} />}
        />
      </div>

      {/* Filtros + buscador */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 9, padding: 4 }}>
          {(["all", "unread", "critical"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn btn-sm"
              style={{
                background: filter === f ? "var(--bg-card)" : "transparent",
                color: filter === f ? "var(--text-primary)" : "var(--text-muted)",
                border: filter === f ? "1px solid var(--border-hover)" : "1px solid transparent",
                boxShadow: filter === f ? "0 2px 6px -2px rgba(0,0,0,0.4)" : "none",
                fontWeight: 600,
              }}
            >
              {f === "all" ? `Todas (${items.length})` : f === "unread" ? `Sin leer (${unreadCount})` : `Críticas (${criticalCount})`}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} width="13" height="13" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, tipo..."
            style={{
              padding: "9px 30px 9px 34px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 9, fontSize: 13, color: "var(--text-primary)", outline: "none", width: 260,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 8, background: "none", border: "none",
                color: "var(--text-faint)", cursor: "pointer", fontSize: 12, padding: 4
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "60ms", animationFillMode: "backwards" }}>
        {filtered.length === 0 ? (
          <EmptyNotifs filter={filter} hasItems={items.length > 0} />
        ) : (
          <div className="stagger-fade-up">
            {filtered.map((n) => (
              <NotifFullItem
                key={n.id}
                n={n}
                onMarkRead={() => markRead(n.id)}
                onMarkUnread={() => markUnread(n.id)}
                onDelete={() => deleteOne(n.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Estilos dinámicos inyectados */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 0.8s linear infinite;
        }
        @keyframes pulse-unread {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        .unread-pulse-dot {
          animation: pulse-unread 2s infinite;
        }
        .notification-item-card {
          transition: all 0.15s ease;
        }
        .notification-item-card:hover {
          background-color: rgba(255, 255, 255, 0.015) !important;
        }
      `}} />
    </div>
  );
}

/* ─────────────── SCORECARD COMPONENT ─────────────── */
function SeverityScorecard({ label, value, color, glowColor, icon }: {
  label: string; value: number; color: string; glowColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="card" style={{
      padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
      boxShadow: value > 0 ? `0 0 15px -3px ${color}20` : "none",
      transition: "all 0.25s ease"
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span style={{ fontSize: 26, fontWeight: 700, color: value > 0 ? color : "var(--text-muted)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
          {value}
        </span>
      </div>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: value > 0 ? glowColor : "rgba(255,255,255,0.02)",
        color: value > 0 ? color : "var(--text-faint)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.25s ease"
      }}>
        {icon}
      </div>
    </div>
  );
}

/* ─────────────── NOTIF ITEM COMPONENT ─────────────── */
function NotifFullItem({ n, onMarkRead, onMarkUnread, onDelete }: {
  n: NotificacionRow;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const t = SEVERIDAD_TOKENS[n.severidad];
  const isRead = !!n.leida_en;
  const hasMetadata = n.metadata && Object.keys(n.metadata).length > 0;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        padding: "16px 22px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderLeft: `3px solid ${isRead ? "transparent" : t.color}`,
        background: isRead ? "transparent" : `${t.bg}`,
        opacity: isRead ? 0.66 : 1,
        transition: "all 0.15s ease",
      }}
      className="notification-item-card"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: t.bg, border: `1px solid ${t.border}`, color: t.color,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <SeveridadIcon severidad={n.severidad} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{n.titulo}</p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
              background: t.bg, border: `1px solid ${t.border}`, color: t.color,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {t.label}
            </span>
            {!isRead && (
              <span className="unread-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} />
            )}
          </div>
          {n.mensaje && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, margin: "4px 0 6px 0" }}>
              {n.mensaje}
            </p>
          )}
          <p style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums", margin: 0 }}>
            {n.tipo} · {fmtDateTime(n.creada_en)}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          {hasMetadata && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="btn btn-icon btn-sm btn-icon-edit"
              title={isOpen ? "Ocultar detalles" : "Ver detalles"}
              style={{ padding: 4 }}
            >
              {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {isRead ? (
            <button onClick={onMarkUnread} title="Marcar sin leer" aria-label="Marcar sin leer" className="btn btn-icon btn-sm btn-icon-edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/></svg>
            </button>
          ) : (
            <button onClick={onMarkRead} title="Marcar como leída" aria-label="Marcar como leída" className="btn btn-icon btn-sm btn-icon-edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          )}
          <button onClick={onDelete} title="Eliminar" aria-label="Eliminar" className="btn btn-icon btn-sm btn-icon-danger">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>

      {isOpen && hasMetadata && (
        <div style={{ paddingLeft: 46 }}>
          <NotificationMetadataViewer metadata={n.metadata} />
        </div>
      )}
    </div>
  );
}

/* ─────────────── METADATA VIEWER COMPONENT ─────────────── */
function NotificationMetadataViewer({ metadata }: { metadata: Record<string, any> }) {
  const [showRaw, setShowRaw] = useState(false);

  const entries = useMemo(() => {
    if (!metadata) return [];
    return Object.entries(metadata).filter(([k]) => k !== "id");
  }, [metadata]);

  if (entries.length === 0) return null;

  return (
    <div style={{
      marginTop: 8, display: "flex", flexDirection: "column", gap: 10,
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 8, padding: 12
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
          {showRaw ? "Datos raw (JSON):" : "Detalles del evento:"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowRaw(!showRaw);
          }}
          style={{
            background: "var(--bg-black)", border: "1px solid var(--border)",
            padding: "2px 8px", borderRadius: 4, fontSize: 9.5, cursor: "pointer",
            color: "var(--text-muted)", fontWeight: 600, height: 20
          }}
        >
          {showRaw ? "Estructurado" : "Ver JSON"}
        </button>
      </div>

      {showRaw ? (
        <pre style={{
          margin: 0, padding: 8, background: "var(--bg-black)", borderRadius: 6,
          fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)",
          whiteSpace: "pre-wrap", wordBreak: "break-all", border: "1px solid var(--border)"
        }}>
          {JSON.stringify(metadata, null, 2)}
        </pre>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{
              padding: "4px 8px", borderRadius: 4, background: "var(--bg-black)",
              border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 10.5
            }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}:</span>
              <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }} title={String(v)}>
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── SEVERIDAD ICON ─────────────── */
function SeveridadIcon({ severidad }: { severidad: Severidad }) {
  switch (severidad) {
    case "info":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case "warn":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "error":
    case "critical":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
  }
}

/* ─────────────── EMPTY NOTIFS COMPONENT ─────────────── */
function EmptyNotifs({ filter, hasItems }: { filter: Filter; hasItems: boolean }) {
  const messages = {
    all:      { title: "Sin notificaciones", msg: "Te avisaremos cuando algo necesite tu atención." },
    unread:   { title: "Todo leído", msg: "No tienes notificaciones pendientes. ¡Bien!" },
    critical: { title: "Sin alertas críticas", msg: "Las estaciones operan con normalidad." },
  };
  const m = messages[filter];
  return (
    <div style={{ padding: "70px 20px", textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)",
        border: "1px solid rgba(34,197,94,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px", color: "#4ade80",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>{m.title}</p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 320, margin: "0 auto" }}>
        {hasItems ? m.msg : "Cuando ocurran eventos importantes (estaciones offline, llegadas tarde, errores), aparecerán aquí."}
      </p>
    </div>
  );
}

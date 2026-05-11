"use client";

import { useState, useMemo } from "react";
import {
  Activity, UserPlus, UserMinus, Edit3, Download, Upload, Trash2,
  Brain, Image as ImageIcon, AlertCircle, CheckCircle2, RefreshCw,
  Monitor, Wifi, WifiOff, Eye, ChevronDown, ChevronUp, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  metadata: Record<string, unknown> | null;
  actor_email: string | null;
  ip: string | null;
  created_at: string;
}

interface StationLog {
  id: string;
  dispositivo_id: string;
  tipo: string;
  detalle: Record<string, unknown>;
  creado_en: string;
}

type Tab = "todos" | "admin" | "station" | "training";

interface Event {
  id: string;
  ts: string;
  source: "admin" | "station";
  action: string;
  resource?: string;
  actor?: string;
  ip?: string;
  device?: string;
  metadata: Record<string, unknown> | null;
}

// Mapeo de acciones a icono + color + label legible
const ACTION_MAP: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  // Admin (audit_log)
  "empleado.create":      { icon: UserPlus,   color: "#10b981", label: "Empleado creado" },
  "empleado.update":      { icon: Edit3,      color: "#3b82f6", label: "Empleado actualizado" },
  "empleado.delete":      { icon: UserMinus,  color: "#ef4444", label: "Empleado eliminado" },
  "empleado.bulk_import": { icon: Upload,     color: "#8b5cf6", label: "Importación masiva" },
  "dispositivo.create":   { icon: Monitor,    color: "#10b981", label: "Estación registrada" },
  "dispositivo.update":   { icon: Edit3,      color: "#3b82f6", label: "Estación actualizada" },
  "dispositivo.delete":   { icon: Trash2,     color: "#ef4444", label: "Estación eliminada" },
  // Station (logs_estacion)
  "sync_ok":              { icon: Download,   color: "#10b981", label: "Sincronización OK" },
  "sync_error":           { icon: AlertCircle, color: "#ef4444", label: "Error de sincronización" },
  "training_started":     { icon: Brain,      color: "#f59e0b", label: "Entrenamiento iniciado" },
  "training_completed":   { icon: CheckCircle2, color: "#10b981", label: "Entrenamiento completado" },
  "embedding_generated":  { icon: Brain,      color: "#06b6d4", label: "Embedding generado" },
  "embedding_failed":     { icon: AlertCircle, color: "#ef4444", label: "Error generando embedding" },
  "foto_descargada":      { icon: ImageIcon,  color: "#06b6d4", label: "Foto descargada" },
  "foto_error_descarga":  { icon: AlertCircle, color: "#ef4444", label: "Error descargando foto" },
  "reconocimiento_ok":    { icon: Eye,        color: "#10b981", label: "Reconocimiento OK" },
  "reconocimiento_fallo": { icon: AlertCircle, color: "#f59e0b", label: "Reconocimiento fallido" },
  "asistencia_registrada": { icon: CheckCircle2, color: "#10b981", label: "Asistencia registrada" },
  "camara_ok":            { icon: Wifi,       color: "#10b981", label: "Cámara OK" },
  "camara_error":         { icon: WifiOff,    color: "#ef4444", label: "Cámara con error" },
};

function getActionMeta(action: string) {
  return ACTION_MAP[action] ?? { icon: Activity, color: "#6b7280", label: action };
}

export function ActividadClient({
  auditEntries, stationLogs, dispositivos,
}: {
  auditEntries: AuditEntry[];
  stationLogs: StationLog[];
  dispositivos: Array<{ id: string; nombre: string }>;
}) {
  const [tab, setTab] = useState<Tab>("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const dispMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dispositivos) m.set(d.id, d.nombre);
    return m;
  }, [dispositivos]);

  // Unir ambas fuentes en un timeline
  const events: Event[] = useMemo(() => {
    const fromAudit: Event[] = auditEntries.map((a) => ({
      id: `a-${a.id}`,
      ts: a.created_at,
      source: "admin",
      action: a.action,
      resource: a.resource,
      actor: a.actor_email ?? undefined,
      ip: a.ip ?? undefined,
      metadata: a.metadata,
    }));
    const fromStation: Event[] = stationLogs.map((s) => ({
      id: `s-${s.id}`,
      ts: s.creado_en,
      source: "station",
      action: s.tipo,
      device: dispMap.get(s.dispositivo_id) ?? s.dispositivo_id.slice(0, 8),
      metadata: s.detalle,
    }));
    return [...fromAudit, ...fromStation].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [auditEntries, stationLogs, dispMap]);

  const filtered = useMemo(() => {
    let list = events;
    if (tab === "admin")    list = list.filter((e) => e.source === "admin");
    if (tab === "station")  list = list.filter((e) => e.source === "station");
    if (tab === "training") list = list.filter((e) =>
      e.action.startsWith("training_") || e.action.startsWith("embedding_") || e.action.startsWith("foto_")
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.action.toLowerCase().includes(q) ||
        e.actor?.toLowerCase().includes(q) ||
        e.device?.toLowerCase().includes(q) ||
        e.resource?.toLowerCase().includes(q) ||
        JSON.stringify(e.metadata ?? {}).toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, tab, search]);

  const counts = useMemo(() => ({
    todos:    events.length,
    admin:    events.filter((e) => e.source === "admin").length,
    station:  events.filter((e) => e.source === "station").length,
    training: events.filter((e) =>
      e.action.startsWith("training_") || e.action.startsWith("embedding_") || e.action.startsWith("foto_")
    ).length,
  }), [events]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const tabs: Array<{ id: Tab; label: string; count: number; tone: string }> = [
    { id: "todos",    label: "Todo",          count: counts.todos,    tone: "#6b7280" },
    { id: "admin",    label: "Admin Panel",   count: counts.admin,    tone: "#3b82f6" },
    { id: "station",  label: "Estaciones",    count: counts.station,  tone: "#10b981" },
    { id: "training", label: "Entrenamiento", count: counts.training, tone: "#f59e0b" },
  ];

  return (
    <div className="page animate-fade-up">
      <Breadcrumbs crumbs={[{ label: "Actividad" }]} />
      <PageHeader
        title="Actividad y auditoría"
        subtitle="Historial completo del panel y de las estaciones"
        icon={<Activity size={20} />}
        stats={[
          { label: "Total", value: counts.todos },
          { label: "Admin", value: counts.admin },
          { label: "Stations", value: counts.station },
        ]}
        actions={
          <ExportButton
            label="Exportar"
            filenamePrefix="actividad"
            getRows={() => filtered.map((e) => ({
              Fecha: new Date(e.ts).toLocaleString("es-MX"),
              Origen: e.source,
              Accion: e.action,
              Actor: e.actor ?? e.device ?? "",
              Recurso: e.resource ?? "",
              IP: e.ip ?? "",
              Detalle: JSON.stringify(e.metadata ?? {}),
            }))}
          />
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginTop: 12, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 14px",
              background: "transparent", border: "none",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-faint)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              borderBottom: `2px solid ${tab === t.id ? t.tone : "transparent"}`,
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11, padding: "1px 6px",
              borderRadius: 10,
              background: tab === t.id ? `${t.tone}1f` : "var(--bg-elevated)",
              color: tab === t.id ? t.tone : "var(--text-faint)",
              minWidth: 18, textAlign: "center",
            }}>{t.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ paddingBottom: 8 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por accion, actor, recurso..."
            style={{
              width: 280, padding: "7px 10px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12, color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          tone="blue"
          title={search ? "Sin resultados" : "Sin actividad todavía"}
          description={search
            ? "Prueba con otro filtro o palabra."
            : "Cuando crees empleados, edites estaciones o sincronices, las acciones aparecerán aquí."
          }
        />
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((e) => {
              const meta = getActionMeta(e.action);
              const Icon = meta.icon;
              const isOpen = expanded.has(e.id);
              const hasDetail = e.metadata && Object.keys(e.metadata).length > 0;

              return (
                <li key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <button
                    onClick={() => hasDetail && toggle(e.id)}
                    style={{
                      width: "100%", padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: 14,
                      background: "transparent", border: "none",
                      cursor: hasDetail ? "pointer" : "default",
                      textAlign: "left", color: "var(--text-primary)",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${meta.color}1f`, color: meta.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</span>
                        <span style={{
                          fontSize: 10, padding: "1px 6px",
                          background: e.source === "admin" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                          color: e.source === "admin" ? "#3b82f6" : "#10b981",
                          borderRadius: 4, fontWeight: 500,
                        }}>
                          {e.source === "admin" ? "ADMIN" : "STATION"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 8 }}>
                        {e.actor && <span>{e.actor}</span>}
                        {e.device && <span>📟 {e.device}</span>}
                        {e.resource && <span>· {e.resource}</span>}
                        {e.ip && <span>· {e.ip}</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {formatRelativeTime(e.ts)}
                    </div>

                    {hasDetail && (
                      isOpen
                        ? <ChevronUp size={14} style={{ color: "var(--text-faint)" }} />
                        : <ChevronDown size={14} style={{ color: "var(--text-faint)" }} />
                    )}
                  </button>

                  {isOpen && hasDetail && (
                    <div style={{
                      padding: "0 16px 14px 66px",
                      fontSize: 11, color: "var(--text-secondary)",
                    }}>
                      <pre style={{
                        margin: 0, padding: 10,
                        background: "var(--bg-elevated)", borderRadius: 6,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        fontFamily: "ui-monospace, monospace", fontSize: 11,
                      }}>
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60)        return "hace " + diff + "s";
  if (diff < 3600)      return "hace " + Math.floor(diff / 60) + "m";
  if (diff < 86400)     return "hace " + Math.floor(diff / 3600) + "h";
  if (diff < 604800)    return "hace " + Math.floor(diff / 86400) + "d";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

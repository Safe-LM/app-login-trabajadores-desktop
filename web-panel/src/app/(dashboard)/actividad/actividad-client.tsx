"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, UserPlus, UserMinus, Edit3, Download, Upload, Trash2,
  Brain, Image as ImageIcon, AlertCircle, CheckCircle2, RefreshCw,
  Monitor, Wifi, WifiOff, Eye, ChevronDown, ChevronUp, Trophy, type LucideIcon,
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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      // Delay de animación para UX fluida
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err) {
      console.error("Error al actualizar la actividad:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginTop: 12, marginBottom: 16, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
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
        <div style={{ flex: 1, minWidth: 10 }} />
        <div style={{ paddingBottom: 8, position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar accion, actor, recurso..."
            style={{
              width: 280, padding: "7px 30px 7px 10px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12, color: "var(--text-primary)",
              outline: "none",
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

      {/* Controles de Acordeón */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 500 }}>
          Mostrando {filtered.length} eventos
        </span>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              const idsWithMeta = filtered
                .filter((e) => e.metadata && Object.keys(e.metadata).length > 0)
                .map((e) => e.id);
              setExpanded(new Set(idsWithMeta));
            }}
            style={{
              padding: "4px 8px", background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, fontSize: 11, cursor: "pointer", color: "var(--text-muted)",
              transition: "all 0.1s ease"
            }}
            className="btn btn-secondary btn-xs"
          >
            Expandir todo
          </button>
          <button
            onClick={() => setExpanded(new Set())}
            style={{
              padding: "4px 8px", background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, fontSize: 11, cursor: "pointer", color: "var(--text-muted)",
              transition: "all 0.1s ease"
            }}
            className="btn btn-secondary btn-xs"
          >
            Contraer todo
          </button>
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
                <li key={e.id} style={{ borderBottom: "1px solid var(--border)", position: "relative" }}>
                  {/* Conector Vertical de la línea de tiempo */}
                  <div style={{
                    position: "absolute", left: 34, top: 0, bottom: 0,
                    width: 2, background: "var(--border)", zIndex: 0
                  }} />

                  <button
                    onClick={() => hasDetail && toggle(e.id)}
                    style={{
                      width: "100%", padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: 14,
                      background: "transparent", border: "none",
                      cursor: hasDetail ? "pointer" : "default",
                      textAlign: "left", color: "var(--text-primary)",
                      position: "relative", zIndex: 1
                    }}
                    className="timeline-item-btn"
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${meta.color}1f`, color: meta.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 0 0 4px var(--bg-card)",
                      position: "relative", zIndex: 2
                    }}>
                      <Icon size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
                        <span style={{
                          fontSize: 9.5, padding: "1px 6px",
                          background: e.source === "admin" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                          color: e.source === "admin" ? "#3b82f6" : "#10b981",
                          borderRadius: 4, fontWeight: 700,
                        }}>
                          {e.source === "admin" ? "ADMIN" : "STATION"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {e.actor && <span>👤 {e.actor}</span>}
                        {e.device && <span>📟 {e.device}</span>}
                        {e.resource && <span>· Recurso: {e.resource}</span>}
                        {e.ip && <span>· IP: {e.ip}</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {formatRelativeTime(e.ts)}
                    </div>

                    {hasDetail && (
                      <div style={{ marginLeft: 6 }}>
                        {isOpen
                          ? <ChevronUp size={14} style={{ color: "var(--text-faint)" }} />
                          : <ChevronDown size={14} style={{ color: "var(--text-faint)" }} />
                        }
                      </div>
                    )}
                  </button>

                  {isOpen && hasDetail && e.metadata && (
                    <div style={{
                      padding: "0 16px 14px 66px",
                      position: "relative", zIndex: 1
                    }}>
                      <MetadataViewer action={e.action} metadata={e.metadata} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Estilos dinámicos para animaciones y micro-interacciones */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 0.8s linear infinite;
        }
        .timeline-item-btn {
          transition: background-color 0.15s ease;
        }
        .timeline-item-btn:hover {
          background-color: rgba(255, 255, 255, 0.015) !important;
        }
      `}} />
    </div>
  );
}

/* ─────────────── METADATA VIEWER COMPONENT ─────────────── */
function MetadataViewer({ action, metadata }: { action: string; metadata: Record<string, any> }) {
  const [showRaw, setShowRaw] = useState(false);

  // Parsear metadatos comunes para visualización premium
  const content = useMemo(() => {
    if (!metadata || Object.keys(metadata).length === 0) return null;

    // Caso 1: Reconocimiento Biométrico
    if (action === "reconocimiento_ok" || action === "reconocimiento_fallo") {
      const confidence = typeof metadata.similarity === "number" 
        ? Math.round(metadata.similarity * 100) 
        : typeof metadata.confidence === "number"
        ? Math.round(metadata.confidence * 100)
        : null;
      const employeeName = metadata.empleado_nombre || metadata.employee_name || "";
      const errorMsg = metadata.error || metadata.motivo || metadata.reason;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>Resultado:</span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: action === "reconocimiento_ok" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: action === "reconocimiento_ok" ? "#10b981" : "#ef4444",
              fontWeight: 600
            }}>
              {action === "reconocimiento_ok" ? "Verificado" : "Fallo Biométrico"}
            </span>

            {employeeName && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Colaborador: <strong>{employeeName}</strong>
              </span>
            )}

            {confidence != null && (
              <span style={{
                fontSize: 10.5, padding: "2px 6px", borderRadius: 4,
                background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)",
                fontVariantNumeric: "tabular-nums"
              }}>
                Confianza: {confidence}%
              </span>
            )}
          </div>
          {errorMsg && (
            <div style={{
              padding: "6px 10px", borderRadius: 6,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              color: "#f87171", fontSize: 11
            }}>
              <strong>Detalle del fallo:</strong> {String(errorMsg)}
            </div>
          )}
        </div>
      );
    }

    // Caso 2: Errores Generales
    if (action.includes("error") || action.includes("failed") || action.includes("fallo")) {
      const errorMsg = metadata.error || metadata.message || metadata.reason || JSON.stringify(metadata);
      return (
        <div style={{
          padding: "8px 12px", borderRadius: 6,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", display: "flex", flexDirection: "column", gap: 4
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Error Detectado</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.4 }}>{String(errorMsg)}</span>
        </div>
      );
    }

    // Caso 3: Sincronización Exitosa
    if (action === "sync_ok") {
      const count = metadata.registros_sincronizados || metadata.synced_count || 0;
      const details = metadata.detalle || metadata.details;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>Sincronización Completa</span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 600
            }}>
              {count} registros sincronizados
            </span>
          </div>
          {details && (
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{String(details)}</p>
          )}
        </div>
      );
    }

    // Caso 4: Cambios del Admin en Empleados / Dispositivos
    if (action.startsWith("empleado.") || action.startsWith("dispositivo.")) {
      const keys = Object.keys(metadata).filter((k) => k !== "id");
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>Atributos modificados:</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
            {keys.map((k) => {
              const val = metadata[k];
              return (
                <div key={k} style={{
                  padding: "4px 8px", borderRadius: 4, background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 10.5
                }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}:</span>
                  <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                    {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Caso por defecto: Atributos clave-valor generales
    const entries = Object.entries(metadata);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{
              padding: "4px 8px", borderRadius: 4, background: "var(--bg-elevated)",
              border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 10.5
            }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}:</span>
              <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }} title={String(v)}>
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [action, metadata]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", background: "var(--bg-card)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          {showRaw ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>Detalles RAW (JSON):</span>
          ) : (
            content
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowRaw(!showRaw);
          }}
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            padding: "2px 8px", borderRadius: 4, fontSize: 9.5, cursor: "pointer",
            color: "var(--text-muted)", fontWeight: 600, flexShrink: 0, height: 20
          }}
        >
          {showRaw ? "Estructurado" : "Ver JSON"}
        </button>
      </div>

      {showRaw && (
        <pre style={{
          margin: 0, padding: 8,
          background: "var(--bg-elevated)", borderRadius: 6,
          whiteSpace: "pre-wrap", wordBreak: "break-all",
          fontFamily: "ui-monospace, monospace", fontSize: 10.5,
          border: "1px solid var(--border)", color: "var(--text-secondary)"
        }}>
          {JSON.stringify(metadata, null, 2)}
        </pre>
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


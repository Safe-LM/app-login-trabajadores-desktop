"use client";

import { useState } from "react";
import { Plus, Trash2, Edit3, Send, Webhook as WebhookIcon, Check, X, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";

type Webhook = {
  id: string;
  nombre: string;
  url: string;
  secret: string | null;
  activo: boolean;
  eventos: string[];
  ultimo_enviado_at: string | null;
  ultimo_status: number | null;
  ultimo_error: string | null;
  total_enviados: number;
  total_fallidos: number;
  creado_en: string;
};

const EVENTOS_DISPONIBLES = [
  { value: "*",                          label: "Todos los eventos" },
  { value: "station_offline",            label: "Estación offline" },
  { value: "station_recovered",          label: "Estación recuperada" },
  { value: "station_release_available",  label: "Nueva versión disponible" },
  { value: "panel_release_available",    label: "Nueva versión del panel" },
  { value: "asistencia_anomala",         label: "Anomalías de asistencia" },
];

export function WebhooksClient({ initial }: { initial: Webhook[] }) {
  const [items, setItems] = useState<Webhook[]>(initial);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/webhooks");
    const data = await r.json();
    if (data.webhooks) setItems(data.webhooks);
  }

  async function toggleActive(w: Webhook) {
    const res = await fetch(`/api/webhooks/${w.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !w.activo }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((x) => x.id === w.id ? { ...x, activo: !w.activo } : x));
      toast.success(w.activo ? "Webhook desactivado" : "Webhook activado");
    } else {
      toast.error("Error al cambiar estado");
    }
  }

  async function remove(w: Webhook) {
    if (!confirm(`¿Eliminar el webhook "${w.nombre}"?`)) return;
    const res = await fetch(`/api/webhooks/${w.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== w.id));
      toast.success("Webhook eliminado");
    } else {
      toast.error("Error al eliminar");
    }
  }

  async function test(w: Webhook) {
    setTesting(w.id);
    try {
      const res = await fetch(`/api/webhooks/${w.id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Test enviado · HTTP ${data.status}`);
      } else {
        toast.error(`Test falló · ${data.error ?? `HTTP ${data.status}`}`);
      }
      refresh();
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="page animate-fade-up">
      <Breadcrumbs crumbs={[
        { label: "Configuración", href: "/configuracion" },
        { label: "Webhooks" },
      ]} />
      <PageHeader
        title="Webhooks"
        subtitle="Notifica a sistemas externos cuando pasan eventos"
        icon={<WebhookIcon size={20} />}
        iconColor="#8b5cf6"
        stats={[
          { label: "Activos",   value: items.filter((x) => x.activo).length },
          { label: "Total",     value: items.length },
        ]}
        actions={
          <button onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
            <Plus size={13} />
            <span>Nuevo webhook</span>
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={WebhookIcon}
          tone="violet"
          title="Sin webhooks configurados"
          description="Conecta tu Slack, Teams, n8n, Zapier o tu propio backend para recibir notificaciones automáticas."
          action={{ label: "Crear webhook", onClick: () => setCreating(true), icon: Plus }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((w) => (
            <WebhookRow
              key={w.id}
              w={w}
              onToggle={() => toggleActive(w)}
              onEdit={() => setEditing(w)}
              onDelete={() => remove(w)}
              onTest={() => test(w)}
              testing={testing === w.id}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <WebhookModal
          webhook={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function WebhookRow({ w, onToggle, onEdit, onDelete, onTest, testing }: {
  w: Webhook;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  const lastStatus = w.ultimo_status;
  const ok = lastStatus != null && lastStatus >= 200 && lastStatus < 300;

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: w.activo ? "#10b981" : "var(--text-faint)",
              boxShadow: w.activo ? "0 0 6px rgba(16,185,129,0.6)" : "none",
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{w.nombre}</span>
            {!w.activo && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>
                Inactivo
              </span>
            )}
          </div>
          <code style={{ fontSize: 11, color: "var(--text-faint)", wordBreak: "break-all" }}>
            {w.url}
          </code>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={onTest} disabled={testing} title="Enviar prueba" className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }}>
            <Send size={12} />
            {testing ? "..." : "Test"}
          </button>
          <button onClick={onToggle} title={w.activo ? "Desactivar" : "Activar"} className="btn btn-secondary btn-sm" style={{ padding: "6px 8px" }}>
            {w.activo ? <X size={13} /> : <Check size={13} />}
          </button>
          <button onClick={onEdit} title="Editar" className="btn btn-secondary btn-sm" style={{ padding: "6px 8px" }}>
            <Edit3 size={13} />
          </button>
          <button onClick={onDelete} title="Eliminar" className="btn btn-secondary btn-sm" style={{ padding: "6px 8px", color: "#f87171" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {w.eventos.map((ev) => (
          <span key={ev} style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 4,
            background: "rgba(139,92,246,0.12)", color: "#a78bfa", fontWeight: 600,
          }}>
            {EVENTOS_DISPONIBLES.find((e) => e.value === ev)?.label ?? ev}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-faint)", paddingTop: 6, borderTop: "1px solid var(--border)" }}>
        <span>📤 {w.total_enviados} enviados</span>
        {w.total_fallidos > 0 && <span style={{ color: "#f87171" }}>⚠️ {w.total_fallidos} fallidos</span>}
        {lastStatus != null && (
          <span style={{ color: ok ? "#10b981" : "#f87171" }}>
            Último: HTTP {lastStatus}
            {w.ultimo_enviado_at && ` · ${new Date(w.ultimo_enviado_at).toLocaleString("es-MX")}`}
          </span>
        )}
        {w.ultimo_error && (
          <span title={w.ultimo_error} style={{ color: "#f87171", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11} /> Error
          </span>
        )}
      </div>
    </div>
  );
}

function WebhookModal({ webhook, onClose, onSaved }: {
  webhook: Webhook | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(webhook?.nombre ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [secret, setSecret] = useState(webhook?.secret ?? "");
  const [eventos, setEventos] = useState<string[]>(webhook?.eventos ?? ["*"]);
  const [saving, setSaving] = useState(false);

  function toggleEvento(ev: string) {
    setEventos((prev) => {
      if (ev === "*") return ["*"];
      const next = prev.filter((e) => e !== "*");
      if (next.includes(ev)) return next.filter((e) => e !== ev);
      return [...next, ev];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !url.trim()) { toast.error("Nombre y URL son requeridos"); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ nombre, url, secret: secret || null, eventos });
      const res = webhook
        ? await fetch(`/api/webhooks/${webhook.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      toast.success(webhook ? "Webhook actualizado" : "Webhook creado");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{
        width: "min(560px, 100%)",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 14, boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {webhook ? "Editar webhook" : "Nuevo webhook"}
          </h2>
        </div>
        <form onSubmit={submit} style={{ padding: 20, overflowY: "auto" }}>
          <Field label="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required style={modalInput} placeholder="Ej: Slack del equipo de RRHH" />
          </Field>
          <Field label="URL" hint="Donde se enviará el POST con el payload JSON.">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required style={modalInput} placeholder="https://hooks.slack.com/services/..." />
          </Field>
          <Field label="Secret (opcional)" hint="Si lo defines, se enviará como header X-SafeLink-Secret para validar origen.">
            <input value={secret} onChange={(e) => setSecret(e.target.value)} style={modalInput} placeholder="Cualquier cadena alfanumérica" />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Eventos
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {EVENTOS_DISPONIBLES.map((ev) => {
                const active = eventos.includes(ev.value);
                return (
                  <label key={ev.value} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                    background: active ? "rgba(139,92,246,0.1)" : "var(--bg-elevated)",
                    border: `1px solid ${active ? "rgba(139,92,246,0.3)" : "var(--border)"}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleEvento(ev.value)}
                      style={{ accentColor: "#8b5cf6" }}
                    />
                    <span style={{ fontSize: 13, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {ev.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? "Guardando..." : webhook ? "Guardar cambios" : "Crear webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const modalInput: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, color: "var(--text-primary)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

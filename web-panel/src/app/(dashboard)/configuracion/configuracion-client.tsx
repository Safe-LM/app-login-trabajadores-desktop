"use client";
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";

type Empresa = {
  id: string;
  nombre: string;
  slug: string;
  timezone: string;
  logo_url: string | null;
};

type SucursalHorario = {
  id: string;
  nombre: string;
  hora_apertura: string | null;
  hora_cierre: string | null;
  tolerancia_min: number;
  activa: boolean;
};

const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Mexico_City",       label: "México · CDMX (GMT-6)" },
  { value: "America/Tijuana",           label: "México · Tijuana (GMT-8)" },
  { value: "America/Monterrey",         label: "México · Monterrey (GMT-6)" },
  { value: "America/Bogota",            label: "Colombia · Bogotá (GMT-5)" },
  { value: "America/Lima",              label: "Perú · Lima (GMT-5)" },
  { value: "America/Santiago",          label: "Chile · Santiago (GMT-4)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina · Buenos Aires (GMT-3)" },
  { value: "UTC",                       label: "UTC" },
];

const LOGO_BUCKET = "logos-empresa";
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function ConfiguracionClient({ empresa, sucursales }: { empresa: Empresa; sucursales: SucursalHorario[] }) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", width: "100%" }}>
      <PageHeader
        title="Configuración"
        subtitle="Información de tu empresa, horarios y administración"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>}
        iconColor="#94a3b8"
      />
      <div className="stagger-fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <EmpresaSection empresa={empresa} />
        <SucursalesSection initial={sucursales} />
        <EquipoCard />
        <DangerZone />
      </div>
    </div>
  );
}

/* ─────────────── EMPRESA ─────────────── */
function EmpresaSection({ empresa }: { empresa: Empresa }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre]       = useState(empresa.nombre);
  const [timezone, setTimezone]   = useState(empresa.timezone);
  const [logoUrl, setLogoUrl]     = useState(empresa.logo_url);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = nombre !== empresa.nombre || timezone !== empresa.timezone || logoUrl !== empresa.logo_url;
  const initial = (nombre || empresa.slug).trim()[0]?.toUpperCase() ?? "E";

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), timezone, logo_url: logoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      notify({ kind: "success", title: "Configuración actualizada" });
      router.refresh();
    } catch (e) {
      notify({ kind: "error", title: "No se pudo guardar", message: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify({ kind: "error", title: "Archivo inválido", message: "Selecciona una imagen (PNG, JPG, SVG)" });
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      notify({ kind: "error", title: "Imagen demasiado grande", message: "Máximo 2 MB" });
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${empresa.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      notify({ kind: "success", title: "Logo cargado", message: "Recuerda guardar para aplicar" });
    } catch (e) {
      notify({ kind: "error", title: "No se pudo subir el logo", message: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    setLogoUrl(null);
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <Header
        title="Información general"
        subtitle="Datos visibles para tu equipo y reportes"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>}
        iconColor="#3b82f6"
      />

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
        <div style={{ position: "relative" }}>
          <div style={{
            width: 96, height: 96, borderRadius: 20, overflow: "hidden",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "var(--accent)",
          }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initial}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Cambiar logo"
            style={{
              position: "absolute", bottom: -8, right: -8,
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--accent)", border: "2px solid var(--bg-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: uploading ? "wait" : "pointer", color: "#fff",
              boxShadow: "0 4px 12px var(--accent-glow)",
            }}
          >
            {uploading
              ? <span className="animate-spin-slow" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent" }} />
              : <CameraIcon />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: "none" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p className="heading-2">{nombre || "Sin nombre"}</p>
          <p className="text-muted-sm">Slug: {empresa.slug} · ID: <code style={{ fontSize: 11 }}>{empresa.id.slice(0, 8)}</code></p>
          {logoUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={removeLogo} style={{ alignSelf: "flex-start", marginTop: 6 }}>
              Quitar logo
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <Field label="Nombre de la organización">
          <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu empresa" maxLength={120} />
        </Field>
        <Field label="Zona horaria">
          <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 10 }}>
        <button type="button" className="btn btn-primary" disabled={saving || !dirty || !nombre.trim()} onClick={save}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </section>
  );
}

/* ─────────────── SUCURSALES & HORARIOS ─────────────── */
function SucursalesSection({ initial }: { initial: SucursalHorario[] }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [items, setItems] = useState(initial);
  const [savingId, setSavingId] = useState<string | null>(null);

  function patch(id: string, patch: Partial<SucursalHorario>) {
    setItems(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  async function save(suc: SucursalHorario) {
    setSavingId(suc.id);
    try {
      const res = await fetch("/api/sucursales/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: suc.id,
          hora_apertura: suc.hora_apertura,
          hora_cierre: suc.hora_cierre,
          tolerancia_min: suc.tolerancia_min,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      notify({ kind: "success", title: `Horario actualizado · ${suc.nombre}` });
      router.refresh();
    } catch (e) {
      notify({ kind: "error", title: "No se pudo actualizar", message: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Header
          title="Horarios por sucursal"
          subtitle="La hora de apertura define cuándo se considera 'llegada tarde'"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          iconColor="#22c55e"
        />
        <Link href="/sucursales" className="btn btn-secondary btn-sm">
          Gestionar sucursales →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p className="heading-3">No has creado sucursales</p>
          <p className="text-muted-sm">Crea tu primera sucursal para configurar horarios.</p>
          <Link href="/sucursales" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
            Crear sucursal
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(s => {
            const original = initial.find(i => i.id === s.id);
            const dirty = !original
              || original.hora_apertura !== s.hora_apertura
              || original.hora_cierre   !== s.hora_cierre
              || original.tolerancia_min !== s.tolerancia_min;
            return (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(160px, 1.4fr) repeat(3, minmax(110px, 1fr)) auto",
                  gap: 10, alignItems: "end",
                  padding: "12px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
                className="sucursal-row"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.nombre}</span>
                  <span className="text-eyebrow" style={{ color: s.activa ? "#4ade80" : "#f87171" }}>
                    {s.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <Field label="Apertura">
                  <input
                    type="time"
                    className="input"
                    value={trimSeconds(s.hora_apertura)}
                    onChange={e => patch(s.id, { hora_apertura: e.target.value || null })}
                    style={{ colorScheme: "dark" }}
                  />
                </Field>
                <Field label="Cierre">
                  <input
                    type="time"
                    className="input"
                    value={trimSeconds(s.hora_cierre)}
                    onChange={e => patch(s.id, { hora_cierre: e.target.value || null })}
                    style={{ colorScheme: "dark" }}
                  />
                </Field>
                <Field label="Tolerancia (min)">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    className="input"
                    value={s.tolerancia_min}
                    onChange={e => patch(s.id, { tolerancia_min: clampInt(Number(e.target.value), 0, 240) })}
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!dirty || savingId === s.id}
                  onClick={() => save(s)}
                  style={{ minWidth: 90, justifyContent: "center" }}
                >
                  {savingId === s.id ? "Guardando…" : "Guardar"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 720px) {
          :global(.sucursal-row) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.sucursal-row > :last-child) {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </section>
  );
}

function trimSeconds(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/* ─────────────── EQUIPO ─────────────── */
function EquipoCard() {
  return (
    <Link
      href="/configuracion/equipo"
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 22px", borderRadius: 14,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        textDecoration: "none", color: "inherit",
        transition: "all .15s",
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,.4)"; }}
      onMouseOut={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "linear-gradient(135deg, rgba(59,130,246,.18), rgba(59,130,246,.06))",
        border: "1px solid rgba(59,130,246,.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#3b82f6", flexShrink: 0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
          Equipo
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Gestiona quién tiene acceso a tu empresa. Invita admins y viewers por email.
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)", flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  );
}

/* ─────────────── DANGER ZONE ─────────────── */
function DangerZone() {
  const { notify } = useNotifications();
  return (
    <section
      style={{
        border: "1px solid rgba(239,68,68,0.18)",
        background: "rgba(239,68,68,0.03)",
        borderRadius: 12,
        padding: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.06) 100%)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "#f87171",
          boxShadow: "0 6px 14px -8px rgba(239,68,68,0.5)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>Zona de peligro</h3>
          <p className="text-muted-sm" style={{ marginTop: 2, fontSize: 12 }}>
            La eliminación de la organización es irreversible y debe gestionarse con soporte.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => notify({
          kind: "info",
          title: "Acción no disponible",
          message: "Contacta a soporte@safelink.app para eliminar tu organización.",
        })}
      >
        Eliminar organización
      </button>
    </section>
  );
}

/* ─────────────── PRIMITIVOS ─────────────── */
function Header({ title, subtitle, icon, iconColor = "var(--accent)" }: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, color-mix(in srgb, ${iconColor} 18%, transparent) 0%, color-mix(in srgb, ${iconColor} 6%, transparent) 100%)`,
          border: `1px solid color-mix(in srgb, ${iconColor} 25%, transparent)`,
          color: iconColor,
          boxShadow: `0 6px 14px -8px color-mix(in srgb, ${iconColor} 50%, transparent)`,
        }}>
          {icon}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h2 className="heading-2" style={{ marginBottom: 0 }}>{title}</h2>
        <p className="text-muted-sm" style={{ fontSize: 12 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, UserPlus, Mail, Clock, X, Crown, Shield, Eye, MoreHorizontal, ArrowRightLeft, Trash2, Copy, Check, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";

/* ─────────── Tipos ─────────── */
type Miembro = {
  id: string;
  user_id: string;
  email: string;
  rol: "owner" | "admin" | "viewer";
  invitado_en: string;
  aceptado_en: string;
  es_yo: boolean;
};

type Invitacion = {
  id: string;
  email: string;
  rol: "admin" | "viewer";
  expira_en: string;
  created_at: string;
};

type Props = {
  empresaNombre: string;
  miembrosIniciales: Miembro[];
  invitacionesIniciales: Invitacion[];
  currentUserId: string;
};

/* ─────────── Helpers UI ─────────── */
const ROL_META: Record<Miembro["rol"], { label: string; color: string; icon: LucideIcon; desc: string }> = {
  owner:  { label: "Owner",  color: "#f59e0b", icon: Crown,  desc: "Acceso total. Gestiona facturación y miembros." },
  admin:  { label: "Admin",  color: "#2563eb", icon: Shield, desc: "Gestiona estaciones, empleados, sucursales." },
  viewer: { label: "Viewer", color: "#64748b", icon: Eye,    desc: "Solo lectura: reportes y dashboards." },
};

function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  return (parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : local.slice(0, 2)).toUpperCase();
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1)   return "hace un momento";
  if (min < 60)  return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)    return `hace ${d} día${d === 1 ? "" : "s"}`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string): { text: string; tone: "ok" | "soon" | "expired" } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: "expirada", tone: "expired" };
  const d = Math.ceil(ms / (24 * 3600 * 1000));
  if (d <= 1)  return { text: "menos de 1 día", tone: "soon" };
  if (d <= 2)  return { text: `${d} días`,      tone: "soon" };
  return         { text: `${d} días`,           tone: "ok" };
}

/* ─────────── Componente principal ─────────── */
export function EquipoClient({ empresaNombre, miembrosIniciales, invitacionesIniciales, currentUserId }: Props) {
  const [miembros, setMiembros] = useState<Miembro[]>(miembrosIniciales);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>(invitacionesIniciales);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean } | null>(null);

  const yo = useMemo(() => miembros.find(m => m.user_id === currentUserId) ?? null, [miembros, currentUserId]);
  const soyOwnerOrAdmin = yo?.rol === "owner" || yo?.rol === "admin";
  const soyOwner = yo?.rol === "owner";

  async function refresh() {
    const r = await fetch("/api/empresa/miembros");
    if (!r.ok) return;
    const data = await r.json();
    setMiembros(data.miembros ?? []);
    setInvitaciones(data.invitaciones_pendientes ?? []);
  }

  async function cambiarRol(m: Miembro, rol: "admin" | "viewer") {
    const res = await fetch(`/api/empresa/miembros/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { toast.error(data.error ?? "Error"); return; }
    toast.success(`${m.email} ahora es ${rol}`);
    refresh();
  }

  async function transferirOwnership(m: Miembro) {
    if (!confirm(`¿Transferir ownership a ${m.email}? Tú quedarás como admin.`)) return;
    const res = await fetch(`/api/empresa/miembros/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferir_ownership: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { toast.error(data.error ?? "Error"); return; }
    toast.success(`Ownership transferido a ${m.email}`);
    refresh();
  }

  async function quitarMiembro(m: Miembro) {
    if (!confirm(`¿Quitar a ${m.email} de ${empresaNombre}?`)) return;
    const res = await fetch(`/api/empresa/miembros/${m.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) { toast.error(data.error ?? "Error"); return; }
    toast.success(`${m.email} removido`);
    refresh();
  }

  async function cancelarInvitacion(inv: Invitacion) {
    if (!confirm(`¿Cancelar invitación a ${inv.email}?`)) return;
    const res = await fetch(`/api/empresa/invitaciones/${inv.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) { toast.error(data.error ?? "Error"); return; }
    toast.success("Invitación cancelada");
    setInvitaciones(prev => prev.filter(x => x.id !== inv.id));
  }

  return (
    <div className="page animate-fade-up">
      <Breadcrumbs crumbs={[
        { label: "Configuración", href: "/configuracion" },
        { label: "Equipo" },
      ]} />
      <PageHeader
        title="Miembros del equipo"
        subtitle={`Gestiona quién tiene acceso a ${empresaNombre}`}
        icon={<Users size={20} />}
        iconColor="#3b82f6"
        stats={[
          { label: "Miembros",     value: miembros.length },
          { label: "Pendientes",   value: invitaciones.length },
        ]}
        actions={
          soyOwnerOrAdmin ? (
            <button onClick={() => setShowInvite(true)} className="btn btn-primary btn-sm">
              <UserPlus size={13} />
              <span>Invitar miembro</span>
            </button>
          ) : null
        }
      />

      {/* Miembros activos */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="text-muted-sm" style={{ marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11, fontWeight: 700 }}>
          Miembros activos · {miembros.length}
        </h2>
        {miembros.length === 0 ? (
          <EmptyState icon={Users} tone="violet"
            title="Sin miembros aún"
            description="Algo raro: deberías ser miembro al menos tú." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {miembros.map(m => (
              <MiembroRow
                key={m.id}
                m={m}
                soyOwner={soyOwner}
                onCambiarRol={cambiarRol}
                onTransferir={transferirOwnership}
                onQuitar={quitarMiembro}
              />
            ))}
          </div>
        )}
      </section>

      {/* Invitaciones pendientes */}
      {invitaciones.length > 0 && (
        <section>
          <h2 className="text-muted-sm" style={{ marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11, fontWeight: 700 }}>
            Invitaciones pendientes · {invitaciones.length}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitaciones.map(inv => (
              <InvitacionRow
                key={inv.id}
                inv={inv}
                soyOwnerOrAdmin={soyOwnerOrAdmin}
                onCancelar={cancelarInvitacion}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <InviteModal
          empresaNombre={empresaNombre}
          onClose={() => { setShowInvite(false); setInviteResult(null); }}
          onDone={(result) => { setInviteResult(result); refresh(); }}
        />
      )}

      {/* Modal post-invite (mostrar URL si no se envió email) */}
      {inviteResult && !inviteResult.emailSent && (
        <PostInviteModal
          url={inviteResult.url}
          onClose={() => setInviteResult(null)}
        />
      )}
    </div>
  );
}

/* ─────────── MiembroRow ─────────── */
function MiembroRow({
  m, soyOwner, onCambiarRol, onTransferir, onQuitar,
}: {
  m: Miembro;
  soyOwner: boolean;
  onCambiarRol: (m: Miembro, rol: "admin" | "viewer") => void;
  onTransferir: (m: Miembro) => void;
  onQuitar: (m: Miembro) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rolMeta = ROL_META[m.rol];
  const RolIcon = rolMeta.icon;

  // Puedo actuar sobre este miembro?
  const canEdit = soyOwner && !m.es_yo;
  const canRemove = soyOwner && !m.es_yo; // no me puedo quitar a mi mismo
  const canPromoteToOwner = soyOwner && !m.es_yo && m.rol !== "owner";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 12,
      background: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: `linear-gradient(135deg, ${rolMeta.color}33, ${rolMeta.color}11)`,
        border: `1px solid ${rolMeta.color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: rolMeta.color, flexShrink: 0,
      }}>
        {initials(m.email)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.email}
          </span>
          {m.es_yo && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", padding: "1px 6px", borderRadius: 4, background: "var(--bg-elevated)" }}>
              Tú
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
          <RolIcon size={11} />
          <span style={{ color: rolMeta.color, fontWeight: 600 }}>{rolMeta.label}</span>
          <span>·</span>
          <span>se unió {timeAgo(m.aceptado_en)}</span>
        </div>
      </div>

      {(canEdit || canRemove) && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="btn btn-ghost btn-icon"
            aria-label="Más opciones"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 4, minWidth: 220,
                boxShadow: "0 8px 24px rgba(0,0,0,.3)",
              }}>
                {canEdit && m.rol !== "admin" && (
                  <MenuItem icon={Shield} onClick={() => { setMenuOpen(false); onCambiarRol(m, "admin"); }}>
                    Cambiar a Admin
                  </MenuItem>
                )}
                {canEdit && m.rol !== "viewer" && m.rol !== "owner" && (
                  <MenuItem icon={Eye} onClick={() => { setMenuOpen(false); onCambiarRol(m, "viewer"); }}>
                    Cambiar a Viewer
                  </MenuItem>
                )}
                {canPromoteToOwner && (
                  <MenuItem icon={ArrowRightLeft} onClick={() => { setMenuOpen(false); onTransferir(m); }}>
                    Transferir ownership
                  </MenuItem>
                )}
                {canRemove && m.rol !== "owner" && (
                  <MenuItem icon={Trash2} danger onClick={() => { setMenuOpen(false); onQuitar(m); }}>
                    Quitar del equipo
                  </MenuItem>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: LucideIcon; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      width: "100%", padding: "8px 10px", borderRadius: 6,
      background: "transparent", border: "none", cursor: "pointer",
      color: danger ? "#ef4444" : "var(--text-primary)",
      fontSize: 12, textAlign: "left",
    }}
    onMouseOver={e => { e.currentTarget.style.background = "var(--bg-card)"; }}
    onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
      <Icon size={13} />
      <span>{children}</span>
    </button>
  );
}

/* ─────────── InvitacionRow ─────────── */
function InvitacionRow({
  inv, soyOwnerOrAdmin, onCancelar,
}: {
  inv: Invitacion;
  soyOwnerOrAdmin: boolean;
  onCancelar: (inv: Invitacion) => void;
}) {
  const exp = daysUntil(inv.expira_en);
  const rolMeta = ROL_META[inv.rol];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 12,
      background: "var(--bg-card)", border: "1px dashed var(--border)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--bg-elevated)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-faint)", flexShrink: 0,
      }}>
        <Mail size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
          {inv.email}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
          <span style={{ color: rolMeta.color, fontWeight: 600 }}>{rolMeta.label}</span>
          <span>·</span>
          <Clock size={10} />
          <span style={{ color: exp.tone === "expired" ? "#ef4444" : exp.tone === "soon" ? "#f59e0b" : "var(--text-muted)" }}>
            expira en {exp.text}
          </span>
        </div>
      </div>
      {soyOwnerOrAdmin && (
        <button onClick={() => onCancelar(inv)} className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }}>
          <X size={13} />
          <span>Cancelar</span>
        </button>
      )}
    </div>
  );
}

/* ─────────── InviteModal ─────────── */
function InviteModal({
  empresaNombre, onClose, onDone,
}: {
  empresaNombre: string;
  onClose: () => void;
  onDone: (result: { url: string; emailSent: boolean }) => void;
}) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "viewer">("admin");
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailTrim = email.trim().toLowerCase();
  const emailLooksValid = /^[^@]+@[^@]+\.[^@]+$/.test(emailTrim);
  const canSubmit = !sending && emailLooksValid;

  async function submit() {
    if (!emailLooksValid) {
      setTouched(true);
      toast.error("Email inválido");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/empresa/miembros/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim, rol }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Error al invitar");
        return;
      }
      if (data.email_sent) {
        toast.success(`Invitación enviada a ${emailTrim}`);
      } else if (data.service_misconfigured) {
        // Servidor mal configurado (falta SUPABASE_SERVICE_ROLE_KEY)
        toast.error("El envío de email no está configurado en el servidor. Comparte el link manualmente.", { duration: 6000 });
      } else if (data.email_error) {
        toast.warning(`Email no enviado: ${data.email_error}. Comparte el link manualmente.`, { duration: 6000 });
      } else {
        toast.message("Invitación creada — esta persona ya tiene cuenta, comparte el link manualmente");
      }
      onDone({ url: data.invitation_url, emailSent: !!data.email_sent });
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      {/* Stripe superior degradado */}
      <div style={{
        height: 3,
        background: "linear-gradient(90deg, transparent, #2563eb 25%, #60a5fa 50%, #2563eb 75%, transparent)",
      }} />

      {/* Header compacto con icono */}
      <div style={{ padding: "18px 22px 0", position: "relative" }}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 12, right: 12,
            width: 26, height: 26, borderRadius: 7,
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-faint)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
        >
          <X size={14} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(59,130,246,.22), rgba(59,130,246,.06))",
            border: "1px solid rgba(59,130,246,.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3b82f6", flexShrink: 0,
          }}>
            <UserPlus size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-.01em", lineHeight: 1.2 }}>
              Invitar miembro
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
              Únete a <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{empresaNombre}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Body compacto */}
      <div style={{ padding: "16px 22px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Email */}
        <div>
          <label style={{
            display: "block", fontSize: 10, fontWeight: 700,
            color: "var(--text-muted)", marginBottom: 5,
            textTransform: "uppercase", letterSpacing: ".08em",
          }}>
            Correo electrónico
          </label>
          <div style={{ position: "relative" }}>
            <Mail
              size={13}
              style={{
                position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                color: emailLooksValid ? "#3b82f6" : "var(--text-faint)",
                pointerEvents: "none",
                transition: "color .15s",
              }}
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="colega@empresa.com"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="input"
              style={{
                width: "100%",
                paddingLeft: 32,
                borderColor: touched && email && !emailLooksValid ? "rgba(239,68,68,.4)" : undefined,
              }}
              onKeyDown={e => { if (e.key === "Enter" && canSubmit) submit(); }}
            />
          </div>
          {touched && email && !emailLooksValid && (
            <p style={{ fontSize: 10, color: "#fca5a5", margin: "4px 0 0" }}>
              Verifica el formato del email.
            </p>
          )}
        </div>

        {/* Rol */}
        <div>
          <label style={{
            display: "block", fontSize: 10, fontWeight: 700,
            color: "var(--text-muted)", marginBottom: 5,
            textTransform: "uppercase", letterSpacing: ".08em",
          }}>
            Nivel de acceso
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["admin", "viewer"] as const).map(r => {
              const meta = ROL_META[r];
              const RolIcon = meta.icon;
              const selected = rol === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRol(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: selected
                      ? `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)`
                      : "var(--bg-elevated)",
                    border: `1px solid ${selected ? meta.color + "88" : "var(--border)"}`,
                    boxShadow: selected ? `0 0 0 3px ${meta.color}22` : "none",
                    textAlign: "left",
                    transition: "all .15s",
                  }}
                  onMouseOver={e => { if (!selected) e.currentTarget.style.borderColor = "var(--text-faint)"; }}
                  onMouseOut={e => { if (!selected) e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${meta.color}1f`,
                    border: `1px solid ${meta.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: meta.color, flexShrink: 0,
                  }}>
                    <RolIcon size={13} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: 700,
                      color: selected ? meta.color : "var(--text-primary)",
                      lineHeight: 1.2,
                    }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2 }}>
                      {meta.desc}
                    </div>
                  </div>

                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: `1.5px solid ${selected ? meta.color : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, background: selected ? meta.color : "transparent",
                    transition: "all .15s",
                  }}>
                    {selected && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Helper inline (sin info bar separada) */}
          <p style={{ fontSize: 10.5, color: "var(--text-faint)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
            <Mail size={11} />
            Recibirá un email con un link único · expira en 7 días
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 22px 16px",
        display: "flex", justifyContent: "flex-end", gap: 8,
      }}>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          style={{
            padding: "8px 14px", borderRadius: 8,
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-muted)", fontSize: 12.5, fontWeight: 600,
            cursor: sending ? "not-allowed" : "pointer",
            transition: "all .15s",
          }}
          onMouseOver={e => { if (!sending) { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--text-faint)"; } }}
          onMouseOut={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: canSubmit
              ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
              : "rgba(37,99,235,.25)",
            border: "none",
            color: "#fff", fontSize: 12.5, fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? "0 4px 14px rgba(37,99,235,.35)" : "none",
            transition: "all .15s",
            opacity: sending ? 0.7 : 1,
          }}
        >
          {sending ? (
            <>
              <span style={{
                width: 11, height: 11, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,.35)",
                borderTopColor: "#fff",
                animation: "spin .7s linear infinite",
              }} />
              <span>Enviando…</span>
            </>
          ) : (
            <>
              <UserPlus size={12} />
              <span>Enviar invitación</span>
            </>
          )}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </ModalOverlay>
  );
}

/* ─────────── PostInviteModal (mostrar URL cuando no se envió email) ─────────── */
function PostInviteModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Comparte este link</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
          La persona ya tiene cuenta en SafeLink — no enviamos correo automático.
          Comparte este link por WhatsApp / Slack / Email y al abrirlo aceptará la invitación.
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: 10, borderRadius: 8,
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          fontFamily: "monospace", fontSize: 11, color: "var(--text-primary)",
          wordBreak: "break-all",
        }}>
          {url}
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Listo</button>
          <button onClick={copy} className="btn btn-primary btn-sm">
            {copied ? <><Check size={13} /><span>Copiado</span></> : <><Copy size={13} /><span>Copiar link</span></>}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─────────── ModalOverlay (renderizado en Portal al <body>) ─────────── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  // Cerrar con ESC + montar Portal solo en cliente (SSR-safe)
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // Bloquear scroll del body mientras el modal esta abierto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const overlay = (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: "rgba(2,6,23,.65)",
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "overlayIn .2s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-card, #101828)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 440,
          maxHeight: "calc(100dvh - 48px)",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)",
          animation: "modalIn .22s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalIn   { from { opacity: 0; transform: scale(.96) translateY(-4px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );

  // Portal al body: escapamos cualquier transform/filter/perspective
  // del arbol padre que podria romper position:fixed (ej. sidebar layout
  // del dashboard con transforms para animaciones).
  return createPortal(overlay, document.body);
}

"use client";
import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton } from "@/components/ui/ExportButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatCard } from "@/components/ui/StatCard";

type Sucursal = { id: string; nombre: string };
type Empleado = {
  id: string;
  nombre: string;
  apellido: string;
  puesto: string | null;
  employee_code: string | null;
  enrollado: boolean | null;
  activo: boolean | null;
  sucursal_id: string | null;
  foto_url: string | null;
  sucursales: { nombre: string } | null;
  created_at?: string;
};

const PAGE_SIZE = 15;

/* ── Avatar con foto del empleado (fallback a iniciales) ── */
function EmpleadoAvatar({ emp, size = 36 }: { emp: Empleado; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const showFoto = emp.foto_url && !imgError;

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, hsl(${(emp.nombre.charCodeAt(0) * 13) % 360}, 60%, 55%) 0%, hsl(${(emp.apellido.charCodeAt(0) * 17) % 360}, 60%, 45%) 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "#fff",
      boxShadow: "0 4px 10px -4px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {showFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={emp.foto_url!}
          alt={`${emp.nombre} ${emp.apellido}`}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <>{emp.nombre[0]?.toUpperCase()}{emp.apellido[0]?.toUpperCase()}</>
      )}
    </div>
  );
}

/* ── helpers ── */
const MODAL_INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--text-primary)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 200ms ease, box-shadow 200ms ease",
};
function ModalField({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {icon && <span style={{ color: "var(--text-faint)", display: "flex" }}>{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--text-faint)", marginTop: -2 }}>{hint}</span>}
    </div>
  );
}

/* ── Modal crear / editar ── */
function EmpModal({
  emp, sucursales, onClose, onSaved,
}: {
  emp: Empleado | null;
  sucursales: Sucursal[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!emp;
  const { notify } = useNotifications();
  const [nombre,     setNombre]     = useState(emp?.nombre     ?? "");
  const [apellido,   setApellido]   = useState(emp?.apellido   ?? "");
  const [puesto,     setPuesto]     = useState(emp?.puesto     ?? "");
  const [empCode,    setEmpCode]    = useState(emp?.employee_code ?? "");
  const [sucursalId, setSucursalId] = useState(emp?.sucursal_id ?? "");
  const [activo,     setActivo]     = useState(emp?.activo     ?? true);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [photo,      setPhoto]      = useState<string | null>(null);
  const [dragging,   setDragging]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayFoto = photo ?? emp?.foto_url ?? null;

  async function save() {
    if (!nombre.trim() || !apellido.trim()) { setError("Nombre y apellido son requeridos."); return; }
    setError(""); setLoading(true);
    const body = {
      id: emp?.id,
      nombre: nombre.trim(), apellido: apellido.trim(),
      puesto: puesto.trim() || null,
      employee_code: empCode.trim() || null,
      sucursal_id: sucursalId || null,
      activo,
      foto: photo,
    };
    const url  = editing ? "/api/empleados/update" : "/api/empleados/create";
    try {
      const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        const msg = data.error || "Error al guardar";
        setError(msg);
        notify({ kind: "error", title: editing ? "No se pudo actualizar" : "No se pudo crear", message: msg });
        return;
      }
      notify({
        kind: "success",
        title: editing ? "Empleado actualizado" : "Empleado creado",
        message: `${nombre.trim()} ${apellido.trim()}`,
        duration: 3500,
      });
      onSaved(); onClose();
    } catch (e) {
      setLoading(false);
      const msg = (e as Error).message ?? "Error de red";
      setError(msg);
      notify({ kind: "error", title: "Error de red", message: msg });
    }
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--accent)";
    e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)";
  };
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--border)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <div className="animate-modal-up" style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        width: "100%",
        maxWidth: 780,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
      }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 520 }}>

          {/* ─── Columna Izquierda: Foto ─── */}
          <div style={{
            padding: "32px 24px",
            background: "var(--bg-elevated)",
            borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          }}>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, fontFamily: "var(--font-heading)" }}>Foto de Perfil</h3>
              <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Usada para reconocimiento facial</p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 180, height: 180, borderRadius: "50%",
                border: `2px dashed ${dragging ? "var(--accent)" : displayFoto ? "transparent" : "var(--border-strong)"}`,
                background: dragging ? "var(--accent-soft)" : "var(--bg-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden",
                transition: "all 250ms ease",
                boxShadow: displayFoto ? "0 8px 24px -8px rgba(0,0,0,0.4)" : "none",
              }}
            >
              {displayFoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayFoto} alt="Foto del empleado" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
                    display: "flex", alignItems: "flex-end", justifyContent: "center",
                    padding: "12px 0", opacity: 0, transition: "opacity 200ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Cambiar
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "var(--accent-soft)", border: "1px solid rgba(37,99,235,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 12px",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Subir foto</p>
                  <p style={{ fontSize: 10, color: "var(--text-faint)" }}>Arrastra o haz clic</p>
                </div>
              )}
              {dragging && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                  <span style={{ color: "var(--accent-hover)", fontSize: 12, fontWeight: 600 }}>Soltar aqui</span>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {displayFoto && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPhoto(null); }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: "var(--text-muted)", gap: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Quitar foto
              </button>
            )}

            <div style={{
              width: "100%", padding: "14px 16px", borderRadius: "var(--radius-md)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
                  background: displayFoto ? "transparent" : `linear-gradient(135deg, hsl(${(nombre.charCodeAt(0) || 0) * 13 % 360}, 60%, 50%), hsl(${(apellido.charCodeAt(0) || 0) * 17 % 360}, 60%, 40%))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden",
                  border: displayFoto ? "2px solid var(--accent)" : "none",
                }}>
                  {displayFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <>{(nombre[0] || "?").toUpperCase()}{(apellido[0] || "").toUpperCase()}</>
                  )}
                </div>
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {nombre || "Nombre"} {apellido || "Apellido"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{puesto || "Sin cargo"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Columna Derecha: Formulario ─── */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (!loading) save(); }}
            style={{ padding: "32px 28px", display: "flex", flexDirection: "column" }}
          >
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "var(--radius-md)",
                  background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                  {editing ? "Actualizar Empleado" : "Nuevo Empleado"}
                </h2>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginLeft: 42 }}>
                {editing ? "Modifica los datos del perfil" : "Completa la informacion del personal"}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ModalField label="Nombre" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={MODAL_INPUT} placeholder="Ej: Roberto" onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </ModalField>
                <ModalField label="Apellido" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
                  <input value={apellido} onChange={(e) => setApellido(e.target.value)} style={MODAL_INPUT} placeholder="Ej: Sanchez" onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </ModalField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ModalField label="Puesto" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}>
                  <input value={puesto} onChange={(e) => setPuesto(e.target.value)} style={MODAL_INPUT} placeholder="Ej: Analista" onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </ModalField>
                <ModalField label="ID Interno" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>} hint="Codigo de nomina o identificador">
                  <input value={empCode} onChange={(e) => setEmpCode(e.target.value)} style={{ ...MODAL_INPUT, fontFamily: "var(--font-data)" }} placeholder="SL-2026-04" onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </ModalField>
              </div>

              <ModalField label="Sucursal" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}>
                <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...MODAL_INPUT, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }} onFocus={handleInputFocus} onBlur={handleInputBlur}>
                  <option value="">Seleccionar sucursal...</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id} style={{ background: "var(--bg-card)" }}>{s.nombre}</option>)}
                </select>
              </ModalField>

              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "var(--radius-sm)",
                    background: activo ? "var(--green-soft)" : "rgba(255,255,255,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 250ms",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activo ? "#4ade80" : "var(--text-faint)"} strokeWidth="2">
                      {activo
                        ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                        : <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>}
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Estado del Empleado</p>
                    <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{activo ? "Puede registrar asistencia" : "No puede registrar asistencia"}</p>
                  </div>
                </div>
                <label style={{ position: "relative", width: 44, height: 24, cursor: "pointer", flexShrink: 0 }}>
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: activo ? "var(--green)" : "rgba(255,255,255,0.1)",
                    borderRadius: 12, transition: "background 250ms",
                  }} />
                  <div style={{
                    position: "absolute", top: 3, left: activo ? 23 : 3,
                    width: 18, height: 18, background: "#fff", borderRadius: "50%",
                    transition: "left 250ms", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </label>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--red-soft)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-md)", color: "#f87171", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, gap: 8 }}>
                {loading ? (
                  <>
                    <svg className="animate-spin-slow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    {editing ? "Actualizar" : "Crear Empleado"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Modal confirmar eliminar ── */
function DeleteModal({ emp, onClose, onOptimisticDelete, onError }: {
  emp: Empleado;
  onClose: () => void;
  onOptimisticDelete: (id: string) => void;
  onError: (emp: Empleado) => void;
}) {
  const { notify } = useNotifications();
  async function confirm() {
    // Optimistic: removemos del estado local YA y cerramos modal.
    onOptimisticDelete(emp.id);
    onClose();
    notify({
      kind: "success",
      title: "Empleado eliminado",
      message: `${emp.nombre} ${emp.apellido}`,
      duration: 3500,
    });
    // Fetch en background; si falla, restauramos y avisamos.
    try {
      const res = await fetch("/api/empleados/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(emp);
        notify({ kind: "error", title: "No se pudo eliminar", message: data.error ?? "El servidor rechazo la operacion. Restaurando." });
      }
    } catch {
      onError(emp);
      notify({ kind: "error", title: "Error de red", message: "No se pudo eliminar. Restaurando." });
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, position: "relative", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#ef4444 50%,transparent)" }} />
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Eliminar empleado</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            ¿Estás seguro de eliminar a <strong style={{ color: "var(--text-primary)" }}>{emp.nombre} {emp.apellido}</strong>?<br/>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Esta acción no se puede deshacer.</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={confirm} className="btn btn-danger" style={{ flex: 1 }}>
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function EmpleadosClient({ empleados: initial, sucursales, empresaId }: { empleados: Empleado[]; sucursales: Sucursal[]; empresaId: string }) {
  const router = useRouter();
  const [empleados, setEmpleados] = useState(initial);
  const [modal,  setModal]  = useState<"create" | "edit" | "delete" | "import-info" | null>(null);
  const [target, setTarget] = useState<Empleado | null>(null);
  const [search, setSearch] = useState("");
  const [filterSucursal, setFilterSucursal] = useState("all");
  const [filterEstado, setFilterEstado] = useState<"all" | "activo" | "inactivo">("all");
  const [filterEnrolado, setFilterEnrolado] = useState<"all" | "si" | "no">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [, startT] = useTransition();
  const fileExcelRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotifications();

  // Sync state when server data changes (automatic refresh)
  useEffect(() => { setEmpleados(initial); }, [initial]);

  const refresh = () => startT(() => { router.refresh(); });

  // Realtime: aplica cambios CRUD al instante sin recargar la pagina.
  // - INSERT: si otro admin/dispositivo crea un empleado, aparece en la lista.
  // - UPDATE: cambios de cualquier campo (incluido enrollado por estaciones).
  // - DELETE: removido en otra sesion -> desaparece de la lista.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`empleados-realtime:${empresaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "empleados",
          // Defensa: solo eventos de NUESTRA empresa. Sin esto dependiamos
          // de la RLS del canal Realtime, que puede ser laxa.
          filter: `empresa_id=eq.${empresaId}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Partial<Empleado> & { id: string };
            setEmpleados((prev) =>
              prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setEmpleados((prev) => prev.filter((e) => e.id !== deleted.id));
          } else if (payload.eventType === "INSERT") {
            const ins = payload.new as { id: string };
            // Hidratar el join sucursales para mostrar el nombre
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (supabase as any)
              .from("empleados")
              .select("id, nombre, apellido, puesto, employee_code, enrollado, activo, sucursal_id, foto_url, sucursales(nombre)")
              .eq("id", ins.id)
              .eq("empresa_id", empresaId)
              .single();
            if (data) {
              setEmpleados((prev) => {
                if (prev.some((e) => e.id === data.id)) return prev;
                return [...prev, data as Empleado].sort((a, b) =>
                  (a.apellido ?? "").localeCompare(b.apellido ?? "")
                );
              });
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId]);

  const filtered = useMemo(() => {
    let result = empleados;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter((e) =>
        `${e.nombre} ${e.apellido} ${e.puesto ?? ""} ${e.employee_code ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (filterSucursal !== "all") {
      result = result.filter((e) => e.sucursal_id === filterSucursal);
    }
    if (filterEstado === "activo") {
      result = result.filter((e) => e.activo);
    } else if (filterEstado === "inactivo") {
      result = result.filter((e) => !e.activo);
    }
    if (filterEnrolado === "si") {
      result = result.filter((e) => e.enrollado);
    } else if (filterEnrolado === "no") {
      result = result.filter((e) => !e.enrollado);
    }
    return result;
  }, [empleados, search, filterSucursal, filterEstado, filterEnrolado]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, filterSucursal, filterEstado, filterEnrolado]);

  async function handleExcelImport(file: File) {
    // Carga diferida: solo se descarga el bundle de XLSX cuando el usuario importa
    const XLSX = await import("xlsx");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      const validRows = json.filter(r => r.Nombre && r.Apellido);
      if (validRows.length === 0) {
        alert("No se encontraron registros válidos. Columnas requeridas: Nombre, Apellido.");
        return;
      }

      if (confirm(`¿Importar ${validRows.length} empleados?`)) {
        startT(async () => {
          const res = await fetch("/api/empleados/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employees: validRows })
          });
          if (res.ok) refresh();
          else alert("Error al importar registros.");
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function openEdit(e: Empleado) { setTarget(e); setModal("edit"); }
  function openDelete(e: Empleado) { setTarget(e); setModal("delete"); }

  // S2.2: forzar reenroll del empleado en todas las stations de la empresa
  async function forzarReenroll(emp: Empleado) {
    const ok = window.confirm(
      `¿Forzar re-enrollment de ${emp.nombre} ${emp.apellido}?\n\n` +
      `Esto borrara los embeddings actuales y obligara a las stations a ` +
      `regenerarlos desde la foto. Util si el empleado cambio de look ` +
      `(barba, lentes, peinado).`
    );
    if (!ok) return;
    try {
      const res = await fetch("/api/empleados/forzar-reenroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleado_id: emp.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      const n = data.stations_notificadas ?? 0;
      notify({
        kind: "success",
        title: "Re-enrollment iniciado",
        message: `${n} estación${n === 1 ? "" : "es"} regenerará embeddings de ${emp.nombre}.`,
      });
      // Marcar como no enrollado para feedback inmediato visual
      setEmpleados((prev) => prev.map((e) => e.id === emp.id ? { ...e, enrollado: false } : e));
    } catch (e) {
      notify({ kind: "error", title: "No se pudo forzar re-enrollment", message: (e as Error).message });
    }
  }

  const hasActiveFilters = search || filterSucursal !== "all" || filterEstado !== "all" || filterEnrolado !== "all";
  const activos = empleados.filter(e => e.activo).length;
  const enrolados = empleados.filter(e => e.enrollado).length;
  const pendientes = empleados.filter(e => !e.enrollado).length;

  const SELECT_STYLE: React.CSSProperties = {
    background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
    fontSize: 12, color: "var(--text-primary)", padding: "7px 10px", cursor: "pointer", outline: "none",
    fontFamily: "inherit", transition: "border-color 150ms", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>
      {(modal === "create" || modal === "edit") && (
        <EmpModal emp={modal === "edit" ? target : null} sucursales={sucursales} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal === "delete" && target && (
        <DeleteModal
          emp={target}
          onClose={() => setModal(null)}
          onOptimisticDelete={(id) => setEmpleados((prev) => prev.filter((e) => e.id !== id))}
          onError={(emp) => {
            setEmpleados((prev) => [...prev, emp].sort((a, b) => a.apellido.localeCompare(b.apellido)));
            refresh();
          }}
        />
      )}
      {modal === "import-info" && (
        <ImportInfoModal
          onClose={() => setModal(null)}
          onSelect={() => { setModal(null); fileExcelRef.current?.click(); }}
        />
      )}
      <input type="file" ref={fileExcelRef} hidden accept=".xlsx, .xls, .csv" onChange={(e) => e.target.files?.[0] && handleExcelImport(e.target.files[0])} />

      <Breadcrumbs />
      <PageHeader
        title="Empleados"
        subtitle="Gestión de personal y reconocimiento facial"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
      />

      <div className="animate-fade-up" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24,
        animationDelay: "40ms", animationFillMode: "backwards",
      }}>
        <StatCard
          label="Total Personal"
          value={empleados.length}
          color="blue"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <StatCard
          label="Activos"
          value={activos}
          color="green"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <StatCard
          label="Enrolados"
          value={enrolados}
          color="purple"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        />
        <StatCard
          label="Pendientes"
          value={pendientes}
          color="yellow"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      <div className="card animate-fade-up" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", animationDelay: "80ms", animationFillMode: "backwards" }}>
        <div style={{ position: "relative", flex: "0 0 260px" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, puesto o codigo..."
            style={{
              paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
              fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", width: "100%",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          />
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)", flexShrink: 0 }} />

        <select value={filterSucursal} onChange={(e) => setFilterSucursal(e.target.value)} style={SELECT_STYLE}>
          <option value="all">Todas las sucursales</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)} style={SELECT_STYLE}>
          <option value="all">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <select value={filterEnrolado} onChange={(e) => setFilterEnrolado(e.target.value as typeof filterEnrolado)} style={SELECT_STYLE}>
          <option value="all">Enrolamiento</option>
          <option value="si">Enrolados</option>
          <option value="no">Pendientes</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setFilterSucursal("all"); setFilterEstado("all"); setFilterEnrolado("all"); }}
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--text-muted)", gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Limpiar
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={() => setModal("import-info")} className="btn btn-secondary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Importar
        </button>
        <ExportButton
          label="Exportar"
          filenamePrefix="empleados"
          sheetName="Empleados"
          getRows={() => filtered.map((e) => ({
            Nombre: e.nombre,
            Apellido: e.apellido,
            Codigo: e.employee_code ?? "",
            Puesto: e.puesto ?? "",
            Sucursal: e.sucursales?.nombre ?? "",
            Estado: e.activo ? "Activo" : "Inactivo",
            Enrollado: e.enrollado ? "Si" : "No",
          }))}
        />
        <button onClick={() => setModal("create")} className="btn btn-primary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Empleado
        </button>
      </div>

      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "120ms", animationFillMode: "backwards" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "28%" }}>Empleado</th>
              <th style={{ width: "16%" }}>Puesto</th>
              <th style={{ width: "16%" }}>Sucursal</th>
              <th style={{ width: "14%" }}>Biometria</th>
              <th style={{ width: "10%" }}>Estado</th>
              <th style={{ width: "16%", textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "64px 20px", textAlign: "center", borderBottom: "none" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: hasActiveFilters
                      ? "linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.03) 100%)"
                      : "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(37,99,235,0.03) 100%)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={hasActiveFilters ? "#facc15" : "#60a5fa"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {hasActiveFilters ? (
                        <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>
                      ) : (
                        <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>
                      )}
                    </svg>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontFamily: "var(--font-heading)" }}>
                    {hasActiveFilters ? "Sin resultados" : "Sin empleados registrados"}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-faint)", maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                    {hasActiveFilters
                      ? "No se encontraron empleados que coincidan con los filtros aplicados."
                      : "Agrega tu primer empleado al sistema o importa un archivo Excel para comenzar."}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      onClick={() => { setSearch(""); setFilterSucursal("all"); setFilterEstado("all"); setFilterEnrolado("all"); }}
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 20 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Limpiar filtros
                    </button>
                  ) : (
                    <button onClick={() => setModal("create")} className="btn btn-primary btn-sm" style={{ marginTop: 20 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Crear empleado
                    </button>
                  )}
                </td>
              </tr>
            ) : paginated.map((emp) => (
              <tr key={emp.id} className="emp-row">
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <EmpleadoAvatar emp={emp} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13, lineHeight: 1.3 }}>{emp.nombre} {emp.apellido}</p>
                      {emp.employee_code
                        ? <p style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>{emp.employee_code}</p>
                        : <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Sin codigo</p>}
                    </div>
                  </div>
                </td>
                <td>
                  {emp.puesto
                    ? <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{emp.puesto}</span>
                    : <span style={{ color: "var(--text-faint)", fontSize: 12, fontStyle: "italic" }}>Sin asignar</span>}
                </td>
                <td>
                  {(emp.sucursales as { nombre: string } | null)?.nombre
                    ? (
                      <span className="badge badge-neutral">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {(emp.sucursales as { nombre: string }).nombre}
                      </span>
                    )
                    : <span style={{ color: "var(--text-faint)", fontSize: 12, fontStyle: "italic" }}>Sin sucursal</span>}
                </td>
                <td>
                  {emp.enrollado ? (
                    <span className="badge badge-success" title="Entrenamiento facial completo">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Entrenado
                    </span>
                  ) : (
                    <span className="badge badge-warn" title="Esperando procesamiento de embeddings faciales">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#facc15", boxShadow: "0 0 6px rgba(234,179,8,0.5)" }} className="animate-pulse-dot" />
                      Pendiente
                    </span>
                  )}
                </td>
                <td>
                  {emp.activo
                    ? <span className="badge badge-success">Activo</span>
                    : <span className="badge badge-neutral">Inactivo</span>}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button onClick={() => openEdit(emp)} title="Editar" aria-label={`Editar ${emp.nombre} ${emp.apellido}`} className="btn btn-icon btn-sm btn-icon-edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => forzarReenroll(emp)}
                      title="Forzar re-enrollment en todas las estaciones"
                      aria-label={`Forzar re-enrollment de ${emp.nombre}`}
                      className="btn btn-icon btn-sm"
                      style={{ color: "#a78bfa" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3.21-6.91L21 8M21 3v5h-5"/></svg>
                    </button>
                    <button onClick={() => openDelete(emp)} title="Eliminar" aria-label={`Eliminar ${emp.nombre} ${emp.apellido}`} className="btn btn-icon btn-sm btn-icon-danger">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderTop: "1px solid var(--border)",
          }}>
            <p style={{ fontSize: 12, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span>
              <span style={{ margin: "0 6px" }}>de</span>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{filtered.length}</span>
              <span style={{ marginLeft: 6 }}>empleados</span>
            </p>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-icon btn-sm btn-secondary"
                style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`btn btn-icon btn-sm ${currentPage === pageNum ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 12, fontWeight: currentPage === pageNum ? 700 : 500 }}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-icon btn-sm btn-secondary"
                style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal Info Importación ── */
function ImportInfoModal({ onClose, onSelect }: { onClose: () => void; onSelect: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.8)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: "linear-gradient(145deg, #1e293b, #0f172a)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 30px 60px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #22c55e, #4ade80, #22c55e)" }} />
        
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 0 20px rgba(34,197,94,0.1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>Formato de Importación</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>Prepara tu archivo Excel con la siguiente estructura de columnas para un registro exitoso.</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.05)", padding: 24, marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { c: "Nombre", d: "Obligatorio", color: "#ef4444" },
              { c: "Apellido", d: "Obligatorio", color: "#ef4444" },
              { c: "Puesto", d: "Opcional", color: "#3b82f6" },
              { c: "Codigo", d: "ID Nómina", color: "#3b82f6" }
            ].map(col => (
              <div key={col.c} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ marginTop: 6, width: 8, height: 8, borderRadius: "50%", background: col.color, boxShadow: `0 0 10px ${col.color}44` }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{col.c}</p>
                  <p style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>{col.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <button onClick={onClose} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={onSelect} className="btn btn-success btn-lg" style={{ flex: 2 }}>
            Seleccionar Archivo
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton } from "@/components/ui/ExportButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
// XLSX se carga bajo demanda dentro de handleExcelImport — pesa ~300KB

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
};

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
const INPUT = {
  width: "100%", padding: "12px 14px",
  background: "rgba(15, 23, 42, 0.6)", border: "1px solid var(--border)",
  borderRadius: 10, fontSize: 13, color: "var(--text-primary)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const,
  transition: "all 200ms ease",
};
const LABEL = {
  fontSize: 11, fontWeight: 600 as const, color: "var(--text-faint)" as const,
  textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block" as const, marginBottom: 6,
};
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <label style={LABEL}>{label}</label>
      </div>
      {children}
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

  // photo (base64) = foto NUEVA seleccionada por el usuario, se envía al API.
  // displayFoto = lo que se muestra: foto nueva si la hay, si no la existente.
  // No mandamos foto_url existente al guardar para no re-subirla corrupta.
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ 
        background: "linear-gradient(145deg, #1e293b, #0f172a)", 
        border: "1px solid rgba(255,255,255,0.08)", 
        borderRadius: 24, 
        width: "100%", 
        maxWidth: 860, 
        position: "relative", 
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header Decorativo */}
        <div style={{ height: 4, background: "linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)" }} />

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 500 }}>
          
          {/* Columna Izquierda: Foto y Preview */}
          <div style={{ padding: 40, background: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Identidad Facial</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Sube una foto clara del rostro</p>
            </div>

            {/* Dropzone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 200, height: 200, borderRadius: "50%",
                border: `2px dashed ${dragging ? "var(--accent)" : "rgba(255,255,255,0.15)"}`,
                background: dragging ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden",
                transition: "all 300ms ease"
              }}
            >
              {displayFoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayFoto} alt="Foto del empleado" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    padding: "8px 0", background: "rgba(0,0,0,0.55)",
                    color: "#fff", fontSize: 10, fontWeight: 600, textAlign: "center",
                    letterSpacing: "0.04em",
                  }}>
                    {photo ? "Nueva foto" : "Cambiar foto"}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" style={{ marginBottom: 10 }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Arrastra o click para subir</p>
                </div>
              )}
              {dragging && <div style={{ position: "absolute", inset: 0, background: "rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 600 }}>Soltar aquí</div>}
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {/* Live Card Preview */}
            <div style={{ 
              width: "100%", padding: 20, borderRadius: 16, 
              background: "rgba(255,255,255,0.03)", 
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex", gap: 12, alignItems: "center"
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", overflow: "hidden" }}>
                {displayFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (nombre[0] || "?")}
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {nombre || "Nombre"} {apellido || "Apellido"}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{puesto || "Cargo no definido"}</p>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (!loading) save(); }}
            style={{ padding: 40, display: "flex", flexDirection: "column" }}
          >
            <div style={{ marginBottom: 30 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                {editing ? "Actualizar Perfil" : "Alta de Empleado"}
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Completa la información profesional del personal.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Nombre" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={INPUT} placeholder="Ej: Roberto" />
                </Field>
                <Field label="Apellido">
                  <input value={apellido} onChange={(e) => setApellido(e.target.value)} style={INPUT} placeholder="Ej: Sánchez" />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Puesto / Cargo" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}>
                  <input value={puesto} onChange={(e) => setPuesto(e.target.value)} style={INPUT} placeholder="Ej: Analista de Seguridad" />
                </Field>
                <Field label="ID Interno" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>}>
                  <input value={empCode} onChange={(e) => setEmpCode(e.target.value)} style={INPUT} placeholder="Ej: SL-2026-04" />
                </Field>
              </div>

              <Field label="Sucursal de Asignación" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}>
                <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...INPUT, cursor: "pointer", appearance: "none" }}>
                  <option value="">Seleccionar sucursal...</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id} style={{ background: "#0f172a" }}>{s.nombre}</option>)}
                </select>
              </Field>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Estado del Empleado</p>
                  <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Permitir registros de asistencia</p>
                </div>
                <label style={{ position: "relative", width: 44, height: 24, cursor: "pointer" }}>
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <div style={{ position: "absolute", inset: 0, background: activo ? "var(--accent)" : "rgba(255,255,255,0.1)", borderRadius: 20, transition: "300ms" }} />
                  <div style={{ position: "absolute", top: 3, left: activo ? 23 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "300ms", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                </label>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 20, padding: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#f87171", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 2 }}>
                {loading && (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                )}
                {loading ? "Sincronizando..." : editing ? "Actualizar Perfil" : "Finalizar Registro"}
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

  const filtered = empleados.filter((e) => {
    const q = search.toLowerCase();
    return !q || `${e.nombre} ${e.apellido} ${e.puesto ?? ""} ${e.employee_code ?? ""}`.toLowerCase().includes(q);
  });

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

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* modals */}
      {(modal === "create" || modal === "edit") && (
        <EmpModal emp={modal === "edit" ? target : null} sucursales={sucursales} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal === "delete" && target && (
        <DeleteModal
          emp={target}
          onClose={() => setModal(null)}
          onOptimisticDelete={(id) => setEmpleados((prev) => prev.filter((e) => e.id !== id))}
          onError={(emp) => {
            // Restaurar si el server fallo y refrescar para sincronizar
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

      <Breadcrumbs />
      <PageHeader
        title="Empleados"
        subtitle="Personal registrado en el sistema"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        stats={[
          { label: "Total", value: empleados.length },
          { label: "Activos", value: empleados.filter(e => e.activo).length },
        ]}
        actions={
          <>
            <input type="file" ref={fileExcelRef} hidden accept=".xlsx, .xls, .csv" onChange={(e) => e.target.files?.[0] && handleExcelImport(e.target.files[0])} />
            <button onClick={() => setModal("import-info")} className="btn btn-secondary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Importar Excel
            </button>
            <ExportButton
              label="Exportar"
              filenamePrefix="empleados"
              sheetName="Empleados"
              getRows={() => empleados.map((e) => ({
                Nombre: e.nombre,
                Apellido: e.apellido,
                Codigo: e.employee_code ?? "",
                Puesto: e.puesto ?? "",
                Sucursal: e.sucursales?.nombre ?? "",
                Estado: e.activo ? "Activo" : "Inactivo",
                Enrollado: e.enrollado ? "Si" : "No",
              }))}
            />
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar personal..." style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", width: 220, transition: "border-color 150ms" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
            </div>
            <button onClick={() => setModal("create")} className="btn btn-primary btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nuevo Empleado
            </button>
          </>
        }
      />

      {/* table */}
      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "60ms", animationFillMode: "backwards" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{
              borderBottom: "1px solid var(--border)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
            }}>
              {["Empleado", "Puesto", "Sucursal", "Enrollado", "Estado", ""].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.02) 100%)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px", color: "var(--text-faint)",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {search ? "Sin resultados" : "Sin empleados aún"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {search ? "Prueba con otro término de búsqueda." : "Crea el primer empleado o importa desde Excel."}
                  </p>
                </td>
              </tr>
            ) : filtered.map((emp, i) => (
              <tr key={emp.id} className="emp-row" style={{
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
                transition: "background 120ms, box-shadow 120ms",
                position: "relative",
              }}>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <EmpleadoAvatar emp={emp} />
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{emp.nombre} {emp.apellido}</p>
                      {emp.employee_code && <p style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>#{emp.employee_code}</p>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{emp.puesto ?? "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{(emp.sucursales as { nombre: string } | null)?.nombre ?? "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  {emp.enrollado ? (
                    <span
                      title="Entrenamiento facial completo (10 embeddings con augmentation)"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "rgba(34,197,94,.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,.2)", padding: "2px 9px", borderRadius: 20 }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Entrenado
                    </span>
                  ) : (
                    <span
                      title="Esperando que una estación procese la foto y genere los embeddings faciales"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "rgba(234,179,8,.08)", color: "#facc15", border: "1px solid rgba(234,179,8,.2)", padding: "2px 9px", borderRadius: 20 }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#facc15", boxShadow: "0 0 6px rgba(234,179,8,0.6)" }} className="animate-pulse" />
                      Entrenando…
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {emp.activo
                    ? <span style={{ fontSize: 11, background: "rgba(34,197,94,.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,.2)", padding: "2px 9px", borderRadius: 20 }}>Activo</span>
                    : <span style={{ fontSize: 11, background: "rgba(100,116,139,.1)", color: "var(--text-faint)", border: "1px solid rgba(100,116,139,.2)", padding: "2px 9px", borderRadius: 20 }}>Inactivo</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(emp)} title="Editar" aria-label={`Editar ${emp.nombre} ${emp.apellido}`} className="btn btn-icon btn-sm btn-icon-edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => forzarReenroll(emp)}
                      title="Forzar re-enrollment en todas las estaciones"
                      aria-label={`Forzar re-enrollment de ${emp.nombre}`}
                      className="btn btn-icon btn-sm"
                      style={{ color: "#8b5cf6" }}
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

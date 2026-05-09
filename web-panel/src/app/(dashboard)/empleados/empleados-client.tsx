"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  sucursales: { nombre: string } | null;
};

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
      foto: photo, // Enviamos el base64 para procesar embedding
    };
    const url  = editing ? "/api/empleados/update" : "/api/empleados/create";
    const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Error al guardar"); return; }
    onSaved(); onClose();
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
              {photo ? (
                <img src={photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                {photo ? <img src={photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (nombre[0] || "?")}
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
          <div style={{ padding: 40, display: "flex", flexDirection: "column" }}>
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
              <button onClick={onClose} style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "200ms" }}>
                Cancelar
              </button>
              <button onClick={save} disabled={loading} style={{ 
                flex: 2, padding: "14px", 
                background: loading ? "rgba(37,99,235,0.5)" : "var(--accent)", 
                color: "#fff", border: "none", borderRadius: 12, 
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 10px 20px -10px var(--accent-glow)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s"
              }}>
                {loading && (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                )}
                {loading ? "Sincronizando..." : editing ? "Actualizar Perfil" : "Finalizar Registro"}
              </button>
            </div>
          </div>
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
  async function confirm() {
    // Optimistic: removemos del estado local YA y cerramos modal de inmediato.
    onOptimisticDelete(emp.id);
    onClose();
    // El fetch corre en segundo plano; si falla, restauramos.
    try {
      const res = await fetch("/api/empleados/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id }),
      });
      if (!res.ok) onError(emp);
    } catch {
      onError(emp);
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
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          <button onClick={confirm} style={{ flex: 1, padding: "10px 0", background: "rgba(239,68,68,.9)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function EmpleadosClient({ empleados: initial, sucursales }: { empleados: Empleado[]; sucursales: Sucursal[] }) {
  const router = useRouter();
  const [empleados, setEmpleados] = useState(initial);
  const [modal,  setModal]  = useState<"create" | "edit" | "delete" | "import-info" | null>(null);
  const [target, setTarget] = useState<Empleado | null>(null);
  const [search, setSearch] = useState("");
  const [, startT] = useTransition();
  const fileExcelRef = useRef<HTMLInputElement>(null);

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
      .channel("empleados-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "empleados" },
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
              .select("id, nombre, apellido, puesto, employee_code, enrollado, activo, sucursal_id, sucursales(nombre)")
              .eq("id", ins.id)
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
  }, []);

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

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Empleados</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{empleados.length} empleados registrados</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {/* import */}
          <input type="file" ref={fileExcelRef} hidden accept=".xlsx, .xls, .csv" onChange={(e) => e.target.files?.[0] && handleExcelImport(e.target.files[0])} />
          <button 
            onClick={() => setModal("import-info")}
            style={{ padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-muted)", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Excel
          </button>

          {/* search */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar personal..." style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", width: 220, transition: "border-color 150ms" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
          </div>
          <button onClick={() => setModal("create")} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", boxShadow: "0 0 14px var(--accent-glow)", transition: "background 200ms" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo Empleado
          </button>
        </div>
      </div>

      {/* table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Empleado", "Puesto", "Sucursal", "Enrollado", "Estado", ""].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                  {search ? "Sin resultados para esa búsqueda." : "No hay empleados registrados."}
                </td>
              </tr>
            ) : filtered.map((emp) => (
              <tr key={emp.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background 120ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--accent)", opacity: .85, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {emp.nombre[0]}{emp.apellido[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{emp.nombre} {emp.apellido}</p>
                      {emp.employee_code && <p style={{ fontSize: 11, color: "var(--text-faint)" }}>#{emp.employee_code}</p>}
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
                    <button onClick={() => openEdit(emp)} title="Editar" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-elevated)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", transition: "all 150ms" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => openDelete(emp)} title="Eliminar" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-elevated)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", transition: "all 150ms" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,.4)"; e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}>
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
          <button onClick={onClose} style={{ flex: 1, padding: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "200ms" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
            Cancelar
          </button>
          <button onClick={onSelect} style={{ flex: 2, padding: "16px", background: "#22c55e", border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 25px -5px rgba(34,197,94,0.4)", transition: "all 200ms" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            Seleccionar Archivo
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

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
  width: "100%", padding: "10px 13px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const,
  transition: "border-color 150ms",
};
const LABEL = {
  fontSize: 11, fontWeight: 500 as const, color: "var(--text-muted)" as const,
  textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block" as const, marginBottom: 5,
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={LABEL}>{label}</label>{children}</div>;
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
    };
    const url  = editing ? "/api/empleados/update" : "/api/empleados/create";
    const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Error al guardar"); return; }
    onSaved(); onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, position: "relative", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        {/* accent stripe */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#2563eb 30%,#60a5fa 70%,transparent)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(37,99,235,.1)", border: "1px solid rgba(37,99,235,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {editing ? "Editar empleado" : "Nuevo empleado"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* nombre + apellido en fila */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nombre *">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"}
                placeholder="Ej: Juan" autoFocus />
            </Field>
            <Field label="Apellido *">
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"}
                placeholder="Ej: Pérez" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Puesto">
              <input value={puesto} onChange={(e) => setPuesto(e.target.value)} style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"}
                placeholder="Ej: Operador" />
            </Field>
            <Field label="Código empleado">
              <input value={empCode} onChange={(e) => setEmpCode(e.target.value)} style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"}
                placeholder="Ej: EMP-001" />
            </Field>
          </div>

          <Field label="Sucursal">
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...INPUT, cursor: "pointer" }}>
              <option value="">— Sin sucursal —</option>
              {sucursales.map((s) => <option key={s.id} value={s.id} style={{ background: "#0f172a" }}>{s.nombre}</option>)}
            </select>
          </Field>

          {editing && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div style={{ position: "relative", width: 36, height: 20 }}>
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", zIndex: 1 }} />
                <div style={{ width: 36, height: 20, borderRadius: 10, background: activo ? "var(--accent)" : "var(--bg-elevated)", border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`, transition: "background 200ms", position: "relative" }}>
                  <div style={{ position: "absolute", top: 2, left: activo ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
                </div>
              </div>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Empleado activo</span>
            </label>
          )}

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "10px 12px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px 0", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, fontWeight: 500, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={save} disabled={loading} style={{
              flex: 2, padding: "11px 0",
              background: loading ? "rgba(37,99,235,.5)" : "var(--accent)",
              color: "#fff", border: "none", borderRadius: 9,
              fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "background 200ms",
              boxShadow: loading ? "none" : "0 0 16px var(--accent-glow)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
              {loading && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>}
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Crear empleado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Modal confirmar eliminar ── */
function DeleteModal({ emp, onClose, onDeleted }: { emp: Empleado; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    await fetch("/api/empleados/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: emp.id }) });
    setLoading(false);
    onDeleted(); onClose();
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
          <button onClick={confirm} disabled={loading} style={{ flex: 1, padding: "10px 0", background: "rgba(239,68,68,.9)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {loading ? "Eliminando..." : "Sí, eliminar"}
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
  const [modal,  setModal]  = useState<"create" | "edit" | "delete" | null>(null);
  const [target, setTarget] = useState<Empleado | null>(null);
  const [search, setSearch] = useState("");
  const [, startT] = useTransition();

  const refresh = () => startT(() => { router.refresh(); });

  const filtered = empleados.filter((e) => {
    const q = search.toLowerCase();
    return !q || `${e.nombre} ${e.apellido} ${e.puesto ?? ""} ${e.employee_code ?? ""}`.toLowerCase().includes(q);
  });

  function openEdit(e: Empleado) { setTarget(e); setModal("edit"); }
  function openDelete(e: Empleado) { setTarget(e); setModal("delete"); }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* modals */}
      {(modal === "create" || modal === "edit") && (
        <EmpModal emp={modal === "edit" ? target : null} sucursales={sucursales} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal === "delete" && target && (
        <DeleteModal emp={target} onClose={() => setModal(null)} onDeleted={refresh} />
      )}

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Empleados</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{empleados.length} empleados registrados</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {/* search */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empleado..." style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", width: 220, transition: "border-color 150ms" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
          </div>
          <button onClick={() => setModal("create")} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", boxShadow: "0 0 14px var(--accent-glow)", transition: "background 200ms" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar empleado
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
                  {emp.enrollado
                    ? <span style={{ fontSize: 11, background: "rgba(34,197,94,.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,.2)", padding: "2px 9px", borderRadius: 20 }}>Enrollado</span>
                    : <span style={{ fontSize: 11, background: "rgba(234,179,8,.08)", color: "#facc15", border: "1px solid rgba(234,179,8,.2)", padding: "2px 9px", borderRadius: 20 }}>Pendiente</span>}
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

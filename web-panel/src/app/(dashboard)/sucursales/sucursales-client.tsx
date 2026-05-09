
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";

type Sucursal = {
  id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  hora_apertura: string | null;
  hora_cierre: string | null;
  tolerancia_min: number;
};

export function SucursalesClient({ sucursales: initial }: { sucursales: Sucursal[] }) {
  const router = useRouter();
  const [sucursales, setSucursales] = useState(initial);
  const [selected, setSelected] = useState<Sucursal | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { setSucursales(initial); }, [initial]);

  const filtered = sucursales.filter(s => s.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {showCrear && <ModalSucursal onClose={() => setShowCrear(false)} onDone={() => router.refresh()} />}
      {selected && <ModalSucursal sucursal={selected} onClose={() => setSelected(null)} onDone={() => router.refresh()} />}

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
        <PageHeader
          title="Sucursales"
          subtitle="Gestiona los puntos físicos de registro y sus dispositivos"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M4 21V4a2 2 0 012-2h12a2 2 0 012 2v17M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/></svg>}
          iconColor="#a78bfa"
          stats={[
            { label: "Total", value: sucursales.length },
            { label: "Activas", value: sucursales.filter(s => s.activa).length },
          ]}
          actions={
            <>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar sucursal..."
                  style={{
                    padding: "9px 14px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 9, fontSize: 13, color: "var(--text-primary)", outline: "none", width: 240,
                  }}
                />
              </div>
              <button onClick={() => setShowCrear(true)} className="btn btn-primary btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nueva Sucursal
              </button>
            </>
          }
        />

      <div className="stagger-fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {filtered.map((s) => (
          <div key={s.id} onClick={() => setSelected(s)} className="card card-hover sucursal-card" style={{
            padding: "22px", cursor: "pointer",
            position: "relative", overflow: "hidden",
          }}>
            {/* Accent bar lateral con glow */}
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
              background: s.activa
                ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                : "linear-gradient(180deg, #52525b 0%, #3f3f46 100%)",
              boxShadow: s.activa ? "0 0 12px rgba(34,197,94,0.4)" : "none",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: "linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.06) 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(167,139,250,0.22)",
                  boxShadow: "0 6px 14px -8px rgba(167,139,250,0.5)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M4 21V4a2 2 0 012-2h12a2 2 0 012 2v17M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/></svg>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  {s.nombre}
                </h3>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 7,
                background: s.activa ? "rgba(34,197,94,0.10)" : "rgba(100,116,139,0.10)",
                color: s.activa ? "#4ade80" : "var(--text-faint)",
                border: `1px solid ${s.activa ? "rgba(34,197,94,0.22)" : "rgba(100,116,139,0.22)"}`,
                letterSpacing: "0.06em",
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: s.activa ? "#22c55e" : "#52525b",
                  boxShadow: s.activa ? "0 0 5px #22c55e" : "none",
                }} className={s.activa ? "animate-pulse-dot" : undefined} />
                {s.activa ? "ACTIVA" : "INACTIVA"}
              </span>
            </div>

            <p style={{
              fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
              marginBottom: 16, minHeight: 38,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {s.direccion || "Sin dirección registrada"}
            </p>

            {/* Stats inline: horario + tolerancia */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
              borderTop: "1px solid var(--border)",
              marginTop: 4,
            }}>
              <div style={{ padding: "12px 0", borderRight: "1px solid var(--border)" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
                  Horario
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-faint)" }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {s.hora_apertura && s.hora_cierre
                    ? `${s.hora_apertura.slice(0, 5)} – ${s.hora_cierre.slice(0, 5)}`
                    : <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>Sin definir</span>}
                </p>
              </div>
              <div style={{ padding: "12px 0 12px 14px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
                  Tolerancia
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {s.tolerancia_min != null
                    ? `${s.tolerancia_min} min`
                    : <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>—</span>}
                </p>
              </div>
            </div>

            {/* Indicador "Ver" que aparece al hover */}
            <div className="sucursal-card__cta" style={{
              position: "absolute", bottom: 14, right: 14,
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, color: "var(--accent-hover)",
              opacity: 0, transform: "translateX(-4px)",
              transition: "opacity 200ms, transform 200ms cubic-bezier(0.16,1,0.3,1)",
              pointerEvents: "none",
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              Ver
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .sucursal-card:hover :global(.sucursal-card__cta) {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </div>
    </>
  );
}

function ModalSucursal({ sucursal, onClose, onDone }: { sucursal?: Sucursal; onClose: () => void; onDone: () => void }) {
  const { notify } = useNotifications();
  const [nombre, setNombre] = useState(sucursal?.nombre || "");
  const [direccion, setDireccion] = useState(sucursal?.direccion || "");
  const [activa, setActiva] = useState(sucursal ? sucursal.activa : true);
  const [horaApertura, setHoraApertura] = useState((sucursal?.hora_apertura ?? "09:00:00").slice(0, 5));
  const [horaCierre,   setHoraCierre]   = useState((sucursal?.hora_cierre   ?? "18:00:00").slice(0, 5));
  const [toleranciaMin, setToleranciaMin] = useState(sucursal?.tolerancia_min ?? 10);
  const [loading, setLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [tab, setTab] = useState<"info" | "horario">("info");

  async function save() {
    if (!nombre.trim()) {
      notify({ kind: "warning", title: "Nombre requerido" });
      return;
    }
    setLoading(true);
    try {
      const url = sucursal ? "/api/sucursales/update" : "/api/sucursales/create";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sucursal?.id,
          nombre: nombre.trim(),
          direccion: direccion.trim() || null,
          activa,
          hora_apertura: horaApertura || null,
          hora_cierre: horaCierre || null,
          tolerancia_min: toleranciaMin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      notify({ kind: "success", title: sucursal ? "Sucursal actualizada" : "Sucursal creada" });
      onDone();
      onClose();
    } catch (e) {
      notify({ kind: "error", title: "No se pudo guardar", message: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!sucursal) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sucursales/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sucursal.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      notify({ kind: "success", title: "Sucursal eliminada" });
      onDone();
      onClose();
    } catch (e) {
      notify({ kind: "error", title: "No se pudo eliminar", message: e instanceof Error ? e.message : undefined });
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: "rgba(0,0,0,0.8)", 
      backdropFilter: "blur(12px)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 1000, 
      padding: "20px" 
    }} onClick={onClose}>
      <div style={{ 
        background: "var(--bg-card)", 
        border: "1px solid var(--border)", 
        borderRadius: 24, 
        width: "100%", 
        maxWidth: 500, 
        position: "relative", 
        overflow: "hidden",
        boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header Modal */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 40, height: 40, borderRadius: 12, background: "var(--accent)", 
                  display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px var(--accent-glow)"
                }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M4 21V4a2 2 0 012-2h12a2 2 0 012 2v17M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/></svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                    {sucursal ? sucursal.nombre : "Nueva Sucursal"}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Configuración de sede</p>
                </div>
             </div>
             <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>
          </div>

          <div style={{ display: "flex", gap: 20 }}>
            <button onClick={() => setTab("info")} style={{
              background: "none", border: "none", padding: "0 0 8px 0", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: tab === "info" ? "var(--accent)" : "var(--text-muted)",
              borderBottom: `2px solid ${tab === "info" ? "var(--accent)" : "transparent"}`,
              transition: "all 0.2s"
            }}>Información</button>
            <button onClick={() => setTab("horario")} style={{
              background: "none", border: "none", padding: "0 0 8px 0", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: tab === "horario" ? "var(--accent)" : "var(--text-muted)",
              borderBottom: `2px solid ${tab === "horario" ? "var(--accent)" : "transparent"}`,
              transition: "all 0.2s"
            }}>Horario</button>
          </div>
        </div>

        <div style={{ padding: "32px", overflowY: "auto" }}>
          {tab === "info" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre de la Sucursal</label>
                <input 
                  value={nombre} 
                  onChange={e => setNombre(e.target.value)} 
                  style={{ 
                    padding: "12px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", 
                    borderRadius: 12, fontSize: 14, color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s"
                  }} 
                  onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                  placeholder="Ej: Oficina Central / Almacén Norte" 
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dirección Completa</label>
                <textarea 
                  value={direccion} 
                  onChange={e => setDireccion(e.target.value)} 
                  style={{ 
                    padding: "12px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", 
                    borderRadius: 12, fontSize: 14, color: "var(--text-primary)", outline: "none", minHeight: 100, resize: "none", transition: "border-color 0.2s"
                  }} 
                  onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                  placeholder="Calle, número, colonia, ciudad..." 
                />
              </div>

              <div style={{ 
                display: "flex", alignItems: "center", justifyContent: "space-between", 
                padding: "14px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid var(--border)" 
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Estado Operativo</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Permitir registros en esta sede</p>
                </div>
                <button onClick={() => setActiva(!activa)} style={{
                  width: 44, height: 24, borderRadius: 20, background: activa ? "var(--accent)" : "#3f3f46",
                  border: "none", position: "relative", cursor: "pointer", transition: "background 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}>
                  <div style={{ 
                    position: "absolute", top: 3, left: activa ? 23 : 3, width: 18, height: 18, 
                    background: "#fff", borderRadius: "50%", transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Define la hora esperada de entrada y salida. Las llegadas posteriores a la apertura
                + tolerancia generarán notificaciones automáticas en el panel.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hora de apertura</label>
                  <input
                    type="time"
                    value={horaApertura}
                    onChange={e => setHoraApertura(e.target.value)}
                    style={{
                      padding: "12px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: 12, fontSize: 14, color: "var(--text-primary)", outline: "none", colorScheme: "dark",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hora de cierre</label>
                  <input
                    type="time"
                    value={horaCierre}
                    onChange={e => setHoraCierre(e.target.value)}
                    style={{
                      padding: "12px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: 12, fontSize: 14, color: "var(--text-primary)", outline: "none", colorScheme: "dark",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tolerancia (minutos)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={toleranciaMin}
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setToleranciaMin(Math.min(240, Math.max(0, Math.round(n))));
                  }}
                  style={{
                    padding: "12px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 12, fontSize: 14, color: "var(--text-primary)", outline: "none",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  Llegada tarde después de {horaApertura || "—"} + {toleranciaMin} min
                </span>
              </div>
            </div>
          )}

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={save} disabled={loading} style={{
              padding: "14px", background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 8px 25px var(--accent-glow)", transition: "all 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              {loading ? "Procesando..." : sucursal ? "Guardar Cambios" : "Crear Sucursal"}
            </button>

            {sucursal && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                {!showDelete ? (
                  <button onClick={() => setShowDelete(true)} style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}>
                    Eliminar esta sucursal
                  </button>
                ) : (
                  <div style={{ background: "rgba(239,68,68,0.1)", padding: "16px", borderRadius: 16, border: "1px solid rgba(239,68,68,0.2)", width: "100%" }}>
                    <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginBottom: 12, fontWeight: 600 }}>¿Confirmas la eliminación definitiva?</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={handleDelete} style={{ flex: 1, padding: "10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirmar</button>
                      <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


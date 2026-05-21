"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Building2, Plus, Search, Clock, X, ChevronRight, MapPin } from "lucide-react";

const LocationPicker = dynamic(
  () => import("@/components/ui/LocationPicker").then(m => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: "100%", height: 240, borderRadius: 8,
        background: "var(--bg-elevated)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-faint)", fontSize: 12,
      }}>
        Cargando mapa…
      </div>
    ),
  }
);

type Sucursal = {
  id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  hora_apertura: string | null;
  hora_cierre: string | null;
  tolerancia_min: number;
  lat: number | null;
  lng: number | null;
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
          count={`${sucursales.length} ${sucursales.length === 1 ? "sucursal" : "sucursales"}`}
          subtitle="Gestiona los puntos físicos de registro y sus dispositivos"
          icon={<Building2 size={18} strokeWidth={1.75} />}
          stats={[
            { label: "Activas", value: sucursales.filter(s => s.activa).length },
          ]}
          actions={
            <>
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  strokeWidth={2}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}
                />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar sucursal..."
                  className="input"
                  style={{ paddingLeft: 34, width: 240 }}
                />
              </div>
              <button onClick={() => setShowCrear(true)} className="btn btn-primary btn-sm">
                <Plus size={14} strokeWidth={2.5} />
                Nueva Sucursal
              </button>
            </>
          }
        />

        {filtered.length === 0 ? (
          <EmptyStateSucursales onCreate={() => setShowCrear(true)} />
        ) : (
          <div className="stagger-fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelected(s)}
                className="card card-hover sucursal-card"
                style={{ padding: 20, cursor: "pointer", position: "relative" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "var(--radius-md)",
                      background: "rgba(37,99,235,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--accent-hover)", flexShrink: 0,
                    }}>
                      <Building2 size={16} strokeWidth={1.75} />
                    </div>
                    <h3 style={{
                      fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                      letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.nombre}
                    </h3>
                  </div>
                  <StatusBadge
                    kind={s.activa ? "online" : "offline"}
                    label={s.activa ? "Activa" : "Inactiva"}
                    strong={s.activa}
                  />
                </div>

                <p style={{
                  fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55,
                  marginBottom: 14, minHeight: 36,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {s.direccion || <span style={{ color: "var(--text-faint)" }}>Sin dirección registrada</span>}
                </p>

                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  borderTop: "1px solid var(--border)", paddingTop: 12,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  <div>
                    <p style={{
                      fontSize: 9, fontWeight: 700, color: "var(--text-faint)",
                      textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4,
                    }}>
                      Horario
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={11} strokeWidth={2} style={{ color: "var(--text-faint)" }} />
                      {s.hora_apertura && s.hora_cierre
                        ? `${s.hora_apertura.slice(0, 5)} – ${s.hora_cierre.slice(0, 5)}`
                        : <span style={{ color: "var(--text-faint)" }}>Sin definir</span>}
                    </p>
                  </div>
                  <div style={{ paddingLeft: 14, borderLeft: "1px solid var(--border)" }}>
                    <p style={{
                      fontSize: 9, fontWeight: 700, color: "var(--text-faint)",
                      textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4,
                    }}>
                      Tolerancia
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                      {s.tolerancia_min != null
                        ? `${s.tolerancia_min} min`
                        : <span style={{ color: "var(--text-faint)" }}>—</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyStateSucursales({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Building2 size={22} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        Sin sucursales registradas
      </h3>
      <p className="text-muted-sm" style={{ maxWidth: 320 }}>
        Las sucursales son los puntos físicos donde se conectan las estaciones de registro.
      </p>
      <button onClick={onCreate} className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
        <Plus size={14} strokeWidth={2.5} />
        Crear primera sucursal
      </button>
    </div>
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
  const [lat, setLat] = useState<number | null>(sucursal?.lat ?? null);
  const [lng, setLng] = useState<number | null>(sucursal?.lng ?? null);
  const [loading, setLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [tab, setTab] = useState<"info" | "horario" | "ubicacion">("info");

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
          lat, lng,
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
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="animate-modal-up"
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500,
          position: "relative", overflow: "hidden",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius-md)",
                background: "rgba(37,99,235,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-hover)",
              }}>
                <Building2 size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {sucursal ? sucursal.nombre : "Nueva sucursal"}
                </h2>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Configuración de sede</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-icon btn-ghost btn-sm"
              aria-label="Cerrar"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 18, borderBottom: "1px solid var(--border)" }}>
            {(["info", "horario", "ubicacion"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: "none", border: "none", padding: "0 0 10px 0", cursor: "pointer",
                  fontSize: 12.5, fontWeight: 600,
                  color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}
              >
                {t === "info" ? "Información" : t === "horario" ? "Horario" : (
                  <>
                    <MapPin size={12} strokeWidth={2} />
                    Ubicación
                    {(lat != null && lng != null) && <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "var(--accent)", marginLeft: 2,
                    }} />}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, overflowY: "auto" }}>
          {tab === "ubicacion" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
                <strong>Mi ubicación</strong> usa el GPS/Wi-Fi de este equipo (aproximado),
                <strong> clic</strong> coloca un pin nuevo y <strong>arrastrar</strong> ajusta.
              </p>

              <LocationPicker
                lat={lat}
                lng={lng}
                onChange={(la, ln) => { setLat(la); setLng(ln); }}
              />

              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "10px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                fontVariantNumeric: "tabular-nums",
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Coordenadas
                  </p>
                  <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}>
                    {lat != null && lng != null
                      ? `${lat.toFixed(5)}°  ${lng.toFixed(5)}°`
                      : <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>Sin ubicación</span>}
                  </p>
                </div>
                {lat != null && lng != null && (
                  <button
                    type="button"
                    onClick={() => { setLat(null); setLng(null); }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#f87171", flexShrink: 0 }}
                    title="Quitar ubicación de esta sucursal"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ) : tab === "info" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Nombre de la sucursal">
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="input"
                  placeholder="Ej: Oficina Central / Almacén Norte"
                />
              </Field>

              <Field label="Dirección completa">
                <textarea
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  className="input"
                  style={{ minHeight: 90, resize: "none" }}
                  placeholder="Calle, número, colonia, ciudad..."
                />
              </Field>

              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Estado operativo</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Permitir registros en esta sede</p>
                </div>
                <button
                  onClick={() => setActiva(!activa)}
                  type="button"
                  style={{
                    width: 38, height: 22, borderRadius: "var(--radius-pill)",
                    background: activa ? "var(--accent)" : "#3f3f46",
                    border: "none", position: "relative", cursor: "pointer",
                    transition: "background 180ms ease",
                  }}
                  aria-pressed={activa}
                >
                  <span style={{
                    position: "absolute", top: 3, left: activa ? 19 : 3,
                    width: 16, height: 16, background: "#fff", borderRadius: "50%",
                    transition: "left 180ms ease",
                  }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
                Define la hora esperada de entrada y salida. Las llegadas posteriores a la apertura
                + tolerancia generarán notificaciones automáticas.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Hora de apertura">
                  <input
                    type="time"
                    value={horaApertura}
                    onChange={e => setHoraApertura(e.target.value)}
                    className="input"
                    style={{ colorScheme: "dark" }}
                  />
                </Field>
                <Field label="Hora de cierre">
                  <input
                    type="time"
                    value={horaCierre}
                    onChange={e => setHoraCierre(e.target.value)}
                    className="input"
                    style={{ colorScheme: "dark" }}
                  />
                </Field>
              </div>

              <Field label="Tolerancia (minutos)" hint={`Llegada tarde después de ${horaApertura || "—"} + ${toleranciaMin} min`}>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={toleranciaMin}
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setToleranciaMin(Math.min(240, Math.max(0, Math.round(n))));
                  }}
                  className="input"
                />
              </Field>
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={save}
              disabled={loading}
              className="btn btn-primary btn-block"
              style={{ padding: "11px 14px" }}
            >
              {loading ? "Procesando..." : sucursal ? "Guardar cambios" : "Crear sucursal"}
              {!loading && <ChevronRight size={14} strokeWidth={2.5} />}
            </button>

            {sucursal && (
              <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                {!showDelete ? (
                  <button
                    onClick={() => setShowDelete(true)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#f87171" }}
                  >
                    Eliminar esta sucursal
                  </button>
                ) : (
                  <div style={{
                    background: "rgba(239,68,68,0.06)",
                    padding: 14, borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(239,68,68,0.18)", width: "100%",
                  }}>
                    <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginBottom: 10, fontWeight: 600 }}>
                      ¿Confirmas la eliminación definitiva?
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleDelete} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                        Confirmar
                      </button>
                      <button onClick={() => setShowDelete(false)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                        Cancelar
                      </button>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: "var(--text-faint)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{hint}</span>
      )}
    </div>
  );
}

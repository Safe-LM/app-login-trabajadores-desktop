"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ChevronsUpDown, Check, Crown, Shield, Eye, Search, Building2, Loader2 } from "lucide-react";

type MiEmpresa = {
  empresa_id: string;
  empresa_nombre: string;
  empresa_slug: string;
  rol: "owner" | "admin" | "viewer";
  es_activa: boolean;
};

const ROL_CONFIG = {
  owner:  { icon: Crown, color: "#f59e0b", label: "Propietario" },
  admin:  { icon: Shield, color: "#3b82f6", label: "Administrador" },
  viewer: { icon: Eye, color: "#64748b", label: "Visor" },
} as const;

export function EmpresaSwitcher({ empresaNombre }: { empresaNombre: string | null }) {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<MiEmpresa[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch("/api/me/empresa-activa");
        if (!r.ok) return;
        const data = await r.json();
        if (!cancel && data.ok) {
          setEmpresas(data.empresas ?? []);
          setLoaded(true);
        }
      } catch {}
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [open, loaded]);

  useEffect(() => {
    if (open && loaded && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch("");
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function cambiar(empresaId: string) {
    setSwitching(empresaId);
    try {
      const r = await fetch("/api/me/empresa-activa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      if (!r.ok) return;
      window.location.reload();
    } finally {
      setSwitching(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return empresas;
    const q = search.toLowerCase();
    return empresas.filter(e => e.empresa_nombre.toLowerCase().includes(q) || e.empresa_slug.toLowerCase().includes(q));
  }, [empresas, search]);

  const tieneMultiples = loaded && empresas.length > 1;
  const initial = (empresaNombre ?? "?")[0]?.toUpperCase();

  return (
    <div ref={rootRef} className="sidebar-org" style={{ position: "relative" }}>
      <p className="sidebar-org__label">Empresa</p>
      <button
        type="button"
        className="sidebar-org__switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        title={empresaNombre ?? "Sin empresa"}
        onClick={() => setOpen(v => !v)}
      >
        <span className="sidebar-org__avatar">{initial}</span>
        <span className="sidebar-org__name">{empresaNombre ?? "Sin empresa"}</span>
        <ChevronsUpDown size={13} strokeWidth={2} style={{
          color: "var(--text-faint)", flexShrink: 0,
          transition: "transform 200ms",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          zIndex: 60,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          maxHeight: 340, display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "fadeIn 0.15s ease-out",
        }}>
          <div style={{
            padding: "10px 10px 6px",
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>
              Cambiar empresa
            </div>
            {loaded && empresas.length > 3 && (
              <div style={{ position: "relative" }}>
                <Search size={12} style={{
                  position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-faint)", pointerEvents: "none",
                }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  style={{
                    width: "100%", padding: "6px 8px 6px 26px",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", fontSize: 11,
                    color: "var(--text-primary)", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 4 }}>
            {!loaded ? (
              <div style={{ padding: "16px 10px", textAlign: "center" }}>
                <Loader2 size={16} style={{ color: "var(--text-faint)", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>Cargando...</p>
              </div>
            ) : empresas.length === 0 ? (
              <div style={{ padding: "16px 10px", textAlign: "center" }}>
                <Building2 size={20} style={{ color: "var(--text-faint)", margin: "0 auto 6px", display: "block" }} />
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Sin empresas</p>
                <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>Contacta a un admin</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "12px 10px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Sin resultados</p>
              </div>
            ) : (
              <>
                {filtered.map(emp => {
                  const config = ROL_CONFIG[emp.rol];
                  const RolIcon = config.icon;
                  const isSwitching = switching === emp.empresa_id;
                  return (
                    <button
                      key={emp.empresa_id}
                      onClick={() => { if (!emp.es_activa && !isSwitching) cambiar(emp.empresa_id); }}
                      disabled={emp.es_activa || isSwitching}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "8px 8px",
                        borderRadius: "var(--radius-md)",
                        background: emp.es_activa ? "var(--accent-soft)" : "transparent",
                        border: emp.es_activa ? "1px solid rgba(37,99,235,0.15)" : "1px solid transparent",
                        cursor: emp.es_activa || isSwitching ? "default" : "pointer",
                        color: "var(--text-primary)", textAlign: "left",
                        transition: "background 120ms, border-color 120ms",
                      }}
                      onMouseOver={e => { if (!emp.es_activa && !isSwitching) e.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseOut={e  => { if (!emp.es_activa && !isSwitching) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: "var(--radius-md)",
                        background: emp.es_activa
                          ? "linear-gradient(135deg, var(--accent), var(--accent-hover))"
                          : `linear-gradient(135deg, ${config.color}33, ${config.color}11)`,
                        color: emp.es_activa ? "#fff" : config.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                        border: emp.es_activa ? "none" : `1px solid ${config.color}22`,
                      }}>
                        {emp.empresa_nombre[0]?.toUpperCase() ?? "?"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{
                            fontSize: 12, fontWeight: emp.es_activa ? 600 : 500,
                            whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden",
                          }}>
                            {emp.empresa_nombre}
                          </span>
                          {emp.es_activa && (
                            <span style={{
                              fontSize: 8, fontWeight: 600, color: "var(--accent)",
                              background: "rgba(37,99,235,0.12)",
                              padding: "1px 4px", borderRadius: 3,
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>
                              Activa
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                          <RolIcon size={9} color={config.color} />
                          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{config.label}</span>
                        </div>
                      </div>
                      {isSwitching ? (
                        <Loader2 size={12} style={{ color: "var(--text-faint)", animation: "spin 1s linear infinite" }} />
                      ) : emp.es_activa ? (
                        <Check size={12} color="#22c55e" strokeWidth={2.5} />
                      ) : null}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {!tieneMultiples && loaded && empresas.length > 0 && (
            <div style={{
              padding: "6px 10px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}>
              <p style={{ fontSize: 9, color: "var(--text-faint)", textAlign: "center", margin: 0 }}>
                Cuando te unas a otra empresa aparecera aqui
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Check, Crown, Shield, Eye } from "lucide-react";

type MiEmpresa = {
  empresa_id: string;
  empresa_nombre: string;
  empresa_slug: string;
  rol: "owner" | "admin" | "viewer";
  es_activa: boolean;
};

const ROL_ICON = { owner: Crown, admin: Shield, viewer: Eye } as const;
const ROL_COLOR = { owner: "#f59e0b", admin: "#2563eb", viewer: "#64748b" } as const;

export function EmpresaSwitcher({ empresaNombre }: { empresaNombre: string | null }) {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<MiEmpresa[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Cargar empresas la primera vez que se abre el menu (lazy)
  useEffect(() => {
    if (!open || loaded) return;
    let cancel = false;
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
    })();
    return () => { cancel = true; };
  }, [open, loaded]);

  // Cerrar al clickear fuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
      // Hard reload para que el JWT se refresque con el nuevo claim
      window.location.reload();
    } finally {
      setSwitching(null);
    }
  }

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
        <ChevronsUpDown size={12} strokeWidth={2} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 60,
          background: "var(--bg-elevated, #1a2238)",
          border: "1px solid var(--border)",
          borderRadius: 10, padding: 4,
          boxShadow: "0 12px 32px rgba(0,0,0,.45)",
          maxHeight: 320, overflowY: "auto",
        }}>
          {!loaded ? (
            <div style={{ padding: 10, fontSize: 11, color: "var(--text-faint)" }}>Cargando…</div>
          ) : empresas.length === 0 ? (
            <div style={{ padding: 10, fontSize: 11, color: "var(--text-faint)" }}>Sin empresas</div>
          ) : (
            <>
              {empresas.map(emp => {
                const RolIcon = ROL_ICON[emp.rol];
                const color = ROL_COLOR[emp.rol];
                const isSwitching = switching === emp.empresa_id;
                return (
                  <button
                    key={emp.empresa_id}
                    onClick={() => { if (!emp.es_activa) cambiar(emp.empresa_id); }}
                    disabled={emp.es_activa || isSwitching}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 10px",
                      borderRadius: 6, background: emp.es_activa ? "rgba(37,99,235,.08)" : "transparent",
                      border: "none", cursor: emp.es_activa ? "default" : "pointer",
                      color: "var(--text-primary)", textAlign: "left",
                    }}
                    onMouseOver={e => { if (!emp.es_activa) e.currentTarget.style.background = "var(--bg-card)"; }}
                    onMouseOut={e  => { if (!emp.es_activa) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: `${color}22`, color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {emp.empresa_nombre[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 600 }}>
                      {emp.empresa_nombre}
                    </span>
                    <RolIcon size={11} color={color} />
                    {emp.es_activa && <Check size={13} color="#22c55e" />}
                  </button>
                );
              })}
              {!tieneMultiples && (
                <div style={{ padding: "6px 10px 4px", fontSize: 10, color: "var(--text-faint)" }}>
                  Cuando te unas a otra empresa aparecerá aquí.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

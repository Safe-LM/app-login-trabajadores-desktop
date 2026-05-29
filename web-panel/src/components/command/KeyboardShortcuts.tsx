"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, LayoutGrid, Users, ClipboardList, Building2, Monitor,
  Bell, BarChart3, Settings, Search, HelpCircle, Command as CmdIcon,
  Trophy, Activity, Map,
  type LucideIcon,
} from "lucide-react";

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [goMode, setGoMode] = useState(false);
  const showHelpRef = useRef(false);
  const goModeRef = useRef(false);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleHelp = useCallback(() => {
    setShowHelp((v) => { showHelpRef.current = !v; return !v; });
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
    showHelpRef.current = false;
  }, []);

  useEffect(() => {
    const isTyping = () => {
      const a = document.activeElement;
      if (!a) return false;
      const tag = a.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if ((a as HTMLElement).isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;

      const k = e.key;
      const kl = k.toLowerCase();

      if (kl === "?" || (k === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHelp((v) => { showHelpRef.current = !v; return !v; });
        return;
      }

      if (kl === "escape" && showHelpRef.current) {
        e.preventDefault();
        setShowHelp(false);
        showHelpRef.current = false;
        return;
      }

      if (k === "/" && !e.shiftKey) {
        const input = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="uscar"], input[placeholder*="earch"], input[placeholder*="Buscar"]'
        );
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }

      if (goModeRef.current) {
        const route = goToMap[kl];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        setGoMode(false);
        goModeRef.current = false;
        if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null; }
        return;
      }

      if (kl === "g") {
        e.preventDefault();
        setGoMode(true);
        goModeRef.current = true;
        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        goTimerRef.current = setTimeout(() => { setGoMode(false); goModeRef.current = false; }, 1500);
        return;
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null; }
    };
  }, [router]);

  return (
    <>
      {goMode && <GoModeIndicator />}
      {showHelp && <ShortcutsHelp onClose={closeHelp} />}
    </>
  );
}

const goToMap: Record<string, string> = {
  d: "/dashboard",
  e: "/empleados",
  a: "/asistencia",
  s: "/dispositivos",
  u: "/sucursales",
  n: "/notificaciones",
  r: "/reportes",
  c: "/configuracion",
  t: "/tablero",
  x: "/ejecutivo",
  v: "/actividad",
};

// ─── Indicador "Pulsa la siguiente tecla..." ──────────────────────────────

function GoModeIndicator() {
  const hints: Array<[string, string, LucideIcon, string]> = [
    ["T", "Tablero",        Map,           "#3b82f6"],
    ["D", "Dashboard",      LayoutGrid,    "#60a5fa"],
    ["E", "Empleados",      Users,         "#10b981"],
    ["A", "Asistencia",     ClipboardList, "#f59e0b"],
    ["S", "Estaciones",     Monitor,       "#06b6d4"],
    ["U", "Sucursales",     Building2,     "#8b5cf6"],
    ["R", "Reportes",       BarChart3,     "#ec4899"],
    ["X", "Ejecutivo",      Trophy,        "#f97316"],
    ["V", "Actividad",      Activity,      "#14b8a6"],
    ["N", "Notificaciones", Bell,          "#ef4444"],
    ["C", "Configuracion",  Settings,      "#6b7280"],
  ];

  return (
    <div style={goBadgeStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: "var(--accent, #3b82f6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 13,
          fontFamily: "var(--font-data, monospace)",
        }}>G</div>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary, #f5f5f7)" }}>
          Pulsa la siguiente tecla para navegar...
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        {hints.map(([key, label, Icon, color]) => (
          <div key={key} style={goHintStyle}>
            <kbd style={{ ...kbdStyle, minWidth: 22 }}>{key}</kbd>
            <Icon size={11} style={{ color: color as string }} />
            <span style={{ fontSize: 10, color: "var(--text-secondary, #d4d4d8)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overlay de ayuda (?) ─────────────────────────────────────────────────

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const navigation: Array<[string, string, LucideIcon, string]> = [
    ["G T", "Tablero",        Map,           "#3b82f6"],
    ["G D", "Dashboard",      LayoutGrid,    "#60a5fa"],
    ["G E", "Empleados",      Users,         "#10b981"],
    ["G A", "Asistencia",     ClipboardList, "#f59e0b"],
    ["G S", "Estaciones",     Monitor,       "#06b6d4"],
    ["G U", "Sucursales",     Building2,     "#8b5cf6"],
    ["G R", "Reportes",       BarChart3,     "#ec4899"],
    ["G X", "Ejecutivo",      Trophy,        "#f97316"],
    ["G V", "Actividad",      Activity,      "#14b8a6"],
    ["G N", "Notificaciones", Bell,          "#ef4444"],
    ["G C", "Configuracion",  Settings,      "#6b7280"],
  ];

  const commands: Array<[string, string, string]> = [
    ["⌘ K",  "Abrir paleta de comandos", "Buscar y ejecutar cualquier acción"],
    ["/",    "Buscar en esta página",    "Salta al cuadro de búsqueda"],
    ["?",    "Ver atajos de teclado",    "Este menú"],
    ["Esc",  "Cerrar / cancelar",        "Cierra modales y overlays"],
  ];

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <HelpCircle size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Atajos de teclado</h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint, #888)", marginTop: 2 }}>
                Domina el panel sin tocar el ratón
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
          {/* Tip card */}
          <div style={tipCardStyle}>
            <CmdIcon size={16} style={{ color: "#3b82f6", flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary, #d4d4d8)" }}>
              <strong style={{ color: "var(--text-primary, #f5f5f7)" }}>Tip:</strong>{" "}
              Pulsa <kbd style={kbdStyle}>⌘</kbd> <kbd style={kbdStyle}>K</kbd> (o{" "}
              <kbd style={kbdStyle}>Ctrl</kbd> <kbd style={kbdStyle}>K</kbd> en Windows){" "}
              en cualquier momento para abrir la búsqueda rápida.
            </div>
          </div>

          {/* Seccion: Navegacion */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>Navegación rápida</span>
              <span style={sectionHintStyle}>
                Pulsa <kbd style={kbdStyle}>G</kbd> y luego una letra
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {navigation.map(([keys, label, Icon, color]) => (
                <div key={keys} style={rowStyle}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: `${color}1f`, color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={14} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary, #f5f5f7)" }}>
                    {label}
                  </span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {keys.split(" ").map((k) => (
                      <kbd key={k} style={kbdStyle}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seccion: Comandos generales */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>Comandos generales</span>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {commands.map(([keys, label, desc]) => (
                <div key={keys} style={{ ...rowStyle, padding: "10px 10px" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "var(--bg-elevated, #1a1a1d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-faint, #888)", flexShrink: 0,
                  }}>
                    <Search size={13} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary, #f5f5f7)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint, #888)", marginTop: 1 }}>{desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {keys.split(" ").map((k) => (
                      <kbd key={k} style={kbdStyle}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          Pulsa <kbd style={kbdStyle}>Esc</kbd> para cerrar
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9998,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: "min(540px, 100%)", maxHeight: "85vh", overflow: "hidden",
  background: "var(--bg-surface, #0f0f10)",
  border: "1px solid var(--border, #2a2a2d)",
  borderRadius: 14,
  boxShadow: "0 32px 80px rgba(0, 0, 0, 0.7)",
  display: "flex", flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "18px 20px 14px",
  borderBottom: "1px solid var(--border, #2a2a2d)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  color: "var(--text-faint, #888)", padding: 6, borderRadius: 6,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const tipCardStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px", marginTop: 12,
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  borderRadius: 8, lineHeight: 1.5,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 20,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "var(--text-faint, #888)",
};

const sectionHintStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--text-faint, #888)",
  display: "flex", alignItems: "center", gap: 4,
};

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 10px", borderRadius: 8,
  background: "var(--bg-elevated, #131316)",
  border: "1px solid var(--border, #2a2a2d)",
};

const footerStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderTop: "1px solid var(--border, #2a2a2d)",
  background: "var(--bg-elevated, #131316)",
  fontSize: 11, color: "var(--text-faint, #888)",
  textAlign: "center",
};

const kbdStyle: React.CSSProperties = {
  fontSize: 10, padding: "2px 6px", minWidth: 18, textAlign: "center",
  background: "var(--bg-elevated, #1a1a1d)",
  border: "1px solid var(--border, #2a2a2d)",
  borderRadius: 4, color: "var(--text-secondary, #d4d4d8)",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontWeight: 500,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  lineHeight: 1,
};

const goBadgeStyle: React.CSSProperties = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "var(--bg-surface, #0f0f10)",
  border: "1px solid var(--border, #2a2a2d)",
  borderRadius: 12, padding: 14, minWidth: 320,
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
  zIndex: 9997,
};

const goHintStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  padding: "5px 7px", borderRadius: 6,
  background: "var(--bg-elevated, #131316)",
  border: "1px solid var(--border, #2a2a2d)",
};

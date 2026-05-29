"use client";

import { Command } from "cmdk";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Search, LayoutGrid, Users, ClipboardList, Building2,
  Monitor, Bell, BarChart3, Settings, Plus, Keyboard,
  ArrowRight, CornerDownLeft, Trophy, Activity, Map,
  type LucideIcon,
} from "lucide-react";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  icon: LucideIcon;
  color: string;
  group: string;
  keywords?: string;
  shortcut?: string;
};

export function CommandPalette({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);

    const openHandler = () => setOpen(true);
    document.addEventListener("safelink:open-palette", openHandler);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("safelink:open-palette", openHandler);
    };
  }, []);

  // Bloquear scroll del fondo mientras la paleta está abierta.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleSelect = useCallback((item: Item) => {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    } else if (item.action) {
      setTimeout(item.action, 50);
    }
  }, [router]);

  const items: Item[] = [
    { id: "nav-tablero",       label: "Tablero",        hint: "Vista general en tiempo real",  icon: Map,           color: "#3b82f6", href: "/tablero",        group: "Navegar a", keywords: "inicio home panel",                shortcut: "G T" },
    { id: "nav-dashboard",     label: "Dashboard",      hint: "Metricas y resumen del dia",    icon: LayoutGrid,    color: "#60a5fa", href: "/dashboard",      group: "Navegar a", keywords: "estadisticas resumen",             shortcut: "G D" },
    { id: "nav-empleados",     label: "Empleados",      hint: "Gestiona el personal",          icon: Users,         color: "#10b981", href: "/empleados",      group: "Navegar a", keywords: "trabajadores personal staff",      shortcut: "G E" },
    { id: "nav-asistencia",    label: "Asistencia",     hint: "Check-ins en tiempo real",      icon: ClipboardList, color: "#f59e0b", href: "/asistencia",     group: "Navegar a", keywords: "entradas salidas checkin",         shortcut: "G A" },
    { id: "nav-sucursales",    label: "Sucursales",     hint: "Oficinas y ubicaciones",        icon: Building2,     color: "#8b5cf6", href: "/sucursales",     group: "Navegar a", keywords: "oficinas locales sedes",           shortcut: "G U" },
    { id: "nav-dispositivos",  label: "Estaciones",     hint: "Equipos fisicos vinculados",    icon: Monitor,       color: "#06b6d4", href: "/dispositivos",   group: "Navegar a", keywords: "dispositivos kiosko hardware",     shortcut: "G S" },
    { id: "nav-reportes",      label: "Reportes",       hint: "Estadisticas y analisis",       icon: BarChart3,     color: "#ec4899", href: "/reportes",       group: "Navegar a", keywords: "estadisticas analytics graficas",  shortcut: "G R" },
    { id: "nav-ejecutivo",     label: "Ejecutivo",      hint: "Vista ejecutiva de KPIs",       icon: Trophy,        color: "#f97316", href: "/ejecutivo",      group: "Navegar a", keywords: "kpis resumen ejecutivo",           shortcut: "G X" },
    { id: "nav-actividad",     label: "Actividad",      hint: "Log de acciones del sistema",   icon: Activity,      color: "#14b8a6", href: "/actividad",      group: "Navegar a", keywords: "log historial acciones",           shortcut: "G V" },
    { id: "nav-notificaciones",label: "Notificaciones", hint: "Alertas e incidencias",         icon: Bell,          color: "#ef4444", href: "/notificaciones", group: "Navegar a", keywords: "alertas mensajes",                 shortcut: "G N" },
    { id: "nav-configuracion", label: "Configuracion",  hint: "Ajustes de la empresa",         icon: Settings,      color: "#6b7280", href: "/configuracion",  group: "Navegar a", keywords: "settings ajustes preferencias",    shortcut: "G C" },

    { id: "new-empleado",     label: "Nuevo empleado",     hint: "Registra a una persona",      icon: Plus, color: "#10b981", href: "/empleados?new=1",      group: "Crear nuevo", keywords: "agregar trabajador" },
    { id: "new-sucursal",     label: "Nueva sucursal",     hint: "Crea una oficina",            icon: Plus, color: "#8b5cf6", href: "/sucursales?new=1",     group: "Crear nuevo", keywords: "agregar oficina" },
    { id: "new-dispositivo",  label: "Registrar estacion", hint: "Vincula un equipo fisico",    icon: Plus, color: "#06b6d4", href: "/dispositivos?new=1",   group: "Crear nuevo", keywords: "agregar dispositivo equipo" },

    { id: "help-shortcuts", label: "Ver todos los atajos de teclado", hint: "Lista completa", icon: Keyboard, color: "#f59e0b", action: onShowShortcuts, group: "Ayuda", keywords: "shortcuts atajos hotkeys keyboard", shortcut: "?" },
  ];

  if (!mounted || !open) return null;

  return createPortal(
    <Command label="Paleta de comandos" loop>
      <div onClick={() => setOpen(false)} style={overlayStyle}>
        <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
          <div style={searchBarStyle}>
            <Search size={18} style={{ opacity: 0.5, flexShrink: 0 }} />
            <Command.Input
              placeholder="Buscar comandos, paginas, acciones..."
              autoFocus
              style={searchInputStyle}
            />
            <kbd style={kbdStyle}>ESC</kbd>
          </div>

          <Command.List style={listStyle}>
            <Command.Empty style={emptyStyle}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Sin resultados</div>
              <div style={{ fontSize: 12, color: "var(--text-faint, #888)", marginTop: 4 }}>
                Prueba con otra palabra
              </div>
            </Command.Empty>

            {["Navegar a", "Crear nuevo", "Ayuda"].map((groupName) => {
              const groupItems = items.filter((i) => i.group === groupName);
              return (
                <Command.Group key={groupName} heading={groupName} className="cmd-group">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.hint} ${item.keywords ?? ""}`}
                        onSelect={() => handleSelect(item)}
                        style={itemStyle}
                      >
                        <div style={{
                          ...iconBoxStyle,
                          background: `${item.color}1f`,
                          color: item.color,
                        }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={itemLabelStyle}>{item.label}</div>
                          {item.hint && <div style={itemHintStyle}>{item.hint}</div>}
                        </div>
                        {item.shortcut && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {item.shortcut.split(" ").map((k) => (
                              <kbd key={k} style={kbdStyle}>{k}</kbd>
                            ))}
                          </div>
                        )}
                        <ArrowRight size={14} style={{ opacity: 0, color: "var(--text-faint, #888)" }} className="cmd-arrow" />
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>

          <div style={footerStyle}>
            <div style={footerHintStyle}>
              <kbd style={kbdStyle}><CornerDownLeft size={10} /></kbd>
              <span>seleccionar</span>
            </div>
            <div style={footerHintStyle}>
              <kbd style={kbdStyle}>↑</kbd>
              <kbd style={kbdStyle}>↓</kbd>
              <span>navegar</span>
            </div>
            <div style={footerHintStyle}>
              <kbd style={kbdStyle}>ESC</kbd>
              <span>cerrar</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={footerHintStyle}>
              <kbd style={kbdStyle}>?</kbd>
              <span>ver atajos</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cmd-group [cmdk-group-heading] {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-faint, #888);
          padding: 12px 14px 6px;
        }
        [cmdk-item][data-selected="true"] {
          background: var(--bg-hover, #1c1c1f) !important;
        }
        [cmdk-item][data-selected="true"] .cmd-arrow {
          opacity: 1 !important;
        }
      `}</style>
    </Command>,
    document.body
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex", alignItems: "flex-start", justifyContent: "center",
  padding: "clamp(16px, 10vh, 96px) 12px 12px",
  animation: "fadeIn 0.15s ease-out",
};

const modalStyle: React.CSSProperties = {
  width: "min(680px, 100%)",
  maxHeight: "min(560px, calc(100dvh - 32px))",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-surface, #0f0f10)",
  border: "1px solid var(--border, #2a2a2d)",
  borderRadius: 14,
  boxShadow: "0 32px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04)",
  overflow: "hidden",
  animation: "slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
};

const searchBarStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid var(--border, #2a2a2d)",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  outline: "none", color: "var(--text-primary, #f5f5f7)",
  fontSize: 16, fontWeight: 400,
};

const listStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, overflow: "auto", padding: "4px 8px 8px",
};

const emptyStyle: React.CSSProperties = {
  padding: "48px 24px", textAlign: "center",
  color: "var(--text-secondary, #d4d4d8)",
  display: "flex", flexDirection: "column", alignItems: "center",
};

const itemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
  color: "var(--text-primary, #f5f5f7)",
  margin: "2px 0",
};

const iconBoxStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

const itemLabelStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const itemHintStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--text-faint, #888)", marginTop: 2,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const footerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "10px 16px",
  borderTop: "1px solid var(--border, #2a2a2d)",
  background: "var(--bg-elevated, #131316)",
  fontSize: 11, color: "var(--text-faint, #888)",
};

const footerHintStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
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

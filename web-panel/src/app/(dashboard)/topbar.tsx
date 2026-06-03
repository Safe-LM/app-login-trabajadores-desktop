"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

import { usePathname } from "next/navigation";
import {
  Bell, Search, Command,
  Home, Users, Building2, Monitor, BarChart3, Trophy, Activity, Settings,
  LayoutDashboard, Map, ClipboardList, Sun, Moon, Volume2, VolumeX, type LucideIcon,
} from "lucide-react";
import { playPingSound } from "@/components/notifications/audio";



/**
 * Tabs contextuales por seccion. SOLO aparecen cuando la seccion tiene
 * sub-vistas reales (no son duplicados del sidebar).
 */
const SECTION_TABS: { matcher: RegExp; tabs: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    // Grupo "Inicio" del sidebar — 4 vistas operativas
    matcher: /^\/(dashboard|tablero|mapa|asistencia)/,
    tabs: [
      { href: "/tablero",    label: "Tablero",    icon: LayoutDashboard },
      { href: "/mapa",       label: "Mapa",       icon: Map             },
      { href: "/dashboard",  label: "Dashboard",  icon: Home            },
      { href: "/asistencia", label: "Asistencia", icon: ClipboardList   },
    ],
  },
];

/** Pages sin tabs muestran su nombre + icono en la izquierda del topbar. */
const PAGE_META: { matcher: RegExp; label: string; icon: LucideIcon }[] = [
  { matcher: /^\/empleados/,      label: "Empleados",     icon: Users     },
  { matcher: /^\/sucursales/,     label: "Sucursales",    icon: Building2 },
  { matcher: /^\/dispositivos/,   label: "Estaciones",    icon: Monitor   },
  { matcher: /^\/reportes/,       label: "Reportes",      icon: BarChart3 },
  { matcher: /^\/ejecutivo/,      label: "Ejecutivo",     icon: Trophy    },
  { matcher: /^\/actividad/,      label: "Actividad",     icon: Activity  },
  { matcher: /^\/notificaciones/, label: "Notificaciones",icon: Bell      },
  { matcher: /^\/configuracion/,  label: "Configuración", icon: Settings  },
];

export function DashboardTopBar({
  unreadCount,
  userEmail,
}: {
  unreadCount: number;
  userEmail: string;
}) {
  const pathname = usePathname();
  const section = SECTION_TABS.find(s => s.matcher.test(pathname));
  const pageMeta = !section ? PAGE_META.find(p => p.matcher.test(pathname)) : null;

  const [theme, setTheme] = useState("dark");
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("safelink:theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(savedTheme);

    const muted = localStorage.getItem("safelink:notif-muted") === "true";
    setSoundEnabled(!muted);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("safelink:theme", nextTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);
  };

  const toggleSound = () => {
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    localStorage.setItem("safelink:notif-muted", String(!nextSound));
    if (nextSound) {
      playPingSound(true);
    }
  };

  function openPalette() {
    document.dispatchEvent(new CustomEvent("safelink:open-palette"));
  }

  return (
    <header className="topbar" role="banner">
      {/* IZQUIERDA: tabs contextuales o nombre de la pagina */}
      {section ? (
        <nav className="topbar__tabs" aria-label="Sub-secciones">
          {section.tabs.map(t => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={"topbar__tab" + (active ? " topbar__tab--active" : "")}
              >
                <Icon size={13} strokeWidth={active ? 2.25 : 1.75} style={{ opacity: active ? 1 : 0.7 }} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      ) : pageMeta ? (
        <div className="topbar__crumb">
          <pageMeta.icon size={15} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
          <span className="topbar__crumb-label">{pageMeta.label}</span>
        </div>
      ) : (
        <div />
      )}

      <div style={{ flex: 1 }} />

      {/* DERECHA: search + bell + avatar */}
      <div className="topbar__actions">
        <button
          type="button"
          onClick={openPalette}
          className="topbar__action topbar__action--search"
          aria-label="Buscar"
        >
          <Search size={14} strokeWidth={2} />
          <span className="topbar__search-label">Buscar…</span>
          <kbd className="topbar__kbd">
            <Command size={10} strokeWidth={2.5} />K
          </kbd>
        </button>

        <button
          type="button"
          onClick={toggleSound}
          className="topbar__action--control"
          title={soundEnabled ? "Silenciar notificaciones" : "Activar sonido de notificaciones"}
          aria-label={soundEnabled ? "Silenciar notificaciones" : "Activar sonido de notificaciones"}
        >
          {soundEnabled ? <Volume2 size={16} strokeWidth={1.75} /> : <VolumeX size={16} strokeWidth={1.75} />}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="topbar__action--control"
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>

        <Link
          href="/notificaciones"
          className="topbar__action--control"
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
          title="Notificaciones"
        >
          <Bell size={16} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="topbar__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </Link>

        <div
          className="topbar__avatar"
          aria-label={userEmail}
          title={userEmail}
        >
          {userEmail[0]?.toUpperCase()}
        </div>
      </div>
    </header>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import {
  Home,
  Users,
  Building2,
  Monitor,
  Trophy,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Shield,
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { EmpresaSwitcher } from "./empresa-switcher";

type NavGroup = "operacion" | "analisis" | "sistema";
type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Rutas adicionales que tambien activan este item (para vistas con tabs en topbar) */
  alsoActiveOn?: RegExp;
};

const nav: NavEntry[] = [
  // OPERACION — recursos del dia a dia
  // "Inicio" agrupa las 4 vistas operativas (Tablero/Mapa/Dashboard/Asistencia) que viven en los tabs del topbar
  { href: "/tablero",      label: "Inicio",     icon: Home,      group: "operacion", alsoActiveOn: /^\/(dashboard|tablero|mapa|asistencia)/ },
  { href: "/empleados",    label: "Empleados",  icon: Users,     group: "operacion" },
  { href: "/sucursales",   label: "Sucursales", icon: Building2, group: "operacion" },
  { href: "/dispositivos", label: "Estaciones", icon: Monitor,   group: "operacion" },

  // ANALISIS — metricas e historico
  { href: "/reportes",  label: "Reportes",  icon: BarChart3, group: "analisis" },
  { href: "/ejecutivo", label: "Ejecutivo", icon: Trophy,    group: "analisis" },
  { href: "/actividad", label: "Actividad", icon: Activity,  group: "analisis" },

  // SISTEMA — configuracion del panel
  { href: "/notificaciones", label: "Notificaciones", icon: Bell,     group: "sistema" },
  { href: "/configuracion",  label: "Configuración",  icon: Settings, group: "sistema" },
];

export function SidebarNav({ userEmail, empresaNombre }: { userEmail: string; empresaNombre: string | null }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Prefetch agresivo: todas las rutas del sidebar en idle.
  useEffect(() => {
    const idle = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(cb);
      } else {
        setTimeout(cb, 200);
      }
    };
    idle(() => {
      for (const item of nav) {
        if (item.href !== pathname) router.prefetch(item.href);
      }
    });
  }, [pathname, router]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const operacion = nav.filter(n => n.group === "operacion");
  const analisis  = nav.filter(n => n.group === "analisis");
  const sistema   = nav.filter(n => n.group === "sistema");

  return (
    <>
      {/* Hamburguesa (movil) */}
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
        className="sidebar-burger"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={mobileOpen ? "sidebar sidebar--open" : "sidebar"}
        aria-label="Navegación principal"
        style={{
          width: "var(--sidebar-width)", flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          background: "var(--bg-black)",
          position: "sticky", top: 0,
          height: "100dvh",
        }}
      >
        {/* Logo / wordmark */}
        <Link href="/dashboard" className="sidebar-brand" aria-label="Safe Link Monitoring">
          <div className="sidebar-brand__mark">
            <Shield size={15} strokeWidth={2.5} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="sidebar-brand__title">Safe Link</p>
            <p className="sidebar-brand__tagline">Monitoring</p>
          </div>
        </Link>

        {/* Organization switcher */}
        <EmpresaSwitcher empresaNombre={empresaNombre} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          <SectionLabel>Operación</SectionLabel>
{/* Las labels ya no son uppercase militar — sentence-case Geist. */}
          {operacion.map(item => (
            <NavItem key={item.href} item={item} active={isActive(item, pathname)} />
          ))}

          <SectionLabel style={{ marginTop: 14 }}>Análisis</SectionLabel>
          {analisis.map(item => (
            <NavItem key={item.href} item={item} active={isActive(item, pathname)} />
          ))}

          <SectionLabel style={{ marginTop: 14 }}>Sistema</SectionLabel>
          {sistema.map(item => (
            <NavItem key={item.href} item={item} active={isActive(item, pathname)} />
          ))}
        </nav>

        {/* Footer: usuario + logout */}
        <div style={{ padding: "8px 8px 10px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{
            padding: "9px 10px", borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", gap: 9,
            marginBottom: 4,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: "rgba(37,99,235,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--accent-hover)",
            }}>
              {userEmail[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userEmail}
              </p>
              <p style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
                Administrador
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="logout-btn"
            aria-label="Cerrar sesión"
          >
            <span className="logout-btn__icon">
              <LogOut size={14} strokeWidth={2} />
            </span>
            <span className="logout-btn__label">
              {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
      letterSpacing: "0.04em",
      padding: "6px 11px 4px", ...style,
    }}>
      {children}
    </p>
  );
}

function isActive(item: NavEntry, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.alsoActiveOn?.test(pathname)) return true;
  return false;
}

function NavItem({ item, active }: { item: NavEntry; active: boolean }) {
  const router = useRouter();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={true}
      onMouseEnter={() => router.prefetch(item.href)}
      className="nav-item"
      data-active={active ? "true" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "8px 11px", borderRadius: "var(--radius-md)",
        fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        background: active ? "rgba(37,99,235,0.10)" : "transparent",
        textDecoration: "none",
        transition: "background 120ms ease, color 120ms ease",
        position: "relative",
      }}
    >
      {active && (
        <span style={{
          position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 18, borderRadius: 99,
          background: "var(--accent)",
        }} />
      )}
      <Icon
        size={16}
        strokeWidth={active ? 2 : 1.75}
        style={{
          flexShrink: 0,
          color: active ? "var(--accent-hover)" : "currentColor",
          opacity: active ? 1 : 0.85,
        }}
      />
      {item.label}
    </Link>
  );
}

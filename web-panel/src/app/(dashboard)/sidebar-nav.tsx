"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const nav = [
  { href: "/dashboard",    label: "Dashboard",    icon: GridIcon,      group: "general" },
  { href: "/empleados",    label: "Empleados",    icon: UsersIcon,     group: "general" },
  { href: "/asistencia",   label: "Asistencia",   icon: ClipboardIcon, group: "general" },
  { href: "/sucursales",   label: "Sucursales",   icon: BuildingIcon,  group: "general" },
  { href: "/dispositivos", label: "Estaciones",   icon: MonitorIcon,   group: "gestion" },
  { href: "/reportes",     label: "Reportes",     icon: ChartIcon,     group: "gestion" },
  { href: "/configuracion",label: "Configuración",icon: SettingsIcon,  group: "gestion" },
];

export function SidebarNav({ userEmail }: { userEmail: string }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cierra el drawer al cambiar de ruta
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Cierra con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Prefetch agresivo: pedimos todas las rutas del sidebar en idle.
  // Cambiar de pagina se siente instantaneo despues del primer paint.
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

  const general = nav.filter(n => n.group === "general");
  const gestion = nav.filter(n => n.group === "gestion");

  return (
    <>
      {/* Boton hamburguesa (solo movil) */}
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
        className="sidebar-burger"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Backdrop (solo movil cuando esta abierto) */}
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
          position: "sticky", top: 0, height: "100vh",
        }}>
      {/* Logo */}
      <div style={{
        height: "var(--header-height)", padding: "0 16px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px rgba(37,99,235,0.35)",
        }}>
          <ShieldIcon />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Safe Link
          </p>
          <p style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase" }}>
            Monitoring
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
        <SectionLabel>General</SectionLabel>
        {general.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />
        ))}

        <SectionLabel style={{ marginTop: 12 }}>Gestión</SectionLabel>
        {gestion.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />
        ))}
      </nav>

      {/* Footer: usuario + logout */}
      <div style={{ padding: "8px 8px 10px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{
          padding: "9px 10px", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 9,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid transparent",
          marginBottom: 4,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "var(--accent)",
          }}>
            {userEmail[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail}
            </p>
            <p style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
              Administrador
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full px-2.5 py-[7px] rounded-[7px] flex items-center gap-2 text-xs font-medium text-text-faint bg-transparent border border-transparent transition-colors duration-150 hover:text-[#f87171] hover:bg-[rgba(239,68,68,0.06)] hover:border-[rgba(239,68,68,0.12)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-[inherit]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {loggingOut ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </div>
    </aside>
    </>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 700, color: "var(--text-faint)",
      letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "6px 10px 4px", ...style,
    }}>
      {children}
    </p>
  );
}

function NavItem({ href, label, Icon, active }: { href: string; label: string; Icon: React.FC; active: boolean }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={(e) => {
        router.prefetch(href);
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }
      }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 8,
        fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        background: active
          ? "linear-gradient(90deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.04) 100%)"
          : "transparent",
        border: active ? "1px solid rgba(37,99,235,0.18)" : "1px solid transparent",
        textDecoration: "none",
        transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
        position: "relative",
      }}
    >
      {/* Indicador activo lateral más prominente */}
      {active && (
        <span style={{
          position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 18, borderRadius: 99,
          background: "var(--accent)",
          boxShadow: "0 0 12px rgba(37,99,235,0.7)",
        }} />
      )}
      <span style={{
        flexShrink: 0,
        color: active ? "var(--accent-hover)" : "currentColor",
        opacity: active ? 1 : 0.7,
        transition: "all 150ms",
      }}>
        <Icon />
      </span>
      {label}
    </Link>
  );
}

function ShieldIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function UsersIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
}
function ClipboardIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>;
}
function MonitorIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function ChartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
}
function SettingsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}
function BuildingIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M4 21V4a2 2 0 012-2h12a2 2 0 012 2v17M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/></svg>;
}

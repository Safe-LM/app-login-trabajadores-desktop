"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard",     label: "Dashboard",     icon: GridIcon },
  { href: "/empleados",     label: "Empleados",     icon: UsersIcon },
  { href: "/asistencia",    label: "Asistencia",    icon: ClipboardIcon },
  { href: "/dispositivos",  label: "Estaciones",    icon: MonitorIcon },
  { href: "/reportes",      label: "Reportes",      icon: ChartIcon },
  { href: "/configuracion", label: "Configuracion", icon: SettingsIcon },
];

export function SidebarNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: "var(--sidebar-width)", flexShrink: 0,
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      background: "var(--bg-black)",
    }}>
      <div style={{
        height: "var(--header-height)", padding: "0 20px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px var(--accent-glow)", flexShrink: 0,
        }}>
          <ShieldIcon />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Safe Link
          </p>
          <p style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.04em" }}>
            MONITORING
          </p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 10px 4px" }}>
          General
        </p>
        {nav.slice(0, 3).map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />
        ))}
        <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "16px 10px 4px" }}>
          Gestion
        </p>
        {nav.slice(3).map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />
        ))}
      </nav>

      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)" }}>
        <div style={{ padding: "10px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
          }}>
            {userEmail[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail}
            </p>
            <p style={{ fontSize: 10, color: "var(--text-faint)" }}>Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, label, Icon, active }: { href: string; label: string; Icon: React.FC; active: boolean }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 8,
      fontSize: 13, fontWeight: 500,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
      background: active ? "var(--bg-elevated)" : "transparent",
      textDecoration: "none", transition: "background 150ms, color 150ms",
      cursor: "pointer",
    }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }
      }}
    >
      <span style={{ flexShrink: 0 }}><Icon /></span>
      {label}
    </Link>
  );
}

function ShieldIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function UsersIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
}
function ClipboardIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>;
}
function MonitorIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function ChartIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
}
function SettingsIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}

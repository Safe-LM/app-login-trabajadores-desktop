"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

/**
 * Breadcrumbs automaticos basados en el pathname.
 * Convierte /empleados/123 -> Inicio > Empleados > 123
 *
 * Si necesitas crumbs personalizados, pasa la prop `crumbs`.
 */
export function Breadcrumbs({
  crumbs,
  showHome = true,
}: {
  crumbs?: Array<{ label: string; href?: string }>;
  showHome?: boolean;
}) {
  const pathname = usePathname();

  const items = crumbs ?? autoCrumbs(pathname);
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" style={navStyle}>
      <ol style={listStyle}>
        {showHome && (
          <>
            <li style={itemStyle}>
              <Link href="/dashboard" style={linkStyle} aria-label="Inicio">
                <Home size={13} />
              </Link>
            </li>
            <ChevronRight size={12} style={separatorStyle} />
          </>
        )}
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={c.label + i} style={itemStyle}>
              {!isLast && c.href ? (
                <Link href={c.href} style={linkStyle}>{c.label}</Link>
              ) : (
                <span style={isLast ? currentStyle : linkStyle}>{c.label}</span>
              )}
              {!isLast && <ChevronRight size={12} style={separatorStyle} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function autoCrumbs(pathname: string): Array<{ label: string; href: string }> {
  const parts = pathname.split("/").filter(Boolean);
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    empleados: "Empleados",
    asistencia: "Asistencia",
    sucursales: "Sucursales",
    dispositivos: "Estaciones",
    notificaciones: "Notificaciones",
    reportes: "Reportes",
    configuracion: "Configuración",
  };
  return parts.map((p, i) => ({
    label: labels[p] ?? decodeURIComponent(p),
    href: "/" + parts.slice(0, i + 1).join("/"),
  }));
}

const navStyle: React.CSSProperties = {
  marginBottom: 8,
};

const listStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  listStyle: "none", padding: 0, margin: 0,
  fontSize: 12,
};

const itemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
};

const linkStyle: React.CSSProperties = {
  color: "var(--text-faint, #888)",
  textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: 4,
};

const currentStyle: React.CSSProperties = {
  color: "var(--text-secondary, #d4d4d8)",
  fontWeight: 500,
};

const separatorStyle: React.CSSProperties = {
  color: "var(--text-faint, #666)",
  flexShrink: 0,
};

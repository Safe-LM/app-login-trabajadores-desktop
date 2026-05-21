"use client";
import React from "react";

export type PageHeaderProps = {
  /** Texto eyebrow opcional (mayúsculas, encima del título) */
  eyebrow?: string;
  /** Título principal de la página */
  title: string;
  /** Caption inline al lado del título (ej: "5 estaciones"). Estilo Argus "· N items". */
  count?: React.ReactNode;
  /** Subtítulo opcional debajo del título (string o ReactNode) */
  subtitle?: React.ReactNode;
  /** Icono opcional al lado del título (chip) */
  icon?: React.ReactNode;
  /** Color del chip/icon (CSS var name o color hex). Default: var(--accent) */
  iconColor?: string;
  /** Slot de acciones a la derecha (botones, badges, info) */
  actions?: React.ReactNode;
  /** Stats inline a la derecha (chips con label + value) */
  stats?: Array<{ label: string; value: React.ReactNode }>;
};

export function PageHeader({ eyebrow, title, count, subtitle, icon, iconColor, actions, stats }: PageHeaderProps) {
  return (
    <div className="page-header animate-fade-up" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {icon && (
          <div
            style={{
              width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `color-mix(in srgb, ${iconColor ?? "var(--accent)"} 10%, transparent)`,
              color: iconColor ?? "var(--accent-hover)",
            }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <p className="text-eyebrow" style={{ marginBottom: 4 }}>
              {eyebrow}
            </p>
          )}
          <h1 className="heading-1" style={{
            marginBottom: subtitle ? 4 : 0, lineHeight: 1.15,
            display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
          }}>
            <span>{title}</span>
            {count != null && (
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: "var(--text-muted)",
                letterSpacing: 0,
                fontVariantNumeric: "tabular-nums",
              }}>
                <span style={{ color: "var(--text-faint)", marginRight: 6 }}>·</span>
                {count}
              </span>
            )}
          </h1>
          {subtitle && (
            <div className="text-muted-sm" style={{ fontSize: 13 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {(actions || stats) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {stats && stats.length > 0 && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {stats.map((s, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-end",
                  paddingRight: i < stats.length - 1 ? 12 : 0,
                  borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "var(--text-faint)",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                  }}>
                    {s.label}
                  </span>
                  <span style={{
                    fontSize: 18, fontWeight: 700, color: "var(--text-primary)",
                    letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
                  }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

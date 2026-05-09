"use client";
import React from "react";

export type PageHeaderProps = {
  /** Texto eyebrow opcional (mayúsculas, encima del título) */
  eyebrow?: string;
  /** Título principal de la página */
  title: string;
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

export function PageHeader({ eyebrow, title, subtitle, icon, iconColor, actions, stats }: PageHeaderProps) {
  return (
    <div className="page-header animate-fade-up" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        {icon && (
          <div
            style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, color-mix(in srgb, ${iconColor ?? "var(--accent)"} 18%, transparent) 0%, color-mix(in srgb, ${iconColor ?? "var(--accent)"} 6%, transparent) 100%)`,
              border: `1px solid color-mix(in srgb, ${iconColor ?? "var(--accent)"} 25%, transparent)`,
              color: iconColor ?? "var(--accent-hover)",
              boxShadow: `0 8px 20px -10px color-mix(in srgb, ${iconColor ?? "var(--accent)"} 50%, transparent)`,
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
          <h1 className="heading-1" style={{ marginBottom: subtitle ? 4 : 0, lineHeight: 1.15 }}>
            {title}
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
                    fontSize: 18, fontWeight: 800, color: "var(--text-primary)",
                    letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
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

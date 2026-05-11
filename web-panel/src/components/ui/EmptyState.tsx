"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** CTA principal (boton) */
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  /** Accion secundaria como link/texto */
  secondary?: { label: string; onClick: () => void };
  /** Tono visual (color del icono) */
  tone?: "neutral" | "blue" | "green" | "amber" | "violet";
  children?: ReactNode;
}

const TONE_COLORS: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "#6b7280",
  blue:    "#3b82f6",
  green:   "#10b981",
  amber:   "#f59e0b",
  violet:  "#8b5cf6",
};

/**
 * Empty state premium. Para listas vacias, sin resultados, etc.
 * Reemplaza el clasico "Sin datos" gris por algo orientado a accion.
 */
export function EmptyState({
  icon: Icon, title, description, action, secondary, tone = "neutral", children,
}: Props) {
  const color = TONE_COLORS[tone];
  const ActionIcon = action?.icon;

  return (
    <div style={containerStyle}>
      {Icon && (
        <div style={{
          ...iconBoxStyle,
          background: `${color}1f`,
          color,
        }}>
          <Icon size={28} />
        </div>
      )}
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descStyle}>{description}</p>}
      {children}
      {(action || secondary) && (
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {action && (
            <button onClick={action.onClick} className="btn btn-primary">
              {ActionIcon && <ActionIcon size={14} />}
              <span>{action.label}</span>
            </button>
          )}
          {secondary && (
            <button onClick={secondary.onClick} className="btn btn-secondary">
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center",
  padding: "48px 24px", textAlign: "center",
  background: "var(--bg-elevated, #131316)",
  border: "1px dashed var(--border, #2a2a2d)",
  borderRadius: 14,
  minHeight: 280,
};

const iconBoxStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 16, fontWeight: 600,
  color: "var(--text-primary, #f5f5f7)",
};

const descStyle: React.CSSProperties = {
  margin: "6px 0 0", maxWidth: 380, fontSize: 13,
  color: "var(--text-faint, #888)", lineHeight: 1.5,
};

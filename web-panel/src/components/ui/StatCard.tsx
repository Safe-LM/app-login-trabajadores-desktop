"use client";
import React from "react";

type StatColor = "blue" | "green" | "red" | "yellow" | "purple" | "neutral";

const COLOR_TOKENS: Record<StatColor, { color: string; glow: string; bg: string; border: string }> = {
  blue:    { color: "#3b82f6", glow: "rgba(37, 99, 235, 0.22)",  bg: "rgba(37, 99, 235, 0.10)",  border: "rgba(37, 99, 235, 0.20)" },
  green:   { color: "#22c55e", glow: "rgba(34, 197, 94, 0.22)",  bg: "rgba(34, 197, 94, 0.10)",  border: "rgba(34, 197, 94, 0.20)" },
  red:     { color: "#ef4444", glow: "rgba(239, 68, 68, 0.22)",  bg: "rgba(239, 68, 68, 0.10)",  border: "rgba(239, 68, 68, 0.20)" },
  yellow:  { color: "#eab308", glow: "rgba(234, 179, 8, 0.22)",  bg: "rgba(234, 179, 8, 0.10)",  border: "rgba(234, 179, 8, 0.20)" },
  purple:  { color: "#a78bfa", glow: "rgba(167, 139, 250, 0.22)", bg: "rgba(167, 139, 250, 0.10)", border: "rgba(167, 139, 250, 0.20)" },
  neutral: { color: "#94a3b8", glow: "rgba(148, 163, 184, 0.18)", bg: "rgba(148, 163, 184, 0.08)", border: "rgba(148, 163, 184, 0.18)" },
};

export type StatCardProps = {
  label: string;
  value: number | string;
  color?: StatColor;
  icon?: React.ReactNode;
  /** Delta porcentual: positivo arriba, negativo abajo */
  delta?: { value: number; label?: string } | null;
  /** Mini sparkline data (4-12 puntos recomendado) */
  sparkline?: number[];
  /** Sufijo opcional al valor (ej: "%") */
  suffix?: string;
};

export function StatCard({ label, value, color = "blue", icon, delta, sparkline, suffix }: StatCardProps) {
  const t = COLOR_TOKENS[color];
  const styleVars: React.CSSProperties & Record<string, string> = {
    "--stat-color": t.color,
    "--stat-glow": t.glow,
    "--stat-bg": t.bg,
    "--stat-border": t.border,
  };

  return (
    <div className="stat-card" style={styleVars}>
      <div className="stat-card__label">
        {icon && <span className="stat-card__icon">{icon}</span>}
        {label}
      </div>
      <div className="stat-card__value">
        {value}
        {suffix && <span style={{ fontSize: 18, opacity: 0.55, marginLeft: 2 }}>{suffix}</span>}
      </div>
      {delta && (
        <span className={`stat-card__delta stat-card__delta--${delta.value >= 0 ? "up" : "down"}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {delta.value >= 0 ? <polyline points="17 7 7 17" transform="rotate(180 12 12)"/> : <polyline points="7 7 17 17"/>}
            {delta.value >= 0 ? <polyline points="17 17 17 7 7 7"/> : <polyline points="17 7 17 17 7 17"/>}
          </svg>
          {Math.abs(delta.value)}% {delta.label ?? ""}
        </span>
      )}
      {sparkline && sparkline.length >= 2 && (
        <Sparkline points={sparkline} color={t.color} />
      )}
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 60;
  const H = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fillPath = `${path} L${W},${H} L0,${H} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg className="stat-card__sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

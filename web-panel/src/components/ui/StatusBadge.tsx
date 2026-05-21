"use client";
import React from "react";

export type StatusKind = "online" | "warn" | "offline" | "error" | "neutral";

type Props = {
  kind: StatusKind;
  label: string;
  /** Si `true`, agrega un halo suave al dot (para destacar estaciones activas) */
  strong?: boolean;
  /** Mostrar el dot pero ocultar el label (modo compacto) */
  dotOnly?: boolean;
  className?: string;
};

export function StatusBadge({ kind, label, strong, dotOnly, className }: Props) {
  return (
    <span
      className={
        "status status--" + kind +
        (strong ? " status--strong" : "") +
        (className ? " " + className : "")
      }
      aria-label={dotOnly ? label : undefined}
      title={dotOnly ? label : undefined}
    >
      <span className="status-dot" />
      {!dotOnly && label}
    </span>
  );
}

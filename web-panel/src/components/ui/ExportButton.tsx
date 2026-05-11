"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportCSV, exportXLSX } from "@/lib/export";
import { toast } from "sonner";

type Row = Record<string, unknown>;

interface Props {
  /** Funcion que devuelve las filas listas para exportar */
  getRows: () => Row[] | Promise<Row[]>;
  /** Prefijo del archivo: "empleados", "asistencia-mayo", ... */
  filenamePrefix: string;
  /** Texto del boton (default: "Exportar") */
  label?: string;
  /** Columnas a incluir (default: keys del primer row) */
  columns?: string[];
  /** Sheet name para XLSX */
  sheetName?: string;
  /** Compact: boton chico de icono */
  compact?: boolean;
}

export function ExportButton({
  getRows, filenamePrefix, label = "Exportar", columns, sheetName, compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handle(format: "csv" | "xlsx") {
    setBusy(format);
    try {
      const rows = await getRows();
      if (rows.length === 0) {
        toast.warning("Sin datos para exportar");
        return;
      }
      if (format === "csv") {
        exportCSV(rows, filenamePrefix, columns);
      } else {
        await exportXLSX(rows, filenamePrefix, sheetName);
      }
      toast.success(`${rows.length} fila${rows.length === 1 ? "" : "s"} exportadas`);
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-secondary"
        style={compact ? { padding: "8px 10px" } : undefined}
        aria-label="Exportar datos"
        aria-expanded={open}
      >
        <Download size={14} />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div style={menuStyle}>
          <button
            type="button"
            onClick={() => handle("csv")}
            disabled={busy !== null}
            style={itemStyle}
          >
            <FileText size={14} style={{ color: "#10b981" }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>CSV</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                Para hojas de cálculo
              </div>
            </div>
            {busy === "csv" && <Spinner />}
          </button>
          <button
            type="button"
            onClick={() => handle("xlsx")}
            disabled={busy !== null}
            style={itemStyle}
          >
            <FileSpreadsheet size={14} style={{ color: "#22c55e" }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Excel</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                Archivo .xlsx nativo
              </div>
            </div>
            {busy === "xlsx" && <Spinner />}
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
    </svg>
  );
}

const menuStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 6px)", right: 0,
  width: 220, padding: 4, zIndex: 100,
  background: "var(--bg-surface, #0f0f10)",
  border: "1px solid var(--border, #2a2a2d)",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
};

const itemStyle: React.CSSProperties = {
  width: "100%", padding: "10px 10px", borderRadius: 6,
  display: "flex", alignItems: "center", gap: 10,
  background: "transparent", border: "none",
  cursor: "pointer", color: "var(--text-primary, #f5f5f7)",
};

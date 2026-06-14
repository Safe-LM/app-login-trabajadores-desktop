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
  title?: string;
  metadata?: Record<string, string>;
  kpis?: any;
  serieTiempo?: any[];
  porSucursal?: any[];
  granularidad?: string;
}

export function ExportButton({
  getRows,
  filenamePrefix,
  label = "Exportar",
  columns,
  sheetName,
  compact,
  title,
  metadata,
  kpis,
  serieTiempo,
  porSucursal,
  granularidad,
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
        exportCSV(rows, filenamePrefix, columns, { title, metadata });
      } else {
        await exportXLSX(rows, filenamePrefix, sheetName, {
          title,
          metadata,
          kpis,
          serieTiempo,
          porSucursal,
          granularidad,
        });
      }
      toast.success(`${rows.length} fila${rows.length === 1 ? "" : ""} exportada${rows.length === 1 ? "" : "s"}`);
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
      <style>{`
        .export-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 240px;
          padding: 6px;
          z-index: 100;
          background: rgba(15, 15, 16, 0.85) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.02) !important;
          animation: exportMenuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top right;
        }
        @keyframes exportMenuIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .export-item {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #e4e4e7 !important;
          transition: all 0.15s ease;
        }
        .export-item:hover:not(:disabled) {
          background: rgba(27, 138, 107, 0.09) !important;
          color: #ffffff !important;
          transform: translateX(2px);
        }
        .export-item:active:not(:disabled) {
          transform: scale(0.98);
        }
        .export-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .export-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }
        .export-desc {
          font-size: 11px;
          color: #a1a1aa;
          margin-top: 1px;
        }
      `}</style>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-secondary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          ...(compact ? { padding: "8px 10px" } : undefined),
          ...(open ? { borderColor: "#1B8A6B", boxShadow: "0 0 0 2px rgba(27,138,107,0.2)" } : undefined),
        }}
        aria-label="Exportar datos"
        aria-expanded={open}
      >
        <Download size={14} style={open ? { color: "#1B8A6B" } : undefined} />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div className="export-menu">
          <button
            type="button"
            onClick={() => handle("csv")}
            disabled={busy !== null}
            className="export-item"
          >
            <FileText size={16} style={{ color: "#3fa889" }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div className="export-title">Exportar CSV</div>
              <div className="export-desc">
                Formato plano para nómina / sistemas
              </div>
            </div>
            {busy === "csv" && <Spinner />}
          </button>
          <button
            type="button"
            onClick={() => handle("xlsx")}
            disabled={busy !== null}
            className="export-item"
            style={{ marginTop: 2 }}
          >
            <FileSpreadsheet size={16} style={{ color: "#1B8A6B" }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div className="export-title">Exportar Excel</div>
              <div className="export-desc">
                Dashboard y reporte ejecutivo (.xlsx)
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

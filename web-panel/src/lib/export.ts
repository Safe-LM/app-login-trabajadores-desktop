/**
 * Helpers de export — CSV y Excel. Funcionan en cliente sin pedir nada
 * al servidor (los datos ya estan en memoria al hacer click).
 */

type Row = Record<string, unknown>;

/**
 * Convierte un array de filas a CSV. La primera fila es el header
 * tomado de las keys del primer registro (o columns si se proveen).
 * Escapa segun RFC 4180: si el valor contiene coma, salto de linea
 * o comilla, se entrecomilla y las comillas internas se duplican.
 */
export function toCSV(rows: Row[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

/**
 * Descarga un blob como archivo. Crea un anchor temporal y lo
 * dispara — funciona en todos los browsers modernos.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Exporta filas como CSV con BOM UTF-8 (para que Excel detecte tildes).
 * El nombre del archivo recibe un prefijo (ej: "empleados") y se anade
 * timestamp ISO yyyy-mm-dd.
 */
export function exportCSV(rows: Row[], filenamePrefix: string, columns?: string[]): void {
  const csv = toCSV(rows, columns);
  const bom = "﻿"; // BOM UTF-8 para Excel
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${filenamePrefix}-${date}.csv`);
}

/**
 * Exporta como Excel (.xlsx) usando la libreria xlsx que ya esta en
 * las deps. Mas pesada que CSV pero mantiene tipos de columna.
 */
export async function exportXLSX(
  rows: Row[],
  filenamePrefix: string,
  sheetName = "Datos",
): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-calcular el ancho óptimo de las columnas según el contenido y los encabezados
  const headers = Object.keys(rows[0] || {});
  const colWidths = headers.map((header) => {
    let maxLen = header.length;
    for (const r of rows) {
      const val = r[header];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    // Asignar ancho con un margen cómodo de 3 caracteres, limitado a máximo 50
    return { wch: Math.min(maxLen + 3, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}

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
    let s = String(v);
    // CWE-1236 Mitigation: escape leading formula injection chars
    if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
      s = `'${s}`;
    }
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
 * Opciones para controlar el formateo del reporte y metadatos.
 */
export interface ExportOptions {
  title?: string;
  metadata?: Record<string, string>;
  kpis?: {
    pctAsistencia?: number;
    pctPuntualidad?: number;
    horasTrabajadas?: number;
    totalRegistros?: number;
    empleadosActivos?: number;
    llegadasTarde?: number;
    ausencias?: number;
  };
  serieTiempo?: { label: string; total: number; entradas: number; salidas: number }[];
  porSucursal?: { name: string; value: number }[];
  granularidad?: string;
}

/**
 * Exporta filas como CSV con BOM UTF-8 (para que Excel detecte tildes).
 * El nombre del archivo recibe un prefijo (ej: "empleados") y se añade
 * timestamp ISO yyyy-mm-dd.
 */
export function exportCSV(
  rows: Row[],
  filenamePrefix: string,
  columns?: string[],
  options?: ExportOptions
): void {
  const csv = toCSV(rows, columns);
  const bom = "\uFEFF"; // BOM UTF-8 para Excel
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${filenamePrefix}-${date}.csv`);
}

/**
 * Exporta como Excel (.xlsx) usando la librería xlsx que ya está en
 * las deps. Soporta un bloque de cabecera profesional con título y metadatos,
 * y genera un dashboard con barras de progreso visuales si se pasan KPIs y series.
 */
export async function exportXLSX(
  rows: Row[],
  filenamePrefix: string,
  sheetName = "Datos",
  options?: ExportOptions
): Promise<void> {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Helper para crear barras de progreso basadas en texto Unicode
  const makeTextProgressBar = (pct: number): string => {
    const filled = Math.min(10, Math.max(0, Math.round(pct / 10)));
    const empty = 10 - filled;
    return `${"■".repeat(filled)}${"□".repeat(empty)} ${pct}%`;
  };

  // 1. Generar la hoja "Resumen Ejecutivo" si se proveen KPIs y Series de Tiempo
  if (options && options.kpis && options.serieTiempo) {
    const dashAOA: any[][] = [];
    const merges: any[] = [];
    const rowHeights: any[] = [];

    // Título Principal Combinado
    dashAOA.push(["TABLERO DE ASISTENCIA Y PUNTUALIDAD"]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
    rowHeights.push({ hpt: 35 });

    dashAOA.push([]); // Fila vacía de separación
    rowHeights.push({ hpt: 12 });

    // Cabecera: Información General (A3:E3)
    const infoHeaderRow = dashAOA.length;
    dashAOA.push(["INFORMACIÓN GENERAL", "", "", "", ""]);
    merges.push({ s: { r: infoHeaderRow, c: 0 }, e: { r: infoHeaderRow, c: 4 } });
    rowHeights.push({ hpt: 24 });

    const metadata = options.metadata || {};
    const metaRows = [
      ["Empresa", metadata["Empresa"] || "Safe Link"],
      ["Período de Reporte", metadata["Período"] || ""],
      ["Filtrado por Sucursal", metadata["Filtrado por Sucursal"] || "Todas"],
      ["Filtrado por Colaborador", metadata["Filtrado por Colaborador"] || "Todos"],
      ["Fecha de Emisión", metadata["Fecha de Emisión"] || ""],
    ];

    metaRows.forEach((r) => {
      dashAOA.push([r[0], r[1], "", "", ""]);
      merges.push({ s: { r: dashAOA.length - 1, c: 1 }, e: { r: dashAOA.length - 1, c: 4 } });
      rowHeights.push({ hpt: 18 });
    });

    dashAOA.push([]); // Separación
    rowHeights.push({ hpt: 15 });

    // Cabecera: KPIs (A:E)
    const kpisStartRow = dashAOA.length;
    dashAOA.push(["MÉTRICAS DE RENDIMIENTO (KPIs)", "", "", "", ""]);
    merges.push({ s: { r: kpisStartRow, c: 0 }, e: { r: kpisStartRow, c: 4 } });
    rowHeights.push({ hpt: 24 });

    dashAOA.push(["Indicador Clave", "Métrica", "Estado", "Progreso Visual", ""]);
    merges.push({ s: { r: kpisStartRow + 1, c: 3 }, e: { r: kpisStartRow + 1, c: 4 } });
    rowHeights.push({ hpt: 20 });

    const getAsistenciaStatus = (pct: number) => {
      if (pct >= 90) return "Excelente";
      if (pct >= 80) return "Bueno";
      if (pct >= 70) return "Regular";
      return "Requiere Atención";
    };

    const getPuntualidadStatus = (pct: number) => {
      if (pct >= 90) return "Excelente";
      if (pct >= 80) return "Bueno";
      if (pct >= 70) return "Regular";
      return "Crítico (Retardos)";
    };

    const kpis = options.kpis;
    const pctAsist = kpis.pctAsistencia ?? 0;
    const pctPunt = kpis.pctPuntualidad ?? 0;

    const kpiRows = [
      ["Asistencia Promedio", `${pctAsist}%`, getAsistenciaStatus(pctAsist), makeTextProgressBar(pctAsist)],
      ["Puntualidad General", `${pctPunt}%`, getPuntualidadStatus(pctPunt), makeTextProgressBar(pctPunt)],
      ["Horas Netas Laboradas", `${(kpis.horasTrabajadas ?? 0).toFixed(1)} hrs`, "Operativo", "N/A"],
      ["Registros Procesados", kpis.totalRegistros ?? 0, "Actividad", "N/A"],
      ["Colaboradores Activos", kpis.empleadosActivos ?? 0, "Personal", "N/A"],
      ["Retardos Detectados", kpis.llegadasTarde ?? 0, (kpis.llegadasTarde ?? 0) > 5 ? "Alerta" : "Normal", "N/A"],
      ["Ausencias Estimadas", kpis.ausencias ?? 0, (kpis.ausencias ?? 0) > 2 ? "Alerta" : "Normal", "N/A"],
    ];

    kpiRows.forEach((r, idx) => {
      dashAOA.push([r[0], r[1], r[2], r[3], ""]);
      merges.push({ s: { r: kpisStartRow + 2 + idx, c: 3 }, e: { r: kpisStartRow + 2 + idx, c: 4 } });
      rowHeights.push({ hpt: 18 });
    });

    dashAOA.push([]); // Separación
    rowHeights.push({ hpt: 15 });

    // Cabecera: Histórico de Asistencia por Rango (A:E)
    const timeStartRow = dashAOA.length;
    const granularidadFmt = options.granularidad === "mes" ? "MES" : options.granularidad === "semana" ? "SEMANA" : "DÍA";
    dashAOA.push([`TENDENCIA HISTÓRICA POR ${granularidadFmt}`, "", "", "", ""]);
    merges.push({ s: { r: timeStartRow, c: 0 }, e: { r: timeStartRow, c: 4 } });
    rowHeights.push({ hpt: 24 });

    dashAOA.push(["Período / Rango", "Registros Totales", "Entradas", "Salidas", "Progreso Visual"]);
    rowHeights.push({ hpt: 20 });

    const timePoints = options.serieTiempo || [];
    const maxTotal = timePoints.reduce((acc, pt) => Math.max(acc, pt.total), 0) || 1;

    timePoints.forEach((pt, idx) => {
      const barFilled = Math.min(10, Math.max(0, Math.round((pt.total / maxTotal) * 10)));
      const visualBar = "■".repeat(barFilled) + "□".repeat(10 - barFilled);
      dashAOA.push([pt.label, pt.total, pt.entradas, pt.salidas, visualBar]);
      rowHeights.push({ hpt: 18 });
    });

    dashAOA.push([]); // Separación
    rowHeights.push({ hpt: 15 });

    // Cabecera: Distribución por Sucursal (A:E)
    const sucStartRow = dashAOA.length;
    dashAOA.push(["DESGLOSE DE ACTIVIDAD POR SUCURSAL", "", "", "", ""]);
    merges.push({ s: { r: sucStartRow, c: 0 }, e: { r: sucStartRow, c: 4 } });
    rowHeights.push({ hpt: 24 });

    dashAOA.push(["Sucursal", "Registros Totales", "Participación", "Representación Visual", ""]);
    merges.push({ s: { r: sucStartRow + 1, c: 3 }, e: { r: sucStartRow + 1, c: 4 } });
    rowHeights.push({ hpt: 20 });

    const sucursalList = options.porSucursal || [];
    const totalRegs = kpis.totalRegistros || 1;

    sucursalList.forEach((s, idx) => {
      const pct = Math.round((s.value / totalRegs) * 100);
      const barFilled = Math.min(10, Math.max(0, Math.round(pct / 10)));
      const visualBar = "■".repeat(barFilled) + "□".repeat(10 - barFilled);
      dashAOA.push([s.name, s.value, `${pct}%`, visualBar, ""]);
      merges.push({ s: { r: sucStartRow + 2 + idx, c: 3 }, e: { r: sucStartRow + 2 + idx, c: 4 } });
      rowHeights.push({ hpt: 18 });
    });

    const wsDash = XLSX.utils.aoa_to_sheet(dashAOA);
    wsDash["!merges"] = merges;
    wsDash["!rows"] = rowHeights;

    wsDash["!cols"] = [
      { wch: 32 }, // Col A
      { wch: 20 }, // Col B
      { wch: 18 }, // Col C
      { wch: 20 }, // Col D
      { wch: 15 }, // Col E
    ];
    wsDash["!views"] = [{ showGridLines: true }];

    XLSX.utils.book_append_sheet(wb, wsDash, "Resumen Ejecutivo");
  }

  // 2. Generar la hoja "Detalle de Registros"
  const wsDetail = XLSX.utils.json_to_sheet(rows);

  // Auto-calcular el ancho óptimo de las columnas
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
    return { wch: Math.min(maxLen + 3, 50) };
  });
  wsDetail["!cols"] = colWidths;

  const detailRowHeights = [{ hpt: 26 }]; // Encabezado de columnas
  rows.forEach(() => detailRowHeights.push({ hpt: 18 }));
  wsDetail["!rows"] = detailRowHeights;
  wsDetail["!views"] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}


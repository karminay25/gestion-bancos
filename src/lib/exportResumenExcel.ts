import ExcelJS from "exceljs";
import { filterMovements, ingresoEgresoDeMovimiento, sortAsc, sanitizeSheetName, ExportFilters } from "./exportExcel";
import { formatCostCenter, compareCostCenters } from "./costCenter";

const COLOR_INGRESO = "FF059669"; // emerald-600
const COLOR_INGRESO_LIGHT = "FFD1FAE5"; // emerald-100
const COLOR_EGRESO = "FFE11D48"; // rose-600
const COLOR_EGRESO_LIGHT = "FFFFE4E6"; // rose-100
const COLOR_ROW_ALT = "FFF8FAFC"; // slate-50
const COLOR_TEXT = "FF334155"; // slate-700
const COLOR_TITLE = "FF1E293B"; // slate-800
const COLOR_MUTED = "FF64748B"; // slate-500

const CURRENCY_FMT = '"$"#,##0.00';

const BASE_HEADERS = ["Fecha", "Empresa", "Cuenta", "Nombre / Tercero", "Concepto", "Factura"];

function solidFill(argb: string): ExcelJS.Fill {
    return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function movementRow(m: any, monto: number, includeCostCenterColumn: boolean): (string | number)[] {
    const row: (string | number)[] = [
        m.fecha,
        m.cuentas_bancarias?.empresas?.codigo || "",
        m.cuentas_bancarias?.descripcion?.trim() || m.cuentas_bancarias?.banco || "",
        m.nombre_tercero || "",
        m.concepto || "",
        m.factura || "",
    ];
    if (includeCostCenterColumn) row.push(m.centros_costo ? formatCostCenter(m.centros_costo) : "Sin centro de costo");
    row.push(monto);
    return row;
}

function writeTable(
    ws: ExcelJS.Worksheet,
    startRow: number,
    colCount: number,
    includeCostCenterColumn: boolean,
    label: string,
    items: { m: any; monto: number }[],
    colorMain: string,
    colorLight: string
): number {
    let r = startRow;

    // Encabezado de sección
    ws.mergeCells(r, 1, r, colCount);
    const headerCell = ws.getCell(r, 1);
    headerCell.value = `${label}  (${items.length} movimiento${items.length === 1 ? "" : "s"})`;
    headerCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    headerCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    headerCell.fill = solidFill(colorMain);
    ws.getRow(r).height = 22;
    r++;

    const headers = [...BASE_HEADERS];
    if (includeCostCenterColumn) headers.push("Centro de Costo");
    headers.push("Monto");

    headers.forEach((h, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, color: { argb: COLOR_TITLE } };
        cell.fill = solidFill(colorLight);
        cell.alignment = { vertical: "middle", horizontal: i === headers.length - 1 ? "right" : "left" };
        cell.border = { bottom: { style: "thin", color: { argb: colorMain } } };
    });
    r++;

    const tableStart = startRow;

    if (items.length === 0) {
        ws.mergeCells(r, 1, r, colCount);
        const emptyCell = ws.getCell(r, 1);
        emptyCell.value = "Sin movimientos";
        emptyCell.font = { italic: true, size: 10, color: { argb: COLOR_MUTED } };
        emptyCell.alignment = { horizontal: "left", vertical: "middle" };
        ws.getRow(r).height = 18;
        r++;
    } else {
        items.forEach(({ m, monto }, idx) => {
            const row = movementRow(m, monto, includeCostCenterColumn);
            row.forEach((val, i) => {
                const cell = ws.getCell(r, i + 1);
                cell.value = val;
                const isMoney = i === row.length - 1;
                if (isMoney) {
                    cell.numFmt = CURRENCY_FMT;
                    cell.alignment = { horizontal: "right" };
                    cell.font = { color: { argb: colorMain }, bold: true, size: 10 };
                } else {
                    cell.font = { size: 10, color: { argb: COLOR_TEXT } };
                    cell.alignment = { horizontal: "left" };
                }
                if (idx % 2 === 1) {
                    cell.fill = solidFill(COLOR_ROW_ALT);
                }
            });
            r++;
        });
    }

    // Fila de total
    const total = items.reduce((s, x) => s + x.monto, 0);
    ws.mergeCells(r, 1, r, colCount - 1);
    const totalLabelCell = ws.getCell(r, 1);
    totalLabelCell.value = `TOTAL ${label}`;
    totalLabelCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    totalLabelCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    const totalValueCell = ws.getCell(r, colCount);
    totalValueCell.value = total;
    totalValueCell.numFmt = CURRENCY_FMT;
    totalValueCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    totalValueCell.alignment = { horizontal: "right" };
    for (let c = 1; c <= colCount; c++) {
        ws.getCell(r, c).fill = solidFill(colorMain);
    }
    ws.getRow(r).height = 20;
    r++;

    // Borde exterior de la tabla completa
    for (let rowIdx = tableStart; rowIdx < r; rowIdx++) {
        for (let c = 1; c <= colCount; c++) {
            const cell = ws.getCell(rowIdx, c);
            const left = c === 1 ? { style: "thin" as const, color: { argb: colorMain } } : cell.border?.left;
            const right = c === colCount ? { style: "thin" as const, color: { argb: colorMain } } : cell.border?.right;
            const top = rowIdx === tableStart ? { style: "thin" as const, color: { argb: colorMain } } : cell.border?.top;
            const bottom = rowIdx === r - 1 ? { style: "thin" as const, color: { argb: colorMain } } : cell.border?.bottom;
            cell.border = { ...cell.border, left, right, top, bottom };
        }
    }

    return r;
}

function addResumenSheet(
    wb: ExcelJS.Workbook,
    sheetName: string,
    title: string,
    subtitle: string,
    movements: any[],
    includeCostCenterColumn: boolean
) {
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

    const colCount = includeCostCenterColumn ? BASE_HEADERS.length + 2 : BASE_HEADERS.length + 1;
    const widths = [12, 12, 22, 26, 34, 14];
    if (includeCostCenterColumn) widths.push(22);
    widths.push(16);
    ws.columns = widths.map(w => ({ width: w }));

    let r = 1;
    ws.mergeCells(r, 1, r, colCount);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: COLOR_TITLE } };
    titleCell.alignment = { vertical: "middle" };
    ws.getRow(r).height = 26;
    r++;

    if (subtitle) {
        ws.mergeCells(r, 1, r, colCount);
        const subCell = ws.getCell(r, 1);
        subCell.value = subtitle;
        subCell.font = { italic: true, size: 9, color: { argb: COLOR_MUTED } };
        r++;
    }
    r++;

    const sorted = sortAsc(movements);
    const ingresos: { m: any; monto: number }[] = [];
    const egresos: { m: any; monto: number }[] = [];
    for (const m of sorted) {
        const { ingreso, egreso } = ingresoEgresoDeMovimiento(m);
        if (ingreso != null) ingresos.push({ m, monto: ingreso });
        if (egreso != null) egresos.push({ m, monto: egreso });
    }

    r = writeTable(ws, r, colCount, includeCostCenterColumn, "INGRESOS", ingresos, COLOR_INGRESO, COLOR_INGRESO_LIGHT);
    r++;
    r = writeTable(ws, r, colCount, includeCostCenterColumn, "EGRESOS", egresos, COLOR_EGRESO, COLOR_EGRESO_LIGHT);
    r++;

    const totalIngresos = ingresos.reduce((s, x) => s + x.monto, 0);
    const totalEgresos = egresos.reduce((s, x) => s + x.monto, 0);
    const neto = totalIngresos - totalEgresos;
    const netoColor = neto >= 0 ? COLOR_INGRESO : COLOR_EGRESO;

    ws.mergeCells(r, 1, r, colCount - 1);
    const netLabelCell = ws.getCell(r, 1);
    netLabelCell.value = "SALDO NETO  (Ingresos − Egresos)";
    netLabelCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    netLabelCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    const netValueCell = ws.getCell(r, colCount);
    netValueCell.value = neto;
    netValueCell.numFmt = CURRENCY_FMT;
    netValueCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    netValueCell.alignment = { horizontal: "right" };
    for (let c = 1; c <= colCount; c++) {
        ws.getCell(r, c).fill = solidFill(netoColor);
    }
    ws.getRow(r).height = 24;

    ws.getRow(1).height = 26;
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

export function buildFilterLabel(
    filters: ExportFilters,
    companies: any[],
    seasons: any[],
    costCenters: any[]
): string {
    const parts: string[] = [];
    if (filters.empresaId !== "all") {
        const emp = companies.find(c => c.id.toString() === filters.empresaId);
        if (emp) parts.push(`Empresa: ${emp.codigo}`);
    }
    if (filters.fechaDesde || filters.fechaHasta) {
        parts.push(`Periodo: ${filters.fechaDesde || "inicio"} a ${filters.fechaHasta || "hoy"}`);
    }
    if (filters.temporadaId !== "all") {
        const t = seasons.find(s => s.id.toString() === filters.temporadaId);
        if (t) parts.push(`Temporada: ${t.nombre}`);
    }
    if (filters.centroCostoId !== "all") {
        const cc = costCenters.find(c => c.id.toString() === filters.centroCostoId);
        if (cc) parts.push(`Centro de Costo: ${formatCostCenter(cc)}`);
    }
    parts.push(`Generado: ${new Date().toLocaleString("es-MX")}`);
    return parts.join("   |   ");
}

export function buildResumenWorkbook(
    allMovements: any[],
    costCenters: any[],
    filters: ExportFilters,
    filterLabel: string
): ExcelJS.Workbook {
    const filtered = filterMovements(allMovements, filters);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistema de Bancos";
    wb.created = new Date();

    const usedNames = new Set<string>();

    const generalSheetName = sanitizeSheetName("Resumen General", usedNames);
    addResumenSheet(wb, generalSheetName, "RESUMEN DE INGRESOS Y EGRESOS", filterLabel, filtered, true);

    const byCC = new Map<string, any[]>();
    const sinCC: any[] = [];
    for (const m of filtered) {
        if (m.centro_costo_id) {
            const key = m.centro_costo_id.toString();
            if (!byCC.has(key)) byCC.set(key, []);
            byCC.get(key)!.push(m);
        } else {
            sinCC.push(m);
        }
    }

    const orderedCC = [...costCenters].sort(compareCostCenters).filter(cc => byCC.has(cc.id.toString()));
    for (const cc of orderedCC) {
        const key = cc.id.toString();
        const movs = byCC.get(key)!;
        byCC.delete(key);
        const label = formatCostCenter(cc);
        const sheetName = sanitizeSheetName(label, usedNames);
        addResumenSheet(wb, sheetName, `RESUMEN: ${label.toUpperCase()}`, filterLabel, movs, false);
    }

    // Centros de costo presentes en los movimientos pero ausentes de la lista `costCenters` (caso borde)
    for (const [, movs] of byCC) {
        const label = movs[0]?.centros_costo ? formatCostCenter(movs[0].centros_costo) : "Centro de Costo";
        const sheetName = sanitizeSheetName(label, usedNames);
        addResumenSheet(wb, sheetName, `RESUMEN: ${label.toUpperCase()}`, filterLabel, movs, false);
    }

    if (sinCC.length > 0) {
        const sheetName = sanitizeSheetName("Sin Centro de Costo", usedNames);
        addResumenSheet(wb, sheetName, "RESUMEN: SIN CENTRO DE COSTO", filterLabel, sinCC, false);
    }

    return wb;
}

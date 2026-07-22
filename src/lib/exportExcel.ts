import * as XLSX from "xlsx";
import { formatCostCenter } from "./costCenter";

export interface ExportFilters {
    empresaId: string; // 'all' or empresa id
    fechaDesde: string; // '' or 'YYYY-MM-DD'
    fechaHasta: string; // '' or 'YYYY-MM-DD'
    temporadaId: string; // 'all' or temporada id
    centroCostoId: string; // 'all' or centro_costo id
    modo: "general" | "consolidado";
}

export function filterMovements(movements: any[], filters: ExportFilters) {
    return movements.filter(m => {
        if (filters.empresaId !== "all" && m.cuentas_bancarias?.empresa_id?.toString() !== filters.empresaId) return false;
        if (filters.fechaDesde && m.fecha < filters.fechaDesde) return false;
        if (filters.fechaHasta && m.fecha > filters.fechaHasta) return false;
        if (filters.temporadaId !== "all" && (m.temporada_id?.toString() || "") !== filters.temporadaId) return false;
        if (filters.centroCostoId !== "all" && (m.centro_costo_id?.toString() || "") !== filters.centroCostoId) return false;
        return true;
    });
}

// Excel no permite: \ / ? * [ ] en nombres de hoja, y limita a 31 caracteres.
function sanitizeSheetName(name: string, used: Set<string>): string {
    let clean = name.replace(/[\\/?*[\]]/g, "").trim().slice(0, 31) || "Cuenta";
    let candidate = clean;
    let n = 2;
    while (used.has(candidate)) {
        const suffix = ` (${n})`;
        candidate = clean.slice(0, 31 - suffix.length) + suffix;
        n++;
    }
    used.add(candidate);
    return candidate;
}

function ingresoEgresoDeMovimiento(m: any) {
    const monto = parseFloat(m.monto);
    if (m.tipo === "Ingreso") return { ingreso: monto, egreso: null };
    if (m.tipo === "Egreso") return { ingreso: null, egreso: monto };
    // Traspaso: signo indica direccion
    return monto >= 0 ? { ingreso: monto, egreso: null } : { ingreso: null, egreso: Math.abs(monto) };
}

function sortAsc(movements: any[]) {
    return [...movements].sort((a, b) => {
        const cmp = a.fecha.localeCompare(b.fecha);
        if (cmp !== 0) return cmp;
        return (a.created_at || "").localeCompare(b.created_at || "");
    });
}

export function buildExportWorkbook(allMovements: any[], accounts: any[], filters: ExportFilters) {
    const filtered = filterMovements(allMovements, filters);
    const wb = XLSX.utils.book_new();

    if (filters.modo === "consolidado") {
        const rows = sortAsc(filtered).map(m => {
            const { ingreso, egreso } = ingresoEgresoDeMovimiento(m);
            return {
                Fecha: m.fecha,
                Empresa: m.cuentas_bancarias?.empresas?.codigo || "N/A",
                Cuenta: m.cuentas_bancarias?.descripcion || m.cuentas_bancarias?.banco || "N/A",
                Nombre: m.nombre_tercero || "",
                Ingreso: ingreso,
                Egreso: egreso,
                Saldo: m.saldoo ?? "",
                Factura: m.factura || "",
                Concepto: m.concepto || "",
                "Centro de Costo": m.centros_costo ? formatCostCenter(m.centros_costo) : "Gral",
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
        return wb;
    }

    // Modo general: una hoja por cuenta bancaria, formato tipo "BANCOS 2026"
    const byAccount = new Map<string, any[]>();
    for (const m of filtered) {
        const cid = m.cuenta_id;
        if (!byAccount.has(cid)) byAccount.set(cid, []);
        byAccount.get(cid)!.push(m);
    }

    // Orden de hojas: por empresa (segun orden de accounts) y luego por cuenta
    const usedNames = new Set<string>();
    const orderedAccountIds = accounts
        .filter(a => byAccount.has(a.id))
        .map(a => a.id);
    // Incluir cuentas que aparecen en los movimientos pero no en `accounts` (por si acaso)
    for (const cid of byAccount.keys()) {
        if (!orderedAccountIds.includes(cid)) orderedAccountIds.push(cid);
    }

    for (const cuentaId of orderedAccountIds) {
        const movsForAccount = sortAsc(byAccount.get(cuentaId) || []);
        if (movsForAccount.length === 0) continue;

        const acc = accounts.find(a => a.id === cuentaId) || movsForAccount[0].cuentas_bancarias;
        const empresaCodigo = acc?.empresas?.codigo || movsForAccount[0].cuentas_bancarias?.empresas?.codigo || "";
        const descripcion = acc?.descripcion?.trim() || acc?.banco || movsForAccount[0].cuentas_bancarias?.descripcion?.trim() || "Cuenta";
        // Evitar prefijos redundantes cuando la descripcion ya menciona la empresa (ej. "BOSBES PESOS BBVA")
        const baseName = descripcion.toUpperCase().startsWith(empresaCodigo.toUpperCase()) || !empresaCodigo
            ? descripcion
            : `${empresaCodigo} ${descripcion}`;
        const sheetName = sanitizeSheetName(baseName.trim(), usedNames);

        const rows = movsForAccount.map(m => {
            const { ingreso, egreso } = ingresoEgresoDeMovimiento(m);
            return {
                FECHA: m.fecha,
                NOMBRE: m.nombre_tercero || "",
                INGRESO: ingreso,
                EGRESO: egreso,
                SALDO: m.saldoo ?? "",
                FACTURA: m.factura || "",
                CONCEPTO: m.concepto || "",
                "CENTRO DE COSTO": m.centros_costo ? formatCostCenter(m.centros_costo) : "",
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    if (wb.SheetNames.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Sin datos");
    }

    return wb;
}

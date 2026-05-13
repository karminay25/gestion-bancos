import * as XLSX from 'xlsx';
import { RawMovement } from './bbva';

function extractNombre(descripcion: string): string {
    // Comisiones
    if (/comisi[oóÛ]/i.test(descripcion)) return 'COMISIONES MONEX';
    
    // Try to get "Nombre Beneficiario: X" from SPID outgoing
    const benefMatch = descripcion.match(/Nombre Beneficiario:\s*([^|]+)/i);
    if (benefMatch) return benefMatch[1].trim().substring(0, 100);

    // Try "B/O: SWF/XXXXX BANKNAME ..." from incoming internationals
    const boMatch = descripcion.match(/B\/O:\s*\S+\s+(.+?)\s{2,}/i);
    if (boMatch) return boMatch[1].trim().substring(0, 100);

    // Try extracting after "DEPOSITO EN" or "Depósito en"
    const depMatch = descripcion.match(/dep[oóÛ]sito en (.+?)(?:Transferencia|$)/i);
    if (depMatch) return depMatch[1].trim().substring(0, 100);

    // Fallback: first meaningful words before "Transferencia" or "|"
    const fallback = descripcion.split(/Transferencia|en cuenta Bancaria|\|/i)[0].trim();
    return fallback.substring(0, 100) || 'MONEX';
}

export function parseMonex(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const movements: RawMovement[] = [];
    
    const cleanNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned) || 0;
    };

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        // Skip rows that don't have a date in col 1 (headers, summaries, etc.)
        // Col 0 contains the currency. Filter to only USD as requested.
        const col0 = row[0]?.toString().trim().toUpperCase() || '';
        if (col0 !== 'USD' && !col0.includes('ORDENES')) continue;

        const fechaRaw = row[1];
        if (!fechaRaw) continue;

        let fecha = '';
        try {
            if (typeof fechaRaw === 'number') {
                // Excel serial date
                const dateObj = XLSX.SSF.parse_date_code(Math.floor(fechaRaw));
                fecha = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            } else if (fechaRaw instanceof Date) {
                fecha = (fechaRaw as Date).toISOString().split('T')[0];
            } else if (typeof fechaRaw === 'string') {
                // Text date from bank: "DD/MM/YYYY"
                const dateMatch = fechaRaw.trim().match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
                if (dateMatch) {
                    const [_, d, m, y] = dateMatch;
                    fecha = `${y}-${m}-${d}`;
                }
            }
        } catch (e) { continue; }

        if (!fecha) continue;

        const descripcion = row[3]?.toString() || '';

        // Skip cancelled or pending rows from the "Ordenes de Pago" section
        const situacion = row[4]?.toString().trim().toUpperCase();
        if (situacion && (situacion.includes('CANCEL') || situacion.includes('REVISI'))) continue;

        // Col 10 = Importe (positive = Ingreso, negative = Egreso/cargo)
        const importe = cleanNum(row[10]);
        if (importe === 0) continue;

        // Monex is always USD — no currency routing needed

        const nombre = extractNombre(descripcion);
        const concepto = descripcion.trim().replace(/\s+/g, ' ').substring(0, 255);
        const referencia = row[5]?.toString().trim() || '';

        movements.push({
            fecha,
            concepto,
            referencia,
            descripcion: nombre,
            monto: Math.abs(importe),
            tipo: importe > 0 ? 'Ingreso' : 'Egreso'
        });
    }

    // Try to find a summary balance in the file to help the system
    let suggestedBalance: number | undefined;
    for (const row of data) {
        const text = JSON.stringify(row);
        if (/Saldo Actual/i.test(text) || /Saldo al/i.test(text)) {
            // Usually balance is in a specific column in these summary rows
            // Let's look for a large-ish number in the row
            for (const val of row) {
                if (typeof val === 'number' && Math.abs(val) > 0) {
                    suggestedBalance = val;
                }
            }
        }
    }

    // Already oldest-first in the file (ascending), no reverse needed
    return { 
        detectedCompany: null, 
        movements,
        suggestedInitialBalance: suggestedBalance
    };
}

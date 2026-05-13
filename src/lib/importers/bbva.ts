import * as XLSX from 'xlsx';

export interface RawMovement {
    fecha: string;
    concepto: string;
    referencia: string;
    descripcion: string;
    monto: number;
    tipo: 'Ingreso' | 'Egreso';
    moneda?: string;
}

export function parseBBVA(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Detect Company (Row 0)
    const companyHeader = data[0]?.[0]?.toString() || "";
    let detectedCompany = null;
    if (companyHeader.includes("LOLA")) detectedCompany = "LOLA";
    if (companyHeader.includes("BOSBES")) detectedCompany = "BOSBES";

    const movements: RawMovement[] = [];
    
    // Helper to strip commas and convert to clean number
    const cleanNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Remove commas and other non-numeric chars except period and minus
        const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned) || 0;
    };

    // Start scanning from the beginning to find movements dynamically
    // A movement is characterized by a valid date in col 0 and values in 4 or 5
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        const fechaRaw = row[0];
        if (!fechaRaw) continue;

        let fecha = "";
        try {
            if (typeof fechaRaw === 'number') {
                // Handle Excel numeric date
                const dateObj = XLSX.SSF.parse_date_code(fechaRaw);
                fecha = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            } else if (fechaRaw instanceof Date) {
                fecha = (fechaRaw as Date).toISOString().split('T')[0];
            } else if (typeof fechaRaw === 'string') {
                // Extract only the date part via regex to avoid header garbage
                const dateMatch = fechaRaw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
                if (dateMatch) {
                    const [_, d, m, y] = dateMatch;
                    fecha = `${y}-${m}-${d}`;
                } else if (/^\d{4}-\d{2}-\d{2}/.test(fechaRaw)) {
                    fecha = fechaRaw.split('T')[0];
                }
            }
        } catch (e) {
            continue;
        }

        if (!fecha) continue;

        const concepto = row[1]?.toString() || "";
        const referencia = row[2]?.toString() || "";
        const refAmpliada = row[3]?.toString() || "";
        
        // Strip leading numbers from Nombre (Referencia Ampliada)
        const nombre = refAmpliada.replace(/^\d+/, '').trim() || concepto;
        
        // Col 4 = Cargos (Egreso), Col 5 = Abonos (Ingreso)
        const cargo = Math.abs(cleanNum(row[4]));
        const abono = Math.abs(cleanNum(row[5]));

        if (cargo === 0 && abono === 0) continue;

        // Extract the running balance from Column G (Index 6)
        const rowSaldo = cleanNum(row[6]);

        movements.push({
            fecha,
            concepto: concepto.trim().replace(/\s+/g, ' '),
            referencia,
            descripcion: nombre,
            monto: abono || cargo,
            tipo: abono > 0 ? 'Ingreso' : 'Egreso',
            _originalRowSaldo: rowSaldo,
            _originalCargo: cargo,
            _originalAbono: abono
        });
    }

    // Detect initial balance from the OLDEST movement found (bottom of sheet, which is the LAST parsed item)
    let suggestedInitialBalance: number | null = null;
    if (movements.length > 0) {
        const oldestMovement = movements[movements.length - 1]; // because BBVA is newest-to-oldest, the oldest is the last one in the loop
        if (oldestMovement._originalRowSaldo !== 0) {
            // El saldo inicial es el saldo de la fila más antigua menos su abono más su cargo
            suggestedInitialBalance = oldestMovement._originalRowSaldo - oldestMovement._originalAbono + oldestMovement._originalCargo;
        }
    }

    // Cleanup temporary properties
    const finalMovements = movements.map(m => {
        const { _originalRowSaldo, _originalCargo, _originalAbono, ...rest } = m;
        return {
            ...rest,
            saldo_excel: _originalRowSaldo
        };
    });

    return { detectedCompany, movements: finalMovements, suggestedInitialBalance };
}

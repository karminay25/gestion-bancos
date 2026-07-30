/**
 * Utility to calculate account balances and sort movements consistently across the app.
 */

export interface Movement {
    id: string;
    cuenta_id: string;
    fecha: string;
    tipo: 'Ingreso' | 'Egreso';
    monto: number | string;
    saldo_excel?: number | string | null;
    factura?: string | null;
    nombre_tercero?: string | null;
    concepto?: string | null;
    centro_costo_id?: string | number | null;
    temporada_id?: string | number | null;
    created_at?: string;
    [key: string]: any;
}

/**
 * Sorts movements chronologically.
 * Uses fecha as primary sort and created_at as tie-breaker for perfect Excel mirroring.
 */
export function sortMovements<T extends { fecha: string; created_at?: string }>(movements: T[]): T[] {
    return [...movements].sort((a, b) => {
        const dateCompare = a.fecha.localeCompare(b.fecha);
        if (dateCompare !== 0) return dateCompare;
        return (a.created_at || '').localeCompare(b.created_at || '');
    });
}

/**
 * Calculates the current balance for a set of movements belonging to a single account.
 * Implements the "hardened" algorithm that looks for explicit balance tags.
 */
export function calculateAccountBalance(movements: Movement[]): number {
    if (movements.length === 0) return 0;

    // 1. Ensure movements are sorted correctly for balance calculation
    const sorted = sortMovements(movements);

    // 2. Find latest movement with an explicit balance (Excel or [BANCO:] tag)
    let latestBaseIdx = -1;
    let baseBalance = 0;

    for (let i = sorted.length - 1; i >= 0; i--) {
        const m = sorted[i];
        let val = m.saldoo;
        
        if (val === null || val === undefined || val === '') {
            val = m.saldo_excel;
            // Check for [BANCO: X] tag in factura field
            if (!val && m.factura?.includes('[BANCO:')) {
                const match = m.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
                if (match) val = match[1].replace(/,/g, '');
            }
        }

        if (val !== null && val !== undefined && val !== '') {
            const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(String(val));
            // Un saldo ilegible (texto como "N/A") se ignora y se sigue buscando
            // hacia atrás. Antes se tomaba como base igualmente y el NaN se
            // propagaba, dejando el saldo de TODA la cuenta en NaN.
            if (!isNaN(parsed)) {
                latestBaseIdx = i;
                baseBalance = parsed;
                break;
            }
        }
    }

    // Ingreso/Egreso store an unsigned monto (sign derived from tipo); Traspaso stores
    // a signed monto where the sign itself encodes direction (+ in, - out).
    const delta = (m: Movement): number => {
        const amt = parseFloat(m.monto?.toString().replace(/,/g, '') || '0');
        if (m.tipo === 'Egreso') return -Math.abs(amt);
        if (m.tipo === 'Ingreso') return Math.abs(amt);
        return amt;
    };

    // 3. If no base balance found, sum everything from zero
    if (latestBaseIdx === -1) {
        return sorted.reduce((sum, m) => sum + delta(m), 0);
    }

    // 4. Calculate from base balance forward
    let current = baseBalance;
    for (let i = latestBaseIdx + 1; i < sorted.length; i++) {
        current += delta(sorted[i]);
    }

    return current;
}

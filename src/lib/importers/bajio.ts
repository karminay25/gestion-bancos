import * as XLSX from 'xlsx';
import { RawMovement } from './bbva';

function extractNombreBajio(descripcion: string): string {
    // Try to find Ordenante
    const ordMatch = descripcion.match(/Ordenante:\s*([^|]+)/i);
    if (ordMatch) return ordMatch[1].trim().substring(0, 100);

    // Try to find Beneficiario (sometimes it's "Beneficiario: NAME" or just "Beneficiario |")
    const benMatch = descripcion.match(/Beneficiario:\s*([^|]+)/i);
    if (benMatch && benMatch[1].trim().length > 2) return benMatch[1].trim().substring(0, 100);

    // Specific patterns for Bajio
    if (descripcion.includes('Pago Parcial Crédito')) return 'PAGO CREDITO BAJIO';
    if (descripcion.includes('Comisión')) return 'COMISION BAJIO';
    if (descripcion.includes('IVA')) return 'IVA BAJIO';

    // Fallback: first part before "|"
    const fallback = descripcion.split('|')[0].trim();
    // If it's too long, truncate it
    return fallback.substring(0, 100);
}

export function parseBajio(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    
    // Find the sheet: either 'disponible' or 'Movimientos' or the first sheet that seems to have data
    let sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('disponible') || n.toLowerCase().includes('mov'));
    if (!sheetName) sheetName = wb.SheetNames[0];
    
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const cleanNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned) || 0;
    };

    // Detect currency from header
    let detectedCurrency = 'MXN';
    for (let i = 0; i < 15; i++) {
        if (!data[i]) continue;
        const rowStr = JSON.stringify(data[i]);
        if (rowStr?.includes('Dólar')) detectedCurrency = 'USD';
    }

    const movements: RawMovement[] = [];
    let headerFound = false;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        // Try to detect the header row first
        const rowStr = JSON.stringify(row).toUpperCase();
        if (!headerFound) {
            if (rowStr.includes('FECHA') && (rowStr.includes('CONCEPTO') || rowStr.includes('DESCRIPCI'))) {
                headerFound = true;
            }
            continue;
        }

        // Process rows after header
        const fechaRaw = row[1];
        if (!fechaRaw) continue;

        let fecha = '';
        try {
            if (typeof fechaRaw === 'number') {
                const dateObj = XLSX.SSF.parse_date_code(Math.floor(fechaRaw));
                fecha = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            } else if (typeof fechaRaw === 'string') {
                // Handle formats like "30-mar-2026", "30/03/2026", "30-03-26"
                const parts = fechaRaw.trim().split(/[-/ ]/);
                if (parts.length >= 3) {
                    let day = parts[0].padStart(2, '0');
                    let monthStr = parts[1].toLowerCase();
                    let year = parts[2];
                    if (year.length === 2) year = '20' + year;

                    const months: Record<string, string> = {
                        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
                        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
                        'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12'
                    };

                    let month = months[monthStr] || monthStr.padStart(2, '0');
                    fecha = `${year}-${month}-${day}`;
                }
            }
        } catch (e) { continue; }

        if (!fecha || fecha.length !== 10) continue;

        const descripcion = row[4]?.toString() || '';
        const cargos = cleanNum(row[5]); // Egreso
        const abonos = cleanNum(row[6]); // Ingreso
        const saldo = cleanNum(row[7]);

        if (cargos === 0 && abonos === 0) continue;

movements.push({
    fecha,
    concepto: descripcion.substring(0, 255),
    referencia: '',
    descripcion: extractNombreBajio(descripcion),
    proveedor: extractNombreBajio(descripcion), // new field
    monto: Math.abs(cargos || abonos), // Ensure absolute value
    tipo: abonos > 0 ? 'Ingreso' : 'Egreso',
    saldo_excel: saldo,
    moneda: detectedCurrency
});
    }

    // Sort all movements by date ascending to ensure consistent order
    movements.sort((a, b) => a.fecha.localeCompare(b.fecha));

    return { detectedCompany: null, movements };
}

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const ACCOUNT_ID = 'cccb5951-8232-4ab7-b9cf-47b918677999';
const SHEET_NAME = 'BOSBES PESOS BBVA';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debugInsert() {
    console.log('--- DEBUG INSERT BOSBES PESOS BBVA ---');

    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[SHEET_NAME];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const payload: any[] = [];

    let lastValidDate = '2025-01-01';
    data.forEach((row, i) => {
        const nombre = row[2]?.toString() || "";
        const dateRaw = row[0];
        const ingreso = parseFloat(row[3]) || 0;
        const egreso = parseFloat(row[4]) || 0;
        const monto = ingreso || egreso;
        const saldoLiteral = parseFloat(row[5]) || 0;

        let dateIso = "";
        if (nombre === 'SALDO INICIAL') dateIso = lastValidDate;
        else if (typeof dateRaw === 'number') {
            const d = new Date((dateRaw - 25569) * 86400000);
            dateIso = d.toISOString().split('T')[0];
            lastValidDate = dateIso;
        } else if (monto > 0) dateIso = lastValidDate;
        else return;

        payload.push({
            id: `00000000-bosb-0000-0000-${i.toString(16).padStart(12, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre || "S/N",
            monto: monto,
            tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
            factura: `[BANCO: ${saldoLiteral.toFixed(2)}]`
        });
    });

    console.log(`Payload size: ${payload.length}`);
    const { error } = await supabase.from('movimientos').insert(payload.slice(0, 10));
    if (error) {
        console.error('ERROR INSERTING:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
    } else {
        console.log('Insert of first 10 successful.');
    }
}

debugInsert();

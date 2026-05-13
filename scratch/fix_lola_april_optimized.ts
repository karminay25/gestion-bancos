import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RSM_PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852'; // LOLA BBVA PESOS

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fixLolaApril() {
    console.log('--- FIXING APRIL FOR LOLA BBVA PESOS ---');

    // 1. Delete April movements only
    await supabase.from('movimientos')
        .delete()
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-04-01');

    // 2. Read RSM
    const wb = XLSX.readFile(RSM_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const payload: any[] = [];
    
    // Rows with data start at index 2 (based on check_rsm_cols.ts)
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;

        const dateRaw = row[0];
        const d = new Date((dateRaw - 25569) * 86400000);
        const dateIso = d.toISOString().split('T')[0];

        const concepto = row[1]?.toString() || "";
        const refAmpliada = row[3]?.toString() || "";
        
        // Strip leading numbers from Nombre
        const nombre = refAmpliada.replace(/^\d+/, '').trim() || concepto;

        const egreso = parseFloat(row[4]) || 0;
        const ingreso = parseFloat(row[5]) || 0;
        const monto = ingreso || egreso;
        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        const saldoLiteral = parseFloat(row[6]) || 0;

        payload.push({
            id: `00000000-0000-0000-aaaa-a${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `[BANCO: ${saldoLiteral.toFixed(2)}]`, // No factura text, just tag
            centro_costo_id: null // Will need to map these later or use defaults
        });
    }

    console.log(`Inserting ${payload.length} corrected April movements...`);
    // Reverse because RSM is usually newest first (Saldo 82k is at Row 2)
    // Wait! Row 2 is 82k. Row 6 is 337k. Yes, newest first.
    // I should probably insert them so they are ordered by ID correctly.
    const sortedPayload = payload.reverse();

    const { error } = await supabase.from('movimientos').insert(sortedPayload);
    if (error) console.error('Error:', error.message);
    else console.log('APRIL FIXED.');
}

fixLolaApril();

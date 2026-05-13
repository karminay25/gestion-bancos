import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RSM_PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function populateSaldoExcel() {
    console.log('--- RE-IMPORTING RSM WITH LITERAL BALANCE ---');

    // 1. Clean previous RSM import
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).like('id', '00000000-0000-0000-bb1a-%');

    // 2. Parse RSM
    const wb = XLSX.readFile(RSM_PATH);
    const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const movements = data.slice(2).filter(row => row[0] && (row[4] || row[5]));
    movements.reverse();

    const payload: any[] = movements.map((row, i) => {
        const dateIso = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        const monto = parseFloat(row[5]) || parseFloat(row[4]);
        const tipo = row[5] ? 'Ingreso' : 'Egreso';
        const concepto = row[3]?.toString().trim() || row[1]?.toString().trim();
        const nombre = row[1]?.toString().trim() + ' ' + (row[2]?.toString().trim() || '');
        const saldoExcel = parseFloat(row[6]) || 0;

        return {
            id: `00000000-0000-0000-bb1a-f${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            saldo_excel: saldoExcel // <--- THE LITERAL COPY
        };
    });

    console.log(`Attempting to insert ${payload.length} movements with saldo_excel...`);
    const { error } = await supabase.from('movimientos').insert(payload);
    
    if (error) {
        console.error('Error during insert:', error.message);
        if (error.message.includes('column "saldo_excel" of relation "movimientos" does not exist')) {
            console.log('\nCRITICAL: The user MUST run the SQL command to add the column first.');
        }
    } else {
        console.log('SUCCESS. Literal balances saved.');
    }
}

populateSaldoExcel();

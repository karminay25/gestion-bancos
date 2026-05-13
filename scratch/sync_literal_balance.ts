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

async function syncWithLiteralBalance() {
    console.log('--- SYNCING WITH LITERAL BANK BALANCE (PLAN B) ---');

    // 1. Clean ALL RSM-related imports
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).like('id', '00000000-0000-0000-bb1%');

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
        const referencia = row[2]?.toString().trim() || '';

        return {
            id: `00000000-0000-0000-bb1b-f${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${referencia} [BANCO: ${saldoExcel.toFixed(2)}]`
        };
    });

    console.log(`Inserting ${payload.length} movements with literal balances...`);
    const { error } = await supabase.from('movimientos').insert(payload);
    
    if (error) console.error('Error:', error.message);
    else console.log('SUCCESS. Literal balances are now visible in the new "Saldo Banco" column!');
}

syncWithLiteralBalance();

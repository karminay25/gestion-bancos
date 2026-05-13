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

async function fix() {
    console.log('--- Cleaning up failed import and re-importing ---');
    
    // 1. Delete the "AJUSTE ESTADO DE CUENTA" added in failed run
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).eq('nombre_tercero', 'AJUSTE ESTADO DE CUENTA');

    const wb = XLSX.readFile(RSM_PATH);
    const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const movements = data.slice(2).filter(row => row[0] && (row[4] || row[5]));
    movements.reverse();

    const { data: existing } = await supabase.from('movimientos').select('fecha, monto, tipo, concepto').eq('cuenta_id', ACCOUNT_ID);
    const existingKeys = new Set(existing?.map(m => `${m.fecha}|${parseFloat(m.monto).toFixed(2)}|${m.tipo}|${m.concepto?.slice(0, 20)}`));

    const payload: any[] = [];
    let count = 0;

    for (const row of movements) {
        const dateIso = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        const monto = parseFloat(row[5]) || parseFloat(row[4]);
        const tipo = row[5] ? 'Ingreso' : 'Egreso';
        const concepto = row[3]?.toString().trim() || row[1]?.toString().trim();
        const nombre = row[1]?.toString().trim() + ' ' + (row[2]?.toString().trim() || '');

        const key = `${dateIso}|${monto.toFixed(2)}|${tipo}|${concepto?.slice(0, 20)}`;
        if (existingKeys.has(key)) continue;

        payload.push({
            id: `00000000-0000-0000-bb1a-f${count.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo
        });
        count++;
    }

    if (payload.length > 0) {
        console.log(`Inserting ${payload.length} movements...`);
        const { error } = await supabase.from('movimientos').insert(payload);
        if (error) { console.error('Error:', error.message); return; }
    }

    // Recalculate balance
    const { data: all } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let systemBalance = 0;
    all?.forEach(m => systemBalance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    
    const bankFinalBalance = parseFloat(data[2][6]);
    const drift = bankFinalBalance - systemBalance;

    if (Math.abs(drift) > 0.01) {
        console.log(`Adding adjustment for drift: $${drift.toFixed(2)}`);
        await supabase.from('movimientos').insert({
            id: `00000000-0000-0000-bb1a-ffffffffffff`,
            cuenta_id: ACCOUNT_ID,
            fecha: new Date().toISOString().split('T')[0],
            nombre_tercero: 'AJUSTE ESTADO DE CUENTA',
            concepto: 'Ajuste final para coincidir con el saldo del banco.',
            monto: Math.abs(drift),
            tipo: drift > 0 ? 'Ingreso' : 'Egreso'
        });
    }

    console.log('DONE. Final Balance:', bankFinalBalance);
}

fix();

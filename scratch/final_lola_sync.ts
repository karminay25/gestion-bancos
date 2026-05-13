import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';
const RSM_PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';

async function finalSync() {
    console.log('--- RESTORING ORDER FOR LOLA BBVA PESOS ---');

    // 1. Delete experimental RSM imports (IDs starting with bb1a-f or bb1b-f)
    console.log('Cleaning up experimental RSM movements...');
    const { data: toDelete } = await supabase
        .from('movimientos')
        .select('id')
        .eq('cuenta_id', ACCOUNT_ID)
        .or('id.like.00000000-0000-0000-bb1a-f%,id.like.00000000-0000-0000-bb1b-f%,nombre_tercero.eq.AJUSTE APERTURA ESTADO CUENTA,nombre_tercero.eq.AJUSTE ESTADO DE CUENTA');
    
    if (toDelete && toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} records...`);
        const ids = toDelete.map(d => d.id);
        await supabase.from('movimientos').delete().in('id', ids);
    }

    // 2. Parse RSM and filter for April 8 onwards
    const wb = XLSX.readFile(RSM_PATH);
    const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const rsmMovements = data.slice(2).filter(row => row[0] && (row[4] || row[5]));
    
    // RSM is newest first. Oldest is at the end.
    const missingMovements = rsmMovements.filter(row => {
        const date = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        return date > '2026-04-07';
    });
    
    // Chronological order for insert
    missingMovements.reverse();

    console.log(`Found ${missingMovements.length} movements in RSM after April 7.`);

    const payload = missingMovements.map((row, i) => {
        const dateIso = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        const monto = parseFloat(row[5]) || parseFloat(row[4]);
        const tipo = row[5] ? 'Ingreso' : 'Egreso';
        const concepto = row[3]?.toString().trim() || row[1]?.toString().trim();
        const nombre = row[1]?.toString().trim() + ' ' + (row[2]?.toString().trim() || '');
        const saldoExcel = parseFloat(row[6]) || 0;
        const referencia = row[2]?.toString().trim() || '';

        return {
            id: `00000000-0000-0000-bb1c-f${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${referencia} [BANCO: ${saldoExcel.toFixed(2)}]`
        };
    });

    if (payload.length > 0) {
        console.log(`Inserting ${payload.length} new movements...`);
        await supabase.from('movimientos').insert(payload);
    }

    // 3. Final Balance Adjustment (Only at the VERY END to reach the bank's final balance)
    const { data: all } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let systemBalance = 0;
    all?.forEach(m => systemBalance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    
    const bankFinalBalance = parseFloat(data[2][6]); // Saldo of first data row in RSM (Newest)
    const drift = bankFinalBalance - systemBalance;

    if (Math.abs(drift) > 0.01) {
        console.log(`Adding final adjustment for drift: $${drift.toFixed(2)}`);
        await supabase.from('movimientos').insert({
            id: '00000000-0000-0000-bb1c-ffffffffffff',
            cuenta_id: ACCOUNT_ID,
            fecha: '2026-04-21',
            nombre_tercero: 'AJUSTE CIERRE BANCO',
            concepto: 'Ajuste final para coincidir con el saldo del banco después de integrar abril.',
            monto: Math.abs(drift),
            tipo: drift > 0 ? 'Ingreso' : 'Egreso'
        });
    }

    console.log('DONE. Lola BBVA Pesos is now correctly synced.');
}

finalSync();

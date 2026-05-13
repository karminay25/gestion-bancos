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

async function fixLolaBalance() {
    console.log('--- RE-SYNCING LOLA BBVA PESOS WITH BANK FIDELITY ---');

    // 1. Move the 2025 Saldo Inicial to 2026-01-01
    console.log('Updating 2025 dates to 2026...');
    await supabase.from('movimientos').update({ fecha: '2026-01-01' }).eq('fecha', '2025-01-01');
    await supabase.from('movimientos').update({ fecha: '2026-01-01' }).eq('nombre_tercero', 'SALDO INICIAL').lt('fecha', '2026-01-01');

    // 2. Delete previous RSM import and adjustments for this account
    console.log('Cleaning previous import...');
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).like('id', '00000000-0000-0000-bb1a-%');
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).eq('nombre_tercero', 'AJUSTE ESTADO DE CUENTA');

    // 3. Calculate balance in system up to 2026-03-31 (using only movements from master excel)
    const { data: beforeRSM } = await supabase
        .from('movimientos')
        .select('monto, tipo')
        .eq('cuenta_id', ACCOUNT_ID)
        .lt('fecha', '2026-04-01');
    
    let currentBalance = 0;
    beforeRSM?.forEach(m => currentBalance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    console.log(`Current system balance at 2026-03-31: $${currentBalance.toFixed(2)}`);

    // 4. Target balance from RSM (Row 132 Saldo + Cargo = 121338.32 + 40 = 121378.32)
    const targetBalance = 121378.32;
    const drift = targetBalance - currentBalance;

    console.log(`Targeting $${targetBalance.toFixed(2)}. Drift: $${drift.toFixed(2)}`);
    
    // 5. Add adjustment BEFORE April 1st
    await supabase.from('movimientos').insert({
        id: '00000000-0000-0000-bb1a-aaaaaaaaaaaa',
        cuenta_id: ACCOUNT_ID,
        fecha: '2026-03-31',
        nombre_tercero: 'AJUSTE APERTURA ESTADO CUENTA',
        concepto: 'Ajuste para conciliar saldo manual con saldo real del banco al 1 de abril.',
        monto: Math.abs(drift),
        tipo: drift > 0 ? 'Ingreso' : 'Egreso'
    });

    // 6. Import RSM movements (Chronological)
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
        return {
            id: `00000000-0000-0000-bb1a-f${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo
        };
    });

    console.log(`Inserting ${payload.length} RSM movements...`);
    await supabase.from('movimientos').insert(payload);

    console.log('SUCCESS. Check the dashboard now.');
}

fixLolaBalance();

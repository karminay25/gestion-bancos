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

async function importRSM() {
    console.log('--- Importing BBVA RSM Statement ---');
    
    const wb = XLSX.readFile(RSM_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // BBVA RSM Structure:
    // Row 1: Headers
    // Row 2+: Data (Newest First)
    const movements = data.slice(2).filter(row => row[0] && (row[4] || row[5]));
    
    // Reverse to chronological order for balance tracking
    movements.reverse();

    console.log(`Processing ${movements.length} movements...`);

    // Fetch existing movements for this account to avoid duplicates
    const { data: existing } = await supabase
        .from('movimientos')
        .select('fecha, monto, tipo, concepto')
        .eq('cuenta_id', ACCOUNT_ID);
    
    const existingKeys = new Set(existing?.map(m => `${m.fecha}|${parseFloat(m.monto).toFixed(2)}|${m.tipo}|${m.concepto?.slice(0, 20)}`));

    const payload: any[] = [];
    let addedCount = 0;
    let skippedCount = 0;

    for (const row of movements) {
        const dateRaw = row[0];
        const dateIso = new Date((dateRaw - 25569) * 86400000).toISOString().split('T')[0];
        const egreso = parseFloat(row[4]) || 0;
        const ingreso = parseFloat(row[5]) || 0;
        const monto = ingreso || egreso;
        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        const concepto = row[3]?.toString().trim() || row[1]?.toString().trim();
        const nombre = row[1]?.toString().trim() + ' ' + (row[2]?.toString().trim() || '');

        const key = `${dateIso}|${monto.toFixed(2)}|${tipo}|${concepto?.slice(0, 20)}`;
        if (existingKeys.has(key)) {
            skippedCount++;
            continue;
        }

        payload.push({
            id: `00000000-0000-0000-bbva-rsm${addedCount.toString().padStart(8, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            created_at: new Date().toISOString()
        });
        addedCount++;
    }

    if (payload.length > 0) {
        console.log(`Inserting ${payload.length} new movements...`);
        const { error } = await supabase.from('movimientos').insert(payload);
        if (error) console.error('Error:', error.message);
        else console.log('Successfully inserted.');
    } else {
        console.log('No new movements found.');
    }

    // Final balance check
    const { data: all } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let systemBalance = 0;
    all?.forEach(m => systemBalance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));

    const bankFinalBalance = parseFloat(data[2][6]); // Saldo of Row 2 (Newest)
    console.log(`\nSystem Balance: $${systemBalance.toFixed(2)}`);
    console.log(`Bank Statement Final Balance: $${bankFinalBalance.toFixed(2)}`);

    const drift = bankFinalBalance - systemBalance;
    if (Math.abs(drift) > 0.01) {
        console.log(`\nDrift detected: $${drift.toFixed(2)}. Adding adjustment...`);
        await supabase.from('movimientos').insert({
            cuenta_id: ACCOUNT_ID,
            fecha: new Date().toISOString().split('T')[0],
            nombre_tercero: 'AJUSTE ESTADO DE CUENTA',
            concepto: 'Ajuste para coincidir con el saldo real del banco.',
            monto: Math.abs(drift),
            tipo: drift > 0 ? 'Ingreso' : 'Egreso'
        });
        console.log('Adjustment added.');
    }

    console.log('\nImport complete!');
}

importRSM();

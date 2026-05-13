import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNTS = {
  'BBVA PESOS': '92e326e1-77a6-4426-95f6-505f0b36d852',
  'BBVA DOLARES': 'b865af21-de39-4dbc-bf37-245c49a8ce50',
  'MONEX USD': '3690f38f-6ea9-46de-b8cc-e183e0542ab5',
  'BAJIO PESOS': 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8',
  'BAJIO USD': '16806e60-2b77-48c8-98b6-3e40c0505247',
  'BOSBES PESOS BBVA': 'cccb5951-8232-4ab7-b9cf-47b918677999',
  'BOSBES USD BBVA ': '64d7c5b4-f28e-4117-bcb8-d3731c1af35b',
  'BOSBES USD MONEX': '62d2bb5c-5f31-4f33-835d-6939e92f8485'
};

const CC = {
  'LOLA': '6a579200-6474-40a2-9e62-325bb63cd132',
  'OBA': '5353b861-04c2-4d1a-bf3d-318a44b4e87c',
  'BOSBES': '781e0438-b6a4-4a57-9c24-65334c68f123',
  'SOCIO CARLOS': '1916c7cb-9e43-4a8a-a3e3-8b3bc7bb82d1',
  'SOCIO JOSE': '4ec14c0c-1a1f-43c0-9c0d-e096d8dc3713',
  'SOCIO LUIS': '2fbe4ba1-23a6-4ba4-98ef-cd2e2f68115d',
  'SOCIO JFV': 'a9c4ef69-0811-4d6b-958c-14aded433506',
  'CRFV': '45688ff0-f68e-4c28-8e5f-0421578eee44'
};

function excelDateToISO(serial: any) {
    if (!serial || isNaN(serial)) return null;
    const date = new Date((serial - 25569) * 86400000);
    return date.toISOString().split('T')[0];
}

async function runPrecisionSync() {
  console.log('--- Precision Sync V3 ---');
  await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const workbook = XLSX.readFile(EXCEL_PATH);
  const finalPayload: any[] = [];
  let rowCounter = 0;

  for (const [sheetName, accountId] of Object.entries(ACCOUNTS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    
    console.log(`Extracting: ${sheetName}`);
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Row 7: Saldo Inicial
    const row7 = rows[6];
    if (row7 && row7[2] === 'SALDO INICIAL') {
        const saldoIni = parseFloat(row7[5]) || 0;
        finalPayload.push({
            cuenta_id: accountId,
            fecha: '2026-01-01',
            nombre_tercero: 'SALDO INICIAL',
            monto: saldoIni,
            tipo: 'Ingreso',
            concepto: 'Saldo Inicial Enero 2026',
            sort_order: ++rowCounter
        });
    }

    // Row 8 onwards: Transactions
    for (let i = 7; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;
        
        const fecha = excelDateToISO(row[0]);
        if (!fecha) continue;

        const ingreso = parseFloat(row[3]) || 0;
        const egreso = parseFloat(row[4]) || 0;
        const monto = ingreso || egreso;
        if (monto === 0 && !row[2]) continue;

        const ccString = row[9]?.toString().trim() || 'GRAL';
        let ccId = CC[ccString as keyof typeof CC] || null;

        finalPayload.push({
            cuenta_id: accountId,
            fecha,
            nombre_tercero: row[2] || 'S/N',
            monto,
            tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
            factura: row[7] || null,
            concepto: row[8] || null,
            centro_costo_id: ccId,
            sort_order: ++rowCounter
        });
    }
  }

  // Verification Math
  console.log('Verifying BBVA PESOS array balance...');
  const bbvaRows = finalPayload.filter(r => r.cuenta_id === ACCOUNTS['BBVA PESOS']);
  let checkBalance = 0;
  bbvaRows.forEach(r => {
      checkBalance += (r.tipo === 'Ingreso' ? r.monto : -r.monto);
  });
  console.log(`Calculated Balance: $${checkBalance.toLocaleString()}`);

  console.log(`Inserting ${finalPayload.length} rows...`);
  const BATCH = 100;
  for (let i = 0; i < finalPayload.length; i += BATCH) {
    const { error } = await supabase.from('movimientos').insert(finalPayload.slice(i, i + BATCH));
    if (error) {
        console.error('Batch error:', error.message);
        // Retry without sort_order if cache is failed
        if (error.message.includes('sort_order')) {
            console.log('Degrading to no-sort-order sync...');
            await supabase.from('movimientos').insert(finalPayload.slice(i, i + BATCH).map(({sort_order, ...r}) => r));
        }
    }
  }
  console.log('\n--- Sync Complete ---');
}

runPrecisionSync();

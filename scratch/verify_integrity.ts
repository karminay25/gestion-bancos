import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const ACCOUNT_ID = 'cccb5951-8232-4ab7-b9cf-47b918677999'; // BOSBES BBVA PESOS
const SHEET_NAME = 'BOSBES PESOS BBVA';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyInsertion() {
    console.log(`--- VERIFYING INSERTION FOR: ${SHEET_NAME} ---`);

    const wb = XLSX.readFile(EXCEL_PATH);
    const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAME], { header: 1 });

    // Pick a row with data (Row 500)
    const rowIdx = 500;
    const row = data[rowIdx];
    console.log('Excel Row 500:', row);

    const dateRaw = row[0];
    const d = new Date((dateRaw - 25569) * 86400000).toISOString().split('T')[0];
    const nombre = row[2]?.toString() || "";
    const ingreso = parseFloat(row[3]) || 0;
    const egreso = parseFloat(row[4]) || 0;
    const monto = ingreso || egreso;
    const saldo = parseFloat(row[5]) || 0;
    const concepto = row[8]?.toString() || row[7]?.toString() || "";

    console.log('\nExpecting in DB:');
    console.log(`- Fecha: ${d}`);
    console.log(`- Nombre: ${nombre}`);
    console.log(`- Monto: ${monto}`);
    console.log(`- Saldo: ${saldo}`);
    console.log(`- Concepto: ${concepto}`);

    const { data: dbRows } = await supabase
        .from('movimientos')
        .select('*, centros_costo(nombre)')
        .eq('cuenta_id', ACCOUNT_ID)
        .eq('fecha', d)
        .eq('nombre_tercero', nombre)
        .eq('monto', monto);

    console.log('\nFound in DB:', dbRows);
}

verifyInsertion();

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHEET_MAPPING: Record<string, string> = {
  'BBVA PESOS': '92e326e1-77a6-4426-95f6-505f0b36d852',
  'BBVA DOLARES': 'b865af21-de39-4dbc-bf37-245c49a8ce50',
  'MONEX USD': '3690f38f-6ea9-46de-b8cc-e183e0542ab5',
  'BAJIO PESOS': 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8',
  'BAJIO USD': '16806e60-2b77-48c8-98b6-3e40c0505247',
  'BOSBES PESOS BBVA': 'cccb5951-8232-4ab7-b9cf-47b918677999',
  'BOSBES USD BBVA ': '64d7c5b4-f28e-4117-bcb8-d3731c1af35b',
  'BOSBES USD MONEX': '62d2bb5c-5f31-4f33-835d-6939e92f8485'
};

const CC_MAPPING: Record<string, string> = {
  'LOLA': '6a579200-6474-40a2-9e62-325bb63cd132',
  'OBA': '5353b861-04c2-4d1a-bf3d-318a44b4e87c',
  'BOSBES': '781e0438-b6a4-4a57-9c24-65334c68f123',
  'SOCIO CARLOS': '1916c7cb-9e43-4a8a-a3e3-8b3bc7bb82d1',
  'SOCIO JOSE': '4ec14c0c-1a1f-43c0-9c0d-e096d8dc3713',
  'SOCIO LUIS': '2fbe4ba1-23a6-4ba4-98ef-cd2e2f68115d',
  'SOCIO JFV': 'a9c4ef69-0811-4d6b-958c-14aded433506',
  'CRFV': '45688ff0-f68e-4c28-8e5f-0421578eee44',
  'PRO': '432e9102-c9c0-4ece-8c55-a3ec8e648a8b',
  'LACM': '77234ef6-d4f3-43a2-8051-26fab5c68ace'
};

function excelDateToJS(serial: any) {
    if (!serial || isNaN(serial)) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

async function sync() {
  console.log('--- Iniciando Sincronización Total ---');
  
  // 1. Limpiar tabla actual
  console.log('Vaciando tabla movimientos...');
  const { error: delError } = await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.error('Error al limpiar tabla:', delError);
    return;
  }

  // 2. Leer Excel
  const workbook = XLSX.readFile(EXCEL_PATH);
  const allRows: any[] = [];

  for (const sheetName of Object.keys(SHEET_MAPPING)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.warn(`Hoja ${sheetName} no encontrada en Excel.`);
        continue;
    }

    console.log(`Procesando hoja: ${sheetName}`);
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Los datos reales empiezan en la fila 7 (index 6)
    // Headers: [FECHA, BANCO, NOMBRE, INGRESO, EGRESO, SALDO, null, FACTURA, CONCEPTO, C.D COSTO]
    for (let i = 6; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;
        
        const fechaRaw = row[0];
        const fecha = excelDateToJS(fechaRaw);
        if (!fecha) continue; // Si no hay fecha vlida, ignorar (podran ser filas de resumen)

        const nombre = row[2];
        if (!nombre || nombre === 'SALDO INICIAL') continue; // El saldo inicial se maneja como lógica de app o ajuste inicial en DB

        const ingreso = parseFloat(row[3]) || 0;
        const egreso = parseFloat(row[4]) || 0;
        const monto = ingreso > 0 ? ingreso : egreso;
        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        
        if (monto === 0) continue;

        const factura = row[7] || null;
        const concepto = row[8] || null;
        const ccString = row[9]?.toString().trim() || 'GRAL';
        
        // Match Cost Center
        let ccId = CC_MAPPING[ccString];
        if (!ccId && ccString !== 'GRAL') {
            // Intenta búsqueda parcial
            const found = Object.keys(CC_MAPPING).find(key => ccString.includes(key));
            if (found) ccId = CC_MAPPING[found];
        }

        allRows.push({
            cuenta_id: SHEET_MAPPING[sheetName],
            fecha,
            nombre_tercero: nombre,
            monto,
            tipo,
            factura,
            concepto,
            centro_costo_id: ccId || null
        });
    }
  }

  console.log(`Total registros preparados: ${allRows.length}`);

  // 3. Insertar en Supabase (en lotes de 100)
  const BATCH_SIZE = 100;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('movimientos').insert(batch);
    if (error) {
        console.error(`Error insertando lote ${i}:`, error);
    } else {
        process.stdout.write(`.`);
    }
  }

  console.log('\n--- Sincronización Completada con Éxito ---');
}

sync();

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('🚀 Iniciando importación de datos...');
  console.log(`  Leyendo Excel: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  // 1. Asegurar Empresas
  console.log('🏢 Sincronizando empresas (LOLA, BOSBES, OBA)...');
  const companiesToEnsure = [
    { codigo: 'LOLA', nombre_completo: 'LOLA BERRIES SPR DE RL DE CV', razon_social: 'LOLA BERRIES SPR DE RL DE CV' },
    { codigo: 'BOSBES', nombre_completo: 'BOSBES BERRIES SPR DE RL DE CV', razon_social: 'BOSBES BERRIES SPR DE RL DE CV' },
    { codigo: 'OBA', nombre_completo: 'OBA BERRIES', razon_social: 'OBA BERRIES' }
  ];

  for (const comp of companiesToEnsure) {
    await supabase.from('empresas').upsert(comp, { onConflict: 'codigo' });
  }

  let { data: companies, error: compError } = await supabase.from('empresas').select('*');
  if (compError || !companies) {
    console.error('❌ Error al obtener empresas:', compError?.message);
    return;
  }
  const getCompanyId = (name) => companies?.find(c => c.codigo && c.codigo.toUpperCase() === name.toUpperCase())?.id;

  // 1.5 Limpieza (Para reemplazo total solicitado)
  console.log('🧹 Limpiando datos anteriores...');
  await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('cuentas_bancarias').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. Procesar Hojas
  const sheetsToImport = [
    { name: 'BBVA PESOS', company: 'LOLA', bank: 'BBVA', currency: 'MXN' },
    { name: 'BBVA DOLARES', company: 'LOLA', bank: 'BBVA', currency: 'USD' },
    { name: 'MONEX USD', company: 'LOLA', bank: 'MONEX', currency: 'USD' },
    { name: 'BAJIO PESOS', company: 'LOLA', bank: 'BAJIO', currency: 'MXN' },
    { name: 'BAJIO USD', company: 'LOLA', bank: 'BAJIO', currency: 'USD' },
    { name: 'BOSBES PESOS BBVA', company: 'BOSBES', bank: 'BBVA', currency: 'MXN' },
    { name: 'BOSBES USD BBVA ', company: 'BOSBES', bank: 'BBVA', currency: 'USD' },
    { name: 'BOSBES USD MONEX', company: 'BOSBES', bank: 'MONEX', currency: 'USD' }
  ];
  console.log(`  Total de hojas a importar configuradas: ${sheetsToImport.length}`);

  for (const sheetDef of sheetsToImport) {
    const sheet = workbook.Sheets[sheetDef.name];
    if (!sheet) {
      console.warn(`⚠️ Hoja no encontrada: ${sheetDef.name}`);
      continue;
    }

    console.log(`\nImportando hoja: ${sheetDef.name} (${sheetDef.company})...`);
    
    // Asegurar Cuenta Bancaria
    const companyId = getCompanyId(sheetDef.company);
    if (!companyId) {
        console.warn(`  ID de empresa no encontrado para: ${sheetDef.company}`);
        continue;
    }

    console.log(`  Upserting cuenta: ${sheetDef.bank} (${sheetDef.currency})...`);
    const { data: account, error: accError } = await supabase
      .from('cuentas_bancarias')
      .upsert({
        empresa_id: companyId,
        banco: sheetDef.bank,
        moneda: sheetDef.currency,
        descripcion: sheetDef.name
      }, { onConflict: 'empresa_id,banco,moneda,descripcion' }) // Just for uniqueness
      .select()
      .single();

    console.log(`  Cuenta asegurada: ${account?.id}`);

    // Leer datos
    console.log(`  Convirtiendo hoja a JSON...`);
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`  Matrix de tamaño ${matrix.length} obtenida.`);
    
    // Buscar la fila de encabezados (buscamos "FECHA")
    let headerRowIndex = -1;
    console.log(`  Matrix length: ${matrix.length}`);
    if (matrix.length > 0) {
        console.log(`  Muestra de fila 0:`, JSON.stringify(matrix[0]));
        console.log(`  Muestra de fila 5:`, JSON.stringify(matrix[5]));
    }
    for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const row = matrix[i];
        if (Array.isArray(row) && row.some(cell => cell && cell.toString().includes('FECHA'))) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.warn(`No se encontraron encabezados en la hoja ${sheetDef.name}`);
        continue;
    }

    const headers = matrix[headerRowIndex];
    const rows = matrix.slice(headerRowIndex + 1);
    console.log(`  Headers encontrados en fila ${headerRowIndex}:`, headers);
    console.log(`  Procesando ${rows.length} filas...`);

    const movements = [];
    const costCenters = new Set();

    for (const row of rows) {
        const fechaVal = row[headers.indexOf('FECHA')];
        const nombre = row[headers.indexOf('NOMBRE')];
        
        if (!fechaVal || nombre === 'SALDO INICIAL') continue;
        
        let fecha;
        if (typeof fechaVal === 'number') {
            // Excel date
            fecha = new Date(Math.round((fechaVal - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        } else {
            // Likely a month name or something, skip for now if not a date
            continue;
        }

        const ingreso = parseFloat(row[headers.indexOf('INGRESO')]) || 0;
        const egreso = parseFloat(row[headers.indexOf('EGRESO')]) || 0;
        const concepto = row[headers.indexOf('CONCEPTO')];
        const factura = row[headers.indexOf('FACTURA')];
        const ccName = row[headers.indexOf('C.D COSTO')] || row[headers.indexOf('CENTROS DE COSTO')];

        if (ingreso === 0 && egreso === 0) continue;

        if (ccName) costCenters.add(ccName);

        movements.push({
            cuenta_id: account.id,
            fecha,
            tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
            monto: ingreso > 0 ? ingreso : egreso,
            nombre_tercero: nombre,
            concepto,
            factura,
            cc_temp: ccName // Temporary store to map later
        });
    }

    console.log(`  Encontrados ${movements.length} movimientos válidos.`);
    if (movements.length === 0) continue;

    // Asegurar Centros de Costo
    console.log(`  Procesando ${costCenters.size} centros de costo...`);
    for (const cc of costCenters) {
        await supabase.from('centros_costo').upsert({ nombre: cc }, { onConflict: 'nombre' });
    }

    const { data: dbCCs } = await supabase.from('centros_costo').select('*');

    // Mapear movimientos con CC_ID e insertar
    const finalMovements = movements.map(m => {
        const dbCC = dbCCs.find(cc => cc.nombre === m.cc_temp);
        const { cc_temp, ...rest } = m;
        return { ...rest, centro_costo_id: dbCC?.id };
    });

    console.log(`  Insertando ${finalMovements.length} movimientos en Supabase...`);
    const { error: insError } = await supabase.from('movimientos').insert(finalMovements);
    if (insError) console.error('  ❌ Error al insertar movimientos:', insError.message);
    else console.log(`  ✅ ${finalMovements.length} movimientos insertados con éxito.`);
  }

  console.log('\n✨ Importación finalizada.');
}

run().catch(err => console.error('🔥 Error crítico:', err));

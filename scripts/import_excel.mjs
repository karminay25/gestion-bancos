import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const excelPath = 'c:/proyectoResidencias/BANCOS 2026 AL 310526.xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Months list to skip header month rows
const monthsList = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

// Helper to format Date to YYYY-MM-DD in UTC (timezone safe representation of Excel dates)
function formatDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse Excel dates timezone-safely
function parseExcelDate(val) {
  if (val instanceof Date) {
    const dUTC = new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
    return formatDate(dUTC);
  }
  if (typeof val === 'number') {
    // Excel date serial number (1900 date system)
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    return formatDate(dateObj);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Check if it matches DD/MM/YYYY or DD/MM/YY
    const dateParts = trimmed.split('/');
    if (dateParts.length === 3) {
      let day = parseInt(dateParts[0], 10);
      let month = parseInt(dateParts[1], 10) - 1;
      let year = parseInt(dateParts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return formatDate(d);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      return formatDate(dUTC);
    }
  }
  return null;
}


// Helper to parse numbers safely
function parseNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const cleanStr = val.toString().replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

// Helper to clean third party names (mirrors backend cleanTerceroName)
function cleanTerceroName(rawName) {
  if (!rawName) return 'POR IDENTIFICAR';

  let cleaned = rawName.toString().toUpperCase().trim();

  // 1. Manejo de IVA y Comisiones explícitas
  if (/^16%$/.test(cleaned) || cleaned.includes('IVA COM.CH') || cleaned.includes('COMISION') || cleaned.includes('COM A CARGO')) {
    return 'COMISIONES BANCARIAS';
  }

  // 2. Limpieza de prefijos de pago de facturas, notas y cotizaciones
  cleaned = cleaned.replace(/PAGO\s+(F|FAC\s+CREDITO|FACTURA[A-Z]?|NOTA\s+SAY|COT|COTIZACION)\s*([A-Z0-9]+)?\s*/g, '');
  cleaned = cleaned.replace(/^PAGO\s+F[A-Z0-9]+\s+/g, '');
  cleaned = cleaned.replace(/CBM\s+BMRC.*/g, '');

  // 3. Eliminar prefijos de banco genéricos
  const genericPrefixes = [
    'SPEI ENVIADO BANAMEX',
    'SPEI ENVIADO HSBC',
    'SPEI ENVIADO SANTANDER',
    'SPEI ENVIADO BAJIO',
    'SPEI ENVIADO',
    'SPEI RECIBIDOBANORTE',
    'SPEI RECIBIDOBAJIO',
    'SPEI RECIBIDOSANTANDER',
    'SPEI RECIBIDOBMONEX',
    'SPEI RECIBIDO',
    'TRASPASO A TERCEROS',
    'TRASPASO BBVA PESOS',
    'TRASPASO',
    'EMISION LIBRAMIE CHQ',
    'DEPOSITO EN CUENTA',
    'ABONO POR TRANSFERENCIA',
    'PAGO DE NOMINA',
    'COMPENSACIONES',
    'DEVOLUCION PAGO ERRONEO',
    'DEV MOV ERRONEO',
    'DEVOLUCION'
  ];

  for (const prefix of genericPrefixes) {
    cleaned = cleaned.replace(new RegExp(prefix, 'g'), '');
  }

  // 4. Fechas basura como "DEL 01MAR26 AL 31MAR26"
  if (/DEL\s+\d{2}[A-Z]{3}\d{2}\s+AL\s+\d{2}[A-Z]{3}\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/DEL\s+\d{2}[A-Z]{3}\d{2}\s+AL\s+\d{2}[A-Z]{3}\d{2}/g, '');
  }

  // 5. Cleanup residual spaces and dashes
  cleaned = cleaned.replace(/^[-\s]+|[-\s]+$/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  if (!cleaned) {
    const wasGeneric = genericPrefixes.some(p => rawName.toUpperCase().includes(p));
    const wasDate = /DEL\s+\d{2}[A-Z]{3}\d{2}/.test(rawName.toUpperCase());
    if (wasGeneric || wasDate || /^[0-9A-Z\s]*$/.test(rawName)) {
      return 'POR IDENTIFICAR';
    }
    return rawName.trim().substring(0, 100);
  }

  return cleaned.substring(0, 100);
}

// Function to find the balance for a company and banco/moneda combination in RESUMEN
function findResumenBalance(matrix, companyKeyword, bankKeyword, isUsd) {
  let companyRowIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (row && row.some(cell => cell && cell.toString().toUpperCase().includes(companyKeyword))) {
      companyRowIdx = i;
      break;
    }
  }

  if (companyRowIdx === -1) return 0;

  for (let i = companyRowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    
    // Stop if we hit total banks or the other company header
    if (row.some(cell => cell && (cell.toString().toUpperCase().includes('TOTAL BANCOS') || cell.toString().toUpperCase().includes('TOTAL BANCO')))) {
      break;
    }
    if (companyKeyword === 'LOLA' && row.some(cell => cell && cell.toString().toUpperCase().includes('BOSBES'))) {
      break;
    }

    const bankCell = row[1];
    if (bankCell && bankCell.toString().toUpperCase().includes(bankKeyword)) {
      const val = isUsd ? row[3] : row[2];
      return parseNum(val);
    }
  }
  return 0;
}

// Only import movements up to end of May 2026
const CUTOFF_DATE = '2026-05-31';

// Configuration of sheets to import
const sheetsConfig = [
  {
    sheetName: 'BBVA PESOS',
    accountDesc: 'BBVA PESOS',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  },
  {
    sheetName: 'BBVA DOLARES',
    accountDesc: 'BBVA DOLARES',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  },
  {
    sheetName: 'MONEX USD',
    accountDesc: 'MONEX USD',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  },
  {
    sheetName: 'BAJIO USD',
    accountDesc: 'BAJIO USD',
    startCol: 0,
    endCol: 7,
    colMapping: {
      fecha: 0,
      nombre: 1,
      concepto: 2,
      cc: 3,
      factura: 4,
      ingreso: 5,
      egreso: 6,
      saldo: 7
    }
  },
  {
    sheetName: 'BAJIO USD',
    accountDesc: 'CREDITO BAJIO',
    startCol: 10,
    endCol: 17,
    colMapping: {
      fecha: 10,
      nombre: 11,
      concepto: 12,
      cc: 13,
      factura: 14,
      ingreso: 15,
      egreso: 16,
      saldo: 17
    }
  },
  {
    sheetName: 'BOSBES PESOS BBVA',
    accountDesc: 'BOSBES PESOS BBVA',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  },
  {
    sheetName: 'BOSBES USD MONEX',
    accountDesc: 'BOSBES USD MONEX',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  },
  {
    sheetName: 'BOSBES USD BBVA ',
    accountDesc: 'BOSBES USD BBVA ',
    startCol: 0,
    endCol: 9,
    colMapping: {
      fecha: 0,
      nombre: 2,
      ingreso: 3,
      egreso: 4,
      saldo: 5,
      factura: 7,
      concepto: 8,
      cc: 9
    }
  }
];


async function run() {
  console.log('🚀 Iniciando importación de datos desde Excel a Supabase...');
  console.log(`  Leyendo Excel: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  console.log('📄 Hojas disponibles en Excel:', workbook.SheetNames);

  // 1. Obtener cuentas bancarias de la base de datos
  const { data: accounts, error: accError } = await supabase.from('cuentas_bancarias').select('*');
  if (accError || !accounts) {
    console.error("❌ Error al obtener cuentas bancarias de la BD:", accError?.message);
    return;
  }
  console.log(`  Cuentas registradas en BD: ${accounts.length}`);

  // 2. Procesar la hoja RESUMEN para validaciones cruzadas de saldos
  console.log('📊 Leyendo hoja RESUMEN de forma dinámica...');
  const resumenSheet = workbook.Sheets['RESUMEN'];
  const resumenMatrix = XLSX.utils.sheet_to_json(resumenSheet, { header: 1 });
  
  const resumenSaldos = {
    'BBVA PESOS': findResumenBalance(resumenMatrix, 'LOLA', 'BANCOMER', false),
    'BBVA DOLARES': findResumenBalance(resumenMatrix, 'LOLA', 'BANCOMER', true),
    'MONEX USD': findResumenBalance(resumenMatrix, 'LOLA', 'MONEX', true),
    'CREDITO BAJIO': findResumenBalance(resumenMatrix, 'LOLA', 'BANBAJIO', true),
    'BOSBES PESOS BBVA': findResumenBalance(resumenMatrix, 'BOSBES', 'BANCOMER', false),
    'BOSBES USD MONEX': findResumenBalance(resumenMatrix, 'BOSBES', 'MONEX', true)
  };
  
  console.log('  Saldos dinámicos de RESUMEN:', resumenSaldos);

  // 3. Importar cada una de las cuentas configuradas
  for (const config of sheetsConfig) {
    const sheet = workbook.Sheets[config.sheetName];
    if (!sheet) {
      console.warn(`⚠️ Hoja no encontrada en Excel: ${config.sheetName}`);
      continue;
    }

    console.log(`\n-------------------------------------------------------------`);
    console.log(`📂 Procesando Cuenta: ${config.accountDesc} (Hoja: ${config.sheetName})...`);

    // Buscar la cuenta correspondiente en la base de datos
    const dbAccount = accounts.find(a => a.descripcion && a.descripcion.toUpperCase() === config.accountDesc.toUpperCase());
    if (!dbAccount) {
      console.error(`❌ No se encontró la cuenta bancaria en la base de datos con descripción: ${config.accountDesc}`);
      continue;
    }
    console.log(`  Asociada a Cuenta ID: ${dbAccount.id}`);

    // Convertir hoja a 2D Array
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    

    // Localizar fila de encabezados
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(30, matrix.length); i++) {
      const row = matrix[i];
      if (row && row[config.colMapping.fecha] === 'FECHA') {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.error(`❌ No se encontró el encabezado 'FECHA' en la columna mapeada para la hoja: ${config.sheetName}`);
      continue;
    }
    console.log(`  Encabezados encontrados en fila física ${headerRowIndex + 1}`);

    // Parsear movimientos
    let lastSeenDate = null;
    const movements = [];
    const costCenters = new Set();

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row) continue;

      const rawFecha = row[config.colMapping.fecha];
      const rawNombre = row[config.colMapping.nombre];
      const rawConcepto = row[config.colMapping.concepto];
      const rawCc = row[config.colMapping.cc];
      const rawFactura = row[config.colMapping.factura];
      const rawIngreso = row[config.colMapping.ingreso];
      const rawEgreso = row[config.colMapping.egreso];
      const rawSaldo = row[config.colMapping.saldo];

      // Ignorar filas de títulos de mes (ej. "ENERO")
      if (typeof rawFecha === 'string' && monthsList.includes(rawFecha.trim().toUpperCase())) {
        continue;
      }

      // Propagar fecha
      const parsedFecha = parseExcelDate(rawFecha);
      if (parsedFecha) {
        lastSeenDate = parsedFecha;
      }

      // Ignorar fila de Saldo Inicial
      if (typeof rawNombre === 'string' && rawNombre.trim().toUpperCase() === 'SALDO INICIAL') {
        continue;
      }

      const ingreso = parseNum(rawIngreso);
      const egreso = parseNum(rawEgreso);
      const saldo = parseNum(rawSaldo);

      // Es un movimiento válido si hay montos
      if (ingreso !== 0 || egreso !== 0) {
        const finalFecha = parsedFecha || lastSeenDate;
        if (!finalFecha) {
          console.warn(`  ⚠️ Fila ${r + 1}: Movimiento sin fecha resuelta. Saltando.`);
          continue;
        }

        const cleanNombre = cleanTerceroName(rawNombre);
        const ccName = rawCc ? rawCc.toString().trim() : null;
        if (ccName) {
          costCenters.add(ccName);
        }

        movements.push({
          excelRow: r + 1,
          fecha: finalFecha,
          tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
          monto: ingreso > 0 ? ingreso : egreso,
          nombre_tercero: cleanNombre,
          concepto: rawConcepto ? rawConcepto.toString().trim() : null,
          factura: rawFactura ? rawFactura.toString().trim() : '',
          saldo_excel: saldo,
          cc_temp: ccName
        });
        // Debug: Log first few movements for BOSBES PESOS BBVA
        if (config.accountDesc === 'BOSBES PESOS BBVA') {
          console.log('🔎 Debug movements sample for BOSBES PESOS BBVA:', movements.slice(0, 5));
        }
      }
    }

    // Filter to only movements up to end of May 2026
    const allMovements = movements.filter(m => m.fecha <= CUTOFF_DATE);
    const filtered = allMovements.length !== movements.length
      ? `(${movements.length - allMovements.length} movimientos posteriores a Mayo 2026 omitidos)`
      : '';
    movements.length = 0;
    allMovements.forEach(m => movements.push(m));
    console.log(`  Encontrados ${movements.length} movimientos válidos en Excel (hasta Mayo 2026). ${filtered}`);
    // Additional debug: list omitted movements for BOSBES USD BBVA
    if (config.accountDesc.includes('BOSBES USD BBVA')) {
      const omitted = movements.filter(m => m.fecha > CUTOFF_DATE);
      if (omitted.length > 0) {
        console.log('🔎 Movimientos omitidos (posteriores a Mayo 2026):', omitted.slice(0,5));
        if (omitted.length > 5) console.log(`   ... and ${omitted.length-5} more`);
      }
    }

    console.log(`  Encontrados ${movements.length} movimientos válidos en Excel (hasta Mayo 2026). ${filtered}`);
    if (movements.length === 0) {
      console.warn(`  ⚠️ No hay movimientos válidos para importar en esta hoja.`);
      continue;
    }

    // Asegurar centros de costo en la BD
    if (costCenters.size > 0) {
      console.log(`  Sincronizando ${costCenters.size} centros de costo en BD...`);
      for (const cc of costCenters) {
        const { error: ccErr } = await supabase
          .from('centros_costo')
          .upsert({ nombre: cc }, { onConflict: 'nombre' });
        if (ccErr) console.error(`    ❌ Error al crear centro de costo "${cc}":`, ccErr.message);
      }
    }

    const { data: dbCCs } = await supabase.from('centros_costo').select('*');

    // 4. Limpiar movimientos históricos en Supabase de esta cuenta (Corregida la cadena de llamada)
    console.log(`  🧹 Limpiando movimientos históricos en BD para esta cuenta...`);
    const { error: delError } = await supabase
      .from('movimientos')
      .delete()
      .eq('cuenta_id', dbAccount.id);

    if (delError) {
      console.error(`  ❌ Error al limpiar movimientos de la BD:`, delError.message);
      continue;
    }

    // Determine the index of the movement that holds the final Excel balance
    const finalIdx = movements.reduce((lastIdx, m, i) => (m.saldo_excel != null ? i : lastIdx), -1);
    const toInsert = movements.map((m, idx) => {
      const dbCC = dbCCs ? dbCCs.find(cc => cc.nombre && cc.nombre.toUpperCase() === m.cc_temp?.toUpperCase()) : null;
      // Only add [BANCO:] tag to the movement that has the final Excel balance
      let finalFactura = m.factura;
      if (idx === finalIdx && m.saldo_excel != null) {
        finalFactura = `${m.factura} [BANCO: ${m.saldo_excel.toFixed(2)}]`.trim();
      }
      return {
        id: crypto.randomUUID(),
        cuenta_id: dbAccount.id,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        nombre_tercero: m.nombre_tercero,
        concepto: m.concepto,
        factura: finalFactura || null,
        centro_costo_id: dbCC ? dbCC.id : null,
        temporada_id: null
      };
    });

    // 6. Insertar secuencialmente uno por uno para asegurar orden cronológico (created_at)
    console.log(`  📥 Insertando ${toInsert.length} movimientos secuencialmente en la BD...`);
    let count = 0;
    for (const move of toInsert) {
      let insErr = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await supabase.from('movimientos').insert(move);
        insErr = res.error;
        if (!insErr) break;
        const isNetworkErr = insErr.message?.includes('fetch') || insErr.message?.includes('network') || insErr.code === 'ECONNRESET';
        if (!isNetworkErr || attempt === 4) break;
        const delay = attempt * 1500;
        console.warn(`    ⚠️  Error de red, reintentando en ${delay}ms (intento ${attempt}/4)...`);
        await new Promise(r => setTimeout(r, delay));
      }
      if (insErr) {
        console.error(`    ❌ Error en fila Excel ${movements[count].excelRow}:`, insErr.message);
        throw new Error(`Fallo en inserción secuencial para cuenta ${config.accountDesc}`);
      }
      count++;
      if (count % 200 === 0) {
        console.log(`    Progreso: ${count}/${toInsert.length} insertados...`);
      }
    }
    console.log(`  ✅ Inserción completada con éxito.`);

    // 7. Validación de saldos: el saldo calculado debe coincidir con el saldo del último movimiento de la hoja
    console.log(`  🔍 Realizando verificación de saldos...`);

    const { data: insertedMovs, error: fetchErr } = await supabase
      .from('movimientos')
      .select('*')
      .eq('cuenta_id', dbAccount.id)
      .range(0, 9999);


    if (fetchErr || !insertedMovs) {
      console.error(`  ❌ Error al recuperar movimientos para verificación:`, fetchErr?.message);
      continue;
    }

    const sorted = [...insertedMovs].sort((a, b) => {
      const dateCompare = a.fecha.localeCompare(b.fecha);
      if (dateCompare !== 0) return dateCompare;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    // Find the [BANCO:] tag — it's on the last movement
    let calcBalance = 0;
    let baseIdx = -1;
    let baseBalance = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const m = sorted[i];
      if (m.factura && m.factura.includes('[BANCO:')) {
        const match = m.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
        if (match) {
          baseIdx = i;
          baseBalance = parseFloat(match[1].replace(/,/g, ''));
          break;
        }
      }
    }

    if (baseIdx === -1) {
      calcBalance = sorted.reduce((sum, m) => m.tipo === 'Ingreso' ? sum + m.monto : sum - m.monto, 0);
    } else {
      calcBalance = baseBalance;
      // No movements should exist after the BANCO tag (it's the last one)
    }

    const lastExcelSaldo = movements[movements.length - 1].saldo_excel;
    const diff = Math.abs(calcBalance - lastExcelSaldo);

    console.log(`    Saldo último movimiento (Excel):     $${lastExcelSaldo.toLocaleString()}`);
    console.log(`    Saldo calculado en base de datos:    $${calcBalance.toLocaleString()}`);

    if (diff > 0.05) {
      console.error(`    ❌ Mismatch de saldo. Diferencia: $${diff.toFixed(2)}`);
      // Additional debug info for BOSBES accounts
      if (config.accountDesc.includes('BOSBES')) {
        console.log('🔎 Debug BOSBES account details:');
        console.log('    Último saldo Excel:', lastExcelSaldo);
        console.log('    Saldo calculado DB:', calcBalance);
        console.log('    Número de movimientos procesados:', movements.length);
      }
      throw new Error(`Validación de saldo falló para la cuenta ${config.accountDesc}`);
    } else {
      console.log(`    ✅ Saldo verificado correctamente.`);
      if (config.accountDesc.includes('BOSBES')) {
        console.log('🔎 BOSBES cuenta verificó saldo correctamente.');
      }
    }
  }

  console.log('\n✨ Proceso de importación y verificación completado exitosamente para todas las cuentas.');
}

run().catch(err => {
  console.error('\n🔥 ERROR CRÍTICO:', err.message);
  process.exit(1);
});

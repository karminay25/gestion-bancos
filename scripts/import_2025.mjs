import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const excelPath = path.resolve(__dirname, '..', 'BANCOS 2025 ACTUALIZADO OK.xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const monthsList = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

// Todos los movimientos son 2025; si el serial da 2024, se fuerza a 2025
function parseExcelDate(val) {
  let d = null;
  if (val instanceof Date) {
    d = new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
  } else if (typeof val === 'number') {
    const raw = new Date(Math.round((val - 25569) * 86400 * 1000));
    d = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  } else if (typeof val === 'string') {
    const t = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      d = new Date(t + 'T00:00:00Z');
    } else {
      const parts = t.split('/');
      if (parts.length === 3) {
        let [day, month, year] = parts.map(Number);
        if (year < 100) year += 2000;
        d = new Date(Date.UTC(year, month - 1, day));
      }
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  // Forzar año 2025 si el Excel dice 2024
  if (d.getUTCFullYear() === 2024) {
    d = new Date(Date.UTC(2025, d.getUTCMonth(), d.getUTCDate()));
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const n = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function cleanTerceroName(raw) {
  if (!raw) return 'POR IDENTIFICAR';
  let s = raw.toString().toUpperCase().trim();
  if (/^16%$/.test(s) || s.includes('IVA COM.CH') || s.includes('COMISION') || s.includes('COM A CARGO')) {
    return 'COMISIONES BANCARIAS';
  }
  const prefixes = [
    'SPEI ENVIADO BANAMEX','SPEI ENVIADO HSBC','SPEI ENVIADO SANTANDER',
    'SPEI ENVIADO BAJIO','SPEI ENVIADO','SPEI RECIBIDOBANORTE',
    'SPEI RECIBIDOBAJIO','SPEI RECIBIDOSANTANDER','SPEI RECIBIDOBMONEX',
    'SPEI RECIBIDO','TRASPASO A TERCEROS','TRASPASO BBVA PESOS','TRASPASO',
    'EMISION LIBRAMIE CHQ','DEPOSITO EN CUENTA','ABONO POR TRANSFERENCIA',
    'PAGO DE NOMINA','COMPENSACIONES','DEVOLUCION PAGO ERRONEO',
    'DEV MOV ERRONEO','DEVOLUCION'
  ];
  s = s.replace(/PAGO\s+(F|FAC\s+CREDITO|FACTURA[A-Z]?|NOTA\s+SAY|COT|COTIZACION)\s*([A-Z0-9]+)?\s*/g, '');
  s = s.replace(/^PAGO\s+F[A-Z0-9]+\s+/g, '');
  s = s.replace(/CBM\s+BMRC.*/g, '');
  for (const p of prefixes) s = s.replace(new RegExp(p, 'g'), '');
  s = s.replace(/DEL\s+\d{2}[A-Z]{3}\d{2}\s+AL\s+\d{2}[A-Z]{3}\d{2}/g, '');
  s = s.replace(/^[-\s]+|[-\s]+$/g, '').replace(/\s{2,}/g, ' ');
  if (!s) return 'POR IDENTIFICAR';
  return s.substring(0, 100);
}

// Hojas en el mismo orden consecutivo que las cuentas en el sistema
const sheetsConfig = [
  {
    sheetName: 'BBVA PESOS',
    accountDesc: 'BBVA PESOS',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  },
  {
    sheetName: 'BBVA DOLARES',
    accountDesc: 'BBVA DOLARES',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  },
  {
    sheetName: 'MONEX USD',
    accountDesc: 'MONEX USD',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  },
  {
    sheetName: 'BAJIO PESOS',
    accountDesc: 'BAJIO PESOS',
    headerCol: 0,
    // Row4: ["FECHA","BANCO","NOMBRE","INGRESO","EGRESO","SALDO"]
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:null, concepto:null, cc:null }
  },
  {
    sheetName: 'BAJIO USD',
    accountDesc: 'BAJIO USD',
    headerCol: 0,
    // Row2: ["FECHA","NOMBRE","CONCEPTO","C.D COSTO","FACTURA","INGRESO","EGRESO","SALDO"]
    colMapping: { fecha:0, nombre:1, concepto:2, cc:3, factura:4, ingreso:5, egreso:6, saldo:7 }
  },
  {
    sheetName: 'BAJIO USD',
    accountDesc: 'CREDITO BAJIO',
    headerCol: 10,
    // cols 10-17: misma estructura que BAJIO USD
    colMapping: { fecha:10, nombre:11, concepto:12, cc:13, factura:14, ingreso:15, egreso:16, saldo:17 }
  },
  {
    sheetName: 'BOSBES PESOS BBVA',
    accountDesc: 'BOSBES PESOS BBVA',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  },
  {
    sheetName: 'BOSBES USD MONEX',
    accountDesc: 'BOSBES USD MONEX',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  },
  {
    sheetName: 'BOSBES USD BBVA ',
    accountDesc: 'BOSBES USD BBVA ',
    headerCol: 0,
    colMapping: { fecha:0, nombre:2, ingreso:3, egreso:4, saldo:5, factura:7, concepto:8, cc:9 }
  }
];

async function processSheet(config, accounts) {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) {
    console.warn(`⚠️  Hoja no encontrada: ${config.sheetName}`);
    return;
  }

  const dbAccount = accounts.find(a =>
    a.descripcion && a.descripcion.trim().toUpperCase() === config.accountDesc.trim().toUpperCase()
  );
  if (!dbAccount) {
    console.error(`❌ Cuenta no encontrada en BD: "${config.accountDesc}"`);
    return;
  }

  console.log(`\n━━━ ${config.accountDesc} ━━━`);

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  // Localizar fila de encabezado por 'FECHA' en headerCol
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(30, matrix.length); i++) {
    const row = matrix[i];
    if (row && row[config.headerCol] != null &&
        row[config.headerCol].toString().toUpperCase().trim() === 'FECHA') {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    console.error(`❌ Encabezado FECHA no encontrado en col ${config.headerCol}`);
    return;
  }

  // Leer saldo inicial
  let saldoInicial = 0;
  for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 10, matrix.length); i++) {
    const row = matrix[i];
    if (!row) continue;
    const nombreCell = config.colMapping.nombre !== null ? row[config.colMapping.nombre] : null;
    if (typeof nombreCell === 'string' && nombreCell.trim().toUpperCase() === 'SALDO INICIAL') {
      saldoInicial = parseNum(config.colMapping.saldo !== null ? row[config.colMapping.saldo] : 0);
      console.log(`  Saldo inicial: ${saldoInicial.toLocaleString('es-MX')}`);
      break;
    }
  }

  // Parsear movimientos
  let lastDate = null;
  const movements = [];
  const costCentersNeeded = new Set();

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;

    const rawFecha = row[config.colMapping.fecha];
    if (typeof rawFecha === 'string' && monthsList.includes(rawFecha.trim().toUpperCase())) continue;

    const parsedFecha = parseExcelDate(rawFecha);
    if (parsedFecha) lastDate = parsedFecha;

    const rawNombre = config.colMapping.nombre !== null ? row[config.colMapping.nombre] : null;
    if (typeof rawNombre === 'string' && rawNombre.trim().toUpperCase() === 'SALDO INICIAL') continue;

    const ingreso = parseNum(config.colMapping.ingreso !== null ? row[config.colMapping.ingreso] : 0);
    const egreso  = parseNum(config.colMapping.egreso  !== null ? row[config.colMapping.egreso]  : 0);
    const saldoExcel = parseNum(config.colMapping.saldo !== null ? row[config.colMapping.saldo] : 0);

    if (ingreso === 0 && egreso === 0) continue;

    const finalFecha = parsedFecha || lastDate;
    if (!finalFecha) { console.warn(`  ⚠️  Fila ${r+1}: sin fecha, saltando`); continue; }

    const rawConcepto = config.colMapping.concepto !== null ? row[config.colMapping.concepto] : null;
    const rawFactura  = config.colMapping.factura  !== null ? row[config.colMapping.factura]  : null;
    const rawCc       = config.colMapping.cc       !== null ? row[config.colMapping.cc]       : null;
    const ccName = rawCc ? rawCc.toString().trim() : null;
    if (ccName) costCentersNeeded.add(ccName);

    movements.push({
      excelRow: r + 1,
      fecha: finalFecha,
      tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
      monto: ingreso > 0 ? ingreso : egreso,
      nombre_tercero: cleanTerceroName(rawNombre),
      concepto: rawConcepto ? rawConcepto.toString().trim() : null,
      factura: rawFactura ? rawFactura.toString().trim() : '',
      saldo_excel: saldoExcel,
      cc_temp: ccName
    });
  }

  console.log(`  ${movements.length} movimientos encontrados`);
  if (movements.length === 0) { console.warn('  ⚠️  Sin movimientos, saltando.'); return; }

  // Saldo final = último movimiento con saldo != 0
  const lastSaldoMov = [...movements].reverse().find(m => m.saldo_excel !== 0);
  const lastSaldo = lastSaldoMov ? lastSaldoMov.saldo_excel : 0;
  const finalIdx = movements.reduce((last, m, i) => (m.saldo_excel !== 0 ? i : last), -1);

  // Sincronizar centros de costo
  for (const cc of costCentersNeeded) {
    await supabase.from('centros_costo').upsert({ nombre: cc }, { onConflict: 'nombre' });
  }
  const { data: freshCCs } = await supabase.from('centros_costo').select('*');

  // Limpiar movimientos anteriores
  const { error: delErr } = await supabase.from('movimientos').delete().eq('cuenta_id', dbAccount.id);
  if (delErr) { console.error(`  ❌ Error borrando: ${delErr.message}`); return; }

  // Insertar secuencialmente con saldo acumulado
  let runningBalance = saldoInicial;
  let insertCount = 0;

  for (let idx = 0; idx < movements.length; idx++) {
    const m = movements[idx];

    if (m.tipo === 'Ingreso') runningBalance += m.monto;
    else runningBalance -= m.monto;

    // Saldo en este momento: del Excel si existe, sino el calculado
    const saldoEnEsteMomento = m.saldo_excel !== 0 ? m.saldo_excel : runningBalance;

    const ccObj = freshCCs ? freshCCs.find(c => c.nombre && c.nombre.toUpperCase() === m.cc_temp?.toUpperCase()) : null;

    let finalFactura = m.factura || '';
    if (idx === finalIdx) {
      finalFactura = `${finalFactura} [BANCO: ${lastSaldo.toFixed(2)}]`.trim();
    }

    const record = {
      id: crypto.randomUUID(),
      cuenta_id: dbAccount.id,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: m.monto,
      nombre_tercero: m.nombre_tercero,
      concepto: m.concepto,
      factura: finalFactura || null,
      centro_costo_id: ccObj ? ccObj.id : null,
      temporada_id: null,
      saldoo: saldoEnEsteMomento
    };

    let insErr = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await supabase.from('movimientos').insert(record);
      insErr = res.error;
      if (!insErr) break;
      const isNet = insErr.message?.includes('fetch') || insErr.message?.includes('network') || insErr.code === 'ECONNRESET';
      if (!isNet || attempt === 4) break;
      await new Promise(r => setTimeout(r, attempt * 1500));
    }

    if (insErr) {
      console.error(`  ❌ Fila ${m.excelRow}: ${insErr.message}`);
      throw new Error(`Fallo en inserción para ${config.accountDesc}`);
    }

    insertCount++;
    if (insertCount % 200 === 0) console.log(`    ⏳ ${insertCount}/${movements.length}...`);
  }

  console.log(`  ✅ ${insertCount} movimientos insertados | Saldo final: ${lastSaldo.toLocaleString('es-MX')}`);
}

async function run() {
  console.log('🚀 Importando BANCOS 2025 ACTUALIZADO OK.xlsx...\n');

  const { data: accounts, error: accErr } = await supabase.from('cuentas_bancarias').select('*');
  if (accErr || !accounts) { console.error('❌ Cuentas:', accErr?.message); return; }
  console.log(`BD cuentas: ${accounts.map(a => a.descripcion.trim()).join(' | ')}\n`);

  for (const config of sheetsConfig) {
    await processSheet(config, accounts);
  }

  console.log('\n✨ Importación 2025 completada exitosamente.');
}

run().catch(err => {
  console.error('\n🔥 ERROR:', err.message);
  process.exit(1);
});

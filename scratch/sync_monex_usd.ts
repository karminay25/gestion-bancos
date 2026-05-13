import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const ACCOUNT_ID = '3690f38f-6ea9-46de-b8cc-e183e0542ab5';
const SHEET_NAME = 'MONEX USD';
const COLS = [0, 3, 4, 2, 7, 8, 9, 5]; // Date, Ingreso, Egreso, Nombre, Factura, Concepto, C.D Costo, Saldo

function parse(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/[\$,\s]/g, '')) || 0;
    return 0;
}

function getISO(s: any) {
    if (typeof s !== 'number') return null;
    return new Date((s - 25569) * 86400000).toISOString().split('T')[0];
}

async function syncMonexUSD() {
    console.log(`=== SYNC DEFINITIVE: ${SHEET_NAME} ===`);
    
    // 1. Clear existing movements for THIS account only
    const { error: delErr } = await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID);
    if (delErr) { console.error('Error clearing account:', delErr); return; }
    console.log('Account cleared.');

    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[SHEET_NAME];
    if (!sheet) { console.error('Sheet not found'); return; }
    const d: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const m = COLS;

    const payload: any[] = [];
    let mathBalance = 0;
    let lastExcelSaldo = 0;
    let lastDate = '2026-01-01';
    let started = false;

    for (let i = 0; i < d.length; i++) {
        const row = d[i];
        if (!row || row.length === 0) continue;

        const dateIso = getISO(row[m[0]]);
        if (dateIso) lastDate = dateIso;

        const nombre = row[m[3]]?.toString().trim() || "";
        const ing = parse(row[m[1]]);
        const egr = parse(row[m[2]]);
        const saldo = parse(row[m[7]]);

        if (!started) {
            if (saldo !== 0 || nombre.toUpperCase().includes('SALDO INICIAL')) {
                started = true;
                let startMonto = saldo;
                
                if (!nombre.toUpperCase().includes('SALDO INICIAL') && (ing !== 0 || egr !== 0)) {
                    startMonto = saldo - (ing - egr);
                }

                mathBalance = startMonto;
                lastExcelSaldo = saldo;

                payload.push({
                    id: `00000000-0000-0000-bba3-${payload.length.toString().padStart(12, '0')}`,
                    cuenta_id: ACCOUNT_ID,
                    fecha: lastDate,
                    nombre_tercero: 'SALDO INICIAL',
                    monto: startMonto,
                    tipo: 'Ingreso',
                    concepto: 'Balance de Apertura (Excel)'
                });
                console.log(`Starting at row ${i+1} with balance ${startMonto}`);
                
                if (nombre.toUpperCase().includes('SALDO INICIAL')) continue;
            } else {
                continue;
            }
        }

        if (ing === 0 && egr === 0) {
            if (saldo !== 0) lastExcelSaldo = saldo;
            continue;
        }

        const monto = ing || egr;
        const tipo = ing > 0 ? 'Ingreso' : 'Egreso';
        mathBalance += (tipo === 'Ingreso' ? monto : -monto);
        lastExcelSaldo = saldo || lastExcelSaldo;

        payload.push({
            id: `00000000-0000-0000-bba3-${payload.length.toString().padStart(12, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: lastDate,
            nombre_tercero: nombre || 'S/N',
            monto,
            tipo,
            factura: row[m[4]]?.toString() || null,
            concepto: row[m[5]]?.toString() || null,
            centro_costo_id: CC[row[m[6]]?.toString().trim() as keyof typeof CC] || null
        });
    }

    const drift = lastExcelSaldo - mathBalance;
    if (Math.abs(drift) > 0.01) {
        console.log(`Drift detected: ${drift.toFixed(2)}. Adding adjustment.`);
        payload.push({
            id: `00000000-0000-0000-bba3-${payload.length.toString().padStart(12, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: lastDate,
            nombre_tercero: 'AJUSTE EXCEL',
            monto: Math.abs(drift),
            tipo: drift > 0 ? 'Ingreso' : 'Egreso',
            concepto: 'Ajuste final para coincidir 100% con el saldo del Excel.'
        });
    }

    console.log(`Inserting ${payload.length} movements...`);
    const BATCH = 50;
    for (let i = 0; i < payload.length; i += BATCH) {
        const batch = payload.slice(i, i + BATCH);
        const { error } = await supabase.from('movimientos').insert(batch);
        if (error) {
            console.error(`Error in batch ${i}:`, error.message);
            for (const item of batch) {
                const { error: singleErr } = await supabase.from('movimientos').insert(item);
                if (singleErr) console.error('Single insert fail:', singleErr.message, item.nombre_tercero);
            }
        } else {
            process.stdout.write('.');
        }
    }
    console.log('\nSync complete!');
}

syncMonexUSD();

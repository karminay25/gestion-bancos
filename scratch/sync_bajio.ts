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

const ACCOUNTS = [
  { id: 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8', sheet: 'BAJIO PESOS', prefix: 'ba41', cols: [0, 3, 4, 2, 7, -1, -1, 5] },
  { id: '16806e60-2b77-48c8-98b6-3e40c0505247', sheet: 'BAJIO USD',   prefix: 'ba42', cols: [0, 5, 6, 1, 4, 2, 3, 7] },
  { id: '8299de99-89fb-4a93-9b27-b91a0ceeaea6', sheet: 'BAJIO USD',   prefix: 'ba43', cols: [10, 15, 16, 11, 14, 12, 13, 17] }
];

function parse(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/[\$,\s]/g, '')) || 0;
    return 0;
}

function getISO(s: any) {
    if (typeof s !== 'number') return null;
    let d = new Date((s - 25569) * 86400000);
    if (d.getFullYear() === 2024 || d.getFullYear() === 2001) d.setFullYear(2025);
    return d.toISOString().split('T')[0];
}

async function syncAccount(cfg: typeof ACCOUNTS[0], wb: XLSX.WorkBook) {
    console.log(`\n>>> Syncing ${cfg.sheet} (${cfg.id})...`);
    const sheet = wb.Sheets[cfg.sheet];
    if (!sheet) { console.error(`Sheet ${cfg.sheet} not found`); return; }
    
    const d: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const m = cfg.cols;

    await supabase.from('movimientos').delete().eq('cuenta_id', cfg.id);

    const payload: any[] = [];
    let mathBalance = 0;
    let lastExcelSaldo = 0;
    let lastDate = '2025-01-01';
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
            // Bajio sheets sometimes don't have "SALDO INICIAL" text, just a first row with saldo
            if (saldo !== 0) {
                started = true;
                let startMonto = saldo;
                if (ing !== 0 || egr !== 0) {
                    startMonto = saldo - (ing - egr);
                }
                mathBalance = startMonto;
                lastExcelSaldo = saldo;

                payload.push({
                    id: `00000000-0000-0000-${cfg.prefix}-000000000000`,
                    cuenta_id: cfg.id,
                    fecha: '2025-01-01',
                    nombre_tercero: 'SALDO INICIAL',
                    monto: startMonto,
                    tipo: 'Ingreso',
                    concepto: 'Balance de Apertura (Excel)',
                    created_at: '2025-01-01T00:00:00Z'
                });
            } else continue;
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
            id: `00000000-0000-0000-${cfg.prefix}-${(payload.length).toString().padStart(12, '0')}`,
            cuenta_id: cfg.id,
            fecha: lastDate,
            nombre_tercero: nombre || 'S/N',
            monto,
            tipo,
            factura: m[4] !== -1 ? row[m[4]]?.toString() || null : null,
            concepto: m[5] !== -1 ? row[m[5]]?.toString() || null : null,
            centro_costo_id: m[6] !== -1 ? CC[row[m[6]]?.toString().trim() as keyof typeof CC] || null : null
        });
    }

    const drift = lastExcelSaldo - mathBalance;
    if (Math.abs(drift) > 0.01) {
        payload.push({
            id: `00000000-0000-0000-${cfg.prefix}-ffffffffffff`,
            cuenta_id: cfg.id,
            fecha: lastDate,
            nombre_tercero: 'AJUSTE EXCEL',
            monto: Math.abs(drift),
            tipo: drift > 0 ? 'Ingreso' : 'Egreso',
            concepto: 'Ajuste final.'
        });
    }

    console.log(`Inserting ${payload.length} rows...`);
    const { error } = await supabase.from('movimientos').insert(payload);
    if (error) console.error('Error inserting:', error.message);
    else console.log('Success!');
}

async function main() {
    const wb = XLSX.readFile(EXCEL_PATH);
    for (const cfg of ACCOUNTS) {
        await syncAccount(cfg, wb);
    }
}

main();

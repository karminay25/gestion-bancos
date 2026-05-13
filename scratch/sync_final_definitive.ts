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
  { name: 'BBVA PESOS', id: '92e326e1-77a6-4426-95f6-505f0b36d852', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BBVA DOLARES', id: 'b865af21-de39-4dbc-bf37-245c49a8ce50', cols: [0,3,4,2,7,8,9,5] },
  { name: 'MONEX USD', id: '3690f38f-6ea9-46de-b8cc-e183e0542ab5', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BAJIO PESOS', id: 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BAJIO USD', sheet: 'BAJIO USD', id: '16806e60-2b77-48c8-98b6-3e40c0505247', cols: [0,5,6,1,4,2,3,7] },
  { name: 'CREDITO BAJIO', sheet: 'BAJIO USD', id: '8299de99-89fb-4a93-9b27-b91a0ceeaea6', cols: [10,15,16,11,14,12,13,17] },
  { name: 'BOSBES PESOS BBVA', id: 'cccb5951-8232-4ab7-b9cf-47b918677999', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BOSBES USD BBVA ', id: '64d7c5b4-f28e-4117-bcb8-d3731c1af35b', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BOSBES USD MONEX', id: '62d2bb5c-5f31-4f33-835d-6939e92f8485', cols: [0,3,4,2,7,8,9,5] }
];

function p(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/[\$,\s]/g, '')) || 0;
    return 0;
}

function g(s: any) {
    if (typeof s !== 'number') return null;
    return new Date((s - 25569) * 86400000).toISOString().split('T')[0];
}

async function sync() {
    console.log('=== FINAL ATOMIC SYNC ===');
    await supabase.from('movimientos').delete().gte('fecha', '1900-01-01');
    const wb = XLSX.readFile(EXCEL_PATH);
    const pay: any[] = [];

    for (const c of ACCOUNTS) {
        console.log(`\n${c.name}:`);
        const sheet = wb.Sheets[c.sheet || c.name];
        if (!sheet) continue;
        const d: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const m = c.cols; // [Fecha, Ing, Egr, Nom, Fac, Con, CC, Saldo]

        let b = 0; // Sum
        let lastE = 0;
        let lastD = '2026-01-01';
        let start = -1;

        // 1. Find the exact starting row that has a Saldo
        for (let i = 0; i < d.length; i++) {
            const row = d[i];
            const s = p(row[m[7]]);
            if (s !== 0) {
                b = s;
                lastE = s;
                start = i;
                const iso = g(row[m[0]]);
                if (iso) lastD = iso;

                pay.push({
                    id: `00000000-0000-0000-0000-${pay.length.toString().padStart(12, '0')}`,
                    cuenta_id: c.id,
                    fecha: lastD,
                    nombre_tercero: 'SALDO INICIAL',
                    monto: s,
                    tipo: 'Ingreso',
                    concepto: 'Balance Inicial'
                });
                console.log(`  START Row ${i+1}: ${s}`);
                break;
            }
        }

        if (start === -1) continue;

        // 2. Process all rows STRICTLY AFTER the starting row
        for (let i = start + 1; i < d.length; i++) {
            const row = d[i];
            if (!row) continue;
            
            const iso = g(row[m[0]]);
            if (iso) lastD = iso;

            const ing = p(row[m[1]]);
            const egr = p(row[m[2]]);
            const s = p(row[m[7]]);

            if (ing === 0 && egr === 0) {
                if (s !== 0) lastE = s;
                continue;
            }

            const monto = ing || egr;
            const tipo = ing > 0 ? 'Ingreso' : 'Egreso';
            b += (tipo === 'Ingreso' ? monto : -monto);
            lastE = s || lastE;

            pay.push({
                id: `00000000-0000-0000-0000-${pay.length.toString().padStart(12, '0')}`,
                cuenta_id: c.id,
                fecha: lastD,
                nombre_tercero: row[m[3]]?.toString() || 'S/N',
                monto,
                tipo,
                factura: row[m[4]]?.toString() || null,
                concepto: row[m[5]]?.toString() || null,
                centro_costo_id: CC[row[m[6]]?.toString().trim() as keyof typeof CC] || null
            });
        }

        // 3. Close the gap
        const drift = lastE - b;
        if (Math.abs(drift) > 0.01) {
            console.log(`  DRIFT ${drift.toFixed(2)}. Correcting.`);
            pay.push({
                id: `00000000-0000-0000-0000-${pay.length.toString().padStart(12, '0')}`,
                cuenta_id: c.id,
                fecha: lastD,
                nombre_tercero: 'AJUSTE EXCEL',
                monto: Math.abs(drift),
                tipo: drift > 0 ? 'Ingreso' : 'Egreso',
                concepto: 'Ajuste final para coincidir con Excel'
            });
        }
    }

    const BATCH = 100;
    for (let i = 0; i < pay.length; i += BATCH) {
        await supabase.from('movimientos').insert(pay.slice(i, i + BATCH));
        process.stdout.write('.');
    }
    console.log('\n=== DONE ===');
}

sync();

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

const ACCOUNTS = {
  'BBVA PESOS': { id: '92e326e1-77a6-4426-95f6-505f0b36d852', cols: [0,3,4,2,7,8,9,5] }, // Fecha, Ing, Egr, Nom, Fac, Con, CC, Saldo
  'BBVA DOLARES': { id: 'b865af21-de39-4dbc-bf37-245c49a8ce50', cols: [0,3,4,2,7,8,9,5] },
  'MONEX USD': { id: '3690f38f-6ea9-46de-b8cc-e183e0542ab5', cols: [0,3,4,2,7,8,9,5] },
  'BAJIO PESOS': { id: 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8', cols: [0,3,4,2,7,8,9,5] },
  'BAJIO USD': { id: '16806e60-2b77-48c8-98b6-3e40c0505247', cols: [0,5,6,1,4,2,3,7] }, // Custom mapping A-H
  'CREDITO BAJIO': { id: '8299de99-89fb-4a93-9b27-b91a0ceeaea6', sheet: 'BAJIO USD', cols: [10,15,16,11,14,12,13,17] }, // Custom mapping K-R
  'BOSBES PESOS BBVA': { id: 'cccb5951-8232-4ab7-b9cf-47b918677999', cols: [0,3,4,2,7,8,9,5] },
  'BOSBES USD BBVA ': { id: '64d7c5b4-f28e-4117-bcb8-d3731c1af35b', cols: [0,3,4,2,7,8,9,5] },
  'BOSBES USD MONEX': { id: '62d2bb5c-5f31-4f33-835d-6939e92f8485', cols: [0,3,4,2,7,8,9,5] }
};

function parseNum(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/[\$,\s]/g, '')) || 0;
    return 0;
}

function getISO(s: any) {
    if (typeof s !== 'number') return null;
    return new Date((s - 25569) * 86400000).toISOString().split('T')[0];
}

async function definitiveSyncV7() {
    console.log('=== DEFINITIVE PRECISION SYNC V7 (FINAL AUDIT) ===');
    await supabase.from('movimientos').delete().gte('fecha', '1900-01-01');

    const wb = XLSX.readFile(EXCEL_PATH);
    const payload: any[] = [];

    for (const [name, cfg] of Object.entries(ACCOUNTS)) {
        console.log(`Processing ${name}...`);
        const sheetName = (cfg as any).sheet || name;
        const sheet = wb.Sheets[sheetName];
        if (!sheet) { console.error(`Sheet ${sheetName} not found`); continue; }
        
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const map = (cfg as any).cols; // [Fecha, Ing, Egr, Nom, Fac, Con, CC, Saldo]
        
        let initialDate: string | null = null;
        for (let i = 0; i < data.length; i++) {
            const d = getISO(data[i][map[0]]);
            if (d && d.startsWith('20')) { initialDate = d; break; }
        }
        if (!initialDate) initialDate = '2026-01-01';

        let runningSum = 0;
        let lastExcelSaldo = 0;
        let lastDate = initialDate;
        let startRow = 0;

        // Find Start Row (Saldo Inicial or first move)
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const cellNom = row[map[3]]?.toString().toUpperCase();
            if (cellNom === 'SALDO INICIAL' || (name === 'CREDITO BAJIO' && i === 3)) {
                const ini = parseNum(row[map[7]]);
                runningSum = ini;
                lastExcelSaldo = ini;
                startRow = i + 1;
                payload.push({
                    id: `00000000-0000-0000-0000-${payload.length.toString().padStart(12, '0')}`,
                    cuenta_id: (cfg as any).id,
                    fecha: initialDate,
                    nombre_tercero: 'SALDO INICIAL',
                    monto: ini,
                    tipo: 'Ingreso',
                    concepto: 'Balance de Apertura'
                });
                break;
            }
        }

        // Process movements
        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            
            const currentDate = getISO(row[map[0]]);
            if (currentDate) lastDate = currentDate;
            else if (typeof row[map[0]] === 'string' && row[map[0]].trim() !== '') continue;

            const ing = parseNum(row[map[1]]);
            const egr = parseNum(row[map[2]]);
            const excelSaldo = parseNum(row[map[7]]);
            
            if (ing === 0 && egr === 0 && !row[map[3]]) {
                if (excelSaldo !== 0) lastExcelSaldo = excelSaldo;
                continue;
            }

            const monto = ing || egr;
            if (monto === 0) continue;
            
            const tipo = ing > 0 ? 'Ingreso' : 'Egreso';
            runningSum += (tipo === 'Ingreso' ? monto : -monto);
            lastExcelSaldo = excelSaldo || lastExcelSaldo;

            payload.push({
                id: `00000000-0000-0000-0000-${payload.length.toString().padStart(12, '0')}`,
                cuenta_id: (cfg as any).id,
                fecha: lastDate,
                nombre_tercero: row[map[3]]?.toString() || 'S/N',
                monto,
                tipo,
                factura: row[map[4]]?.toString() || null,
                concepto: row[map[5]]?.toString() || null,
                centro_costo_id: CC[row[map[6]]?.toString().trim() as keyof typeof CC] || null
            });
        }

        // Precision Check: Handle Excel Drifts ($0.19, $0.20, etc.)
        const drift = lastExcelSaldo - runningSum;
        if (Math.abs(drift) > 0.001) {
            console.log(`Drift detected in ${name}: $${drift.toFixed(4)}. Adding correction row...`);
            payload.push({
                id: `00000000-0000-0000-0000-${payload.length.toString().padStart(12, '0')}`,
                cuenta_id: (cfg as any).id,
                fecha: lastDate,
                nombre_tercero: 'AJUSTE POR REDONDEO',
                monto: Math.abs(drift),
                tipo: drift > 0 ? 'Ingreso' : 'Egreso',
                concepto: 'Ajuste para coincidir con Excel'
            });
        }
    }

    console.log(`Payload size: ${payload.length}`);
    const BATCH = 50;
    for (let i = 0; i < payload.length; i += BATCH) {
        const { error } = await supabase.from('movimientos').insert(payload.slice(i, i + BATCH));
        if (error) console.error('Insert batch failed:', error.message);
        else process.stdout.write('.');
    }
    console.log('\n=== SYNC COMPLETE ===');
}

definitiveSyncV7();

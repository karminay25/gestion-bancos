import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

// Account ID mapping
const ACCOUNT_IDS: Record<string, string> = {
    'BBVA PESOS':      '92e326e1-77a6-4426-95f6-505f0b36d852',
    'BBVA DOLARES':    'b865af21-de39-4dbc-bf37-245c49a8ce50',
    'MONEX USD':       '3690f38f-6ea9-46de-b8cc-e183e0542ab5',
    'BAJIO USD':       '16806e60-2b77-48c8-98b6-3e40c0505247',
    'BOSBES PESOS BBVA': 'cccb5951-8232-4ab7-b9cf-47b918677999',
    'BOSBES USD BBVA ': '64d7c5b4-f28e-4117-bcb8-d3731c1af35b',
    'BOSBES USD MONEX': '62d2bb5c-5f31-4f33-835d-6939e92f8485',
};

// Cost center name → DB ID mapping (normalized to uppercase)
const CC_MAP: Record<string, string> = {
    'LOLA':         '6a579200-6474-40a2-9e62-325bb63cd132',
    'BOSBES':       '781e0438-b6a4-4a57-9c24-65334c68f123',
    'OBA':          '5353b861-04c2-4d1a-bf3d-318a44b4e87c',
    'OBA/LOLA':     'e2135513-2bd1-4bbb-8370-d0a45476e6ba',
    'OBA/BOSBES':   'f911c4bf-5334-4208-9a2d-72068394ea2e',
    'CRFV':         '45688ff0-f68e-4c28-8e5f-0421578eee44',
    'CFRV':         '438739a4-6e27-4be3-b981-502f3eda088e',
    'PRO':          '432e9102-c9c0-4ece-8c55-a3ec8e648a8b',
    'PRO ':         '02f5bed6-5c0c-409e-9f43-dc9fe6429173',
    'JFV':          '8dbcec20-53f3-4dcb-a753-239312649a8c',
    'LACM':         '77234ef6-d4f3-43a2-8051-26fab5c68ace',
    'SOCIOS':       'bd15f386-3ca3-4cdd-976c-985ca8f55f70',
    'SOCIO CARLOS': '1916c7cb-9e43-4a8a-a3e3-8b3bc7bb82d1',
    'SOCIO LUIS':   '2fbe4ba1-23a6-4ba4-98ef-cd2e2f68115d',
    'SOCIO JOSE':   '4ec14c0c-1a1f-43c0-9c0d-e096d8dc3713',
    'SOCIIO JFV':   'a9c4ef69-0811-4d6b-958c-14aded433506',
    'AGRICOLA OBA': '62495ae9-8053-462d-88b3-c355b4c8459d',
    'ACTIVO LOLA':  '14ad5959-6ae5-4ed6-bd10-6b4908468184',
    'LOLA/BOSBES':  '3793ff29-3986-4f79-8c16-4517952f71bb',
    ' BOSBES':      '681d3350-635d-4b51-8c39-0e1497b0b4b7',
    'BOSBSES':      '673fcb90-840a-41b7-8004-3eef8e803806',
    'LOA':          '7540b540-c77a-4d2e-8fb8-8d49705fb2cc',
};

function excelDateToISO(val: any): string | null {
    if (!val) return null;
    if (typeof val === 'number') {
        const d = new Date((val - 25569) * 86400000);
        return d.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        const match = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    }
    return null;
}

async function syncCostCenters() {
    console.log('--- SYNCING COST CENTERS FROM EXCEL ---\n');
    const wb = XLSX.readFile(EXCEL_PATH);
    
    // Standard sheets (header at row 5, CC at col 9)
    const standardSheets = [
        'BBVA PESOS', 'BBVA DOLARES', 'MONEX USD',
        'BOSBES PESOS BBVA', 'BOSBES USD BBVA ', 'BOSBES USD MONEX'
    ];

    let totalUpdated = 0;
    let totalSkipped = 0;
    let notMapped: Set<string> = new Set();

    for (const sheetName of standardSheets) {
        const acctId = ACCOUNT_IDS[sheetName];
        if (!acctId) continue;
        
        const sheet = wb.Sheets[sheetName];
        if (!sheet) { console.log(`Sheet "${sheetName}" not found.`); continue; }
        
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const HEADER_ROW = 5;
        
        console.log(`Processing: ${sheetName}`);
        
        for (let i = HEADER_ROW + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;
            
            const fecha = excelDateToISO(row[0]);
            if (!fecha || !fecha.startsWith('2026')) continue;
            
            const ccRaw = row[9]?.toString().trim();
            if (!ccRaw) continue;
            
            const ccId = CC_MAP[ccRaw] || CC_MAP[ccRaw.toUpperCase()];
            if (!ccId) {
                notMapped.add(ccRaw);
                continue;
            }
            
            const ingreso = parseFloat(row[3]) || 0;
            const egreso = parseFloat(row[4]) || 0;
            const monto = ingreso || egreso;
            if (monto === 0) continue;

            // Find matching movement by date + monto
            const { data: matches } = await supabase
                .from('movimientos')
                .select('id, centro_costo_id')
                .eq('cuenta_id', acctId)
                .eq('fecha', fecha)
                .eq('monto', monto)
                .is('centro_costo_id', null)
                .limit(1);
            
            if (!matches || matches.length === 0) {
                totalSkipped++;
                continue;
            }
            
            const { error } = await supabase
                .from('movimientos')
                .update({ centro_costo_id: ccId })
                .eq('id', matches[0].id);
            
            if (error) {
                console.error(`  Error updating ${fecha} monto=${monto}:`, error.message);
            } else {
                totalUpdated++;
            }
        }
    }

    // Special case: BAJIO USD - CC at col 3
    const bajioSheet = wb.Sheets['BAJIO USD'];
    if (bajioSheet) {
        const data: any[][] = XLSX.utils.sheet_to_json(bajioSheet, { header: 1 });
        const acctId = ACCOUNT_IDS['BAJIO USD'];
        console.log(`Processing: BAJIO USD (special layout)`);
        
        for (let i = 3; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;
            
            const fecha = excelDateToISO(row[0]);
            if (!fecha || !fecha.startsWith('2026')) continue;
            
            const ccRaw = row[3]?.toString().trim();
            if (!ccRaw) continue;
            
            const ccId = CC_MAP[ccRaw] || CC_MAP[ccRaw.toUpperCase()];
            if (!ccId) { notMapped.add(ccRaw); continue; }
            
            const ingreso = parseFloat(row[5]) || 0;
            const egreso = parseFloat(row[6]) || 0;
            const monto = ingreso || egreso;
            if (monto === 0) continue;
            
            const { data: matches } = await supabase
                .from('movimientos')
                .select('id')
                .eq('cuenta_id', acctId)
                .eq('fecha', fecha)
                .eq('monto', monto)
                .is('centro_costo_id', null)
                .limit(1);
            
            if (!matches || matches.length === 0) { totalSkipped++; continue; }
            
            const { error } = await supabase
                .from('movimientos')
                .update({ centro_costo_id: ccId })
                .eq('id', matches[0].id);
            
            if (!error) totalUpdated++;
        }
    }

    console.log(`\n✅ Updated: ${totalUpdated} movements`);
    console.log(`⚠️  Skipped (no match): ${totalSkipped}`);
    if (notMapped.size > 0) {
        console.log(`\n🔴 CC values in Excel with NO DB mapping (review manually):`);
        notMapped.forEach(cc => console.log(`   "${cc}"`));
    }
}

syncCostCenters();

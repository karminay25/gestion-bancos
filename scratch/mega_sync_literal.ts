import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const TODAY = new Date('2026-05-01'); // Cutoff for future dates

interface SheetConfig {
    sheet: string;
    accountId: string;
    prefix: string;
    cols: {
        date: number;
        name: number;
        ingreso: number;
        egreso: number;
        saldo: number;
        factura: number;
        concepto: number;
        ccStart: number;
    }
}

const SYNC_CONFIG: SheetConfig[] = [
    { sheet: 'BBVA DOLARES', accountId: 'b865af21-de39-4dbc-bf37-245c49a8ce50', prefix: '1111', cols: { date: 0, name: 2, ingreso: 3, egreso: 4, saldo: 5, factura: 7, concepto: 8, ccStart: 9 } },
    { sheet: 'MONEX USD', accountId: '3690f38f-6ea9-46de-b8cc-e183e0542ab5', prefix: '2222', cols: { date: 0, name: 2, ingreso: 3, egreso: 4, saldo: 5, factura: 7, concepto: 8, ccStart: 9 } },
    { sheet: 'BAJIO PESOS', accountId: 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8', prefix: '3333', cols: { date: 0, name: 1, ingreso: 5, egreso: 6, saldo: 7, factura: 4, concepto: 2, ccStart: 3 } },
    { sheet: 'BAJIO USD', accountId: '16806e60-2b77-48c8-98b6-3e40c0505247', prefix: '4444', cols: { date: 0, name: 1, ingreso: 5, egreso: 6, saldo: 7, factura: 4, concepto: 2, ccStart: 3 } },
    { sheet: 'BAJIO USD', accountId: '8299de99-89fb-4a93-9b27-b91a0ceeaea6', prefix: '9999', cols: { date: 10, name: 11, ingreso: 15, egreso: 16, saldo: 17, factura: 14, concepto: 12, ccStart: 13 } }, // CREDITO BAJIO
    { sheet: 'BOSBES PESOS BBVA', accountId: 'cccb5951-8232-4ab7-b9cf-47b918677999', prefix: '5555', cols: { date: 0, name: 2, ingreso: 3, egreso: 4, saldo: 5, factura: 7, concepto: 8, ccStart: 9 } },
    { sheet: 'BOSBES USD BBVA ', accountId: '64d7c5b4-f28e-4117-bcb8-d3731c1af35b', prefix: '6666', cols: { date: 0, name: 2, ingreso: 3, egreso: 4, saldo: 5, factura: 7, concepto: 8, ccStart: 9 } },
    { sheet: 'BOSBES USD MONEX', accountId: '62d2bb5c-5f31-4f33-835d-6939e92f8485', prefix: '7777', cols: { date: 0, name: 2, ingreso: 3, egreso: 4, saldo: 5, factura: 7, concepto: 8, ccStart: 9 } }
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function megaSyncLiteral() {
    console.log('--- MEGA SYNC: FIXING CREDITO & FUTURE DATES ---');

    const { data: ccData } = await supabase.from('centros_costo').select('*');
    const ccMap: Record<string, string> = {};
    ccData?.forEach(cc => ccMap[cc.nombre.trim().toUpperCase()] = cc.id);

    const wb = XLSX.readFile(EXCEL_PATH);

    for (const config of SYNC_CONFIG) {
        console.log(`\nProcessing Account: ${config.accountId} from Sheet: "${config.sheet}"...`);
        
        await supabase.from('movimientos').delete().eq('cuenta_id', config.accountId);

        const sheet = wb.Sheets[config.sheet];
        if (!sheet) { console.error(`Sheet "${config.sheet}" not found!`); continue; }
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const payload: any[] = [];

        let lastValidDate = '2025-01-01';

        data.forEach((row, i) => {
            const c = config.cols;
            const nombre = row[c.name]?.toString() || "";
            const dateRaw = row[c.date];
            const ingreso = parseFloat(row[c.ingreso]) || 0;
            const egreso = parseFloat(row[c.egreso]) || 0;
            const monto = ingreso || egreso;
            const saldoLiteral = parseFloat(row[c.saldo]) || 0;

            let dateIso = "";
            if (nombre === 'SALDO INICIAL') dateIso = lastValidDate;
            else if (typeof dateRaw === 'number') {
                const d = new Date((dateRaw - 25569) * 86400000);
                // SKIP FUTURE DATES (TYPOS IN EXCEL)
                if (d > TODAY) {
                    console.log(`  Skipping future date typo: ${d.toISOString()} in row ${i}`);
                    return;
                }
                dateIso = d.toISOString().split('T')[0];
                lastValidDate = dateIso;
            } else if (monto > 0) dateIso = lastValidDate;
            else return;

            const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
            const concepto = row[c.concepto]?.toString() || "";
            const factura = row[c.factura]?.toString() || "";
            const facturaLiteral = factura && factura !== 'null' ? factura : '';
            
            let ccId = null;
            for (let j = c.ccStart; j < row.length; j++) {
                const val = row[j]?.toString().trim().toUpperCase();
                if (val && ccMap[val]) { ccId = ccMap[val]; break; }
            }

            payload.push({
                id: `00000000-0000-0000-${config.prefix}-${i.toString(16).padStart(12, '0')}`,
                cuenta_id: config.accountId,
                fecha: dateIso,
                nombre_tercero: nombre || "S/N",
                concepto: concepto,
                monto: monto,
                tipo: tipo,
                factura: `${facturaLiteral} [BANCO: ${saldoLiteral.toFixed(2)}]`,
                centro_costo_id: ccId
            });
        });

        if (payload.length > 0) {
            console.log(`Inserting ${payload.length} movements...`);
            for (let i = 0; i < payload.length; i += 100) {
                const chunk = payload.slice(i, i + 100);
                const { error } = await supabase.from('movimientos').insert(chunk);
                if (error) { console.error(`Error:`, error.message); return; }
            }
        }
    }

    console.log('\n--- MEGA SYNC COMPLETE ---');
}

megaSyncLiteral();

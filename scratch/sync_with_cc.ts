import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const RSM_PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function finalLiteralSyncWithCC() {
    console.log('--- STARTING LITERAL SYNC WITH COST CENTERS (FIXING DUPLICATES) ---');

    const { data: ccData } = await supabase.from('centros_costo').select('*');
    const ccMap: Record<string, string> = {};
    ccData?.forEach(cc => {
        ccMap[cc.nombre.trim().toUpperCase()] = cc.id;
    });

    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID);

    const wb = XLSX.readFile(EXCEL_PATH);
    const masterData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets['BBVA PESOS'], { header: 1 });
    const masterPayload: any[] = [];

    masterData.forEach((row, i) => {
        const nombre = row[2]?.toString() || "";
        const dateRaw = row[0];
        
        let dateIso = "";
        if (nombre === 'SALDO INICIAL') {
            dateIso = '2026-01-01';
        } else if (typeof dateRaw === 'number') {
            if (dateRaw === 46809) dateIso = '2026-03-23';
            else {
                const d = new Date((dateRaw - 25569) * 86400000);
                if (d.getFullYear() < 2025 || d.getFullYear() > 2026) d.setFullYear(2026);
                dateIso = d.toISOString().split('T')[0];
            }
        } else return;

        const ingreso = parseFloat(row[3]) || 0;
        const egreso = parseFloat(row[4]) || 0;
        const monto = ingreso || egreso;
        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        const saldoLiteral = parseFloat(row[5]) || 0;
        const concepto = row[8]?.toString() || row[7]?.toString() || "";
        const factura = row[7]?.toString() || "";
        
        let ccId = null;
        for (let j = 10; j < row.length; j++) {
            const val = row[j]?.toString().trim().toUpperCase();
            if (val && ccMap[val]) {
                ccId = ccMap[val];
                break;
            }
        }

        masterPayload.push({
            id: `00000000-0000-0000-3333-a${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${factura} [BANCO: ${saldoLiteral.toFixed(2)}]`,
            centro_costo_id: ccId
        });
    });

    console.log(`Inserting ${masterPayload.length} movements with CC...`);
    for (let i = 0; i < masterPayload.length; i += 50) {
        await supabase.from('movimientos').insert(masterPayload.slice(i, i + 50));
    }

    const wbRSM = XLSX.readFile(RSM_PATH);
    const rsmData: any[][] = XLSX.utils.sheet_to_json(wbRSM.Sheets[wbRSM.SheetNames[0]], { header: 1 });
    // ONLY April 8 onwards
    const rsmRows = rsmData.slice(2).filter(row => {
        if (typeof row[0] !== 'number') return false;
        const date = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        return date > '2026-04-07';
    });
    rsmRows.reverse();

    const rsmPayload = rsmRows.map((row, i) => {
        const d = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        const monto = parseFloat(row[5]) || parseFloat(row[4]);
        const tipo = row[5] ? 'Ingreso' : 'Egreso';
        const concepto = row[3]?.toString().trim() || row[1]?.toString().trim();
        const nombre = row[1]?.toString().trim() + ' ' + (row[2]?.toString().trim() || '');
        const saldoLiteral = parseFloat(row[6]) || 0;
        const referencia = row[2]?.toString().trim() || '';

        return {
            id: `00000000-0000-0000-3333-b${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: d,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${referencia} [BANCO: ${saldoLiteral.toFixed(2)}]`
        };
    });

    if (rsmPayload.length > 0) {
        console.log(`Inserting ${rsmPayload.length} RSM movements...`);
        await supabase.from('movimientos').insert(rsmPayload);
    }

    console.log('SYNC COMPLETE.');
}

finalLiteralSyncWithCC();

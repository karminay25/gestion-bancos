import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const ACCOUNT_ID = 'b865af21-de39-4dbc-bf37-245c49a8ce50';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function syncLolaUSD() {
    console.log('--- STARTING LITERAL SYNC FOR LOLA BBVA DOLARES (FIXING MISSING DATES) ---');

    const { data: ccData } = await supabase.from('centros_costo').select('*');
    const ccMap: Record<string, string> = {};
    ccData?.forEach(cc => ccMap[cc.nombre.trim().toUpperCase()] = cc.id);

    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID);

    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets['BBVA DOLARES'];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const payload: any[] = [];

    let lastValidDate = '2025-01-01';

    data.forEach((row, i) => {
        const nombre = row[2]?.toString() || "";
        const dateRaw = row[0];
        const ingreso = parseFloat(row[3]) || 0;
        const egreso = parseFloat(row[4]) || 0;
        const monto = ingreso || egreso;
        const saldoLiteral = parseFloat(row[5]) || 0;

        let dateIso = "";
        if (nombre === 'SALDO INICIAL') {
            dateIso = lastValidDate;
        } else if (typeof dateRaw === 'number') {
            const d = new Date((dateRaw - 25569) * 86400000);
            dateIso = d.toISOString().split('T')[0];
            lastValidDate = dateIso;
        } else if (monto > 0) {
            // Inheritance logic for rows with missing dates but valid movements
            dateIso = lastValidDate;
        } else return;

        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        const concepto = row[8]?.toString() || row[7]?.toString() || "";
        const factura = row[7]?.toString() || "";
        
        let ccId = null;
        for (let j = 9; j < row.length; j++) {
            const val = row[j]?.toString().trim().toUpperCase();
            if (val && ccMap[val]) {
                ccId = ccMap[val];
                break;
            }
        }

        payload.push({
            id: `00000000-0000-0000-5555-a${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre || "S/N",
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${factura} [BANCO: ${saldoLiteral.toFixed(2)}]`,
            centro_costo_id: ccId
        });
    });

    console.log(`Inserting ${payload.length} literal movements for Lola USD...`);
    for (let i = 0; i < payload.length; i += 50) {
        await supabase.from('movimientos').insert(payload.slice(i, i + 50));
    }

    console.log('USD SYNC COMPLETE.');
}

syncLolaUSD();

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const EXCEL_PATH = 'c:/proyectoResidencias/MONEX BOSBES DEL 010125AL28022026 CONTABILIDAD.xlsx';
const ACCOUNT_ID = '62d2bb5c-5f31-4f33-835d-6939e92f8485'; // BOSBES USD MONEX

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MONTHS: Record<string, string> = {
    'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'
};

async function syncMonexBosbes() {
    console.log('--- SYNCING MONEX BOSBES 2026 (LITERAL) ---');

    // 1. Delete existing 2026 movements
    const { error: delError } = await supabase.from('movimientos')
        .delete()
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-01-01');
    
    if (delError) { console.error('Delete error:', delError.message); return; }

    // 2. Read Excel
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const payload: any[] = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const dateStr = row[0].toString();
        // Expected format: "DD/Mes/YYYY"
        const parts = dateStr.split('/');
        if (parts.length !== 3) continue;

        const day = parts[0].padStart(2, '0');
        const month = MONTHS[parts[1]] || '01';
        const year = parts[2];

        if (year !== '2026') continue;

        const dateIso = `${year}-${month}-${day}`;
        const nombre = row[3]?.toString().trim() || "S/N";
        const concepto = row[1]?.toString().trim() || "";
        const referencia = row[4]?.toString().trim() || "";
        
        const ingreso = parseFloat(row[5]) || 0;
        const egreso = parseFloat(row[6]) || 0;
        const monto = ingreso || egreso;
        
        if (monto === 0) continue; // Skip Diarios/Valuacion with 0 monto

        const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';
        const saldoLiteral = parseFloat(row[7]) || 0;

        payload.push({
            id: `00000000-0000-0000-8888-8${i.toString(16).padStart(11, '0')}`,
            cuenta_id: ACCOUNT_ID,
            fecha: dateIso,
            nombre_tercero: nombre,
            concepto: concepto,
            monto: monto,
            tipo: tipo,
            factura: `${referencia} [BANCO: ${saldoLiteral.toFixed(2)}]`,
            centro_costo_id: null
        });
    }

    console.log(`Inserting ${payload.length} literal movements for 2026...`);
    
    // Insert them in original order (they seem to be chronological in Excel)
    for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabase.from('movimientos').insert(chunk);
        if (error) { console.error('Insert error:', error.message); return; }
    }

    console.log('SYNC COMPLETE.');
}

syncMonexBosbes();

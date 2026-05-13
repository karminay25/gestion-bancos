import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import XLSX from 'xlsx';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FILE_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

async function importMonexHistorical() {
    const wb = XLSX.readFile(FILE_PATH);
    const monexSheets = [
        { sheet: 'MONEX USD', id: '3690f38f-6ea9-46de-b8cc-e183e0542ab5' },
        { sheet: 'BOSBES USD MONEX', id: '62d2bb5c-5f31-4f33-835d-6939e92f8485' }
    ];

    for (const { sheet, id } of monexSheets) {
        console.log(`\nImporting ${sheet}...`);
        const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 });
        
        const movements = [];
        for (let i = 1; i < data.length; i++) { // Skip header
            const row = data[i];
            if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows but keep going

            const fechaRaw = row[0];
            let fecha = '';
            if (typeof fechaRaw === 'number') {
                const d = XLSX.SSF.parse_date_code(fechaRaw);
                fecha = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            } else if (fechaRaw instanceof Date) {
                fecha = fechaRaw.toISOString().split('T')[0];
            } else if (typeof fechaRaw === 'string') {
                const match = fechaRaw.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (match) fecha = fechaRaw;
            }

            if (!fecha) continue;

            const concepto = (row[2] || row[1] || '').toString();
            const ingreso = parseFloat(row[3]) || 0;
            const egreso = parseFloat(row[4]) || 0;
            const saldo = parseFloat(row[5]) || 0;

            if (ingreso === 0 && egreso === 0) continue;

            movements.push({
                cuenta_id: id,
                fecha,
                concepto,
                nombre_tercero: concepto,
                monto: ingreso || egreso,
                tipo: ingreso > 0 ? 'Ingreso' : 'Egreso',
                factura: ` [BANCO: ${saldo.toFixed(2)}]`
            });
        }

        if (movements.length > 0) {
            console.log(`Inserting ${movements.length} movements for ${sheet}`);
            const { error } = await supabase.from('movimientos').insert(movements);
            if (error) console.error('Error inserting:', error);
            else console.log('Imported successfully.');
        }
    }
}

importMonexHistorical();

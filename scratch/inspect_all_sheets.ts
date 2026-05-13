import XLSX from 'xlsx';
import fs from 'fs';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function inspectAll() {
    try {
        const wb = XLSX.readFile(EXCEL_PATH);
        let output = '';
        wb.SheetNames.forEach(sheetName => {
            const sheet = wb.Sheets[sheetName];
            const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            output += `\n--- ${sheetName} ---\n`;
            for (let i = 0; i < 20; i++) {
                const row = data[i];
                if (!row) continue;
                output += `Row ${i}: ${JSON.stringify(row)}\n`;
            }
        });
        fs.writeFileSync('scratch/excel_first_rows.txt', output);
    } catch (e) {
        console.error('Error:', e);
    }
}

inspectAll();

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BAJIO USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BAJIO USD RIGHT TABLE ---');
for (let i = 0; i < 15; i++) {
    const row = data[i];
    if (row && row.length > 10) {
        console.log(`Row ${i} (Right):`, row.slice(10, 18));
    }
}

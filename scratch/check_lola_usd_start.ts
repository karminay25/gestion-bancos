import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BBVA DOLARES'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BBVA DOLARES First Rows ---');
for (let i = 0; i < 15; i++) {
    console.log(`Row ${i}:`, data[i]);
}

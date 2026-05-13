import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['MONEX USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- MONEX USD First Rows ---');
for (let i = 0; i < 10; i++) {
    console.log(`Row ${i}:`, data[i]);
}

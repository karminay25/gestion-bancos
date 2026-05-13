import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BAJIO USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BAJIO USD Rows 20-30 ---');
for (let i = 20; i < 30; i++) {
    console.log(`Row ${i}:`, data[i]);
}

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheetName = 'MONEX USD';
const sheet = wb.Sheets[sheetName];
if (!sheet) {
    console.log(`Sheet "${sheetName}" not found!`);
    process.exit(1);
}
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`--- ${sheetName} Sheet Header (First 15 rows) ---`);
data.slice(0, 15).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
});

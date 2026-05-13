import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/MovimientosContrato (8).xls';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows:', data.length);
console.log('\n--- ALL ROWS WITH CONTENT ---');
for (let i = 0; i < data.length; i++) {
    if (!data[i] || data[i].length === 0) continue;
    console.log(`Row ${i}:`, JSON.stringify(data[i]).substring(0, 120));
}

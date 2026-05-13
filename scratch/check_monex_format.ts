import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/MovimientosContrato (8).xls';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Sheet name:', wb.SheetNames[0]);
console.log('Total rows:', data.length);
console.log('\n--- FIRST 12 ROWS ---');
for (let i = 0; i < 12; i++) {
    console.log(`Row ${i}:`, data[i]);
}
console.log('\n--- LAST 5 ROWS ---');
for (let i = data.length - 5; i < data.length; i++) {
    console.log(`Row ${i}:`, data[i]);
}

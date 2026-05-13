import XLSX from 'xlsx';

const FILE_PATH = 'c:/proyectoResidencias/MOV CUENTAS BAJIO LOLA DE FEB A MARZO 26 (1).xlsx';
const wb = XLSX.readFile(FILE_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows:', data.length);
console.log('\n--- FIRST 20 ROWS ---');
data.slice(0, 20).forEach((row, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row));
});

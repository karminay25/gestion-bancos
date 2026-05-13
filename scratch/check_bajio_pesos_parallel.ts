import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BAJIO PESOS'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BAJIO PESOS Parallel Tables Check ---');
console.log('Row 0:', data[0]);
console.log('Row 1:', data[1]);
console.log('Row 2:', data[2]);
console.log('Row 3:', data[3]);
console.log('Row 5:', data[5]);

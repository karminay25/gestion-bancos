import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BOSBES PESOS BBVA'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BOSBES PESOS BBVA Header ---');
console.log('Row 2:', data[2]);
console.log('Row 3:', data[3]);
console.log('Row 4:', data[4]);
console.log('Row 5:', data[5]);
console.log('Row 6:', data[6]);

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BBVA RSM Columns ---');
console.log('Row 0:', data[0]);
console.log('Row 1:', data[1]);
console.log('Row 2:', data[2]);
console.log('Row 3:', data[3]);
console.log('Row 4:', data[4]);
console.log('Row 5:', data[5]);
console.log('Row 6 (Example Data):', data[6]);

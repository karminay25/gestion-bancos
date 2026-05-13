import XLSX from 'xlsx';

const PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const wb = XLSX.readFile(PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Total rows in RSM: ${data.length}`);
console.log(`First data row (Row 2):`, data[2]);
console.log(`Last data row (Row ${data.length-1}):`, data[data.length-1]);

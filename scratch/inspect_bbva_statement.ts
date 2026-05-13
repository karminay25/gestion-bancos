import XLSX from 'xlsx';

const PATH = 'c:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const wb = XLSX.readFile(PATH);

console.log('Sheets:', wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BBVA Statement Header (First 20 rows) ---');
data.slice(0, 20).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
});

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheetName = 'MONEX USD';
const sheet = wb.Sheets[sheetName];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const targetValue = 681.53;

console.log(`Searching for ${targetValue} in ${sheetName}...`);
data.forEach((row, i) => {
    if (row.includes(targetValue)) {
        console.log(`Found at Row ${i}:`, row);
    }
});

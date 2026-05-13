import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

const sheet = wb.Sheets['BBVA PESOS'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`--- Searching for 703.5 in BBVA PESOS ---`);
data.forEach((row, i) => {
    if (row.includes(703.5)) {
        console.log(`Found in Row ${i}:`, row);
    }
});

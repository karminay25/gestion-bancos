import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

const sheet = wb.Sheets['MONEX USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`--- Searching for 197330.38 ---`);
data.forEach((row, i) => {
    if (row.includes(197330.38)) {
        console.log(`Found in Row ${i}:`, row);
    }
});

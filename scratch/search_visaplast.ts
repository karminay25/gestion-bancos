import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

console.log('Searching for VISAPLAST 118459.2 in all sheets...');

wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, i) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('VISAPLAST') || rowStr.includes('118459')) {
            console.log(`Found in Sheet [${sheetName}] Row ${i}:`, row);
        }
    });
});

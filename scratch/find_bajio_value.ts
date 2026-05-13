import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BAJIO USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, i) => {
    if (row.some(v => v?.toString().includes('18641.92'))) {
        console.log(`Found 18641.92 in Row ${i}:`, row);
    }
});

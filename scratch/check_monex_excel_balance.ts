import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

const sheet = wb.Sheets['MONEX USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`--- MONEX USD Final Balance ---`);
let lastBalance = 0;
for (let i = data.length - 1; i >= 0; i--) {
    const val = data[i][7];
    if (typeof val === 'number') {
        lastBalance = val;
        break;
    }
}
console.log(`Sheet Last Balance:`, lastBalance);

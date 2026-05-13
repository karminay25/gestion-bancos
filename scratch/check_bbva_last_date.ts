import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

const sheet = wb.Sheets['BBVA PESOS'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`--- BBVA PESOS Last Movements ---`);
for (let i = data.length - 1; i >= 0; i--) {
    const date = data[i][0];
    if (typeof date === 'number') {
        console.log(`Row ${i} Date:`, new Date((date - 25569) * 86400000).toISOString().split('T')[0]);
        console.log(`Row ${i} Data:`, data[i]);
        break;
    }
}

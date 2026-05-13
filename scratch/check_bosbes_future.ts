import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BOSBES PESOS BBVA'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, i) => {
    const val = row[0];
    if (typeof val === 'number') {
        const d = new Date((val - 25569) * 86400000);
        if (d.getFullYear() >= 2026 && d.getMonth() >= 11) {
            console.log(`FUTURE DATE in BOSBES: Row ${i}: ${d.toISOString()}`);
        }
    }
});

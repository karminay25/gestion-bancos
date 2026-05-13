import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BBVA PESOS'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- BBVA PESOS Last Rows ---');
for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (typeof row[0] === 'number') {
        const date = new Date((row[0] - 25569) * 86400000).toISOString().split('T')[0];
        console.log(`Row ${i}: ${date} - ${row[2]} - Monto: ${row[4] || row[5]} - Saldo: ${row[6]}`);
        if (i < data.length - 20) break;
    }
}

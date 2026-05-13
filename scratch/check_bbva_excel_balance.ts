import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

['BBVA PESOS', 'BBVA DOLARES'].forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`--- ${sheetName} Final Balance ---`);
    let lastBalance = 0;
    for (let i = data.length - 1; i >= 0; i--) {
        const val = data[i][5];
        if (typeof val === 'number') {
            lastBalance = val;
            break;
        }
    }
    console.log(`Sheet Last Balance:`, lastBalance);
});

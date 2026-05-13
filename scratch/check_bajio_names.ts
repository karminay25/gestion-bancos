import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

['BAJIO PESOS', 'BAJIO USD'].forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`--- ${sheetName} Names ---`);
    const names = new Set();
    data.slice(5).forEach(row => {
        if (row[2]) names.add(row[2]);
    });
    console.log(Array.from(names));
});

import XLSX from 'xlsx';

const FILE_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(FILE_PATH);

['MONEX USD', 'BOSBES USD MONEX'].forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- ${sheetName} ---`);
    for (let i = data.length - 1; i >= Math.max(0, data.length - 10); i--) {
        console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
});

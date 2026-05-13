import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

wb.SheetNames.forEach(name => {
    const sheet = wb.Sheets[name];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, i) => {
        if (row.some(v => v?.toString().includes('10409.61'))) {
            console.log(`FOUND 10409.61 in Sheet "${name}" Row ${i}:`, row);
        }
    });
});

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/MONEX BOSBES DEL 010125AL28022026 CONTABILIDAD.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- MONEX BOSBES Rows ---');
for (let i = 0; i < 20; i++) {
    console.log(`Row ${i}:`, data[i]);
}

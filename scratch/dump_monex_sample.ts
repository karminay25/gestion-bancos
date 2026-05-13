import XLSX from 'xlsx';

const FILE_PATH = 'C:/proyectoResidencias/MovimientosContrato (8).xls';

try {
    const wb = XLSX.readFile(FILE_PATH);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('--- MONEX SAMPLE EXPORT ---');
    console.log('Sheet Name:', sheetName);
    data.slice(0, 30).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
} catch (e: any) {
    console.error('Error reading file:', e.message);
}

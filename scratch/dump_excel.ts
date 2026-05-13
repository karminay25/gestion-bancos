import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function dumpExcel() {
    try {
        const wb = XLSX.readFile(EXCEL_PATH);
        wb.SheetNames.forEach(name => {
            console.log(`\n--- Sheet: ${name} ---`);
            const sheet = wb.Sheets[name];
            const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.table(data.slice(0, 15));
        });
    } catch (e) {
        console.error('Error reading Excel:', e);
    }
}

dumpExcel();

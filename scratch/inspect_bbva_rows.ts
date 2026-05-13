import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function inspectBBVA() {
    try {
        const wb = XLSX.readFile(EXCEL_PATH);
        const sheetName = 'BBVA PESOS';
        const sheet = wb.Sheets[sheetName];
        if (!sheet) {
            console.log(`Sheet ${sheetName} not found`);
            return;
        }
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`--- Inspecting ${sheetName} ---`);
        for (let i = 0; i < 40; i++) {
            const row = data[i];
            if (!row) continue;
            console.log(`Row ${i}: F:${row[0]} | T:${row[2]} | I:${row[3]} | E:${row[4]} | S:${row[5]} | C:${row[8]}`);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

inspectBBVA();

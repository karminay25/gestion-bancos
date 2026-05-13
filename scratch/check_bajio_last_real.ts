import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function checkBajioLast() {
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets['BAJIO USD'];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`BAJIO USD total rows: ${data.length}`);
    
    // Check row by row for the last non-zero saldo in col 7 and col 17
    let last7 = 0;
    let last17 = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        if (row[7]) last7 = row[7];
        if (row[17]) last17 = row[17];
    }
    console.log(`Last Saldo in Col 7: ${last7}`);
    console.log(`Last Saldo in Col 17: ${last17}`);
}

checkBajioLast();

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function checkLength() {
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets['BBVA PESOS'];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`BBVA PESOS total rows: ${data.length}`);
    
    // Find last row with movements
    let lastMovement = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] && (data[i][3] || data[i][4])) {
            lastMovement = i;
            break;
        }
    }
    console.log(`Last movement at row: ${lastMovement}`);
    if (lastMovement !== -1) {
        console.log('Row content:', JSON.stringify(data[lastMovement]));
    }
}

checkLength();

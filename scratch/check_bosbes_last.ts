import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function checkBOSBES() {
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets['BOSBES PESOS BBVA'];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`BOSBES PESOS BBVA total rows: ${data.length}`);
    
    let lastMove = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] && (data[i][3] || data[i][4] || data[i][5])) {
            lastMove = i;
            break;
        }
    }
    console.log(`Last movement at row: ${lastMove}`);
    if (lastMove !== -1) {
        console.log('Row content:', JSON.stringify(data[lastMove]));
    }
}

checkBOSBES();

import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

['BAJIO PESOS', 'BAJIO USD'].forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`--- ${sheetName} Final Balance ---`);
    // Find last non-empty row with a number in the balance column
    let lastBalance = 0;
    const colIdx = sheetName === 'BAJIO PESOS' ? 5 : 7; // BAJIO USD Col 7 is Saldo (Dolares), Col 17 is Saldo (Credito)
    
    for (let i = data.length - 1; i >= 0; i--) {
        const val = data[i][colIdx];
        if (typeof val === 'number') {
            lastBalance = val;
            break;
        }
    }
    console.log(`Sheet Last Balance (Col ${colIdx}):`, lastBalance);

    if (sheetName === 'BAJIO USD') {
        let lastCreditoBalance = 0;
        for (let i = data.length - 1; i >= 0; i--) {
            const val = data[i][17];
            if (typeof val === 'number') {
                lastCreditoBalance = val;
                break;
            }
        }
        console.log(`Sheet Last Balance (Col 17 - Credito):`, lastCreditoBalance);
    }
});

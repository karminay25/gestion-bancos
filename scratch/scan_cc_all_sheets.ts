import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

const sheetsToCheck = [
    'BBVA PESOS', 'BBVA DOLARES', 'MONEX USD', 
    'BAJIO PESOS', 'BAJIO USD', 'BOSBES PESOS BBVA',
    'BOSBES USD BBVA ', 'BOSBES USD MONEX'
];

for (const sheetName of sheetsToCheck) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find header row
    let headerRow = -1;
    for (let i = 0; i < 15; i++) {
        const row = data[i];
        if (!row) continue;
        const rowStr = row.join('|').toLowerCase();
        if (rowStr.includes('c.d') || rowStr.includes('costo') || rowStr.includes('centro')) {
            headerRow = i;
            console.log(`\n=== ${sheetName} === Header at Row ${i}:`);
            console.log(row);
            break;
        }
    }
    
    if (headerRow === -1) {
        console.log(`\n=== ${sheetName} === NO COST CENTER COLUMN FOUND`);
        continue;
    }

    // Check a sample of rows with CC data
    let found = 0;
    for (let i = headerRow + 1; i < data.length && found < 5; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;
        // CC seems to be at col 9
        if (row[9] && row[9].toString().trim() !== '') {
            console.log(`  Row ${i}: Date=${row[0]} | Name=${row[2]} | Monto=${row[3]||row[4]} | CC=${row[9]}`);
            found++;
        }
    }
}

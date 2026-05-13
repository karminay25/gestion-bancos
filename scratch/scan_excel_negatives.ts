import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const ACCOUNTS = [
  { name: 'BBVA PESOS', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BBVA DOLARES', cols: [0,3,4,2,7,8,9,5] },
  { name: 'MONEX USD', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BAJIO PESOS', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BAJIO USD', sheet: 'BAJIO USD', cols: [0,5,6,1,4,2,3,7] },
  { name: 'CREDITO BAJIO', sheet: 'BAJIO USD', cols: [10,15,16,11,14,12,13,17] },
  { name: 'BOSBES PESOS BBVA', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BOSBES USD BBVA ', cols: [0,3,4,2,7,8,9,5] },
  { name: 'BOSBES USD MONEX', cols: [0,3,4,2,7,8,9,5] }
];

function scanNegatives() {
    const wb = XLSX.readFile(EXCEL_PATH);
    ACCOUNTS.forEach(cfg => {
        const sheet = wb.Sheets[cfg.sheet || cfg.name];
        if (!sheet) return;
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const m = cfg.cols;
        
        console.log(`\nScanning account: ${cfg.name}`);
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            const ing = row[m[1]];
            const egr = row[m[2]];
            const sal = row[m[7]];
            
            if (typeof ing === 'number' && ing < 0) console.log(`  Row ${i}: Negative INGRESO: ${ing}`);
            if (typeof egr === 'number' && egr < 0) console.log(`  Row ${i}: Negative EGRESO: ${egr}`);
            if (typeof sal === 'number' && sal < 0) console.log(`  Row ${i}: Negative SALDO: ${sal}`);
        }
    });
}

scanNegatives();

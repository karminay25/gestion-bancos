import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const m = [0,3,4,2,7,8,9,5]; // Fecha, Ing, Egr, Nom, Fac, Con, CC, Saldo

function p(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/[\$,\s]/g, '')) || 0;
    return 0;
}

const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['MONEX USD'];
const d: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let b = 0;
let lastE = 0;
let startIdx = -1;

for (let i = 0; i < d.length; i++) {
    const sVal = p(d[i][m[7]]);
    if (sVal !== 0 && typeof d[i][m[7]] === 'number') {
        b = sVal;
        lastE = sVal;
        startIdx = i;
        console.log(`[START] Row ${i+1} b=${b}`);
        break;
    }
}

for (let i = startIdx + 1; i < d.length; i++) {
    const row = d[i];
    if (!row) continue;
    
    const ing = p(row[m[1]]);
    const egr = p(row[m[2]]);
    const sVal = p(row[m[7]]);

    if (ing === 0 && egr === 0) {
        if (sVal !== 0 && typeof d[i][m[7]] === 'number') lastE = sVal;
        continue;
    }

    const monto = ing || egr;
    const tipo = ing > 0 ? 'Ingreso' : 'Egreso';
    b += (tipo === 'Ingreso' ? monto : -monto);
    if (lastE !== 0) lastE = (sVal !== 0 && typeof d[i][m[7]] === 'number') ? sVal : lastE;

    // Log the first few movements
    if (i < startIdx + 5) {
        console.log(`Row ${i+1} Move: ${tipo} ${monto} b=${b} ExcelSaldo=${sVal}`);
    }
}

console.log(`\nFinal b: ${b}`);
console.log(`Final Excel: ${lastE}`);
console.log(`Drift: ${lastE - b}`);

const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
const worksheet = workbook.Sheets['BBVA PESOS'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const parseDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        if(date) return new Date(date.y, date.m - 1, date.d);
        return null;
    }
    return null; 
};

const cleanNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = val.toString().replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

let previousSaldo = 28462.4; // Saldo inicial

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const fechaRaw = row[0];
    const fecha = parseDate(fechaRaw);
    if (!fecha) continue;

    if (fecha.getFullYear() !== 2026) continue;
    if (fecha.getMonth() >= 3) break; // Stop at April

    const ingreso = Math.abs(cleanNum(row[3]));
    const egreso = Math.abs(cleanNum(row[4]));
    if (ingreso === 0 && egreso === 0) continue;

    const explicitSaldo = cleanNum(row[5]);
    
    const calculatedSaldo = previousSaldo + ingreso - egreso;
    
    // Check if the calculated saldo matches the explicit saldo (with 1 dollar tolerance)
    if (Math.abs(calculatedSaldo - explicitSaldo) > 1 && explicitSaldo !== 0) {
        console.log(`\nMath break at ROW ${i}!`);
        console.log(`Fecha: ${fecha.toISOString().split('T')[0]}`);
        console.log(`Description: ${row[2]}`);
        console.log(`Ingreso: ${ingreso}, Egreso: ${egreso}`);
        console.log(`Previous Balance: ${previousSaldo}`);
        console.log(`Calculated Balance should be: ${calculatedSaldo}`);
        console.log(`But Excel says the Balance is: ${explicitSaldo}`);
        console.log(`Difference: ${calculatedSaldo - explicitSaldo}`);
        process.exit(1);
    }
    
    previousSaldo = explicitSaldo !== 0 ? explicitSaldo : calculatedSaldo;
}

console.log("Math is perfect!");

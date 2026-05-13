const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
const worksheet = workbook.Sheets['BBVA PESOS'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const cleanNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = val.toString().replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

for (let i = 0; i < 600; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;
    
    let originalIngreso = row[3];
    let originalEgreso = row[4];
    
    if (typeof originalIngreso === 'number' && originalIngreso < 0) {
        console.log(`NEGATIVE INGRESO at row ${i}:`, originalIngreso);
    }
    if (typeof originalEgreso === 'number' && originalEgreso < 0) {
        console.log(`NEGATIVE EGRESO at row ${i}:`, originalEgreso);
    }
}
